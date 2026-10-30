// Headless Rune Delve simulator — drives the real combat/board engines with
// a deterministic heuristic AI player so we can stress-test future levels
// before any real player touches them.
//
// Pure module. Zero React, zero DB. Safe to import anywhere.

import { ensurePlayableBoard } from "./boardEngine";
import { mulberry32, type Rng } from "./prng";
import { generateBoard, BOARD_SIZE, type RuneType } from "./dungeonGenerator";
import { isValidChain, resolveBoard, cellKey, type Cell } from "./boardEngine";
import {
  initialCombat,
  applyChain,
  enemiesAttack,
  useAbility as activateAbility,
  endTurn,
  spawnWave,
  MAX_MANA,
  chainTier,
  type CombatState,
} from "./combatEngine";
import { generateLevel, type LevelDefinition } from "./levelGenerator";
import { getClass, type HeroClass } from "./classConfig";
import { filterTargetable, type BossRuleId } from "./bossRules";
import { evaluateObjective, normalizeScoreObjectiveTarget } from "./objectives";
import { advanceResonance, resonanceWillBurst } from "./resonance";
import {
  campaignTurnBudget,
  prepareCampaignEnemies,
} from "./campaignEncounter";
import {
  applyPhaseDamageBump,
  detectPhaseTransitions,
  type BossPhaseIndex,
} from "./bossPhases";
import { buildInitialSeals, sealsBrokenByChain } from "./sealedTiles";
import { buildInitialEclipse } from "./eclipseTiles";
import {
  buildInitialCorruption,
  resolveChainAgainstCorruption,
  spreadCorruption,
} from "./corruptedTiles";
import { buildInitialShift, applyShift } from "./shiftingRunes";
import {
  buildInitialPairs,
  consumePairs,
  pairsTriggeredByChain,
} from "./linkedPairs";
import {
  computeLayoutZones,
  countChainInZone,
  HAZARD_DAMAGE,
  HAZARD_MAX_DAMAGE_PER_CHAIN,
} from "./layoutZones";
import { getLayoutIdForLevel } from "./chamberAssignment";
import { mechanicsForLevel } from "./mechanics";
import { getActiveMasteries } from "./classMastery";
import {
  getMasteryStartingMana,
  getMasteryMaxHpBonus,
  getMasteryAbilityManaCost,
  getMasteryChainDamageMult,
  getMasteryOpeningCritMult,
  getMasteryBlueChainHeal,
  getMasteryOpeningHeal,
  getMasteryShieldBonus,
} from "./masteryEffects";
import {
  buildActive,
  computeChainMods,
  getStartingMana,
  getStartingShieldTurns,
  getForeseerBonusTurns,
  getTelegraphReadyEarly,
  getSealedTilesSpeedup,
  getRelicRankMaxHpBonus,
  type ActiveRelics,
} from "./relicEffects";

/** The profile surface deliberately accepts only effects fully modelled here.
 * A class above level 49 or an unmodelled relic must not silently produce an
 * apparently authoritative balance measurement. */
export interface SimBuildProfile {
  id: string;
  classLevel: number;
  slots?: string[];
  ranks?: Record<string, number>;
}

export interface SimOptions {
  /** Match campaign's opening seed and per-chain refill RNG instead of
   * sampling alternate boards. Identical runs intentionally repeat. */
  canonicalBoard?: boolean;
}

export const NAKED_SIM_PROFILE: SimBuildProfile = {
  id: "naked",
  classLevel: 1,
};

/** Current first-traversal anchors, not a claim about a live account's gear.
 * The first relic is affordable after roughly six early clears. */
export function progressionSimProfile(level: number): SimBuildProfile {
  const anchors = [
    [1, 1],
    [15, 5],
    [50, 12],
    [100, 20],
    [150, 25],
  ];
  let classLevel = 1;
  for (let i = 1; i < anchors.length; i++) {
    const [end, endClass] = anchors[i];
    const [start, startClass] = anchors[i - 1];
    if (level >= start)
      classLevel = Math.round(
        startClass +
          (endClass - startClass) *
            Math.min(1, (level - start) / (end - start)),
      );
  }
  const rank = level >= 101 ? 3 : level >= 51 ? 2 : 1;
  return {
    id: "progression",
    classLevel,
    slots:
      level < 7
        ? []
        : level < 15
          ? ["ember_edge"]
          : ["ember_edge", "aether_spark"],
    ranks: { ember_edge: rank, aether_spark: rank },
  };
}

