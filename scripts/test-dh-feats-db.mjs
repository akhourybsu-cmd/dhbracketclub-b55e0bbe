// Real PostgreSQL functions, triggers, constraints and RLS in isolated PGlite.
// npm install --prefix /tmp/dh-feats-db @electric-sql/pglite
// PGLITE_MODULE=/tmp/dh-feats-db/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-dh-feats-db.mjs
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite(),
  id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const migration = await readFile(
  "supabase/migrations/20261029040000_dh_feats.sql",
  "utf8",
);
const catalog = JSON.parse(
  await readFile("src/lib/feats/catalog.json", "utf8"),
);
let seq = 1000,
  checks = 0;
const check = async (name, fn) => {
  await fn();
  checks++;
  console.log("PASS", name);
};
await db.exec(
  `create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;`,
);
await db.exec(await readFile("scripts/fixtures/dh-feats-sources.sql", "utf8"));
await db.exec(
  `insert into profiles(id,display_name) values('${id(1)}','Alice'),('${id(2)}','Bob'),('${id(3)}','Carol'),('${id(4)}','Outside');insert into club_members(user_id,club_id) values('${id(1)}','${id(10)}'),('${id(2)}','${id(10)}'),('${id(3)}','${id(10)}'),('${id(4)}','${id(11)}');`,
);
const insert = async (table, row) => {
  const cols = Object.keys(row),
    args = Object.values(row).map((v) =>
      v && typeof v === "object" ? JSON.stringify(v) : v,
    );
  await db.query(
    `insert into ${table}(${cols.join(",")}) values(${cols.map((_, i) => "$" + (i + 1)).join(",")})`,
    args,
  );
};
for (let n = 0; n < 5; n++)
  await insert("daily_finds", {
    id: id(seq++),
    club_id: id(10),
    user_id: id(1),
    kind: "learned",
    title: "Saved history",
    created_at: "2026-01-01T12:00:00Z",
  });
await db.exec(migration);
await db.exec(migration);
const owner = async (fn) => {
  await db.exec("reset role");
  try {
    return await fn();
  } finally {
    await db.exec("set role authenticated");
  }
};
const actor = (n) =>
  db.query("select set_config('test.user',$1,false)", [n ? id(n) : ""]);
const rpc = async (name, args = []) =>
  (
    await db.query(
      `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) r`,
      args,
    )
  ).rows[0].r;
const board = () => rpc("dh_feats_board", [id(10)]);
const metrics = (n = 1) => owner(() => rpc("dh_feat_metrics", [id(n)]));
const seed = (table, row) =>
  owner(() => insert(table, { id: id(seq++), ...row }));
const source = (table, row) =>
  seed(table, { club_id: id(10), user_id: id(1), ...row });
