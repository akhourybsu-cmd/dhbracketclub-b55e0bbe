import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  rows: {} as Record<string, unknown>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: db.rpc, from: db.from },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "player" } }),
}));
vi.mock("@/contexts/ClubContext", () => ({
  useClub: () => ({ club: { id: "club" } }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useEnsureHero, useUpdateHero } from "@/hooks/useRuneDelveHero";
import {
  useEnsureClassProgress,
  useUpdateClassProgress,
} from "@/hooks/useRuneDelveClassProgress";
import {
  useAdvanceProgress,
  useMyProgress,
} from "@/hooks/useRuneDelveCampaign";
import {
  useBumpFailure,
  useEarnShards,
  useResetFailure,
  useRuneWallet,
  useSpendShards,
  useUnlockSlot,
} from "@/hooks/useRuneShards";
import { useActiveQuests, useReportQuestProgress } from "@/hooks/useQuests";

const hero = {
  id: "hero",
  user_id: "player",
  class: "mage" as const,
  hero_name: "Delver",
  xp: 700,
  level: 4,
  cosmetic_title: "Candle Adept",
};
const track = {
  ...hero,
  id: "track",
  highest_unlocked_level: 18,
  highest_completed_level: 17,
  total_levels_cleared: 17,
  current_chapter: 1,
};
const wallet = {
  user_id: "player",
  shards: 85,
  lifetime_shards_earned: 150,
  slots_unlocked: 2,
};
const bootstrap = { hero, track, wallet, progress: track };

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  db.rpc.mockReset();
  db.from.mockReset();
  db.update.mockReset();
  db.rows = {};
  db.rpc.mockResolvedValue({ data: bootstrap, error: null });
  // No insert/upsert/delete methods: attempts to restore direct write paths
  // fail this contract rather than succeeding against a permissive mock.
  db.from.mockImplementation((table: string) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      update: db.update.mockImplementation(() => chain),
      maybeSingle: vi.fn(async () => ({
        data: db.rows[table] ?? null,
        error: null,
      })),
      single: vi.fn(async () => ({
        data: db.rows[table] ?? null,
        error: null,
      })),
    };
    return chain;
  });
});
afterEach(cleanup);

