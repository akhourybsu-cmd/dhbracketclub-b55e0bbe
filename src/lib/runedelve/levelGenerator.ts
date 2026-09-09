// Deterministic level generator. Same level number → same level for everyone.
import { mulberry32, rngInt } from './prng';
import type { Enemy } from './dungeonGenerator';
import { mechanicsForLevel, introMechanicForLevel, type MechanicId } from './mechanics';
import { rollSecondaryObjective, type SecondaryObjective } from './layeredGoals';
import { bossRuleForLevel, bossKindForLevel, bossStatBoost, bossNamePrefix, type BossRuleId, type BossKind } from './bossRules';
import { rosterPoolForLevel, rosterPoolForLevelAllowingNextChapter, type RosterEntry } from './enemyRoster';

export type ObjectiveType = 'defeat_all' | 'survive' | 'reach_score' | 'defeat_elite';

export interface LevelDefinition {
  level_number: number;
  chapter: number;
  difficulty_tier: number;
  generation_seed: number;
  board_size: number;
  enemy_config: Enemy[];
  turn_limit: number;
  objective_type: ObjectiveType;
  objective_target: number;
  /**
   * `modifiers` is the canonical place where mechanic tags live so the level
   * row in the database carries them. The shape is intentionally small and
   * forward-compatible — readers should fall back to the deterministic
   * `mechanicsForLevel(n)` helper when the column is missing or empty (true
   * for any level row that was created before the mechanic system existed).
   */
  modifiers: LevelModifiers;
}

/**
 * Canonical shape of `LevelDefinition.modifiers`. Exported so play/results
 * pages can cast `level.modifiers as LevelModifiers` instead of `as any`.
 */
export interface LevelModifiers {
  mechanics?: MechanicId[];
  intro_mechanic?: MechanicId | null;
  /** Band 4 — present on levels with the multi_objective mechanic. */
  secondary_objective?: SecondaryObjective | null;
  /** Band 5 + new mid-cadence — present on any boss-rule level. */
  boss_rule?: BossRuleId | null;
  /** Mini / Mid / Chapter boss tier. Drives portrait + label decoration. */
  boss_kind?: BossKind;
  /** Multi-wave reinforcements. Each wave spawns when the prior fully clears. */
  waves?: Array<{ enemies: Enemy[]; reinforcement_turns: number }>;
  [k: string]: unknown;
}

// Legacy template list — kept ONLY as a fallback safety net for any code path
// that still references the old shape. New picks go through `rosterPoolForLevel`.
const ENEMY_TEMPLATES: Array<{ name: string; emoji: string; hp: number; damage: number; tier: number }> = [
  { name: 'Cave Bat',       emoji: '🦇', hp: 45,  damage: 4, tier: 1 },
  { name: 'Goblin Scout',   emoji: '👹', hp: 60,  damage: 5, tier: 1 },
];

export function chapterFor(level: number): number {
  return Math.max(1, Math.ceil(level / 50));
}

// Fantasy chapter names — only used for flavor.
const CHAPTER_NAMES: Record<number, { name: string; subtitle: string }> = {
  1: { name: 'The Ember Caves',      subtitle: 'Where every delver begins.' },
  2: { name: 'The Crystal Hollow',   subtitle: 'Frost and cursed steel await.' },
  3: { name: 'The Shattered Vault',  subtitle: 'Ancient drakes stir below.' },
};
export function chapterMeta(chapter: number): { name: string; subtitle: string } {
  return CHAPTER_NAMES[chapter] ?? { name: `Depth ${chapter}`, subtitle: 'Uncharted runes.' };
}

// Milestone levels worth highlighting on the map (boss-like beats).
export function isMilestoneLevel(level: number): boolean {
  if (level === 1) return false;
  return level % 10 === 0 || level % 50 === 1; // every 10, plus chapter openers
}
export function isChapterOpener(level: number): boolean {
  return level > 1 && (level - 1) % 50 === 0;
}

