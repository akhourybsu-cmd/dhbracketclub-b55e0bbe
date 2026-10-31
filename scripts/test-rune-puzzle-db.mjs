// Isolated PostgreSQL replay, RLS and idempotency checks. Never touches live data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";

const bundled = await build({
  entryPoints: ["src/lib/runedelve/puzzles/engine.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const engine = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);
const canonical = JSON.parse(
  await readFile("src/lib/runedelve/puzzles/rooms.json", "utf8").catch(
    () => "[]",
  ),
);
const preliminary = process.argv.includes("--allow-unseeded");
if (!preliminary)
  assert.equal(
    canonical.length,
    18,
    "The launch migration must contain the complete verified campaign",
  );
const db = new PGlite();
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
await db.exec(`
create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user',true),'')::uuid$$;
grant usage on schema auth,public to anon,authenticated;
insert into auth.users values('${uid(1)}'),('${uid(2)}'),('${uid(3)}'),('${uid(4)}'),('${uid(5)}');
create table public.rune_delve_wallet(user_id uuid primary key,shards integer,lifetime_shards_earned integer);
create table public.rune_delve_class_progress(user_id uuid,class text,xp integer,level integer);
create table public.rune_delve_runs(id uuid primary key,score integer);
create table public.dh_score_history(id uuid primary key,score integer);
insert into rune_delve_wallet values('${uid(1)}',1500,2200);
insert into rune_delve_class_progress values('${uid(1)}','mage',7000,30);
insert into rune_delve_runs values('${uid(700)}',12345);
insert into dh_score_history values('${uid(701)}',456);
`);
const fingerprint = async () =>
  (
    await db.query(`select md5(string_agg(v,E'\n' order by v)) hash from (
 select to_jsonb(t)::text v from rune_delve_wallet t union all select to_jsonb(t)::text from rune_delve_class_progress t
 union all select to_jsonb(t)::text from rune_delve_runs t union all select to_jsonb(t)::text from dh_score_history t) records`)
  ).rows[0].hash;
const before = await fingerprint();
const migration = await readFile(
  "supabase/migrations/20261031050000_rune_delve_spatial_puzzles.sql",
  "utf8",
);
await db.exec(migration);
await db.exec(migration);
let checks = 0;
const check = async (name, fn) => {
  await fn();
  checks++;
  console.log("PASS", name);
};
const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const owner = async (sql, args = []) => {
  await db.exec("reset role");
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("set role authenticated");
  }
};
const actor = (n) =>
  db.query("select set_config('test.user',$1,false)", [n ? uid(n) : ""]);
const profile = async () => (await scalar("select rune_puzzle_profile() r")).r;
const complete = async (room, actions, request = uid(1000 + checks)) =>
  (
    await scalar("select rune_puzzle_complete($1,$2,$3::jsonb,$4::uuid) r", [
      room.id,
      room.version,
      JSON.stringify(actions),
      request,
    ])
  ).r;
const replaySql = async (room, actions) =>
  (
    await owner("select rune_puzzle_replay($1::jsonb,$2::jsonb) r", [
      JSON.stringify(room),
      JSON.stringify(actions),
    ])
  ).rows[0].r;
const base = {
  id: "sql-room-01",
  version: 1,
  order: 1,
  chapter: 1,
  title: "SQL routing room",
  lesson: "Restore the sigil and reach the portal.",
  mechanic: "runes",
  width: 6,
  height: 6,
  walls: [],
  start: 13,
  exit: 17,
  stones: [{ id: "a", color: "red", cell: 14 }],
  sigils: [{ color: "red", cell: 16 }],
  plates: [],
  gates: [],
  ice: [],
  treasures: [0],
  parPushes: 2,
  solution: ["right", "right", "up", "right", "right", "down"],
};
const gold = ["up", "up", "left", "right", "down", "down", ...base.solution];
const slow = [
  "right",
  "up",
  "right",
  "right",
  "down",
  "left",
  "down",
  "left",
  "left",
  "up",
  "right",
  "right",
  "up",
  "right",
  "right",
  "down",
];
const originals = (
  await db.query(
    "select room_id,definition_version from rune_puzzle_definitions where active",
  )
).rows;
if (!preliminary) {
  assert.equal(
    originals.length,
    18,
    "SQL canonical definitions match the shipped campaign",
  );
  for (const room of canonical) {
    const stored = (
      await scalar(
        "select definition from rune_puzzle_definitions where room_id=$1 and definition_version=$2",
        [room.id, room.version],
      )
    ).definition;
    const { solution: _solution, ...definition } = room;
    assert.deepEqual(
      stored,
      definition,
      `Immutable server definition matches client ${room.id}`,
    );
  }
}
await db.exec("update rune_puzzle_definitions set active=false");
const rooms = [
  base,
  { ...base, id: "sql-room-02", order: 2 },
  { ...base, id: "sql-room-03", order: 3 },
];
for (const room of rooms)
  await db.query(
    "insert into rune_puzzle_definitions(room_id,definition_version,ordinal,definition) values($1,1,$2,$3::jsonb)",
    [room.id, room.order, JSON.stringify(room)],
  );
await db.exec("set role authenticated");
await actor(1);

await check(
  "fresh puzzle progression leaves every legacy currency, XP, run and DH Score record intact",
  async () => {
    assert.deepEqual(await profile(), {
      avatar: "warrior",
      completed: 0,
      records: [],
      stars: 0,
      unlocked: 1,
    });
    const now = await owner(
      "select md5(string_agg(v,E'\n' order by v)) hash from (select to_jsonb(t)::text v from rune_delve_wallet t union all select to_jsonb(t)::text from rune_delve_class_progress t union all select to_jsonb(t)::text from rune_delve_runs t union all select to_jsonb(t)::text from dh_score_history t) records",
    );
    assert.equal(now.rows[0].hash, before);
  },
);

await check(
  "authenticated players cannot forge definitions, progress, profiles or receipts",
  async () => {
    for (const sql of [
      "insert into rune_puzzle_profiles(user_id,avatar) values(auth.uid(),'mage')",
      "update rune_puzzle_profiles set avatar='mage' where user_id=auth.uid()",
      `insert into rune_puzzle_results(user_id,room_id,definition_version,stars,best_pushes,best_moves) values(auth.uid(),'sql-room-03',1,3,1,1)`,
      "delete from rune_puzzle_results where user_id=auth.uid()",
      "update rune_puzzle_definitions set ordinal=1",
      "select * from rune_puzzle_definitions",
      "select * from rune_puzzle_receipts",
      "select rune_puzzle_progress(auth.uid())",
      "select rune_puzzle_replay('{}','[]')",
    ])
      await assert.rejects(db.exec(sql), /permission denied/);
  },
);

await check(
  "avatars are canonical, validated and scoped to the authenticated profile",
  async () => {
    const selected = (
      await scalar("select rune_puzzle_select_avatar('cleric') r")
    ).r;
    assert.equal(selected.avatar, "cleric");
    await assert.rejects(
      db.exec("select rune_puzzle_select_avatar('admin')"),
      /invalid_puzzle_avatar/,
    );
    await actor(2);
    assert.equal((await profile()).avatar, "warrior");
    const rows = await db.query("select * from rune_puzzle_profiles");
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].user_id, uid(2));
    await actor(1);
  },
);

