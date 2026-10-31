// Source-backed puzzle Feats in isolated PostgreSQL. No live account writes.
// Authoritative action replay is covered by test-rune-puzzle-db.mjs; these
// owner-seeded source rows exercise the shared Feat evaluator and ledger.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createFeatsFixture } from "./dh-feats-fixture.mjs";

const fixture = await createFeatsFixture();
const { id, ownerQuery: query, ownerExec: exec } = fixture;
const legacy = JSON.parse(await readFile("src/lib/feats/catalog.json", "utf8"));
const expedition = JSON.parse(
  await readFile("src/lib/feats/runeExpeditionCatalog.json", "utf8"),
);
const puzzles = JSON.parse(
  await readFile("src/lib/feats/runePuzzleCatalog.json", "utf8"),
);
const migration = await readFile(
  "supabase/migrations/20261031060000_rune_puzzle_feats.sql",
  "utf8",
);
let checks = 0,
  requestNumber = 3000;
const check = async (name, run) => {
  await run();
  checks++;
  console.log("PASS", name);
};
const board = async () => {
  const result = await fixture.rpc("dh_feats_board", { p_club_id: id(10) });
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
const metrics = async (user = id(1)) =>
  (await query("select dh_feat_metrics($1) r", [user])).rows[0].r;
const puzzlePoints = (b) =>
  b.unlocks
    .filter((unlock) => unlock.feat_key.startsWith("rune_puzzle_"))
    .reduce((sum, unlock) => sum + unlock.points, 0);
const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
let rooms;
async function source(
  ordinal,
  stars,
  { user = id(1), at = ago(0), request = id(requestNumber++) } = {},
) {
  const room = rooms.find((row) => row.ordinal === ordinal);
  const saved = await query(
    `insert into rune_puzzle_results(user_id,room_id,definition_version,stars,best_pushes,best_moves)
    values($1,$2,$3,$4,5,12) on conflict(user_id,room_id,definition_version) do update
      set stars=greatest(rune_puzzle_results.stars,excluded.stars),last_completed_at=now() returning stars`,
    [user, room.room_id, room.definition_version, stars],
  );
  const result = {
    requestId: request,
    roomId: room.room_id,
    definitionVersion: room.definition_version,
    stars: saved.rows[0].stars,
  };
  await query(
    `insert into rune_puzzle_receipts(user_id,request_id,room_id,definition_version,actions,result,created_at)
    values($1,$2,$3,$4,'["right"]'::jsonb,$5::jsonb,$6) on conflict(user_id,request_id) do nothing`,
    [
      user,
      request,
      room.room_id,
      room.definition_version,
      JSON.stringify(result),
      at,
    ],
  );
  return request;
}
try {
  await exec(`
    insert into auth.users(id) values('${id(1)}'),('${id(2)}'),('${id(3)}');
    create table rune_delve_expedition_runs(id uuid primary key default gen_random_uuid(),user_id uuid,rooms integer,ascension integer,cleared boolean,status text,finished_at timestamptz);
    insert into dh_feat_accounts(user_id,dirty) values('${id(1)}',false) on conflict(user_id) do nothing;
    insert into dh_feat_unlocks(user_id,feat_key,tier,points,target,historical) values('${id(1)}','drop_posts',1,7,1,false);
  `);
  await exec(
    await readFile(
      "supabase/migrations/20261031010000_rune_expedition_feats.sql",
      "utf8",
    ),
  );
  await exec(
    await readFile(
      "supabase/migrations/20261031050000_rune_delve_spatial_puzzles.sql",
      "utf8",
    ),
  );
  rooms = (
    await query(
      "select room_id,definition_version,ordinal from rune_puzzle_definitions where active order by ordinal",
    )
  ).rows;
  assert.equal(rooms.length, 18);
  const oldReceipt = (
    await query(
      "select to_jsonb(u) r from dh_feat_unlocks u where user_id=$1 and feat_key='drop_posts'",
      [id(1)],
    )
  ).rows[0].r;
  const definitionsBefore = (
    await query(
      "select jsonb_agg(to_jsonb(d) order by room_id,definition_version) r from rune_puzzle_definitions d",
    )
  ).rows[0].r;
  await exec(migration);
  await exec(migration);

  await check(
    "catalog extension is additive and idempotent; old definitions and earned receipts are unchanged",
    async () => {
      const b = await board();
      assert.equal(b.catalog.length, 68);
      assert.equal(
        b.catalog.reduce((sum, item) => sum + item.thresholds.length, 0),
        338,
      );
      for (const old of [...legacy, ...expedition])
        assert.deepEqual(
          b.catalog.find((item) => item.key === old.key),
          old,
        );
      for (const item of puzzles)
        assert.deepEqual(
          b.catalog.find((candidate) => candidate.key === item.key),
          item,
        );
      assert.deepEqual(
        (
          await query(
            "select to_jsonb(u) r from dh_feat_unlocks u where user_id=$1 and feat_key='drop_posts'",
            [id(1)],
          )
        ).rows[0].r,
        oldReceipt,
      );
      assert.deepEqual(
        (
          await query(
            "select jsonb_agg(to_jsonb(d) order by room_id,definition_version) r from rune_puzzle_definitions d",
          )
        ).rows[0].r,
        definitionsBefore,
      );
      assert.equal(puzzlePoints(b), 0);
    },
  );

  await check(
    "profile reads and avatar selection cannot create puzzle engagement",
    async () => {
      await query("select set_config('test.user',$1,false)", [id(1)]);
      await query("select rune_puzzle_profile()");
      await query("select rune_puzzle_select_avatar('mage')");
      const m = await metrics();
      assert.equal(m.rune_puzzle_rooms, 0);
      assert.equal(m.rune_puzzle_stars, 0);
      assert.equal(m.feature_explorer, 0);
      assert.equal(m.active_days, 0);
    },
  );

  let firstRequest;
  await check(
    "first solve invalidates sources without directly minting Feat awards",
    async () => {
      firstRequest = await source(1, 1, { at: ago(1) });
      assert.equal(
        (
          await query("select dirty from dh_feat_accounts where user_id=$1", [
            id(1),
          ])
        ).rows[0].dirty,
        true,
      );
      assert.equal(
        (
          await query(
            "select count(*)::integer n from dh_feat_unlocks where user_id=$1 and feat_key like 'rune_puzzle_%'",
            [id(1)],
          )
        ).rows[0].n,
        0,
      );
      const m = await metrics();
      assert.equal(m.rune_puzzle_rooms, 1);
      assert.equal(m.rune_puzzle_stars, 1);
      assert.equal(m.rune_clears, 0);
      assert.equal(m.rune_enemies, 0);
      assert.equal(m.feature_explorer, 1);
      assert.equal(m.active_days, 1);
      const b = await board();
      assert.equal(puzzlePoints(b), 5);
      assert.equal(
        b.unlocks.filter((item) => item.feat_key === "rune_puzzle_rooms")
          .length,
        1,
      );
      assert.equal(
        b.unlocks.filter((item) => item.feat_key === "rune_puzzle_stars")
          .length,
        0,
      );
    },
  );

  await check(
    "repeat receipt, same-star replay and mutable result dates do not duplicate counters or points",
    async () => {
      const before = await board();
      await source(1, 1, { request: firstRequest });
      await source(1, 1, { at: ago(1) });
      await query(
        "update rune_puzzle_results set last_completed_at=now()+interval '20 days' where user_id=$1",
        [id(1)],
      );
      const m = await metrics(),
        after = await board();
      assert.equal(m.rune_puzzle_rooms, 1);
      assert.equal(m.rune_puzzle_stars, 1);
      assert.equal(m.active_days, 1);
      assert.equal(after.score, before.score);
      assert.equal(puzzlePoints(after), 5);
    },
  );

  await check(
    "a better star result awards only the newly crossed star tier",
    async () => {
      const before = await board();
      await source(1, 3);
      const m = await metrics(),
        after = await board();
      assert.equal(m.rune_puzzle_rooms, 1);
      assert.equal(m.rune_puzzle_stars, 3);
      assert.equal(m.active_days, 2);
      assert.equal(puzzlePoints(after) - puzzlePoints(before), 5);
      assert.ok(
        after.unlocks.some(
          (unlock) =>
            unlock.feat_key === "rune_puzzle_stars" &&
            unlock.tier === 1 &&
            unlock.points === 5,
        ),
      );
      await source(1, 2);
      assert.equal((await metrics()).rune_puzzle_stars, 3);
      assert.equal(puzzlePoints(await board()), puzzlePoints(after));
    },
  );

  await check(
    "distinct solves unlock the six-room and twelve-star milestones exactly once",
    async () => {
      for (let ordinal = 2; ordinal <= 6; ordinal++) await source(ordinal, 3);
      const m = await metrics(),
        b = await board();
      assert.equal(m.rune_puzzle_rooms, 6);
      assert.equal(m.rune_puzzle_stars, 18);
      assert.equal(puzzlePoints(b), 30);
      assert.equal(
        b.unlocks.filter((unlock) => unlock.feat_key === "rune_puzzle_rooms")
          .length,
        2,
      );
      assert.equal(
        b.unlocks.filter((unlock) => unlock.feat_key === "rune_puzzle_stars")
          .length,
        2,
      );
    },
  );

  await check(
    "all eighteen rooms and fifty-four best stars reach the bounded nine-tier reward total",
    async () => {
      for (let ordinal = 7; ordinal <= 18; ordinal++) await source(ordinal, 3);
      const m = await metrics(),
        before = await board();
      assert.equal(m.rune_puzzle_rooms, 18);
      assert.equal(m.rune_puzzle_stars, 54);
      assert.equal(puzzlePoints(before), 135);
      assert.equal(
        before.unlocks.filter((unlock) =>
          unlock.feat_key.startsWith("rune_puzzle_"),
        ).length,
        9,
      );
      await exec(migration);
      await source(18, 3);
      const after = await board();
      assert.equal(after.score, before.score);
      assert.equal(puzzlePoints(after), 135);
      assert.deepEqual(
        (
          await query(
            "select feat_key,tier,count(*) n from dh_feat_unlocks where user_id=$1 group by feat_key,tier having count(*)>1",
            [id(1)],
          )
        ).rows,
        [],
      );
    },
  );

  await check(
    "inactive versions do not inflate current room/star totals; all Rune modes remain one feature",
    async () => {
      const room = rooms[0];
      await query(
        `insert into rune_puzzle_definitions(room_id,definition_version,ordinal,definition,active)
      select room_id,2,ordinal,jsonb_set(definition,'{version}','2'::jsonb),false from rune_puzzle_definitions where room_id=$1 and definition_version=1`,
        [room.room_id],
      );
      await query(
        `insert into rune_puzzle_results(user_id,room_id,definition_version,stars,best_pushes,best_moves) values($1,$2,2,3,5,12)`,
        [id(2), room.room_id],
      );
      await source(1, 1, { user: id(2) });
      await query(
        "insert into rune_delve_runs(user_id,level_number,dungeon_cleared,clears) values($1,5,true,5)",
        [id(2)],
      );
      await query(
        "insert into rune_delve_expedition_runs(user_id,rooms,ascension,cleared,status,finished_at) values($1,6,0,true,'banked',now())",
        [id(2)],
      );
      const m = await metrics(id(2));
      assert.equal(m.rune_puzzle_rooms, 1);
      assert.equal(m.rune_puzzle_stars, 1);
      assert.equal(m.rune_clears, 5);
      assert.equal(m.rune_expedition_rooms, 6);
      assert.equal(m.feature_explorer, 1);
      assert.equal(m.active_days, 1);
    },
  );

  await check(
    "activity days require completed immutable receipt shape, not a mutable best-result timestamp",
    async () => {
      const room = rooms[0];
      for (const stars of [0, "3"]) {
        await query(
          "insert into rune_puzzle_receipts(user_id,request_id,room_id,definition_version,actions,result,created_at) values($1,$2,$3,1,'[]',$4::jsonb,$5)",
          [
            id(3),
            id(requestNumber++),
            room.room_id,
            JSON.stringify({
              roomId: room.room_id,
              definitionVersion: 1,
              stars,
            }),
            ago(3),
          ],
        );
      }
      assert.equal((await metrics(id(3))).active_days, 0);
      await source(1, 1, { user: id(3), at: ago(2) });
      await query(
        "update rune_puzzle_results set last_completed_at=now()+interval '40 days' where user_id=$1",
        [id(3)],
      );
      assert.equal((await metrics(id(3))).active_days, 1);
      // Completed historical versions still prove the date of actual activity.
      await query(
        "insert into rune_puzzle_receipts(user_id,request_id,room_id,definition_version,actions,result,created_at) values($1,$2,$3,2,'[]',$4::jsonb,$5)",
        [
          id(3),
          id(requestNumber++),
          room.room_id,
          JSON.stringify({
            roomId: room.room_id,
            definitionVersion: 2,
            stars: 3,
          }),
          ago(4),
        ],
      );
      assert.equal((await metrics(id(3))).active_days, 2);
    },
  );

  await check(
    "private testing identities stay absent from both standings after puzzle completion",
    async () => {
      const hidden = "bea76765-545c-4b48-a24d-861c1918c3d6";
      await query("insert into auth.users(id) values($1)", [hidden]);
      await query(
        "insert into profiles(id,display_name) values($1,'Private operator')",
        [hidden],
      );
      await query("insert into club_members(user_id,club_id) values($1,$2)", [
        hidden,
        id(10),
      ]);
      // Register the private identity explicitly, retaining a stale shared-club
      // membership in this fixture to verify the standings predicate itself.
      await query(
        "insert into clubs(id,name,slug) values($1,'Private workspace','private-fixture')",
        [id(11)],
      );
      await query(
        "insert into dh_private_accounts(user_id,workspace_id,profile_snapshot,membership_snapshot) values($1,$2,'{}','{}')",
        [hidden, id(11)],
      );
      await source(1, 3, { user: hidden });
      const b = await board();
      assert.equal(
        b.leaders.some((member) => member.user_id === hidden),
        false,
      );
      assert.equal(
        b.monthly_leaders.some((member) => member.user_id === hidden),
        false,
      );
      assert.equal(b.members, 3);
    },
  );

  await check(
    "migration registers only a result-source invalidation trigger",
    async () => {
      const triggers = (
        await query(
          "select event_object_table from information_schema.triggers where trigger_name='dh_feat_dirty' and event_object_table like 'rune_puzzle_%' group by event_object_table",
        )
      ).rows;
      assert.deepEqual(triggers, [
        { event_object_table: "rune_puzzle_results" },
      ]);
      assert.deepEqual(
        (
          await query(
            "select to_jsonb(u) r from dh_feat_unlocks u where user_id=$1 and feat_key='drop_posts'",
            [id(1)],
          )
        ).rows[0].r,
        oldReceipt,
      );
    },
  );
  await check(
    "an incompatible upstream evaluator fails explicitly",
    async () => {
      const originalDefinition = (
        await query(
          "select pg_get_functiondef('public.dh_feat_metrics(uuid)'::regprocedure) definition",
        )
      ).rows[0].definition;
      const marker =
        "dh_feat_number(m->>'rune_expedition_rooms'),dh_feat_number(m->>'rune_puzzle_rooms')";
      assert.ok(originalDefinition.includes(marker));
      await exec(
        originalDefinition.replace(
          marker,
          "dh_feat_number(m->>'rune_expedition_rooms'), dh_feat_number(m->>'rune_puzzle_rooms')",
        ),
      );
      await assert.rejects(
        exec(migration),
        /spatial puzzle extension is incomplete/,
      );
      // This final check deliberately leaves the isolated transaction aborted.
      // Closing the fixture discards it; no follow-up command can commit it.
    },
  );

  console.log(JSON.stringify({ groups: checks, passed: true }));
} finally {
  await fixture.close();
}
