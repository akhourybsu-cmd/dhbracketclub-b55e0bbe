// Source-backed Cipher rewards against the existing evaluator and permanent
// ledger in isolated PostgreSQL. Full protocol/RLS tests live in test-cipher-db.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createFeatsFixture } from './dh-feats-fixture.mjs';

const fixture = await createFeatsFixture();
const { id, ownerExec: exec, ownerQuery: query } = fixture;
const foundation = await readFile('supabase/migrations/20261101010000_showdown_foundation.sql', 'utf8');
const discovery = await readFile('supabase/migrations/20261101030000_showdown_discovery_feats.sql', 'utf8');
const afterimage = await readFile('supabase/migrations/20261101040000_afterimage_foundation.sql', 'utf8');
const cipher = await readFile('supabase/migrations/20261101060000_cipher_duel_foundation.sql', 'utf8');
const path = 'supabase/migrations/20261101070000_cipher_duel_feats.sql';
const source = await readFile(path, 'utf8');
const catalog = JSON.parse(await readFile('src/lib/feats/cipherCatalog.json', 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const fn = name => {
  const value = foundation.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$;`, 'i'))?.[0];
  assert.ok(value, `Production ${name} is present`); return value;
};
const afterimageExtension = ['metrics', 'catalog', 'discovery'].map(tag => {
  const value = afterimage.match(new RegExp(`do \\$${tag}\\$[\\s\\S]*?end \\$${tag}\\$;`))?.[0];
  assert.ok(value, `Production Afterimage ${tag} is present`); return value;
}).join('\n');
const metrics = async (user = id(1)) => (await query('select dh_feat_metrics($1) result', [user])).rows[0].result;
const records = async (user = id(1)) => (await query('select showdown_member_metrics($1,$2) result', [user, id(10)])).rows[0].result;
const cipherMetrics = async (user = id(1)) => (await query('select cipher_feat_metrics_v1($1,$2) result', [user, id(10)])).rows[0].result;
const receipts = async () => (await query('select to_jsonb(u) result from dh_feat_unlocks u where user_id=$1 order by feat_key,tier', [id(1)])).rows.map(row => row.result);
const security = async () => (await query("select prosecdef,proconfig,proacl::text from pg_proc where oid='public.dh_feat_metrics(uuid)'::regprocedure")).rows[0];
const ago = days => new Date(Date.now() - days * 86400000).toISOString();
let sequence = 41000, checks = 0;
const check = async (name, run) => { await run(); console.log('PASS', name); checks++; };
async function match({ game = 'cipher_duel', opponent = id(2), guesses = 4, ownStatus = 'solved', opponentStatus = 'solved', opponentGuesses = 6, status = 'completed', winner = id(1), at = ago(2), completed = ago(0), club = id(10), score = 0, solved = 0, recipient = false } = {}) {
  const challenge = id(sequence++);
  await query('insert into showdown_challenges(id,club_id,game_key,challenger_id,recipient_id,status,winner_id,outcome) values($1,$2,$3,$4,$5,\'active\',$6,$7)', [challenge, club, game, recipient ? opponent : id(1), recipient ? id(1) : opponent, winner, winner ? 'winner' : 'draw']);
  for (const user of [id(1), opponent]) {
    const own = user === id(1);
    await query('insert into showdown_attempts(challenge_id,user_id,total_score,solved_count,rotations,finished_at) values($1,$2,$3,$4,$5,$6)', [challenge, user, own ? score : 0, own ? solved : 0, game === 'prism_break' && own ? solved * 2 : 0, at]);
    if (game === 'cipher_duel') await query('insert into showdown_cipher_states(challenge_id,user_id,status,guess_count) values($1,$2,$3,$4)', [challenge, user, own ? ownStatus : opponentStatus, own ? guesses : opponentGuesses]);
    else for (let round = 1; round <= 3; round++) await query('insert into showdown_round_states(challenge_id,user_id,round_number,submitted,solved,skipped,score,rotations) values($1,$2,$3,true,$4,false,$5,$6)', [challenge, user, round, own && round <= solved, own ? Math.floor(score / 3) + (round === 3 ? score % 3 : 0) : 0, own && round <= solved && game === 'prism_break' ? 2 : 0]);
  }
  if (game !== 'cipher_duel') for (let round = 1; round <= 3; round++) await query('insert into showdown_challenge_rounds(challenge_id,round_number,minimum_rotations) values($1,$2,$3)', [challenge, round, game === 'prism_break' ? 2 : null]);
  if (status !== 'active') await query('update showdown_challenges set status=$1,completed_at=$2 where id=$3', [status, status === 'completed' ? completed : null, challenge]);
  return challenge;
}

try {
  await exec(`
    create role service_role;
    alter table public.clubs add column status text not null default 'active';
    create table public.platform_assets(id uuid primary key default gen_random_uuid(),name text not null,slug text not null unique,category text default 'games',short_description text default '',full_description text default '',icon_name text default 'Swords',placement_area text default 'games',requires_configuration boolean default false,is_premium boolean default false,is_active boolean default true,default_configuration_json jsonb default '{}',sort_order integer default 0,updated_at timestamptz default now());
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
  const stateTable = cipher.match(/create table public\.showdown_cipher_states\([\s\S]*?\n\);/)?.[0];
  assert.ok(stateTable); await exec(stateTable);
  await exec(fn('showdown_member_valid')); await exec(fn('showdown_member_metrics')); await exec(discovery); await exec(afterimageExtension);
  await match({ game: 'prism_break', score: 1500, solved: 3, at: ago(20) });
  await match({ game: 'afterimage', score: 58, at: ago(19), opponent: id(3), winner: null });
  assert.equal((await fixture.rpc('dh_feats_board', { p_club_id: id(10) })).error, null);
  const before = await metrics(), beforeRecords = await records(), beforeReceipts = await receipts(), beforeSecurity = await security();
  const beforeCatalog = (await query('select jsonb_agg(to_jsonb(c) order by key) result from dh_feat_catalog c')).rows[0].result;
  const beforeAsset = (await query("select to_jsonb(a)-'short_description'-'full_description'-'updated_at' result from platform_assets a where slug='dh-showdown'")).rows[0].result;
  const beforeInstalls = (await query("select coalesce(jsonb_agg(to_jsonb(i)),'[]') result from club_installed_assets i")).rows[0].result;
  await exec(source);

  await check('production extension preserves every previous metric, Prism/Afterimage aggregate and permanent receipt', async () => {
    const current = await metrics();
    for (const [key, value] of Object.entries(before)) assert.equal(current[key], value, key);
    assert.deepEqual(await records(), beforeRecords);
    assert.deepEqual(await receipts(), beforeReceipts);
    assert.deepEqual(await security(), beforeSecurity);
    assert.equal(Object.values(await cipherMetrics()).every(value => value === 0), true);
    const asset = (await query("select to_jsonb(a) result from platform_assets a where slug='dh-showdown'")).rows[0].result;
    for (const name of ['Prism Break', 'Afterimage', 'Cipher Duel']) assert.ok(asset.full_description.includes(name));
    assert.equal(asset.short_description, 'Three asynchronous mini-games. One club rivalry.');
    const { short_description: _short, full_description: _full, updated_at: _updated, ...identity } = asset;
    assert.deepEqual(identity, beforeAsset, 'discovery text preserves asset flags, configuration and ordering');
    assert.deepEqual((await query("select coalesce(jsonb_agg(to_jsonb(i)),'[]') result from club_installed_assets i")).rows[0].result, beforeInstalls, 'discovery text never modifies club installations');
  });
  await check('six finite source-backed awards use the existing Showdown category and exactly 75 total permanent points', async () => {
    const rows = (await query("select key,category,title,description,thresholds,points,kind,unit,sort_order from dh_feat_catalog where key like 'showdown_cipher_%' order by sort_order")).rows.map(row => ({ ...row, thresholds: row.thresholds.map(Number) }));
    assert.deepEqual(rows, catalog);
    assert.equal(rows.length, 6); assert.equal(rows.reduce((sum, row) => sum + row.points[0], 0), 75);
    assert.equal(new Set(rows.map(row => row.key)).size, 6);
    assert.deepEqual(rows.map(row => row.thresholds), [[1], [1], [1], [1], [10], [1]]);
    const old = (await query("select jsonb_agg(to_jsonb(c) order by key) result from dh_feat_catalog c where key not like 'showdown_cipher_%'")).rows[0].result;
    for (const row of old) {
      const previous = beforeCatalog.find(def => def.key === row.key);
      assert.ok(previous);
      assert.deepEqual(['showdown_matches','showdown_wins','showdown_rivals'].includes(row.key) ? { ...row, description: previous.description } : row, previous);
    }
  });
  await check('metric helpers remain private and evaluator security stays unchanged', async () => {
    for (const signature of ['public.cipher_feat_metrics_v1(uuid,uuid)', 'public.showdown_member_metrics(uuid,uuid)', 'public.dh_feat_metrics(uuid)']) for (const role of ['anon', 'authenticated']) {
      assert.equal((await query('select has_function_privilege($1,$2,\'execute\') allowed', [role, signature])).rows[0].allowed, false);
    }
  });
  await check('invitations and active, declined, cancelled and expired matches never award progress or days', async () => {
    const current = await metrics();
    for (const status of ['pending', 'active', 'declined', 'cancelled', 'expired']) await match({ status, guesses: 1, at: ago(18) });
    assert.deepEqual(await metrics(), current);
  });
  await check('zero-guess surrender is an ordinary completed record but never achievement or activity progress', async () => {
    const current = await metrics(), raw = await records();
    await match({ ownStatus: 'surrendered', guesses: 0, opponentStatus: 'surrendered', opponentGuesses: 0, winner: null, at: ago(17) });
    assert.deepEqual(await metrics(), current);
    const now = await records(); assert.equal(now.played, raw.played + 1); assert.equal(now.draws, raw.draws + 1); assert.equal(now.qualified_played, raw.qualified_played);
  });
  await check('zero-round Cipher attempts with one real guess qualify general engagement and the actual own finish day', async () => {
    const current = await metrics(), raw = await records();
    const matchId = await match({ ownStatus: 'surrendered', guesses: 1, winner: id(2), at: ago(16) });
    assert.equal((await query('select count(*) n from showdown_round_states where challenge_id=$1', [matchId])).rows[0].n, 0);
    const now = await metrics(), record = await records();
    assert.equal(now.showdown_matches, current.showdown_matches + 1); assert.equal(now.showdown_wins, current.showdown_wins);
    assert.equal(now.active_days, current.active_days + 1);
    assert.equal(record.played, raw.played + 1); assert.equal(record.losses, raw.losses + 1); assert.equal(record.qualified_played, raw.qualified_played + 1);
    assert.equal(now.showdown_prism_solved, current.showdown_prism_solved); assert.equal(now.showdown_prism_best, current.showdown_prism_best);
    assert.equal(now.showdown_cipher_first_break, 0);
  });
  await check('a four-guess win qualifies FIRST BREAK and CODE CRACKER without premature mastery or unbreakable credit', async () => {
    await match({ guesses: 4, opponentGuesses: 5, at: ago(15) });
    const current = await cipherMetrics();
    assert.equal(current.showdown_cipher_first_break, 1); assert.equal(current.showdown_cipher_code_cracker, 1);
    assert.equal(current.showdown_cipher_master_decoder, 0); assert.equal(current.showdown_cipher_unbreakable, 0); assert.equal(current.showdown_cipher_perfect_read, 0);
    const board = await fixture.rpc('dh_feats_board', { p_club_id: id(10) }); assert.equal(board.error, null);
    assert.equal(board.data.unlocks.filter(row => row.feat_key.startsWith('showdown_cipher_')).reduce((sum, row) => sum + row.points, 0), 15);
  });
  await check('a three-guess solve earns MASTER DECODER even when the opponent wins in two', async () => {
    const before = await cipherMetrics(); await match({ guesses: 3, opponentGuesses: 2, winner: id(2), at: ago(14) });
    const current = await cipherMetrics(); assert.equal(current.showdown_cipher_master_decoder, 1); assert.equal(current.showdown_cipher_first_break, before.showdown_cipher_first_break);
  });
  await check('a winning solve against an exhausted or surrendered opponent earns UNBREAKABLE', async () => {
    await match({ guesses: 5, opponentStatus: 'exhausted', opponentGuesses: 10, at: ago(13) });
    assert.equal((await cipherMetrics()).showdown_cipher_unbreakable, 1);
    await match({ guesses: 6, opponentStatus: 'surrendered', opponentGuesses: 0, at: ago(13) });
    assert.equal((await cipherMetrics()).showdown_cipher_unbreakable, 2);
  });
  await check('first-guess solves require completion, award PERFECT READ and do not use raw numerical scores', async () => {
    const matchId = await match({ guesses: 1, opponentGuesses: 1, winner: null, at: ago(12) });
    const current = await cipherMetrics(); assert.equal(current.showdown_cipher_perfect_read, 1);
    assert.equal((await query('select sum(total_score) score from showdown_attempts where challenge_id=$1', [matchId])).rows[0].score, 0);
  });
  await check('rivalry counts ten matches with one same rival, never ten total matches across different members', async () => {
    const current = await cipherMetrics(); assert.equal(current.showdown_cipher_rivalry, 6);
    for (let n = 0; n < 3; n++) await match({ opponent: id(3), ownStatus: 'exhausted', guesses: 10, opponentStatus: 'exhausted', opponentGuesses: 10, winner: null, at: ago(11) });
    assert.equal((await cipherMetrics()).showdown_cipher_rivalry, 6);
    for (let n = 0; n < 3; n++) await match({ guesses: 7, at: ago(10) });
    assert.equal((await cipherMetrics()).showdown_cipher_rivalry, 9);
    let board = await fixture.rpc('dh_feats_board', { p_club_id: id(10) }); assert.equal(board.data.unlocks.some(row => row.feat_key === 'showdown_cipher_rivalry'), false);
    await match({ guesses: 7, at: ago(10), recipient: true });
    assert.equal((await cipherMetrics()).showdown_cipher_rivalry, 10);
    board = await fixture.rpc('dh_feats_board', { p_club_id: id(10) }); assert.equal(board.data.unlocks.filter(row => row.feat_key === 'showdown_cipher_rivalry').length, 1);
  });
  await check('recipient attempts receive symmetric awards and repeated games on one day add only one activity day', async () => {
    const current = await metrics(); await match({ guesses: 1, recipient: true, at: ago(10) });
    const now = await metrics(); assert.equal(now.active_days, current.active_days); assert.equal(now.showdown_cipher_perfect_read, current.showdown_cipher_perfect_read + 1);
  });
  await check('private opponents and cross-club matches never enter public Cipher metrics or activity days', async () => {
    const current = await metrics();
    await match({ guesses: 1, opponent: id(7), at: ago(9) });
    await match({ guesses: 1, opponent: id(4), club: id(11), at: ago(8) });
    assert.deepEqual(await metrics(), current);
  });
  await check('repeated evaluation and migration reapplication preserve unique receipts and finite Cipher points', async () => {
    const board = await fixture.rpc('dh_feats_board', { p_club_id: id(10) }); assert.equal(board.error, null);
    const earned = await receipts();
    const cipherAwards = earned.filter(row => row.feat_key.startsWith('showdown_cipher_'));
    assert.equal(cipherAwards.length, 6); assert.equal(cipherAwards.reduce((sum, row) => sum + row.points, 0), 75);
    await exec(source);
    const repeat = await fixture.rpc('dh_feats_board', { p_club_id: id(10) }); assert.equal(repeat.data.score, board.data.score);
    assert.deepEqual(await receipts(), earned);
    assert.deepEqual(await security(), beforeSecurity);
  });
  await check('removal from the club stops source qualification without rewriting already-earned permanent awards', async () => {
    const earned = await receipts(); await query('delete from club_members where user_id=$1', [id(1)]);
    assert.equal((await records()).qualified_played, 0);
    assert.equal(Object.values(await cipherMetrics()).every(value => value === 0), true);
    assert.deepEqual(await receipts(), earned);
  });

  const bodies = (await query("select proname,md5(prosrc) body_hash from pg_proc where oid in('public.showdown_member_metrics(uuid,uuid)'::regprocedure,'public.cipher_feat_metrics_v1(uuid,uuid)'::regprocedure,'public.dh_feat_metrics(uuid)'::regprocedure) order by proname")).rows;
  console.log(`${checks} Cipher DH Feats PostgreSQL checks passed.`);
  console.log(JSON.stringify({ migration: path, sha256: hash(source), bodies }, null, 2));
} finally { await fixture.close(); }
