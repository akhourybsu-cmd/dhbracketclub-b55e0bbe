import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeepClaimPage from '@/pages/DeepClaimPage';
import { continueDeepClaimCompany } from './fixtures/deepClaimTutorialMock';
import { DeepClaimBusiness, type ClaimBusinessView } from '@/components/deepClaim/DeepClaimBusiness';
import { DeepClaimIndustry } from '@/components/deepClaim/DeepClaimIndustry';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';

const wire = vi.hoisted(() => ({ data: null as DeepClaimSnapshot | null, readOnly: false, startResearch: vi.fn(), fulfillContract: vi.fn(), claimMilestone: vi.fn(), refresh: vi.fn(), noop: vi.fn(), build: vi.fn(), hire: vi.fn(), stores: vi.fn(), confirmed: vi.fn(), close: vi.fn(), pending: null as string | null }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club-a' }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => true }) }));
// Pixel backdrop lifecycle is covered separately; keep these economic suites renderer-free.
vi.mock('@/components/deepClaim/menu/DeepClaimMenuBackdrop', () => ({ DeepClaimMenuBackdrop: () => null }));
vi.mock('@/hooks/useDeepClaimTutorial', async () => ({ useDeepClaimTutorial: (await import('./fixtures/deepClaimTutorialMock')).useDeepClaimTutorialMock }));
vi.mock('@/hooks/useDeepClaim', () => ({ useDeepClaim: () => ({ data: wire.data, loading: false, refreshing: false, error: null, busy: false, readOnly: wire.readOnly, pendingAction: wire.pending, serverNow: () => Date.parse('2026-11-01T12:00:00Z'), refresh: wire.refresh, startResearch: wire.startResearch, fulfillContract: wire.fulfillContract, claimMilestone: wire.claimMilestone, preview: wire.noop, dispatch: wire.noop, resolveDiscovery: wire.noop, hire: wire.noop, train: wire.noop, assignEquipment: wire.noop, repairEquipment: wire.noop, retireEquipment: wire.noop, startProduction: wire.noop, collectProduction: wire.noop, upgrade: wire.noop, retryPending: wire.noop }) }));
vi.mock('@/components/deepClaim/renderer/DeepClaimCanvas', () => ({ DeepClaimCanvas: ({ onSelectBuilding }: { onSelectBuilding: (key: 'mine_office' | 'research_office' | 'trading_post') => void }) => <div><button onClick={() => onSelectBuilding('mine_office')}>Map office</button><button onClick={() => onSelectBuilding('research_office')}>Map research</button><button onClick={() => onSelectBuilding('trading_post')}>Map trading</button></div> }));
vi.mock('@/lib/deepClaim/audio', () => ({ createDeepClaimAudio: () => { const settings = { master: false, music: true, ambient: true, sfx: true, volume: .65 }; return { getSnapshot: () => settings, subscribe: () => () => {}, setScene: vi.fn(), updateSettings: vi.fn(), unlock: vi.fn(), play: vi.fn(), setActive: vi.fn(), dispose: vi.fn() }; } }));
const actions = { startResearch: wire.startResearch, fulfillContract: wire.fulfillContract, claimMilestone: wire.claimMilestone };
function Office({ data = wire.data!, initial = 'company', readOnly = false, now = Date.parse('2026-11-01T12:00:00Z') }: { data?: DeepClaimSnapshot; initial?: ClaimBusinessView; readOnly?: boolean; now?: number }) {
  const [view, setView] = useState(initial);
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimBusiness snapshot={data} view={view} onView={setView} onClose={wire.close} onBuild={wire.build} onHire={wire.hire} onStores={wire.stores} actions={actions} onConfirmed={wire.confirmed} now={now} onRefresh={wire.refresh} busy={false} readOnly={readOnly} /></MemoryRouter>;
}
function App() { return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimPage /></MemoryRouter>; }
function prepareResearch() { wire.data!.buildings.find(item => item.key === 'research_office')!.level = 1; wire.data!.resources = { stone: 12, clay: 6 }; wire.data!.company!.cash = 200; }
function researchDetail() { fireEvent.click(screen.getByRole('button', { name: 'Review Cutting Methods' })); }
function contractDetail() { fireEvent.click(screen.getByRole('button', { name: 'Review order Yard Foundations' })); }
beforeEach(() => { vi.clearAllMocks(); wire.data = phaseFourSnapshot(); wire.readOnly = false; wire.pending = null; wire.startResearch.mockResolvedValue(wire.data); wire.fulfillContract.mockResolvedValue(wire.data); wire.claimMilestone.mockResolvedValue(wire.data); });
afterEach(cleanup);

describe('Deep Claim Office integration and research', () => {
  it('keeps six main tabs and opens the company Office from both the surface action and Mine Office', () => {
    render(<App />); continueDeepClaimCompany(); expect(screen.getAllByRole('tab')).toHaveLength(6); fireEvent.click(screen.getByRole('button', { name: 'Open company office' })); expect(within(screen.getByRole('group', { name: 'Company office views' })).getAllByRole('button')).toHaveLength(5); fireEvent.click(screen.getByRole('button', { name: 'Back to camp' })); fireEvent.click(screen.getByRole('button', { name: 'Map office' })); expect(screen.getByRole('dialog', { name: 'Company Office' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Hire staff' })); expect(screen.getByRole('heading', { name: 'Hiring' })).toBeInTheDocument();
  });
  it('routes unbuilt business plots to real construction and built plots to their real Office views', () => {
    const app = render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Map research' })); expect(screen.getByRole('dialog', { name: 'Research Office' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Confirm build' })).toBeInTheDocument(); cleanup(); app.unmount(); wire.data!.buildings.find(item => item.key === 'research_office')!.level = 1; wire.data!.buildings.find(item => item.key === 'trading_post')!.level = 1; render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Map research' })); expect(screen.getByRole('group', { name: 'Research branches' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Back to camp' })); fireEvent.click(screen.getByRole('button', { name: 'Map trading' })); expect(screen.getByRole('heading', { name: 'Contracts' })).toBeInTheDocument();
  });
  it('exposes seven research branches and the real two-tier dependency path', () => {
    render(<Office initial="research" />); expect(within(screen.getByRole('group', { name: 'Research branches' })).getAllByRole('button')).toHaveLength(7); expect(screen.getByRole('button', { name: 'Review Cutting Methods' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Review Precision Extraction' })); expect(screen.getByText('Required research')).toBeInTheDocument(); const required = wire.data!.business_catalog!.research.find(item => item.key === 'excavation_2')!.requires; for (const key of required) expect(screen.getAllByText(wire.data!.business_catalog!.research.find(item => item.key === key)!.name).length).toBeGreaterThan(0); expect(screen.getByRole('button', { name: 'Start research' })).toBeDisabled(); expect(wire.startResearch).not.toHaveBeenCalled();
  });
  it('commits research only after reviewing the server cost, materials and operating reserve', async () => {
    prepareResearch(); wire.data!.company!.cash = 71; const view = render(<Office initial="research" />); researchDetail(); expect(screen.getByRole('button', { name: 'Start research' })).toBeDisabled(); expect(screen.getByText('70 cr')).toBeInTheDocument(); wire.data = { ...wire.data!, revision: 5, company: { ...wire.data!.company!, cash: 72 } }; view.rerender(<Office initial="research" data={wire.data} />); fireEvent.click(screen.getByRole('button', { name: 'Review current report' })); expect(screen.getByRole('button', { name: 'Start research' })).toBeEnabled(); expect(wire.startResearch).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Start research' })); await waitFor(() => expect(wire.startResearch).toHaveBeenCalledWith('excavation_1', 5)); expect(wire.confirmed).toHaveBeenCalledWith('Research underway.', expect.stringContaining('Cutting Methods'), expect.any(Object));
  });
  it('does not allow a second research project while another is active', () => {
    prepareResearch(); wire.data!.business!.research = [{ key: 'geology_1', status: 'active', started_at: wire.data!.server_now, completes_at: '2026-11-01T12:05:00Z', completed_at: null }]; render(<Office initial="research" />); researchDetail(); expect(screen.getByRole('button', { name: 'Start research' })).toBeDisabled(); expect(screen.getByText('One research project can run at a time.')).toBeInTheDocument();
  });
  it('uses server completion state after an elapsed timer and never offers a research collect action', () => {
    wire.data!.business!.research = [{ key: 'excavation_1', status: 'active', started_at: '2026-11-01T11:50:00Z', completes_at: '2026-11-01T11:55:00Z', completed_at: null }]; render(<Office />); expect(screen.getByText('Awaiting completion report')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Check research completion' })); expect(wire.refresh).toHaveBeenCalledOnce(); expect(wire.startResearch).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: /Collect research/ })).not.toBeInTheDocument();
  });
  it('requires reviewing a newer company report before committing an old research decision', () => {
    prepareResearch(); const view = render(<Office initial="research" />); researchDetail(); view.rerender(<Office initial="research" data={{ ...wire.data!, revision: 5 }} />); expect(screen.queryByRole('button', { name: 'Start research' })).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Review current report' })); expect(screen.getByRole('button', { name: 'Start research' })).toBeEnabled(); expect(wire.startResearch).not.toHaveBeenCalled();
  });
  it('explains current research bonuses without adding them a second time to employee stats', () => {
    wire.data!.business!.research_bonuses = { mining: 10, leadership: 4 }; wire.data!.business!.processing_speed_percent = 15; const original = structuredClone(wire.data); render(<Office />); expect(screen.getByText('+10 Mining')).toBeInTheDocument(); expect(screen.getByText('−15% production time')).toBeInTheDocument(); expect(wire.data).toEqual(original);
  });
});

describe('Deep Claim finite deliveries, milestones and current industry', () => {
  it('blocks whole-order delivery until the actual collected stock is present', async () => {
    wire.data!.buildings.find(item => item.key === 'trading_post')!.level = 1; wire.data!.resources = { stone: 19 }; const view = render(<Office initial="contracts" />); contractDetail(); expect(screen.getByRole('button', { name: 'Deliver whole order' })).toBeDisabled(); expect(screen.getByText('19 collected · need 1 more')).toBeInTheDocument(); wire.data = { ...wire.data!, revision: 5, resources: { stone: 20 } }; view.rerender(<Office initial="contracts" data={wire.data} />); fireEvent.click(screen.getByRole('button', { name: 'Review current report' })); expect(wire.fulfillContract).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Deliver whole order' })); await waitFor(() => expect(wire.fulfillContract).toHaveBeenCalledWith('yard_foundations', 5)); expect(wire.confirmed).toHaveBeenCalledWith('Order delivered.', expect.stringContaining('24 company credits'), expect.any(Object));
  });
  it('shows real Trading Post and prerequisite requirements without acceptance or expiry controls', () => {
    render(<Office initial="contracts" />); contractDetail(); expect(screen.getByText('Trading Post level 1 is required.')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Build Trading Post' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Accept|Extend|Cancel order/ })).not.toBeInTheDocument(); expect(screen.getByText(/This order does not expire/)).toBeInTheDocument();
  });
  it('keeps a completed contract read-only and all twelve orders accessible in bounded pages', () => {
    wire.data!.business!.contracts[0].status = 'completed'; render(<Office initial="contracts" />); expect(screen.getAllByRole('button', { name: /^Review order / })).toHaveLength(4); fireEvent.click(screen.getByRole('button', { name: 'Next orders page' })); expect(screen.getByText('5–8 of 12')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Previous orders page' })); contractDetail(); expect(screen.getByRole('button', { name: 'Deliver whole order' })).toBeDisabled(); expect(wire.fulfillContract).not.toHaveBeenCalled();
  });
  it('claims a legacy-earned milestone from authoritative progress even when no visible jobs remain', async () => {
    wire.data!.expeditions = []; wire.data!.business!.milestones.find(item => item.key === 'first_shift')!.progress = 1; render(<Office initial="records" />); fireEvent.click(screen.getByRole('button', { name: 'Review milestone First Shift' })); expect(screen.getByRole('button', { name: 'Claim company credits' })).toBeEnabled(); expect(wire.claimMilestone).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Claim company credits' })); await waitFor(() => expect(wire.claimMilestone).toHaveBeenCalledWith('first_shift', 4));
  });
  it('does not infer milestone completion from visible history and refuses a claimed award', () => {
    const view = render(<Office initial="records" />); fireEvent.click(screen.getByRole('button', { name: 'Review milestone First Shift' })); expect(screen.getByRole('button', { name: 'Claim company credits' })).toBeDisabled(); wire.data!.business!.milestones[0] = { key: 'first_shift', progress: 1, claimed_at: wire.data!.server_now }; view.rerender(<Office initial="records" data={wire.data!} />); expect(screen.getByRole('button', { name: 'Claim company credits' })).toBeDisabled(); expect(wire.claimMilestone).not.toHaveBeenCalled();
  });
  it('renders all eleven operational totals from durable statistics rather than capped visible collections', () => {
    wire.data!.business!.stats.completed_mining_expeditions = 1234; wire.data!.business!.stats.max_completed_mining_depth = 410; wire.data!.business!.stats.collected_processed_units = 948; wire.data!.expeditions = []; wire.data!.production_jobs = []; render(<Office initial="records" />); fireEvent.click(screen.getByRole('button', { name: 'Operations' })); expect(screen.getByText('1,234')).toBeInTheDocument(); expect(screen.getByText('410m')).toBeInTheDocument(); expect(screen.getByText('948')).toBeInTheDocument(); expect(screen.getByText('Contract credits earned')).toBeInTheDocument();
  });
  it('keeps paid research disabled while the company is read-only', () => {
    prepareResearch(); render(<Office initial="research" readOnly />); researchDetail(); expect(screen.getByRole('button', { name: 'Start research' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled(); expect(wire.startResearch).not.toHaveBeenCalled();
  });
  it('blocks locked alloy recipes and links their real prerequisite research', () => {
    const data = phaseFourSnapshot(); data.resources = { copper_bar: 20, tin_bar: 20 }; data.company!.cash = 1000; data.buildings.find(item => item.key === 'smeltery')!.level = 3; render(<DeepClaimIndustry snapshot={data} view="workshop" onView={wire.noop} station="smeltery" onStation={wire.noop} busy={false} readOnly={false} now={Date.parse(data.server_now)} onRefresh={wire.refresh} onBuild={wire.build} onResearch={wire.hire} onSell={wire.noop} onOpenHaul={wire.noop} startProduction={wire.noop} collectProduction={wire.noop} onConfirmed={wire.confirmed} />); fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Bronze' })); fireEvent.click(screen.getByRole('button', { name: 'Review batch' })); expect(screen.getByRole('button', { name: 'Start production' })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: 'View required research' })); expect(wire.hire).toHaveBeenCalledOnce();
  });
  it('presents an actual confirmed Office receipt in the center', async () => {
    wire.data!.business!.milestones[0].progress = 1; const updated = structuredClone(wire.data!); updated.company!.cash = 217; updated.business!.milestones[0].claimed_at = updated.server_now; wire.claimMilestone.mockImplementation(async () => { wire.data = updated; return updated; }); render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Open company office' })); fireEvent.click(screen.getByRole('button', { name: 'Review milestone · 1 ready' })); fireEvent.click(screen.getByRole('button', { name: 'Claim company credits' })); const receipt = await screen.findByRole('dialog', { name: 'Company milestone secured.' }); expect(receipt).toHaveTextContent('217 company credits'); expect(screen.queryByRole('dialog', { name: 'Company Office' })).not.toBeInTheDocument();
  });
});
