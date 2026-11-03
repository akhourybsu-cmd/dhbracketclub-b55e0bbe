import { describe, expect, it } from 'vitest';
import { operationAdvice } from '@/lib/deepClaim/operationAdvice';
import { fieldConditions, infrastructureQuote } from '@/lib/deepClaim/field';
import type { DeepClaimInfrastructure, DeepClaimInfrastructureKey, DeepClaimPoint, DeepClaimPreview, DeepClaimTile, DeepClaimWorld } from '@/lib/deepClaim/types';
import { phaseThreeSnapshot } from './fixtures/deepClaimPhase3';

function tile(x: number, y: number): DeepClaimTile {
  return { x, y, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0 };
}
function world(tiles: DeepClaimTile[], max_depth = 999): DeepClaimWorld {
  return { tiles, max_depth, width: 96, chunk_size: 32, revision: 1 };
}
function structure(key: DeepClaimInfrastructureKey, point: DeepClaimPoint, strength = 20): DeepClaimInfrastructure {
  return { ...infrastructureQuote(key, 180, 100).installation, ...point, strength, id: key, status: 'installed', job_id: 'past-job', installed_at: '2026-11-01T00:00:00Z' };
}
function preview(target = { x: 48, y: 100 }): DeepClaimPreview {
  const route = Array.from({ length: target.y + 1 }, (_, y) => ({ x: 48, y }));
  return {
    allowed: true, reasons: [], company_revision: 1, server_now: '2026-11-01T00:00:00Z', wages: 2,
    energy_per_worker: 1, duration_seconds: 1200, estimated_yield: { min: 0, max: 0 }, route,
    cargo_capacity: 50, risk_level: 'low', accessible_depth: 999, expected_resources: [],
    projected_completion_at: '2026-11-01T00:20:00Z', stages: [{ key: 'travel', duration_seconds: 150 }, { key: 'return', duration_seconds: 150 }],
    conditions: fieldConditions({ depth: target.y, safety: 20, energy: 1, target, route, infrastructure: [] }),
  };
}

describe('Deep Claim operation intent', () => {
  it('distinguishes opening routes from production without promising exploration cargo', () => {
    const common = { target: null, world: null };
    expect(operationAdvice({ ...common, mode: 'explore' }).detail).toMatch(/unknown ground.*May also bring back ore/);
    expect(operationAdvice({ ...common, mode: 'extract' }).detail).toMatch(/known deposit.*selling or production/);
  });

  it('handles setup and unselected plans without inventing coverage', () => {
    expect(operationAdvice({ mode: 'survey', target: null, world: null }).tone).toBe('neutral');
    expect(operationAdvice({ mode: 'survey', target: { x: 48, y: 5 }, world: world([]) }).unknownCount).toBeUndefined();
    expect(operationAdvice({ mode: 'infrastructure', target: null, world: null }).heading).toBe('Improve future shifts');
  });
});

describe('Deep Claim public survey usefulness', () => {
  it('counts only unknown cells within the verified footprint and accessible map boundary', () => {
    const target = { x: 0, y: 1 }, quote = { ...preview(target), accessible_depth: 2, survey: { radius: 2, tile_limit: 41 } };
    const advice = operationAdvice({ mode: 'survey', target, world: world([tile(0, 1), tile(1, 1)]), quote });
    expect(advice.unknownCount).toBe(3);
    expect(advice.heading).toBe('Up to 3 new tiles');
    expect(advice.detail).toMatch(/unmined.*no cargo/);
  });

  it('uses the selected crew and duration before review, without assuming maximum geology', () => {
    const worker = phaseThreeSnapshot().workers[0], target = { x: 48, y: 20 };
    worker.stats.geology = 34;
    const input = { mode: 'survey' as const, target, world: world([tile(48, 20)]), workers: [worker] };
    expect(operationAdvice({ ...input, minutes: 20 }).unknownCount).toBe(4);
    expect(operationAdvice({ ...input, minutes: 60 }).unknownCount).toBe(12);
  });

  it('prefers verified survey coverage and reports fully known areas clearly', () => {
    const target = { x: 48, y: 20 }, quote = { ...preview(target), survey: { radius: 1, tile_limit: 3 } };
    const known = [tile(48, 20), tile(47, 20), tile(49, 20), tile(48, 19), tile(48, 21)];
    expect(operationAdvice({ mode: 'survey', target, world: world(known), quote, workers: phaseThreeSnapshot().workers, minutes: 180 }))
      .toMatchObject({ tone: 'caution', heading: 'Already surveyed', unknownCount: 0 });
  });
});

