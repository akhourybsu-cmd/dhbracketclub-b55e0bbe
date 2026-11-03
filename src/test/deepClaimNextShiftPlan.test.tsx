import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimDispatch } from '@/components/deepClaim/DeepClaimDispatch';
import { claimTargets } from '@/components/deepClaim/display';
import { deriveNextShiftPlan } from '@/lib/deepClaim/nextShiftPlan';
import type { DeepClaimExpedition, DeepClaimPreview, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseThreeSnapshot } from './fixtures/deepClaimPhase3';

function returned(overrides: Partial<DeepClaimExpedition> = {}): DeepClaimExpedition {
  return { id: 'shift-1', mode: 'extract', status: 'collected', stage: 'collected', target: { x: 47, y: 1 }, worker_ids: ['worker-a', 'worker-b'], path: [{ x: 48, y: 1 }, { x: 47, y: 1 }],
    started_at: '2026-11-01T10:00:00Z', completes_at: '2026-11-01T11:00:00Z', duration_minutes: 60, duration_seconds: 3600, tutorial: false, wages: 8, energy_per_worker: 2, config_version: 3, stages: [], cargo: {}, ...overrides };
}
function mine(source = returned()): DeepClaimSnapshot {
  const data = phaseThreeSnapshot();
  data.company!.tutorial_used = true;
  data.world!.tiles.push({ x: 47, y: 1, terrain: 'stone', material: 'coal', remaining: 6, initial_amount: 10 });
  data.expeditions = [source];
  return data;
}
function allowed(): DeepClaimPreview {
  return { allowed: true, reasons: [], company_revision: 3, server_now: '2026-11-01T12:00:00Z', wages: 8, energy_per_worker: 2, duration_seconds: 3600, estimated_yield: { min: 3, max: 6 }, cargo_capacity: 40, risk_level: 'low', accessible_depth: 49, expected_resources: ['coal'], route: [{ x: 48, y: 1 }, { x: 47, y: 1 }], projected_completion_at: '2026-11-01T13:00:00Z', stages: [] };
}
afterEach(cleanup);

describe('Deep Claim next-shift planning', () => {
  it('reuses a still-workable destination, ordinary duration and available previous crew without mutation', () => {
    const data = mine(), before = structuredClone(data), previous = data.expeditions[0];
    const result = deriveNextShiftPlan(data, previous);
    expect(result).toEqual({ plan: { sourceExpeditionId: 'shift-1', mode: 'extract', target: { x: 47, y: 1 }, workerIds: ['worker-a', 'worker-b'], durationMinutes: 60, tutorial: false, ordinary: true, targetChanged: false, crewChanged: false }, reasons: [] });
    expect(data).toEqual(before); expect(result.plan!.target).not.toBe(previous.target); expect(result.plan!.workerIds).not.toBe(previous.worker_ids);
  });
  it('uses the latest owned record rather than fields copied from a stale or foreign-looking job', () => {
    const data = mine(), stale = { ...returned(), target: { x: 30, y: 800 }, worker_ids: ['other-player-worker'], duration_minutes: 180 as const };
    expect(deriveNextShiftPlan(data, stale).plan).toMatchObject({ target: { x: 47, y: 1 }, workerIds: ['worker-a', 'worker-b'], durationMinutes: 60 });
    expect(deriveNextShiftPlan(data, { ...stale, id: 'not-an-owned-job' }).plan).toBeNull();
  });
  it('turns the tutorial return into an ordinary quick run without another induction grant', () => {
    const source = returned({ tutorial: true, duration_seconds: 30, duration_minutes: 20 });
    const result = deriveNextShiftPlan(mine(source), source);
    expect(result.plan).toMatchObject({ durationMinutes: 20, tutorial: false, ordinary: true });
  });
  it('keeps only previous workers with enough energy for the selected duration', () => {
    const source = returned({ duration_minutes: 180, worker_ids: ['worker-a', 'worker-b', 'worker-c'] }), data = mine(source);
    data.workers[0].energy = 2; data.workers[1].assigned_job_id = 'another-shift'; data.workers[2].energy = 3;
    expect(deriveNextShiftPlan(data, source).plan).toMatchObject({ workerIds: ['worker-c'], durationMinutes: 180, crewChanged: true });
  });
  it('offers an available replacement only when none of the original crew can return', () => {
    const data = mine(); data.workers[0].energy = 0; data.workers[1].assigned_job_id = 'another-shift';
    expect(deriveNextShiftPlan(data, data.expeditions[0]).plan).toMatchObject({ workerIds: ['worker-c'], crewChanged: true });
    data.workers[2].energy = 1;
    expect(deriveNextShiftPlan(data, data.expeditions[0])).toMatchObject({ plan: null, reasons: ['No rested crew is available for this shift.'] });
  });
  it('moves from a depleted seam to another actually known deposit of the same material', () => {
    const data = mine(); data.world!.tiles.find(tile => tile.x === 47 && tile.y === 1)!.remaining = 0;
    data.world!.tiles.push(
      { x: 48, y: 2, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0 },
      { x: 49, y: 1, terrain: 'stone', material: 'iron_ore', remaining: 15, initial_amount: 15 },
      { x: 49, y: 2, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0 },
      { x: 50, y: 2, terrain: 'stone', material: 'coal', remaining: 20, initial_amount: 20 });
    expect(deriveNextShiftPlan(data, data.expeditions[0]).plan).toMatchObject({ target: { x: 50, y: 2 }, targetChanged: true });
  });
  it('can choose a nearby different deposit when the old material has run out', () => {
    const data = mine(); data.world!.tiles.find(tile => tile.x === 47 && tile.y === 1)!.remaining = 0;
    data.world!.tiles.push({ x: 49, y: 1, terrain: 'stone', material: 'iron_ore', remaining: 15, initial_amount: 15 });
    expect(deriveNextShiftPlan(data, data.expeditions[0]).plan).toMatchObject({ target: { x: 49, y: 1 }, mode: 'extract', targetChanged: true });
  });
  it('does not extract an exhausted deposit or an isolated, unreachable mineral', () => {
    const data = mine(); data.world!.tiles.find(tile => tile.x === 47 && tile.y === 1)!.remaining = 0;
    data.world!.tiles.push({ x: 30, y: 40, terrain: 'stone', material: 'coal', remaining: 100, initial_amount: 100 });
    expect(deriveNextShiftPlan(data, data.expeditions[0])).toEqual({ plan: null, reasons: ['Explore to find another workable deposit.'] });
  });
  it('keeps exploration as exploration and chooses only a connected frontier', () => {
    const source = returned({ mode: 'explore' }), data = mine(source); data.world!.tiles.find(tile => tile.x === 47 && tile.y === 1)!.remaining = 0;
    const plan = deriveNextShiftPlan(data, source).plan!;
    expect(plan.mode).toBe('explore'); expect(plan.targetChanged).toBe(true); expect(claimTargets(data, 'explore')).toContainEqual(plan.target);
  });
  it('blocks partial collection and every other ready output before another plan is offered', () => {
    const source = returned({ status: 'ready', stage: 'ready', cargo: { coal: 2 } }), data = mine(source);
    expect(deriveNextShiftPlan(data, source).plan).toBeNull();
    data.expeditions[0] = returned(); data.expeditions.push({ ...source, id: 'other-return' });
    expect(deriveNextShiftPlan(data, returned()).reasons).toContain('Collect the remaining haul first.');
    data.expeditions.pop(); data.production_jobs = [{ id: 'batch', recipe_key: 'smelt_copper', recipe_version: 1, station: 'smeltery', status: 'ready', batches: 1, started_at: data.server_now, completes_at: data.server_now, duration_seconds: 60, cash_cost: 2, inputs: {}, outputs: { copper_bar: 1 }, equipment_outputs: [] }];
    expect(deriveNextShiftPlan(data, returned()).reasons).toContain('Collect the finished production first.');
  });
  it('respects storage, pending finds and real active-crew slots even after their displayed timer elapses', () => {
    const data = mine(); data.company!.warehouse_used = data.company!.warehouse_capacity; data.discovery_summary!.pending = 24;
    data.expeditions.push(returned({ id: 'active-job', status: 'active', stage: 'return', completes_at: '2020-01-01T00:00:00Z' }));
    expect(deriveNextShiftPlan(data, data.expeditions[0])).toEqual({ plan: null, reasons: ['Make room in the warehouse first.', 'Review pending finds before sending another crew.', 'Wait for an open crew slot.'] });
    data.company!.warehouse_used = 0; data.discovery_summary!.pending = 0; data.company!.crew_slots = 2;
    expect(deriveNextShiftPlan(data, data.expeditions[0]).plan).not.toBeNull();
  });
  it.each(['survey', 'infrastructure'] as const)('does not reuse a %s job as a mining plan', mode => {
    const source = returned({ mode }); expect(deriveNextShiftPlan(mine(source), source).plan).toBeNull();
  });
  it('does not plan for a missing company or world', () => {
    const data = mine(); expect(deriveNextShiftPlan({ ...data, company: null }, returned()).plan).toBeNull();
    expect(deriveNextShiftPlan({ ...data, world: null }, returned()).plan).toBeNull();
  });
});

