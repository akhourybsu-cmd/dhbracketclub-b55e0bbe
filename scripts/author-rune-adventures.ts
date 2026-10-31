// Offline adventure authoring. Run the bundled script from the repository root.
// Released orders 1–18 are loaded verbatim and may never be regenerated here.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  initialPuzzleState,
  movePuzzle,
  puzzleStars,
  replayPuzzle,
  validatePuzzleRoom,
} from "../src/lib/runedelve/puzzles/engine";
import { solvePuzzle } from "../src/lib/runedelve/puzzles/solver";
import type {
  PuzzleChapter,
  PuzzleRoom,
} from "../src/lib/runedelve/puzzles/types";

const released: PuzzleRoom[] = JSON.parse(
  readFileSync("src/lib/runedelve/puzzles/rooms.json", "utf8"),
).slice(0, 18);
const stable = (value: unknown): string =>
  JSON.stringify(
    value && typeof value === "object"
      ? Array.isArray(value)
        ? value.map((v) => JSON.parse(stable(v)))
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
if (
  createHash("sha256").update(stable(released)).digest("hex") !==
  "c9c42e63af6c3e44694b4471fbceaed0efa98ae7681f6e05b96581778e5da169"
)
  throw Error("Released chambers changed; authoring stopped.");
type Local = Pick<
  PuzzleRoom,
  | "walls"
  | "stones"
  | "sigils"
  | "plates"
  | "gates"
  | "ice"
  | "treasures"
  | "guardian"
>;
const colors = { r: "red", b: "blue", g: "green", y: "gold" } as const;
function map(rows: string[]): Local {
  const room: Local = {
    walls: [],
    stones: [],
    sigils: [],
    plates: [],
    gates: [],
    ice: [],
    treasures: [],
  };
  if (rows.length !== 6 || rows.some((row) => row.length !== 6))
    throw Error("Every local board must be 6×6");
  rows.forEach((row, r) =>
    [...row].forEach((mark, c) => {
      const cell = r * 6 + c;
      if (mark === "#") room.walls.push(cell);
      else if (mark === "*") room.treasures.push(cell);
      else if (mark === "p") room.plates.push(cell);
      else if (mark === "|") room.gates.push(cell);
      else if (mark === "~") room.ice.push(cell);
      else if (mark.toLowerCase() in colors) {
        const color = colors[mark.toLowerCase() as keyof typeof colors];
        if (mark === mark.toLowerCase())
          room.stones.push({
            id: `rune-${room.stones.length + 1}`,
            color,
            cell,
          });
        else room.sigils.push({ color, cell });
      }
    }),
  );
  return room;
}
const clone = (id: string): Local => {
  const room = released.find((r) => r.id === id)!;
  return structuredClone({
    walls: room.walls,
    stones: room.stones,
    sigils: room.sigils,
    plates: room.plates,
    gates: room.gates,
    ice: room.ice,
    treasures: room.treasures,
    ...(room.guardian ? { guardian: room.guardian } : {}),
  });
};
const recolor = (
  board: Local,
  from: string,
  to: "red" | "blue" | "green" | "gold",
): Local => {
  const result = structuredClone(board);
  for (const item of [...result.stones, ...result.sigils])
    if (item.color === from) item.color = to;
  if (result.guardian?.color === from) result.guardian.color = to;
  return result;
};
// The rear alcove must be reached before turning the rune into its final lane.
const carry = (color: "r" | "b" | "g" | "y") =>
  map([
    "######",
    `#${color.toUpperCase()}####`,
    "#.####",
    `#...${color}.`,
    "*.....",
    "#.####",
  ]);
const vertical = (color: "r" | "b" | "g" | "y") =>
  map([
    "######",
    `#${color.toUpperCase()}####`,
    "#.####",
    `#${color}####`,
    "*...##",
    "#.####",
  ]);
const foyer = () =>
  map(["######", "#....#", "#....#", "#....#", "#....#", "######"]);
// Eight necessary pushes and three changes of pushing side, with no independent
// free-roaming stones to multiply the global search state.
const turns = (color: "r" | "b" | "g" | "y") =>
  map([
    "######",
    `#${color.toUpperCase()}...#`,
    `#.##${color}#`,
    "#.##..",
    "*.....",
    "#..##.",
  ]);
const riftCarry = (color: "r" | "b" | "g" | "y") =>
  map([
    "######",
    `#${color.toUpperCase()}.###`,
    "#.####",
    `#...${color}.`,
    "*...#.",
    "#.####",
  ]);
const riftTurns = (color: "r" | "b" | "g" | "y") =>
  map([
    "######",
    `#${color.toUpperCase()}...#`,
    `#..#${color}#`,
    "#.##..",
    "*.....",
    "#.###.",
  ]);
const at = (area: number, cell: number) => area * 36 + cell;
type Link = [number, number, number, number, ("passage" | "rift")?];
interface Draft {
  title: string;
  lesson: string;
  areas: [string, Local][];
  links: Link[];
  start: [number, number];
  exit: [number, number];
  change?: (room: PuzzleRoom) => void;
}
const drafts: Draft[] = [
  {
    title: "A Door Beyond",
    lesson: "Follow the archway. A second room remembers your first.",
    areas: [
      ["Arrival Court", foyer()],
      ["First Annex", vertical("r")],
    ],
    links: [[0, 28, 1, 31]],
    start: [0, 7],
    exit: [0, 10],
  },
  {
    title: "Two Seals, One Portal",
    lesson: "Both rooms share one portal. Restore a seal, then find the other.",
    areas: [
      ["Ember Hall", carry("r")],
      ["Aqua Annex", vertical("b")],
    ],
    links: [[0, 31, 1, 31]],
    start: [0, 26],
    exit: [0, 27],
  },
  {
    title: "The Distant Shutter",
    lesson: "A restored seal can hold a distant pressure gate open.",
    areas: [
      ["Shutter Hall", carry("r")],
      ["Counterweight Room", vertical("b")],
    ],
    links: [[0, 31, 1, 31]],
    start: [0, 26],
    exit: [0, 27],
    change: (r) => {
      r.gates.push(29);
      r.plates.push(at(1, 7));
    },
  },
  {
    title: "The Borrowed Brake",
    lesson:
      "The annex has its own ice problem. Leave every room ready for your return.",
    areas: [
      ["Turning Gallery", turns("y")],
      ["Frozen Workshop", clone("vault-02")],
    ],
    links: [[0, 35, 1, 7]],
    start: [0, 8],
    exit: [0, 9],
  },
  {
    title: "The Keeper's Far Room",
    lesson:
      "Restore the far seal to reopen the rear lane; return for the keeper’s cache.",
    areas: [
      ["Keeper's Hall", carry("r")],
      ["Blue Counterweight", carry("b")],
    ],
    links: [[0, 31, 1, 31]],
    start: [0, 26],
    exit: [0, 27],
    change: (r) => {
      r.gates.push(29);
      r.plates.push(at(1, 7));
      r.walls = r.walls.filter((c) => ![0, 6, 12].includes(c));
      r.treasures.push(0);
      r.guardian = {
        cell: 6,
        color: "red",
        archetypeId: "stone_golem",
        name: "Stone Golem",
      };
    },
  },
  {
    title: "The Gallery Relay",
    lesson:
      "Lend the shutter a weight, restore the far room, then finish the exchange.",
    areas: [
      ["The Shutter Exchange", clone("crystal-04")],
      ["Gold Carry", carry("y")],
    ],
    links: [[0, 34, 1, 31]],
    start: [0, 26],
    exit: [0, 8],
    change: (r) => {
      r.gates.push(at(1, 29));
    },
  },
  {
    title: "The First Brass Key",
    lesson:
      "A key opens every matching lock. Find it beyond the archway, then return.",
    areas: [
      ["Brass Lock Hall", carry("r")],
      ["Key Shrine", vertical("g")],
    ],
    links: [[0, 31, 1, 31]],
    start: [0, 26],
    exit: [0, 27],
    change: (r) => {
      r.keys = [{ color: "gold", cell: at(1, 13) }];
      r.doors = [{ color: "gold", cell: 29 }];
    },
  },
  {
    title: "Unlock the Turning Room",
    lesson: "Park the rune at a turn if its final pushing side is locked away.",
    areas: [
      ["Three-Turn Hall", turns("r")],
      ["Blue Key Shrine", vertical("g")],
    ],
    links: [[0, 35, 1, 31]],
    start: [0, 8],
    exit: [0, 9],
    change: (r) => {
      r.keys = [{ color: "blue", cell: at(1, 13) }];
      r.doors = [{ color: "blue", cell: 31 }];
    },
  },
  {
    title: "One Key Leads to Another",
    lesson: "Read both locks. The first key opens the route to the second.",
    areas: [
      ["Gold Key Hall", carry("r")],
      ["Blue Key Annex", carry("b")],
    ],
    links: [[0, 31, 1, 31]],
    start: [0, 26],
    exit: [0, 27],
    change: (r) => {
      r.keys = [
        { color: "blue", cell: at(1, 24) },
        { color: "gold", cell: 13 },
      ];
      r.doors = [
        { color: "blue", cell: 29 },
        { color: "gold", cell: at(1, 29) },
      ];
      r.treasures = r.treasures.filter((c) => c !== at(1, 24));
      r.treasures.push(at(1, 27));
    },
  },
  {
    title: "The Frozen Key",
    lesson:
      "A far key opens the last pushing side. Solve the ice room without spending it.",
    areas: [
      ["Turning Keep", turns("y")],
      ["Ice Key Room", clone("vault-03")],
    ],
    links: [[0, 35, 1, 31]],
    start: [0, 8],
    exit: [0, 9],
    change: (r) => {
      r.keys = [{ color: "blue", cell: at(1, 28) }];
      r.doors = [{ color: "blue", cell: 31 }];
    },
  },
  {
    title: "The Three-Room Circuit",
    lesson:
      "Three rooms make one circuit: a key, a counterweight, and a return route.",
    areas: [
      ["Outer Lock", carry("r")],
      ["Counterweight", vertical("b")],
      ["Inner Key", vertical("g")],
    ],
    links: [
      [0, 31, 1, 31],
      [1, 27, 2, 31],
    ],
    start: [0, 26],
    exit: [0, 27],
    change: (r) => {
      r.keys = [{ color: "gold", cell: at(2, 13) }];
      r.doors = [{ color: "gold", cell: 29 }];
      r.plates.push(at(1, 7));
      r.gates.push(at(2, 25));
    },
  },
  {
    title: "The Keep's Returning Seal",
    lesson:
      "The final key lies beyond a borrowed weight. Return before sealing your route.",
    areas: [
      ["Shutter Keep", clone("crystal-04")],
      ["Blue Lock Gallery", carry("g")],
      ["Key of the Keep", vertical("y")],
    ],
    links: [
      [0, 34, 1, 31],
      [1, 27, 2, 31],
    ],
    start: [0, 26],
    exit: [0, 8],
    change: (r) => {
      r.keys = [{ color: "blue", cell: at(2, 13) }];
      r.doors = [{ color: "blue", cell: at(1, 29) }];
      r.gates.push(at(1, 28));
    },
  },
  {
    title: "A Fold in the Room",
    lesson:
      "Rifts move you, not runestones. Use the fold to reach the pushing side.",
    areas: [
      ["Folded Hall", riftCarry("r")],
      ["Quiet Annex", vertical("b")],
    ],
    links: [
      [0, 31, 1, 31],
      [0, 8, 0, 29, "rift"],
    ],
    start: [0, 26],
    exit: [0, 27],
  },
  {
    title: "The Rift at the Last Turn",
    lesson:
      "A rift can reach a pushing position that an ordinary corridor cannot.",
    areas: [
      ["Star Turning Room", riftTurns("y")],
      ["Blue Annex", vertical("b")],
    ],
    links: [
      [0, 35, 1, 31],
      [0, 14, 0, 31, "rift"],
    ],
    start: [0, 8],
    exit: [0, 9],
  },
  {
    title: "Return Through Starlight",
    lesson:
      "Carry a key through the fold, then come back to release the waiting rune.",
    areas: [
      ["Folded Lock", riftCarry("r")],
      ["Green Key Gallery", carry("g")],
    ],
    links: [
      [0, 31, 1, 31],
      [0, 8, 0, 29, "rift"],
    ],
    start: [0, 26],
    exit: [0, 27],
    change: (r) => {
      r.keys = [{ color: "green", cell: at(1, 13) }];
      r.doors = [{ color: "green", cell: at(0, 23) }];
    },
  },
  {
    title: "The Frozen Constellation",
    lesson:
      "Ice carries stones; rifts carry you. Plan where each journey ends.",
    areas: [
      ["Folded Turning Room", riftTurns("y")],
      ["Frozen Shutter", clone("vault-03")],
    ],
    links: [
      [0, 35, 1, 31],
      [0, 14, 0, 31, "rift"],
    ],
    start: [0, 8],
    exit: [0, 9],
  },
  {
    title: "The Observatory Circuit",
    lesson:
      "Restore the counterweight, cross the fold, then recover the key behind the last seal.",
    areas: [
      ["Star Lock", riftCarry("r")],
      ["Frozen Counterweight", clone("vault-03")],
      ["Green Key Shrine", vertical("b")],
    ],
    links: [
      [0, 31, 1, 31],
      [1, 28, 2, 31],
      [0, 8, 0, 29, "rift"],
    ],
    start: [0, 26],
    exit: [0, 27],
    change: (r) => {
      r.keys = [{ color: "green", cell: at(2, 13) }];
      r.doors = [{ color: "green", cell: 23 }];
      r.gates.push(at(2, 25));
    },
  },
  {
    title: "The Living Hollow",
    lesson:
      "Every discovery has a purpose. Read the three rooms before sealing the final route.",
    areas: [
      ["The Last Turning Room", riftTurns("y")],
      ["Keeper's Red Gallery", carry("r")],
      ["Green Key Sanctuary", vertical("b")],
    ],
    links: [
      [0, 35, 1, 31],
      [1, 27, 2, 31],
      [0, 14, 0, 31, "rift"],
    ],
    start: [0, 8],
    exit: [0, 9],
    change: (r) => {
      r.keys = [{ color: "green", cell: at(2, 13) }];
      r.doors = [{ color: "green", cell: at(1, 29) }];
      r.plates.push(at(1, 7));
      r.gates.push(at(0, 23));
    },
  },
];
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
  {
    id: 4,
    title: "Sunken Galleries",
    subtitle: "Follow the archways. Bring every room to life.",
    mechanic: "passages",
    firstRoom: 19,
    lastRoom: 24,
  },
  {
    id: 5,
    title: "Verdant Keep",
    subtitle: "Find a key. Return through a changed world.",
    mechanic: "keys",
    firstRoom: 25,
    lastRoom: 30,
  },
  {
    id: 6,
    title: "Astral Observatory",
    subtitle: "Fold the room. Complete the final circuit.",
    mechanic: "rifts",
    firstRoom: 31,
    lastRoom: 36,
  },
] as const;
const prefixes = ["galleries", "keep", "astral"];
function build(draft: Draft, index: number): PuzzleRoom {
  const chapter = (4 + Math.floor(index / 6)) as PuzzleChapter;
  const room: PuzzleRoom = {
    id: `${prefixes[chapter - 4]}-${String((index % 6) + 1).padStart(2, "0")}`,
    version: 1,
    order: index + 19,
    chapter,
    title: draft.title,
    lesson: draft.lesson,
    mechanic: chapters[chapter - 1].mechanic,
    width: 6,
    height: 6,
    walls: [],
    start: at(...draft.start),
    exit: at(...draft.exit),
    stones: [],
    sigils: [],
    plates: [],
    gates: [],
    ice: [],
    treasures: [],
    areas: draft.areas.map(([title], i) => ({ id: `room-${i + 1}`, title })),
    passages: draft.links.map(([a, x, b, y, kind]) => ({
      a: at(a, x),
      b: at(b, y),
      ...(kind ? { kind } : {}),
    })),
    parPushes: 100,
    solution: [],
  };
  draft.areas.forEach(([, board], i) => {
    for (const key of ["walls", "plates", "gates", "ice", "treasures"] as const)
      room[key].push(...board[key].map((c) => at(i, c)));
    room.stones.push(
      ...board.stones.map((stone) => ({
        ...stone,
        id: `area-${i}-${stone.id}`,
        cell: at(i, stone.cell),
      })),
    );
    room.sigils.push(
      ...board.sigils.map((sigil) => ({ ...sigil, cell: at(i, sigil.cell) })),
    );
    if (board.guardian) {
      if (room.guardian) throw Error("Only one guardian supported");
      room.guardian = { ...board.guardian, cell: at(i, board.guardian.cell) };
    }
  });
  const endpoints = room.passages!.flatMap((p) => [p.a, p.b]);
  room.walls = room.walls.filter((c) => !endpoints.includes(c));
  draft.change?.(room);
  for (const key of ["walls", "plates", "gates", "ice", "treasures"] as const)
    room[key] = [...new Set(room[key])].sort((a, b) => a - b);
  return room;
}
const rooms = drafts.map(build);
const selected = process.argv
  .find((arg) => arg.startsWith("--only="))
  ?.slice(7);