/** Separate earned-economy comparison; the existing progression baseline stays
 * unchanged. All tier-three combat
 * effects are resolved by combatEngine.useAbility with active mastery IDs. */
export function proposedEarnedSimProfile(level: number): SimBuildProfile {
  const base = progressionSimProfile(level);
  const classLevel =
    level <= 50
      ? base.classLevel
      : level <= 100
        ? Math.round(12 + ((level - 50) * 12) / 50)
        : Math.round(24 + (Math.min(50, level - 100) * 16) / 50);
  return { ...base, id: "earned-proposal", classLevel };
}

/** Affordable class-aware loadouts for the earned economy. A defensive second
 * item suits Shadowstep's cheaper setup; other heroes keep the mana opener.
 * Class level 25 adds the third owned item, with no unsupported relic procs. */
export function affordableSimProfile(
  level: number,
  cls: HeroClass,
): SimBuildProfile {
  const base = proposedEarnedSimProfile(level);
  const rank = level >= 101 ? 3 : level >= 51 ? 2 : 1;
  const first = cls === "mage" ? "aether_spark" : "ember_edge";
  const two =
    cls === "rogue"
      ? ["ember_edge", "iron_resolve"]
      : ["ember_edge", "aether_spark"];
  const slots =
    level < 7
      ? []
      : level < 15
        ? [first]
        : base.classLevel < 25
          ? two
          : [...two, cls === "rogue" ? "aether_spark" : "iron_resolve"];
  return {
    ...base,
    id: "earned-affordable",
    slots,
    ranks: { ember_edge: rank, aether_spark: rank, iron_resolve: rank },
  };
}

function validateProfile(profile: SimBuildProfile): void {
  if (
    !Number.isInteger(profile.classLevel) ||
    profile.classLevel < 1 ||
    profile.classLevel >= 50
  )
    throw new Error(
      "Simulator profiles support class levels 1–49 (mastery tiers 1–3). Higher-tier page procs are not modelled.",
    );
  const supported = new Set([
    "ember_edge",
    "aether_spark",
    "iron_resolve",
    "foreseers_lens",
    "foresight",
    "keysight",
    "sapphire_flow",
    "verdant_heart",
    "bulwark",
    "crimson_tide",
    "executioners_mark",
    "desperate_surge",
  ]);
  if (
    (profile.slots?.length ?? 0) > (profile.classLevel >= 25 ? 3 : 2) ||
    profile.slots?.some((id) => !supported.has(id))
  )
    throw new Error(
      "Simulator profile contains unsupported equipment or a locked relic slot; the third modelled slot unlocks at class level 25.",
    );
}

// ─── Per-run telemetry ──────────────────────────────────────────────────────
export interface SimRunResult {
  cleared: boolean;
  turnsUsed: number;
  turnsRemaining: number;
  /** Opening turns plus only the reinforcement grants actually received. */
  turnBudget: number;
  authoredTurnBudget: number;
  wavesSpawned: number;
  wavesTotal: number;
  phaseTransitions: number;
  maxHp: number;
  openingMana: number;
  openingShieldTurns: number;
  chainActions: number;
  abilityCasts: number;
  objectiveTarget: number;
  failureReason: "hp" | "turns" | "objective" | "board" | "safety" | null;
  hpRemaining: number;
  totalDamage: number;
  damageTaken: number;
  longestChain: number;
  enemiesDefeated: number;
  enemyCountStart: number;
  abilityUsed: boolean;
  /** Lowest HP the hero ever reached (≤25 = "near-death"). */
  minHp: number;
  /** Count of turns where hero HP was ≤25%. */
  nearDeathTurns: number;
  /** Number of times an enemy ability fired (sum across all enemies). */
  enemyAbilityFires: number;
  /** Number of times a heavy telegraph fired. */
  heavyStrikeFires: number;
  /** Boss rule active in this level (if any). */
  bossRule: BossRuleId | null;
  resonanceBursts: number;
  bonusActions: number;
  boardReshuffles: number;
}

