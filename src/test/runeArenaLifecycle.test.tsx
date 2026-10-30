import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RuneDelveEndlessPage from "@/pages/RuneDelveEndlessPage";
import { arenaStorageKey, type ArenaRun } from "@/lib/runedelve/arenaState";
import { initialCombat } from "@/lib/runedelve/combatEngine";
import { endlessScore } from "@/lib/runedelve/endlessMode";
import type { HeroClass } from "@/lib/runedelve/classConfig";

const state = vi.hoisted(() => ({
  userId: "alice",
  save: vi.fn(),
  priorRun: null as null | { kills_count: number },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: state.userId } }),
}));
vi.mock("@/hooks/useRuneDelveHero", () => ({
  useRuneDelveHero: () => ({
    data: { class: "warrior" },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/hooks/useDailyChallenge", () => ({
  useMyDailyRun: () => ({
    data: state.priorRun,
    isLoading: false,
    isError: false,
  }),
  useSubmitDailyRun: () => ({ mutateAsync: state.save }),
}));
vi.mock("@/components/runedelve/RuneBoard", () => ({
  RuneBoard: ({
    disabled,
    onChainComplete,
  }: {
    disabled: boolean;
    onChainComplete: (chain: { r: number; c: number }[]) => void;
  }) => (
    <button
      disabled={disabled}
      data-testid="arena-chain"
      onClick={() =>
        onChainComplete([
          { r: 0, c: 0 },
          { r: 0, c: 1 },
          { r: 0, c: 2 },
        ])
      }
    >
      Chain
    </button>
  ),
}));
vi.mock("@/components/runedelve/EnemyDisplay", () => ({
  EnemyDisplay: ({
    onInspectChange,
  }: {
    onInspectChange: (open: boolean) => void;
  }) => (
    <>
      <button onClick={() => onInspectChange(true)}>Inspect enemy</button>
      <button onClick={() => onInspectChange(false)}>Close enemy</button>
    </>
  ),
}));
vi.mock("@/components/runedelve/HeroStatusBar", () => ({
  HeroStatusBar: ({
    disabled,
    onAbility,
  }: {
    disabled: boolean;
    onAbility: () => void;
  }) => (
    <button disabled={disabled} onClick={onAbility}>
      Cast ability
    </button>
  ),
}));
vi.mock("@/components/runedelve/RuneArtwork", () => ({
  RuneHeroArt: () => <span>Hero</span>,
  RUNE_PORTAL_ART: "/portal.webp",
}));

function fresh(cls: HeroClass = "warrior"): ArenaRun {
  return {
    version: 1,
    requestId: "00000000-0000-4000-8000-000000000001",
    cls,
    seed: 42,
    tick: 0,
    grid: Array.from({ length: 5 }, () => Array(5).fill("red")),
    combat: initialCombat(
      [1, 2].map((id) => ({
        id: `foe-${id}`,
        name: `Foe ${id}`,
        emoji: "",
        hp: 200,
        maxHp: 200,
        damage: 4,
      })),
      9999,
    ),
    elapsed: 0,
    attackAt: 4.5,
    spawnAt: null,
    paused: false,
    savedAt: Date.now(),
    result: null,
  };
}
function put(run: ArenaRun, user = "alice") {
  sessionStorage.setItem(arenaStorageKey(user), JSON.stringify(run));
}
function checkpoint(user = "alice"): ArenaRun {
  return JSON.parse(sessionStorage.getItem(arenaStorageKey(user))!);
}
const view = () => (
  <MemoryRouter
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
  >
    <RuneDelveEndlessPage />
  </MemoryRouter>
);
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-30T23:59:50Z"));
  state.userId = "alice";
  state.priorRun = null;
  state.save.mockReset();
  state.save.mockResolvedValue({
    rewarded: true,
    reward: { shards: 25, xp: 0 },
    dateStr: "2026-10-30",
  });
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Daily arena lifecycle", () => {
  it("starts a fresh checkpoint when improving a previous daily result", () => {
    state.priorRun = { kills_count: 10 };
    render(view());
    expect(screen.getByText(/Best today: 10 slain/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Improve today's best/ }),
    );
    expect(checkpoint().elapsed).toBe(0);
    expect(checkpoint().result).toBeNull();
    expect(checkpoint().requestId).toMatch(/^[\da-f-]{36}$/);
    expect(state.save).not.toHaveBeenCalled();
  });
  it("counts active play, stops for inspection and header exit decisions, and restores paused", () => {
    put(fresh());
    render(view());
    expect(screen.getByText(/Arena paused/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Resume arena" })[0]);
    advance(1000);
    expect(checkpoint().elapsed).toBeCloseTo(1);
    fireEvent.click(screen.getByRole("button", { name: "Inspect enemy" }));
    const inspectedAt = checkpoint().elapsed;
    advance(5000);
    expect(checkpoint().elapsed).toBe(inspectedAt);
    expect(screen.getByTestId("arena-chain")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Close enemy" }));
    advance(500);
    expect(checkpoint().elapsed).toBeCloseTo(inspectedAt + 0.5);
    act(() => window.dispatchEvent(new Event("rune-delve:pause")));
    const pausedAt = checkpoint().elapsed;
    advance(5000);
    expect(checkpoint().elapsed).toBe(pausedAt);
    expect(checkpoint().paused).toBe(true);
  });

  it("pauses when backgrounded and preserves both the attack clock and board across remount", () => {
    put(fresh());
    const page = render(view());
    fireEvent.click(screen.getAllByRole("button", { name: "Resume arena" })[0]);
    advance(2000);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    const paused = checkpoint();
    advance(10000);
    expect(checkpoint()).toEqual(paused);
    page.unmount();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    render(view());
    expect(screen.getByText(/Arena paused/)).toBeInTheDocument();
    expect(checkpoint().grid).toEqual(paused.grid);
    expect(checkpoint().attackAt).toBe(paused.attackAt);
    fireEvent.click(screen.getAllByRole("button", { name: "Resume arena" })[0]);
    advance(2600);
    expect(checkpoint().combat.hp).toBe(92);
  });

  it.each(["warrior", "mage", "rogue", "cleric"] as const)(
    "commits the %s base ability without advancing the enemy clock",
    (cls) => {
      const run = fresh(cls);
      run.combat.mana = 3;
      run.combat.hp = 50;
      put(run);
      render(view());
      fireEvent.click(
        screen.getAllByRole("button", { name: "Resume arena" })[0],
      );
      fireEvent.click(screen.getByRole("button", { name: "Cast ability" }));
      const next = checkpoint();
      expect(next.combat.mana).toBe(cls === "rogue" ? 1 : 0);
      expect(next.elapsed).toBe(0);
      expect(next.attackAt).toBe(4.5);
      expect(next.combat.hp).toBe(cls === "cleric" ? 80 : 50);
      expect(next.combat.enemies.map((enemy) => enemy.hp)).toEqual(
        cls === "warrior"
          ? [160, 160]
          : cls === "mage"
            ? [120, 200]
            : cls === "cleric"
              ? [178, 178]
              : [200, 200],
      );
      expect(next.combat.shadowstepActive).toBe(cls === "rogue");
    },
  );

  it("retains the exact result request ID when a failed timeout save retries after midnight", async () => {
    const run = fresh();
    run.elapsed = 119.8;
    run.attackAt = 123;
    put(run);
    state.save.mockRejectedValueOnce(new Error("offline"));
    render(view());
    fireEvent.click(screen.getAllByRole("button", { name: "Resume arena" })[0]);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(
      screen.getByRole("button", { name: "Retry save" }),
    ).toBeInTheDocument();
    expect(checkpoint().result?.score).toBe(endlessScore(0, 0));
    vi.setSystemTime(new Date("2026-10-31T00:00:10Z"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    });
    expect(state.save).toHaveBeenCalledTimes(2);
    expect(state.save.mock.calls[0][0]).toEqual(state.save.mock.calls[1][0]);
    expect(state.save.mock.calls[1][0].requestId).toBe(run.requestId);
    expect(sessionStorage.getItem(arenaStorageKey("alice"))).toBeNull();
  });

  it("does not accept a stale receipt after switching Alice to Bob and back to Alice", async () => {
    const run = fresh();
    run.elapsed = 120;
    run.result = { reason: "timeout", kills: 0, score: 0 };
    put(run);
    let oldResolve!: (value: unknown) => void;
    let currentResolve!: (value: unknown) => void;
    state.save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          oldResolve = resolve;
        }),
    );
    state.save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          currentResolve = resolve;
        }),
    );
    const page = render(view());
    state.userId = "bob";
    page.rerender(view());
    state.userId = "alice";
    page.rerender(view());
    expect(state.save).toHaveBeenCalledTimes(2);
    await act(async () => {
      oldResolve({ rewarded: true, reward: { shards: 111, xp: 0 } });
    });
    expect(screen.queryByText(/111 shards/)).toBeNull();
    expect(sessionStorage.getItem(arenaStorageKey("alice"))).not.toBeNull();
    await act(async () => {
      currentResolve({ rewarded: true, reward: { shards: 25, xp: 0 } });
    });
    expect(screen.getByText(/25 shards/)).toBeInTheDocument();
  });

  it("warns when the current board cannot be checkpointed on this device", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    render(view());
    fireEvent.click(screen.getByRole("button", { name: /Begin arena/ }));
    expect(
      screen.getByText(/Device storage is unavailable/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause arena" }));
    expect(screen.queryByText(/your run is saved/)).toBeNull();
  });
});
