import { describe, expect, it } from "vitest";
import { generateLevel } from "@/lib/runedelve/levelGenerator";
import { rosterById } from "@/lib/runedelve/enemyRoster";
import { getPriorityEnemy } from "@/lib/runedelve/objectives";

const levels = Array.from({ length: 150 }, (_, index) =>
  generateLevel(index + 1),
);
const durable = (role: string | undefined) =>
  ["tank", "defender", "controller"].includes(role ?? "");

describe("campaign encounter curve", () => {
  it("keeps the opening readable before introducing enemy abilities", () => {
    for (const level of levels.slice(0, 15)) {
      expect(level.enemy_config).toHaveLength(2);
      expect(level.turn_limit).toBeGreaterThanOrEqual(14);
      expect(level.enemy_config.every((enemy) => !enemy.ability)).toBe(true);
    }
  });

  it("gives every chapter its own roster and every boss a combat identity", () => {
    for (const chapter of [2, 3]) {
      const foes = levels
        .filter((level) => level.chapter === chapter)
        .flatMap((level) => [
          ...level.enemy_config,
          ...(level.modifiers.waves ?? []).flatMap((wave) => wave.enemies),
        ]);
      expect(
        foes.filter(
          (enemy) => rosterById(enemy.archetypeId)?.chapter === chapter,
        ).length / foes.length,
      ).toBeGreaterThan(0.65);
    }
    for (const level of levels.filter((level) => !!level.modifiers.boss_kind)) {
      const boss = getPriorityEnemy([
        ...level.enemy_config,
        ...(level.modifiers.waves ?? []).flatMap((wave) => wave.enemies),
      ]);
      expect(boss).toBeDefined();
      expect(rosterById(boss?.archetypeId)?.chapter).toBe(level.chapter);
      expect(["striker", "tank", "controller"]).toContain(boss?.role);
    }
  });

  it("prevents stacked durable and independent ability threats in a wave", () => {
    for (const level of levels) {
      for (const wave of [
        level.enemy_config,
        ...(level.modifiers.waves ?? []).map((wave) => wave.enemies),
      ]) {
        expect(
          wave.filter((enemy) => !enemy.tier && durable(enemy.role)).length,
        ).toBeLessThanOrEqual(1);
        expect(
          wave.filter((enemy) => !!enemy.ability).length,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it("bounds combined printed attack while preserving late role HP differences", () => {
    for (const level of levels.filter((level) => level.level_number > 50)) {
      const attack = level.enemy_config.reduce(
        (sum, enemy) => sum + enemy.damage,
        0,
      );
      expect(attack).toBeLessThanOrEqual(
        Math.round(30 + (level.level_number - 50) * 0.32),
      );
    }
    const deepRegular = levels
      .filter((level) => level.chapter === 3)
      .flatMap((level) => level.enemy_config)
      .filter((enemy) => !enemy.tier);
    const mean = (role: string) => {
      const foes = deepRegular.filter((enemy) => enemy.role === role);
      return foes.reduce((sum, enemy) => sum + enemy.maxHp, 0) / foes.length;
    };
    expect(mean("tank")).toBeGreaterThan(mean("striker") * 1.2);
    expect(mean("striker")).toBeGreaterThan(mean("swarm") * 1.3);
  });
});
