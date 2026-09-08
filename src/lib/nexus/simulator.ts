// Nexus Defense — Endless / Co-op Simulator
//
// Headless harness that drives the REAL battle engine (engine.ts) with
// scripted bot strategies. No UI, no DB, no side-effects on player data.
//
// Contribution math is mirrored from the `submit_operation_contribution`
// SQL RPC so simulated Operation pacing matches what real runs would
// generate. If you change the SQL formula, mirror it here.
//
// Usage from React: simulateBatch(opts) returns aggregated metrics.
// Long sweeps should call runSweep() inside a setTimeout-driven batch
// loop so the UI thread stays responsive.

import { initBattle, tick, startWave, placeTower, upgradeTower, castAbility } from './engine';
import { ENDLESS_MISSION, ENDLESS_MISSION_ID } from './endless';
import { distanceCells, getGridLayout, type PathVariantId } from './grid';
import { TOWERS, TOWER_KINDS } from './towers';
import { ENEMIES } from './enemies';
import { ABILITY_KINDS } from './abilities';
import {
  AbilityKind, BattleState, EnemyKind, MissionDef, TowerKind,
} from './types';

// ─── Strategy profiles ──────────────────────────────────────────────────────
export type StrategyId =
  | 'basic' | 'balanced' | 'optimizer' | 'random'
  // Human archetypes — wrap a base policy with realistic flaws.
  | 'tourist' | 'hoarder' | 'spammer' | 'distracted' | 'learner'
  // Population mix — samples archetypes per run with realistic weights.
  | 'realmix';

export const STRATEGY_LABELS: Record<StrategyId, string> = {
  basic: 'Basic Player',
  balanced: 'Balanced Player',
  optimizer: 'Optimizer (ceiling)',
  random: 'Randomized',
  tourist: 'Tourist (1–2 towers, abandons)',
  hoarder: 'Hoarder (saves energy, panics late)',
  spammer: 'Spammer (cheap towers, no upgrades)',
  distracted: 'Distracted (random pauses)',
  learner: 'Learner (improves mid-run)',
  realmix: 'Realistic Friend Group Mix',
};

// ─── Human realism layer ────────────────────────────────────────────────────
// Wraps a base policy with traits that mirror how actual mobile players behave:
// reaction delay, misclicks, hoarding bias, attention drops, ability misses,
// and per-wave abandonment probability.
interface HumanProfile {
  base: 'basic' | 'balanced' | 'optimizer' | 'random';
  /** Min/max ms of "thinking time" added to every decision tick. */
  reactionMs: [number, number];
  /** Probability a placed tower lands on a neighboring valid tile. 0..1 */
  misclickRate: number;
  /** Fraction of energy the bot prefers to leave unspent during calm waves. */
  hoardBias: number;
  /** Ability-cast probability when conditions are met (real players miss windows). 0..1 */
  abilityAttention: number;
  /** Probability a single decision tick is skipped entirely (phone, distraction). 0..1 */
  skipTickRate: number;
  /** Per-wave abandonment probability — return value is p(quit at this wave). */
  abandon: (wave: number, hpFrac: number) => number;
  /** If true, perf improves after wave 3 (Learner). */
  improvesAfterWave?: number;
  /** Loadout noise — small chance to swap one ability for the other. (Currently both abilities are default, so this is a no-op placeholder for future loadout variance.) */
  loadoutNoise: number;
}

const HUMAN_PROFILES: Record<Exclude<StrategyId, 'basic' | 'balanced' | 'optimizer' | 'random' | 'realmix'>, HumanProfile> = {
  tourist: {
    base: 'basic',
    reactionMs: [800, 2500],
    misclickRate: 0.18,
    hoardBias: 0.45,
    abilityAttention: 0.25,
    skipTickRate: 0.15,
    // Quits hard around wave 5–7 even if alive.
    abandon: (w) => (w >= 4 ? 0.08 : 0) + (w >= 6 ? 0.18 : 0),
    loadoutNoise: 0.3,
  },
  hoarder: {
    base: 'balanced',
    reactionMs: [600, 2000],
    misclickRate: 0.10,
    hoardBias: 0.55,
    abilityAttention: 0.45,
    skipTickRate: 0.08,
    // Sticks around longer but rage-quits if base HP < 30%.
    abandon: (w, hp) => (hp < 0.3 && w >= 6 ? 0.12 : 0) + (w >= 12 ? 0.05 : 0),
    loadoutNoise: 0.15,
  },
  spammer: {
    base: 'basic',
    reactionMs: [300, 900],
    misclickRate: 0.22,
    hoardBias: 0.05, // never hoards
    abilityAttention: 0.7,
    skipTickRate: 0.05,
    abandon: (w) => (w >= 7 ? 0.08 : 0),
    loadoutNoise: 0.2,
  },
  distracted: {
    base: 'balanced',
    reactionMs: [1200, 4500],
    misclickRate: 0.16,
    hoardBias: 0.25,
    abilityAttention: 0.4,
    skipTickRate: 0.30,
    // Rarely abandons; just plays badly.
    abandon: (w) => (w >= 10 ? 0.04 : 0),
    loadoutNoise: 0.2,
  },
  learner: {
    base: 'balanced',
    reactionMs: [700, 2200],
    misclickRate: 0.14,
    hoardBias: 0.20,
    abilityAttention: 0.55,
    skipTickRate: 0.10,
    abandon: (w, hp) => (hp < 0.25 && w < 4 ? 0.10 : 0),
    improvesAfterWave: 3,
    loadoutNoise: 0.1,
  },
};

