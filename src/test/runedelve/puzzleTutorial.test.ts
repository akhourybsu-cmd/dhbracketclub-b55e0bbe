import { describe, expect, it } from "vitest";
import {
  initialPuzzleState,
  movePuzzle,
  puzzleAreaIndex,
  puzzleNeighbor,
} from "@/lib/runedelve/puzzles/engine";
import { PUZZLE_ROOMS } from "@/lib/runedelve/puzzles/rooms";
import { getPuzzleCoach } from "@/lib/runedelve/puzzles/tutorial";

describe("Rune Delve contextual teaching", () => {
  it("teaches walking, pushing, the optional cache and the exit on the actual first route", () => {
    const room = PUZZLE_ROOMS[0];
    let state = initialPuzzleState(room);
    const initial = JSON.stringify(state);
    const opening = getPuzzleCoach(room, state)!;
    expect(opening.id).toBe("first-step");
    expect(opening.cell).toBe(
      puzzleNeighbor(room, state.player, room.solution[0]),
    );
    expect(JSON.stringify(state)).toBe(initial);
    const steps = [opening.id];
    for (const direction of room.solution) {
      const result = movePuzzle(room, state, direction);
      expect(result.moved).toBe(true);
      state = result.state;
      const coach = getPuzzleCoach(room, state);
      if (coach) steps.push(coach.id);
    }
    expect(new Set(steps)).toEqual(
      new Set(["first-step", "first-push", "first-cache", "first-exit"]),
    );
    expect(state.status).toBe("solved");
    expect(getPuzzleCoach(room, state)).toBeNull();
  });

  it("allows an alternate route without forcing a tutorial action or pointing at an invalid next step", () => {
    const room = PUZZLE_ROOMS[0];
    const initial = initialPuzzleState(room);
    const alternate = movePuzzle(room, initial, "right");
    expect(alternate.moved).toBe(true);
    expect(getPuzzleCoach(room, alternate.state)).toMatchObject({
      id: "first-experiment",
    });
    expect(getPuzzleCoach(room, alternate.state)?.cell).toBeUndefined();
    expect(getPuzzleCoach(room, initial)?.id).toBe("first-step");
  });

  it.each([
    [7, "first-plate"],
    [13, "first-ice"],
    [19, "first-passage"],
    [25, "first-key"],
    [31, "first-rift"],
  ] as const)(
    "introduces the new mechanic in adventure %i without changing the board",
    (order, id) => {
      const room = PUZZLE_ROOMS.find((item) => item.order === order)!;
      const state = initialPuzzleState(room);
      const before = JSON.stringify(state);
      const coach = getPuzzleCoach(room, state)!;
      expect(coach.id).toBe(id);
      expect(JSON.stringify(state)).toBe(before);
      if (coach.cell !== undefined) {
        expect(puzzleAreaIndex(coach.cell)).toBe(puzzleAreaIndex(state.player));
        expect(room.walls).not.toContain(coach.cell);
      }
    },
  );

  it("changes exploration and key prompts only when the delver makes the actual discovery", () => {
    for (const order of [19, 25]) {
      const room = PUZZLE_ROOMS.find((item) => item.order === order)!;
      let state = initialPuzzleState(room);
      const opening = getPuzzleCoach(room, state)!.id;
      let changed = false;
      for (const direction of room.solution) {
        state = movePuzzle(room, state, direction).state;
        const coach = getPuzzleCoach(room, state);
        if (coach && coach.id !== opening) {
          if (order === 19) {
            expect(coach.id).toBe("room-discovered");
            expect(state.visitedAreas!.length).toBeGreaterThan(1);
          } else {
            expect(coach.id).toBe("key-attuned");
            expect(state.keys!.length).toBeGreaterThan(0);
          }
          changed = true;
          break;
        }
      }
      expect(changed).toBe(true);
    }
  });
});
