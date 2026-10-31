import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RuneWorldScene } from "@/components/runedelve/RuneWorldScene";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import RuneDelveQuestsPage from "@/pages/RuneDelveQuestsPage";

const queries = vi.hoisted(() => ({
  hero: vi.fn(),
  combatProgress: vi.fn(),
  puzzleProgress: vi.fn(),
}));
vi.mock("@/hooks/useRuneDelveHero", () => ({
  useRuneDelveHero: () => queries.hero(),
}));
vi.mock("@/hooks/useRuneDelveCampaign", () => ({
  useMyProgress: (heroClass: string | undefined) =>
    queries.combatProgress(heroClass),
}));
vi.mock("@/hooks/useRunePuzzles", () => ({
  useRunePuzzleProgress: () => queries.puzzleProgress(),
}));
vi.mock("@/hooks/useQuests", () => ({
  useActiveQuests: () => ({ data: [], isLoading: false, isError: false }),
  useQuestDefinitions: () => ({ data: [], isLoading: false, isError: false }),
  useClaimQuest: () => ({ mutateAsync: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  queries.hero.mockReturnValue({ data: { class: "warrior" } });
  queries.combatProgress.mockReturnValue({
    data: { highest_unlocked_level: 150 },
  });
  queries.puzzleProgress.mockReturnValue({ data: { unlocked: 1 } });
});
afterEach(cleanup);

function biome(container: HTMLElement) {
  return container.querySelector(".rd-world-scene")?.getAttribute("data-biome");
}

describe("Rune visual currentness", () => {
  it.each([
    ["ember-01", "ember"],
    ["crystal-01", "crystal"],
    ["vault-06", "hollow"],
  ])(
    "uses the active %s puzzle realm without reading archived progression",
    (id, realm) => {
      const view = render(
        <MemoryRouter initialEntries={[`/rune-delve/chamber/${id}`]}>
          <RuneWorldScene />
        </MemoryRouter>,
      );
      expect(biome(view.container)).toBe(realm);
      expect(queries.hero).not.toHaveBeenCalled();
      expect(queries.combatProgress).not.toHaveBeenCalled();
      expect(queries.puzzleProgress).toHaveBeenCalledOnce();
    },
  );

  it("uses the new journey frontier for its menu scenery and an ember fallback while loading", () => {
    queries.puzzleProgress.mockReturnValue({ data: { unlocked: 13 } });
    const view = render(
      <MemoryRouter initialEntries={["/rune-delve"]}>
        <RuneWorldScene />
      </MemoryRouter>,
    );
    expect(biome(view.container)).toBe("hollow");
    queries.puzzleProgress.mockReturnValue({ data: undefined });
    view.rerender(
      <MemoryRouter initialEntries={["/rune-delve"]}>
        <RuneWorldScene />
      </MemoryRouter>,
    );
    expect(biome(view.container)).toBe("ember");
    expect(queries.hero).not.toHaveBeenCalled();
    expect(queries.combatProgress).not.toHaveBeenCalled();
  });

  it("retains combat realm selection and unmounts its queries when returning to the puzzle journey", () => {
    function SceneAndTravel() {
      const navigate = useNavigate();
      return (
        <>
          <RuneWorldScene />
          <button onClick={() => navigate("/rune-delve/chamber/ember-01")}>
            Puzzle journey
          </button>
        </>
      );
    }
    const view = render(
      <MemoryRouter initialEntries={["/rune-delve/play/75"]}>
        <SceneAndTravel />
      </MemoryRouter>,
    );
    expect(biome(view.container)).toBe("crystal");
    expect(queries.combatProgress).toHaveBeenCalledWith("warrior");
    expect(queries.puzzleProgress).not.toHaveBeenCalled();
    queries.hero.mockClear();
    queries.combatProgress.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Puzzle journey" }));
    expect(biome(view.container)).toBe("ember");
    expect(queries.hero).not.toHaveBeenCalled();
    expect(queries.combatProgress).not.toHaveBeenCalled();
  });

  it("sends archived quest hero creation to the combat hub rather than the new puzzle home", () => {
    queries.hero.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/rune-delve/quests"]}>
          <RuneDelveQuestsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      screen.getByRole("link", { name: "Create a hero to unlock quests" }),
    ).toHaveAttribute("href", "/rune-delve/legacy");
    expect(
      screen.getByRole("link", { name: "Back to Combat Archive" }),
    ).toHaveAttribute("href", "/rune-delve/legacy");
  });

  it("keeps combat loading recovery in the Archive", () => {
    render(
      <MemoryRouter initialEntries={["/rune-delve/daily"]}>
        <RuneDataState error onRetry={vi.fn()} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: "Combat Archive" }),
    ).toHaveAttribute("href", "/rune-delve/legacy");
  });
});
