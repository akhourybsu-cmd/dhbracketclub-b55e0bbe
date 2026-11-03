import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeepClaimPage from '@/pages/DeepClaimPage';
import { continueDeepClaimCompany } from './fixtures/deepClaimTutorialMock';
import { DeepClaimClub } from '@/components/deepClaim/DeepClaimClub';
import { deepClaimLink } from '@/components/deepClaim/clubLinks';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';
import { phaseFiveClubView } from './fixtures/deepClaimPhase5';
import { discoverySpecimen } from '@/lib/deepClaim/field';
import { projectReward } from '@/lib/deepClaim/social';
import type { DeepClaimClubView, DeepClaimDiscovery, DeepClaimSnapshot, DeepClaimStandingMetric } from '@/lib/deepClaim/types';

const CLUB = '11111111-1111-4111-8111-111111111111';
const wire = vi.hoisted(() => ({ snapshot: null as DeepClaimSnapshot | null, club: null as DeepClaimClubView | null, clubHook: vi.fn(), refresh: vi.fn(), preferences: vi.fn(), contribute: vi.fn(), claim: vi.fn(), noop: vi.fn(), confirmed: vi.fn(), close: vi.fn(), error: null as string | null, readOnly: false, refreshing: false, prefUpdate: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: '11111111-1111-4111-8111-111111111111' }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => true }) }));
// Pixel backdrop lifecycle is covered separately; keep these economic suites renderer-free.
vi.mock('@/components/deepClaim/menu/DeepClaimMenuBackdrop', () => ({ DeepClaimMenuBackdrop: () => null }));
vi.mock('@/hooks/useDeepClaimTutorial', async () => ({ useDeepClaimTutorial: (await import('./fixtures/deepClaimTutorialMock')).useDeepClaimTutorialMock }));
vi.mock('@/hooks/useDeepClaim', () => ({ useDeepClaim: () => ({ data: wire.snapshot, loading: false, refreshing: false, error: null, busy: false, readOnly: false, pendingAction: null, serverNow: () => Date.parse('2026-11-02T12:00:00Z'), refresh: wire.refresh, setSocialPreferences: wire.preferences, contributeProject: wire.contribute, claimProject: wire.claim, preview: wire.noop, dispatch: wire.noop, resolveDiscovery: wire.noop, startResearch: wire.noop, fulfillContract: wire.noop, claimMilestone: wire.noop, hire: wire.noop, train: wire.noop, assignEquipment: wire.noop, repairEquipment: wire.noop, retireEquipment: wire.noop, startProduction: wire.noop, collectProduction: wire.noop, upgrade: wire.noop, retryPending: wire.noop }) }));
vi.mock('@/hooks/useDeepClaimClub', () => ({ useDeepClaimClub: (input: unknown) => { wire.clubHook(input); return { data: wire.club, loading: false, refreshing: wire.refreshing, error: wire.error, readOnly: wire.readOnly, refresh: wire.refresh }; } }));
vi.mock('@/hooks/useNotificationPreferences', () => ({ useNotificationPreferences: () => ({ prefs: { deep_claim: true }, loading: false, saving: false, error: null, update: wire.prefUpdate, refresh: wire.refresh }) }));
vi.mock('@/components/deepClaim/renderer/DeepClaimCanvas', () => ({ DeepClaimCanvas: () => <div data-testid="private-mine-canvas" /> }));
vi.mock('@/lib/deepClaim/audio', () => ({ createDeepClaimAudio: () => { const settings = { master: false, music: true, ambient: true, sfx: true, volume: .65, musicVolume: 1, sfxVolume: 1, ambientVolume: 1 }; return { getSnapshot: () => settings, subscribe: () => () => {}, setScene: vi.fn(), updateSettings: vi.fn(), unlock: vi.fn(), play: vi.fn(), setActive: vi.fn(), dispose: vi.fn() }; } }));
const actions = { setSocialPreferences: wire.preferences, contributeProject: wire.contribute, claimProject: wire.claim };
function publicSpecimen(kind: DeepClaimDiscovery['kind']) { const { name, detail } = discoverySpecimen(kind, 'fine'); return { kind, quality: 'fine' as const, name, detail }; }
function kept(id: string, kind: DeepClaimDiscovery['kind'] = 'banded_geode'): DeepClaimDiscovery { const { name, detail, sale_value, salvage } = discoverySpecimen(kind, 'fine'); return { id, kind, quality: 'fine', name, detail, sale_value, salvage, job_id: 'PRIVATE-JOB', x: 79, y: 599, status: 'kept', discovered_at: '2026-11-02T12:00:00Z', resolved_at: '2026-11-02T12:00:00Z' }; }
function Board({ data = wire.club, snapshot = wire.snapshot!, initial = 'projects', projectKey = null, error = null, readOnly = false, refreshing = false, metric: initialMetric = 'weekly_mining_value' }: { data?: DeepClaimClubView | null; snapshot?: DeepClaimSnapshot; initial?: 'projects' | 'standings' | 'showcase'; projectKey?: string | null; error?: string | null; readOnly?: boolean; refreshing?: boolean; metric?: DeepClaimStandingMetric }) {
  const [view, setView] = useState(initial), [metric, setMetric] = useState<DeepClaimStandingMetric>(initialMetric), [page, setPage] = useState(0);
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimClub snapshot={snapshot} data={data} loading={false} refreshing={refreshing} error={error} refresh={wire.refresh} metric={metric} onMetric={setMetric} page={page} onPage={setPage} view={view} onView={setView} projectKey={projectKey} actions={actions} busy={false} readOnly={readOnly} onClose={wire.close} onConfirmed={wire.confirmed} /></MemoryRouter>;
}
function App({ url = '/deep-claim' }: { url?: string }) { return <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimPage /></MemoryRouter>; }
function project() { fireEvent.click(screen.getByRole('button', { name: 'Review project Camp Supply' })); }
function privacy() { fireEvent.click(screen.getByRole('button', { name: 'Sharing preferences' })); }
beforeEach(() => { vi.clearAllMocks(); wire.snapshot = phaseFourSnapshot(); wire.snapshot.company!.club_id = CLUB; wire.snapshot.resources = { stone: 100, coal: 100, clay: 100 }; wire.club = phaseFiveClubView(); wire.club.club_id = CLUB; wire.error = null; wire.readOnly = false; wire.refreshing = false; wire.preferences.mockResolvedValue(wire.snapshot); wire.contribute.mockResolvedValue(wire.snapshot); wire.claim.mockResolvedValue(wire.snapshot); wire.refresh.mockResolvedValue(undefined); wire.prefUpdate.mockResolvedValue(undefined); });
afterEach(cleanup);

