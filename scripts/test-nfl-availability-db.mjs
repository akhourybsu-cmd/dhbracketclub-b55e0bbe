// Runs against the parent test's isolated database only, never a live project.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function runAvailabilityChecks({db,id,actor,save,publish,markets,standing,check}) {
 const migration=await readFile(new URL('../supabase/migrations/20260910223000_crazy_chain_player_cancellation.sql',import.meta.url),'utf8');
 await db.exec(migration);await db.exec(migration);
 await db.exec(`insert into nfl_games(id,week_id,season_id,home_team_id,away_team_id,kickoff_at,status,external_id) values
 ('${id(20)}','${id(8)}','${id(7)}','${id(5)}','${id(6)}',now()+interval '2 hours','scheduled','event-20'),
 ('${id(21)}','${id(8)}','${id(7)}','${id(5)}','${id(6)}',now()+interval '5 days','scheduled','event-21')`);
 const player={...markets[0],game_id:id(20),market_type:'passing_yards',subject_label:'Quarterback',subject_external_id:'qb',operator:'gte',threshold:200,display_text:'QB 200+ yards',external_id:'qb:20',availability_note:'Questionable; selection allowed.'};
 await publish([player,{...markets[0],game_id:id(20),external_id:'team:20'}, {...player,game_id:id(21),external_id:'qb:21'}]);
 const rows=(await db.query('select * from nfl_chain_markets where game_id=any($1::uuid[])',[[id(20),id(21)]])).rows;
 const athlete=rows.find(r=>r.game_id===id(20)&&r.subject_external_id)?.id;
 const team=rows.find(r=>r.game_id===id(20)&&!r.subject_external_id)?.id;
 const nextWeek=rows.find(r=>r.game_id===id(21))?.id;
 const evidence={player_id:'qb',team_id:id(5),team_external_id:'1',status:'out',reported_at:new Date(Date.now()-60_000).toISOString(),return_date:null};
 const cancel=async(checks=[evidence],{event='event-20',kickoff,when,game=20}={})=>{
   const time=kickoff || (await db.query('select kickoff_at from nfl_games where id=$1',[id(game)])).rows[0].kickoff_at;
   return (await db.query('select apply_nfl_chain_availability($1,$2,$3,$4::jsonb,coalesce($5::timestamptz,clock_timestamp())) result',
     [id(game),event,time,JSON.stringify(checks),when||null])).rows[0].result;
 };
 let before;
 await check('availability SQL is rerunnable and stale/review players remain selectable for members',async()=>{
  assert.equal((await db.query('select get_nfl_chain_board($1) b',[id(8)])).rows[0].b.availability_mode,'pick_then_void');
  assert.equal(rows.find(r=>r.id===athlete).availability_status,'review');
  assert.equal(rows.find(r=>r.id===athlete).availability_note,'Questionable; selection allowed.');
  await db.query("update nfl_chain_markets set availability_status='review',availability_checked_at=now()-interval '2 days' where id=$1",[athlete]);
  await actor(3,false);await db.exec('set role authenticated');await save(20,[athlete,team]);await db.exec('reset role');
  before=(await db.query('select * from nfl_chain_legs where market_id=$1',[athlete])).rows[0];
  await save(21,[nextWeek]);
  assert.equal((await db.query('select is_pick_unlocked($1) open',[id(20)])).rows[0].open,false);
  assert.equal((await db.query('select nfl_chain_game_unlocked($1) open',[id(20)])).rows[0].open,true);
 });
 await check('normal users and commissioners cannot submit fabricated automatic cancellations',async()=>{
  await assert.rejects(cancel(),/Server availability/);
  await actor(3,true);await db.exec('set role authenticated');
  await assert.rejects(cancel(),/permission denied/);await db.exec('reset role');
  await actor(3,true,1,'service_role');
 });
 await check('uncertain, conflicting, future, stale and mismatched evidence cannot cancel a pick',async()=>{
  await assert.rejects(cancel([{...evidence,status:'questionable'}]),/Unconfirmed/);
  await assert.rejects(cancel([{...evidence,status:'doubtful'}]),/Unconfirmed/);
  await assert.rejects(cancel([evidence,evidence]),/Conflicting/);
  await assert.rejects(cancel([{...evidence,team_external_id:'99'}]),/mismapped/);
  await assert.rejects(cancel([evidence],{event:'wrong'}),/mismatch/);
  await assert.rejects(cancel([evidence],{kickoff:new Date(Date.now()+3600_000).toISOString()}),/mismatch/);
  await assert.rejects(cancel([evidence],{when:new Date(Date.now()-6*60_000).toISOString()}),/expired/);
  await assert.rejects(cancel([evidence],{when:new Date(Date.now()+60_000).toISOString()}),/future/);
  await assert.rejects(cancel([{...evidence,reported_at:new Date(Date.now()+60_000).toISOString()}]),/Unconfirmed/);
  await assert.rejects(cancel([{...evidence,return_date:'2026-01-01'}]),/Unconfirmed/);
  assert.equal((await cancel([])).picks_cancelled,0);
  assert.equal((await cancel([{...evidence,player_id:'unknown'}])).picks_cancelled,0);
  assert.equal((await db.query('select status from nfl_chain_legs where id=$1',[before.id])).rows[0].status,'pending');
 });
 await check('confirmed absence inside the 30-minute lock voids only the correct game/player without chain penalty',async()=>{
  const chain=(await standing()).current_chain;
  await db.query("update nfl_games set kickoff_at=now()+interval '20 minutes' where id=$1",[id(20)]);
  await actor();await assert.rejects(save(20,[team]),/30 minutes/);await actor(3,true,1,'service_role');
  assert.deepEqual(await cancel(),{cancelled:1,picks_cancelled:1});
  const after=(await db.query('select * from nfl_chain_legs where id=$1',[before.id])).rows[0];
  assert.equal(after.status,'void');assert.equal(after.threshold,before.threshold);assert.equal(after.display_text,before.display_text);
  assert.match(after.void_reason,/out before kickoff.*no chain penalty/);
  assert.equal((await standing()).current_chain,chain);
  assert.equal((await db.query('select status from nfl_chain_legs where market_id=$1',[team])).rows[0].status,'pending');
  assert.equal((await db.query('select status from nfl_chain_legs where market_id=$1',[nextWeek])).rows[0].status,'pending');
  assert.equal((await db.query('select availability_evidence from nfl_chain_markets where id=$1',[athlete])).rows[0].availability_evidence.event_id,'event-20');
 });
 await check('repeated cancellations are idempotent; a final result cannot resurrect a cancelled pick',async()=>{
  assert.deepEqual(await cancel(),{cancelled:0,picks_cancelled:0});
  await db.query("update nfl_games set status='final',kickoff_at=now()-interval '1 minute' where id=$1",[id(20)]);
  await assert.rejects(cancel(),/before kickoff/);
  await db.query('select apply_nfl_chain_game_results($1,$2::jsonb,clock_timestamp())',
    [id(20),JSON.stringify([{id:athlete,actual:300,voided:false},{id:team,actual:1,voided:false}])]);
  assert.equal((await db.query('select status from nfl_chain_legs where id=$1',[before.id])).rows[0].status,'void');
  assert.equal((await db.query('select result_source from nfl_chain_markets where id=$1',[athlete])).rows[0].result_source,'espn-eligibility');
  assert.equal((await standing()).current_chain,5); // Four earlier hits plus the team; cancelled player earns nothing.
 });
 await check('no early-week cancellation or override of a commissioner decision',async()=>{
  await assert.rejects(cancel([evidence],{game:21,event:'event-21'}),/within 24 hours/);
  await actor();await db.query('select settle_nfl_chain_market($1,null,true)',[nextWeek]);
  await db.query("update nfl_games set kickoff_at=now()+interval '1 hour' where id=$1",[id(21)]);
  await actor(3,true,1,'service_role');
  assert.deepEqual(await cancel([evidence],{game:21,event:'event-21'}),{cancelled:0,picks_cancelled:0});
  assert.equal((await db.query('select result_source from nfl_chain_markets where id=$1',[nextWeek])).rows[0].result_source,'commissioner');
 });
 await actor();
}