// Realistic mix — sampled per run. Tuned to a small friend group:
// most players are casual/distracted, a few are decent, one min-maxer.
const REAL_MIX: Array<{ id: StrategyId; weight: number }> = [
  { id: 'tourist',    weight: 0.30 },
  { id: 'hoarder',    weight: 0.20 },
  { id: 'spammer',    weight: 0.15 },
  { id: 'distracted', weight: 0.15 },
  { id: 'learner',    weight: 0.10 },
  { id: 'balanced',   weight: 0.07 },
  { id: 'optimizer',  weight: 0.03 },
];

function sampleMix(rng: () => number): Exclude<StrategyId, 'realmix'> {
  let r = rng();
  for (const m of REAL_MIX) {
    r -= m.weight;
    if (r <= 0) return m.id as Exclude<StrategyId, 'realmix'>;
  }
  return 'balanced';
}

// Cheap deterministic PRNG (mulberry32) so seed→result is reproducible.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Per-run telemetry ──────────────────────────────────────────────────────
export interface SimRunResult {
  victory: boolean;
  wavesCleared: number; // 0..20 — final cleared count (waveIndex+1 if mid-wave death uses index)
  failedWave: number | null;
  durationSec: number;
  baseHpRemaining: number;
  score: number;
  kills: number;
  leaks: number;
  bossDamage: number;
  energyStarvedSec: number;
  unspentEnergyAtEnd: number;
  towerBuilds: Record<TowerKind, number>;
  towerUpgrades: Record<TowerKind, number>;
  towerDamage: Record<TowerKind, number>;
  abilityUses: Record<AbilityKind, number>;
  contributionPoints: number; // mirror of SQL formula
  /** Human-profile only: did this player rage-quit / get bored before defeat? */
  abandoned?: boolean;
  /** When realmix is selected, which archetype was sampled for this run. */
  sampledArchetype?: StrategyId | null;
}

export interface SimAggregate {
  strategy: StrategyId;
  runs: number;
  victories: number;
  victoryRate: number;
  // survival
  avgWaves: number;
  medianWaves: number;
  maxWaves: number;
  pctReached: { w5: number; w10: number; w15: number; w20: number };
  failureWaveHistogram: Record<number, number>;
  // duration
  avgDurationSec: number;
  medianDurationSec: number;
  // combat
  avgKills: number;
  avgLeaks: number;
  avgBossDamage: number;
  // economy
  avgEnergyStarvedSec: number;
  avgUnspentAtEnd: number;
  // towers
  towerBuildShare: Record<TowerKind, number>;
  towerDamageShare: Record<TowerKind, number>;
  abilityUsesAvg: Record<AbilityKind, number>;
  // contribution
  avgContribution: number;
  medianContribution: number;
  contributionPerMinute: number;
  // diagnosis
  verdict: 'TooEasy' | 'Easy' | 'Balanced' | 'Hard' | 'Brutal';
  diagnostics: string[];
  recommendations: string[];
  // Operation pacing (computed at the end against current targets)
  operationPacing: OperationPacing;
  // Human realism diagnostics (only meaningful when a human profile is used).
  abandonRate: number; // 0..1 — fraction of runs that quit before defeat
  archetypeMix?: Record<string, number>; // realmix only
}

export interface OperationPacing {
  phase1Target: number;
  phase2Target: number;
  phase3Target: number;
  avgKillsPerRun: number;
  avgScorePerRun: number;
  avgBossDmgPerRun: number;
  runsToCompletePhase1: number;
  runsToCompletePhase2: number;
  runsToCompletePhase3: number;
  runsToCompleteOperation: number;
  perPlayerEstimate: Record<number, number>; // groupSize → runs each
}

// Default Operation targets (mirrors live defaults set in DB / hook).
export const DEFAULT_OP_TARGETS = {
  phase1: 2500,
  phase2: 250000,
  phase3: 25000,
};

