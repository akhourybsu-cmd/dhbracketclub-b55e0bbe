// Execute the shipped schema, RPCs, policies, grants and rollback in isolated PostgreSQL.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { build } from 'vite';

const db = new PGlite();
const uuid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const AL = uuid(1), BEA = uuid(2), CY = uuid(3), MASKED = uuid(4), OWNER = uuid(5);
const CLUB = uuid(100), OTHER = uuid(101);
const GAME = 'riftwatch', RULES = 'riftwatch-1.0.0', HASH = 'd'.repeat(64);
let sequence = 1000, checks = 0;
const check = async (name, action) => { await action(); console.log('PASS', name); checks++; };
const guard = async (work, code = '42501') => assert.rejects(work, err => err.code === code);

await db.exec(`
  create role anon; create role authenticated; create role service_role; create schema auth;
  grant usage on schema public,auth to anon,authenticated,service_role;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
  create table auth.users(id uuid primary key);
  create table public.profiles(id uuid primary key references auth.users, display_name text, avatar_url text, email text);
  create table public.clubs(id uuid primary key,status text default 'active',owner_admin_id uuid);
  create table public.club_members(user_id uuid not null,club_id uuid not null,role text default 'member',unique(user_id,club_id));
  create table public.dh_private_accounts(user_id uuid, workspace_id uuid);
  create table public.platform_assets(id uuid primary key default gen_random_uuid(),slug text unique,name text,
    category text,short_description text,full_description text,icon_name text,placement_area text,sort_order int,is_active boolean default true);
  create table public.club_installed_assets(club_id uuid,asset_id uuid references public.platform_assets on delete cascade,
    enabled boolean default true,visible_to_members boolean default true);
  create function public.is_club_admin(uid uuid,cid uuid) returns boolean language sql stable as $$
    select exists(select 1 from club_members where user_id=uid and club_id=cid and role='admin') $$;
  create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
`);
const read = file => readFile(file, 'utf8');
async function loadHelper(file, name) {
  const source = await read('supabase/migrations/' + file);
  const start = source.indexOf('create or replace function public.' + name + '(');
  const end = source.indexOf('$$;', start);
  assert.ok(start >= 0 && end > start);
  await db.exec(source.slice(start, end + 3));
}
for (const helper of ['dh_public_member', 'dh_visible_member', 'dh_visible_club']) {
  await loadHelper('20261029060000_private_sessions.sql', helper);
}
await loadHelper('20261101010000_showdown_foundation.sql', 'showdown_member_valid');
await db.exec(await read('supabase/migrations/20261128180000_arcade_scores.sql'));
for (const [user, name] of [[AL, 'Alden'], [BEA, 'Beatrice'], [CY, 'cy@example.net'], [MASKED, 'Hidden'], [OWNER, 'Owner']]) {
  await db.query('insert into auth.users values($1)', [user]);
  await db.query('insert into profiles values($1,$2,$3,$4)', [user, name, 'https://public.example/avatar.png', 'private@example.com']);
}
await db.query('insert into clubs(id,owner_admin_id) values($1,$3),($2,null)', [CLUB, OTHER, OWNER]);
await db.query('insert into club_members(user_id,club_id) values($1,$4),($2,$4),($3,$5),($1,$5),($6,$4)', [AL, BEA, CY, CLUB, OTHER, MASKED]);
await db.query('insert into dh_private_accounts values($1,$2)', [MASKED, uuid(99)]);
async function call(role, user, query, args = []) {
  return db.transaction(async tx => {
    await tx.exec('set local role ' + role);
    await tx.query("select set_config('test.uid',$1,true)", [user || '']);
    return (await tx.query(query, args)).rows;
  });
}
async function rpc(role, user, name, args) {
  const rows = await call(role, user, 'select ' + name + '(' + args.map((_,i)=>'$'+(i+1)).join(',') + ') val', args);
  return rows[0].val;
}
const start = (user=AL, club=CLUB, request=uuid(++sequence), rules=RULES) =>
  rpc('authenticated',user,'arcade_start_run',[club,GAME,rules,'test-build',request]);
const claim = (run,user=AL,hash=HASH,club=run.clubId,rules=run.rulesetVersion) =>
  rpc('service_role',null,'arcade_claim_run',[user,club,run.runId,GAME,rules,hash,1]);
const finish = (run,user=AL,score=200,wave=2,ticks=60,reason=null) =>
  rpc('service_role',null,'arcade_finish_run',[user,run.clubId,run.runId,HASH,
    reason ? null : JSON.stringify({score,wave,kills:4,simulationTicks:ticks}),reason]);
