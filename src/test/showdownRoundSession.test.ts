import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShowdownRoundSession, type RoundSessionClient } from '@/lib/showdown/roundSession';
import { ShowdownError } from '@/lib/showdown/service';
import { replayActions } from '@/lib/showdown/prism/engine';
import type { PrismAction, PrismPuzzle } from '@/lib/showdown/prism/types';
import type { ShowdownMatchDetail, ShowdownRoundInput } from '@/lib/showdown/types';

// A real, unsolved two-turn board. Production catalog content is deliberately not
// loaded into the client-session tests or the production gameplay bundle.
function puzzle(round = 1): PrismPuzzle {
  return { id: `outbox-round-${round}`, version: 1, difficulty: round === 1 ? 'easy' : round === 2 ? 'medium' : 'hard', width: 5, height: 5,
    tiles: Array.from({ length: 25 }, (_, cell) => cell === 10 ? { kind: 'emitter', direction: 'E', color: 'cyan' } : cell === 4 ? { kind: 'receiver', color: 'cyan', label: 'A' } : cell === 2 || cell === 12 ? { kind: 'mirror', orientation: '\\', rotatable: true } : { kind: 'empty' }),
  };
}
const turn: PrismAction = { type: 'rotate', cell: 12 };
const otherTurn: PrismAction = { type: 'rotate', cell: 2 };
const reset: PrismAction = { type: 'reset' };
const solved: PrismAction[] = [turn, otherTurn];
const record = { wins: 0, losses: 0, draws: 0, played: 0 };
function detail(actions: PrismAction[] = [], revision = 0, completed = 0): ShowdownMatchDetail {
  const current = completed < 3 ? completed + 1 : null;
  return {
    challenge: { id: 'challenge-1', club_id: 'club-1', game_key: 'prism_break', rules_version: 1, status: 'active', challenger_id: 'member-a', recipient_id: 'member-b', created_at: '2026-11-01T00:00:00Z', expires_at: '2026-11-04T00:00:00Z', completed_at: null, winner_id: null, outcome: null, rematch_of: null,
      players: [
        { user_id: 'member-a', display_name: 'Alex', avatar_url: null, started_at: '2026-11-01T00:00:00Z', finished_at: completed === 3 ? '2026-11-01T00:02:00Z' : null, rounds_completed: completed, total_score: completed * 500, solved_count: completed, rotations: completed * 2 },
        { user_id: 'member-b', display_name: 'Blair', avatar_url: null, started_at: null, finished_at: null, rounds_completed: 0, total_score: null, solved_count: null, rotations: null },
      ] },
    rounds: [1, 2, 3].map(number => {
      const submitted = number <= completed;
      const roundActions = submitted ? solved : number === current ? actions : [];
      return { round_number: number, difficulty: number === 1 ? 'easy' : number === 2 ? 'medium' : 'hard', puzzle_id: puzzle(number).id, puzzle_version: 1, title: `Board ${number}`, puzzle: submitted || number === current ? puzzle(number) : null, minimum_rotations: submitted ? 2 : null,
        me: { actions: roundActions, revision: submitted ? 2 : number === current ? revision : 0, submitted, skipped: false, solved: submitted, score: submitted ? 500 : null, rotations: replayActions(puzzle(number), roundActions).rotations }, opponent: null };
    }),
    current_round: current, can_play: completed < 3, can_decline: false, can_cancel: false, readonly_reason: null,
    record, rivalry: { ...record, opponent_id: 'member-b', display_name: 'Blair', avatar_url: null },
  };
}
function expired(): ShowdownMatchDetail {
  const value = detail();
  return { ...value, challenge: { ...value.challenge, status: 'expired' }, current_round: null, can_play: false, readonly_reason: 'Challenge expired' };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
class DeviceStorage {
  values = new Map<string, string>();
  getItem = (key: string) => this.values.get(key) ?? null;
  setItem = (key: string, value: string) => { this.values.set(key, value); };
  removeItem = (key: string) => { this.values.delete(key); };
}
const sessions: ShowdownRoundSession[] = [];
function setup(initial = detail(), storage = new DeviceStorage(), overrides: Partial<RoundSessionClient> = {}) {
  const client = {
    fetch: vi.fn().mockResolvedValue(initial),
    save: vi.fn().mockImplementation(async (input: ShowdownRoundInput) => detail(input.actions, input.expectedRevision + 1, input.roundNumber - 1)),
    submit: vi.fn().mockImplementation(async (input: ShowdownRoundInput) => detail([], 0, input.roundNumber)),
    ...overrides,
  };
  const onDetail = vi.fn();
  const session = new ShowdownRoundSession('challenge-1', 'member-a:club-1:challenge-1', storage, client, onDetail);
  sessions.push(session);
  session.accept(initial);
  return { session, client, storage, onDetail };
}
const readCache = (storage: DeviceStorage) => JSON.parse(storage.getItem('member-a:club-1:challenge-1') ?? 'null');
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); vi.clearAllTimers(); vi.useRealTimers(); });

