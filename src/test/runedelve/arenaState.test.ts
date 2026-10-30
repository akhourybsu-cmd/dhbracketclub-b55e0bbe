import { describe, expect, it } from "vitest";
import { initialCombat } from "@/lib/runedelve/combatEngine";
import {
  arenaStorageKey,
  advanceArenaClock,
  spawnArenaEnemies,
  ARENA_SAVE_MAX_AGE_MS,
  parseArenaRun,
  previewArenaChain,
  type ArenaRun,
} from "@/lib/runedelve/arenaState";
import { endlessScore } from "@/lib/runedelve/endlessMode";

const now = Date.UTC(2026, 9, 30, 23, 59, 50);
const fresh = (): ArenaRun => ({
  version: 1,
  requestId: "00000000-0000-4000-8000-000000000001",
  cls: "rogue",
  seed: 1234,
  tick: 0,
  grid: Array.from({ length: 5 }, () => Array(5).fill("red")),
  combat: initialCombat(
    [
      {
        id: "front",
        name: "Sentinel",
        emoji: "💀",
        hp: 200,
        maxHp: 200,
        damage: 4,
      },
    ],
    9999,
  ),
  elapsed: 0,
  attackAt: 4.5,
  spawnAt: null,
  paused: false,
  savedAt: now,
  result: null,
});
const parse = (run: unknown, at = now) =>
  parseArenaRun(JSON.stringify(run), at);

describe("Rune Delve · daily arena checkpoints", () => {
  it("restores a valid board paused with its resonance and primed ability intact across midnight", () => {
    const run = fresh();
    run.combat.shadowstepActive = true;
    run.combat.resonance = { colors: ["blue", "green", "gold"], bursts: 3 };
    const restored = parse(run, now + 30_000);
    expect(restored?.paused).toBe(true);
    expect(restored?.combat).toEqual(run.combat);
    expect(arenaStorageKey("member")).toBe("rd-arena-v1:member");
    expect(arenaStorageKey("member")).not.toBe(
      arenaStorageKey("another-member"),
    );
  });

  it("rejects malformed rows, cells, enemies and missing combat fields before rendering", () => {
    const run = fresh();
    expect(parse({ ...run, grid: [null, null, null, null, null] })).toBeNull();
    expect(parse({ ...run, grid: [["red"]] })).toBeNull();
    expect(
      parse({ ...run, grid: run.grid.map((row) => row.map(() => "purple")) }),
    ).toBeNull();
    expect(parse({ ...run, combat: { enemies: [] } })).toBeNull();
    expect(
      parse({ ...run, combat: { ...run.combat, enemies: [{ id: "enemy" }] } }),
    ).toBeNull();
    expect(parseArenaRun("{bad JSON")).toBeNull();
  });

  it("rejects negative, overflowing, future and stale state rather than trapping the arena", () => {
    const run = fresh();
    expect(parse({ ...run, elapsed: -1 })).toBeNull();
    expect(parse({ ...run, attackAt: -1 })).toBeNull();
    expect(parse({ ...run, combat: { ...run.combat, mana: 4 } })).toBeNull();
    expect(parse({ ...run, combat: { ...run.combat, hp: -1 } })).toBeNull();
    expect(
      parse({
        ...run,
        combat: {
          ...run.combat,
          resonance: { colors: ["red", "red"], bursts: 1 },
        },
      }),
    ).toBeNull();
    expect(
      parse({ ...run, savedAt: now - ARENA_SAVE_MAX_AGE_MS - 1 }),
    ).toBeNull();
    expect(parse({ ...run, savedAt: now + 60_001 })).toBeNull();
    expect(parse({ ...run, savedAt: undefined })).toBeNull();
    expect(parse({ ...run, requestId: undefined })).toBeNull();
  });

  it("restores only a result that agrees with its final combat state", () => {
    const run = fresh();
    run.combat.enemiesDefeated = 7;
    run.combat.totalDamage = 450;
    run.elapsed = 120;
    run.result = { reason: "timeout", kills: 7, score: endlessScore(7, 450) };
    expect(parse(run)?.result).toEqual(run.result);
    expect(parse({ ...run, result: { ...run.result, kills: 8 } })).toBeNull();
    expect(parse({ ...run, result: { ...run.result, score: 1 } })).toBeNull();
    expect(parse({ ...run, result: null })).toBeNull();
  });
});

