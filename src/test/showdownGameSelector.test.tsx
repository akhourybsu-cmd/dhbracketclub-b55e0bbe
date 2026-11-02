import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShowdownPage from '@/pages/ShowdownPage';
import { ShowdownGameSelector } from '@/components/showdown/ShowdownGameSelector';
import type { ShowdownChallenge, ShowdownGame, ShowdownLobbyData } from '@/lib/showdown/types';

const wire = vi.hoisted(() => ({ lobbies: {} as Record<string, ShowdownLobbyData | null>, hook: vi.fn(), create: vi.fn(), navigate: null as NavigateFunction | null }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'alex' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club', name: 'Dry My Horse' }, loading: false }) }));
vi.mock('@/hooks/useShowdown', () => ({ useShowdownLobby: (game: string) => {
  wire.hook(game);
  return { data: wire.lobbies[game] ?? null, loading: !wire.lobbies[game], refreshing: false, error: null, refresh: vi.fn(), create: wire.create, act: vi.fn(), busy: false, hasMore: false, loadMore: vi.fn(), loadingMore: false };
} }));

const games: ShowdownGame[] = [
  { game_key: 'prism_break', name: 'Prism Break', current_rules_version: 1, description: 'Bend the light.', enabled: true },
  { game_key: 'afterimage', name: 'Afterimage', current_rules_version: 1, description: 'Remember the room.', enabled: true },
  { game_key: 'cipher_duel', name: 'Cipher Duel', current_rules_version: 1, description: 'Set a secret. Crack theirs.', enabled: true },
];
function challenge(game: string): ShowdownChallenge {
  return { id: `${game}-active`, club_id: 'club', game_key: game, rules_version: 1, status: 'active', challenger_id: 'alex', recipient_id: 'blair',
    created_at: '2026-11-01T00:00:00.000Z', expires_at: '2099-11-04T00:00:00.000Z', completed_at: null, winner_id: null, outcome: null, rematch_of: null,
    ...(game === 'cipher_duel' ? { cipher: { own_code_locked: true, opponent_code_locked: true, own_status: 'playing' as const, own_guesses_used: 2, opponent_finished: false, gameplay_started_at: '2026-11-01T00:00:00.000Z' } } : {}),
    players: [{ user_id: 'alex', display_name: 'Alex', avatar_url: null, started_at: '2026-11-01', finished_at: null, rounds_completed: 1, total_score: 0, solved_count: 0, rotations: 0 },
      { user_id: 'blair', display_name: 'Blair', avatar_url: null, started_at: null, finished_at: null, rounds_completed: 0, total_score: null, solved_count: null, rotations: null }] };
}
function lobby(game: string): ShowdownLobbyData {
  const record = game === 'prism_break' ? { wins: 1, losses: 0, draws: 0, played: 1 } : game === 'afterimage' ? { wins: 2, losses: 3, draws: 1, played: 6 } : { wins: 0, losses: 1, draws: 2, played: 3 };
  return { games: structuredClone(games), members: [{ user_id: 'alex', display_name: 'Alex', avatar_url: null }, { user_id: 'blair', display_name: 'Blair', avatar_url: null }], challenges: [challenge(game)], next_cursor: null, record, rivalries: [], standings: [] };
}
function Location() { const location = useLocation(); wire.navigate = useNavigate(); return <output data-testid="selector-location">{location.pathname}{location.search}</output>; }
function Harness({ entry = '/showdown' }: { entry?: string }) { return <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Location /><ShowdownPage /></MemoryRouter>; }
function picker() { return screen.getByRole('radiogroup', { name: 'Showdown games' }); }
function game(name: string) { return within(picker()).getByRole('radio', { name }); }
function expectRecord(name: string, wins: number, losses: number, draws: number) {
  const summary = screen.getByRole('group', { name: `${name} record` });
  for (const label of [`${wins} ${wins === 1 ? 'win' : 'wins'}`, `${losses} ${losses === 1 ? 'loss' : 'losses'}`, `${draws} ${draws === 1 ? 'draw' : 'draws'}`]) expect(within(summary).getByText(label, { exact: true })).toBeInTheDocument();
}

beforeEach(() => {
  vi.clearAllMocks(); wire.navigate = null;
  wire.lobbies = Object.fromEntries(games.map(game => [game.game_key, lobby(game.game_key)]));
  wire.create.mockResolvedValue({ challenge: { id: 'created-challenge' } });
});
afterEach(cleanup);

describe('Showdown game selector accessibility', () => {
  function Controlled({ disabled = false }: { disabled?: boolean }) {
    const [value, setValue] = useState('prism_break');
    return <ShowdownGameSelector games={games} value={value} onChange={key => { wire.hook(key); setValue(key); }} disabled={disabled} />;
  }
  it('shows all three named game cards with one selected roving tab stop', () => {
    render(<Controlled />);
    expect(within(picker()).getAllByRole('radio')).toHaveLength(3);
    expect(game('Prism Break')).toHaveAttribute('aria-checked', 'true');
    expect(game('Prism Break')).toHaveAttribute('tabindex', '0');
    for (const name of ['Afterimage', 'Cipher Duel']) { expect(game(name)).toHaveAttribute('aria-checked', 'false'); expect(game(name)).toHaveAttribute('tabindex', '-1'); }
  });
  it('supports wrapping arrows and Home/End while moving both selection and focus', () => {
    render(<Controlled />); game('Prism Break').focus();
    for (const [key, name] of [['ArrowRight', 'Afterimage'], ['ArrowDown', 'Cipher Duel'], ['ArrowRight', 'Prism Break'], ['End', 'Cipher Duel'], ['Home', 'Prism Break'], ['ArrowLeft', 'Cipher Duel'], ['ArrowUp', 'Afterimage']]) {
      fireEvent.keyDown(document.activeElement!, { key });
      expect(game(name)).toHaveFocus(); expect(game(name)).toHaveAttribute('aria-checked', 'true');
      expect(within(picker()).getAllByRole('radio').filter(radio => radio.tabIndex === 0)).toHaveLength(1);
    }
  });
  it('cannot mutate a disabled chooser and excludes disabled, unknown or unsupported rules', () => {
    const onChange = vi.fn();
    const view = render(<ShowdownGameSelector games={games} value="prism_break" onChange={onChange} disabled />);
    fireEvent.click(game('Afterimage')); fireEvent.keyDown(game('Prism Break'), { key: 'End' });
    expect(onChange).not.toHaveBeenCalled(); expect(within(picker()).getAllByRole('radio').every(radio => (radio as HTMLButtonElement).disabled)).toBe(true);
    view.rerender(<ShowdownGameSelector games={[games[0], { ...games[1], current_rules_version: 999 }, { ...games[2], enabled: false }, { ...games[0], game_key: 'unknown-game' }]} value="prism_break" onChange={onChange} />);
    expect(within(picker()).getAllByRole('radio')).toHaveLength(1); expect(game('Prism Break')).toBeVisible();
  });
});

describe('Showdown selected-game integration', () => {
  it('changes the URL, records and challenge list together without retaining the previous game', () => {
    render(<Harness />);
    expect(screen.getByRole('link', { name: 'Continue puzzle' })).toHaveAttribute('href', '/showdown/prism_break-active');
    fireEvent.click(game('Afterimage'));
    expect(screen.getByTestId('selector-location')).toHaveTextContent('game=afterimage');
    expectRecord('Afterimage', 2, 3, 1);
    expect(screen.getByRole('link', { name: 'Continue scene' })).toHaveAttribute('href', '/showdown/afterimage-active');
    expect(screen.queryByRole('link', { name: 'Continue puzzle' })).not.toBeInTheDocument();
    fireEvent.click(game('Cipher Duel'));
    expect(screen.getByTestId('selector-location')).toHaveTextContent('game=cipher_duel');
    expectRecord('Cipher Duel', 0, 1, 2);
    expect(screen.getByRole('link', { name: 'Crack their code' })).toHaveAttribute('href', '/showdown/cipher_duel-active');
    expect(wire.hook).toHaveBeenLastCalledWith('cipher_duel');
  });
  it('keeps game cards stable during scoped loading while removing old records and matches', () => {
    const view = render(<Harness />); wire.lobbies.afterimage = null;
    fireEvent.click(game('Afterimage'));
    expect(game('Afterimage')).toHaveAttribute('aria-checked', 'true'); expect(within(picker()).getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByLabelText('Prism Break record')).not.toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'Continue puzzle' })).not.toBeInTheDocument();
    wire.lobbies.afterimage = lobby('afterimage'); view.rerender(<Harness />);
    expectRecord('Afterimage', 2, 3, 1);
  });
  it('preselects the current game in a challenge and sends the game actually chosen in the dialog', async () => {
    render(<Harness entry="/showdown?game=afterimage" />);
    fireEvent.click(screen.getByRole('button', { name: 'Challenge a member' }));
    const dialog = screen.getByRole('dialog', { name: 'New showdown' }), choices = within(dialog).getByRole('radiogroup', { name: 'Choose a game' });
    expect(within(choices).getByRole('radio', { name: 'Afterimage' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(choices).getByRole('radio', { name: 'Prism Break' }));
    fireEvent.change(within(dialog).getByLabelText('Club member'), { target: { value: 'blair' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send challenge' }));
    await waitFor(() => expect(wire.create).toHaveBeenCalledWith({ recipientId: 'blair', gameKey: 'prism_break', requestId: expect.any(String) }));
    await waitFor(() => expect(screen.getByTestId('selector-location')).toHaveTextContent('/showdown/created-challenge'));
  });
  it('routes a Cipher choice to code creation without creating an invitation', async () => {
    render(<Harness />); fireEvent.click(screen.getByRole('button', { name: 'Challenge a member' }));
    const dialog = screen.getByRole('dialog', { name: 'New showdown' });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Cipher Duel' }));
    fireEvent.change(within(dialog).getByLabelText('Club member'), { target: { value: 'blair' } });
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create your code' }));
    await waitFor(() => expect(screen.getByTestId('selector-location')).toHaveTextContent('/showdown/cipher/new?recipient_id=blair'));
    expect(wire.create).not.toHaveBeenCalled();
  });
  it('resets selection for deleted or invalid URL game keys and closes a removed challenge flag', async () => {
    render(<Harness entry="/showdown?game=afterimage&challenge=new&recipient=blair" />);
    expect(screen.getByRole('dialog', { name: 'New showdown' })).toBeVisible();
    await act(async () => wire.navigate!('/showdown?game=afterimage'));
    expect(screen.queryByRole('dialog', { name: 'New showdown' })).not.toBeInTheDocument(); expect(game('Afterimage')).toHaveAttribute('aria-checked', 'true');
    await act(async () => wire.navigate!('/showdown'));
    expect(game('Prism Break')).toHaveAttribute('aria-checked', 'true'); expect(wire.hook).toHaveBeenLastCalledWith('prism_break');
    await act(async () => wire.navigate!('/showdown?game=afterimage'));
    await act(async () => wire.navigate!('/showdown?game=missing-game'));
    expect(game('Prism Break')).toHaveAttribute('aria-checked', 'true'); expect(wire.hook).toHaveBeenLastCalledWith('prism_break');
    expect(screen.getByTestId('selector-location')).not.toHaveTextContent('missing-game');
  });
  it('falls back from a server game with unsupported rules instead of showing a stale selected game', async () => {
    for (const data of Object.values(wire.lobbies)) if (data) data.games.find(game => game.game_key === 'afterimage')!.current_rules_version = 999;
    render(<Harness entry="/showdown?game=afterimage&tab=history" />);
    await waitFor(() => expect(game('Prism Break')).toHaveAttribute('aria-checked', 'true'));
    expect(within(picker()).queryByRole('radio', { name: 'Afterimage' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Afterimage record')).not.toBeInTheDocument();
    expect(wire.hook).toHaveBeenLastCalledWith('prism_break');
    expect(screen.getByTestId('selector-location')).toHaveTextContent('tab=history');
    expect(screen.getByTestId('selector-location')).not.toHaveTextContent('game=afterimage');
  });
});
