import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShowdownPage from '@/pages/ShowdownPage';
import CipherCreatePage from '@/pages/CipherCreatePage';
import { CipherResults } from '@/components/showdown/cipher/CipherResults';
import { calculateFeedback } from '@/lib/showdown/cipher/engine';
import type { CipherCode, CipherDraft, CipherGuess, CipherStats } from '@/lib/showdown/cipher/types';
import type { ShowdownChallenge, ShowdownLobbyData, ShowdownMatchDetail } from '@/lib/showdown/types';

const wire = vi.hoisted(() => ({
  userId: 'alex', clubId: 'club', lobby: null as ShowdownLobbyData | null, create: vi.fn(), prepare: vi.fn(), complete: vi.fn(), draftChange: vi.fn(), rematch: vi.fn(),
  draft: [null, null, null, null] as CipherDraft, pendingCode: null as CipherCode | null,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: wire.userId }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: wire.clubId, name: 'Dry My Horse' }, loading: false }) }));
vi.mock('@/hooks/useShowdown', () => ({ useShowdownLobby: () => ({ data: wire.lobby, loading: false, refreshing: false, error: null, refresh: vi.fn(), create: wire.create, act: vi.fn(), busy: false, hasMore: false, loadMore: vi.fn(), loadingMore: false }) }));
vi.mock('@/hooks/useCipherSetup', () => ({ useCipherSetupDraft: (recipient: string) => ({ draft: wire.draft, onDraftChange: wire.draftChange, pendingCode: wire.pendingCode, prepare: wire.prepare, complete: wire.complete, ready: Boolean(recipient) }) }));
vi.mock('@/components/showdown/cipher/CipherCodeMaker', () => ({ CipherCodeMaker: (props: { onLock: (code: CipherCode) => Promise<void>; onLeave?: () => void; busy?: boolean; initialCode?: CipherDraft; pendingCode?: CipherCode | null; onDraftChange?: (draft: CipherDraft) => void; step: string; error?: string | null }) => <div data-testid="cipher-create-maker" data-draft={JSON.stringify(props.initialCode)} data-pending={JSON.stringify(props.pendingCode)} data-step={props.step}><button disabled={props.busy} onClick={() => void props.onLock(['red', 'blue', 'red', 'green']).catch(() => {})}>Lock fixture code</button><button onClick={() => props.onDraftChange?.(['red', null, null, null])}>Edit local code</button><button onClick={props.onLeave}>Leave code maker</button>{props.error && <p role="alert">{props.error}</p>}</div> }));
vi.mock('@/components/showdown/cipher/CipherGame', () => ({ CipherGuessHistory: ({ guesses, readOnly }: { guesses: CipherGuess[]; readOnly?: boolean }) => <div data-testid="cipher-readonly-history" data-guesses={JSON.stringify(guesses)} data-readonly={String(readOnly)}>Ten final guess rows</div> }));

