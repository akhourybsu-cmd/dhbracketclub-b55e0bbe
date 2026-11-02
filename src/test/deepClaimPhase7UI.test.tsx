import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeepClaimPage from '@/pages/DeepClaimPage';
import { continueDeepClaimCompany } from './fixtures/deepClaimTutorialMock';
import { DeepClaimDispatch } from '@/components/deepClaim/DeepClaimDispatch';
import { DeepClaimOperations } from '@/components/deepClaim/DeepClaimField';
import { DeepClaimBusiness, type ClaimBusinessView } from '@/components/deepClaim/DeepClaimBusiness';
import { DeepClaimIndustry } from '@/components/deepClaim/DeepClaimIndustry';
import { DeepClaimWorkforce } from '@/components/deepClaim/DeepClaimWorkforce';
import { DeepClaimStores } from '@/components/deepClaim/DeepClaimPanels';
import { DEEP_CATALOG, buildingEffect } from '@/lib/deepClaim/catalog';
import type { DeepClaimMode, DeepClaimPreview, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';
import { phaseSevenSnapshot } from './fixtures/deepClaimPhase7';

const wire = vi.hoisted(() => ({ data: null as DeepClaimSnapshot | null, scans: [] as string[], noop: vi.fn(), preview: vi.fn(), dispatch: vi.fn(), upgrade: vi.fn(), research: vi.fn(), locate: vi.fn(), production: vi.fn(), assign: vi.fn(), repair: vi.fn(), confirmed: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club-a' }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => true }) }));
// Pixel backdrop lifecycle is covered separately; keep these economic suites renderer-free.
vi.mock('@/components/deepClaim/menu/DeepClaimMenuBackdrop', () => ({ DeepClaimMenuBackdrop: () => null }));
vi.mock('@/hooks/useDeepClaimTutorial', async () => ({ useDeepClaimTutorial: (await import('./fixtures/deepClaimTutorialMock')).useDeepClaimTutorialMock }));
vi.mock('@/hooks/useDeepClaim', () => ({ useDeepClaim: () => ({ data: wire.data, readOnly: false, busy: false, refreshing: false, error: null, serverNow: () => Date.parse(wire.data!.server_now), upgrade: wire.upgrade, startResearch: wire.research, refresh: wire.noop, preview: wire.preview, dispatch: wire.dispatch, hire: wire.noop, train: wire.noop, assignEquipment: wire.assign, repairEquipment: wire.repair, retireEquipment: wire.noop, startProduction: wire.production, collectProduction: wire.noop }) }));
vi.mock('@/components/deepClaim/display', async original => { const actual = await original<typeof import('@/components/deepClaim/display')>(); return { ...actual, claimTargets: (...args: Parameters<typeof actual.claimTargets>) => { wire.scans.push(args[1]); return actual.claimTargets(...args); } }; });
vi.mock('@/components/deepClaim/renderer/DeepClaimCanvas', () => ({ DeepClaimCanvas: () => <div data-testid="mine-canvas" /> }));
vi.mock('@/lib/deepClaim/audio', () => ({ createDeepClaimAudio: () => { const snapshot = { master: false, music: true, sfx: true, ambient: true, volume: .65, musicVolume: 1, ambientVolume: 1, sfxVolume: 1 }; return { getSnapshot: () => snapshot, subscribe: () => () => {}, setScene: vi.fn(), updateSettings: wire.noop, unlock: wire.noop, play: wire.noop, setBackgroundPaused: wire.noop, dispose: wire.noop }; } }));

function deepSnapshot(): DeepClaimSnapshot {
  const data = phaseSevenSnapshot(7);
  data.company!.cash = 30000; data.company!.tutorial_used = true; data.world!.max_depth = 999;
  data.world!.tiles = [...Array.from({ length: 956 }, (_, index) => ({ x: 48, y: index + 1, terrain: 'excavated' as const, material: null, remaining: 0, initial_amount: 0 })), { x: 47, y: 800, terrain: 'stone', material: 'nickel_ore', remaining: 24, initial_amount: 24 }, { x: 20, y: 999, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0 }];
  data.buildings = data.buildings.map(item => item.key === 'mine_shaft' ? { ...item, level: 5, max_level: 6, upgrade_cost: DEEP_CATALOG.shaft.upgrade_cost, effect: buildingEffect('mine_shaft', 5) } : item);
  return data;
}
function quote(overrides: Partial<DeepClaimPreview> = {}): DeepClaimPreview { return { allowed: true, reasons: [], company_revision: 7, server_now: '2026-11-01T12:00:00Z', wages: 6, energy_per_worker: 1, duration_seconds: 1200, estimated_yield: { min: 12, max: 16 }, cargo_capacity: 60, risk_level: 'moderate', accessible_depth: 999, expected_resources: ['nickel_ore'], route: [{ x: 48, y: 800 }, { x: 47, y: 800 }], projected_completion_at: '2026-11-01T12:20:00Z', stages: [{ key: 'travel', duration_seconds: 40 }, { key: 'setup', duration_seconds: 40 }, { key: 'work', duration_seconds: 1040 }, { key: 'haul', duration_seconds: 40 }, { key: 'return', duration_seconds: 40 }], operation_version: 7, conditions: { instability: 2, gas: 1, water: 1, incident_chance_percent: 12, max_delay_seconds: 120, transport_bonus_percent: 20, infrastructure_ids: [] }, deep_modifiers: { lift_discount_percent: 74, thermal_load_percent: 34, engineering_mitigation_percent: 5, ventilation_mitigation_percent: 7, gear_mitigation_percent: 5, heat_penalty_percent: 17, raw_work_seconds: 600, effective_work_seconds: 498 }, ...overrides }; }
function App() { return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimPage /></MemoryRouter>; }
function Dispatch({ mode = 'extract', data = wire.data! }: { mode?: DeepClaimMode; data?: DeepClaimSnapshot }) { return <DeepClaimDispatch snapshot={data} initialMode={mode} initialTarget={mode === 'extract' ? { x: 47, y: 800 } : { x: 48, y: 800 }} onClose={wire.noop} readOnly={false} busy={false} preview={wire.preview} dispatch={wire.dispatch} />; }
function Operations({ data = wire.data! }: { data?: DeepClaimSnapshot }) { return <DeepClaimOperations snapshot={data} point={null} onClose={wire.noop} onDispatch={wire.noop} onLocate={wire.locate} onFinds={wire.noop} onReports={wire.noop} />; }
function Office({ data = wire.data!, initial = 'research' }: { data?: DeepClaimSnapshot; initial?: ClaimBusinessView }) { const [view, setView] = useState(initial); return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimBusiness snapshot={data} view={view} onView={setView} onClose={wire.noop} onBuild={wire.upgrade} onHire={wire.noop} onStores={wire.noop} actions={{ startResearch: wire.research, fulfillContract: wire.noop, claimMilestone: wire.noop }} onConfirmed={wire.confirmed} now={Date.parse(data.server_now)} onRefresh={wire.noop} busy={false} readOnly={false} /></MemoryRouter>; }
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); wire.scans = []; wire.data = deepSnapshot(); wire.preview.mockResolvedValue(quote()); wire.dispatch.mockResolvedValue(wire.data); wire.production.mockResolvedValue(wire.data); wire.assign.mockResolvedValue(wire.data); wire.repair.mockResolvedValue(wire.data); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Known-ground navigation and worksite stability', () => {
  it('lists only actual connected known depths, one passage per depth, and locates the chosen real point', () => {
    render(<Operations />); const selector = screen.getByRole('combobox', { name: 'Known mine depth' }); const options = [...(selector as HTMLSelectElement).options];
    expect(options).toHaveLength(956); expect(options.some(option => option.textContent?.includes('999m'))).toBe(false); expect(options.some(option => /nickel/i.test(option.textContent ?? ''))).toBe(false);
    fireEvent.change(selector, { target: { value: '800' } }); fireEvent.click(screen.getByRole('button', { name: 'Locate known depth' })); expect(wire.locate).toHaveBeenCalledWith({ x: 48, y: 800 });
  });
  it('keeps navigation disabled when no connected known passage exists', () => {
    const data = deepSnapshot(); data.world!.tiles = [{ x: 20, y: 999, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0 }]; render(<Operations data={data} />);
    expect(screen.getByRole('combobox', { name: 'Known mine depth' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Locate known depth' })).toBeDisabled(); expect(wire.locate).not.toHaveBeenCalled();
  });
  it('retains a legal deep target when changing modes and clears only the old quote and browsing filter', async () => {
    render(<Dispatch mode="survey" />); const selector = screen.getByRole('combobox', { name: 'Expedition worksite' }); fireEvent.change(screen.getByRole('searchbox', { name: 'Depth or material' }), { target: { value: '800m' } });
    fireEvent.click(screen.getByRole('button', { name: 'Infrastructure' })); expect(selector).toHaveValue('48:800'); expect(screen.getByRole('searchbox', { name: 'Depth or material' })).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' })); await waitFor(() => expect(wire.preview).toHaveBeenCalledWith(expect.objectContaining({ mode: 'infrastructure', target_x: 48, target_y: 800 })));
  });
  it('chooses a legal deposit when the selected passage cannot be used for extraction', () => {
    render(<Dispatch mode="survey" />); fireEvent.click(screen.getByRole('button', { name: 'Extraction' })); expect(screen.getByRole('combobox', { name: 'Expedition worksite' })).toHaveValue('47:800');
  });
  it('does not repeat the public target scan on clock ticks or unrelated company revisions', () => {
    vi.useFakeTimers(); const view = render(<App />); continueDeepClaimCompany(); const count = wire.scans.length; act(() => vi.advanceTimersByTime(3000)); expect(wire.scans).toHaveLength(count);
    wire.data = { ...wire.data!, revision: 8, company: { ...wire.data!.company!, cash: 31000 } }; view.rerender(<App />); expect(wire.scans).toHaveLength(count);
    wire.data = { ...wire.data!, world: { ...wire.data!.world!, revision: 8, tiles: [...wire.data!.world!.tiles] } }; view.rerender(<App />); expect(wire.scans).toHaveLength(count + 1);
  });
});

describe('Authoritative deep shift explanations', () => {
  it('presents exact server lift and heat modifiers without applying a second local penalty', async () => {
    render(<Dispatch />); fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' })); const modifiers = await screen.findByRole('region', { name: 'Heat and lift modifiers' });
    expect(modifiers).toHaveTextContent('74% route saving'); expect(modifiers).toHaveTextContent('17% work penalty'); expect(modifiers).toHaveTextContent('498s of 600s'); expect(screen.getByText('12–16')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Conditions' })); expect(screen.getByText('Heat load')).toBeInTheDocument(); expect(screen.getAllByText('−5%')).toHaveLength(2); expect(screen.getByText('−7%')).toBeInTheDocument(); expect(screen.getByText(/Survey and installation crews do not lose work to heat/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Dispatch crew' })); }); await waitFor(() => expect(wire.dispatch).toHaveBeenCalledWith(expect.objectContaining({ target_y: 800 }), 7));
  });
  it('adds no invented modifier panel to legacy quotes', async () => {
    wire.preview.mockResolvedValue(quote({ operation_version: 3, deep_modifiers: undefined })); render(<Dispatch />); fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' })); await screen.findByRole('button', { name: 'Dispatch crew' }); expect(screen.queryByRole('region', { name: 'Heat and lift modifiers' })).not.toBeInTheDocument();
  });
  it('blocks shaft6 without the existing research and links directly to its actual review', () => {
    render(<App />); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('button', { name: 'Open camp buildings' })); fireEvent.click(screen.getByRole('button', { name: /Mine Shaft.*Level 5/ }));
    const shaft = screen.getByRole('dialog', { name: 'Mine Shaft' }); expect(within(shaft).getByRole('button', { name: 'Confirm upgrade' })).toBeDisabled(); expect(shaft).toHaveTextContent('Required: Deep Cutting Systems'); expect(shaft).toHaveTextContent('192');
    fireEvent.click(within(shaft).getByRole('button', { name: 'Review deep research' })); expect(screen.getByRole('heading', { name: 'Deep Cutting Systems' })).toBeInTheDocument(); expect(wire.upgrade).not.toHaveBeenCalled();
  });
  it('enables the real shaft upgrade only after authoritative research completion', async () => {
    wire.data!.business!.research.push({ key: 'deep_operations_2', status: 'completed', started_at: wire.data!.server_now, completes_at: wire.data!.server_now, completed_at: wire.data!.server_now }); render(<App />); continueDeepClaimCompany();
    fireEvent.click(screen.getByRole('button', { name: 'Open camp buildings' })); fireEvent.click(screen.getByRole('button', { name: /Mine Shaft.*Level 5/ })); expect(screen.getByRole('button', { name: 'Confirm upgrade' })).toBeEnabled();
    wire.upgrade.mockResolvedValue(wire.data); await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm upgrade' })); }); expect(wire.upgrade).toHaveBeenCalledWith('mine_shaft');
  });
  it('uses snapshot infrastructure capacity and preserves the existing finite research navigation', () => {
    wire.data!.deep_operations!.infrastructure_capacity = 192; const view = render(<Operations />); expect(screen.getByText('0/192')).toBeInTheDocument(); view.unmount(); render(<Office initial="company" />);
    expect(screen.getByRole('region', { name: 'Ancient Deep progression' })).toHaveTextContent('600–999m'); fireEvent.click(screen.getByRole('button', { name: 'Deep operations research' })); expect(screen.getByRole('button', { name: 'Review Deep Cutting Systems' })).toBeInTheDocument(); expect(within(screen.getByRole('group', { name: 'Research branches' })).getAllByRole('button')).toHaveLength(7);
  });
});