await check(
  "anonymous and empty-JWT callers cannot read or mutate puzzle progress",
  async () => {
    await actor(null);
    await assert.rejects(profile(), /not_authenticated/);
    await db.exec("set role anon");
    await assert.rejects(profile(), /permission denied/);
    await assert.rejects(
      db.exec("select * from rune_puzzle_results"),
      /permission denied/,
    );
    await db.exec("set role authenticated");
    await actor(1);
  },
);

await check(
  "a locked or unknown chamber cannot be skipped with a valid solution",
  async () => {
    await assert.rejects(complete(rooms[1], gold), /puzzle_locked/);
    await assert.rejects(
      complete({ ...base, id: "does-not-exist" }, gold),
      /puzzle_unavailable/,
    );
    await assert.rejects(
      complete({ ...base, version: 99 }, gold),
      /puzzle_unavailable/,
    );
    assert.equal((await profile()).completed, 0);
  },
);

await check(
  "server replay rejects unsolved, blocked, malformed and oversized action trails",
  async () => {
    await assert.rejects(complete(base, ["right"]), /puzzle_not_solved/);
    await assert.rejects(
      complete(base, ["left", "left", "left"]),
      /invalid_puzzle_actions: wall:1/,
    );
    await assert.rejects(
      complete(base, ["teleport"]),
      /invalid_puzzle_actions: invalid_direction:0/,
    );
    await assert.rejects(
      complete(base, [{ cleared: true, stars: 3 }]),
      /invalid_puzzle_actions: invalid_direction:0/,
    );
    await assert.rejects(complete(base, []), /invalid_puzzle_result/);
    await assert.rejects(
      complete(base, { cleared: true, stars: 3 }),
      /invalid_puzzle_result/,
    );
    await assert.rejects(complete(base, "right"), /invalid_puzzle_result/);
    await assert.rejects(complete(base, null), /invalid_puzzle_result/);
    await assert.rejects(
      complete(base, Array(1201).fill("right")),
      /invalid_puzzle_result/,
    );
    assert.equal((await profile()).completed, 0);
    assert.equal(
      (await owner("select count(*)::integer n from rune_puzzle_receipts"))
        .rows[0].n,
      0,
    );
  },
);

