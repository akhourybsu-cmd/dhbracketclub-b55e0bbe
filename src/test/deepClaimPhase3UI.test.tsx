import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeepClaimPage from '@/pages/DeepClaimPage';
import { continueDeepClaimCompany } from './fixtures/deepClaimTutorialMock';
import { DeepClaimDispatch } from '@/components/deepClaim/DeepClaimDispatch';
import { DeepClaimFieldLog } from '@/components/deepClaim/DeepClaimField';
import { claimTargets } from '@/components/deepClaim/display';
import { phaseThreeSnapshot } from './fixtures/deepClaimPhase3';
import type { DeepClaimDiscovery, DeepClaimFieldReport, DeepClaimPreview, DeepClaimSnapshot } from '@/lib/deepClaim/types';

const wire = vi.hoisted(() => ({ data: null as DeepClaimSnapshot | null, readOnly: false, preview: vi.fn(), dispatch: vi.fn(), resolve: vi.fn(), refresh: vi.fn(), pending: null as string | null, noop: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club-a' }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => true }) }));
// Pixel backdrop lifecycle is covered separately; keep these economic suites renderer-free.
vi.mock('@/components/deepClaim/menu/DeepClaimMenuBackdrop', () => ({ DeepClaimMenuBackdrop: () => null }));
vi.mock('@/hooks/useDeepClaimTutorial', async () => ({ useDeepClaimTutorial: (await import('./fixtures/deepClaimTutorialMock')).useDeepClaimTutorialMock }));
vi.mock('@/hooks/useDeepClaim', () => ({ useDeepClaim: () => ({ data: wire.data, loading: false, refreshing: false, error: null, busy: false, readOnly: wire.readOnly, pendingAction: wire.pending, serverNow: () => Date.parse('2026-11-01T12:00:00Z'), refresh: wire.refresh, preview: wire.preview, dispatch: wire.dispatch, resolveDiscovery: wire.resolve, hire: wire.noop, train: wire.noop, assignEquipment: wire.noop, repairEquipment: wire.noop, retireEquipment: wire.noop, startProduction: wire.noop, collectProduction: wire.noop, upgrade: wire.noop, retryPending: wire.noop }) }));
vi.mock('@/components/deepClaim/renderer/DeepClaimCanvas', () => ({ DeepClaimCanvas: ({ onSelectTile, focusRequest }: { onSelectTile: (point: { x: number; y: number }) => void; focusRequest?: { id: string; point: { x: number; y: number } } }) => <div data-testid="mine-canvas" data-focus={focusRequest ? `${focusRequest.point.x}:${focusRequest.point.y}` : ''}><button onClick={() => onSelectTile({ x: 48, y: 1 })}>Map shaft passage</button><button onClick={() => onSelectTile({ x: 47, y: 3 })}>Map find site</button></div> }));
vi.mock('@/lib/deepClaim/audio', () => ({ createDeepClaimAudio: () => { const settings = { master: false, music: true, ambient: true, sfx: true, volume: .65 }; return { getSnapshot: () => settings, subscribe: () => () => {}, setScene: vi.fn(), updateSettings: vi.fn(), unlock: vi.fn(), play: vi.fn(), setActive: vi.fn(), dispose: vi.fn() }; } }));
const confirmed = vi.fn();
const selectFind = vi.fn();
const locate = vi.fn();
function find(overrides: Partial<DeepClaimDiscovery> = {}): DeepClaimDiscovery { return { id: 'find-1', job_id: 'job-1', x: 47, y: 3, kind: 'banded_geode', name: 'Banded Geode', quality: 'fine', detail: 'A 320g specimen with pale quartz bands.', sale_value: 42, salvage: { quartz: 2, stone: 3 }, status: 'pending', discovered_at: '2026-11-01T11:59:00Z', resolved_at: null, ...overrides }; }
function report(overrides: Partial<DeepClaimFieldReport> = {}): DeepClaimFieldReport { return { id: 'report-1', job_id: 'job-1', kind: 'incident', title: 'A short rockfall delay', description: 'The crew paused to clear loose stone safely.', point: { x: 47, y: 108 }, occurred_at: '2026-11-01T11:59:00Z', delay_seconds: 72, tiles_revealed: 0, infrastructure_id: null, discovery_id: null, ...overrides }; }
function quote(overrides: Partial<DeepClaimPreview> = {}): DeepClaimPreview { return { allowed: true, reasons: [], company_revision: 3, server_now: '2026-11-01T12:00:00Z', wages: 6, energy_per_worker: 1, duration_seconds: 1200, estimated_yield: { min: 0, max: 0 }, cargo_capacity: 40, risk_level: 'low', accessible_depth: 49, expected_resources: [], route: [{ x: 48, y: 1 }], projected_completion_at: '2026-11-01T12:20:00Z', stages: [{ key: 'travel', duration_seconds: 40 }, { key: 'setup', duration_seconds: 40 }, { key: 'work', duration_seconds: 1040 }, { key: 'haul', duration_seconds: 40 }, { key: 'return', duration_seconds: 40 }], operation_version: 3, operation_cost: 0, materials_cost: {}, conditions: { instability: 1, gas: 0, water: 0, incident_chance_percent: 0, max_delay_seconds: 0, transport_bonus_percent: 0, infrastructure_ids: [] }, survey: null, installation: null, ...overrides }; }
function App() { return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimPage /></MemoryRouter>; }
function Dispatch({ snapshot = wire.data!, mode = 'survey' as const }: { snapshot?: DeepClaimSnapshot; mode?: 'survey' | 'infrastructure' }) { return <DeepClaimDispatch snapshot={snapshot} initialMode={mode} initialTarget={{ x: 48, y: 1 }} onClose={wire.noop} busy={false} readOnly={false} preview={wire.preview} dispatch={wire.dispatch} />; }
function FieldLog({ data = wire.data!, selected = 'find-1', readOnly = false, view = 'finds' as const }: { data?: DeepClaimSnapshot; selected?: string | null; readOnly?: boolean; view?: 'finds' | 'reports' | 'ledger' }) { return <DeepClaimFieldLog snapshot={data} view={view} onView={wire.noop} selectedFindId={selected} onSelectFind={selectFind} onLocate={locate} resolveDiscovery={wire.resolve} busy={false} readOnly={readOnly} onConfirmed={confirmed} />; }
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); wire.data = phaseThreeSnapshot(); wire.readOnly = false; wire.pending = null; wire.preview.mockResolvedValue(quote()); wire.dispatch.mockResolvedValue(wire.data); wire.resolve.mockResolvedValue(wire.data); });
afterEach(cleanup);