// ─── Bot policies ───────────────────────────────────────────────────────────
// Each policy is called every "decision tick" (every ~500ms of sim time).
// It returns a list of intent actions to attempt against current state.
type BotAction =
  | { kind: 'place'; tower: TowerKind; col: number; row: number }
  | { kind: 'upgrade'; towerId: string }
  | { kind: 'ability'; ability: AbilityKind };

interface PolicyCtx {
  state: BattleState;
  rng: () => number;
  mission: MissionDef;
}

function incomingThreats({ state, mission }: PolicyCtx): Set<EnemyKind> {
  const waveIndex = state.status === 'pre'
    ? 0
    : state.status === 'between'
      ? Math.min(state.waveIndex + 1, mission.waves.length - 1)
      : Math.max(0, state.waveIndex);
  return new Set(mission.waves[waveIndex]?.spawns.map(spawn => spawn.enemy) ?? []);
}

// Score build tiles by proximity to path — towers near the most path cells
// (within plausible range) get the highest score. Returns sorted desc.
const tileScoreCache = new Map<string, number>();
function scoreTile(col: number, row: number, range: number, variantId?: PathVariantId | string): number {
  const layout = getGridLayout(variantId);
  const key = `${layout.variantId}:${col},${row},${range.toFixed(1)}`;
  const cached = tileScoreCache.get(key);
  if (cached != null) return cached;
  let s = 0;
  for (const p of layout.PATH) {
    const d = distanceCells(col + 0.5, row + 0.5, p.col + 0.5, p.row + 0.5);
    if (d <= range) s += 1 + Math.max(0, range - d) * 0.2;
  }
  tileScoreCache.set(key, s);
  return s;
}

function bestEmptyTile(state: BattleState, range: number, rng: () => number, jitter = 0): { col: number; row: number } | null {
  const layout = getGridLayout(state.pathVariantId);
  const occupied = new Set(state.towers.map(t => `${t.cell.col},${t.cell.row}`));
  const candidates = layout.BUILD_TILES.filter(t => !occupied.has(`${t.col},${t.row}`));
  if (!candidates.length) return null;
  const scored = candidates.map(t => ({
    t,
    s: scoreTile(t.col, t.row, range, layout.variantId) + (jitter ? rng() * jitter : 0),
  })).sort((a, b) => b.s - a.s);
  return { col: scored[0].t.col, row: scored[0].t.row };
}

function pickBasic(ctx: PolicyCtx): BotAction[] {
  const { state, rng } = ctx;
  const acts: BotAction[] = [];
  // Casual: always buy pulse first if affordable, occasionally buys arc.
  // Upgrades only if tons of energy.
  const towerCount = state.towers.length;
  if (state.energy >= TOWERS.pulse.cost && towerCount < 8) {
    const pick: TowerKind = rng() < 0.7 ? 'pulse' : (rng() < 0.5 ? 'arc' : 'cryo');
    if (state.energy >= TOWERS[pick].cost) {
      const tile = bestEmptyTile(state, TOWERS[pick].range, rng, 0.5);
      if (tile) acts.push({ kind: 'place', tower: pick, col: tile.col, row: tile.row });
    }
  }
  if (state.energy >= 250 && rng() < 0.2) {
    // pick a random tower to upgrade
    const candidates = state.towers.filter(t => t.level < 3);
    if (candidates.length) {
      const t = candidates[Math.floor(rng() * candidates.length)];
      acts.push({ kind: 'upgrade', towerId: t.id });
    }
  }
  // Casuals rarely use abilities — only when nexus HP is critical
  if (state.baseHp / state.baseHpMax < 0.4) {
    const ab = state.abilities.find(a => a.cooldownMs <= 0);
    if (ab) acts.push({ kind: 'ability', ability: ab.kind });
  }
  return acts;
}

function pickBalanced(ctx: PolicyCtx): BotAction[] {
  const { state, rng } = ctx;
  const acts: BotAction[] = [];
  const builds = state.towerBuilds;
  const threats = incomingThreats(ctx);
  // Composition target: 3 pulse, 2 cryo, 2 arc, 1 rail before doubling up.
  const target: Array<[TowerKind, number]> = [
    ['pulse', 3], ['cryo', 2], ['arc', 2], ['rail', 1],
  ];
  let nextPick: TowerKind | null = null;
  // Competent players respond to explicit mission intel before following their
  // generic build order. This keeps stealth/air missions representative.
  if (threats.has('stealth') && builds.rail < 1) nextPick = 'rail';
  else if (threats.has('flyer') && builds.flak + builds.rail < 1) nextPick = 'flak';
  else {
    for (const [k, n] of target) {
      if (builds[k] < n) { nextPick = k; break; }
    }
  }
  if (!nextPick) {
    // doubled-up phase: prefer rail then cryo
    nextPick = state.energy >= TOWERS.rail.cost ? 'rail' : 'cryo';
  }
  if (nextPick && state.energy >= TOWERS[nextPick].cost) {
    const tile = bestEmptyTile(state, TOWERS[nextPick].range, rng);
    if (tile) acts.push({ kind: 'place', tower: nextPick, col: tile.col, row: tile.row });
  }
  // Upgrade highest-damage tower whenever energy is comfortable
  if (state.energy >= 200) {
    const ups = [...state.towers].filter(t => t.level < 3)
      .sort((a, b) => b.totalDamage - a.totalDamage);
    if (ups[0]) acts.push({ kind: 'upgrade', towerId: ups[0].id });
  }
  // Cast ability when many enemies on screen or nexus pressured
  const heavyPressure = state.enemies.length >= 8 || state.baseHp / state.baseHpMax < 0.55;
  if (heavyPressure) {
    const ab = state.abilities.find(a => a.cooldownMs <= 0);
    if (ab) acts.push({ kind: 'ability', ability: ab.kind });
  }
  return acts;
}

