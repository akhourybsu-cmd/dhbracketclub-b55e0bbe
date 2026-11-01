// Source-backed Afterimage integration with existing permanent DH Feats awards.
// The complete gameplay migration is covered by test-afterimage-db.mjs. This
// focused fixture runs its exact evaluator/catalog blocks against the real Feats
// evaluator, privacy helpers and award RPCs, without touching any live records.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createFeatsFixture } from './dh-feats-fixture.mjs';

const fixture = await createFeatsFixture();
const { id, ownerExec: exec, ownerQuery: query } = fixture;
const foundation = await readFile('supabase/migrations/20261101010000_showdown_foundation.sql', 'utf8');
const discovery = await readFile('supabase/migrations/20261101030000_showdown_discovery_feats.sql', 'utf8');
const path = 'supabase/migrations/20261101040000_afterimage_foundation.sql';
const afterimage = await readFile(path, 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const extractFunction = name => {
  const source = foundation.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$;`, 'i'))?.[0];
  assert.ok(source, `${name} is present in the production foundation`);
  return source;
};
const blocks = ['metrics', 'catalog', 'discovery'].map(tag => {
  const source = afterimage.match(new RegExp(`do \\$${tag}\\$[\\s\\S]*?end \\$${tag}\\$;`))?.[0];
  assert.ok(source, `Afterimage production ${tag} block is present`);
  return source;
});
const extension = blocks.join('\n');
const metrics = async (member = id(1)) => (await query('select public.dh_feat_metrics($1) result', [member])).rows[0].result;
const memberMetrics = async () => (await query('select public.showdown_member_metrics($1,$2) result', [id(1), id(10)])).rows[0].result;
const security = async () => (await query("select prosecdef,proconfig,proacl::text from pg_proc where oid='public.dh_feat_metrics(uuid)'::regprocedure")).rows[0];
const receipts = async () => (await query('select to_jsonb(u) result from dh_feat_unlocks u where user_id=$1 order by feat_key,tier', [id(1)])).rows.map(row => row.result);
const ago = days => new Date(Date.now() - days * 86400000).toISOString();
let sequence = 20000, checks = 0;
const check = async (name, run) => { await run(); console.log('PASS', name); checks++; };
async function match({ game = 'afterimage', opponent = id(2), score = 0, perfect = 0, status = 'completed', winner = null, at = ago(2), completed = ago(0), club = id(10) } = {}) {
  const challenge = id(sequence++);
  await query(`insert into showdown_challenges(id,club_id,game_key,challenger_id,recipient_id,status,winner_id,outcome,completed_at)
    values($1,$2,$3,$4,$5,'active',$6,$7,null)`, [challenge, club, game, id(1), opponent, winner, winner ? 'winner' : 'draw']);
  for (const [user, total, solved] of [[id(1), score, perfect], [opponent, 0, 0]]) {
    await query('insert into showdown_attempts(challenge_id,user_id,total_score,solved_count,rotations,finished_at) values($1,$2,$3,$4,$5,$6)', [challenge, user, total, solved, game === 'prism_break' ? solved * 2 : 0, at]);
    for (let round = 1; round <= 3; round++) {
      const solvedRound = round <= solved;
      await query('insert into showdown_round_states(challenge_id,user_id,round_number,submitted,solved,skipped,score,rotations) values($1,$2,$3,true,$4,false,$5,$6)', [challenge, user, round, solvedRound, Math.floor(total / 3) + (round === 3 ? total % 3 : 0), game === 'prism_break' && solvedRound ? 2 : 0]);
    }
  }
  for (let round = 1; round <= 3; round++) await query('insert into showdown_challenge_rounds(challenge_id,round_number,minimum_rotations) values($1,$2,$3)', [challenge, round, game === 'prism_break' ? 2 : null]);
  if (status !== 'active') await query('update showdown_challenges set status=$1,completed_at=$2 where id=$3', [status, status === 'completed' ? completed : null, challenge]);
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
    insert into public.clubs(id,name,slug) values('${id(11)}','Outside','outside'),('${id(12)}','Private','private');
    insert into public.profiles(id,display_name) values('${id(4)}','Outside member'),('${id(7)}','Private member');
    insert into public.club_members(user_id,club_id) values('${id(4)}','${id(11)}'),('${id(7)}','${id(12)}');
    insert into public.dh_private_accounts(user_id,workspace_id,profile_snapshot,membership_snapshot) values('${id(7)}','${id(12)}','{}','{}');
    insert into public.dh_feat_unlocks(user_id,feat_key,tier,points,target,historical) values('${id(1)}','drop_posts',1,7,1,false);
  `);
  await exec(extractFunction('showdown_member_valid'));
  await exec(extractFunction('showdown_member_metrics'));
  await exec('revoke all on function public.showdown_member_metrics(uuid,uuid) from public,anon,authenticated; grant execute on function public.showdown_member_metrics(uuid,uuid) to service_role;');
  await exec(discovery);
  await match({ game: 'prism_break', score: 1500, perfect: 3, winner: id(1), at: ago(5) });
  assert.equal((await fixture.rpc('dh_feats_board', { p_club_id: id(10) })).error, null);
  const beforeMetrics = await metrics(), beforeRecord = await memberMetrics(), beforeReceipts = await receipts();
  const beforeSecurity = await security();
  const beforeCatalog = (await query('select jsonb_agg(to_jsonb(c) order by key) result from dh_feat_catalog c')).rows[0].result;
  const beforeAssets = (await query("select to_jsonb(a)-'short_description'-'full_description'-'updated_at' result from platform_assets a where slug='dh-showdown'")).rows[0].result;
  const beforeInstalls = (await query('select coalesce(jsonb_agg(to_jsonb(i)),\'[]\') result from club_installed_assets i')).rows[0].result;
  await exec(extension);

  await check('exact production evaluator extension preserves existing metrics, private ACL and permanent awards', async () => {
    assert.deepEqual(await metrics(), beforeMetrics);
    assert.deepEqual(await memberMetrics(), beforeRecord);
    assert.deepEqual(await receipts(), beforeReceipts);
    assert.deepEqual(await security(), beforeSecurity);
    assert.equal((await query("select has_function_privilege('authenticated','public.dh_feat_metrics(uuid)','execute') allowed")).rows[0].allowed, false);
    assert.equal((await query("select has_function_privilege('anon','public.showdown_member_metrics(uuid,uuid)','execute') allowed")).rows[0].allowed, false);
  });
  await check('only three general descriptions change; thresholds, points, six families and Prism-specific wording remain intact', async () => {
    const now = (await query('select jsonb_agg(to_jsonb(c) order by key) result from dh_feat_catalog c')).rows[0].result;
    const general = new Set(['showdown_matches', 'showdown_wins', 'showdown_rivals']);
    assert.equal(now.length, beforeCatalog.length);
    for (const row of now) {
      const previous = beforeCatalog.find(entry => entry.key === row.key);
      assert.ok(previous);
      if (general.has(row.key)) {
        assert.match(row.description, /at least one point/);
        assert.deepEqual({ ...row, description: previous.description }, previous);
      } else assert.deepEqual(row, previous);
    }
  });
  await check('existing discovery copy names both games without changing asset identity or club installations', async () => {
    const asset = (await query("select to_jsonb(a) result from platform_assets a where slug='dh-showdown'")).rows[0].result;
    assert.match(asset.full_description, /Prism Break/); assert.match(asset.full_description, /Afterimage/);
    const { short_description: _short, full_description: _full, updated_at: _updated, ...identity } = asset;
    assert.deepEqual(identity, beforeAssets);
    assert.deepEqual((await query('select coalesce(jsonb_agg(to_jsonb(i)),\'[]\') result from club_installed_assets i')).rows[0].result, beforeInstalls);
  });

  const partial = await match({ opponent: id(3), score: 58, perfect: 0, winner: id(1), at: ago(3), completed: ago(0) });
  await check('partial Afterimage accuracy qualifies without any perfect round and keeps Prism metrics isolated', async () => {
    const current = await metrics(), raw = await memberMetrics();
    assert.equal(current.showdown_matches, beforeMetrics.showdown_matches + 1);
    assert.equal(current.showdown_wins, beforeMetrics.showdown_wins + 1);
    assert.equal(current.showdown_rivals, beforeMetrics.showdown_rivals + 1);
    assert.equal(raw.qualified_played, beforeRecord.qualified_played + 1);
    assert.equal(raw.qualified_wins, beforeRecord.qualified_wins + 1);
    for (const key of ['showdown_prism_solved', 'showdown_prism_optimal', 'showdown_prism_best']) assert.equal(current[key], beforeMetrics[key]);
    assert.equal(current.active_days, Number(beforeMetrics.active_days) + 1, 'uses the player finish day, not the opponent completion day');
    assert.equal((await query('select solved_count from showdown_attempts where challenge_id=$1 and user_id=$2', [partial, id(1)])).rows[0].solved_count, 0);
  });
  await check('finished zero-score scenes remain ordinary records without awarding engagement or activity days', async () => {
    const before = await metrics(), record = await memberMetrics();
    await match({ score: 0, perfect: 0, at: ago(9) });
    const after = await metrics(), raw = await memberMetrics();
    assert.equal(raw.played, record.played + 1); assert.equal(raw.draws, record.draws + 1);
    assert.equal(raw.qualified_played, record.qualified_played);
    for (const key of ['showdown_matches', 'showdown_wins', 'showdown_rivals', 'active_days']) assert.equal(after[key], before[key]);
  });
  await check('uncompleted, expired, declined, cancelled, private and cross-club scores never contribute', async () => {
    const before = await metrics(), raw = await memberMetrics();
    for (const status of ['active', 'expired', 'declined', 'cancelled']) await match({ score: 250, perfect: 2, status, at: ago(10) });
    await match({ score: 375, perfect: 3, opponent: id(7), at: ago(10) });
    await match({ score: 375, perfect: 3, opponent: id(4), club: id(11), at: ago(10) });
    assert.deepEqual(await metrics(), before); assert.deepEqual(await memberMetrics(), raw);
  });
  await check('completion invalidation and board retries award once while retaining every preexisting receipt', async () => {
    const first = await fixture.rpc('dh_feats_board', { p_club_id: id(10) });
    assert.equal(first.error, null);
    const earned = await receipts();
    for (const receipt of beforeReceipts) assert.deepEqual(earned.find(row => row.feat_key === receipt.feat_key && row.tier === receipt.tier), receipt);
    const second = await fixture.rpc('dh_feats_board', { p_club_id: id(10) });
    assert.equal(second.error, null); assert.equal(second.data.score, first.data.score);
    await query("update showdown_challenges set status='completed' where id=$1", [partial]);
    assert.deepEqual(await receipts(), earned);
  });
  await check('source patch retries are stable and cannot widen evaluator permissions', async () => {
    const before = await metrics(), acl = await security();
    await exec(extension);
    assert.deepEqual(await metrics(), before); assert.deepEqual(await security(), acl);
    assert.equal(hash(await readFile(path, 'utf8')), hash(afterimage), 'production source did not drift during this run');
  });
  console.log(`${checks} Afterimage DH Feats database checks passed. Foundation SHA256 ${hash(afterimage)}`);
} finally { await fixture.close(); }
