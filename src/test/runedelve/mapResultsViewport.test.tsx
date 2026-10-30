import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import RuneDelveLevelMapPage from "@/pages/RuneDelveLevelMapPage";
import RuneDelveResultsPage from "@/pages/RuneDelveResultsPage";
import { runeResultKey } from "@/lib/runedelve/resultSnapshot";

const state = vi.hoisted(() => ({
  viewport: { width: 320, height: 568, short: true, landscape: false },
  unlocked: 148,
  completed: 147,
  play: vi.fn(),
}));
vi.mock("@/hooks/useRuneViewport", () => ({
  useRuneViewport: () => state.viewport,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "viewport-member" } }),
}));
vi.mock("@/hooks/useRuneDelveHero", () => ({
  useRuneDelveHero: () => ({ data: { class: "mage" }, refetch: vi.fn() }),
}));
vi.mock("@/hooks/useRuneDelveSfx", () => ({
  useRuneDelveSfx: () => ({ play: state.play }),
}));
vi.mock("@/components/Confetti", () => ({ Confetti: () => null }));
vi.mock("@/components/runedelve/fx/CountUp", () => ({
  CountUp: ({
    value,
    className,
    format,
  }: {
    value: number;
    className: string;
    format: (n: number) => string;
  }) => <span className={className}>{format(value)}</span>,
}));
vi.mock("@/hooks/useRuneDelveCampaign", () => ({
  useMyProgress: () => ({
    data: {
      highest_unlocked_level: state.unlocked,
      highest_completed_level: state.completed,
    },
    refetch: vi.fn(),
  }),
  useLevelWindow: (start: number, count: number) => ({
    data: Array.from({ length: count }, (_, i) => ({
      level_number: start + i,
      modifiers: {},
    })),
    refetch: vi.fn(),
  }),
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
      best_turns_used: 2,
    },
    refetch: vi.fn(),
  }),
  useLevelBestScores: () => ({
    data: Array.from({ length: 7 }, (_, i) => ({
      id: `record-${i + 1}`,
      rank: i + 1,
      score: 9000 - i * 100,
      hero: { hero_name: `Club hero ${i + 1}` },
    })),
  }),
}));

function Location() {
  const location = useLocation();
  return (
    <p data-testid="destination">
      {location.pathname}
      {location.search}
    </p>
  );
}
function app(route = "/rune-delve/levels") {
  return (
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/rune-delve/levels" element={<RuneDelveLevelMapPage />} />
        <Route
          path="/rune-delve/results/:levelNumber"
          element={<RuneDelveResultsPage />}
        />
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>
  );
}
function visibleLevels(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLButtonElement>(".rd-path-tile")];
}
function rememberLevels(container: HTMLElement, levels: Set<number>) {
  visibleLevels(container).forEach((button) =>
    levels.add(
      Number(button.getAttribute("aria-label")?.match(/^Level (\d+)/)?.[1]),
    ),
  );
}
beforeEach(() => {
  state.viewport = { width: 320, height: 568, short: true, landscape: false };
  state.unlocked = 148;
  state.completed = 147;
  sessionStorage.clear();
  localStorage.removeItem("rd-path-choice:viewport-member:10");
});
afterEach(cleanup);

describe("Viewport-paged dungeon", () => {
  it("starts on the frontier page and preserves its chamber across viewport changes", () => {
    const { container, rerender } = render(app());
    expect(screen.getByRole("combobox", { name: "Chapter" })).toHaveValue("3");
    expect(
      screen.getByRole("button", { name: /^Level 148 ·/ }),
    ).toHaveAttribute("data-state", "current");
    expect(visibleLevels(container)).toHaveLength(4);
    state.viewport = {
      width: 390,
      height: 844,
      short: false,
      landscape: false,
    };
    rerender(app());
    expect(visibleLevels(container)).toHaveLength(10);
    expect(screen.getByRole("button", { name: /^Level 148 ·/ })).toBeEnabled();
    state.viewport = { width: 844, height: 390, short: true, landscape: true };
    rerender(app());
    expect(visibleLevels(container)).toHaveLength(4);
    expect(screen.getByRole("button", { name: /^Level 148 ·/ })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /^Continue · Chamber 148/ }),
    ).toBeEnabled();
  });

  it("keeps all 150 chambers and future locked chapters reachable through explicit pages", () => {
    const { container } = render(app());
    const seen = new Set<number>();
    for (let chapter = 1; chapter <= 3; chapter++) {
      fireEvent.change(screen.getByRole("combobox", { name: "Chapter" }), {
        target: { value: String(chapter) },
      });
      for (let stage = 0; stage < 5; stage++) {
        const start = (chapter - 1) * 50 + stage * 10 + 1;
        fireEvent.click(
          screen.getByRole("button", {
            name: new RegExp(`^${start}–${start + 9} `),
          }),
        );
        rememberLevels(container, seen);
        fireEvent.click(
          screen.getByRole("button", { name: /^Next chambers .* page$/ }),
        );
        rememberLevels(container, seen);
      }
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 150 }, (_, i) => i + 1),
    );
    expect(screen.getByRole("button", { name: /^Level 150 ·/ })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Chapter" }), {
      target: { value: "4" },
    });
    expect(screen.getByRole("button", { name: /^Level 151 ·/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Level 151 ·/ }));
    expect(screen.queryByTestId("destination")).toBeNull();
    expect(state.unlocked).toBe(148);
  });

  it("retains milestone path selection and its exact play deep-link", async () => {
    state.unlocked = 10;
    state.completed = 9;
    render(app());
    fireEvent.click(screen.getByRole("button", { name: /^Level 10 ·/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Next milestone paths page" }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Choose Treasure Path" }),
    );
    expect(screen.getByTestId("destination")).toHaveTextContent(
      "/rune-delve/play/10?pathVariant=treasure",
    );
    expect(localStorage.getItem("rd-path-choice:viewport-member:10")).toBe(
      "treasure",
    );
  });
});

