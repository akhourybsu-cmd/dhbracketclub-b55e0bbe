/** Renderer-only crew staging. Uses disclosed routes and excavated cells; never advances an expedition. */
import { indexRevealedWorld, pointAlongPublicPath } from './visualProjection';
import type {
  DeepClaimExpedition, DeepClaimMode, DeepClaimPoint, DeepClaimSnapshot, DeepClaimSpecialty,
  DeepClaimTile, DeepClaimWorker,
} from './types';

export type CrewWorkerPose = 'idle' | 'walk' | 'mine' | 'haul' | 'setup' | 'survey' | 'build';
export interface CrewWorkerPresentation extends DeepClaimPoint {
  worker_id: string;
  job_id: string | null;
  name: string;
  specialty: DeepClaimSpecialty;
  stage: DeepClaimExpedition['stage'] | 'idle';
  progress: number;
  elapsed_seconds: number;
  pose: CrewWorkerPose;
  facing: -1 | 1;
  animation_phase_ms: number;
  moving: boolean;
  awaiting_sync: boolean;
  crew_slot: number;
  crew_number: number | null;
}
export interface CrewPresentation extends DeepClaimPoint {
  job_id: string;
  number: number;
  mode: DeepClaimMode;
  worker_ids: string[];
  target: DeepClaimPoint;
  stage: DeepClaimExpedition['stage'];
  awaiting_sync: boolean;
}
export interface CrewPresentationResult {
  workers: CrewWorkerPresentation[];
  crews: CrewPresentation[];
}

/** Continuous display anchor between the surface and the first underground cell; route coordinates stay unchanged. */
export function crewFootPoint(point: DeepClaimPoint): DeepClaimPoint {
  return { x: point.x + .5, y: point.y <= 0 ? 0 : point.y < 1 ? point.y * 1.94 : point.y + .94 };
}

interface CrewPlan {
  job: DeepClaimExpedition;
  number: number;
  members: DeepClaimWorker[];
  start: number;
  end: number;
}
interface SafeRoute {
  points: DeepClaimPoint[];
  total: number;
  horizontal: { from: number; to: number; facing: -1 | 1 }[];
}
interface CrewLayout { route: SafeRoute; spots: DeepClaimPoint[] }
const EMPTY_TILES: DeepClaimTile[] = [];
const EMPTY_KNOWN = new Map<string, DeepClaimTile>();
const key = (point: DeepClaimPoint) => `${Math.floor(point.x)}:${Math.floor(point.y)}`;
const distance = (a: DeepClaimPoint, b: DeepClaimPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const sign = (number: number): -1 | 1 => number < 0 ? -1 : 1;
const compareIds = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
const plansByJobs = new WeakMap<DeepClaimExpedition[], WeakMap<DeepClaimWorker[], CrewPlan[]>>();
const routesByTiles = new WeakMap<DeepClaimTile[], WeakMap<DeepClaimPoint[], SafeRoute>>();
const layoutsByTiles = new WeakMap<DeepClaimTile[], WeakMap<CrewPlan[], Map<string, CrewLayout>>>();

/** Stable and deliberately cosmetic; reload does not restart every worker on the same frame. */
function animationPhase(id: string): number {
  let value = 2166136261;
  for (let index = 0; index < id.length; index++) value = Math.imul(value ^ id.charCodeAt(index), 16777619);
  return (value >>> 0) % 880;
}
function crewPlans(snapshot: DeepClaimSnapshot): CrewPlan[] {
  let byWorkers = plansByJobs.get(snapshot.expeditions);
  if (!byWorkers) { byWorkers = new WeakMap(); plansByJobs.set(snapshot.expeditions, byWorkers); }
  const cached = byWorkers.get(snapshot.workers);
  if (cached) return cached;
  const byId = new Map(snapshot.workers.map(worker => [worker.id, worker]));
  // Cosmetic ordinals include retained history, so a companion finishing does not renumber this crew.
  // They are not persistent company-wide IDs once older history leaves the public snapshot.
  const ordered = [...snapshot.expeditions]
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at) || compareIds(a, b));
  const plans: CrewPlan[] = [];
  for (let ordinal = 0; ordinal < ordered.length; ordinal++) {
    const job = ordered[ordinal];
    if (job.status !== 'active') continue;
    const stage = job.stages.find(entry => entry.key === job.stage);
    if (!stage) continue;
    const stat = job.mode === 'survey' ? 'geology' : job.mode === 'infrastructure' ? 'engineering' : 'mining';
    const members = job.worker_ids.map(id => byId.get(id)).filter((worker): worker is DeepClaimWorker => !!worker && worker.assigned_job_id === job.id)
      .sort((a, b) => b.stats[stat] - a.stats[stat] || compareIds(a, b));
    if (!members.length) continue;
    plans.push({ job, members, number: ordinal + 1, start: Date.parse(stage.starts_at), end: Date.parse(stage.ends_at) });
  }
  byWorkers.set(snapshot.workers, plans);
  return plans;
}
function open(point: DeepClaimPoint, known: ReadonlyMap<string, DeepClaimTile>): boolean {
  return point.x >= 0 && point.x < 96 && point.y >= 0 && (point.y === 0 || known.get(key(point))?.remaining === 0);
}

