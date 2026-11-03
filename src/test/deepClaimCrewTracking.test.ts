import { describe, expect, it } from 'vitest';
import { crewFootPoint, type CrewPresentation, type CrewWorkerPresentation } from '@/lib/deepClaim/crewPresentation';
import { layoutCrewMarkers, trackingCamera } from '@/components/deepClaim/renderer/crewTracking';
import { constrainCamera, mineToScreen, screenToMine, type DeepClaimCamera, type ViewportSize } from '@/components/deepClaim/renderer/camera';

const viewport = { width: 320, height: 240 };
const bounds = { width: 96, depth: 999 };
const camera = { x: 48, y: 20, scale: 24 };
function crew(id = 'crew-a', x = 48, y = 20, number = 1): CrewPresentation {
  return { job_id: id, number, x, y, worker_ids: ['a', 'b', 'c'], target: { x: 88, y: 900 }, stage: 'travel', mode: 'extract', awaiting_sync: false };
}
function worker(id: string, x: number, y: number, job_id: string | null = 'crew-a'): CrewWorkerPresentation {
  return { worker_id: id, job_id, name: id, specialty: 'miner', x, y, stage: 'travel', progress: .5, elapsed_seconds: 20, pose: 'walk', facing: 1, animation_phase_ms: 0, moving: true, awaiting_sync: false, crew_slot: 0, crew_number: 1 };
}
function crewAtScreen(id: string, x: number, y: number, number = 1): CrewPresentation {
  const point = screenToMine({ x, y }, camera, viewport);
  return crew(id, point.x - .5, point.y - .94, number);
}
function expectFitsWorkers(workers: CrewWorkerPresentation[], view: ViewportSize, followed: DeepClaimCamera) {
  for (const person of workers) {
    const top = mineToScreen(person, followed, view);
    const bottom = mineToScreen({ x: person.x + 1, y: person.y + 1 }, followed, view);
    expect(top.x).toBeGreaterThanOrEqual(12 - .001);
    expect(top.y).toBeGreaterThanOrEqual(12 + Math.min(60, view.height / 3) - .001);
    expect(bottom.x).toBeLessThanOrEqual(view.width - 12 - Math.min(50, view.width / 5) + .001);
    expect(bottom.y).toBeLessThanOrEqual(view.height - 12 + .001);
  }
}

