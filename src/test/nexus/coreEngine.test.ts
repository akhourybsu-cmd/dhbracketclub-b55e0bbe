import { describe, expect, it, beforeEach } from "vitest";
import {
  CAMPAIGN,
  CHALLENGES,
  ENDLESS,
  ENEMIES,
} from "@/lib/nexus/core/catalog";
import {
  activateAbility,
  buyUpgrade,
  createRun,
  distance,
  isFinished,
  startWave,
  stats,
  stepRun,
  waveEnemies,
} from "@/lib/nexus/core/engine";
import { readCoreRun, saveCoreRun } from "@/lib/nexus/core/persistence";
import type {
  CoreEnemy,
  CoreRun,
  CoreScenario,
  EnemyType,
  UpgradeId,
} from "@/lib/nexus/core/types";

function enemy(kind: EnemyType, x: number, y: number, id = 100): CoreEnemy {
  return {
    ...ENEMIES[kind],
    id,
    kind,
    x,
    y,
    maxHp: ENEMIES[kind].hp,
    attackCd: 0,
    slowed: 0,
  };
}
function battle(scenario = ENDLESS) {
  const s = startWave(createRun(scenario, {}, "test", 19), scenario);
  delete s.loadout;
  s.balanceVersion = 3;
  s.toSpawn = [];
  s.spawnCd = 999;
  s.fireCd = 999;
  return s;
}
function simulate(scenario: CoreScenario, invest = true, research = {}) {
  let s = startWave(createRun(scenario, research, "balance", 42), scenario);
  delete s.loadout;
  s.balanceVersion = 3;
  // A simple mobile-player policy: alternate offense, defenses and utility.
  const plan: UpgradeId[] = [
    "damage",
    "haste",
    "damage",
    "multishot",
    "hull",
    "haste",
    "orbit",
    "damage",
    "shield",
    "income",
    "haste",
    "regen",
    "damage",
    "multishot",
    "range",
    "hull",
    "frost",
    "critical",
    "haste",
    "damage",
    "orbit",
    "armor",
    "shield",
    "regen",
  ];
  let cursor = 0;
  for (let i = 0; i < 24000 && !isFinished(s); i++) {
    if (invest) {
      if (s.hp < stats(s, scenario).maxHp * 0.55)
        s = buyUpgrade(s, scenario, "hull");
      const upgraded = buyUpgrade(s, scenario, plan[cursor % plan.length]);
      if (upgraded !== s) {
        s = upgraded;
        cursor++;
      }
      // A restricted challenge cannot block the rest of the upgrade plan.
      else if (
        (scenario.rule === "glass" &&
          ["hull", "shield", "regen", "armor"].includes(
            plan[cursor % plan.length],
          )) ||
        (scenario.rule === "blackout" && plan[cursor % plan.length] === "regen")
      )
        cursor++;
      if (s.enemies.some((e) => distance(e) < 140))
        s = activateAbility(s, scenario, "nova");
      if (s.enemies.some((e) => e.kind === "boss" && distance(e) < 220))
        s = activateAbility(s, scenario, "overdrive");
    }
    s = stepRun(s, scenario);
  }
  return s;
}

