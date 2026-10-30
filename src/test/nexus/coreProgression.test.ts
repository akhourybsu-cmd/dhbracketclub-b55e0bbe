import { describe, expect, it } from "vitest";
import { ENDLESS } from "@/lib/nexus/core/catalog";
import {
  activateAbility,
  buyUpgrade,
  createRun,
  startWave,
  stats,
  stepRun,
  waveEnemies,
} from "@/lib/nexus/core/engine";
import { endlessCredits, rewardBreakdown } from "@/lib/nexus/core/economy";
import {
  ARMORY,
  loadoutError,
  loadoutPower,
  milestoneCredits,
  upgradeAvailable,
} from "@/lib/nexus/core/progression";
import { emptyMetrics } from "@/lib/nexus/core/systems";
import { readCoreRun, saveCoreRun } from "@/lib/nexus/core/persistence";
import type { CoreEnemy, CoreLoadout, CoreRun } from "@/lib/nexus/core/types";
const target = (id: number, x: number, y = 0): CoreEnemy => ({
  id,
  kind: "drone",
  x,
  y,
  hp: 10000,
  maxHp: 10000,
  speed: 0,
  damage: 1,
  radius: 9,
  bounty: 7,
  attackCd: 999,
  slowed: 0,
});
function arena(loadout: CoreLoadout) {
  const s = startWave(createRun(ENDLESS, {}, "test", 42, loadout), ENDLESS);
  s.toSpawn = [];
  s.fireCd = 999;
  s.energy = 10000;
  s.metrics = emptyMetrics(10000);
  return s;
}
const advance = (s: CoreRun, seconds: number) => {
  for (let i = 0; i < seconds / 0.05; i++) s = stepRun(s, ENDLESS);
  return s;
};
describe("endless arsenal and progression", () => {
  it("starts with only a working pulse cannon and no unlocked support effects", () => {
    const s = createRun(ENDLESS);
    expect(s.balanceVersion).toBe(6);
    expect(s.loadout).toEqual({ weapons: [], module: null });
    expect(s.upgrades).toEqual({});
    expect(stats(s, ENDLESS)).toMatchObject({
      orbit: 0,
      arcDamage: 0,
      railDamage: 0,
      mortarDamage: 0,
      regen: 0,
      slow: 0,
      income: 1,
    });
    const n = startWave(s, ENDLESS);
    n.enemies = [target(900, 100)];
    n.toSpawn = [];
    expect(advance(n, 2).metrics!.damage.pulse).toBeGreaterThan(0);
    for (const id of [
      "arc",
      "rail",
      "orbit",
      "mortar",
      "income",
      "frost",
      "regen",
    ] as const)
      expect(buyUpgrade(s, ENDLESS, id)).toBe(s);
  });
  it("enforces unique hardpoints, known modules, owned equipment and the shared power budget", () => {
    const owned = ARMORY.map((a) => a.id);
    expect(
      loadoutError({ weapons: ["rail", "orbit"], module: "repair" }, owned),
    ).toBeNull();
    expect(loadoutPower({ weapons: ["arc", "mortar"], module: null })).toBe(4);
    for (const value of [
      null,
      {},
      { weapons: ["rail", "arc"], module: null },
      { weapons: ["orbit", "orbit"], module: null },
      { weapons: ["arc", "mortar", "orbit"], module: null },
      { weapons: [], module: "unknown" },
    ])
      expect(loadoutError(value, owned)).toBeTruthy();
    expect(loadoutError({ weapons: ["arc"], module: null }, [])).toMatch(
      /Unlock/,
    );
    expect(() =>
      createRun(ENDLESS, {}, "test", 1, {
        weapons: ["rail", "mortar"],
        module: null,
      }),
    ).toThrow(/power/);
  });
  it("brings selected weapons online for free and charges only subsequent upgrade levels", () => {
    const s = createRun(ENDLESS, {}, "test", 1, {
      weapons: ["rail", "orbit"],
      module: "repair",
    });
    expect(s.upgrades).toEqual({ rail: 1, orbit: 1 });
    expect(s.metrics!.energySpent).toBe(0);
    expect(s.energy).toBe(80);
    expect(stats(s, ENDLESS)).toMatchObject({
      railDamage: 170,
      orbit: 1,
      regen: 2.5,
    });
    s.energy = 1000;
    s.metrics = emptyMetrics(1000);
    const n = buyUpgrade(s, ENDLESS, "rail");
    expect(n.upgrades.rail).toBe(2);
    expect(n.metrics!.energySpent).toBe(216);
    expect(n.energy + n.metrics!.energySpent).toBe(n.metrics!.energyEarned);
    expect(buyUpgrade(s, ENDLESS, "arc")).toBe(s);
  });
  it("gives each support module its own starting buff and exclusive upgrade path", () => {
    for (const [module, id, field, start] of [
      ["repair", "regen", "regen", 2.5],
      ["siphon", "income", "income", 1.1],
      ["stasis", "frost", "slow", 0.1],
    ] as const) {
      const s = arena({ weapons: [], module });
      expect(stats(s, ENDLESS)[field]).toBeCloseTo(start);
      expect(stats(buyUpgrade(s, ENDLESS, id), ENDLESS)[field]).toBeGreaterThan(
        start,
      );
      for (const other of ["regen", "income", "frost"] as const)
        expect(upgradeAvailable(s, other)).toBe(other === id);
    }
  });
  it("mortars hit the densest cluster after a delay with full area damage, leaving distant threats intact", () => {
    const s = arena({ weapons: ["mortar"], module: null });
    s.enemies = [
      target(1, 60),
      target(2, -150),
      target(3, -160, 35),
      target(4, -185, -20),
    ];
    const shot = stepRun(s, ENDLESS);
    expect(shot.metrics!.shots.mortar).toBe(1);
    expect(shot.metrics!.damage.mortar).toBe(0);
    expect(shot.shells![0].x).toBeLessThan(0);
    expect(shot.enemies.every((e) => e.hp === 10000)).toBe(true);
    const hit = advance(shot, 0.7),
      damage = stats(s, ENDLESS).mortarDamage;
    expect(hit.enemies[0].hp).toBe(10000);
    for (const e of hit.enemies.slice(1))
      expect(e.hp).toBeCloseTo(10000 - damage);
    expect(hit.metrics!.damage.mortar).toBeCloseTo(damage * 3);
    expect(hit.effects.some((e) => e.kind === "mortar")).toBe(true);
  });
  it("mortars commit to a location so fast enemies can escape and armor still mitigates the blast", () => {
    const s = arena({ weapons: ["mortar"], module: null });
    s.enemies = [
      { ...target(1, 220), speed: 200 },
      { ...target(2, 225), kind: "tank" },
    ];
    const n = advance(s, 0.8),
      damage = stats(s, ENDLESS).mortarDamage;
    expect(n.enemies[0].hp).toBe(10000);
    expect(n.enemies[1].hp).toBeCloseTo(10000 - damage * 0.75);
  });
  it("amplifies mortar damage with power and research and accelerates recharge with overdrive", () => {
    const s = arena({ weapons: ["mortar"], module: null }),
      a = stats(s, ENDLESS);
    const b = stats(
      {
        ...s,
        upgrades: { ...s.upgrades, damage: 1 },
        research: { weapons: 1 },
      },
      ENDLESS,
    );
    expect(b.mortarDamage / a.mortarDamage).toBeCloseTo(1.22 * 1.08);
    const n = activateAbility(s, ENDLESS, "overdrive");
    expect(stats(n, ENDLESS).mortarInterval).toBe(a.mortarInterval / 2);
    expect(stats(advance(n, 6.1), ENDLESS).mortarInterval).toBe(
      a.mortarInterval,
    );
  });
  it("introduces threats gradually and keeps every fifth wave a boss wave", () => {
    expect(new Set(waveEnemies(1, ENDLESS))).toEqual(new Set(["drone"]));
    expect(waveEnemies(2, ENDLESS)).toContain("runner");
    expect(waveEnemies(3, ENDLESS)).toContain("swarm");
    expect(waveEnemies(4, ENDLESS)).toContain("tank");
    expect(waveEnemies(5, ENDLESS)).toContain("boss");
    expect(waveEnemies(6, ENDLESS)).toContain("splitter");
    expect(waveEnemies(100, ENDLESS)).toContain("boss");
    expect(ENDLESS.waves).toBeNull();
  });
  it("rewards repeat runs, pays crossed milestones exactly once, and caps wave payouts", () => {
    expect([0, 5, 10, 20].map(endlessCredits)).toEqual([0, 18, 42, 110]);
    expect(endlessCredits(100000)).toBe(1800);
    expect(milestoneCredits(15, 0)).toBe(110);
    expect(milestoneCredits(15, 10)).toBe(55);
    expect(milestoneCredits(14, 15)).toBe(0);
    const run = { phase: "defeat" as const, cleared: 10, balanceVersion: 4 };
    expect(
      rewardBreakdown(run, ENDLESS, {
        campaign: {},
        challenges: {},
        bestWave: 5,
      }),
    ).toMatchObject({ waves: 42, bonus: 35, total: 77 });
    expect(
      rewardBreakdown(run, ENDLESS, {
        campaign: {},
        challenges: {},
        bestWave: 10,
      }).total,
    ).toBe(42);
  });
  it("restores delayed shells and rejects loadouts with hidden weapon upgrades", () => {
    localStorage.clear();
    const s = arena({ weapons: ["mortar"], module: "siphon" });
    s.enemies = [target(1, 100)];
    const shot = stepRun(s, ENDLESS);
    expect(saveCoreRun(shot, "loadout", "club")).toBe(true);
    expect(readCoreRun("loadout", "club")?.shells).toEqual(shot.shells);
    saveCoreRun(
      { ...shot, upgrades: { ...shot.upgrades, rail: 1 } },
      "loadout",
      "club",
    );
    expect(readCoreRun("loadout", "club")).toBeNull();
    saveCoreRun(
      { ...shot, loadout: { weapons: ["rail", "mortar"], module: null } },
      "loadout",
      "club",
    );
    expect(readCoreRun("loadout", "club")).toBeNull();
  });
});
