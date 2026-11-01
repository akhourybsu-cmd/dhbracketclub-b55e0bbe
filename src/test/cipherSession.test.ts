import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CipherSession, type CipherSessionClient } from '@/lib/showdown/cipher/session';
import { ShowdownError } from '@/lib/showdown/service';
import { validateCipherView } from '@/lib/showdown/cipher/engine';
import type { CipherCodeInput, CipherGuessInput, CipherSurrenderInput, ShowdownMatchDetail } from '@/lib/showdown/types';
import type { CipherCode, CipherDraft } from '@/lib/showdown/cipher/types';
import { cipherFixtureDetail as detail, CIPHER_CODE_A, CIPHER_CODE_B, CIPHER_TEST_B } from './fixtures/cipher';

class DeviceStore {
  values = new Map<string, string>();
  getItem = (key: string) => this.values.get(key) ?? null;
  setItem = (key: string, value: string) => { this.values.set(key, value); };
  removeItem = (key: string) => { this.values.delete(key); };
}
const draft: CipherCode = ['red','blue','green','yellow'];
const nextDraft: CipherCode = ['blue','green','yellow','red'];
const blank: CipherDraft = [null,null,null,null];
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject };
}
const sessions: CipherSession[] = [];
function setup(initial = detail(), storage = new DeviceStore(), overrides: Partial<CipherSessionClient> = {}, key = `cipher:${initial.challenge.id}:${initial.challenge.challenger_id}`) {
  const client = {
    fetch: vi.fn().mockResolvedValue(initial),
    lock: vi.fn().mockImplementation(async (input: CipherCodeInput) => detail({ userId: CIPHER_TEST_B, ownCode: input.code })),
    guess: vi.fn().mockImplementation(async (input: CipherGuessInput) => detail({ guesses: [...Array.from({ length: input.expectedGuessCount }, () => draft), input.guess] })),
    surrender: vi.fn().mockImplementation(async (input: CipherSurrenderInput) => detail({ phase: 'attempt_sealed', attemptStatus: 'surrendered', guesses: Array.from({ length: input.expectedGuessCount }, () => draft) })),
    ...overrides,
  };
  const onDetail = vi.fn();
  const session = new CipherSession(initial.challenge.id, key, storage, client, onDetail);
  sessions.push(session); session.accept(initial); return { session, storage, client, onDetail, key };
}
const cached = (store: DeviceStore, key: string) => JSON.parse(store.getItem(key) ?? 'null');
const jsonbOrder = (value: unknown): unknown => Array.isArray(value) ? value.map(jsonbOrder) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.length - b.length || a.localeCompare(b)).map(([key, item]) => [key, jsonbOrder(item)])) : value;
beforeEach(() => vi.useFakeTimers());
afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); vi.clearAllTimers(); vi.useRealTimers(); });

describe('Cipher shared-detail fixture validity', () => {
  it('produces real two-member states with empty puzzle rounds, accurate receipts and positive72-hour clocks', () => {
    for (const phase of ['create_code','waiting_code','codebreaking','attempt_sealed','completed','closed'] as const) {
      const fixture = detail({ phase });
      expect(fixture.rounds).toEqual([]); expect(fixture.current_round).toBeNull();
      expect(fixture.challenge.players).toHaveLength(2);
      expect(() => validateCipherView(fixture.cipher, { completed: phase === 'completed', participantIds: [fixture.challenge.challenger_id, fixture.challenge.recipient_id] })).not.toThrow();
      const view = fixture.cipher!;
      if (view.gameplay_started_at) expect(Date.parse(view.gameplay_expires_at!) - Date.parse(view.gameplay_started_at)).toBe(72 * 60 * 60 * 1000);
    }
  });
});

