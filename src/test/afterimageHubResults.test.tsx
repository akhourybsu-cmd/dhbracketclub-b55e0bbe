import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShowdownPage from '@/pages/ShowdownPage';
import { AfterimageResults } from '@/components/showdown/afterimage/AfterimageResults';
import type { ShowdownChallenge, ShowdownLobbyData, ShowdownMatchDetail, ShowdownRoundState } from '@/lib/showdown/types';
import type { AfterimageSceneView } from '@/lib/showdown/afterimage/types';

const wire = vi.hoisted(() => ({
  lobbies: {} as Record<string, ShowdownLobbyData>, create: vi.fn(), lobbyHook: vi.fn(), rematch: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'alex' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club', name: 'Dry My Horse' }, loading: false }) }));
vi.mock('@/hooks/useShowdown', () => ({ useShowdownLobby: (game: string) => {
  wire.lobbyHook(game);
  return { data: wire.lobbies[game], loading: false, refreshing: false, error: null, refresh: vi.fn(), create: wire.create, act: vi.fn(), busy: false, hasMore: false, loadMore: vi.fn(), loadingMore: false };
} }));
vi.mock('@/components/showdown/afterimage/AfterimageScene', () => ({ AfterimageScene: (props: { scene: AfterimageSceneView; placements?: Record<string, string>; feedback?: Record<string, string>; label?: string; readOnly?: boolean; mode?: string }) => <div data-testid="afterimage-review-art" data-scene={JSON.stringify(props.scene)} data-placements={JSON.stringify(props.placements ?? {})} data-feedback={JSON.stringify(props.feedback ?? {})} data-readonly={String(props.readOnly)} data-mode={props.mode}>{props.label}</div> }));

const record = { wins: 2, losses: 1, draws: 0, played: 3 };
function scene(): AfterimageSceneView {
  return {
    id: 'memory-scene', version: 1, difficulty: 'medium', title: 'The quiet workshop', theme: 'workshop', background: 'workshop', width: 1000, height: 700, phase: 'review',
    objects: [
      { id: 'fixed', assetId: 'clock', label: 'Clock', x: 500, y: 200, layer: 1 },
      { id: 'cup', assetId: 'cup', label: 'Teacup', x: 150, y: 400, layer: 1 },
      { id: 'book', assetId: 'book', label: 'Book', x: 350, y: 400, layer: 1 },
      { id: 'flower', assetId: 'flower', label: 'Flower', x: 550, y: 400, layer: 1 },
      { id: 'key', assetId: 'key', label: 'Key', x: 750, y: 400, layer: 1 },
    ],
    slots: ['cup', 'book', 'flower', 'key'].map((id, index) => ({ id: `slot-${id}`, x: 150 + index * 200, y: 400, width: 180, height: 160, label: `Place ${index + 1}`, layer: 1 })),
    tray: [{ id: 'cup', assetId: 'cup', label: 'Teacup' }, { id: 'book', assetId: 'book', label: 'Book' }, { id: 'flower', assetId: 'flower', label: 'Flower' }, { id: 'key', assetId: 'key', label: 'Key' }, { id: 'decoy', assetId: 'shell', label: 'Seashell' }],
    answers: ['cup', 'book', 'flower', 'key'].map(id => ({ object_id: id, slot_id: `slot-${id}` })),
    a11y: { label: 'A cozy workshop', instructions: 'Restore the missing objects.' },
  };
}
function attempt(overrides: Partial<ShowdownRoundState> = {}): ShowdownRoundState {
  return { actions: [], revision: 2, submitted: true, skipped: false, solved: true, score: 125, rotations: 0, correct_count: 4, perfect: true, placements: scene().answers, ...overrides };
}
function match(): ShowdownMatchDetail {
  const challenge: ShowdownChallenge = {
    id: 'memory-match', club_id: 'club', game_key: 'afterimage', rules_version: 1, status: 'completed', challenger_id: 'alex', recipient_id: 'blair', created_at: '2026-11-01', expires_at: '2099-11-04', completed_at: '2026-11-02', winner_id: 'alex', outcome: 'winner', rematch_of: null,
    players: [
      { user_id: 'alex', display_name: 'Alex', avatar_url: null, started_at: '2026-11-01', finished_at: '2026-11-02', rounds_completed: 3, total_score: 300, solved_count: 2, rotations: 0, perfect_count: 2 },
      { user_id: 'blair', display_name: 'Blair', avatar_url: null, started_at: '2026-11-01', finished_at: '2026-11-02', rounds_completed: 3, total_score: 225, solved_count: 0, rotations: 0, perfect_count: 0 },
    ],
  };
  return {
    challenge, rounds: [1, 2, 3].map(round => ({
      round_number: round, difficulty: round === 1 ? 'easy' : round === 2 ? 'medium' : 'hard', puzzle_id: 'memory-scene', puzzle_version: 1, title: 'The quiet workshop', puzzle: null, minimum_rotations: null, scene: scene(),
      me: round === 2 ? attempt({ score: 50, correct_count: 2, perfect: false, solved: false, placements: [{ object_id: 'cup', slot_id: 'slot-cup' }, { object_id: 'book', slot_id: 'slot-book' }, { object_id: 'decoy', slot_id: 'slot-flower' }] }) : attempt(),
      opponent: attempt({ score: 75, correct_count: 3, perfect: false, solved: false, placements: scene().answers?.slice(0, 3) }),
    })), current_round: null, can_play: false, can_decline: false, can_cancel: false, readonly_reason: null,
    record, rivalry: { ...record, opponent_id: 'blair', display_name: 'Blair', avatar_url: null },
  };
}
function lobby(game: 'prism_break' | 'afterimage'): ShowdownLobbyData {
  return {
    games: [
      { game_key: 'prism_break', current_rules_version: 1, name: 'Prism Break', description: 'Bend the light.', enabled: true },
      { game_key: 'afterimage', current_rules_version: 1, name: 'Afterimage', description: 'Restore what you remember.', enabled: true },
    ], members: [{ user_id: 'alex', display_name: 'Alex', avatar_url: null }, { user_id: 'blair', display_name: 'Blair', avatar_url: null }],
    challenges: game === 'afterimage' ? [match().challenge] : [{ ...match().challenge, game_key: 'prism_break', id: 'prism-match', players: match().challenge.players.map(player => ({ ...player, total_score: 1500 })) }],
    record: game === 'afterimage' ? { wins: 7, losses: 4, draws: 1, played: 12 } : record,
    rivalries: [], standings: [{ user_id: 'alex', display_name: 'Alex', avatar_url: null, ...record, points: game === 'afterimage' ? 21 : 6 }], next_cursor: null,
  };
}
function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><span data-testid="memory-location">{location.pathname}{location.search}</span><button onClick={() => navigate('/showdown?game=prism_break&tab=history')}>Open Prism history</button></>;
}
function Harness({ children, entry = '/showdown' }: { children: React.ReactNode; entry?: string }) {
  return <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Location />{children}</MemoryRouter>;
}
function renderResults(detail = match(), busy = false) { return render(<Harness><AfterimageResults detail={detail} viewerId="alex" onRematch={wire.rematch} busy={busy} /></Harness>); }

beforeEach(() => { vi.clearAllMocks(); wire.lobbies = { prism_break: lobby('prism_break'), afterimage: lobby('afterimage') }; wire.create.mockResolvedValue(match()); });
afterEach(cleanup);

describe('Afterimage discovery and per-game records', () => {
  it('creates the selected registered game with the real club opponent and opens it directly', async () => {
    render(<Harness><ShowdownPage /></Harness>);
    fireEvent.click(screen.getByRole('button', { name: 'Challenge a member' }));
    const dialog = screen.getByRole('dialog', { name: 'New showdown' });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Afterimage' }));
    expect(within(dialog).getByLabelText('Play my scenes now')).toBeChecked();
    expect(within(dialog).queryByRole('option', { name: 'Alex' })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Club member'), { target: { value: 'blair' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send challenge' }));
    await waitFor(() => expect(screen.getByTestId('memory-location')).toHaveTextContent('/showdown/memory-match'));
    expect(wire.create).toHaveBeenCalledWith({ recipientId: 'blair', gameKey: 'afterimage', requestId: expect.any(String) });
  });
  it('keeps play-later challenges in the chosen game and scopes the record and ranks', async () => {
    render(<Harness><ShowdownPage /></Harness>);
    fireEvent.click(screen.getByRole('button', { name: 'Challenge a member' }));
    const dialog = screen.getByRole('dialog', { name: 'New showdown' });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Afterimage' }));
    fireEvent.change(within(dialog).getByLabelText('Club member'), { target: { value: 'blair' } });
    fireEvent.click(within(dialog).getByLabelText('Play my scenes now'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send challenge' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your three scenes are ready');
    expect(screen.getByTestId('memory-location')).toHaveTextContent('game=afterimage&tab=play');
    const selectedRecord = screen.getByRole('group', { name: 'Afterimage record' });
    for (const label of ['7 wins', '4 losses', '1 draw']) expect(within(selectedRecord).getByText(label, { exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Ranks' }));
    expect(screen.getByRole('heading', { name: 'Afterimage standings' })).toBeInTheDocument();
    expect(screen.getByLabelText('Game standings')).toHaveTextContent('21points');
    expect(screen.getByTestId('memory-location')).toHaveTextContent('game=afterimage');
    expect(wire.lobbyHook).toHaveBeenLastCalledWith('afterimage');
  });
  it('uses versioned per-game history caps and follows in-place URL game changes', async () => {
    render(<Harness entry="/showdown?game=afterimage&tab=history"><ShowdownPage /></Harness>);
    expect(screen.getByText(/Your score: 300 \/ 375/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Prism history' }));
    expect(await screen.findByText(/Your score: 1500 \/ 1,500/)).toBeInTheDocument();
    const selectedRecord = screen.getByRole('group', { name: 'Prism Break record' });
    for (const label of ['2 wins', '1 loss', '0 draws']) expect(within(selectedRecord).getByText(label, { exact: true })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Showdown games' })).getByRole('radio', { name: 'Afterimage' }));
    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByTestId('memory-location')).toHaveTextContent('game=afterimage');
    expect(screen.getByText(/Your score: 300 \/ 375/)).toBeInTheDocument();
  });
});

describe('Afterimage final scores and scene inspection', () => {
  it('presents authoritative memory scores, perfect scenes and rivalry, with a real rematch action', () => {
    renderResults();
    const result = screen.getByTestId('showdown-results');
    expect(within(result).getByLabelText('Final scores')).toHaveTextContent('300 / 375');
    expect(within(result).getByLabelText('Final scores')).toHaveTextContent('2 / 3 perfect scenes');
    expect(within(result).getByLabelText('Final scores')).toHaveTextContent('10 / 12 correct placements');
    expect(within(result).getByLabelText('Career head-to-head record')).toHaveTextContent('Your Afterimage rivalry with Blair');
    expect(result).not.toHaveTextContent(/rotation|Prism Break/);
    expect(within(result).getByRole('link', { name: 'Match history' })).toHaveAttribute('href', '/showdown?game=afterimage&tab=history');
    fireEvent.click(within(result).getByRole('button', { name: 'Rematch' }));
    expect(wire.rematch).toHaveBeenCalledOnce();
  });
  it('explains tied-score perfect-scene tiebreaks and legitimate draws without moves or speed', () => {
    const data = match(); data.challenge.players[1].total_score = 300;
    const view = renderResults(data);
    expect(screen.getByText(/Scores tied. More perfect scenes decided/)).toBeInTheDocument();
    data.challenge.players[1].perfect_count = 2; data.challenge.outcome = 'draw'; data.challenge.winner_id = null;
    view.rerender(<Harness><AfterimageResults detail={data} viewerId="alex" onRematch={wire.rematch} busy /></Harness>);
    expect(screen.getByRole('heading', { name: 'A shared impression.' })).toBeInTheDocument();
    expect(screen.getByText(/Same score. Same perfect scenes. A true draw/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled();
  });
  it.each(['active', 'unfinished rival', 'wrong game'])('does not disclose completed review data for %s', state => {
    const data = match();
    if (state === 'active') data.challenge.status = 'active';
    if (state === 'unfinished rival') data.challenge.players[1].finished_at = null;
    if (state === 'wrong game') data.challenge.game_key = 'prism_break';
    renderResults(data);
    expect(screen.queryByTestId('showdown-results')).not.toBeInTheDocument();
    expect(screen.queryByTestId('afterimage-review-art')).not.toBeInTheDocument();
    expect(screen.queryByText('300')).not.toBeInTheDocument();
  });
  it('compares the true original and each read-only attempt with precise wrong/empty feedback and distractors', () => {
    renderResults();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect round 2' }));
    const dialog = screen.getByRole('dialog', { name: 'Round 2 review' });
    const art = within(dialog).getAllByTestId('afterimage-review-art');
    const original = art.find(element => element.dataset.mode === 'study')!;
    const recall = art.find(element => element.dataset.mode === 'results')!;
    expect(JSON.parse(original.dataset.scene!).objects).toHaveLength(5);
    expect(JSON.parse(original.dataset.scene!).slots).toEqual([]);
    expect(JSON.parse(recall.dataset.scene!).objects.map((object: { id: string }) => object.id)).toEqual(['fixed']);
    expect(JSON.parse(recall.dataset.scene!).answers).toBeUndefined();
    expect(JSON.parse(recall.dataset.placements!)).toEqual({ 'slot-cup': 'cup', 'slot-book': 'book', 'slot-flower': 'decoy' });
    expect(JSON.parse(recall.dataset.feedback!)).toEqual({ 'slot-cup': 'correct', 'slot-book': 'correct', 'slot-flower': 'wrong', 'slot-key': 'empty' });
    expect(art.every(element => element.dataset.readonly === 'true')).toBe(true);
    expect(within(dialog).getByLabelText('Unused distractors')).toHaveTextContent('All distractors were placed');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Blair' }));
    expect(within(dialog).getByLabelText('Unused distractors')).toHaveTextContent('Seashell');
    expect(within(dialog).getByText("Blair's final scene placement")).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Blair' })).toHaveAttribute('aria-pressed', 'true');
  });
});
