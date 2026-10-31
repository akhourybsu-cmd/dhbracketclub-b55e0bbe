import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PuzzleCompletionReceipt,
  PuzzleProgress,
  PuzzleRoom,
} from "@/lib/runedelve/puzzles/types";
import RunePuzzlePlayPage from "@/pages/RunePuzzlePlayPage";
import RunePuzzleHomePage from "@/pages/RunePuzzleHomePage";
import RunePuzzleJourneyPage from "@/pages/RunePuzzleJourneyPage";
import { puzzleCheckpointKey } from "@/lib/runedelve/puzzles/checkpoint";

const fixture = vi.hoisted(() => ({
  userId: "alice",
  error: false,
  loading: false,
  refetch: vi.fn(),
  complete: vi.fn(),
  audio: vi.fn(),
  avatar: vi.fn(),
  progress: {
    unlocked: 1,
    completed: 0,
    stars: 0,
    avatar: "warrior",
    records: [],
  } as PuzzleProgress,
  room: {
    id: "ember-01",
    version: 1,
    order: 1,
    chapter: 1,
    title: "First Light",
    lesson: "Push the blue stone onto its sigil.",
    mechanic: "runes",
    width: 6,
    height: 6,
    walls: [
      0, 1, 2, 3, 4, 5, 6, 11, 12, 17, 18, 23, 24, 29, 30, 31, 32, 33, 34, 35,
    ],
    start: 13,
    exit: 8,
    stones: [{ id: "a", color: "blue", cell: 14 }],
    sigils: [{ color: "blue", cell: 15 }],
    plates: [],
    gates: [],
    ice: [],
    treasures: [14],
    parPushes: 1,
    solution: ["right", "up"],
  } as PuzzleRoom,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: fixture.userId } }),
}));
vi.mock("@/hooks/useRunePuzzles", () => ({
  useRunePuzzleProgress: () => ({
    data: fixture.error ? null : fixture.progress,
    isLoading: fixture.loading,
    isError: fixture.error,
    refetch: fixture.refetch,
  }),
  useCompleteRunePuzzle: () => ({ mutateAsync: fixture.complete }),
  useSelectRunePuzzleAvatar: () => ({ mutateAsync: fixture.avatar }),
}));
vi.mock("@/lib/runedelve/puzzles/rooms", () => ({
  PUZZLE_ROOMS: [
    fixture.room,
    { ...fixture.room, id: "ember-02", order: 2, title: "The Second Seal" },
  ],
  getPuzzleRoom: (id: string) =>
    id === "ember-01"
      ? fixture.room
      : id === "ember-02"
        ? { ...fixture.room, id, order: 2, title: "The Second Seal" }
        : undefined,
  PUZZLE_CHAPTERS: [
    {
      id: 1,
      title: "Ember Caves",
      subtitle: "Restore the sigils.",
      mechanic: "runes",
      firstRoom: 1,
      lastRoom: 6,
    },
    {
      id: 2,
      title: "Crystal Hollow",
      subtitle: "Open a passage.",
      mechanic: "gates",
      firstRoom: 7,
      lastRoom: 12,
    },
    {
      id: 3,
      title: "Shattered Vault",
      subtitle: "Read the ice.",
      mechanic: "ice",
      firstRoom: 13,
      lastRoom: 18,
    },
  ],
}));
vi.mock("@/hooks/useRuneDelveSfx", () => ({
  useRuneDelveSfx: () => ({ play: fixture.audio }),
}));
vi.mock("@/components/runedelve/RuneArtwork", () => ({
  RuneHeroArt: ({ cls }: { cls: string }) => (
    <span aria-hidden="true">{cls}</span>
  ),
  RuneEnemyArt: () => <span>Guardian</span>,
  RUNE_PORTAL_ART: "/portal.webp",
}));

