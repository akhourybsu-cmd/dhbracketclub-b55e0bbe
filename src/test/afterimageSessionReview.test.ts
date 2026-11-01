import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AfterimageSession, type AfterimageSessionClient } from '@/lib/showdown/afterimage/session';
import { ShowdownError } from '@/lib/showdown/service';
import type { AfterimagePlacement } from '@/lib/showdown/afterimage/types';
import type { ShowdownMatchDetail, ShowdownReconstructionInput } from '@/lib/showdown/types';
import { afterimageFixtureDetail as detail } from './fixtures/afterimage';

const first = { object_id: 'object-book', slot_id: 'place-1' };
const other = { object_id: 'object-lantern', slot_id: 'place-2' };
class DeviceStorage {
  values = new Map<string, string>();
  getItem = (key: string) => this.values.get(key) ?? null;
  setItem = (key: string, value: string) => { this.values.set(key, value); };
  removeItem = (key: string) => { this.values.delete(key); };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject };
}
// JSON objects have no significant property ordering. PostgreSQL jsonb serializes
// the shorter slot_id key first; a transport/JSON round trip can reorder keys.
const jsonbPlacements = (placements: AfterimagePlacement[]) => placements.map(({ object_id, slot_id }) => ({ slot_id, object_id }));
const sessions: AfterimageSession[] = [];
function setup(initial = detail(), storage = new DeviceStorage(), overrides: Partial<AfterimageSessionClient> = {}) {
  const client = {
    fetch: vi.fn().mockResolvedValue(initial), start: vi.fn().mockResolvedValue(detail({ phase: 'study' })),
    save: vi.fn().mockImplementation(async (input: ShowdownReconstructionInput) => detail({ placements: jsonbPlacements(input.placements), revision: input.expectedRevision + 1 })),
    submit: vi.fn().mockResolvedValue(detail({ completed: 1, phase: 'ready', revision: 0 })), ...overrides,
  };
  const session = new AfterimageSession('memory-match', 'review-cache', storage, client, vi.fn());
  sessions.push(session); session.accept(initial); return { session, storage, client };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); vi.clearAllTimers(); vi.useRealTimers(); });

describe('Afterimage independent transport-order regressions', () => {
  it('keeps edits made during an autosave when its JSONB response uses a different property order', async () => {
    const ack = deferred<ShowdownMatchDetail>();
    const save = vi.fn().mockReturnValueOnce(ack.promise).mockImplementation(async (input: ShowdownReconstructionInput) => detail({ placements: jsonbPlacements(input.placements), revision: input.expectedRevision + 1 }));
    const { session } = setup(detail(), undefined, { save });
    session.changePlacements([first]); const syncing = session.flush();
    session.changePlacements([first, other]);
    ack.resolve(detail({ placements: jsonbPlacements([first]), revision: 2 }));
    await syncing;
    expect(save.mock.calls.map(([input]) => input.placements)).toEqual([[first], [first, other]]);
    expect(session.getSnapshot()).toMatchObject({ placements: [first, other], error: null, saveState: 'saved' });
  });
  it('recovers a committed lost ACK without discarding subsequent local edits when server key order differs', async () => {
    const ack = deferred<ShowdownMatchDetail>();
    const original = setup(detail(), undefined, { save: vi.fn().mockReturnValue(ack.promise) });
    original.session.changePlacements([first]); const syncing = original.session.flush();
    original.session.changePlacements([first, other]);
    ack.reject(new ShowdownError('Acknowledgement lost')); await expect(syncing).rejects.toThrow('Acknowledgement lost');
    original.session.dispose();
    const restored = setup(detail({ placements: jsonbPlacements([first]), revision: 2 }), original.storage);
    expect(restored.session.getSnapshot().placements).toEqual([first, other]);
    await restored.session.retry();
    expect(restored.client.save).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 2, placements: [first, other] }));
  });
  it('preserves a final submission queued behind an autosave despite reordered ACK keys', async () => {
    const ack = deferred<ShowdownMatchDetail>();
    const { session, client } = setup(detail(), undefined, { save: vi.fn().mockReturnValue(ack.promise) });
    session.changePlacements([first]); const syncing = session.flush();
    session.changePlacements([first, other]); const submitting = session.submit();
    ack.resolve(detail({ placements: jsonbPlacements([first]), revision: 2 }));
    await Promise.all([syncing, submitting]);
    expect(client.submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ placements: [first, other], expectedRevision: 2 }));
    expect(session.getSnapshot()).toMatchObject({ placements: [], saveState: 'saved', submitting: false });
  });
});