describe('Deep Claim useful infrastructure locations', () => {
  it.each([
    ['pump', 30, /No water risk/],
    ['ventilation', 30, /No gas or deep heat/],
    ['supports', 2, /No delay risk/],
  ] as const)('warns about preparing %s at shallow depth without forbidding it', (project, y, heading) => {
    const target = { x: 48, y };
    expect(operationAdvice({ mode: 'infrastructure', project, target, world: world([tile(48, y)]) }))
      .toMatchObject({ tone: 'caution', heading: expect.stringMatching(heading), detail: expect.stringContaining('prepares nearby future work') });
  });

  it('recognizes known deeper ground inside coverage, rather than calling every shallow placement useless', () => {
    const target = { x: 48, y: 97 };
    const advice = operationAdvice({ mode: 'infrastructure', project: 'pump', target, world: world([tile(48, 97), tile(48, 101)]) });
    expect(advice).toMatchObject({ tone: 'useful', heading: 'Reduce water delays nearby' });
  });

  it('recognizes ventilation covering known deep heat despite a zero-delay build site', () => {
    const target = { x: 48, y: 596 }, quote = preview(target);
    quote.conditions!.incident_chance_percent = 0;
    const advice = operationAdvice({ mode: 'infrastructure', project: 'ventilation', target, world: world([tile(48, 596), tile(48, 601)]), quote });
    expect(advice).toMatchObject({ tone: 'useful', heading: 'Protect deep mining from heat' });
  });

  it('warns when equal or stronger installed protection covers all nearby known ground', () => {
    const target = { x: 48, y: 150 }, existing = structure('supports', target);
    const advice = operationAdvice({ mode: 'infrastructure', project: 'supports', target, world: world([tile(48, 150), tile(49, 150)]), infrastructure: [existing] });
    expect(advice).toMatchObject({ tone: 'caution', heading: 'Already protected here' });
    expect(advice.detail).toMatch(/does not stack/);
  });

  it('does not treat unfinished construction as installed protection', () => {
    const target = { x: 48, y: 150 }, building = { ...structure('supports', target), status: 'building' as const, installed_at: null };
    expect(operationAdvice({ mode: 'infrastructure', project: 'supports', target, world: world([tile(48, 150)]), infrastructure: [building] }).tone).toBe('useful');
  });

  it('warns about zero current delay risk rather than promising additional risk reduction', () => {
    const target = { x: 48, y: 150 }, quote = preview(target);
    quote.conditions!.incident_chance_percent = 0;
    expect(operationAdvice({ mode: 'infrastructure', project: 'pump', target, world: world([tile(48, 150)]), quote }))
      .toMatchObject({ tone: 'caution', heading: 'This site already has no delay risk' });
  });

  it('bounds the local reduction by current chance and subtracts existing protection', () => {
    const target = { x: 48, y: 150 }, quote = preview(target);
    quote.conditions!.incident_chance_percent = 3;
    quote.installation = { key: 'pump', grade: 2, radius: 8, strength: 8 };
    const existing = structure('pump', target, 6);
    expect(operationAdvice({ mode: 'infrastructure', project: 'pump', target, world: world([tile(48, 150)]), quote, infrastructure: [existing] }).heading)
      .toBe('Up to 2 percentage points less delay risk here');
  });
});

describe('Deep Claim honest rail advice', () => {
  it('describes more productive time in the same shift without guaranteeing extra cargo', () => {
    const target = { x: 48, y: 100 };
    const advice = operationAdvice({ mode: 'infrastructure', project: 'rail', target, world: world([tile(48, 100)]), quote: preview(target) });
    expect(advice).toMatchObject({ tone: 'useful', heading: 'Less travel, more time working' });
    expect(advice.detail).toMatch(/Shift length stays the same.*depends on the deposit and capacity/);
  });

  it('warns when the quoted trip is already at the twenty-second travel floor', () => {
    const target = { x: 48, y: 3 }, quote = preview(target);
    quote.stages = [{ key: 'travel', duration_seconds: 20 }, { key: 'return', duration_seconds: 20 }];
    expect(operationAdvice({ mode: 'infrastructure', project: 'rail', target, world: world([tile(48, 3)]), quote }))
      .toMatchObject({ tone: 'caution', heading: 'Travel is already at its minimum' });
  });

  it('detects redundant route coverage and ignores off-route proximity', () => {
    const target = { x: 48, y: 100 }, quote = preview(target), existing = structure('rail', target, 40);
    expect(operationAdvice({ mode: 'infrastructure', project: 'rail', target, world: world([tile(48, 100)]), quote, infrastructure: [existing] }).tone).toBe('caution');
    quote.route = [{ x: 0, y: 1 }, { x: 0, y: 2 }];
    expect(operationAdvice({ mode: 'infrastructure', project: 'rail', target, world: world([tile(48, 100)]), quote }).heading).toBe('No added rail benefit on this route');
  });

  it('leaves every public input untouched and returns no authority fields', () => {
    const target = { x: 48, y: 100 }, quote = preview(target);
    const input = { mode: 'infrastructure' as const, project: 'rail' as const, target, world: world([tile(48, 100)]), quote, infrastructure: [structure('rail', { x: 48, y: 1 })] };
    const before = structuredClone(input), advice = operationAdvice(input);
    expect(input).toEqual(before);
    expect(Object.keys(advice).sort()).toEqual(['detail', 'heading', 'tone']);
  });
});
