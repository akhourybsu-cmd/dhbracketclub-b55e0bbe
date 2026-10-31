// Offline authoring: solve the actual rules, then freeze the resulting room data.
// Bundle with esbuild --bundle --platform=node --format=esm before running.
import { writeFileSync } from "node:fs";
import {
  initialPuzzleState,
  replayPuzzle,
  validatePuzzleRoom,
  puzzleStars,
} from "../src/lib/runedelve/puzzles/engine";
import { solvePuzzle } from "../src/lib/runedelve/puzzles/solver";
import type {
  PuzzleDirection,
  PuzzleRoom,
} from "../src/lib/runedelve/puzzles/types";

type Coord = [number, number];
type Draft = {
  title: string;
  lesson: string;
  map: string[];
  plates?: Coord[];
  ice?: Coord[];
  guardian?: {
    at: Coord;
    color: "red" | "blue" | "green" | "gold";
    archetypeId: string;
    name: string;
  };
  initial?: PuzzleDirection[];
};
const drafts: Draft[] = [
  {
    title: "First Light",
    lesson: "Push the ember rune onto its matching sigil.",
    map: ["######", "#@...#", "#.rR.#", "#..*E#", "#....#", "######"],
    initial: ["down", "right", "down", "right", "right"],
  },
  {
    title: "Behind the Rune",
    lesson: "Find the pushing side before choosing a route.",
    map: ["######", "#...E#", "#R.r.#", "#.*@.#", "#....#", "######"],
    initial: [
      "right",
      "up",
      "left",
      "left",
      "down",
      "right",
      "right",
      "up",
      "up",
    ],
  },
  {
    title: "Crossed Intentions",
    lesson: "A finished rune can block your next pushing position.",
    map: ["######", "#..B.#", "#..b.#", "#.rRE#", "#@*..#", "######"],
    initial: [
      "right",
      "right",
      "up",
      "up",
      "left",
      "left",
      "down",
      "right",
      "down",
      "right",
      "right",
      "up",
    ],
  },
  {
    title: "The Narrow Exchange",
    lesson: "Use both corridors to reach the backs of the runes.",
    map: ["######", "#R..E#", "#r#..#", "#..bB#", "#@*..#", "######"],
  },
  {
    title: "The Patient Wraith",
    lesson: "Restore the blue sigil to calm the waiting wraith.",
    map: ["######", "#...*#", "#.yY.#", "#.bBX#", "#@..E#", "######"],
    guardian: {
      at: [3, 4],
      color: "blue",
      archetypeId: "rune_wraith",
      name: "Rune Wraith",
    },
  },
  {
    title: "The Threefold Seal",
    lesson: "Choose the order: three colors share a narrow workspace.",
    map: ["######", "#R.GE#", "#r.g.#", "#..bB#", "#@*..#", "######"],
  },
  {
    title: "A Living Key",
    lesson: "Step from the plate into the gate; it waits until you leave.",
    map: ["######", "#R#.E#", "#r#..#", "#p|.*#", "#@#..#", "######"],
  },
  {
    title: "A Patient Weight",
    lesson: "Leave the spare rune on the plate while you cross.",
    map: ["######", "#p.#B#", "#rb|.#", "#..|.#", "#@*#E#", "######"],
  },
  {
    title: "Two Duties",
    lesson: "One rune can restore a sigil and hold a gate open.",
    map: ["######", "#R...#", "#r.b.#", "#.#|.#", "#@*BE#", "######"],
    plates: [[1, 1]],
  },
  {
    title: "The Shutter Exchange",
    lesson: "Borrow a rune as a weight, then put it back on its sigil.",
    map: ["######", "#.E#R#", "#p.|.#", "#br|.#", "#B@|.#", "######"],
    plates: [[2, 1]],
    guardian: undefined,
  },
  {
    title: "The Keeper's Shortcut",
    lesson: "Calm the golem to recover the cache on its guarded tile.",
    map: ["######", "#.@..#", "#..#R#", "#gr|.#", "#pX|E#", "######"],
    guardian: {
      at: [4, 2],
      color: "red",
      archetypeId: "stone_golem",
      name: "Stone Golem",
    },
  },
  {
    title: "The Crystal Lock",
    lesson: "Make room for each color before closing its route.",
    map: ["##*###", "#R|EB#", "#..b.#", "#.gr.#", "#G..@#", "######"],
    plates: [[1, 4]],
  },
  {
    title: "First Drift",
    lesson: "Pushed runes slide across ice; your delver walks normally.",
    map: ["######", "#@...#", "#.r~~#", "#..*R#", "#...E#", "######"],
  },
  {
    title: "Make a Stop",
    lesson: "Use the spare rune as a brake beside the icy sigil.",
    map: ["######", "#@...#", "#.rR.#", "#..#b#", "#E.*.#", "######"],
    ice: [[2, 3]],
  },
  {
    title: "The Frozen Shutter",
    lesson: "Hold the gates before sending a rune across their ice.",
    map: ["######", "#p.#R#", "#gr|.#", "#..|.#", "#@*|E#", "######"],
    ice: [[2, 3]],
  },
  {
    title: "Crosswind",
    lesson: "Slide the lower rune only after clearing the upper lane.",
    map: ["######", "#R..E#", "#~r..#", "#B.b~#", "#@*..#", "######"],
    ice: [[3, 2]],
  },
  {
    title: "The Sleeping Sentinel",
    lesson: "Restore the blue sigil to open a lane behind the ember rune.",
    map: ["######", "#R..E#", "#~r#.#", "#..bB#", "#@.X*#", "######"],
    guardian: {
      at: [4, 3],
      color: "blue",
      archetypeId: "cursed_knight",
      name: "Cursed Knight",
    },
  },
  {
    title: "Heart of the Vault",
    lesson: "A temporary move can open the route to a permanent solution.",
    map: ["###*##", "#G~@R#", "#|r..#", "#.bg.#", "#B..E#", "######"],
    plates: [[1, 1]],
  },
];
const colors = { r: "red", b: "blue", g: "green", y: "gold" } as const;
const prefixes = ["ember", "crystal", "vault"];
const chapters = [
  {
    id: 1,
    title: "Ember Caves",
    subtitle: "Find a route. Restore the sigils.",
    mechanic: "runes",
    firstRoom: 1,
    lastRoom: 6,
  },
  {
    id: 2,
    title: "Crystal Hollow",
    subtitle: "Hold the plates. Open a passage.",
    mechanic: "gates",
    firstRoom: 7,
    lastRoom: 12,
  },
  {
    id: 3,
    title: "Shattered Vault",
    subtitle: "Read the ice. Choose a stopping point.",
    mechanic: "ice",
    firstRoom: 13,
    lastRoom: 18,
  },
];
const cell = ([r, c]: Coord) => r * 6 + c;
function build(draft: Draft, index: number): PuzzleRoom {
  const chapter = (Math.floor(index / 6) + 1) as 1 | 2 | 3;
  const room: PuzzleRoom = {
    id: `${prefixes[chapter - 1]}-${String((index % 6) + 1).padStart(2, "0")}`,
    version: 1,
    order: index + 1,
    chapter,
    title: draft.title,
    lesson: draft.lesson,
    mechanic: chapters[chapter - 1].mechanic as PuzzleRoom["mechanic"],
    width: 6,
    height: 6,
    walls: [],
    start: -1,
    exit: -1,
    stones: [],
    sigils: [],
    plates: [],
    gates: [],
    ice: [],
    treasures: [],
    parPushes: 100,
    solution: draft.initial ?? [],
  };
  if (draft.map.length !== 6 || draft.map.some((row) => row.length !== 6))
    throw Error(`Invalid map ${room.id}`);
  draft.map.forEach((row, r) =>
    [...row].forEach((mark, c) => {
      const at = r * 6 + c;
      if (mark === "#") room.walls.push(at);
      else if (mark === "@") room.start = at;
      else if (mark === "E") room.exit = at;
      else if (mark === "*") room.treasures.push(at);
      else if (mark === "p") room.plates.push(at);
      else if (mark === "|") room.gates.push(at);
      else if (mark === "~") room.ice.push(at);
      else if (mark.toLowerCase() in colors) {
        const color = colors[mark.toLowerCase() as keyof typeof colors];
        if (mark === mark.toLowerCase())
          room.stones.push({
            id: `rune-${room.stones.length + 1}`,
            color,
            cell: at,
          });
        else room.sigils.push({ color, cell: at });
      }
    }),
  );
  if (draft.plates)
    room.plates = [
      ...new Set([...room.plates, ...draft.plates.map(cell)]),
    ].sort((a, b) => a - b);
  if (draft.ice)
    room.ice = [...new Set([...room.ice, ...draft.ice.map(cell)])].sort(
      (a, b) => a - b,
    );
  if (draft.guardian)
    room.guardian = {
      cell: cell(draft.guardian.at),
      color: draft.guardian.color,
      archetypeId: draft.guardian.archetypeId,
      name: draft.guardian.name,
    };
  // The keeper literally guards the optional cache; the room can be left without it.
  if (index === 10) room.treasures.push(cell([4, 2]));
  if (index === 9) room.treasures.push(cell([3, 4]));
  return room;
}
const rooms = drafts.map(build);
const report = [];
let failed = false;
for (const room of rooms) {
  const errors = validatePuzzleRoom(room);
  if (errors.length) {
    console.error(room.id, errors);
    failed = true;
    continue;
  }
  if (process.argv.includes("--draft")) continue;
  const result = solvePuzzle(room, initialPuzzleState(room), {
    maxStates: 300000,
    requireTreasure: true,
  });
  report.push({ id: room.id, ...result, actions: result.actions.length });
  console.log(
    room.id,
    result.status,
    `pushes=${result.pushes}`,
    `moves=${result.actions.length}`,
    `states=${result.explored}`,
  );
  if (result.status !== "solved") {
    failed = true;
    continue;
  }
  room.solution = result.actions;
  room.parPushes = result.pushes;
  const replay = replayPuzzle(room, room.solution);
  if (
    !replay.valid ||
    replay.state.status !== "solved" ||
    puzzleStars(room, replay.state) !== 3
  )
    throw Error(`Golden solution failed ${room.id}`);
}
writeFileSync(
  "/tmp/rune-puzzle-authoring-results.json",
  JSON.stringify(report, null, 2),
);
if (failed)
  throw Error("Room authoring failed; definitions were not overwritten");
const encoded = JSON.stringify(rooms, null, 2);
writeFileSync("src/lib/runedelve/puzzles/rooms.json", encoded + "\n");
writeFileSync(
  "src/lib/runedelve/puzzles/rooms.ts",
  `// Authored rooms. Regenerate with scripts/author-rune-puzzles.ts; do not edit a released version in place.\nimport type { PuzzleRoom } from "./types";\n\nexport const PUZZLE_CHAPTERS = ${JSON.stringify(chapters, null, 2)} as const;\n\nexport const PUZZLE_ROOMS: readonly PuzzleRoom[] = ${encoded};\n\nexport const PUZZLE_ROOM_BY_ID: ReadonlyMap<string, PuzzleRoom> = new Map(PUZZLE_ROOMS.map(room => [room.id, room]));\nexport function getPuzzleRoom(id: string | number): PuzzleRoom | undefined {\n return typeof id === "number" ? PUZZLE_ROOMS.find(room => room.order === id) : PUZZLE_ROOM_BY_ID.get(id);\n}\n`,
);
console.log(
  `Wrote ${rooms.length} ${process.argv.includes("--draft") ? "draft" : "verified"} rooms.`,
);
