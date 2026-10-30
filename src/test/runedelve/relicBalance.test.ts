import { describe, expect, it } from "vitest";
import {
  applyChain,
  enemiesAttack,
  initialCombat,
  useAbility as activateAbility,
} from "@/lib/runedelve/combatEngine";
import { RELIC_CATALOG, describeRelicAtRank } from "@/lib/runedelve/relics";
import { buildCharacterSheet } from "@/lib/runedelve/characterStats";
import { getActiveMasteries } from "@/lib/runedelve/classMastery";
import {
  getMasteryMaxHpBonus,
  getMasteryOpeningHeal,
} from "@/lib/runedelve/masteryEffects";
import {
  abilityFreeFirstUse,
  buildActive,
  computeChainMods,
  getLifestealHealAmount,
  getRelicRankMaxHpBonus,
  thornsRelicMultiplier,
} from "@/lib/runedelve/relicEffects";

const foe = {
  id: "target",
  name: "Target",
  emoji: "",
  hp: 10000,
  maxHp: 10000,
  damage: 100,
};
const context = {
  chainType: "red" as const,
  length: 3,
  redChainCountSoFar: 1,
  isFirstChainOfRun: false,
  hpRatio: 0.5,
  enemyHpRatioBeforeHit: 1,
  chainNumberThisRun: 1,
};

describe("ranked relic choices", () => {
  it("gives every relic upgrade visible equipped vitality even across primary-effect plateaus", () => {
    for (const relic of RELIC_CATALOG) {
      let previousHp = 0;
      for (let rank = 1; rank <= 5; rank++) {
        const sheet = buildCharacterSheet({
          cls: "mage",
          classLevel: 1,
          campaignLevel: 1,
          slots: [relic.id],
          rankById: new Map([[relic.id, rank]]),
        });
        const hp = sheet.stats.find((stat) => stat.id === "hp")!.effective;
        if (rank > 1) {
          expect(hp, `${relic.id} rank ${rank}`).toBe(previousHp + 2);
          const detail = describeRelicAtRank(relic, rank);
          expect(detail).toContain(`+${(rank - 1) * 2} max HP while equipped`);
          expect(
            sheet.bonuses.find((bonus) => bonus.id === relic.id)?.detail,
          ).toBe(detail);
        }
        previousHp = hp;
      }
    }
    const relics = buildActive(
      ["aether_spark", "iron_resolve", "keysight"],
      new Map([
        ["aether_spark", 5],
        ["iron_resolve", 5],
        ["keysight", 5],
      ]),
    );
    const opening = initialCombat([foe], 10, {
      bonusMaxHp: getRelicRankMaxHpBonus(relics),
    });
    expect(opening.maxHp).toBe(124);
    expect(opening.hp).toBe(124);
    expect(
      getRelicRankMaxHpBonus(
        buildActive(["unknown"], new Map([["unknown", 5]])),
      ),
    ).toBe(0);
  });

  it("retains the mana-versus-guard choice between Aether Spark and Iron Resolve", () => {
    for (const cls of ["warrior", "mage", "rogue", "cleric"] as const) {
      const mana = buildCharacterSheet({
        cls,
        classLevel: 80,
        campaignLevel: 100,
        slots: ["aether_spark"],
        rankById: new Map([["aether_spark", 5]]),
      });
      const guard = buildCharacterSheet({
        cls,
        classLevel: 80,
        campaignLevel: 100,
        slots: ["iron_resolve"],
        rankById: new Map([["iron_resolve", 5]]),
      });
      expect(mana.startingMana).toBe(3);
      expect(mana.startingShield).toBe(0);
      expect(guard.startingMana).toBeLessThan(mana.startingMana);
      expect(guard.startingShield).toBe(3);
    }
  });

  it("limits First Light to one or two real free casts rather than unlimited empty-mana attacks", () => {
    for (let rank = 1; rank <= 5; rank++) {
      const relics = buildActive(
        ["first_light"],
        new Map([["first_light", rank]]),
      );
      let state = initialCombat([foe], 10);
      let casts = 0;
      while (abilityFreeFirstUse(relics, casts)) {
        const result = activateAbility(state, "warrior", null, [], 1, 0);
        expect(result.ok).toBe(true);
        state = result.next;
        casts++;
        expect(casts).toBeLessThanOrEqual(2);
      }
      expect(casts).toBe(rank < 4 ? 1 : 2);
      expect(state.totalDamage).toBe(casts * 40);
      expect(state.mana).toBe(0);
      expect(activateAbility(state, "warrior").ok).toBe(false);
      expect(state.turnsRemaining).toBe(10);
    }
  });

  it("makes Crimson Tide's third and sixth red chains actual damage spikes", () => {
    const relics = buildActive(["crimson_tide"]);
    let state = initialCombat([foe], 10);
    const hits = [];
    for (let count = 1; count <= 6; count++) {
      const mods = computeChainMods(relics, {
        ...context,
        redChainCountSoFar: count,
      });
      const result = applyChain(state, "red", 3, "warrior", null, 5, 1, {
        relicMultiplier: mods.bonusDamageMult,
      });
      hits.push(result.resolution.damageDealt);
      state = result.next;
    }
    expect(hits).toEqual([36, 36, 58, 36, 36, 58]);
  });

  it("uses actual red HP loss for capped lifesteal, including large burst and overkill cases", () => {
    const relics = buildActive(
      ["vampiric_sigil"],
      new Map([["vampiric_sigil", 5]]),
    );
    const start = {
      ...initialCombat([foe], 10),
      hp: 20,
      maxHp: 108,
      shadowstepActive: true,
    };
    const large = applyChain(start, "red", 8, "rogue");
    expect(large.resolution.damageDealt).toBeGreaterThan(108);
    expect(
      getLifestealHealAmount(relics, large.resolution.damageDealt, 108),
    ).toBe(21);
    const overkill = applyChain(
      { ...start, enemies: [{ ...foe, hp: 5 }] },
      "red",
      8,
      "rogue",
    );
    expect(overkill.resolution.damageDealt).toBe(5);
    expect(
      getLifestealHealAmount(relics, overkill.resolution.damageDealt, 108),
    ).toBe(1);
    expect(getLifestealHealAmount(relics, 0, 108)).toBe(0);
  });

  it("gives Spiked Aegis stronger reflection at each rank while bounding the combined build's damage", () => {
    for (let rank = 1; rank <= 5; rank++) {
      const reflected = (id: string) => {
        const relics = buildActive([id], new Map([[id, rank]]));
        return enemiesAttack(
          { ...initialCombat([foe], 10), shieldTurns: 3 },
          false,
          null,
          0,
          { cls: "warrior", relicMultiplier: thornsRelicMultiplier(relics) },
        ).totalDamage;
      };
      expect(reflected("spiked_aegis")).toBeGreaterThan(
        reflected("brambleward"),
      );
    }
    const both = buildActive(
      ["spiked_aegis", "brambleward"],
      new Map([
        ["spiked_aegis", 5],
        ["brambleward", 5],
      ]),
    );
    const result = enemiesAttack(
      { ...initialCombat([foe], 10), shieldTurns: 3 },
      false,
      null,
      0,
      { cls: "warrior", relicMultiplier: thornsRelicMultiplier(both) },
    );
    expect(result.totalDamage).toBe(61);
    expect(result.hp).toBe(60);
  });
});

