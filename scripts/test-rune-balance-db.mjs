// Current Rune economy / privilege contract in isolated PostgreSQL, never live.
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
create type rd_quest_status as enum('active','completed','claimed');create type rd_quest_scope as enum('daily','weekly');
create table clubs(id uuid primary key);create table club_members(user_id uuid,club_id uuid);
create table platform_assets(id uuid primary key,slug text);create table club_installed_assets(club_id uuid,asset_id uuid,enabled boolean);
create function current_user_club_id() returns uuid language sql stable security definer as $$select club_id from club_members where user_id=auth.uid() limit 1$$;
create function dh_visible_member(uuid) returns boolean language sql stable as $$select true$$;
create function dh_visible_club(uuid) returns boolean language sql stable as $$select true$$;
create function is_platform_owner(uuid) returns boolean language sql stable as $$select false$$;
create function is_app_admin(uuid) returns boolean language sql stable as $$select false$$;
insert into clubs values('11111111-1111-1111-1111-111111111111');
insert into auth.users values('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}'),('${id(5)}');
insert into club_members select id,'11111111-1111-1111-1111-111111111111' from auth.users;
insert into platform_assets values('${id(100)}','rune-delve');
insert into club_installed_assets values('11111111-1111-1111-1111-111111111111','${id(100)}',true);
`);
for (const path of [
  "scripts/fixtures/rune-schema.sql",
  "supabase/migrations/20260819120000_rune-delve-atomic-wallet.sql",
  "supabase/migrations/20261030140000_rune_delve_expeditions.sql",
  "supabase/migrations/20261031000000_rune_delve_settlement.sql",
  "supabase/migrations/20261031020000_rune_delve_quality_fixes.sql",
])
  await db.exec(await readFile(path, "utf8"));
const questSeed = await readFile(
  "supabase/migrations/20260423201930_292e151b-523d-49df-a1a1-5a8e33b92558.sql",
  "utf8",
);
await db.exec(
  questSeed.slice(
    questSeed.indexOf("INSERT INTO public.rune_delve_quest_definitions"),
  ),
);
await db.exec(`
grant usage on schema public,auth to anon,authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant update(shards) on rune_delve_wallet to authenticated;
insert into rune_delve_heroes(user_id,hero_name,xp,level) values('${id(1)}','Veteran',6000,14);
insert into rune_delve_class_progress(user_id,class,xp,level) values('${id(1)}','warrior',6000,14);
insert into rune_delve_heroes(user_id,hero_name,xp,level) values('${id(4)}','Earned Veteran',700,80);
insert into rune_delve_class_progress(user_id,class,xp,level) values('${id(4)}','warrior',700,70);
insert into rune_delve_wallet(user_id,shards,lifetime_shards_earned,slots_unlocked) values('${id(1)}',1500,2000,2);
insert into rune_delve_progress(user_id,highest_unlocked_level,highest_completed_level,total_levels_cleared) values('${id(1)}',51,50,50);
insert into rune_delve_relic_unlocks(user_id,relic_id,rank) values('${id(1)}','ember_edge',3);
insert into rune_delve_action_receipts(user_id,request_id,action_kind,action_key,result) values('${id(1)}','${id(9001)}','run','{"legacy":true}','{"legacy":true,"shardsAwarded":123}');
`);
const before = (
  await db.query(
    `select h.xp hero_xp,t.xp track_xp,w.shards,w.lifetime_shards_earned,r.rank,p.highest_unlocked_level from rune_delve_heroes h join rune_delve_class_progress t using(user_id) join rune_delve_wallet w using(user_id) join rune_delve_relic_unlocks r using(user_id) join rune_delve_progress p using(user_id) where h.user_id=$1`,
    [id(1)],
  )
).rows[0];
const migration = await readFile(
  "supabase/migrations/20261031030000_rune_delve_balance_pass.sql",
  "utf8",
);
await db.exec(migration);
await db.exec(migration);
await db.exec("set role authenticated");
const actor = async (n) =>
  db.query("select set_config('test.user',$1,false)", [id(n)]);
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
const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0];
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log("PASS", name);
}
await actor(1);
await check(
  "reruns preserve XP, balances, progression, relic ranks and historical receipts while leveling upward",
  async () => {
    const after = await scalar(
      `select h.xp hero_xp,t.xp track_xp,w.shards,w.lifetime_shards_earned,r.rank,p.highest_unlocked_level from rune_delve_heroes h join rune_delve_class_progress t using(user_id) join rune_delve_wallet w using(user_id) join rune_delve_relic_unlocks r using(user_id) join rune_delve_progress p using(user_id) where h.user_id=$1`,
      [id(1)],
    );
    assert.deepEqual(after, before);
    const account = await rpc("rune_delve_bootstrap");
    assert.equal(account.track.level, 27);
    assert.equal(account.wallet.slots_unlocked, 3);
    assert.deepEqual(
      await rpc("rune_delve_save_run", [{ legacy: true }, id(9001)]),
      { legacy: true, shardsAwarded: 123 },
    );
  },
);
await check(
  "authenticated JWT cannot mint, mutate balances/ranks/XP/progress/runs or forge quest sources",
  async () => {
    for (const sql of [
      `update rune_delve_wallet set shards=999999 where user_id='${id(1)}'`,
      `update rune_delve_relic_unlocks set rank=5 where user_id='${id(1)}'`,
      `insert into rune_delve_relic_unlocks(user_id,relic_id) values('${id(1)}','phoenix_heart')`,
      `update rune_delve_class_progress set xp=999999 where user_id='${id(1)}'`,
      `update rune_delve_progress set highest_unlocked_level=150 where user_id='${id(1)}'`,
      `insert into rune_delve_runs(user_id,score) values('${id(1)}',999999)`,
      `update rune_delve_active_quests set status='completed',progress=99999 where user_id='${id(1)}'`,
      `update rune_delve_quest_definitions set shard_reward=999999`,
      `update rune_delve_heroes set xp=999999 where user_id='${id(1)}'`,
    ])
      await assert.rejects(db.exec(sql), /permission denied/);
    await assert.rejects(
      rpc("rune_delve_earn_shards", [999999]),
      /permission denied/,
    );
    await assert.rejects(
      rpc("rune_delve_spend_shards", [1]),
      /permission denied/,
    );
    await assert.rejects(
      rpc("rune_delve_report_quest", [{ type: "total_score", amount: 999999 }]),
      /permission denied/,
    );
    await assert.rejects(
      rpc("rune_delve_roll_drop", [id(1), 150, "elite", id(8000)]),
      /permission denied/,
    );
    await db.exec(
      `update rune_delve_heroes set hero_name='Renamed' where user_id='${id(1)}'`,
    );
    assert.equal(
      (
        await scalar(
          "select hero_name from rune_delve_heroes where user_id=$1",
          [id(1)],
        )
      ).hero_name,
      "Renamed",
    );
  },
);
await check(
  "anonymous and unauthenticated callers cannot bootstrap or write currency",
  async () => {
    await db.exec("set role anon");
    await assert.rejects(rpc("rune_delve_bootstrap"), /permission denied/);
    await assert.rejects(
      rpc("rune_delve_earn_shards", [100]),
      /permission denied/,
    );
    await db.exec("set role authenticated");
    await db.query("select set_config('test.user','',false)");
    await assert.rejects(rpc("rune_delve_bootstrap"), /not_authenticated/);
    await assert.rejects(
      rpc("rune_delve_save_daily", [1, 100, "warrior", id(499)]),
      /not_authenticated/,
    );
  },
);
await actor(2);
await check(
  "safe bootstrap creates zero value, preserves existing identity and selects only canonical class stats",
  async () => {
    let account = await rpc("rune_delve_bootstrap");
    assert.equal(account.hero, null);
    assert.equal(account.wallet.shards, 0);
    account = await rpc("rune_delve_bootstrap", ["mage", "New Mage", true]);
    assert.equal(account.hero.hero_name, "New Mage");
    assert.equal(account.track.xp, 0);
    assert.equal(account.track.level, 1);
    assert.equal(
      (await rpc("rune_delve_bootstrap", ["warrior", "Overwrite", true])).hero
        .hero_name,
      "New Mage",
    );
    const selected = await rpc("rune_delve_select_class", ["warrior"]);
    assert.equal(selected.class, "warrior");
    assert.equal(selected.xp, 0);
    await assert.rejects(
      rpc("rune_delve_select_class", ["hacker"]),
      /Invalid class/,
    );
  },
);
await check(
  "server assigns bounded current quests once without client progress or reward fields",
  async () => {
    const assigned = await rpc("rune_delve_assign_quests");
    assert.equal(assigned.length, 6);
    assert.equal(assigned.filter((q) => q.scope === "daily").length, 3);
    assert.equal(assigned.filter((q) => q.scope === "weekly").length, 3);
    assert.ok(assigned.every((q) => q.progress === 0 && q.status === "active"));
    assert.deepEqual(await rpc("rune_delve_assign_quests"), assigned);
  },
);
const definition = (n) => ({
  level_number: n,
  generation_seed: n * 100,
  turn_limit: 18,
  enemy_config: [{ hp: 100, damage: 5 }],
  modifiers: {},
  objective_type: "defeat_all",
  board_size: 5,
});
const chambers = new Map();
for (const n of [1, 2, 10, 25, 50, 100, 151])
  chambers.set(n, await rpc("rune_delve_ensure_level", [definition(n)]));
const payload = (n = 1, extra = {}) => ({
  level_id: chambers.get(n).id,
  level_number: n,
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
const save = (receipt, n = 1, extra = {}) =>
  rpc("rune_delve_save_run", [payload(n, extra), id(receipt)]);
await check(
  "first clear and meaningful replay XP settle exactly once without the one-point record cliff",
  async () => {
    const first = await save(200);
    assert.equal(first.xpAwarded, 31);
    assert.equal(first.shardsAwarded, 16);
    assert.deepEqual(await save(200), first);
    const replay = await save(201, 1, { score: 900 });
    assert.equal(replay.xpAwarded, 8);
    assert.equal(replay.shardsAwarded, 6);
    const tinyRecord = await save(202, 1, { score: 1001 });
    assert.equal(tinyRecord.xpAwarded, 8);
    await assert.rejects(save(200, 1, { score: 1001 }), /request_id_reused/);
  },
);
await owner(
  "update rune_delve_class_progress set highest_unlocked_level=150 where user_id=$1 and class='warrior'",
  [id(2)],
);
await check(
  "first boss/chapter celebration survives while the repeat premium is modest",
  async () => {
    const first = await save(203, 50);
    assert.equal(first.shardsAwarded, 310);
    assert.equal(first.xpAwarded, 56);
    assert.equal((await save(204, 50)).shardsAwarded, 24);
  },
);
await check(
  "only legitimate milestones get path multipliers and treasure is capped by finite authored layout",
  async () => {
    assert.equal(
      (await save(205, 1, { reward_context: { path: "elite" } })).shardsAwarded,
      6,
    );
    const treasure = await save(206, 10, {
      reward_context: { path: "treasure", treasure_shards: 1000000 },
    });
    assert.equal(treasure.shardsAwarded, 40); // round(25*1.25)+3 cells*1 shard*3.
    const again = await save(207, 10, {
      reward_context: { path: "treasure", treasure_shards: 1000000 },
    });
    assert.equal(again.shardsAwarded, 19); // round(8*1.25)+9.
    await assert.rejects(
      rpc("rune_delve_ensure_level", [definition(100001)]),
      /invalid_level/,
    );
  },
);
await check(
  "campaign continuation beyond chamber 150 retains canonical identity and bounded XP",
  async () => {
    await owner(
      "update rune_delve_class_progress set highest_unlocked_level=151 where user_id=$1 and class='warrior'",
      [id(2)],
    );
    const next = await save(208, 151);
    assert.equal(next.row.level_number, 151);
    assert.equal(next.xpAwarded, 151);
    assert.equal(next.shardsAwarded, 161);
    assert.deepEqual(await save(208, 151), next);
    assert.equal(
      (
        await scalar(
          "select highest_unlocked_level from rune_delve_class_progress where user_id=$1 and class='warrior'",
          [id(2)],
        )
      ).highest_unlocked_level,
      152,
    );
    for (const [depth, cells] of [
      [151, 1],
      [152, 1],
      [154, 2],
      [160, 3],
      [180, 4],
      [200, 1],
    ])
      assert.equal(
        await rpc("rune_delve_treasure_cells", [depth, "standard"]),
        cells,
      );
  },
);
await check(
  "failed pickups diminish too and a nonmeaningful failure cannot grind XP",
  async () => {
    const args = {
      dungeon_cleared: false,
      hp_remaining: 0,
      enemies_defeated: 0,
      turns_used: 18,
      total_damage: 1,
      reward_context: {
        treasure_shards: 999999,
        turn_limit: 18,
        total_enemies: 1,
      },
    };
    const first = await save(210, 25, args);
    let last;
    for (let i = 211; i <= 214; i++) last = await save(i, 25, args);
    assert.ok(first.shardsAwarded > last.shardsAwarded);
    assert.ok(first.xpAwarded > last.xpAwarded);
    assert.equal(
      (await save(215, 2, { ...args, total_damage: 0 })).xpAwarded,
      0,
    );
  },
);
await check(
  "free drops are server-delivered, owned and receipt-idempotent",
  async () => {
    const beforeCount = (
      await scalar(
        "select count(*)::int n from rune_delve_relic_unlocks where user_id=$1",
        [id(2)],
      )
    ).n;
    let dropped;
    for (let i = 300; i < 450; i++) {
      const result = await save(i);
      if (result.relicDrop) {
        dropped = { result, receipt: i };
        break;
      }
    }
    assert.ok(
      dropped,
      "A deterministic drop exists in 150 seeded receipt trials",
    );
    const stored = await scalar(
      "select * from rune_delve_relic_unlocks where user_id=$1 and id=$2",
      [id(2), dropped.result.relicDrop.id],
    );
    assert.equal(stored.relic_id, dropped.result.relicDrop.relic_id);
    const afterCount = (
      await scalar(
        "select count(*)::int n from rune_delve_relic_unlocks where user_id=$1",
        [id(2)],
      )
    ).n;
    assert.ok(afterCount > beforeCount);
    assert.deepEqual(await save(dropped.receipt), dropped.result);
    assert.equal(
      (
        await scalar(
          "select count(*)::int n from rune_delve_relic_unlocks where user_id=$1",
          [id(2)],
        )
      ).n,
      afterCount,
    );
  },
);
await check(
  "daily zero-kill attempts pay nothing; improvements pay only a bounded positive difference",
  async () => {
    const lifetime = (
      await scalar(
        "select lifetime_runs from rune_delve_class_progress where user_id=$1 and class='warrior'",
        [id(2)],
      )
    ).lifetime_runs;
    const idle = await rpc("rune_delve_save_daily", [0, 0, "warrior", id(500)]);
    assert.deepEqual(idle.reward, { shards: 0, xp: 0, title: null });
    assert.equal(idle.firstMeaningfulAttempt, false);
    assert.equal(
      (
        await scalar(
          "select lifetime_runs from rune_delve_class_progress where user_id=$1 and class='warrior'",
          [id(2)],
        )
      ).lifetime_runs,
      lifetime,
    );
    const first = await rpc("rune_delve_save_daily", [
      3,
      800,
      "warrior",
      id(501),
    ]);
    assert.equal(first.reward.shards, 75);
    assert.equal(first.reward.xp, 30);
    assert.equal(first.firstMeaningfulAttempt, true);
    assert.equal(first.stars, 1);
    const better = await rpc("rune_delve_save_daily", [
      10,
      2500,
      "warrior",
      id(502),
    ]);
    assert.equal(better.reward.shards, 175);
    assert.equal(better.reward.xp, 70);
    assert.deepEqual(better.dailyRewardTotal, { shards: 250, xp: 100 });
    assert.deepEqual(
      await rpc("rune_delve_save_daily", [10, 2500, "warrior", id(502)]),
      better,
    );
    const lower = await rpc("rune_delve_save_daily", [
      6,
      1600,
      "warrior",
      id(503),
    ]);
    assert.equal(lower.reward.shards, 0);
    assert.equal(lower.reward.xp, 0);
    const best = await rpc("rune_delve_save_daily", [
      50,
      5000,
      "warrior",
      id(504),
    ]);
    assert.deepEqual(best.dailyRewardTotal, { shards: 900, xp: 500 });
    assert.equal(best.stars, 3);
    assert.equal(
      (
        await scalar(
          "select lifetime_runs from rune_delve_class_progress where user_id=$1 and class='warrior'",
          [id(2)],
        )
      ).lifetime_runs,
      lifetime + 1,
    );
  },
);
await check(
  "every daily ladder boundary matches the displayed canonical totals",
  async () => {
    for (const [kills, shards] of [
      [0, 0],
      [1, 25],
      [2, 25],
      [3, 75],
      [5, 75],
      [6, 150],
      [9, 150],
      [10, 250],
      [14, 250],
      [15, 400],
      [21, 400],
      [22, 600],
      [29, 600],
      [30, 900],
      [50, 900],
      [100, 900],
    ]) {
      const reward = await rpc("rune_delve_daily_reward", [kills]);
      assert.equal(reward.shards, shards);
      assert.equal(reward.xp, Math.min(500, kills * 10));
    }
  },
);
await actor(3);
await rpc("rune_delve_bootstrap", ["mage", "Legacy Daily", true]);
await owner(
  `insert into rune_delve_daily_runs(user_id,daily_date,score,stars,dungeon_cleared,modifiers,hero_class,kills_count) values($1,(now() at time zone 'UTC')::date,0,0,false,'[]','mage',0)`,
  [id(3)],
);
await check(
  "legacy paid idle currency remains paid after the new zero tier",
  async () => {
    const result = await rpc("rune_delve_save_daily", [
      1,
      100,
      "mage",
      id(510),
    ]);
    assert.equal(result.reward.shards, 0);
    assert.equal(result.dailyRewardTotal.shards, 25);
    assert.equal(result.reward.xp, 10);
  },
);
await actor(4);
await check(
  "earned levels above the new XP curve survive migration, zero credit and class switching",
  async () => {
    const account = await rpc("rune_delve_bootstrap");
    assert.equal(account.hero.level, 80);
    assert.equal(account.track.level, 80);
    assert.equal(account.track.xp, 700);
    assert.equal(account.wallet.slots_unlocked, 3);
    assert.equal(
      (await rpc("rune_delve_save_daily", [0, 0, "warrior", id(520)]))
        .classLevel,
      80,
    );
    await rpc("rune_delve_select_class", ["mage"]);
    const selected = await rpc("rune_delve_select_class", ["warrior"]);
    assert.equal(selected.level, 80);
    assert.equal(selected.xp, 700);
  },
);
await actor(5);
await rpc("rune_delve_bootstrap", ["warrior", "Receipted Daily", true]);
await owner(
  `insert into rune_delve_daily_runs(user_id,daily_date,score,stars,dungeon_cleared,modifiers,hero_class,kills_count) values($1,(now() at time zone 'UTC')::date,2500,1,false,'[]','warrior',10)`,
  [id(5)],
);
await owner(
  `insert into rune_delve_action_receipts(user_id,request_id,action_kind,action_key,result) values($1,$2,'daily','{}',jsonb_build_object('dateStr',(now() at time zone 'UTC')::date::text,'reward',jsonb_build_object('shards',25,'xp',10),'rewarded',true)),($1,$3,'daily','{}',jsonb_build_object('dateStr',(now() at time zone 'UTC')::date::text,'reward',jsonb_build_object('shards',0,'xp',0),'rewarded',false))`,
  [id(5), id(530), id(531)],
);
await check(
  "legacy receipts recover actual paid amounts when an unpaid attempt raised the daily best",
  async () => {
    const result = await rpc("rune_delve_save_daily", [
      10,
      2500,
      "warrior",
      id(532),
    ]);
    assert.deepEqual(result.reward, { shards: 225, xp: 90, title: null });
    assert.deepEqual(result.dailyRewardTotal, { shards: 250, xp: 100 });
    assert.equal(result.firstMeaningfulAttempt, false);
    assert.deepEqual(
      (await rpc("rune_delve_save_daily", [6, 1600, "warrior", id(533)]))
        .reward,
      { shards: 0, xp: 0, title: null },
    );
  },
);
await actor(3);
await check(
  "banked Expedition XP, shards and class progression use one durable acknowledgement",
  async () => {
    const ticket = await rpc("rune_delve_expedition_begin", [
      id(600),
      "11111111-1111-1111-1111-111111111111",
      "mage",
      0,
    ]);
    assert.equal(ticket.id, id(600));
    const first = await rpc("rune_delve_expedition_finish", [
      id(600),
      6,
      3000,
      45,
      true,
    ]);
    assert.equal(first.reward, 112);
    assert.equal(first.xpAwarded, 112);
    assert.deepEqual(
      await rpc("rune_delve_expedition_finish", [id(600), 6, 3000, 45, true]),
      first,
    );
    assert.equal(
      (
        await scalar(
          "select xp_awarded from rune_delve_expedition_runs where id=$1",
          [id(600)],
        )
      ).xp_awarded,
      112,
    );
  },
);
console.log(`Rune balance database contract passed: ${checks} groups`);
await db.close();
