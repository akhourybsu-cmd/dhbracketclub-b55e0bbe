import { describe, expect, it } from "vitest";
import {
  campaignTurnBudget,
  prepareCampaignEnemies,
} from "@/lib/runedelve/campaignEncounter";
import {
  applyPhaseDamageBump,
  detectPhaseTransitions,
  restoreBossPhases,
} from "@/lib/runedelve/bossPhases";
import { enemiesAttack, initialCombat } from "@/lib/runedelve/combatEngine";
import type { Enemy } from "@/lib/runedelve/dungeonGenerator";
import {
  evaluateObjective,
  getObjectiveProgress,
} from "@/lib/runedelve/objectives";
import {
  buildActive,
  cleansingTouchHpCost,
  onEnemyKilled,
} from "@/lib/runedelve/relicEffects";
import { resolveBoard } from "@/lib/runedelve/boardEngine";
import type { RuneType } from "@/lib/runedelve/dungeonGenerator";

const boss: Enemy = {
  id: "boss",
  name: "Boss Warden",
  emoji: "👹",
  tier: "boss",
  hp: 60,
  maxHp: 100,
  damage: 10,
};

describe("campaign encounter integration", () => {
  it("keeps a sealed linked twin intact instead of leaving a null hole in the board", () => {
    const grid: RuneType[][] = Array.from({ length: 5 }, () =>
      Array<RuneType>(5).fill("red"),
    );
    grid[4][4] = "gold";
    const result = resolveBoard(
      grid,
      [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
        { r: 0, c: 2 },
        { r: 4, c: 4 },
      ],
      () => 0,
      new Set(["4-4"]),
    );
    expect(result[4][4]).toBe("gold");
    expect(
      result
        .flat()
        .every((rune) => ["red", "blue", "green", "gold"].includes(rune)),
    ).toBe(true);
  });
  it("preserves already applied boss phases across resume, including a healed boss", () => {
    const enemy = { ...boss };
    for (const transition of detectPhaseTransitions([enemy], new Map()))
      applyPhaseDamageBump(enemy, transition);
    expect(enemy.damage).toBe(12);
    expect(detectPhaseTransitions([enemy], restoreBossPhases([enemy]))).toEqual(
      [],
    );
    enemy.hp = 70;
    const restored = restoreBossPhases([enemy], [[enemy.id, 2]]);
    enemy.hp = 60;
    expect(detectPhaseTransitions([enemy], restored)).toEqual([]);
    enemy.hp = 30;
    const transitions = detectPhaseTransitions([enemy], restored);
    expect(transitions.map((transition) => transition.to)).toEqual([3]);
    applyPhaseDamageBump(enemy, transitions[0]);
    expect(enemy.damage).toBe(14);
  });

  it("applies Elite Path HP and ranked Foresight to opening and reinforcement enemies", () => {
    const options = {
      idPrefix: "e",
      seed: 123,
      level: 100,
      telegraphed: true,
      foresightTurns: 3,
      hpMultiplier: 1.25,
    };
    const opening = prepareCampaignEnemies([boss], options)[0];
    const reinforcement = prepareCampaignEnemies([boss], {
      ...options,
      idPrefix: "w2-",
    })[0];
    const baseline = prepareCampaignEnemies([boss], {
      ...options,
      foresightTurns: 0,
      hpMultiplier: 1,
    })[0];
    expect(reinforcement).toEqual(opening);
    expect(opening.hp).toBe(75);
    expect(opening.maxHp).toBe(125);
    expect(opening.intent).toBe((baseline.intent ?? 0) + 3);
    expect(opening.intentMax).toBe((baseline.intentMax ?? 0) + 3);
  });

  it("keeps turns used honest for negative bargains and earned reinforcement turns", () => {
    expect(campaignTurnBudget(8, 10, [{ reinforcement_turns: 2 }], 0)).toBe(8);
    const budget = campaignTurnBudget(8, 10, [{ reinforcement_turns: 2 }], 1);
    expect(budget - 9).toBe(1);
    const state = initialCombat([boss], 8);
    expect(getObjectiveProgress(state, 8, "survive", 10).current).toBe(0);
    expect(
      evaluateObjective({ ...state, turnsRemaining: 0 }, 8, "survive", 10),
    ).toEqual({ over: true, cleared: true });
  });

  it.each([1, 0.5])(
    "retains permanent Splitter damage changes with temporary incoming multiplier %s",
    (incomingMultiplier) => {
      const result = enemiesAttack(
        initialCombat([{ ...boss, hp: 40 }], 10),
        false,
        "splitter",
        0,
        { incomingMultiplier },
      );
      expect(result.enemies).toHaveLength(2);
      expect(result.enemies.map((enemy) => enemy.damage)).toEqual([7, 7]);
      expect(result.hp).toBe(100 - Math.round(10 * incomingMultiplier));
      expect(boss.damage).toBe(10);
    },
  );

  it("grants ranked Bloodbond healing only to living heroes", () => {
    for (let rank = 1; rank <= 5; rank++) {
      const relics = buildActive(["bloodbond"], new Map([["bloodbond", rank]]));
      const state = { ...initialCombat([boss], 10), hp: 50 };
      expect(onEnemyKilled(relics, state).hp).toBeGreaterThan(50);
      expect(onEnemyKilled(relics, { ...state, hp: 0 }).hp).toBe(0);
    }
  });

  it.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
  ])(
    "honors Cleansing Touch rank %s's %s free sources without waiving unrelated corruption",
    (rank, uses) => {
      const relics = buildActive(
        ["cleansing_touch"],
        new Map([["cleansing_touch", rank]]),
      );
      for (let clearedBefore = 0; clearedBefore < uses; clearedBefore++) {
        expect(cleansingTouchHpCost(relics, 4, 1, clearedBefore, 4)).toBe(0);
      }
      expect(cleansingTouchHpCost(relics, 4, 1, uses, 4)).toBe(4);
      // Two sources plus one ordinary corrupt rune, with one free source left.
      expect(cleansingTouchHpCost(relics, 12, 2, uses - 1, 4)).toBe(8);
    },
  );
});
