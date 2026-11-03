import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimBusiness, type ClaimBusinessView } from '@/components/deepClaim/DeepClaimBusiness';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';

afterEach(cleanup);
const start = Date.parse('2026-11-01T12:00:00Z');
function researchReport() {
  const data = phaseFourSnapshot();
  data.business!.research = [{ key: 'excavation_1', status: 'active', started_at: new Date(start).toISOString(), completes_at: new Date(start + 600_000).toISOString(), completed_at: null }];
  return data;
}
function completedOrder(key: string): NonNullable<DeepClaimSnapshot['business']>['research'][number] {
  return { key, status: 'completed', started_at: new Date(start).toISOString(), completes_at: new Date(start + 600_000).toISOString(), completed_at: new Date(start + 600_000).toISOString() };
}
function Office({ data, now, view = 'company', refresh = vi.fn(), startResearch = vi.fn(), initialReview }: { data: DeepClaimSnapshot; now: number; view?: ClaimBusinessView; refresh?: () => void; startResearch?: () => Promise<DeepClaimSnapshot>; initialReview?: { kind: 'research' | 'contract' | 'milestone'; key: string } }) {
  const noop = vi.fn();
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimBusiness snapshot={data} initialReview={initialReview} now={now} view={view} onView={noop} onClose={noop} onBuild={noop} onHire={noop} onStores={noop} onConfirmed={noop} onRefresh={refresh} busy={false} readOnly={false} actions={{ startResearch, fulfillContract: noop, claimMilestone: noop }} /></MemoryRouter>;
}