const mine: CipherCode = ['red', 'blue', 'red', 'green'];
const theirs: CipherCode = ['yellow', 'purple', 'orange', 'blue'];
const record = { wins: 1, losses: 0, draws: 0, played: 1 };
const statistics: CipherStats = { ...record, solved_count: 1, failed_count: 0, successful_guesses_total: 3, average_guesses_to_solve: 3, best_guess_count: 3, first_guess_solves: 0, current_win_streak: 1, longest_win_streak: 1 };
const time = '2026-11-01T01:00:00.000Z';
function history(target: CipherCode, count: number): CipherGuess[] { return Array.from({ length: count }, (_, index) => { const colors: CipherCode = index === count - 1 ? target : ['red', 'red', 'red', 'red']; return { sequence: index + 1, colors, ...calculateFeedback(target, colors), submitted_at: time }; }); }
function match(): ShowdownMatchDetail {
  const mineAttempt = { status: 'solved' as const, guesses_used: 3, solved: true, finished_at: time };
  const theirAttempt = { status: 'solved' as const, guesses_used: 5, solved: true, finished_at: time };
  return {
    challenge: {
      id: 'cipher-match', club_id: 'club', game_key: 'cipher_duel', rules_version: 1, status: 'completed', challenger_id: 'alex', recipient_id: 'blair', created_at: time, expires_at: '2099-11-04T01:00:00.000Z', completed_at: time, winner_id: 'alex', outcome: 'winner', rematch_of: null,
      cipher: { own_code_locked: true, opponent_code_locked: true, own_status: 'solved', own_guesses_used: 3, opponent_finished: true, gameplay_started_at: time },
      players: [{ user_id: 'alex', display_name: 'Alex', avatar_url: null, started_at: time, finished_at: time, rounds_completed: 0, total_score: null, solved_count: null, rotations: null }, { user_id: 'blair', display_name: 'Blair', avatar_url: null, started_at: time, finished_at: time, rounds_completed: 0, total_score: null, solved_count: null, rotations: null }],
    }, rounds: [], current_round: null, can_play: false, can_decline: false, can_cancel: false, readonly_reason: null, record, rivalry: { ...record, opponent_id: 'blair', display_name: 'Blair', avatar_url: null }, cipher_statistics: statistics,
    cipher: { phase: 'completed', own_code: mine, own_code_locked_at: time, opponent_code_locked: true, opponent_finished: true, invitation_expires_at: '2099-11-04T01:00:00.000Z', gameplay_started_at: time, gameplay_expires_at: '2099-11-07T01:00:00.000Z', own_guesses: history(theirs, 3), own_attempt: mineAttempt, statistics,
      results: [{ user_id: 'alex', code: mine, guesses: history(theirs, 3), attempt: mineAttempt }, { user_id: 'blair', code: theirs, guesses: history(mine, 5), attempt: theirAttempt }],
    },
  };
}
function openChallenge(id: string, cipher: NonNullable<ShowdownChallenge['cipher']>): ShowdownChallenge {
  const challenge = match().challenge;
  return { ...challenge, id, status: cipher.gameplay_started_at ? 'active' : 'pending', completed_at: null, winner_id: null, outcome: null, challenger_id: cipher.own_code_locked ? 'alex' : 'blair', recipient_id: cipher.own_code_locked ? 'blair' : 'alex', cipher,
    players: challenge.players.map(player => ({ ...player, finished_at: player.user_id === 'alex' && ['solved', 'exhausted', 'surrendered'].includes(cipher.own_status) ? time : null })),
  };
}
function lobby(): ShowdownLobbyData {
  return { games: [
    { game_key: 'prism_break', current_rules_version: 1, name: 'Prism Break', description: 'Bend the light.', enabled: true }, { game_key: 'afterimage', current_rules_version: 1, name: 'Afterimage', description: 'Remember a scene.', enabled: true }, { game_key: 'cipher_duel', current_rules_version: 1, name: 'Cipher Duel', description: 'Set a secret. Crack theirs.', enabled: true },
  ], members: [{ user_id: 'alex', display_name: 'Alex', avatar_url: null }, { user_id: 'blair', display_name: 'Blair', avatar_url: null }], challenges: [], next_cursor: null, record, rivalries: [], standings: [], cipher_statistics: statistics };
}
function Location() { const location = useLocation(); return <span data-testid="cipher-test-location">{location.pathname}{location.search}</span>; }
function Harness({ children, entry = '/showdown?game=cipher_duel' }: { children: React.ReactNode; entry?: string }) { return <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Location />{children}</MemoryRouter>; }
function renderSetup(entry = '/showdown/cipher/new?recipient_id=blair') { return render(<Harness entry={entry}><CipherCreatePage /></Harness>); }
function renderResults(detail = match()) { return render(<Harness><CipherResults detail={detail} viewerId="alex" onRematch={wire.rematch} busy={false} /></Harness>); }

beforeEach(() => { vi.clearAllMocks(); wire.userId = 'alex'; wire.clubId = 'club'; wire.lobby = lobby(); wire.draft = [null, null, null, null]; wire.pendingCode = null; wire.prepare.mockImplementation((code: CipherCode) => ({ code, requestId: '00000000-0000-4000-8000-000000000001' })); wire.create.mockResolvedValue(match()); });
afterEach(cleanup);