// ─── Aggregate stats ────────────────────────────────────────────────────────
export interface SimAggregate {
  level: number;
  runs: number;
  cleared: number;
  clearRate: number; // 0..1
  avgTurnsUsed: number;
  avgTurnsRemaining: number;
  avgTurnBudget: number;
  avgHpRemaining: number;
  avgDamageDealt: number;
  avgDamageTaken: number;
  avgLongestChain: number;
  /** All authored enemy HP / all authored turns, including reinforcements. */
  hpPerTurnBudget: number;
  /** Avg HP the hero loses per turn — how much pressure the level applies. */
  avgIncomingPerTurn: number;
  /** % of runs that ever dipped below 25% HP. */
  nearDeathRate: number;
  /** Avg lowest HP across all runs — the "scariest moment". */
  avgMinHp: number;
  /** Avg ability fires per run, by mechanic source. */
  avgEnemyAbilityFires: number;
  avgHeavyStrikeFires: number;
  /** Verdict label so the dashboard can color-code. */
  verdict: "Brutal" | "Hard" | "Balanced" | "Easy" | "Trivial";
}

// ─── Heuristic AI ───────────────────────────────────────────────────────────
// Find the best chain on the current board for the current state. The AI is
// intentionally simple but matches what an attentive human would do:
//   • If hero HP < 35% and a green chain is available → heal.
//   • If mana is full → use class ability before chaining.
//   • Otherwise: pick the longest available chain, prefer red when enemies
//     have a heavy telegraph in ≤1 turn, else prefer red > gold > blue > green
//     (color tie-break only when chain lengths tie).
//
// All chains are flood-filled greedily — pure DFS exploring 8-directional
// neighbours of the same color. We keep the longest chain found per starting
// cell and pick the best overall.
type ChainCandidate = { cells: Cell[]; type: RuneType };

function findAllMaxChains(
  grid: RuneType[][],
  seals: Set<string>,
  eclipse: Set<string>,
): ChainCandidate[] {
  const seenSeed = new Set<string>();
  const results: ChainCandidate[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const start: Cell = { r, c };
      const k = cellKey(start);
      if (seenSeed.has(k) || seals.has(k) || eclipse.has(k)) continue;
      const type = grid[r][c];
      // DFS to find the longest contiguous same-color chain from this seed.
      let best: Cell[] = [start];
      const stack: { path: Cell[]; visited: Set<string> }[] = [
        { path: [start], visited: new Set([k]) },
      ];
      while (stack.length) {
        const { path, visited } = stack.pop()!;
        if (path.length > best.length) best = path;
        if (best.length >= 9) break;
        const tail = path[path.length - 1];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = tail.r + dr;
            const nc = tail.c + dc;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE)
              continue;
            const nk = `${nr}-${nc}`;
            if (visited.has(nk) || seals.has(nk)) continue;
            if (grid[nr][nc] !== type) continue;
            // Cap path length to keep the DFS bounded — chains > 10 are
            // vanishingly rare on a 5x5 board and the AI doesn't gain extra
            // value past length 6.
            if (path.length >= 9) continue;
            const nv = new Set(visited);
            nv.add(nk);
            stack.push({ path: [...path, { r: nr, c: nc }], visited: nv });
          }
        }
      }
      if (best.length >= 3) {
        results.push({ cells: best, type });
        for (const c2 of best) seenSeed.add(cellKey(c2));
      }
    }
  }
  return results;
}

