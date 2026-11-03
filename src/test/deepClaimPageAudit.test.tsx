import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeepClaimPage from '@/pages/DeepClaimPage';
import type { DeepClaimExpedition, DeepClaimProductionJob, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseTwoSnapshot } from './fixtures/deepClaimPhase2';
import { continueDeepClaimCompany } from './fixtures/deepClaimTutorialMock';

const wire = vi.hoisted(() => ({ data: null as DeepClaimSnapshot | null, collect: vi.fn(), collectProduction: vi.fn(), upgrade: vi.fn(), noop: vi.fn(), play: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club-a' }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => true }) }));
vi.mock('@/hooks/useDeepClaimTutorial', async () => ({ useDeepClaimTutorial: (await import('./fixtures/deepClaimTutorialMock')).useDeepClaimTutorialMock }));
// Keep the complete Page and its management/receipt components; terrain rendering has separate coverage.
vi.mock('@/components/deepClaim/menu/DeepClaimMenuBackdrop', () => ({ DeepClaimMenuBackdrop: () => null }));
vi.mock('@/components/deepClaim/renderer/DeepClaimCanvas', () => ({ DeepClaimCanvas: () => <div data-testid="mine-viewport" /> }));
vi.mock('@/hooks/useDeepClaim', () => ({ useDeepClaim: () => ({
  data: wire.data, loading: false, refreshing: false, error: null, busy: false, readOnly: false, pendingAction: null,
  serverNow: () => Date.parse('2026-11-01T12:00:00Z'), collect: wire.collect, collectProduction: wire.collectProduction, upgrade: wire.upgrade,
  refresh: wire.noop, bootstrap: wire.noop, preview: wire.noop, dispatch: wire.noop, sell: wire.noop, retryPending: wire.noop,
  hire: wire.noop, train: wire.noop, assignEquipment: wire.noop, repairEquipment: wire.noop, retireEquipment: wire.noop, startProduction: wire.noop,
}) }));
vi.mock('@/lib/deepClaim/audio', () => ({ createDeepClaimAudio: () => {
  const settings = { master: false, music: true, ambient: true, sfx: true, volume: .65 };
  return { getSnapshot: () => settings, subscribe: () => () => {}, setScene: vi.fn(), updateSettings: vi.fn(), unlock: vi.fn(), play: wire.play, setActive: vi.fn(), dispose: vi.fn() };
} }));

function App() { return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimPage /></MemoryRouter>; }
function readyBatch(): DeepClaimProductionJob {
  return { id: 'batch-a', recipe_key: 'smelt_copper', recipe_version: 1, batches: 1, station: 'smeltery', status: 'ready', started_at: '2026-11-01T11:00:00Z', completes_at: '2026-11-01T11:02:00Z', duration_seconds: 120, cash_cost: 5, inputs: { coal: 2, copper_ore: 10 }, outputs: { copper_bar: 2 }, equipment_outputs: [] };
}
function readyHaul(): DeepClaimExpedition {
  return { id: 'shift-a', mode: 'extract', status: 'ready', worker_ids: ['worker-a'], target: { x: 47, y: 1 }, path: [{ x: 48, y: 1 }], stage: 'ready', started_at: '2026-11-01T11:00:00Z', completes_at: '2026-11-01T11:20:00Z', duration_minutes: 20, duration_seconds: 1200, tutorial: false, wages: 2, energy_per_worker: 1, config_version: 2, cargo: { copper_ore: 20 }, stages: [] };
}
function openWarehouse() {
  fireEvent.click(screen.getByRole('button', { name: 'Open camp buildings' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Buildings' })).getByRole('button', { name: /Warehouse/ }));
  return screen.getByRole('dialog', { name: 'Warehouse' });
}
function openProduction() {
  fireEvent.click(screen.getByRole('tab', { name: /Stores/ }));
  fireEvent.click(screen.getByRole('button', { name: /Workshop/ }));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  wire.data = phaseTwoSnapshot(); wire.data.company!.tutorial_used = true; wire.data.company!.cash = 1000;
  wire.noop.mockResolvedValue(wire.data);
});
afterEach(cleanup);

describe('Deep Claim Page reviewed building purchases', () => {
  it.each(['revision', 'level', 'price'] as const)('requires a fresh deliberate review after the building %s changes', async field => {
    const view = render(<App />); continueDeepClaimCompany();
    const originalDialog = openWarehouse();
    expect(within(originalDialog).getByRole('button', { name: 'Confirm upgrade' })).toBeEnabled();
    const updated = structuredClone(wire.data!);
    if (field === 'revision') updated.revision++;
    if (field === 'level') updated.buildings.find(item => item.key === 'warehouse')!.level = 2;
    if (field === 'price') updated.buildings.find(item => item.key === 'warehouse')!.upgrade_cost = 160;
    wire.data = updated; view.rerender(<App />);
    const dialog = screen.getByRole('dialog', { name: 'Warehouse' });
    expect(within(dialog).queryByRole('button', { name: 'Confirm upgrade' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('status')).toHaveTextContent('Review this upgrade again');
    expect(wire.upgrade).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review current upgrade' }));
    expect(within(dialog).getByRole('button', { name: 'Confirm upgrade' })).toBeEnabled();
    expect(within(dialog).queryByRole('button', { name: 'Review current upgrade' })).not.toBeInTheDocument();
    expect(wire.upgrade).not.toHaveBeenCalled();
    wire.upgrade.mockResolvedValue(updated);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm upgrade' }));
    await screen.findByRole('dialog', { name: 'Camp updated.' });
    expect(wire.upgrade).toHaveBeenCalledExactlyOnceWith('warehouse');
  });

  it('keeps an upgrade single-flight even while the hook still reports busy false', async () => {
    const pending = deferred<DeepClaimSnapshot>(); wire.upgrade.mockReturnValue(pending.promise);
    render(<App />); continueDeepClaimCompany(); const dialog = openWarehouse();
    const confirm = within(dialog).getByRole('button', { name: 'Confirm upgrade' });
    fireEvent.click(confirm); expect(confirm).toBeEnabled(); fireEvent.click(confirm);
    expect(wire.upgrade).toHaveBeenCalledExactlyOnceWith('warehouse');
    const updated = structuredClone(wire.data!); updated.revision++; updated.buildings.find(item => item.key === 'warehouse')!.level = 2;
    wire.data = updated; await act(async () => pending.resolve(updated));
    expect(screen.getByRole('dialog', { name: 'Warehouse upgraded.' })).toBeInTheDocument();
  });
});

describe('Deep Claim Page authoritative collection receipts', () => {
  it.each(['ready', 'collected'] as const)('does not announce production secured when a %s response transfers no inventory', async status => {
    wire.data!.production_jobs = [readyBatch()];
    const updated = structuredClone(wire.data!); updated.revision++; updated.production_jobs![0].status = status;
    wire.collectProduction.mockImplementation(async () => { wire.data = updated; return updated; });
    render(<App />); continueDeepClaimCompany(); openProduction();
    fireEvent.click(screen.getByRole('button', { name: 'Collect Smelt Copper' }));
    const receipt = await screen.findByRole('dialog', { name: 'Camp updated.' });
    expect(screen.queryByRole('dialog', { name: 'Production secured.' })).not.toBeInTheDocument();
    expect(within(receipt).queryByRole('list', { name: 'Materials added to storage' })).not.toBeInTheDocument();
    expect(receipt.querySelector('[data-dc-reward-kind]')).toHaveAttribute('data-dc-reward-kind', 'confirmation');
    expect(receipt).toHaveTextContent(status === 'ready' ? 'Output is still staged.' : 'No new output transferred.');
    expect(wire.collectProduction).toHaveBeenCalledExactlyOnceWith('batch-a');
    expect(wire.play).not.toHaveBeenCalledWith('deposit');
  });

  it('limits production receipts to actual positive inventory gains from the collected batch', async () => {
    wire.data!.resources = { stone: 8, copper_bar: 5 }; wire.data!.production_jobs = [readyBatch()];
    const updated = structuredClone(wire.data!); updated.revision++; updated.production_jobs![0].status = 'collected';
    updated.resources = { stone: 4, copper_bar: 6, quartz: 9 };
    wire.collectProduction.mockImplementation(async () => { wire.data = updated; return updated; });
    render(<App />); continueDeepClaimCompany(); openProduction();
    fireEvent.click(screen.getByRole('button', { name: 'Collect Smelt Copper' }));
    const receipt = await screen.findByRole('dialog', { name: 'Production secured.' });
    const items = within(receipt).getAllByRole('listitem');
    expect(items).toHaveLength(1); expect(items[0]).toHaveAttribute('data-dc-receipt-resource', 'copper_bar');
    expect(within(items[0]).getByText('1')).toBeInTheDocument();
    expect(receipt).not.toHaveTextContent('Quartz'); expect(receipt).not.toHaveTextContent('remain staged');
  });

  it('collects a haul once and displays only its confirmed inventory gain', async () => {
    wire.data!.expeditions = [readyHaul()]; wire.data!.resources = { copper_ore: 3 };
    const pending = deferred<DeepClaimSnapshot>(); wire.collect.mockReturnValue(pending.promise);
    render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Open haul' }));
    const collect = screen.getByRole('button', { name: 'Collect into storage' });
    fireEvent.click(collect); expect(collect).toBeEnabled(); fireEvent.click(collect);
    expect(wire.collect).toHaveBeenCalledExactlyOnceWith('shift-a');
    const updated = structuredClone(wire.data!); updated.revision++; updated.expeditions[0].status = 'collected';
    updated.resources = { copper_ore: 7, stone: 100 }; wire.data = updated;
    await act(async () => pending.resolve(updated));
    const receipt = screen.getByRole('dialog', { name: 'Haul secured.' });
    const items = within(receipt).getAllByRole('listitem');
    expect(items).toHaveLength(1); expect(items[0]).toHaveAttribute('data-dc-receipt-resource', 'copper_ore');
    expect(within(items[0]).getByText('4')).toBeInTheDocument();
    expect(wire.play).toHaveBeenCalledWith('deposit');
    expect(screen.queryByRole('dialog', { name: 'The haul is home' })).not.toBeInTheDocument();
  });

  it('acknowledges a no-transfer haul without an acquisition sound or invented cargo', async () => {
    wire.data!.expeditions = [readyHaul()];
    const updated = structuredClone(wire.data!); updated.revision++; updated.expeditions[0].status = 'collected';
    wire.collect.mockResolvedValue(updated);
    render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Open haul' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collect into storage' }));
    const receipt = await screen.findByRole('dialog', { name: 'Camp updated.' });
    expect(within(receipt).queryAllByRole('listitem')).toHaveLength(0);
    expect(wire.play).not.toHaveBeenCalledWith('deposit');
    expect(wire.play).toHaveBeenCalledWith('menu_select');
  });

  it.each(['collected', 'removed'] as const)('closes an open haul after a source refresh marks it %s', status => {
    wire.data!.expeditions = [readyHaul()];
    const view = render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Open haul' }));
    expect(screen.getByRole('dialog', { name: 'The haul is home' })).toBeInTheDocument();
    wire.data = { ...wire.data!, revision: wire.data!.revision + 1, expeditions: status === 'removed' ? [] : [{ ...readyHaul(), status: 'collected' }] };
    view.rerender(<App />);
    expect(screen.queryByRole('dialog', { name: 'The haul is home' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collect into storage' })).not.toBeInTheDocument();
    expect(wire.collect).not.toHaveBeenCalled();
  });
});
