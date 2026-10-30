import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RuneDelvePlayPage from "@/pages/RuneDelvePlayPage";
import {
  buildSnapshot,
  loadSnapshot,
  saveSnapshot,
  snapshotKey,
} from "@/lib/runedelve/runSnapshot";
import { initialCombat, type CombatState } from "@/lib/runedelve/combatEngine";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import type { Enemy, RuneType } from "@/lib/runedelve/dungeonGenerator";
import { calculateScore } from "@/lib/runedelve/scoring";
import {
  TREASURE_SCORE_BONUS,
  TREASURE_SHARD_BONUS,
} from "@/lib/runedelve/layoutZones";

const fixture = vi.hoisted(() => ({
  heroClass: "rogue" as HeroClass,
  combat: null as CombatState | null,
  enemies: [] as Enemy[],
  submit: vi.fn(),
}));
const enemy: Enemy = {
  id: "e0",
  name: "Cave Bat",
  emoji: "🦇",
  hp: 1,
  maxHp: 1,
  damage: 4,
  archetypeId: "cave_bat",
};
const level = {
  id: "level-101",
  level_number: 101,
  generation_seed: 123,
  turn_limit: 10,
  enemy_config: [enemy],
  objective_type: "defeat_all",
  objective_target: 0,
  modifiers: { mechanics: ["multi_objective"], secondary_objective: null },
};
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "player" } }),
}));
vi.mock("@/hooks/useRuneDelveHero", () => ({
  useRuneDelveHero: () => ({
    data: { class: fixture.heroClass, level: 100, total_xp: 0 },
  }),
}));
vi.mock("@/hooks/useRuneDelveClassProgress", () => ({
  useAllClassProgress: () => ({
    data: [{ class: fixture.heroClass, level: 100 }],
    isLoading: false,
  }),
}));
vi.mock("@/hooks/useRuneDelveCampaign", () => ({
  useLevel: () => ({ data: level }),
  useMyLevelRun: () => ({ data: null }),
  useMyProgress: () => ({ data: { highest_unlocked_level: 150 } }),
  useSubmitLevelRun: () => ({ mutateAsync: fixture.submit }),
}));
vi.mock("@/hooks/useLoadout", () => ({
  useLoadout: () => ({ data: {}, isLoading: false }),
}));
vi.mock("@/hooks/useRuneShards", () => ({
  useRuneWallet: () => ({ data: { balance: 0 } }),
  useFailureRow: () => ({ data: { failure_count: 0 } }),
}));
vi.mock("@/hooks/useRelicCollection", () => ({
  useRelicCollection: () => ({ data: [], isLoading: false }),
  rankMapFromOwned: () => new Map(),
  useUnlockRelic: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/useBestiary", () => ({
  useRecordDefeats: () => ({
    mutateAsync: async () => ({ newlyDiscovered: [] }),
  }),
}));
vi.mock("@/hooks/useDailyChallenge", () => ({ useSubmitDailyRun: () => ({}) }));
vi.mock("@/hooks/useQuests", () => ({ useActiveQuests: () => ({ data: [] }) }));
vi.mock("@/hooks/useSoundEffect", () => ({
  useSoundEffect: () => ({ play: vi.fn() }),
}));
vi.mock("@/hooks/useRuneDelveSfx", () => ({
  useRuneDelveSfx: () => ({ play: vi.fn() }),
}));
vi.mock("@/hooks/useFxQueue", () => ({
  useFxQueue: () => ({ queue: [], trigger: vi.fn(), complete: vi.fn() }),
}));
vi.mock("@/components/runedelve/fx/FxLayer", () => ({ FxLayer: () => null }));
vi.mock("@/components/runedelve/fx/FloatingNumber", () => ({
  FloatingNumberLayer: () => null,
  useFloaters: () => ({ floaters: [], addAt: vi.fn(), complete: vi.fn() }),
}));
vi.mock("@/components/runedelve/MechanicIntroSheet", () => ({
  MechanicIntroSheet: () => null,
}));
vi.mock("@/components/runedelve/RuneBoard", () => ({
  RuneBoard: ({
    onChainComplete,
    disabled,
  }: {
    onChainComplete: (chain: { r: number; c: number }[]) => void;
    disabled: boolean;
  }) => (
    <button
      disabled={disabled}
      onClick={() =>
        onChainComplete([
          { r: 0, c: 0 },
          { r: 0, c: 1 },
          { r: 0, c: 2 },
        ])
      }
    >
      Test chain
    </button>
  ),
}));
vi.mock("@/components/runedelve/HeroStatusBar", () => ({
  HeroStatusBar: ({
    state,
    onAbility,
    disabled,
  }: {
    state: CombatState;
    onAbility: () => void;
    disabled: boolean;
  }) => {
    fixture.combat = state;
    return (
      <button disabled={disabled} onClick={onAbility}>
        Test ability
      </button>
    );
  },
}));
vi.mock("@/components/runedelve/EnemyDisplay", () => ({
  EnemyDisplay: ({ enemies }: { enemies: Enemy[] }) => {
    fixture.enemies = enemies;
    return null;
  },
}));
vi.mock("@/lib/runedelve/layoutZones", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/runedelve/layoutZones")>()),
  computeLayoutZones: () => ({
    treasure: new Set(["0-0", "0-1", "0-2"]),
    hazard: new Set(),
  }),
}));
vi.mock("@/lib/runedelve/relicDrops", () => ({ rollRelicDrop: () => null }));