const status = (user,run) => rpc('authenticated',user,'arcade_run_status',[run.runId]);
const board = (user=AL,club=CLUB,period='all_time',rules=RULES) =>
  rpc('authenticated',user,'arcade_leaderboard',[club,GAME,rules,period]);

await check('opt-in catalog entry alone grants no seat or board',async()=>{
  assert.equal((await db.query("select count(*) n from platform_assets where slug='riftwatch'")).rows[0].n,1);
  assert.equal((await db.query('select count(*) n from club_installed_assets')).rows[0].n,0);
  await guard(start()); await guard(board());
});
await db.query("insert into club_installed_assets(club_id,asset_id) select c.id,a.id from clubs c cross join platform_assets a where a.slug='riftwatch'");

let playerRun, winning;
await check('start binds owner, board, build, bounded lifetime and a unique server seed',async()=>{
  const key=uuid(++sequence);
  playerRun=await start(AL,CLUB,key);
  assert.equal(playerRun.status,'started');
  assert.match(playerRun.seed,/^\d+$/); assert.ok(Number(playerRun.seed)<=0xffffffff);
  assert.equal(new Date(playerRun.expiresAt)-new Date(playerRun.startedAt),2*60*60*1000);
  assert.deepEqual(await start(AL,CLUB,key),playerRun);
  await guard(start(AL,OTHER,key),'23505');
  assert.equal((await status(AL,playerRun)).runId,playerRun.runId);
  const second=await start(); assert.notEqual(second.runId,playerRun.runId);
  assert.match(second.seed,/^\d+$/);
});
await check('only active visible members and active club owners have access',async()=>{
  await guard(start(CY)); await guard(start(MASKED)); await guard(board(MASKED));
  assert.equal((await board(OWNER)).totalMembers,0);
  await db.query("update clubs set status='suspended' where id=$1",[CLUB]); await guard(board());
  await db.query("update clubs set status='active' where id=$1",[CLUB]);
  await db.exec('update club_installed_assets set enabled=false'); await guard(start());
  await db.exec('update club_installed_assets set enabled=true,visible_to_members=false'); await guard(start());
  assert.equal((await board(OWNER)).totalMembers,0);
  await db.exec('update club_installed_assets set visible_to_members=true');
});
await check('foreign run ids do not expose session status or verification work',async()=>{
  await guard(status(BEA,playerRun));
  await guard(claim(playerRun,BEA)); await guard(claim(playerRun,AL,HASH,OTHER));
  await guard(claim(playerRun,AL,HASH,CLUB,'future'),'22023');
  assert.deepEqual(await call('authenticated',BEA,'select id from arcade_run_sessions'),[]);
  assert.ok((await call('authenticated',AL,'select id from arcade_run_sessions')).some(row=>row.id===playerRun.runId));
});
await check('only the validator can claim and settle and clients cannot write private totals',async()=>{
  await guard(rpc('authenticated',AL,'arcade_claim_run',[AL,CLUB,playerRun.runId,GAME,RULES,HASH,1]));
  await guard(rpc('authenticated',AL,'arcade_finish_run',[AL,CLUB,playerRun.runId,HASH,'{}',null]));
  for(const table of ['arcade_run_sessions','arcade_scores','arcade_rulesets']){
    for(const statement of [`insert into ${table} default values`,`delete from ${table}`,`update ${table} set game_key='tamper'`]){
      await guard(call('authenticated',AL,statement));
    }
  }
  await guard(call('anon',null,'select id from arcade_scores'));
  await guard(call('authenticated',AL,'select user_id from arcade_scores'));
  await guard(call('authenticated',AL,'select receipt,replay_hash from arcade_run_sessions'));
  await guard(rpc('authenticated',AL,'arcade_board_data',[BEA,OTHER,GAME,RULES,'all_time']));
});
await check('retryable claim leases prohibit duplicate verification or replay replacement',async()=>{
  assert.equal((await claim(playerRun)).verifyNow,true);
  assert.equal((await claim(playerRun)).verifyNow,false);
  await guard(claim(playerRun,AL,'0'.repeat(64)),'23505');
  await db.query("update arcade_run_sessions set lease_until=now()-interval '1 second' where id=$1",[playerRun.runId]);
  assert.equal((await claim(playerRun)).verifyNow,true);
  const r=await start(); await claim(r);
  const rejected=await finish(r,AL,200,2,60,'invalid_replay');
  assert.equal(rejected.status,'rejected'); assert.equal(rejected.rejectionCode,'invalid_replay');
  assert.equal((await claim(r)).verifyNow,false); assert.equal((await finish(r)).status,'rejected');
});
await check('finishing a valid run generates a frozen personal-best receipt and one immutable score',async()=>{
  const calls=await Promise.all([finish(playerRun),finish(playerRun)]);
  assert.deepEqual(calls[0],calls[1]); winning=calls[0]; assert.equal(winning.status,'verified');
  assert.equal(winning.result.newPersonalBest,true); assert.equal(winning.result.personalBest,200);
  assert.equal(winning.result.rank,1); assert.equal(winning.result.previousRank,null);
  assert.equal((await db.query('select count(*) n from arcade_scores')).rows[0].n,1);
  assert.equal((await claim(playerRun)).verifyNow,false);
});
await check('server expiry and elapsed time reject late and faster-than-wall-clock runs',async()=>{
  const old=await start();
  await db.query("update arcade_run_sessions set started_at=now()-interval '3 hours',expires_at=now()-interval '1 hour' where id=$1",[old.runId]);
  assert.equal((await claim(old)).status,'expired'); assert.equal((await status(AL,old)).status,'expired');
  const rushed=await start();await claim(rushed);
  assert.equal((await finish(rushed,AL,500,8,60000)).rejectionCode,'invalid_duration');
  assert.equal((await db.query('select count(*) n from arcade_scores')).rows[0].n,1);
});
await check('late retries preserve original PB and movement while the board updates',async()=>{
  const r=await start(BEA);await claim(r,BEA);await finish(r,BEA,400);
  const mine=await start();await claim(mine);const beaten=await finish(mine,AL,600);
  assert.equal(beaten.result.rank,1);assert.equal(beaten.result.previousRank,2);assert.equal(beaten.result.rankChange,1);
  assert.equal(beaten.result.newPersonalBest,true); assert.equal(beaten.result.leaderboard.entries.length,2);
  const old=await status(AL,playerRun);assert.equal(old.result.personalBest,200);
  assert.equal(old.result.leaderboard.personalBest.score,600);
  const lower=await start();await claim(lower);const receipt=await finish(lower,AL,150);
  assert.equal(receipt.result.newPersonalBest,false); assert.equal(receipt.result.personalBest,600);
});
await check('disabled asset or membership removal between claim and finish prevents score settlement and public display',async()=>{
  const run=await start(BEA);await claim(run,BEA);
  await db.query('delete from club_members where user_id=$1 and club_id=$2',[BEA,CLUB]);
  await guard(finish(run,BEA)); await guard(status(BEA,run));
  assert.equal((await board()).totalMembers,1);
  assert.equal((await call('authenticated',AL,'select id from arcade_scores')).length,3);
  await db.query('insert into club_members(user_id,club_id) values($1,$2)',[BEA,CLUB]);
  await db.query('update club_installed_assets set enabled=false where club_id=$1',[CLUB]);
  await guard(finish(run,BEA)); await guard(board());
  await db.query('update club_installed_assets set enabled=true where club_id=$1',[CLUB]);
  assert.equal((await finish(run,BEA)).status,'verified');
});
await check('same member has separate authorized club boards, safe display fields only',async()=>{
  await db.query("update profiles set avatar_url='https://example.test/avatars/'||id::text||'/avatar.png' where id=$1",[CY]);
  const other=await start(AL,OTHER);await claim(other);await finish(other,AL,50);
  const r=await start(CY,OTHER);await claim(r,CY);await finish(r,CY,51);
  assert.equal((await board(AL,OTHER)).personalBest.score,50);
  assert.equal((await board()).personalBest.score,600);
  const item=(await board(AL,OTHER)).entries[0];
  assert.deepEqual(Object.keys(item).sort(),['rank','isMe','score','wave','achievedAt','displayName','avatarUrl'].sort());
  assert.equal(item.displayName,'Club member'); assert.equal(item.isMe,false);
  assert.equal(item.avatarUrl,null);
  assert.equal((await board(AL,OTHER)).personalBest.avatarUrl,'https://public.example/avatar.png');
  await guard(board(BEA,OTHER)); await guard(board(CY,CLUB));
});
await check('calendar boundaries use New York dates, Monday weeks, spring forward, and the repeated autumn hour',async()=>{
  const startAt=async(p,at)=>(await db.query('select arcade_period_start($1,$2)::text start',[p,at])).rows[0].start;
  for (const [period,at,expected] of [
    ['today','2026-03-08T16:00:00Z','2026-03-08T05:00:00Z'],
    ['today','2026-03-09T16:00:00Z','2026-03-09T04:00:00Z'],
    ['today','2026-11-01T06:30:00Z','2026-11-01T04:00:00Z'],
    ['today','2026-11-02T06:30:00Z','2026-11-02T05:00:00Z'],
    ['week','2026-11-02T04:59:59Z','2026-10-26T04:00:00Z'],
    ['week','2026-11-02T05:00:00Z','2026-11-02T05:00:00Z'],
  ]) assert.equal(Date.parse(await startAt(period,at)),Date.parse(expected));
  await guard(board(AL,CLUB,'all'),'22023');
});
await check('period filtering chooses each player’s best score inside the interval',async()=>{
  await db.query(`update arcade_scores set achieved_at=arcade_period_start('week',now())-interval '1 second'
    where club_id=$1 and user_id=$2 and score=600`,[CLUB,AL]);
  assert.equal((await board(AL,CLUB,'today')).personalBest.score,200);
  assert.equal((await board(AL,CLUB,'week')).personalBest.score,200);
  assert.equal((await board()).personalBest.score,600);
});
await check('retiring a ruleset keeps history without mixing its scores into the current board',async()=>{
  await db.exec("update arcade_rulesets set is_current=false; insert into arcade_rulesets values('riftwatch','test-next','riftwatch',true,60,100000)");
  assert.equal((await board(AL,CLUB,'all_time','test-next')).totalMembers,0);
  await guard(board(),'22023');await guard(start(),'22023');
  assert.equal((await status(AL,playerRun)).status,'verified');
  await db.exec("delete from arcade_rulesets where ruleset_version='test-next';update arcade_rulesets set is_current=true");
});
await check('tie breaks use wave, earliest achieved timestamp, then stable score-row UUID',async()=>{
  const r=await start(CY,OTHER);await claim(r,CY);await finish(r,CY,50);
  await db.query('update arcade_scores set score=50,wave=2,achieved_at=now()-interval \'1 minute\' where club_id=$1',[OTHER]);
  const eligible=(await db.query('select distinct on(user_id) user_id,id from arcade_scores where club_id=$1 order by user_id,id',[OTHER])).rows;
  const first=eligible.sort((a,b)=>a.id.localeCompare(b.id))[0];
  assert.equal((await board(AL,OTHER)).entries[0].isMe,first.user_id===AL);
  await db.query("update arcade_scores set achieved_at=now()-interval '2 minutes' where club_id=$1 and user_id=$2",[OTHER,CY]);
  assert.equal((await board(AL,OTHER)).entries[0].isMe,false);
  await db.query('update arcade_scores set wave=3 where club_id=$1 and user_id=$2',[OTHER,AL]);
  assert.equal((await board(AL,OTHER)).entries[0].isMe,true);
});
await check('Top 25 plus two neighbors on each side is bounded, ordered, and deduplicated',async()=>{
  for(let i=0;i<38;i++){
    const id=uuid(200+i);await db.query('insert into auth.users values($1)',[id]);
    await db.query("insert into profiles(id,display_name) values($1,'Warden')",[id]);
    await db.query('insert into club_members(user_id,club_id) values($1,$2)',[id,CLUB]);
    const r=await start(id);await claim(r,id);await finish(r,id,1000+i);
  }
  const result=await board(uuid(201));assert.equal(result.totalMembers,40);
  assert.deepEqual(result.entries.map(e=>e.rank),[...Array.from({length:25},(_,i)=>i+1),35,36,37,38,39]);
  assert.equal(result.entries.filter(e=>e.isMe).length,1);
  const adjacent=await board(uuid(212));assert.equal(new Set(adjacent.entries.map(e=>e.rank)).size,adjacent.entries.length);
});
await check('rate limit counts across request IDs while same-request retries remain free',async()=>{
  const identities=Array.from({length:12},()=>uuid(++sequence));
  for(const key of identities)await start(OWNER,CLUB,key);
  assert.ok((await start(OWNER,CLUB,identities[0])).seed);
  await assert.rejects(start(OWNER),err=>err.code==='P0001'&&err.message==='rate_limited');
});
await check('issued seed through real gameplay, Edge replay, SQL settlement, board and retry', async () => {
  // Compile the production TypeScript in memory. Only Supabase auth/transport are adapted
  // to this disposable database. RPC argument names still resolve in PostgreSQL.
  async function loadGameModule(entry) {
    const bundle = await build({
      configFile: false, logLevel: 'silent',
      build: { ssr: entry, write: false, minify: false, copyPublicDir: false,
        rollupOptions: { output: { format: 'es', inlineDynamicImports: true } } },
    });
    return import('data:text/javascript;base64,' + Buffer.from(bundle.output[0].code).toString('base64'));
  }
  const { handleArcadeRequest } = await loadGameModule('supabase/functions/arcade-run/handler.ts');
  const { createRun, stepRun, summarize, INPUT, MAX_TICKS } =
    await loadGameModule('supabase/functions/_shared/arcade/riftwatch.ts');
  const user = uuid(410), clubId = uuid(700);
  await db.query('insert into auth.users values($1)', [user]);
  await db.query("insert into profiles(id,display_name) values($1,'Warden')", [user]);
  await db.query('insert into clubs(id) values($1)', [clubId]);
  await db.query('insert into club_members(user_id,club_id) values($1,$2)', [user, clubId]);
  await db.query("insert into club_installed_assets(club_id,asset_id) select $1,id from platform_assets where slug='riftwatch'", [clubId]);
  function rpcTransport(role, identity) {
    return async (name, args) => {
      assert.match(name, /^arcade_[a-z_]+$/);
      const names = Object.keys(args);
      names.forEach(key => assert.match(key, /^p_[a-z_]+$/));
      const named = names.map((key, index) => key + ' => $' + (index + 1)).join(',');
      const values = Object.values(args).map(value => value && typeof value === 'object' ? JSON.stringify(value) : value);
      return (await call(role, identity, 'select public.' + name + '(' + named + ') val', values))[0].val;
    };
  }
  const memberRpc = rpcTransport('authenticated', user);
  const trustedRpc = rpcTransport('service_role', null);
  const scope = { clubId, gameKey: GAME, rulesetVersion: RULES };
  async function post(action) {
    const res = await handleArcadeRequest(new Request('https://arcade.test/functions/v1/arcade-run', {
      method: 'POST', headers: { Authorization: 'Bearer fixture-member', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...scope, ...action }),
    }), { authenticate: async token => {
      assert.equal(token, 'fixture-member');
      return { userId: user, memberRpc, trustedRpc };
    } });
    return { status: res.status, body: await res.json() };
  }
  async function play() {
    const ticket = await post({ action: 'start', requestId: uuid(++sequence), clientBuild: 'test-build' });
    assert.equal(ticket.status, 200, JSON.stringify(ticket.body));
    const { seed, runId } = ticket.body;
    const state = createRun(seed);
    while (state.phase !== 'over' && state.tick < MAX_TICKS) stepRun(state, INPUT.fire);
    assert.equal(state.phase, 'over');
    // The engine plays headlessly in milliseconds. Advance just this test fixture's
    // database start time by the corresponding duration before checking server elapsed time.
    await db.query("update arcade_run_sessions set started_at=started_at-$2::int*interval '1 second' where id=$1",
      [runId, Math.ceil(state.tick / 60)]);
    return { action: 'submit', clientBuild: 'test-build', runId, replayEncodingVersion: 1,
      inputEvents: [[0, INPUT.fire]], clientSummary: summarize(state) };
  }
  const submission = await play();
  const verified = await post(submission);
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  assert.equal(verified.body.status, 'verified');
  assert.equal(verified.body.isPersonalBest, true);
  for (const [field, value] of Object.entries(submission.clientSummary)) assert.equal(verified.body[field], value);
  assert.deepEqual(await post(submission), verified);
  const restored = await post({ action: 'status', runId: submission.runId });
  assert.deepEqual(restored.body.result, verified.body);
  const ranks = await board(user, clubId);
  assert.equal(ranks.personalBest.rank, 1);
  assert.equal(ranks.personalBest.score, submission.clientSummary.score);
  const altered = await play();
  altered.clientSummary.score++;
  assert.equal((await post(altered)).status, 422);
  assert.equal((await post({ action: 'status', runId: altered.runId })).body.status, 'rejected');
  assert.equal((await db.query('select count(*) n from arcade_scores where club_id=$1', [clubId])).rows[0].n, 1);
});
await check('the supplied rollback removes only arcade objects and the Riftwatch asset',async()=>{
  await db.exec("insert into platform_assets(name,slug) values('Mesomon','mesomon')");
  await db.exec(await read('docs/rollback/riftwatch_arcade.sql'));
  assert.equal((await db.query("select to_regclass('public.arcade_scores') reg")).rows[0].reg,null);
  assert.equal((await db.query("select slug from platform_assets")).rows[0].slug,'mesomon');
  assert.ok((await db.query("select to_regprocedure('public.showdown_member_valid(uuid,uuid)') fn")).rows[0].fn);
});
await db.close();
console.log('PASS Arcade database:',checks,'groups on disposable PostgreSQL. PGlite serializes transactions.');