/** Stop at the last disclosed open approach, including on compressed long shaft paths. */
function safeRoute(path: DeepClaimPoint[], tiles: DeepClaimTile[], known: ReadonlyMap<string, DeepClaimTile>): SafeRoute {
  let byPath = routesByTiles.get(tiles);
  if (!byPath) { byPath = new WeakMap(); routesByTiles.set(tiles, byPath); }
  const cached = byPath.get(path);
  if (cached) return cached;
  const points: DeepClaimPoint[] = [], horizontal: SafeRoute['horizontal'] = [];
  let total = 0;
  const start = path[0] ?? { x: 48, y: 0 };
  if (open(start, known)) points.push({ ...start });
  route: for (let index = 1; index < path.length && points.length; index++) {
    const from = path[index - 1], to = path[index], steps = distance(from, to);
    // Authoritative mine routes are orthogonal. Do not invent an elbow for malformed input.
    if (from.x !== to.x && from.y !== to.y) break;
    const dx = Math.sign(to.x - from.x), dy = Math.sign(to.y - from.y);
    for (let step = 1; step <= steps; step++) {
      const next = { x: from.x + dx * step, y: from.y + dy * step };
      if (!open(next, known)) break route;
      if (dx) horizontal.push({ from: total, to: total + 1, facing: sign(dx) });
      points.push(next); total++;
    }
  }
  if (!points.length) points.push({ x: 48, y: 0 });
  const route = { points, horizontal, total };
  byPath.set(path, route);
  return route;
}
function routePoint(route: SafeRoute, at: number): DeepClaimPoint {
  const entrance = route.points[0];
  if (at < 0) return { x: Math.max(0, entrance.x + at), y: 0 };
  return pointAlongPublicPath(route.points, route.total ? Math.min(route.total, at) / route.total : 0);
}
function routeFacing(route: SafeRoute, at: number, returning: boolean): -1 | 1 {
  if (at < 0) return returning ? -1 : 1;
  const current = route.horizontal.find(segment => at >= segment.from && at <= segment.to);
  if (current) return returning ? sign(-current.facing) : current.facing;
  let last = returning ? route.horizontal.find(segment => segment.from >= at) : undefined;
  if (!returning) for (let index = route.horizontal.length - 1; index >= 0; index--) {
    if (route.horizontal[index].to <= at) { last = route.horizontal[index]; break; }
  }
  return last ? returning ? sign(-last.facing) : last.facing : 1;
}
function workCandidates(route: SafeRoute, known: ReadonlyMap<string, DeepClaimTile>): DeepClaimPoint[] {
  const end = route.points[route.points.length - 1], candidates: DeepClaimPoint[] = [], seen = new Set<string>();
  // A crew stays on its own public approach before using adjacent connected open space.
  for (let index = route.points.length - 1; index >= 0; index--) {
    const point = route.points[index];
    if (distance(end, point) > 3) break;
    if (!seen.has(key(point))) { seen.add(key(point)); candidates.push(point); }
  }
  const queue = [end], visited = new Set([key(end)]);
  for (let index = 0; index < queue.length && index < 49; index++) {
    const point = queue[index];
    for (const next of [{ x: point.x - 1, y: point.y }, { x: point.x + 1, y: point.y }, { x: point.x, y: point.y - 1 }, { x: point.x, y: point.y + 1 }]) {
      if (distance(end, next) > 3 || visited.has(key(next)) || !open(next, known)) continue;
      visited.add(key(next)); queue.push(next);
      if (!seen.has(key(next))) { seen.add(key(next)); candidates.push(next); }
    }
  }
  // Keep a shallow crew underground when nearby connected floor space exists.
  return [...candidates.filter(point => point.y > 0), ...candidates.filter(point => point.y === 0)];
}
function crewLayouts(plans: CrewPlan[], tiles: DeepClaimTile[], known: ReadonlyMap<string, DeepClaimTile>): Map<string, CrewLayout> {
  let byPlan = layoutsByTiles.get(tiles);
  if (!byPlan) { byPlan = new WeakMap(); layoutsByTiles.set(tiles, byPlan); }
  const cached = byPlan.get(plans);
  if (cached) return cached;
  const layouts = new Map<string, CrewLayout>(), occupied = new Map<string, number>();
  for (const plan of plans) {
    const route = safeRoute(plan.job.path, tiles, known), candidates = workCandidates(route, known), spots: DeepClaimPoint[] = [];
    for (let slot = 0; slot < plan.members.length; slot++) {
      const point = candidates.find(candidate => !occupied.has(key(candidate))) ?? candidates[slot % candidates.length] ?? route.points[0];
      const count = occupied.get(key(point)) ?? 0;
      // If open space is exhausted, use small in-cell offsets, never a neighboring wall/fog cell.
      spots.push({ x: point.x + count % 3 * .16, y: point.y + Math.floor(count / 3) % 3 * .02 });
      occupied.set(key(point), count + 1);
    }
    layouts.set(plan.job.id, { route, spots });
  }
  byPlan.set(plans, layouts);
  return layouts;
}
function workPose(worker: DeepClaimWorker, mode: DeepClaimMode, slot: number): CrewWorkerPose {
  if (mode === 'survey') return 'survey';
  if (mode === 'infrastructure') return slot === 0 || worker.specialty === 'engineer' ? 'build' : worker.specialty === 'hauler' ? 'haul' : 'setup';
  if (slot === 0) return 'mine';
  return worker.specialty === 'geologist' || worker.specialty === 'surveyor' ? 'survey' : worker.specialty === 'hauler' ? 'haul' : 'setup';
}