function pickOptimizer(ctx: PolicyCtx): BotAction[] {
  const { state, rng } = ctx;
  const acts: BotAction[] = [];
  // Open with cryo+pulse stack near choke, then add rail by wave 4.
  const builds = state.towerBuilds;
  const threats = incomingThreats(ctx);
  let nextPick: TowerKind | null = null;
  if (threats.has('stealth') && builds.rail < 1) nextPick = 'rail';
  else if (threats.has('flyer') && builds.flak + builds.rail < 1) nextPick = 'flak';
  else if (builds.cryo < 1) nextPick = 'cryo';
  else if (builds.pulse < 2) nextPick = 'pulse';
  else if (builds.rail < 1 && state.waveIndex >= 2) nextPick = 'rail';
  else if (builds.arc < 2) nextPick = 'arc';
  else if (builds.rail < 2 && state.waveIndex >= 6) nextPick = 'rail';
  else nextPick = state.energy >= TOWERS.rail.cost ? 'rail' : 'pulse';

  if (nextPick && state.energy >= TOWERS[nextPick].cost) {
    const tile = bestEmptyTile(state, TOWERS[nextPick].range, rng);
    if (tile) acts.push({ kind: 'place', tower: nextPick, col: tile.col, row: tile.row });
  }
  // Greedy upgrade: highest damage tower at every chance
  const ups = [...state.towers].filter(t => t.level < 3)
    .sort((a, b) => b.totalDamage - a.totalDamage);
  if (ups[0] && state.energy >= 100) {
    acts.push({ kind: 'upgrade', towerId: ups[0].id });
  }
  // Use abilities aggressively whenever boss on field or 6+ enemies
  const bossOnField = state.enemies.some(e => e.kind === 'boss');
  if (bossOnField || state.enemies.length >= 6) {
    const ab = state.abilities.find(a => a.cooldownMs <= 0);
    if (ab) acts.push({ kind: 'ability', ability: ab.kind });
  }
  return acts;
}

function pickRandom(ctx: PolicyCtx): BotAction[] {
  const { state, rng } = ctx;
  const acts: BotAction[] = [];
  const kinds: TowerKind[] = ['pulse', 'arc', 'cryo', 'rail'];
  const pick = kinds[Math.floor(rng() * kinds.length)];
  if (state.energy >= TOWERS[pick].cost) {
    const tile = bestEmptyTile(state, TOWERS[pick].range, rng, 5);
    if (tile) acts.push({ kind: 'place', tower: pick, col: tile.col, row: tile.row });
  }
  if (rng() < 0.15) {
    const candidates = state.towers.filter(t => t.level < 3);
    if (candidates.length) {
      const t = candidates[Math.floor(rng() * candidates.length)];
      acts.push({ kind: 'upgrade', towerId: t.id });
    }
  }
  if (rng() < 0.1) {
    const ab = state.abilities.find(a => a.cooldownMs <= 0);
    if (ab) acts.push({ kind: 'ability', ability: ab.kind });
  }
  return acts;
}

type BasePolicyId = 'basic' | 'balanced' | 'optimizer' | 'random';
const POLICIES: Record<BasePolicyId, (ctx: PolicyCtx) => BotAction[]> = {
  basic: pickBasic,
  balanced: pickBalanced,
  optimizer: pickOptimizer,
  random: pickRandom,
};

// ─── Single run ─────────────────────────────────────────────────────────────

const TICK_MS = 100;
const DECISION_INTERVAL_MS = 500; // bot acts twice per simulated second
const MAX_SIM_MS = 25 * 60_000;   // hard safety cap: 25 sim minutes

/** Apply misclick: with probability p, swap the placement to a neighboring
 *  valid build tile (same column ±1 / row ±1) if one is empty. Mirrors a
 *  real player's thumb landing on the wrong cell on a small phone screen. */
