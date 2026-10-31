import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PUZZLE_CHAPTERS,
  PUZZLE_ROOMS,
  getPuzzleRoom,
} from "@/lib/runedelve/puzzles/rooms";
import {
  initialPuzzleState,
  movePuzzle,
  puzzleStars,
  replayPuzzle,
  validatePuzzleRoom,
} from "@/lib/runedelve/puzzles/engine";
import { solvePuzzle } from "@/lib/runedelve/puzzles/solver";

function trace(room: (typeof PUZZLE_ROOMS)[number]) {
  let state = initialPuzzleState(room);
  const states = [state];
  for (const direction of room.solution) {
    const result = movePuzzle(room, state, direction);
    expect(
      result.moved,
      `${room.id}: ${direction} remains a legal authored action`,
    ).toBe(true);
    state = result.state;
    states.push(state);
  }
  return states;
}
const distance = (a: number, b: number) =>
  Math.abs(Math.floor(a / 6) - Math.floor(b / 6)) + Math.abs((a % 6) - (b % 6));

describe("Rune Delve · authored spatial journey", () => {
  it("keeps all 18 immutable room identities and SQL definitions identical", () => {
    expect(PUZZLE_ROOMS).toHaveLength(18);
    expect(PUZZLE_ROOMS.map((room) => room.order)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
    expect(
      PUZZLE_CHAPTERS.map(
        (chapter) =>
          PUZZLE_ROOMS.filter((room) => room.chapter === chapter.id).length,
      ),
    ).toEqual([6, 6, 6]);
    expect(new Set(PUZZLE_ROOMS.map((room) => room.id)).size).toBe(18);
    const canonical = JSON.parse(
      readFileSync(resolve("src/lib/runedelve/puzzles/rooms.json"), "utf8"),
    );
    expect(canonical).toEqual(PUZZLE_ROOMS);
    for (const room of PUZZLE_ROOMS) {
      expect(room.version).toBe(1);
      expect(validatePuzzleRoom(room), room.id).toEqual([]);
      expect(getPuzzleRoom(room.id)).toBe(room);
      expect(getPuzzleRoom(room.order)).toBe(room);
      expect(initialPuzzleState(room).status).toBe("playing");
    }
  });

  it.each(PUZZLE_ROOMS.map((room) => [room.id, room] as const))(
    "%s has a complete three-medal route through the real resolver",
    (_, room) => {
      const result = replayPuzzle(room, room.solution);
      expect(result.valid, room.id).toBe(true);
      expect(result.state.status).toBe("solved");
      expect(result.state.player).toBe(room.exit);
      expect(result.state.pushes).toBe(room.parPushes);
      expect(result.state.collected).toHaveLength(room.treasures.length);
      expect(puzzleStars(room, result.state)).toBe(3);
    },
  );

  it("keeps every gold route within the live hint budget and measures pushes before walking", () => {
    for (const room of PUZZLE_ROOMS) {
      const solved = solvePuzzle(room, undefined, {
        maxStates: 75000,
        requireTreasure: true,
      });
      expect(solved.status, room.id).toBe("solved");
      expect(solved.pushes, room.id).toBe(room.parPushes);
      expect(solved.explored, room.id).toBeLessThanOrEqual(75000);
    }
    expect(getPuzzleRoom("crystal-06")?.parPushes).toBeGreaterThanOrEqual(8);
    expect(getPuzzleRoom("vault-06")?.parPushes).toBeGreaterThanOrEqual(8);
    expect(PUZZLE_ROOMS.slice(0, 6).every((room) => room.parPushes <= 3)).toBe(
      true,
    );
  });

  it("makes every gate chapter route use both its plate and its open gates", () => {
    for (const room of PUZZLE_ROOMS.filter(
      (room) => room.mechanic === "gates",
    )) {
      const states = trace(room);
      expect(
        states.some(
          (state) =>
            room.plates.includes(state.player) ||
            state.stones.some((stone) => room.plates.includes(stone.cell)),
        ),
        room.id,
      ).toBe(true);
      expect(
        states.some(
          (state) =>
            room.gates.includes(state.player) ||
            state.stones.some((stone) => room.gates.includes(stone.cell)),
        ),
        room.id,
      ).toBe(true);
    }
  });

  it("uses real ice interactions, including a deliberately placed stopping stone", () => {
    let movingSlides = 0;
    for (const room of PUZZLE_ROOMS.filter((room) => room.mechanic === "ice")) {
      const states = trace(room);
      const traversedIce = states.slice(1).some((state, index) =>
        state.stones.some((stone) => {
          const previous = states[index].stones.find(
            (before) => before.id === stone.id,
          )!;
          if (previous.cell === stone.cell) return false;
          const step =
            stone.cell > previous.cell
              ? Math.floor(stone.cell / 6) === Math.floor(previous.cell / 6)
                ? 1
                : 6
              : Math.floor(stone.cell / 6) === Math.floor(previous.cell / 6)
                ? -1
                : -6;
          for (
            let cell = previous.cell + step;
            step > 0 ? cell <= stone.cell : cell >= stone.cell;
            cell += step
          )
            if (room.ice.includes(cell)) return true;
          return false;
        }),
      );
      expect(traversedIce, room.id).toBe(true);
      if (
        states
          .slice(1)
          .some((state, i) =>
            state.stones.some(
              (stone) =>
                distance(
                  stone.cell,
                  states[i].stones.find((previous) => previous.id === stone.id)!
                    .cell,
                ) > 1,
            ),
          )
      )
        movingSlides++;
    }
    expect(movingSlides).toBeGreaterThanOrEqual(5);
    const brake = getPuzzleRoom("vault-02")!;
    const brokenBrake = {
      ...brake,
      stones: brake.stones.filter((stone) => stone.color !== "blue"),
    };
    expect(
      solvePuzzle(brokenBrake, undefined, {
        maxStates: 75000,
        requireTreasure: true,
      }).status,
    ).toBe("unsolvable");
  });

  it("keeps exploration optional and uses all four rune colors without collection-strength gates", () => {
    const colors = new Set(
      PUZZLE_ROOMS.flatMap((room) => room.stones.map((stone) => stone.color)),
    );
    expect([...colors].sort()).toEqual(["blue", "gold", "green", "red"]);
    let bypassedTreasures = 0;
    for (const room of PUZZLE_ROOMS) {
      const solved = solvePuzzle(room, undefined, { maxStates: 75000 });
      expect(solved.status, room.id).toBe("solved");
      const final = replayPuzzle(room, solved.actions).state;
      if (final.collected.length < room.treasures.length) bypassedTreasures++;
      expect(room.stones.length).toBeLessThanOrEqual(3);
    }
    expect(bypassedTreasures).toBeGreaterThanOrEqual(9);
    const keeper = getPuzzleRoom("crystal-05")!;
    const plain = solvePuzzle(keeper, undefined, { maxStates: 75000 });
    let state = initialPuzzleState(keeper);
    const visited = [state.player];
    for (const direction of plain.actions) {
      state = movePuzzle(keeper, state, direction).state;
      visited.push(state.player);
    }
    expect(state.status).toBe("solved");
    expect(visited).not.toContain(keeper.guardian!.cell);
    expect(keeper.guardian!.archetypeId).toBe("stone_golem");
  });
});
