// Deterministic level generator. Same level number → same level for everyone.
import { mulberry32, rngInt } from "./prng";
import type { Enemy } from "./dungeonGenerator";
import {
  mechanicsForLevel,
  introMechanicForLevel,
  type MechanicId,
} from "./mechanics";
import {
  rollSecondaryObjective,
  type SecondaryObjective,
} from "./layeredGoals";
import {
  bossRuleForLevel,
  bossKindForLevel,
  bossStatBoost,
  bossNamePrefix,
  type BossRuleId,
  type BossKind,
} from "./bossRules";
import {
  rosterPoolForLevel,
  rosterPoolForLevelAllowingNextChapter,
  type RosterEntry,
} from "./enemyRoster";
import { scoreTargetForEnemies } from "./scoring";

export type ObjectiveType =
  "defeat_all" | "survive" | "reach_score" | "defeat_elite";

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
  /** Version 2 uses earned combat work, never opening health/remaining turns. */
  score_objective_version?: 2;
  [k: string]: unknown;
}

// Legacy template list — kept ONLY as a fallback safety net for any code path
// that still references the old shape. New picks go through `rosterPoolForLevel`.
const ENEMY_TEMPLATES: Array<{
  name: string;
  emoji: string;
  hp: number;
  damage: number;
  tier: number;
}> = [
  { name: "Cave Bat", emoji: "🦇", hp: 45, damage: 4, tier: 1 },
  { name: "Goblin Scout", emoji: "👹", hp: 60, damage: 5, tier: 1 },
];

export function chapterFor(level: number): number {
  return Math.max(1, Math.ceil(level / 50));
}

