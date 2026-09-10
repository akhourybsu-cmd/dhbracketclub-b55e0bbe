// Isolated PostgreSQL checks. No live data or credentials.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
process.on('uncaughtException',error=>{console.error(error.message,error.detail||'',error.where||'',error.query?.slice(Math.max(0,Number(error.position)-150),Number(error.position)+150)||'');process.exit(1);});
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const thirty=process.argv.includes('--30m') || process.argv.includes('--bundle');
let passed=0;
const check=async(name,run)=>{await run();console.log(`PASS ${name}`);passed++;};
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
create function auth.role() returns text language sql as $$ select current_setting('test.role',true) $$;
create function current_user_club_id() returns uuid language sql as $$ select nullif(current_setting('test.club',true),'')::uuid $$;
create function is_app_admin(uuid) returns boolean language sql as $$ select current_setting('test.admin',true)='true' $$;
create function is_platform_owner(uuid) returns boolean language sql as $$ select false $$;
create function update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
create table clubs(id uuid primary key); create table profiles(id uuid primary key);
create table platform_assets(slug text,name text,short_description text,full_description text,updated_at timestamptz);
create table nfl_teams(id uuid primary key);
create table nfl_seasons(id uuid primary key,year integer,pick_lock_minutes integer);
create table nfl_weeks(id uuid primary key,season_id uuid references nfl_seasons,week_number integer,featured_game_id uuid);
create table nfl_games(id uuid primary key,week_id uuid references nfl_weeks,season_id uuid references nfl_seasons,
 home_team_id uuid references nfl_teams,away_team_id uuid references nfl_teams,kickoff_at timestamptz,status text);
create table nfl_picks(id uuid primary key default gen_random_uuid(),club_id uuid default current_user_club_id(),user_id uuid,
 game_id uuid,week_id uuid,season_id uuid,picked_team_id uuid,is_correct boolean,points_awarded integer default 0);
create table nfl_tiebreakers(id uuid primary key default gen_random_uuid(),club_id uuid default current_user_club_id(),user_id uuid,
 week_id uuid,season_id uuid,predicted_total integer,actual_total integer,delta integer);
alter table nfl_picks enable row level security; alter table nfl_tiebreakers enable row level security;
create function nfl_week_lock_at(uuid) returns timestamptz language sql as $$ select min(kickoff_at)-interval '10 minutes' from nfl_games where week_id=$1 $$;
create function is_nfl_week_unlocked(uuid) returns boolean language sql as $$ select now()<nfl_week_lock_at($1) $$;
create function is_pick_unlocked(uuid) returns boolean language sql as $$ select true $$;
create function recompute_nfl_week_status(uuid) returns void language sql as $$ select $$;
grant usage on schema public,auth to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;
insert into clubs values('${id(1)}'),('${id(2)}'); insert into profiles values('${id(3)}'),('${id(4)}');
insert into nfl_teams values('${id(5)}'),('${id(6)}'); insert into nfl_seasons values('${id(7)}',2026,10);
insert into nfl_weeks values('${id(8)}','${id(7)}',1,'${id(10)}');
insert into nfl_games values
 ('${id(9)}','${id(8)}','${id(7)}','${id(5)}','${id(6)}',now()+interval '3 days','scheduled'),
 ('${id(10)}','${id(8)}','${id(7)}','${id(5)}','${id(6)}',now()+interval '6 days','scheduled');