// 1..5 difficulty tier — visible label for the player.
export function difficultyTierFor(level: number): number {
  if (level <= 10) return 1;
  if (level <= 25) return 2;
  if (level <= 50) return 3;
  if (level <= 100) return 4;
  return 5;
}

// Stable seed: same level number → same seed.
function seedFor(level: number): number {
  // Simple but well-distributed integer hash.
  let h = level | 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h = (h ^ (h >>> 16)) >>> 0;
  // Avoid 0 (mulberry32 treats it specially in some implementations).
  return h || 1;
}

// Tighten move budget as the campaign deepens — but keep it humane.
// Rebalance (data-driven): keep 12 turns through L15 so the L8 cliff softens.
//
// Boss tiers get a generous turn-budget bump on top of the band default —
// mid/chapter encounters carry stat-promoted bosses, boss rules, and (for
// chapter beats) a dramatic wave-2 spawn, so flat 10-11 turns left them
// mathematically unwinnable per Monte Carlo. Mini-bosses keep the band
// budget — the +60% HP bump is still survivable inside the same window.
function turnLimitFor(level: number): number {
  // Rebalance v4: a flat 13-turn floor across every band, rising to 14 in
  // L1-50 where players are still learning class patterns. Monte Carlo
  // (20 runs/level/class across L10-150) showed the previous 10-turn
  // deep-band budget left non-Mage classes mathematically locked out of the
  // kill window even with perfect play. The new baseline gives every class
  // room for one mistake-recovery cycle without trivialising the early game.
  // Rebalance v6 — the deep bands (51+) ran on a 13-turn base, but by then a
  // regular level fields 3 enemies at the ~140-HP cap PLUS damage-reducing /
  // HP-adding abilities (shield_self, heal_ally, summon_minion). That left many
  // ordinary deep levels tighter than the boss levels that got turn bumps
  // (simulator: 0-3% worst-class). Lift the deep base to 15 so single-target
  // classes have a real kill window against ability-laden waves.
  const base = (() => {
    if (level <= 15) return 14;
    if (level <= 25) return 14;
    if (level <= 50) return 14;
    if (level <= 100) return 15;
    return 15;
  })();
  const kind = bossKindForLevel(level);
  // Levels with reinforcement waves (deep band, every 20) need extra turns
  // to handle the extra HP pool — without this they're mathematically unwinnable.
  // Inline check (mirrors hasSecondWave) to avoid TDZ on the function.
  const hasWave = level === 50 || level === 100 || level === 150 || (level >= 60 && level % 20 === 0 && level > 24);
  // Rebalance v6 — mini-boss levels that ALSO spawn a wave (L60, L120, …) used
  // to fall into the `mini` early-return and never pick up the wave bonus, so a
  // full extra wave landed on a +2 budget. Grant BOTH bumps.
  if (kind === 'mini')    return base + 3 + (hasWave ? 3 : 0);
  if (kind === 'mid')     return base + 4;
  if (kind === 'chapter') return base + 5;
  if (hasWave) return base + 3;
  return base;
}

// Enemy count ramp — Rebalance v2: smooth the L14 cliff. Playtest showed
// the 25% chance of 3 enemies at L14 paired with tanky Slime rolls created
// a 2.5× HP spike vs L13. We now keep 2 enemies through L15, then ramp.
function enemyCountFor(level: number, rng: () => number): number {
  if (level <= 15) return 2;                       // tutorial-friendly Chapter 1 opener
  if (level <= 25) return rng() < 0.6 ? 2 : 3;     // 60/40 split — gentle introduction
  if (level <= 40) return rng() < 0.45 ? 2 : 3;    // 45/55 — softer post-tutorial ramp
  if (level <= 60) return rng() < 0.30 ? 2 : 3;    // mostly 3, occasional 2
  // Rebalance v5: cap deep-band enemy count at 3. Prior 3-4 spike combined
  // with deep-band HP scaling created encounters past 600 effective HP that
  // no class could close inside the turn budget.
  return 3;
}

