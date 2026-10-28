import { describe, it, expect } from "vitest";
import {
  CAMPAIGN,
  CHALLENGES,
  ENDLESS,
  UPGRADES,
} from "@/lib/nexus/core/catalog";
import {
  activateAbility,
  buyUpgrade,
  createRun,
  startWave,
  stepRun,
  stats,
  upgradeCost,
} from "@/lib/nexus/core/engine";
import {
  emptyMetrics,
  researchCost,
  SYSTEMS,
  upgradePreview,
} from "@/lib/nexus/core/systems";
import { rewardBreakdown, waveCredits } from "@/lib/nexus/core/economy";
import type { CoreEnemy, CoreRun } from "@/lib/nexus/core/types";

const target = (id: number, x: number, y = 0): CoreEnemy => ({
  id,
  kind: "drone",
  x,
  y,
  hp: 1e8,
  maxHp: 1e8,
  speed: 0,
  damage: 9,
  radius: 9,
  bounty: 7,
  attackCd: 999,
  slowed: 0,
});
function arena() {
  const s = startWave(createRun(ENDLESS, {}, "test", 42), ENDLESS);
  s.toSpawn = [];
  s.fireCd = 999;
  return s;
}
const advance = (s: CoreRun, seconds: number) => {
  for (let i = 0; i < seconds / 0.05; i++) s = stepRun(s, ENDLESS);
  return s;
};