describe('Deep Claim field planning', () => {
  it('keeps workforce and production operational in schema3 within the same six tabs', () => {
    render(<App />); continueDeepClaimCompany(); expect(screen.getAllByRole('tab')).toHaveLength(6); fireEvent.click(screen.getByRole('tab', { name: 'Crew' })); expect(screen.getByRole('group', { name: 'Crew view' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('tab', { name: 'Stores' })); expect(screen.getByRole('group', { name: 'Stores view' })).toBeInTheDocument();
  });
  it('offers shaft-connected depleted sites for field work and excludes occupied infrastructure cells', () => {
    const data = phaseThreeSnapshot(); data.world!.tiles.push({ x: 40, y: 8, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0 }); expect(claimTargets(data, 'survey')).toContainEqual({ x: 48, y: 1 }); expect(claimTargets(data, 'survey')).not.toContainEqual({ x: 40, y: 8 }); data.infrastructure = [{ id: 'supports-1', key: 'supports', x: 48, y: 1, grade: 1, radius: 7, strength: 7, status: 'installed', job_id: 'job', installed_at: data.server_now }]; expect(claimTargets(data, 'infrastructure')).not.toContainEqual({ x: 48, y: 1 }); expect(claimTargets(data, 'survey')).toContainEqual({ x: 48, y: 1 });
  });
  it('exposes four readable operation modes and a bounded six-worker chooser', () => {
    wire.data!.workers = Array.from({ length: 12 }, (_, index) => ({ ...wire.data!.workers[0], id: `crew-${index}`, name: `Crew ${index}` })); render(<Dispatch />); expect(within(screen.getByRole('group', { name: 'Expedition type' })).getAllByRole('button')).toHaveLength(4); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Change crew' })); expect(screen.getAllByRole('checkbox')).toHaveLength(6); expect(screen.getByRole('checkbox', { name: 'Send Crew 3' })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: 'Next crew page' })); expect(screen.getAllByRole('checkbox')).toHaveLength(6); expect(screen.getByRole('checkbox', { name: 'Send Crew 6' })).toBeDisabled(); expect(screen.getByText('Crew 2/2')).toBeInTheDocument();
  });
  const worksiteGroup = () => screen.getByRole('group', { name: 'Expedition worksite' });
  const siteButtons = () => worksiteGroup().querySelectorAll('button[data-dc-worksite]');
  const chosenSite = () => within(worksiteGroup()).getByRole('button', { pressed: true });
  function manySites() {
    const data = phaseThreeSnapshot(); data.world!.max_depth = 599;
    data.world!.tiles = Array.from({ length: 600 }, (_, index) => ({ x: index % 2 ? 47 : 48, y: Math.floor(index / 2) + 1, terrain: 'excavated' as const, material: null, remaining: 0, initial_amount: 0 })); return data;
  }
  it('bounds a600site worksite board and pages without changing the selected target', () => {
    render(<Dispatch snapshot={manySites()} />); expect(siteButtons()).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Next worksite page' })); expect(siteButtons()).toHaveLength(5);
    expect(chosenSite()).toHaveAttribute('data-dc-worksite', '48:1'); expect(screen.getByText('5–8 / 600')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous worksite page' })); expect(siteButtons()).toHaveLength(4);
  });
  it('finds exact public sites without coordinate prose or silently changing the selection', () => {
    render(<Dispatch snapshot={manySites()} />); fireEvent.change(screen.getByRole('searchbox', { name: 'Depth or material' }), { target: { value: '299m' } });
    expect(siteButtons()).toHaveLength(3); expect(worksiteGroup()).toHaveTextContent('299m · West 1m'); expect(worksiteGroup()).not.toHaveTextContent('x47');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Depth or material' }), { target: { value: '48:299' } }); expect(siteButtons()).toHaveLength(2);
    expect(chosenSite()).toHaveAttribute('data-dc-worksite', '48:1'); expect(screen.getByRole('button', { name: 'Next worksite page' })).toBeDisabled();
  });
  it('pins a deep map selection across search and resets browsing when the operation changes', () => {
    render(<DeepClaimDispatch snapshot={manySites()} initialMode="survey" initialTarget={{ x: 47, y: 299 }} onClose={wire.noop} busy={false} readOnly={false} preview={wire.preview} dispatch={wire.dispatch} />);
    expect(siteButtons()).toHaveLength(5); expect(chosenSite()).toHaveAttribute('data-dc-worksite', '47:299');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Depth or material' }), { target: { value: 'no matches' } }); expect(siteButtons()).toHaveLength(1);
    expect(within(worksiteGroup()).getByRole('status')).toHaveTextContent('No matching sites'); expect(chosenSite()).toHaveAttribute('data-dc-worksite', '47:299');
    fireEvent.click(screen.getByRole('button', { name: 'Improve the mine' })); expect(screen.getByRole('searchbox', { name: 'Depth or material' })).toHaveValue('');
    expect(screen.getByText('1–4 / 600')).toBeInTheDocument(); expect(chosenSite()).toHaveAttribute('data-dc-worksite', '47:299'); expect(siteButtons()).toHaveLength(5);
  });
  it('reviews the exact chosen worksite and freezes selection while the foreman checks it', async () => {
    let resolve!: (value: DeepClaimPreview) => void; wire.preview.mockImplementation(() => new Promise<DeepClaimPreview>(done => { resolve = done; }));
    render(<Dispatch snapshot={manySites()} />); fireEvent.change(screen.getByRole('searchbox', { name: 'Depth or material' }), { target: { value: '47:299' } });
    fireEvent.click(worksiteGroup().querySelector('[data-dc-worksite="47:299"]')!); fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    expect(wire.preview).toHaveBeenCalledWith(expect.objectContaining({ target_x: 47, target_y: 299 }));
    expect([...siteButtons()].every(button => (button as HTMLButtonElement).disabled)).toBe(true); expect(screen.getByRole('searchbox')).toBeDisabled();
    resolve(quote()); await screen.findByRole('button', { name: 'Dispatch crew' }); expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit plan' })); expect(chosenSite()).toHaveAttribute('data-dc-worksite', '47:299');
  });
  it('does not retain a hidden filter when a refreshed mine has only a few sites', () => {
    const data = manySites(), view = render(<Dispatch snapshot={data} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Depth or material' }), { target: { value: 'no matches' } });
    view.rerender(<Dispatch snapshot={{ ...data, revision: 4, world: { ...data.world!, tiles: data.world!.tiles.slice(0, 4) } }} />);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument(); expect(siteButtons()).toHaveLength(4);
    expect(chosenSite()).toHaveAttribute('data-dc-worksite', '48:1');
  });
  it('enters a separate survey review without a haul promise and submits the verified revision', async () => {
    wire.preview.mockResolvedValue(quote({ survey: { radius: 3, tile_limit: 17 }, company_revision: 4 })); render(<Dispatch />); fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' })); const confirm = await screen.findByRole('button', { name: 'Dispatch crew' }); expect(screen.queryByRole('group', { name: 'Expedition type' })).not.toBeInTheDocument(); expect(screen.getByText('Survey radius')).toBeInTheDocument(); expect(screen.queryByText('Estimated haul')).not.toBeInTheDocument(); expect(wire.preview).toHaveBeenCalledWith({ worker_ids: ['worker-a', 'worker-b', 'worker-c'], mode: 'survey', target_x: 48, target_y: 1, duration_minutes: 20, tutorial: false, infrastructure_key: null }); fireEvent.click(confirm); await waitFor(() => expect(wire.dispatch).toHaveBeenCalledWith(expect.objectContaining({ mode: 'survey' }), 4));
  });
  it('quotes the selected infrastructure key and shows server materials, fee, grade and coverage', async () => {
    wire.preview.mockResolvedValue(quote({ operation_cost: 91, materials_cost: { stone: 17, clay: 3 }, installation: { key: 'pump', grade: 2, radius: 14, strength: 11 } })); render(<Dispatch mode="infrastructure" />); fireEvent.click(within(screen.getByRole('group', { name: 'Infrastructure project' })).getByRole('button', { name: /Drainage Pump/ })); fireEvent.click(screen.getByRole('button', { name: /^Grade 2/ })); fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' })); await screen.findByRole('button', { name: 'Dispatch crew' }); expect(wire.preview).toHaveBeenCalledWith(expect.objectContaining({ mode: 'infrastructure', infrastructure_key: 'pump', duration_minutes: 60 })); expect(screen.getByText('91 cr')).toBeInTheDocument(); expect(screen.getByText('Drainage Pump · grade 2')).toBeInTheDocument(); expect(screen.getByText(/14-tile radius/)).toBeInTheDocument(); expect(screen.getByLabelText('Project materials consumed now')).toHaveTextContent('17Stone'); expect(screen.queryByText('Estimated haul')).not.toBeInTheDocument();
  });
  it('shows transparent delay chance and mitigations without inventing an incident', async () => {
    wire.preview.mockResolvedValue(quote({ conditions: { instability: 2, gas: 1, water: 1, incident_chance_percent: 13, max_delay_seconds: 132, transport_bonus_percent: 25, infrastructure_ids: ['rail-1', 'pump-1'] } })); render(<Dispatch />); fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' })); await screen.findByRole('button', { name: 'Dispatch crew' }); expect(screen.getByText('13% delay chance')).toBeInTheDocument(); expect(screen.getByText('Up to 132s extra')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Conditions' })); expect(screen.getByText('25% bonus')).toBeInTheDocument(); expect(screen.getByText(/no workers, tunnels or resources are lost/i)).toBeInTheDocument(); expect(screen.queryByText('A short rockfall delay')).not.toBeInTheDocument();
  });
  it('returns to the editable plan and invalidates a quote after the company changes', async () => {
    const data = phaseThreeSnapshot(); const view = render(<Dispatch snapshot={data} />); fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' })); await screen.findByRole('button', { name: 'Dispatch crew' }); fireEvent.click(screen.getByRole('button', { name: 'Edit plan' })); expect(screen.getByRole('group', { name: 'Expedition type' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' })); await screen.findByRole('button', { name: 'Dispatch crew' }); view.rerender(<Dispatch snapshot={{ ...data, revision: 5 }} />); expect(screen.queryByRole('button', { name: 'Dispatch crew' })).not.toBeInTheDocument(); expect(screen.getByText(/Your camp changed/)).toBeInTheDocument();
  });
  it('switches an incompatible passage context to an eligible mining frontier', () => {
    render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Map shaft passage' })); const sheet = screen.getByRole('dialog', { name: 'Underground operations' }); fireEvent.click(within(sheet).getByRole('button', { name: 'Expand tunnels' })); expect(screen.getByRole('dialog', { name: 'Expand tunnels' })).toBeInTheDocument(); expect(chosenSite()).not.toHaveAttribute('data-dc-worksite', '48:1');
  });
  it('opens a contextual operation sheet from a known passage and keeps keyboard/list alternatives', () => {
    render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('tab', { name: 'Mine' })); expect(screen.getByRole('button', { name: 'Open mine operations' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Map shaft passage' })); const sheet = screen.getByRole('dialog', { name: 'Underground operations' }); fireEvent.click(within(sheet).getByRole('button', { name: 'Scout the area' })); expect(screen.getByRole('dialog', { name: 'Scout the area' })).toBeInTheDocument(); expect(chosenSite()).toHaveAttribute('data-dc-worksite', '48:1');
  });
});

