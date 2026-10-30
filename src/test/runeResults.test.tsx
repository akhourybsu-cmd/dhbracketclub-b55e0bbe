import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RuneDelveResultsPage from "@/pages/RuneDelveResultsPage";
import { runeResultKey } from "@/lib/runedelve/resultSnapshot";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "member-a" } }),
}));
vi.mock("@/hooks/useRuneDelveHero", () => ({
  useRuneDelveHero: () => ({ data: { class: "mage" }, refetch: vi.fn() }),
}));
vi.mock("@/hooks/useRuneDelveCampaign", () => ({
  useLevel: () => ({
    data: { id: "level-10", enemy_config: [{ maxHp: 150 }] },
    refetch: vi.fn(),
  }),
  useMyLevelRun: () => ({
    data: {
      score: 5000,
      dungeon_cleared: true,
      total_damage: 150,
      enemies_defeated: 3,
      hp_remaining: 100,
      turns_used: 2,
      longest_chain: 8,
      xp_earned: 40,
    },
    refetch: vi.fn(),
  }),
  useMyProgress: () => ({ data: { highest_unlocked_level: 11 } }),
  useLevelBestScores: () => ({ data: [] }),
}));
vi.mock("@/hooks/useRuneDelveSfx", () => ({
  useRuneDelveSfx: () => ({ play: vi.fn() }),
}));
vi.mock("@/components/Confetti", () => ({ Confetti: () => null }));
vi.mock("@/components/runedelve/fx/CountUp", () => ({
  CountUp: ({ value }: { value: number }) => <span>{value}</span>,
}));
beforeEach(() => sessionStorage.clear());
afterEach(cleanup);
function renderResults() {
  return render(
    <MemoryRouter initialEntries={["/rune-delve/results/10"]}>
      <Routes>
        <Route
          path="/rune-delve/results/:levelNumber"
          element={<RuneDelveResultsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Latest result versus merged best record", () => {
  it("shows the latest defeat even when the saved personal best was a victory", () => {
    sessionStorage.setItem(
      runeResultKey("member-a", "mage", 10),
      JSON.stringify({
        version: 2,
        userId: "member-a",
        heroClass: "mage",
        levelNumber: 10,
        ts: Date.now(),
        score: 350,
        totalDamage: 94,
        enemiesDefeated: 1,
        hpRemaining: 0,
        turnsUsed: 8,
        longestChain: 6,
        xpEarned: 0,
        dungeonCleared: false,
        shardsAwarded: 5,
        wasNewBest: false,
        improvedChain: false,
        improvedTurns: false,
        improvedHp: false,
        firstClear: false,
      }),
    );
    renderResults();
    expect(
      screen.getByRole("heading", { name: "Fallen, not finished" }),
    ).toBeTruthy();
    expect(screen.getByText("350")).toBeTruthy();
    expect(screen.queryByText("5000")).toBeNull();
    expect(screen.queryByText("Next chamber")).toBeNull();
  });
  it("labels a direct historical visit as a personal record", () => {
    renderResults();
    expect(screen.getByText(/Personal record/)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Chamber conquered" }),
    ).toBeTruthy();
    expect(screen.getByText("5000")).toBeTruthy();
  });
});