describe("Viewport-paged results", () => {
  it("keeps every action available while all stats and club records remain reachable", () => {
    const { rerender } = render(app("/rune-delve/results/10"));
    const actions = () => {
      expect(
        screen.getByRole("link", { name: "Refine your loadout" }),
      ).toHaveAttribute("href", "/rune-delve/armory");
      expect(screen.getByRole("button", { name: "Play again" })).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Next chamber" }),
      ).toBeEnabled();
    };
    actions();
    fireEvent.click(screen.getByRole("tab", { name: "Stats" }));
    const stats = screen.getByRole("tabpanel", { name: "Stats" });
    for (const label of [
      "Damage",
      "Defeated",
      "Health",
      "Turns",
      "Best chain",
      "Best XP",
    ])
      expect(within(stats).getByText(label)).toBeTruthy();
    actions();
    fireEvent.click(screen.getByRole("tab", { name: "Records" }));
    const seen = new Set<string>();
    for (let page = 0; page < 4; page++) {
      const panel = screen.getByRole("tabpanel", { name: "Records" });
      within(panel)
        .getAllByText(/^Club hero \d+$/)
        .forEach((name) => seen.add(name.textContent!));
      if (page < 3)
        fireEvent.click(
          within(panel).getByRole("button", { name: "Next club records page" }),
        );
      actions();
    }
    expect(seen.size).toBe(7);
    state.viewport = { width: 844, height: 390, short: true, landscape: true };
    rerender(app("/rune-delve/results/10"));
    expect(
      within(screen.getByRole("tabpanel", { name: "Records" })).getByText(
        "Club hero 7",
      ),
    ).toBeTruthy();
    actions();
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByTestId("destination")).toHaveTextContent(
      "/rune-delve/play/10",
    );
  });

  it("supports keyboard tabs and keeps the primary onward action", () => {
    render(app("/rune-delve/results/10"));
    const summary = screen.getByRole("tab", { name: "This record" });
    summary.focus();
    fireEvent.keyDown(summary, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Stats" })).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "Stats" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Stats" }), {
      key: "End",
    });
    expect(screen.getByRole("tab", { name: "Records" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Records" }), {
      key: "Home",
    });
    expect(summary).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Next chamber" }));
    expect(screen.getByTestId("destination")).toHaveTextContent(
      "/rune-delve/play/11",
    );
  });

  it("uses one club-record row in landscape and preserves latest defeat versus best-record data", () => {
    state.viewport = { width: 844, height: 390, short: true, landscape: true };
    sessionStorage.setItem(
      runeResultKey("viewport-member", "mage", 10),
      JSON.stringify({
        version: 2,
        userId: "viewport-member",
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
    render(app("/rune-delve/results/10"));
    expect(
      screen.getByRole("heading", { name: "Fallen, not finished" }),
    ).toBeTruthy();
    expect(screen.getByText("350")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next chamber" })).toBeNull();
    expect(screen.getByRole("link", { name: "Tune build" })).toHaveAttribute(
      "href",
      "/rune-delve/armory",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Records" }));
    const panel = screen.getByRole("tabpanel", { name: "Records" });
    expect(within(panel).getByText("5,000")).toBeTruthy();
    expect(within(panel).getAllByText(/^Club hero \d+$/)).toHaveLength(1);
    fireEvent.click(
      within(panel).getByRole("button", { name: "Next club records page" }),
    );
    expect(within(panel).getByText("Club hero 2")).toBeTruthy();
  });
});