describe('Deep Claim finite discoveries and committed reports', () => {
  beforeEach(() => { wire.data!.discoveries = [find()]; wire.data!.discovery_summary = { pending: 1, kept: 0, sold: 0, salvaged: 0 }; });
  it.each([['Keep in cabinet', 'Confirm keep', 'keep'], ['Sell specimen', 'Confirm sale', 'sell'], ['Salvage materials', 'Confirm salvage', 'salvage']] as const)('requires a deliberate %s decision and sends the frozen company revision', async (label, button, choice) => {
    render(<FieldLog />); const dialog = screen.getByRole('dialog', { name: 'Banded Geode' }); expect(wire.resolve).not.toHaveBeenCalled(); fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`^${label}`) })); expect(wire.resolve).not.toHaveBeenCalled(); fireEvent.click(within(dialog).getByRole('button', { name: button })); await waitFor(() => expect(wire.resolve).toHaveBeenCalledWith('find-1', choice, 3));
  });
  it('requires the entire salvage to fit without consuming a pending specimen', () => {
    wire.data!.company!.warehouse_used = wire.data!.company!.warehouse_capacity - 4; render(<FieldLog />); fireEvent.click(screen.getByRole('button', { name: /^Salvage materials/ })); expect(screen.getByRole('button', { name: 'Confirm salvage' })).toBeDisabled(); expect(screen.getByText(/The find stays pending/)).toBeInTheDocument(); expect(wire.resolve).not.toHaveBeenCalled();
  });
  it('invalidates a decision on a newer snapshot and requires reviewing it again', () => {
    const view = render(<FieldLog />); fireEvent.click(screen.getByRole('button', { name: /^Sell specimen/ })); view.rerender(<FieldLog data={{ ...wire.data!, revision: 4 }} />); expect(screen.getByRole('button', { name: 'Confirm sale' })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: /^Sell specimen/ })); expect(screen.getByRole('button', { name: 'Confirm sale' })).toBeEnabled(); expect(wire.resolve).not.toHaveBeenCalled();
  });
  it('does not carry a selected decision into another specimen', () => {
    wire.data!.discoveries!.push(find({ id: 'find-2', name: 'Second Geode' })); const view = render(<FieldLog />); fireEvent.click(screen.getByRole('button', { name: /^Sell specimen/ })); view.rerender(<FieldLog selected="find-2" />); expect(screen.getByRole('button', { name: 'Choose a decision' })).toBeDisabled(); expect(wire.resolve).not.toHaveBeenCalled();
  });
  it('keeps decisions disabled while offline but permits finding the public site', () => {
    render(<FieldLog readOnly />); expect(screen.getByRole('button', { name: /^Keep in cabinet/ })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: 'Locate find site' })); expect(locate).toHaveBeenCalledWith(expect.objectContaining({ x: 47, y: 3 })); expect(wire.resolve).not.toHaveBeenCalled();
  });
  it('makes resolved specimens read-only and preserves the real cabinet record', () => {
    wire.data!.discoveries = [find({ status: 'kept', resolved_at: wire.data!.server_now })]; wire.data!.discovery_summary = { pending: 0, kept: 1, sold: 0, salvaged: 0 }; render(<FieldLog />); expect(screen.queryByRole('group', { name: 'Find decision' })).not.toBeInTheDocument(); expect(screen.getByText('This specimen is preserved in your company’s cabinet.')).toBeInTheDocument(); expect(wire.resolve).not.toHaveBeenCalled();
  });
  it('shows only committed report content and locates the exact public incident site', () => {
    wire.data!.field_reports = [report()]; render(<FieldLog view="reports" selected={null} />); fireEvent.click(screen.getByRole('button', { name: 'Read report: A short rockfall delay' })); const detail = screen.getByRole('dialog', { name: 'A short rockfall delay' }); expect(detail).toHaveTextContent('72s'); expect(detail).toHaveTextContent('108m'); fireEvent.click(within(detail).getByRole('button', { name: 'Locate report site' })); expect(locate).toHaveBeenCalledWith({ x: 47, y: 108 });
  });
  it('prioritizes actual finds on the surface and focuses their site without resetting ordinary map state', () => {
    render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Review finds · 1' })); expect(screen.getByRole('tab', { name: /Log/ })).toHaveAttribute('aria-selected', 'true'); fireEvent.click(screen.getByRole('button', { name: 'Inspect Banded Geode' })); fireEvent.click(screen.getByRole('button', { name: 'Locate find site' })); expect(screen.getByRole('tab', { name: 'Mine' })).toHaveAttribute('aria-selected', 'true'); expect(screen.getByTestId('mine-canvas')).toHaveAttribute('data-focus', '47:3');
  });
  it('shows six pending finds per page without losing later decisions', () => {
    wire.data!.discoveries = Array.from({ length: 8 }, (_, index) => find({ id: `find-${index}`, name: `Specimen ${index}` })); wire.data!.discovery_summary!.pending = 8; render(<FieldLog selected={null} />); expect(screen.getAllByRole('button', { name: /^Inspect Specimen/ })).toHaveLength(6); fireEvent.click(screen.getByRole('button', { name: 'Next finds page' })); expect(screen.getAllByRole('button', { name: /^Inspect Specimen/ })).toHaveLength(2); fireEvent.click(screen.getByRole('button', { name: 'Inspect Specimen 7' })); expect(selectFind).toHaveBeenCalledWith('find-7');
  });
  it('keeps field decisions reachable while blocking a new shift at the pending-find cap', () => {
    wire.data!.discovery_summary!.pending = 24; render(<App />); continueDeepClaimCompany(); expect(screen.getByRole('button', { name: 'Review finds · 24' })).toBeEnabled(); expect(screen.getByRole('button', { name: 'Mine a deposit' })).toBeDisabled(); expect(screen.getByRole('tab', { name: 'Mine' })).toBeEnabled(); expect(wire.dispatch).not.toHaveBeenCalled();
  });
  it('finishes auxiliary field jobs without displaying an empty cargo collection action', () => {
    wire.data!.discoveries = []; wire.data!.discovery_summary!.pending = 0; wire.data!.field_reports = [report({ kind: 'survey', title: 'Survey complete', delay_seconds: 0, tiles_revealed: 11 })]; wire.data!.expeditions = [{ id: 'survey-1', mode: 'survey', status: 'collected', worker_ids: ['worker-a'], target: { x: 48, y: 1 }, path: [], stages: [], stage: 'collected', started_at: wire.data!.server_now, completes_at: wire.data!.server_now, duration_minutes: 20, duration_seconds: 1200, tutorial: false, wages: 2, energy_per_worker: 1, config_version: 3, cargo: {} }]; render(<App />); continueDeepClaimCompany(); expect(screen.queryByRole('button', { name: 'Open haul' })).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('tab', { name: 'Log' })); fireEvent.click(screen.getByRole('button', { name: 'Reports' })); expect(screen.getByRole('button', { name: 'Read report: Survey complete' })).toBeInTheDocument();
  });
});
