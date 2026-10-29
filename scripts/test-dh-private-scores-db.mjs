// Real forward migrations in isolated PostgreSQL; no production credentials/data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createFeatsFixture } from "./dh-feats-fixture.mjs";
const backend = await createFeatsFixture(),
  { id } = backend;
const hidden = "bea76765-545c-4b48-a24d-861c1918c3d6";
const migration = await readFile(
  "supabase/migrations/20261029060000_private_sessions.sql",
  "utf8",
);
const as = async (uid, sql) => {
  const result = await backend.ownerExec(
    `select set_config('test.user','${uid}',false); set role authenticated; ${sql}; reset role;`,
  );
  return result[2].rows;
};
const owner = async (sql) =>
  backend.ownerExec(`select set_config('test.user','',false); ${sql}`);
try {
  await owner(`
    insert into profiles(id,display_name,avatar_url) values('${hidden}','Private operator','original.png');
    insert into auth.users values('${hidden}','{"display_name":"Private operator"}','{"provider":"email"}');
    insert into club_members(user_id,club_id,role) values('${hidden}','${id(10)}','member');
    insert into club_installed_assets(club_id,asset_id,configuration_json) values('${id(10)}','${id(50)}','{"setting":1}');
    insert into pools(id,owner_user_id,club_id) values('${id(60)}','${hidden}','${id(10)}');
    insert into notifications(user_id,club_id) values('${hidden}','${id(10)}');
  `);
  // Broad permissive policies model even a platform owner. Restrictive privacy
  // must win over them, not depend on hiding a row in React.
  for (const table of [
    "profiles",
    "clubs",
    "club_members",
    "daily_finds",
    "daily_find_reactions",
    "pools",
    "notifications",
  ])
    await owner(
      `alter table ${table} enable row level security; grant all on ${table} to authenticated; grant select on ${table} to anon; create policy qa_broad on ${table} for all to anon,authenticated using(true) with check(true);`,
    );
  await backend.ownerExec(migration);
  const workspace = (
    await backend.ownerQuery("select workspace_id from dh_private_accounts")
  ).rows[0].workspace_id;
  await backend.ownerExec(migration);
  assert.equal(
    (
      await backend.ownerQuery(
        "select count(*)::int n from dh_private_accounts",
      )
    ).rows[0].n,
    1,
  );
  const account = (
    await backend.ownerQuery(
      `select p.display_name,p.avatar_url,m.club_id,m.role,a.profile_snapshot->>'display_name' original_name from profiles p join club_members m on m.user_id=p.id join dh_private_accounts a on a.user_id=p.id where p.id='${hidden}'`,
    )
  ).rows[0];
  assert.deepEqual(account, {
    display_name: "Private session",
    avatar_url: null,
    club_id: workspace,
    role: "admin",
    original_name: "Private operator",
  });
  assert.equal(
    (
      await backend.ownerQuery(
        `select count(*)::int n from club_installed_assets where club_id='${workspace}' and configuration_json='{"setting":1}'`,
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (await backend.ownerQuery(`select club_id from pools where id='${id(60)}'`))
      .rows[0].club_id,
    workspace,
  );
  console.log(
    "PASS reversible identity mask, isolated membership, retained private pool/assets, repeatable deployment",
  );

  assert.equal(
    (await as(id(1), `select id from profiles where id='${hidden}'`)).length,
    0,
  );
  assert.equal(
    (await as(id(1), `select id from clubs where id='${workspace}'`)).length,
    0,
  );
  assert.equal(
    (
      await as(
        id(1),
        `select user_id from club_members where user_id='${hidden}'`,
      )
    ).length,
    0,
  );
  await assert.rejects(
    owner(
      `insert into readshift_guesses(club_id,reader_user_id,guessed_user_id) values('${id(10)}','${id(1)}','${hidden}')`,
    ),
    /Private activity/,
  );
  assert.equal(
    (await as(id(1), `select id from pools where owner_user_id='${hidden}'`))
      .length,
    0,
  );
  await assert.rejects(
    as(id(1), "select * from dh_private_accounts"),
    /permission denied/,
  );
  const anon =
    await backend.ownerExec(`begin; select set_config('test.user','',true); set local role anon;
    select (select count(*)::int from profiles where id='${hidden}') hidden_profiles,
      (select count(*)::int from clubs where id='${workspace}') hidden_clubs; rollback;`);
  assert.deepEqual(
    anon.find((result) => result.rows[0]?.hidden_profiles !== undefined)
      .rows[0],
    { hidden_profiles: 0, hidden_clubs: 0 },
  );
  assert.equal(
    (
      await as(hidden, `select display_name from profiles where id='${hidden}'`)
    )[0].display_name,
    "Private session",
  );
  await as(
    hidden,
    `update profiles set display_name='Unmasked',avatar_url='bad.png' where id='${hidden}'`,
  );
  assert.equal(
    (
      await backend.ownerQuery(
        `select display_name from profiles where id='${hidden}'`,
      )
    ).rows[0].display_name,
    "Private session",
  );
  console.log(
    "PASS member/platform-wide permissive reads cannot expose private identity, club, roster, pool or registry",
  );

  await assert.rejects(
    as(
      hidden,
      `insert into daily_finds(club_id,user_id,title) values('${id(10)}','${hidden}','Blocked')`,
    ),
    /Private activity/,
  );
  await assert.rejects(
    owner(
      `insert into daily_finds(club_id,user_id,title) values('${id(10)}','${hidden}','Blocked service write')`,
    ),
    /Private activity/,
  );
  await assert.rejects(
    owner(
      `update club_members set club_id='${id(10)}' where user_id='${hidden}'`,
    ),
    /Private activity/,
  );
  await owner(
    `insert into daily_finds(id,club_id,user_id,title) values('${id(70)}','${id(10)}','${id(1)}','Public');`,
  );
  await assert.rejects(
    as(
      hidden,
      `insert into daily_find_reactions(find_id,user_id,emoji) values('${id(70)}','${hidden}','heart')`,
    ),
    /Private activity/,
  );
  await as(
    hidden,
    `insert into daily_finds(id,club_id,user_id,title) values('${id(71)}','${workspace}','${hidden}','Private');`,
  );
  await as(
    hidden,
    `insert into daily_find_reactions(find_id,user_id,emoji) values('${id(71)}','${hidden}','heart')`,
  );
  assert.equal(
    (await as(id(1), `select id from daily_finds where user_id='${hidden}'`))
      .length,
    0,
  );
  console.log(
    "PASS public participation blocked for clients, definer/service writes and child reactions; private testing works",
  );

  const roster = await as(
    id(1),
    `select * from dh_presence_directory('${id(10)}')`,
  );
  assert.equal(roster.length, 3);
  assert.ok(roster.every((row) => row.id !== hidden));
  assert.equal(
    (await as(hidden, `select * from dh_presence_directory('${workspace}')`))
      .length,
    0,
  );
  await assert.rejects(
    as(hidden, `select * from dh_presence_directory('${id(10)}')`),
    /Club membership required/,
  );
  assert.equal(
    (
      await backend.ownerQuery(
        "select has_function_privilege('anon','dh_presence_directory(uuid)','execute') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  console.log(
    "PASS canonical presence excludes private sessions and validates current membership",
  );

  await owner(
    `insert into daily_finds(club_id,user_id,title) values('${id(10)}','${id(2)}','New activity');`,
  );
  const home = (await backend.rpc("dh_home_progress", { p_club_id: id(10) }))
    .data;
  const board = (await backend.rpc("dh_feats_board", { p_club_id: id(10) }))
    .data;
  assert.equal(board.members, 3);
  assert.equal(
    new Set(board.leaders.map((m) => m.user_id)).size,
    board.leaders.length,
  );
  assert.ok(board.leaders.every((m) => m.user_id !== hidden));
  assert.equal(home.club_rank, board.me.rank);
  assert.ok(
    board.leaders.find((m) => m.user_id === id(2)).score > 0,
    "Home refreshes other dirty members before ranking",
  );
  for (const member of board.leaders) {
    const receipts = (
      await backend.ownerQuery(
        "select coalesce(sum(points),0)::int score,count(*)::int unlocked from dh_feat_unlocks where user_id=$1",
        [member.user_id],
      )
    ).rows[0];
    assert.equal(member.score, receipts.score);
    assert.equal(member.unlocked, receipts.unlocked);
  }
  const privateBoard = (
    await as(hidden, `select dh_feats_board('${workspace}') board`)
  )[0].board;
  assert.equal(privateBoard.me, null);
  assert.deepEqual(privateBoard.leaders, []);
  assert.equal(
    privateBoard.score,
    privateBoard.unlocks.reduce((sum, u) => sum + u.points, 0),
  );
  assert.equal(
    (await as(hidden, `select dh_home_progress('${workspace}') home`))[0].home
      .club_rank,
    null,
  );
  await assert.rejects(
    as(hidden, `select dh_feats_board('${id(10)}')`),
    /Club membership required/,
  );
  console.log(
    "PASS private sessions unranked; exact unique member totals; Home and board ranks agree after saved activity",
  );

  // Simulate a missed invalidation. The bounded authoritative sweep repairs it.
  await owner(`insert into daily_finds(club_id,user_id,title) select '${id(10)}','${id(3)}','Saved '||n from generate_series(1,5) n;
    update dh_feat_accounts set dirty=false,evaluated_at=now()-interval '6 minutes' where user_id='${id(3)}';`);
  const refreshed = (await backend.rpc("dh_feats_board", { p_club_id: id(10) }))
    .data;
  assert.ok(refreshed.leaders.find((m) => m.user_id === id(3)).score > 0);
  const before = (
    await backend.ownerQuery("select count(*)::int n from dh_feat_unlocks")
  ).rows[0].n;
  for (let n = 0; n < 3; n++)
    await backend.rpc("dh_feats_board", { p_club_id: id(10) });
  assert.equal(
    (await backend.ownerQuery("select count(*)::int n from dh_feat_unlocks"))
      .rows[0].n,
    before,
  );
  await owner(
    `update dh_feat_unlocks set historical=true where user_id='${id(3)}';`,
  );
  const monthly = (await backend.rpc("dh_feats_board", { p_club_id: id(10) }))
    .data;
  assert.ok(monthly.leaders.find((m) => m.user_id === id(3)).score > 0);
  assert.equal(
    monthly.monthly_leaders.find((m) => m.user_id === id(3)).score,
    0,
  );
  console.log(
    "PASS missed-trigger reconciliation, repeat refresh without duplicate awards, historical/monthly separation",
  );
  await owner(
    `update dh_feat_unlocks set historical=false,earned_at=(date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')-interval '1 second' where user_id='${id(2)}';`,
  );
  assert.equal(
    (
      await backend.rpc("dh_feats_board", { p_club_id: id(10) })
    ).data.monthly_leaders.find((m) => m.user_id === id(2)).score,
    0,
  );
  await owner(
    `update dh_feat_unlocks set earned_at=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' where user_id='${id(2)}';`,
  );
  const boundary = (await backend.rpc("dh_feats_board", { p_club_id: id(10) }))
    .data;
  assert.equal(
    boundary.monthly_leaders.find((m) => m.user_id === id(2)).score,
    boundary.leaders.find((m) => m.user_id === id(2)).score,
  );
  console.log(
    "PASS UTC month boundary includes exact cutoff and excludes preceding awards",
  );

  await owner(`
    insert into profiles(id,display_name) values('${id(4)}','New member');
    insert into club_members(user_id,club_id) values('${id(4)}','${id(10)}');
    insert into readshift_stats(user_id,rounds_played,updated_at) values('${id(4)}',4,'2020-04-10');
  `);
  const metrics = async () =>
    (await backend.ownerQuery("select dh_feat_metrics($1) m", [id(4)])).rows[0]
      .m;
  assert.equal(
    (await metrics()).active_days,
    0,
    "Passive READSHIFT stat refresh grants no active day",
  );
  await owner(`
    insert into readshift_answers(club_id,user_id,body,locked,created_at) values
      ('${id(10)}','${id(4)}','Sent',true,'2020-04-01'),
      ('${id(10)}','${id(4)}','Sent',true,'2020-04-02'),
      ('${id(10)}','${id(4)}','Draft',false,'2020-04-03');
    insert into readshift_guesses(club_id,reader_user_id,guessed_user_id,created_at) values
      ('${id(10)}','${id(4)}','${id(2)}','2020-04-04'),
      ('${id(10)}','${id(4)}',null,'2020-04-05');
    select dh_feats_refresh_user('${id(4)}');
    insert into readshift_answers(club_id,user_id,body,locked,created_at) values('${id(10)}','${id(4)}','Another',true,'2020-04-06');
  `);
  assert.equal((await metrics()).active_days, 4);
  assert.equal(
    (
      await backend.ownerQuery(
        "select dirty from dh_feat_accounts where user_id=$1",
        [id(4)],
      )
    ).rows[0].dirty,
    true,
  );
  await owner(`
    insert into workout_exercises(id,club_id,name) values('${id(82)}','${id(10)}','Squats');
    insert into workout_activities(club_id,user_id,exercise_id,status,raw_value,measurement_type,activity_local_date)
      values('${id(10)}','${id(4)}','${id(82)}','active',10,'reps',null);
    insert into lockbox_locks(id,club_id,user_id,created_at) values('${id(83)}','${id(10)}','${id(4)}','2020-05-01');
  `);
  assert.equal(
    (await metrics()).forge_days,
    0,
    "Missing dates cannot create a workout day",
  );
  const days = (await metrics()).active_days;
  await owner(
    `insert into lockbox_attempts(club_id,attacker_id,lock_id,is_solved,solved_at) values('${id(10)}','${id(4)}','${id(83)}',true,'2020-05-02');`,
  );
  assert.equal((await metrics()).active_days, days);
  assert.equal((await metrics()).locks_solved, 0);
  console.log(
    "PASS canonical submitted activity days, immediate source invalidation, no passive/self-solve/undated-day awards",
  );
} finally {
  await backend.close();
}
