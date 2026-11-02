import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimIndustry } from '@/components/deepClaim/DeepClaimIndustry';
import type { DeepClaimProductionJob, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseTwoSnapshot } from './fixtures/deepClaimPhase2';

afterEach(cleanup);

const now = Date.parse('2026-11-01T12:00:00Z');
function workOrder(overrides: Partial<DeepClaimProductionJob> = {}): DeepClaimProductionJob {
  return { id: 'work-order', recipe_key: 'smelt_copper', recipe_version: 1, batches: 1, station: 'smeltery', status: 'active',
    started_at: '2026-11-01T11:59:00Z', completes_at: '2026-11-01T12:01:00Z', duration_seconds: 120,
    cash_cost: 5, inputs: { coal: 2, copper_ore: 10 }, outputs: { copper_bar: 2 }, equipment_outputs: [], ...overrides };
}
function workshop(snapshot: DeepClaimSnapshot, time: number, refresh = vi.fn(), collect = vi.fn().mockResolvedValue(undefined), readOnly = false) {
  return <DeepClaimIndustry snapshot={snapshot} view="workshop" onView={vi.fn()} station="smeltery" onStation={vi.fn()} busy={false} readOnly={readOnly}
    now={time} onRefresh={refresh} onBuild={vi.fn()} onSell={vi.fn()} onOpenHaul={vi.fn()} startProduction={vi.fn()} collectProduction={collect} onConfirmed={vi.fn()} />;
}

describe('Deep Claim visual work-order progress', () => {
  it('resumes from the disclosed work-order clock and keeps elapsed output uncollectible until confirmed', () => {
    const snapshot = phaseTwoSnapshot(), refresh = vi.fn(), collect = vi.fn();
    snapshot.production_jobs = [workOrder()];
    const view = render(workshop(snapshot, now, refresh, collect));
    expect(screen.getByRole('progressbar', { name: 'Smelt Copper elapsed time' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('50%')).toBeInTheDocument();
    view.rerender(workshop(snapshot, now + 120_000, refresh, collect));
    expect(screen.getByRole('progressbar', { name: 'Smelt Copper elapsed time' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('Checking completion')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collect Smelt Copper' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check production' }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(collect).not.toHaveBeenCalled();
  });

  it('does not display progress for a station job that has not started', () => {
    const snapshot = phaseTwoSnapshot();
    snapshot.production_jobs = [workOrder({ started_at: '2026-11-01T12:01:00Z', completes_at: '2026-11-01T12:03:00Z' })];
    render(workshop(snapshot, now));
    expect(screen.getByRole('progressbar', { name: 'Smelt Copper elapsed time' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByText('Waiting for this station')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collect Smelt Copper' })).not.toBeInTheDocument();
  });

  it('shows authoritative ready output as complete while preserving the read-only collection guard', () => {
    const snapshot = phaseTwoSnapshot(), collect = vi.fn().mockResolvedValue(undefined);
    snapshot.production_jobs = [workOrder({ status: 'ready' })];
    const view = render(workshop(snapshot, now, vi.fn(), collect, true));
    expect(screen.getByRole('progressbar', { name: 'Smelt Copper elapsed time' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('button', { name: 'Collect Smelt Copper' })).toBeDisabled();
    view.rerender(workshop(snapshot, now, vi.fn(), collect));
    fireEvent.click(screen.getByRole('button', { name: 'Collect Smelt Copper' }));
    expect(collect).toHaveBeenCalledWith(snapshot.production_jobs[0]);
  });
});
