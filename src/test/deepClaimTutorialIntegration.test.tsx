import { useState, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimWorkforce } from '@/components/deepClaim/DeepClaimWorkforce';
import { DeepClaimDispatch } from '@/components/deepClaim/DeepClaimDispatch';
import { DeepClaimBusiness } from '@/components/deepClaim/DeepClaimBusiness';
import { DeepClaimIndustry } from '@/components/deepClaim/DeepClaimIndustry';
import { DeepClaimClub } from '@/components/deepClaim/DeepClaimClub';
import { DeepClaimFieldLog, DeepClaimOperations, type ClaimFieldView } from '@/components/deepClaim/DeepClaimField';
import { DeepClaimSettings } from '@/components/deepClaim/DeepClaimSettings';
import { DeepClaimTutorialEventsProvider, useDeepClaimTutorialEvents, useTutorialView } from '@/components/deepClaim/tutorial/events';
import { TUTORIAL_TARGETS } from '@/lib/deepClaim/tutorial/types';
import type { DeepClaimPreview } from '@/lib/deepClaim/types';
import type { createDeepClaimAudio } from '@/lib/deepClaim/audio';
import { phaseSevenSnapshot } from './fixtures/deepClaimPhase7';
import { phaseFiveClubView } from './fixtures/deepClaimPhase5';