describe('Deep Claim disclosed crew following', () => {
  it('centers only this crew’s shown workers and never jumps to the fog target or unrelated staff', () => {
    const people = [worker('a', 48, 20), worker('b', 47, 20), worker('c', 46, 20), worker('other', 80, 800, 'another-job'), worker('idle', 1, 0, null)];
    const result = trackingCamera(crew(), people, camera, viewport, bounds);
    expect(result.y).toBeLessThan(25);
    expect(result.x).toBeLessThan(52);
    expect(result.scale).toBe(34);
    expectFitsWorkers(people.slice(0, 3), viewport, result);
  });

  it.each([{ width: 280, height: 210 }, { width: 180, height: 150 }])('fits three miners below the HUD and away from controls in a $width×$height viewport', view => {
    const people = [worker('a', 47, 100), worker('b', 48, 101), worker('c', 49, 102)];
    const result = trackingCamera(crew('crew-a', 47, 100), people, camera, view, bounds);
    expect(result.scale).toBeGreaterThanOrEqual(12);
    expect(result.scale).toBeLessThanOrEqual(34);
    expectFitsWorkers(people, view, result);
  });

  it('zooms out to include a spread-out group while retaining the minimum readable scale', () => {
    const people = [worker('a', 40, 100), worker('b', 47, 100), worker('c', 54, 100)];
    const view = { width: 280, height: 210 };
    const result = trackingCamera(crew('crew-a', 40, 100), people, camera, view, bounds);
    expect(result.scale).toBeLessThan(20);
    expectFitsWorkers(people, view, result);
    expect(trackingCamera(crew(), [worker('a', 1, 20), worker('b', 90, 20)], camera, view, bounds).scale).toBe(12);
  });

  it('tracks fractional route movement continuously without favoring a different member', () => {
    const people = [worker('a', 47, 100), worker('b', 47, 101), worker('c', 47, 102)];
    const before = trackingCamera(crew('crew-a', 47, 100), people, camera, viewport, bounds);
    const after = trackingCamera(crew('crew-a', 47.25, 100.5), people.map(person => ({ ...person, x: person.x + .25, y: person.y + .5 })), camera, viewport, bounds);
    expect(after.x - before.x).toBeCloseTo(.25, 8);
    expect(after.y - before.y).toBeCloseTo(.5, 8);
    expect(after.scale).toBe(before.scale);
  });

  it('fits the full Surface bodies above ground rather than framing empty space below their feet', () => {
    const people = [worker('a', 47, 0), worker('b', 48, 0), worker('c', 49, 0)];
    const result = trackingCamera(crew('crew-a', 47, 0), people, camera, viewport, bounds);
    for (const person of people) {
      const head = mineToScreen({ x: person.x, y: -1.4 }, result, viewport);
      const foot = mineToScreen({ x: person.x + 1, y: .1 }, result, viewport);
      expect(head.y).toBeGreaterThanOrEqual(72);
      expect(foot.y).toBeLessThanOrEqual(viewport.height - 12);
      expect(head.x).toBeGreaterThanOrEqual(12);
      expect(foot.x).toBeLessThanOrEqual(viewport.width - 62);
    }
  });

  it('moves continuously when a crew first enters the shaft and crosses the underground size boundary', () => {
    for (const [startY, endY] of [[0, .001], [.999, 1.001]]) {
      const before = trackingCamera(crew('crew-a', 48, startY), [worker('a', 48, startY)], camera, viewport, bounds);
      const after = trackingCamera(crew('crew-a', 48, endY), [worker('a', 48, endY)], camera, viewport, bounds);
      expect(Math.abs(after.y - before.y)).toBeLessThan(.01);
      expect(Math.abs(after.x - before.x)).toBeLessThan(.01);
      expect(after.scale).toBe(before.scale);
    }
  });

  it('falls back to the safe presented leader and constrains world edges without mutating inputs', () => {
    const leader = crew('crew-a', 95, 998), people = [worker('foreign', 1, 1, 'other')];
    const current = { ...camera, minimumScale: 3 }, original = structuredClone({ leader, people, current, viewport, bounds });
    const result = trackingCamera(leader, people, current, viewport, bounds);
    expect(result).toEqual(constrainCamera(result, viewport, bounds));
    expect(result.minimumScale).toBe(3);
    expect(result.y).toBeGreaterThan(990);
    expect({ leader, people, current, viewport, bounds }).toEqual(original);
  });

  it('bounds invalid presentation coordinates and inherited zoom limits to finite camera output', () => {
    const result = trackingCamera(crew(), [worker('invalid', NaN, Infinity)], { x: NaN, y: Infinity, scale: NaN, minimumScale: 90 }, viewport, bounds);
    expect(Number.isFinite(result.x) && Number.isFinite(result.y) && Number.isFinite(result.scale)).toBe(true);
    expect(result.scale).toBeLessThanOrEqual(34);
    expect(result.scale).toBeGreaterThanOrEqual(12);
  });
});