describe('Deep Claim visual Office progress', () => {
  it('resumes the persisted research schedule instead of restarting an animated loading estimate', () => {
    const data = researchReport(), original = structuredClone(data);
    const ui = render(<Office data={data} now={start + 150_000} />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '25');
    ui.rerender(<Office data={data} now={start + 450_000} />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '75');
    expect(data).toEqual(original);
    ui.unmount();
    render(<Office data={data} now={start + 450_000} />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '75');
  });

  it('keeps an elapsed project unconfirmed until the server supplies completion', () => {
    const data = researchReport(), refresh = vi.fn(), startResearch = vi.fn();
    const ui = render(<Office data={data} now={start + 900_000} refresh={refresh} startResearch={startResearch} />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('Awaiting completion report')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check research completion' }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(startResearch).not.toHaveBeenCalled();
    expect(data.business!.research[0].status).toBe('active');
    const completed = structuredClone(data);
    completed.business!.research[0] = { ...completed.business!.research[0], status: 'completed', completed_at: new Date(start + 600_000).toISOString() };
    completed.business!.stats.completed_research = 1;
    ui.rerender(<Office data={completed} now={start + 900_000} refresh={refresh} />);
    expect(screen.queryByRole('progressbar', { name: 'Research elapsed time' })).not.toBeInTheDocument();
  });

  it('bounds future and invalid research schedules without reporting false completion', () => {
    const data = researchReport();
    const ui = render(<Office data={data} now={start - 1000} />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '0');
    const invalid = structuredClone(data);
    invalid.business!.research[0].completes_at = 'invalid';
    ui.rerender(<Office data={invalid} now={start} />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('Refresh to check the research schedule')).toBeInTheDocument();
    expect(screen.queryByText('Awaiting completion report')).not.toBeInTheDocument();
  });

  it('moves a branch from partial progress to maxed using confirmed research rather than cached totals', () => {
    const data = phaseFourSnapshot();
    data.business!.stats.completed_research = 999;
    data.business!.research = [completedOrder('excavation_1')];
    const total = data.business_catalog!.research.length;
    const ui = render(<Office data={data} now={start + 900_000} view="research" />);
    expect(screen.getByRole('progressbar', { name: 'Company research completed' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('progressbar', { name: 'Company research completed' })).toHaveAttribute('aria-valuetext', `1 of ${total} complete`);
    expect(screen.getByRole('button', { name: 'Excavation: 1 of 2 complete' })).not.toHaveAttribute('data-complete', 'true');
    const completed = structuredClone(data);
    completed.business!.research.push(completedOrder('excavation_2'));
    ui.rerender(<Office data={completed} now={start + 900_000} view="research" />);
    expect(screen.getByRole('button', { name: 'Excavation: 2 of 2 complete · Maxed' })).toHaveAttribute('data-complete', 'true');
    expect(screen.getByRole('progressbar', { name: 'Company research completed' })).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByRole('progressbar', { name: 'Company research completed' })).toHaveAttribute('aria-valuetext', `2 of ${total} complete`);
  });

  it('shows maximum research only when every published catalog entry is confirmed complete', () => {
    const data = phaseFourSnapshot();
    data.business!.research = data.business_catalog!.research.map(item => completedOrder(item.key));
    const total = data.business_catalog!.research.length;
    render(<Office data={data} now={start + 900_000} view="research" />);
    const progress = screen.getByRole('progressbar', { name: 'Company research completed' });
    expect(progress).toHaveAttribute('aria-valuenow', String(total));
    expect(progress).toHaveAttribute('aria-valuemax', String(total));
    expect(progress).toHaveAttribute('aria-valuetext', `${total} of ${total} complete`);
    const heading = screen.getByRole('heading', { name: 'Research' }).closest<HTMLElement>('.dcl-section-heading')!;
    expect(within(heading).getByText('Maxed', { exact: true })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Research branches' })).getAllByRole('button', { name: / · Maxed$/ })).toHaveLength(7);
  });

  it('uses the loaded catalog for total and branch maxima instead of fixed research counts', () => {
    const data = phaseFourSnapshot();
    data.business_catalog!.research = data.business_catalog!.research.filter(item => item.branch === 'excavation' || item.key === 'geology_1');
    data.business!.research = data.business_catalog!.research.map(item => completedOrder(item.key));
    render(<Office data={data} now={start + 900_000} view="research" />);
    expect(screen.getByRole('progressbar', { name: 'Company research completed' })).toHaveAttribute('aria-valuemax', '3');
    expect(screen.getByRole('progressbar', { name: 'Company research completed' })).toHaveAttribute('aria-valuetext', '3 of 3 complete');
    expect(screen.getByRole('button', { name: 'Geology: 1 of 1 complete · Maxed' })).toHaveAttribute('data-complete', 'true');
    expect(screen.getByRole('button', { name: 'Safety: 0 of 0 complete' })).not.toHaveAttribute('data-complete', 'true');
  });

  it('does not inflate completion for duplicate receipts, unknown keys or an unfinished project', () => {
    const data = researchReport();
    data.business!.research[0].key = 'geology_1';
    data.business!.research.push(completedOrder('excavation_1'), completedOrder('excavation_1'), completedOrder('unknown_research'));
    data.business!.stats.completed_research = 4;
    render(<Office data={data} now={start + 900_000} view="research" />);
    expect(screen.getByRole('progressbar', { name: 'Company research completed' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('button', { name: 'Excavation: 1 of 2 complete' })).not.toHaveAttribute('data-complete', 'true');
    expect(screen.getByRole('button', { name: 'Geology: 0 of 2 complete' })).not.toHaveAttribute('data-complete', 'true');
  });

  it('keeps elapsed but active research out of completion and maximum states', () => {
    const data = researchReport();
    render(<Office data={data} now={start + 900_000} view="research" />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('Awaiting completion report')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Company research completed' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('button', { name: 'Excavation: 0 of 2 complete' })).not.toHaveAttribute('data-complete', 'true');
    expect(screen.queryByText('Maxed', { exact: true })).not.toBeInTheDocument();
  });

  it('lets completed research be inspected and left without offering or repeating a paid start', () => {
    const data = phaseFourSnapshot(), startResearch = vi.fn();
    data.business!.research = [completedOrder('excavation_1')];
    const original = structuredClone(data);
    render(<Office data={data} now={start + 900_000} view="research" startResearch={startResearch} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review Cutting Methods' }));
    expect(screen.getByRole('heading', { name: 'Cutting Methods' })).toBeInTheDocument();
    expect(screen.getByText('Complete', { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start research' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('group', { name: 'Research branches' })).toBeInTheDocument();
    expect(startResearch).not.toHaveBeenCalled();
    expect(data).toEqual(original);
  });

  it('shows actual collected contract materials without treating them as an already delivered order', () => {
    const data = phaseFourSnapshot(); data.resources = { stone: 19 };
    render(<Office data={data} now={start} view="contracts" />);
    const progress = screen.getByRole('progressbar', { name: 'Yard Foundations materials assembled' });
    expect(progress).toHaveAttribute('aria-valuenow', '19');
    expect(progress).toHaveAttribute('aria-valuemax', '20');
    fireEvent.click(screen.getByRole('button', { name: 'Review order Yard Foundations' }));
    const dialog = screen.getByRole('dialog', { name: 'Company Office' });
    expect(within(dialog).getByRole('button', { name: 'Deliver whole order' })).toBeDisabled();
    expect(within(dialog).getByRole('progressbar', { name: 'Stone collected for requirement' })).toHaveAttribute('aria-valuenow', '19');
    expect(data.business!.contracts[0].status).toBe('offered');
  });
});


describe('Company goal review links', () => {
  it.each([
    ['research', 'excavation_1', 'research', 'Reinforced Picks', 'Start research'],
    ['contract', 'yard_foundations', 'contracts', 'Yard Foundations', 'Deliver whole order'],
    ['milestone', 'first_shift', 'records', 'First Shift', 'Claim company credits'],
  ] as const)('opens the exact %s review without submitting an economic action', (kind, key, view, name, action) => {
    const data = phaseFourSnapshot(), startResearch = vi.fn();
    const actualName = kind === 'research' ? data.business_catalog!.research.find(item => item.key === key)!.name : name;
    render(<Office data={data} now={start} view={view} initialReview={{ kind, key }} startResearch={startResearch} />);
    expect(screen.getByRole('heading', { name: actualName })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: action })).toBeInTheDocument();
    expect(startResearch).not.toHaveBeenCalled();
  });
  it('ignores an unknown direct-review key instead of creating an actionable entry', () => {
    render(<Office data={phaseFourSnapshot()} now={start} view="contracts" initialReview={{ kind: 'contract', key: 'made_up_reward' }} />);
    expect(screen.queryByRole('button', { name: 'Deliver whole order' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to camp' })).toBeInTheDocument();
  });
});
