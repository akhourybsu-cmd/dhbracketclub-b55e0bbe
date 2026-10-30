import { describe, expect, it } from "vitest";
import {
  applyChain,
  chainTier,
  damageEnemies,
  initialCombat,
  redChainPower,
  useAbility,
} from "@/lib/runedelve/combatEngine";
import {
  advanceResonance,
  getResonanceColors,
  resonanceWillBurst,
} from "@/lib/runedelve/resonance";
import {
  ensurePlayableBoard,
  findAvailableChain,
  isValidChain,
} from "@/lib/runedelve/boardEngine";
import {
  MAX_HERO_LEVEL,
  levelFromXp,
  titleForLevel,
  xpForLevel,
} from "@/lib/runedelve/classConfig";
import { mulberry32 } from "@/lib/runedelve/prng";
import { resolveEnemyAttack } from "@/lib/runedelve/telegraph";
import { shouldMasteryRefundMana } from "@/lib/runedelve/masteryEffects";
import type { Enemy, RuneType } from "@/lib/runedelve/dungeonGenerator";

const enemy = (id = "foe", patch: Partial<Enemy> = {}): Enemy => ({
  id,
  name: id,
  emoji: "👹",
  hp: 200,
  maxHp: 200,
  damage: 5,
  ...patch,
});
const deadBoard = (): RuneType[][] =>
  Array.from({ length: 5 }, (_, row) =>
    Array.from(
      { length: 5 },
      (_, col) =>
        (row % 2 ? ["green", "gold"] : ["red", "blue"])[col % 2] as RuneType,
    ),
  );

describe("Rune Delve · Convergence", () => {
  it("rewards four different rune colors once, retaining earned sigils across repeats", () => {
    let state = initialCombat([enemy()], 12);
    for (const rune of ["red", "blue", "red", "green"] as const) {
      const result = advanceResonance(state, rune);
      expect(result.burst).toBeNull();
      state = result.next;
    }
    expect(getResonanceColors(state)).toEqual(["red", "blue", "green"]);
    expect(resonanceWillBurst(state, "gold")).toBe(true);
    expect(resonanceWillBurst(state, "red")).toBe(false);
    const result = advanceResonance(state, "gold");
    expect(result.burst).toEqual({
      damageDealt: 20,
      enemyKills: [],
      manaGained: 1,
      guardGained: 1,
    });
    expect(result.next.resonance).toEqual({ colors: [], bursts: 1 });
    expect(state.enemies[0].hp).toBe(200);
    expect(result.next.enemies[0].hp).toBe(180);
    expect(result.next.turnsRemaining).toBe(12);
  });

  it("counts actual area damage and kills, respects armor, and never overfills mana", () => {
    const state = {
      ...initialCombat(
        [enemy("weak", { hp: 10 }), enemy("armored", { armor: 4 })],
        12,
      ),
      mana: 3,
      resonance: { colors: ["red", "blue", "green"] as RuneType[], bursts: 2 },
    };
    const { next, burst } = advanceResonance(state, "gold");
    expect(burst?.damageDealt).toBe(26);
    expect(burst?.enemyKills).toEqual(["weak"]);
    expect(burst?.manaGained).toBe(0);
    expect(next.totalDamage).toBe(26);
    expect(next.enemiesDefeated).toBe(1);
    expect(next.mana).toBe(3);
    expect(next.resonance?.bursts).toBe(3);
  });

  it("cannot bypass a guarded or phased boss or grant a post-defeat burst", () => {
    const base = {
      ...initialCombat([enemy("guard"), enemy("boss", { tier: "boss" })], 12),
      resonance: { colors: ["red", "blue", "green"] as RuneType[], bursts: 0 },
    };
    const guarded = advanceResonance(base, "gold", 1, "last_stand");
    expect(guarded.next.enemies.map((foe) => foe.hp)).toEqual([180, 200]);
    const phased = advanceResonance(
      { ...base, enemies: [enemy("boss", { phaseLockTurns: 1 })] },
      "gold",
      1,
      "phaselock",
    );
    expect(phased.burst?.damageDealt).toBe(0);
    expect(advanceResonance({ ...base, hp: 0 }, "gold").next).toEqual({
      ...base,
      hp: 0,
    });
  });

  it("loads old combat snapshots with no sigils and scales the burst with campaign depth", () => {
    const original = initialCombat([enemy()], 12);
    expect(getResonanceColors(original)).toEqual([]);
    const ready = {
      ...original,
      resonance: { colors: ["red", "blue", "green"] as RuneType[], bursts: 0 },
    };
    expect(advanceResonance(ready, "gold", 150).burst?.damageDealt).toBe(29);
  });
});

