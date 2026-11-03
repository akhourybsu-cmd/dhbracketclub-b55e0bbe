import { describe, expect, it } from 'vitest';
import { crewFootPoint, projectCrewPresentation } from '@/lib/deepClaim/crewPresentation';
import type { DeepClaimExpedition, DeepClaimMode, DeepClaimSnapshot, DeepClaimStageKey } from '@/lib/deepClaim/types';
import { phaseThreeSnapshot } from './fixtures/deepClaimPhase3';

const start = Date.parse('2026-11-01T12:00:00Z');
function setup(stage: DeepClaimStageKey = 'work', mode: DeepClaimMode = 'extract') {
  const snapshot = phaseThreeSnapshot();
  let cursor = start;
  const stages = (['travel', 'setup', 'work', 'haul', 'return'] as const).map((key, index) => {
    const begins = cursor; cursor += [60, 30, 1000, 50, 60][index] * 1000;
    return { key, starts_at: new Date(begins).toISOString(), ends_at: new Date(cursor).toISOString() };
  });
  const job: DeepClaimExpedition = {
    id: 'crew-first', mode, status: 'active', worker_ids: snapshot.workers.map(worker => worker.id),
    target: { x: 47, y: 8 }, path: [...Array.from({ length: 9 }, (_, y) => ({ x: 48, y })), { x: 47, y: 8 }],
    stages, stage, started_at: new Date(start).toISOString(), completes_at: new Date(cursor).toISOString(),
    duration_minutes: 20, duration_seconds: 1200, tutorial: false, wages: 6, energy_per_worker: 1, config_version: 3, cargo: null,
  };
  snapshot.world!.tiles = Array.from({ length: 8 }, (_, index) => ({ x: 48, y: index + 1, terrain: 'excavated' as const, material: null, remaining: 0, initial_amount: 0 }));
  snapshot.world!.tiles.push({ x: 47, y: 8, terrain: 'stone', material: 'coal', remaining: 20, initial_amount: 20 });
  snapshot.workers = snapshot.workers.map(worker => ({ ...worker, assigned_job_id: job.id }));
  snapshot.expeditions = [job];
  snapshot.server_now = stages.find(entry => entry.key === stage)!.starts_at;
  return { snapshot, job };
}
function expectDisclosed(snapshot: DeepClaimSnapshot) {
  for (const worker of projectCrewPresentation(snapshot).workers) {
    if (worker.y === 0) continue;
    const cell = snapshot.world!.tiles.find(tile => tile.x === Math.floor(worker.x) && tile.y === Math.floor(worker.y));
    expect(cell?.remaining).toBe(0);
  }
}

describe('Deep Claim continuous crew foot anchor', () => {
  it.each([[0, 0], [.001, .00194], [.5, .97], [1, 1.94]])('keeps the shaft entry continuous at route depth %s', (y, expected) => {
    const point = { x: 48, y }, before = { ...point };
    const foot = crewFootPoint(point);
    expect(foot.x).toBe(48.5); expect(foot.y).toBeCloseTo(expected, 8);
    expect(point).toEqual(before);
  });

  it('preserves the underground anchor and clamps surface queue positions to surface height', () => {
    expect(crewFootPoint({ x: 47, y: 8 })).toEqual({ x: 47.5, y: 8.94 });
    expect(crewFootPoint({ x: 46, y: -1 })).toEqual({ x: 46.5, y: 0 });
  });
});

