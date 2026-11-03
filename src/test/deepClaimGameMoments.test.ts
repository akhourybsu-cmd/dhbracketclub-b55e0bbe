import { describe, expect, it } from 'vitest';
import { commissionedCrew, confirmedBuildingChange, crewFocusPoint } from '@/lib/deepClaim/gameMoments';
import type { DeepClaimDispatchInput, DeepClaimExpedition } from '@/lib/deepClaim/types';
import { phaseThreeSnapshot } from './fixtures/deepClaimPhase3';

function setup() {
  const before = phaseThreeSnapshot(), after = structuredClone(before); after.revision++;
  const input: DeepClaimDispatchInput = { mode: 'extract', target_x: 47, target_y: 1, worker_ids: [before.workers[0].id], duration_minutes: 20, tutorial: false, infrastructure_key: null };
  const job: DeepClaimExpedition = { id: 'confirmed-job', mode: 'extract', status: 'active', stage: 'work', worker_ids: [...input.worker_ids], target: { x: 47, y: 1 }, path: [{ x: 48, y: 0 }, { x: 48, y: 1 }, { x: 47, y: 1 }], started_at: before.server_now, completes_at: '2026-11-01T12:20:00Z', duration_minutes: 20, duration_seconds: 1200, energy_per_worker: 1, wages: 3, tutorial: false, config_version: 3, cargo: null,
    stages: [{ key: 'work', starts_at: before.server_now, ends_at: '2026-11-01T12:20:00Z' }] };
  after.expeditions = [job]; after.workers[0].assigned_job_id = job.id;
  if (!after.world!.tiles.some(tile => tile.x === 47 && tile.y === 1)) after.world!.tiles.push({ x: 47, y: 1, terrain: 'stone', material: 'coal', remaining: 10, initial_amount: 10 });
  return { before, after, input, job };
}

describe('Deep Claim confirmed game moments', () => {
  it('commissions only the newly confirmed matching crew without mutating snapshots', () => {
    const { before, after, input, job } = setup(), copy = structuredClone({ before, after, input });
    const moment = commissionedCrew(before, after, input);
    expect(moment?.job).toBe(job); expect(moment?.workers.map(worker => worker.id)).toEqual(input.worker_ids);
    expect(moment?.companyId).toBe(after.company!.id); expect({ before, after, input }).toEqual(copy);
  });
  it('does not turn a preview, old job or unchanged retry into another departure', () => {
    const { before, after, input, job } = setup();
    expect(commissionedCrew(before, before, input)).toBeNull();
    expect(commissionedCrew(after, { ...after, revision: after.revision + 1 }, input)).toBeNull();
    expect(commissionedCrew(before, { ...after, expeditions: [{ ...job, status: 'ready', stage: 'ready' }] }, input)).toBeNull();
  });
  it.each([{ target_x: 50 }, { worker_ids: ['someone-else'] }, { duration_minutes: 60 }, { tutorial: true }, { mode: 'explore' }] as const)('rejects an unrelated dispatch update %j', change => {
    const { before, after, input } = setup(); expect(commissionedCrew(before, after, { ...input, ...change, worker_ids: 'worker_ids' in change ? [...change.worker_ids] : input.worker_ids })).toBeNull();
  });
  it.each(['user_id', 'club_id', 'id'] as const)('isolates moments when company %s changes', field => {
    const { before, after, input } = setup(); after.company![field] = 'other';
    expect(commissionedCrew(before, after, input)).toBeNull();
    after.buildings.find(item => item.key === 'warehouse')!.level++;
    expect(confirmedBuildingChange(before, after, 'warehouse')).toBeNull();
  });
  it('does not decorate a roster that lacks the actual assignment', () => {
    const { before, after, input } = setup(); after.workers[0].assigned_job_id = null;
    expect(commissionedCrew(before, after, input)).toBeNull();
  });
  it('shows the actual owned before/after levels and server effect rather than assuming one level', () => {
    const { before, after } = setup(); const building = after.buildings.find(item => item.key === 'warehouse')!;
    building.level = 3; building.effect = 'Confirmed warehouse capacity';
    expect(confirmedBuildingChange(before, after, 'warehouse')).toEqual({ key: 'warehouse', fromLevel: 1, toLevel: 3, effect: building.effect });
    expect(confirmedBuildingChange(after, { ...after, revision: after.revision + 1 }, 'warehouse')).toBeNull();
  });
});

describe('Follow a disclosed crew location', () => {
  it('focuses the projected owned worker in known ground', () => {
    const { after, job } = setup(); expect(crewFocusPoint(after, job, Date.parse(after.server_now))).toEqual(job.target);
  });
  it('uses the revealed approach when the worksite is still fogged and preserves the route', () => {
    const { after, job } = setup(); after.world!.tiles = after.world!.tiles.filter(tile => !(tile.x === 47 && tile.y === 1));
    const copy = structuredClone(after);
    expect(crewFocusPoint(after, job, Date.parse(job.completes_at) + 1000)).toEqual({ x: 48, y: 1 });
    expect(after).toEqual(copy); expect(after.expeditions[0].status).toBe('active');
  });
  it('does not trust a stale callback payload or invent a location without a world', () => {
    const { after } = setup(); expect(crewFocusPoint(after, { id: 'unknown' }, 0)).toBeNull();
    expect(crewFocusPoint({ ...after, world: null }, after.expeditions[0], 0)).toBeNull();
  });
});