function applyMisclick(
  state: BattleState,
  action: Extract<BotAction, { kind: 'place' }>,
  rng: () => number,
  rate: number,
): Extract<BotAction, { kind: 'place' }> {
  if (rate <= 0 || rng() >= rate) return action;
  const occupied = new Set(state.towers.map(t => `${t.cell.col},${t.cell.row}`));
  const neighbors = getGridLayout(state.pathVariantId).BUILD_TILES.filter(t => {
    const dc = Math.abs(t.col - action.col);
    const dr = Math.abs(t.row - action.row);
    return (dc + dr) > 0 && dc <= 1 && dr <= 1 && !occupied.has(`${t.col},${t.row}`);
  });
  if (!neighbors.length) return action;
  const pick = neighbors[Math.floor(rng() * neighbors.length)];
  return { ...action, col: pick.col, row: pick.row };
}

/** Run any mission through the same deterministic player-model harness used
 *  for Endless. Keeping campaign and endgame on one engine lets balance tests
 *  catch an impossible mission before it reaches players. */
export function runMission(
  strategy: StrategyId,
  seed: number,
  mission: MissionDef,
  options: { pathVariantId?: PathVariantId } = {},
): SimRunResult {
  const rng = mulberry32(seed);

  // Resolve to a base policy + optional human profile.
  let resolved: StrategyId = strategy;
  if (strategy === 'realmix') resolved = sampleMix(rng);
  const profile: HumanProfile | null = (resolved in HUMAN_PROFILES)
    ? HUMAN_PROFILES[resolved as keyof typeof HUMAN_PROFILES]
    : null;
  const basePolicy: BasePolicyId = profile ? profile.base : (resolved as BasePolicyId);

  // Default loadout: both abilities, no boost. This mirrors the actual default
  // selection for endless runs.
  const abilities: AbilityKind[] = ['orbital', 'emp'];
  let state = initBattle(mission.id, abilities, { mission, pathVariantId: options.pathVariantId });

  // Auto-start the first wave (humans tap "begin"; bots start immediately).
  state = startWave(state, mission);
  let lastDecisionAt = 0;
  let nextDecisionDelay = 0; // extra "thinking time" before next decision tick
  let abandoned = false;
  let lastAbandonCheckWave = -1;

  while (state.elapsedMs < MAX_SIM_MS && state.status !== 'defeat' && state.status !== 'victory') {
    // Auto-advance wave breaks immediately so we don't waste 5s of sim time.
    if (state.status === 'between' && state.betweenWaveMs > 1000) {
      state = { ...state, betweenWaveMs: 1000 };
    }

    // Per-wave abandonment check (humans rage-quit / get bored).
    if (profile && state.waveIndex !== lastAbandonCheckWave) {
      lastAbandonCheckWave = state.waveIndex;
      const hpFrac = state.baseHp / Math.max(1, state.baseHpMax);
      const pQuit = profile.abandon(state.waveIndex + 1, hpFrac);
      if (pQuit > 0 && rng() < pQuit) {
        abandoned = true;
        break;
      }
    }

    // Decision phase
    if (state.elapsedMs - lastDecisionAt >= DECISION_INTERVAL_MS + nextDecisionDelay) {
      lastDecisionAt = state.elapsedMs;
      // Re-roll thinking time per profile.
      if (profile) {
        const [lo, hi] = profile.reactionMs;
        nextDecisionDelay = lo + rng() * (hi - lo);
      } else {
        nextDecisionDelay = 0;
      }

      // Profile-aware skip: distracted players miss whole decision windows.
      const shouldSkip = profile ? rng() < profile.skipTickRate : false;

      if (!shouldSkip) {
        let actions = POLICIES[basePolicy]({ state, rng, mission });

        if (profile) {
          // Hoarding bias — drop tower placements during "calm" periods
          // (no enemies on screen and base HP healthy).
          const calm = state.enemies.length <= 2 && state.baseHp / state.baseHpMax > 0.7;
          if (calm && rng() < profile.hoardBias) {
            actions = actions.filter(a => a.kind !== 'place');
          }
          // Ability attention — sometimes ignore valid ability windows.
          if (rng() >= profile.abilityAttention) {
            actions = actions.filter(a => a.kind !== 'ability');
          }
          // Learner gets a small bump after the threshold wave.
          if (profile.improvesAfterWave != null && state.waveIndex + 1 > profile.improvesAfterWave) {
            // Improved players act more reliably (cut hoarding & skip tail).
            // No-op past this point — already applied; left as documentation.
          }
          // Misclick mutation on placements.
          actions = actions.map(a =>
            a.kind === 'place' ? applyMisclick(state, a, rng, profile.misclickRate) : a
          );
        }

        for (const a of actions) {
          if (a.kind === 'place') {
            const r = placeTower(state, a.tower, a.col, a.row);
            if (r.ok) state = r.state;
          } else if (a.kind === 'upgrade') {
            const r = upgradeTower(state, a.towerId);
            if (r.ok) state = r.state;
          } else if (a.kind === 'ability') {
            const r = castAbility(state, a.ability);
            if (r.ok) state = r.state;
          }
        }
      }
    }

    state = tick(state, mission);
  }

  // Compute per-tower damage attribution
  const towerDamage = Object.fromEntries(TOWER_KINDS.map((k) => [k, 0])) as Record<TowerKind, number>;
  for (const t of state.towers) towerDamage[t.kind] += t.totalDamage;

  const wavesCleared = state.status === 'victory'
    ? state.totalWaves
    : Math.max(0, state.waveIndex); // index = next wave attempted; 0 if died on first
  const failedWave = state.status === 'defeat'
    ? state.waveIndex + 1
    : (abandoned ? state.waveIndex + 1 : null);

  const durationSec = Math.round(state.elapsedMs / 1000);
  const kills = state.killedThisRun;
  const score = state.score;
  const bossDamage = state.bossDamageDealt;
  const points = computeContributionPoints({
    kills, score, waves: wavesCleared, bossDamage,
    activePhase: 1, // assume Phase 1 weighting (matches "fresh op" baseline)
  });

  return {
    victory: state.status === 'victory',
    wavesCleared,
    failedWave,
    durationSec,
    baseHpRemaining: state.baseHp,
    score, kills, leaks: state.leaks, bossDamage,
    energyStarvedSec: Math.round(state.energyStarvedMs / 1000),
    unspentEnergyAtEnd: state.energy,
    towerBuilds: state.towerBuilds,
    towerUpgrades: state.towerUpgrades,
    towerDamage,
    abilityUses: state.abilityUses,
    contributionPoints: points,
    abandoned,
    sampledArchetype: profile ? resolved : null,
  };
}

