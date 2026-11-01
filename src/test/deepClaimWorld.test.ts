import { describe, expect, it } from 'vitest';
import { companySnapshot } from './fixtures/deepClaim';
import { chunkAddress, projectWorkers, revealedChunkMap, validateDeepClaimPreview, validateDeepClaimSnapshot, validateDeepClaimWorld } from '@/lib/deepClaim/world';
import type { DeepClaimExpedition } from '@/lib/deepClaim/types';

const anchor = Date.parse('2026-11-01T12:00:00.000Z');
function workingSnapshot() {
  const snapshot = companySnapshot();
  let cursor = anchor;
  const stages = (['travel','setup','work','haul','return'] as const).map((key, index) => {
    const starts_at = new Date(cursor).toISOString(); cursor += [5,3,15,3,4][index] * 1000;
    return { key, starts_at, ends_at: new Date(cursor).toISOString() };
  });
  const job: DeepClaimExpedition = { id: 'job-a', mode: 'extract', status: 'active', worker_ids: ['worker-a'], target: { x: 47, y: 1 }, path: [{ x: 48, y: 0 },{ x: 48, y: 1 },{ x: 47, y: 1 }], stages,
    stage: 'travel', started_at: new Date(anchor).toISOString(), completes_at: new Date(cursor).toISOString(), duration_minutes: 20, duration_seconds: 30, tutorial: true, wages: 3, energy_per_worker: 1, config_version: 1, cargo: null };
  snapshot.expeditions = [job]; snapshot.workers[0].assigned_job_id = job.id; return snapshot;
}

describe('Deep Claim private-world boundary and public visual projection', () => {
  it('validates bootstrap shafty0 and permanently exhausted ore tiles retaining their original finite amount', () => {
    const snapshot = companySnapshot();
    snapshot.world!.tiles.push({ x: 48, y: 0, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0 });
    snapshot.world!.tiles.push({ x: 47, y: 1, terrain: 'excavated', material: null, remaining: 0, initial_amount: 35 });
    expect(() => validateDeepClaimSnapshot(snapshot, { userId: 'user-a', clubId: 'club-a' })).not.toThrow();
    expect(() => validateDeepClaimSnapshot(snapshot, { userId: 'other', clubId: 'club-a' })).toThrow(/identity/);
    expect(() => validateDeepClaimSnapshot(snapshot, { userId: 'user-a', clubId: 'other' })).toThrow(/identity/);
  });
  it('rejects secret seeds, future plans, active cargo, negative stock and duplicate terrain cells', () => {
    const hidden = companySnapshot(); Object.assign(hidden.world!, { seed: 'must-stay-private' }); expect(() => validateDeepClaimSnapshot(hidden)).toThrow();
    const planned = workingSnapshot(); Object.assign(planned.expeditions[0], { planned_extractions: [] }); expect(() => validateDeepClaimSnapshot(planned)).toThrow();
    const cargo = workingSnapshot(); cargo.expeditions[0].cargo = { silver_ore: 100 }; expect(() => validateDeepClaimSnapshot(cargo)).toThrow(/future cargo/);
    const negative = companySnapshot(); negative.resources.stone = -2; expect(() => validateDeepClaimSnapshot(negative)).toThrow();
    const repeated = companySnapshot(); repeated.world!.tiles.push({ ...repeated.world!.tiles[0] }); expect(() => validateDeepClaimWorld(repeated.world)).toThrow();
  });
  it('rejects overlapping crews and worker-to-job assignments that cannot exist on the server', () => {
    const duplicate = workingSnapshot(); duplicate.expeditions.push({ ...duplicate.expeditions[0], id: 'job-b' });
    expect(() => validateDeepClaimSnapshot(duplicate)).toThrow(/assignments/);
    const orphan = companySnapshot(); orphan.workers[0].assigned_job_id = 'missing-job'; expect(() => validateDeepClaimSnapshot(orphan)).toThrow(/assignment/);
    const ready = workingSnapshot(); ready.expeditions[0].status = 'ready'; ready.expeditions[0].stage = 'ready'; ready.expeditions[0].cargo = { coal: 10 };
    expect(() => validateDeepClaimSnapshot(ready)).toThrow(/assignment/);
  });
  it('groups only revealed cells into32tile chunks and never fabricates an untouched chunk', () => {
    const world = companySnapshot().world!;
    expect(chunkAddress({ x: 95, y: 96 })).toEqual({ x: 2, y: 3, key: '2:3' });
    expect([...revealedChunkMap(world).keys()]).toEqual(['1:0']);
    expect(revealedChunkMap(world).get('1:0')).toEqual(world.tiles);
    expect(revealedChunkMap({ ...world, tiles: [] }).size).toBe(0);
  });
  it('projects public movement only within the server-declared stage even when the local estimated clock races ahead', () => {
    const snapshot = workingSnapshot(); validateDeepClaimSnapshot(snapshot);
    const before = JSON.stringify(snapshot), halfway = projectWorkers(snapshot, anchor + 2500)[0];
    expect(halfway).toMatchObject({ worker_id: 'worker-a', job_id: 'job-a', stage: 'travel', pose: 'walk', progress: 0.5 });
    expect(halfway.x).toBe(48); expect(halfway.y).toBe(1);
    const tooLate = projectWorkers(snapshot, anchor + 600_000)[0];
    expect(tooLate).toMatchObject({ stage: 'travel', pose: 'walk', progress: 1, x: 47, y: 1 });
    expect(JSON.stringify(snapshot)).toBe(before); expect(snapshot.expeditions[0].cargo).toBeNull();
    expect(projectWorkers(snapshot)[1]).toMatchObject({ stage: 'idle', job_id: null, y: 0, pose: 'idle' });
  });
  it('validates safe preview estimates while rejecting private fields and inconsistent availability', () => {
    const preview = { allowed: true, reasons: [], company_revision: 1, server_now: new Date(anchor).toISOString(), wages: 3, energy_per_worker: 1,
      duration_seconds: 30, estimated_yield: { min: 17, max: 27 }, route: [{ x: 48, y: 0 },{ x: 47, y: 1 }],
      stages: [{ key: 'travel', duration_seconds: 5 }], cargo_capacity: 59, risk_level: 'low', accessible_depth: 49,
      expected_resources: ['stone','coal'], projected_completion_at: new Date(anchor + 30_000).toISOString() };
    expect(() => validateDeepClaimPreview(preview)).not.toThrow();
    expect(() => validateDeepClaimPreview({ ...preview, _quantity: 22 })).toThrow();
    expect(() => validateDeepClaimPreview({ ...preview, allowed: false })).toThrow(/availability/);
    expect(() => validateDeepClaimPreview({ ...preview, estimated_yield: { min: 30, max: 27 } })).toThrow();
  });
});