alter table nfl_games add column home_score integer,add column away_score integer,add column winner_team_id uuid;
`);
for(const file of ['20260907120000_nfl_pickem_integrity_and_privacy.sql','20260910150000_nfl_game_center_crazy_chain.sql',
  ...(process.argv.includes('--with-catch-up')?['20260910180000_crazy_chain_remaining_games.sql']:[]),
  ...(process.argv.includes('--bundle') ? ['../../docs/sql/NFL_PER_GAME_AND_LIVE.sql','../../docs/sql/NFL_PER_GAME_AND_LIVE.sql'] : [
  '20260910210000_crazy_chain_per_game_live.sql','20260910213000_pickem_per_game_live.sql',
  '20260910210000_crazy_chain_per_game_live.sql','20260910213000_pickem_per_game_live.sql'])]) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
}
const actor=async(user=3,admin=true,club=1,role='authenticated')=>db.query(
 `select set_config('test.user',$1,false),set_config('test.club',$2,false),set_config('test.admin',$3,false),set_config('test.role',$4,false)`,
 [id(user),club?id(club):'',String(admin),role]);
await actor();
const markets=[9,10].map((game,i)=>({club_id:id(1),week_id:id(8),season_id:id(7),game_id:id(game),market_type:'team_win',
 subject_label:'Home',subject_team_id:id(5),subject_external_id:null,operator:'eq',threshold:1,display_text:'Home to win',source_provider:'espn-roster',external_id:`win:${i}`}));
const publish=async(ms=markets)=>db.query('select publish_nfl_chain_board($1,$2,$3::jsonb,$4::jsonb,now())',[id(8),id(1),JSON.stringify(ms),'[]']);
await publish();
const rows=(await db.query('select id,game_id from nfl_chain_markets')).rows;
const first=rows.find(r=>r.game_id===id(9)).id,later=rows.find(r=>r.game_id===id(10)).id;
const save=async(game,ids)=>db.query('select save_nfl_chain_game($1,$2::uuid[])',[id(game),ids]);
const settle=async(m,value)=>db.query('select settle_nfl_chain_market($1,$2,false)',[m,value]);
const standing=async()=> (await db.query('select * from nfl_chain_standings where user_id=$1',[id(3)])).rows[0];
await check('per-game saves preserve other game selections and snapshots',async()=>{
 await save(9,[first]); const before=(await db.query('select * from nfl_chain_legs')).rows[0];
 await save(10,[later]); const after=(await db.query('select * from nfl_chain_legs where id=$1',[before.id])).rows[0];
 assert.equal(after.threshold,before.threshold); assert.equal(after.display_text,before.display_text);
 assert.equal((await db.query('select count(*)::int n from nfl_chain_legs')).rows[0].n,2);
 await assert.rejects(save(9,[later]),/this game only/);
});
if(thirty) await check('30-minute migration reopens only Crazy Chain, preserves picks, and is rerunnable',async()=>{
 await db.exec("update nfl_games set kickoff_at=now()+interval '2 hours' where id='"+id(9)+"'");
 const prior=(await db.query('select chain_lock_at from nfl_games where id=$1',[id(9)])).rows[0].chain_lock_at;
 const legs=(await db.query('select id,threshold,display_text from nfl_chain_legs order by id')).rows;
 const migration=await readFile(new URL('../supabase/migrations/20260910220000_crazy_chain_30_minute_lock.sql',import.meta.url),'utf8');
 await db.exec(migration);await db.exec(migration);
 assert.deepEqual((await db.query('select chain_lock_at from nfl_games where id=$1',[id(9)])).rows[0].chain_lock_at,prior);
 assert.deepEqual((await db.query('select id,threshold,display_text from nfl_chain_legs order by id')).rows,legs);
 assert.equal((await db.query('select is_pick_unlocked($1) open',[id(9)])).rows[0].open,false);
 assert.equal((await db.query('select nfl_chain_game_unlocked($1) open',[id(9)])).rows[0].open,true);
 const board=(await db.query('select get_nfl_chain_board($1) board',[id(8)])).rows[0].board;
 assert.equal(board.mode,'per_game_30m');assert.equal(board.lock_minutes,30);
 await save(9,[first]);await publish();
 await db.query('update nfl_weeks set featured_game_id=$1 where id=$2',[id(9),id(8)]);
 assert.equal((await db.query('select nfl_tiebreaker_unlocked($1) open',[id(8)])).rows[0].open,false);
 await db.query('update nfl_weeks set featured_game_id=$1 where id=$2',[id(10),id(8)]);
 await assert.rejects(db.query('insert into nfl_picks(club_id,user_id,game_id,week_id,season_id,picked_team_id) values($1,$2,$3,$4,$5,$6)',
  [id(1),id(3),id(9),id(8),id(7),id(5)]),/48 hours/);
 await db.exec("update nfl_games set kickoff_at=now()+interval '31 minutes' where id='"+id(9)+"'");
 await save(9,[first]);
});
await check('exact game cutoff closes Thursday but leaves Sunday editable',async()=>{
 await db.exec(`update nfl_games set kickoff_at=now()+interval '${thirty?'30 minutes':'48 hours'}' where id='${id(9)}'`);
 assert.equal((await db.query('select is_pick_unlocked($1) open',[id(9)])).rows[0].open,false);
 assert.equal((await db.query('select is_pick_unlocked($1) open',[id(10)])).rows[0].open,true);
 await assert.rejects(save(9,[]),thirty?/30 minutes/:/48 hours/);
 await assert.rejects(db.query('select save_nfl_chain_card($1,$2::uuid[])',[id(8),[later]]),/cannot be removed/);
 await save(10,[]); await save(10,[later]);
 await assert.rejects(publish(),thirty?/30-minute slate/:/48-hour slate/); await publish([markets[1]]);
});
await check('postponement cannot reopen a frozen game; earlier time moves cutoff earlier',async()=>{
 const column=thirty?'crazy_chain_lock_at':'chain_lock_at';
 const before=(await db.query('select '+column+' deadline from nfl_games where id=$1',[id(9)])).rows[0].deadline;
 await db.exec(`update nfl_games set kickoff_at=now()+interval '7 days' where id='${id(9)}'`);
 assert.deepEqual((await db.query('select '+column+' deadline from nfl_games where id=$1',[id(9)])).rows[0].deadline,before);
 await db.exec(`update nfl_games set kickoff_at=now()-interval '1 day' where id='${id(9)}'`);
});
await check('no early settlement, cross-club grading, or missing-value zeroes',async()=>{
 await assert.rejects(settle(first,1),/final game/);
 await actor(4,true,2); await assert.rejects(settle(first,1),/commissioner/); await actor();
 await db.exec(`update nfl_games set status='final' where id='${id(9)}'`);
 await assert.rejects(settle(first,null),/finite verified/);
});
await check('Thursday credits immediately while Sunday can still be edited',async()=>{
 await settle(first,1); assert.equal((await standing()).current_chain,1);
 assert.equal((await standing()).perfect_games,1);
 await save(10,[]); assert.equal((await standing()).current_chain,1);
 await save(10,[later]); assert.equal((await standing()).current_chain,1);
});
await check('repeat results cannot double-credit; corrections rebuild the chain',async()=>{
 const initial=(await standing()).id; await settle(first,1); assert.equal((await standing()).current_chain,1);
 await settle(first,0); assert.equal((await standing()).current_chain,0);
 await settle(first,1); assert.equal((await standing()).current_chain,1);assert.equal((await standing()).id,initial);
});
await check('future entry counts stay private and pick disclosure is per game',async()=>{
 await db.query('insert into nfl_picks(club_id,user_id,game_id,week_id,season_id,picked_team_id) values($1,$2,$3,$4,$5,$6)',
 [id(1),id(3),id(10),id(8),id(7),id(5)]);
 await actor(3,true,1,'service_role');
 await db.query('insert into nfl_picks(club_id,user_id,game_id,week_id,season_id,picked_team_id) values($1,$2,$3,$4,$5,$6)',
 [id(1),id(3),id(9),id(8),id(7),id(5)]);
 await actor(4,false); await db.exec('set role authenticated');
 assert.equal((await db.query('select count(*)::int n from nfl_chain_entries')).rows[0].n,0);
 const visible=(await db.query('select game_id from nfl_picks')).rows;assert.deepEqual(visible.map(r=>r.game_id),[id(9)]);
 await db.exec('reset role');await actor();
});
await check('Pickem allows only valid future picks; tiebreaker uses its featured game',async()=>{
 await actor(4,false); await db.exec('set role authenticated');
 await db.query('insert into nfl_picks(club_id,user_id,game_id,week_id,season_id,picked_team_id,is_correct,points_awarded) values($1,$2,$3,$4,$5,$6,true,99)',
 [id(1),id(4),id(10),id(8),id(7),id(5)]);
 const own=(await db.query('select * from nfl_picks where user_id=$1',[id(4)])).rows[0];assert.equal(own.is_correct,null);assert.equal(own.points_awarded,0);
 await assert.rejects(db.query('update nfl_picks set game_id=$1 where id=$2',[id(9),own.id]),/48 hours|identity/);
 await db.query('insert into nfl_tiebreakers(club_id,user_id,week_id,season_id,predicted_total) values($1,$2,$3,$4,42)',[id(1),id(4),id(8),id(7)]);
 await db.exec('reset role');await actor();
});
await check('later final losses reset immediately, independent of the weekly envelope',async()=>{
 await db.exec(`update nfl_games set kickoff_at=now()-interval '1 hour',status='final' where id='${id(10)}'`);
 await settle(later,0);assert.equal((await standing()).current_chain,0);assert.equal((await standing()).best_chain,1);
 await settle(later,1);assert.equal((await standing()).current_chain,2);
});
await check('same-kickoff games and delayed evidence have deterministic standings',async()=>{
 await db.exec(`insert into nfl_games(id,week_id,season_id,home_team_id,away_team_id,kickoff_at,status) values
 ('${id(11)}','${id(8)}','${id(7)}','${id(5)}','${id(6)}',now()+interval '10 days','scheduled'),
 ('${id(12)}','${id(8)}','${id(7)}','${id(5)}','${id(6)}',now()+interval '10 days','scheduled')`);
 await publish([11,12].map(n=>({...markets[0],game_id:id(n),external_id:'simultaneous:'+n})));
 const ms=(await db.query('select id,game_id from nfl_chain_markets where game_id=any($1::uuid[])',[[id(11),id(12)]])).rows;
 const one=ms.find(r=>r.game_id===id(11)).id,two=ms.find(r=>r.game_id===id(12)).id;
 await save(11,[one]);await save(12,[two]);
 await db.exec(`update nfl_games set kickoff_at=now()-interval '10 minutes',status='final' where id in ('${id(11)}','${id(12)}')`);
 await settle(two,1);assert.equal((await standing()).current_chain,2);assert.equal((await standing()).total_hit_legs,3);
 await settle(one,0);assert.equal((await standing()).current_chain,0);
 await settle(one,1);assert.equal((await standing()).current_chain,4);
});
await check('automatic batch preserves manual decisions, handles corrections, and rejects replayed stale evidence',async()=>{
 const apply=async(value,when=new Date().toISOString())=>db.query('select apply_nfl_chain_game_results($1,$2::jsonb,$3::timestamptz)',
 [id(9),JSON.stringify([{id:first,actual:value,voided:false}]),when]);
 await assert.rejects(apply(0),/Server scoring only/);
 await actor(3,true,1,'service_role');
 await apply(0);assert.equal((await db.query('select actual_value from nfl_chain_markets where id=$1',[first])).rows[0].actual_value,'1');
 await db.query("update nfl_chain_markets set result_source='espn-final' where id=$1",[first]);
 await apply(0);assert.equal((await standing()).current_chain,3); // first miss, later three hits
 await apply(0);assert.equal((await standing()).current_chain,3);
 await assert.rejects(apply(1,new Date(Date.now()-11*60_000).toISOString()),/expired/);
 await actor();
});
await check('saved snapshots grade independently of market edits',async()=>{
 await db.query('update nfl_chain_markets set threshold=99 where id=$1',[first]);
 await settle(first,1);
 assert.equal((await db.query('select status from nfl_chain_legs where market_id=$1',[first])).rows[0].status,'hit');
 assert.equal((await standing()).current_chain,4);
});
await db.close();console.log(`${passed} per-game database checks passed.`);
