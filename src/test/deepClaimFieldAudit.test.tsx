import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimDispatch } from '@/components/deepClaim/DeepClaimDispatch';
import { DeepClaimFieldLog, DeepClaimOperations } from '@/components/deepClaim/DeepClaimField';
import type { DeepClaimDiscovery, DeepClaimPoint, DeepClaimPreview, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseThreeSnapshot } from './fixtures/deepClaimPhase3';

const preview = vi.fn(), dispatch = vi.fn(), resolveDiscovery = vi.fn(), close = vi.fn(), locate = vi.fn(), confirmed = vi.fn(), select = vi.fn();
const noop = () => {};
function estimate(): DeepClaimPreview {
  return { allowed: true, reasons: [], company_revision: 3, server_now: '2026-11-01T12:00:00Z', wages: 6, energy_per_worker: 1, duration_seconds: 1200, estimated_yield: { min: 0, max: 0 }, cargo_capacity: 40, risk_level: 'low', accessible_depth: 49, expected_resources: [], route: [{ x: 48, y: 1 }], projected_completion_at: '2026-11-01T12:20:00Z', stages: [] };
}
function Planner({ snapshot }: { snapshot: DeepClaimSnapshot }) {
  return <DeepClaimDispatch snapshot={snapshot} initialTarget={{ x: 48, y: 1 }} initialMode="survey" readOnly={false} busy={false} onClose={close} preview={preview} dispatch={dispatch} />;
}
function mine(depth = 20) {
  const snapshot = phaseThreeSnapshot();
  snapshot.world!.tiles = Array.from({ length: depth }, (_, index) => ({ x: 48, y: index + 1, terrain: 'excavated' as const, material: null, remaining: 0, initial_amount: 0 }));
  return snapshot;
}
function Operations({ snapshot, point = { x: 48, y: 2 } }: { snapshot: DeepClaimSnapshot; point?: DeepClaimPoint | null }) {
  return <DeepClaimOperations snapshot={snapshot} point={point} onClose={close} onDispatch={noop} onLocate={locate} onFinds={noop} onReports={noop} />;
}
function discoveries() {
  const snapshot = phaseThreeSnapshot();
  const find: DeepClaimDiscovery = { id: 'find-a', job_id: 'job-a', x: 47, y: 3, kind: 'banded_geode', name: 'Banded Geode', quality: 'fine', detail: 'Pale quartz bands run through the stone.', sale_value: 42, salvage: { quartz: 2 }, status: 'pending', discovered_at: snapshot.server_now, resolved_at: null };
  snapshot.discoveries = [find, { ...find, id: 'find-b', name: 'Second Geode' }];
  snapshot.discovery_summary = { pending: 2, kept: 0, sold: 0, salvaged: 0 };
  return snapshot;
}
function FieldLog({ snapshot, selectedId }: { snapshot: DeepClaimSnapshot; selectedId?: string }) {
  const [selection, setSelection] = useState<string | null>('find-a');
  return <DeepClaimFieldLog snapshot={snapshot} view="finds" onView={noop} selectedFindId={selectedId ?? selection} onSelectFind={id => { select(id); setSelection(id); }} onLocate={locate} resolveDiscovery={resolveDiscovery} readOnly={false} busy={false} onConfirmed={confirmed} />;
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  preview.mockResolvedValue(estimate()); dispatch.mockResolvedValue(phaseThreeSnapshot()); resolveDiscovery.mockResolvedValue(discoveries());
});
afterEach(cleanup);

