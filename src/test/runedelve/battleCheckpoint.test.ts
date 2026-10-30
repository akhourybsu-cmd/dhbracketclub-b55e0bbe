import { beforeEach, describe, expect, it } from "vitest";
import {
  buildSnapshot,
  loadSnapshot,
  saveSnapshot,
  SNAPSHOT_VERSION,
} from "@/lib/runedelve/runSnapshot";
import { generateBoard } from "@/lib/runedelve/dungeonGenerator";
import { initialCombat } from "@/lib/runedelve/combatEngine";
import { mulberry32 } from "@/lib/runedelve/prng";

function checkpoint() {
  return buildSnapshot({
    levelNumber: 56,
    generationSeed: 123,
    grid: generateBoard(mulberry32(123)),
    combat: {
      ...initialCombat([], 17),
      resonance: { colors: ["red", "gold"], bursts: 2 },
    },
    initialTurns: 19,
    seals: new Set(["0-1"]),
    corruption: { cells: new Set(["1-1"]), sources: new Set(["1-1"]) },
    log: [],
    lastStandUsed: 1,
    phoenixUsed: true,
    bonusUsedThisCycle: true,
    redChainCount: 4,
    chainCountTotal: 9,
    abilityUsedCount: 2,
    corruptCleansedCount: 3,
    defeatedArchetypes: new Map([["cave_bat", 2]]),
    wavesSpawned: 1,
    rngTick: 9,
    activeRelicsSnapshot: { ranks: new Map([["phoenix_heart", 2]]) },
    activeModifierId: "steady_path",
    shiftingColumn: 3,
    linkedPairs: [
      ["0-0", "4-4"],
      ["4-4", "0-0"],
    ],
    eclipsedCells: ["3-2"],
    chainsThisFight: 4,
    bonusShardsFromMastery: 9,
    bonusShardsFromTreasure: 10,
    bonusScoreFromTreasure: 150,
    totalManaSpent: 5,
    goldRunesCleared: 11,
    braceFired: true,
    aegisFired: true,
    tookDamage: true,
    masteryIds: ["warrior_t4_panic_shield"],
    bossPhases: [["boss-1", 3]],
  });
}

beforeEach(() => sessionStorage.clear());

describe("complete Rune Delve battle checkpoints", () => {
  it("round trips board mechanics, pending rewards, and spent one-use powers", () => {
    const original = checkpoint();
    saveSnapshot("checkpoint", original);
    const loaded = loadSnapshot("checkpoint", 123);
    expect(loaded).toEqual(original);
    expect(loaded?.version).toBe(SNAPSHOT_VERSION);
    expect(loaded?.combat.resonance).toEqual({
      colors: ["red", "gold"],
      bursts: 2,
    });
    expect(loaded?.linkedPairs).toEqual([
      ["0-0", "4-4"],
      ["4-4", "0-0"],
    ]);
    expect(loaded?.bonusShardsFromTreasure).toBe(10);
    expect(loaded?.aegisFired).toBe(true);
    expect(loaded?.bossPhases).toEqual([["boss-1", 3]]);
  });

  it("rejects old incomplete checkpoints and malformed grids without crashing", () => {
    const old = { ...checkpoint(), version: SNAPSHOT_VERSION - 1 };
    sessionStorage.setItem("checkpoint", JSON.stringify(old));
    expect(loadSnapshot("checkpoint", 123)).toBeNull();
    sessionStorage.setItem(
      "checkpoint",
      JSON.stringify({ ...checkpoint(), grid: [["purple"]] }),
    );
    expect(loadSnapshot("checkpoint", 123)).toBeNull();
    sessionStorage.setItem(
      "checkpoint",
      JSON.stringify({ ...checkpoint(), combat: { hp: null } }),
    );
    expect(loadSnapshot("checkpoint", 123)).toBeNull();
  });
});
