import { describe, expect, it } from "vitest";
import { CLASS_LIST } from "@/lib/runedelve/classConfig";
import { getActiveMasteries } from "@/lib/runedelve/classMastery";
import {
  applyChain,
  campaignPowerMultiplier,
  chainTier,
  initialCombat,
  redChainDamage,
  redChainPower,
  useAbility as activateAbility,
} from "@/lib/runedelve/combatEngine";
import {
  getMasteryAbilityManaCost,
  getMasteryOpeningCritMult,
  shouldMasteryRefundMana,
} from "@/lib/runedelve/masteryEffects";

const foe = {
  id: "target",
  name: "Target",
  emoji: "",
  hp: 10000,
  maxHp: 10000,
  damage: 10,
};

describe("documented class roles", () => {
  it("grows campaign power smoothly at chapter and mastery boundaries", () => {
    for (const [level, multiplier] of [
      [1, 1],
      [25, 1],
      [50, 1.1],
      [100, 1.25],
      [150, 1.45],
      [200, 1.65],
    ])
      expect(campaignPowerMultiplier(level)).toBeCloseTo(multiplier, 10);
    let previous = campaignPowerMultiplier(1);
    for (let level = 2; level <= 500; level++) {
      const next = campaignPowerMultiplier(level);
      expect(next).toBeGreaterThanOrEqual(previous);
      expect(next - previous).toBeLessThanOrEqual(0.004000001);
      previous = next;
    }
  });

  it("keeps chain previews and class abilities on the same campaign power curve", () => {
    for (const level of [25, 26, 50, 51, 100, 101, 150, 200]) {
      const depth = campaignPowerMultiplier(level);
      for (const cls of CLASS_LIST) {
        const start = { ...initialCombat([foe], 10), mana: 3 };
        const modifiers = { tierMultiplier: chainTier(7).damageMultiplier };
        const hit = applyChain(
          start,
          "red",
          7,
          cls.id,
          null,
          5,
          level,
          modifiers,
        );
        expect(hit.resolution.damageDealt).toBe(
          redChainPower(7, cls.id, level, modifiers),
        );
        const cast = activateAbility(start, cls.id, null, [], level);
        expect(cast.ok).toBe(true);
        if (cls.id === "rogue") {
          const burst = applyChain(cast.next, "red", 7, cls.id, null, 5, level);
          expect(burst.resolution.damageDealt).toBe(
            redChainPower(7, cls.id, level, {}, true),
          );
        } else {
          const base = cls.id === "warrior" ? 40 : cls.id === "mage" ? 80 : 22;
          expect(cast.next.totalDamage).toBe(Math.round(base * depth));
        }
      }
    }
  });

  it("gives Warrior the strongest ordinary strike at every campaign depth", () => {
    for (const level of [1, 10, 25, 40, 80, 150]) {
      for (const length of [3, 4, 5, 6, 7, 8]) {
        const warrior = redChainDamage(length, "warrior", level);
        for (const cls of CLASS_LIST.filter((cls) => cls.id !== "warrior"))
          expect(warrior).toBeGreaterThan(
            redChainDamage(length, cls.id, level),
          );
      }
    }
    expect(redChainDamage(5, "warrior")).toBe(60);
    expect(redChainDamage(5, "mage")).toBe(50);
    expect(redChainDamage(5, "rogue")).toBe(58);
    expect(redChainDamage(5, "cleric")).toBe(50);
  });

  it("retains Mage mana, Cleric sustain and Rogue's earned Shadowstep burst", () => {
    const start = { ...initialCombat([foe], 10), hp: 40 };
    expect(applyChain(start, "blue", 3, "mage").resolution.manaGained).toBe(2);
    expect(applyChain(start, "blue", 3, "warrior").resolution.manaGained).toBe(
      1,
    );
    expect(applyChain(start, "green", 3, "cleric").resolution.hpHealed).toBe(
      27,
    );
    expect(applyChain(start, "green", 3, "warrior").resolution.hpHealed).toBe(
      18,
    );
    const primed = activateAbility({ ...start, mana: 3 }, "rogue");
    expect(primed.ok).toBe(true);
    expect(primed.next.mana).toBe(1);
    expect(activateAbility(primed.next, "rogue").ok).toBe(false);
    const burst = applyChain(primed.next, "red", 5, "rogue");
    expect(burst.resolution.damageDealt).toBe(116);
    expect(burst.next.shadowstepActive).toBe(false);
  });

  it("uses each documented base cost and retains explicit zero-cost casts", () => {
    for (const cls of CLASS_LIST) {
      const start = initialCombat([foe], 10);
      const notReady = activateAbility(
        { ...start, mana: cls.abilityCost - 1 },
        cls.id,
      );
      expect(notReady.ok).toBe(false);
      const ready = activateAbility(
        { ...start, mana: cls.abilityCost },
        cls.id,
      );
      expect(ready.ok).toBe(true);
      expect(ready.next.mana).toBe(0);
      const free = activateAbility(start, cls.id, null, [], 1, 0);
      expect(free.ok).toBe(true);
      expect(free.next.mana).toBe(0);
    }
  });

  it("reserves Opening Strike for the first red chain after non-attack setup", () => {
    const active = getActiveMasteries("rogue", 15);
    let state = { ...initialCombat([foe], 10), hp: 40 };
    let redChains = 0;
    for (const color of ["green", "blue", "gold"] as const)
      state = applyChain(state, color, 3, "rogue").next;
    const first = applyChain(state, "red", 3, "rogue", null, 5, 1, {
      combatMultiplier: getMasteryOpeningCritMult(active, redChains),
    });
    redChains++;
    expect(first.resolution.damageDealt).toBe(45);
    const second = applyChain(first.next, "red", 3, "rogue", null, 5, 1, {
      combatMultiplier: getMasteryOpeningCritMult(active, redChains),
    });
    expect(second.resolution.damageDealt).toBe(30);
    expect(getMasteryOpeningCritMult(active, redChains)).toBe(1);
  });

  it("refunds only every sixth paid mana and never a free First Light cast", () => {
    const masteries = getActiveMasteries("mage", 80);
    const cost = getMasteryAbilityManaCost(masteries, 3);
    expect(cost).toBe(2);
    let paid = 0;
    let refunds = 0;
    for (let cast = 0; cast < 6; cast++) {
      const start = { ...initialCombat([foe], 10), mana: 3 };
      const free = activateAbility(start, "mage", null, masteries, 80, 0);
      expect(free.ok).toBe(true);
      expect(free.next.mana).toBe(start.mana);
      expect(shouldMasteryRefundMana(masteries, paid, 0)).toBe(false);
      const result = activateAbility(start, "mage", null, masteries, 80, cost);
      const spent = start.mana - result.next.mana;
      paid += spent;
      if (shouldMasteryRefundMana(masteries, paid, spent)) refunds++;
    }
    expect(paid).toBe(12);
    expect(refunds).toBe(2);
  });
});