describe("central core combat", () => {
  it("moves enemies from every quadrant directly toward the core at distinct speeds", () => {
    const s = battle();
    s.enemies = [
      enemy("drone", 300, 300, 1),
      enemy("runner", -300, 300, 2),
      enemy("tank", 300, -300, 3),
      enemy("drone", -300, -300, 4),
    ];
    const next = stepRun(s, ENDLESS);
    for (let i = 0; i < 4; i++)
      expect(distance(next.enemies[i])).toBeLessThan(distance(s.enemies[i]));
    expect(distance(s.enemies[1]) - distance(next.enemies[1])).toBeGreaterThan(
      distance(s.enemies[2]) - distance(next.enemies[2]),
    );
    expect(next.enemies[0].x).toBeCloseTo(next.enemies[0].y);
    expect(s.enemies[0].x).toBe(300); // transitions do not mutate checkpoints
  });
  it("absorbs damage with shield first and keeps enemies attacking at the core", () => {
    const s = battle();
    s.shield = 5;
    s.enemies = [enemy("tank", 40, 0)];
    const n = stepRun(s, ENDLESS);
    expect(n.shield).toBe(0);
    expect(n.hp).toBeLessThan(s.hp);
    expect(n.enemies).toHaveLength(1);
    let next = n;
    for (let i = 0; i < 25; i++) next = stepRun(next, ENDLESS);
    expect(next.hp).toBeLessThan(n.hp);
  });
  it("stops at the first lethal breach, including a one-hit glass core", () => {
    const glass = CHALLENGES.find((s) => s.id === "glass")!;
    const s = battle(glass);
    s.enemies = [enemy("drone", 35, 0)];
    expect(s.hp).toBe(1);
    expect(s.shield).toBe(0);
    const next = stepRun(s, glass);
    expect(next.phase).toBe("defeat");
    expect(stepRun(next, glass)).toBe(next);
    for (const id of ["hull", "shield", "regen", "armor"] as const)
      expect(buyUpgrade(s, glass, id)).toBe(s);
  });
  it("tracks projectile targets and does not fire outside detection range", () => {
    const s = battle();
    s.fireCd = 0;
    s.enemies = [enemy("drone", 400, 0)];
    expect(stepRun(s, ENDLESS).projectiles).toHaveLength(0);
    s.enemies[0].x = 180;
    let n = stepRun(s, ENDLESS);
    expect(n.projectiles).toHaveLength(1);
    for (let i = 0; i < 10; i++) n = stepRun(n, ENDLESS);
    expect(n.enemies[0].hp).toBeLessThan(s.enemies[0].hp);
  });
  it("applies purchases once, caps upgrades, and never spends unavailable energy", () => {
    const s = battle();
    const n = buyUpgrade(s, ENDLESS, "damage");
    expect(n.energy).toBe(52);
    expect(n.upgrades.damage).toBe(1);
    expect(buyUpgrade(n, ENDLESS, "multishot")).toBe(n);
    const max = { ...s, energy: 10000, upgrades: { damage: 10 } };
    expect(buyUpgrade(max, ENDLESS, "damage")).toBe(max);
  });
  it("nova knocks back close enemies, ignores distant enemies, and respects cooldown", () => {
    const s = battle();
    s.enemies = [
      { ...enemy("tank", 100, 0, 1), hp: 500 },
      enemy("drone", 400, 0, 2),
    ];
    const n = activateAbility(s, ENDLESS, "nova");
    expect(n.enemies[0].x).toBe(165);
    expect(n.enemies[0].hp).toBe(435);
    expect(n.enemies[1].hp).toBe(s.enemies[1].hp);
    expect(activateAbility(n, ENDLESS, "nova")).toBe(n);
  });
  it("does not clear a wave before a splitter’s children are defeated", () => {
    const s = battle();
    s.enemies = [{ ...enemy("splitter", 100, 0), hp: 1 }];
    const n = activateAbility(s, ENDLESS, "nova");
    expect(n.enemies).toHaveLength(3);
    expect(n.enemies.every((e) => e.kind === "swarm")).toBe(true);
    expect(stepRun(n, ENDLESS).phase).toBe("wave");
  });
  it("has uncapped endless waves and a boss cadence beyond the old campaign limit", () => {
    expect(waveEnemies(35, ENDLESS)).toContain("boss");
    const s = battle();
    s.wave = 31;
    const n = stepRun(s, ENDLESS);
    expect(n.cleared).toBe(31);
    expect(n.phase).toBe("intermission");
    expect(startWave(n, ENDLESS).wave).toBe(32);
  });
  it("disables repair and shield recharge during Blackout", () => {
    const scenario = CHALLENGES.find((s) => s.id === "blackout")!;
    const s = battle(scenario);
    s.upgrades = { regen: 5 };
    s.hp = 50;
    s.shield = 0;
    s.enemies = [enemy("drone", 400, 0)];
    const n = stepRun(s, scenario);
    expect(n.hp).toBe(50);
    expect(n.shield).toBe(0);
  });
  it("replays identically after JSON checkpoint restoration", () => {
    let a = startWave(createRun(ENDLESS, {}, "same", 42), ENDLESS);
    for (let i = 0; i < 200; i++) a = stepRun(a, ENDLESS);
    let b = JSON.parse(JSON.stringify(a)) as CoreRun;
    for (let i = 0; i < 200; i++) {
      a = stepRun(a, ENDLESS);
      b = stepRun(b, ENDLESS);
    }
    expect(b).toEqual(a);
  });
});

describe("campaign balance", () => {
  it("allows a fresh nexus to finish its first sector with a basic upgrade plan", () => {
    const s = simulate(CAMPAIGN[0]);
    expect(s.phase, `cleared ${s.cleared} waves, ${s.kills} kills`).toBe(
      "victory",
    );
  });
  it("makes upgrades matter in endless survival", () => {
    const base = simulate(ENDLESS, false);
    const built = simulate(ENDLESS);
    expect(base.phase).toBe("defeat");
    expect(built.cleared).toBeGreaterThan(base.cleared);
  });
});

describe("versioned, account-scoped checkpoints", () => {
  beforeEach(() => localStorage.clear());
  it("keeps player and club saves separate and rejects the old engine format", () => {
    const s = createRun(ENDLESS, {}, "saved", 123);
    saveCoreRun(s, "alice", "club-a");
    expect(readCoreRun("alice", "club-a")).toEqual(s);
    expect(readCoreRun("bob", "club-a")).toBeNull();
    expect(readCoreRun("alice", "club-b")).toBeNull();
    localStorage.setItem(
      "nexus_core_run_v2:alice:club-a",
      JSON.stringify({ version: 1 }),
    );
    expect(readCoreRun("alice", "club-a")).toBeNull();
  });
  it("survives malformed storage", () => {
    localStorage.setItem("nexus_core_run_v2:alice:club-a", "{bad json");
    expect(readCoreRun("alice", "club-a")).toBeNull();
  });
});
