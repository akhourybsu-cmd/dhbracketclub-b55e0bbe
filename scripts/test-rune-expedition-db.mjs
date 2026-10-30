// Isolated PostgreSQL reward/RLS contract. Never contacts Supabase or club accounts.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.RUNE_PGLITE_MODULE ?? "@electric-sql/pglite"
);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let checks = 0;
const check = async (name, fn) => {
  await fn();
  checks++;
  console.log("PASS", name);
};
await db.exec(`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user',true),'')::uuid$$;
create table auth.users(id uuid primary key);
create table public.clubs(id uuid primary key);
create table public.club_members(user_id uuid,club_id uuid);
create table public.platform_assets(id uuid primary key,slug text);
create table public.club_installed_assets(club_id uuid,asset_id uuid,enabled boolean);
create table public.rune_delve_heroes(user_id uuid primary key);
create table public.rune_delve_wallet(user_id uuid primary key,shards integer not null,lifetime_shards_earned integer not null,slots_unlocked integer not null);
grant usage on schema public,auth to authenticated,anon;
grant select on club_members,clubs to authenticated;
insert into auth.users values('${id(1)}'),('${id(2)}');
insert into clubs values('${id(10)}'),('${id(11)}'),('${id(12)}');
insert into club_members values('${id(1)}','${id(10)}'),('${id(2)}','${id(10)}'),('${id(1)}','${id(12)}');
insert into platform_assets values('${id(20)}','rune-delve');
insert into club_installed_assets values('${id(10)}','${id(20)}',true);
insert into rune_delve_heroes values('${id(1)}'),('${id(2)}');`);
const migration = await readFile(
  "supabase/migrations/20261030140000_rune_delve_expeditions.sql",
  "utf8",
);
await db.exec(migration);
await db.exec(migration);
await db.exec("set role authenticated");
const actor = async (n) =>
  db.query("select set_config('test.user',$1,false)", [id(n)]);
await actor(1);
const rpc = async (name, args = []) =>
  (
    await db.query(
      `select ${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) r`,
      args,
    )
  ).rows[0].r;
const owner = async (sql, args = []) => {
  await db.exec("reset role");
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("set role authenticated");
  }
};
const profile = () => rpc("rune_delve_expedition_profile", [id(10)]);
const begin = (n, tier = 0, cls = "warrior", club = 10) =>
  rpc("rune_delve_expedition_begin", [id(n), id(club), cls, tier]);
const finish = (n, rooms, score, turns, cleared) =>
  rpc("rune_delve_expedition_finish", [id(n), rooms, score, turns, cleared]);
await check("idempotent migration and empty account profile", async () => {
  assert.deepEqual(await profile(), {
    highest_ascension: 0,
    best_score: 0,
    total_runs: 0,
    total_clears: 0,
    active_run: null,
  });
});
await check(
  "server ticket retry preserves seed and immutable class/difficulty",
  async () => {
    const a = await begin(100);
    const b = await begin(100);
    assert.deepEqual(a, b);
    assert.equal(a.hero_class, "warrior");
    assert.equal((await profile()).active_run.id, id(100));
    await assert.rejects(begin(100, 0, "mage"), /mismatch/);
  },
);
await check(
  "membership, installation, class and ascension gates are enforced",
  async () => {
    await assert.rejects(begin(101, 1), /previous_ascension/);
    await assert.rejects(begin(101, 0, "bad"), /invalid_expedition/);
    await assert.rejects(begin(101, 0, "warrior", 11), /membership/);
    await assert.rejects(begin(101, 0, "warrior", 12), /not_installed/);
  },
);
await check(
  "starting a new ticket invalidates the old one without paying rewards",
  async () => {
    await begin(101);
    await assert.rejects(finish(100, 3, 500, 20, false), /replaced/);
    const r = await finish(101, 0, 0, 0, false);
    assert.equal(r.reward, 0);
    assert.equal((await profile()).total_runs, 1);
    assert.equal(
      (await owner("select count(*)::int n from rune_delve_wallet")).rows[0].n,
      0,
    );
  },
);
await check(
  "six-room clear grants bounded shards and unlocks the next ascension exactly once",
  async () => {
    await begin(102);
    const r = await finish(102, 6, 3000, 45, true);
    assert.equal(r.reward, 112);
    assert.equal(r.highest_ascension, 1);
    const retry = await finish(102, 0, 0, 0, false);
    assert.deepEqual(retry, r);
    const wallet = (
      await owner("select * from rune_delve_wallet where user_id=$1", [id(1)])
    ).rows[0];
    assert.equal(wallet.shards, 112);
    assert.equal(wallet.lifetime_shards_earned, 112);
    assert.equal((await profile()).total_runs, 2);
    assert.equal((await profile()).total_clears, 1);
    assert.equal((await profile()).active_run, null);
  },
);
await check(
  "result telemetry rejects invalid rooms, outcomes and oversized scores",
  async () => {
    await begin(103, 1);
    for (const args of [
      [7, 100, 10, false],
      [6, 100, 30, false],
      [3, 100, 1, false],
      [3, 250001, 30, false],
      [3, 100, -1, false],
    ])
      await assert.rejects(finish(103, ...args), /invalid_expedition/);
    assert.equal((await profile()).active_run.id, id(103));
  },
);
await check(
  "wallet failure rolls back receipt/progress so the same ticket can retry safely",
  async () => {
    await owner(
      "alter table rune_delve_wallet add constraint test_wallet_cap check(shards<=120)",
    );
    await assert.rejects(finish(103, 3, 600, 20, false), /test_wallet_cap/);
    assert.equal((await profile()).total_runs, 2);
    assert.equal((await profile()).active_run.id, id(103));
    await owner(
      "alter table rune_delve_wallet drop constraint test_wallet_cap",
    );
    const r = await finish(103, 3, 600, 20, false);
    assert.equal(r.reward, 42);
    assert.equal(
      (
        await owner("select shards from rune_delve_wallet where user_id=$1", [
          id(1),
        ])
      ).rows[0].shards,
      154,
    );
    assert.equal((await profile()).highest_ascension, 1);
  },
);
await check(
  "member RLS hides peer tickets/progress and disallows client reward writes",
  async () => {
    await actor(2);
    assert.equal(
      (await db.query("select count(*)::int n from rune_delve_expedition_runs"))
        .rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from rune_delve_expedition_progress",
        )
      ).rows[0].n,
      0,
    );
    await assert.rejects(finish(102, 6, 3000, 45, true), /not_found/);
    await assert.rejects(begin(102), /mismatch/);
    await assert.rejects(
      db.query(
        "insert into rune_delve_expedition_progress(user_id,club_id) values($1,$2)",
        [id(2), id(10)],
      ),
      /permission denied/,
    );
  },
);
await check(
  "removed members cannot read or claim prior expeditions",
  async () => {
    await actor(1);
    await begin(104);
    await owner("delete from club_members where user_id=$1", [id(1)]);
    assert.equal(
      (await db.query("select count(*)::int n from rune_delve_expedition_runs"))
        .rows[0].n,
      0,
    );
    await assert.rejects(profile(), /membership/);
    await assert.rejects(finish(104, 0, 0, 0, false), /membership/);
  },
);
await check(
  "anonymous callers cannot execute expedition procedures",
  async () => {
    await db.exec("set role anon");
    await assert.rejects(profile(), /permission denied/);
    await assert.rejects(begin(200), /permission denied/);
    await assert.rejects(finish(102, 6, 3000, 45, true), /permission denied/);
  },
);
console.log(JSON.stringify({ groups: checks, passed: true }));
await db.close();