vi.mock('@/hooks/useNotificationPreferences', () => ({ useNotificationPreferences: () => ({ prefs: { deep_claim: true }, loading: false, saving: false, error: null, update: vi.fn(), refresh: vi.fn() }) }));
const emit = vi.fn(), openJournal = vi.fn(), askGus = vi.fn(), mainMenu = vi.fn();
const actions = { hire: vi.fn(), train: vi.fn(), assignEquipment: vi.fn(), repairEquipment: vi.fn(), retireEquipment: vi.fn() };
const noop = vi.fn();
function Bridge({ children }: { children: ReactNode }) {
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <DeepClaimTutorialEventsProvider value={{ emit, openJournal, askGus, mainMenu, scopeKey: 'user-a:club-a:company-a' }}>{children}</DeepClaimTutorialEventsProvider>
  </MemoryRouter>;
}
function Workforce() { return <DeepClaimWorkforce snapshot={phaseSevenSnapshot()} actions={actions} busy={false} readOnly={false} onConfirmed={noop} onQuarters={noop} />; }
function estimate(): DeepClaimPreview {
  return { allowed: true, reasons: [], company_revision: 7, server_now: '2026-11-01T12:00:00Z', wages: 6, energy_per_worker: 1,
    duration_seconds: 1200, estimated_yield: { min: 2, max: 4 }, cargo_capacity: 120, risk_level: 'low', accessible_depth: 49,
    route: [{ x: 48, y: 1 }, { x: 47, y: 1 }], expected_resources: ['stone'], projected_completion_at: '2026-11-01T12:20:00Z',
    stages: [{ key: 'travel', duration_seconds: 40 }, { key: 'setup', duration_seconds: 40 }, { key: 'work', duration_seconds: 1040 }, { key: 'haul', duration_seconds: 40 }, { key: 'return', duration_seconds: 40 }] };
}
function fieldSnapshot() {
  const data = phaseSevenSnapshot();
  data.discoveries = [{ id: 'find-1', job_id: 'job-1', x: 47, y: 3, kind: 'banded_geode', name: 'Banded Geode', quality: 'fine', detail: 'A recovered quartz-banded specimen.',
    sale_value: 42, salvage: { quartz: 2, stone: 3 }, status: 'pending', discovered_at: data.server_now, resolved_at: null }];
  data.discovery_summary = { pending: 1, kept: 0, sold: 0, salvaged: 0 };
  data.field_reports = [{ id: 'report-1', job_id: 'job-1', kind: 'discovery', title: 'A find recovered', description: 'The returning crew brought a specimen home.', point: { x: 47, y: 3 },
    occurred_at: data.server_now, delay_seconds: 0, tiles_revealed: 0, infrastructure_id: null, discovery_id: 'find-1' }];
  return data;
}
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe('Deep Claim genuine gameplay tutorial observations', () => {
  it('keeps independently rendered gameplay usable without a provider or decorative help buttons', () => {
    render(<Workforce />);
    expect(screen.queryByRole('button', { name: /^Help:/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Crew file' })[0]);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Inspect Mining' }), { key: 'Enter' });
    expect(screen.getByRole('dialog', { name: 'Worker a' })).toBeInTheDocument();
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
  });

  it('observes the actual employee, keyboard-inspected skill, energy and traits without training anyone', async () => {
    render(<Bridge><Workforce /></Bridge>);
    fireEvent.click(screen.getAllByRole('button', { name: 'Crew file' })[0]);
    await waitFor(() => expect(emit).toHaveBeenCalledWith('worker_inspected', expect.objectContaining({ worker_id: 'worker-a', view: 'overview' })));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Inspect Geology' }), { key: ' ' });
    expect(emit).toHaveBeenCalledWith('stat_inspected', expect.objectContaining({ worker_id: 'worker-a', stat: 'geology' }));
    fireEvent.focus(document.querySelector('[data-dc-tutorial="worker-traits"]')!);
    expect(emit).toHaveBeenCalledWith('traits_inspected', expect.objectContaining({ worker_id: 'worker-a' }));
    fireEvent.click(screen.getByRole('button', { name: 'Training' }));
    await waitFor(() => expect(emit).toHaveBeenCalledWith('worker_inspected', expect.objectContaining({ worker_id: 'worker-a', view: 'training' })));
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
    for (const target of document.querySelectorAll('[data-dc-tutorial]')) expect(TUTORIAL_TARGETS).toContain(target.getAttribute('data-dc-tutorial'));
  });

  it('opens an owned requested worker and view, handles a repeated Show Me ID once, and reopens with a fresh ID', async () => {
    const snapshot = phaseSevenSnapshot();
    const workforce = (id: string, view: 'training' | 'gear') => <Bridge><DeepClaimWorkforce snapshot={snapshot} actions={actions} busy={false} readOnly={false} onConfirmed={noop} onQuarters={noop}
      initialView="hire" inspectRequest={{ id, workerId: 'worker-b', view }} /></Bridge>;
    const rendered = render(workforce('inspect-1', 'training'));
    expect(await screen.findByRole('dialog', { name: 'Worker b' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Training skill' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to crew' }));
    rendered.rerender(workforce('inspect-1', 'training'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rendered.rerender(workforce('inspect-2', 'gear'));
    expect(await screen.findByRole('dialog', { name: 'Worker b' })).toBeInTheDocument();
    expect(document.querySelector('[data-dc-tutorial="worker-gear"]')).toBeInTheDocument();
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
  });

  it('ignores foreign or stale worker inspection IDs without leaving Hiring or exposing another file', () => {
    render(<Bridge><DeepClaimWorkforce snapshot={phaseSevenSnapshot()} actions={actions} busy={false} readOnly={false} onConfirmed={noop} onQuarters={noop}
      initialView="hire" inspectRequest={{ id: 'inspect-foreign', workerId: 'other-company-worker', view: 'training' }} /></Bridge>);
    expect(screen.getByRole('heading', { name: 'Hiring' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(emit.mock.calls.some(([type]) => type === 'worker_inspected')).toBe(false);
  });

  it('opens Hiring through a fresh view request without snapping back after the player changes views', async () => {
    const data = phaseSevenSnapshot();
    const workforce = (id: string) => <Bridge><DeepClaimWorkforce snapshot={data} actions={actions} busy={false} readOnly={false} onConfirmed={noop} onQuarters={noop}
      viewRequest={{ id, view: 'hire' }} /></Bridge>;
    const rendered = render(workforce('hiring-1'));
    expect(await screen.findByRole('heading', { name: 'Hiring' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Staff/ }));
    rendered.rerender(workforce('hiring-1'));
    expect(screen.getByRole('heading', { name: 'Crew' })).toBeInTheDocument();
    rendered.rerender(workforce('hiring-2'));
    expect(await screen.findByRole('heading', { name: 'Hiring' })).toBeInTheDocument();
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
  });

  it('does not replay observations on clock-only handler changes and routes later gestures to the current scope', () => {
    function Probe() {
      const tutorial = useDeepClaimTutorialEvents();
      useTutorialView('stock_inspected', { view: 'stock' }, 'same-visible-stock');
      return <button onClick={() => tutorial.emit('stock_inspected', { view: 'manual' })}>Inspect stock</button>;
    }
    const first = vi.fn(), second = vi.fn();
    const view = render(<DeepClaimTutorialEventsProvider value={{ emit: first, openJournal, askGus, scopeKey: 'first' }}><Probe /></DeepClaimTutorialEventsProvider>);
    expect(first).toHaveBeenCalledTimes(1);
    view.rerender(<DeepClaimTutorialEventsProvider value={{ emit: second, openJournal, askGus, scopeKey: 'first' }}><Probe /></DeepClaimTutorialEventsProvider>);
    expect(second).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect stock' }));
    expect(second).toHaveBeenCalledWith('stock_inspected', { view: 'manual' });
    view.rerender(<DeepClaimTutorialEventsProvider value={{ emit: second, openJournal, askGus, scopeKey: 'second' }}><Probe /></DeepClaimTutorialEventsProvider>);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('records a quote only after the real preview resolves and never turns review into a confirmed expedition', async () => {
    let resolve!: (value: DeepClaimPreview) => void;
    const preview = vi.fn(() => new Promise<DeepClaimPreview>(done => { resolve = done; })), dispatch = vi.fn();
    render(<Bridge><DeepClaimDispatch snapshot={phaseSevenSnapshot()} initialTarget={{ x: 47, y: 1 }} initialMode="extract" preview={preview} dispatch={dispatch} onClose={noop} readOnly={false} busy={false} /></Bridge>);
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    expect(emit.mock.calls.some(([type]) => type === 'quote_reviewed')).toBe(false);
    await act(async () => { resolve(estimate()); });
    await waitFor(() => expect(emit).toHaveBeenCalledWith('quote_reviewed', { mode: 'extract', allowed: true, company_revision: 7 }));
    expect(document.querySelector('[data-dc-tutorial="dispatch-quote"]')).toBeInTheDocument();
    expect(dispatch).not.toHaveBeenCalled();
    expect(emit.mock.calls.some(([type]) => type.endsWith('_confirmed'))).toBe(false);
  });

  it('keeps a failed preview unreviewed and an unconfirmed dispatch out of the observation channel', async () => {
    const dispatch = vi.fn();
    render(<Bridge><DeepClaimDispatch snapshot={phaseSevenSnapshot()} initialTarget={{ x: 47, y: 1 }} initialMode="extract" preview={vi.fn().mockRejectedValue(new Error('Connection interrupted'))} dispatch={dispatch} onClose={noop} readOnly={false} busy={false} /></Bridge>);
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
    expect(emit.mock.calls.some(([type]) => type === 'quote_reviewed' || type.endsWith('_confirmed'))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('opens a relevant research lesson and Ask Gus without starting paid research', async () => {
    const data = phaseSevenSnapshot(), startResearch = vi.fn();
    render(<Bridge><DeepClaimBusiness snapshot={data} view="research" onView={noop} onClose={noop} onBuild={noop} onHire={noop} onStores={noop}
      actions={{ startResearch, fulfillContract: noop, claimMilestone: noop }} onConfirmed={noop} now={Date.parse(data.server_now)} onRefresh={noop} busy={false} readOnly={false} /></Bridge>);
    fireEvent.click(screen.getByRole('button', { name: 'Help: Company Office' })); expect(openJournal).toHaveBeenCalledWith('business.research');
    fireEvent.click(screen.getByRole('button', { name: 'Ask Gus' })); expect(askGus).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Review Cutting Methods' }));
    await waitFor(() => expect(emit).toHaveBeenCalledWith('research_inspected', { record_id: 'excavation_1', view: 'research' }));
    expect(startResearch).not.toHaveBeenCalled();
  });

  it.each(['projects', 'standings', 'showcase'] as const)('keeps Office and %s help in existing header/navigation rows above the Club footer', view => {
    const data = phaseSevenSnapshot(), board = phaseFiveClubView({ ownRevision: 7 });
    const club = <DeepClaimClub snapshot={data} data={board} loading={false} refreshing={false} error={null} refresh={async () => {}} metric="weekly_mining_value" onMetric={noop} page={0} onPage={noop}
      view={view} onView={noop} onClose={noop} actions={{ setSocialPreferences: noop, contributeProject: noop, claimProject: noop }} onConfirmed={noop} busy={false} readOnly={false} />;
    render(<Bridge><DeepClaimBusiness snapshot={data} view="club" clubContent={club} onView={noop} onClose={noop} onBuild={noop} onHire={noop} onStores={noop}
      actions={{ startResearch: noop, fulfillContract: noop, claimMilestone: noop }} onConfirmed={noop} now={Date.parse(data.server_now)} onRefresh={noop} busy={false} readOnly={false} /></Bridge>);
    const dialog = screen.getByRole('dialog', { name: 'Company Office' });
    const header = screen.getByRole('button', { name: 'Help: Company Office' }).closest('.dcl-dialog-header');
    expect(header).toBe(dialog.firstElementChild);
    expect(header).toContainElement(screen.getByRole('button', { name: 'Ask Gus' }));
    const navigationRow = screen.getByRole('group', { name: 'Club office views' }).closest('.dct-context-toolbar');
    expect(navigationRow).toContainElement(screen.getByRole('button', { name: `Help: ${view === 'projects' ? 'Club projects' : view === 'standings' ? 'Standings' : 'Showcases'}` }));
    expect(document.querySelector('.dcl-club-footer')).toContainElement(screen.getByRole('button', { name: 'Back to camp' }));
    expect(document.querySelector('.dcl-club')?.lastElementChild).toBe(document.querySelector('.dcl-club-footer'));
  });

  it('clears a stale Office detail on an external view change without remounting the portaled Office', async () => {
    const data = phaseSevenSnapshot(), startResearch = vi.fn(), fulfillContract = vi.fn();
    const office = (view: 'research' | 'contracts') => <Bridge><DeepClaimBusiness snapshot={data} view={view} onView={noop} onClose={noop} onBuild={noop} onHire={noop} onStores={noop}
      actions={{ startResearch, fulfillContract, claimMilestone: noop }} onConfirmed={noop} now={Date.parse(data.server_now)} onRefresh={noop} busy={false} readOnly={false} /></Bridge>;
    const rendered = render(office('research'));
    fireEvent.click(screen.getByRole('button', { name: 'Review Cutting Methods' }));
    expect(screen.getByRole('heading', { name: 'Effects' })).toBeInTheDocument();
    const outerDialog = screen.getByRole('dialog', { name: 'Company Office' });
    rendered.rerender(office('contracts'));
    expect(screen.getByRole('dialog', { name: 'Company Office' })).toBe(outerDialog);
    expect(screen.getByRole('heading', { name: 'Contracts' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Effects' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review order Yard Foundations' }));
    await waitFor(() => expect(emit).toHaveBeenCalledWith('contract_inspected', expect.objectContaining({ view: 'contracts' })));
    expect(startResearch).not.toHaveBeenCalled(); expect(fulfillContract).not.toHaveBeenCalled();
  });

  it('preserves an initial real research review instead of treating the first render as an external view change', () => {
    const data = phaseSevenSnapshot();
    render(<Bridge><DeepClaimBusiness snapshot={data} view="research" initialResearchKey="deep_operations_2" onView={noop} onClose={noop} onBuild={noop} onHire={noop} onStores={noop}
      actions={{ startResearch: noop, fulfillContract: noop, claimMilestone: noop }} onConfirmed={noop} now={Date.parse(data.server_now)} onRefresh={noop} busy={false} readOnly={false} /></Bridge>);
    expect(screen.getByRole('heading', { name: 'Deep Cutting Systems' })).toBeInTheDocument();
    expect(document.querySelector('[data-dc-tutorial="research-review"]')).toBeInTheDocument();
  });

  it('preserves a new milestone review opened in the same internal action as its Records view change', async () => {
    const data = phaseSevenSnapshot(); data.business!.milestones.find(item => item.key === 'first_shift')!.progress = 1;
    const claimMilestone = vi.fn().mockResolvedValue(data);
    function Office() {
      const [view, setView] = useState<'company' | 'research' | 'contracts' | 'records' | 'club'>('company');
      return <DeepClaimBusiness snapshot={data} view={view} onView={setView} onClose={noop} onBuild={noop} onHire={noop} onStores={noop}
        actions={{ startResearch: noop, fulfillContract: noop, claimMilestone }} onConfirmed={noop} now={Date.parse(data.server_now)} onRefresh={noop} busy={false} readOnly={false} />;
    }
    render(<Bridge><Office /></Bridge>);
    fireEvent.click(screen.getByRole('button', { name: 'Review milestone · 1 ready' }));
    const confirm = screen.getByRole('button', { name: 'Claim company credits' });
    expect(confirm).toBeEnabled(); expect(claimMilestone).not.toHaveBeenCalled();
    fireEvent.click(confirm);
    await waitFor(() => expect(claimMilestone).toHaveBeenCalledWith('first_shift', data.revision));
  });

  it('inspects the actual locked recipe and its inputs without manufacturing practice inventory', async () => {
    const data = phaseSevenSnapshot(), startProduction = vi.fn();
    render(<Bridge><DeepClaimIndustry snapshot={data} view="workshop" onView={noop} station="smeltery" onStation={noop} now={Date.parse(data.server_now)}
      onRefresh={noop} onBuild={noop} onSell={noop} onOpenHaul={noop} startProduction={startProduction} collectProduction={noop} onConfirmed={noop} busy={false} readOnly={false} /></Bridge>);
    fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Nickel Alloy' }));
    await waitFor(() => expect(emit).toHaveBeenCalledWith('recipe_inspected', { recipe_key: 'smelt_nickel_alloy', view: 'smeltery' }));
    expect(screen.getByText(/Complete Deep Cutting Systems research first/)).toBeInTheDocument();
    expect(startProduction).not.toHaveBeenCalled(); expect(data.resources.nickel_alloy ?? 0).toBe(0);
  });

  it('closes a stale recipe when Show Me changes the controlled station or Stores view', async () => {
    const data = phaseSevenSnapshot(), startProduction = vi.fn();
    const industry = (station: 'smeltery' | 'gem_workshop', view: 'stock' | 'workshop' = 'workshop') => <Bridge><DeepClaimIndustry snapshot={data} view={view} onView={noop} station={station} onStation={noop} now={Date.parse(data.server_now)}
      onRefresh={noop} onBuild={noop} onSell={noop} onOpenHaul={noop} startProduction={startProduction} collectProduction={noop} onConfirmed={noop} busy={false} readOnly={false} /></Bridge>;
    const rendered = render(industry('smeltery'));
    fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Copper' }));
    expect(screen.getByRole('dialog', { name: 'Smelt Copper' })).toBeInTheDocument();
    rendered.rerender(industry('gem_workshop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review Polish Quartz' }));
    await waitFor(() => expect(emit).toHaveBeenCalledWith('recipe_inspected', { recipe_key: 'polish_quartz', view: 'gem_workshop' }));
    rendered.rerender(industry('gem_workshop', 'stock'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Warehouse' })).toBeInTheDocument();
    expect(startProduction).not.toHaveBeenCalled();
  });

  it('teaches privacy by reviewing actual opt-in controls without changing either sharing preference', async () => {
    const data = phaseSevenSnapshot(), board = phaseFiveClubView({ ownRevision: 7 }), setSocialPreferences = vi.fn();
    render(<Bridge><DeepClaimClub snapshot={data} data={board} loading={false} refreshing={false} error={null} refresh={async () => {}} metric="weekly_mining_value" onMetric={noop} page={0} onPage={noop}
      view="projects" onView={noop} onClose={noop} actions={{ setSocialPreferences, contributeProject: noop, claimProject: noop }} onConfirmed={noop} busy={false} readOnly={false} /></Bridge>);
    fireEvent.click(screen.getByRole('button', { name: 'Sharing preferences' }));
    await waitFor(() => expect(emit).toHaveBeenCalledWith('privacy_reviewed', { view: 'privacy' }));
    expect(screen.getByRole('checkbox', { name: 'List my company in standings' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Publish my selected specimens' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Help: Sharing privacy' })); expect(openJournal).toHaveBeenCalledWith('club.privacy');
    expect(setSocialPreferences).not.toHaveBeenCalled();
  });

  it('preserves a genuine project deep link initially and clears stale project/privacy details on external club-view changes', () => {
    const data = phaseSevenSnapshot(), board = phaseFiveClubView({ ownRevision: 7 }), setSocialPreferences = vi.fn(), contributeProject = vi.fn();
    const club = (view: 'projects' | 'standings' | 'showcase') => <Bridge><DeepClaimClub snapshot={data} data={board} loading={false} refreshing={false} error={null} refresh={async () => {}} metric="weekly_mining_value" onMetric={noop} page={0} onPage={noop}
      projectKey="camp_supply" view={view} onView={noop} onClose={noop} actions={{ setSocialPreferences, contributeProject, claimProject: noop }} onConfirmed={noop} busy={false} readOnly={false} /></Bridge>;
    const rendered = render(club('projects'));
    expect(screen.getByRole('heading', { name: 'Camp Supply' })).toBeInTheDocument();
    const original = document.querySelector('.dcl-club');
    rendered.rerender(club('standings'));
    expect(document.querySelector('.dcl-club')).toBe(original);
    expect(screen.getByRole('group', { name: 'Club standing metric' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Camp Supply' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sharing preferences' }));
    expect(screen.getByRole('checkbox', { name: 'List my company in standings' })).not.toBeChecked();
    rendered.rerender(club('showcase'));
    expect(screen.getByRole('heading', { name: 'Showcases' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'List my company in standings' })).not.toBeInTheDocument();
    expect(setSocialPreferences).not.toHaveBeenCalled(); expect(contributeProject).not.toHaveBeenCalled();
  });

  it('clears stale report and discovery dialogs when an external Field Log view changes', () => {
    const data = fieldSnapshot(), resolveDiscovery = vi.fn();
    function Log({ view }: { view: ClaimFieldView }) {
      const [selected, setSelected] = useState<string | null>(null);
      return <DeepClaimFieldLog snapshot={data} view={view} onView={noop} selectedFindId={selected} onSelectFind={setSelected} onLocate={noop}
        resolveDiscovery={resolveDiscovery} readOnly={false} busy={false} onConfirmed={noop} />;
    }
    const log = (view: ClaimFieldView) => <Bridge><Log view={view} /></Bridge>;
    const rendered = render(log('reports'));
    fireEvent.click(screen.getByRole('button', { name: 'Read report: A find recovered' }));
    expect(screen.getByRole('dialog', { name: 'A find recovered' })).toBeInTheDocument();
    rendered.rerender(log('finds'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Banded Geode' }));
    expect(screen.getByRole('dialog', { name: 'Banded Geode' })).toBeInTheDocument();
    rendered.rerender(log('reports'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    rendered.rerender(log('finds'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(resolveDiscovery).not.toHaveBeenCalled();
  });

  it('preserves Inspect recovered find across its same-batch internal Reports-to-Finds transition', () => {
    const data = fieldSnapshot(), resolveDiscovery = vi.fn();
    function Log() {
      const [view, setView] = useState<ClaimFieldView>('reports'), [selected, setSelected] = useState<string | null>(null);
      return <DeepClaimFieldLog snapshot={data} view={view} onView={setView} selectedFindId={selected} onSelectFind={setSelected} onLocate={noop}
        resolveDiscovery={resolveDiscovery} readOnly={false} busy={false} onConfirmed={noop} />;
    }
    render(<Bridge><Log /></Bridge>);
    fireEvent.click(screen.getByRole('button', { name: 'Read report: A find recovered' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect recovered find' }));
    expect(screen.getByRole('dialog', { name: 'Banded Geode' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'A find recovered' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-dc-tutorial="discovery-review"]')).toBeInTheDocument();
    expect(resolveDiscovery).not.toHaveBeenCalled();
  });

  it('retains the reference Field Guide alongside the journal and delegates safe Main Menu navigation', async () => {
    const settings = { master: false, music: true, ambient: true, sfx: true, volume: .65, musicVolume: 1, ambientVolume: 1, sfxVolume: 1 };
    const audio = { getSnapshot: () => settings, subscribe: () => () => {}, updateSettings: noop, unlock: async () => false } as unknown as ReturnType<typeof createDeepClaimAudio>;
    render(<Bridge><DeepClaimSettings audio={audio} visuals={{ reducedMotion: false, reducedGraphics: false }} onVisualsChange={noop} onRefresh={noop} refreshing={false} business deep industry field /></Bridge>);
    fireEvent.click(screen.getByRole('button', { name: 'Training Journal' })); expect(openJournal).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Return to Main Menu' })); expect(mainMenu).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Field guide' }));
    expect(screen.getByRole('dialog', { name: 'Field guide' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next guide page' }));
    await waitFor(() => expect(emit).toHaveBeenCalledWith('guide_reviewed', { view: 'field_guide', record_id: 'page:1' }));
  });

  it('opens the actual requested Updates view once while preserving every sound and notification preference', async () => {
    const settings = { master: false, music: true, ambient: true, sfx: true, volume: .65 };
    const updateSettings = vi.fn();
    const audio = { getSnapshot: () => settings, subscribe: () => () => {}, updateSettings, unlock: async () => false } as unknown as ReturnType<typeof createDeepClaimAudio>;
    const controls = (id: string) => <Bridge><DeepClaimSettings audio={audio} visuals={{ reducedMotion: false, reducedGraphics: false }} onVisualsChange={noop}
      onRefresh={noop} refreshing={false} business viewRequest={{ id, view: 'updates' }} /></Bridge>;
    const rendered = render(controls('updates-1'));
    expect(await screen.findByRole('switch', { name: 'Deep Claim notifications' })).toBeInTheDocument();
    expect(emit).toHaveBeenCalledWith('settings_opened', { view: 'updates' });
    fireEvent.click(screen.getByRole('tab', { name: 'Sound' }));
    rendered.rerender(controls('updates-1'));
    expect(screen.getByRole('switch', { name: 'Enable sound' })).not.toBeChecked();
    rendered.rerender(controls('updates-2'));
    expect(await screen.findByRole('switch', { name: 'Deep Claim notifications' })).toBeInTheDocument();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('delegates Gus commentary only to the provided company journal preference and retains manual help', () => {
    const settings = { master: false, music: true, ambient: true, sfx: true, volume: .65 }, updateSettings = vi.fn(), commentary = vi.fn();
    const audio = { getSnapshot: () => settings, subscribe: () => () => {}, updateSettings, unlock: async () => false } as unknown as ReturnType<typeof createDeepClaimAudio>;
    function Controls() {
      const [enabled, setEnabled] = useState(true);
      return <DeepClaimTutorialEventsProvider value={{ emit, openJournal, askGus, commentaryEnabled: enabled, onCommentaryChange: value => { commentary(value); setEnabled(value); } }}>
        <DeepClaimSettings audio={audio} visuals={{ reducedMotion: false, reducedGraphics: false }} onVisualsChange={noop} onRefresh={noop} refreshing={false} viewRequest={{ id: 'visuals', view: 'visuals' }} />
      </DeepClaimTutorialEventsProvider>;
    }
    render(<Controls />);
    const toggle = screen.getByRole('switch', { name: 'Gus commentary' }); expect(toggle).toBeChecked();
    fireEvent.click(toggle); expect(toggle).not.toBeChecked(); expect(commentary).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Training Journal' })); expect(openJournal).toHaveBeenCalledOnce();
    expect(updateSettings).not.toHaveBeenCalled();
    expect(screen.getByText(/Guidance and Ask Gus stay available/)).toBeInTheDocument();
  });

  it('offers accessible known-depth inspection without speculative work or dispatch', () => {
    const data = phaseSevenSnapshot(), onDispatch = vi.fn(), onLocate = vi.fn();
    function Operations() { const [point] = useState({ x: 48, y: 1 }); return <DeepClaimOperations snapshot={data} point={point} onClose={noop} onDispatch={onDispatch} onLocate={onLocate} onFinds={noop} onReports={noop} />; }
    render(<Bridge><Operations /></Bridge>);
    fireEvent.click(screen.getByRole('button', { name: 'Locate known depth' }));
    expect(onLocate).toHaveBeenCalledWith({ x: 48, y: 1 });
    expect(emit).toHaveBeenCalledWith('worksite_inspected', { view: 'operations', record_id: '48:1' });
    expect(onDispatch).not.toHaveBeenCalled();
  });
});