describe('Deep Claim disclosed crew positions', () => {
  it('spreads a three-person mining crew along the open shaft without occupying solid ore or neighboring fog', () => {
    const { snapshot } = setup(), { workers, crews } = projectCrewPresentation(snapshot);
    expect(workers).toHaveLength(3);
    expect(new Set(workers.map(worker => `${worker.x}:${worker.y}`)).size).toBe(3);
    expect(workers.every(worker => worker.x === 48 && worker.y > 0)).toBe(true);
    expect(crews[0]).toMatchObject({ x: 48, y: 8, target: { x: 47, y: 8 } });
    expectDisclosed(snapshot);
  });

  it('keeps the approach safe when the target is fogged and when a compressed shaft crosses unrevealed cells', () => {
    const { snapshot, job } = setup();
    snapshot.world!.tiles = snapshot.world!.tiles.filter(tile => tile.x !== 47 && tile.y <= 3);
    job.path = [{ x: 48, y: 0 }, { x: 48, y: 8 }, { x: 47, y: 8 }];
    expect(projectCrewPresentation(snapshot).crews[0]).toMatchObject({ x: 48, y: 3 });
    expectDisclosed(snapshot);
  });

  it('gives different crews distinct nearby work positions using only connected public ground', () => {
    const { snapshot, job } = setup();
    const secondWorker = { ...snapshot.workers[0], id: 'second-crew-worker', assigned_job_id: 'crew-second' };
    const second = { ...job, id: 'crew-second', worker_ids: [secondWorker.id], target: { x: 49, y: 8 }, path: [...job.path.slice(0, -1), { x: 49, y: 8 }] };
    snapshot.workers.push(secondWorker); snapshot.expeditions.push(second);
    const { workers, crews } = projectCrewPresentation(snapshot);
    expect(crews.map(crew => crew.number)).toEqual([1, 2]);
    expect(new Set(workers.map(worker => `${worker.x}:${worker.y}`)).size).toBe(4);
    expectDisclosed(snapshot);
  });

  it('uses nearby underground floor before surface space for a shallow crew', () => {
    const { snapshot, job } = setup();
    job.target = { x: 47, y: 1 }; job.path = [{ x: 48, y: 0 }, { x: 48, y: 1 }, job.target];
    snapshot.world!.tiles = snapshot.world!.tiles.filter(point => point.x === 48 && point.y <= 3);
    const { workers } = projectCrewPresentation(snapshot);
    expect(workers.map(worker => worker.y)).toEqual([1, 2, 3]);
    expect(workers.every(worker => Math.abs(worker.x - 48) + Math.abs(worker.y - 1) <= 3)).toBe(true);
    expectDisclosed(snapshot);
  });

  it('uses small safe in-cell places when available public floor space is exhausted', () => {
    const { snapshot, job } = setup();
    job.path = [{ x: 48, y: 5 }];
    snapshot.world!.tiles = [{ ...snapshot.world!.tiles[0], y: 5 }];
    const { workers } = projectCrewPresentation(snapshot);
    expect(new Set(workers.map(worker => `${worker.x}:${worker.y}`)).size).toBe(3);
    expect(workers.every(worker => Math.floor(worker.x) === 48 && Math.floor(worker.y) === 5)).toBe(true);
    expectDisclosed(snapshot);
  });
});