// Per-template HP cap on early levels — keep the L14-15 area from rolling a
// triple-Slime/Stone-Golem wall before the player has any relics. Extended
// through L25 (Rebalance v3) since the Chapter-1 player has limited tools.
const EARLY_HP_CAP = 110;
// Mid-band cap so a single Stone-Golem/Slime roll can't double the encounter
// HP budget in the L26-50 brick-wall band.
const MID_HP_CAP = 130;
// Late-band cap (L51-100) — same idea but loosened so chapter-2 still bites.
// Rebalance v6: trimmed 150→138 so a triple-mook deep wave stays inside the
// non-Mage DPS budget (three 150s + a boss overshot every survivable window).
const LATE_HP_CAP = 138;
// Deep-band cap (L101-150) — Rebalance v5: prior uncapped scaling pushed
// triple-Stone-Golem rolls past 220 HP each, gating the deep band even for
// Mage. Tames mook variance. (Boss + elite slots now get their OWN caps below,
// applied after their multipliers — see bossHpCap / eliteHpCap.)
const DEEP_HP_CAP = 148;

// Elite-slot HP cap — Rebalance v6. `defeat_elite` levels promote one mook with
// ×1.6 HP, which was ALSO exempt from the band cap (an L150 Elite Wraith Lord
// hit 498 HP). Cap it near the mini-boss ceiling so elite levels stay beatable.
function eliteHpCap(level: number): number {
  const band = level <= 25 ? 0 : level <= 50 ? 1 : level <= 100 ? 2 : 3;
  return [150, 210, 250, 290][band];
}

// Boss-slot HP cap — Rebalance v6. The promoted final slot was exempt from
// every mook cap AND took the full depth `hpMul` (up to 2.15× at L120)
// multiplied by the boss stat boost (mini 1.6× / chapter 1.95×). That stack
// produced 450–826 HP single enemies on ordinary mini-boss filler levels,
// putting L60/70/120 at a measured 0% clear rate for EVERY class except Mage.
// This ceiling (applied AFTER the boost) keeps bosses chunky and threatening
// while staying inside the sustained DPS budget of a good non-Mage run.
// Scales by band and boss tier; validated against the headless simulator.
function bossHpCap(level: number, kind: BossKind): number {
  const band = level <= 25 ? 0 : level <= 50 ? 1 : level <= 100 ? 2 : 3;
  // Mini-bosses are single beefy targets on every-10th filler levels.
  const miniCeil = [160, 200, 224, 250][band];
  // Mid / chapter flagships carry a boss rule + (chapter) a wave, so they get
  // a higher ceiling but still a hard cap.
  const flagCeil = [200, 260, 300, 350][band];
  return kind === 'mini' ? miniCeil : flagCeil;
}

// (HP/damage scaling lives below — single RosterEntry-based implementation.)

// Pick a roster archetype for this level. The roster's chapter/tier gating
// already mirrors the prior pool-growth logic, so we just bias early levels
// toward "soft" damage profiles to keep the L1-L15 ramp friendly.
function pickTemplate(level: number, rng: () => number): RosterEntry {
  // L36-50 "bleed-in": ~25% chance to widen the pool to Chapter 2 so the
  // earlier ability gate (level <= 30) actually has Chapter-2 ability enemies
  // to surface. Keeps Chapter 1 dominant the rest of the time.
  const useNextChapter = level >= 36 && level <= 50 && rng() < 0.25;
  let pool = useNextChapter
    ? rosterPoolForLevelAllowingNextChapter(level)
    : rosterPoolForLevel(level);
  // Never seed an ability-bearing enemy in Chapter 1 — keeps intro readable.
  if (level <= 30) pool = pool.filter(e => !e.ability);
  // Per-enemy DPS cap on early levels — prefer tankier-but-softer templates.
  if (level <= 15) {
    const softPool = pool.filter(e => e.baseDamage <= 6);
    if (softPool.length && rng() < 0.7) pool = softPool;
  }
  // Hard fallback so the picker can never crash on an empty pool.
  if (pool.length === 0) pool = rosterPoolForLevel(Math.max(1, level));
  if (pool.length === 0) {
    const fb = ENEMY_TEMPLATES[0];
    return {
      id: 'fallback', name: fb.name, family: 'cave', role: 'striker',
      chapter: 1, tier: 1, emoji: fb.emoji, baseHp: fb.hp, baseDamage: fb.damage,
    };
  }
  return pool[rngInt(rng, pool.length)];
}

