import { describe, expect, it, vi } from 'vitest';
import { CanvasFrameScheduler, type CanvasFrameHost } from '@/components/deepClaim/renderer/frameScheduler';
import { indexRevealedWorld, pointAlongPublicPath } from '@/lib/deepClaim/visualProjection';
import { projectWorkers } from '@/lib/deepClaim/world';
import { shareDeepClaimSnapshot } from '@/lib/deepClaim/service';
import { companySnapshot } from './fixtures/deepClaim';
import type { DeepClaimExpedition, DeepClaimPoint } from '@/lib/deepClaim/types';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

function frameHost(hz: number, timestampLag = 0, truncateTimers = false) {
  let now = 0, serial = 0, nextDisplay = 1000 / hz;
  const frames = new Map<number, FrameRequestCallback>(), timers = new Map<number, { callback: () => void; at: number }>();
  const host: CanvasFrameHost = { now: () => now,
    requestFrame: callback => { frames.set(++serial, callback); return serial; }, cancelFrame: id => { frames.delete(id); },
    setTimer: (callback, delay) => { timers.set(++serial, { callback, at: now + Math.max(0, truncateTimers ? Math.floor(delay) : delay) }); return serial; }, clearTimer: id => { timers.delete(id); } };
  function advance(duration: number) {
    const until = now + duration;
    while (nextDisplay <= until || [...timers.values()].some(timer => timer.at <= until)) {
      const soonest = Math.min(nextDisplay, ...[...timers.values()].map(timer => timer.at)); now = soonest;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
      if (nextDisplay <= now) { const ready = [...frames.values()]; frames.clear(); nextDisplay += 1000 / hz; ready.forEach(callback => callback(now - timestampLag)); }
    }
    now = until;
  }
  return { host, advance, pending: () => frames.size + timers.size };
}

describe('Deep Claim sleeping frame scheduler', () => {
  it.each([60, 120])('caps actual paint and RAF wakeups at30/12 on a%ihz display, including repeated input invalidation', hz => {
    for (const reducedGraphics of [false, true]) {
      const clock = frameHost(hz), painted: number[] = [];
      const scheduler = new CanvasFrameScheduler(clock.host, time => painted.push(time));
      scheduler.configure({ enabled: true, reducedMotion: false, reducedGraphics }); scheduler.invalidate();
      for (let tick = 0; tick < 500; tick++) { scheduler.invalidate(); clock.advance(10); }
      const expected = reducedGraphics ? 60 : 150;
      expect(painted.length).toBeGreaterThanOrEqual(expected - 2); expect(painted.length).toBeLessThanOrEqual(expected + 1);
      expect(scheduler.wakeups).toBeLessThanOrEqual(expected + 2);
      expect(scheduler.wakeups).toBe(scheduler.paints);
      scheduler.dispose(); expect(clock.pending()).toBe(0);
    }
  });
  it('keeps timer deadlines on the execution clock when RAF frame timestamps lag by16ms', () => {
    for (const reducedGraphics of [false, true]) {
      const clock = frameHost(60, 16), draw = vi.fn(), scheduler = new CanvasFrameScheduler(clock.host, draw);
      scheduler.configure({ enabled: true, reducedMotion: false, reducedGraphics }); scheduler.invalidate(); clock.advance(5000);
      const expected = reducedGraphics ? 60 : 150;
      expect(scheduler.paints).toBeGreaterThanOrEqual(expected - 2); expect(scheduler.paints).toBeLessThanOrEqual(expected + 1);
      expect(scheduler.wakeups).toBeLessThanOrEqual(scheduler.paints + 2);
      expect(draw.mock.calls[0][0]).toBeCloseTo(1000 / 60 - 16); scheduler.dispose(); expect(clock.pending()).toBe(0);
    }
  });
  it('never requests an early RAF when fractional timers truncate and frame timestamps lag', () => {
    for (const reducedGraphics of [false, true]) {
      const clock = frameHost(60, 16, true), draw = vi.fn(), scheduler = new CanvasFrameScheduler(clock.host, draw);
      scheduler.configure({ enabled: true, reducedMotion: false, reducedGraphics }); scheduler.invalidate();
      for (let tick = 0; tick < 1000; tick++) { clock.advance(5); scheduler.invalidate(); }
      const expected = reducedGraphics ? 60 : 150;
      expect(scheduler.paints).toBeGreaterThanOrEqual(expected - 2); expect(scheduler.paints).toBeLessThanOrEqual(expected + 1);
      expect(scheduler.wakeups).toBe(scheduler.paints);
      scheduler.dispose(); expect(clock.pending()).toBe(0);
    }
  });
  it('renders a single static frame per explicit invalidation and leaves no hidden/inactive timers', () => {
    const clock = frameHost(120), draw = vi.fn(), scheduler = new CanvasFrameScheduler(clock.host, draw);
    scheduler.configure({ enabled: true, reducedMotion: true, reducedGraphics: false }); scheduler.invalidate(); clock.advance(5000);
    expect(draw).toHaveBeenCalledTimes(1); expect(clock.pending()).toBe(0);
    scheduler.invalidate(); scheduler.invalidate(); clock.advance(20); expect(draw).toHaveBeenCalledTimes(2);
    scheduler.configure({ enabled: true, reducedMotion: false, reducedGraphics: false }); scheduler.invalidate(); clock.advance(40);
    scheduler.configure({ enabled: false, reducedMotion: false, reducedGraphics: false }); const before = draw.mock.calls.length;
    expect(clock.pending()).toBe(0); clock.advance(5000); expect(draw).toHaveBeenCalledTimes(before);
    scheduler.configure({ enabled: true, reducedMotion: false, reducedGraphics: false }); scheduler.invalidate(); clock.advance(20);
    expect(draw).toHaveBeenCalledTimes(before + 1); scheduler.dispose(); expect(clock.pending()).toBe(0);
  });
});