describe("Rune Delve · fair chain power", () => {
  it("applies a weaker hit before lethal checks without healing a different enemy", () => {
    const state = initialCombat(
      [enemy("front", { hp: 34 }), enemy("back", { hp: 70 })],
      12,
    );
    const result = applyChain(state, "red", 3, "warrior", null, 5, 1, {
      runMultiplier: 0.85,
    });
    expect(result.next.enemies.map((foe) => foe.hp)).toEqual([3, 70]);
    expect(result.next.enemiesDefeated).toBe(0);
    expect(result.resolution.enemyKills).toEqual([]);
  });

  it("keeps an amplified single-target strike on its target and clamps score to actual HP loss", () => {
    const state = initialCombat(
      [enemy("front", { hp: 40 }), enemy("back")],
      12,
    );
    const result = applyChain(state, "red", 3, "warrior", null, 5, 1, {
      runMultiplier: 1.6,
    });
    expect(result.next.enemies.map((foe) => foe.hp)).toEqual([0, 200]);
    expect(result.next.totalDamage).toBe(40);
    expect(result.resolution.enemyKills).toEqual(["front"]);
  });

  it("shares raw power across preview and hit while armor reduces only the final hit", () => {
    const modifiers = {
      runMultiplier: 1.6,
      relicMultiplier: 1.3,
      lengthBonus: 1,
      tierMultiplier: 1.2,
      combatMultiplier: 1.5,
    };
    const state = {
      ...initialCombat(
        [enemy("front", { hp: 10_000, maxHp: 10_000, armor: 4 })],
        12,
      ),
      shadowstepActive: true,
    };
    const result = applyChain(
      state,
      "red",
      6,
      "rogue",
      null,
      5,
      100,
      modifiers,
    );
    expect(result.resolution.damageDealt).toBe(
      redChainPower(6, "rogue", 100, modifiers, true) - 4,
    );
    expect(result.next.shadowstepActive).toBe(false);
    expect(state.shadowstepActive).toBe(true);
    expect(chainTier(6).bonusAction).toBe(false);
    expect(chainTier(7).bonusAction).toBe(true);
  });

  it("scales healing before the HP cap, preserving a full heal under mild penalties", () => {
    const state = { ...initialCombat([enemy()], 12), hp: 90 };
    expect(
      applyChain(state, "green", 6, "warrior", null, 5, 1, {
        healMultiplier: 0.75,
      }).next.hp,
    ).toBe(100);
  });

  it("makes Arc Cascade hit a different foe even when its first target survives", () => {
    const state = {
      ...initialCombat([enemy("front"), enemy("back")], 12),
      mana: 3,
    };
    const result = useAbility(state, "mage", null, ["mage_t3_arc_chain"]);
    expect(result.next.enemies.map((foe) => foe.hp)).toEqual([120, 176]);
    expect(result.next.totalDamage).toBe(104);
  });

  it("makes Veilcut delay an imminent special attack instead of firing it early", () => {
    const state = {
      ...initialCombat(
        [
          enemy("charging", {
            ability: "heavy_strike",
            abilityCooldown: 1,
            abilityCooldownMax: 3,
          }),
          enemy("waiting", {
            ability: "heavy_strike",
            abilityCooldown: 2,
            abilityCooldownMax: 3,
          }),
        ],
        12,
      ),
      mana: 3,
    };
    const result = useAbility(state, "rogue", null, ["rogue_t3_shadow_cd"]);
    expect(result.next.enemies.map((foe) => foe.abilityCooldown)).toEqual([
      3, 2,
    ]);
    expect(state.enemies[0].abilityCooldown).toBe(1);
  });

  it("preserves mana when Shadowstep is already primed", () => {
    const state = {
      ...initialCombat([enemy()], 12),
      mana: 3,
      shadowstepActive: true,
    };
    const result = useAbility(state, "rogue");
    expect(result.ok).toBe(false);
    expect(result.next).toBe(state);
    expect(result.next.mana).toBe(3);
  });

  it("keeps full guard mitigation on light attacks beside a heavy strike", () => {
    const result = resolveEnemyAttack(
      [
        enemy("heavy", { damage: 10, intent: 0, intentMax: 3 }),
        enemy("light", { damage: 10, intent: 2, intentMax: 3 }),
      ],
      true,
    );
    expect(result.totalDamage).toBe(15);
    expect(result.heavyFired).toBe(true);
  });

  it("refunds each sixth mana crossing even when a cast skips the exact multiple", () => {
    expect(shouldMasteryRefundMana(["mage_t5_overflow"], 3, 3)).toBe(false);
    expect(shouldMasteryRefundMana(["mage_t5_overflow"], 6, 3)).toBe(true);
    expect(shouldMasteryRefundMana(["mage_t5_overflow"], 8, 2)).toBe(false);
    expect(shouldMasteryRefundMana(["mage_t5_overflow"], 12, 2)).toBe(true);
    expect(shouldMasteryRefundMana(["mage_t5_overflow"], 6, 0)).toBe(false);
    expect(shouldMasteryRefundMana([], 8, 2)).toBe(false);
  });

  it("counts the real damage of a two-target revive burst and respects a protected boss", () => {
    const state = initialCombat(
      [
        enemy("weak", { hp: 9 }),
        enemy("front"),
        enemy("boss", { tier: "boss" }),
      ],
      12,
    );
    const result = damageEnemies(state, 25, "last_stand", 2);
    expect(result.next.enemies.map((foe) => foe.hp)).toEqual([0, 175, 200]);
    expect(result.damageDealt).toBe(34);
    expect(result.next.totalDamage).toBe(34);
    expect(result.next.enemiesDefeated).toBe(1);
    expect(result.enemyKills).toEqual(["weak"]);
  });

  it("extends Sanctuary guard with Steadfast Aegis and never deals armor-chip damage from a zero hit", () => {
    const state = {
      ...initialCombat([enemy("armored", { armor: 10 })], 12),
      mana: 3,
    };
    expect(
      useAbility(state, "cleric", null, ["cleric_t2_long_shield"]).next
        .shieldTurns,
    ).toBe(3);
    expect(damageEnemies(state, 0).damageDealt).toBe(0);
  });
});

