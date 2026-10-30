import { describe, expect, it } from "vitest";
import { ENDLESS, RESEARCH, UPGRADES } from "@/lib/nexus/core/catalog";
import {
  activateAbility,
  buyUpgrade,
  createRun,
  enemyScale,
  startWave,
  stats,
  stepRun,
} from "@/lib/nexus/core/engine";
import { DIFFICULTIES, scenarioForRun } from "@/lib/nexus/core/difficulty";
import { readCoreRun, saveCoreRun } from "@/lib/nexus/core/persistence";
import { researchCost, upgradeCap } from "@/lib/nexus/core/systems";
import { rewardBreakdown } from "@/lib/nexus/core/economy";
import { simulateCore } from "@/lib/nexus/core/simulator";
import { AUXILIARIES } from "@/lib/nexus/core/progression";
import type { CoreEnemy, CoreLoadout, CoreRun } from "@/lib/nexus/core/types";

function enemy(
  id: number,
  x = 100,
  kind: CoreEnemy["kind"] = "drone",
): CoreEnemy {
  return {
    id,
    kind,
    x,
    y: 0,
    hp: 10000,
    maxHp: 10000,
    speed: 0,
    damage: 10,
    radius: 9,
    bounty: 7,
    attackCd: 999,
    slowed: 0,
  };
}
function arena(loadout: CoreLoadout, difficulty = 1) {
  const s = startWave(
    createRun(ENDLESS, {}, "expansion", 42, loadout, 6, difficulty),
    ENDLESS,
  );
  s.toSpawn = [];
  s.spawnCd = 999;
  s.fireCd = 999;
  return s;
}
function advance(s: CoreRun, seconds: number) {
  for (let i = 0; i < Math.round(seconds / 0.05); i++) s = stepRun(s, ENDLESS);
  return s;
}