const receipt = (requestId: string): PuzzleCompletionReceipt => ({
  requestId,
  roomId: "ember-01",
  definitionVersion: 1,
  stars: 3,
  starsGained: 3,
  pushes: 1,
  moves: 2,
  treasureCollected: true,
  firstClear: true,
  unlocked: 2,
  progress: { ...fixture.progress, stars: 3, completed: 1, unlocked: 2 },
});
function mount(route = "/rune-delve/chamber/ember-01") {
  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/rune-delve" element={<RunePuzzleHomePage />} />
        <Route path="/rune-delve/journey" element={<RunePuzzleJourneyPage />} />
        <Route
          path="/rune-delve/chamber/:roomId"
          element={<RunePuzzlePlayPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}
function move(key: string) {
  fireEvent.keyDown(window, { key });
}
function pointer(
  target: Element,
  type: "pointerdown" | "pointerup" | "pointercancel",
  x: number,
  y: number,
  pointerId = 1,
) {
  fireEvent(
    target,
    Object.assign(new Event(type, { bubbles: true }), {
      isPrimary: true,
      button: 0,
      pointerId,
      clientX: x,
      clientY: y,
    }),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  fixture.userId = "alice";
  fixture.error = false;
  fixture.loading = false;
  fixture.progress = {
    unlocked: 1,
    completed: 0,
    stars: 0,
    avatar: "warrior",
    records: [],
  };
  localStorage.clear();
  fixture.complete.mockImplementation(({ requestId }: { requestId: string }) =>
    Promise.resolve(receipt(requestId)),
  );
  fixture.avatar.mockResolvedValue(fixture.progress);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Rune Delve spatial journey UI", () => {
  it("moves, pushes, undoes and restarts through production controls while invalid moves cost nothing", () => {
    mount();
    const board = screen.getByTestId("puzzle-board");
    expect(board.querySelector('[data-puzzle-player="true"]')).toHaveAttribute(
      "data-puzzle-cell",
      "13",
    );
    fireEvent.click(board.querySelector('[data-puzzle-cell="12"]')!);
    expect(screen.getByText("Stone wall. Find another way.")).toBeVisible();
    expect(fixture.audio).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Undo last step" }),
    ).toBeDisabled();
    fireEvent.click(board.querySelector('[data-puzzle-cell="14"]')!);
    expect(board.querySelector('[data-puzzle-player="true"]')).toHaveAttribute(
      "data-puzzle-cell",
      "14",
    );
    expect(board.querySelector('[data-puzzle-stone="blue"]')).toHaveAttribute(
      "data-puzzle-cell",
      "15",
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo last step" }));
    expect(board.querySelector('[data-puzzle-stone="blue"]')).toHaveAttribute(
      "data-puzzle-cell",
      "14",
    );
    move("ArrowRight");
    fireEvent.click(screen.getByRole("button", { name: "Restart chamber" }));
    expect(board.querySelector('[data-puzzle-player="true"]')).toHaveAttribute(
      "data-puzzle-cell",
      "13",
    );
    expect(fixture.complete).not.toHaveBeenCalled();
    expect(
      JSON.parse(
        localStorage.getItem(puzzleCheckpointKey("alice", "ember-01", 1))!,
      ).actions,
    ).toEqual([]);
  });

  it("accepts a swipe followed by a tap without waiting for compatibility clicks or applying them twice", () => {
    mount();
    const board = screen.getByTestId("puzzle-board");
    const cell = (index: number) =>
      board.querySelector(`[data-puzzle-cell="${index}"]`)!;
    pointer(cell(13), "pointerdown", 100, 100);
    pointer(cell(13), "pointerup", 145, 100);
    expect(board.querySelector('[data-puzzle-player="true"]')).toHaveAttribute(
      "data-puzzle-cell",
      "14",
    );
    pointer(cell(20), "pointerdown", 100, 140, 2);
    pointer(cell(20), "pointerup", 100, 140, 2);
    expect(board.querySelector('[data-puzzle-player="true"]')).toHaveAttribute(
      "data-puzzle-cell",
      "20",
    );
    // A delayed compatibility click from the swipe could target the tile above
    // the delver after the next tap. It must not turn into an extra move.
    fireEvent.click(cell(14), { detail: 1 });
    fireEvent.click(cell(20), { detail: 1 });
    expect(board.querySelector('[data-puzzle-player="true"]')).toHaveAttribute(
      "data-puzzle-cell",
      "20",
    );
    pointer(cell(19), "pointerdown", 55, 140, 3);
    pointer(cell(19), "pointerup", 55, 140, 3);
    expect(
      JSON.parse(
        localStorage.getItem(puzzleCheckpointKey("alice", "ember-01", 1))!,
      ).actions,
    ).toEqual(["right", "down", "left"]);
  });

  it("ignores canceled gestures and gaps, taps the starting tile, and preserves assistive activation", () => {
    mount();
    const board = screen.getByTestId("puzzle-board");
    const cell = (index: number) =>
      board.querySelector(`[data-puzzle-cell="${index}"]`)!;
    pointer(cell(14), "pointerdown", 100, 100);
    pointer(cell(14), "pointercancel", 100, 100);
    pointer(cell(14), "pointerup", 100, 100);
    pointer(board, "pointerdown", 120, 120, 2);
    pointer(cell(14), "pointerup", 120, 120, 2);
    pointer(cell(14), "pointerdown", 100, 100, 3);
    pointer(cell(14), "pointerup", 100, 100, 4);
    expect(board.querySelector('[data-puzzle-player="true"]')).toHaveAttribute(
      "data-puzzle-cell",
      "13",
    );
    pointer(cell(14), "pointerdown", 100, 100, 5);
    pointer(cell(20), "pointerup", 105, 110, 5);
    expect(board.querySelector('[data-puzzle-player="true"]')).toHaveAttribute(
      "data-puzzle-cell",
      "14",
    );
    fireEvent.click(cell(13), { detail: 0 });
    expect(board.querySelector('[data-puzzle-player="true"]')).toHaveAttribute(
      "data-puzzle-cell",
      "13",
    );
    expect(
      JSON.parse(
        localStorage.getItem(puzzleCheckpointKey("alice", "ember-01", 1))!,
      ).actions,
    ).toEqual(["right", "left"]);
  });

  it("commits rapid inputs in order and retains the exact terminal UUID/actions when save retries", async () => {
    fixture.complete.mockRejectedValueOnce(
      new Error("Signal lost. Try again."),
    );
    mount();
    act(() => {
      move("ArrowRight");
      move("ArrowUp");
    });
    await screen.findByRole("button", { name: "Retry save" });
    expect(fixture.complete).toHaveBeenCalledTimes(1);
    const sent = fixture.complete.mock.calls[0][0];
    expect(fixture.audio.mock.calls.some((call) => call[0] === "victory")).toBe(
      false,
    );
    expect(sent.actions).toEqual(["right", "up"]);
    expect(sent.requestId).toMatch(/^[\da-f-]{36}$/);
    const pending = JSON.parse(
      localStorage.getItem(puzzleCheckpointKey("alice", "ember-01", 1))!,
    );
    expect(pending.requestId).toBe(sent.requestId);
    move("ArrowLeft");
    expect(fixture.complete).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await screen.findByRole("link", { name: "Enter the next chamber" });
    expect(fixture.complete.mock.calls[1][0]).toEqual(sent);
    expect(
      fixture.audio.mock.calls.filter((call) => call[0] === "victory"),
    ).toHaveLength(1);
    expect(
      localStorage.getItem(puzzleCheckpointKey("alice", "ember-01", 1)),
    ).toBeNull();
    expect(
      screen.getByLabelText("Saved best mastery: 3 of 3 stars"),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Enter the next chamber" }),
    ).toHaveAttribute("href", "/rune-delve/chamber/ember-02");
  });

  it("restores a canonical pending route and does not let a late Alice receipt change Bob's board", async () => {
    let resolve!: (value: PuzzleCompletionReceipt) => void;
    fixture.complete.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const page = mount();
    move("ArrowRight");
    move("ArrowUp");
    await waitFor(() => expect(fixture.complete).toHaveBeenCalledTimes(1));
    const requestId = fixture.complete.mock.calls[0][0].requestId;
    page.unmount();
    fixture.userId = "bob";
    mount();
    await act(async () => {
      resolve(receipt(requestId));
    });
    expect(
      screen.queryByRole("dialog", { name: "Chamber restored" }),
    ).toBeNull();
    expect(
      screen
        .getByTestId("puzzle-board")
        .querySelector('[data-puzzle-player="true"]'),
    ).toHaveAttribute("data-puzzle-cell", "13");
    expect(
      localStorage.getItem(puzzleCheckpointKey("alice", "ember-01", 1)),
    ).not.toBeNull();
  });

  it("resumes a partial board and reuses its saved receipt identity after a failed terminal save", async () => {
    fixture.complete.mockRejectedValueOnce(new Error("Offline"));
    let page = mount();
    move("ArrowRight");
    page.unmount();
    page = mount();
    expect(
      screen
        .getByTestId("puzzle-board")
        .querySelector('[data-puzzle-player="true"]'),
    ).toHaveAttribute("data-puzzle-cell", "14");
    move("ArrowUp");
    await screen.findByRole("button", { name: "Retry save" });
    const first = fixture.complete.mock.calls[0][0];
    page.unmount();
    mount();
    await screen.findByRole("link", { name: "Enter the next chamber" });
    expect(fixture.complete).toHaveBeenCalledTimes(2);
    expect(fixture.complete.mock.calls[1][0]).toEqual(first);
    expect(
      localStorage.getItem(puzzleCheckpointKey("alice", "ember-01", 1)),
    ).toBeNull();
  });

  it("keeps movement out of open dialogs and obtains a hint without taking the move", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Puzzle rules" }));
    move("ArrowRight");
    expect(
      screen
        .getByTestId("puzzle-board")
        .querySelector('[data-puzzle-player="true"]'),
    ).toHaveAttribute("data-puzzle-cell", "13");
    fireEvent.click(
      screen.getByRole("button", { name: "Back to the chamber" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Show a hint" }));
    await screen.findByText("Try moving right.");
    expect(
      screen
        .getByTestId("puzzle-board")
        .querySelector('[data-puzzle-player="true"]'),
    ).toHaveAttribute("data-puzzle-cell", "13");
    move("ArrowRight");
    expect(screen.queryByText("Try moving right.")).toBeNull();
  });

  it("keeps a failed avatar selection open and leaves the saved appearance intact", async () => {
    fixture.avatar.mockRejectedValueOnce(
      new Error("Could not save your delver."),
    );
    mount("/rune-delve");
    fireEvent.click(
      screen.getByRole("button", { name: "Choose delver appearance" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mage" }));
    expect(
      await screen.findByText("Could not save your delver."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Warrior" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("dialog", { name: "Choose your delver" }),
    ).toBeVisible();
  });

  it("discards pending appearance controls across account changes, including switching back", async () => {
    let resolveOldSelection!: (progress: PuzzleProgress) => void;
    fixture.avatar.mockImplementationOnce(
      () =>
        new Promise<PuzzleProgress>((resolve) => {
          resolveOldSelection = resolve;
        }),
    );
    const home = () => (
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <RunePuzzleHomePage />
      </MemoryRouter>
    );
    const page = render(home());
    fireEvent.click(
      screen.getByRole("button", { name: "Choose delver appearance" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mage" }));
    expect(screen.getByRole("button", { name: "Warrior" })).toBeDisabled();

    fixture.userId = "bob";
    page.rerender(home());
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Choose delver appearance" }),
    );
    expect(screen.getByRole("button", { name: "Mage" })).toBeEnabled();

    fixture.userId = "alice";
    page.rerender(home());
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Choose delver appearance" }),
    );
    await act(async () => {
      resolveOldSelection(fixture.progress);
    });
    expect(
      screen.getByRole("dialog", { name: "Choose your delver" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Mage" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Warrior" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not present a loading failure as a fresh unlocked journey", () => {
    fixture.error = true;
    mount("/rune-delve/journey");
    expect(screen.getByText("The dungeon lost your signal")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Enter chamber/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(fixture.refetch).toHaveBeenCalledTimes(1);
  });

  it("shows earned stars and keeps later chamber entry locked", () => {
    fixture.progress.records = [
      {
        room_id: "ember-01",
        definition_version: 1,
        stars: 2,
        best_pushes: 1,
        best_moves: 2,
        treasure_collected: false,
      },
    ];
    mount("/rune-delve/journey");
    expect(
      screen.getByLabelText("First Light mastery: 2 of 3 stars"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Chamber 2: The Second Seal. Locked.",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Enter chamber 1: First Light" }),
    ).toHaveAttribute("href", "/rune-delve/chamber/ember-01");
  });
});