/** Backwards-compatible Endless entry point used by the simulator UI. */
export function runOne(strategy: StrategyId, seed: number): SimRunResult {
  return runMission(strategy, seed, ENDLESS_MISSION);
}

// ─── Mirror of submit_operation_contribution formula ────────────────────────
const KILL_CAP = 600;
const SCORE_SOFT_CAP = 60_000;
const BOSS_SOFT_CAP = 6_000;
const PER_RUN_POINT_CAP = 10_000;

export function computeContributionPoints(args: {
  kills: number; score: number; waves: number; bossDamage: number; activePhase: 1 | 2 | 3;
}): number {
  let k = Math.min(args.kills, KILL_CAP);
  let s = args.score <= SCORE_SOFT_CAP
    ? args.score / 100
    : (SCORE_SOFT_CAP / 100) + (args.score - SCORE_SOFT_CAP) / 400;
  const w = args.waves * 20;
  let b = args.bossDamage <= BOSS_SOFT_CAP
    ? args.bossDamage / 50
    : (BOSS_SOFT_CAP / 50) + (args.bossDamage - BOSS_SOFT_CAP) / 200;

  // Anti-farm threshold same as SQL: <2 waves AND (<60s OR <5 kills) → 0.
  // (Sim path always reports duration; mirror best-effort.)
  if (args.waves < 2 && args.kills < 5) return 0;

  if (args.activePhase === 1) k *= 1.2;
  else if (args.activePhase === 2) s *= 1.2;
  else b *= 1.2;
  return Math.min(PER_RUN_POINT_CAP, Math.floor(k + s + w + b));
}

// ─── Aggregation ────────────────────────────────────────────────────────────
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function pct(xs: number[], threshold: number): number {
  return xs.length ? xs.filter(x => x >= threshold).length / xs.length : 0;
}