describe("early mastery payoff", () => {
  it("grants Iron Constitution immediate opening health and further cleared-chapter growth", () => {
    const unlocked = getActiveMasteries("warrior", 15);
    const opening = initialCombat([foe], 10, {
      bonusMaxHp: getMasteryMaxHpBonus(unlocked, 0),
    });
    expect(opening.maxHp).toBe(106);
    expect(
      initialCombat([foe], 10, {
        bonusMaxHp: getMasteryMaxHpBonus(unlocked, 2),
      }).maxHp,
    ).toBe(110);
    expect(getMasteryMaxHpBonus(getActiveMasteries("warrior", 14), 2)).toBe(0);
  });

  it("lets Morning Prayer heal a wounded second chain and then stops", () => {
    const active = getActiveMasteries("cleric", 5);
    let state = initialCombat([{ ...foe, damage: 10 }], 10);
    for (let chain = 0; chain < 3; chain++) {
      state = applyChain(state, "blue", 3, "cleric").next;
      state = {
        ...state,
        hp: Math.min(
          state.maxHp,
          state.hp + getMasteryOpeningHeal(active, chain),
        ),
      };
      state = enemiesAttack(state);
    }
    expect(state.hp).toBe(75);
    expect(getMasteryOpeningHeal(active, 2)).toBe(0);
    expect(getMasteryOpeningHeal(active, 100)).toBe(0);
  });
});
