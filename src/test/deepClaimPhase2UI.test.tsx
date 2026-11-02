import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeepClaimPage from '@/pages/DeepClaimPage';
import { continueDeepClaimCompany } from './fixtures/deepClaimTutorialMock';
import { DeepClaimWorkforce, type DeepClaimWorkforceActions } from '@/components/deepClaim/DeepClaimWorkforce';
import { DeepClaimIndustry } from '@/components/deepClaim/DeepClaimIndustry';
import { DeepClaimDispatch } from '@/components/deepClaim/DeepClaimDispatch';
import { phaseTwoSnapshot } from './fixtures/deepClaimPhase2';
import type { DeepClaimCandidate, DeepClaimEquipment, DeepClaimProductionJob, DeepClaimSnapshot } from '@/lib/deepClaim/types';

const state = vi.hoisted(() => ({ data: null as DeepClaimSnapshot | null, readOnly: false, pending: null as string | null, hire: vi.fn(), train: vi.fn(), assignEquipment: vi.fn(), repairEquipment: vi.fn(), retireEquipment: vi.fn(), startProduction: vi.fn(), collectProduction: vi.fn(), refresh: vi.fn(), upgrade: vi.fn(), preview: vi.fn(), dispatch: vi.fn(), retry: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club-a' }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => true }) }));
// Pixel backdrop lifecycle is covered separately; keep these economic suites renderer-free.
vi.mock('@/components/deepClaim/menu/DeepClaimMenuBackdrop', () => ({ DeepClaimMenuBackdrop: () => null }));
vi.mock('@/hooks/useDeepClaimTutorial', async () => ({ useDeepClaimTutorial: (await import('./fixtures/deepClaimTutorialMock')).useDeepClaimTutorialMock }));
vi.mock('@/hooks/useDeepClaim', () => ({ useDeepClaim: () => ({ data: state.data, loading: false, refreshing: false, error: null, busy: false, readOnly: state.readOnly, pendingAction: state.pending, serverNow: () => Date.parse('2026-11-01T12:00:00Z'), refresh: state.refresh, preview: state.preview, dispatch: state.dispatch, hire: state.hire, train: state.train, assignEquipment: state.assignEquipment, repairEquipment: state.repairEquipment, retireEquipment: state.retireEquipment, startProduction: state.startProduction, collectProduction: state.collectProduction, upgrade: state.upgrade, retryPending: state.retry }) }));
vi.mock('@/components/deepClaim/renderer/DeepClaimCanvas', () => ({ DeepClaimCanvas: ({ onSelectBuilding }: { onSelectBuilding: (key: 'mine_office' | 'smeltery') => void }) => <div><button onClick={() => onSelectBuilding('mine_office')}>Map office</button><button onClick={() => onSelectBuilding('smeltery')}>Map smeltery</button></div> }));
vi.mock('@/lib/deepClaim/audio', () => ({ createDeepClaimAudio: () => { const settings = { master: false, music: true, ambient: true, sfx: true, volume: .65 }; return { getSnapshot: () => settings, subscribe: () => () => {}, setScene: vi.fn(), updateSettings: vi.fn(), unlock: vi.fn(), play: vi.fn(), setActive: vi.fn(), dispose: vi.fn() }; } }));
const confirmed = vi.fn();
const actions: DeepClaimWorkforceActions = { hire: state.hire, train: state.train, assignEquipment: state.assignEquipment, repairEquipment: state.repairEquipment, retireEquipment: state.retireEquipment };
function candidate(snapshot: DeepClaimSnapshot): DeepClaimCandidate { return { id: 'applicant-1', name: 'Iris Slate', specialty: 'engineer', traits: [], stats: { ...snapshot.workers[0].stats }, wage: 4, hire_cost: 90, operating_day: snapshot.company!.energy_day, hired: false }; }
function gear(snapshot: DeepClaimSnapshot, overrides: Partial<DeepClaimEquipment> = {}): DeepClaimEquipment { const definition = snapshot.equipment_catalog![0]; return { id: 'gear-1', definition_key: definition.key, worker_id: null, durability: 40, max_durability: 100, repair_cost: 11, repair_materials: { stone: 2 }, ...overrides }; }
function workforce(snapshot: DeepClaimSnapshot, readOnly = false) { return <DeepClaimWorkforce snapshot={snapshot} actions={actions} busy={false} readOnly={readOnly} onConfirmed={confirmed} onQuarters={vi.fn()} />; }
function industry(snapshot: DeepClaimSnapshot, readOnly = false) { return <DeepClaimIndustry snapshot={snapshot} view="workshop" onView={vi.fn()} station="smeltery" onStation={vi.fn()} busy={false} readOnly={readOnly} now={Date.parse(snapshot.server_now)} onRefresh={state.refresh} onBuild={state.upgrade} onSell={vi.fn()} onOpenHaul={vi.fn()} startProduction={state.startProduction} collectProduction={async job => { await state.collectProduction(job.id); }} onConfirmed={confirmed} />; }
function job(overrides: Partial<DeepClaimProductionJob> = {}): DeepClaimProductionJob { return { id: 'batch-1', recipe_key: 'smelt_copper', recipe_version: 1, batches: 1, station: 'smeltery', status: 'active', started_at: '2026-11-01T12:01:00Z', completes_at: '2026-11-01T12:03:00Z', duration_seconds: 120, cash_cost: 5, inputs: { coal: 2, copper_ore: 10 }, outputs: { copper_bar: 2 }, equipment_outputs: [], ...overrides }; }
function openWorker(view: 'Training' | 'Gear') { fireEvent.click(screen.getAllByRole('button', { name: 'Crew file' })[0]); fireEvent.click(screen.getByRole('button', { name: view })); }
function openRecipe() { fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Copper' })); return screen.getByRole('dialog', { name: 'Smelt Copper' }); }
function App() { return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimPage /></MemoryRouter>; }
beforeEach(() => { vi.clearAllMocks(); state.data = phaseTwoSnapshot(); state.readOnly = false; state.pending = null; for (const action of Object.values(actions)) vi.mocked(action).mockResolvedValue(state.data); state.startProduction.mockResolvedValue(state.data); state.collectProduction.mockResolvedValue(state.data); });
afterEach(cleanup);

describe('Deep Claim workforce operations', () => {
  it('requires real housing, reserve and explicit confirmation before hiring the fixed daily applicant', async () => {
    const data = phaseTwoSnapshot(); data.candidates = [candidate(data)]; data.company!.worker_capacity = 6; data.company!.cash = 91;
    const view = render(workforce(data)); fireEvent.click(screen.getByRole('button', { name: 'Hire' }));
    expect(screen.getByRole('button', { name: 'Hire Iris Slate' })).toBeDisabled();
    data.company!.cash = 92; view.rerender(workforce(data)); fireEvent.click(screen.getByRole('button', { name: 'Hire Iris Slate' }));
    expect(state.hire).not.toHaveBeenCalled(); const dialog = screen.getByRole('dialog', { name: 'Hire Iris Slate' }); expect(dialog).toHaveTextContent('4 credits per energy');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm hire' })); await waitFor(() => expect(state.hire).toHaveBeenCalledWith('applicant-1'));
  });
  it('blocks hiring at housing capacity and retains the actual applicant rather than rerolling it', () => {
    const data = phaseTwoSnapshot(); data.candidates = [candidate(data)]; render(workforce(data)); fireEvent.click(screen.getByRole('button', { name: 'Hire' }));
    expect(screen.getByRole('heading', { name: 'Iris Slate' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Hire Iris Slate' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Review quarters' })).toBeEnabled();
  });
  it('uses the server training fee and gain and enforces one course per operating day', async () => {
    const data = phaseTwoSnapshot(); data.workers[0].training_cost = 37; data.workers[0].training_gain = 4;
    const view = render(workforce(data)); openWorker('Training'); expect(screen.getByText(/Base 50 → 54/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review training' })); const dialog = screen.getByRole('dialog', { name: 'Train Worker a' }); expect(dialog).toHaveTextContent('37 cr');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm training' })); await waitFor(() => expect(state.train).toHaveBeenCalledWith('worker-a', 'mining'));
    cleanup(); data.workers[0].trained_day = data.company!.energy_day; view.unmount(); render(workforce(data)); openWorker('Training'); expect(screen.getByRole('button', { name: 'Review training' })).toBeDisabled(); expect(screen.getByText(/Today’s course is complete/)).toBeInTheDocument();
  });
  it('blocks paid training and equipment changes for employees currently on a shift', () => {
    const data = phaseTwoSnapshot(); data.workers[0].assigned_job_id = 'shift'; data.equipment = [gear(data)]; render(workforce(data)); openWorker('Training'); expect(screen.getByRole('button', { name: 'Review training' })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: 'Gear' })); expect(screen.getByRole('button', { name: 'Equip Copper Pickaxe' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Repair Copper Pickaxe' })).toBeDisabled();
  });
  it('allows confirmed same-slot replacement and submits item and target employee IDs', async () => {
    const data = phaseTwoSnapshot(); data.equipment = [gear(data, { id: 'assigned', worker_id: 'worker-a' }), gear(data, { id: 'replacement' })]; render(workforce(data)); openWorker('Gear');
    const equip = screen.getByRole('button', { name: 'Equip Copper Pickaxe' }); expect(equip).toHaveTextContent('Replace slot'); fireEvent.click(equip); expect(state.assignEquipment).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Confirm equipment' })); await waitFor(() => expect(state.assignEquipment).toHaveBeenCalledWith('replacement', 'worker-a'));
  });
  it('requires both cash reserve and listed materials before repairing owned equipment', async () => {
    const data = phaseTwoSnapshot(); data.equipment = [gear(data)]; data.resources = {}; const view = render(workforce(data)); openWorker('Gear'); expect(screen.getByRole('button', { name: 'Repair Copper Pickaxe' })).toBeDisabled();
    data.resources = { stone: 2 }; data.company!.cash = 12; view.rerender(workforce(data)); expect(screen.getByRole('button', { name: 'Repair Copper Pickaxe' })).toBeDisabled();
    data.company!.cash = 13; view.rerender(workforce(data)); fireEvent.click(screen.getByRole('button', { name: 'Repair Copper Pickaxe' })); const dialog = screen.getByRole('dialog', { name: 'Repair Copper Pickaxe' }); expect(dialog).toHaveTextContent('Stone'); fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm repair' })); await waitFor(() => expect(state.repairEquipment).toHaveBeenCalledWith('gear-1'));
  });
  it('keeps retirement inside unassigned item details and requires permanent no-refund confirmation', async () => {
    const data = phaseTwoSnapshot(); data.equipment = [gear(data)]; render(workforce(data)); openWorker('Gear'); expect(screen.queryByRole('button', { name: 'Retire item' })).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'View Copper Pickaxe' })); fireEvent.click(screen.getByRole('button', { name: 'Retire item' })); const dialog = screen.getByRole('dialog', { name: 'Retire Copper Pickaxe' }); expect(dialog).toHaveTextContent('permanently removes'); expect(dialog).toHaveTextContent('no refund'); expect(state.retireEquipment).not.toHaveBeenCalled(); fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm retirement' })); await waitFor(() => expect(state.retireEquipment).toHaveBeenCalledWith('gear-1'));
  });
  it('never offers retirement for an assigned item', () => {
    const data = phaseTwoSnapshot(); data.equipment = [gear(data, { worker_id: 'worker-a' })]; render(workforce(data)); openWorker('Gear'); fireEvent.click(screen.getByRole('button', { name: 'View Copper Pickaxe' })); expect(screen.queryByRole('button', { name: 'Retire item' })).not.toBeInTheDocument(); expect(state.retireEquipment).not.toHaveBeenCalled();
  });
  it('defaults expanded staff to a legal three-worker expedition and disables a fourth selection', () => {
    const data = phaseTwoSnapshot(); data.workers.push({ ...data.workers[0], id: 'worker-d', name: 'Worker d' }); render(<DeepClaimDispatch snapshot={data} initialMode="explore" initialTarget={{ x: 47, y: 2 }} onClose={vi.fn()} readOnly={false} busy={false} preview={state.preview} dispatch={state.dispatch} />);
    const workers = screen.getAllByRole('checkbox').filter(input => !input.getAttribute('aria-label')?.includes('First shift')); expect(workers.filter(input => (input as HTMLInputElement).checked)).toHaveLength(3); expect(screen.getByRole('checkbox', { name: /Worker d/ })).toBeDisabled();
  });
});

describe('Deep Claim production and shared game integration', () => {
  it('reviews actual scaled inputs before starting a real production batch', async () => {
    const data = phaseTwoSnapshot(); data.company!.cash = 1000; data.resources = { copper_ore: 30, coal: 6 }; data.buildings.find(item => item.key === 'smeltery')!.level = 1; render(industry(data)); const dialog = openRecipe();
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Production batches' }), { target: { value: '2' } }); fireEvent.click(within(dialog).getByRole('button', { name: 'Review batch' })); expect(state.startProduction).not.toHaveBeenCalled(); expect(dialog).toHaveTextContent('20'); expect(dialog).toHaveTextContent('4'); fireEvent.click(within(dialog).getByRole('button', { name: 'Start production' })); await waitFor(() => expect(state.startProduction).toHaveBeenCalledWith('smelt_copper', 2));
  });
  it('offers a real station build and blocks a recipe when materials are missing', () => {
    const data = phaseTwoSnapshot(); render(industry(data)); expect(screen.getByRole('button', { name: 'Build Smeltery' })).toBeEnabled(); const dialog = openRecipe(); fireEvent.click(within(dialog).getByRole('button', { name: 'Review batch' })); expect(within(dialog).getByRole('button', { name: 'Start production' })).toBeDisabled(); expect(dialog).toHaveTextContent('Need 10 Copper ore'); expect(state.startProduction).not.toHaveBeenCalled();
  });
  it('invalidates an open batch review on a newer authoritative company revision', () => {
    const data = phaseTwoSnapshot(); data.resources = { copper_ore: 10, coal: 2 }; data.buildings.find(item => item.key === 'smeltery')!.level = 1; const view = render(industry(data)); const dialog = openRecipe(); fireEvent.click(within(dialog).getByRole('button', { name: 'Review batch' })); expect(within(dialog).getByRole('button', { name: 'Start production' })).toBeEnabled(); view.rerender(industry({ ...data, revision: data.revision + 1 })); expect(within(dialog).queryByRole('button', { name: 'Start production' })).not.toBeInTheDocument(); expect(within(dialog).getByRole('button', { name: 'Review batch' })).toBeEnabled();
  });
  it('preserves the three-uncollected-job queue and distinguishes future jobs from server-ready outputs', () => {
    const data = phaseTwoSnapshot(); data.production_jobs = [job(), job({ id: 'batch-2', status: 'ready', started_at: '2026-11-01T11:50:00Z', completes_at: '2026-11-01T11:52:00Z' }), job({ id: 'batch-3' })]; data.resources = { copper_ore: 10, coal: 2 }; data.buildings.find(item => item.key === 'smeltery')!.level = 1; render(industry(data)); expect(screen.getAllByText('Queued')).toHaveLength(2); expect(screen.getAllByRole('button', { name: 'Collect Smelt Copper' })).toHaveLength(1); const dialog = openRecipe(); fireEvent.click(within(dialog).getByRole('button', { name: 'Review batch' })); expect(within(dialog).getByRole('button', { name: 'Start production' })).toBeDisabled(); expect(dialog).toHaveTextContent('three company queue slots');
  });
  it('counts owned and pending equipment toward the same storage bound', () => {
    const data = phaseTwoSnapshot(); data.company!.cash = 1000; data.resources = { copper_bar: 1, stone: 4 }; data.equipment = Array.from({ length: 48 }, (_, index) => gear(data, { id: `gear-${index}` })); render(<DeepClaimIndustry snapshot={data} view="workshop" onView={vi.fn()} station="tool_station" onStation={vi.fn()} busy={false} readOnly={false} now={Date.parse(data.server_now)} onRefresh={vi.fn()} onBuild={vi.fn()} onSell={vi.fn()} onOpenHaul={vi.fn()} startProduction={state.startProduction} collectProduction={vi.fn()} onConfirmed={confirmed} />); fireEvent.click(screen.getByRole('button', { name: 'Review Craft Copper Pickaxe' })); const dialog = screen.getByRole('dialog', { name: 'Craft Copper Pickaxe' }); fireEvent.click(within(dialog).getByRole('button', { name: 'Review batch' })); expect(within(dialog).getByRole('button', { name: 'Start production' })).toBeDisabled(); expect(dialog).toHaveTextContent('Equipment storage is full');
  });
  it('does not turn a locally elapsed timer into collectible output', () => {
    const data = phaseTwoSnapshot(); data.production_jobs = [job({ started_at: '2026-11-01T11:50:00Z', completes_at: '2026-11-01T11:52:00Z' })]; render(industry(data)); expect(screen.queryByRole('button', { name: 'Collect Smelt Copper' })).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Check production' })); expect(state.refresh).toHaveBeenCalledOnce(); expect(state.collectProduction).not.toHaveBeenCalled();
  });
  it('does not permit a new production action while a saved request is read-only', () => {
    const data = phaseTwoSnapshot(); data.resources = { copper_ore: 10, coal: 2 }; data.buildings.find(item => item.key === 'smeltery')!.level = 1; render(industry(data, true)); const dialog = openRecipe(); fireEvent.click(within(dialog).getByRole('button', { name: 'Review batch' })); expect(within(dialog).getByRole('button', { name: 'Start production' })).toBeDisabled(); expect(state.startProduction).not.toHaveBeenCalled();
  });
  it('keeps the first-sale guide intact with three new unbuilt plots and exposes real build confirmation', () => {
    state.data!.company!.tutorial_used = true; state.data!.resources = {}; state.data!.expeditions = [{ id: 'intro', tutorial: true, status: 'collected' } as DeepClaimSnapshot['expeditions'][number]]; render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Review camp upgrades' })); fireEvent.click(screen.getByRole('button', { name: /Smeltery.*Unbuilt plot/ })); expect(screen.getByRole('button', { name: 'Confirm build' })).toBeInTheDocument(); expect(state.upgrade).not.toHaveBeenCalled();
  });
  it('opens hiring from the actual office and shows persistent wage information', () => {
    state.data!.candidates = [candidate(state.data!)]; render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Map office' })); expect(screen.getByRole('heading', { name: 'The hiring office' })).toBeInTheDocument(); expect(screen.getByText('4 cr per energy · wages paid on dispatch')).toBeInTheDocument();
  });
  it('routes ready production from the surface into Workshop and blocks another mining shift until collection', () => {
    state.data!.production_jobs = [job({ status: 'ready' })];
    const view = render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Collect production' }));
    expect(screen.getByRole('tab', { name: /Stores/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Collect Smelt Copper' })).toBeInTheDocument();
    state.data = { ...state.data!, expeditions: [{ id: 'active-shift', mode: 'explore', status: 'active', worker_ids: ['worker-a'], target: { x: 47, y: 2 }, path: [], stage: 'work', started_at: '2026-11-01T11:50:00Z', completes_at: '2026-11-01T12:10:00Z', duration_minutes: 20, duration_seconds: 1200, tutorial: false, wages: 2, energy_per_worker: 1, config_version: 2, cargo: null, stages: [] }] };
    view.rerender(<App />); fireEvent.click(screen.getByRole('tab', { name: 'Surface' }));
    const newShift = screen.getByRole('button', { name: 'Dispatch another crew' }); expect(newShift).toBeDisabled(); expect(newShift).toHaveTextContent('Collect output first');
    expect(screen.getByRole('tab', { name: 'Mine' })).toBeEnabled(); expect(state.dispatch).not.toHaveBeenCalled();
  });
  it('reports actual partial production collection while keeping remaining output staged', async () => {
    state.data!.production_jobs = [job({ status: 'ready' })]; const updated = structuredClone(state.data!); updated.revision++; updated.production_jobs![0].outputs = { copper_bar: 1 }; updated.resources = { copper_bar: 1 }; updated.company!.warehouse_used = updated.company!.warehouse_capacity; state.collectProduction.mockImplementation(async () => { state.data = updated; return updated; }); render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('tab', { name: /Stores/ })); fireEvent.click(screen.getByRole('button', { name: /Workshop/ })); fireEvent.click(screen.getByRole('button', { name: 'Collect Smelt Copper' })); const receipt = await screen.findByRole('dialog', { name: 'Production secured.' }); expect(receipt).toHaveTextContent('Copper bar'); expect(receipt).toHaveTextContent('1 units remain staged'); expect(updated.production_jobs![0].status).toBe('ready');
  });
  it('centers real collected equipment IDs and never treats historical production output as remaining', async () => {
    state.data!.production_jobs = [job({ recipe_key: 'craft_copper_pickaxe', station: 'tool_station', status: 'ready', outputs: {}, equipment_outputs: ['copper_pickaxe'] })]; const updated = structuredClone(state.data!); updated.revision++; updated.production_jobs![0].status = 'collected'; updated.equipment = [gear(updated, { id: 'created-on-server', durability: 100 })]; state.collectProduction.mockImplementation(async () => { state.data = updated; return updated; }); render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('tab', { name: /Stores/ })); fireEvent.click(screen.getByRole('button', { name: /Workshop/ })); fireEvent.click(screen.getByRole('button', { name: 'Collect Craft Copper Pickaxe' })); const receipt = await screen.findByRole('dialog', { name: 'Production secured.' }); expect(receipt).toHaveTextContent('Copper Pickaxe'); expect(receipt).toHaveTextContent('Owned equipment'); expect(receipt).not.toHaveTextContent('remain staged'); expect(state.collectProduction).toHaveBeenCalledWith('batch-1');
  });
});
