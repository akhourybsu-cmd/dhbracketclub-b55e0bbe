import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimExpeditionCard } from '@/components/deepClaim/DeepClaimExpeditionCard';
import { operationCardModel } from '@/components/deepClaim/operationCard';
import type { DeepClaimExpedition, DeepClaimMode, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { companySnapshot } from './fixtures/deepClaim';

afterEach(cleanup);
const start = Date.parse('2026-11-01T12:00:00Z');
function fixture(overrides: Partial<DeepClaimExpedition> = {}) {
  const snapshot = companySnapshot();
  snapshot.workers[0].name = 'Mara Flint'; snapshot.workers[1].name = 'Ivo Reed'; snapshot.workers[2].name = 'Tessa Vale';
  snapshot.world!.tiles = [...snapshot.world!.tiles, { x: 47, y: 1, terrain: 'stone', material: 'coal', remaining: 10, initial_amount: 10 }];
  const job: DeepClaimExpedition = {
    id: 'shift-a', mode: 'extract', status: 'active', worker_ids: ['worker-a', 'worker-b'], target: { x: 47, y: 1 }, path: [{ x: 48, y: 1 }, { x: 47, y: 1 }],
    stage: 'work', started_at: new Date(start).toISOString(), completes_at: new Date(start + 1_200_000).toISOString(),
    duration_minutes: 20, duration_seconds: 1200, tutorial: false, wages: 4, energy_per_worker: 1, config_version: 3, cargo: null,
    stages: (['travel', 'setup', 'work', 'haul', 'return'] as const).map((key, index) => ({ key, starts_at: new Date(start + index * 240_000).toISOString(), ends_at: new Date(start + (index + 1) * 240_000).toISOString() })),
    ...overrides,
  };
  snapshot.expeditions = [job];
  return { snapshot, job };
}
function card(snapshot: DeepClaimSnapshot, job: DeepClaimExpedition, now = start + 600_000) {
  const onRefresh = vi.fn(), onCollect = vi.fn(), onFollow = vi.fn();
  const view = render(<DeepClaimExpeditionCard snapshot={snapshot} job={job} now={now} onRefresh={onRefresh} onCollect={onCollect} onFollow={onFollow} />);
  return { ...view, onRefresh, onCollect, onFollow };
}

describe('Deep Claim source-backed operations presentation', () => {
  it('resolves a job from this company snapshot instead of a stale or modified caller payload', () => {
    const { snapshot, job } = fixture();
    const altered = { ...job, status: 'ready' as const, stage: 'return' as const, worker_ids: ['worker-c'], cargo: { gold_ore: 100 } };
    const result = operationCardModel(snapshot, altered, start + 600_000);
    expect(result.source).toBe(job); expect(result.ready).toBe(false); expect(result.stageIndex).toBe(2); expect(result.units).toBe(0);
    expect(result.crew.map(worker => worker.name)).toEqual(['Mara Flint', 'Ivo Reed']);
  });
  it('does not expose a job or roster absent from the current company', () => {
    const { snapshot } = fixture();
    const absent = operationCardModel(snapshot, { id: 'foreign-shift' }, start);
    expect(absent.source).toBeNull(); expect(absent.crew).toEqual([]); expect(absent.material).toBeNull();
    expect(operationCardModel({ ...snapshot, company: null }, { id: 'shift-a' }, start).source).toBeNull();
  });
  it('keeps elapsed-but-active work awaiting a report and retains the stored stage', () => {
    const { snapshot, job } = fixture();
    const result = operationCardModel(snapshot, job, start + 1_300_000);
    expect(result.fraction).toBe(100); expect(result.ready).toBe(false); expect(result.canCheckReturn).toBe(true);
    expect(result.status).toBe('Awaiting report'); expect(result.stageIndex).toBe(2); expect(job.stage).toBe('work');
  });
  it.each(['bad start', 'bad end', 'reversed', 'invalid now'] as const)('bounds %s clocks and offers sync without declaring a return', kind => {
    const { snapshot, job } = fixture(kind === 'bad start' ? { started_at: 'bad' } : kind === 'bad end' ? { completes_at: 'bad' } : kind === 'reversed' ? { completes_at: new Date(start - 1000).toISOString() } : {});
    const result = operationCardModel(snapshot, job, kind === 'invalid now' ? NaN : start + 500);
    expect(result.fraction).toBe(0); expect(result.canCheckReturn).toBe(true); expect(result.ready).toBe(false); expect(result.status).toBe('Sync needed');
  });
  it('bounds future display time without changing official stage progress', () => {
    const { snapshot, job } = fixture({ stage: 'setup' });
    const result = operationCardModel(snapshot, job, start - 50_000);
    expect(result.fraction).toBe(0); expect(result.stageIndex).toBe(1); expect(result.status).toBe('Preparing'); expect(result.canCheckReturn).toBe(false);
  });
  it('uses only the revealed target material, without guessing an unknown destination', () => {
    const { snapshot, job } = fixture(); expect(operationCardModel(snapshot, job, start).material).toBe('coal');
    const hidden = { ...job, target: { x: 46, y: 1 } }; snapshot.expeditions = [hidden];
    expect(operationCardModel(snapshot, hidden, start).material).toBeNull();
  });
  it('counts only settled ready cargo and never treats collected stock as staged', () => {
    const { snapshot, job } = fixture({ status: 'ready', stage: 'ready', cargo: { coal: 10, stone: 12 } });
    expect(operationCardModel(snapshot, job, NaN)).toMatchObject({ ready: true, fraction: 100, units: 22, canCheckReturn: false });
    const collected = { ...job, status: 'collected' as const, stage: 'collected' as const }; snapshot.expeditions = [collected];
    expect(operationCardModel(snapshot, collected, start)).toMatchObject({ ready: false, fraction: 100, units: 0, canCheckReturn: false });
  });
  it('does not mutate the authoritative expedition, paths, workers or terrain', () => {
    const { snapshot, job } = fixture(), before = structuredClone(snapshot);
    operationCardModel(snapshot, job, start + 600_000); operationCardModel(snapshot, job, start + 2_000_000);
    expect(snapshot).toEqual(before);
  });
});

describe('Deep Claim playable crew operations card', () => {
  it('shows actual assigned portraits, known material and five source-backed stages', () => {
    const { snapshot, job } = fixture(); card(snapshot, job);
    expect(screen.getByRole('img', { name: 'Mara Flint' })).toBeInTheDocument(); expect(screen.getByRole('img', { name: 'Ivo Reed' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Tessa Vale' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Assigned crew: Mara Flint, Ivo Reed' })).toBeInTheDocument();
    const route = screen.getByRole('list', { name: 'Expedition stages' }); expect(within(route).getAllByRole('listitem')).toHaveLength(5);
    expect(within(route).getByText('Work').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(document.querySelector('[data-dc-resource-art="coal"]')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Expedition elapsed time' })).toHaveAttribute('aria-valuenow', '50');
  });
  it('checks an elapsed active shift rather than collecting or visually advancing it', () => {
    const { snapshot, job } = fixture(); const ui = card(snapshot, job, start + 1_300_000);
    expect(screen.queryByRole('button', { name: 'Open haul' })).not.toBeInTheDocument();
    expect(screen.getByText('Awaiting report')).toBeInTheDocument();
    expect(screen.getByText('Work').closest('li')).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: 'Check return' })); expect(ui.onRefresh).toHaveBeenCalledOnce(); expect(ui.onCollect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Follow crew' })); expect(ui.onFollow).toHaveBeenCalledExactlyOnceWith(job);
  });
  it('opens only confirmed ready cargo and lets the player inspect its real worksite', () => {
    const { snapshot, job } = fixture({ status: 'ready', stage: 'ready', cargo: { coal: 10, stone: 12 } }); const ui = card(snapshot, job);
    expect(screen.getByText('22 units staged')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Check return' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-dc-tutorial="jobs-ready"]')).toBeInTheDocument();
    const route = screen.getByRole('list', { name: 'Expedition stages' });
    expect([...route.querySelectorAll('li')].every(item => item.dataset.complete === 'true' && !item.hasAttribute('aria-current'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Open haul' })); expect(ui.onCollect).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'View worksite' })); expect(ui.onFollow).toHaveBeenCalledExactlyOnceWith(job);
  });
  it('keeps a missing or foreign operation inert and does not render fabricated portraits', () => {
    const { snapshot, job } = fixture(); const ui = card(snapshot, { ...job, id: 'not-owned' });
    expect(screen.getByText('Shift unavailable')).toBeInTheDocument(); expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'View worksite' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Open haul' })).not.toBeInTheDocument();
    expect(ui.onFollow).not.toHaveBeenCalled(); expect(ui.onCollect).not.toHaveBeenCalled();
  });
  it.each([['explore', 'Expand tunnels', 'Expanding'], ['extract', 'Mine a deposit', 'Mining'], ['survey', 'Scout the area', 'Scouting'], ['infrastructure', 'Improve the mine', 'Building']] as const)('names %s work from the authoritative mode', (mode: DeepClaimMode, title, status) => {
    const { snapshot, job } = fixture({ mode }); card(snapshot, job);
    expect(screen.getByText(title)).toBeInTheDocument(); expect(screen.getByText(status)).toBeInTheDocument();
  });
  it('keeps disclosed lift and heat figures available without recalculating their effects', () => {
    const { snapshot, job } = fixture({ deep_modifiers: { lift_discount_percent: 25, thermal_load_percent: 20, engineering_mitigation_percent: 5, ventilation_mitigation_percent: 4, gear_mitigation_percent: 4, heat_penalty_percent: 7, raw_work_seconds: 900, effective_work_seconds: 837 } });
    card(snapshot, job); expect(screen.getByLabelText('Lift 25 percent, heat penalty 7 percent')).toHaveTextContent('25%7%');
  });
});
