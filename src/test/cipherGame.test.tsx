import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CipherCodeMaker, type CipherCodeMakerProps } from '@/components/showdown/cipher/CipherCodeMaker';
import { CipherGame, CipherGuessHistory, type CipherGameProps } from '@/components/showdown/cipher/CipherGame';
import { CipherHelp } from '@/components/showdown/cipher/CipherHelp';
import type { CipherCode, CipherDraft, CipherGuess, CipherView } from '@/lib/showdown/cipher/types';

const code: CipherCode = ['red', 'red', 'blue', 'green'];
const blank: CipherDraft = [null, null, null, null];
const opponent = { displayName: 'Blair' };
const leave = vi.fn();
function view(overrides: Partial<CipherView> = {}): CipherView {
  return { phase: 'codebreaking', own_code: code, own_code_locked_at: '2026-11-01T00:00:00Z', opponent_code_locked: true,
    opponent_finished: false, invitation_expires_at: '2026-11-04T00:00:00Z', gameplay_started_at: '2026-11-01T00:01:00Z',
    gameplay_expires_at: '2026-11-08T00:01:00Z', own_guesses: [], own_attempt: { status: 'playing', guesses_used: 0, solved: false, finished_at: null }, results: null, ...overrides };
}
function guess(sequence = 1, exact = 2, color_only = 1): CipherGuess {
  return { sequence, exact, color_only, colors: ['orange', 'orange', 'orange', 'orange'], submitted_at: '2026-11-01T00:02:00Z' };
}
function Maker(overrides: Partial<CipherCodeMakerProps>) { return <CipherCodeMaker opponent={opponent} step="challenge" onLeave={leave} onLock={vi.fn().mockResolvedValue(undefined)} {...overrides} />; }
const gameBase = { attemptKey: 'duel-a:member-a', opponent, onLeave: leave, onLockCode: vi.fn().mockResolvedValue(undefined), onSurrender: vi.fn().mockResolvedValue(undefined) };
function Game({ initialDraft = blank, onChange, ...overrides }: Partial<CipherGameProps> & { initialDraft?: CipherDraft; onChange?: (draft: CipherDraft) => void }) {
  const [draft, setDraft] = useState<CipherDraft>(initialDraft);
  return <CipherGame {...gameBase} view={view()} onSubmitGuess={vi.fn().mockResolvedValue(undefined)} {...overrides} draft={draft} onDraftChange={next => { setDraft(next); onChange?.(next); }} />;
}
const color = (id: string) => screen.getByRole('button', { name: `Choose ${id}` });
const secretSlot = (index: number) => screen.getByRole('button', { name: new RegExp(`^Secret slot ${index}:`) });
const guessSlot = (index: number) => screen.getByRole('button', { name: new RegExp(`^Guess slot ${index}:`) });
async function settle() { await act(async () => {}); }
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); localStorage.clear(); });

