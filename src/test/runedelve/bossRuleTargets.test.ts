import { describe, expect, it } from "vitest";
import {
  applyBossTurnEffects,
  applyPhaseLockOnDamage,
  enemyDamageMultiplier,
  filterTargetable,
  isImmune,
} from "@/lib/runedelve/bossRules";
import { initialCombat } from "@/lib/runedelve/combatEngine";
import type { Enemy } from "@/lib/runedelve/dungeonGenerator";
import {
  evaluateObjective,
  getPriorityEnemy,
} from "@/lib/runedelve/objectives";

const boss: Enemy = {
  id: "boss",
  name: "Boss Warden",
  emoji: "",
  tier: "boss",
  hp: 40,
  maxHp: 100,
  damage: 10,
};
const guard: Enemy = {
  id: "guard",
  name: "Oathbound Guard",
  emoji: "",
  hp: 30,
  maxHp: 30,
  damage: 5,
};
const summon: Enemy = {
  id: "summon",
  name: "Bone Husk",
  archetypeId: "bone_husk",
  emoji: "",
  hp: 5,
  maxHp: 20,
  damage: 2,
};

describe.each([true, false])(
  "boss identity with an appended %s live summon",
  (alive) => {
    const minion = { ...summon, hp: alive ? 5 : 0 };
    const encounter = () => [{ ...guard }, { ...boss }, { ...minion }];

    it("keeps Last Stand on the marked boss until its other living foes fall", () => {
      const enemies = encounter();
      expect(isImmune("last_stand", enemies, enemies[1])).toBe(true);
      expect(isImmune("last_stand", enemies, enemies[2])).toBe(false);
      expect(
        filterTargetable("last_stand", enemies).map((enemy) => enemy.id),
      ).toEqual(alive ? ["guard", "summon"] : ["guard"]);
      enemies[0].hp = 0;
      expect(isImmune("last_stand", enemies, enemies[1])).toBe(alive);
      enemies[2].hp = 0;
      expect(isImmune("last_stand", enemies, enemies[1])).toBe(false);
    });

    it("regenerates the boss without healing or reviving its summon", () => {
      const state = initialCombat(encounter(), 10);
      const result = applyBossTurnEffects(state, "regenerator");
      expect(
        result.state.enemies.find((enemy) => enemy.id === "boss")?.hp,
      ).toBe(45);
      expect(
        result.state.enemies.find((enemy) => enemy.id === "summon")?.hp,
      ).toBe(minion.hp);
      expect(result.logs).toEqual([
        { kind: "heal", text: "Boss Warden regenerated", amount: 5 },
      ]);
      expect(state.enemies[1].hp).toBe(40);
    });

    it("ends Dread Aura when the marked boss dies, even if its summon survives", () => {
      const enemies = encounter();
      expect(enemyDamageMultiplier("aura", enemies[0], enemies)).toBe(1.15);
      expect(enemyDamageMultiplier("aura", enemies[1], enemies)).toBe(1);
      if (alive)
        expect(enemyDamageMultiplier("aura", enemies[2], enemies)).toBe(1.15);
      enemies[1].hp = 0;
      expect(enemyDamageMultiplier("aura", enemies[0], enemies)).toBe(1);
      if (alive)
        expect(enemyDamageMultiplier("aura", enemies[2], enemies)).toBe(1);
      expect(
        applyBossTurnEffects(initialCombat(enemies, 10), "regenerator").state
          .enemies[1].hp,
      ).toBe(0);
    });

    it("splits the wounded boss once and leaves the summon and input untouched", () => {
      const state = initialCombat(encounter(), 10);
      state.enemies.forEach(Object.freeze);
      Object.freeze(state.enemies);
      Object.freeze(state);
      const result = applyBossTurnEffects(state, "splitter");
      expect(result.state.enemies.map((enemy) => enemy.id)).toEqual([
        "guard",
        "boss",
        "summon",
        "boss-echo",
      ]);
      expect(result.state.enemies[1]).toMatchObject({
        hp: 20,
        maxHp: 20,
        damage: 7,
        hasSplit: true,
      });
      expect(result.state.enemies[2]).toEqual(minion);
      expect(result.state.enemies[3]).toMatchObject({
        hp: 20,
        maxHp: 20,
        damage: 7,
        hasSplit: true,
      });
      expect(
        applyBossTurnEffects(result.state, "splitter").state.enemies,
      ).toHaveLength(4);
      expect(state.enemies[1]).toEqual(boss);
    });

    it("credits and decays Phase Lock on the wounded boss, not the final summon", () => {
      const enemies = encounter();
      enemies[1].hp = 70;
      const locked = applyPhaseLockOnDamage("phaselock", enemies);
      expect(locked[1]).toMatchObject({
        phaseLockTurns: 1,
        phaseLockNextAt: 25,
      });
      expect(locked[2].phaseLockTurns).toBeUndefined();
      expect(locked[2].phaseLockNextAt).toBeUndefined();
      expect(isImmune("phaselock", locked, locked[1])).toBe(true);
      expect(
        filterTargetable("phaselock", locked).map((enemy) => enemy.id),
      ).toEqual(alive ? ["guard", "summon"] : ["guard"]);
      const faded = applyBossTurnEffects(
        initialCombat(locked, 10),
        "phaselock",
      );
      expect(faded.state.enemies[1].phaseLockTurns).toBe(0);
      expect(
        isImmune("phaselock", faded.state.enemies, faded.state.enemies[1]),
      ).toBe(false);
      expect(enemies[1].phaseLockTurns).toBeUndefined();
    });
  },
);

