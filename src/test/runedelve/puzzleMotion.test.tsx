import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRunePuzzleMotion, PUZZLE_MOTION_MS } from "@/hooks/useRunePuzzleMotion";
import { initialPuzzleState, movePuzzle, puzzleAreaIndex } from "@/lib/runedelve/puzzles/engine";
import { PUZZLE_ROOMS } from "@/lib/runedelve/puzzles/rooms";

const room = PUZZLE_ROOMS[0];
const opening = initialPuzzleState(room);
const walk = movePuzzle(room, opening, "down").state;
const push = movePuzzle(room, walk, "right").state;
let media: MediaQueryList;

beforeEach(() => {
  vi.useFakeTimers();
  media = Object.assign(new EventTarget(), {
    matches: false,
    media: "(prefers-reduced-motion: reduce)",
  }) as MediaQueryList;
  vi.spyOn(window, "matchMedia").mockReturnValue(media);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Rune puzzle committed-action motion", () => {
  it("treats a rift inside one room as travel rather than sliding through its walls", () => {
    const adventure = PUZZLE_ROOMS.find((candidate) => candidate.id === "astral-01")!;
    let before = initialPuzzleState(adventure);
    for (const direction of adventure.solution) {
      const after = movePuzzle(adventure, before, direction).state;
      const distance = Math.abs(before.player % 6 - after.player % 6) +
        Math.abs(Math.floor(before.player / 6) - Math.floor(after.player / 6));
      if (puzzleAreaIndex(before.player) === puzzleAreaIndex(after.player) && distance > 1) {
        const view = renderHook(({ state }) => useRunePuzzleMotion(adventure, state), {
          initialProps: { state: before },
        });
        view.rerender({ state: after });
        expect(view.result.current.motion?.kind).toBe("travel");
        expect(view.result.current.motion?.actors).toHaveLength(0);
        return;
      }
      before = after;
    }
    throw new Error("The authored rift route must contain an in-room fold");
  });
  it("starts a restored checkpoint idle, then distinguishes walking and seal restoration", () => {
    const restored = renderHook(() => useRunePuzzleMotion(room, push));
    expect(restored.result.current.motion).toBeNull();
    expect(restored.result.current.sequence).toBe(0);
    restored.unmount();
    const view = renderHook(({ state }) => useRunePuzzleMotion(room, state), {
      initialProps: { state: opening },
    });
    view.rerender({ state: walk });
    expect(view.result.current.motion?.kind).toBe("step");
    expect(view.result.current.motion?.actors).toHaveLength(1);
    view.rerender({ state: push });
    expect(view.result.current.motion?.kind).toBe("push");
    expect(view.result.current.motion?.actors).toHaveLength(2);
    expect(view.result.current.motion?.effects.get(room.sigils[0].cell)).toContain("seal");
    expect(view.result.current.motion?.effects.get(room.exit)).toContain("portal");
  });

  it("replaces rapid movement and clears after the final input instead of building a queue", () => {
    const view = renderHook(({ state }) => useRunePuzzleMotion(room, state), {
      initialProps: { state: opening },
    });
    view.rerender({ state: walk });
    act(() => vi.advanceTimersByTime(100));
    view.rerender({ state: push });
    expect(view.result.current.sequence).toBe(2);
    expect(view.result.current.motion?.actors.length).toBeLessThanOrEqual(5);
    act(() => vi.advanceTimersByTime(PUZZLE_MOTION_MS - 1));
    expect(view.result.current.motion).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(view.result.current.motion).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not replay acquisitions or movement when undoing, restarting, or changing rooms", () => {
    const view = renderHook(({ state, currentRoom }) => useRunePuzzleMotion(currentRoom, state), {
      initialProps: { state: opening, currentRoom: room },
    });
    view.rerender({ state: walk, currentRoom: room });
    view.rerender({ state: push, currentRoom: room });
    view.rerender({ state: walk, currentRoom: room });
    expect(view.result.current.motion).toBeNull();
    expect(view.result.current.sequence).toBe(2);
    view.rerender({ state: opening, currentRoom: room });
    expect(view.result.current.motion).toBeNull();
    view.rerender({ state: initialPuzzleState(PUZZLE_ROOMS[1]), currentRoom: PUZZLE_ROOMS[1] });
    expect(view.result.current.motion).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels for a dialog and establishes an idle baseline when it closes", () => {
    const view = renderHook(({ state, paused }) => useRunePuzzleMotion(room, state, paused), {
      initialProps: { state: opening, paused: false },
    });
    view.rerender({ state: walk, paused: false });
    view.rerender({ state: walk, paused: true });
    expect(view.result.current.motion).toBeNull();
    expect(view.result.current.paused).toBe(true);
    view.rerender({ state: walk, paused: false });
    expect(view.result.current.motion).toBeNull();
    view.rerender({ state: push, paused: false });
    expect(view.result.current.motion?.kind).toBe("push");
  });

  it("clears when backgrounded and does not replay on visibility restoration", () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const view = renderHook(({ state }) => useRunePuzzleMotion(room, state), {
      initialProps: { state: opening },
    });
    view.rerender({ state: walk });
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(view.result.current.motion).toBeNull();
    view.rerender({ state: push });
    expect(view.result.current.motion).toBeNull();
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(view.result.current.motion).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("respects reduced motion initially and when the preference changes during a step", () => {
    Object.defineProperty(media, "matches", { value: true, writable: true });
    const view = renderHook(({ state }) => useRunePuzzleMotion(room, state), {
      initialProps: { state: opening },
    });
    view.rerender({ state: walk });
    expect(view.result.current.motion).toBeNull();
    Object.assign(media, { matches: false });
    act(() => media.dispatchEvent(new Event("change")));
    view.rerender({ state: push });
    expect(view.result.current.motion?.kind).toBe("push");
    Object.assign(media, { matches: true });
    act(() => media.dispatchEvent(new Event("change")));
    expect(view.result.current.motion).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
