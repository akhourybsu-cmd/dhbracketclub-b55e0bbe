import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeepClaimPage from '@/pages/DeepClaimPage';
import { continueDeepClaimCompany, skipDHGamesIntro } from './fixtures/deepClaimTutorialMock';
import { ClaimState } from '@/components/deepClaim/DeepClaimPrimitives';
import { STARTER_WORKERS, buildingEffect } from '@/lib/deepClaim/catalog';
import type { DeepClaimExpedition, DeepClaimPreview, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { acknowledgeReturnReport, returnReportKey, saveReturnReport } from '@/lib/deepClaim/returnReport';

const wire = vi.hoisted(() => ({ data: null as DeepClaimSnapshot | null, installed: true, authLoading: false, readOnly: false, pending: null as string | null, hook: vi.fn(), preview: vi.fn(), dispatch: vi.fn(), collect: vi.fn(), sell: vi.fn(), upgrade: vi.fn(), refresh: vi.fn(), bootstrap: vi.fn(), retry: vi.fn(), unlock: vi.fn(), audioUpdate: vi.fn(), play: vi.fn(), dispose: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'player' }, loading: wire.authLoading }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club' }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => wire.installed, refresh: wire.refresh }) }));
// Pixel backdrop lifecycle is covered separately; keep these economic suites renderer-free.
vi.mock('@/components/deepClaim/menu/DeepClaimMenuBackdrop', () => ({ DeepClaimMenuBackdrop: () => null }));
vi.mock('@/hooks/useDeepClaimTutorial', async () => ({ useDeepClaimTutorial: (await import('./fixtures/deepClaimTutorialMock')).useDeepClaimTutorialMock }));
vi.mock('@/hooks/useDeepClaim', () => ({ useDeepClaim: () => { wire.hook(); return { data: wire.data, loading: false, refreshing: false, error: null, busy: false, readOnly: wire.readOnly, pendingAction: wire.pending, serverNow: () => Date.parse('2026-11-02T12:00:00Z'), refresh: wire.refresh, bootstrap: wire.bootstrap, preview: wire.preview, dispatch: wire.dispatch, collect: wire.collect, sell: wire.sell, upgrade: wire.upgrade, retryPending: wire.retry }; } }));
vi.mock('@/components/deepClaim/renderer/DeepClaimCanvas', () => ({ DeepClaimCanvas: ({ focusRequest }: { focusRequest?: { point: { x: number; y: number } } }) => <div data-testid="deep-claim-canvas" data-focus={focusRequest ? `${focusRequest.point.x}:${focusRequest.point.y}` : ''} /> }));
vi.mock('@/lib/deepClaim/audio', () => ({ createDeepClaimAudio: () => { const snapshot = { master: false, music: true, ambient: true, sfx: true, volume: .65 }; return { getSnapshot: () => snapshot, subscribe: () => () => {}, setScene: vi.fn(), updateSettings: wire.audioUpdate, unlock: wire.unlock, play: wire.play, setActive: vi.fn(), dispose: wire.dispose }; } }));
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
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); wire.data = snapshot(); wire.installed = true; wire.authLoading = false; wire.readOnly = false; wire.pending = null; wire.preview.mockResolvedValue(quote()); wire.dispatch.mockResolvedValue(snapshot()); wire.unlock.mockResolvedValue(true); wire.retry.mockResolvedValue(snapshot()); });
afterEach(cleanup);