describe('Cipher explicit actions and recovery', () => {
  it('keeps incomplete guesses locally through reload and isolated from other matches without submitting anything', () => {
    const original = setup(); original.session.changeDraft(['red',null,'green',null]); original.session.dispose();
    const restored = setup(detail(), original.storage);
    expect(restored.session.getSnapshot().draft).toEqual(['red',null,'green',null]);
    expect(restored.client.guess).not.toHaveBeenCalled(); expect(restored.client.lock).not.toHaveBeenCalled();
    const other = setup(detail({ id: 'another-cipher' }), original.storage);
    expect(other.session.getSnapshot().draft).toEqual(blank);
    expect(JSON.stringify(cached(original.storage, original.key))).not.toMatch(/feedback|opponent|own_code|results/);
  });
  it('freezes an unknown code lock, preserves its UUID through reload and refuses a different secret', async () => {
    const lock = vi.fn().mockRejectedValue(new ShowdownError('Lock acknowledgement lost'));
    const original = setup(detail({ phase: 'create_code' }), undefined, { lock });
    await expect(original.session.lockCode(CIPHER_CODE_B)).rejects.toThrow('acknowledgement lost');
    const operation = lock.mock.calls[0][0]; original.session.changeDraft(CIPHER_CODE_A);
    expect(original.session.getSnapshot().pendingCode).toEqual(CIPHER_CODE_B);
    await expect(original.session.lockCode(CIPHER_CODE_A)).rejects.toThrow(/original locked code/);
    original.session.dispose();
    const restored = setup(detail({ phase: 'create_code' }), original.storage); await restored.session.retry();
    expect(restored.client.lock).toHaveBeenCalledExactlyOnceWith(operation);
    expect(restored.session.getSnapshot()).toMatchObject({ pendingCode: null, draft: blank, busy: false });
  });
  it('recovers a pending lock already confirmed by GET without replaying it or exposing any rival secret', async () => {
    const lock = vi.fn().mockRejectedValue(new ShowdownError('Lock response lost'));
    const original = setup(detail({ phase: 'create_code' }), undefined, { lock });
    await expect(original.session.lockCode(CIPHER_CODE_B)).rejects.toThrow(); original.session.dispose();
    const server = detail({ userId: CIPHER_TEST_B });
    const restored = setup(server, original.storage); await restored.session.retry();
    expect(restored.client.lock).not.toHaveBeenCalled(); expect(restored.client.fetch).toHaveBeenCalledOnce();
    expect(restored.session.getSnapshot()).toMatchObject({ pendingCode: null, draft: blank });
    expect(server.cipher!.results).toBeNull(); expect(server.cipher).not.toHaveProperty('opponent_code');
  });
  it('submits a complete guess once with the current official count while duplicate taps await that request', async () => {
    const response = deferred<ShowdownMatchDetail>(), guess = vi.fn().mockReturnValue(response.promise);
    const { session } = setup(detail({ guesses: [nextDraft] }), undefined, { guess });
    session.changeDraft(draft); const first = session.submitGuess(), second = session.submitGuess();
    session.changeDraft(CIPHER_CODE_B);
    expect(guess).toHaveBeenCalledOnce(); expect(guess.mock.calls[0][0]).toMatchObject({ expectedGuessCount: 1, guess: draft });
    expect(session.getSnapshot()).toMatchObject({ draft, busy: true, submitting: true });
    response.resolve(detail({ guesses: [nextDraft,draft] })); await Promise.all([first,second]);
    expect(guess).toHaveBeenCalledOnce(); expect(session.getSnapshot()).toMatchObject({ draft: blank, busy: false, submitting: false });
  });
  it('retries an unacknowledged guess with the same UUID and count after reload without consuming an extra guess', async () => {
    const guess = vi.fn().mockRejectedValue(new ShowdownError('Guess acknowledgement lost'));
    const original = setup(detail(), undefined, { guess }); original.session.changeDraft(draft);
    await expect(original.session.submitGuess()).rejects.toThrow(); const operation = guess.mock.calls[0][0]; original.session.dispose();
    const restored = setup(detail(), original.storage); await restored.session.retry();
    expect(restored.client.guess).toHaveBeenCalledExactlyOnceWith(operation);
    expect(restored.onDetail.mock.calls[0][0].cipher!.own_guesses).toHaveLength(1);
    expect(restored.session.getSnapshot()).toMatchObject({ draft: blank, saveState: 'saved' });
  });
  it.each(['success','error'] as const)('keeps the next draft when polling confirms a guess before its late RPC %s', async outcome => {
    const response = deferred<ShowdownMatchDetail>(), guess = vi.fn().mockReturnValue(response.promise);
    const { session } = setup(detail(), undefined, { guess }); session.changeDraft(draft); const pending = session.submitGuess();
    expect(session.accept(jsonbOrder(detail({ guesses: [draft] })) as ShowdownMatchDetail)).toBe(true);
    session.changeDraft(nextDraft);
    if (outcome === 'success') response.resolve(detail({ guesses: [draft] })); else response.reject(new ShowdownError('Old response failed'));
    await pending;
    expect(session.getSnapshot()).toMatchObject({ draft: nextDraft, saveState: 'saved', busy: false, error: null });
    expect(guess).toHaveBeenCalledOnce();
  });
  it('queues a new explicit guess after a polling ACK without a stale prior response clearing or duplicating it', async () => {
    const response = deferred<ShowdownMatchDetail>();
    const guess = vi.fn().mockReturnValueOnce(response.promise).mockResolvedValue(detail({ guesses: [draft,nextDraft] }));
    const { session } = setup(detail(), undefined, { guess }); session.changeDraft(draft); const first = session.submitGuess();
    session.accept(detail({ guesses: [draft] })); session.changeDraft(nextDraft); const second = session.submitGuess();
    response.reject(new ShowdownError('Old response failed')); await Promise.all([first,second]);
    expect(guess.mock.calls.map(([input]) => [input.expectedGuessCount,input.guess])).toEqual([[0,draft],[1,nextDraft]]);
    expect(guess.mock.calls[1][0].requestId).not.toBe(guess.mock.calls[0][0].requestId);
    expect(session.getSnapshot()).toMatchObject({ draft: blank, busy: false, error: null });
  });
  it('restores a newer device’s official receipt on conflict and never automatically guesses the discarded draft', async () => {
    const authoritative = detail({ guesses: [nextDraft] });
    const { session, client } = setup(detail(), undefined, { guess: vi.fn().mockRejectedValue(new ShowdownError('History changed', 'conflict')), fetch: vi.fn().mockResolvedValue(authoritative) });
    session.changeDraft(draft); await expect(session.submitGuess()).rejects.toThrow('History changed');
    expect(session.getSnapshot()).toMatchObject({ draft: blank, busy: false, saveState: 'saved' });
    await session.retry(); expect(client.guess).toHaveBeenCalledOnce(); expect(client.fetch).toHaveBeenCalledTimes(2);
  });
  it('accepts semantically identical JSONB histories but rejects rewritten receipts, changed secrets and regressed history', () => {
    const { session } = setup(detail({ guesses: [draft] })); session.changeDraft(nextDraft);
    expect(session.accept(jsonbOrder(detail({ guesses: [draft] })) as ShowdownMatchDetail)).toBe(true);
    const rewritten = detail({ guesses: [draft] }); rewritten.cipher!.own_guesses[0].exact = 2;
    expect(session.accept(rewritten)).toBe(false);
    expect(session.accept(detail({ ownCode: CIPHER_CODE_B, guesses: [draft] }))).toBe(false);
    expect(session.accept(detail())).toBe(false); expect(session.getSnapshot().draft).toEqual(nextDraft);
  });
  it('surrenders with zero guesses exactly once and rejects a closed challenge that never accepted a pending guess', async () => {
    const { session, client } = setup(); await session.surrender();
    expect(client.surrender).toHaveBeenCalledWith(expect.objectContaining({ expectedGuessCount: 0 }));
    expect(client.guess).not.toHaveBeenCalled(); expect(session.getSnapshot().blocked).toBe(true);
    const closed = setup(detail(), undefined, { guess: vi.fn().mockResolvedValue(detail({ phase: 'closed' })) });
    closed.session.changeDraft(draft); await expect(closed.session.submitGuess()).rejects.toMatchObject({ code: 'closed' });
    expect(closed.session.getSnapshot()).toMatchObject({ blocked: true, submitting: false });
    expect(closed.storage.getItem(closed.key)).toBeNull();
  });
  it('does not mistake a remote guess for a surrender acknowledgement and exposes a retryable conflict', async () => {
    const response = deferred<ShowdownMatchDetail>();
    const surrender = vi.fn().mockReturnValueOnce(response.promise).mockResolvedValue(detail({ phase: 'attempt_sealed', attemptStatus: 'surrendered', guesses: [nextDraft] }));
    const { session, client } = setup(detail(), undefined, { surrender, fetch: vi.fn().mockResolvedValue(detail({ guesses: [nextDraft] })) });
    const pending = session.surrender();
    session.accept(detail({ guesses: [nextDraft] }));
    response.reject(new ShowdownError('Another device guessed before surrender', 'conflict'));
    await expect(pending).rejects.toMatchObject({ code: 'conflict' });
    expect(session.getSnapshot()).toMatchObject({ blocked: false, busy: false, error: 'Another device guessed before surrender' });
    await session.surrender();
    expect(surrender.mock.calls.map(([input]) => input.expectedGuessCount)).toEqual([0,1]);
    expect(client.guess).not.toHaveBeenCalled(); expect(session.getSnapshot().blocked).toBe(true);
  });
  it('retires an in-flight request when changing scope so its eventual response cannot rewrite another match’s draft', async () => {
    const response = deferred<ShowdownMatchDetail>();
    const old = setup(detail(), undefined, { guess: vi.fn().mockReturnValue(response.promise) }); old.session.changeDraft(draft); const pending = old.session.submitGuess(); old.session.dispose();
    const current = setup(detail({ id: 'new-cipher', clubId: 'club-2' }), old.storage); current.session.changeDraft(['purple',null,'orange',null]);
    response.resolve(detail({ guesses: [draft] })); await pending;
    expect(old.onDetail).not.toHaveBeenCalled(); expect(current.session.getSnapshot().draft).toEqual(['purple',null,'orange',null]);
    expect(current.client.guess).not.toHaveBeenCalled();
  });
});