// Per-archetype scaling — Rebalance v3 (post L30 brick-wall fix).
// Old curve made enemies 3× base HP by L50, with a 10% damage menace bump
// L31-50. Monte Carlo: 0% clears L34-60 across all classes vs a ~250 dmg
// budget. New curve targets 50-65% Balanced verdict, capping enemy HP scaling
// to roughly 1.7× by L50 and 2.3× by L100 so a 4-chain rogue/cleric run can
// still close the kill window.
// Rebalance v5 — flatten HP curve past L50 so deep bands are clearable.
// Old: 1.0 → 1.6 (L25) → 1.85 (L50) → 2.35 (L100) → 2.85 (L150)
// New: 1.0 → 1.6 (L25) → 1.80 (L50) → 2.05 (L100) → 2.30 (L150)
// Damage curve is ALSO flattened in the deep band — incoming pressure now
// scales mainly through enemy count + boss rules, not raw per-hit numbers.
function scaleEnemy(base: RosterEntry, level: number) {
  const hpMul = (() => {
    if (level <= 25) return 1 + (level - 1) * 0.025;
    if (level <= 50) return 1 + 24 * 0.025 + (level - 25) * 0.008;
    return 1 + 24 * 0.025 + 25 * 0.008 + (level - 50) * 0.005;
  })();
  const dmgMul = (() => {
    if (level <= 25) return 1 + (level - 1) * 0.012;
    if (level <= 50) return 1 + 24 * 0.012 + (level - 25) * 0.006;
    return 1 + 24 * 0.012 + 25 * 0.006 + (level - 50) * 0.003;
  })();
  return {
    hp: Math.round(base.baseHp * hpMul),
    damage: Math.max(base.baseDamage, Math.round(base.baseDamage * dmgMul)),
  };
}

// MVP objectives — gradually introduced.
function objectiveFor(level: number, turnLimit: number): { type: ObjectiveType; target: number } {
  // Default everywhere: defeat all enemies.
  if (level < 15)  return { type: 'defeat_all', target: 0 };
  // From level 15: occasional survive levels.
  if (level % 13 === 0) return { type: 'survive', target: turnLimitFor(level) };
  // From level 30: occasional score targets.
  if (level >= 30 && level % 17 === 0) {
    // A run starts with score credit for full HP and remaining turns. The old
    // linear target sat below that baseline at L34/L51, so those chambers
    // rendered already complete and the board could never resolve. Every
    // score objective now requires at least 100 points of active play.
    const startingScore = 100 * 5 + turnLimit * 50;
    return { type: 'reach_score', target: Math.max(600 + level * 12, startingScore + 100) };
  }
  // From chapter 2 (51+): elite levels every ~25.
  if (level >= 51 && level % 25 === 0) return { type: 'defeat_elite', target: 0 };
  return { type: 'defeat_all', target: 0 };
}

