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
  MAX_HP,
  chainTier,
  type CombatState,
} from "./combatEngine";
import { generateLevel, type LevelDefinition } from "./levelGenerator";
import type { HeroClass } from "./classConfig";
import type { BossRuleId } from "./bossRules";
import { evaluateObjective } from "./objectives";
import { advanceResonance, resonanceWillBurst } from "./resonance";
import { applyInitialIntents } from "./telegraph";

// ─── Per-run telemetry ──────────────────────────────────────────────────────
export interface SimRunResult {
  cleared: boolean;
  turnsUsed: number;
  turnsRemaining: number;
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
  avgHpRemaining: number;
  avgDamageDealt: number;
  avgDamageTaken: number;
  avgLongestChain: number;
  /** Total HP of starting wave divided by turn limit — the "DPS budget" the player must hit. */
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

function findAllMaxChains(grid: RuneType[][]): ChainCandidate[] {
  const seenSeed = new Set<string>();
  const results: ChainCandidate[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const start: Cell = { r, c };
      const k = cellKey(start);
      if (seenSeed.has(k)) continue;
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
            if (visited.has(nk)) continue;
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
): ChainCandidate | null {
  const chains = findAllMaxChains(grid);
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
    const result = applyChain(
      state,
      candidate.type,
      candidate.cells.length,
      cls,
      bossRule,
      5,
      level,
      { tierMultiplier: tier.damageMultiplier },
    );
    let utility =
      result.resolution.damageDealt +
      result.resolution.hpHealed * (hpPct < 0.55 ? 1.4 : 0.65) +
      result.resolution.manaGained * manaValue;
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
function runOne(
  level: LevelDefinition,
  cls: HeroClass,
  runSeed: number,
): SimRunResult {
  const rng: Rng = mulberry32(runSeed);
  let grid = ensurePlayableBoard(generateBoard(rng), rng).grid;
  let state = initialCombat(level.enemy_config, level.turn_limit);
  const bossRule = (level.modifiers?.boss_rule ?? null) as BossRuleId | null;
  const waves = (level.modifiers?.waves ?? []) as Array<{
    enemies: typeof level.enemy_config;
    reinforcement_turns: number;
  }>;
  const enemyCountStart = state.enemies.length;

  let damageTaken = 0;
  let minHp = state.hp;
  let nearDeathTurns = 0;
  let enemyAbilityFires = 0;
  let heavyStrikeFires = 0;
  let summonsSoFar = 0;
  let waveSpawned = false;
  let turnsTaken = 0;
  let bonusUsedThisCycle = false;
  let bonusActions = 0;
  let boardReshuffles = 0;
  const telegraphActive = (level.modifiers?.mechanics ?? []).includes(
    "telegraphed_attacks",
  );
  if (telegraphActive)
    state = {
      ...state,
      enemies: applyInitialIntents(
        state.enemies,
        level.generation_seed,
        level.level_number,
      ),
    };
  const spawnNextWave = () => {
    const fresh = telegraphActive
      ? applyInitialIntents(
          waves[0].enemies,
          level.generation_seed + 1,
          level.level_number,
        )
      : waves[0].enemies;
    state = spawnWave(state, fresh, waves[0].reinforcement_turns);
    waveSpawned = true;
  };

  let safety = level.turn_limit * 4 + 12; // hard cap so a degenerate board can't loop forever
  while (safety-- > 0) {
    const verdict = evaluateObjective(
      state,
      level.turn_limit,
      level.objective_type,
      level.objective_target,
    );
    if (verdict.over) {
      return finalize(state, verdict.cleared);
    }

    // Fire ability when full mana + still have targets. Cleric still
    // prioritises Sanctuary on heal-pressure, but no longer hoards mana
    // when at full HP — the shield component is valuable on every cast.
    if (state.mana >= 3 && state.enemies.some((e) => e.hp > 0)) {
      const r = activateAbility(state, cls, bossRule, [], level.level_number);
      if (r.ok) state = r.next;
      if (
        state.enemies.every((foe) => foe.hp <= 0) &&
        waves.length &&
        !waveSpawned
      )
        spawnNextWave();
      const afterAbility = evaluateObjective(
        state,
        level.turn_limit,
        level.objective_type,
        level.objective_target,
      );
      if (
        afterAbility.over &&
        !(
          state.enemies.every((e) => e.hp <= 0) &&
          waves.length > 0 &&
          !waveSpawned
        )
      ) {
        return finalize(state, afterAbility.cleared);
      }
    }

    const recovered = ensurePlayableBoard(grid, rng);
    grid = recovered.grid;
    if (recovered.reshuffled) boardReshuffles += 1;
    const chain = pickBestChain(grid, state, cls, level.level_number, bossRule);
    if (!chain) {
      return finalize(state, false);
    }
    if (!isValidChain(grid, chain.cells)) {
      state = endTurn(state);
      continue;
    }

    const tier = chainTier(chain.cells.length);
    const { next } = applyChain(
      state,
      chain.type,
      chain.cells.length,
      cls,
      bossRule,
      5,
      level.level_number,
      { tierMultiplier: tier.damageMultiplier },
    );
    state = advanceResonance(
      next,
      chain.type,
      level.level_number,
      bossRule,
    ).next;
    grid = resolveBoard(grid, chain.cells, rng);

    // Check kill state before enemy phase.
    if (state.enemies.every((e) => e.hp <= 0)) {
      // Trigger reinforcement wave once if defined.
      if (waves.length && !waveSpawned) {
        spawnNextWave();
        state = endTurn(state);
        turnsTaken += 1;
        continue;
      }
      turnsTaken += 1;
      state = endTurn(state);
      continue;
    }

    if (tier.bonusAction && !bonusUsedThisCycle) {
      bonusUsedThisCycle = true;
      bonusActions += 1;
      continue;
    }
    bonusUsedThisCycle = false;
    turnsTaken += 1;
    // Enemy phase. Telegraphed when any enemy carries an intent.
    const telegraphed = state.enemies.some((e) => e.intent != null);
    const hpBefore = state.hp;
    const r = enemiesAttack(state, telegraphed, bossRule, summonsSoFar, {
      cls,
    });
    state = { ...r };
    damageTaken += Math.max(0, hpBefore - state.hp);
    if (r.heavyFired) heavyStrikeFires += 1;
    enemyAbilityFires += r.abilityLogs?.length ?? 0;
    for (const eff of r.abilityEffects ?? []) {
      if (eff.kind === "spawn_minion") {
        state = { ...state, enemies: [...state.enemies, eff.enemy] };
        summonsSoFar += 1;
      }
    }

    minHp = Math.min(minHp, state.hp);
    if (state.hp / state.maxHp <= 0.25) nearDeathTurns += 1;
  }

  // Hard safety break — treat as failure.
  return finalize(state, false);

  function finalize(s: CombatState, cleared: boolean): SimRunResult {
    return {
      cleared,
      turnsUsed: turnsTaken,
      turnsRemaining: s.turnsRemaining,
      hpRemaining: s.hp,
      totalDamage: s.totalDamage,
      damageTaken,
      longestChain: s.longestChain,
      enemiesDefeated: s.enemiesDefeated,
      enemyCountStart,
      abilityUsed: s.abilityUsed,
      minHp: Math.max(0, minHp),
      nearDeathTurns,
      enemyAbilityFires,
      heavyStrikeFires,
      bossRule,
      resonanceBursts: s.resonance?.bursts ?? 0,
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
): { aggregate: SimAggregate; runs: SimRunResult[] } {
  const def = generateLevel(level);
  const out: SimRunResult[] = [];
  for (let i = 0; i < runs; i++) {
    out.push(runOne(def, cls, (baseSeed ^ ((level << 16) | i)) >>> 0));
  }
  const cleared = out.filter((r) => r.cleared).length;
  const sum = (sel: (r: SimRunResult) => number) =>
    out.reduce((s, r) => s + sel(r), 0);
  const avg = (sel: (r: SimRunResult) => number) =>
    out.length ? sum(sel) / out.length : 0;

  const totalStartHp = def.enemy_config.reduce((s, e) => s + e.maxHp, 0);
  const hpPerTurnBudget = totalStartHp / Math.max(1, def.turn_limit);

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
      avgHpRemaining: avg((r) => r.hpRemaining),
      avgDamageDealt: avg((r) => r.totalDamage),
      avgDamageTaken: avg((r) => r.damageTaken),
      avgLongestChain: avg((r) => r.longestChain),
      hpPerTurnBudget,
      avgIncomingPerTurn: avg((r) => r.damageTaken / Math.max(1, r.turnsUsed)),
      nearDeathRate: out.length
        ? out.filter((r) => r.minHp / MAX_HP <= 0.25).length / out.length
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
): SimAggregate[] {
  const out: SimAggregate[] = [];
  for (let lvl = startLevel; lvl <= endLevel; lvl++) {
    out.push(simulateLevel(lvl, cls, runsPerLevel, baseSeed).aggregate);
  }
  return out;
}
