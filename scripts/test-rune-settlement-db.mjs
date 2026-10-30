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
create table clubs(id uuid primary key);
create table club_members(user_id uuid,club_id uuid);
create table dh_private_accounts(user_id uuid,workspace_id uuid);
create function current_user_club_id() returns uuid language sql stable security definer as $$select club_id from club_members where user_id=auth.uid() limit 1$$;
create function dh_public_member(uid uuid) returns boolean language sql stable security definer as $$select not exists(select 1 from dh_private_accounts where user_id=uid)$$;
create function dh_visible_member(uid uuid) returns boolean language sql stable security definer as $$select uid=auth.uid() or dh_public_member(uid)$$;
create function dh_visible_club(cid uuid) returns boolean language sql stable security definer as $$select not exists(select 1 from dh_private_accounts where workspace_id=cid) or exists(select 1 from dh_private_accounts where workspace_id=cid and user_id=auth.uid())$$;
create function is_platform_owner(uid uuid) returns boolean language sql stable as $$select false$$;
create function is_app_admin(uid uuid) returns boolean language sql stable as $$select false$$;
insert into clubs values('11111111-1111-1111-1111-111111111111');
insert into club_members values('${id(1)}','11111111-1111-1111-1111-111111111111'),('${id(2)}','11111111-1111-1111-1111-111111111111');
`);
await db.exec(await readFile("scripts/fixtures/rune-schema.sql", "utf8"));
await db.exec(`
grant usage on schema public,auth to anon,authenticated;
grant select,insert,update on all tables in schema public to authenticated;
insert into auth.users values('${id(1)}'),('${id(2)}');
insert into rune_delve_heroes(user_id) values('${id(1)}'),('${id(2)}');
`);
const migration = await readFile(
  "supabase/migrations/20261031000000_rune_delve_settlement.sql",
  "utf8",
);
await db.exec(migration);
await db.exec(migration);
const qualityMigration = await readFile(
  "supabase/migrations/20261031020000_rune_delve_quality_fixes.sql",
  "utf8",
);
await db.exec(qualityMigration);
await db.exec(qualityMigration);
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
const producerTypes = [
  "daily_challenges_completed",
  "class_run_complete",
  "enemies_defeated",
  "total_score",
  "shards_earned",
  "class_xp_earned",
  "bosses_defeated",
];
for (const [index, type] of producerTypes.entries()) {
  await owner(
    "insert into rune_delve_quest_definitions(id,title,description,scope,objective_type,shard_reward,xp_reward,is_personal,hero_class) values($1,$1,$1,'weekly',$2,10,10,false,null)",
    ["producer_" + type, type],
  );
  for (const uid of [1, 2])
    await owner(
      "insert into rune_delve_active_quests(id,user_id,quest_id,scope,period_key,progress,target_value,status) values($1,$2,$3,'weekly',to_char(now() at time zone 'UTC','IYYY-\"W\"IW'),0,100000,'active')",
      [id(700 + uid * 10 + index), id(uid), "producer_" + type],
    );
}
const producerProgress = async (uid) =>
  Object.fromEntries(
    (
      await db.query(
        "select d.objective_type,a.progress from rune_delve_active_quests a join rune_delve_quest_definitions d on d.id=a.quest_id where a.user_id=$1 and d.id like 'producer_%'",
        [id(uid)],
      )
    ).rows.map((row) => [row.objective_type, row.progress]),
  );
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
await check(
  "daily completion and actual reward volumes advance quests once per acknowledged day",
  async () => {
    assert.deepEqual(await producerProgress(1), {
      daily_challenges_completed: 1,
      class_run_complete: 1,
      enemies_defeated: 0,
      total_score: 10,
      shards_earned: 25,
      class_xp_earned: 0,
      bosses_defeated: 0,
    });
    await actor(2);
    const first = await rpc("rune_delve_save_daily", [
      8,
      2500,
      "mage",
      id(310),
    ]);
    assert.equal(first.reward.shards, 75);
    assert.equal(first.reward.xp, 80);
    const expected = {
      daily_challenges_completed: 1,
      class_run_complete: 1,
      enemies_defeated: 8,
      total_score: 2500,
      shards_earned: 75,
      class_xp_earned: 80,
      bosses_defeated: 0,
    };
    assert.deepEqual(await producerProgress(2), expected);
    await rpc("rune_delve_save_daily", [8, 2500, "mage", id(310)]);
    await rpc("rune_delve_save_daily", [10, 3500, "mage", id(311)]);
    assert.deepEqual(await producerProgress(2), expected);
    await actor(1);
  },
);
await check(
  "quest counters use relative increments and quest claims pay XP and shards together once",
  async () => {
    await owner(
      "insert into rune_delve_quest_definitions(id,title,description,scope,objective_type,shard_reward,xp_reward,is_personal,hero_class) values('hunt','Monster Hunt','Defeat monsters','daily','enemies_defeated',70,200,false,null)",
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
await check(
  "banked Expedition score/shards and full-clear milestones advance real quest counters exactly once",
  async () => {
    await db.exec("reset role");
    await db.exec(`create table platform_assets(id uuid primary key,slug text);create table club_installed_assets(club_id uuid,asset_id uuid,enabled boolean);
    insert into clubs values('${id(10)}');insert into club_members values('${id(1)}','${id(10)}');insert into platform_assets values('${id(20)}','rune-delve');insert into club_installed_assets values('${id(10)}','${id(20)}',true);`);
    await db.exec(
      await readFile(
        "supabase/migrations/20261030140000_rune_delve_expeditions.sql",
        "utf8",
      ),
    );
    await db.exec("set role authenticated");
    const before = await producerProgress(1);
    await rpc("rune_delve_expedition_begin", [id(800), id(10), "warrior", 0]);
    await rpc("rune_delve_expedition_finish", [id(800), 6, 3000, 42, true]);
    const expected = {
      ...before,
      total_score: before.total_score + 3000,
      shards_earned: before.shards_earned + 112,
      class_run_complete: before.class_run_complete + 1,
      bosses_defeated: before.bosses_defeated + 1,
    };
    assert.deepEqual(await producerProgress(1), expected);
    await rpc("rune_delve_expedition_finish", [id(800), 6, 3000, 42, true]);
    assert.deepEqual(await producerProgress(1), expected);
    await rpc("rune_delve_expedition_begin", [id(801), id(10), "warrior", 1]);
    await rpc("rune_delve_expedition_finish", [id(801), 3, 600, 20, false]);
    assert.deepEqual(await producerProgress(1), {
      ...expected,
      total_score: expected.total_score + 600,
      shards_earned: expected.shards_earned + 42,
    });
  },
);
const campaignTypes = [
  "levels_cleared",
  "longest_chain",
  "no_damage_clear",
  "total_score",
  "enemies_defeated",
  "class_run_complete",
  "abilities_used",
  "daily_challenges_completed",
  "bosses_defeated",
  "shards_earned",
  "high_level_clears",
  "class_xp_earned",
];
for (const [index, type] of campaignTypes.entries()) {
  await owner(
    "insert into rune_delve_quest_definitions(id,title,description,scope,objective_type) values($1,$1,$1,'weekly',$2)",
    ["campaign_" + type, type],
  );
  await owner(
    "insert into rune_delve_active_quests(id,user_id,quest_id,scope,period_key,target_value) values($1,$2,$3,'weekly',to_char(now() at time zone 'UTC','IYYY-\"W\"IW'),$4)",
    [
      id(900 + index),
      id(1),
      "campaign_" + type,
      type === "no_damage_clear" ? 1 : 100000,
    ],
  );
}
const campaignProgress = async () =>
  Object.fromEntries(
    (
      await db.query(
        "select d.objective_type,a.progress from rune_delve_active_quests a join rune_delve_quest_definitions d on d.id=a.quest_id where a.user_id=$1 and d.id like 'campaign_%'",
        [id(1)],
      )
    ).rows.map((row) => [row.objective_type, row.progress]),
  );
await check(
  "campaign quests commit with the run receipt, including ability/boss telemetry and actual paid XP",
  async () => {
    const payload = {
      score: 9000,
      enemies_defeated: 3,
      longest_chain: 10,
      ability_used: true,
      quest_context: {
        abilities_used: 2,
        bosses_defeated: 1,
        no_damage_clear: true,
      },
    };
    const receipt = await save(920, payload);
    assert.equal(receipt.xpAwarded, 140);
    assert.deepEqual(receipt.completedQuests, ["campaign_no_damage_clear"]);
    const expected = {
      levels_cleared: 1,
      longest_chain: 10,
      no_damage_clear: 1,
      total_score: 9000,
      enemies_defeated: 3,
      class_run_complete: 1,
      abilities_used: 2,
      daily_challenges_completed: 0,
      bosses_defeated: 1,
      shards_earned: receipt.shardsAwarded,
      high_level_clears: 0,
      class_xp_earned: 140,
    };
    assert.deepEqual(await campaignProgress(), expected);
    assert.deepEqual(await save(920, payload), receipt);
    assert.deepEqual(await campaignProgress(), expected);
    const failed = await save(921, {
      score: 100,
      dungeon_cleared: false,
      enemies_defeated: 0,
      ability_used: false,
      quest_context: {
        abilities_used: 999,
        bosses_defeated: 999,
        no_damage_clear: true,
      },
    });
    assert.deepEqual(await campaignProgress(), {
      ...expected,
      total_score: 9100,
      class_run_complete: 2,
      shards_earned: expected.shards_earned + failed.shardsAwarded,
    });
  },
);
await check(
  "a quest-write failure rolls back the campaign payment and preserves a retryable action",
  async () => {
    const beforeWallet = await one("rune_delve_wallet");
    const beforeRun = await one("rune_delve_runs");
    const before = await campaignProgress();
    await owner(
      "alter table rune_delve_active_quests add constraint test_campaign_quest_guard check(quest_id<>'campaign_class_run_complete' or progress<=2)",
    );
    await assert.rejects(
      save(922, { score: 200, quest_context: {} }),
      /test_campaign_quest_guard/,
    );
    assert.equal((await one("rune_delve_wallet")).shards, beforeWallet.shards);
    assert.equal((await one("rune_delve_runs")).attempts, beforeRun.attempts);
    assert.deepEqual(await campaignProgress(), before);
    await owner(
      "alter table rune_delve_active_quests drop constraint test_campaign_quest_guard",
    );
    await save(922, { score: 200, quest_context: {} });
    assert.equal((await campaignProgress()).class_run_complete, 3);
  },
);
await check(
  "cached clients without quest_context retain one client producer and unchanged receipt retries",
  async () => {
    const before = await campaignProgress();
    const receipt = await save(926, { score: 300, ability_used: true });
    assert.deepEqual(receipt.completedQuests, []);
    assert.deepEqual(await campaignProgress(), before);
    assert.deepEqual(
      await save(926, { score: 300, ability_used: true }),
      receipt,
    );
    assert.deepEqual(await campaignProgress(), before);
    // The currently deployed page reports after receiving its run response.
    await rpc("rune_delve_report_quest", [
      {
        type: "class_run_complete",
        amount: 1,
        heroClass: "warrior",
        questIds: [id(905)],
      },
    ]);
    assert.deepEqual(await campaignProgress(), {
      ...before,
      class_run_complete: before.class_run_complete + 1,
    });
  },
);
await check(
  "boss failure rewards include bounded phase progress and match the preview equation",
  async () => {
    const boss = await rpc("rune_delve_ensure_level", [definition(75)]);
    await owner(
      "update rune_delve_class_progress set highest_unlocked_level=75 where user_id=$1 and class='warrior'",
      [id(1)],
    );
    const payload = {
      level_id: boss.id,
      level_number: 75,
      score: 1,
      dungeon_cleared: false,
      enemies_defeated: 0,
      turns_used: 18,
      reward_context: {
        turn_limit: 18,
        total_enemies: 1,
        boss_rule: true,
        boss_phase_reached: 0,
      },
    };
    assert.equal((await save(923, payload)).shardsAwarded, 9);
    await owner(
      "update rune_delve_failure_rewards set failure_count=0 where user_id=$1 and level_number=75",
      [id(1)],
    );
    assert.equal(
      (
        await save(924, {
          ...payload,
          reward_context: { ...payload.reward_context, boss_phase_reached: 3 },
        })
      ).shardsAwarded,
      13,
    );
    await owner(
      "update rune_delve_failure_rewards set failure_count=0 where user_id=$1 and level_number=75",
      [id(1)],
    );
    assert.equal(
      (
        await save(925, {
          ...payload,
          reward_context: {
            ...payload.reward_context,
            boss_phase_reached: 999,
          },
        })
      ).shardsAwarded,
      13,
    );
  },
);
await check(
  "account saves survive club transfers while shared reads follow current membership and private exclusions",
  async () => {
    await owner("insert into clubs values($1),($2)", [id(40), id(41)]);
    await owner("update club_members set club_id=$1 where user_id=$2", [
      id(40),
      id(1),
    ]);
    for (const n of [3, 4, 5, 6, 7]) {
      await owner("insert into auth.users values($1)", [id(n)]);
      await owner("insert into club_members values($1,$2)", [
        id(n),
        n === 4 ? "11111111-1111-1111-1111-111111111111" : id(40),
      ]);
    }
    await owner("insert into dh_private_accounts values($1,$2)", [
      id(5),
      id(41),
    ]);
    for (const n of [3, 4, 5, 6]) {
      const origin = n === 6 ? id(41) : "11111111-1111-1111-1111-111111111111";
      await owner(
        "insert into rune_delve_heroes(user_id,club_id) values($1,$2)",
        [id(n), origin],
      );
      await owner(
        "insert into rune_delve_class_progress(user_id,class,club_id) values($1,'warrior',$2)",
        [id(n), origin],
      );
      await owner(
        "insert into rune_delve_progress(user_id,club_id) values($1,$2)",
        [id(n), origin],
      );
      await owner(
        "insert into rune_delve_runs(user_id,hero_class,club_id) values($1,'warrior',$2)",
        [id(n), origin],
      );
      await owner(
        "insert into rune_delve_daily_runs(user_id,daily_date,hero_class,club_id) values($1,current_date,'warrior',$2)",
        [id(n), origin],
      );
    }
    for (const table of [
      "rune_delve_heroes",
      "rune_delve_class_progress",
      "rune_delve_progress",
      "rune_delve_runs",
      "rune_delve_daily_runs",
    ]) {
      const visible = (
        await db.query(`select distinct user_id from ${table} order by user_id`)
      ).rows.map((row) => row.user_id);
      assert.deepEqual(visible, [id(1), id(3)], table);
    }
    await actor(7);
    await db.query("insert into rune_delve_heroes(user_id) values($1)", [
      id(7),
    ]);
    assert.equal(
      (
        await db.query(
          "select club_id from rune_delve_heroes where user_id=auth.uid()",
        )
      ).rows[0].club_id,
      id(40),
    );
    await actor(5);
    assert.equal(
      (
        await db.query(
          "select count(*)::integer n from rune_delve_heroes where user_id=auth.uid()",
        )
      ).rows[0].n,
      1,
    );
    await actor(1);
  },
);
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
