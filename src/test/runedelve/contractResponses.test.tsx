import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: state.rpc },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "player" } }),
}));
vi.mock("@/contexts/ClubContext", () => ({
  useClub: () => ({ club: { id: "club" } }),
}));

import { useUpdateLoadout } from "@/hooks/useLoadout";
import { useRuneExpedition } from "@/hooks/useRuneExpedition";
import { computeFailureShards } from "@/lib/runedelve/shardEconomy";
import type { ExpeditionRun } from "@/lib/runedelve/expedition";

const loadout = {
  id: "saved-loadout",
  user_id: "player",
  class: "mage",
  slot_1: "ember_edge",
  slot_2: null,
  slot_3: null,
};
const input = {
  cls: "mage" as const,
  slot_1: "ember_edge",
  slot_2: null,
  slot_3: null,
};
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
beforeEach(() => state.rpc.mockReset());
afterEach(cleanup);

describe("Rune persistence response contracts", () => {
  it("normalizes a one-row PostgREST equipment composite", async () => {
    state.rpc.mockResolvedValue({ data: [loadout], error: null });
    const { result } = renderHook(() => useUpdateLoadout(), setup());
    await act(async () => {
      expect(await result.current.mutateAsync(input)).toEqual(loadout);
    });
  });

  it.each([
    [],
    {},
    { ...loadout, user_id: "another-account" },
    { ...loadout, class: "warrior" },
    { ...loadout, slot_1: null },
  ])(
    "rejects an equipment response that does not acknowledge the submitted loadout: %j",
    async (data) => {
      state.rpc.mockResolvedValue({ data, error: null });
      const { result } = renderHook(() => useUpdateLoadout(), setup());
      await act(async () => {
        await expect(result.current.mutateAsync(input)).rejects.toThrow(
          "Loadout was not confirmed",
        );
      });
    },
  );

  it("refreshes quest progress immediately after an Expedition bank acknowledgement", async () => {
    state.rpc.mockImplementation(async (name: string) => ({
      data:
        name === "rune_delve_expedition_profile"
          ? {
              active_run: null,
              highest_ascension: 0,
              total_runs: 0,
              total_clears: 0,
              best_score: 0,
            }
          : {
              reward: 112,
              rooms: 6,
              cleared: true,
              highest_ascension: 1,
              best_score: 3000,
            },
      error: null,
    }));
    const context = setup();
    context.client.setQueryData(["rd-active-quests", "player"], []);
    const { result } = renderHook(() => useRuneExpedition(), context);
    await act(async () => {
      await result.current.finish({
        id: "ticket",
        roomsCleared: 6,
        score: 3000,
        totalTurns: 40,
        phase: "won",
      } as ExpeditionRun);
    });
    expect(
      context.client.getQueryState(["rd-active-quests", "player"])
        ?.isInvalidated,
    ).toBe(true);
  });
});

it("keeps boss-failure preview rewards aligned with settlement and bounded under reinforcement telemetry", () => {
  const args = {
    levelNumber: 75,
    failureCount: 1,
    enemiesKilled: 0,
    totalEnemies: 1,
    turnsUsed: 18,
    turnLimit: 18,
    bossPhaseReached: 0,
    bossHasRule: true,
    compassEquipped: false,
  };
  expect(computeFailureShards(args).total).toBe(9);
  expect(computeFailureShards({ ...args, bossPhaseReached: 3 }).total).toBe(13);
  expect(
    computeFailureShards({
      ...args,
      enemiesKilled: 99,
      bossPhaseReached: 99,
      turnsUsed: 99,
    }).total,
  ).toBe(17);
});
