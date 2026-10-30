import { describe, expect, it } from "vitest";
import { initialCombat } from "@/lib/runedelve/combatEngine";
import {
  arenaStorageKey,
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
    expect(previewArenaChain(run, "red", 3).damage).toBe(64);
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
