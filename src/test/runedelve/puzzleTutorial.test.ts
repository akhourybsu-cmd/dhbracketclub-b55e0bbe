import { describe, expect, it } from "vitest";
import {
  initialPuzzleState,
  movePuzzle,
  PUZZLE_DIRECTIONS,
  puzzleAreaIndex,
  puzzleNeighbor,
  puzzleOpenGates,
  puzzleStars,
  replayPuzzle,
} from "@/lib/runedelve/puzzles/engine";
import { PUZZLE_ROOMS } from "@/lib/runedelve/puzzles/rooms";
import {
  getPuzzleCoach,
  getPuzzleCoachIntro,
  getPuzzleTutorialProgress,
  isPuzzleCoachComplete,
} from "@/lib/runedelve/puzzles/tutorial";
import type {
  PuzzleDirection,
  PuzzleRoom,
  PuzzleState,
} from "@/lib/runedelve/puzzles/types";

const chamber = (order: number) => PUZZLE_ROOMS.find((room) => room.order === order)!;
function at(room: PuzzleRoom, actions: readonly PuzzleDirection[]) {
  const replay = replayPuzzle(room, actions);
  expect(replay.valid).toBe(true);
  return replay.state;
}
function coachAt(room: PuzzleRoom, actions: readonly PuzzleDirection[]) {
  return getPuzzleCoach(room, at(room, actions), { actions });
}

