// Source-backed Showdown achievements in isolated PostgreSQL. No live writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFeatsFixture } from './dh-feats-fixture.mjs';

const fixture = await createFeatsFixture();
const { id, ownerExec: exec, ownerQuery: query } = fixture;
const migration = await readFile('supabase/migrations/20261101030000_showdown_discovery_feats.sql', 'utf8');
const foundation = await readFile('supabase/migrations/20261101010000_showdown_foundation.sql', 'utf8');
const catalog = JSON.parse(await readFile('src/lib/feats/showdownCatalog.json', 'utf8'));
let checks = 0, sequence = 10000;
const check = async (name, run) => { await run(); console.log('PASS', name); checks++; };
const fn = name => {
  const regex = new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$;`, 'i');
  const source = foundation.match(regex)?.[0];
  assert.ok(source, `${name} is present in the production foundation`);
  return source;
};
const metrics = async (member = id(1)) => (await query('select public.dh_feat_metrics($1) result', [member])).rows[0].result;
const ago = n => new Date(Date.now() - n * 86400000).toISOString();
async function match({ status = 'completed', opponent = id(2), solved = 3, opponentSolved = 1, score = solved * 500, winner = solved ? id(1) : null, at = ago(1), completed = ago(0), club = id(10) } = {}) {
  const challenge = id(sequence++);
  await query(`insert into showdown_challenges(id,club_id,game_key,challenger_id,recipient_id,status,winner_id,outcome,completed_at)
    values($1,$2,'prism_break',$3,$4,$5,$6,$7,$8)`, [challenge, club, id(1), opponent, status, winner, winner ? 'winner' : 'draw', status === 'completed' ? completed : null]);
  for (const [user, count, total] of [[id(1), solved, score], [opponent, opponentSolved, opponentSolved * 500]]) {
    await query('insert into showdown_attempts(challenge_id,user_id,total_score,solved_count,rotations,finished_at) values($1,$2,$3,$4,$5,$6)', [challenge, user, total, count, count * 2, at]);
    for (let round = 1; round <= 3; round++) {
      const success = round <= count;
      await query('insert into showdown_round_states(challenge_id,user_id,round_number,submitted,solved,skipped,score,rotations) values($1,$2,$3,true,$4,$5,$6,$7)', [challenge, user, round, success, !success, success ? 500 : 0, success ? 2 : 0]);
    }
  }
  for (let round = 1; round <= 3; round++) await query('insert into showdown_challenge_rounds(challenge_id,round_number,minimum_rotations) values($1,$2,2)', [challenge, round]);
  return challenge;
}

try {
  await exec(`
    create role service_role;
    alter table public.clubs add column status text not null default 'active';
    create table public.platform_assets(id uuid primary key default gen_random_uuid(),name text not null,slug text not null unique,
      category text default 'games',short_description text default '',full_description text default '',icon_name text default 'Swords',placement_area text default 'games',
      requires_configuration boolean default false,is_premium boolean default false,is_active boolean default true,default_configuration_json jsonb default '{}',sort_order integer default 0,updated_at timestamptz default now());
    create table public.showdown_challenges(id uuid primary key,club_id uuid,game_key text,challenger_id uuid,recipient_id uuid,status text,winner_id uuid,outcome text,completed_at timestamptz);
    create table public.showdown_attempts(challenge_id uuid,user_id uuid,total_score integer,solved_count integer,rotations integer,finished_at timestamptz,primary key(challenge_id,user_id));
    create table public.showdown_round_states(challenge_id uuid,user_id uuid,round_number integer,submitted boolean,solved boolean,skipped boolean,score integer,rotations integer,primary key(challenge_id,user_id,round_number));
    create table public.showdown_challenge_rounds(challenge_id uuid,round_number integer,minimum_rotations integer,primary key(challenge_id,round_number));
    insert into public.clubs(id,name,slug) values('${id(11)}','Outside','outside'),('${id(12)}','Private','private'),('${id(13)}','Configured','configured');
    insert into public.profiles(id,display_name) values('${id(4)}','Outside member'),('${id(7)}','Private member');
    insert into public.club_members(user_id,club_id) values('${id(4)}','${id(11)}'),('${id(7)}','${id(12)}');
    insert into public.dh_private_accounts(user_id,workspace_id,profile_snapshot,membership_snapshot) values('${id(7)}','${id(12)}','{}','{}');
    insert into public.platform_assets(id,name,slug) values('${id(50)}','Draft Arena','draft-arena');
    insert into public.platform_assets(id,name,slug,default_configuration_json) values('${id(51)}','Existing Showdown','dh-showdown','{"preferred_game":"prism_break"}');
    insert into public.club_installed_assets(club_id,asset_id,enabled,visible_to_members,configuration_json,sort_order) values
      ('${id(10)}','${id(50)}',true,true,'{}',0),('${id(11)}','${id(50)}',false,true,'{}',0),
      ('${id(12)}','${id(50)}',true,true,'{}',0),('${id(13)}','${id(50)}',true,true,'{}',0),
      ('${id(13)}','${id(51)}',false,false,'{"channel":"quiet"}',99);
    insert into public.dh_feat_accounts(user_id,dirty,evaluated_at) values('${id(1)}',false,now()),('${id(2)}',false,now()) on conflict do nothing;
    insert into public.dh_feat_unlocks(user_id,feat_key,tier,points,target,historical) values('${id(1)}','drop_posts',1,7,1,false);
  `);
  await exec(fn('showdown_member_valid'));
  await exec(fn('showdown_member_metrics'));
  const oldCatalog = (await query('select jsonb_agg(to_jsonb(c) order by key) result from dh_feat_catalog c')).rows[0].result;
  const receipt = (await query("select to_jsonb(u) result from dh_feat_unlocks u where user_id=$1 and feat_key='drop_posts'", [id(1)])).rows[0].result;
  const oldMetrics = await metrics();
  const evaluatorSecurity = (await query("select prosecdef,proconfig,proacl::text from pg_proc where oid='public.dh_feat_metrics(uuid)'::regprocedure")).rows[0];
  const configured = (await query('select to_jsonb(i) result from club_installed_assets i where club_id=$1 and asset_id=$2', [id(13), id(51)])).rows[0].result;
  await exec(migration);
  await exec(migration);

  await check('feature discovery follows visible enabled Draft Arena installations and preserves existing configuration', async () => {
    const installed = (await query('select club_id,enabled,visible_to_members from club_installed_assets where asset_id=$1 order by club_id', [id(51)])).rows;
    assert.deepEqual(installed.map(row => row.club_id), [id(10), id(13)]);
    assert.deepEqual((await query('select to_jsonb(i) result from club_installed_assets i where club_id=$1 and asset_id=$2', [id(13), id(51)])).rows[0].result, configured);
    assert.deepEqual((await query('select default_configuration_json result from platform_assets where slug=$1', ['dh-showdown'])).rows[0].result, { preferred_game: 'prism_break' });
    const newClub = id(sequence++);
    await query('insert into clubs(id,name,slug) values($1,$2,$3)', [newClub, 'New club', 'blank-new-club']);
    assert.equal((await query('select count(*) n from club_installed_assets where club_id=$1', [newClub])).rows[0].n, 0);
  });
  await check('six families are additive and repeatable, retaining previous source metrics and permanent award receipts', async () => {
    assert.deepEqual((await query("select jsonb_agg(to_jsonb(c) order by key) result from dh_feat_catalog c where category<>'showdown'")).rows[0].result, oldCatalog);
    const defs = (await query("select key,category,title,description,thresholds,points,kind,unit,sort_order from dh_feat_catalog where category='showdown' order by sort_order")).rows;
    assert.deepEqual(defs.map(row => ({ ...row, thresholds: row.thresholds.map(Number) })), catalog);
    assert.deepEqual((await query("select to_jsonb(u) result from dh_feat_unlocks u where user_id=$1 and feat_key='drop_posts'", [id(1)])).rows[0].result, receipt);
    const current = await metrics();
    for (const [key, value] of Object.entries(oldMetrics)) assert.equal(current[key], value, key);
    for (const def of catalog) assert.equal(current[def.key], 0);
    assert.deepEqual((await query("select prosecdef,proconfig,proacl::text from pg_proc where oid='public.dh_feat_metrics(uuid)'::regprocedure")).rows[0], evaluatorSecurity);
    assert.equal((await query("select has_function_privilege('authenticated','public.dh_feat_metrics(uuid)','execute') allowed")).rows[0].allowed, false);
  });
  await check('invitations, unfinished attempts, declines, cancellations and expiration earn no achievements or activity days', async () => {
    for (const status of ['pending', 'active', 'declined', 'cancelled', 'expired']) await match({ status, at: ago(5) });
    const current = await metrics();
    for (const def of catalog) assert.equal(current[def.key], 0);
    assert.equal(current.active_days, oldMetrics.active_days);
    assert.equal((await query('select dirty from dh_feat_accounts where user_id=$1', [id(1)])).rows[0].dirty, false);
  });
  const completed = await match({ status: 'active', at: ago(3) });
  await query("update showdown_challenges set status='completed',completed_at=now() where id=$1", [completed]);
  await check('only completion invalidates both members, and exact result metrics remain distinct from DH Score awards', async () => {
    assert.deepEqual((await query('select dirty from dh_feat_accounts where user_id in($1,$2) order by user_id', [id(1), id(2)])).rows.map(row => row.dirty), [true, true]);
    const current = await metrics();
    assert.equal(current.showdown_matches, 1); assert.equal(current.showdown_wins, 1);
    assert.equal(current.showdown_prism_solved, 3); assert.equal(current.showdown_prism_optimal, 3);
    assert.equal(current.showdown_prism_best, 1500); assert.equal(current.showdown_rivals, 1);
    assert.equal(current.active_days, Number(oldMetrics.active_days) + 1);
    assert.equal(current.feature_explorer, Number(oldMetrics.feature_explorer) + 1);
    const board = await fixture.rpc('dh_feats_board', { p_club_id: id(10) });
    assert.equal(board.error, null);
    const award = board.data.unlocks.filter(row => row.feat_key.startsWith('showdown_')).reduce((sum, row) => sum + row.points, 0);
    assert.equal(award, 120);
    const repeat = await fixture.rpc('dh_feats_board', { p_club_id: id(10) });
    assert.equal(repeat.data.score, board.data.score);
    const before = await query("select count(*) n from dh_feat_unlocks where user_id=$1 and feat_key like 'showdown_%'", [id(1)]);
    await query("update showdown_challenges set status='completed' where id=$1", [completed]);
    assert.equal((await query("select count(*) n from dh_feat_unlocks where user_id=$1 and feat_key like 'showdown_%'", [id(1)])).rows[0].n, before.rows[0].n);
  });
  await check('all-skip draws remain legitimate match records but cannot farm DH Score families, feature variety or activity days', async () => {
    const before = await metrics();
    await match({ solved: 0, opponentSolved: 0, winner: null, at: ago(6) });
    const current = await metrics();
    for (const def of catalog) assert.equal(current[def.key], before[def.key]);
    assert.equal(current.active_days, before.active_days);
    assert.equal(current.feature_explorer, before.feature_explorer);
    const record = (await query('select showdown_member_metrics($1,$2) result', [id(1), id(10)])).rows[0].result;
    assert.equal(record.draws, 1); assert.equal(record.played, 2); assert.equal(record.qualified_played, 1);
  });
  await check('best-score mastery is a single match; completed qualified rivalry and own finish days count only once', async () => {
    await match({ opponent: id(3), solved: 2, opponentSolved: 2, score: 1000, winner: null, at: ago(2) });
    await match({ opponent: id(3), solved: 1, opponentSolved: 1, score: 500, winner: null, at: ago(2) });
    const current = await metrics();
    assert.equal(current.showdown_matches, 3); assert.equal(current.showdown_prism_best, 1500);
    assert.equal(current.showdown_rivals, 2); assert.equal(current.showdown_wins, 1);
    assert.equal(current.active_days, Number(oldMetrics.active_days) + 2);
  });
  await check('private and outside-club sources cannot enter the public member metrics', async () => {
    const before = await metrics();
    await match({ opponent: id(7), solved: 3, at: ago(9) });
    await match({ opponent: id(4), club: id(11), solved: 3, at: ago(10) });
    const current = await metrics();
    for (const def of catalog) assert.equal(current[def.key], before[def.key]);
    assert.equal(current.active_days, before.active_days);
  });
  await check('repeating a completed-state update does not invalidate or award either member again', async () => {
    await fixture.rpc('dh_feats_board', { p_club_id: id(10) });
    await query("update showdown_challenges set status='completed' where id=$1", [completed]);
    assert.deepEqual((await query('select dirty from dh_feat_accounts where user_id in($1,$2) order by user_id', [id(1), id(2)])).rows.map(row => row.dirty), [false, false]);
  });
  await check('an upstream metrics contract change fails and rolls its migration changes back', async () => {
    const broken = "create or replace function public.dh_feat_metrics(uid uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $broken$begin return '{}'::jsonb;end$broken$";
    const quote = value => "'" + value.replaceAll("'", "''") + "'";
    await exec(`create function public.test_showdown_patch_guard(p_sql text) returns boolean language plpgsql as $test$
      declare original text:=pg_get_functiondef('public.dh_feat_metrics(uuid)'::regprocedure);
      begin
        begin
          execute ${quote(broken)};
          execute p_sql;
          raise exception 'Contract guard did not reject the incompatible evaluator';
        exception when others then
          if sqlerrm not like 'DH Feats evaluator changed;%' then raise; end if;
        end;
        if pg_get_functiondef('public.dh_feat_metrics(uuid)'::regprocedure) is distinct from original then raise exception 'Existing evaluator was not restored';end if;
        return true;
      end $test$;`);
    const body = migration.replace(/\nbegin;\s*/, '\n').replace(/commit;\s*$/, '');
    assert.equal((await query('select public.test_showdown_patch_guard($1) preserved', [body])).rows[0].preserved, true);
    await exec('drop function public.test_showdown_patch_guard(text);');
    assert.equal((await metrics()).showdown_prism_best, 1500);
  });
  console.log(`${checks} Showdown discovery and DH Feats database checks passed.`);
} finally { await fixture.close(); }