await db.exec("set role authenticated");
await actor(1);
await check(
  "63 source-backed families and 314 tiers; repeatable migration",
  async () => {
    const b = await board();
    assert.equal(b.catalog.length, 63);
    assert.equal(
      b.catalog.reduce((n, f) => n + f.thresholds.length, 0),
      314,
    );
    assert.deepEqual(b.catalog, catalog);
    assert.equal(b.progress.drop_posts, 5);
    assert.equal(b.score, 80);
    assert.ok(b.unlocks.every((u) => u.historical));
    assert.equal(b.monthly_me.score, 0);
    assert.equal(b.leaders.length, 3);
    assert.equal(b.leaders[0].user_id, id(1));
    assert.equal(b.leaders[1].rank, b.leaders[2].rank);
  },
);
await check(
  "authentication, membership, private source metrics and server-only awards",
  async () => {
    await actor(0);
    await assert.rejects(board, /membership/);
    await actor(4);
    await assert.rejects(board, /membership/);
    await actor(1);
    assert.equal(
      (await db.query("select * from dh_feat_accounts")).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query("select * from dh_feat_progress where user_id=$1", [
          id(2),
        ])
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query("select * from dh_feat_unlocks where user_id=$1", [
          id(2),
        ])
      ).rows.length,
      0,
    );
    await assert.rejects(
      () =>
        db.query("update dh_feat_accounts set dirty=false where user_id=$1", [
          id(1),
        ]),
      /permission/,
    );
    await assert.rejects(() => rpc("dh_feat_metrics", [id(2)]), /permission/);
    await assert.rejects(
      () => rpc("dh_feats_refresh_user", [id(2)]),
      /permission/,
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into dh_feat_unlocks values($1,$2,1,999,1,now(),false)",
          [id(1), "drop_posts"],
        ),
      /permission/,
    );
  },
);
await check(
  "Drop types, variety, distinct discussion targets and unique appreciation",
  async () => {
    const find = id(seq++);
    await source("daily_finds", {
      id: find,
      kind: "learned",
      title: "A new discovery",
      created_at: "2026-01-02T12:00:00Z",
    });
    await source("daily_finds", {
      kind: "article",
      title: "Read this",
      created_at: "2026-01-02T13:00:00Z",
    });
    await source("daily_finds", {
      kind: "photo",
      title: "Saw this",
      created_at: "2026-01-02T14:00:00Z",
    });
    await seed("daily_find_comments", {
      find_id: find,
      user_id: id(2),
      body: "Good find",
    });
    await seed("daily_find_comments", {
      find_id: find,
      user_id: id(2),
      body: "One more thought",
    });
    await seed("daily_find_comments", {
      find_id: find,
      user_id: id(1),
      body: "My own follow-up",
    });
    await seed("daily_find_reactions", {
      find_id: find,
      user_id: id(1),
      emoji: "fire",
    });
    await seed("daily_find_reactions", {
      find_id: find,
      user_id: id(2),
      emoji: "fire",
    });
    await seed("daily_find_reactions", {
      find_id: find,
      user_id: id(2),
      emoji: "heart",
    });
    await seed("daily_find_reactions", {
      find_id: find,
      user_id: id(3),
      emoji: "heart",
    });
    const m = await metrics();
    assert.equal(m.drop_posts, 8);
    assert.equal(m.drop_learned, 6);
    assert.equal(m.drop_articles, 1);
    assert.equal(m.drop_photos, 1);
    assert.equal(m.drop_days, 2);
    assert.equal(m.drop_variety, 1);
    assert.equal(m.drop_appreciation, 2);
    assert.equal(m.drop_comments, 0);
    assert.equal((await metrics(2)).drop_comments, 1);
    const b = await board();
    assert.ok(
      b.unlocks.some((u) => u.feat_key === "drop_articles" && !u.historical),
    );
    assert.ok(b.monthly_me.score > 0);
  },
);
await check(
  "refreshes, edits and deletions cannot duplicate or revoke an earned tier",
  async () => {
    const before = await board();
    await board();
    await owner(() => db.exec("update daily_finds set title='Edited title'"));
    assert.equal((await board()).score, before.score);
    await owner(() =>
      db.query("delete from daily_finds where user_id=$1", [id(1)]),
    );
    const after = await board();
    assert.equal(after.score, before.score);
    assert.equal(after.progress.drop_posts, 8);
    await source("daily_finds", { kind: "learned", title: "A new find" });
    assert.equal((await board()).progress.drop_posts, 8);
  },
);
await check(
  "cross-device pins enforce three valid unique goals and isolate accounts",
  async () => {
    assert.deepEqual(
      await rpc("dh_feats_pin", [
        ["drop_posts", "pw_profit", "nexus_best", "drop_posts"],
      ]),
      ["drop_posts", "pw_profit", "nexus_best"],
    );
    await assert.rejects(
      () =>
        rpc("dh_feats_pin", [
          ["drop_posts", "pw_profit", "nexus_best", "active_days"],
        ]),
      /three/,
    );
    await assert.rejects(
      () => rpc("dh_feats_pin", [["forged-achievement"]]),
      /valid/,
    );
    assert.equal((await board()).pinned.length, 3);
    await actor(2);
    assert.deepEqual((await board()).pinned, []);
    await actor(1);
  },
);
await check(
  "portfolio seed money, market-day baseline and missing-day exclusion",
  async () => {
    const season = id(seq++),
      portfolio = id(seq++);
    await seed("pw_seasons", {
      id: season,
      club_id: id(10),
      starting_cash: 50000,
      status: "active",
    });
    await source("pw_portfolios", {
      id: portfolio,
      season_id: season,
      total_value: 50000,
      valued_at: "2026-01-02T21:00:00Z",
    });
    assert.equal((await metrics()).pw_equity, 0);
    await source("pw_trades", {
      portfolio_id: portfolio,
      season_id: season,
      side: "buy",
      symbol: "TEST",
      shares: 1,
      price: 100,
      amount: 100,
      trading_date: "2026-01-02",
    });
    assert.equal((await metrics()).pw_profit, 0);
    await seed("pw_daily_values", {
      portfolio_id: portfolio,
      club_id: id(10),
      trading_date: "2026-01-02",
      value: 50000,
    });
    await seed("pw_daily_values", {
      portfolio_id: portfolio,
      club_id: id(10),
      trading_date: "2026-01-05",
      value: 51100,
    });
    assert.equal((await metrics()).pw_day_gain, 1100);
    await owner(() =>
      db.exec(
        "insert into pw_market_holidays(holiday_date,early_close) values('2026-01-06',false)",
      ),
    );
    await seed("pw_daily_values", {
      portfolio_id: portfolio,
      club_id: id(10),
      trading_date: "2026-01-07",
      value: 51500,
    });
    await seed("pw_daily_values", {
      portfolio_id: portfolio,
      club_id: id(10),
      trading_date: "2026-01-09",
      value: 80000,
    });
    const m = await metrics();
    assert.equal(m.pw_day_gain, 1100);
    assert.equal(m.pw_green_days, 2);
    assert.equal(m.pw_equity, 80000);
    assert.equal(m.pw_profit, 30000);
    assert.equal(m.pw_trade_days, 1);
    await owner(() =>
      db.query(
        "update pw_portfolios set total_value=100000,valued_at=now() where id=$1",
        [portfolio],
      ),
    );
    await owner(() =>
      db.query("update pw_portfolios set total_value=60000 where id=$1", [
        portfolio,
      ]),
    );
    const b = await board();
    assert.equal(b.progress.pw_equity, 100000);
    assert.equal(b.progress.pw_profit, 50000);
    assert.equal(b.progress.pw_day_gain, 1100);
    assert.equal(
      b.unlocks.filter((u) => u.feat_key === "pw_day_gain").length,
      3,
    );
  },
);
await check(
  "short-lived intraday gains survive a later quote reversal",
  async () => {
    const portfolio = (
      await owner(() => db.query("select id from pw_portfolios limit 1"))
    ).rows[0].id;
    await seed("pw_daily_values", {
      portfolio_id: portfolio,
      club_id: id(10),
      trading_date: "2026-01-12",
      value: 90000,
    });
    await owner(() =>
      db.query(
        "update pw_daily_values set value=79000 where portfolio_id=$1 and trading_date='2026-01-12'",
        [portfolio],
      ),
    );
    const b = await board();
    assert.equal(b.progress.pw_day_gain, 10000);
    assert.equal(
      b.unlocks.filter((u) => u.feat_key === "pw_day_gain").length,
      5,
    );
  },
);
await check(
  "draft eligibility, perfect boards and rated-pick ladders use completed results",
  async () => {
    const draft = id(seq++);
    await seed("drafts", { id: draft, club_id: id(10), status: "in_progress" });
    for (const n of [1, 2])
      await source("draft_results", {
        user_id: id(n),
        draft_id: draft,
        rank: n,
        pick_ratings: [{ score: 8 }, { score: 9 }, { score: 8 }, { score: 10 }],
      });
    assert.equal((await metrics()).drafts_completed, 0);
    await owner(() =>
      db.query("update drafts set status='completed' where id=$1", [draft]),
    );
    assert.equal((await metrics()).drafts_completed, 0);
    await source("draft_results", {
      user_id: id(3),
      draft_id: draft,
      rank: 3,
      pick_ratings: [],
    });
    const m = await metrics();
    assert.equal(m.drafts_completed, 1);
    assert.equal(m.draft_wins, 1);
    assert.equal(m.draft_podiums, 0);
    assert.equal(m.draft_rated_picks, 4);
    assert.equal(m.draft_perfect_boards, 1);
    const b = await board();
    assert.ok(
      b.leaders.find((x) => x.user_id === id(2)).score > 0,
      "Club refresh also evaluates other members",
    );
  },
);
await check(
  "Nexus current-rules results, canonical builds, unlock ownership and Rune records",
  async () => {
    await source("nexus_core_runs", {
      mode: "endless",
      waves: 50,
      kills: 1000,
      balance_version: 3,
      loadout: { weapons: [] },
    });
    for (const weapons of [
      ["orbit", "arc"],
      ["arc", "orbit"],
    ])
      await source("nexus_core_runs", {
        mode: "endless",
        waves: 10,
        kills: 100,
        balance_version: 5,
        loadout: { weapons, module: null },
      });
    await owner(() =>
      db.query(
        "insert into nexus_core_profiles(user_id,unlocks) values($1,array['orbit','arc','repair'])",
        [id(1)],
      ),
    );
    await source("rune_delve_runs", {
      clears: 7,
      dungeon_cleared: true,
      enemies_defeated: 80,
      longest_chain: 12,
      level_number: 15,
    });
    const m = await metrics();
    assert.equal(m.nexus_waves, 20);
    assert.equal(m.nexus_best, 10);
    assert.equal(m.nexus_builds, 1);
    assert.equal(m.nexus_weapons, 2);
    assert.equal(m.nexus_kills, 200);
    assert.equal(m.rune_clears, 7);
    assert.equal(m.rune_chain, 12);
    assert.equal(m.rune_level, 15);
  },
);
await check(
  "FORGE distinguishes units, ignores revoked logs and unfinished sessions",
  async () => {
    const ex = id(seq++),
      date = "2026-01-03";
    await seed("workout_exercises", {
      id: ex,
      club_id: id(10),
      name: "Push-ups",
    });
    for (const [measurement_type, raw_value, status] of [
      ["reps", 100, "active"],
      ["duration", 600, "active"],
      ["distance", 2, "active"],
      ["reps", 10000, "revoked"],
    ])
      await source("workout_activities", {
        exercise_id: ex,
        measurement_type,
        raw_value,
        status,
        activity_local_date: date,
      });
    const complete = id(seq++),
      unfinished = id(seq++);
    await source("workout_log_sessions", {
      id: complete,
      status: "completed",
      activity_local_date: date,
    });
    await source("workout_log_sessions", {
      id: unfinished,
      status: "in_progress",
      activity_local_date: "2026-01-04",
    });
    await source("workout_log_entries", {
      session_id: complete,
      exercise_name: "Squat",
      log_kind: "weight_reps",
      sets: [
        { weight: 100, reps: 20 },
        { weight: 0, reps: 10 },
      ],
    });
    await source("workout_log_entries", {
      session_id: complete,
      exercise_name: "Running",
      log_kind: "cardio",
      seconds: 600,
      distance_mi: 1,
    });
    await source("workout_log_entries", {
      session_id: unfinished,
      exercise_name: "Not finished",
      log_kind: "reps",
      reps: 10000,
    });
    const m = await metrics();
    assert.equal(m.forge_days, 1);
    assert.equal(m.forge_sessions, 1);
    assert.equal(m.forge_reps, 130);
    assert.equal(m.forge_minutes, 20);
    assert.equal(m.forge_miles, 3);
    assert.equal(m.forge_movements, 3);
  },
);
await check(
  "READSHIFT, NFL, brackets, posts, lore, polls and rankings use saved participation",
  async () => {
    await source("readshift_stats", {
      rounds_played: 30,
      correct_reads: 55,
      games_played: 5,
      games_won: 1,
    });
    for (const is_correct of [true, false, null])
      await source("nfl_picks", { is_correct });
    await source("nfl_chain_standings", { best_chain: 15, perfect_games: 3 });
    const pool = id(seq++);
    await source("brackets", { pool_id: pool, status: "draft" });
    await source("brackets", {
      pool_id: pool,
      status: "submitted",
      submitted_at: "2026-01-02",
    });
    await seed("standings", {
      user_id: id(1),
      pool_id: pool,
      correct_picks: 30,
    });
    const post = id(seq++),
      lore = id(seq++);
    await source("posts", { id: post, user_id: id(2), content: "Topic" });
    for (let i = 0; i < 3; i++)
      await source("post_comments", { post_id: post, content: "Thought" });
    await source("posts", { content: "My topic" });
    await source("posts", { content: "  " });
    await seed("lore_entries", {
      id: lore,
      club_id: id(10),
      created_by: id(2),
    });
    await source("lore_contributions", { lore_id: lore, content: "History" });
    await source("poll_votes", { poll_id: id(8000) });
    await source("poll_votes", { poll_id: id(8000) });
    await source("ranking_submissions", {
      ranking_id: id(9000),
      submitted_at: "2026-01-02",
    });
    const m = await metrics();
    assert.equal(m.readshift_rounds, 30);
    assert.equal(m.readshift_reads, 55);
    assert.equal(m.readshift_wins, 1);
    assert.equal(m.nfl_correct, 1);
    assert.equal(m.nfl_chain, 15);
    assert.equal(m.brackets_submitted, 1);
    assert.equal(m.brackets_correct, 30);
    assert.equal(m.post_comments, 1);
    assert.equal(m.posts_created, 1);
    assert.equal(m.lore_contributions, 1);
    assert.equal(m.poll_votes, 1);
    assert.equal(m.ranking_submissions, 1);
  },
);
await check(
  "locks exclude self-solves; event RSVPs remain distinct from attendance",
  async () => {
    const mine = id(seq++),
      theirs = id(seq++);
    await source("lockbox_locks", { id: mine, week_id: id(100) });
    await source("lockbox_locks", {
      id: theirs,
      user_id: id(2),
      week_id: id(100),
    });
    for (const lock_id of [mine, theirs, theirs])
      await seed("lockbox_attempts", {
        lock_id,
        attacker_id: id(1),
        is_solved: true,
        solved_at: "2026-01-05",
      });
    await seed("events", { created_by: id(1), club_id: id(10) });
    for (const [event_id, status] of [
      [id(600), "going"],
      [id(600), "going"],
      [id(601), "maybe"],
    ])
      await source("event_rsvps", { event_id, status });
    const m = await metrics();
    assert.equal(m.locks_solved, 1);
    assert.equal(m.locks_created, 1);
    assert.equal(m.events_created, 1);
    assert.equal(m.events_going, 1);
  },
);
await check(
  "public character activity and real journeys exclude private and studio test play",
  async () => {
    await seed("narrative_messages", {
      sender_id: id(1),
      character_id: id(123),
      visibility: "public",
      message_type: "character_action",
      body: "Investigate the room",
    });
    await seed("narrative_messages", {
      sender_id: id(1),
      character_id: id(123),
      visibility: "private",
      message_type: "character_action",
      body: "Secret",
    });
    for (const [is_test_run, ending_key] of [
      [false, "dawn"],
      [true, "dusk"],
    ]) {
      const run = id(seq++);
      await seed("journey_campaign_runs", {
        id: run,
        user_id: id(1),
        campaign_id: id(500),
        status: "completed",
        ending_key,
        is_test_run,
      });
      await seed("journey_run_choice_history", {
        user_id: id(1),
        run_id: run,
        choice_key: "left",
      });
    }
    const m = await metrics();
    assert.equal(m.narrative_posts, 1);
    assert.equal(m.journey_choices, 1);
    assert.equal(m.journey_finishes, 1);
    assert.equal(m.journey_endings, 1);
    assert.deepEqual(Object.keys(m).sort(), catalog.map((f) => f.key).sort());
    assert.ok(
      Object.values(m).every((v) => Number.isFinite(Number(v)) && v >= 0),
    );
    assert.ok(m.feature_explorer >= 12);
  },
);
await check(
  "Portfolio wins require completed competitions and three participants; late entries invalidate every affected account",
  async () => {
    const challenge = id(seq++);
    await seed("pw_challenges", {
      id: challenge,
      club_id: id(10),
      status: "completed",
    });
    for (const n of [1, 2])
      await source("pw_entries", {
        challenge_id: challenge,
        user_id: id(n),
        submitted_at: "2026-01-02",
        final_rank: n,
      });
    assert.equal((await board()).progress.pw_wins, 0);
    await source("pw_entries", {
      challenge_id: challenge,
      user_id: id(3),
      submitted_at: "2026-01-02",
      final_rank: 3,
    });
    assert.equal((await board()).progress.pw_wins, 1);
    const season = id(seq++);
    await seed("pw_seasons", {
      id: season,
      club_id: id(10),
      starting_cash: 100000,
      status: "active",
    });
    for (const n of [1, 2, 3])
      await source("pw_portfolios", {
        season_id: season,
        user_id: id(n),
        total_value: 100000,
        final_rank: n,
      });
    assert.equal((await metrics()).pw_wins, 1);
    await owner(() =>
      db.query("update pw_seasons set status='completed' where id=$1", [
        season,
      ]),
    );
    assert.equal((await board()).progress.pw_wins, 2);
    const portfolio = (
      await owner(() =>
        db.query("select id from pw_portfolios where user_id=$1 limit 1", [
          id(1),
        ]),
      )
    ).rows[0].id;
    for (const realized_pl of [100, -100, 0])
      await source("pw_trades", {
        portfolio_id: portfolio,
        season_id: season,
        side: "sell",
        symbol: "TEST",
        shares: 1,
        price: 100,
        amount: 100,
        realized_pl,
        trading_date: "2026-01-02",
      });
    const m = await metrics();
    assert.equal(m.pw_profitable_sales, 1);
    assert.equal(m.pw_trade_days, 1);
  },
);
await check(
  "score exactly equals unique receipts; monthly excludes backfill; seen receipts persist",
  async () => {
    const b = await board();
    assert.equal(
      b.score,
      b.unlocks.reduce((sum, u) => sum + u.points, 0),
    );
    assert.equal(b.unlocked, b.unlocks.length);
    assert.equal(
      new Set(b.unlocks.map((u) => u.feat_key + ":" + u.tier)).size,
      b.unlocked,
    );
    assert.equal(
      b.monthly_me.score,
      b.unlocks
        .filter((u) => !u.historical)
        .reduce((sum, u) => sum + u.points, 0),
    );
    await rpc("dh_feats_seen", [b.as_of]);
    const refreshed = await board();
    assert.equal(refreshed.score, b.score);
    assert.ok(Date.parse(refreshed.seen_at) >= Date.parse(b.as_of));
    assert.deepEqual(await rpc("dh_feats_summary", [id(10)]), {
      score: b.score,
      unlocked: b.unlocked,
    });
  },
);
await check(
  "new members earn their first feats as new awards rather than historical imports",
  async () => {
    await owner(async () => {
      await insert("profiles", { id: id(5), display_name: "New member" });
      await insert("club_members", { user_id: id(5), club_id: id(10) });
      await insert("posts", {
        id: id(seq++),
        user_id: id(5),
        club_id: id(10),
        content: "Hello club",
      });
    });
    await actor(5);
    const b = await board();
    assert.equal(b.score, 30);
    assert.equal(b.monthly_me.score, 30);
    assert.ok(b.unlocks.every((u) => !u.historical));
    await actor(1);
  },
);
await check(
  "catalog redeployment preserves point receipts, tracking and earned progress",
  async () => {
    const before = await board();
    await owner(() => db.exec(migration));
    const after = await board();
    assert.equal(after.score, before.score);
    assert.equal(after.unlocked, before.unlocked);
    assert.deepEqual(after.pinned, before.pinned);
  },
);
await db.close();
console.log(`PASS ${checks} PostgreSQL contract groups`);
