import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArcadeLeaderboard, PersonalBestCard, RankChangeResult, useRefreshArcadeBoards } from '@/components/arcade/ArcadeStandings';
import { getArcadeLeaderboard, type ArcadeBoardEntry, type ArcadeScope, type ArcadePeriod } from '@/lib/arcade/client';
import { RIFTWATCH } from '@/lib/arcade/riftwatchDefinition';
import { POCKET_CARTRIDGES } from '@/components/pocket/cartridges';
import { getOnboarding } from '@/lib/onboarding/registry';
import { NAV_ASSET_SLUGS } from '@/types/assets';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'active-member' } }) }));
vi.mock('@/lib/arcade/client', () => ({ getArcadeLeaderboard: vi.fn() }));

const scope: ArcadeScope = { clubId: 'club', gameKey: RIFTWATCH.key, rulesetVersion: RIFTWATCH.rulesetVersion };
const row: ArcadeBoardEntry = { rank: 28, displayName: 'Hazel', score: 2750, wave: 5, achievedAt: '2026-11-28T00:05:00Z', isMe: true, avatarUrl: null };
const top = { ...row, rank: 1, displayName: 'Edda', score: 3450, isMe: false };
function board(period: ArcadePeriod) { return { period, entries: [top, row], personalBest: row, totalMembers: 29 }; }

beforeEach(() => { vi.mocked(getArcadeLeaderboard).mockImplementation(async (_, period) => board(period)); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function Refresh({ scope }: { scope: ArcadeScope }) {
  const refresh = useRefreshArcadeBoards();
  return <button onClick={() => refresh(scope)}>Finish run</button>;
}

describe('Club arcade standings', () => {
  it('registers the game once across Pocket, club installation and onboarding', () => {
    expect(POCKET_CARTRIDGES.filter(cart => cart.id === RIFTWATCH.key)).toHaveLength(1);
    expect(POCKET_CARTRIDGES.find(cart => cart.id === RIFTWATCH.key)?.arcade?.rulesetVersion).toBe(scope.rulesetVersion);
    expect(NAV_ASSET_SLUGS[RIFTWATCH.route]).toBe(RIFTWATCH.key);
    expect(getOnboarding(RIFTWATCH.key)?.primaryCta.route).toBe(RIFTWATCH.route);
  });
  it('displays the server positions once, changes period and refetches after a verified result', async () => {
    const client = new QueryClient();
    const view = render(<QueryClientProvider client={client}><ArcadeLeaderboard scope={scope} /><Refresh scope={scope} /></QueryClientProvider>);
    await screen.findByText('Hazel');
    expect(screen.getAllByText('Hazel')).toHaveLength(1);
    expect(screen.getByText('Your position')).toBeVisible();
    expect(screen.getByText('#28')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'This Week' }));
    await screen.findByText('Hazel');
    expect(getArcadeLeaderboard).toHaveBeenLastCalledWith(scope,'week');
    fireEvent.click(screen.getByRole('button', { name: 'Finish run' }));
    await act(async () => { await Promise.resolve(); });
    expect(getArcadeLeaderboard).toHaveBeenCalledTimes(3);
    const otherClub = { ...scope, clubId: 'club-b' };
    view.rerender(<QueryClientProvider client={client}><ArcadeLeaderboard scope={otherClub} /></QueryClientProvider>);
    await screen.findByText('Edda');
    expect(getArcadeLeaderboard).toHaveBeenLastCalledWith(otherClub,'week');
    client.clear();
  });
  it('renders the verified personal record and movement returned by the server', () => {
    render(<><PersonalBestCard entry={row} /><RankChangeResult result={{
      status: 'verified', score: 2750, wave: 5, kills: 32, simulationTicks: 5000,
      personalBest: 2750, isPersonalBest: true, rank: 28, previousRank: 31, rankChange: 3, leaderboard: board('all_time'),
    }} /></>);
    expect(screen.getByText('2,750')).toBeVisible();
    expect(screen.getByText('Up 3 places')).toBeVisible();
    expect(screen.getByText('New personal best')).toBeVisible();
  });
});