const report = [];
let failed = false;
for (const room of rooms) {
  if (selected && !room.id.includes(selected)) continue;
  const errors = validatePuzzleRoom(room);
  if (errors.length) {
    console.error(room.id, errors);
    failed = true;
    continue;
  }
  const result = solvePuzzle(room, initialPuzzleState(room), {
    maxStates: 75000,
    requireTreasure: true,
  });
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
  room.parPushes = result.pushes;
  room.solution = result.actions;
  const replay = replayPuzzle(room, room.solution);
  if (
    !replay.valid ||
    replay.state.status !== "solved" ||
    puzzleStars(room, replay.state) !== 3
  )
    throw Error("Invalid authored gold route " + room.id);
  let state = initialPuzzleState(room),
    transitions = 0,
    riftTrips = 0;
  for (const action of room.solution) {
    const old = state;
    state = movePuzzle(room, state, action).state;
    if (Math.floor(old.player / 36) !== Math.floor(state.player / 36))
      transitions++;
    else if (
      Math.abs(old.player - state.player) !== 1 &&
      Math.abs(old.player - state.player) !== 6
    )
      riftTrips++;
  }
  report.push({
    id: room.id,
    chapter: room.chapter,
    areas: room.areas!.length,
    pushes: room.parPushes,
    moves: room.solution.length,
    explored: result.explored,
    transitions,
    riftTrips,
  });
}
writeFileSync(
  "/tmp/rune-adventure-authoring-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
if (failed || selected || process.argv.includes("--check")) {
  if (failed) process.exitCode = 1;
} else {
  const all = [...released, ...rooms],
    encoded = JSON.stringify(all, null, 2);
  writeFileSync("src/lib/runedelve/puzzles/rooms.json", encoded + "\n");
  writeFileSync(
    "src/lib/runedelve/puzzles/rooms.ts",
    `// Authored rooms. Regenerate additions with scripts/author-rune-adventures.ts; released versions are immutable.\nimport type { PuzzleRoom } from "./types";\n\nexport const PUZZLE_CHAPTERS = ${JSON.stringify(chapters, null, 2)} as const;\n\nexport const PUZZLE_ROOMS: readonly PuzzleRoom[] = ${encoded};\n\nexport const PUZZLE_ROOM_BY_ID: ReadonlyMap<string, PuzzleRoom> = new Map(PUZZLE_ROOMS.map(room => [room.id, room]));\nexport function getPuzzleRoom(id: string | number): PuzzleRoom | undefined { return typeof id === "number" ? PUZZLE_ROOMS.find(room => room.order === id) : PUZZLE_ROOM_BY_ID.get(id); }\n`,
  );
  writeFileSync(
    "docs/balance/rune-adventure-content.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        solverBudget: 75000,
        certificate:
          "Exact push-first solver with all treasure required; each route also replayed through the production resolver.",
        released18Hash:
          "c9c42e63af6c3e44694b4471fbceaed0efa98ae7681f6e05b96581778e5da169",
        catalogHash: createHash("sha256").update(stable(all)).digest("hex"),
        gameplayHash: createHash("sha256")
          .update(
            stable(
              all.map(({ solution: _solution, ...definition }) => definition),
            ),
          )
          .digest("hex"),
        campaign: {
          adventures: all.length,
          chapters: chapters.length,
          boards: all.reduce((n, room) => n + (room.areas?.length ?? 1), 0),
          masteryStars: all.length * 3,
        },
        original: {
          adventures: released.length,
          meanPushes:
            released.reduce((n, room) => n + room.parPushes, 0) /
            released.length,
          meanGoldActions:
            released.reduce((n, room) => n + room.solution.length, 0) /
            released.length,
        },
        additions: {
          adventures: rooms.length,
          boards: rooms.reduce((n, room) => n + (room.areas?.length ?? 1), 0),
          meanPushes:
            rooms.reduce((n, room) => n + room.parPushes, 0) / rooms.length,
          meanGoldActions:
            rooms.reduce((n, room) => n + room.solution.length, 0) /
            rooms.length,
          goldActions: rooms.reduce((n, room) => n + room.solution.length, 0),
          maxExplored: Math.max(...report.map((row) => row.explored)),
        },
        rooms: report,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Wrote ${all.length} immutable/verified chambers.`);
}