// Helper: build a single Enemy entry from a roster pick at a given level,
// applying the early-HP cap + role-specific decorations. Used both for the
// main wave and any reinforcement waves so behaviour stays identical.
function buildEnemy(
  template: RosterEntry,
  level: number,
  index: number,
  opts: { isElite?: boolean; bossKind?: BossKind; idPrefix?: string } = {},
): Enemy {
  const { isElite = false, bossKind = null, idPrefix = 'e' } = opts;
  let { hp, damage } = scaleEnemy(template, level);
  const isFinalBossSlot = bossKind != null;
  if (level <= 25 && !isElite && !isFinalBossSlot) {
    hp = Math.min(hp, EARLY_HP_CAP);
  } else if (level <= 50 && !isElite && !isFinalBossSlot) {
    hp = Math.min(hp, MID_HP_CAP);
  } else if (level <= 100 && !isElite && !isFinalBossSlot) {
    hp = Math.min(hp, LATE_HP_CAP);
  } else if (!isElite && !isFinalBossSlot) {
    hp = Math.min(hp, DEEP_HP_CAP);
  }
  if (isElite) {
    hp = Math.round(hp * 1.6);
    damage = Math.round(damage * 1.2);
    // Rebalance v6 — cap the elite slot (was uncapped; L150 elites hit ~498 HP).
    hp = Math.min(hp, eliteHpCap(level));
  }
  if (isFinalBossSlot) {
    const boost = bossStatBoost(bossKind);
    hp = Math.round(hp * boost.hpMul);
    damage = Math.round(damage * boost.dmgMul);
    // Rebalance v6 — cap the promoted slot so depth-scaling × boss-boost can't
    // exceed a beatable ceiling. Without this, deep boss levels were 0% clears.
    hp = Math.min(hp, bossHpCap(level, bossKind));
  }
  const namePrefix = isFinalBossSlot ? bossNamePrefix(bossKind) : isElite ? 'Elite ' : '';
  return {
    id: `${idPrefix}${index}`,
    name: `${namePrefix}${template.name}`,
    emoji: template.emoji,
    hp,
    maxHp: hp,
    damage,
    archetypeId: template.id,
    family: template.family,
    role: template.role,
    // Mini-bosses keep their family ability so the gold-ringed portrait
    // actually feels threatening. Mid/chapter bosses skip — boss rules carry
    // the gimmick and we don't want to double-stack telegraphs.
    ability: !isElite && (bossKind === 'mini' || !isFinalBossSlot) ? template.ability : undefined,
    abilityCooldown: !isElite && (bossKind === 'mini' || !isFinalBossSlot) && template.ability ? template.abilityCooldown : undefined,
    abilityCooldownMax: !isElite && (bossKind === 'mini' || !isFinalBossSlot) && template.ability ? template.abilityCooldown : undefined,
    telegraphLabel: !isElite && (bossKind === 'mini' || !isFinalBossSlot) ? template.telegraphLabel : undefined,
    tier: bossKind === 'mini' ? 'mini' : isFinalBossSlot ? 'boss' : undefined,
  };
}

// Levels that get a second wave: chapter beats only, plus every 20 levels
// from L60 upward (for late-campaign variety).
//
// Mid-boss levels (25, 75, 125) USED to spawn a wave-2 reinforcement on top
// of an already 3-enemy fight + a boss rule. Per Monte Carlo this pushed the
// encounter past any survivable DPS budget, so mid-bosses now stay at one
// wave — the boss promotion + rule already carries the difficulty bump.
function hasSecondWave(level: number): boolean {
  if (level <= 24) return false;
  if (level === 50 || level === 100 || level === 150) return true; // chapter bosses
  if (level >= 60 && level % 20 === 0) return true;
  return false;
}

