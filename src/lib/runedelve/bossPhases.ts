// Rune Delve — Boss Phases (R5)
//
// Wraps boss/mini-boss enemies with multi-phase encounter logic.
// Today, bosses get a one-line "Boss Rule" modifier (regenerator,
// splitter, etc.) — they're stat blocks with a gimmick. R5 promotes
// them to PROPER encounters:
//
//   • Phase 1 (start)   — baseline fight
//   • Phase 2 at 66% HP — "Awakened" — damage +20%, flavor log
//   • Phase 3 at 33% HP — "Final Form" — damage +40% (total), flavor log
//
// Crucial constraint: this file does NOT touch the combat engine.
// Phase transitions mutate the live `enemy.damage` field on the
// existing CombatState.enemies[] array. The engine reads enemy.damage
// when computing attacks; bumping it on the enemy object IS the
// mechanic. No changes to applyChain, telegraph.ts, or bossRules.ts.
//
// Visual surface: each transition pushes a styled log entry so the
// player gets a "the dragon enters phase 2" beat without us building
// a separate FX pipeline. EnemyDisplay can read the phase index from
// the play page state and render a small "P2" / "P3" pip if desired.

import type { Enemy } from "./dungeonGenerator";

export type BossPhaseIndex = 1 | 2 | 3;

export interface BossPhaseDef {
  /** Which phase index this defines (2 or 3 — phase 1 is the
   *  default "fresh" state). */
  index: 2 | 3;
  /** HP ratio threshold (e.g. 0.66 for phase 2 at 66% HP). */
  threshold: number;
  /** Damage multiplier applied to the boss's `damage` field when
   *  this phase begins. Cumulative against phase 1 damage. */
  damageMult: number;
  /** Short uppercase name shown in the log header. */
  name: string;
  /** Flavor message — varies by boss tier to give bosses personality. */
  flavor: string;
}

/** Phase progression for full bosses (chapter ends — L50, L100, L150). */
const BOSS_PHASES: BossPhaseDef[] = [
  {
    index: 2,
    threshold: 0.66,
    damageMult: 1.2,
    name: "Phase 2 — Awakened",
    flavor: "The wardstone splits — the boss roars and strikes harder.",
  },
  {
    index: 3,
    threshold: 0.33,
    damageMult: 1.4, // total vs phase 1, applied via multiply-from-current * (1.4 / 1.2)
    name: "Phase 3 — Final Form",
    flavor: "A column of light. The seal breaks. Every blow lands like an axe.",
  },
];

/** Phase progression for mini-bosses (mid-chapter — every 10th level
 *  that isn't a chapter boss). Same structure, tamer numbers, tighter
 *  flavor — they're scary but not chapter-ending. */
const MINI_PHASES: BossPhaseDef[] = [
  {
    index: 2,
    threshold: 0.5,
    damageMult: 1.15,
    name: "Phase 2 — Provoked",
    flavor: "The mini-boss hisses — its strikes sharpen.",
  },
];

/** Which phase set applies to a given enemy. Returns [] for
 *  non-bosses (regular enemies don't phase). */
export function phasesFor(enemy: Enemy): BossPhaseDef[] {
  if (enemy.tier === "boss") return BOSS_PHASES;
  if (enemy.tier === "mini") return MINI_PHASES;
  return [];
}

/**
 * Detect which phase an enemy SHOULD be in right now based on its
 * current HP ratio. Returns 1 (default) up to the highest index whose
 * threshold has been crossed.
 */
export function targetPhaseFor(enemy: Enemy): BossPhaseIndex {
  const phases = phasesFor(enemy);
  if (phases.length === 0) return 1;
  const ratio = enemy.hp / Math.max(1, enemy.maxHp);
  let active: BossPhaseIndex = 1;
  for (const p of phases) {
    if (ratio <= p.threshold) {
      active = p.index;
    }
  }
  return active;
}

/** Damage already contains phase buffs in a checkpoint; never apply them twice. */
export function restoreBossPhases(
  enemies: Enemy[],
  stored?: Array<[string, BossPhaseIndex]>,
): Map<string, BossPhaseIndex> {
  const restored = new Map(stored ?? []);
  return new Map(
    enemies
      .filter((enemy) => phasesFor(enemy).length > 0)
      .map((enemy) => [
        enemy.id,
        Math.max(
          restored.get(enemy.id) ?? 1,
          targetPhaseFor(enemy),
        ) as BossPhaseIndex,
      ]),
  );
}

export interface PhaseTransition {
  enemyId: string;
  enemyName: string;
  from: BossPhaseIndex;
  to: BossPhaseIndex;
  def: BossPhaseDef;
}

/**
 * Diff a "phase map" against current enemy HPs and emit transitions
 * for every boss/mini-boss that just crossed a threshold. Pure — the
 * caller is responsible for applying transition effects (damage mult,
 * log push, FX) and updating its own phase map.
 */
export function detectPhaseTransitions(
  enemies: Enemy[],
  currentPhases: Map<string, BossPhaseIndex>,
): PhaseTransition[] {
  const out: PhaseTransition[] = [];
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const phases = phasesFor(e);
    if (phases.length === 0) continue;
    const current = currentPhases.get(e.id) ?? 1;
    const target = targetPhaseFor(e);
    if (target <= current) continue;
    // Emit one transition per phase crossed (e.g. 1 → 3 emits both
    // phase 2 and phase 3 in order). Lets the caller log each beat.
    for (const p of phases) {
      if (p.index > current && p.index <= target) {
        out.push({
          enemyId: e.id,
          enemyName: e.name,
          from: (p.index - 1) as BossPhaseIndex,
          to: p.index,
          def: p,
        });
      }
    }
  }
  return out;
}

/**
 * Apply a transition's damage mult to the live enemy object. Computes
 * the DELTA from the previous phase mult so phases 1→2→3 don't
 * compound incorrectly when crossed in a single chain.
 */
export function applyPhaseDamageBump(
  enemy: Enemy,
  transition: PhaseTransition,
): void {
  const phases = phasesFor(enemy);
  if (phases.length === 0) return;
  // Cumulative mult AT the target phase
  const targetMult = transition.def.damageMult;
  // Cumulative mult AT the previous phase (1 if from === 1)
  const prevDef = phases.find((p) => p.index === transition.from);
  const prevMult = prevDef?.damageMult ?? 1;
  // Delta multiply so the enemy's `damage` field reflects exactly the
  // cumulative scaling regardless of how many transitions fire in
  // sequence.
  const delta = targetMult / prevMult;
  enemy.damage = Math.max(1, Math.round(enemy.damage * delta));
}