describe('Deep industry, gear and readable reviews', () => {
  it('keeps new materials out of legacy catalogs while exposing actual schema5 stock', () => {
    const catalogNames = () => {
      const names = new Set<string>();
      for (let page = 0; page < 30 && !(screen.getByRole('button', { name: 'Previous materials' }) as HTMLButtonElement).disabled; page++) fireEvent.click(screen.getByRole('button', { name: 'Previous materials' }));
      for (let page = 0; page < 30; page++) {
        screen.getAllByRole('button', { name: /^Inspect / }).forEach(button => names.add(button.getAttribute('aria-label')!));
        if ((screen.getByRole('button', { name: 'Next materials' }) as HTMLButtonElement).disabled) break;
        fireEvent.click(screen.getByRole('button', { name: 'Next materials' }));
      }
      return names;
    };
    const props = { readOnly: false, busy: false, onSell: wire.noop }; const view = render(<DeepClaimStores snapshot={phaseFourSnapshot()} {...props} />);
    const legacy = catalogNames();
    for (const name of ['Nickel ore', 'Sulfur', 'Nickel alloy']) expect(legacy.has(`Inspect ${name}`)).toBe(false);
    view.rerender(<DeepClaimStores snapshot={wire.data!} {...props} />);
    const current = catalogNames();
    for (const name of ['Nickel ore', 'Sulfur', 'Nickel alloy']) expect(current.has(`Inspect ${name}`)).toBe(true);
  });
  it('explains shield slot/condition/crew averaging and respects the real research gates', () => {
    render(<DeepClaimIndustry snapshot={wire.data!} view="workshop" onView={wire.noop} station="tool_station" onStation={wire.noop} busy={false} readOnly={false} now={Date.parse(wire.data!.server_now)} onRefresh={wire.noop} onBuild={wire.noop} onResearch={wire.research} onSell={wire.noop} onOpenHaul={wire.noop} startProduction={wire.production} collectProduction={wire.noop} onConfirmed={wire.confirmed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review Craft Nickel Heat Shield' })); const review = screen.getByRole('dialog', { name: 'Craft Nickel Heat Shield' }); expect(review).toHaveTextContent('15 percentage points'); expect(review).toHaveTextContent('Uses the head slot');
    fireEvent.click(within(review).getByRole('button', { name: 'Review batch' })); expect(within(review).getByRole('button', { name: 'Start production' })).toBeDisabled(); fireEvent.click(within(review).getByRole('button', { name: 'View required research' })); expect(wire.research).toHaveBeenCalledWith('deep_operations_2'); expect(wire.production).not.toHaveBeenCalled();
  });
  it('distinguishes working assigned shields from broken gear and lists mandatory repair materials', async () => {
    const data = wire.data!; const worker = data.workers[0]; data.equipment = [{ id: 'shield', definition_key: 'nickel_heatshield', worker_id: worker.id, durability: 0, max_durability: 180, repair_cost: 90, repair_materials: { nickel_alloy: 1, sulfur: 2 } }]; data.resources = { nickel_alloy: 1, sulfur: 2 };
    render(<DeepClaimWorkforce snapshot={data} initialView="staff" actions={{ hire: wire.noop, train: wire.noop, assignEquipment: wire.assign, repairEquipment: wire.repair, retireEquipment: wire.noop }} busy={false} readOnly={false} onConfirmed={wire.confirmed} onQuarters={wire.noop} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Crew file' })[0]); fireEvent.click(screen.getByRole('button', { name: 'Gear' })); expect(screen.getByText('Heat protection: inactive · broken')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Repair Nickel Heat Shield' })); const repair = screen.getByRole('dialog', { name: 'Repair Nickel Heat Shield' }); expect(repair).toHaveTextContent('1 Nickel alloy'); expect(repair).toHaveTextContent('2 Sulfur'); expect(wire.repair).not.toHaveBeenCalled(); await act(async () => { fireEvent.click(within(repair).getByRole('button', { name: 'Confirm repair' })); }); expect(wire.repair).toHaveBeenCalledWith('shield');
  });
  it('resets and focuses explicit Office reviews, restores the opener, and preserves scroll on polling/revisions', () => {
    const view = render(<Office />); const body = screen.getByRole('dialog', { name: 'Company Office' }).querySelector<HTMLDivElement>('.dcl-business-body')!; const opener = screen.getByRole('button', { name: 'Review Cutting Methods' }); body.scrollTop = 180; opener.focus(); fireEvent.click(opener);
    expect(body.scrollTop).toBe(0); expect(screen.getByRole('heading', { name: 'Cutting Methods' })).toHaveFocus(); body.scrollTop = 80;
    wire.data = { ...wire.data!, revision: 8, server_now: '2026-11-01T12:01:00Z' }; view.rerender(<Office data={wire.data} />); expect(body.scrollTop).toBe(80);
    fireEvent.click(screen.getByRole('button', { name: 'Back' })); expect(body.scrollTop).toBe(0); expect(screen.getByRole('button', { name: 'Review Cutting Methods' })).toHaveFocus();
  });
});