describe("Rune Delve · dead board recovery", () => {
  it("refreshes an exhausted board for free with deterministic, valid matching runes", () => {
    const grid = deadBoard();
    expect(findAvailableChain(grid)).toBeNull();
    const recovered = ensurePlayableBoard(grid, mulberry32(42));
    expect(recovered.reshuffled).toBe(true);
    expect(isValidChain(recovered.grid, recovered.chain ?? [])).toBe(true);
    expect(ensurePlayableBoard(grid, mulberry32(42)).grid).toEqual(
      recovered.grid,
    );
    expect(grid).toEqual(deadBoard());
    expect(ensurePlayableBoard(recovered.grid, mulberry32(43)).grid).toBe(
      recovered.grid,
    );
  });

  it("preserves stone runes and respects eclipsed starts even with adversarial random rolls", () => {
    const grid = deadBoard();
    const seals = new Set(["0-0", "1-1", "2-2"]);
    const eclipse = new Set(["0-1", "0-2"]);
    const result = ensurePlayableBoard(grid, () => 0.1, seals, eclipse);
    for (const key of seals) {
      const [r, c] = key.split("-").map(Number);
      expect(result.grid[r][c]).toBe(grid[r][c]);
    }
    expect(isValidChain(result.grid, result.chain ?? [], seals, eclipse)).toBe(
      true,
    );
  });

  it("returns an explicit unavailable move when seal topology has fewer than three open cells", () => {
    const grid = deadBoard();
    const seals = new Set(
      grid.flatMap((row, r) => row.map((_, c) => `${r}-${c}`)),
    );
    seals.delete("0-0");
    seals.delete("0-1");
    const recovered = ensurePlayableBoard(grid, mulberry32(1), seals);
    expect(recovered.chain).toBeNull();
    expect(recovered.reshuffled).toBe(false);
  });
});

describe("Rune Delve · complete class title ladder", () => {
  it("lets class XP reach the advertised level-150 title without overflowing its progress bar", () => {
    const xpTo150 = Array.from({ length: 149 }, (_, index) =>
      xpForLevel(index + 1),
    ).reduce((sum, xp) => sum + xp, 0);
    const max = levelFromXp(xpTo150 + 1_000_000);
    expect(max.level).toBe(MAX_HERO_LEVEL);
    expect(max.intoLevel).toBe(max.needed);
    expect(titleForLevel(levelFromXp(xpTo150).level, "mage")).toBe(
      "Eternal Archsage",
    );
    expect(levelFromXp(-10).level).toBe(1);
  });
});