let first;
await check(
  "completion derives solve, pushes, moves, treasure, stars and next unlock from canonical actions",
  async () => {
    first = await complete(base, base.solution, uid(2001));
    assert.equal(first.firstClear, true);
    assert.equal(first.stars, 2);
    assert.equal(first.starsGained, 2);
    assert.equal(first.pushes, 2);
    assert.equal(first.moves, base.solution.length);
    assert.equal(first.treasureCollected, false);
    assert.equal(first.unlocked, 2);
    assert.equal(first.progress.avatar, "cleric");
    assert.equal(first.progress.completed, 1);
    assert.equal(first.progress.stars, 2);
  },
);

await check(
  "a better replay awards only new stars and retains push-first best records",
  async () => {
    const better = await complete(base, gold, uid(2002));
    assert.equal(better.firstClear, false);
    assert.equal(better.stars, 3);
    assert.equal(better.starsGained, 1);
    assert.equal(better.treasureCollected, true);
    assert.equal(better.progress.completed, 1);
    assert.equal(better.progress.records[0].best_pushes, 2);
    assert.equal(better.progress.records[0].best_moves, base.solution.length);
    const worse = await complete(base, slow, uid(2003));
    assert.equal(worse.pushes, 4);
    assert.equal(worse.stars, 3);
    assert.equal(worse.starsGained, 0);
    assert.equal(worse.progress.records[0].best_pushes, 2);
    assert.equal(worse.progress.records[0].best_moves, base.solution.length);
  },
);

await check(
  "receipt retries remain exact after later progress, and changed payloads reject UUID reuse",
  async () => {
    await complete(rooms[1], gold, uid(2010));
    const cached = await complete(base, base.solution, uid(2001));
    assert.deepEqual(cached, first);
    assert.equal(cached.progress.completed, 1);
    assert.equal((await profile()).completed, 2);
    await assert.rejects(complete(base, gold, uid(2001)), /request_id_reused/);
    await assert.rejects(
      complete(rooms[1], base.solution, uid(2001)),
      /request_id_reused/,
    );
  },
);

await check(
  "a frozen receipt remains retryable when its definition is retired",
  async () => {
    await owner(
      "update rune_puzzle_definitions set active=false where room_id=$1",
      [base.id],
    );
    assert.deepEqual(await complete(base, base.solution, uid(2001)), first);
    await assert.rejects(
      complete(base, base.solution, uid(2099)),
      /puzzle_unavailable/,
    );
    await owner(
      "update rune_puzzle_definitions set active=true where room_id=$1",
      [base.id],
    );
  },
);

