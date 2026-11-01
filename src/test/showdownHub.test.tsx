import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShowdownPage from '@/pages/ShowdownPage';
import ShowdownMatchPage from '@/pages/ShowdownMatchPage';
import { ShowdownResults } from '@/components/showdown/ShowdownResults';
import type { ShowdownChallenge, ShowdownLobbyData, ShowdownMatchDetail } from '@/lib/showdown/types';
import type { PrismPuzzle, PrismTile } from '@/lib/showdown/prism/types';

const wire = vi.hoisted(() => ({
  userId: 'a', lobbyData: null as ShowdownLobbyData | null, matchData: null as ShowdownMatchDetail | null,
  create: vi.fn(), act: vi.fn(), refresh: vi.fn(), loadMore: vi.fn(), rematch: vi.fn(), matchHook: vi.fn(),
  hasMore: false, lobbyError: null as string | null,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: wire.userId }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club-1', name: 'Dry My Horse' }, loading: false }) }));
vi.mock('@/hooks/useShowdown', () => ({
  useShowdownLobby: () => ({ data: wire.lobbyData, loading: false, refreshing: false, error: wire.lobbyError, refresh: wire.refresh, create: wire.create, act: wire.act, busy: false, hasMore: wire.hasMore, loadMore: wire.loadMore, loadingMore: false }),
  useShowdownMatch: () => { wire.matchHook(); return { data: wire.matchData, loading: false, error: null, refresh: wire.refresh, actions: [], onActionsChange: vi.fn(), submit: vi.fn(), act: wire.act, rematch: wire.rematch, saveState: 'saved', saveError: null, retrySave: vi.fn(), busy: false, submitting: false }; },
}));

const record = { wins: 0, losses: 0, draws: 0, played: 0 };
function puzzle(): PrismPuzzle {
  const tiles: PrismTile[] = Array.from({ length: 25 }, () => ({ kind: 'empty' }));
  tiles[10] = { kind: 'emitter', direction: 'E', color: 'cyan' };
  tiles[12] = { kind: 'mirror', orientation: '/', rotatable: true };
  tiles[22] = { kind: 'receiver', color: 'cyan', label: 'A' };
  return { id: 'ui-puzzle', version: 1, difficulty: 'easy', width: 5, height: 5, tiles };
}
function challenge(overrides: Partial<ShowdownChallenge> = {}): ShowdownChallenge {
  return {
    id: 'challenge-1', club_id: 'club-1', game_key: 'prism_break', rules_version: 1,
    status: 'pending', challenger_id: 'b', recipient_id: 'a', created_at: '2026-11-01T00:00:00Z', expires_at: '2099-11-04T00:00:00Z', completed_at: null,
    winner_id: null, outcome: null, rematch_of: null,
    players: [
      { user_id: 'a', display_name: 'Alex', avatar_url: null, started_at: null, finished_at: null, rounds_completed: 0, total_score: 0, solved_count: 0, rotations: 0 },
      { user_id: 'b', display_name: 'Blair', avatar_url: null, started_at: '2026-11-01', finished_at: null, rounds_completed: 0, total_score: null, solved_count: null, rotations: null },
    ], ...overrides,
  };
}
function detail(completed = false): ShowdownMatchDetail {
  const c = challenge();
  if (completed) {
    c.status = 'completed'; c.winner_id = 'a'; c.outcome = 'winner'; c.completed_at = '2026-11-02';
    c.players[0] = { ...c.players[0], started_at: '2026-11-01', finished_at: '2026-11-02', rounds_completed: 3, total_score: 1500, solved_count: 3, rotations: 3 };
    c.players[1] = { ...c.players[1], finished_at: '2026-11-02', rounds_completed: 3, total_score: 1000, solved_count: 2, rotations: 2 };
  }
  return {
    challenge: c, rounds: [1, 2, 3].map(n => ({ round_number: n, difficulty: n === 1 ? 'easy' : n === 2 ? 'medium' : 'hard', puzzle_id: `puzzle-${n}`, puzzle_version: 1, title: `Test chamber ${n}`, puzzle: completed || n === 1 ? puzzle() : null, minimum_rotations: completed ? 1 : null,
      me: { actions: completed ? [{ type: 'rotate', cell: 12 }] : [], revision: 0, submitted: completed, skipped: false, solved: completed, score: completed ? 500 : null, rotations: completed ? 1 : 0 },
      opponent: completed ? { actions: n === 3 ? [] : [{ type: 'rotate', cell: 12 }], revision: 0, submitted: true, skipped: n === 3, solved: n !== 3, score: n === 3 ? 0 : 500, rotations: n === 3 ? 0 : 1 } : null,
    })), current_round: completed ? null : 1, can_play: !completed, can_decline: false, can_cancel: false, readonly_reason: null, record, rivalry: { ...record, wins: 2, losses: 1, played: 3, opponent_id: 'b', display_name: 'Blair', avatar_url: null },
  };
}
function lobby(): ShowdownLobbyData {
  return { games: [{ game_key: 'prism_break', current_rules_version: 1, name: 'Prism Break', description: 'Bend the light. Three puzzles. One rivalry.', enabled: true }], members: [{ user_id: 'a', display_name: 'Alex', avatar_url: null }, { user_id: 'b', display_name: 'Blair', avatar_url: null }], challenges: [challenge()], next_cursor: null, record, rivalries: [], standings: [] };
}
function Location() { const location = useLocation(); return <span data-testid="showdown-test-location">{location.pathname}</span>; }
function Harness({ children }: { children: React.ReactNode }) { return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/showdown']}><Location />{children}</MemoryRouter>; }
function chooseChallenge() {
  fireEvent.click(screen.getByRole('button', { name: 'Challenge a member' }));
  const dialog = screen.getByRole('dialog', { name: 'New showdown' });
  fireEvent.change(within(dialog).getByLabelText('Club member'), { target: { value: 'b' } });
  return dialog;
}

beforeEach(() => { vi.clearAllMocks(); wire.userId = 'a'; wire.lobbyData = lobby(); wire.matchData = detail(); wire.hasMore = false; wire.lobbyError = null; wire.create.mockResolvedValue(detail()); wire.act.mockResolvedValue(detail()); wire.refresh.mockResolvedValue(undefined); wire.rematch.mockResolvedValue(detail()); });
afterEach(cleanup);

describe('Showdown discovery and challenge controls', () => {
  it('uses real member/game choices, excludes self, and immediately opens the created challenge', async () => {
    render(<Harness><ShowdownPage /></Harness>);
    const dialog = chooseChallenge();
    expect(within(dialog).queryByRole('option', { name: 'Alex' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send challenge' }));
    await waitFor(() => expect(screen.getByTestId('showdown-test-location')).toHaveTextContent('/showdown/challenge-1'));
    expect(wire.create).toHaveBeenCalledWith({ recipientId: 'b', gameKey: 'prism_break', requestId: expect.stringMatching(/^[a-f\d-]{36}$/) });
  });
  it('keeps failed creation choices and request identity intact for a safe retry', async () => {
    wire.create.mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce(detail());
    render(<Harness><ShowdownPage /></Harness>);
    const dialog = chooseChallenge();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send challenge' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Connection interrupted');
    expect(within(dialog).getByLabelText('Club member')).toHaveValue('b');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send challenge' }));
    await waitFor(() => expect(wire.create).toHaveBeenCalledTimes(2));
    expect(wire.create.mock.calls[0]).toEqual(wire.create.mock.calls[1]);
  });
  it('declines an invitation without first starting the opponent’s boards and requires confirmation', async () => {
    render(<Harness><ShowdownPage /></Harness>);
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    let dialog = screen.getByRole('dialog', { name: 'Decline challenge?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep challenge' }));
    expect(wire.act).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    dialog = screen.getByRole('dialog', { name: 'Decline challenge?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Decline challenge' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your record is unchanged');
    expect(wire.act).toHaveBeenCalledWith('challenge-1', 'decline');
    expect(wire.matchHook).not.toHaveBeenCalled();
  });
  it('offers older history through the actual pagination callback', async () => {
    wire.hasMore = true;
    render(<Harness><ShowdownPage /></Harness>);
    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load older matches' }));
    expect(wire.loadMore).toHaveBeenCalledTimes(1);
  });
  it('does not navigate a new account into a challenge created by an old pending session', async () => {
    let finish!: (value: ShowdownMatchDetail) => void;
    wire.create.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const view = render(<Harness><ShowdownPage /></Harness>);
    const dialog = chooseChallenge();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send challenge' }));
    wire.userId = 'b';
    view.rerender(<Harness><ShowdownPage /></Harness>);
    await act(async () => finish(detail()));
    expect(screen.getByTestId('showdown-test-location')).toHaveTextContent('/showdown');
    expect(screen.getByTestId('showdown-test-location')).not.toHaveTextContent('/challenge-1');
  });
  it('presents saved data and an explicit refresh retry during a background failure', () => {
    wire.lobbyError = 'The board could not be refreshed.';
    render(<Harness><ShowdownPage /></Harness>);
    expect(screen.getByRole('alert')).toHaveTextContent('Your last loaded challenges are still shown.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry refresh' }));
    expect(wire.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('showdown-challenge-card')).toBeVisible();
  });
});

describe('Match waiting and closed states', () => {
  it('shows only the viewer’s sealed score while waiting, with no solution controls', () => {
    const data = detail(); data.can_play = false; data.current_round = null;
    data.challenge.status = 'active';
    data.challenge.players[0] = { ...data.challenge.players[0], finished_at: '2026-11-01', rounds_completed: 3, total_score: 1500, solved_count: 3, rotations: 3 };
    data.challenge.players[1].total_score = 1234;
    wire.matchData = data;
    render(<MemoryRouter initialEntries={['/showdown/challenge-1']}><Routes><Route path="/showdown/:challengeId" element={<ShowdownMatchPage />} /></Routes></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Your light is locked in.' })).toBeVisible();
    expect(screen.getByText('1500 / 1,500')).toBeVisible();
    expect(screen.queryByText('1234')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inspect round/ })).not.toBeInTheDocument();
  });
  it('offers a fresh hub invitation for an expired match without invoking the completed-only rematch endpoint', () => {
    const data = detail(); data.challenge.status = 'expired'; data.can_play = false; data.current_round = null;
    wire.matchData = data;
    render(<MemoryRouter initialEntries={['/showdown/challenge-1']}><Routes><Route path="/showdown/:challengeId" element={<ShowdownMatchPage />} /></Routes></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'The light has faded.' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'New challenge' })).toHaveAttribute('href', '/showdown?challenge=new&recipient=b&game=prism_break');
    expect(wire.rematch).not.toHaveBeenCalled();
  });
});

describe('Results privacy and completed replay', () => {
  it('does not reveal scores from an unfinished challenge even if a malformed response supplies them', () => {
    const data = detail(); data.challenge.players[1].total_score = 1234;
    render(<Harness><ShowdownResults detail={data} viewerId="a" onRematch={() => {}} busy={false} /></Harness>);
    expect(screen.queryByTestId('showdown-results')).not.toBeInTheDocument();
    expect(screen.queryByText('1234')).not.toBeInTheDocument();
  });
  it('presents a legitimate draw without inventing a winner and offers the real rematch action', () => {
    const data = detail(true); data.challenge.outcome = 'draw'; data.challenge.winner_id = null;
    data.challenge.players[1] = { ...data.challenge.players[1], total_score: 1500, solved_count: 3, rotations: 3 };
    data.rounds[2].opponent = { actions: [{ type: 'rotate', cell: 12 }], revision: 1, submitted: true, skipped: false, solved: true, score: 500, rotations: 1 };
    render(<Harness><ShowdownResults detail={data} viewerId="a" onRematch={wire.rematch} busy={false} /></Harness>);
    expect(screen.getByRole('heading', { name: 'Perfectly matched.' })).toBeVisible();
    expect(screen.getByText(/Same score. Same solved rounds. Same rotations/)).toBeVisible();
    expect(screen.queryByLabelText('Winner')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));
    expect(wire.rematch).toHaveBeenCalledTimes(1);
  });
  it('shows authoritative score/round/rivalry records and exposes each final board as read-only', async () => {
    render(<Harness><ShowdownResults detail={detail(true)} viewerId="a" onRematch={wire.rematch} busy={false} /></Harness>);
    expect(screen.getByTestId('showdown-results')).toBeVisible();
    expect(screen.getByText('1500')).toBeVisible(); expect(screen.getByText('1000')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Career head-to-head record' })).toHaveTextContent('2–1–0');
    fireEvent.click(screen.getByRole('button', { name: 'Inspect round 1' }));
    const dialog = screen.getByRole('dialog', { name: 'Round 1 replay' });
    expect(within(dialog).getByRole('group', { name: "Alex's final board" })).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Blair' }));
    expect(within(dialog).getByRole('group', { name: "Blair's final board" })).toBeVisible();
    expect(within(dialog).queryByRole('button', { name: /Rotate mirror/ })).not.toBeInTheDocument();
  });
});