function pickBestChain(
  grid: RuneType[][],
  state: CombatState,
  cls: HeroClass,
  level: number,
  bossRule: BossRuleId | null,
  seals: Set<string>,
  eclipse: Set<string>,
  preview: (candidate: ChainCandidate) => ReturnType<typeof applyChain>,
  boardCost: (candidate: ChainCandidate) => number,
): ChainCandidate | null {
  const chains = findAllMaxChains(grid, seals, eclipse);
  if (!chains.length) return null;

  const hpPct = state.hp / state.maxHp;
  const enemyHasImmediateHeavy = state.enemies.some(
    (e) => e.hp > 0 && e.intent != null && e.intent <= 1,
  );

  // Survival prio: heal if low and a green chain exists.
  if (hpPct < 0.35) {
    const greens = chains
      .filter((c) => c.type === "green")
      .sort((a, b) => b.cells.length - a.cells.length);
    if (greens.length) return greens[0];
  }

  const incoming = state.enemies.reduce(
    (sum, foe) => sum + (foe.hp > 0 ? foe.damage : 0),
    0,
  );
  const alive = state.enemies.filter((foe) => foe.hp > 0).length;
  const manaValue =
    cls === "mage"
      ? 80 / 3
      : cls === "warrior"
        ? (40 * alive) / 3
        : cls === "cleric"
          ? (22 * alive + Math.min(30, state.maxHp - state.hp)) / 3
          : 22;
  // Value actual resources. A seven-rune heal at full HP is less useful than
  // a three-rune strike; long chains should not conceal such balance mistakes.
  const value = (candidate: ChainCandidate) => {
    const tier = chainTier(candidate.cells.length);
    const result = preview(candidate);
    let utility =
      result.resolution.damageDealt +
      result.resolution.hpHealed * (hpPct < 0.55 ? 1.4 : 0.65) +
      result.resolution.manaGained * manaValue -
      boardCost(candidate) * (hpPct < 0.55 ? 1.5 : 0.8);
    if (result.resolution.guardGained > 0 && state.shieldTurns < 2) {
      utility += incoming * (enemyHasImmediateHeavy ? 0.9 : 0.65);
    }
    if (tier.bonusAction) utility += 12;
    if (resonanceWillBurst(state, candidate.type))
      utility += 20 * alive + manaValue + incoming * 0.4;
    if (result.resolution.enemyKills.length > 0)
      utility += result.resolution.enemyKills.length * 10;
    return utility;
  };
  return [...chains].sort(
    (a, b) => value(b) - value(a) || b.cells.length - a.cells.length,
  )[0];
}

// ─── Main run loop ──────────────────────────────────────────────────────────
/** Simulate an authored encounter as well as generated levels. Exposed for
 * deterministic accounting regression tests; no alternate combat math lives here. */