await check(
  "success cannot be followed by extra movement and the last room has no phantom unlock",
  async () => {
    await assert.rejects(
      complete(rooms[2], [...gold, "left"], uid(2020)),
      /invalid_puzzle_actions: finished/,
    );
    const last = await complete(rooms[2], gold, uid(2021));
    assert.equal(last.unlocked, 3);
    assert.equal(last.progress.completed, 3);
    assert.equal(last.progress.stars, 9);
  },
);

await check(
  "other players cannot read completions, borrow receipts or inherit avatar/progression",
  async () => {
    await actor(2);
    assert.deepEqual(await profile(), {
      avatar: "warrior",
      completed: 0,
      records: [],
      stars: 0,
      unlocked: 1,
    });
    assert.equal(
      (await db.query("select * from rune_puzzle_results")).rows.length,
      0,
    );
    await assert.rejects(complete(rooms[1], gold, uid(2010)), /puzzle_locked/);
    const own = await complete(base, base.solution, uid(2001));
    assert.equal(own.firstClear, true);
    assert.equal(own.progress.completed, 1);
    await actor(1);
  },
);

await check(
  "SQL replay matches the production engine for gates, ice, guardian state and extra weights",
  async () => {
    const cases = [
      [base, gold],
      [{ ...base, plates: [13], gates: [14] }, ["right", "up", "down"]],
      [{ ...base, plates: [13], gates: [16], ice: [15] }, ["right"]],
      [{ ...base, plates: [13], gates: [15, 16], ice: [15, 16] }, ["right"]],
      [
        {
          ...base,
          ice: [15],
          stones: [...base.stones, { id: "b", color: "green", cell: 16 }],
        },
        ["right"],
      ],
      [
        {
          ...base,
          sigils: [...base.sigils, { color: "blue", cell: 21 }],
          stones: [...base.stones, { id: "b", color: "blue", cell: 20 }],
          guardian: {
            cell: 15,
            color: "blue",
            name: "Rune Wraith",
            archetypeId: "rune_wraith",
          },
        },
        ["right"],
      ],
      [
        {
          ...base,
          sigils: [...base.sigils, { color: "blue", cell: 21 }],
          stones: [...base.stones, { id: "b", color: "blue", cell: 21 }],
          guardian: {
            cell: 15,
            color: "blue",
            name: "Rune Wraith",
            archetypeId: "rune_wraith",
          },
        },
        ["right", "right"],
      ],
      [
        {
          ...base,
          start: 6,
          exit: 35,
          sigils: [{ color: "blue", cell: 7 }],
          stones: [{ id: "ward", color: "blue", cell: 7 }],
          guardian: {
            cell: 8,
            color: "blue",
            name: "Rune Wraith",
            archetypeId: "rune_wraith",
          },
        },
        ["right", "right"],
      ],
      [
        {
          ...base,
          start: 0,
          exit: 1,
          plates: [30],
          gates: [1],
          stones: [
            { id: "b", color: "blue", cell: 35 },
            { id: "weight", color: "red", cell: 30 },
          ],
          sigils: [{ color: "blue", cell: 35 }],
          treasures: [0],
        },
        ["right"],
      ],
      [{ ...base, treasures: [13, 7, 14] }, ["up", "right", "down"]],
      [{ ...base, start: 5 }, ["right"]],
      [{ ...base, sigils: [{ cell: 16, color: "blue" }] }, base.solution],
      [base, [...base.solution, "up"]],
      [base, ["north"]],
      [base, [null]],
      [base, []],
    ];
    for (const [room, actions] of cases) {
      for (let length = 0; length <= actions.length; length++) {
        const trace = actions.slice(0, length);
        assert.deepEqual(
          await replaySql(room, trace),
          engine.replayPuzzle(room, trace),
          `${room.id}: ${JSON.stringify(trace)}`,
        );
      }
    }
  },
);

