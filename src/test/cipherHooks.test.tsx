import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useShowdownMatch } from '@/hooks/useShowdown';
import { ShowdownError } from '@/lib/showdown/service';
import type { CipherCodeInput, CipherGuessInput, ShowdownMatchDetail } from '@/lib/showdown/types';
import type { CipherCode, CipherDraft } from '@/lib/showdown/cipher/types';
import { cipherFixtureDetail as detail, CIPHER_CODE_A, CIPHER_CODE_B } from './fixtures/cipher';

const wire = vi.hoisted(() => ({
  userId: 'member-a', clubId: 'club-1', match: vi.fn(), lock: vi.fn(), guess: vi.fn(), surrender: vi.fn(), create: vi.fn(), act: vi.fn(),
  prismSave: vi.fn(), prismSubmit: vi.fn(), memorySave: vi.fn(), memorySubmit: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: wire.userId ? { id: wire.userId } : null, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: wire.clubId ? { id: wire.clubId } : null, loading: false }) }));
vi.mock('@/lib/showdown/service', async () => ({
  ...await vi.importActual<typeof import('@/lib/showdown/service')>('@/lib/showdown/service'),
  fetchShowdownMatch: wire.match, lockCipherCode: wire.lock, submitCipherGuess: wire.guess, surrenderCipher: wire.surrender,
  createShowdown: wire.create, actOnShowdown: wire.act, saveShowdownRound: wire.prismSave, submitShowdownRound: wire.prismSubmit,
  saveAfterimageReconstruction: wire.memorySave, submitAfterimageReconstruction: wire.memorySubmit,
}));

const draft: CipherCode = ['red', 'blue', 'green', 'yellow'];
const nextDraft: CipherCode = ['green', 'blue', 'red', 'orange'];
const blank: CipherDraft = [null, null, null, null];
const queryKey = (user = 'member-a', club = 'club-1') => ['showdown', user, club, 'match', 'cipher-match'];
const storageKey = (user = 'member-a', club = 'club-1') => `dh:showdown:cipher:match:v1:${user}:${club}:cipher-match`;
const clients: QueryClient[] = [];
function provider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  clients.push(client);
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); wire.userId = 'member-a'; wire.clubId = 'club-1';
  wire.match.mockImplementation(async () => detail({ userId: wire.userId, clubId: wire.clubId }));
  wire.lock.mockImplementation(async (input: CipherCodeInput) => detail({ userId: wire.userId, clubId: wire.clubId, ownCode: input.code }));
  wire.guess.mockImplementation(async (input: CipherGuessInput) => detail({ userId: wire.userId, clubId: wire.clubId, guesses: [...Array.from({ length: input.expectedGuessCount }, () => draft), input.guess] }));
  wire.surrender.mockResolvedValue(detail({ phase: 'attempt_sealed' }));
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); localStorage.clear(); });

