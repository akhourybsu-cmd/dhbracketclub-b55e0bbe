import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimGoalDock, DeepClaimGoalPlanner } from '@/components/deepClaim/DeepClaimCompanyGoals';
import { evaluateCompanyGoal, type CompanyGoalRef } from '@/lib/deepClaim/companyGoals';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';

afterEach(cleanup);
const warehouse: CompanyGoalRef = { kind: 'building', key: 'warehouse', level: 2 };
const course: CompanyGoalRef = { kind: 'research', key: 'excavation_1' };
function planner(data = phaseFourSnapshot(), selected: CompanyGoalRef | null = null) {
  const onPin = vi.fn(), onReview = vi.fn(), onClose = vi.fn();
  const rendered = render(<DeepClaimGoalPlanner snapshot={data} selected={selected} onPin={onPin} onReview={onReview} onClose={onClose} />);
  return { ...rendered, onPin, onReview, onClose };
}

describe('Deep Claim company goal controls', () => {
  it('offers a real project picker without a fabricated goal or reward', () => {
    const onOpen = vi.fn(), onReview = vi.fn();
    render(<DeepClaimGoalDock goal={null} onOpen={onOpen} onReview={onReview} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review pinned goal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open shift report' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose company goal' }));
    expect(onOpen).toHaveBeenCalledOnce(); expect(onReview).not.toHaveBeenCalled();
  });

  it('keeps goal navigation and an optional factual shift report as separate actions', () => {
    const onOpen = vi.fn(), onReview = vi.fn(), onReport = vi.fn();
    const data = phaseFourSnapshot(), original = structuredClone(data);
    const goal = evaluateCompanyGoal(data, warehouse)!;
    render(<DeepClaimGoalDock goal={goal} onOpen={onOpen} onReview={onReview} onReport={onReport} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1 of 1 requirements ready');
    fireEvent.click(screen.getByRole('button', { name: 'Open shift report' }));
    expect(onReport).toHaveBeenCalledOnce(); expect(onOpen).not.toHaveBeenCalled(); expect(onReview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Review pinned goal' }));
    expect(onReview).toHaveBeenCalledOnce(); expect(onOpen).not.toHaveBeenCalled(); expect(data).toEqual(original);
  });

  it('shows only four source-backed choices at a time and does not pin merely by inspecting one', () => {
    const data = phaseFourSnapshot(), original = structuredClone(data), ui = planner(data);
    const choices = () => screen.getAllByRole('button', { name: /^Plan / });
    expect(choices()).toHaveLength(4); expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous goal page' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Plan Warehouse/ }));
    expect(screen.getByRole('heading', { name: 'Warehouse · Lv 2' })).toHaveFocus();
    expect(ui.onPin).not.toHaveBeenCalled(); expect(ui.onReview).not.toHaveBeenCalled();
    expect(screen.getByRole('list', { name: 'Goal requirements' })).toHaveTextContent('Credits · includes 2 cr reserve');
    fireEvent.click(screen.getByRole('button', { name: 'Pin goal' }));
    expect(ui.onPin).toHaveBeenCalledExactlyOnceWith(warehouse); expect(ui.onReview).not.toHaveBeenCalled(); expect(data).toEqual(original);
  });

  it('routes an exact inspected reference to review without pinning or charging it', () => {
    const data = phaseFourSnapshot(), original = structuredClone(data), ui = planner(data);
    fireEvent.click(screen.getByRole('button', { name: 'Research' }));
    fireEvent.click(screen.getByRole('button', { name: /^Plan Cutting Methods$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Review goal' }));
    expect(ui.onReview).toHaveBeenCalledExactlyOnceWith(course); expect(ui.onPin).not.toHaveBeenCalled(); expect(data).toEqual(original);
  });

  it('keeps paged categories bounded and restores the inspected card’s keyboard focus', () => {
    planner();
    fireEvent.click(screen.getByRole('button', { name: 'Next goal page' }));
    const cards = screen.getAllByRole('button', { name: /^Plan / }), target = cards[1];
    expect(cards).toHaveLength(4); const name = target.getAttribute('aria-label')!;
    fireEvent.click(target); fireEvent.click(screen.getByRole('button', { name: 'Back to goals' }));
    expect(screen.getByRole('button', { name })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Contracts' }));
    expect(screen.getByRole('button', { name: 'Previous goal page' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /^Plan / })).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Plan Yard Foundations' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Goal categories' })).toHaveTextContent('Contracts12');
  });

  it('reevaluates actual requirements from refreshed company state while preserving the plan', () => {
    const data = phaseFourSnapshot(), required = data.buildings.find(item => item.key === 'warehouse')!.upgrade_cost! + 2;
    data.company!.cash = required - 1;
    const onPin = vi.fn(), onReview = vi.fn(), onClose = vi.fn();
    const ui = render(<DeepClaimGoalPlanner snapshot={data} selected={warehouse} onPin={onPin} onReview={onReview} onClose={onClose} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pinned' })).toBeDisabled();
    const updated = { ...data, company: { ...data.company!, cash: required } };
    ui.rerender(<DeepClaimGoalPlanner snapshot={updated} selected={warehouse} onPin={onPin} onReview={onReview} onClose={onClose} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1'); expect(screen.getByText('Ready to review')).toBeInTheDocument();
    expect(onReview).not.toHaveBeenCalled(); expect(onPin).not.toHaveBeenCalled();
  });

  it('never marks elapsed research complete before the server confirms it', () => {
    const data = phaseFourSnapshot(); data.business!.research = [{ key: 'excavation_1', status: 'active', started_at: '2026-11-01T10:00:00Z', completes_at: '2026-11-01T11:00:00Z', completed_at: null }];
    planner(data, course);
    expect(screen.getByText('Researching')).toBeInTheDocument();
    expect(screen.getByText('Awaiting completion report')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.queryByText('Complete', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Goal requirements' })).not.toHaveTextContent('Credits');
  });

  it('preserves an achieved pinned building target without asking the player to pay for it again', () => {
    const data = phaseFourSnapshot(); data.company!.cash = 0; const owned = data.buildings.find(item => item.key === 'warehouse')!; owned.level = 2; owned.upgrade_cost = 1000;
    const ui = planner(data, warehouse);
    expect(screen.getAllByText('Complete', { exact: true })).toHaveLength(2);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('button', { name: 'Pinned' })).toBeDisabled();
    expect(screen.getByRole('list', { name: 'Goal requirements' })).not.toHaveTextContent('Credits');
    fireEvent.click(screen.getByRole('button', { name: 'Review goal' })); expect(ui.onReview).toHaveBeenCalledExactlyOnceWith(warehouse);
  });

  it('shows a milestone’s recorded progress and existing award without granting it', () => {
    const data = phaseFourSnapshot(); data.business!.milestones.find(item => item.key === 'first_batch')!.progress = 1;
    const ui = planner(data, { kind: 'milestone', key: 'first_batch' });
    expect(screen.getByRole('list', { name: 'Goal requirements' })).toHaveTextContent('Production batches collected');
    expect(screen.getByText('20 cr')).toBeInTheDocument(); expect(screen.getByText('Milestone award')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Claim/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review goal' }));
    expect(ui.onReview).toHaveBeenCalledExactlyOnceWith({ kind: 'milestone', key: 'first_batch' }); expect(ui.onPin).not.toHaveBeenCalled();
  });

  it('exposes the current pin as a selected card after returning to the planner', () => {
    planner(phaseFourSnapshot(), warehouse); fireEvent.click(screen.getByRole('button', { name: 'Back to goals' }));
    const categories = screen.getByRole('group', { name: 'Goal categories' });
    expect(within(categories).getByRole('button', { name: 'Buildings' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Plan Warehouse/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: /^Plan /, pressed: true })).toHaveLength(1);
  });
});
