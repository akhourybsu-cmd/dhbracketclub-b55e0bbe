import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimBusiness } from '@/components/deepClaim/DeepClaimBusiness';
import { DeepClaimClub } from '@/components/deepClaim/DeepClaimClub';
import { DeepClaimGoalPlanner } from '@/components/deepClaim/DeepClaimCompanyGoals';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';
import { phaseFiveClubView } from './fixtures/deepClaimPhase5';

afterEach(cleanup);
const start = Date.parse('2026-11-01T12:00:00Z');
type OfficeProps = ComponentProps<typeof DeepClaimBusiness>;
type ClubProps = ComponentProps<typeof DeepClaimClub>;

function Office(props: Partial<OfficeProps> & { snapshot: DeepClaimSnapshot }) {
  const noop = vi.fn();
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimBusiness
    view="research" now={start + 300_000} onView={noop} onClose={noop} onBuild={noop} onHire={noop} onStores={noop}
    onConfirmed={noop} onRefresh={noop} busy={false} readOnly={false}
    actions={{ startResearch: noop, fulfillContract: noop, claimMilestone: noop }} {...props}
  /></MemoryRouter>;
}

function Club(props: Partial<ClubProps> & { snapshot: DeepClaimSnapshot }) {
  const noop = vi.fn();
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimClub
    view="projects" data={phaseFiveClubView()} loading={false} refreshing={false} error={null} refresh={noop}
    metric="weekly_mining_value" page={0} onMetric={noop} onPage={noop} onView={noop} onClose={noop}
    busy={false} readOnly={false} onConfirmed={noop}
    actions={{ setSocialPreferences: noop, contributeProject: noop, claimProject: noop }} {...props}
  /></MemoryRouter>;
}

function fundedResearch() {
  const data = phaseFourSnapshot();
  data.company!.cash = 0;
  data.resources = {};
  data.business!.research = [{ key: 'excavation_1', status: 'active', started_at: new Date(start).toISOString(), completes_at: new Date(start + 600_000).toISOString(), completed_at: null }];
  return data;
}

