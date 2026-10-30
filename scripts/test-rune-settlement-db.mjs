// Isolated PostgreSQL contract: never contacts a live account or Supabase.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.RUNE_PGLITE_MODULE ?? "@electric-sql/pglite"
);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
await db.exec(`
create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user',true),'')::uuid$$;
create type rd_quest_status as enum('active','completed','claimed');
create type rd_quest_scope as enum('daily','weekly');
create table rune_delve_heroes(id uuid primary key default gen_random_uuid(),user_id uuid unique not null,hero_name text default 'Hero',class text default 'warrior',level integer default 1,xp integer default 0,current_streak integer default 0,best_streak integer default 0,lifetime_runs integer default 0,lifetime_score bigint default 0,cosmetic_title text,last_run_date date);
create table rune_delve_class_progress(id uuid primary key default gen_random_uuid(),user_id uuid not null,class text not null,xp integer default 0,level integer default 1,cosmetic_title text,lifetime_runs integer default 0,lifetime_score bigint default 0,highest_unlocked_level integer default 1,highest_completed_level integer default 0,total_levels_cleared integer default 0,current_chapter integer default 1,unique(user_id,class));
create table rune_delve_progress(id uuid primary key default gen_random_uuid(),user_id uuid unique not null,highest_unlocked_level integer default 1,highest_completed_level integer default 0,total_levels_cleared integer default 0,current_chapter integer default 1);
create table rune_delve_levels(id uuid primary key default gen_random_uuid(),level_number integer unique not null,chapter integer,difficulty_tier integer,generation_seed bigint,board_size integer,enemy_config jsonb,turn_limit integer,objective_type text,objective_target integer,modifiers jsonb,status text default 'active');
create table rune_delve_runs(id uuid primary key default gen_random_uuid(),user_id uuid not null,level_id uuid references rune_delve_levels(id),level_number integer,hero_class text,score integer default 0,enemies_defeated integer default 0,dungeon_cleared boolean default false,turns_used integer default 0,total_damage integer default 0,longest_chain integer default 0,hp_remaining integer default 0,xp_earned integer default 0,ability_used boolean default false,attempts integer default 1,clears integer default 0,best_turns_used integer,best_hp_remaining integer default 0,last_played_at timestamptz default now());
create unique index on rune_delve_runs(user_id,level_id,hero_class) where level_id is not null;
create table rune_delve_wallet(user_id uuid primary key,shards integer not null default 0,lifetime_shards_earned integer not null default 0,slots_unlocked integer not null default 2);
create table rune_delve_relic_unlocks(id uuid primary key default gen_random_uuid(),user_id uuid not null,relic_id text not null,rank integer default 1,acquired_at_level integer default 1,acquired_at timestamptz default now(),unique(user_id,relic_id));
create table rune_delve_loadouts(id uuid primary key default gen_random_uuid(),user_id uuid not null,class text not null,slot_1 text,slot_2 text,slot_3 text,unique(user_id,class));
create table rune_delve_failure_rewards(id uuid primary key default gen_random_uuid(),user_id uuid,level_number integer,hero_class text,failure_count integer,last_awarded_at timestamptz,unique(user_id,level_number,hero_class));
create table rune_delve_daily_runs(id uuid primary key default gen_random_uuid(),user_id uuid,daily_date date,score integer,stars integer,dungeon_cleared boolean,modifiers jsonb,hero_class text,kills_count integer,completed_at timestamptz,unique(user_id,daily_date));
create table rune_delve_daily_streaks(user_id uuid primary key,current_streak integer,best_streak integer,last_completed_date date,lifetime_clears integer);
create table rune_delve_quest_definitions(id text primary key,title text,scope rd_quest_scope,objective_type text,shard_reward integer,xp_reward integer,is_personal boolean default false,hero_class text);
create table rune_delve_active_quests(id uuid primary key default gen_random_uuid(),user_id uuid,quest_id text references rune_delve_quest_definitions(id),scope rd_quest_scope,period_key text,progress integer,target_value integer,status rd_quest_status,claimed_at timestamptz);
grant usage on schema public,auth to anon,authenticated;
grant select on all tables in schema public to authenticated;
insert into auth.users values('${id(1)}'),('${id(2)}');
insert into rune_delve_heroes(user_id) values('${id(1)}'),('${id(2)}');
`);
const migration = await readFile(
  "supabase/migrations/20261031000000_rune_delve_settlement.sql",
  "utf8",
);
await db.exec(migration);
await db.exec(migration);
await db.exec("set role authenticated");
const actor = (n) =>
  db.query("select set_config('test.user',$1,false)", [n ? id(n) : ""]);