describe("Rune Delve playable teaching phases", () => {
  it.each([
    [1, "learn", "Learn", 4],
    [2, "practice", "Practice", 2],
    [3, "trial", "Trial", 2],
  ] as const)("gives chamber %i an explicit phase and real completion", (order, phase, label, steps) => {
    const room = chamber(order);
    expect(getPuzzleTutorialProgress(room, initialPuzzleState(room))).toEqual({
      phase, label, stage: order, stages: 3, step: 1, steps, complete: false,
    });
    expect(getPuzzleTutorialProgress(room, at(room, room.solution), { actions: room.solution }))
      .toMatchObject({ phase, step: steps, complete: true });
    expect(getPuzzleCoachIntro(room)).toEqual(getPuzzleCoach(room, initialPuzzleState(room)));
  });

  it("teaches walk, push, optional cache and exit as actual first-room beats", () => {
    const room = chamber(1);
    const ids: string[] = [];
    const steps: number[] = [];
    for (let length = 0; length <= room.solution.length; length++) {
      const actions = room.solution.slice(0, length);
      const state = at(room, actions);
      const before = JSON.stringify(state);
      const coach = getPuzzleCoach(room, state, { actions });
      if (coach) ids.push(coach.id);
      steps.push(getPuzzleTutorialProgress(room, state, { actions })!.step);
      expect(JSON.stringify(state)).toBe(before);
    }
    expect(ids).toEqual(["first-step", "first-push", "first-cache", "first-cache", "first-exit"]);
    expect(steps).toEqual([1, 2, 3, 3, 4, 4]);
    expect(getPuzzleCoachIntro(room)?.cell)
      .toBe(puzzleNeighbor(room, room.start, room.solution[0]));
    expect(coachAt(room, room.solution)).toBeNull();
  });

  it("rewinds first-room steps on undo and does not treat walking loops as new lessons", () => {
    const room = chamber(1);
    const route: PuzzleDirection[] = ["down", "right", "up", "down", "up", "down"];
    expect(getPuzzleTutorialProgress(room, at(room, route), { actions: route })?.step).toBe(3);
    for (const [length, step] of [[2, 3], [1, 2], [0, 1]]) {
      const actions = route.slice(0, length);
      expect(getPuzzleTutorialProgress(room, at(room, actions), { actions })?.step).toBe(step);
    }
  });

  it("makes every Learn glow a legal next input instead of a distant objective", () => {
    const room = chamber(1);
    const routes: PuzzleDirection[][] = [
      room.solution,
      ["down", "right", "up", "right", "right", "down", "down"],
      ["down", "down", "right", "right", "up", "up", "left", "left", "down", "right"],
    ];
    for (const route of routes) {
      for (let length = 0; length <= route.length; length++) {
        const actions = route.slice(0, length);
        const state = at(room, actions);
        const coach = getPuzzleCoach(room, state, { actions });
        if (coach?.cell !== undefined) {
          const direction = PUZZLE_DIRECTIONS.find(
            (input) => puzzleNeighbor(room, state.player, input) === coach.cell,
          );
          expect(direction).toBeDefined();
          expect(movePuzzle(room, state, direction!).moved).toBe(true);
        }
      }
    }
    expect(coachAt(room, ["down", "right"])).toMatchObject({ id: "first-cache", cell: 20 });
    expect(coachAt(room, ["down", "right", "up"])?.cell).toBeUndefined();
    expect(coachAt(room, routes[2])).toMatchObject({ id: "first-exit" });
    expect(coachAt(room, routes[2])?.cell).toBeUndefined();
  });

  it("allows an off-route legal move and offers recovery without forcing an answer", () => {
    const room = chamber(1);
    const initial = initialPuzzleState(room);
    const alternate = movePuzzle(room, initial, "right");
    expect(alternate.moved).toBe(true);
    expect(getPuzzleCoach(room, alternate.state)).toMatchObject({ id: "first-experiment" });
    expect(getPuzzleCoach(room, alternate.state)?.cell).toBeUndefined();
    expect(getPuzzleCoach(room, alternate.state)?.text).toMatch(/Undo.*Restart.*Hints.*free/);
    expect(getPuzzleTutorialProgress(room, alternate.state)?.step).toBe(2);
    expect(getPuzzleCoach(room, initial)?.id).toBe("first-step");
  });

  it("allows skipping optional treasure or finding it before restoring a rune", () => {
    const room = chamber(1);
    const skip: PuzzleDirection[] = ["down", "right", "up", "right", "right", "down", "down"];
    const skipped = at(room, skip);
    expect(skipped.status).toBe("solved");
    expect(skipped.collected).toEqual([]);
    expect(getPuzzleTutorialProgress(room, skipped, { actions: skip })).toMatchObject({ complete: true, step: 4 });
    expect(isPuzzleCoachComplete(room, skipped, { actions: skip })).toBe(true);
    const cacheFirst: PuzzleDirection[] = ["down", "down", "right", "right", "up", "up", "left", "left", "down", "right"];
    expect(coachAt(room, cacheFirst)?.id).toBe("first-exit");
    expect(getPuzzleTutorialProgress(room, at(room, cacheFirst))?.step).toBe(4);
  });

  it("keeps Practice objective-only on every route position, independent of an authored answer", () => {
    const room = chamber(2);
    const noAnswer = { ...room, solution: [] };
    for (let length = 0; length <= room.solution.length; length++) {
      const actions = room.solution.slice(0, length);
      const state = at(room, actions);
      const coach = getPuzzleCoach(room, state, { actions });
      expect(coach).toEqual(getPuzzleCoach(noAnswer, state, { actions }));
      if (coach) {
        expect(coach.kind).toBe("objective");
        expect(coach.cell).toBeUndefined();
      }
    }
    const restored = room.solution.slice(0, 6);
    expect(coachAt(room, restored)?.id).toBe("practice-exit");
  });

  it("fades Trial only after meaningful action and restores its nudge when that action is undone", () => {
    const room = chamber(3);
    const walk: PuzzleDirection[] = ["up"];
    expect(at(room, walk).pushes).toBe(0);
    expect(coachAt(room, walk)).toMatchObject({ id: "matching-colors", kind: "introduction" });
    expect(coachAt(room, walk)?.cell).toBeUndefined();
    const push: PuzzleDirection[] = ["up", "right"];
    expect(at(room, push).pushes).toBe(1);
    expect(coachAt(room, push)).toBeNull();
    expect(isPuzzleCoachComplete(room, at(room, push), { actions: push })).toBe(true);
    expect(getPuzzleTutorialProgress(room, at(room, push), { actions: push }))
      .toMatchObject({ step: 2, complete: false });
    expect(coachAt(room, walk)?.id).toBe("matching-colors");
    expect(coachAt(room, ["right"])).toBeNull(); // A real cache pickup is meaningful, too.
    expect(getPuzzleCoach({ ...room, solution: [] }, at(room, walk), { actions: walk }))
      .toEqual(coachAt(room, walk));
  });
});

