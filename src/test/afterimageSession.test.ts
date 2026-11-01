import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AfterimageSession, type AfterimageSessionClient } from '@/lib/showdown/afterimage/session';
import { ShowdownError } from '@/lib/showdown/service';
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
const sessions: AfterimageSession[] = [];
function setup(initial = detail(), storage = new DeviceStorage(), overrides: Partial<AfterimageSessionClient> = {}) {
  const client = {
    fetch: vi.fn().mockResolvedValue(initial), start: vi.fn().mockResolvedValue(detail({ phase: 'study' })),
    save: vi.fn().mockImplementation(async (input: ShowdownReconstructionInput) => detail({ placements: input.placements, revision: input.expectedRevision + 1, completed: input.roundNumber - 1 })),
    submit: vi.fn().mockImplementation(async (input: ShowdownReconstructionInput) => detail({ phase: 'ready', revision: 0, completed: input.roundNumber })), ...overrides,
  };
  const onDetail = vi.fn();
  const session = new AfterimageSession('memory-match', 'private-memory-cache', storage, client, onDetail);
  sessions.push(session); session.accept(initial); return { session, storage, client, onDetail };
}
const cached = (storage: DeviceStorage) => JSON.parse(storage.getItem('private-memory-cache') ?? 'null');
beforeEach(() => vi.useFakeTimers());
afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); vi.clearAllTimers(); vi.useRealTimers(); });