describe('Deep Claim editable returned-crew draft', () => {
  it('starts with the selected ordinary draft and still requires a fresh quote before dispatch', async () => {
    const data = mine(); data.company!.tutorial_used = false;
    data.world!.tiles.find(tile => tile.x === 47 && tile.y === 1)!.remaining = 10;
    data.world!.tiles.push({ x: 49, y: 1, terrain: 'stone', material: 'stone', remaining: 12, initial_amount: 12 });
    const preview = vi.fn().mockResolvedValue(allowed()), dispatch = vi.fn().mockResolvedValue(data), close = vi.fn();
    render(<DeepClaimDispatch snapshot={data} initialMode="extract" initialTarget={{ x: 47, y: 1 }} initialPlan={{ workerIds: ['worker-b'], durationMinutes: 60, ordinary: true }} readOnly={false} busy={false} onClose={close} preview={preview} dispatch={dispatch} />);
    expect(preview).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled();
    expect(within(screen.getByRole('group', { name: 'Selected crew' })).getByText('Worker b')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Standard/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('checkbox', { name: /First shift/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    await screen.findByRole('button', { name: 'Dispatch crew' });
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({ worker_ids: ['worker-b'], duration_minutes: 60, tutorial: false, target_x: 47, target_y: 1 }));
    expect(dispatch).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Dispatch crew' }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ duration_minutes: 60, tutorial: false }), 3));
    expect(close).toHaveBeenCalledOnce();
  });
  it('rechecks the current crew on opening and does not silently replace unavailable draft workers', () => {
    const data = mine(); data.workers[0].energy = 2; data.workers[1].assigned_job_id = 'other-shift';
    const preview = vi.fn(), dispatch = vi.fn();
    render(<DeepClaimDispatch snapshot={data} initialMode="extract" initialTarget={{ x: 47, y: 1 }} initialPlan={{ workerIds: ['worker-a', 'worker-b', 'not-owned'], durationMinutes: 180, ordinary: true }} readOnly={false} busy={false} onClose={vi.fn()} preview={preview} dispatch={dispatch} />);
    expect(screen.getByText('No crew selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review dispatch' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Send Worker c' })).not.toBeChecked();
    expect(preview).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled();
  });
});