describe("long-horizon arsenal", () => {
  it("builds laser heat only while retaining a valid lock, and resets heat after target loss", () => {
    let s = arena({ weapons: ["laser"], module: null });
    s.enemies = [enemy(1), enemy(2, 180)];
    const first = advance(s, 1);
    const warmed = advance(first, 1);
    expect(
      warmed.metrics!.damage.laser - first.metrics!.damage.laser,
    ).toBeGreaterThan(first.metrics!.damage.laser);
    expect(warmed.laserTarget).toBe(1);
    warmed.enemies[0].x = 500;
    s = stepRun(warmed, ENDLESS);
    expect(s.laserTarget).toBe(2);
    expect(s.laserHeat).toBe(0.05);
    expect(s.metrics!.damage.laser).toBeGreaterThan(0);
  });

  it("spreads bounded corrosion, bypasses armor and expires without stacking", () => {
    let s = arena({ weapons: ["venom"], module: null });
    s.enemies = [enemy(1, 100, "tank"), enemy(2, 150)];
    s = stepRun(s, ENDLESS);
    expect(s.enemies[0].venomTime).toBe(4);
    expect(s.enemies[1].venomTime).toBeUndefined();
    s.venomCd = 999;
    const dps = stats(s, ENDLESS).venomDps;
    s = advance(s, 5);
    expect(s.metrics!.damage.venom).toBeCloseTo(dps * 4);
    expect(s.enemies[0].venomTime).toBe(0);
    const before = s.metrics!.damage.venom;
    expect(advance(s, 2).metrics!.damage.venom).toBe(before);
  });

  it("flak selects the fastest threat and splashes only its neighbors", () => {
    let s = arena({ weapons: ["flak"], module: null });
    s.enemies = [
      enemy(1, -150),
      { ...enemy(2, 150), speed: 5 },
      enemy(3, 175),
      enemy(4, 260),
    ];
    s = stepRun(s, ENDLESS);
    expect(s.enemies[0].hp).toBe(10000);
    expect(s.enemies[1].hp).toBeLessThan(10000);
    expect(s.enemies[2].hp).toBeLessThan(10000);
    expect(s.enemies[3].hp).toBe(10000);
    expect(s.metrics!.shots.flak).toBe(1);
  });

  it("supports active-ability and retaliation builds with real cooldown and incoming-hit effects", () => {
    const capacitor = arena({ weapons: [], module: "capacitor" });
    expect(activateAbility(capacitor, ENDLESS, "nova").novaCd).toBe(17);
    capacitor.energy = 1e6;
    let upgraded = buyUpgrade(capacitor, ENDLESS, "cooldown");
    expect(
      activateAbility(upgraded, ENDLESS, "overdrive").overdriveCd,
    ).toBeCloseTo(24.48);
    expect(
      buyUpgrade(arena({ weapons: [], module: null }), ENDLESS, "cooldown")
        .upgrades.cooldown,
    ).toBeUndefined();
    upgraded = arena({ weapons: [], module: "thorns" });
    upgraded.shield = 0;
    upgraded.shieldDelay = 3;
    upgraded.enemies = [{ ...enemy(1, 39, "tank"), attackCd: 0 }];
    const n = stepRun(upgraded, ENDLESS);
    expect(n.hp).toBe(170);
    expect(n.metrics!.damage.thorns).toBe(130);
    expect(n.enemies[0].hp).toBe(9870);
    upgraded.enemies[0].maxHp = 1e9;
    expect(stepRun(upgraded, ENDLESS).metrics!.damage.thorns).toBe(150);
  });

  it("keeps new and archived caps separate, with bounded defensive stats at late progression", () => {
    expect(upgradeCap("damage", 5)).toBe(10);
    expect(upgradeCap("damage", 6)).toBe(30);
    expect(upgradeCap("laser", 5)).toBe(0);
    const s = arena({ weapons: [], module: "stasis" });
    s.upgrades = { armor: 10, frost: 8, critical: 10 };
    const v = stats(s, ENDLESS);
    expect(v.armor).toBe(0.6);
    expect(v.slow).toBeLessThanOrEqual(0.65);
    expect(v.critical).toBeLessThanOrEqual(0.6);
    expect(RESEARCH.every((r) => r.max === 30)).toBe(true);
    expect(researchCost("weapons", 9)).toBe(Math.round(35 * 1.35 ** 9));
    expect(researchCost("weapons", 10)).toBe(Math.round(35 * 1.35 ** 10));
    expect(researchCost("weapons", 29)).toBe(
      Math.round(35 * 1.35 ** 10 * 1.16 ** 19),
    );
  });

  it("restores heat, corrosion, difficulty and research30 while rejecting malformed or future state", () => {
    let s = arena({ weapons: ["laser", "venom"], module: "capacitor" }, 4);
    s.research = { weapons: 30 };
    s.enemies = [enemy(99)];
    s = advance(s, 1);
    saveCoreRun(s, "expansion", "club");
    expect(readCoreRun("expansion", "club")).toMatchObject({
      difficulty: 4,
      laserTarget: 99,
      research: { weapons: 30 },
    });
    saveCoreRun({ ...s, difficulty: 7 }, "expansion", "club");
    expect(readCoreRun("expansion", "club")).toBeNull();
    saveCoreRun({ ...s, balanceVersion: 5 }, "expansion", "club");
    expect(readCoreRun("expansion", "club")).toBeNull();
  });

  it("every v6 upgrade spends exactly its listed price and stops at the deployed-system cap", () => {
    for (const def of UPGRADES) {
      const module =
        def.id === "regen"
          ? "repair"
          : def.id === "income"
            ? "siphon"
            : def.id === "frost"
              ? "stasis"
              : def.id === "cooldown"
                ? "capacitor"
                : def.id === "thorns"
                  ? "thorns"
                  : null;
      const weapon = AUXILIARIES.find((a) => a.id === def.id);
      let s = arena({
        weapons: weapon ? [weapon.id as CoreLoadout["weapons"][number]] : [],
        module,
      });
      s.energy = 1e12;
      for (let level = s.upgrades[def.id] || 0; level < def.max; level++) {
        const next = buyUpgrade(s, ENDLESS, def.id);
        expect(next.upgrades[def.id]).toBe(level + 1);
        expect(next.energy).toBeLessThan(s.energy);
        expect(next.metrics!.energySpent - s.metrics!.energySpent).toBe(
          s.energy - next.energy,
        );
        s = next;
      }
      expect(buyUpgrade(s, ENDLESS, def.id)).toBe(s);
    }
  });
});