describe("weapon systems and upgrade contracts", () => {
  it("applies critical hit damage and preserves the seeded critical roll in flight", () => {
    let s = arena();
    s.fireCd = 0;
    s.upgrades = { critical: 5 };
    s.enemies = [target(99, 60)];
    s = stepRun(s, ENDLESS);
    expect(s.projectiles[0].critical).toBe(true);
    s = stepRun(s, ENDLESS);
    expect(s.metrics!.damage.pulse).toBe(
      SYSTEMS.damage * SYSTEMS.critMultiplier,
    );
  });
  it("slows movement inside the stasis ring and uses the stronger nova slow", () => {
    const s = arena();
    s.upgrades = { frost: 4 };
    s.enemies = [{ ...target(1, 150), speed: 40 }];
    const n = stepRun(s, ENDLESS);
    expect(n.enemies[0].x).toBeCloseTo(150 - 40 * 0.05 * 0.68);
    s.enemies[0].slowed = 1;
    expect(stepRun(s, ENDLESS).enemies[0].x).toBeCloseTo(
      150 - 40 * 0.05 * 0.45,
    );
  });
  it("reduces incoming damage with armor before applying it to hull", () => {
    const s = arena();
    s.upgrades = { armor: 6 };
    s.shield = 0;
    s.shieldDelay = 3;
    s.enemies = [{ ...target(1, 39), attackCd: 0 }];
    const n = stepRun(s, ENDLESS);
    expect(n.hp).toBeCloseTo(180 - 9 * 0.64);
  });
  it("delivers advertised pulse rates without rounding away high-level upgrades", () => {
    for (const setup of [{}, { haste: 8 }] as const) {
      let s = arena();
      s.upgrades = { ...setup };
      s.research = { reactor: 10 };
      s.fireCd = 0;
      s.overdriveTime = 999;
      s.enemies = [target(99, 100)];
      const advertised = stats(s, ENDLESS).fireRate;
      s = advance(s, 20);
      expect(
        Math.abs(s.metrics!.shots.pulse - advertised * 20),
      ).toBeLessThanOrEqual(1.01);
    }
  });
  it("retargets projectiles after their enemy is destroyed rather than discarding them", () => {
    const s = arena();
    s.enemies = [target(2, 100)];
    s.projectiles = [
      { id: 1, x: 85, y: 0, target: 999, damage: 16, critical: false },
    ];
    const n = stepRun(s, ENDLESS);
    expect(n.enemies[0].hp).toBe(1e8 - 16);
    expect(n.metrics!.damage.pulse).toBe(16);
  });
  it("assigns new pulse shots to threats not already covered by lethal in-flight shots", () => {
    const s = arena();
    s.fireCd = 0;
    s.enemies = [{ ...target(1, 150), hp: 10 }, target(2, 180)];
    s.projectiles = [
      { id: 9, x: 5, y: 0, target: 1, damage: 16, critical: false },
    ];
    const n = stepRun(s, ENDLESS);
    expect(n.projectiles.filter((p) => p.target === 1)).toHaveLength(1);
    expect(n.projectiles.some((p) => p.target === 2)).toBe(true);
  });
  it("chains through distinct neighbors with falloff, ignoring isolated enemies", () => {
    const s = arena();
    s.upgrades = { arc: 1 };
    s.enemies = [
      target(1, 80),
      target(2, 150),
      target(3, 215),
      target(4, -220),
    ];
    const n = stepRun(s, ENDLESS),
      v = stats(s, ENDLESS);
    expect(n.metrics!.shots.arc).toBe(1);
    expect(n.enemies[0].hp).toBeCloseTo(1e8 - v.arcDamage);
    expect(n.enemies[1].hp).toBeCloseTo(1e8 - v.arcDamage * 0.82);
    expect(n.enemies[2].hp).toBeCloseTo(1e8 - v.arcDamage * 0.82 ** 2);
    expect(n.enemies[3].hp).toBe(1e8);
    expect(n.effects.filter((e) => e.kind === "arc")).toHaveLength(3);
  });
  it("pierces aligned enemies, bypasses armor, and leaves off-axis enemies untouched", () => {
    const s = arena();
    s.upgrades = { rail: 1 };
    s.enemies = [
      { ...target(1, 100), kind: "tank" },
      target(2, 175),
      target(3, 170, 100),
    ];
    const n = stepRun(s, ENDLESS),
      damage = stats(s, ENDLESS).railDamage;
    expect(n.enemies[0].hp).toBe(1e8 - damage);
    expect(n.enemies[1].hp).toBe(1e8 - damage);
    expect(n.enemies[2].hp).toBe(1e8);
  });
  it("orbital blades can intercept enemies attacking the hull", () => {
    const s = arena();
    s.upgrades = { orbit: 1 };
    s.enemies = [target(1, 39)];
    const n = advance(s, 4);
    expect(n.metrics!.damage.orbit).toBeGreaterThan(0);
    expect(n.metrics!.shots.orbit).toBeGreaterThan(0);
  });
  it("records actual damage, including armor and lethal overkill, instead of inflated damage", () => {
    const s = arena();
    s.enemies = [{ ...target(1, 100), kind: "tank", hp: 5, bounty: 17 }];
    s.projectiles = [
      { id: 10, x: 99, y: 0, target: 1, damage: 999, critical: true },
    ];
    const n = stepRun(s, ENDLESS);
    expect(n.metrics!.damage.pulse).toBe(5);
    expect(n.metrics!.kills.pulse).toBe(1);
  });
  it("weapons research and power upgrade amplify every weapon, while pulse modifiers remain specific", () => {
    const s = arena();
    s.upgrades = { arc: 1, rail: 1, orbit: 1 };
    const a = stats(s, ENDLESS),
      b = stats({ ...s, upgrades: { ...s.upgrades, damage: 1 } }, ENDLESS);
    for (const key of [
      "damage",
      "arcDamage",
      "railDamage",
      "orbitDamage",
    ] as const)
      expect(b[key] / a[key]).toBeCloseTo(1.22);
    const c = stats(
      {
        ...s,
        upgrades: { ...s.upgrades, haste: 1, critical: 1, multishot: 1 },
      },
      ENDLESS,
    );
    expect(c.arcDamage).toBe(a.arcDamage);
    expect(c.railInterval).toBe(a.railInterval);
    expect(c.fireRate).toBeGreaterThan(a.fireRate);
  });
  it("overdrive accelerates gun systems and orbital damage, then restores base values", () => {
    const s = arena();
    s.upgrades = { arc: 1, rail: 1, orbit: 1 };
    s.enemies = [target(1, 200)];
    const a = stats(s, ENDLESS),
      n = activateAbility(s, ENDLESS, "overdrive"),
      b = stats(n, ENDLESS);
    expect(b.fireRate).toBe(a.fireRate * 2);
    expect(b.arcInterval).toBe(a.arcInterval / 2);
    expect(b.railInterval).toBe(a.railInterval / 2);
    expect(b.orbitDamage).toBe(a.orbitDamage * 2);
    expect(stats(advance(n, 6.1), ENDLESS).fireRate).toBe(a.fireRate);
  });
  it("shield recharge waits until the core has been free of hits for three seconds", () => {
    const s = arena();
    s.shield = 20;
    s.enemies = [{ ...target(1, 39), attackCd: 0 }];
    const n = stepRun(s, ENDLESS);
    const shield = n.shield;
    n.enemies[0].x = 300;
    const before = advance(n, 2.8);
    expect(before.shield).toBe(shield);
    expect(advance(before, 0.4).shield).toBeGreaterThan(shield);
  });
  it("pays fractional siphon bonuses accurately and keeps the energy budget conserved", () => {
    let s = arena();
    s.energy = 80;
    s.metrics = emptyMetrics(80);
    s.upgrades = { income: 1 };
    for (let i = 0; i < 10; i++) {
      s.enemies = [{ ...target(i + 1, 100), hp: 1 }];
      s.projectiles = [
        { id: 100 + i, x: 99, y: 0, target: i + 1, damage: 2, critical: false },
      ];
      s.toSpawn = ["drone"];
      s.spawnCd = 999;
      s = stepRun(s, ENDLESS);
    }
    expect(s.energy).toBe(157);
    expect(s.metrics!.energyEarned).toBe(157);
    const next = buyUpgrade(s, ENDLESS, "damage");
    expect(next.energy + next.metrics!.energySpent).toBe(
      next.metrics!.energyEarned,
    );
  });
  it("every upgrade has a working purchase, increasing integer cost, accurate preview, and a cap", () => {
    for (const u of UPGRADES) {
      let s = arena();
      s.energy = 1000000;
      s.metrics = emptyMetrics(s.energy);
      for (let lv = 0; lv < u.max; lv++) {
        const cost = upgradeCost(u.id, lv);
        expect(Number.isInteger(cost)).toBe(true);
        if (lv) expect(cost).toBeGreaterThan(upgradeCost(u.id, lv - 1));
        expect(upgradePreview(s, ENDLESS, u.id).length).toBeGreaterThan(5);
        const n = buyUpgrade(s, ENDLESS, u.id);
        expect(n).not.toBe(s);
        expect(n.energy).toBe(s.energy - cost);
        s = n;
      }
      expect(buyUpgrade(s, ENDLESS, u.id)).toBe(s);
    }
  });
});
describe("currency policy", () => {
  it("awards no credits for zero-wave losses and never converts energy to credits", () => {
    expect(
      rewardBreakdown({ phase: "defeat", cleared: 0 }, ENDLESS).total,
    ).toBe(0);
    const s = createRun(CAMPAIGN[0]);
    s.energy = 99999;
    s.phase = "defeat";
    expect(rewardBreakdown(s, CAMPAIGN[0]).total).toBe(0);
  });
  it("pays clear bonuses only for the first victory; a defeat does not consume the bonus", () => {
    const s = CAMPAIGN[0];
    expect(rewardBreakdown({ phase: "victory", cleared: 5 }, s).total).toBe(90);
    expect(
      rewardBreakdown({ phase: "victory", cleared: 5 }, s, {
        campaign: { "1": 3 },
        challenges: {},
      }),
    ).toMatchObject({ total: 20, bonus: 0 });
    expect(rewardBreakdown({ phase: "defeat", cleared: 4 }, s).bonus).toBe(0);
  });
  it("rewards deeper endless runs and honors the server reward cap", () => {
    expect(waveCredits(ENDLESS, 10)).toBe(65);
    expect(waveCredits(ENDLESS, 20)).toBe(180);
    expect(waveCredits(ENDLESS, 10000)).toBe(1500);
    expect(waveCredits(CHALLENGES[0], 8)).toBe(48);
    expect(researchCost("weapons", 1)).toBe(47);
  });
});
