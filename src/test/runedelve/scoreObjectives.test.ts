import { describe, expect, it } from "vitest";
import { initialCombat } from "@/lib/runedelve/combatEngine";
import type { Enemy } from "@/lib/runedelve/dungeonGenerator";
import {
  evaluateObjective,
  getObjectiveProgress,
  normalizeScoreObjectiveTarget,
} from "@/lib/runedelve/objectives";
import {
  calculateScore,
  combatObjectiveScore,
  liveScore,
  scoreTargetForEnemies,
} from "@/lib/runedelve/scoring";

const foe: Enemy = {
  id: "foe",
  name: "Cave Warden",
  emoji: "👹",
  hp: 200,
  maxHp: 200,
  damage: 8,
};

describe("campaign combat-earned score goals", () => {
  it("keeps high opening HP and bonus turns playable on a legacy score row", () => {
    const legacy = {
      objective_type: "reach_score",
      objective_target: 1_425,
      enemy_config: [foe],
    };
    const state = {
      ...initialCombat([foe], 17),
      hp: 130,
      maxHp: 130,
    };
    expect(liveScore(state)).toBe(1_500);
    const target = normalizeScoreObjectiveTarget(legacy);
    expect(target).toBe(235);
    expect(evaluateObjective(state, 17, "reach_score", target)).toEqual({
      over: false,
      cleared: false,
    });
    expect(getObjectiveProgress(state, 17, "reach_score", target).current).toBe(
      0,
    );
  });

  it("cannot win with only healing, guard, or repeated resource chains", () => {
    const state = {
      ...initialCombat([foe], 17),
      hp: 130,
      maxHp: 130,
      guard: 999,
      mana: 9,
      longestChain: 25,
    };
    expect(combatObjectiveScore(state)).toBe(0);
    expect(evaluateObjective(state, 17, "reach_score", 100).cleared).toBe(
      false,
    );
    // Even after a tiny real hit, unlimited resource chains cannot grind an
    // objective. Only the best chain earns a single capped bonus.
    const hit = { ...state, totalDamage: 1 };
    expect(combatObjectiveScore(hit)).toBe(81);
    expect(combatObjectiveScore({ ...hit, longestChain: 1_000 })).toBe(81);
    expect(evaluateObjective(hit, 17, "reach_score", 100).cleared).toBe(false);
  });

  it("counts every authored wave in normalized legacy targets", () => {
    const reinforcement = { ...foe, id: "wave", hp: 100, maxHp: 100 };
    const legacy = {
      objective_type: "reach_score",
      objective_target: 1_425,
      enemy_config: [foe],
      modifiers: { waves: [{ enemies: [reinforcement] }] },
    };
    expect(normalizeScoreObjectiveTarget(legacy)).toBe(390);
    expect(normalizeScoreObjectiveTarget(legacy)).toBe(
      scoreTargetForEnemies([foe, reinforcement]),
    );
    expect(
      normalizeScoreObjectiveTarget({
        ...legacy,
        objective_target: 400,
        modifiers: { ...legacy.modifiers, score_objective_version: 2 },
      }),
    ).toBe(400);
    expect(legacy.objective_target).toBe(1_425);
  });

  it("preserves earned checkpoint progress while keeping final score rewards", () => {
    const state = {
      ...initialCombat([foe], 10),
      totalDamage: 150,
      enemiesDefeated: 1,
      longestChain: 6,
    };
    expect(combatObjectiveScore(state)).toBe(290);
    const exhausted = { ...state, hp: 1, turnsRemaining: 1 };
    expect(combatObjectiveScore(exhausted)).toBe(290);
    const final = calculateScore({
      ...state,
      hpRemaining: state.hp,
      cleared: true,
    });
    expect(final.hpPts).toBe(500);
    expect(final.turnsPts).toBe(500);
    expect(final.total).toBe(1_500 + 150 + 200 + 150);
  });
});