describe('Deep Claim public geometry and structural sharing', () => {
  it('reuses the public index across clock-only metadata and replaces it for actual changed terrain', () => {
    const before = companySnapshot(), world = before.world!; const index = indexRevealedWorld(world);
    expect(indexRevealedWorld({ ...world, revision: world.revision + 1 })).toBe(index);
    expect(index.known.size).toBe(world.tiles.length); expect([...index.chunks.values()].flat()).toEqual(world.tiles);
    const changed = { ...world, tiles: world.tiles.map((tile, i) => i ? tile : { ...tile, remaining: Math.max(0, tile.remaining - 1) }) };
    expect(indexRevealedWorld(changed)).not.toBe(index); expect(indexRevealedWorld(world)).toBe(index);
  });
  it('projects a long nonuniform return path without mutation or advancing the declared stage', () => {
    const path: DeepClaimPoint[] = Array.from({ length: 600 }, (_, y) => ({ x: 48, y }));
    path.push({ x: 47, y: 599 }); const original = JSON.stringify(path); Object.freeze(path);
    for (const progress of [0, .1, .25, .5, .75, .9, 1]) {
      const p = pointAlongPublicPath(path, progress), distance = 600 * progress;
      expect(p.x).toBeCloseTo(distance <= 599 ? 48 : 48 - (distance - 599)); expect(p.y).toBeCloseTo(Math.min(599, distance));
    }
    const snapshot = companySnapshot(), start = Date.parse(snapshot.server_now), finish = start + 10000;
    const job = { id: 'return', status: 'active', stage: 'return', worker_ids: [snapshot.workers[0].id], path, target: { x: 47, y: 599 }, stages: [{ key: 'return', starts_at: new Date(start).toISOString(), ends_at: new Date(finish).toISOString() }] } as DeepClaimExpedition;
    snapshot.expeditions = [job]; snapshot.workers[0].assigned_job_id = job.id;
    expect(projectWorkers(snapshot, start)[0]).toMatchObject({ x: 47, y: 599, stage: 'return' });
    expect(projectWorkers(snapshot, start + 5000)[0]).toMatchObject({ x: 48, y: 300, stage: 'return' });
    expect(projectWorkers(snapshot, finish + 100000)[0]).toMatchObject({ x: 48, y: 0, stage: 'return', progress: 1 });
    expect(JSON.stringify(path)).toBe(original); expect(job.status).toBe('active');
  });
  it('shares unchanged subtrees while retaining every accepted authoritative change and identity boundary', () => {
    const before = companySnapshot(); const clockOnly = structuredClone(before); clockOnly.server_now = '2026-11-01T12:00:01Z';
    const shared = shareDeepClaimSnapshot(before, clockOnly); expect(shared).not.toBe(before); expect(shared.world).toBe(before.world); expect(shared.workers).toBe(before.workers);
    const changed = structuredClone(clockOnly); changed.revision++; changed.company!.cash += 15; changed.world!.tiles[0].initial_amount += 3;
    const accepted = shareDeepClaimSnapshot(shared, changed); expect(accepted.revision).toBe(changed.revision); expect(accepted.company!.cash).toBe(changed.company!.cash); expect(accepted.world!.tiles).not.toBe(before.world!.tiles);
    const older = structuredClone(before); expect(shareDeepClaimSnapshot(accepted, older)).toBe(accepted);
    const other = structuredClone(before); other.company!.id = 'other-company'; other.company!.user_id = 'other-user'; expect(shareDeepClaimSnapshot(accepted, other)).toBe(other);
    expect(before.company!.cash).not.toBe(accepted.company!.cash);
  });
});
