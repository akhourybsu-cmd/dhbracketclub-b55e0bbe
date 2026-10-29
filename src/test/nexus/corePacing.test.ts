import { describe, expect, it } from "vitest";
import { ENDLESS } from "@/lib/nexus/core/catalog";
import {
  buyUpgrade,
  createRun,
  enemyScale,
  startWave,
  stats,
  stepRun,
} from "@/lib/nexus/core/engine";
import { simulateCore } from "@/lib/nexus/core/simulator";
import { readCoreRun, saveCoreRun } from "@/lib/nexus/core/persistence";
import type { CoreLoadout } from "@/lib/nexus/core/types";

describe("versioned combat pacing", () => {
  it("preserves actual ruleset-4 outcomes for saved starter, rail and mortar runs", () => {
    const cases: [CoreLoadout, number, number, number, number, number][] = [
      [{ weapons: [], module: null }, 14, 610, 515, 4973, 4879],
      [
        { weapons: ["rail", "orbit"], module: "repair" },
        16,
        674,
        643,
        6197,
        6098,
      ],
      [
        { weapons: ["mortar", "orbit"], module: "stasis" },
        18,
        831,
        789,
        7510,
        7379,
      ],
    ];
    for (const [loadout, waves, seconds, kills, earned, spent] of cases) {
      const s = simulateCore(ENDLESS, "balanced", 42, {}, 1800, loadout, 4);
      expect([
        s.waves,
        s.seconds,
        s.kills,
        s.energyEarned,
        s.energySpent,
      ]).toEqual([waves, seconds, kills, earned, spent]);
    }
  });

  it("starts combat promptly, introduces a boss early and retains upgrade decisions", () => {
    const s = simulateCore(ENDLESS, "balanced", 42);
    expect(s.pacing.firstShot).toBeGreaterThan(4);
    expect(s.pacing.firstShot).toBeLessThan(7);
    expect(s.pacing.firstKill).toBeLessThan(9);
    expect(s.pacing.firstBoss).toBeGreaterThan(70);
    expect(s.pacing.firstBoss).toBeLessThan(110);
    expect(s.seconds).toBeGreaterThan(360);
    expect(s.seconds).toBeLessThan(660);
    expect(
      s.pacing.purchases.filter((t) => t <= 60).length,
    ).toBeGreaterThanOrEqual(5);
  });

  it("keeps brief normal breaks and a longer recovery after a boss", () => {
    for (const [version, wave, duration] of [
      [5, 1, 3.5],
      [5, 5, 6.5],
      [4, 1, 7],
      [4, 5, 7],
    ]) {
      const s = startWave(
        createRun(ENDLESS, {}, "test", 42, undefined, version),
        ENDLESS,
      );
      s.wave = wave;
      s.enemies = [];
      s.toSpawn = [];
      const n = stepRun(s, ENDLESS);
      expect(n.phase).toBe("intermission");
      expect(n.breakTime).toBe(duration);
    }
  });

  it("lets an orbital contact a small swarm already attacking the hull", () => {
    const s = startWave(
      createRun(ENDLESS, {}, "test", 42, { weapons: ["orbit"], module: null }),
      ENDLESS,
    );
    s.toSpawn = [];
    s.fireCd = 999;
    s.time = -0.05; // Blade points along +x on the next simulation step.
    s.enemies = [
      {
        id: 100,
        kind: "swarm",
        x: 35,
        y: 0,
        hp: 100,
        maxHp: 100,
        speed: 0,
        damage: 5,
        radius: 5,
        bounty: 4,
        attackCd: 1,
        slowed: 0,
      },
    ];
    const n = stepRun(s, ENDLESS);
    expect(n.metrics!.damage.orbit).toBe(stats(s, ENDLESS).orbitDamage);
    expect(n.enemies[0].hp).toBe(82);
  });

  it("chains through separated neighbors beyond detection range with the current falloff", () => {
    const s = startWave(
      createRun(ENDLESS, {}, "test", 42, { weapons: ["arc"], module: null }),
      ENDLESS,
    );
    s.toSpawn = [];
    s.fireCd = 999;
    s.enemies = [100, 225, 350].map((x, i) => ({
      id: i + 100,
      kind: "drone",
      x,
      y: 0,
      hp: 10000,
      maxHp: 10000,
      speed: 0,
      damage: 1,
      radius: 9,
      bounty: 7,
      attackCd: 999,
      slowed: 0,
    }));
    const n = stepRun(s, ENDLESS);
    n.enemies.forEach((e, i) =>
      expect(e.hp).toBeCloseTo(10000 - 40 * 0.86 ** i),
    );
    expect(
      stepRun({ ...s, balanceVersion: 4 }, ENDLESS).enemies.filter(
        (e) => e.hp < 10000,
      ),
    ).toHaveLength(1);
  });

  it("makes repair support fortify hull purchases and actually restore hull over time", () => {
    const s = createRun(ENDLESS, {}, "test", 42, {
      weapons: [],
      module: "repair",
    });
    expect(s.hp).toBe(216);
    s.hp = 80;
    const n = buyUpgrade(s, ENDLESS, "hull");
    expect(stats(n, ENDLESS).maxHp).toBe(270);
    expect(n.hp).toBe(134);
    let battle = startWave(n, ENDLESS);
    battle.spawnCd = 999;
    for (let i = 0; i < 20; i++) battle = stepRun(battle, ENDLESS);
    expect(battle.hp).toBeCloseTo(136.5);
  });

  it("keeps research finite under a continuously increasing late-game health ramp", () => {
    let prior = enemyScale(1, ENDLESS);
    for (let wave = 2; wave <= 200; wave++) {
      const value = enemyScale(wave, ENDLESS);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(prior);
      prior = value;
    }
  });

  it("restores the original rules from a checkpoint and rejects future rules it cannot simulate", () => {
    localStorage.clear();
    const s = createRun(
      ENDLESS,
      {},
      "saved",
      42,
      { weapons: ["rail"], module: "stasis" },
      4,
    );
    saveCoreRun(s, "version-test", "club");
    const restored = readCoreRun("version-test", "club")!;
    expect(restored.balanceVersion).toBe(4);
    expect(stats(restored, ENDLESS)).toMatchObject({
      railDamage: 140,
      slow: 0.12,
    });
    saveCoreRun({ ...s, balanceVersion: 6 }, "version-test", "club");
    expect(readCoreRun("version-test", "club")).toBeNull();
  });
});