describe('Deep Claim connected session loop', () => {
  it('presents confirmed building levels and the actual effect once', async () => {
    wire.data!.company!.tutorial_used = true;
    wire.upgrade.mockImplementation(async key => {
      const updated = structuredClone(wire.data!); updated.revision++;
      const building = updated.buildings.find(item => item.key === key)!;
      building.level = 2; building.effect = '240 units of storage';
      wire.data = updated; return updated;
    });
    render(<Harness />); continueDeepClaimCompany();
    fireEvent.click(screen.getByRole('button', { name: 'Open camp buildings' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Buildings' })).getByRole('button', { name: /Warehouse/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm upgrade' }));
    const receipt = await screen.findByRole('dialog', { name: 'Warehouse upgraded.' });
    const change = receipt.querySelector('[data-dc-building-change="warehouse"]');
    expect(change).toHaveAttribute('data-from-level', '1'); expect(change).toHaveAttribute('data-to-level', '2');
    expect(within(receipt).getAllByText('240 units of storage')).toHaveLength(1); expect(wire.upgrade).toHaveBeenCalledExactlyOnceWith('warehouse');
  });
  it('shows departure only after dispatch confirmation and follows the actual public crew', async () => {
    wire.dispatch.mockImplementation(async input => {
      const updated = snapshot(); updated.revision = 2; updated.company!.tutorial_used = true;
      const job = { ...haul('active'), worker_ids: input.worker_ids };
      updated.expeditions = [job]; updated.workers = updated.workers.map(worker => ({ ...worker, assigned_job_id: input.worker_ids.includes(worker.id) ? job.id : null }));
      wire.data = updated; return updated;
    });
    render(<Harness />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Start first shift · 30s' }));
    expect(document.querySelector('[data-dc-departure]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dispatch crew' }));
    const departure = await screen.findByRole('status', { name: 'Crew departure' }); expect(departure).toHaveTextContent('Mara Flint');
    fireEvent.click(within(departure).getByRole('button', { name: 'Dismiss departure' }));
    const card = document.querySelector('[data-dc-expedition="shift-1"]')!;
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Follow crew' }));
    expect(screen.getByRole('tab', { name: 'Mine' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('deep-claim-canvas')).toHaveAttribute('data-focus', '47:1'); expect(wire.dispatch).toHaveBeenCalledOnce();
  });
  it('pins an investment across reload and opens its actual review without a purchase', async () => {
    wire.data!.company!.tutorial_used = true;
    const ui = render(<Harness />); continueDeepClaimCompany();
    fireEvent.click(screen.getByRole('button', { name: 'Choose company goal' }));
    fireEvent.click(document.querySelector('[data-dc-goal-id="building:warehouse:2"]')!);
    fireEvent.click(screen.getByRole('button', { name: 'Pin goal' }));
    expect(wire.upgrade).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog', { name: 'Company goals' })).not.toBeInTheDocument();
    ui.unmount(); render(<Harness />); continueDeepClaimCompany();
    fireEvent.click(screen.getByRole('button', { name: 'Review pinned goal' }));
    expect(screen.getByRole('dialog', { name: 'Warehouse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm upgrade' })).toBeEnabled(); expect(wire.upgrade).not.toHaveBeenCalled();
    wire.data = { ...wire.data!, company: { ...wire.data!.company!, cash: 1 } };
    fireEvent.click(screen.getByRole('button', { name: 'Back to camp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review pinned goal' }));
    expect(screen.getByRole('button', { name: 'Confirm upgrade' })).toBeDisabled();
  });
  it('reports a real return once per visit and never collects it automatically', async () => {
    wire.data!.company!.tutorial_used = true; wire.data!.expeditions = [haul('active')];
    const scope = { userId: 'player', clubId: 'club', companyId: 'company' };
    saveReturnReport(returnReportKey(scope), acknowledgeReturnReport(null, wire.data!, scope)!);
    wire.data = { ...wire.data!, revision: 2, expeditions: [haul('ready')] };
    const ui = render(<Harness />); continueDeepClaimCompany();
    const report = await screen.findByRole('dialog', { name: 'Shift report' });
    expect(report).toHaveTextContent('Copper ore'); expect(wire.collect).not.toHaveBeenCalled();
    fireEvent.click(within(report).getByRole('button', { name: 'Back to camp' }));
    ui.unmount(); render(<Harness />); continueDeepClaimCompany();
    expect(screen.queryByRole('dialog', { name: 'Shift report' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open shift report' }));
    expect(screen.getByRole('dialog', { name: 'Shift report' })).toBeInTheDocument(); expect(wire.collect).not.toHaveBeenCalled();
  });
  it('offers a fresh ordinary draft only after confirmed complete collection', async () => {
    wire.data!.company!.tutorial_used = true; wire.data!.expeditions = [haul()];
    wire.collect.mockImplementation(async () => {
      const updated = structuredClone(wire.data!); updated.revision++;
      updated.expeditions = [haul('collected')]; updated.world!.tiles.find(tile => tile.x === 47 && tile.y === 1)!.remaining = 0;
      updated.resources = { copper_ore: 20 }; updated.company!.warehouse_used = 20;
      wire.data = updated; return updated;
    });
    render(<Harness />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Open haul' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collect into storage' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Plan next shift' }));
    expect(screen.queryByRole('checkbox', { name: /First shift/ })).not.toBeInTheDocument();
    expect(wire.dispatch).not.toHaveBeenCalled(); expect(wire.preview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    await waitFor(() => expect(wire.preview).toHaveBeenCalledWith(expect.objectContaining({ mode: 'extract', duration_minutes: 20, tutorial: false, worker_ids: ['worker-0'] })));
    expect(wire.preview.mock.lastCall![0]).not.toMatchObject({ target_x: 47, target_y: 1 });
    expect(wire.collect).toHaveBeenCalledOnce(); expect(wire.dispatch).not.toHaveBeenCalled();
  });
});

describe('Deep Claim publisher entry', () => {
  it('keeps the menu inert through the timed intro, then focuses it without founding or playing audio', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    try {
      render(<Harness />);
      expect(screen.getByTestId('deep-claim-shell')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(4800));
      expect(screen.queryByTestId('dh-games-intro')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus();
      expect(wire.bootstrap).not.toHaveBeenCalled(); expect(wire.unlock).not.toHaveBeenCalled(); expect(wire.play).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it('does not replay when returning from the game to its main menu', () => {
    render(<Harness />); continueDeepClaimCompany();
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Return to Main Menu' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.queryByTestId('dh-games-intro')).not.toBeInTheDocument();
  });
  it('does not restart an already shown intro after a transient authentication loading state', () => {
    const view = render(<Harness />); skipDHGamesIntro();
    wire.authLoading = true; view.rerender(<Harness />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    wire.authLoading = false; view.rerender(<Harness />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.queryByTestId('dh-games-intro')).not.toBeInTheDocument();
  });
});

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
    render(<Harness />); continueDeepClaimCompany();
    fireEvent.click(screen.getByRole('button', { name: 'Start first shift · 30s' }));
    const dialog = screen.getByRole('dialog', { name: 'Extraction' });
    expect(within(dialog).getByRole('checkbox', { name: /First shift/ })).toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Extraction' }));
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
    skipDHGamesIntro();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip introduction' }));
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Frontier Works' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review deed' }));
    expect(wire.bootstrap).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Found company' }));
    await waitFor(() => expect(wire.bootstrap).toHaveBeenCalledWith('Frontier Works'));
    expect(await screen.findByTestId('deep-claim-canvas')).toBeInTheDocument();
  });
  it('keeps normal exploration distinct from the accelerated first shift and clears edited quotes', async () => {
    render(<Harness />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Explore' }));
    const dialog = screen.getByRole('dialog', { name: 'Exploration' });
    expect(within(dialog).getByRole('checkbox', { name: /First shift/ })).not.toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review dispatch' }));
    await within(dialog).findByRole('button', { name: 'Dispatch crew' });
    expect(wire.preview.mock.calls[0][0]).toMatchObject({ mode: 'explore', duration_minutes: 20, tutorial: false });
    fireEvent.click(within(dialog).getByRole('button', { name: /Standard/ }));
    expect(within(dialog).queryByRole('button', { name: 'Dispatch crew' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Review dispatch' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /First shift/ }));
    expect(screen.getByRole('dialog', { name: 'Extraction' })).toBeInTheDocument();
    expect(within(within(dialog).getByRole('group', { name: 'Expedition worksite' })).getByRole('button', { pressed: true })).toHaveAttribute('data-dc-worksite', '47:1');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review dispatch' }));
    await waitFor(() => expect(wire.preview).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'extract', target_x: 47, target_y: 1, duration_minutes: 20, tutorial: true })));
  });
  it('shows authoritative blocked reasons and never exposes a confirm action for them', async () => {
    wire.preview.mockResolvedValue(quote({ allowed: false, reasons: ['Crew slots are occupied.'] }));
    render(<Harness />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Start first shift · 30s' }));
    const dialog = screen.getByRole('dialog', { name: 'Extraction' }); fireEvent.click(within(dialog).getByRole('button', { name: 'Review dispatch' }));
    expect(await within(dialog).findByText('Crew slots are occupied.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Dispatch crew' })).not.toBeInTheDocument(); expect(wire.dispatch).not.toHaveBeenCalled();
  });
  it('accepts a newer authoritative preview but invalidates it if the cached company later advances', async () => {
    wire.preview.mockResolvedValue(quote({ company_revision: 2 }));
    const view = render(<Harness />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Start first shift · 30s' }));
    const dialog = screen.getByRole('dialog', { name: 'Extraction' }); fireEvent.click(within(dialog).getByRole('button', { name: 'Review dispatch' }));
    expect(await within(dialog).findByRole('button', { name: 'Dispatch crew' })).toBeInTheDocument();
    wire.data = { ...wire.data!, revision: 3 }; view.rerender(<Harness />);
    expect(within(dialog).getByText(/Your camp changed/)).toBeInTheDocument(); expect(within(dialog).queryByRole('button', { name: 'Dispatch crew' })).not.toBeInTheDocument();
  });
});

describe('Deep Claim authoritative hauls and recovery', () => {
  it('opens the recovered company and confirmation when a saved economic action is retried from the title', async () => {
    wire.pending = 'Contribute to club project';
    render(<Harness />);
    expect(screen.getByTestId('deep-claim-title')).toBeInTheDocument();
    skipDHGamesIntro();
    fireEvent.click(screen.getByRole('button', { name: /^Confirm sync$/ }));
    expect(await screen.findByRole('dialog', { name: /^Saved action confirmed\.$/ })).toBeInTheDocument();
    expect(screen.queryByTestId('deep-claim-title')).not.toBeInTheDocument();
    expect(wire.retry).toHaveBeenCalledOnce();
    expect(wire.bootstrap).not.toHaveBeenCalled();
    expect(wire.dispatch).not.toHaveBeenCalled();
    expect(wire.sell).not.toHaveBeenCalled();
  });
  it('treats collected historical cargo as secured, not as uncollected staged cargo', async () => {
    wire.data!.expeditions = [haul()]; wire.data!.company!.tutorial_used = true;
    const updated = snapshot(); updated.revision = 2; updated.resources = { copper_ore: 20 }; updated.company!.warehouse_used = 20; updated.company!.tutorial_used = true; updated.expeditions = [haul('collected')];
    wire.collect.mockImplementation(async () => { wire.data = updated; return updated; });
    render(<Harness />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Open haul' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collect into storage' }));
    const reward = await screen.findByRole('dialog', { name: 'Haul secured.' });
    expect(reward).toHaveTextContent('20'); expect(reward).toHaveTextContent('Copper ore'); expect(reward).not.toHaveTextContent('remain staged');
  });
  it('preserves and clearly reports the remaining cargo after a partial collection', async () => {
    wire.data!.expeditions = [haul()]; wire.data!.company!.warehouse_used = 105; wire.data!.resources = { stone: 105 };
    const updated = snapshot(); updated.revision = 2; updated.resources = { stone: 105, copper_ore: 15 }; updated.company!.warehouse_used = 120; updated.expeditions = [{ ...haul(), cargo: { copper_ore: 5 } }];
    wire.collect.mockImplementation(async () => { wire.data = updated; return updated; });
    render(<Harness />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Open haul' })); fireEvent.click(screen.getByRole('button', { name: 'Collect into storage' }));
    const reward = await screen.findByRole('dialog', { name: 'Haul secured.' }); expect(reward).toHaveTextContent('15'); expect(reward).toHaveTextContent('5 units remain staged');
  });
  it('guides a collected first haul through Stores and one real camp upgrade, then releases the guide', async () => {
    wire.data!.company!.tutorial_used = true; wire.data!.company!.warehouse_used = 20; wire.data!.resources = { copper_ore: 20 }; wire.data!.expeditions = [haul('collected')];
    const view = render(<Harness />); continueDeepClaimCompany();
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
  it.each([false, true])('keeps retained ore while choosing the next cue from actual sale history: %s', sold => {
    wire.data!.company!.tutorial_used = true;
    wire.data!.company!.warehouse_used = 15;
    wire.data!.resources = { copper_ore: 15 };
    wire.data!.expeditions = [haul('collected')];
    wire.data!.log = sold ? [{ id: 'real-sale', kind: 'sold', title: 'Sold 5 copper ore', created_at: at }] : [];
    render(<Harness />); continueDeepClaimCompany();
    expect(screen.getByRole('button', { name: sold ? 'Review camp upgrades' : 'Sell first haul' })).toBeInTheDocument();
    expect(wire.data!.resources).toEqual({ copper_ore: 15 });
    expect(wire.sell).not.toHaveBeenCalled(); expect(wire.upgrade).not.toHaveBeenCalled();
  });
  it('keeps an unconfirmed action read-only and retries the saved receipt instead of creating another action', async () => {
    wire.pending = 'Dispatch crew'; wire.readOnly = true;
    render(<Harness />); continueDeepClaimCompany();
    expect(screen.getByRole('button', { name: 'Start first shift · 30s' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Return to DH' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm sync' }));
    await waitFor(() => expect(wire.retry).toHaveBeenCalledOnce()); expect(wire.dispatch).not.toHaveBeenCalled(); expect(wire.collect).not.toHaveBeenCalled();
  });
  it('exposes all three persistent workers and current seven-skill profiles without hiring placeholders', () => {
    const view = render(<Harness />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('tab', { name: 'Crew' }));
    for (const worker of STARTER_WORKERS) expect(screen.getByRole('heading', { name: worker.name })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Crew file' })[0]);
    const profile = screen.getByRole('dialog', { name: 'Mara Flint' }); expect(profile).toHaveTextContent('10% more extraction output'); expect(profile).toHaveTextContent('Leadership');
    wire.data = { ...wire.data!, workers: wire.data!.workers.map((worker, index) => index === 0 ? { ...worker, energy: 0 } : worker) }; view.rerender(<Harness />);
    expect(profile).toHaveTextContent('0/6 energy'); expect(profile).not.toHaveTextContent('Hire');
  });
  it('requires a valid whole stock quantity before passing a sale to the server', async () => {
    wire.data!.resources = { stone: 8 }; wire.data!.company!.warehouse_used = 8; wire.sell.mockResolvedValue(snapshot());
    render(<Harness />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('tab', { name: 'Stores' })); fireEvent.click(screen.getByRole('button', { name: 'Sell Stone' }));
    const dialog = screen.getByRole('dialog', { name: 'Sell Stone' }); fireEvent.change(within(dialog).getByLabelText('Quantity to sell'), { target: { value: '0' } });
    expect(within(dialog).getByRole('button', { name: 'Confirm sale' })).toBeDisabled();
    expect(within(dialog).getByRole('group', { name: 'Transaction summary' })).toHaveTextContent('— cr');
    fireEvent.change(within(dialog).getByLabelText('Quantity to sell'), { target: { value: '3' } });
    expect(within(dialog).getByRole('group', { name: 'Transaction summary' })).toHaveTextContent('Sale total · 3 units');
    expect(within(dialog).getByRole('group', { name: 'Transaction summary' })).toHaveTextContent('3 cr');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm sale' }));
    await waitFor(() => expect(wire.sell).toHaveBeenCalledWith({ resource_key: 'stone', quantity: 3 }));
  });
  it('preserves the authoritative upgrade price plus two operating credits before enabling confirmation', () => {
    wire.data!.company!.cash = 50;
    const view = render(<Harness />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Open camp buildings' })); fireEvent.click(screen.getByRole('button', { name: /Mine Office.*Level 1/ }));
    const dialog = screen.getByRole('dialog', { name: 'Mine Office' });
    expect(within(dialog).getByRole('group', { name: 'Transaction summary' })).toHaveTextContent('50 cr');
    expect(within(dialog).getByRole('group', { name: 'Transaction summary' })).toHaveTextContent('2 cr reserve');
    expect(within(dialog).getByRole('button', { name: 'Confirm upgrade' })).toBeDisabled(); expect(dialog).toHaveTextContent('earn 2 more credits');
    wire.data = { ...wire.data!, company: { ...wire.data!.company!, cash: 52 } }; view.rerender(<Harness />);
    expect(within(dialog).getByRole('button', { name: 'Confirm upgrade' })).toBeEnabled(); expect(wire.upgrade).not.toHaveBeenCalled();
  });
  it('keeps audio opt-in through an explicit menu gesture and only enables sound from settings', async () => {
    render(<Harness />); expect(wire.unlock).not.toHaveBeenCalled();
    continueDeepClaimCompany(); await waitFor(() => expect(wire.unlock).toHaveBeenCalledOnce());
    expect(wire.audioUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' })); expect(wire.unlock).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('switch', { name: 'Enable sound' }));
    await waitFor(() => expect(wire.unlock).toHaveBeenCalledTimes(2)); expect(wire.audioUpdate).toHaveBeenCalledWith({ master: true });
  });
});
