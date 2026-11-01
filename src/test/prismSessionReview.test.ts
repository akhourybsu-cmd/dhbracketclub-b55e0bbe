import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShowdownRoundSession, type RoundSessionClient } from '@/lib/showdown/roundSession';
import { ShowdownError } from '@/lib/showdown/service';
import { replayActions } from '@/lib/showdown/prism/engine';
import type { PrismAction, PrismPuzzle } from '@/lib/showdown/prism/types';
import type { ShowdownMatchDetail, ShowdownRoundInput } from '@/lib/showdown/types';

const first: PrismAction = { type: 'rotate', cell: 12 };
const solved: PrismAction[] = [first, { type: 'rotate', cell: 22 }];
const reset: PrismAction[] = [first, { type: 'reset' }];
const record = { wins: 0, losses: 0, draws: 0, played: 0 };
function puzzle(round: number): PrismPuzzle {
  return { id: `prism-review-${round}`, version: 1, difficulty: round === 1 ? 'easy' : round === 2 ? 'medium' : 'hard', width: 5, height: 5,
    tiles: Array.from({ length: 25 }, (_, cell) => cell === 10 ? { kind: 'emitter', direction: 'E', color: 'cyan' } : cell === 24 ? { kind: 'receiver', color: 'cyan', label: 'A' } : cell === 12 || cell === 22 ? { kind: 'mirror', orientation: '/', rotatable: true } : { kind: 'empty' }),
  };
}
function detail(actions: PrismAction[] = [], revision = 0, completed = 0): ShowdownMatchDetail {
  const current = completed < 3 ? completed + 1 : null;
  return { challenge: { id: 'prism-review', club_id: 'club-1', game_key: 'prism_break', rules_version: 1, status: 'active', challenger_id: 'member-a', recipient_id: 'member-b',
    created_at: '2026-11-01T00:00:00Z', expires_at: '2026-11-04T00:00:00Z', completed_at: null, winner_id: null, outcome: null, rematch_of: null,
    players: [
      { user_id: 'member-a', display_name: 'Alex', avatar_url: null, started_at: '2026-11-01T00:00:00Z', finished_at: null, rounds_completed: completed, total_score: completed * 500, solved_count: completed, rotations: completed * 2 },
      { user_id: 'member-b', display_name: 'Blair', avatar_url: null, started_at: null, finished_at: null, rounds_completed: 0, total_score: null, solved_count: null, rotations: null },
    ] }, rounds: [1,2,3].map(number => ({ round_number: number, difficulty: puzzle(number).difficulty, puzzle_id: puzzle(number).id, puzzle_version: 1, title: `Review board ${number}`,
      puzzle: number <= completed || number === current ? puzzle(number) : null, minimum_rotations: number <= completed ? 2 : null,
      me: { actions: number <= completed ? solved : number === current ? actions : [], revision: number <= completed ? 2 : number === current ? revision : 0, submitted: number <= completed, skipped: false, solved: number <= completed, score: number <= completed ? 500 : null, rotations: number <= completed ? 2 : number === current ? actions.filter(action => action.type === 'rotate').length : 0 }, opponent: null,
    })), current_round: current, can_play: completed < 3, can_decline: false, can_cancel: false, readonly_reason: null,
    record, rivalry: { ...record, opponent_id: 'member-b', display_name: 'Blair', avatar_url: null } };
}
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
const jsonbActions = (actions: PrismAction[]): PrismAction[] => actions.map(action => action.type === 'rotate' ? { cell: action.cell, type: action.type } : { type: action.type });
const sessions: ShowdownRoundSession[] = [];
function setup(initial = detail(), storage = new DeviceStorage(), overrides: Partial<RoundSessionClient> = {}) {
  const client = { fetch: vi.fn().mockResolvedValue(initial),
    save: vi.fn().mockImplementation(async (input: ShowdownRoundInput) => detail(jsonbActions(input.actions), input.expectedRevision + 1)),
    submit: vi.fn().mockResolvedValue(detail([], 0, 1)), ...overrides };
  const session = new ShowdownRoundSession('prism-review', 'prism-review-cache', storage, client, vi.fn());
  sessions.push(session); session.accept(initial); return { session, client, storage };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); vi.clearAllTimers(); vi.useRealTimers(); });

describe('Prism transport-order recovery regressions', () => {
  it('keeps a reset appended during a save when JSONB reorders action keys and never refunds its prior rotation', async () => {
    const ack = deferred<ShowdownMatchDetail>();
    const save = vi.fn().mockReturnValueOnce(ack.promise).mockImplementation(async (input: ShowdownRoundInput) => detail(jsonbActions(input.actions), input.expectedRevision + 1));
    const { session } = setup(detail(), undefined, { save });
    session.changeActions([first]); const syncing = session.flush(); session.changeActions(reset);
    ack.resolve(detail(jsonbActions([first]), 1)); await syncing;
    expect(save.mock.calls.map(([input]) => input.actions)).toEqual([[first], reset]);
    expect(session.getSnapshot()).toMatchObject({ actions: reset, error: null, saveState: 'saved' });
    const replay = replayActions(puzzle(1), session.getSnapshot().actions);
    expect(replay.rotations).toBe(1); expect(replay.orientations[12]).toBe('/'); expect(replay.solved).toBe(false);
  });
  it('retains a pending solve submission behind an autosave response with reordered action keys', async () => {
    const ack = deferred<ShowdownMatchDetail>();
    const { session, client } = setup(detail(), undefined, { save: vi.fn().mockReturnValue(ack.promise) });
    session.changeActions([first]); const syncing = session.flush(); session.changeActions(solved);
    const submitting = session.submit(solved, 'solved');
    ack.resolve(detail(jsonbActions([first]), 1)); await Promise.all([syncing, submitting]);
    expect(client.submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ actions: solved, expectedRevision: 1 }), false);
    expect(replayActions(puzzle(1), solved)).toMatchObject({ solved: true, rotations: 2 });
    expect(session.getSnapshot()).toMatchObject({ actions: [], submitting: false, saveState: 'saved' });
  });
  it('recovers a local reset after a committed save loses its acknowledgement and JSONB changes property order', async () => {
    const ack = deferred<ShowdownMatchDetail>();
    const originalSave = vi.fn().mockReturnValue(ack.promise);
    const original = setup(detail(), undefined, { save: originalSave });
    original.session.changeActions([first]); const syncing = original.session.flush(); original.session.changeActions(reset);
    ack.reject(new ShowdownError('Acknowledgement lost')); await expect(syncing).rejects.toThrow(); original.session.dispose();
    const restored = setup(detail(jsonbActions([first]), 1), original.storage); await restored.session.retry();
    expect(restored.client.save).toHaveBeenNthCalledWith(1, expect.objectContaining({ actions: [first], expectedRevision: 0, requestId: originalSave.mock.calls[0][0].requestId }));
    expect(restored.client.save).toHaveBeenNthCalledWith(2, expect.objectContaining({ actions: reset, expectedRevision: 1 }));
    expect(restored.session.getSnapshot()).toMatchObject({ actions: reset, error: null, saveState: 'saved' });
    expect(replayActions(puzzle(1), restored.session.getSnapshot().actions).rotations).toBe(1);
  });
});