describe('Afterimage reconstruction recovery', () => {
  it('serializes an editable arrangement and preserves a reset made while an earlier save is in flight', async () => {
    const response = deferred<ShowdownMatchDetail>();
    const save = vi.fn().mockReturnValueOnce(response.promise).mockImplementation(async (input: ShowdownReconstructionInput) => detail({ placements: input.placements, revision: input.expectedRevision + 1 }));
    const { session } = setup(detail(), undefined, { save });
    session.changePlacements([first]); const syncing = session.flush(); session.changePlacements([]);
    response.resolve(detail({ placements: [first], revision: 2 })); await syncing;
    expect(save.mock.calls.map(([input]) => [input.expectedRevision, input.placements])).toEqual([[1, [first]], [2, []]]);
    expect(session.getSnapshot()).toMatchObject({ placements: [], saveState: 'saved', submitting: false });
  });
  it('recovers local placements after reload without storing scene art, answers, or restarting study', async () => {
    const original = setup(); original.session.changePlacements([first, other]); original.session.dispose();
    const restored = setup(detail(), original.storage);
    expect(restored.session.getSnapshot().placements).toEqual([first, other]);
    expect(cached(original.storage)).not.toHaveProperty('scene'); expect(cached(original.storage)).not.toHaveProperty('answers');
    await restored.session.retry(); expect(restored.client.start).not.toHaveBeenCalled(); expect(restored.client.save).toHaveBeenCalledOnce();
  });
  it('retains the exact request identity when an unacknowledged save is retried after reload', async () => {
    const save = vi.fn().mockRejectedValue(new ShowdownError('Connection interrupted'));
    const original = setup(detail(), undefined, { save }); original.session.changePlacements([first]);
    await expect(original.session.flush()).rejects.toThrow('Connection interrupted');
    const operation = save.mock.calls[0][0]; original.session.dispose();
    const restored = setup(detail(), original.storage); await restored.session.retry();
    expect(restored.client.save).toHaveBeenCalledExactlyOnceWith(operation);
  });
  it('recognizes a committed lost acknowledgement and preserves a later unsaved change on reload', async () => {
    const response = deferred<ShowdownMatchDetail>(); const original = setup(detail(), undefined, { save: vi.fn().mockReturnValue(response.promise) });
    original.session.changePlacements([first]); const pending = original.session.flush(); original.session.changePlacements([first, other]);
    response.reject(new ShowdownError('Acknowledgement lost')); await expect(pending).rejects.toThrow(); original.session.dispose();
    const restored = setup(detail({ placements: [first], revision: 2 }), original.storage);
    expect(restored.session.getSnapshot().placements).toEqual([first, other]); await restored.session.retry();
    expect(restored.client.save).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 2, placements: [first, other] }));
  });
  it('keeps one in-flight Ready request and its UUID when the connection fails and the user retries', async () => {
    const response = deferred<ShowdownMatchDetail>(); const start = vi.fn().mockReturnValueOnce(response.promise).mockResolvedValue(detail({ phase: 'study' }));
    const { session } = setup(detail({ phase: 'ready', revision: 0 }), undefined, { start });
    const opening = session.startStudy(); expect(session.startStudy()).toBe(opening);
    response.reject(new ShowdownError('Ready response lost')); await expect(opening).rejects.toThrow(); await session.startStudy();
    expect(start).toHaveBeenCalledTimes(2); expect(start.mock.calls[1]).toEqual(start.mock.calls[0]);
    expect(session.getSnapshot().starting).toBe(false);
  });
  it('resumes a server-expired study directly in reconstruction without a second start request', async () => {
    const { session, client } = setup(detail({ phase: 'study' }), undefined, { fetch: vi.fn().mockResolvedValue(detail()) });
    await session.refresh(); session.changePlacements([first]); await session.flush();
    expect(client.start).not.toHaveBeenCalled(); expect(client.save).toHaveBeenCalledOnce();
  });
  it('restores another device’s authoritative placements on revision conflict instead of overwriting them', async () => {
    const authoritative = detail({ placements: [other], revision: 4 });
    const { session, client } = setup(detail(), undefined, { save: vi.fn().mockRejectedValue(new ShowdownError('Changed on another device', 'conflict')), fetch: vi.fn().mockResolvedValue(authoritative) });
    session.changePlacements([first]); await expect(session.flush()).rejects.toThrow('Changed on another device');
    expect(session.getSnapshot().placements).toEqual([other]); expect(client.save).toHaveBeenCalledOnce();
  });
  it('does not let a late old-round save replace the next scene or discard its unsaved reconstruction', async () => {
    const response = deferred<ShowdownMatchDetail>(); const { session, onDetail } = setup(detail(), undefined, { save: vi.fn().mockReturnValueOnce(response.promise).mockImplementation(async (input: ShowdownReconstructionInput) => detail({ completed: 1, revision: input.expectedRevision + 1, placements: input.placements })) });
    session.changePlacements([first]); const pending = session.flush(); session.accept(detail({ completed: 1 })); session.changePlacements([other]);
    response.resolve(detail({ placements: [first], revision: 2 })); await pending;
    expect(session.getSnapshot().placements).toEqual([other]); expect(onDetail.mock.calls.every(([value]) => value.current_round === 2)).toBe(true);
  });
  it('allows an empty final arrangement and submits it once while duplicate calls wait for the same operation', async () => {
    const response = deferred<ShowdownMatchDetail>(); const submit = vi.fn().mockReturnValue(response.promise);
    const { session } = setup(detail(), undefined, { submit }); const firstSubmit = session.submit(); const secondSubmit = session.submit();
    response.resolve(detail({ completed: 1, phase: 'ready', revision: 0 })); await Promise.all([firstSubmit, secondSubmit]);
    expect(submit).toHaveBeenCalledOnce(); expect(submit.mock.calls[0][0].placements).toEqual([]);
  });
  it('rejects a submission when the server closes the challenge without accepting that round', async () => {
    const closed = detail(); closed.challenge.status = 'expired'; closed.can_play = false; closed.readonly_reason = 'Challenge expired';
    const { session, storage } = setup(detail(), undefined, { submit: vi.fn().mockResolvedValue(closed) });
    await expect(session.submit()).rejects.toMatchObject({ code: 'closed' }); expect(session.getSnapshot().blocked).toBe(true); expect(cached(storage)).toBeNull();
  });
  it('rejects invalid or duplicate local placements without saving or returning correctness feedback', async () => {
    const { session, client } = setup(); session.changePlacements([first, { ...other, slot_id: first.slot_id }]);
    expect(session.getSnapshot().placements).toEqual([]); expect(session.getSnapshot().error).toMatch(/at most once/);
    session.changePlacements([{ object_id: 'unknown-object', slot_id: 'place-1' }]); expect(client.save).not.toHaveBeenCalled();
  });
  it('ignores stale progress after an attempt or challenge is sealed', () => {
    const { session } = setup(detail({ completed: 3 })); expect(session.accept(detail())).toBe(false); session.changePlacements([first]);
    expect(session.getSnapshot()).toMatchObject({ placements: [], blocked: true });
  });
  it('never replaces reconstruction placements with a delayed pre-expiry study response', () => {
    const { session } = setup(); session.changePlacements([first]);
    expect(session.accept(detail({ phase: 'study' }))).toBe(false);
    expect(session.getSnapshot().placements).toEqual([first]);
  });
});