describe("legacy boss targeting compatibility", () => {
  it("keeps a splitter's original champion as owner after its marked echo is appended", () => {
    const split = applyBossTurnEffects(
      initialCombat([guard, boss], 10),
      "splitter",
    ).state;
    const original = split.enemies.find((enemy) => enemy.id === "boss")!;
    const echo = split.enemies.find((enemy) => enemy.id === "boss-echo")!;
    expect(echo.tier).toBe("boss");
    expect(getPriorityEnemy(split.enemies)?.id).toBe("boss");
    original.hp = 0;
    expect(getPriorityEnemy(split.enemies)?.id).toBe("boss");
    expect(evaluateObjective(split, 10, "defeat_elite", 0).cleared).toBe(true);
    expect(enemyDamageMultiplier("aura", echo, split.enemies)).toBe(1);
    const regenerated = applyBossTurnEffects(split, "regenerator").state;
    expect(regenerated.enemies.find((enemy) => enemy.id === "boss")?.hp).toBe(
      0,
    );
    expect(
      regenerated.enemies.find((enemy) => enemy.id === "boss-echo")?.hp,
    ).toBe(echo.hp);
  });

  it.each(["Boss Warden", "Mini-Boss Warden", "Elite Warden"])(
    "recognizes old %s name markers without tier metadata",
    (name) => {
      const marked: Enemy = { ...boss, tier: undefined, name };
      const result = applyBossTurnEffects(
        initialCombat([guard, marked, summon], 10),
        "regenerator",
      );
      expect(result.state.enemies[1].hp).toBe(45);
      expect(result.state.enemies[2].hp).toBe(5);
    },
  );

  it("recognizes a tier-only mini boss before a later unmarked summon", () => {
    const marked: Enemy = { ...boss, tier: "mini", name: "Warden" };
    const result = applyBossTurnEffects(
      initialCombat([guard, marked, summon], 10),
      "regenerator",
    );
    expect(result.state.enemies[1].hp).toBe(45);
    expect(result.state.enemies[2].hp).toBe(5);
  });

  it("retains final-enemy rules for encounters without any priority markers", () => {
    const legacy: Enemy = { ...boss, name: "Ancient Warden", tier: undefined };
    const enemies = [guard, legacy];
    expect(isImmune("last_stand", enemies, legacy)).toBe(true);
    expect(enemyDamageMultiplier("aura", guard, enemies)).toBe(1.15);
    expect(
      applyBossTurnEffects(initialCombat(enemies, 10), "regenerator").state
        .enemies[1].hp,
    ).toBe(45);
    expect(
      applyBossTurnEffects(initialCombat(enemies, 10), "splitter").state
        .enemies[2].id,
    ).toBe("boss-echo");
    expect(applyPhaseLockOnDamage("phaselock", enemies)[1].phaseLockTurns).toBe(
      1,
    );
  });

  it("does not transfer old incorrect phase flags on a summon into boss immunity", () => {
    const minion: Enemy = { ...summon, phaseLockTurns: 1, phaseLockNextAt: 5 };
    const enemies = [guard, boss, minion];
    expect(isImmune("phaselock", enemies, minion)).toBe(false);
    expect(isImmune("phaselock", enemies, boss)).toBe(false);
    const result = applyBossTurnEffects(
      initialCombat(enemies, 10),
      "phaselock",
    );
    expect(result.state.enemies[2].phaseLockTurns).toBe(0);
  });

  it("keeps Enraged encounter-wide rather than restricting it to the boss", () => {
    for (const enemy of [guard, boss, summon]) {
      expect(
        enemyDamageMultiplier("enrager", { ...enemy, hp: enemy.maxHp / 2 }),
      ).toBe(1.25);
      expect(
        enemyDamageMultiplier("enrager", { ...enemy, hp: enemy.maxHp }),
      ).toBe(1);
    }
  });

  it("handles empty legacy encounters without inventing a target", () => {
    expect(filterTargetable("last_stand", [])).toEqual([]);
    expect(applyPhaseLockOnDamage("phaselock", [])).toEqual([]);
    expect(
      applyBossTurnEffects(initialCombat([], 10), "splitter").state.enemies,
    ).toEqual([]);
    expect(
      applyBossTurnEffects(initialCombat([], 10), "regenerator").state.enemies,
    ).toEqual([]);
  });
});