describe("endless threat tiers", () => {
  it("keeps scaled scenarios idempotent and archived runs on their original threat", () => {
    const run = { balanceVersion: 6, difficulty: 6 };
    const scaled = scenarioForRun(ENDLESS, run);
    expect(scaled.hp).toBe(6.5);
    expect(scenarioForRun(scaled, run)).toBe(scaled);
    expect(scenarioForRun(ENDLESS, { balanceVersion: 5, difficulty: 6 })).toBe(
      ENDLESS,
    );
    const hp = DIFFICULTIES.map((d) =>
      enemyScale(20, scenarioForRun(ENDLESS, { ...run, difficulty: d.id }), 6),
    );
    for (let i = 1; i < hp.length; i++)
      expect(hp[i]).toBeGreaterThan(hp[i - 1]);
  });

  it("introduces twin tenth-wave sieges and credits from the immutable tier snapshot", () => {
    for (const d of DIFFICULTIES) {
      const s = arena({ weapons: [], module: null }, d.id);
      s.phase = "intermission";
      s.wave = 9;
      expect(
        startWave(s, ENDLESS).toSpawn.filter((k) => k === "boss"),
      ).toHaveLength(d.id === 1 ? 1 : 2);
      const result = rewardBreakdown({ ...s, cleared: 10 }, ENDLESS, {
        campaign: {},
        challenges: {},
        bestWave: 10,
      });
      expect(result.waves).toBe(Math.floor(42 * d.reward));
    }
  });

  it("escalates runner speed, armored regeneration and splitter threat without changing archives", () => {
    let s = arena({ weapons: [], module: null }, 4);
    s.enemies = [{ ...enemy(1, 300, "tank"), hp: 5000 }];
    expect(stepRun(s, ENDLESS).enemies[0].hp).toBe(5002);
    s.balanceVersion = 5;
    expect(stepRun(s, ENDLESS).enemies[0].hp).toBe(5000);
    s = arena({ weapons: [], module: null }, 6);
    s.enemies = [{ ...enemy(1, 100, "splitter"), hp: 0 }];
    expect(stepRun(s, ENDLESS).enemies).toHaveLength(4);
  });
});

describe("measured v6 progression guardrails", () => {
  it("supports distinct active builds, gives research meaningful depth and keeps the final tier finite", () => {
    const builds: CoreLoadout[] = [
      { weapons: ["rail", "orbit"], module: "repair" },
      { weapons: ["laser", "flak"], module: "capacitor" },
      { weapons: ["venom", "arc"], module: "stasis" },
    ];
    const research = Object.fromEntries(RESEARCH.map((r) => [r.id, 30]));
    for (const loadout of builds) {
      const fresh = simulateCore(
        ENDLESS,
        "balanced",
        42,
        {},
        1800,
        loadout,
        6,
        1,
      );
      const trained = simulateCore(
        ENDLESS,
        "balanced",
        42,
        research,
        1800,
        loadout,
        6,
        1,
      );
      const apex = simulateCore(
        ENDLESS,
        "balanced",
        42,
        research,
        1800,
        loadout,
        6,
        6,
      );
      expect(fresh.finished && trained.finished && apex.finished).toBe(true);
      expect(trained.waves).toBeGreaterThan(fresh.waves + 10);
      expect(apex.waves).toBeGreaterThanOrEqual(20);
      expect(apex.waves).toBeLessThan(trained.waves);
      expect(apex.seconds).toBeLessThan(1200);
      for (const run of [fresh, trained, apex]) {
        expect(run.energy + run.energySpent).toBe(run.energyEarned);
        for (const weapon of loadout.weapons)
          expect(run.damage[weapon]).toBeGreaterThan(0);
      }
    }
  }, 30_000);
});
