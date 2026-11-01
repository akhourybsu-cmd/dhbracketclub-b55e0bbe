import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeepClaimPage from '@/pages/DeepClaimPage';
import { ClaimState } from '@/components/deepClaim/DeepClaimPrimitives';
import { STARTER_WORKERS, buildingEffect } from '@/lib/deepClaim/catalog';
import type { DeepClaimExpedition, DeepClaimPreview, DeepClaimSnapshot } from '@/lib/deepClaim/types';

const wire = vi.hoisted(() => ({ data: null as DeepClaimSnapshot | null, installed: true, readOnly: false, pending: null as string | null, hook: vi.fn(), preview: vi.fn(), dispatch: vi.fn(), collect: vi.fn(), sell: vi.fn(), upgrade: vi.fn(), refresh: vi.fn(), bootstrap: vi.fn(), retry: vi.fn(), unlock: vi.fn(), audioUpdate: vi.fn(), play: vi.fn(), dispose: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'player' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club' }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => wire.installed, refresh: wire.refresh }) }));
vi.mock('@/hooks/useDeepClaim', () => ({ useDeepClaim: () => { wire.hook(); return { data: wire.data, loading: false, refreshing: false, error: null, busy: false, readOnly: wire.readOnly, pendingAction: wire.pending, serverNow: () => Date.parse('2026-11-02T12:00:00Z'), refresh: wire.refresh, bootstrap: wire.bootstrap, preview: wire.preview, dispatch: wire.dispatch, collect: wire.collect, sell: wire.sell, upgrade: wire.upgrade, retryPending: wire.retry }; } }));
vi.mock('@/components/deepClaim/renderer/DeepClaimCanvas', () => ({ DeepClaimCanvas: () => <div data-testid="deep-claim-canvas" /> }));
vi.mock('@/lib/deepClaim/audio', () => ({ createDeepClaimAudio: () => { const snapshot = { master: false, music: true, ambient: true, sfx: true, volume: .65 }; return { getSnapshot: () => snapshot, subscribe: () => () => {}, updateSettings: wire.audioUpdate, unlock: wire.unlock, play: wire.play, setActive: vi.fn(), dispose: wire.dispose }; } }));
const at = '2026-11-02T12:00:00Z';
function snapshot(): DeepClaimSnapshot {
  return { schema_version: 1, server_now: at, revision: 1, company: { id: 'company', user_id: 'player', club_id: 'club', name: 'Flint & Co', cash: 100, timezone: 'America/New_York', energy_day: '2026-11-02', tutorial_used: false, warehouse_capacity: 120, warehouse_used: 0, crew_slots: 1 }, resources: {},
    workers: STARTER_WORKERS.map((worker, index) => ({ id: `worker-${index}`, name: worker.name, specialty: worker.specialty, traits: [...worker.traits], stats: { ...worker.stats }, xp: 0, level: 1, energy: 6, assigned_job_id: null })),
    world: { width: 96, chunk_size: 32, revision: 1, max_depth: 49, tiles: [...[1, 2, 3, 4, 5, 6].map(y => ({ x: 48, y, terrain: 'excavated' as const, material: null, remaining: 0, initial_amount: 0 })), ...([
      [47, 1, 'coal', 10], [49, 1, 'stone', 12], [46, 1, 'clay', 16], [50, 1, 'copper_ore', 18],
      [47, 2, 'tin_ore', 12], [49, 2, 'iron_ore', 15], [47, 3, 'quartz', 8], [49, 3, 'silver_ore', 3],
    ] as const).map(([x, y, material, remaining]) => ({ x, y, terrain: material === 'clay' ? 'soil' as const : 'stone' as const, material, remaining, initial_amount: remaining }))] },
    expeditions: [], buildings: (['mine_office', 'mine_shaft', 'warehouse', 'tool_station'] as const).map(key => ({ key, level: 1, max_level: 3, upgrade_cost: 50, effect: buildingEffect(key, 1) })), log: [],
  };
}
function quote(overrides: Partial<DeepClaimPreview> = {}): DeepClaimPreview { return { allowed: true, reasons: [], company_revision: 1, server_now: at, wages: 7, energy_per_worker: 1, duration_seconds: 30, estimated_yield: { min: 10, max: 20 }, cargo_capacity: 40, risk_level: 'low', accessible_depth: 49, expected_resources: ['copper_ore'], projected_completion_at: '2026-11-02T12:00:30Z', route: [{ x: 48, y: 1 }, { x: 47, y: 1 }], stages: ['travel', 'setup', 'work', 'haul', 'return'].map(key => ({ key, duration_seconds: 6 })) as DeepClaimPreview['stages'], ...overrides }; }
function haul(status: DeepClaimExpedition['status'] = 'ready'): DeepClaimExpedition { return { id: 'shift-1', mode: 'extract', status, worker_ids: ['worker-0'], target: { x: 47, y: 1 }, path: [{ x: 48, y: 1 }, { x: 47, y: 1 }], stage: status === 'active' ? 'work' : status, started_at: '2026-11-02T11:59:30Z', completes_at: at, duration_minutes: 20, duration_seconds: 30, tutorial: true, wages: 3, energy_per_worker: 1, config_version: 1, cargo: status === 'active' ? null : { copper_ore: 20 }, stages: (['travel', 'setup', 'work', 'haul', 'return'] as const).map(key => ({ key, starts_at: '2026-11-02T11:59:30Z', ends_at: at })) }; }
function Harness() { return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimPage /></MemoryRouter>; }
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); wire.data = snapshot(); wire.installed = true; wire.readOnly = false; wire.pending = null; wire.preview.mockResolvedValue(quote()); wire.dispatch.mockResolvedValue(snapshot()); wire.unlock.mockResolvedValue(true); wire.retry.mockResolvedValue(snapshot()); });
afterEach(cleanup);