export function generateLevel(level: number): LevelDefinition {
  const seed = seedFor(level);
  const rng = mulberry32(seed);
  const enemyCount = enemyCountFor(level, rng);
  const enemies: Enemy[] = [];
  const turnLimit = turnLimitFor(level);
  const objective = objectiveFor(level, turnLimit);
  const mechanics = mechanicsForLevel(level);
  const bossKind = bossKindForLevel(level);
  const isChapterBossLevel = bossKind === 'chapter';

  // For chapter bosses, wave 1 = warm-up gauntlet of 2 mooks; the boss spawns
  // in wave 2 so the fight reads like a proper boss arena. Other tiers keep
  // the boss in wave 1 (final slot) per the legacy generator behaviour.
  const wave1EnemyCount = isChapterBossLevel ? 2 : enemyCount;
  const wave1BossKind: BossKind = isChapterBossLevel ? null : bossKind;

  for (let i = 0; i < wave1EnemyCount; i++) {
    const t = pickTemplate(level, rng);
    const isElite = objective.type === 'defeat_elite' && i === wave1EnemyCount - 1 && !wave1BossKind;
    const isFinalBossSlot = wave1BossKind != null && i === wave1EnemyCount - 1;
    enemies.push(buildEnemy(t, level, i, {
      isElite,
      bossKind: isFinalBossSlot ? wave1BossKind : null,
      idPrefix: 'e',
    }));
  }

  // Layered Goals (Band 4): only when the multi_objective mechanic is active
  // AND the primary isn't already a stretch target — keep them composable.
  const wantsSecondary = mechanics.includes('multi_objective')
    && (objective.type === 'defeat_all' || objective.type === 'defeat_elite');
  const secondary = wantsSecondary ? rollSecondaryObjective(seed, level, turnLimit) : null;

  // ── Build optional second wave ───────────────────────────────────────────
  let waves: LevelModifiers['waves'];
  if (hasSecondWave(level)) {
    const waveEnemies: Enemy[] = [];
    if (isChapterBossLevel) {
      // Wave 2 = the boss alone (single dramatic spawn).
      const t = pickTemplate(level, rng);
      waveEnemies.push(buildEnemy(t, level, 0, {
        bossKind,
        idPrefix: 'w2-',
      }));
    } else {
      // Mid/regular multi-wave levels: 1-2 reinforcements, never with a 2nd
      // ability-bearing enemy if wave 1 already had one.
      const wave1HasAbility = enemies.some(e => !!e.ability);
      // Rebalance v6 — mid AND mini bosses already carry a heavy final slot in
      // wave 1, so their reinforcement wave is a single mook. Only plain
      // deep-band wave levels roll the 1-2 spread.
      const reinforceCount = (bossKind === 'mid' || bossKind === 'mini') ? 1 : (rng() < 0.5 ? 1 : 2);
      for (let i = 0; i < reinforceCount; i++) {
        let t = pickTemplate(level, rng);
        if (wave1HasAbility && t.ability) {
          // Re-roll once to a non-ability template if pool allows it.
          let pool = rosterPoolForLevel(level).filter(e => !e.ability);
          if (level <= 50) pool = pool.filter(e => !e.ability);
          if (pool.length) t = pool[rngInt(rng, pool.length)];
        }
        // Reinforcements are always mooks — the mid-boss is already in wave 1's
        // final slot, so we never re-tag a wave-2 enemy as a boss.
        waveEnemies.push(buildEnemy(t, level, i, {
          bossKind: null,
          idPrefix: 'w2-',
        }));
      }
    }
    if (waveEnemies.length) {
      waves = [{ enemies: waveEnemies, reinforcement_turns: 2 }];
    }
  }

  return {
    level_number: level,
    chapter: chapterFor(level),
    difficulty_tier: difficultyTierFor(level),
    generation_seed: seed,
    board_size: 5,
    enemy_config: enemies,
    turn_limit: turnLimit,
    objective_type: objective.type,
    objective_target: objective.target,
    modifiers: {
      mechanics,
      intro_mechanic: introMechanicForLevel(level),
      secondary_objective: secondary,
      boss_rule: bossRuleForLevel(level),
      boss_kind: bossKind,
      waves,
    },
  };
}

export function objectiveLabel(o: ObjectiveType): string {
  switch (o) {
    case 'defeat_all':   return 'Defeat all enemies';
    case 'survive':      return 'Survive every turn';
    case 'reach_score':  return 'Reach the score target';
    case 'defeat_elite': return 'Defeat the champion';
  }
}

// Star rating for results — score-based, with bonus for clearing under move budget.
export function starsFor(score: number, level: number, cleared: boolean): 0 | 1 | 2 | 3 {
  if (!cleared) return 0;
  const baseTarget = 600 + level * 30;
  if (score >= baseTarget * 1.5) return 3;
  if (score >= baseTarget) return 2;
  return 1;
}