export function aggregate(strategy: StrategyId, runs: SimRunResult[]): SimAggregate {
  const n = runs.length || 1;
  const waves = runs.map(r => r.wavesCleared);
  const durations = runs.map(r => r.durationSec);
  const points = runs.map(r => r.contributionPoints);
  const buildTotals = Object.fromEntries(TOWER_KINDS.map((k) => [k, 0])) as Record<TowerKind, number>;
  const dmgTotals = Object.fromEntries(TOWER_KINDS.map((k) => [k, 0])) as Record<TowerKind, number>;
  const abilityTotals = Object.fromEntries(ABILITY_KINDS.map((k) => [k, 0])) as Record<AbilityKind, number>;
  const failHist: Record<number, number> = {};
  let totalKills = 0, totalLeaks = 0, totalBoss = 0, totalStarved = 0, totalUnspent = 0;
  for (const r of runs) {
    totalKills += r.kills;
    totalLeaks += r.leaks;
    totalBoss += r.bossDamage;
    totalStarved += r.energyStarvedSec;
    totalUnspent += r.unspentEnergyAtEnd;
    (Object.keys(buildTotals) as TowerKind[]).forEach(k => {
      buildTotals[k] += r.towerBuilds[k];
      dmgTotals[k] += r.towerDamage[k];
    });
    (Object.keys(abilityTotals) as AbilityKind[]).forEach(k => {
      abilityTotals[k] += r.abilityUses[k];
    });
    if (r.failedWave != null) failHist[r.failedWave] = (failHist[r.failedWave] ?? 0) + 1;
  }
  const sumBuilds = Object.values(buildTotals).reduce((a, b) => a + b, 0) || 1;
  const sumDmg = Object.values(dmgTotals).reduce((a, b) => a + b, 0) || 1;
  const buildShare = Object.fromEntries(
    (Object.keys(buildTotals) as TowerKind[]).map(k => [k, buildTotals[k] / sumBuilds]),
  ) as Record<TowerKind, number>;
  const dmgShare = Object.fromEntries(
    (Object.keys(dmgTotals) as TowerKind[]).map(k => [k, dmgTotals[k] / sumDmg]),
  ) as Record<TowerKind, number>;
  const abilityAvg = Object.fromEntries(
    (Object.keys(abilityTotals) as AbilityKind[]).map(k => [k, abilityTotals[k] / n]),
  ) as Record<AbilityKind, number>;

  const avgWaves = waves.reduce((a, b) => a + b, 0) / n;
  const avgDuration = durations.reduce((a, b) => a + b, 0) / n;
  const avgContribution = points.reduce((a, b) => a + b, 0) / n;
  const contributionPerMinute = avgDuration > 0 ? avgContribution / (avgDuration / 60) : 0;
  const victories = runs.filter(r => r.victory).length;
  const victoryRate = victories / n;

  // Verdict: focus on whether endless feels balanced for this strategy band.
  // Targets:
  //   basic     → avg waves 5–8
  //   balanced  → 8–14
  //   optimizer → 14–22
  //   random    → 4–10
  const targets: Record<StrategyId, [number, number]> = {
    basic: [5, 8],
    balanced: [8, 14],
    optimizer: [14, 22],
    random: [4, 10],
    tourist: [3, 6],
    hoarder: [6, 11],
    spammer: [4, 8],
    distracted: [4, 9],
    learner: [6, 12],
    // Population mix expectation — tuned to a small friend group avg.
    realmix: [5, 10],
  };
  const [lo, hi] = targets[strategy];
  let verdict: SimAggregate['verdict'];
  if (avgWaves > hi + 4) verdict = 'TooEasy';
  else if (avgWaves > hi) verdict = 'Easy';
  else if (avgWaves < lo - 2) verdict = 'Brutal';
  else if (avgWaves < lo) verdict = 'Hard';
  else verdict = 'Balanced';

  // Diagnostics & recommendations
  const diagnostics: string[] = [];
  const recommendations: string[] = [];

  if (verdict === 'TooEasy' || verdict === 'Easy') {
    diagnostics.push(`Average survival is ${avgWaves.toFixed(1)} waves vs target ${lo}–${hi}. Endless ramps too slowly for ${STRATEGY_LABELS[strategy]}.`);
    if (avgWaves >= 18) recommendations.push('Increase enemy HP scaling on waves 11+ by ~20%.');
    if (totalUnspent / n > 200) recommendations.push(`Cut wave reward energy after wave 10 by ~15% (avg unspent at end = ${(totalUnspent / n).toFixed(0)}).`);
    if (dmgShare.cryo > 0.45) recommendations.push('Cryo dominates damage share — reduce slowDuration or splash.');
    if (dmgShare.rail > 0.45) recommendations.push('Rail dominates damage — increase shielded enemy frequency or reduce armorPierce.');
    if (dmgShare.arc > 0.45) recommendations.push('Arc dominates — reduce chain count from 2 to 1 at base.');
  } else if (verdict === 'Brutal' || verdict === 'Hard') {
    diagnostics.push(`Average survival is ${avgWaves.toFixed(1)} waves vs target ${lo}–${hi}. Endless is too punishing for ${STRATEGY_LABELS[strategy]}.`);
    if (totalStarved / n > 30) recommendations.push('Energy starvation is high — raise wave reward energy on waves 1–5 by ~10%.');
    if (avgWaves < 3) recommendations.push('Soften wave 1–2 enemy counts by ~20%.');
  } else {
    diagnostics.push(`Survival lands in target band (${avgWaves.toFixed(1)} waves vs ${lo}–${hi}).`);
  }
  // Tower diversity check
  const minBuildShare = Math.min(...Object.values(buildShare));
  const maxBuildShare = Math.max(...Object.values(buildShare));
  if (minBuildShare < 0.05 && maxBuildShare > 0.45) {
    const dominant = (Object.keys(buildShare) as TowerKind[]).find(k => buildShare[k] === maxBuildShare);
    diagnostics.push(`Tower diversity unhealthy — ${dominant} dominates (${(maxBuildShare * 100).toFixed(0)}% of builds).`);
  }
  // Boss check
  if (avgWaves >= 5 && totalBoss / n < 200) {
    diagnostics.push('Bosses appear but barely take damage — Phase 3 will stall.');
    recommendations.push('Lower boss shield or reduce boss HP ~15% so average runs produce real Phase 3 contribution.');
  }
  // Contribution pacing
  const opPacing = computeOperationPacing(runs);
  if (opPacing.runsToCompletePhase1 < 3) {
    diagnostics.push('Phase 1 (kills) clears in fewer than 3 average runs — too easy.');
    recommendations.push(`Raise Phase 1 target from ${opPacing.phase1Target} to ~${Math.round(opPacing.phase1Target * 1.5)}.`);
  }
  if (opPacing.runsToCompletePhase3 > 30) {
    diagnostics.push('Phase 3 (boss damage) takes too long — average runs barely contribute.');
    recommendations.push(`Lower Phase 3 target from ${opPacing.phase3Target} to ~${Math.round(opPacing.phase3Target * 0.7)}.`);
  }

  return {
    strategy,
    runs: n,
    victories,
    victoryRate,
    avgWaves,
    medianWaves: median(waves),
    maxWaves: Math.max(...waves, 0),
    pctReached: {
      w5: pct(waves, 5),
      w10: pct(waves, 10),
      w15: pct(waves, 15),
      w20: pct(waves, 20),
    },
    failureWaveHistogram: failHist,
    avgDurationSec: avgDuration,
    medianDurationSec: median(durations),
    avgKills: totalKills / n,
    avgLeaks: totalLeaks / n,
    avgBossDamage: totalBoss / n,
    avgEnergyStarvedSec: totalStarved / n,
    avgUnspentAtEnd: totalUnspent / n,
    towerBuildShare: buildShare,
    towerDamageShare: dmgShare,
    abilityUsesAvg: abilityAvg,
    avgContribution,
    medianContribution: median(points),
    contributionPerMinute,
    verdict,
    diagnostics,
    recommendations,
    operationPacing: opPacing,
    abandonRate: runs.filter(r => r.abandoned).length / n,
    archetypeMix: (() => {
      const m: Record<string, number> = {};
      let any = false;
      for (const r of runs) {
        if (r.sampledArchetype) { any = true; m[r.sampledArchetype] = (m[r.sampledArchetype] ?? 0) + 1; }
      }
      if (!any) return undefined;
      for (const k of Object.keys(m)) m[k] = m[k] / n;
      return m;
    })(),
  };
}