describe("Rune Delve contextual mechanic introductions", () => {
  it.each([
    [7, "first-plate"],
    [13, "first-ice"],
    [19, "first-passage"],
    [25, "first-key"],
    [31, "first-rift"],
  ] as const)("introduces adventure %i only in the visible room", (order, id) => {
    const room = chamber(order);
    const state = initialPuzzleState(room);
    const before = JSON.stringify(state);
    const coach = getPuzzleCoach(room, state)!;
    expect(coach).toMatchObject({ id, kind: "introduction" });
    expect(getPuzzleCoachIntro(room)).toEqual(coach);
    expect(getPuzzleTutorialProgress(room, state)).toBeNull();
    expect(isPuzzleCoachComplete(room, state)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    if (coach.cell !== undefined) {
      expect(puzzleAreaIndex(coach.cell)).toBe(puzzleAreaIndex(state.player));
      expect(room.walls).not.toContain(coach.cell);
    }
  });

  it("keeps gate guidance through plate use, correctly explains reclosure, and fades after crossing", () => {
    const room = chamber(7);
    expect(coachAt(room, ["up"])?.id).toBe("gate-held");
    const offPlate: PuzzleDirection[] = ["up", "up"];
    expect(puzzleOpenGates(room, at(room, offPlate))).toEqual([]);
    expect(coachAt(room, offPlate)).toMatchObject({ id: "first-plate", title: "Keep the way open", cell: 19 });
    expect(coachAt(room, offPlate)?.text).toContain("closes");
    expect(coachAt(room, room.solution.slice(0, 3))?.id).toBe("gate-held");
    for (let length = 4; length <= room.solution.length; length++)
      expect(coachAt(room, room.solution.slice(0, length))).toBeNull();
    expect(coachAt(room, room.solution.slice(0, 3))?.id).toBe("gate-held");
  });

  it("distinguishes walking on ice and ordinary pushes from a real slide", () => {
    const room = chamber(13);
    const walk: PuzzleDirection[] = ["right", "right", "down"];
    expect(room.ice).toContain(at(room, walk).player);
    expect(coachAt(room, walk)?.id).toBe("first-ice");
    const dryPush: PuzzleDirection[] = ["down", "down", "right", "up"];
    expect(at(room, dryPush).pushes).toBe(1);
    expect(coachAt(room, dryPush)?.id).toBe("first-ice");
    expect(coachAt(room, ["down"])?.id).toBe("first-ice");
    for (let length = 2; length <= room.solution.length; length++)
      expect(coachAt(room, room.solution.slice(0, length))).toBeNull();
  });

  it("fades passage teaching only after real discovery, remembers a return, and rewinds on undo", () => {
    const room = chamber(19);
    const discovery = room.solution.findIndex((_, index) =>
      at(room, room.solution.slice(0, index + 1)).visitedAreas!.length > 1,
    ) + 1;
    expect(discovery).toBeGreaterThan(0);
    expect(coachAt(room, room.solution.slice(0, discovery - 1))?.id).toBe("first-passage");
    for (let length = discovery; length <= room.solution.length; length++)
      expect(coachAt(room, room.solution.slice(0, length))).toBeNull();
    expect(coachAt(room, [])?.id).toBe("first-passage");
  });

  it("teaches collecting a covered key, retains the lock objective, then fades after crossing", () => {
    const room = chamber(25);
    const covered = room.solution.slice(0, 8);
    const coveredState = at(room, covered);
    expect(coveredState.keys).toEqual([]);
    expect(coveredState.stones.some((stone) => room.keys!.some((key) => key.cell === stone.cell))).toBe(true);
    expect(coachAt(room, covered)?.text).toMatch(/rune off the key/);
    const pickup = room.solution.slice(0, 9);
    expect(at(room, pickup).keys).toEqual(["gold"]);
    expect(coachAt(room, pickup)?.id).toBe("key-attuned");
    const crossed = room.solution.findIndex((_, index) => {
      const state = at(room, room.solution.slice(0, index + 1));
      return room.doors!.some((door) => door.cell === state.player);
    }) + 1;
    expect(crossed).toBeGreaterThan(9);
    expect(coachAt(room, room.solution.slice(0, crossed - 1))?.id).toBe("key-attuned");
    for (let length = crossed; length <= room.solution.length; length++)
      expect(coachAt(room, room.solution.slice(0, length))).toBeNull();
    expect(coachAt(room, pickup)?.id).toBe("key-attuned");
  });

  it("does not confuse a regular doorway with a rift, and remembers a rift after stepping away", () => {
    const room = chamber(31);
    const doorway = room.solution.slice(0, 4);
    expect(at(room, doorway).visitedAreas!.length).toBe(2);
    expect(coachAt(room, doorway)?.id).toBe("first-rift");
    expect(coachAt(room, room.solution.slice(0, 16))?.id).toBe("first-rift");
    for (let length = 17; length <= room.solution.length; length++)
      expect(coachAt(room, room.solution.slice(0, length))).toBeNull();
    expect(coachAt(room, room.solution.slice(0, 16))?.id).toBe("first-rift");
  });

  it("ignores stale or invalid history rather than graduating a restarted lesson", () => {
    for (const order of [3, 7, 13, 19, 25, 31]) {
      const room = chamber(order);
      const initial = initialPuzzleState(room);
      expect(getPuzzleCoach(room, initial, { actions: room.solution }))
        .toEqual(getPuzzleCoach(room, initial));
      expect(isPuzzleCoachComplete(room, initial, { actions: room.solution })).toBe(false);
    }
    const room = chamber(7);
    const state = at(room, ["up", "up"]);
    expect(getPuzzleCoach(room, state, { actions: ["right", "up"] }))
      .toEqual(getPuzzleCoach(room, state));
  });

  it("leaves ordinary chambers independent without reviving earlier teaching", () => {
    for (const order of [4, 6, 8, 12, 14, 18, 20, 24, 26, 30, 32, 36]) {
      const room = chamber(order);
      const state = initialPuzzleState(room);
      expect(getPuzzleCoach(room, state)).toBeNull();
      expect(getPuzzleCoachIntro(room)).toBeNull();
      expect(getPuzzleTutorialProgress(room, state)).toBeNull();
    }
  });

  it("preserves every released solution and all scoring while teaching remains pure", () => {
    const definitions = JSON.stringify(PUZZLE_ROOMS);
    for (const room of PUZZLE_ROOMS) {
      const actions: PuzzleDirection[] = [];
      let state: PuzzleState = initialPuzzleState(room);
      for (const direction of room.solution) {
        const before = JSON.stringify(state);
        getPuzzleCoach(room, state, { actions });
        getPuzzleTutorialProgress(room, state, { actions });
        isPuzzleCoachComplete(room, state, { actions });
        expect(JSON.stringify(state)).toBe(before);
        const result = movePuzzle(room, state, direction);
        expect(result.moved).toBe(true);
        state = result.state;
        actions.push(direction);
      }
      expect(state.status).toBe("solved");
      expect(puzzleStars(room, state)).toBe(3);
      expect(getPuzzleCoach(room, state, { actions })).toBeNull();
    }
    expect(JSON.stringify(PUZZLE_ROOMS)).toBe(definitions);
  });
});