export function simulateEncounter(
  level: LevelDefinition,
  cls: HeroClass,
  runSeed: number,
  profile: SimBuildProfile = NAKED_SIM_PROFILE,
  options: SimOptions = {},
): SimRunResult {
  validateProfile(profile);
  const relics: ActiveRelics = buildActive(profile.slots ?? [], profile.ranks);
  const masteries = getActiveMasteries(cls, profile.classLevel);
  const rng: Rng = mulberry32(
    options.canonicalBoard ? level.generation_seed : runSeed,
  );
  const mechanics = level.modifiers?.mechanics?.length
    ? level.modifiers.mechanics
    : mechanicsForLevel(level.level_number);
  const telegraphActive = mechanics.includes("telegraphed_attacks");
  const prepareEnemies = (enemies: typeof level.enemy_config, wave: number) =>
    prepareCampaignEnemies(enemies, {
      idPrefix: wave ? `w${wave}-` : "e",
      seed: level.generation_seed + wave,
      level: level.level_number,
      telegraphed: telegraphActive,
      foresightTurns: getTelegraphReadyEarly(relics),
      hpMultiplier: 1,
    });
  const openingTurns = level.turn_limit + getForeseerBonusTurns(relics);
  let state = initialCombat(
    prepareEnemies(level.enemy_config, 0),
    openingTurns,
    {
      bonusMaxHp:
        getMasteryMaxHpBonus(
          masteries,
          Math.floor((level.level_number - 1) / 50),
        ) + getRelicRankMaxHpBonus(relics),
    },
  );
  const startingMana =
    getStartingMana(relics) + getMasteryStartingMana(masteries);
  state.mana = Math.min(MAX_MANA, startingMana);
  state.shieldTurns = getStartingShieldTurns(relics);
  const openingMana = state.mana;
  const openingShieldTurns = state.shieldTurns;
  let seals = buildInitialSeals(
    level.generation_seed,
    mechanics.includes("sealed_tiles"),
  );
  for (const key of [...seals].slice(0, getSealedTilesSpeedup(relics)))
    seals.delete(key);
  const eclipse = buildInitialEclipse(
    level.generation_seed,
    mechanics.includes("eclipse_tiles"),
    seals,
  );
  const shift = buildInitialShift(
    level.generation_seed,
    mechanics.includes("shifting_runes"),
  );
  const linkedPairs = buildInitialPairs(
    level.generation_seed,
    mechanics.includes("linked_pairs"),
    seals,
  );
  let corruption = buildInitialCorruption(
    level.generation_seed,
    mechanics.includes("corrupted_tiles"),
    level.level_number,
    seals,
  );
  const zones = computeLayoutZones(
    getLayoutIdForLevel(level.level_number),
    level.generation_seed,
  );
  let grid = generateBoard(rng);
  const bossRule = (level.modifiers?.boss_rule ?? null) as BossRuleId | null;
  const waves = level.modifiers?.waves ?? [];
  const enemyCountStart = state.enemies.length;
  const phases = new Map<string, BossPhaseIndex>();
  const objectiveTarget = normalizeScoreObjectiveTarget(level);
  let wavesSpawned = 0;
  let phaseTransitions = 0;
  let damageTaken = 0;
  let minHp = state.hp;
  let nearDeathTurns = 0;
  let enemyAbilityFires = 0;
  let heavyStrikeFires = 0;
  let bonusUsedThisCycle = false;
  let bonusActions = 0;
  let boardReshuffles = 0;
  let chainActions = 0;
  let redChains = 0;
  let abilityCasts = 0;
  let rngTick = 0;
  const budget = () =>
    campaignTurnBudget(openingTurns, level.turn_limit, waves, wavesSpawned);
  const authoredTurnBudget = campaignTurnBudget(
    openingTurns,
    level.turn_limit,
    waves,
    waves.length,
  );
  const spawnNextWave = () => {
    if (
      !state.enemies.every((foe) => foe.hp <= 0) ||
      wavesSpawned >= waves.length
    )
      return;
    const wave = waves[wavesSpawned];
    state = spawnWave(
      state,
      prepareEnemies(wave.enemies, wavesSpawned + 1),
      wave.reinforcement_turns ?? 2,
    );
    wavesSpawned += 1;
  };
  const applyPhases = () => {
    const transitions = detectPhaseTransitions(state.enemies, phases);
    if (transitions.length)
      state = {
        ...state,
        enemies: state.enemies.map((enemy) => ({ ...enemy })),
      };
    for (const transition of transitions) {
      phases.set(transition.enemyId, transition.to);
      const enemy = state.enemies.find((foe) => foe.id === transition.enemyId);
      if (enemy) applyPhaseDamageBump(enemy, transition);
      phaseTransitions += 1;
    }
  };
  const takeBoardDamage = (amount: number) => {
    const actual = Math.min(state.hp, amount);
    damageTaken += actual;
    state = { ...state, hp: Math.max(0, state.hp - amount) };
    minHp = Math.min(minHp, state.hp);
  };
  const boardCost = (candidate: ChainCandidate) =>
    Math.min(
      HAZARD_MAX_DAMAGE_PER_CHAIN,
      countChainInZone(candidate.cells, zones.hazard) * HAZARD_DAMAGE,
    ) + resolveChainAgainstCorruption(corruption, candidate.cells).hpCost;
  const previewChain = (
    candidate: ChainCandidate,
    applyHazards = false,
  ): ReturnType<typeof applyChain> => {
    const target = filterTargetable(bossRule, state.enemies)[0];
    const mods = computeChainMods(relics, {
      chainType: candidate.type,
      length: candidate.cells.length,
      redChainCountSoFar: candidate.type === "red" ? redChains + 1 : 0,
      isFirstChainOfRun: chainActions === 0,
      hpRatio: state.hp / state.maxHp,
      enemyHpRatioBeforeHit: target ? target.hp / Math.max(1, target.maxHp) : 1,
      chainNumberThisRun: chainActions + 1,
    });
    const result = applyChain(
      state,
      candidate.type,
      candidate.cells.length,
      cls,
      bossRule,
      5,
      level.level_number,
      {
        tierMultiplier: chainTier(candidate.cells.length).damageMultiplier,
        relicMultiplier: mods.bonusDamageMult,
        combatMultiplier:
          getMasteryChainDamageMult(masteries, candidate.type) *
          (candidate.type === "red"
            ? getMasteryOpeningCritMult(masteries, redChains)
            : 1),
      },
    );
    const next = result.next;
    if (applyHazards) {
      const damage = Math.min(
        HAZARD_MAX_DAMAGE_PER_CHAIN,
        countChainInZone(candidate.cells, zones.hazard) * HAZARD_DAMAGE,
      );
      damageTaken += Math.min(next.hp, damage);
      next.hp = Math.max(0, next.hp - damage);
      minHp = Math.min(minHp, next.hp);
    }
    const manaBefore = next.mana;
    next.mana = Math.min(MAX_MANA, next.mana + mods.bonusManaFlat);
    result.resolution.manaGained += next.mana - manaBefore;
    const heal = Math.min(
      next.maxHp - next.hp,
      mods.bonusHealFlat +
        (candidate.type === "blue" ? getMasteryBlueChainHeal(masteries) : 0) +
        getMasteryOpeningHeal(masteries, chainActions),
    );
    next.hp += heal;
    result.resolution.hpHealed += heal;
    const guard =
      mods.bonusShieldTurns +
      (candidate.type === "gold" && result.resolution.guardGained > 0
        ? getMasteryShieldBonus(masteries)
        : 0);
    next.shieldTurns += guard;
    result.resolution.guardGained += guard;
    return result;
  };

  // At most one free chain per enemy cycle; abilities can add at most one
  // additional action per loop. Size the emergency stop from the WHOLE budget.
  let safety = authoredTurnBudget * 8 + waves.length * 4 + 24;
  while (safety-- > 0) {
    // Pending reinforcements must enter before defeat/score evaluation.
    spawnNextWave();
    const verdict = evaluateObjective(
      state,
      budget(),
      level.objective_type,
      objectiveTarget,
    );
    if (verdict.over) return finalize(verdict.cleared);

    const abilityCost = getMasteryAbilityManaCost(
      masteries,
      getClass(cls).abilityCost,
    );
    if (state.mana >= abilityCost && state.enemies.some((foe) => foe.hp > 0)) {
      const ability = activateAbility(
        state,
        cls,
        bossRule,
        masteries,
        level.level_number,
        abilityCost,
      );
      if (ability.ok) {
        state = ability.next;
        abilityCasts += 1;
        spawnNextWave();
        // Ability thresholds power up the boss before the next chain's attack.
        applyPhases();
        const afterAbility = evaluateObjective(
          state,
          budget(),
          level.objective_type,
          objectiveTarget,
        );
        if (afterAbility.over) return finalize(afterAbility.cleared);
      }
    }

    const rescueRng = mulberry32(level.generation_seed ^ (rngTick + 0x5afe));
    let recovered = ensurePlayableBoard(grid, rescueRng, seals, eclipse);
    if (!recovered.chain && seals.size) {
      seals = new Set(seals);
      for (const key of [...seals].reverse()) {
        seals.delete(key);
        recovered = ensurePlayableBoard(grid, rescueRng, seals, eclipse);
        if (recovered.chain) break;
      }
    }
    grid = recovered.grid;
    if (recovered.reshuffled) boardReshuffles += 1;
    const chain = pickBestChain(
      grid,
      state,
      cls,
      level.level_number,
      bossRule,
      seals,
      eclipse,
      previewChain,
      boardCost,
    );
    if (!chain || !isValidChain(grid, chain.cells, seals, eclipse))
      return finalize(false, "board");

    const chainResult = previewChain(chain, true);
    state = chainResult.next;
    chainActions += 1;
    if (chain.type === "red") redChains += 1;
    const corruptionResult = resolveChainAgainstCorruption(
      corruption,
      chain.cells,
    );
    corruption = corruptionResult.next;
    takeBoardDamage(corruptionResult.hpCost);
    state = advanceResonance(
      state,
      chain.type,
      level.level_number,
      bossRule,
    ).next;
    minHp = Math.min(minHp, state.hp);

    const tier = chainTier(chain.cells.length);
    const alive = state.enemies.some((foe) => foe.hp > 0);
    const bonus = tier.bonusAction && !bonusUsedThisCycle && alive;
    const pendingSeals: string[] = [];
    if (bonus) {
      bonusUsedThisCycle = true;
      bonusActions += 1;
    } else {
      bonusUsedThisCycle = false;
      if (!alive) state = endTurn(state);
      else {
        const hpBefore = state.hp;
        const result = enemiesAttack(
          state,
          telegraphActive,
          bossRule,
          state.enemies.filter((foe) => foe.archetypeId === "bone_husk").length,
          { cls },
        );
        state = result;
        damageTaken += Math.max(0, hpBefore - state.hp);
        if (result.heavyFired) heavyStrikeFires += 1;
        enemyAbilityFires += result.abilityLogs?.length ?? 0;
        for (const effect of result.abilityEffects ?? []) {
          if (effect.kind === "spawn_minion")
            state = { ...state, enemies: [...state.enemies, effect.enemy] };
          if (effect.kind !== "seal_tile" && effect.kind !== "corrupt_tile")
            continue;
          for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index++) {
            const key = `${Math.floor(index / BOARD_SIZE)}-${index % BOARD_SIZE}`;
            if (seals.has(key) || pendingSeals.includes(key)) continue;
            if (effect.kind === "corrupt_tile") {
              if (corruption.cells.has(key)) continue;
              corruption = {
                ...corruption,
                cells: new Set([...corruption.cells, key]),
              };
            } else pendingSeals.push(key);
            break;
          }
        }
      }
      minHp = Math.min(minHp, state.hp);
      if (state.hp / state.maxHp <= 0.25) nearDeathTurns += 1;
    }

    const triggeredPairs = pairsTriggeredByChain(linkedPairs, chain.cells);
    const clearedCells = [...chain.cells, ...triggeredPairs];
    // Match Play's page-level pairing lifecycle: links are consumed when a
    // twin actually adds an extra clear to the selected chain.
    if (triggeredPairs.length)
      consumePairs(linkedPairs, clearedCells.map(cellKey));
    const refillRng = options.canonicalBoard
      ? mulberry32(level.generation_seed + 1000 + rngTick)
      : rng;
    grid = resolveBoard(grid, clearedCells, refillRng, seals);
    if (!bonus) grid = applyShift(grid, shift, refillRng, seals);
    const oldSeals = seals;
    seals = new Set(seals);
    for (const key of sealsBrokenByChain(seals, chain.cells)) seals.delete(key);
    for (const key of pendingSeals) seals.add(key);
    if (mechanics.includes("corrupted_tiles") && !bonus)
      corruption = spreadCorruption(
        corruption,
        rngTick,
        level.generation_seed,
        oldSeals,
      );
    rngTick += 1;
    spawnNextWave();
    // Chain phase changes affect the FOLLOWING retaliation, matching Play.
    applyPhases();
  }
  return finalize(false, "safety");

  function finalize(
    cleared: boolean,
    reason?: SimRunResult["failureReason"],
  ): SimRunResult {
    return {
      cleared,
      turnsUsed: Math.max(0, budget() - state.turnsRemaining),
      turnsRemaining: state.turnsRemaining,
      turnBudget: budget(),
      authoredTurnBudget,
      wavesSpawned,
      wavesTotal: waves.length,
      phaseTransitions,
      maxHp: state.maxHp,
      openingMana,
      openingShieldTurns,
      chainActions,
      abilityCasts,
      objectiveTarget,
      failureReason: cleared
        ? null
        : (reason ??
          (state.hp <= 0
            ? "hp"
            : state.turnsRemaining <= 0
              ? "turns"
              : "objective")),
      hpRemaining: state.hp,
      totalDamage: state.totalDamage,
      damageTaken,
      longestChain: state.longestChain,
      enemiesDefeated: state.enemiesDefeated,
      enemyCountStart,
      abilityUsed: state.abilityUsed,
      minHp: Math.max(0, minHp),
      nearDeathTurns,
      enemyAbilityFires,
      heavyStrikeFires,
      bossRule,
      resonanceBursts: state.resonance?.bursts ?? 0,
      bonusActions,
      boardReshuffles,
    };
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────
export function simulateLevel(
  level: number,
  cls: HeroClass,
  runs: number,
  baseSeed = 0xc0ffee,
  profile: SimBuildProfile = NAKED_SIM_PROFILE,
  options: SimOptions = {},
): { aggregate: SimAggregate; runs: SimRunResult[] } {
  const def = generateLevel(level);
  const out: SimRunResult[] = [];
  for (let i = 0; i < runs; i++) {
    out.push(
      simulateEncounter(
        def,
        cls,
        (baseSeed ^ ((level << 16) | i)) >>> 0,
        profile,
        options,
      ),
    );
  }
  const cleared = out.filter((r) => r.cleared).length;
  const sum = (sel: (r: SimRunResult) => number) =>
    out.reduce((s, r) => s + sel(r), 0);
  const avg = (sel: (r: SimRunResult) => number) =>
    out.length ? sum(sel) / out.length : 0;

  const allEnemies = [
    ...def.enemy_config,
    ...(def.modifiers?.waves ?? []).flatMap((wave) => wave.enemies),
  ];
  const totalEnemyHp = allEnemies.reduce(
    (sum, enemy) => sum + (enemy.maxHp ?? enemy.hp),
    0,
  );
  const hpPerTurnBudget =
    totalEnemyHp / Math.max(1, out[0]?.authoredTurnBudget ?? def.turn_limit);

  const clearRate = out.length ? cleared / out.length : 0;
  let verdict: SimAggregate["verdict"];
  if (clearRate < 0.15) verdict = "Brutal";
  else if (clearRate < 0.45) verdict = "Hard";
  else if (clearRate < 0.8) verdict = "Balanced";
  else if (clearRate < 0.95) verdict = "Easy";
  else verdict = "Trivial";

  return {
    runs: out,
    aggregate: {
      level,
      runs: out.length,
      cleared,
      clearRate,
      avgTurnsUsed: avg((r) => r.turnsUsed),
      avgTurnsRemaining: avg((r) => r.turnsRemaining),
      avgTurnBudget: avg((r) => r.turnBudget),
      avgHpRemaining: avg((r) => r.hpRemaining),
      avgDamageDealt: avg((r) => r.totalDamage),
      avgDamageTaken: avg((r) => r.damageTaken),
      avgLongestChain: avg((r) => r.longestChain),
      hpPerTurnBudget,
      avgIncomingPerTurn: avg((r) => r.damageTaken / Math.max(1, r.turnsUsed)),
      nearDeathRate: out.length
        ? out.filter((r) => r.minHp / r.maxHp <= 0.25).length / out.length
        : 0,
      avgMinHp: avg((r) => r.minHp),
      avgEnemyAbilityFires: avg((r) => r.enemyAbilityFires),
      avgHeavyStrikeFires: avg((r) => r.heavyStrikeFires),
      verdict,
    },
  };
}

/** Sweep across a band of levels, returning aggregates per level. */
export function simulateBand(
  startLevel: number,
  endLevel: number,
  cls: HeroClass,
  runsPerLevel: number,
  baseSeed = 0xc0ffee,
  profile: SimBuildProfile = NAKED_SIM_PROFILE,
  options: SimOptions = {},
): SimAggregate[] {
  const out: SimAggregate[] = [];
  for (let lvl = startLevel; lvl <= endLevel; lvl++) {
    out.push(
      simulateLevel(lvl, cls, runsPerLevel, baseSeed, profile, options)
        .aggregate,
    );
  }
  return out;
}