const rpc = async (name, args = []) =>
  (
    await db.query(
      `select to_jsonb(${name}(${args.map((_, i) => "$" + (i + 1)).join(",")})) r`,
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
const one = async (table) =>
  (await db.query(`select * from ${table} where user_id=$1`, [id(1)])).rows[0];
let checks = 0;
const check = async (name, fn) => {
  await fn();
  checks++;
  console.log("PASS", name);
};
await actor(1);
const definition = (n) => ({
  level_number: n,
  generation_seed: n * 100,
  turn_limit: 18,
  enemy_config: [],
  modifiers: {},
  objective_type: "defeat_all",
  board_size: 5,
});
const level = await rpc("rune_delve_ensure_level", [definition(1)]);
const secondLevel = await rpc("rune_delve_ensure_level", [definition(2)]);
const tenthLevel = await rpc("rune_delve_ensure_level", [definition(10)]);
const run = (extra) => ({
  level_id: level.id,
  level_number: 1,
  hero_class: "warrior",
  score: 1000,
  enemies_defeated: 1,
  dungeon_cleared: true,
  turns_used: 3,
  total_damage: 100,
  longest_chain: 5,
  hp_remaining: 90,
  xp_earned: 999999,
  ability_used: false,
  reward_context: { turn_limit: 18, total_enemies: 1 },
  ...extra,
});
const save = (n, extra = {}) => rpc("rune_delve_save_run", [run(extra), id(n)]);
const buy = (n, relic, rank = null) =>
  rpc("rune_delve_buy_relic", [relic, rank, id(n)]);
await check(
  "canonical chamber seeding is immutable and never creates a transient identity",
  async () => {
    const again = await rpc("rune_delve_ensure_level", [
      { ...definition(1), generation_seed: 99999 },
    ]);
    assert.equal(again.id, level.id);
    assert.equal(again.generation_seed, 100);
    await assert.rejects(
      rpc("rune_delve_ensure_level", [definition(0)]),
      /invalid_level/,
    );
  },
);
await check(
  "one receipt commits run, XP, campaign and shards exactly once",
  async () => {
    const first = await save(100);
    assert.equal(first.shardsAwarded, 16);
    assert.equal(first.xpAwarded, 53);
    assert.equal(first.firstClear, true);
    assert.equal(first.row.attempts, 1);
    assert.deepEqual(await save(100), first);
    const hero = await one("rune_delve_heroes");
    assert.equal(hero.xp, 53);
    assert.equal(hero.lifetime_runs, 1);
    assert.equal((await one("rune_delve_wallet")).shards, 16);
    assert.equal(
      (await one("rune_delve_class_progress")).highest_unlocked_level,
      2,
    );
    await assert.rejects(save(100, { score: 1001 }), /request_id_reused/);
  },
);
await check(
  "lower-score replays preserve the best and improve independent records without duplicate XP",
  async () => {
    const replay = await save(101, {
      score: 900,
      longest_chain: 8,
      turns_used: 2,
      hp_remaining: 95,
    });
    assert.equal(replay.wasNewBest, false);
    assert.equal(replay.xpAwarded, 0);
    assert.equal(replay.shardsAwarded, 3);
    assert.equal(replay.row.score, 1000);
    assert.equal(replay.row.longest_chain, 8);
    assert.equal(replay.row.best_turns_used, 2);
    assert.equal(replay.row.attempts, 2);
    assert.equal((await one("rune_delve_heroes")).xp, 53);
    assert.equal((await one("rune_delve_progress")).total_levels_cleared, 1);
  },
);
await check(
  "queued simultaneous submissions retain the maximum and count each distinct acknowledged attempt",
  async () => {
    await Promise.all([
      save(102, { score: 2500, longest_chain: 7 }),
      save(103, { score: 2000, longest_chain: 10 }),
    ]);
    const row = await one("rune_delve_runs");
    assert.equal(row.score, 2500);
    assert.equal(row.longest_chain, 10);
    assert.equal(row.attempts, 4);
    assert.equal((await one("rune_delve_heroes")).lifetime_runs, 4);
  },
);
await check("locked depths and class campaigns cannot be skipped", async () => {
  await assert.rejects(
    save(104, { level_id: tenthLevel.id, level_number: 10 }),
    /still locked/,
  );
  await assert.rejects(
    save(105, {
      level_id: secondLevel.id,
      level_number: 2,
      hero_class: "mage",
    }),
    /still locked/,
  );
  await save(106, { hero_class: "mage" });
  const tracks = (
    await db.query(
      "select * from rune_delve_class_progress where user_id=$1 order by class",
      [id(1)],
    )
  ).rows;
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].class, "mage");
  assert.equal(tracks[0].highest_unlocked_level, 2);
});
await check(
  "wallet failure rolls back all run, XP and unlock writes and permits the same receipt retry",
  async () => {
    const before = await one("rune_delve_wallet");
    const hero = await one("rune_delve_heroes");
    await owner(
      `alter table rune_delve_wallet add constraint test_shard_cap check(shards<=${before.shards})`,
    );
    const payload = { level_id: secondLevel.id, level_number: 2 };
    await assert.rejects(save(107, payload), /test_shard_cap/);
    assert.equal(
      (await one("rune_delve_heroes")).lifetime_runs,
      hero.lifetime_runs,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::integer n from rune_delve_runs where level_id=$1",
          [secondLevel.id],
        )
      ).rows[0].n,
      0,
    );
    await owner("alter table rune_delve_wallet drop constraint test_shard_cap");
    assert.equal((await save(107, payload)).row.level_number, 2);
  },
);
await check(
  "server catalog debits and delivers purchases together; a lost acknowledgement cannot spend twice",
  async () => {
    await owner("update rune_delve_wallet set shards=2000 where user_id=$1", [
      id(1),
    ]);
    const first = await buy(200, "ember_edge");
    assert.equal(first.rank, 1);
    assert.equal((await one("rune_delve_wallet")).shards, 1900);
    assert.deepEqual(await buy(200, "ember_edge"), first);
    await buy(201, "ember_edge");
    assert.equal((await one("rune_delve_wallet")).shards, 1900);
    const results = await Promise.allSettled([
      buy(202, "ember_edge", 1),
      buy(203, "ember_edge", 1),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await one("rune_delve_wallet")).shards, 1840);
    assert.equal((await buy(204, "ember_edge", 2)).rank, 3);
  },
);
await check(
  "purchase gates and insufficient balances leave both ownership and wallet intact",
  async () => {
    await assert.rejects(buy(205, "crimson_tide"), /tier is still locked/);
    await assert.rejects(buy(206, "not_a_relic"), /unknown_relic/);
    await owner("update rune_delve_wallet set shards=0 where user_id=$1", [
      id(1),
    ]);
    await assert.rejects(buy(207, "ember_edge", 3), /Not enough/);
    assert.equal(
      (
        await db.query(
          "select rank from rune_delve_relic_unlocks where user_id=$1 and relic_id='ember_edge'",
          [id(1)],
        )
      ).rows[0].rank,
      3,
    );
    await owner("update rune_delve_wallet set shards=1000 where user_id=$1", [
      id(1),
    ]);
  },
);
await check(
  "equipment requires ownership, unique relics and an unlocked third slot",
  async () => {
    await assert.rejects(
      rpc("rune_delve_equip", ["warrior", "not_owned", null, null]),
      /Unlock/,
    );
    await assert.rejects(
      rpc("rune_delve_equip", ["warrior", "ember_edge", "ember_edge", null]),
      /only be equipped once/,
    );
    await assert.rejects(
      rpc("rune_delve_equip", ["warrior", null, null, "ember_edge"]),
      /still locked/,
    );
    const loadout = await rpc("rune_delve_equip", [
      "mage",
      "ember_edge",
      null,
      null,
    ]);
    assert.equal(loadout.slot_1, "ember_edge");
    assert.equal(loadout.class, "mage");
  },
);
const producerTypes = ['daily_challenges_completed','class_run_complete','enemies_defeated','total_score','shards_earned','class_xp_earned','bosses_defeated'];
for (const [index, type] of producerTypes.entries()) {
  await owner("insert into rune_delve_quest_definitions values($1,$1,'weekly',$2,10,10,false,null)", ['producer_'+type,type]);
  for (const uid of [1,2]) await owner("insert into rune_delve_active_quests(id,user_id,quest_id,scope,period_key,progress,target_value,status) values($1,$2,$3,'weekly',to_char(now() at time zone 'UTC','IYYY-\"W\"IW'),0,100000,'active')",[id(700+uid*10+index),id(uid),'producer_'+type]);
}
const producerProgress = async uid => Object.fromEntries((await db.query("select d.objective_type,a.progress from rune_delve_active_quests a join rune_delve_quest_definitions d on d.id=a.quest_id where a.user_id=$1 and d.id like 'producer_%'",[id(uid)])).rows.map(row=>[row.objective_type,row.progress]));
await check(
  "daily bests and streaks update atomically while only the first attempt pays",
  async () => {
    const before = await one("rune_delve_wallet");
    const first = await rpc("rune_delve_save_daily", [
      0,
      10,
      "warrior",
      id(300),
    ]);
    assert.equal(first.reward.shards, 25);
    assert.equal(first.rewarded, true);
    assert.deepEqual(
      await rpc("rune_delve_save_daily", [0, 10, "warrior", id(300)]),
      first,
    );
    const better = await rpc("rune_delve_save_daily", [
      30,
      8000,
      "warrior",
      id(301),
    ]);
    assert.equal(better.reward.shards, 0);
    assert.equal(better.reward.xp, 0);
    assert.equal(better.rewarded, false);
    await rpc("rune_delve_save_daily", [31, 8500, "warrior", id(302)]);
    const streak = await one("rune_delve_daily_streaks");
    assert.equal(streak.current_streak, 1);
    assert.equal(streak.lifetime_clears, 1);
    assert.equal((await one("rune_delve_wallet")).shards, before.shards + 25);
  },
);
await check('daily completion and actual reward volumes advance quests once per acknowledged day',async()=>{
  assert.deepEqual(await producerProgress(1),{daily_challenges_completed:1,class_run_complete:1,enemies_defeated:0,total_score:10,shards_earned:25,class_xp_earned:0,bosses_defeated:0});
  await actor(2);
  const first=await rpc('rune_delve_save_daily',[8,2500,'mage',id(310)]);
  assert.equal(first.reward.shards,75);assert.equal(first.reward.xp,80);
  const expected={daily_challenges_completed:1,class_run_complete:1,enemies_defeated:8,total_score:2500,shards_earned:75,class_xp_earned:80,bosses_defeated:0};
  assert.deepEqual(await producerProgress(2),expected);
  await rpc('rune_delve_save_daily',[8,2500,'mage',id(310)]);
  await rpc('rune_delve_save_daily',[10,3500,'mage',id(311)]);
  assert.deepEqual(await producerProgress(2),expected);
  await actor(1);
});
await check(
  "quest counters use relative increments and quest claims pay XP and shards together once",
  async () => {
    await owner(
      "insert into rune_delve_quest_definitions values('hunt','Monster Hunt','daily','enemies_defeated',70,200,false,null)",
    );
    await owner(
      "insert into rune_delve_active_quests(id,user_id,quest_id,scope,period_key,progress,target_value,status) values($1,$2,'hunt','daily',to_char(now() at time zone 'UTC','YYYY-MM-DD'),0,2,'active')",
      [id(400), id(1)],
    );
    await Promise.all([
      rpc("rune_delve_report_quest", [
        { type: "enemies_defeated", amount: 1, heroClass: "warrior" },
      ]),
      rpc("rune_delve_report_quest", [
        { type: "enemies_defeated", amount: 1, heroClass: "warrior" },
      ]),
    ]);
    const before = await one("rune_delve_wallet");
    const first = await rpc("rune_delve_claim_quest", [id(400)]);
    assert.equal(first.shards, 70);
    assert.equal(first.xp, 200);
    const again = await rpc("rune_delve_claim_quest", [id(400)]);
    assert.equal(again.shards, 0);
    assert.equal(again.xp, 0);
    assert.equal((await one("rune_delve_wallet")).shards, before.shards + 70);
  },
);
await check(
  "quest reward failures preserve the completed quest for a safe retry",
  async () => {
    await owner(
      "insert into rune_delve_active_quests(id,user_id,quest_id,scope,period_key,progress,target_value,status) values($1,$2,'hunt','daily','tomorrow',2,2,'completed')",
      [id(401), id(1)],
    );
    const before = await one("rune_delve_wallet");
    await owner(
      `alter table rune_delve_wallet add constraint test_quest_cap check(shards<=${before.shards})`,
    );
    await assert.rejects(
      rpc("rune_delve_claim_quest", [id(401)]),
      /test_quest_cap/,
    );
    assert.equal(
      (
        await db.query(
          "select status from rune_delve_active_quests where id=$1",
          [id(401)],
        )
      ).rows[0].status,
      "completed",
    );
    await owner("alter table rune_delve_wallet drop constraint test_quest_cap");
    await rpc("rune_delve_claim_quest", [id(401)]);
  },
);
await check(
  "chapter first clears grant the promised bonus and treasure telemetry is bounded by actual turns",
  async () => {
    const chapter = await rpc("rune_delve_ensure_level", [definition(50)]);
    await owner(
      "update rune_delve_class_progress set highest_unlocked_level=50 where user_id=$1 and class='warrior'",
      [id(1)],
    );
    const first = await save(450, {
      level_id: chapter.id,
      level_number: 50,
      reward_context: {
        turn_limit: 500,
        total_enemies: 1,
        treasure_shards: 1000000000,
      },
    });
    assert.equal(first.shardsAwarded, 310 + (3 * 2 + 2) * 4 * 5 * 3);
    const repeat = await save(451, { level_id: chapter.id, level_number: 50 });
    assert.equal(repeat.shardsAwarded, 58); // Replay 3+floor(50/10), plus boss 50; no second chapter bonus.
  },
);
await check('banked Expedition score/shards and full-clear milestones advance real quest counters exactly once',async()=>{
  await db.exec('reset role');
  await db.exec(`create table clubs(id uuid primary key);create table club_members(user_id uuid,club_id uuid);create table platform_assets(id uuid primary key,slug text);create table club_installed_assets(club_id uuid,asset_id uuid,enabled boolean);
    insert into clubs values('${id(10)}');insert into club_members values('${id(1)}','${id(10)}');insert into platform_assets values('${id(20)}','rune-delve');insert into club_installed_assets values('${id(10)}','${id(20)}',true);`);
  await db.exec(await readFile('supabase/migrations/20261030140000_rune_delve_expeditions.sql','utf8'));
  await db.exec('set role authenticated');
  const before=await producerProgress(1);
  await rpc('rune_delve_expedition_begin',[id(800),id(10),'warrior',0]);
  await rpc('rune_delve_expedition_finish',[id(800),6,3000,42,true]);
  const expected={...before,total_score:before.total_score+3000,shards_earned:before.shards_earned+112,class_run_complete:before.class_run_complete+1,bosses_defeated:before.bosses_defeated+1};
  assert.deepEqual(await producerProgress(1),expected);
  await rpc('rune_delve_expedition_finish',[id(800),6,3000,42,true]);
  assert.deepEqual(await producerProgress(1),expected);
  await rpc('rune_delve_expedition_begin',[id(801),id(10),'warrior',1]);
  await rpc('rune_delve_expedition_finish',[id(801),3,600,20,false]);
  assert.deepEqual(await producerProgress(1),{...expected,total_score:expected.total_score+600,shards_earned:expected.shards_earned+42});
});
await check(
  "receipts remain private and the internal XP helper cannot be called by a member",
  async () => {
    await actor(2);
    assert.equal(
      (
        await db.query(
          "select count(*)::integer n from rune_delve_action_receipts where user_id<>auth.uid()",
        )
      ).rows[0].n,
      0,
    );
    await assert.rejects(
      rpc("rune_delve_credit_xp", [id(1), "warrior", 10000]),
      /permission denied/,
    );
    await db.exec("set role anon");
    await assert.rejects(
      rpc("rune_delve_save_daily", [10, 3000, "warrior", id(500)]),
      /permission denied/,
    );
    await assert.rejects(
      rpc("rune_delve_ensure_level", [definition(3)]),
      /permission denied/,
    );
  },
);
console.log(JSON.stringify({ groups: checks, passed: true }));
await db.close();