function checkpoint(type: RuneType, state: CombatState, extras = {}) {
  const grid: RuneType[][] = Array.from({ length: 5 }, () =>
    Array<RuneType>(5).fill(type),
  );
  const saved = buildSnapshot({
    levelNumber: 101,
    generationSeed: 123,
    grid,
    combat: state,
    initialTurns: 10,
    seals: new Set(),
    corruption: { cells: new Set(), sources: new Set() },
    log: [],
    lastStandUsed: 0,
    phoenixUsed: false,
    bonusUsedThisCycle: false,
    redChainCount: 0,
    chainCountTotal: 0,
    abilityUsedCount: 0,
    corruptCleansedCount: 0,
    defeatedArchetypes: new Map(),
    wavesSpawned: 0,
    rngTick: 0,
    activeRelicsSnapshot: null,
    activeModifierId: "steady_path",
    ...extras,
  });
  saveSnapshot(snapshotKey("player", level.id, fixture.heroClass), saved);
}

function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/rune-delve/play/101"]}>
        <Routes>
          <Route
            path="/rune-delve/play/:levelNumber"
            element={<RuneDelvePlayPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: vi.fn(() => "pending-receipt-123"),
  });
  fixture.heroClass = "rogue";
  fixture.combat = null;
  fixture.enemies = [];
  fixture.submit
    .mockReset()
    .mockResolvedValue({
      wasNewBest: true,
      shardsAwarded: 10,
      xpAwarded: 0,
      improvedChain: false,
      improvedTurns: false,
      improvedHp: false,
      firstClear: true,
    });
});
afterEach(cleanup);

describe("campaign production action settlement", () => {
  it("includes the winning chain's treasure, mastery shards and gold-rune score, and freezes them for retry", async () => {
    checkpoint("gold", initialCombat([enemy], 10), {
      masteryIds: ["rogue_t1_gold_score", "rogue_t5_master_thief"],
    });
    fixture.submit.mockRejectedValueOnce(new Error("Retry this result"));
    const firstMount = mount();
    fireEvent.click(screen.getByRole("button", { name: "Test chain" }));
    await waitFor(() => expect(fixture.submit).toHaveBeenCalledTimes(1));
    const input = fixture.submit.mock.calls[0][0];
    expect(input.reward_context).toMatchObject({
      treasure_shards: 3 * TREASURE_SHARD_BONUS,
      mastery_shards: 1,
    });
    const final = fixture.combat!;
    const base = calculateScore({
      totalDamage: final.totalDamage,
      enemiesDefeated: final.enemiesDefeated,
      hpRemaining: final.hp,
      turnsRemaining: final.turnsRemaining,
      longestChain: final.longestChain,
      cleared: true,
    }).total;
    expect(input.score).toBe(base + 6 + 3 * TREASURE_SCORE_BONUS);
    const key = snapshotKey("player", level.id, fixture.heroClass);
    expect(loadSnapshot(key, 123)?.pendingSettlement?.input).toEqual(input);
    expect(loadSnapshot(key, 123)?.combat).toEqual(final);
    firstMount.unmount();
    mount();
    expect(fixture.submit).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Test chain", hidden: true }),
    ).toBeDisabled();
    fireEvent.click(await screen.findByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(fixture.submit).toHaveBeenCalledTimes(2));
    expect(fixture.submit.mock.calls[1][0]).toEqual(input);
    expect(loadSnapshot(key, 123)).toBeNull();
  });

  it("counts a finishing ability and applies Bloodbond without spending a turn", async () => {
    fixture.heroClass = "mage";
    checkpoint(
      "blue",
      { ...initialCombat([{ ...enemy, tier: "boss" }], 10), hp: 50, mana: 3 },
      {
        activeRelicsSnapshot: { ranks: new Map([["bloodbond", 5]]) },
        masteryIds: [],
      },
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Test ability" }));
    await waitFor(() => expect(fixture.submit).toHaveBeenCalledOnce());
    expect(fixture.submit.mock.calls[0][0]).toMatchObject({
      hp_remaining: 58,
      turns_used: 0,
      quest_context: { abilities_used: 1, bosses_defeated: 1 },
    });
  });

  it("resumes an awakened boss without multiplying its damage a second time", async () => {
    const phasedBoss: Enemy = {
      ...enemy,
      id: "boss",
      tier: "boss",
      hp: 60,
      maxHp: 100,
      damage: 12,
    };
    checkpoint("green", initialCombat([phasedBoss], 10), {
      bossPhases: [["boss", 2]],
      masteryIds: [],
    });
    mount();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Test chain" })),
    );
    expect(fixture.enemies[0].damage).toBe(12);
    expect(fixture.combat?.hp).toBe(88);
    expect(fixture.submit).not.toHaveBeenCalled();
  });

  it("restores a failed zero-HP result for settlement instead of starting a new board", async () => {
    checkpoint(
      "green",
      {
        ...initialCombat([{ ...enemy, hp: 500, maxHp: 500, damage: 100 }], 10),
        hp: 1,
      },
      { masteryIds: [] },
    );
    fixture.submit.mockRejectedValueOnce(new Error("Response lost"));
    const firstMount = mount();
    fireEvent.click(screen.getByRole("button", { name: "Test chain" }));
    await screen.findByRole("button", { name: "Retry save" });
    const input = fixture.submit.mock.calls[0][0];
    expect(input.hp_remaining).toBe(0);
    const key = snapshotKey("player", level.id, fixture.heroClass);
    expect(loadSnapshot(key, 123)?.pendingSettlement?.input.request_id).toBe(
      input.request_id,
    );
    firstMount.unmount();
    mount();
    expect(screen.getByRole("heading", { name: "Defeated" })).toBeVisible();
    expect(fixture.combat?.hp).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(fixture.submit).toHaveBeenCalledTimes(2));
    expect(fixture.submit.mock.calls[1][0]).toEqual(input);
    expect(loadSnapshot(key, 123)).toBeNull();
  });
});