export function projectCrewPresentation(snapshot: DeepClaimSnapshot, at = Date.parse(snapshot.server_now)): CrewPresentationResult {
  const time = Math.max(Date.parse(snapshot.server_now), Number.isFinite(at) ? at : 0);
  const tiles = snapshot.world?.tiles ?? EMPTY_TILES;
  const known = snapshot.world ? indexRevealedWorld(snapshot.world).known : EMPTY_KNOWN;
  const plans = crewPlans(snapshot), layouts = crewLayouts(plans, tiles, known);
  const workers: CrewWorkerPresentation[] = [], crews: CrewPresentation[] = [];
  const assigned = new Set<string>(), movingOccupied: DeepClaimPoint[] = [];
  for (const plan of plans) {
    const { job } = plan, { route, spots } = layouts.get(job.id)!;
    const elapsed = Math.max(0, Math.min(plan.end - plan.start, time - plan.start));
    const progress = plan.end > plan.start ? elapsed / (plan.end - plan.start) : 1;
    const awaiting_sync = time >= plan.end;
    const travel = job.stage === 'travel' || job.stage === 'return';
    const returning = job.stage === 'return';
    // A committed empty seam can finish before the frozen work stage ends. Show cargo support,
    // without declaring a new stage or inferring the private continuation of an exploration job.
    const depletedExtraction = job.mode === 'extract' && job.stage === 'work' && known.get(key(job.target))?.remaining === 0;
    for (let slot = 0; slot < plan.members.length; slot++) {
      const worker = plan.members[slot]; assigned.add(worker.id);
      let point = spots[slot], facing: -1 | 1 = job.target.x === point.x ? routeFacing(route, route.total, false) : sign(job.target.x - point.x);
      if (travel) {
        let along = (returning ? 1 - progress : progress) * route.total - slot;
        point = routePoint(route, along);
        // Several crews may share the shaft. Queue on disclosed route cells instead of overlapping bodies.
        for (let attempt = 0; attempt < 12 && movingOccupied.some(other => distance(other, point) < .75); attempt++) {
          along -= .85; point = routePoint(route, along);
        }
        facing = routeFacing(route, along, returning); movingOccupied.push(point);
      }
      workers.push({
        worker_id: worker.id, job_id: job.id, name: worker.name, specialty: worker.specialty, ...point,
        stage: job.stage, progress, elapsed_seconds: elapsed / 1000,
        pose: travel ? 'walk' : job.stage === 'work' ? depletedExtraction ? slot === 0 || worker.specialty === 'hauler' ? 'haul' : 'setup' : workPose(worker, job.mode, slot) : job.stage === 'haul' ? 'haul' : 'setup',
        facing, animation_phase_ms: animationPhase(worker.id), moving: travel && !awaiting_sync && route.total > 0,
        awaiting_sync, crew_slot: slot, crew_number: plan.number,
      });
    }
    const lead = workers.find(worker => worker.job_id === job.id)!;
    crews.push({ job_id: job.id, number: plan.number, mode: job.mode, worker_ids: plan.members.map(worker => worker.id), x: lead.x, y: lead.y, target: { ...job.target }, stage: job.stage, awaiting_sync });
  }
  let idle = 0;
  for (const worker of [...snapshot.workers].sort(compareIds)) if (!assigned.has(worker.id)) {
    workers.push({ worker_id: worker.id, job_id: null, name: worker.name, specialty: worker.specialty,
      x: 22 + idle * 2, y: 0, stage: 'idle', progress: 0, elapsed_seconds: 0, pose: 'idle', facing: 1,
      animation_phase_ms: animationPhase(worker.id), moving: false, awaiting_sync: false, crew_slot: idle++, crew_number: null });
  }
  return { workers, crews };
}