describe('Deep Claim dispatch crew recovery', () => {
  it('shows repeated backend blocking reasons once without changing distinct reasons or allowing dispatch', async () => {
    const blocked = { ...estimate(), allowed: false, reasons: ['Storage is full.', 'Crew slots are full.', 'Storage is full.', 'Storage is full!'] };
    const original = structuredClone(blocked);
    preview.mockResolvedValue(blocked);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<Planner snapshot={phaseThreeSnapshot()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
      const quote = await screen.findByRole('region', { name: 'Verified dispatch estimate' });
      expect(within(quote).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Storage is full.', 'Crew slots are full.', 'Storage is full!']);
      expect(screen.getAllByText('Storage is full.', { exact: true })).toHaveLength(1);
      expect(screen.queryByRole('button', { name: 'Dispatch crew' })).not.toBeInTheDocument();
      expect(dispatch).not.toHaveBeenCalled();
      expect(blocked).toEqual(original);
      expect(errors.mock.calls.some(call => call.some(value => String(value).includes('same key')))).toBe(false);
    } finally { errors.mockRestore(); }
  });

  it('preserves the chosen crew but blocks a longer shift when a worker needs more energy', async () => {
    const snapshot = phaseThreeSnapshot(); snapshot.workers[0].energy = 1;
    render(<Planner snapshot={snapshot} />);
    fireEvent.click(screen.getByRole('button', { name: /Thorough.*180 min/ }));
    expect(screen.getByRole('button', { name: 'Review dispatch' })).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Crew availability' })).toHaveTextContent('Worker a needs 3 energy for this shift.');
    fireEvent.click(screen.getByRole('button', { name: 'Change crew' }));
    expect(screen.getByRole('checkbox', { name: 'Send Worker a' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Send Worker a' })).toBeEnabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send Worker a' }));
    expect(screen.getByRole('checkbox', { name: 'Send Worker a' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    await screen.findByRole('button', { name: 'Dispatch crew' });
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({ worker_ids: ['worker-b', 'worker-c'], duration_minutes: 180 }));
  });

  it('checks fresh employee assignments before allowing the selected crew to be reviewed', async () => {
    const snapshot = phaseThreeSnapshot(), view = render(<Planner snapshot={snapshot} />);
    const updated = { ...snapshot, revision: 4, workers: snapshot.workers.map((worker, index) => index ? worker : { ...worker, assigned_job_id: 'another-shift' }) };
    view.rerender(<Planner snapshot={updated} />);
    expect(screen.getByRole('button', { name: 'Review dispatch' })).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Crew availability' })).toHaveTextContent('Worker a is already on a shift.');
    fireEvent.click(screen.getByRole('button', { name: 'Change crew' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send Worker a' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    await waitFor(() => expect(preview).toHaveBeenCalledWith(expect.objectContaining({ worker_ids: ['worker-b', 'worker-c'] })));
  });

  it('offers recovery when a refreshed employee list no longer includes a selected employee', async () => {
    const snapshot = phaseThreeSnapshot(), view = render(<Planner snapshot={snapshot} />);
    view.rerender(<Planner snapshot={{ ...snapshot, revision: 4, workers: snapshot.workers.slice(1) }} />);
    expect(screen.getByRole('button', { name: 'Review dispatch' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove unavailable crew' }));
    expect(screen.getByText('2/3 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    await waitFor(() => expect(preview).toHaveBeenCalledWith(expect.objectContaining({ worker_ids: ['worker-b', 'worker-c'] })));
  });

  it('keeps preview and dispatch single-flight without relying on a parent busy update', async () => {
    const quote = deferred<DeepClaimPreview>(), sent = deferred<DeepClaimSnapshot>();
    preview.mockReturnValue(quote.promise); dispatch.mockReturnValue(sent.promise);
    render(<Planner snapshot={phaseThreeSnapshot()} />);
    const review = screen.getByRole('button', { name: 'Review dispatch' });
    fireEvent.click(review); fireEvent.click(review);
    expect(preview).toHaveBeenCalledOnce(); expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    await act(async () => quote.resolve(estimate()));
    const confirm = screen.getByRole('button', { name: 'Dispatch crew' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(dispatch).toHaveBeenCalledOnce(); expect(close).not.toHaveBeenCalled();
    await act(async () => sent.resolve(phaseThreeSnapshot(4)));
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not close a newer screen when an unmounted dispatch request finishes', async () => {
    const sent = deferred<DeepClaimSnapshot>(); dispatch.mockReturnValue(sent.promise);
    const view = render(<Planner snapshot={phaseThreeSnapshot()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dispatch crew' }));
    view.unmount(); await act(async () => sent.resolve(phaseThreeSnapshot(4)));
    expect(close).not.toHaveBeenCalled();
  });
});

describe('Deep Claim mine lift recovery', () => {
  it('never retains an invisible search when the refreshed list has only a few stops', () => {
    const view = render(<Operations snapshot={mine()} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find depth' }), { target: { value: '19' } });
    view.rerender(<Operations snapshot={mine(4)} />);
    expect(screen.queryByRole('searchbox', { name: 'Find depth' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Known mine depth' })).getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByText('No matching depth')).not.toBeInTheDocument();
  });

  it('retains manual lift browsing on a refresh and follows a newly selected map site', () => {
    const snapshot = mine(), view = render(<Operations snapshot={snapshot} />);
    fireEvent.click(screen.getByRole('button', { name: '5 metres' }));
    view.rerender(<Operations snapshot={{ ...snapshot, revision: 4, world: { ...snapshot.world! } }} />);
    expect(screen.getByRole('button', { name: '5 metres' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find depth' }), { target: { value: '1' } });
    view.rerender(<Operations snapshot={snapshot} point={{ x: 48, y: 17 }} />);
    expect(screen.getByRole('searchbox', { name: 'Find depth' })).toHaveValue('');
    expect(screen.getByRole('button', { name: '17 metres' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Locate known depth' }));
    expect(locate).toHaveBeenCalledWith({ x: 48, y: 17 });
  });
});

describe('Deep Claim discovery confirmation safety', () => {
  it('holds the decision and navigation steady until its request finishes', async () => {
    const snapshot = discoveries(), pending = deferred<DeepClaimSnapshot>();
    resolveDiscovery.mockReturnValue(pending.promise); render(<FieldLog snapshot={snapshot} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sell specimen/ }));
    const confirm = screen.getByRole('button', { name: 'Confirm sale' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(resolveDiscovery).toHaveBeenCalledOnce();
    expect(resolveDiscovery).toHaveBeenCalledWith('find-a', 'sell', 3);
    expect(screen.getByRole('button', { name: 'Locate find site' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Keep in cabinet/ })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(select).not.toHaveBeenCalled(); expect(confirmed).not.toHaveBeenCalled();
    await act(async () => pending.resolve(snapshot));
    expect(confirmed).toHaveBeenCalledOnce(); expect(select).toHaveBeenCalledWith(null);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('restores a retryable decision after a failed request without confirming a reward', async () => {
    const pending = deferred<DeepClaimSnapshot>(); resolveDiscovery.mockReturnValue(pending.promise);
    render(<FieldLog snapshot={discoveries()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Keep in cabinet/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm keep' }));
    await act(async () => pending.reject(new Error('Reconnect to confirm this decision.')));
    expect(screen.getByRole('alert')).toHaveTextContent('Reconnect to confirm this decision.');
    expect(screen.getByRole('button', { name: 'Locate find site' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Confirm keep' })).toBeEnabled();
    expect(confirmed).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled();
  });

  it('does not clear a different find selected while an earlier decision is resolving', async () => {
    const snapshot = discoveries(), pending = deferred<DeepClaimSnapshot>(); resolveDiscovery.mockReturnValue(pending.promise);
    const view = render(<FieldLog snapshot={snapshot} selectedId="find-a" />);
    fireEvent.click(screen.getByRole('button', { name: /^Keep in cabinet/ })); fireEvent.click(screen.getByRole('button', { name: 'Confirm keep' }));
    view.rerender(<FieldLog snapshot={snapshot} selectedId="find-b" />);
    await act(async () => pending.resolve(snapshot));
    expect(screen.getByRole('dialog', { name: 'Second Geode' })).toBeInTheDocument();
    expect(select).not.toHaveBeenCalled(); expect(confirmed).toHaveBeenCalledOnce();
  });

  it('does not send stale confirmation callbacks after the field log unmounts', async () => {
    const pending = deferred<DeepClaimSnapshot>(); resolveDiscovery.mockReturnValue(pending.promise);
    const view = render(<FieldLog snapshot={discoveries()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Keep in cabinet/ })); fireEvent.click(screen.getByRole('button', { name: 'Confirm keep' }));
    view.unmount(); await act(async () => pending.resolve(discoveries()));
    expect(select).not.toHaveBeenCalled(); expect(confirmed).not.toHaveBeenCalled();
  });
});
