import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RuneRewardProvider } from "@/components/runedelve/RuneRewardReveal";
import { useClaimQuest } from "@/hooks/useQuests";
import type { ActiveQuest } from "@/lib/runedelve/quests";
import { progressionRewardItems } from "@/lib/runedelve/rewardPresentation";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: state.rpc },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "player" } }),
}));
vi.mock("@/hooks/useRuneDelveHero", () => ({
  useRuneDelveHero: () => ({ data: { class: "mage" } }),
}));
vi.mock("sonner", () => ({
  toast: { error: state.error, success: state.success },
}));

const quest: ActiveQuest = {
  id: "quest-1",
  user_id: "player",
  quest_id: "daily-chain",
  scope: "daily",
  period_key: "2026-10-30",
  progress: 5,
  target_value: 5,
  status: "completed",
  claimed_at: null,
  definition: {
    id: "daily-chain",
    scope: "daily",
    title: "Chain keeper",
    description: "Chain five times",
    objective_type: "longest_chain",
    target_value: 5,
    shard_reward: 75,
    xp_reward: 40,
    is_personal: false,
    hero_class: null,
    weight: 1,
  },
};
function Claim() {
  const claim = useClaimQuest();
  return (
    <button
      disabled={claim.isPending}
      onClick={() => {
        void claim.mutateAsync(quest).catch(() => {});
      }}
    >
      Claim quest
    </button>
  );
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RuneRewardProvider>
        <Claim />
      </RuneRewardProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("Confirmed acquisition presentation", () => {
  it("waits for the server receipt and celebrates its actual currencies in the center", async () => {
    let confirm!: (result: unknown) => void;
    state.rpc.mockReturnValue(
      new Promise((resolve) => {
        confirm = resolve;
      }),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Claim quest" }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Claim quest" })).toBeDisabled();
    await act(async () =>
      confirm({
        data: { shards: 50, xp: 25, title: "Chain keeper", scope: "daily" },
        error: null,
      }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Quest complete" }),
    ).toBeVisible();
    expect(screen.getByText("+50 Rune Shards")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Next acquired rewards page" }),
    );
    expect(screen.getByText("+25 Class XP")).toBeVisible();
    expect(state.success).not.toHaveBeenCalled();
  });

  it("keeps failures retryable and does not announce an already-paid receipt", async () => {
    state.rpc
      .mockResolvedValueOnce({ data: null, error: { message: "Offline" } })
      .mockResolvedValueOnce({
        data: {
          shards: 0,
          xp: 0,
          title: "Chain keeper",
          scope: "daily",
          alreadyClaimed: true,
        },
        error: null,
      });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Claim quest" }));
    await waitFor(() => expect(state.error).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Claim quest" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Claim quest" }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("includes every newly crossed mastery and never infers acquisitions from an unchanged level", () => {
    const items = progressionRewardItems(
      "mage",
      { previousClassLevel: 1, classLevel: 40, slotsUnlocked: 3 },
      2,
    );
    expect(items.filter((item) => item.kind === "mastery")).toHaveLength(3);
    expect(items.find((item) => item.kind === "level")?.label).toBe("Level 40");
    expect(items.find((item) => item.kind === "slot")?.label).toBe(
      "Third relic slot",
    );
    expect(
      progressionRewardItems("mage", {
        previousClassLevel: 40,
        classLevel: 40,
        slotsUnlocked: 3,
      }),
    ).toEqual([]);
    expect(
      progressionRewardItems("mage", { classLevel: 40, slotsUnlocked: 3 }),
    ).toEqual([]);
  });
});
