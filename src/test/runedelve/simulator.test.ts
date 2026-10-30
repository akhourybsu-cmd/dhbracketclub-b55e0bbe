import { describe, expect, it } from "vitest";
import type { Enemy } from "@/lib/runedelve/dungeonGenerator";
import type { LevelDefinition } from "@/lib/runedelve/levelGenerator";
import { generateLevel } from "@/lib/runedelve/levelGenerator";
import { normalizeScoreObjectiveTarget } from "@/lib/runedelve/objectives";
import {
  progressionSimProfile,
  proposedEarnedSimProfile,
  affordableSimProfile,
  simulateEncounter,
  simulateLevel,
} from "@/lib/runedelve/simulator";

const foe = (id: string, hp = 1, overrides: Partial<Enemy> = {}): Enemy => ({
  id,
  name: "Test Warden",
  emoji: "◆",
  hp,
  maxHp: hp,
  damage: 0,
  ...overrides,
});
const encounter = (
  overrides: Partial<LevelDefinition> = {},
): LevelDefinition => ({
  ...generateLevel(1),
  enemy_config: [foe("opening")],
  objective_type: "defeat_all",
  objective_target: 0,
  turn_limit: 12,
  modifiers: { mechanics: [] },
  ...overrides,
});

describe("Rune Delve simulator accounting", () => {
  it("finishes every authored wave and preserves all granted turns", () => {
    const level = encounter({
      modifiers: {
        mechanics: [],
        waves: [
          { enemies: [foe("wave-1")], reinforcement_turns: 3 },
          { enemies: [foe("wave-2")], reinforcement_turns: 4 },
        ],
      },
    });
    const result = simulateEncounter(level, "mage", 73);
    expect(result.cleared).toBe(true);
    expect(result.wavesSpawned).toBe(2);
    expect(result.enemiesDefeated).toBe(3);
    expect(result.totalDamage).toBe(3);
    expect(result.turnBudget).toBe(19);
    expect(result.authoredTurnBudget).toBe(19);
    expect(result.turnsUsed + result.turnsRemaining).toBe(result.turnBudget);
  });

  it("does not count turns from reinforcements the hero never reached", () => {
    const level = encounter({
      enemy_config: [foe("fatal", 10_000, { damage: 1_000 })],
      modifiers: {
        mechanics: [],
        waves: [{ enemies: [foe("future")], reinforcement_turns: 7 }],
      },
    });
    const result = simulateEncounter(level, "warrior", 73);
    expect(result.cleared).toBe(false);
    expect(result.failureReason).toBe("hp");
    expect(result.wavesSpawned).toBe(0);
    expect(result.turnBudget).toBe(12);
    expect(result.authoredTurnBudget).toBe(19);
    expect(result.turnsUsed + result.turnsRemaining).toBe(12);
  });

  it("applies live boss phase transitions after damage crosses a threshold", () => {
    const result = simulateEncounter(
      encounter({
        enemy_config: [foe("boss", 300, { tier: "boss" })],
      }),
      "mage",
      73,
      {
        id: "phase-test",
        classLevel: 5,
        slots: ["aether_spark"],
        ranks: { aether_spark: 2 },
      },
    );
    expect(result.cleared).toBe(true);
    expect(result.phaseTransitions).toBeGreaterThan(0);
    expect(result.abilityCasts).toBeGreaterThan(0);
  });

  it("uses normalized legacy score targets without clearing at the opening baseline", () => {
    const level = encounter({
      objective_type: "reach_score",
      objective_target: 1,
      enemy_config: [foe("score", 250)],
    });
    const result = simulateEncounter(level, "warrior", 73);
    expect(result.objectiveTarget).toBe(normalizeScoreObjectiveTarget(level));
    expect(result.objectiveTarget).toBeGreaterThan(1);
    expect(result.chainActions).toBeGreaterThan(0);
    expect(result.totalDamage).toBeGreaterThan(0);
  });

  it("includes reinforcement HP in its encounter budget and remains deterministic", () => {
    const level = generateLevel(150);
    const profile = progressionSimProfile(150);
    const a = simulateLevel(150, "warrior", 2, 73, profile);
    const b = simulateLevel(150, "warrior", 2, 73, profile);
    expect(a).toEqual(b);
    const totalHp = [
      ...level.enemy_config,
      ...(level.modifiers.waves ?? []).flatMap((wave) => wave.enemies),
    ].reduce((sum, enemy) => sum + enemy.maxHp, 0);
    expect(a.aggregate.hpPerTurnBudget).toBe(
      totalHp / a.runs[0].authoredTurnBudget,
    );
    expect(profile.classLevel).toBe(25);
    expect(profile.slots).toHaveLength(2);
  });

  it("rejects profiles whose page-level procs are not modelled", () => {
    expect(() =>
      simulateEncounter(encounter(), "mage", 73, {
        id: "unmodelled",
        classLevel: 50,
      }),
    ).toThrow("not modelled");
    expect(() =>
      simulateEncounter(encounter(), "mage", 73, {
        id: "unmodelled",
        classLevel: 5,
        slots: ["rune_echo"],
      }),
    ).toThrow("unsupported equipment");
  });

  it.each([
    ["warrior", [foe("a", 45), foe("b", 45)]],
    ["mage", [foe("a", 70), foe("b", 20)]],
  ] as const)(
    "uses %s tier-three ability power in the shared engine",
    (cls, enemies) => {
      const level = encounter({ enemy_config: [...enemies] });
      const run = (classLevel: number) =>
        simulateEncounter(level, cls, 73, {
          id: "tier-three",
          classLevel,
          slots: ["aether_spark"],
          ranks: { aether_spark: 5 },
        });
      const before = run(29);
      const after = run(30);
      expect(after.cleared).toBe(true);
      expect(after.abilityCasts).toBe(1);
      expect(after.chainActions).toBe(0);
      expect(before.chainActions).toBeGreaterThan(0);
    },
  );

  it("uses tier-three Shadowstep to interrupt the charged enemy ability", () => {
    const level = encounter({
      turn_limit: 1,
      enemy_config: [
        foe("charged", 10_000, {
          ability: "heavy_strike",
          abilityCooldown: 1,
          abilityCooldownMax: 4,
        }),
      ],
    });
    const run = (classLevel: number) =>
      simulateEncounter(level, "rogue", 73, {
        id: "tier-three",
        classLevel,
        slots: ["aether_spark"],
        ranks: { aether_spark: 3 },
      });
    const before = run(29);
    const after = run(30);
    expect(after.openingMana).toBe(2);
    expect(after.abilityCasts).toBeGreaterThan(0);
    expect(before.enemyAbilityFires).toBeGreaterThan(0);
    expect(after.enemyAbilityFires).toBe(0);
  });

  it("uses Greater Sanctuary healing in a sustained-pressure encounter", () => {
    const level = encounter({
      turn_limit: 20,
      enemy_config: [foe("pressure", 1_000, { damage: 40 })],
    });
    const before = simulateEncounter(level, "cleric", 7, {
      id: "tier-two",
      classLevel: 29,
    });
    const after = simulateEncounter(level, "cleric", 7, {
      id: "tier-three",
      classLevel: 30,
    });
    expect(after.abilityCasts).toBeGreaterThan(0);
    expect(after.abilityCasts).toBe(before.abilityCasts);
    expect(after.damageTaken).toBe(before.damageTaken);
    expect(after.hpRemaining).toBeGreaterThan(before.hpRemaining);
  });

  it("keeps the proposed earned profile distinct from the unchanged baseline", () => {
    expect(
      [50, 100, 150].map((level) => proposedEarnedSimProfile(level).classLevel),
    ).toEqual([12, 24, 40]);
    expect(
      [50, 100, 150].map((level) => progressionSimProfile(level).classLevel),
    ).toEqual([12, 20, 25]);
    expect(proposedEarnedSimProfile(150).id).toBe("earned-proposal");
  });

  it("equips an affordable class-aware third item only after class level 25", () => {
    expect(affordableSimProfile(100, "rogue").slots).toEqual([
      "ember_edge",
      "iron_resolve",
    ]);
    expect(affordableSimProfile(7, "mage").slots).toEqual(["aether_spark"]);
    for (const cls of ["warrior", "mage", "rogue", "cleric"] as const) {
      expect(affordableSimProfile(150, cls).slots).toHaveLength(3);
      expect(new Set(affordableSimProfile(150, cls).slots)).toEqual(
        new Set(["ember_edge", "aether_spark", "iron_resolve"]),
      );
    }
    expect(
      simulateEncounter(
        generateLevel(150),
        "warrior",
        73,
        affordableSimProfile(150, "warrior"),
      ).maxHp,
    ).toBe(122);
    expect(() =>
      simulateEncounter(encounter(), "warrior", 73, {
        id: "locked-slot",
        classLevel: 24,
        slots: ["ember_edge", "aether_spark", "iron_resolve"],
      }),
    ).toThrow("locked relic slot");
  });

  it("preserves Opening Strike through an opening support chain", () => {
    // Seed 9 opens with no legal red three-chain; the first red strike comes
    // after support actions. No ability fires in either trajectory.
    const level = encounter({
      turn_limit: 3,
      enemy_config: [foe("durable", 10_000)],
    });
    const before = simulateEncounter(level, "rogue", 9, {
      id: "before-crit",
      classLevel: 14,
    });
    const after = simulateEncounter(level, "rogue", 9, {
      id: "opening-strike",
      classLevel: 15,
    });
    expect(before.abilityCasts).toBe(0);
    expect(after.abilityCasts).toBe(0);
    expect(after.chainActions).toBe(before.chainActions);
    expect(after.totalDamage).toBeGreaterThan(before.totalDamage);
  });

  it("applies ranked equipment and Iron Constitution HP without turning excess mana into guard", () => {
    const warrior = simulateEncounter(
      generateLevel(150),
      "warrior",
      73,
      progressionSimProfile(150),
    );
    expect(warrior.maxHp).toBe(118);
    const mage = simulateEncounter(encounter(), "mage", 73, {
      id: "capped-mana",
      classLevel: 5,
      slots: ["aether_spark"],
      ranks: { aether_spark: 5 },
    });
    expect(mage.maxHp).toBe(108);
    expect(mage.openingMana).toBe(3);
    expect(mage.openingShieldTurns).toBe(0);
  });

  it("uses canonical opening and refill seeds independently of the sweep seed", () => {
    const a = simulateLevel(125, "warrior", 3, 1, progressionSimProfile(125), {
      canonicalBoard: true,
    });
    const b = simulateLevel(125, "warrior", 3, 2, progressionSimProfile(125), {
      canonicalBoard: true,
    });
    expect(a).toEqual(b);
    expect(a.runs[0]).toEqual(a.runs[1]);
    expect(a.runs[1]).toEqual(a.runs[2]);
  });
});