describe('Cipher secret creation and immutable lock intent', () => {
  it('starts empty, permits duplicate colors and only sends the four-position code after explicit confirmation', async () => {
    const lock = vi.fn().mockResolvedValue(undefined), changed = vi.fn();
    render(<Maker onLock={lock} onDraftChange={changed} />);
    expect(screen.getByRole('button', { name: 'Lock & challenge' })).toBeDisabled();
    for (const id of code) fireEvent.click(color(id));
    expect(secretSlot(1)).toHaveAccessibleName('Secret slot 1: red');
    expect(secretSlot(2)).toHaveAccessibleName('Secret slot 2: red');
    expect(color('red')).toBeEnabled();
    expect(changed).toHaveBeenLastCalledWith(code);
    fireEvent.click(screen.getByRole('button', { name: 'Lock & challenge' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Once locked, your code cannot be changed. Your opponent will try to crack this combination.');
    expect(lock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(lock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Lock & challenge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock this code' }));
    await settle();
    expect(lock).toHaveBeenCalledExactlyOnceWith(code);
    expect(screen.getByRole('button', { name: 'Code locked' })).toBeDisabled();
    expect(color('purple')).toBeDisabled();
  });

  it('replaces, removes and resets individual positions while preserving nullable holes', () => {
    const changed = vi.fn();
    render(<Maker initialCode={code} onDraftChange={changed} />);
    fireEvent.click(secretSlot(2)); fireEvent.click(color('purple'));
    expect(changed).toHaveBeenLastCalledWith(['red', 'purple', 'blue', 'green']);
    fireEvent.click(secretSlot(3));
    fireEvent.click(screen.getByRole('button', { name: 'Remove selected secret peg' }));
    expect(changed).toHaveBeenLastCalledWith(['red', 'purple', null, 'green']);
    expect(secretSlot(4)).toHaveAccessibleName('Secret slot 4: green');
    expect(screen.getByRole('button', { name: 'Lock & challenge' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset secret code' }));
    expect(changed).toHaveBeenLastCalledWith(blank);
  });

  it('freezes an unacknowledged secret and retries the exact same combination', async () => {
    const lock = vi.fn().mockRejectedValueOnce(new Error('Acknowledgement lost')).mockResolvedValueOnce(undefined);
    render(<Maker initialCode={code} onLock={lock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lock & challenge' })); fireEvent.click(screen.getByRole('button', { name: 'Lock this code' }));
    await settle();
    expect(screen.getByRole('alert')).toHaveTextContent('Acknowledgement lost');
    expect(secretSlot(2)).toBeDisabled(); expect(color('orange')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset secret code' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry this code' }));
    await settle();
    expect(lock.mock.calls).toEqual([[code], [code]]);
  });

  it('restores a pending lock after reload before allowing any edit or new confirmation', async () => {
    const lock = vi.fn().mockResolvedValue(undefined);
    render(<Maker initialCode={blank} pendingCode={code} onLock={lock} />);
    expect(secretSlot(4)).toHaveAccessibleName('Secret slot 4: green');
    expect(secretSlot(4)).toBeDisabled(); expect(color('yellow')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retry this code' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry this code' }));
    await settle();
    expect(lock).toHaveBeenCalledExactlyOnceWith(code);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('guards duplicate confirmation clicks while the original lock remains in flight', async () => {
    let done!: () => void;
    const lock = vi.fn().mockReturnValue(new Promise<void>(resolve => { done = resolve; }));
    render(<Maker initialCode={code} onLock={lock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lock & challenge' }));
    const confirm = screen.getByRole('button', { name: 'Lock this code' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(lock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Locking code…' })).toBeDisabled();
    await act(async () => { done(); });
  });

  it('locks a recipient code directly without a second acceptance step and confirms declines', async () => {
    const lock = vi.fn().mockResolvedValue(undefined), decline = vi.fn().mockResolvedValue(undefined);
    render(<Maker step="accept" initialCode={code} onLock={lock} onDecline={decline} />);
    fireEvent.click(screen.getByRole('button', { name: 'Decline invitation' }));
    expect(decline).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep invitation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock & accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock this code' }));
    await settle();
    expect(lock).toHaveBeenCalledExactlyOnceWith(code);
    expect(decline).not.toHaveBeenCalled();
  });
});

describe('Cipher codebreaking and server receipts', () => {
  it('keeps the player’s own locked code visible and reads feedback only from official guess receipts', () => {
    const official = guess();
    render(<Game view={view({ own_guesses: [official], own_attempt: { status: 'playing', guesses_used: 1, solved: false, finished_at: null } })} />);
    expect(screen.getByRole('img', { name: 'Your secret position 2: red' })).toBeVisible();
    expect(screen.getByRole('img', { name: '2 exact matches, 1 color match in different positions' })).toBeVisible();
    const row = document.querySelector('[data-cipher-guess-row="1"]')!;
    expect(row.querySelectorAll('.cipher-clue.is-exact')).toHaveLength(2);
    expect(row.querySelectorAll('.cipher-clue.is-color')).toHaveLength(1);
    expect(row.querySelector('.cipher-history-pegs')).not.toContainElement(row.querySelector('.cipher-official-clues'));
    expect(document.querySelectorAll('[data-cipher-guess-row]')).toHaveLength(10);
    expect(screen.queryByText(/opponent.?s secret|timer|seconds remaining/i)).toBeNull();
  });

  it('provides keyboard-operable position selection, duplicates, targeted removal and reset in the active draft', () => {
    const changed = vi.fn();
    render(<Game onChange={changed} />);
    expect(screen.getByRole('button', { name: 'Submit guess' })).toBeDisabled();
    for (const id of code) fireEvent.click(color(id), { detail: 0 });
    expect(changed).toHaveBeenLastCalledWith(code);
    fireEvent.click(guessSlot(3), { detail: 0 }); fireEvent.click(color('yellow'), { detail: 0 });
    expect(guessSlot(3)).toHaveAccessibleName('Guess slot 3: yellow');
    fireEvent.click(guessSlot(2)); fireEvent.click(screen.getByRole('button', { name: 'Remove selected guess peg' }));
    expect(changed).toHaveBeenLastCalledWith(['red', null, 'yellow', 'green']);
    expect(screen.getByRole('button', { name: 'Submit guess' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset current guess' }));
    expect(changed).toHaveBeenLastCalledWith(blank);
  });

  it('does not add a fake history row or clue before the server confirms a submitted guess', async () => {
    let done!: () => void;
    const submit = vi.fn().mockReturnValue(new Promise<void>(resolve => { done = resolve; }));
    render(<Game initialDraft={code} onSubmitGuess={submit} />);
    const send = screen.getByRole('button', { name: 'Submit guess' });
    fireEvent.click(send); fireEvent.click(send);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.cipher-history-row.is-sealed')).toHaveLength(0);
    expect(color('green')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    await act(async () => { done(); });
    expect(screen.getByRole('button', { name: 'Guess sealed' })).toBeDisabled();
    expect(document.querySelectorAll('.cipher-clue.is-exact,.cipher-clue.is-color')).toHaveLength(0);
  });

  it('keeps a failed guess frozen for retry and opens a new draft only after a new official receipt', async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error('Guess response lost')).mockResolvedValueOnce(undefined);
    const props = { ...gameBase, view: view(), draft: code, onDraftChange: vi.fn(), onSubmitGuess: submit };
    const root = render(<CipherGame {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit guess' }));
    await settle();
    expect(color('purple')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Guess response lost');
    fireEvent.click(screen.getByRole('button', { name: 'Retry this guess' }));
    await settle();
    expect(submit).toHaveBeenCalledTimes(2);
    root.rerender(<CipherGame {...props} draft={blank} view={view({ own_guesses: [guess()], own_attempt: { status: 'playing', guesses_used: 1, solved: false, finished_at: null } })} />);
    expect(color('purple')).toBeEnabled();
    expect(guessSlot(1)).toHaveAccessibleName('Guess slot 1: empty');
    expect(document.querySelectorAll('.cipher-history-row.is-sealed')).toHaveLength(1);
  });

  it('requires surrender confirmation and never reveals the rival’s code while waiting for their attempt', async () => {
    const surrender = vi.fn().mockResolvedValue(undefined);
    const root = render(<Game onSurrender={surrender} />);
    fireEvent.click(screen.getByRole('button', { name: 'Surrender this attempt' }));
    expect(surrender).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Surrender counts as an unsuccessful attempt.');
    fireEvent.click(screen.getByRole('button', { name: 'Surrender attempt' }));
    await settle();
    expect(surrender).toHaveBeenCalledTimes(1);
    root.rerender(<Game view={view({ phase: 'attempt_sealed', own_attempt: { status: 'surrendered', guesses_used: 0, solved: false, finished_at: '2026-11-01T00:03:00Z' } })} />);
    expect(screen.getByTestId('cipher-attempt-sealed')).toHaveTextContent('Their code stays sealed until the result.');
    expect(screen.queryByTestId('cipher-composer')).toBeNull();
    expect(screen.getByRole('img', { name: 'Your secret position 4: green' })).toBeVisible();
  });

  it('shows waiting and ten-guess exhaustion as distinct states without reopening a code or draft', () => {
    const root = render(<Game view={view({ phase: 'waiting_code', opponent_code_locked: false, own_attempt: { status: 'pending', guesses_used: 0, solved: false, finished_at: null } })} />);
    expect(screen.getByText('Waiting for rival’s code')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Submit guess' })).toBeNull();
    const history = Array.from({ length: 10 }, (_, index) => guess(index + 1, 0, 0));
    root.rerender(<Game view={view({ phase: 'attempt_sealed', own_guesses: history, own_attempt: { status: 'exhausted', guesses_used: 10, solved: false, finished_at: '2026-11-01T00:04:00Z' } })} />);
    expect(screen.getByText('Ten guesses. Secret intact.')).toBeVisible();
    expect(document.querySelectorAll('.cipher-history-row.is-sealed')).toHaveLength(10);
    expect(screen.queryByTestId('cipher-composer')).toBeNull();
  });

  it('retires an old submit response when switching matches', async () => {
    let fail!: (error: Error) => void;
    const submit = vi.fn().mockReturnValue(new Promise<void>((_, reject) => { fail = reject; }));
    const props = { ...gameBase, view: view(), draft: code, onDraftChange: vi.fn(), onSubmitGuess: submit };
    const root = render(<CipherGame {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit guess' }));
    root.rerender(<CipherGame {...props} attemptKey="duel-b:member-a" draft={blank} />);
    await act(async () => { fail(new Error('Old match failed')); });
    expect(color('red')).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not let a late failure lock a newer official guess received on another device', async () => {
    let fail!: (error: Error) => void;
    const submit = vi.fn().mockReturnValue(new Promise<void>((_, reject) => { fail = reject; }));
    const props = { ...gameBase, view: view(), draft: code, onDraftChange: vi.fn(), onSubmitGuess: submit };
    const root = render(<CipherGame {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit guess' }));
    root.rerender(<CipherGame {...props} draft={blank} view={view({ own_guesses: [guess()], own_attempt: { status: 'playing', guesses_used: 1, solved: false, finished_at: null } })} />);
    await act(async () => { fail(new Error('Retired request response lost')); });
    expect(color('red')).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelectorAll('.cipher-history-row.is-sealed')).toHaveLength(1);
  });

  it('renders a reusable readonly history using exact server clue counts', () => {
    render(<CipherGuessHistory guesses={[guess(1, 4, 0)]} readOnly />);
    expect(screen.getByRole('img', { name: '4 exact matches, 0 color matches in different positions' })).toBeVisible();
    expect(screen.getByTestId('cipher-history').querySelectorAll('button')).toHaveLength(0);
  });
});

describe('Cipher short visual tutorial', () => {
  it('shows the duplicate-aware example and persists completion per user while keeping Help available', () => {
    const key = 'dh:showdown:cipher:tutorial:v1:member-a';
    render(<CipherHelp preferenceKey={key} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('Make a secret.');
    for (let index = 0; index < 3; index++) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('1 black · 2 white');
    expect(screen.getByLabelText('One exact match and two color matches in different positions')).toBeVisible();
    expect(localStorage.getItem(key)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Four exact matches')).toBeVisible();
    expect(screen.getByLabelText('Ten guesses available').children).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Fewer guesses wins');
    fireEvent.click(screen.getByRole('button', { name: 'Let’s play' }));
    expect(localStorage.getItem(key)).toBe('1');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'How to play Cipher Duel' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Make a secret.');
  });

  it('does not autoplay a completed guide for that user or mark an unfinished guide complete', () => {
    localStorage.setItem('guide-a', '1');
    const root = render(<CipherHelp preferenceKey="guide-a" />);
    expect(screen.queryByRole('dialog')).toBeNull();
    root.rerender(<CipherHelp preferenceKey="guide-b" />);
    const guide = screen.getByRole('dialog');
    fireEvent.click(within(guide).getByRole('button', { name: 'Close' }));
    expect(localStorage.getItem('guide-b')).toBeNull();
    expect(localStorage.getItem('guide-a')).toBe('1');
  });
});