describe('Deep Claim first play and dispatch confirmation', () => {
  it('keeps the loading retry usable while an earlier fetch is still running', () => {
    render(<ClaimState onRetry={wire.refresh} refreshing />);
    const retry = screen.getByRole('button', { name: 'Retry loading' });
    expect(retry).toBeEnabled(); fireEvent.click(retry); expect(wire.refresh).toHaveBeenCalledOnce();
  });
  it('does not mount company transport or game content when the club has not installed it', () => {
    wire.installed = false; render(<Harness />);
    expect(screen.getByRole('link', { name: 'Return to DH' })).toBeInTheDocument();
    expect(wire.hook).not.toHaveBeenCalled(); expect(screen.queryByTestId('deep-claim-canvas')).not.toBeInTheDocument();
  });
  it('gives a first-time company a directly valid 30-second extraction, only after a server quote', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Start first shift · 30s' }));
    const dialog = screen.getByRole('dialog', { name: 'Work a seam' });
    expect(within(dialog).getByRole('checkbox', { name: /First shift/ })).toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review dispatch' }));
    expect(wire.dispatch).not.toHaveBeenCalled();
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Dispatch crew' }));
    await waitFor(() => expect(wire.dispatch).toHaveBeenCalledWith({ worker_ids: ['worker-0', 'worker-1', 'worker-2'], mode: 'extract', target_x: 47, target_y: 1, duration_minutes: 20, tutorial: true }, 1));
  });
  it('only enters a new company after the bootstrap server snapshot arrives', async () => {
    wire.data = { ...snapshot(), company: null, world: null, workers: [], resources: {}, expeditions: [], buildings: [], log: [] };
    wire.bootstrap.mockImplementation(async () => { wire.data = snapshot(); return wire.data; });
    render(<Harness />);
    expect(screen.queryByTestId('deep-claim-canvas')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Frontier Works' } });
    fireEvent.click(screen.getByRole('button', { name: 'Found company' }));
    await waitFor(() => expect(wire.bootstrap).toHaveBeenCalledWith('Frontier Works'));
    expect(await screen.findByTestId('deep-claim-canvas')).toBeInTheDocument();
  });
  it('keeps normal exploration distinct from the accelerated first shift and clears edited quotes', async () => {
    render(<Harness />); fireEvent.click(screen.getByRole('button', { name: 'Explore' }));
    const dialog = screen.getByRole('dialog', { name: 'Survey new ground' });
    expect(within(dialog).getByRole('checkbox', { name: /First shift/ })).not.toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review dispatch' }));
    await within(dialog).findByRole('button', { name: 'Dispatch crew' });
    expect(wire.preview.mock.calls[0][0]).toMatchObject({ mode: 'explore', duration_minutes: 20, tutorial: false });
    fireEvent.click(within(dialog).getByRole('button', { name: /Standard/ }));
    expect(within(dialog).queryByRole('button', { name: 'Dispatch crew' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Review dispatch' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /First shift/ }));
    expect(screen.getByRole('dialog', { name: 'Work a seam' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Expedition worksite')).toHaveValue('47:1');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review dispatch' }));
    await waitFor(() => expect(wire.preview).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'extract', target_x: 47, target_y: 1, duration_minutes: 20, tutorial: true })));
  });
  it('shows authoritative blocked reasons and never exposes a confirm action for them', async () => {
    wire.preview.mockResolvedValue(quote({ allowed: false, reasons: ['Crew slots are occupied.'] }));
    render(<Harness />); fireEvent.click(screen.getByRole('button', { name: 'Start first shift · 30s' }));
    const dialog = screen.getByRole('dialog', { name: 'Work a seam' }); fireEvent.click(within(dialog).getByRole('button', { name: 'Review dispatch' }));
    expect(await within(dialog).findByText('Crew slots are occupied.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Dispatch crew' })).not.toBeInTheDocument(); expect(wire.dispatch).not.toHaveBeenCalled();
  });
  it('accepts a newer authoritative preview but invalidates it if the cached company later advances', async () => {
    wire.preview.mockResolvedValue(quote({ company_revision: 2 }));
    const view = render(<Harness />); fireEvent.click(screen.getByRole('button', { name: 'Start first shift · 30s' }));
    const dialog = screen.getByRole('dialog', { name: 'Work a seam' }); fireEvent.click(within(dialog).getByRole('button', { name: 'Review dispatch' }));
    expect(await within(dialog).findByRole('button', { name: 'Dispatch crew' })).toBeInTheDocument();
    wire.data = { ...wire.data!, revision: 3 }; view.rerender(<Harness />);
    expect(within(dialog).getByText(/Your camp changed/)).toBeInTheDocument(); expect(within(dialog).queryByRole('button', { name: 'Dispatch crew' })).not.toBeInTheDocument();
  });
});

