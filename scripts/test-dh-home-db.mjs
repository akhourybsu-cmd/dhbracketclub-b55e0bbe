// Lightweight Home protocol against the real Feats evaluator in isolated PG.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createFeatsFixture } from "./dh-feats-fixture.mjs";
const backend = await createFeatsFixture(),
  { id } = backend;
const migration = await readFile(
  "supabase/migrations/20261029050000_dh_home_progress.sql",
  "utf8",
);
try {
  await backend.ownerExec(migration);
  await backend.ownerExec(migration);
  const home = async () => {
    const r = await backend.rpc("dh_home_progress", { p_club_id: id(10) });
    assert.equal(r.error, null);
    return r.data;
  };
  const fresh = await home();
  assert.equal(fresh.score, 0);
  assert.equal(fresh.unlocked, 0);
  assert.equal(fresh.club_rank, 1);
  assert.ok(
    fresh.goals.length <= 8 &&
      fresh.goals.every((g) => g.target > 0 && g.progress === 0),
  );
  assert.equal(
    (await backend.rpc("dh_home_progress", { p_club_id: id(11) })).error
      ?.message,
    "Club membership required",
  );
  const grants = await backend.ownerQuery(
    "select has_function_privilege('anon','dh_home_progress(uuid)','execute') anon,has_function_privilege('authenticated','dh_home_progress(uuid)','execute') member",
  );
  assert.equal(grants.rows[0].anon, false);
  assert.equal(grants.rows[0].member, true);
  console.log(
    "PASS member-only lightweight protocol, zero-activity score and shared zero-score ranks",
  );
  for (let n = 0; n < 19; n++)
    await backend.seed("daily_finds", {
      club_id: id(10),
      user_id: id(1),
      title: "Find " + n,
      kind: "learned",
    });
  await backend.rpc("dh_feats_pin", { p_keys: ["drop_posts"] });
  const advanced = await home(),
    goal = advanced.goals[0];
  assert.equal(goal.key, "drop_posts");
  assert.equal(goal.value, 19);
  assert.equal(goal.target, 20);
  assert.equal(goal.points, 40);
  assert.equal(goal.tier, 3);
  assert.equal(goal.tracked, true);
  assert.ok(Math.abs(goal.progress - 14 / 15) < 1e-8);
  const board = (await backend.rpc("dh_feats_board", { p_club_id: id(10) }))
    .data;
  assert.equal(advanced.score, board.score);
  assert.equal(advanced.unlocked, board.unlocked);
  assert.equal(advanced.club_rank, board.me.rank);
  const seen = await backend.ownerQuery(
    "select seen_at from dh_feat_accounts where user_id=$1",
    [id(1)],
  );
  await home();
  await home();
  assert.equal((await home()).score, advanced.score);
  assert.deepEqual(
    (
      await backend.ownerQuery(
        "select seen_at from dh_feat_accounts where user_id=$1",
        [id(1)],
      )
    ).rows,
    seen.rows,
    "Home does not acknowledge achievement reveals",
  );
  console.log(
    "PASS pinned goal order, next-tier progress, immutable awards and unacknowledged celebrations",
  );
  await backend.seed("daily_finds", {
    club_id: id(10),
    user_id: id(1),
    title: "Twentieth",
    kind: "learned",
  });
  const crossing = await home();
  assert.ok(crossing.score > advanced.score);
  assert.equal(crossing.goals[0].target, 75);
  assert.equal(crossing.goals[0].tier, 4);
  assert.equal(crossing.goals[0].progress, 0);
  for (let n = 0; n < 76; n++)
    await backend.seed("daily_finds", {
      club_id: id(10),
      user_id: id(2),
      title: "Other member " + n,
      kind: "photo",
    });
  await backend.rpc("dh_feats_board", { p_club_id: id(10) });
  assert.equal((await home()).club_rank, 2);
  await backend.ownerQuery(
    "insert into dh_feat_progress(user_id,feat_key,value) select $1,key,thresholds[cardinality(thresholds)] from dh_feat_catalog on conflict(user_id,feat_key) do update set value=excluded.value",
    [id(1)],
  );
  await backend.ownerQuery(
    "update dh_feat_accounts set dirty=true where user_id=$1",
    [id(1)],
  );
  const max = await home();
  assert.equal(max.score, 18750);
  assert.equal(max.unlocked, 314);
  assert.deepEqual(max.goals, []);
  console.log(
    "PASS exact thresholds, current club standing and complete-career empty goals",
  );
} finally {
  await backend.close();
}