describe('Durable Showdown round outbox', () => {
  it('serializes newer moves after an earlier save and carries forward the acknowledged revision', async () => {
    const first = deferred<ShowdownMatchDetail>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockImplementation(async (input: ShowdownRoundInput) => detail(input.actions, input.expectedRevision + 1));
    const { session } = setup(detail(), undefined, { save });
    session.changeActions([turn]);
    const syncing = session.flush();
    session.changeActions([turn, reset]);
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve(detail([turn], 1));
    await syncing;
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0][0]).toMatchObject({ expectedRevision: 0, actions: [turn] });
    expect(save.mock.calls[1][0]).toMatchObject({ expectedRevision: 1, actions: [turn, reset] });
    expect(save.mock.calls[1][0].requestId).not.toBe(save.mock.calls[0][0].requestId);
    expect(session.getSnapshot()).toMatchObject({ actions: [turn, reset], saveState: 'saved', submitting: false });
  });

  it('retries a lost committed save with its identical persisted request UUID after reload', async () => {
    const firstSave = vi.fn().mockRejectedValue(new ShowdownError('Connection lost after commit'));
    const original = setup(detail(), undefined, { save: firstSave });
    original.session.changeActions([turn]);
    await expect(original.session.flush()).rejects.toThrow('Connection lost');
    const originalRequest = firstSave.mock.calls[0][0];
    expect(readCache(original.storage).pending.requestId).toBe(originalRequest.requestId);
    original.session.dispose();
    const duplicateSave = vi.fn().mockResolvedValue(detail([turn], 1));
    const restored = setup(detail([turn], 1), original.storage, { save: duplicateSave });
    await restored.session.retry();
    expect(duplicateSave).toHaveBeenCalledExactlyOnceWith(originalRequest);
    expect(restored.session.getSnapshot()).toMatchObject({ actions: [turn], saveState: 'saved' });
    expect(readCache(original.storage).pending).toBeNull();
  });

  it('preserves an unsent suffix on reload and never removes rotations when a reset is restored', async () => {
    const storage = new DeviceStorage();
    const initial = setup(detail(), storage);
    initial.session.changeActions([turn, reset]);
    initial.session.dispose();
    const restored = setup(detail(), storage);
    expect(restored.session.getSnapshot().actions).toEqual([turn, reset]);
    expect(replayActions(puzzle(), restored.session.getSnapshot().actions).rotations).toBe(1);
    restored.session.changeActions([turn, reset, turn]);
    await restored.session.flush();
    expect(replayActions(puzzle(), restored.session.getSnapshot().actions).rotations).toBe(2);
    expect(restored.client.save).toHaveBeenCalledWith(expect.objectContaining({ actions: [turn, reset, turn] }));
    restored.session.changeActions([]);
    expect(restored.session.getSnapshot().actions).toEqual([turn, reset, turn]);
    expect(restored.session.getSnapshot().error).toMatch(/cannot be removed/);
  });

  it('recovers the server checkpoint when a device cache cannot be decoded', async () => {
    const storage = new DeviceStorage();
    storage.setItem('member-a:club-1:challenge-1', '{partially unavailable browser data');
    const restored = setup(detail([turn], 3), storage);
    expect(restored.session.getSnapshot()).toMatchObject({ actions: [turn], saveState: 'saved', blocked: false });
    expect(readCache(storage)).toMatchObject({ version: 1, actions: [turn], pending: null, finish: null });
  });

  it('does not borrow another member’s unsynced moves from the same browser', () => {
    const storage = new DeviceStorage();
    const original = setup(detail(), storage);
    original.session.changeActions([turn]);
    original.session.dispose();
    const differentMember = new ShowdownRoundSession('challenge-1', 'member-b:club-1:challenge-1', storage, original.client, vi.fn());
    sessions.push(differentMember);
    differentMember.accept(detail());
    expect(differentMember.getSnapshot().actions).toEqual([]);
    expect(readCache(storage).actions).toEqual([turn]);
    expect(JSON.parse(storage.getItem('member-b:club-1:challenge-1')!)).toMatchObject({ actions: [], pending: null, finish: null });
  });

  it('queues a solved submission behind an in-flight checkpoint rather than sending an overlapping revision', async () => {
    const saveResponse = deferred<ShowdownMatchDetail>(), submitResponse = deferred<ShowdownMatchDetail>();
    const save = vi.fn().mockReturnValue(saveResponse.promise), submit = vi.fn().mockReturnValue(submitResponse.promise);
    const { session, onDetail } = setup(detail(), undefined, { save, submit });
    session.changeActions([turn]);
    const saving = session.flush();
    session.changeActions(solved);
    const submitting = session.submit(solved, 'solved');
    expect(submit).not.toHaveBeenCalled();
    saveResponse.resolve(detail([turn], 1));
    await Promise.resolve(); await Promise.resolve();
    expect(submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ roundNumber: 1, expectedRevision: 1, actions: solved }), false);
    submitResponse.resolve(detail([], 0, 1));
    await Promise.all([saving, submitting]);
    expect(session.getSnapshot()).toMatchObject({ actions: [], submitting: false, saveState: 'saved' });
    expect(onDetail.mock.calls.at(-1)?.[0].current_round).toBe(2);
  });

  it('does not lose a same-turn submission behind an already-idle flush promise', async () => {
    const { session, client } = setup();
    const idle = session.flush();
    const submitting = session.submit([], 'skipped');
    await Promise.all([idle, submitting]);
    expect(client.submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ roundNumber: 1, actions: [] }), true);
    expect(session.getSnapshot().submitting).toBe(false);
  });

  it('replaces an old round outbox when the server already accepted its ranked submission', async () => {
    const original = setup(detail(), undefined, { submit: vi.fn().mockRejectedValue(new ShowdownError('Response lost')) });
    original.session.changeActions(solved);
    await expect(original.session.submit(solved, 'solved')).rejects.toThrow('Response lost');
    expect(readCache(original.storage).finish.actions).toEqual(solved);
    original.session.dispose();
    const restored = setup(detail([], 0, 1), original.storage);
    await restored.session.flush();
    expect(restored.client.submit).not.toHaveBeenCalled();
    expect(restored.session.getSnapshot()).toMatchObject({ actions: [], submitting: false });
    expect(readCache(original.storage)).toMatchObject({ round: 2, actions: [], pending: null, finish: null });
  });

  it('restores another device’s authoritative conflicting log without rewriting it', async () => {
    const save = vi.fn().mockRejectedValue(new ShowdownError('A newer save exists', 'conflict'));
    const fetch = vi.fn().mockResolvedValue(detail([otherTurn], 2));
    const { session, storage, onDetail } = setup(detail([turn], 1), undefined, { save, fetch });
    session.changeActions([turn, reset]);
    await expect(session.flush()).rejects.toThrow('A newer save');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().actions).toEqual([otherTurn]);
    expect(readCache(storage)).toMatchObject({ actions: [otherTurn], pending: null, finish: null });
    expect(onDetail.mock.calls.at(-1)?.[0].rounds[0].me.actions).toEqual([otherTurn]);
    await session.retry();
    expect(save).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().saveState).toBe('saved');
  });

  it('ignores a delayed checkpoint response after a newer round was adopted', async () => {
    const response = deferred<ShowdownMatchDetail>();
    const { session, storage, onDetail } = setup(detail(), undefined, { save: vi.fn().mockReturnValue(response.promise) });
    session.changeActions([turn]);
    const oldSave = session.flush();
    session.accept(detail([], 0, 1));
    response.resolve(detail([turn], 1));
    await oldSave;
    expect(session.getSnapshot().actions).toEqual([]);
    expect(readCache(storage)).toMatchObject({ round: 2, actions: [], pending: null, finish: null });
    expect(onDetail.mock.calls.some(([value]) => value.current_round === 1)).toBe(false);
  });

  it('does not erase a queued next-round finish when an older submission response arrives', async () => {
    const oldResponse = deferred<ShowdownMatchDetail>();
    const submit = vi.fn().mockReturnValueOnce(oldResponse.promise).mockImplementation(async (input: ShowdownRoundInput) => detail([], 0, input.roundNumber));
    const { session } = setup(detail(), undefined, { submit });
    session.changeActions(solved);
    const oldSubmission = session.submit(solved, 'solved');
    session.accept(detail([], 0, 1));
    session.changeActions(solved);
    const nextSubmission = session.submit(solved, 'solved');
    oldResponse.resolve(detail([], 0, 1));
    await Promise.all([oldSubmission, nextSubmission]);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls.map(([input]) => input.roundNumber)).toEqual([1, 2]);
    expect(session.getSnapshot()).toMatchObject({ actions: [], submitting: false, saveState: 'saved' });
  });

  it('does not discard next-round moves when an older round request rejects as a conflict', async () => {
    const oldResponse = deferred<ShowdownMatchDetail>();
    const save = vi.fn().mockReturnValueOnce(oldResponse.promise).mockImplementation(async (input: ShowdownRoundInput) => detail(input.actions, input.expectedRevision + 1, input.roundNumber - 1));
    const fetch = vi.fn().mockResolvedValue(detail([], 0, 1));
    const { session, storage } = setup(detail(), undefined, { save, fetch });
    session.changeActions([turn]);
    const oldSave = session.flush();
    session.accept(detail([], 0, 1));
    session.changeActions([turn]);
    oldResponse.reject(new ShowdownError('The first round was finished on another device', 'conflict'));
    await oldSave.catch(() => {});
    await session.retry();
    expect(session.getSnapshot()).toMatchObject({ actions: [turn], saveState: 'saved', error: null });
    expect(readCache(storage)).toMatchObject({ round: 2, actions: [turn], pending: null, finish: null });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({ roundNumber: 2, actions: [turn], expectedRevision: 0 });
  });

  it('never reopens an expired challenge from a late active response', async () => {
    const response = deferred<ShowdownMatchDetail>();
    const { session, storage, onDetail } = setup(detail(), undefined, { save: vi.fn().mockReturnValue(response.promise) });
    session.changeActions([turn]);
    const oldSave = session.flush();
    session.accept(expired());
    response.resolve(detail([turn], 1));
    await oldSave;
    expect(session.getSnapshot().blocked).toBe(true);
    expect(storage.getItem('member-a:club-1:challenge-1')).toBeNull();
    expect(onDetail.mock.calls.some(([value]) => value.can_play)).toBe(false);
  });

  it('retires in-flight work on disposal and rejects a stale terminal callback without writing another outbox', async () => {
    const response = deferred<ShowdownMatchDetail>();
    const { session, storage, onDetail } = setup(detail(), undefined, { save: vi.fn().mockReturnValue(response.promise) });
    session.changeActions([turn]);
    const oldSave = session.flush();
    const beforeDispose = storage.getItem('member-a:club-1:challenge-1');
    session.dispose();
    response.resolve(detail([turn], 1));
    await oldSave;
    expect(onDetail).not.toHaveBeenCalled();
    await expect(session.submit([turn], 'skipped')).rejects.toThrow();
    expect(storage.getItem('member-a:club-1:challenge-1')).toBe(beforeDispose);
  });

  it('treats a closed submission response as expiration, not a successful score receipt', async () => {
    const submit = vi.fn().mockResolvedValue(expired());
    const { session, storage, onDetail } = setup(detail(), undefined, { submit });
    session.changeActions(solved);
    await expect(session.submit(solved, 'solved')).rejects.toMatchObject({ code: 'closed' });
    expect(session.getSnapshot()).toMatchObject({ blocked: true, submitting: false });
    expect(onDetail.mock.calls.at(-1)?.[0].challenge.status).toBe('expired');
    expect(storage.getItem('member-a:club-1:challenge-1')).toBeNull();
  });
});