describe('Deep Claim authoritative hauls and recovery', () => {
  it('treats collected historical cargo as secured, not as uncollected staged cargo', async () => {
    wire.data!.expeditions = [haul()]; wire.data!.company!.tutorial_used = true;
    const updated = snapshot(); updated.revision = 2; updated.resources = { copper_ore: 20 }; updated.company!.warehouse_used = 20; updated.company!.tutorial_used = true; updated.expeditions = [haul('collected')];
    wire.collect.mockImplementation(async () => { wire.data = updated; return updated; });
    render(<Harness />); fireEvent.click(screen.getByRole('button', { name: 'Open haul' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collect into storage' }));
    const reward = await screen.findByRole('dialog', { name: 'Haul secured.' });
    expect(reward).toHaveTextContent('20'); expect(reward).toHaveTextContent('Copper ore'); expect(reward).not.toHaveTextContent('remain staged');
  });
  it('preserves and clearly reports the remaining cargo after a partial collection', async () => {
    wire.data!.expeditions = [haul()]; wire.data!.company!.warehouse_used = 105; wire.data!.resources = { stone: 105 };
    const updated = snapshot(); updated.revision = 2; updated.resources = { stone: 105, copper_ore: 15 }; updated.company!.warehouse_used = 120; updated.expeditions = [{ ...haul(), cargo: { copper_ore: 5 } }];
    wire.collect.mockImplementation(async () => { wire.data = updated; return updated; });
    render(<Harness />); fireEvent.click(screen.getByRole('button', { name: 'Open haul' })); fireEvent.click(screen.getByRole('button', { name: 'Collect into storage' }));
    const reward = await screen.findByRole('dialog', { name: 'Haul secured.' }); expect(reward).toHaveTextContent('15'); expect(reward).toHaveTextContent('5 units remain staged');
  });
  it('guides a collected first haul through Stores and one real camp upgrade, then releases the guide', async () => {
    wire.data!.company!.tutorial_used = true; wire.data!.company!.warehouse_used = 20; wire.data!.resources = { copper_ore: 20 }; wire.data!.expeditions = [haul('collected')];
    const view = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Sell first haul' }));
    expect(screen.getByRole('tab', { name: 'Stores' })).toHaveAttribute('aria-selected', 'true');
    wire.data = { ...wire.data!, revision: 2, resources: {}, company: { ...wire.data!.company!, cash: 400, warehouse_used: 0 } }; view.rerender(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: 'Surface' })); fireEvent.click(screen.getByRole('button', { name: 'Review camp upgrades' }));
    fireEvent.click(screen.getByRole('button', { name: /Mine Office.*Level 1/ }));
    const building = screen.getByRole('dialog', { name: 'Mine Office' }); expect(building).toHaveTextContent(buildingEffect('mine_office', 2));
    wire.upgrade.mockImplementation(async () => { wire.data = { ...wire.data!, revision: 3, buildings: wire.data!.buildings.map(item => item.key === 'mine_office' ? { ...item, level: 2, effect: buildingEffect(item.key, 2) } : item) }; return wire.data; });
    fireEvent.click(within(building).getByRole('button', { name: 'Confirm upgrade' }));
    const reward = await screen.findByRole('dialog', { name: 'Mine Office upgraded.' }); fireEvent.click(within(reward).getByRole('button', { name: 'Back to the claim' }));
    expect(screen.getByRole('button', { name: 'Explore' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Review camp upgrades' })).not.toBeInTheDocument();
  });
  it('keeps an unconfirmed action read-only and retries the saved receipt instead of creating another action', async () => {
    wire.pending = 'Dispatch crew'; wire.readOnly = true;
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Start first shift · 30s' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Return to DH' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm sync' }));
    await waitFor(() => expect(wire.retry).toHaveBeenCalledOnce()); expect(wire.dispatch).not.toHaveBeenCalled(); expect(wire.collect).not.toHaveBeenCalled();
  });
  it('exposes all three persistent workers and current seven-skill profiles without hiring placeholders', () => {
    const view = render(<Harness />); fireEvent.click(screen.getByRole('tab', { name: 'Crew' }));
    for (const worker of STARTER_WORKERS) expect(screen.getByRole('heading', { name: worker.name })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Crew file' })[0]);
    const profile = screen.getByRole('dialog', { name: 'Mara Flint' }); expect(profile).toHaveTextContent('10% more extraction output'); expect(profile).toHaveTextContent('Leadership');
    wire.data = { ...wire.data!, workers: wire.data!.workers.map((worker, index) => index === 0 ? { ...worker, energy: 0 } : worker) }; view.rerender(<Harness />);
    expect(profile).toHaveTextContent('0/6 energy'); expect(profile).not.toHaveTextContent('Hire');
  });
  it('requires a valid whole stock quantity before passing a sale to the server', async () => {
    wire.data!.resources = { stone: 8 }; wire.data!.company!.warehouse_used = 8; wire.sell.mockResolvedValue(snapshot());
    render(<Harness />); fireEvent.click(screen.getByRole('tab', { name: 'Stores' })); fireEvent.click(screen.getByRole('button', { name: 'Sell Stone' }));
    const dialog = screen.getByRole('dialog', { name: 'Sell Stone' }); fireEvent.change(within(dialog).getByLabelText('Quantity to sell'), { target: { value: '0' } });
    expect(within(dialog).getByRole('button', { name: 'Confirm sale' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Quantity to sell'), { target: { value: '3' } }); fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm sale' }));
    await waitFor(() => expect(wire.sell).toHaveBeenCalledWith({ resource_key: 'stone', quantity: 3 }));
  });
  it('preserves the authoritative upgrade price plus two operating credits before enabling confirmation', () => {
    wire.data!.company!.cash = 50;
    const view = render(<Harness />); fireEvent.click(screen.getByRole('button', { name: 'Open camp buildings' })); fireEvent.click(screen.getByRole('button', { name: /Mine Office.*Level 1/ }));
    const dialog = screen.getByRole('dialog', { name: 'Mine Office' });
    expect(within(dialog).getByRole('button', { name: 'Confirm upgrade' })).toBeDisabled(); expect(dialog).toHaveTextContent('earn 2 more credits');
    wire.data = { ...wire.data!, company: { ...wire.data!.company!, cash: 52 } }; view.rerender(<Harness />);
    expect(within(dialog).getByRole('button', { name: 'Confirm upgrade' })).toBeEnabled(); expect(wire.upgrade).not.toHaveBeenCalled();
  });
  it('never unlocks audio before an explicit settings gesture', async () => {
    render(<Harness />); expect(wire.unlock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' })); expect(wire.unlock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('switch', { name: 'Enable sound' }));
    await waitFor(() => expect(wire.unlock).toHaveBeenCalledOnce()); expect(wire.audioUpdate).toHaveBeenCalledWith({ master: true });
  });
});
