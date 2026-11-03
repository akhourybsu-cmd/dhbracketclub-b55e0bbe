/** Presentation only: explain committed public terrain and verified quotes; never authorize or award work. */
import { infrastructureQuote, routeTransportBonus, selectSurveyTiles, surveyPlan } from './field';
import type {
  DeepClaimDuration, DeepClaimInfrastructure, DeepClaimInfrastructureKey, DeepClaimMode,
  DeepClaimPoint, DeepClaimPreview, DeepClaimWorker, DeepClaimWorld,
} from './types';

export interface DeepClaimOperationAdvice {
  heading: string;
  detail: string;
  tone: 'useful' | 'caution' | 'neutral';
  /** Current unknown cells inside this public survey footprint, not a promise of ore. */
  unknownCount?: number;
}

export interface DeepClaimOperationAdviceInput {
  mode: DeepClaimMode;
  target: DeepClaimPoint | null;
  world: DeepClaimWorld | null;
  infrastructure?: readonly DeepClaimInfrastructure[];
  quote?: DeepClaimPreview | null;
  project?: DeepClaimInfrastructureKey;
  minutes?: DeepClaimDuration;
  workers?: readonly DeepClaimWorker[];
}

const distance = (a: DeepClaimPoint, b: DeepClaimPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const average = (workers: readonly DeepClaimWorker[], stat: 'geology' | 'engineering') =>
  Math.floor(workers.reduce((sum, worker) => sum + worker.stats[stat], 0) / workers.length);

/** Prefer useful public scouting coverage without generating terrain or overriding an explicit player choice.
 * Build the known index once: O(known tiles + sites * bounded survey footprint).
 */
export function preferredSurveySite(
  sites: readonly DeepClaimPoint[], world: DeepClaimWorld | null,
  workers: readonly DeepClaimWorker[], minutes: DeepClaimDuration = 20,
): DeepClaimPoint | null {
  const fallback = sites[0] ?? null;
  if (!fallback || !world || !workers.length) return fallback;
  const plan = surveyPlan(minutes, average(workers, 'geology'), workers.filter(worker => worker.traits.includes('ore_eye')).length);
  const known = new Set(world.tiles.map(point => `${point.x}:${point.y}`));
  for (const site of sites) {
    for (let x = Math.max(0, site.x - plan.radius); x <= Math.min(world.width - 1, site.x + plan.radius); x++) {
      for (let y = Math.max(1, site.y - plan.radius); y <= Math.min(world.max_depth, site.y + plan.radius); y++) {
        if (distance(site, { x, y }) <= plan.radius && !known.has(`${x}:${y}`)) return site;
      }
    }
  }
  return fallback;
}

/** A deliberately advisory result: future preparation can be valid even when a site has no current gain. */
export function operationAdvice({
  mode, target, world, infrastructure = [], quote, project, minutes = 20, workers = [],
}: DeepClaimOperationAdviceInput): DeepClaimOperationAdvice {
  if (mode === 'explore') return {
    heading: 'Open a new route',
    detail: 'Dig into unknown ground and uncover deposits. May also bring back ore.',
    tone: 'useful',
  };
  if (mode === 'extract') return {
    heading: 'Bring ore home',
    detail: 'Mine a known deposit for selling or production. Empty it to open the passage beyond.',
    tone: 'useful',
  };
  if (mode === 'survey') {
    if (!target || !world) return {
      heading: 'See what lies nearby',
      detail: 'Choose an open passage to scout. A survey reveals deposits without mining them.',
      tone: 'neutral',
    };
    const plan = quote?.survey ?? (workers.length ? surveyPlan(minutes, average(workers, 'geology'), workers.filter(worker => worker.traits.includes('ore_eye')).length) : null);
    if (!plan) return {
      heading: 'Scout before you dig',
      detail: 'Choose a crew to see its reach. Surveys reveal ground; they bring back no cargo.',
      tone: 'neutral',
    };
    const unknownCount = selectSurveyTiles(target, world.tiles, Math.min(world.max_depth, quote?.accessible_depth ?? world.max_depth), plan).length;
    return unknownCount ? {
      heading: `Up to ${unknownCount} new ${unknownCount === 1 ? 'tile' : 'tiles'}`,
      detail: 'Learn where to dig next. The ground stays unmined, and the crew brings back no cargo.',
      tone: 'useful', unknownCount,
    } : {
      heading: 'Already surveyed',
      detail: 'Nothing new within this crew’s reach. Choose another site or a wider survey.',
      tone: 'caution', unknownCount,
    };
  }
  if (!project || !target) return {
    heading: 'Improve future shifts',
    detail: 'Choose a project and an open passage. Improvements take effect when the crew returns.',
    tone: 'neutral',
  };

  const installation = quote?.installation?.key === project ? quote.installation
    : infrastructureQuote(project, minutes, workers.length ? average(workers, 'engineering') : 1).installation;
  const proposed: DeepClaimInfrastructure = {
    ...installation, ...target, id: '__proposed_advice__', status: 'installed', job_id: '', installed_at: null,
  };
  const installed = infrastructure.filter(item => item.status === 'installed');
  const coveredKnown = world?.tiles.filter(tile => distance(tile, target) <= installation.radius) ?? [];

  if (project === 'rail') {
    if (quote?.route.length) {
      const before = routeTransportBonus(quote.route, installed);
      const after = routeTransportBonus(quote.route, [...installed, proposed]);
      if (after <= before) return {
        heading: 'No added rail benefit on this route',
        detail: 'This project adds no transport bonus to the quoted route. It may serve other nearby routes.',
        tone: 'caution',
      };
      const travel = quote.stages.filter(stage => stage.key === 'travel' || stage.key === 'return');
      if (travel.length === 2 && travel.every(stage => stage.duration_seconds <= 20)) return {
        heading: 'Travel is already at its minimum',
        detail: 'Rail cannot shorten this route’s travel further. A longer route may benefit more.',
        tone: 'caution',
      };
      return {
        heading: 'Less travel, more time working',
        detail: 'Helps future shifts using this route. Shift length stays the same; extra cargo depends on the deposit and capacity.',
        tone: 'useful',
      };
    }
    return {
      heading: 'Put rail beside a busy route',
      detail: 'Covered travel leaves more time to mine within the same shift. Cargo still has a capacity limit.',
      tone: 'neutral',
    };
  }

  const strongerHere = installed.some(item => item.key === project && distance(item, target) <= item.radius && item.strength >= installation.strength);
  const extendsKnownCoverage = coveredKnown.some(tile => !installed.some(item => item.key === project && distance(item, tile) <= item.radius && item.strength >= installation.strength));
  if (strongerHere && !extendsKnownCoverage) return {
    heading: 'Already protected here',
    detail: 'Equal or stronger coverage serves the known ground here. The same protection does not stack.',
    tone: 'caution',
  };

  const knownHeat = project === 'ventilation' && (target.y >= 600 || coveredKnown.some(tile => tile.y >= 600));
  const relevantDepth = project === 'pump' ? 100 : project === 'ventilation' ? 50 : 8;
  const hazardNearby = target.y >= relevantDepth || coveredKnown.some(tile => tile.y >= relevantDepth);
  if (!hazardNearby && !knownHeat) return {
    heading: project === 'pump' ? 'No water risk here yet' : project === 'ventilation' ? 'No gas or deep heat here yet' : 'No delay risk this close to the surface',
    detail: 'This prepares nearby future work. Choose a deeper site for an immediate benefit.',
    tone: 'caution',
  };
  if (knownHeat) return {
    heading: 'Protect deep mining from heat',
    detail: 'Ventilation helps preserve work time in covered deep ground and reduces gas delays. Future shifts benefit after installation.',
    tone: 'useful',
  };
  if (quote?.conditions?.incident_chance_percent === 0) return {
    heading: 'This site already has no delay risk',
    detail: 'Extra protection may help other nearby work, but it cannot reduce this site’s current risk below zero.',
    tone: 'caution',
  };
  const relevantHere = target.y >= relevantDepth;
  if (relevantHere && quote?.conditions && !strongerHere) {
    const previousStrength = installed.filter(item => item.key === project && distance(item, target) <= item.radius)
      .reduce((best, item) => Math.max(best, item.strength), 0);
    const reduction = Math.min(quote.conditions.incident_chance_percent, Math.max(0, installation.strength - previousStrength));
    if (reduction > 0) return {
      heading: `Up to ${reduction} percentage points less delay risk here`,
      detail: 'Applies to future shifts after installation. Incidents delay the crew; they do not destroy cargo.',
      tone: 'useful',
    };
  }
  return {
    heading: project === 'pump' ? 'Reduce water delays nearby' : project === 'ventilation' ? 'Reduce gas delays nearby' : 'Reduce rockfall delays nearby',
    detail: 'Protects covered future shifts after installation. The same protection does not stack.',
    tone: strongerHere ? 'neutral' : 'useful',
  };
}