await check(
  "bounded seeded action traces agree with client replay, including invalid-move boundaries",
  async () => {
    let seed = 0x801b;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    const dirs = ["up", "right", "down", "left"];
    for (let trial = 0; trial < 160; trial++) {
      const room = {
        ...base,
        plates: trial % 2 ? [13] : [],
        gates: trial % 2 ? [16] : [],
        ice: trial % 3 ? [15, 16] : [],
        walls: trial % 5 ? [] : [4, 5, 10, 11, 28, 29, 34, 35],
        treasures: [7, 13, 22],
      };
      const actions = [];
      let state = engine.initialPuzzleState(room);
      const length = (random() >>> 16) % 36;
      for (let step = 0; step < length && state.status !== "solved"; step++) {
        const legal = dirs
          .map((direction) => ({
            direction,
            result: engine.movePuzzle(room, state, direction),
          }))
          .filter((move) => move.result.moved);
        if (!legal.length) break;
        const chosen = legal[(random() >>> 16) % legal.length];
        actions.push(chosen.direction);
        state = chosen.result.state;
      }
      if (trial % 4 === 0) actions.push(dirs[(random() >>> 16) % dirs.length]);
      assert.deepEqual(
        await replaySql(room, actions),
        engine.replayPuzzle(room, actions),
      );
    }
  },
);

if (!preliminary)
  await check(
    "all18 shipped solutions replay and settle sequentially for a fresh account",
    async () => {
      await owner("update rune_puzzle_definitions set active=false");
      for (const room of canonical)
        await owner(
          "update rune_puzzle_definitions set active=true where room_id=$1 and definition_version=$2",
          [room.id, room.version],
        );
      await actor(5);
      for (const room of canonical) {
        const expected = engine.replayPuzzle(room, room.solution);
        assert.equal(expected.valid, true, room.id);
        assert.equal(expected.state.status, "solved", room.id);
        assert.equal(engine.puzzleStars(room, expected.state), 3, room.id);
        assert.deepEqual(
          await replaySql(room, room.solution),
          expected,
          room.id,
        );
        const receipt = await complete(
          room,
          room.solution,
          uid(3000 + room.order),
        );
        assert.equal(receipt.firstClear, true, room.id);
        assert.equal(receipt.stars, 3, room.id);
        assert.equal(receipt.starsGained, 3, room.id);
        assert.equal(receipt.pushes, expected.state.pushes, room.id);
        assert.equal(receipt.moves, expected.state.moves, room.id);
        assert.equal(receipt.progress.completed, room.order, room.id);
      }
      const final = await profile();
      assert.equal(final.unlocked, 18);
      assert.equal(final.completed, 18);
      assert.equal(final.stars, 54);
      await actor(1);
    },
  );

await check(
  "migration reruns preserve all profiles, best records and immutable receipts",
  async () => {
    await db.exec("reset role");
    const snapshot = async () =>
      (
        await scalar(`select md5(string_agg(v,E'\n' order by v)) hash from (
    select to_jsonb(t)::text v from rune_puzzle_profiles t union all select to_jsonb(t)::text from rune_puzzle_results t
    union all select to_jsonb(t)::text from rune_puzzle_receipts t) rows`)
      ).hash;
    const old = await snapshot();
    await db.exec(migration);
    assert.equal(await snapshot(), old);
    await db.exec("set role authenticated");
  },
);

if (!preliminary)
  await check(
    "a changed puzzle definition cannot silently overwrite a deployed version",
    async () => {
      await db.exec("reset role");
      const room = canonical[0];
      const { solution: _solution, ...original } = room;
      await db.query(
        "update rune_puzzle_definitions set definition=jsonb_set(definition,'{parPushes}',to_jsonb((definition->>'parPushes')::integer+1)) where room_id=$1 and definition_version=$2",
        [room.id, room.version],
      );
      await assert.rejects(
        db.exec(migration),
        /puzzle_definition_version_immutable/,
      );
      await db.exec("rollback");
      await db.query(
        "update rune_puzzle_definitions set definition=$3::jsonb where room_id=$1 and definition_version=$2",
        [room.id, room.version, JSON.stringify(original)],
      );
      await db.exec("set role authenticated");
    },
  );

await check(
  "legacy balances, XP, scores and DH Score remain untouched after every puzzle action",
  async () => {
    await db.exec("reset role");
    assert.equal(await fingerprint(), before);
    await db.exec("set role authenticated");
  },
);
await db.close();
console.log(
  JSON.stringify({
    checks,
    canonicalRoomsVerified: preliminary ? 0 : canonical.length,
    complete: true,
  }),
);