describe('Deep Claim reachable crew markers', () => {
  it('anchors a lone marker above the displayed leader’s feet', () => {
    const leader = crewAtScreen('a', 160, 120);
    expect(layoutCrewMarkers([leader], camera, viewport)).toEqual([{ crew: leader, center: { x: 160, y: 90 } }]);
  });

  it('anchors Surface labels to ground-level feet and keeps them continuous on entering the shaft', () => {
    const surfaceCamera = { ...camera, y: 0 };
    const atGround = layoutCrewMarkers([crew('a', 48, 0)], surfaceCamera, viewport)[0].center;
    const entering = layoutCrewMarkers([crew('a', 48, .001)], surfaceCamera, viewport)[0].center;
    expect(atGround).toEqual({ x: 172, y: 90 });
    expect(entering.y - atGround.y).toBeCloseTo(.001 * 1.94 * surfaceCamera.scale, 8);
    expect(entering.x).toBe(atGround.x);
  });

  it('separates seven colocated crews into reachable lanes below the reserved HUD', () => {
    const crews = Array.from({ length: 7 }, (_, index) => crewAtScreen(`job-${index}`, 160, 120, index + 1));
    const result = layoutCrewMarkers(crews, camera, viewport, { topInset: 56 });
    expect(result).toHaveLength(7);
    for (let index = 0; index < result.length; index++) {
      const center = result[index].center;
      expect(center.x - 27).toBeGreaterThanOrEqual(6);
      expect(center.x + 27).toBeLessThanOrEqual(viewport.width - 6);
      expect(center.y - 22).toBeGreaterThanOrEqual(56 + 6);
      expect(center.y + 22).toBeLessThanOrEqual(viewport.height - 6);
      for (const other of result.slice(index + 1)) expect(Math.abs(center.x - other.center.x) >= 60 || Math.abs(center.y - other.center.y) >= 50).toBe(true);
    }
    expect(layoutCrewMarkers([...crews].reverse(), camera, viewport, { topInset: 56 })).toEqual(result);
  });

  it('clamps near-edge labels but omits crews outside the viewport margin', () => {
    const crews = [crewAtScreen('top-left', 0, 0), crewAtScreen('bottom-right', 320, 240, 2), crewAtScreen('near', -40, 120, 3), crewAtScreen('far', -60, 120, 4)];
    const result = layoutCrewMarkers(crews, camera, viewport, { topInset: 56 });
    expect(result.map(item => item.crew.job_id)).toEqual(['top-left', 'bottom-right', 'near']);
    expect(result[0].center).toEqual({ x: 33, y: 84 });
    expect(result[1].center).toEqual({ x: 287, y: 210 });
  });

  it('keeps markers bounded, deduplicates job IDs and never modifies the camera or crew DTOs', () => {
    const crews = Array.from({ length: 20 }, (_, index) => crewAtScreen(`job-${index}`, 160, 120, index + 1));
    crews.unshift(crews[0]);
    const original = structuredClone({ crews, camera, viewport });
    const result = layoutCrewMarkers(crews, camera, viewport);
    expect(result).toHaveLength(7);
    expect(new Set(result.map(item => item.crew.job_id)).size).toBe(7);
    expect({ crews, camera, viewport }).toEqual(original);
    expect(result[0].crew).toBe(crews[0]);
  });

  it('moves two nearby labels clear of the real top-right control rectangle without wasting the entire right edge', () => {
    const view = { width: 320, height: 300 };
    const crews = [{ x: 280, y: 70 }, { x: 285, y: 75 }].map((point, index) => {
      const shown = screenToMine(point, camera, view);
      return crew(`close-${index}`, shown.x - .5, shown.y - .94, index + 1);
    });
    const reservedRects = [{ left: 210, top: 0, right: 320, bottom: 110 }], original = structuredClone({ crews, reservedRects });
    const result = layoutCrewMarkers(crews, camera, view, { reservedRects });
    expect(result).toHaveLength(2);
    for (const { center } of result) expect(center.x + 27 <= 210 - 6 || center.y - 22 >= 110 + 6).toBe(true);
    expect(Math.abs(result[0].center.x - result[1].center.x) >= 60 || Math.abs(result[0].center.y - result[1].center.y) >= 50).toBe(true);
    expect(result.some(item => item.center.x > 210)).toBe(true);
    expect({ crews, reservedRects }).toEqual(original);
    expect(layoutCrewMarkers(crews, camera, view, { reservedRects: [{ left: 0, top: 0, right: 320, bottom: 300 }] })).toEqual([]);
  });

  it.each([{ width: 320, height: 195 }, { width: 844, height: 100 }])('keeps both close crews selectable without covering physical bodies or controls in $width×$height', view => {
    const followed = { ...camera, scale: 34 };
    const crews = [0, 1].map(index => {
      const foot = screenToMine({ x: (view.width >= 700 ? view.width - 130 : 150) + index * 8, y: view.height / 2 + 20 }, followed, view);
      return crew(`visible-${index}`, foot.x - .5, foot.y - .94, index + 1);
    });
    const bodies = crews.map(leader => {
      const foot = mineToScreen(crewFootPoint(leader), followed, view);
      return { left: foot.x - .25 * followed.scale, right: foot.x + .25 * followed.scale, top: foot.y - .98 * followed.scale, bottom: foot.y };
    });
    const controls = { left: view.width - 200, right: view.width, top: 0, bottom: 60 };
    const result = layoutCrewMarkers(crews, followed, view, { reservedRects: [controls, ...bodies] });
    expect(result).toHaveLength(2);
    for (const { center } of result) {
      const target = { left: center.x - 27, right: center.x + 27, top: center.y - 22, bottom: center.y + 22 };
      expect(target.left).toBeGreaterThanOrEqual(6);
      expect(target.right).toBeLessThanOrEqual(view.width - 6);
      expect(target.top).toBeGreaterThanOrEqual(6);
      expect(target.bottom).toBeLessThanOrEqual(view.height - 6);
      for (const reserved of [controls, ...bodies]) expect(target.right <= reserved.left - 6 || target.left >= reserved.right + 6 || target.bottom <= reserved.top - 6 || target.top >= reserved.bottom + 6).toBe(true);
    }
    expect(Math.abs(result[0].center.x - result[1].center.x) >= 60 || Math.abs(result[0].center.y - result[1].center.y) >= 50).toBe(true);
  });

  it.each([58, 188])('retains shallow crews beside full painted body envelopes with a real %ipx map height', height => {
    const view = { width: 844, height };
    const crews = [crew('near-a', 49, 1), crew('near-b', 47, 1, 2)];
    const people = [worker('a', 49, 1, 'near-a'), worker('b', 48, 1, 'near-a'), worker('c', 47, 1, 'near-b')];
    const followed = trackingCamera(crews[0], people, camera, view, bounds);
    const bodies = people.map(person => {
      const foot = mineToScreen(crewFootPoint(person), followed, view), bodyScale = .7;
      return { left: foot.x - .75 * bodyScale * followed.scale, right: foot.x + bodyScale * followed.scale, top: foot.y - 1.4 * bodyScale * followed.scale, bottom: foot.y + .12 * followed.scale };
    });
    const controls = { left: 627, right: 828, top: 12, bottom: 66 };
    const result = layoutCrewMarkers(crews, followed, view, { reservedRects: [...bodies, controls] });
    expect(result.map(item => item.crew.job_id)).toEqual(['near-a', 'near-b']);
    for (const { center } of result) {
      const target = { left: center.x - 27, right: center.x + 27, top: center.y - 22, bottom: center.y + 22 };
      expect(target.top).toBeGreaterThanOrEqual(6);
      expect(target.bottom).toBeLessThanOrEqual(height - 6);
      for (const reserved of [...bodies, controls]) expect(target.right <= reserved.left - 6 || target.left >= reserved.right + 6 || target.bottom <= reserved.top - 6 || target.top >= reserved.bottom + 6).toBe(true);
    }
  });

  it('never overlaps buttons when a tiny viewport cannot fit every crew', () => {
    const crews = Array.from({ length: 7 }, (_, index) => crewAtScreen(`job-${index}`, 160, 120, index + 1));
    const result = layoutCrewMarkers(crews, camera, { width: 320, height: 120 }, { topInset: 56 });
    for (let index = 0; index < result.length; index++) for (const other of result.slice(index + 1)) {
      expect(Math.abs(result[index].center.x - other.center.x) >= 60 || Math.abs(result[index].center.y - other.center.y) >= 50).toBe(true);
    }
    expect(layoutCrewMarkers(crews, camera, { width: 40, height: 40 })).toEqual([]);
    expect(layoutCrewMarkers(crews, { ...camera, scale: NaN }, viewport)).toEqual([]);
  });
});