// Fantasy chapter names — only used for flavor.
const CHAPTER_NAMES: Record<number, { name: string; subtitle: string }> = {
  1: { name: "The Ember Caves", subtitle: "Where every delver begins." },
  2: { name: "The Crystal Hollow", subtitle: "Frost and cursed steel await." },
  3: { name: "The Shattered Vault", subtitle: "Ancient drakes stir below." },
};
export function chapterMeta(chapter: number): {
  name: string;
  subtitle: string;
} {
  return (
    CHAPTER_NAMES[chapter] ?? {
      name: `Depth ${chapter}`,
      subtitle: "Uncharted runes.",
    }
  );
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

// Class builds get recovery room; bosses and reinforcements add their own
// visible move budget. Difficulty comes from the roster and pressure rather
// than shortening every deep fight into a damage race.
function turnLimitFor(level: number): number {
  const base = level <= 50 ? 14 : 15;
  const kind = bossKindForLevel(level);
  // Levels with reinforcement waves (deep band, every 20) need extra turns
  // to handle the extra HP pool — without this they're mathematically unwinnable.
  // Inline check (mirrors hasSecondWave) to avoid TDZ on the function.
  const hasWave =
    level === 50 ||
    level === 100 ||
    level === 150 ||
    (level >= 60 && level % 20 === 0 && level > 24);
  // Rebalance v6 — mini-boss levels that ALSO spawn a wave (L60, L120, …) used
  // to fall into the `mini` early-return and never pick up the wave bonus, so a
  // full extra wave landed on a +2 budget. Grant BOTH bumps.
  if (kind === "mini") return base + 3 + (hasWave ? 3 : 0);
  if (kind === "mid") return base + 4;
  if (kind === "chapter") return base + (level === 150 ? 4 : 5);
  if (hasWave) return base + 3;
  return base;
}

// Enemy count ramp — Rebalance v2: smooth the L14 cliff. Playtest showed
// the 25% chance of 3 enemies at L14 paired with tanky Slime rolls created
// a 2.5× HP spike vs L13. We now keep 2 enemies through L15, then ramp.
function enemyCountFor(level: number, rng: () => number): number {
  if (level <= 15) return 2; // tutorial-friendly Chapter 1 opener
  if (level <= 25) return rng() < 0.6 ? 2 : 3; // 60/40 split — gentle introduction
  if (level <= 40) return rng() < 0.45 ? 2 : 3; // 45/55 — softer post-tutorial ramp
  if (level <= 60) return rng() < 0.3 ? 2 : 3; // mostly 3, occasional 2
  // Rebalance v5: cap deep-band enemy count at 3. Prior 3-4 spike combined
  // with deep-band HP scaling created encounters past 600 effective HP that
  // no class could close inside the turn budget.
  return 3;
}

// Role-aware ceilings keep strikers fragile and tanks durable while allowing
// chapter-three gear/masteries to meet stronger enemies instead of a flat cap.
function regularHpCap(level: number, role: RosterEntry["role"]): number {
  if (level <= 25) return 110;
  const progress = Math.max(0, level - 50);
  const base =
    role === "tank" || role === "controller"
      ? 150
      : role === "defender"
        ? 140
        : role === "swarm"
          ? 95
          : role === "support" || role === "summoner"
            ? 115
            : 130;
  const growth =
    role === "tank" || role === "controller"
      ? 2
      : role === "defender"
        ? 1.65
        : role === "swarm"
          ? 0.55
          : role === "support" || role === "summoner"
            ? 1
            : 1.2;
  if (level < 50) return Math.round(110 + ((base - 110) * (level - 25)) / 25);
  return Math.round(base + progress * growth);
}
function eliteHpCap(level: number): number {
  return Math.round(150 + Math.max(0, level - 25) * 2.2);
}
function bossHpCap(level: number, kind: BossKind): number {
  return Math.round(
    (kind === "mini" ? 135 : 175) + level * (kind === "mini" ? 1.9 : 3),
  );
}

// (HP/damage scaling lives below — single RosterEntry-based implementation.)

// Pick a roster archetype for this level. The roster's chapter/tier gating
// already mirrors the prior pool-growth logic, so we just bias early levels
// toward "soft" damage profiles to keep the L1-L15 ramp friendly.
function isDurable(template: { role?: string }): boolean {
  return (
    template.role === "tank" ||
    template.role === "defender" ||
    template.role === "controller"
  );
}

function pickTemplate(
  level: number,
  rng: () => number,
  options: { plain?: boolean; avoidDurable?: boolean } = {},
): RosterEntry {
  // L36-50 "bleed-in": ~25% chance to widen the pool to Chapter 2 so the
  // earlier ability gate (level <= 30) actually has Chapter-2 ability enemies
  // to surface. Keeps Chapter 1 dominant the rest of the time.
  const useNextChapter = level >= 36 && level <= 50 && rng() < 0.25;
  let pool = useNextChapter
    ? rosterPoolForLevelAllowingNextChapter(level)
    : rosterPoolForLevel(level);
  // Never seed an ability-bearing enemy in Chapter 1 — keeps intro readable.
  if (level <= 30) pool = pool.filter((e) => !e.ability);
  const eligible = (entry: RosterEntry) =>
    (!options.plain || !entry.ability) &&
    (!options.avoidDurable || !isDurable(entry));
  pool = pool.filter(eligible);
  // A new chapter should predominantly feature its own threats. Familiar
  // enemies remain a minority, rather than diluting every deep encounter.
  if (level > 50 && rng() < 0.8) {
    const native = pool.filter(
      (enemy) => enemy.chapter === Math.min(3, chapterFor(level)),
    );
    if (native.length) pool = native;
  }
  // Per-enemy DPS cap on early levels — prefer tankier-but-softer templates.
  if (level <= 15) {
    const softPool = pool.filter((e) => e.baseDamage <= 6);
    if (softPool.length && rng() < 0.7) pool = softPool;
  }
  // Hard fallback so the picker can never crash on an empty pool.
  if (pool.length === 0)
    pool = rosterPoolForLevel(Math.max(1, level)).filter(eligible);
  if (pool.length === 0) {
    const fb = ENEMY_TEMPLATES[0];
    return {
      id: "fallback",
      name: fb.name,
      family: "cave",
      role: "striker",
      chapter: 1,
      tier: 1,
      emoji: fb.emoji,
      baseHp: fb.hp,
      baseDamage: fb.damage,
    };
  }
  return pool[rngInt(rng, pool.length)];
}

function pickBossTemplate(level: number, rng: () => number): RosterEntry {
  const pool = rosterPoolForLevel(level).filter(
    (enemy) =>
      enemy.chapter === Math.min(3, chapterFor(level)) &&
      (enemy.role === "striker" ||
        enemy.role === "tank" ||
        enemy.role === "controller"),
  );
  return pool.length
    ? pool[rngInt(rng, pool.length)]
    : pickTemplate(level, rng);
}

// Continuous depth scaling is bounded separately by role. A tank keeps its
// larger health pool; a striker trades durability for immediate pressure.
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
function objectiveFor(level: number): { type: ObjectiveType; target: number } {
  // A named boss should always be the thing the player must defeat. This also
  // prevents cadence overlaps (for example L130 is divisible by 13) from
  // turning a boss into an optional target on a survive stage.
  const bossKind = bossKindForLevel(level);
  if (bossKind === "mid" || bossKind === "chapter") {
    return { type: "defeat_elite", target: 0 };
  }
  // Default everywhere: defeat all enemies.
  if (level < 15) return { type: "defeat_all", target: 0 };
  // From level 15: occasional survive levels.
  if (level % 13 === 0) return { type: "survive", target: turnLimitFor(level) };
  // From level 30: occasional score targets.
  if (level >= 30 && level % 17 === 0) {
    // The target is authored from the complete roster after waves are built.
    return { type: "reach_score", target: 0 };
  }
  // From chapter 2 (51+): elite levels every ~25.
  if (level >= 51 && level % 25 === 0)
    return { type: "defeat_elite", target: 0 };
  return { type: "defeat_all", target: 0 };
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
  const { isElite = false, bossKind = null, idPrefix = "e" } = opts;
  let { hp, damage } = scaleEnemy(template, level);
  const isFinalBossSlot = bossKind != null;
  if (!isElite && !isFinalBossSlot)
    hp = Math.min(hp, regularHpCap(level, template.role));
  if (isElite) {
    hp = Math.round(hp * 1.6);
    damage = Math.round(damage * 1.2);
    hp = Math.min(hp, eliteHpCap(level));
  }
  if (isFinalBossSlot) {
    const boost = bossStatBoost(bossKind);
    hp = Math.round(hp * boost.hpMul);
    damage = Math.round(damage * boost.dmgMul);
    // Rebalance v6 — cap the promoted slot so depth-scaling × boss-boost can't
    // exceed a beatable ceiling. Without this, deep boss levels were 0% clears.
    hp = Math.min(hp, bossHpCap(level, bossKind));
    // Promotion carries a real minimum encounter budget even if its base
    // archetype is a familiar low-HP foe. Boss identities never roll a moth.
    const bossFloor =
      bossKind === "mini"
        ? 110 + level * 1.55
        : bossKind === "mid"
          ? 130 + level * 2.65
          : 90 + level * 3.55;
    hp = Math.max(hp, Math.round(bossFloor));
    const attackFloor =
      bossKind === "mini"
        ? 6 + level * 0.08
        : bossKind === "mid"
          ? 7 + level * 0.13
          : 4 + level * 0.19;
    damage = Math.max(damage, Math.round(attackFloor));
  }
  const namePrefix = isFinalBossSlot
    ? bossNamePrefix(bossKind)
    : isElite
      ? "Elite "
      : "";
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
    ability:
      !isElite && (bossKind === "mini" || !isFinalBossSlot)
        ? template.ability
        : undefined,
    abilityCooldown:
      !isElite && (bossKind === "mini" || !isFinalBossSlot) && template.ability
        ? template.abilityCooldown
        : undefined,
    abilityCooldownMax:
      !isElite && (bossKind === "mini" || !isFinalBossSlot) && template.ability
        ? template.abilityCooldown
        : undefined,
    telegraphLabel:
      !isElite && (bossKind === "mini" || !isFinalBossSlot)
        ? template.telegraphLabel
        : undefined,
    tier: bossKind === "mini" ? "mini" : isFinalBossSlot ? "boss" : undefined,
  };
}