describe('Deep Claim funded research and refreshed reviews', () => {
  it('names milestone objectives and depth units without repeating generic award instructions', () => {
    const data = phaseFourSnapshot();
    const shifts = data.business_catalog!.milestones.find(item => item.metric === 'completed_mining_expeditions')!;
    const depth = data.business_catalog!.milestones.find(item => item.metric === 'max_completed_mining_depth')!;
    data.business_catalog!.milestones = [shifts, depth];
    data.business!.milestones.find(item => item.key === depth.key)!.progress = 27;
    const original = structuredClone(data);
    render(<Office snapshot={data} view="records" />);
    const shiftsCard = screen.getByRole('heading', { name: shifts.name }).closest('section')!;
    const depthCard = screen.getByRole('heading', { name: depth.name }).closest('section')!;
    expect(shiftsCard).toHaveTextContent('Mining shifts completed');
    expect(shiftsCard).not.toHaveTextContent(shifts.description);
    expect(depthCard).toHaveTextContent('Deepest mining shift');
    expect(depthCard).toHaveTextContent(`27/${depth.target}m`);
    expect(depthCard).not.toHaveTextContent(depth.description);
    fireEvent.click(within(depthCard).getByRole('button', { name: `Review milestone ${depth.name}` }));
    expect(screen.getByText(`27 / ${depth.target}m recorded`)).toBeInTheDocument();
    expect(screen.queryByText(depth.description)).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: `${depth.name} recorded progress` })).toHaveAttribute('aria-valuenow', '27');
    expect(data).toEqual(original);
  });

  it('shows the paid project and its progress without asking for its costs a second time', () => {
    const data = fundedResearch(), original = structuredClone(data), refresh = vi.fn();
    const ui = render(<Office snapshot={data} initialReview={{ kind: 'research', key: 'excavation_1' }} onRefresh={refresh} />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByRole('heading', { name: 'Effects' })).toBeInTheDocument();
    expect(screen.queryByText('Research cost')).not.toBeInTheDocument();
    expect(screen.queryByText('Required research')).not.toBeInTheDocument();
    expect(screen.queryByText(/operating reserve/)).not.toBeInTheDocument();
    expect(screen.queryByText(/in collected stock/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start research' })).not.toBeInTheDocument();
    ui.rerender(<Office snapshot={{ ...data, revision: data.revision + 1 }} now={start + 900_000} initialReview={{ kind: 'research', key: 'excavation_1' }} onRefresh={refresh} />);
    expect(screen.getByText('Awaiting completion report')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review current report' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check research completion' }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(data).toEqual(original);
  });

  it('keeps funded research cards distinct from the next purchase', () => {
    render(<Office snapshot={fundedResearch()} />);
    const dialog = screen.getByRole('dialog', { name: 'Company Office' });
    const running = dialog.querySelector<HTMLElement>('[data-research-state="active"]')!;
    expect(within(running).getByText('In progress')).toBeInTheDocument();
    expect(running.querySelector('.dcl-research-cost')).toBeNull();
    expect(dialog.querySelector('[data-research-state="locked"] .dcl-research-cost')).not.toBeNull();
  });

  it('still blocks an unfunded project while another project is running', () => {
    const data = fundedResearch();
    data.business!.research[0].key = 'geology_1';
    render(<Office snapshot={data} initialReview={{ kind: 'research', key: 'excavation_1' }} />);
    expect(screen.getByText('Research cost')).toBeInTheDocument();
    expect(screen.getByText('One research project can run at a time.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start research' })).toBeDisabled();
  });

  it('returns to the list if a refreshed catalog no longer contains the inspected record', () => {
    const data = phaseFourSnapshot(), close = vi.fn();
    const ui = render(<Office snapshot={data} initialReview={{ kind: 'contract', key: 'yard_foundations' }} view="contracts" onClose={close} />);
    expect(screen.getByRole('heading', { name: 'Yard Foundations' })).toBeInTheDocument();
    const updated = structuredClone(data);
    updated.business_catalog!.contracts = updated.business_catalog!.contracts.filter(item => item.key !== 'yard_foundations');
    ui.rerender(<Office snapshot={updated} initialReview={{ kind: 'contract', key: 'yard_foundations' }} view="contracts" onClose={close} />);
    expect(screen.queryByRole('button', { name: 'Deliver whole order' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Claim company credits' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to camp' }));
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes a goal invalidated by a refreshed catalog with the displayed one-tap Back to camp action', () => {
    const data = phaseFourSnapshot(), close = vi.fn(), noop = vi.fn();
    const selected = { kind: 'research' as const, key: 'excavation_1' };
    const ui = render(<DeepClaimGoalPlanner snapshot={data} selected={selected} onPin={noop} onReview={noop} onClose={close} />);
    expect(screen.getByRole('button', { name: 'Back to goals' })).toBeInTheDocument();
    const updated = structuredClone(data);
    updated.business_catalog!.research = updated.business_catalog!.research.filter(item => item.key !== selected.key);
    ui.rerender(<DeepClaimGoalPlanner snapshot={updated} selected={selected} onPin={noop} onReview={noop} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to camp' }));
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('Deep Claim office and club request recovery', () => {
  it('keeps the reviewed office decision in place and submits it once until the request settles', async () => {
    const data = phaseFourSnapshot(), stores = vi.fn(), view = vi.fn(), confirmed = vi.fn();
    const contract = data.business_catalog!.contracts[0];
    data.resources = { ...contract.inputs };
    data.buildings.find(item => item.key === 'trading_post')!.level = contract.tier;
    let reject!: (reason: Error) => void;
    const fulfill = vi.fn(() => new Promise<DeepClaimSnapshot>((_resolve, fail) => { reject = fail; }));
    render(<Office snapshot={data} view="contracts" initialReview={{ kind: 'contract', key: contract.key }} onStores={stores} onView={view} onConfirmed={confirmed}
      actions={{ startResearch: vi.fn(), fulfillContract: fulfill, claimMilestone: vi.fn() }} />);
    const submit = screen.getByRole('button', { name: 'Deliver whole order' });
    fireEvent.click(submit); fireEvent.click(submit);
    expect(fulfill).toHaveBeenCalledExactlyOnceWith(contract.key, data.revision);
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    const stock = screen.getByRole('button', { name: 'View collected stock' });
    expect(stock).toBeDisabled(); fireEvent.click(stock);
    expect(screen.getByRole('button', { name: 'Research' })).toBeDisabled();
    expect(stores).not.toHaveBeenCalled(); expect(view).not.toHaveBeenCalled();
    await act(async () => reject(new Error('Connection interrupted. Retry the saved delivery.')));
    expect(screen.getByRole('alert')).toHaveTextContent('Connection interrupted');
    expect(stock).toBeEnabled(); expect(submit).toBeEnabled();
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('freezes the exact club contribution while awaiting the server and recovers after a failure', async () => {
    const data = phaseFourSnapshot(), confirmed = vi.fn();
    data.resources = { stone: 100, clay: 100, coal: 100 };
    let reject!: (reason: Error) => void;
    const contribute = vi.fn(() => new Promise<DeepClaimSnapshot>((_resolve, fail) => { reject = fail; }));
    render(<Club snapshot={data} onConfirmed={confirmed} actions={{ setSocialPreferences: vi.fn(), contributeProject: contribute, claimProject: vi.fn() }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review project Camp Supply' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Stone contribution' }), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review contribution' }));
    const submit = screen.getByRole('button', { name: 'Confirm contribution' });
    fireEvent.click(submit); fireEvent.click(submit);
    expect(contribute).toHaveBeenCalledExactlyOnceWith('camp_supply', { stone: 10 }, data.revision);
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Standings' })).toBeDisabled();
    await act(async () => reject(new Error('Contribution could not be confirmed. Retry the saved action.')));
    expect(screen.getByRole('alert')).toHaveTextContent('Contribution could not be confirmed');
    await waitFor(() => expect(submit).toBeEnabled());
    expect(screen.getByLabelText('Reviewed permanent contribution')).toHaveTextContent('10');
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('restores a new club avatar after an earlier URL failed', () => {
    const data = phaseFiveClubView();
    data.standings = [{ user_id: 'other', display_name: 'Ivo', avatar_url: '/missing-avatar.png', company_name: 'Vale Works', value: 100, rank: 1, is_you: false }];
    const ui = render(<Club snapshot={phaseFourSnapshot()} data={data} view="standings" />);
    const broken = ui.container.querySelector<HTMLImageElement>('.dcl-public-avatar img')!;
    expect(broken).not.toBeNull();
    fireEvent.error(broken);
    expect(ui.container.querySelector('.dcl-public-avatar img')).toBeNull();
    const updated = structuredClone(data);
    updated.standings[0].avatar_url = '/new-avatar.png';
    ui.rerender(<Club snapshot={phaseFourSnapshot()} data={updated} view="standings" />);
    expect(ui.container.querySelector('.dcl-public-avatar img')).toHaveAttribute('src', '/new-avatar.png');
    expect(ui.container.querySelector('.dcl-public-avatar img')).not.toHaveStyle({ display: 'none' });
  });
});