describe('Deep Claim route movement and timing', () => {
  it('stages the crew in single file with distinct surface queue slots at dispatch and arrival', () => {
    const { snapshot, job } = setup('travel');
    const outgoing = projectCrewPresentation(snapshot);
    expect(outgoing.workers.map(worker => worker.y)).toEqual([0, 0, 0]);
    expect(new Set(outgoing.workers.map(worker => worker.x)).size).toBe(3);
    job.stage = 'return'; snapshot.expeditions = [{ ...job }];
    snapshot.server_now = job.stages[4].ends_at;
    const returned = projectCrewPresentation(snapshot);
    expect(returned.workers.every(worker => worker.y === 0 && worker.awaiting_sync && !worker.moving)).toBe(true);
    expect(new Set(returned.workers.map(worker => worker.x)).size).toBe(3);
  });

  it('interpolates travel safely without restarting the route on a reload', () => {
    const { snapshot } = setup('travel'), at = start + 30_000;
    const halfway = projectCrewPresentation(snapshot, at);
    expect(halfway.workers[0]).toMatchObject({ x: 48, y: 4, progress: .5, moving: true });
    expect(projectCrewPresentation(structuredClone(snapshot), at)).toEqual(halfway);
  });

  it('keeps concurrent crews in distinct single-file positions on their shared public route', () => {
    const { snapshot, job } = setup('travel');
    const worker = { ...snapshot.workers[0], id: 'other-crew', assigned_job_id: 'other-job' };
    snapshot.workers.push(worker);
    snapshot.expeditions.push({ ...job, id: 'other-job', worker_ids: [worker.id] });
    const result = projectCrewPresentation(snapshot, start + 30_000);
    expect(new Set(result.workers.map(point => `${point.x}:${point.y}`)).size).toBe(4);
    expect(result.workers.filter(point => point.y > 0).every(point => point.x === 48)).toBe(true);
    expect(result.crews.map(crew => crew.number)).toEqual([1, 2]);
  });

  it('extends the approach only after a new public snapshot actually reveals an emptied target', () => {
    const { snapshot, job } = setup();
    expect(projectCrewPresentation(snapshot).crews[0]).toMatchObject({ x: 48, y: 8 });
    const revealed = {
      ...snapshot,
      world: { ...snapshot.world!, tiles: snapshot.world!.tiles.map(point => point.x === job.target.x && point.y === job.target.y ? { ...point, terrain: 'excavated' as const, remaining: 0 } : point) },
    };
    expect(projectCrewPresentation(revealed).crews[0]).toMatchObject({ x: 47, y: 8 });
    expect(snapshot.world!.tiles.find(point => point.x === 47)!.remaining).toBe(20);
  });

  it.each(['travel', 'return'] as const)('faces the actual horizontal direction during %s', stage => {
    const { snapshot, job } = setup(stage);
    snapshot.workers = [snapshot.workers[0]]; job.worker_ids = [snapshot.workers[0].id];
    job.path = [{ x: 48, y: 0 }, { x: 48, y: 1 }, { x: 46, y: 1 }];
    snapshot.world!.tiles.push({ x: 47, y: 1, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0 }, { x: 46, y: 1, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0 });
    const stageStart = Date.parse(job.stages.find(entry => entry.key === stage)!.starts_at);
    const projected = projectCrewPresentation(snapshot, stageStart + (stage === 'travel' ? 45_000 : 15_000)).workers[0];
    expect(projected.facing).toBe(stage === 'travel' ? -1 : 1);
  });

  it('stops at the declared stage boundary and awaits sync without advancing stages or rewards', () => {
    const { snapshot, job } = setup('work'), before = structuredClone(snapshot);
    const end = Date.parse(job.stages[2].ends_at);
    const stopped = projectCrewPresentation(snapshot, end + 500_000);
    expect(stopped.workers.every(worker => worker.stage === 'work' && worker.progress === 1 && worker.awaiting_sync && !worker.moving)).toBe(true);
    expect(stopped.crews[0].awaiting_sync).toBe(true);
    expect(snapshot).toEqual(before); expect(job.cargo).toBeNull();
  });

  it('does not rewind ahead of server time or accept an invalid local clock', () => {
    const { snapshot, job } = setup('work');
    snapshot.server_now = new Date(Date.parse(job.stages[2].starts_at) + 20_000).toISOString();
    expect(projectCrewPresentation(snapshot, 0)).toEqual(projectCrewPresentation(snapshot));
    expect(projectCrewPresentation(snapshot, NaN)).toEqual(projectCrewPresentation(snapshot));
  });
});