describe('Deep Claim optional club shell and privacy', () => {
  it('retains six main tabs and does not load any club records until Club is selected', () => {
    render(<App />); continueDeepClaimCompany(); expect(screen.getAllByRole('tab')).toHaveLength(6); expect(wire.clubHook).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Open company office' })); expect(within(screen.getByRole('group', { name: 'Company office views' })).getAllByRole('button')).toHaveLength(5); expect(wire.clubHook).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Club' })); expect(wire.clubHook).toHaveBeenCalledWith(expect.objectContaining({ enabled: true })); expect(screen.getByText('Your company is private')).toBeInTheDocument();
  });
  it('requires separate explicit consents and a reviewed confirmation before publishing', async () => {
    wire.snapshot!.discoveries = [kept('kept-1')]; render(<Board />); privacy(); const rank = screen.getByRole('checkbox', { name: 'List my company in standings' }), show = screen.getByRole('checkbox', { name: 'Publish my selected specimens' }); expect(rank).not.toBeChecked(); expect(show).not.toBeChecked(); fireEvent.click(rank); fireEvent.click(show); fireEvent.click(screen.getByRole('checkbox', { name: 'Feature Banded Geode' })); expect(wire.preferences).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Review sharing' })); expect(wire.preferences).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Confirm sharing preferences' })); await waitFor(() => expect(wire.preferences).toHaveBeenCalledWith({ standings_enabled: true, showcase_enabled: true, featured_discovery_ids: ['kept-1'] }, 4));
  });
  it('retains an older featured specimen absent from the capped private cabinet and allows explicit removal', async () => {
    wire.snapshot!.discoveries = []; wire.club!.own = { standings_enabled: true, showcase_enabled: true, featured_discovery_ids: ['older-kept'], featured_specimens: [publicSpecimen('banded_geode')] }; render(<Board />); privacy(); const retained = screen.getByRole('checkbox', { name: 'Feature Banded Geode (retained selection)' }); expect(retained).toBeChecked(); fireEvent.click(screen.getByRole('checkbox', { name: 'List my company in standings' })); fireEvent.click(screen.getByRole('button', { name: 'Review sharing' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm sharing preferences' })); await waitFor(() => expect(wire.preferences).toHaveBeenCalledWith(expect.objectContaining({ standings_enabled: false, featured_discovery_ids: ['older-kept'] }), 4));
    cleanup(); render(<Board />); privacy(); fireEvent.click(screen.getByRole('checkbox', { name: 'Feature Banded Geode (retained selection)' })); fireEvent.click(screen.getByRole('button', { name: 'Review sharing' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm sharing preferences' })); await waitFor(() => expect(wire.preferences).toHaveBeenLastCalledWith(expect.objectContaining({ featured_discovery_ids: [] }), 4));
  });
  it('limits featured selection to three owned kept specimens', () => {
    wire.snapshot!.discoveries = [kept('one', 'banded_geode'), kept('two', 'fern_fossil'), kept('three', 'rail_relic'), kept('four', 'survey_journal')]; render(<Board />); privacy(); fireEvent.click(screen.getByRole('checkbox', { name: 'Feature Banded Geode' })); fireEvent.click(screen.getByRole('checkbox', { name: 'Feature Fern Fossil' })); fireEvent.click(screen.getByRole('checkbox', { name: 'Feature Rail Relic' })); expect(screen.getByRole('checkbox', { name: 'Feature Survey Journal' })).toBeDisabled();
  });
  it('bounds the private kept-specimen picker without dropping selections on another page', () => {
    wire.snapshot!.discoveries = Array.from({ length: 8 }, (_, index) => kept(`kept-${index}`, (['banded_geode', 'fern_fossil', 'rail_relic', 'survey_journal', 'crystal_cluster', 'meteorite_fragment'] as const)[index % 6])); render(<Board />); privacy(); const picker = screen.getByRole('group', { name: 'Featured kept specimens' }); expect(within(picker).getAllByRole('checkbox')).toHaveLength(6); within(picker).getAllByRole('checkbox').slice(0, 3).forEach(input => fireEvent.click(input)); fireEvent.click(screen.getByRole('button', { name: 'Next kept specimens' })); expect(within(picker).getAllByRole('checkbox')).toHaveLength(2); within(picker).getAllByRole('checkbox').forEach(input => expect(input).toBeDisabled()); expect(screen.getByText(/3\/3 selected/)).toBeInTheDocument();
  });
  it('keeps core gameplay usable when the shared read fails', () => {
    wire.club = null; wire.error = 'Club records could not load. Retry.'; render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Open company office' })); fireEvent.click(screen.getByRole('button', { name: 'Club' })); expect(screen.getByText(wire.error)).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Reconnect' })); expect(wire.refresh).toHaveBeenCalledOnce(); fireEvent.click(screen.getByRole('button', { name: 'Back to camp' })); expect(screen.getByTestId('private-mine-canvas')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Expand tunnels' })).toBeEnabled();
  });
});

describe('Deep Claim atomic project review', () => {
  it('places the reviewed project identity before decorative artwork so short viewports start with its title', () => {
    const result = render(<Board />); project();
    const heading = screen.getByRole('heading', { name: 'Camp Supply' });
    const art = result.container.querySelector('.dcl-club-body>.dcl-project-detail-art');
    expect(art).not.toBeNull(); expect(heading.compareDocumentPosition(art!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
  it('starts explicit Club reviews and views at the top without jumping on edits, polling or confirmation', () => {
    const result = render(<Board />); const scroller = result.container.querySelector<HTMLDivElement>('.dcl-club-body')!;
    scroller.scrollTop = 180; project(); expect(scroller.scrollTop).toBe(0);
    scroller.scrollTop = 96; fireEvent.change(screen.getByRole('spinbutton', { name: 'Stone contribution' }), { target: { value: '10' } }); expect(scroller.scrollTop).toBe(96);
    fireEvent.click(screen.getByRole('button', { name: 'Review contribution' })); expect(scroller.scrollTop).toBe(96);
    result.rerender(<Board data={{ ...wire.club!, server_now: '2026-11-02T12:00:01Z' }} />); expect(scroller.scrollTop).toBe(96);
    fireEvent.click(screen.getByRole('button', { name: 'Back' })); expect(scroller.scrollTop).toBe(96);
    fireEvent.click(screen.getByRole('button', { name: 'Back' })); expect(scroller.scrollTop).toBe(0);
    scroller.scrollTop = 133; fireEvent.click(screen.getByRole('button', { name: 'Standings' })); expect(scroller.scrollTop).toBe(0);
  });
  it('reviews a permanent exact contribution and sends the frozen own revision without requiring public listing', async () => {
    render(<Board />); project(); fireEvent.change(screen.getByRole('spinbutton', { name: 'Stone contribution' }), { target: { value: '10' } }); expect(wire.contribute).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Review contribution' })); expect(screen.getByLabelText('Reviewed permanent contribution')).toHaveTextContent('10'); expect(wire.contribute).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Confirm contribution' })); await waitFor(() => expect(wire.contribute).toHaveBeenCalledWith('camp_supply', { stone: 10 }, 4)); expect(wire.preferences).not.toHaveBeenCalled();
  });
  it.each(['-1', '1.5', '33', '101'])('blocks an invalid %s contribution without clipping the requested quantity', quantity => {
    render(<Board />); project(); fireEvent.change(screen.getByRole('spinbutton', { name: 'Stone contribution' }), { target: { value: quantity } }); expect(screen.getByRole('button', { name: 'Review contribution' })).toBeDisabled(); expect(wire.contribute).not.toHaveBeenCalled();
  });
  it('protects the remaining liquid company reserve without counting future project rewards', () => {
    wire.snapshot!.company!.cash = 0; wire.snapshot!.resources = { stone: 2 }; const view = render(<Board />); project(); fireEvent.change(screen.getByRole('spinbutton', { name: 'Stone contribution' }), { target: { value: '2' } }); expect(screen.getByRole('button', { name: 'Review contribution' })).toBeDisabled(); expect(wire.contribute).not.toHaveBeenCalled(); wire.snapshot = { ...wire.snapshot!, resources: { stone: 3 } }; view.rerender(<Board snapshot={wire.snapshot} />); fireEvent.change(screen.getByRole('spinbutton', { name: 'Stone contribution' }), { target: { value: '1' } }); expect(screen.getByRole('button', { name: 'Review contribution' })).toBeEnabled();
  });
  it('respects project remaining and the prior per-resource donation together', () => {
    wire.club!.projects[0].progress = { stone: 79 }; wire.club!.projects[0].own_contribution = { stone: 20 }; render(<Board />); project(); const input = screen.getByRole('spinbutton', { name: 'Stone contribution' }); expect(input).toHaveAttribute('max', '1'); fireEvent.change(input, { target: { value: '2' } }); expect(screen.getByRole('button', { name: 'Review contribution' })).toBeDisabled(); expect(screen.getByText(/project needs 1 · you may add 12 more/)).toBeInTheDocument();
  });
  it('blocks confirmation after private revision changes or while refreshed social data is newer', () => {
    const view = render(<Board />); project(); fireEvent.change(screen.getByRole('spinbutton', { name: 'Stone contribution' }), { target: { value: '10' } }); fireEvent.click(screen.getByRole('button', { name: 'Review contribution' })); view.rerender(<Board snapshot={{ ...wire.snapshot!, revision: 5 }} data={{ ...wire.club!, own_revision: 5 }} />); expect(screen.queryByRole('button', { name: 'Confirm contribution' })).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Review current stock' })).toBeEnabled();
    view.rerender(<Board snapshot={wire.snapshot!} data={{ ...wire.club!, own_revision: 6 }} />); expect(screen.getByRole('button', { name: 'Confirm contribution' })).toBeDisabled(); expect(wire.contribute).not.toHaveBeenCalled();
  });
  it('disables a contribution during refresh or read-only recovery', () => {
    const view = render(<Board refreshing />); project(); expect(screen.getByRole('spinbutton', { name: 'Stone contribution' })).toBeDisabled(); view.rerender(<Board readOnly />); expect(screen.getByRole('spinbutton', { name: 'Stone contribution' })).toBeDisabled(); expect(wire.contribute).not.toHaveBeenCalled();
  });
  it('claims only a completed qualified project using the authoritative amount and prevents a claimed replay', async () => {
    const value = wire.club!.projects[0]; value.progress = { ...value.goals }; value.own_contribution = { stone: 20 }; value.own_value = 20; const reward = projectReward(value.reward_pool, value.own_value, value.total_value); value.qualified = reward.qualified; value.reward_amount = reward.amount; value.status = 'completed'; value.completed_at = wire.club!.server_now; render(<Board />); project(); fireEvent.click(screen.getByRole('button', { name: 'Claim project credits' })); await waitFor(() => expect(wire.claim).toHaveBeenCalledWith('camp_supply', 4)); expect(wire.confirmed).toHaveBeenCalledWith('Project reward secured.', expect.stringContaining(`${value.reward_amount} company credits`), expect.any(Object), true);
    cleanup(); value.claimed_at = wire.club!.server_now; render(<Board />); project(); expect(screen.queryByRole('button', { name: 'Claim project credits' })).not.toBeInTheDocument();
  });
});

describe('Deep Claim public identity and notification targets', () => {
  it('renders tied true ranks and the viewer exactly once without a separate You card', () => {
    wire.club!.own.standings_enabled = true; wire.club!.standings = [{ user_id: 'other', display_name: 'Ivo', avatar_url: null, company_name: 'Vale Works', value: 100, rank: 1, is_you: false }, { user_id: 'user-a', display_name: 'Mara', avatar_url: null, company_name: 'Flint Works', value: 100, rank: 1, is_you: true }]; render(<Board initial="standings" />); expect(screen.getAllByText('Mara · You')).toHaveLength(1); expect(within(screen.getByLabelText('Club standings')).getAllByRole('article')).toHaveLength(2); expect(screen.getAllByText('1')).toHaveLength(2);
  });
  it('hides old weekly rows while a different metric is loading', () => {
    wire.club!.standings = [{ user_id: 'other', display_name: 'Ivo', avatar_url: null, company_name: 'Vale Works', value: 100, rank: 1, is_you: false }]; render(<Board initial="standings" />); fireEvent.click(screen.getByRole('button', { name: 'Depth' })); expect(screen.queryByText('Ivo')).not.toBeInTheDocument(); expect(screen.getByText('Opening the club board')).toBeInTheDocument();
  });
  it('opens only sanitized public showcase detail and never renders private coordinates, inventory or job identifiers', () => {
    wire.snapshot!.discoveries = [kept('secret-own')]; wire.club!.showcases = { page: 0, total: 1, has_more: false, companies: [{ user_id: 'other', display_name: 'Ivo', avatar_url: null, company_name: 'Vale Works', specimens: [publicSpecimen('fern_fossil')] }] }; render(<Board initial="showcase" />); fireEvent.click(screen.getByRole('button', { name: 'View Vale Works showcase' })); expect(screen.getByText('Fern Fossil')).toBeInTheDocument(); expect(screen.queryByText('PRIVATE-JOB')).not.toBeInTheDocument(); expect(screen.queryByText(/599/)).not.toBeInTheDocument(); expect(screen.queryByText('secret-own')).not.toBeInTheDocument();
  });
  it('whitelists query targets, rejects foreign clubs and ignores unsupported private entity parameters', () => {
    expect(deepClaimLink(new URLSearchParams(`club=${CLUB}&office=club&view=projects&project=camp_supply&company=foreign`), CLUB)).toMatchObject({ mismatch: false, office: 'club', project: 'camp_supply' }); expect(deepClaimLink(new URLSearchParams('office=club&view=hack&project=private-id'), CLUB)).toMatchObject({ view: 'projects', project: null });
    render(<App url="/deep-claim?club=22222222-2222-4222-8222-222222222222&office=club&view=projects&project=camp_supply" />); expect(screen.getByText(/This notification belongs to a different club/)).toBeInTheDocument(); expect(wire.clubHook).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog', { name: 'Company Office' })).not.toBeInTheDocument(); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Return to current company' })); expect(screen.queryByText(/This notification belongs/)).not.toBeInTheDocument();
  });
  it('opens a matching notification directly to its actual project without publishing or spending', async () => {
    render(<App url={`/deep-claim?club=${CLUB}&office=club&view=projects&project=camp_supply`} />); expect(await screen.findByRole('dialog', { name: 'Company Office' })).toBeInTheDocument(); expect(screen.getByRole('spinbutton', { name: 'Stone contribution' })).toBeInTheDocument(); expect(wire.preferences).not.toHaveBeenCalled(); expect(wire.contribute).not.toHaveBeenCalled();
  });
  it('closes a URL-driven Office when browser navigation removes its request', async () => {
    function Nav() { const navigate = useNavigate(); return <button onClick={() => navigate('/deep-claim')}>Clear notification route</button>; }
    render(<MemoryRouter initialEntries={[`/deep-claim?club=${CLUB}&office=club&view=projects`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Nav /><DeepClaimPage /></MemoryRouter>); await screen.findByRole('dialog', { name: 'Company Office' }); fireEvent.click(screen.getByRole('button', { name: 'Clear notification route', hidden: true })); await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Company Office' })).not.toBeInTheDocument());
  });
  it('routes the camp notification toggle through the existing global preference hook', async () => {
    render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('tab', { name: 'Settings' })); fireEvent.click(screen.getByRole('tab', { name: 'Updates' })); fireEvent.click(screen.getByRole('switch', { name: 'Deep Claim notifications' })); await waitFor(() => expect(wire.prefUpdate).toHaveBeenCalledWith('deep_claim', false));
  });
});