describe("Rune Delve · honest arena previews", () => {
  it("includes primed Shadowstep, enemy armor and actual overkill in the displayed damage", () => {
    const run = fresh();
    run.combat.shadowstepActive = true;
    run.combat.enemies[0].armor = 4;
    const before = JSON.stringify(run);
    expect(previewArenaChain(run, "red", 3).damage).toBe(56);
    expect(JSON.stringify(run)).toBe(before);
    run.combat.enemies[0].hp = 10;
    expect(previewArenaChain(run, "red", 3).text).toBe("10 dmg");
  });

  it("shows Convergence area damage and the exact mana/guard gains at their caps", () => {
    const run = fresh();
    run.combat.mana = 3;
    run.combat.shieldTurns = 11;
    run.combat.resonance = { colors: ["red", "blue", "green"], bursts: 0 };
    const preview = previewArenaChain(run, "gold", 3);
    expect(preview.damage).toBe(20);
    expect(preview.mana).toBe(0);
    expect(preview.guard).toBe(1);
    expect(preview.burst).toBe(true);
    expect(preview.next.resonance).toEqual({ colors: [], bursts: 1 });
    expect(preview.next.shieldTurns).toBe(12);
  });

  it("does not promise full starting guard on an already guarded hero or over-cap healing", () => {
    const run = fresh();
    run.combat.shieldTurns = 4;
    expect(previewArenaChain(run, "gold", 3).guard).toBe(1);
    run.combat.hp = 96;
    expect(previewArenaChain(run, "green", 5).healing).toBe(4);
  });
});

describe("Rune Delve · active Arena pressure", () => {
  it("keeps paused and finished clocks still and bounds background catch-up", () => {
    const run = fresh();
    expect(advanceArenaClock({ ...run, paused: true }, 10).elapsed).toBe(0);
    expect(advanceArenaClock(run, Number.NaN)).toBe(run);
    expect(advanceArenaClock(run, -1)).toBe(run);
    expect(advanceArenaClock(run, 30).elapsed).toBe(1);
    const finished = {
      ...run,
      elapsed: 120,
      result: { reason: "timeout" as const, kills: 0, score: 0 },
    };
    expect(advanceArenaClock(finished, 1)).toBe(finished);
  });

  it("applies guard and class reflection at the actual attack tick", () => {
    for (const [cls, reflected] of [
      ["warrior", 8],
      ["cleric", 5],
    ] as const) {
      const run = fresh();
      run.cls = cls;
      run.elapsed = 4;
      run.combat.shieldTurns = 1;
      run.combat.enemies[0].damage = 20;
      const before = JSON.stringify(run);
      const next = advanceArenaClock(run, 0.5);
      expect(next.combat.hp).toBe(92);
      expect(next.combat.shieldTurns).toBe(0);
      expect(next.combat.enemies[0].hp).toBe(200 - reflected);
      expect(next.combat.totalDamage).toBe(reflected);
      expect(next.attackAt).toBe(9);
      expect(JSON.stringify(run)).toBe(before);
    }
  });

  it("spawns after the respawn delay and records a final result", () => {
    const run = fresh();
    run.combat.enemies[0].hp = 0;
    const cleared = advanceArenaClock(run, 0.1);
    expect(cleared.spawnAt).toBeCloseTo(0.7);
    const next = advanceArenaClock(cleared, 0.6);
    expect(next.tick).toBe(1);
    expect(next.spawnAt).toBeNull();
    expect(
      next.combat.enemies.every((enemy) => enemy.hp > 0 && !enemy.ability),
    ).toBe(true);
    const timed = advanceArenaClock({ ...next, elapsed: 119.5 }, 0.5);
    expect(timed.result).toEqual({ reason: "timeout", kills: 0, score: 0 });
  });

  it("rewards a long red chain through the same tier calculation used for the hit", () => {
    const run = fresh();
    run.cls = "warrior";
    expect(previewArenaChain(run, "red", 5).damage).toBe(60);
    expect(previewArenaChain(run, "red", 8).damage).toBe(134);
  });

  it("keeps the final field bounded without stacking promoted elites", () => {
    for (let seed = 0; seed < 300; seed++) {
      const field = spawnArenaEnemies(95, seed);
      expect(field.length).toBeGreaterThanOrEqual(2);
      expect(field.length).toBeLessThanOrEqual(3);
      expect(field.filter((enemy) => enemy.tier).length).toBeLessThanOrEqual(1);
      expect(field.every((enemy) => enemy.maxHp <= 298 && !enemy.ability)).toBe(
        true,
      );
    }
  });
});
