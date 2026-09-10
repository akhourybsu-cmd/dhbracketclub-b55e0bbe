// Optional local integration check: npm install --no-save --package-lock=false @electric-sql/pglite
// No live Supabase connection or credentials are used.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let passed = 0;
const check = async (name, run) => { await run(); console.log(`PASS ${name}`); passed++; };
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
  create function auth.role() returns text language sql as $$ select current_setting('test.role',true) $$;
  create function public.current_user_club_id() returns uuid language sql as $$ select nullif(current_setting('test.club',true),'')::uuid $$;
  create function public.is_app_admin(uuid) returns boolean language sql as $$ select current_setting('test.admin',true) = 'true' $$;
  create function public.is_platform_owner(uuid) returns boolean language sql as $$ select false $$;
  create function public.update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
  create table public.clubs(id uuid primary key);
  create table public.profiles(id uuid primary key);
  create table public.platform_assets(slug text,name text,short_description text,full_description text,updated_at timestamptz);
  create table public.nfl_teams(id uuid primary key);
  create table public.nfl_seasons(id uuid primary key,year integer,pick_lock_minutes integer);
  create table public.nfl_weeks(id uuid primary key,season_id uuid references nfl_seasons,week_number integer);
  create table public.nfl_games(id uuid primary key,week_id uuid references nfl_weeks,season_id uuid references nfl_seasons,
    home_team_id uuid references nfl_teams,away_team_id uuid references nfl_teams,kickoff_at timestamptz,status text);
  create function public.nfl_week_lock_at(uuid) returns timestamptz language sql as $$
    select min(kickoff_at)-interval '10 minutes' from nfl_games where week_id=$1 $$;
  create function public.is_nfl_week_unlocked(uuid) returns boolean language sql as $$ select now() < nfl_week_lock_at($1) $$;
  grant usage on schema public,auth to authenticated;
  grant select on all tables in schema public to authenticated;
  insert into clubs values ('${id(1)}'),('${id(2)}');
  insert into profiles values ('${id(3)}'),('${id(4)}');
  insert into nfl_teams values ('${id(5)}'),('${id(6)}');
  insert into nfl_seasons values ('${id(7)}',2026,10);
  insert into nfl_weeks values ('${id(8)}','${id(7)}',1);
  insert into nfl_games values
    ('${id(9)}','${id(8)}','${id(7)}','${id(5)}','${id(6)}',now()+interval '2 days','scheduled'),
    ('${id(10)}','${id(8)}','${id(7)}','${id(5)}','${id(6)}',now()-interval '1 day','final');