// Levels that get a second wave: every chapter-kind boss (including the legacy
// L130/L140 flagships), plus every 20 levels from L60 upward for variety.
//
// Mid-boss levels (25, 75, 125) USED to spawn a wave-2 reinforcement on top
// of an already 3-enemy fight + a boss rule. Per Monte Carlo this pushed the
// encounter past any survivable DPS budget, so mid-bosses now stay at one
// wave — the boss promotion + rule already carries the difficulty bump.
function hasSecondWave(level: number): boolean {
  if (level <= 24) return false;
  if (bossKindForLevel(level) === "chapter") return true;
  if (level >= 60 && level % 20 === 0) return true;
  return false;
}

export function generateLevel(level: number): LevelDefinition {
  const seed = seedFor(level);
  const rng = mulberry32(seed);
  const enemyCount = enemyCountFor(level, rng);
  const enemies: Enemy[] = [];
  const turnLimit = turnLimitFor(level);
  const objective = objectiveFor(level);
  // Layered Goals is an optional secondary bonus, so it only exists beside a
  // straightforward combat objective. Score/survive stages are already focus
  // encounters and must never advertise a bonus that was not generated.
  const allowsLayeredGoal =
    objective.type === "defeat_all" || objective.type === "defeat_elite";
  const mechanics = mechanicsForLevel(level).filter(
    (mechanic) => mechanic !== "multi_objective" || allowsLayeredGoal,
  );
  const bossKind = bossKindForLevel(level);
  const isChapterBossLevel = bossKind === "chapter";

  // For chapter bosses, wave 1 = warm-up gauntlet of 2 mooks; the boss spawns
  // in wave 2 so the fight reads like a proper boss arena. Other tiers keep
  // the boss in wave 1 (final slot) per the legacy generator behaviour.
  const wave1EnemyCount = isChapterBossLevel ? 2 : enemyCount;
  const wave1BossKind: BossKind = isChapterBossLevel ? null : bossKind;

  for (let i = 0; i < wave1EnemyCount; i++) {
    let t = pickTemplate(level, rng);
    // Only ordinary elite stages promote a wave-1 mook. Chapter bosses use a
    // mook warm-up followed by the actual priority target in wave 2.
    const isElite =
      objective.type === "defeat_elite" &&
      i === wave1EnemyCount - 1 &&
      bossKind === null;
    const isFinalBossSlot = wave1BossKind != null && i === wave1EnemyCount - 1;
    if (isFinalBossSlot) t = pickBossTemplate(level, rng);
    // One ability and one durable regular foe give each wave a readable
    // priority without procedural triple-tank damage-race walls.
    if (!isFinalBossSlot) {
      const plain = enemies.some((enemy) => !!enemy.ability);
      const avoidDurable = enemies.some((enemy) =>
        isDurable({ role: enemy.role ?? "striker" }),
      );
      if ((plain && t.ability) || (avoidDurable && isDurable(t))) {
        t = pickTemplate(level, rng, { plain, avoidDurable });
      }
    }
    enemies.push(
      buildEnemy(t, level, i, {
        isElite,
        bossKind: isFinalBossSlot ? wave1BossKind : null,
        idPrefix: "e",
      }),
    );
  }

  // Bound whole-wave pressure so procedural combinations cannot produce
  // an invisible attack cliff. Deeper chapters still demand timely defense.
  if (level > 50) {
    const damageBudget = Math.round(30 + (level - 50) * 0.32);
    const totalDamage = enemies.reduce((sum, enemy) => sum + enemy.damage, 0);
    if (totalDamage > damageBudget) {
      const scale = damageBudget / totalDamage;
      for (const enemy of enemies)
        enemy.damage = Math.max(3, Math.floor(enemy.damage * scale));
    }
  }

  // Summoners add an extra target. Ordinary defeat-all rooms get the same two
  // visible recovery turns as an authored reinforcement wave, so the ability
  // creates urgency without making the original three-enemy HP budget
  // mathematically dishonest.
  const encounterTurnLimit =
    objective.type === "defeat_all" &&
    bossKind === null &&
    enemies.some((enemy) => enemy.ability === "summon_minion")
      ? turnLimit + 2
      : turnLimit;

  // Layered Goals (Band 4): only when the multi_objective mechanic is active
  // AND the primary isn't already a stretch target — keep them composable.
  const wantsSecondary =
    mechanics.includes("multi_objective") &&
    (objective.type === "defeat_all" || objective.type === "defeat_elite");
  const secondary = wantsSecondary
    ? rollSecondaryObjective(seed, level, encounterTurnLimit)
    : null;

  // ── Build optional second wave ───────────────────────────────────────────
  let waves: LevelModifiers["waves"];
  if (hasSecondWave(level)) {
    const waveEnemies: Enemy[] = [];
    if (isChapterBossLevel) {
      // Wave 2 = the boss. Last Stand needs a living guard or its immunity
      // rule is a no-op, so that specific encounter adds one lighter oathbound
      // mook before the boss.
      if (bossRuleForLevel(level) === "last_stand") {
        const guardTemplate = pickTemplate(level, rng, {
          plain: true,
          avoidDurable: true,
        });
        const guard = buildEnemy(guardTemplate, level, 0, {
          bossKind: null,
          idPrefix: "w2-",
        });
        guard.name = `Oathbound ${guard.name}`;
        guard.hp = Math.max(40, Math.round(guard.hp * 0.65));
        guard.maxHp = guard.hp;
        waveEnemies.push(guard);
      }
      const t = pickBossTemplate(level, rng);
      waveEnemies.push(
        buildEnemy(t, level, waveEnemies.length, {
          bossKind,
          idPrefix: "w2-",
        }),
      );
    } else {
      // Mid/regular multi-wave levels: 1-2 reinforcements, never with a 2nd
      // ability-bearing enemy if wave 1 already had one.
      const wave1HasAbility = enemies.some((e) => !!e.ability);
      // Rebalance v6 — mid AND mini bosses already carry a heavy final slot in
      // wave 1, so their reinforcement wave is a single mook. Only plain
      // deep-band wave levels roll the 1-2 spread.
      const reinforceCount =
        bossKind === "mid" || bossKind === "mini" ? 1 : rng() < 0.5 ? 1 : 2;
      for (let i = 0; i < reinforceCount; i++) {
        let t = pickTemplate(level, rng);
        const plain =
          wave1HasAbility || waveEnemies.some((enemy) => !!enemy.ability);
        const avoidDurable = waveEnemies.some((enemy) =>
          isDurable({ role: enemy.role ?? "striker" }),
        );
        if ((plain && t.ability) || (avoidDurable && isDurable(t))) {
          t = pickTemplate(level, rng, { plain, avoidDurable });
        }
        // Reinforcements are always mooks — the mid-boss is already in wave 1's
        // final slot, so we never re-tag a wave-2 enemy as a boss.
        waveEnemies.push(
          buildEnemy(t, level, i, {
            bossKind: null,
            idPrefix: "w2-",
          }),
        );
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
    turn_limit: encounterTurnLimit,
    objective_type: objective.type,
    objective_target:
      objective.type === "reach_score"
        ? scoreTargetForEnemies([
            ...enemies,
            ...(waves ?? []).flatMap((wave) => wave.enemies),
          ])
        : objective.target,
    modifiers: {
      mechanics,
      intro_mechanic: introMechanicForLevel(level),
      secondary_objective: secondary,
      boss_rule: bossRuleForLevel(level),
      boss_kind: bossKind,
      waves,
      ...(objective.type === "reach_score"
        ? { score_objective_version: 2 as const }
        : {}),
    },
  };
}

export function objectiveLabel(o: ObjectiveType): string {
  switch (o) {
    case "defeat_all":
      return "Defeat all enemies";
    case "survive":
      return "Survive every turn";
    case "reach_score":
      return "Earn combat score";
    case "defeat_elite":
      return "Defeat the champion";
  }
}

// Star rating for results — score-based, with bonus for clearing under move budget.
export function starsFor(
  score: number,
  level: number,
  cleared: boolean,
): 0 | 1 | 2 | 3 {
  if (!cleared) return 0;
  const baseTarget = 600 + level * 30;
  if (score >= baseTarget * 1.5) return 3;
  if (score >= baseTarget) return 2;
  return 1;
}
