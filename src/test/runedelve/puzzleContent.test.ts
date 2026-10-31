import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
  it("preserves the original 18 definitions and expands the canonical journey to 36", () => {
    expect(PUZZLE_ROOMS).toHaveLength(36);
    expect(PUZZLE_ROOMS.map((room) => room.order)).toEqual(
      Array.from({ length: 36 }, (_, i) => i + 1),
    );
    expect(
      PUZZLE_CHAPTERS.map(
        (chapter) =>
          PUZZLE_ROOMS.filter((room) => room.chapter === chapter.id).length,
      ),
    ).toEqual([6, 6, 6, 6, 6, 6]);
    expect(new Set(PUZZLE_ROOMS.map((room) => room.id)).size).toBe(36);
    const canonical = JSON.parse(
      readFileSync(resolve("src/lib/runedelve/puzzles/rooms.json"), "utf8"),
    );
    expect(canonical).toEqual(PUZZLE_ROOMS);
    const stable = (value: unknown): string =>
      JSON.stringify(
        value && typeof value === "object"
          ? Array.isArray(value)
            ? value.map((item) => JSON.parse(stable(item)))
            : Object.fromEntries(
                Object.keys(value)
                  .sort()
                  .map((key) => [
                    key,
                    JSON.parse(stable((value as Record<string, unknown>)[key])),
                  ]),
              )
          : value,
      );
    expect(
      createHash("sha256")
        .update(stable(PUZZLE_ROOMS.slice(0, 18)))
        .digest("hex"),
    ).toBe("c9c42e63af6c3e44694b4471fbceaed0efa98ae7681f6e05b96581778e5da169");
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
      expect(room.stones.length).toBeLessThanOrEqual(4);
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

  it("makes every new adventure explore real connected rooms and return to its portal", () => {
    for (const room of PUZZLE_ROOMS.slice(18)) {
      expect(room.areas?.length, room.id).toBeGreaterThanOrEqual(2);
      expect(room.areas?.length, room.id).toBeLessThanOrEqual(3);
      const states = trace(room);
      const visited = new Set(
        states.map((state) => Math.floor(state.player / 36)),
      );
      expect(visited.size, room.id).toBe(room.areas!.length);
      expect(states.at(-1)!.visitedAreas, room.id).toEqual(
        [...visited].sort((a, b) => a - b),
      );
      const transitions = states
        .slice(1)
        .filter(
          (state, index) =>
            Math.floor(state.player / 36) !==
            Math.floor(states[index].player / 36),
        ).length;
      expect(transitions, room.id).toBeGreaterThanOrEqual(
        (room.areas!.length - 1) * 2,
      );
      expect(Math.floor(room.exit / 36), room.id).toBe(0);
    }
  });

  it("uses keys before crossing their locks and makes every rift chapter need its rifts", () => {
    for (const room of PUZZLE_ROOMS.filter((room) => room.keys?.length)) {
      const states = trace(room);
      for (const door of room.doors ?? []) {
        const crossed = states.filter(
          (state) =>
            state.player === door.cell ||
            state.stones.some((stone) => stone.cell === door.cell),
        );
        expect(
          crossed.length,
          `${room.id}: lock is an actual route dependency`,
        ).toBeGreaterThan(0);
        expect(
          crossed.every((state) => state.keys?.includes(door.color)),
          room.id,
        ).toBe(true);
      }
      expect(states.at(-1)!.keys?.length, room.id).toBe(
        new Set(room.keys!.map((key) => key.color)).size,
      );
    }
    for (const room of PUZZLE_ROOMS.filter(
      (room) => room.mechanic === "rifts",
    )) {
      const withoutRifts = {
        ...room,
        passages: room.passages!.filter((link) => link.kind !== "rift"),
      };
      expect(validatePuzzleRoom(withoutRifts), room.id).toEqual([]);
      expect(
        solvePuzzle(withoutRifts, undefined, { maxStates: 75000 }).status,
        `${room.id}: rifts provide a necessary pushing position`,
      ).toBe("unsolvable");
    }
  });

  it("ramps the new capstones through purposeful pushes rather than walking alone", () => {
    const caps = [
      getPuzzleRoom("galleries-06")!,
      getPuzzleRoom("keep-06")!,
      getPuzzleRoom("astral-06")!,
    ];
    expect(caps.map((room) => room.parPushes)).toEqual([12, 14, 15]);
    expect(caps[2].solution.length).toBeGreaterThanOrEqual(60);
    expect(caps[2].areas).toHaveLength(3);
    expect(
      PUZZLE_ROOMS.slice(18).reduce((sum, room) => sum + room.parPushes, 0) /
        18,
    ).toBeGreaterThan(9);
    expect(
      PUZZLE_ROOMS.reduce((sum, room) => sum + (room.areas?.length ?? 1), 0),
    ).toBe(58);
  });
});