`);
await db.exec(await readFile(new URL('../supabase/migrations/20260910150000_nfl_game_center_crazy_chain.sql', import.meta.url),'utf8'));
const migration = await readFile(new URL('../supabase/migrations/20260910180000_crazy_chain_remaining_games.sql',import.meta.url),'utf8');
await db.exec(migration);
await db.exec(migration); // Must be rerunnable.
async function actor(user=3, admin=true, club=1) {
  await db.query(`select set_config('test.user',$1,false),set_config('test.club',$2,false),set_config('test.role','authenticated',false),set_config('test.admin',$3,false)`,[id(user),club ? id(club) : '',String(admin)]);
}
await actor();
const market = {club_id:id(1),week_id:id(8),season_id:id(7),game_id:id(9),market_type:'passing_yards',
  subject_label:'Example QB',subject_team_id:id(5),subject_external_id:'123',operator:'gte',threshold:200,
  display_text:'Example QB · 200+ passing yards',source_provider:'espn-roster',external_id:'test:qb:200'};
const team = {...market,subject_external_id:null,market_type:'team_win',threshold:1,operator:'eq',external_id:'test:team:win'};
const publish = async (markets=[market,team],availability=[],checked=new Date().toISOString()) =>
  (await db.query(`select public.publish_nfl_chain_board($1,$2,$3::jsonb,$4::jsonb,$5::timestamptz) as result`,
    [id(8),id(1),JSON.stringify(markets),JSON.stringify(availability),checked])).rows[0].result;
const save = async ids => (await db.query('select save_nfl_chain_card($1,$2::uuid[]) as result',[id(8),ids])).rows[0].result;
let playerId, teamId;
await check('publish remaining games without reopening Pickem',async()=>{
  assert.equal((await publish()).inserted,2);
  const state=(await db.query('select get_nfl_chain_board($1) as state, is_nfl_week_unlocked($1) as pickem',[id(8)])).rows[0];
  assert.equal(state.pickem,false); assert.equal(state.state.unlocked,true); assert.equal(state.state.catch_up,true);
  assert.deepEqual(state.state.game_ids,[id(9)]);
  const rows=(await db.query('select id,subject_external_id from nfl_chain_markets')).rows;
  playerId=rows.find(row=>row.subject_external_id).id; teamId=rows.find(row=>!row.subject_external_id).id;
});
await check('reruns do not duplicate or rewrite targets',async()=>{
  assert.equal((await publish([{...market,threshold:1,display_text:'Changed'},team])).inserted,0);
  assert.equal((await db.query('select threshold from nfl_chain_markets where id=$1',[playerId])).rows[0].threshold,'200');
});
await check('reject completed games and stale previews',async()=>{
  await assert.rejects(publish([{...market,game_id:id(10)}]),/outside the remaining/);
  await assert.rejects(publish([market],[],new Date(Date.now()-11*60_000).toISOString()),/expired/);
});
await check('reject member, other-club, and missing-club publication',async()=>{
  await actor(4,false); await assert.rejects(publish(),/commissioner/);
  await actor(3,true,2); await assert.rejects(publish(),/commissioner/);
  await actor(3,true,0); await assert.rejects(publish(),/commissioner/); await actor();
});
await check('injury pause prevents new selections without changing saved legs',async()=>{
  await save([playerId]);
  const before=(await db.query('select id,threshold,display_text from nfl_chain_legs')).rows[0];
  assert.equal((await publish([team],[{id:playerId,verified:false,note:'Questionable'}])).paused,1);
  await save([playerId,teamId]);
  const after=(await db.query('select id,threshold,display_text from nfl_chain_legs where market_id=$1',[playerId])).rows[0];
  assert.deepEqual(after,before);
  assert.equal((await db.query('select status from nfl_chain_legs where market_id=$1',[playerId])).rows[0].status,'pending');
  await actor(4,false); await assert.rejects(save([playerId]),/availability recheck/); await actor();
});
await check('cards and legs stay private until the catch-up cutoff',async()=>{
  await actor(4,false); await db.exec('set role authenticated');
  assert.equal((await db.query('select count(*)::int as n from nfl_chain_entries')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int as n from nfl_chain_legs')).rows[0].n,0);
  await db.exec('reset role'); await actor();
});
await check('recovery permits selections; expired evidence fails closed',async()=>{
  await publish([team],[{id:playerId,verified:true,note:null}]);
  await actor(4,false); await save([playerId]); await actor();
  await db.query(`update nfl_chain_markets set availability_checked_at=now()-interval '25 hours' where id=$1`,[playerId]);
  await save([teamId]); // remove the owner's old player selection
  await assert.rejects(save([playerId]),/availability recheck/);
});
await check('frozen deadline never moves forward on refresh',async()=>{
  await db.exec(`update nfl_chain_boards set lock_at=now()-interval '1 minute'`);
  assert.equal((await publish([team])).locked,true);
  await assert.rejects(save([teamId]),/card is locked/);
  await actor(4,false); await db.exec('set role authenticated');
  assert.ok((await db.query('select count(*)::int as n from nfl_chain_entries')).rows[0].n>0);
  await db.exec('reset role');
});
await db.close();
console.log(`${passed} database integration checks passed.`);