describe('Cipher Duel challenge routing and summaries', () => {
  it('routes to code creation without creating a challenge or showing puzzle scoring copy', async () => {
    render(<Harness><ShowdownPage /></Harness>);
    fireEvent.click(screen.getByRole('button', { name: 'Challenge a member' }));
    const dialog = screen.getByRole('dialog', { name: 'New showdown' });
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(/three rounds|1,500|375|score stays/);
    fireEvent.change(within(dialog).getByLabelText('Club member'), { target: { value: 'blair' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create your code' }));
    await waitFor(() => expect(screen.getByTestId('cipher-test-location')).toHaveTextContent('/showdown/cipher/new?recipient_id=blair'));
    expect(wire.create).not.toHaveBeenCalled();
  });
  it('uses code locks and own terminal state for inbox, playable and waiting challenge groups', () => {
    wire.lobby!.challenges = [
      openChallenge('incoming', { own_code_locked: false, opponent_code_locked: true, own_status: 'pending', own_guesses_used: 0, opponent_finished: false, gameplay_started_at: null }),
      openChallenge('waiting-code', { own_code_locked: true, opponent_code_locked: false, own_status: 'pending', own_guesses_used: 0, opponent_finished: false, gameplay_started_at: null }),
      openChallenge('playing', { own_code_locked: true, opponent_code_locked: true, own_status: 'playing', own_guesses_used: 2, opponent_finished: false, gameplay_started_at: time }),
      openChallenge('sealed', { own_code_locked: true, opponent_code_locked: true, own_status: 'solved', own_guesses_used: 3, opponent_finished: false, gameplay_started_at: time }),
    ];
    render(<Harness><ShowdownPage /></Harness>);
    const inbox = screen.getByRole('tabpanel');
    expect(within(inbox).getByRole('link', { name: 'Create your code' })).toHaveAttribute('href', '/showdown/incoming');
    expect(inbox).toHaveTextContent('Invitation ·');
    fireEvent.click(screen.getByRole('tab', { name: /Play/ }));
    expect(screen.getByRole('link', { name: 'Crack their code' })).toHaveAttribute('href', '/showdown/playing');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('2 / 10 guesses');
    fireEvent.click(screen.getByRole('tab', { name: /Waiting/ }));
    expect(screen.getByRole('link', { name: 'Waiting for code' })).toHaveAttribute('href', '/showdown/waiting-code');
    expect(screen.getByRole('link', { name: 'View sealed attempt' })).toHaveAttribute('href', '/showdown/sealed');
    expect(screen.getByRole('tabpanel')).not.toHaveTextContent(/score|3 saved|three/);
  });
  it('shows codebreaking statistics and completed outcomes without a numeric game score', () => {
    wire.lobby!.challenges = [match().challenge];
    render(<Harness entry="/showdown?game=cipher_duel&tab=history"><ShowdownPage /></Harness>);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Code cracked in 3 guesses');
    expect(screen.getByRole('tabpanel')).not.toHaveTextContent(/Your score|375|1,500/);
    fireEvent.click(screen.getByRole('tab', { name: 'Ranks' }));
    const stats = screen.getByLabelText('Cipher Duel statistics');
    expect(stats).toHaveTextContent('Average guesses3');
    expect(stats).toHaveTextContent('Best solve3 guesses');
    expect(stats).toHaveTextContent('Win streak1Best 1');
  });
});

describe('Cipher setup durability and membership', () => {
  it('keeps drafts local, then persists request identity before creating and navigating', async () => {
    renderSetup('/showdown/cipher/new?recipient_id=blair&rematch_of=prior-duel');
    fireEvent.click(screen.getByRole('button', { name: 'Edit local code' }));
    expect(wire.draftChange).toHaveBeenCalledWith(['red', null, null, null]);
    expect(wire.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Lock fixture code' }));
    await waitFor(() => expect(screen.getByTestId('cipher-test-location')).toHaveTextContent('/showdown/cipher-match'));
    expect(wire.prepare).toHaveBeenCalledWith(mine);
    expect(wire.prepare.mock.invocationCallOrder[0]).toBeLessThan(wire.create.mock.invocationCallOrder[0]);
    expect(wire.create).toHaveBeenCalledWith({ recipientId: 'blair', gameKey: 'cipher_duel', secretCode: mine, requestId: '00000000-0000-4000-8000-000000000001', rematchOf: 'prior-duel' });
    expect(wire.complete).toHaveBeenCalledOnce();
  });
  it('restores pending code and retains it after an unknown outcome without clearing its identity', async () => {
    wire.pendingCode = mine; wire.draft = mine; wire.create.mockRejectedValueOnce(new Error('Connection interrupted'));
    renderSetup();
    expect(screen.getByTestId('cipher-create-maker')).toHaveAttribute('data-pending', JSON.stringify(mine));
    fireEvent.click(screen.getByRole('button', { name: 'Lock fixture code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
    expect(wire.complete).not.toHaveBeenCalled();
    expect(screen.getByTestId('cipher-test-location')).toHaveTextContent('/showdown/cipher/new?recipient_id=blair');
    fireEvent.click(screen.getByRole('button', { name: 'Lock fixture code' }));
    await waitFor(() => expect(wire.create).toHaveBeenCalledTimes(2));
    expect(wire.create.mock.calls[0]).toEqual(wire.create.mock.calls[1]);
  });
  it.each(['', 'alex', 'not-a-member'])('blocks setup for invalid recipient %s before rendering or creating', recipient => {
    renderSetup(`/showdown/cipher/new?recipient_id=${recipient}`);
    expect(screen.getByRole('heading', { name: 'Choose your rival.' })).toBeInTheDocument();
    expect(screen.queryByTestId('cipher-create-maker')).not.toBeInTheDocument();
    expect(wire.create).not.toHaveBeenCalled();
  });
  it('does not navigate or clear a new account’s state when an old request finishes', async () => {
    let finish!: (value: ShowdownMatchDetail) => void;
    wire.create.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const view = renderSetup();
    fireEvent.click(screen.getByRole('button', { name: 'Lock fixture code' }));
    wire.userId = 'blair';
    view.rerender(<Harness entry="/showdown/cipher/new?recipient_id=blair"><CipherCreatePage /></Harness>);
    await act(async () => finish(match()));
    expect(screen.getByTestId('cipher-test-location')).not.toHaveTextContent('/showdown/cipher-match');
    expect(wire.complete).not.toHaveBeenCalled();
  });
});

describe('Cipher completed secrets and replay', () => {
  it('shows terminal attempts and each creator’s own secret without a score', () => {
    renderResults();
    const result = screen.getByTestId('showdown-results');
    expect(result).toHaveTextContent('Both codes cracked. Fewer guesses decided the duel');
    expect(within(result).getByLabelText("Alex's secret code")).toHaveAccessibleName("Alex's secret code");
    expect(within(result).getByLabelText("Blair's secret code")).toBeInTheDocument();
    expect(result).not.toHaveTextContent(/points|score|rotations|rounds/);
    fireEvent.click(within(result).getByRole('button', { name: 'Rematch' }));
    expect(wire.rematch).toHaveBeenCalledOnce();
  });
  it('inspects the selected player’s official guesses against the other player’s code', () => {
    const data = match(); renderResults(data);
    fireEvent.click(screen.getByRole('button', { name: "Inspect Alex's guesses" }));
    const dialog = screen.getByRole('dialog', { name: 'Alex’s guesses' });
    expect(within(dialog).getByLabelText("Blair's target code")).toBeInTheDocument();
    expect(within(dialog).getByTestId('cipher-readonly-history')).toHaveAttribute('data-guesses', JSON.stringify(data.cipher!.results![0].guesses));
    expect(within(dialog).getByTestId('cipher-readonly-history')).toHaveAttribute('data-readonly', 'true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Blair' }));
    expect(screen.getByRole('dialog', { name: 'Blair’s guesses' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Alex's target code")).toBeInTheDocument();
    expect(within(dialog).getByTestId('cipher-readonly-history')).toHaveAttribute('data-guesses', JSON.stringify(data.cipher!.results![1].guesses));
  });
  it('records a legitimate draw when neither player cracks the secret', () => {
    const data = match(); data.challenge.outcome = 'draw'; data.challenge.winner_id = null;
    data.cipher!.results = data.cipher!.results!.map(result => ({ ...result, guesses: [], attempt: { status: 'surrendered', solved: false, guesses_used: 0, finished_at: time } })) as typeof data.cipher.results;
    renderResults(data);
    expect(screen.getByRole('heading', { name: 'Evenly matched.' })).toBeInTheDocument();
    expect(screen.getByText(/Neither code was cracked. A true draw/)).toBeInTheDocument();
  });
  it.each(['active', 'unfinished rival', 'missing results', 'wrong game'])('does not render secrets or history for %s', state => {
    const data = match();
    if (state === 'active') data.challenge.status = 'active';
    if (state === 'unfinished rival') data.cipher!.results![1].attempt.finished_at = null;
    if (state === 'missing results') data.cipher!.results = null;
    if (state === 'wrong game') data.challenge.game_key = 'prism_break';
    renderResults(data);
    expect(screen.queryByTestId('showdown-results')).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Blair's secret code")).not.toBeInTheDocument();
    expect(screen.queryByTestId('cipher-readonly-history')).not.toBeInTheDocument();
  });
});
