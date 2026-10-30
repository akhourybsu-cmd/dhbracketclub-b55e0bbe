/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: "player",
  club: "club-a",
  rows: {} as Record<string, any[]>,
  error: null as null | { message: string },
  requests: [] as any[],
  rpc: vi.fn(),
}));
function from(table: string) {
  const filters: ((row: any) => boolean)[] = [];
  let single = false;
  const q = {
    select: () => q,
    eq: (key: string, value: unknown) => {
      filters.push((row) => row[key] === value);
      return q;
    },
    in: (key: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[key]));
      return q;
    },
    order: () => q,
    limit: () => q,
    maybeSingle: () => {
      single = true;
      return q;
    },
    single: () => {
      single = true;
      return q;
    },
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => {
      state.requests.push({ table });
      const rows = (state.rows[table] ?? []).filter((row) =>
        filters.every((filter) => filter(row)),
      );
      return Promise.resolve({
        data: state.error ? null : single ? (rows[0] ?? null) : rows,
        error: state.error,
      }).then(resolve, reject);
    },
  };
  return q;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rest: {}, rpc: state.rpc, from },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: state.user } }),
}));
vi.mock("@/contexts/ClubContext", () => ({
  useClub: () => ({ club: { id: state.club } }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { supabase as client } from "@/integrations/supabase/client";
import { runeRequest, runeRpc } from "@/lib/runedelve/request";
import { useSubmitDailyRun } from "@/hooks/useDailyChallenge";
import { useUpdateLoadout } from "@/hooks/useLoadout";
import { useLoadout } from "@/hooks/useLoadout";
import {
  useCampaignLeaderboard,
  useSubmitLevelRun,
  type SubmitLevelRunInput,
} from "@/hooks/useRuneDelveCampaign";
import { usePurchaseRelicUpgrade } from "@/hooks/useRelicCollection";
import { useRuneActionIds } from "@/lib/runedelve/useRuneActionIds";

function wrapper() {
  const query = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={query}>{children}</QueryClientProvider>
  );
}
const input: SubmitLevelRunInput = {
  level_id: "level-id",
  level_number: 1,
  score: 1000,
  enemies_defeated: 1,
  dungeon_cleared: true,
  turns_used: 3,
  total_damage: 100,
  longest_chain: 5,
  hp_remaining: 90,
  xp_earned: 53,
  ability_used: false,
  hero_class: "warrior",
};
const saved = {
  row: { id: "saved-run" },
  wasNewBest: true,
  shardsAwarded: 16,
  xpAwarded: 53,
};

beforeEach(() => {
  state.user = "player";
  state.club = "club-a";
  state.rows = {};
  state.error = null;
  state.requests = [];
  state.rpc.mockReset();
  sessionStorage.clear();
  let id = 0;
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: vi.fn(() => `uuid-${++id}`),
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Rune Delve reliable persistence", () => {
  it("turns a hung request into a recoverable error", async () => {
    vi.useFakeTimers();
    const result = runeRequest(new Promise(() => {}), "Load hero");
    const rejection = expect(result).rejects.toThrow("Load hero timed out");
    await vi.advanceTimersByTimeAsync(12_000);
    await rejection;
  });

  it("preserves the Supabase receiver and converts synchronous RPC failures", async () => {
    state.rpc.mockImplementation(function (this: typeof client) {
      expect(this).toBe(client);
      throw new Error("Synchronous failure");
    });
    await expect(runeRpc("rune_delve_save_run", {})).rejects.toThrow(
      "Synchronous failure",
    );
  });

  it("does not silently turn a loadout query error into empty equipment", async () => {
    state.error = { message: "Network unavailable" };
    const { result } = renderHook(() => useLoadout("mage"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("scopes standings to verified public members and invalidates identity when changing clubs", async () => {
    state.rows.rune_delve_progress = [
      { id: "one", user_id: "alex", highest_completed_level: 30 },
      { id: "two", user_id: "beth", highest_completed_level: 20 },
      { id: "test", user_id: "private-testing", highest_completed_level: 1000 },
    ];
    state.rpc.mockImplementation(async (name, args) => ({
      data:
        name === "dh_presence_directory"
          ? [{ id: args.p_club_id === "club-a" ? "alex" : "beth" }]
          : null,
      error: null,
    }));
    const { result, rerender } = renderHook(() => useCampaignLeaderboard(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.data?.[0]?.user_id).toBe("alex"));
    expect(result.current.data).toHaveLength(1);
    state.club = "club-b";
    rerender();
    await waitFor(() => expect(result.current.data?.[0]?.user_id).toBe("beth"));
    expect(result.current.data).toHaveLength(1);
    expect(
      result.current.data?.some((row) => row.user_id === "private-testing"),
    ).toBe(false);
  });

  it("reuses the same run receipt after uncertain failure, then starts a fresh acknowledged action", async () => {
    state.rpc
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockResolvedValue({ data: saved, error: null });
    const { result } = renderHook(() => useSubmitLevelRun(), {
      wrapper: wrapper(),
    });
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow(
        "Response lost",
      );
    });
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(state.rpc.mock.calls[0][1].p_request_id).toBe(
      state.rpc.mock.calls[1][1].p_request_id,
    );
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(state.rpc.mock.calls[2][1].p_request_id).not.toBe(
      state.rpc.mock.calls[1][1].p_request_id,
    );
    expect(state.requests).toEqual([]); // No client merge or separate reward writes.
  });

  it("never treats an RPC without a confirmed row as a saved run", async () => {
    state.rpc.mockResolvedValue({ data: { ...saved, row: null }, error: null });
    const { result } = renderHook(() => useSubmitLevelRun(), {
      wrapper: wrapper(),
    });
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow(
        "Run was not saved",
      );
    });
  });

  it("keeps a checkpoint's frozen receipt across an acknowledged response and page remount", async () => {
    state.rpc.mockResolvedValue({ data: saved, error: null });
    const pending = { ...input, request_id: "frozen-campaign-receipt" };
    const first = renderHook(() => useSubmitLevelRun(), { wrapper: wrapper() });
    await act(async () => {
      await first.result.current.mutateAsync(pending);
    });
    first.unmount();
    const resumed = renderHook(() => useSubmitLevelRun(), {
      wrapper: wrapper(),
    });
    await act(async () => {
      await resumed.result.current.mutateAsync(pending);
    });
    for (const call of state.rpc.mock.calls) {
      expect(call[1].p_request_id).toBe("frozen-campaign-receipt");
      expect(call[1].p_run).toEqual(input);
      expect(call[1].p_run).not.toHaveProperty("request_id");
    }
  });

  it("persists unacknowledged action identity across a page remount", () => {
    const first = renderHook(() => useRuneActionIds());
    const id = first.result.current.get("player:run:payload");
    first.unmount();
    const second = renderHook(() => useRuneActionIds());
    expect(second.result.current.get("player:run:payload")).toBe(id);
    second.result.current.complete("player:run:payload");
    expect(second.result.current.get("player:run:payload")).not.toBe(id);
  });

  it("uses the server daily receipt instead of advertising a second daily reward", async () => {
    state.rpc.mockResolvedValue({
      data: {
        stars: 3,
        reward: { shards: 0, xp: 0 },
        dateStr: "2026-10-30",
        kills: 30,
        rewarded: false,
        previousClassLevel: 10,
        classLevel: 10,
        slotsUnlocked: 2,
      },
      error: null,
    });
    const { result } = renderHook(() => useSubmitDailyRun(), {
      wrapper: wrapper(),
    });
    let savedDaily:
      Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      savedDaily = await result.current.mutateAsync({
        kills: 30,
        score: 8000,
        heroClass: "mage",
      });
    });
    expect(savedDaily?.reward).toEqual({ shards: 0, xp: 0 });
    expect(savedDaily?.rewarded).toBe(false);
    expect(state.requests).toEqual([]);
  });

  it("keeps a daily checkpoint receipt stable when an uncertain save is retried after midnight", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-30T23:59:59Z"));
      const acknowledgement = {
        stars: 1,
        reward: { shards: 75, xp: 80 },
        dateStr: "2026-10-30",
        kills: 8,
        rewarded: true,
      };
      state.rpc
        .mockResolvedValueOnce({
          data: null,
          error: { message: "Lost acknowledgement" },
        })
        .mockResolvedValueOnce({ data: acknowledgement, error: null });
      const input = {
        kills: 8,
        score: 2500,
        heroClass: "warrior" as const,
        requestId: "00000000-0000-4000-8000-000000000999",
      };
      const first = renderHook(() => useSubmitDailyRun(), {
        wrapper: wrapper(),
      });
      await act(async () => {
        await expect(
          first.result.current.mutateAsync(input),
        ).rejects.toMatchObject({ message: "Lost acknowledgement" });
      });
      first.unmount();
      vi.setSystemTime(new Date("2026-10-31T00:00:01Z"));
      const resumed = renderHook(() => useSubmitDailyRun(), {
        wrapper: wrapper(),
      });
      await act(async () => {
        expect(await resumed.result.current.mutateAsync(input)).toEqual(
          acknowledgement,
        );
      });
      expect(state.rpc.mock.calls.map((call) => call[1].p_request_id)).toEqual([
        input.requestId,
        input.requestId,
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends equipment through the owned-slot RPC and never duplicates a relic", async () => {
    state.rpc.mockResolvedValue({
      data: {
        id: "loadout",
        user_id: "player",
        class: "mage",
        slot_1: "ember_edge",
        slot_2: null,
        slot_3: null,
      },
      error: null,
    });
    const { result } = renderHook(() => useUpdateLoadout(), {
      wrapper: wrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({
        cls: "mage",
        slot_1: "ember_edge",
        slot_2: null,
        slot_3: null,
      });
    });
    expect(state.rpc).toHaveBeenCalledWith("rune_delve_equip", {
      p_class: "mage",
      p_slot_1: "ember_edge",
      p_slot_2: null,
      p_slot_3: null,
    });
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          cls: "mage",
          slot_1: "ember_edge",
          slot_2: "ember_edge",
          slot_3: null,
        }),
      ).rejects.toThrow("once");
    });
    expect(state.rpc).toHaveBeenCalledTimes(1);
  });

  it("uses one atomic purchase call and rejects a max-rank upgrade before spending", async () => {
    state.rpc.mockResolvedValue({
      data: { id: "relic", relic_id: "ember_edge", rank: 2 },
      error: null,
    });
    const { result } = renderHook(() => usePurchaseRelicUpgrade(), {
      wrapper: wrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({
        relic_id: "ember_edge",
        expected_rank: 1,
      });
    });
    expect(state.rpc).toHaveBeenCalledWith(
      "rune_delve_buy_relic",
      expect.objectContaining({ p_relic_id: "ember_edge", p_expected_rank: 1 }),
    );
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          relic_id: "ember_edge",
          expected_rank: 5,
        }),
      ).rejects.toThrow("below max rank");
    });
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.requests).toEqual([]);
  });
});
