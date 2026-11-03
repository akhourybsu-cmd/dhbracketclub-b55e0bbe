import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimDispatch } from '@/components/deepClaim/DeepClaimDispatch';
import type { DeepClaimPreview, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseThreeSnapshot } from './fixtures/deepClaimPhase3';

function starterMine(): DeepClaimSnapshot {
  const snapshot = phaseThreeSnapshot();
  snapshot.world!.tiles.push(
    { x: 47, y: 1, terrain: 'stone', material: 'coal', remaining: 10, initial_amount: 10 },
    { x: 49, y: 1, terrain: 'stone', material: 'stone', remaining: 12, initial_amount: 12 },
  );
  return snapshot;
}
function estimate(revision = 3, tutorial = false): DeepClaimPreview {
  return {
    allowed: true, reasons: [], company_revision: revision, server_now: '2026-11-01T12:00:00Z',
    wages: 6, energy_per_worker: 1, duration_seconds: tutorial ? 30 : 1200,
    estimated_yield: { min: 1, max: 10 }, cargo_capacity: 40, risk_level: 'low',
    accessible_depth: 49, expected_resources: ['coal'], route: [{ x: 48, y: 1 }, { x: 47, y: 1 }],
    projected_completion_at: '2026-11-01T12:20:00Z', stages: [],
  };
}
function Planner({ snapshot, preview, dispatch = vi.fn() }: {
  snapshot: DeepClaimSnapshot; preview: ReturnType<typeof vi.fn>; dispatch?: ReturnType<typeof vi.fn>;
}) {
  return <DeepClaimDispatch snapshot={snapshot} initialTarget={{ x: 47, y: 1 }} initialMode="extract" readOnly={false} busy={false} onClose={vi.fn()} preview={preview} dispatch={dispatch} />;
}
afterEach(cleanup);

describe('Deep Claim starter dispatch eligibility', () => {
  it.each([{ x: 47, remaining: 9 }, { x: 49, remaining: 11 }])('opens an ordinary Quick shift after starter seam $x was partly mined', async ({ x, remaining }) => {
    const snapshot = starterMine(), preview = vi.fn().mockResolvedValue(estimate()), dispatch = vi.fn();
    snapshot.world!.tiles.find(tile => tile.x === x && tile.y === 1)!.remaining = remaining;
    render(<Planner snapshot={snapshot} preview={preview} dispatch={dispatch} />);
    expect(snapshot.company!.tutorial_used).toBe(false);
    expect(screen.queryByRole('checkbox', { name: /First shift/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Shift duration' })).getByRole('button', { name: /^Quick/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    await screen.findByRole('button', { name: 'Dispatch crew' });
    expect(preview).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ tutorial: false, duration_minutes: 20, target_x: 47, target_y: 1 }));
    expect(screen.getByText(/20 min preset/)).toBeInTheDocument();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('keeps an eligible first shift selected and still requires authoritative review', async () => {
    const preview = vi.fn().mockResolvedValue(estimate(3, true)), dispatch = vi.fn();
    render(<Planner snapshot={starterMine()} preview={preview} dispatch={dispatch} />);
    expect(screen.getByRole('checkbox', { name: /First shift/ })).toBeChecked();
    expect(preview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    await screen.findByRole('button', { name: 'Dispatch crew' });
    expect(preview).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ tutorial: true, duration_minutes: 20 }));
    expect(screen.getByText(/Introduction/)).toBeInTheDocument();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('clears an induction quote when a refreshed company has used its first shift', async () => {
    const snapshot = starterMine(), preview = vi.fn().mockResolvedValueOnce(estimate(3, true)).mockResolvedValueOnce(estimate(4)), dispatch = vi.fn().mockResolvedValue(snapshot);
    const view = render(<Planner snapshot={snapshot} preview={preview} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    await screen.findByRole('button', { name: 'Dispatch crew' });
    view.rerender(<Planner snapshot={{ ...snapshot, revision: 4, company: { ...snapshot.company!, tutorial_used: true } }} preview={preview} dispatch={dispatch} />);
    expect(screen.queryByRole('region', { name: 'Verified dispatch estimate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /First shift/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Shift duration' })).getByRole('button', { name: /^Quick/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Dispatch crew' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dispatch crew' }));
    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ tutorial: false, duration_minutes: 20 }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ tutorial: false, duration_minutes: 20 }), 4));
  });
});