describe('Deep Claim assignment integrity and roles', () => {
  it('uses stable chronological crews and worker IDs rather than roster order', () => {
    const { snapshot, job } = setup();
    const before = projectCrewPresentation(snapshot);
    const reordered = { ...snapshot, workers: [...snapshot.workers].reverse(), expeditions: [{ ...job, worker_ids: [...job.worker_ids].reverse() }] };
    expect(projectCrewPresentation(reordered)).toEqual(before);
  });

  it('keeps an active crew number when a companion finishes and remains in public history', () => {
    const { snapshot, job } = setup();
    const worker = { ...snapshot.workers[0], id: 'second-worker', assigned_job_id: 'second-job' };
    const second = { ...job, id: 'second-job', started_at: new Date(start + 1).toISOString(), worker_ids: [worker.id] };
    snapshot.workers.push(worker); snapshot.expeditions.push(second);
    expect(projectCrewPresentation(snapshot).crews.find(crew => crew.job_id === second.id)!.number).toBe(2);
    const completed = {
      ...snapshot,
      expeditions: snapshot.expeditions.map(entry => entry.id === job.id ? { ...entry, status: 'ready' as const, stage: 'ready' as const, cargo: { coal: 10 } } : entry),
      workers: snapshot.workers.map(entry => entry.assigned_job_id === job.id ? { ...entry, assigned_job_id: null } : entry),
    };
    expect(projectCrewPresentation(completed).crews[0]).toMatchObject({ job_id: second.id, number: 2 });
  });

  it('requires both an active membership and the employee assignment, avoiding ghost crew members', () => {
    const { snapshot, job } = setup();
    snapshot.workers[0].assigned_job_id = null;
    job.worker_ids = [snapshot.workers[0].id, snapshot.workers[1].id];
    const result = projectCrewPresentation(snapshot);
    expect(result.crews[0].worker_ids).toEqual([snapshot.workers[1].id]);
    expect(result.workers.filter(worker => worker.job_id)).toHaveLength(1);
    expect(result.workers.filter(worker => !worker.job_id).every(worker => worker.stage === 'idle' && worker.y === 0)).toBe(true);
  });

  it('returns released employees to distinct surface positions after a confirmed completion', () => {
    const { snapshot, job } = setup();
    job.status = 'ready'; job.stage = 'ready'; job.cargo = { coal: 10 };
    snapshot.workers = snapshot.workers.map(worker => ({ ...worker, assigned_job_id: null }));
    const result = projectCrewPresentation(snapshot);
    expect(result.crews).toEqual([]);
    expect(new Set(result.workers.map(worker => worker.x)).size).toBe(3);
    expect(result.workers.every(worker => worker.pose === 'idle' && !worker.awaiting_sync && !worker.moving)).toBe(true);
  });

  it('shows one strongest miner at the rock face while specialists support that same mining job', () => {
    const { snapshot } = setup();
    snapshot.workers[0] = { ...snapshot.workers[0], specialty: 'miner', stats: { ...snapshot.workers[0].stats, mining: 90 } };
    snapshot.workers[1] = { ...snapshot.workers[1], specialty: 'geologist', stats: { ...snapshot.workers[1].stats, mining: 30 } };
    snapshot.workers[2] = { ...snapshot.workers[2], specialty: 'hauler', stats: { ...snapshot.workers[2].stats, mining: 20 } };
    const { workers } = projectCrewPresentation(snapshot);
    expect(workers.map(worker => worker.pose)).toEqual(['mine', 'survey', 'haul']);
    expect(workers[0].worker_id).toBe(snapshot.workers[0].id);
    expect(new Set(workers.map(worker => worker.animation_phase_ms)).size).toBe(3);
  });

  it('stops mining an authoritatively depleted extraction seam while retaining its declared work stage', () => {
    const { snapshot, job } = setup('work', 'extract');
    const depleted = {
      ...snapshot,
      world: { ...snapshot.world!, tiles: snapshot.world!.tiles.map(point => point.x === job.target.x && point.y === job.target.y ? { ...point, terrain: 'excavated' as const, remaining: 0 } : point) },
    };
    const working = projectCrewPresentation(snapshot), finishedRock = projectCrewPresentation(depleted);
    expect(working.workers[0].pose).toBe('mine');
    expect(finishedRock.workers.every(worker => worker.pose !== 'mine' && worker.stage === 'work')).toBe(true);
    expect(finishedRock.workers[0].pose).toBe('haul');
    expect(finishedRock.workers[0].progress).toBe(working.workers[0].progress);
    expect(job.stage).toBe('work'); expect(job.cargo).toBeNull();
  });

  it('does not infer exploration has finished from an emptied first target', () => {
    const { snapshot, job } = setup('work', 'explore');
    snapshot.world!.tiles = snapshot.world!.tiles.map(point => point.x === job.target.x && point.y === job.target.y ? { ...point, terrain: 'excavated' as const, remaining: 0 } : point);
    expect(projectCrewPresentation(snapshot).workers[0]).toMatchObject({ pose: 'mine', stage: 'work' });
  });

  it.each([['survey', 'survey'], ['infrastructure', 'build']] as const)('keeps %s crew animation within its actual work type', (mode, pose) => {
    const { snapshot } = setup('work', mode);
    expect(projectCrewPresentation(snapshot).workers[0].pose).toBe(pose);
    expect(projectCrewPresentation(snapshot).workers.some(worker => worker.pose === 'mine')).toBe(false);
  });

  it('does not mutate frozen paths, terrain, staff, timestamps or expedition state', () => {
    const { snapshot } = setup('travel'), before = structuredClone(snapshot);
    const freeze = (value: unknown) => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } };
    freeze(snapshot);
    expect(() => projectCrewPresentation(snapshot, start + 30_000)).not.toThrow();
    expect(snapshot).toEqual(before);
  });
});
