import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import RuneDelveExpeditionPage from "@/pages/RuneDelveExpeditionPage";
import {
  createExpedition,
  expeditionStorageKey,
  saveExpedition,
} from "@/lib/runedelve/expedition";

const state = vi.hoisted(() => ({ game: {} as Record<string, unknown> }));
vi.mock("@/hooks/useRuneExpedition", () => ({
  useRuneExpedition: () => state.game,
}));
vi.mock("@/hooks/useRuneDelveHero", () => ({
  useRuneDelveHero: () => ({ data: { class: "warrior" } }),
}));
vi.mock("@/components/runedelve/RuneBoard", () => ({
  RuneBoard: ({ disabled }: { disabled: boolean }) => (
    <button data-testid="mock-rune-board" disabled={disabled}>
      Runes
    </button>
  ),
}));
vi.mock("@/components/runedelve/EnemyDisplay", () => ({
  EnemyDisplay: () => <div>Enemies</div>,
}));
vi.mock("@/components/runedelve/HeroStatusBar", () => ({
  HeroStatusBar: ({ disabled }: { disabled?: boolean }) => (
    <button data-testid="mock-hero-ability" disabled={disabled}>
      Ability
    </button>
  ),
}));
vi.mock("@/components/runedelve/RuneArtwork", () => ({
  RuneHeroArt: () => <span>Portrait</span>,
  RUNE_PORTAL_ART: "/portal.webp",
}));
const ticket = (id: string) => ({
  id,
  seed: 728391,
  hero_class: "warrior" as const,
  ascension: 0,
  started_at: new Date().toISOString(),
});
function game(
  userId: string,
  clubId: string,
  patch: Record<string, unknown> = {},
) {
  return {
    userId,
    clubId,
    data: {
      highest_ascension: 0,
      best_score: 0,
      total_runs: 0,
      total_clears: 0,
      active_run: null,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    begin: vi.fn(async () => ticket(userId)),
    finish: vi.fn(),
    ...patch,
  };
}
const view = () => (
  <MemoryRouter
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
  >
    <RuneDelveExpeditionPage />
  </MemoryRouter>
);
afterEach(cleanup);
beforeEach(() => localStorage.clear());
describe("Expedition scope and modal isolation", () => {
  it("ignores a late start from the previous account and disables all gameplay while paused", async () => {
    let resolveStart!: (value: ReturnType<typeof ticket>) => void;
    state.game = game("alice", "club-a", {
      begin: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveStart = resolve;
          }),
      ),
    });
    const page = render(view());
    fireEvent.click(await screen.findByTestId("expedition-start"));
    state.game = game("bob", "club-b");
    page.rerender(view());
    await act(async () => {
      resolveStart(ticket("old-ticket"));
    });
    expect(screen.queryByTestId("expedition-combat")).toBeNull();
    expect(
      localStorage.getItem(expeditionStorageKey("bob", "club-b")),
    ).toBeNull();
    fireEvent.click(await screen.findByTestId("expedition-start"));
    await screen.findByTestId("expedition-combat");
    fireEvent.click(screen.getByRole("button", { name: "Pause expedition" }));
    await screen.findByRole("dialog", { name: "Expedition paused" });
    expect(screen.getByTestId("mock-rune-board")).toBeDisabled();
    expect(screen.getByTestId("mock-hero-ability")).toBeDisabled();
  });
  it("cannot apply a previous club reward receipt to a different club checkpoint", async () => {
    const original = createExpedition(ticket("alice-run"));
    original.phase = "won";
    original.roomsCleared = 6;
    original.room = 6;
    original.score = 5000;
    original.totalTurns = 30;
    original.combat.enemies = original.combat.enemies.map((enemy) => ({
      ...enemy,
      hp: 0,
    }));
    saveExpedition(expeditionStorageKey("alice", "club-a"), original);
    const other = createExpedition(ticket("other-club-run"));
    saveExpedition(expeditionStorageKey("alice", "club-b"), other);
    let resolveFinish!: (value: unknown) => void;
    state.game = game("alice", "club-a", {
      finish: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFinish = resolve;
          }),
      ),
    });
    const page = render(view());
    fireEvent.click(await screen.findByTestId("expedition-resume"));
    fireEvent.click(await screen.findByTestId("expedition-bank"));
    state.game = game("alice", "club-b");
    page.rerender(view());
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Chamber 1", hidden: true }),
      ).toBeInTheDocument(),
    );
    await act(async () => {
      resolveFinish({
        reward: 112,
        rooms: 6,
        cleared: true,
        highest_ascension: 1,
        best_score: 5000,
      });
    });
    expect(screen.queryByText("SHARDS BANKED")).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(expeditionStorageKey("alice", "club-b"))!)
        .id,
    ).toBe("other-club-run");
    expect(
      screen.getByRole("dialog", { name: "Expedition paused" }),
    ).toBeInTheDocument();
  });
  it("ignores a late start even after returning to the same account and club", async () => {
    let resolveStart!: (value: ReturnType<typeof ticket>) => void;
    state.game = game("alice", "club-a", {
      begin: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveStart = resolve;
          }),
      ),
    });
    const page = render(view());
    fireEvent.click(await screen.findByTestId("expedition-start"));
    state.game = game("bob", "club-b");
    page.rerender(view());
    state.game = game("alice", "club-a", {
      begin: vi.fn(async () => ticket("current-ticket")),
    });
    page.rerender(view());
    fireEvent.click(await screen.findByTestId("expedition-start"));
    await screen.findByTestId("expedition-combat");
    await act(async () => {
      resolveStart(ticket("old-ticket"));
    });
    expect(
      JSON.parse(localStorage.getItem(expeditionStorageKey("alice", "club-a"))!)
        .id,
    ).toBe("current-ticket");
    act(() => window.dispatchEvent(new Event("rune-delve:pause")));
    expect(
      screen.getByRole("dialog", { name: "Expedition paused" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("mock-rune-board")).toBeDisabled();
  });
  it("ignores a late bank receipt after leaving and returning to the same scope", async () => {
    const run = createExpedition(ticket("alice-run"));
    run.phase = "lost";
    saveExpedition(expeditionStorageKey("alice", "club-a"), run);
    let oldResolve!: (value: unknown) => void;
    let currentResolve!: (value: unknown) => void;
    state.game = game("alice", "club-a", {
      finish: vi.fn(
        () =>
          new Promise((resolve) => {
            oldResolve = resolve;
          }),
      ),
    });
    const page = render(view());
    fireEvent.click(await screen.findByTestId("expedition-resume"));
    fireEvent.click(screen.getByTestId("expedition-bank"));
    state.game = game("bob", "club-b");
    page.rerender(view());
    state.game = game("alice", "club-a", {
      finish: vi.fn(
        () =>
          new Promise((resolve) => {
            currentResolve = resolve;
          }),
      ),
    });
    page.rerender(view());
    fireEvent.click(await screen.findByTestId("expedition-resume"));
    fireEvent.click(screen.getByTestId("expedition-bank"));
    const receipt = {
      reward: 0,
      rooms: 0,
      cleared: false,
      highest_ascension: 0,
      best_score: 0,
    };
    await act(async () => {
      oldResolve(receipt);
    });
    expect(screen.queryByText("SHARDS BANKED")).toBeNull();
    expect(
      localStorage.getItem(expeditionStorageKey("alice", "club-a")),
    ).not.toBeNull();
    await act(async () => {
      currentResolve(receipt);
    });
    expect(screen.getByText("SHARDS BANKED")).toBeInTheDocument();
    expect(
      localStorage.getItem(expeditionStorageKey("alice", "club-a")),
    ).toBeNull();
  });
});
