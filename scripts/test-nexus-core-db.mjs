// Optional dependency: npm install --no-save --package-lock=false @electric-sql/pglite
// Runs in an isolated PostgreSQL instance, never against a live club.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
await db.exec(`
  create role anon;create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
  create table profiles(id uuid primary key,display_name text);
  create table clubs(id uuid primary key);
  create table club_members(user_id uuid,club_id uuid);
  create table platform_assets(slug text,short_description text,full_description text);
  grant usage on schema public,auth to authenticated,anon;
  grant select on profiles,club_members,clubs to authenticated;
  insert into profiles values ('${id(1)}','Alice'),('${id(2)}','Bob'),('${id(3)}','Charlie');
  insert into clubs values ('${id(10)}'),('${id(11)}');
  insert into club_members values ('${id(1)}','${id(10)}'),('${id(2)}','${id(10)}'),('${id(3)}','${id(11)}');
`);
const migration = await readFile(
  "supabase/migrations/20261029000000_nexus_core_overhaul.sql",
  "utf8",
);
await db.exec(migration);
await db.exec(migration);
await db.exec("set role authenticated");
const actor = async (n) =>
  db.query("select set_config('test.user',$1,false)", [n ? id(n) : ""]);
const profile = async () =>
  (await db.query("select nexus_core_profile() p")).rows[0].p;
const finish = async (run, club = 10) =>
  (
    await db.query("select nexus_core_finish($1::jsonb,$2::uuid) r", [
      JSON.stringify(run),
      id(club),
    ])
  ).rows[0].r;
const run = (n, extra = {}) => ({
  id: id(n),
  scenarioId: "1",
  phase: "victory",
  cleared: 5,
  hpRatio: 0.95,
  score: 5000,
  kills: 70,
  time: 150,
  ...extra,
});
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log("PASS", name);
}
await check(
  "anonymous callers cannot initialize progress or claim a run",
  async () => {
    await actor(null);
    await assert.rejects(profile(), /Sign in/);
    await assert.rejects(finish(run(100)), /membership/);
  },
);
await actor(1);
await check(
  "profile initialization is idempotent and creates no starting credits",
  async () => {
    assert.equal((await profile()).credits, 0);
    assert.equal((await profile()).credits, 0);
  },
);
await check(
  "locked sectors, unfinished runs, invalid victories, and other clubs are rejected",
  async () => {
    await assert.rejects(
      finish(run(100, { scenarioId: "2", cleared: 6 })),
      /previous sector/,
    );
    await assert.rejects(finish(run(100, { phase: "wave" })), /not complete/);
    await assert.rejects(finish(run(100, { cleared: 4 })), /Invalid victory/);
    await assert.rejects(finish(run(100), 11), /membership/);
  },
);
await check("run replay cannot duplicate rewards or records", async () => {
  const first = await finish(run(100));
  assert.equal(first.reward, 105);
  assert.equal(first.stars, 3);
  assert.equal(first.profile.campaign["1"], 3);
  const again = await finish(run(100));
  assert.equal(again.profile.credits, 105);
  assert.equal(again.profile.total_runs, 1);
});
await check(
  "research uses server prices and rejects overdraw and unknown tracks",
  async () => {
    const buy = async (track) =>
      (await db.query("select nexus_core_research($1) p", [track])).rows[0].p;
    const p = await buy("weapons");
    assert.equal(p.credits, 70);
    assert.equal(p.research.weapons, 1);
    await buy("weapons");
    await assert.rejects(buy("weapons"), /Not enough credits/);
    await assert.rejects(buy("credits"), /Unknown research/);
  },
);
await check(
  "players cannot update wallets directly or read another player’s profile",
  async () => {
    await assert.rejects(
      db.query("update nexus_core_profiles set credits=999999"),
      /permission denied/,
    );
    await actor(2);
    await profile();
    const rows = (await db.query("select user_id from nexus_core_profiles"))
      .rows;
    assert.deepEqual(
      rows.map((r) => r.user_id),
      [id(2)],
    );
    await assert.rejects(finish(run(100)), /Invalid run/);
  },
);
await check("club members see club runs, outsiders do not", async () => {
  assert.equal(
    (await db.query("select * from nexus_core_runs")).rows.length,
    1,
  );
  await actor(3);
  assert.equal(
    (await db.query("select * from nexus_core_runs")).rows.length,
    0,
  );
});
await actor(1);
await check(
  "a later failed attempt cannot downgrade stars, and endless records update",
  async () => {
    await finish(run(101, { hpRatio: 0.1 }));
    assert.equal((await profile()).campaign["1"], 3);
    const result = await finish(
      run(102, {
        scenarioId: "endless",
        phase: "defeat",
        cleared: 37,
        hpRatio: 0,
      }),
    );
    assert.equal(result.profile.best_wave, 37);
    assert.equal(result.reward, 227);
  },
);
await check(
  "challenge records and wave reward limits are independent of the campaign",
  async () => {
    const c = await finish(run(103, { scenarioId: "glass", cleared: 6 }));
    assert.equal(c.profile.challenges.glass, 3);
    const e = await finish(
      run(104, {
        scenarioId: "endless",
        phase: "defeat",
        cleared: 200,
        hpRatio: 0,
      }),
    );
    assert.equal(e.reward, 505);
    assert.equal(e.profile.campaign["1"], 3);
  },
);
await check(
  "leaderboard returns one best run per member and obeys club isolation",
  async () => {
    let rows = (
      await db.query("select * from nexus_core_records($1,$2)", [
        id(10),
        "campaign",
      ])
    ).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, id(1));
    await actor(2);
    await profile();
    await finish(run(105, { score: 6000 }));
    rows = (
      await db.query("select * from nexus_core_records($1,$2)", [
        id(10),
        "campaign",
      ])
    ).rows;
    assert.equal(rows.length, 2);
    assert.equal(rows[0].user_id, id(2));
    await actor(3);
    assert.equal(
      (
        await db.query("select * from nexus_core_records($1,$2)", [
          id(10),
          "campaign",
        ])
      ).rows.length,
      0,
    );
  },
);
await db.close();
console.log(`${passed} database checks passed`);