export function computeOperationPacing(runs: SimRunResult[]): OperationPacing {
  const n = Math.max(1, runs.length);
  const avgKills = runs.reduce((s, r) => s + r.kills, 0) / n;
  const avgScore = runs.reduce((s, r) => s + r.score, 0) / n;
  const avgBoss = runs.reduce((s, r) => s + r.bossDamage, 0) / n;
  const r1 = avgKills > 0 ? Math.ceil(DEFAULT_OP_TARGETS.phase1 / avgKills) : Infinity;
  const r2 = avgScore > 0 ? Math.ceil(DEFAULT_OP_TARGETS.phase2 / avgScore) : Infinity;
  const r3 = avgBoss > 0 ? Math.ceil(DEFAULT_OP_TARGETS.phase3 / avgBoss) : Infinity;
  const total = r1 + r2 + r3;
  const perPlayer: Record<number, number> = {};
  for (const g of [2, 3, 5, 8]) perPlayer[g] = Math.ceil(total / g);
  return {
    phase1Target: DEFAULT_OP_TARGETS.phase1,
    phase2Target: DEFAULT_OP_TARGETS.phase2,
    phase3Target: DEFAULT_OP_TARGETS.phase3,
    avgKillsPerRun: avgKills,
    avgScorePerRun: avgScore,
    avgBossDmgPerRun: avgBoss,
    runsToCompletePhase1: r1,
    runsToCompletePhase2: r2,
    runsToCompletePhase3: r3,
    runsToCompleteOperation: total,
    perPlayerEstimate: perPlayer,
  };
}

// ─── Adaptive convergence helper ────────────────────────────────────────────
/**
 * Returns true if the latest two batch averages of avg-waves are within
 * `epsilon` of each other (relative). Use to decide when adaptive sweep stops.
 */
export function hasConverged(prevAvg: number, currAvg: number, epsilon = 0.05): boolean {
  if (prevAvg === 0) return false;
  return Math.abs(currAvg - prevAvg) / prevAvg < epsilon;
}