describe("trusted Rune account contracts", () => {
  it("bootstraps hero preferences without sending progression values", async () => {
    const { result } = renderHook(() => useEnsureHero(), setup());
    await act(async () => {
      expect(
        await result.current.mutateAsync({ cls: "mage", hero_name: "Delver" }),
      ).toEqual(hero);
    });
    expect(db.rpc).toHaveBeenCalledWith("rune_delve_bootstrap", {
      p_class: "mage",
      p_hero_name: "Delver",
      p_create_hero: true,
    });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("restores a class track from canonical bootstrap state", async () => {
    const { result } = renderHook(() => useEnsureClassProgress(), setup());
    await act(async () => {
      expect(await result.current.mutateAsync("mage")).toEqual(track);
    });
    expect(db.rpc).toHaveBeenCalledWith("rune_delve_bootstrap", {
      p_class: "mage",
      p_hero_name: null,
      p_create_hero: false,
    });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("selects a class without forwarding the caller's cached stats", async () => {
    db.rpc.mockResolvedValue({ data: hero, error: null });
    const { result } = renderHook(() => useUpdateHero(), setup());
    await act(async () => {
      expect(
        await result.current.mutateAsync({
          class: "mage",
          xp: 999999,
          level: 150,
          cosmetic_title: "Forged",
        }),
      ).toEqual(hero);
    });
    expect(db.rpc).toHaveBeenCalledWith("rune_delve_select_class", {
      p_class: "mage",
    });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("sends only the trimmed name in a direct rename PATCH", async () => {
    db.rows.rune_delve_heroes = { ...hero, hero_name: "New Name" };
    const { result } = renderHook(() => useUpdateHero(), setup());
    await act(async () => {
      await result.current.mutateAsync({
        hero_name: " New Name ",
        xp: 999999,
        user_id: "another-player",
      });
    });
    expect(db.update).toHaveBeenCalledWith({ hero_name: "New Name" });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.from.mock.results[0].value.eq).toHaveBeenCalledWith(
      "user_id",
      "player",
    );
  });

  it("does not report a mismatched class acknowledgement as success", async () => {
    db.rpc.mockResolvedValue({
      data: { ...hero, class: "warrior" },
      error: null,
    });
    const { result } = renderHook(() => useUpdateHero(), setup());
    await act(async () => {
      await expect(
        result.current.mutateAsync({ class: "mage" }),
      ).rejects.toThrow("not confirmed");
    });
  });

  it("initializes a missing wallet without creating a hero", async () => {
    const { result } = renderHook(() => useRuneWallet(), setup());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(wallet);
    expect(db.rpc).toHaveBeenCalledWith("rune_delve_bootstrap", {
      p_class: null,
      p_hero_name: null,
      p_create_hero: false,
    });
  });

  it("cannot unlock slots beyond the server's class entitlement", async () => {
    const { result } = renderHook(() => useUnlockSlot(), setup());
    await act(async () => {
      await expect(result.current.mutateAsync(3)).rejects.toThrow(
        "class level 25",
      );
    });
    expect(db.update).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledWith("rune_delve_bootstrap", {
      p_class: null,
      p_hero_name: null,
      p_create_hero: false,
    });
  });

  it("restores missing campaign progress through bootstrap without a direct insert", async () => {
    db.rows.rune_delve_heroes = hero;
    const { result } = renderHook(() => useMyProgress("mage"), setup());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.highest_unlocked_level).toBe(18);
    expect(db.rpc).toHaveBeenCalledWith("rune_delve_bootstrap", {
      p_class: "mage",
      p_hero_name: null,
      p_create_hero: false,
    });
  });

  it("leaves an existing campaign track intact without bootstrapping", async () => {
    db.rows.rune_delve_class_progress = track;
    const { result } = renderHook(() => useMyProgress("mage"), setup());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(track);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("uses server quest assignments and preserves their completed/claimed state", async () => {
    const context = setup();
    const definition = {
      id: "personal",
      is_personal: true,
      scope: "daily",
      title: "Mage quest",
    };
    const quest = {
      id: "assigned",
      user_id: "player",
      quest_id: "personal",
      scope: "daily",
      period_key: "2040-01-01",
      progress: 8,
      target_value: 8,
      status: "claimed",
    };
    context.client.setQueryData(["rune-delve-hero", "player"], hero);
    context.client.setQueryData(["rd-quest-defs"], [definition]);
    db.rpc.mockResolvedValue({ data: [quest], error: null });
    const { result } = renderHook(() => useActiveQuests(), context);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ ...quest, definition }]);
    expect(db.rpc).toHaveBeenCalledWith("rune_delve_assign_quests", {});
    expect(db.from).not.toHaveBeenCalled();
  });

  it("blocks legacy arbitrary economy and quest mutations before any request", async () => {
    const { result } = renderHook(
      () => ({
        earn: useEarnShards(),
        spend: useSpendShards(),
        bump: useBumpFailure(),
        reset: useResetFailure(),
        track: useUpdateClassProgress(),
        advance: useAdvanceProgress(),
        report: useReportQuestProgress(),
      }),
      setup(),
    );
    await act(async () => {
      const params = { levelNumber: 1, heroClass: "mage" as const };
      await expect(result.current.earn.mutateAsync(1000)).rejects.toThrow(
        "managed by the server",
      );
      await expect(result.current.spend.mutateAsync(1)).rejects.toThrow(
        "managed by the server",
      );
      await expect(result.current.bump.mutateAsync(params)).rejects.toThrow(
        "managed by the server",
      );
      await expect(result.current.reset.mutateAsync(params)).rejects.toThrow(
        "managed by the server",
      );
      await expect(
        result.current.track.mutateAsync({
          cls: "mage",
          patch: { xp: 999999 },
        }),
      ).rejects.toThrow("managed by the server");
      await expect(
        result.current.advance.mutateAsync({
          clearedLevel: 150,
          heroClass: "mage",
        }),
      ).rejects.toThrow("managed by the server");
      await expect(
        result.current.report({ type: "levels_cleared", amount: 1000 }),
      ).rejects.toThrow("managed by the server");
    });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });
});
