import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RuneDelveDailyPage from "@/pages/RuneDelveDailyPage";

const state = vi.hoisted(() => ({
  viewport: { width: 320, height: 568, short: true, landscape: false },
  run: null as null | { kills_count: number; stars: number; score: number },
  runError: false,
  boardError: false,
  runRetry: vi.fn(),
  boardRetry: vi.fn(),
  rows: Array.from({ length: 10 }, (_, index) => ({
    id: `row-${index}`,
    rank: index + 1,
    hero_class: "warrior",
    kills_count: 30 - index,
    profile: { display_name: `Delver ${index + 1}` },
  })),
}));
vi.mock("@/hooks/useRuneViewport", () => ({
  useRuneViewport: () => state.viewport,
}));
vi.mock("@/hooks/useDailyChallenge", () => ({
  useTodayDaily: () => ({ dateStr: "2026-10-30", timeLimitSec: 120 }),
  useMyDailyRun: () => ({
    data: state.run,
    isLoading: false,
    isError: state.runError,
    refetch: state.runRetry,
  }),
  useMyDailyStreak: () => ({
    data: { current_streak: 3 },
    isError: false,
    refetch: vi.fn(),
  }),
  useDailyLeaderboard: () => ({
    data: state.rows,
    isLoading: false,
    isError: state.boardError,
    refetch: state.boardRetry,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.run = null;
  state.runError = false;
  state.boardError = false;
  state.viewport = { width: 320, height: 568, short: true, landscape: false };
});
afterEach(cleanup);

function mount() {
  return render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <RuneDelveDailyPage />
    </MemoryRouter>,
  );
}

describe("compact daily arena", () => {
  it("pages every standing while retaining its actual rank", () => {
    mount();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(
      screen.getByRole("article", { name: "Rank 1: Delver 1" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("article", { name: "Rank 3: Delver 3" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Previous arena standings page" }),
    ).toBeDisabled();
    const next = screen.getByRole("button", {
      name: "Next arena standings page",
    });
    fireEvent.click(next);
    expect(
      screen.getByRole("article", { name: "Rank 3: Delver 3" }),
    ).toHaveTextContent("#3");
    for (let page = 2; page < 5; page++) fireEvent.click(next);
    expect(
      screen.getByRole("article", { name: "Rank 10: Delver 10" }),
    ).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(next).toBeDisabled();
  });

  it("pages the full reward ladder including the third-star milestone", () => {
    mount();
    const rewards = screen.getByRole("tab", { name: "Rewards" });
    act(() => {
      rewards.focus();
    });
    fireEvent.keyDown(rewards, { key: "Enter" });
    expect(rewards).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(
      screen.getByRole("article", { name: "0+ slain reward" }),
    ).toHaveTextContent("0 shards");
    const next = screen.getByRole("button", {
      name: "Next arena rewards page",
    });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    const thirdStar = screen.getByRole("article", { name: "16+ slain reward" });
    expect(within(thirdStar).getByLabelText("3 stars")).toBeVisible();
    expect(thirdStar).toHaveTextContent("400 shards");
    fireEvent.click(next);
    expect(
      screen.getByRole("article", { name: "30+ slain reward" }),
    ).toHaveTextContent("900 shards");
    expect(next).toBeDisabled();
    expect(
      screen.getByText(/Better tiers pay the difference/),
    ).toHaveTextContent("Up to 900 shards and 500 XP each day");
  });

  it("offers a daily best retry without discarding the previous result", () => {
    const { rerender } = mount();
    expect(
      screen.getByRole("link", { name: "Enter daily arena" }),
    ).toHaveAttribute("href", "/rune-delve/endless");
    state.run = { kills_count: 17, stars: 2, score: 3456 };
    rerender(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <RuneDelveDailyPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "17 slain." })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Improve today's best" }),
    ).toHaveAttribute("href", "/rune-delve/endless");
    expect(
      screen.queryByRole("link", { name: "Enter daily arena" }),
    ).toBeNull();
  });

  it("keeps separate retry actions for the player result and standings", () => {
    state.boardError = true;
    const { rerender } = mount();
    fireEvent.click(
      within(screen.getByRole("tabpanel")).getByRole("button", {
        name: "Retry",
      }),
    );
    expect(state.boardRetry).toHaveBeenCalledTimes(1);
    expect(state.runRetry).not.toHaveBeenCalled();
    state.runError = true;
    rerender(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <RuneDelveDailyPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(state.runRetry).toHaveBeenCalledTimes(1);
  });
});