describe('Cipher real Showdown hook integration', () => {
  it('opens an unaccepted recipient invitation without a mutation and adopts a code only after the explicit lock receipt', async () => {
    wire.userId = 'member-b';
    wire.match.mockResolvedValue(detail({ phase: 'create_code' }));
    const locked = deferred<ShowdownMatchDetail>();
    wire.lock.mockReturnValue(locked.promise);
    const { client, wrapper } = provider();
    const { result } = renderHook(() => useShowdownMatch('cipher-match'), { wrapper });
    await waitFor(() => expect(result.current.data?.cipher?.phase).toBe('create_code'));
    expect(wire.match).toHaveBeenCalledExactlyOnceWith('cipher-match', true);
    expect(result.current.data?.challenge.status).toBe('pending');
    expect(result.current.data?.can_decline).toBe(true);
    expect(result.current.data?.can_play).toBe(false);
    expect(result.current.data?.cipher?.own_code).toBeNull();
    expect(wire.lock).not.toHaveBeenCalled(); expect(wire.act).not.toHaveBeenCalled(); expect(wire.guess).not.toHaveBeenCalled();
    act(() => result.current.onCipherDraftChange(CIPHER_CODE_B));
    let opening!: Promise<void>;
    act(() => { opening = result.current.lockCipherCode(CIPHER_CODE_B); });
    expect(result.current.cipherPendingCode).toEqual(CIPHER_CODE_B);
    expect(result.current.submitting).toBe(true);
    expect(result.current.data?.cipher?.own_code).toBeNull();
    expect(wire.lock).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ challengeId: 'cipher-match', code: CIPHER_CODE_B, requestId: expect.any(String) }));
    await act(async () => { locked.resolve(detail({ userId: 'member-b', ownCode: CIPHER_CODE_B })); await opening; });
    await waitFor(() => expect(result.current.data?.cipher?.phase).toBe('codebreaking'));
    expect(result.current.data?.challenge.status).toBe('active');
    expect(result.current.data?.can_play).toBe(true);
    expect(result.current.cipherDraft).toEqual(blank);
    expect(result.current.cipherPendingCode).toBeNull();
    expect(result.current.submitting).toBe(false);
    expect(client.getQueryData<ShowdownMatchDetail>(queryKey('member-b'))?.cipher?.own_code).toEqual(CIPHER_CODE_B);
    expect(result.current.data?.cipher?.results).toBeNull();
    expect(wire.act).not.toHaveBeenCalled();
  });

  it('persists an editable nullable draft without consuming a guess, then sends the official count and clears only on receipt', async () => {
    wire.match.mockResolvedValue(detail({ guesses: [draft] }));
    const receipt = deferred<ShowdownMatchDetail>();
    wire.guess.mockReturnValue(receipt.promise);
    const { client, wrapper } = provider();
    const { result } = renderHook(() => useShowdownMatch('cipher-match'), { wrapper });
    await waitFor(() => expect(result.current.data?.cipher?.own_guesses).toHaveLength(1));
    const partial: CipherDraft = ['green', null, 'red', null];
    act(() => result.current.onCipherDraftChange(partial));
    await act(async () => { await result.current.checkpoint(); });
    expect(JSON.parse(localStorage.getItem(storageKey())!).draft).toEqual(partial);
    expect(wire.guess).not.toHaveBeenCalled();
    expect(wire.prismSave).not.toHaveBeenCalled(); expect(wire.memorySave).not.toHaveBeenCalled();
    act(() => result.current.onCipherDraftChange(nextDraft));
    let sending!: Promise<void>, duplicate!: Promise<void>;
    act(() => { sending = result.current.submitCipherGuess(); duplicate = result.current.submitCipherGuess(); });
    expect(wire.guess).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ challengeId: 'cipher-match', guess: nextDraft, expectedGuessCount: 1, requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) }));
    expect(result.current.data?.cipher?.own_guesses).toHaveLength(1);
    expect(result.current.cipherDraft).toEqual(nextDraft);
    const official = detail({ guesses: [draft, nextDraft] });
    await act(async () => { receipt.resolve(official); await Promise.all([sending, duplicate]); });
    await waitFor(() => expect(result.current.data?.cipher?.own_guesses).toHaveLength(2));
    expect(result.current.cipherDraft).toEqual(blank);
    expect(result.current.submitting).toBe(false);
    expect(client.getQueryData<ShowdownMatchDetail>(queryKey())?.cipher?.own_guesses).toEqual(official.cipher!.own_guesses);
    expect(JSON.parse(localStorage.getItem(storageKey())!).count).toBe(2);
    expect(wire.guess).toHaveBeenCalledTimes(1);
    expect(wire.prismSubmit).not.toHaveBeenCalled(); expect(wire.memorySubmit).not.toHaveBeenCalled();
  });

  it('prevents late unlocked and old-history polls from rewinding the code, receipts or a new local draft', async () => {
    wire.userId = 'member-b';
    const beforeLock = deferred<ShowdownMatchDetail>(), beforeGuess = deferred<ShowdownMatchDetail>();
    wire.match.mockResolvedValueOnce(detail({ phase: 'create_code' })).mockReturnValueOnce(beforeLock.promise).mockReturnValueOnce(beforeGuess.promise);
    wire.guess.mockResolvedValue(detail({ userId: 'member-b', ownCode: CIPHER_CODE_B, guesses: [draft] }));
    const { client, wrapper } = provider();
    const { result } = renderHook(() => useShowdownMatch('cipher-match'), { wrapper });
    await waitFor(() => expect(result.current.data?.cipher?.phase).toBe('create_code'));
    let pollingLock!: Promise<void>;
    act(() => { pollingLock = result.current.refresh(); });
    await act(async () => { await result.current.lockCipherCode(CIPHER_CODE_B); });
    await waitFor(() => expect(result.current.data?.cipher?.phase).toBe('codebreaking'));
    await act(async () => { beforeLock.resolve(detail({ phase: 'create_code' })); await pollingLock; });
    expect(result.current.data?.cipher?.own_code).toEqual(CIPHER_CODE_B);
    expect(result.current.data?.challenge.status).toBe('active');
    let pollingGuess!: Promise<void>;
    act(() => { pollingGuess = result.current.refresh(); });
    act(() => result.current.onCipherDraftChange(draft));
    await act(async () => { await result.current.submitCipherGuess(); });
    act(() => result.current.onCipherDraftChange(nextDraft));
    await act(async () => { beforeGuess.resolve(detail({ userId: 'member-b', ownCode: CIPHER_CODE_B })); await pollingGuess; });
    expect(result.current.data?.cipher?.own_guesses).toHaveLength(1);
    expect(result.current.data?.cipher?.own_code).toEqual(CIPHER_CODE_B);
    expect(result.current.cipherDraft).toEqual(nextDraft);
    expect(client.getQueryData<ShowdownMatchDetail>(queryKey('member-b'))?.cipher?.own_guesses).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(storageKey('member-b'))!).draft).toEqual(nextDraft);
    expect(wire.guess).toHaveBeenCalledTimes(1);
  });

  it('isolates late RPCs and device drafts across account and club A → B → A', async () => {
    const stale = deferred<ShowdownMatchDetail>();
    let returningToA = false;
    wire.match.mockImplementation(async () => detail({ userId: wire.userId, clubId: wire.clubId, guesses: wire.userId === 'member-a' && returningToA ? [draft, nextDraft] : [] }));
    wire.guess.mockReturnValue(stale.promise);
    const { client, wrapper } = provider();
    const { result, rerender } = renderHook(() => useShowdownMatch('cipher-match'), { wrapper });
    await waitFor(() => expect(result.current.data?.challenge.club_id).toBe('club-1'));
    act(() => result.current.onCipherDraftChange(draft));
    let sending!: Promise<void>;
    act(() => { sending = result.current.submitCipherGuess(); });
    wire.userId = 'member-b'; wire.clubId = 'club-2'; rerender();
    await waitFor(() => expect(result.current.data?.challenge.club_id).toBe('club-2'));
    const bDraft: CipherDraft = [null, 'orange', null, 'purple'];
    act(() => result.current.onCipherDraftChange(bDraft));
    await act(async () => { await client.invalidateQueries({ queryKey: queryKey() }); });
    returningToA = true; wire.userId = 'member-a'; wire.clubId = 'club-1'; rerender();
    await waitFor(() => expect(result.current.data?.cipher?.own_guesses).toHaveLength(2));
    act(() => result.current.onCipherDraftChange(CIPHER_CODE_A));
    await act(async () => { stale.resolve(detail({ guesses: [draft] })); await sending; });
    expect(result.current.data?.cipher?.own_guesses).toHaveLength(2);
    expect(result.current.cipherDraft).toEqual(CIPHER_CODE_A);
    expect(client.getQueryData<ShowdownMatchDetail>(queryKey())?.cipher?.own_guesses).toHaveLength(2);
    expect(client.getQueryData<ShowdownMatchDetail>(queryKey('member-b', 'club-2'))?.cipher?.own_guesses).toEqual([]);
    expect(JSON.parse(localStorage.getItem(storageKey('member-b', 'club-2'))!).draft).toEqual(bDraft);
    expect(wire.guess).toHaveBeenCalledTimes(1);
  });

  it('restores a lost-acknowledgement guess through a new hook instance with its original UUID and count', async () => {
    const receipt = deferred<ShowdownMatchDetail>();
    wire.guess.mockRejectedValueOnce(new ShowdownError('Guess acknowledgement lost')).mockReturnValue(receipt.promise);
    const firstProvider = provider();
    const first = renderHook(() => useShowdownMatch('cipher-match'), { wrapper: firstProvider.wrapper });
    await waitFor(() => expect(first.result.current.data?.cipher?.phase).toBe('codebreaking'));
    act(() => first.result.current.onCipherDraftChange(draft));
    await act(async () => { await expect(first.result.current.submitCipherGuess()).rejects.toThrow('acknowledgement lost'); });
    const sent = wire.guess.mock.calls[0][0];
    expect(first.result.current.saveState).toBe('offline');
    first.unmount();
    const restoredProvider = provider();
    const restored = renderHook(() => useShowdownMatch('cipher-match'), { wrapper: restoredProvider.wrapper });
    await waitFor(() => expect(restored.result.current.cipherDraft).toEqual(draft));
    let retry!: Promise<void>;
    act(() => { retry = restored.result.current.retrySave(); });
    expect(wire.guess).toHaveBeenCalledTimes(2);
    expect(wire.guess.mock.calls[1][0]).toEqual(sent);
    await act(async () => { receipt.resolve(detail({ guesses: [draft] })); await retry; });
    await waitFor(() => expect(restored.result.current.data?.cipher?.own_guesses).toHaveLength(1));
    expect(restored.result.current.cipherDraft).toEqual(blank);
    expect(restored.result.current.saveState).toBe('saved');
    expect(wire.lock).not.toHaveBeenCalled();
  });

  it('invalidates existing DH score and Feats on completion and requires a fresh secret before a rematch', async () => {
    wire.guess.mockResolvedValue(detail({ phase: 'completed' }));
    const { client, wrapper } = provider();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useShowdownMatch('cipher-match'), { wrapper });
    await waitFor(() => expect(result.current.data?.cipher?.phase).toBe('codebreaking'));
    expect(invalidate).not.toHaveBeenCalled();
    expect(result.current.data?.cipher?.results).toBeNull();
    act(() => result.current.onCipherDraftChange(CIPHER_CODE_B));
    await act(async () => { await result.current.submitCipherGuess(); });
    await waitFor(() => expect(result.current.data?.challenge.status).toBe('completed'));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dh-feats', 'member-a', 'club-1'] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dh-score', 'member-a', 'club-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['showdown', 'member-a', 'club-1', 'lobby'] });
    expect(result.current.data?.cipher?.results).toHaveLength(2);
    expect(result.current.data?.can_play).toBe(false);
    expect(localStorage.getItem(storageKey())).toBeNull();
    await expect(result.current.rematch()).rejects.toThrow('Create a fresh secret code');
    expect(wire.create).not.toHaveBeenCalled();
  });
});
