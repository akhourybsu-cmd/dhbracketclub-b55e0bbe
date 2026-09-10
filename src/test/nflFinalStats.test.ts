import {describe,it,expect} from 'vitest';
import {finalMarketValue,verifyFinalSummary,parseNflScore,type FinalGame,type FinalSummary,type StatMarket} from '../../supabase/functions/_shared/chainFinalStats';
import {chainGameIsOpen,chainGameLockAt} from '../../supabase/functions/_shared/chainGameRules';
import {readAllNflRows} from '../../supabase/functions/_shared/nflReadAll';
const game:FinalGame={id:'g',external_id:'123',external_provider:'espn',status:'final',home_team_id:'h',away_team_id:'a',home_score:24,away_score:17};
const teams=new Map([['h','1'],['a','2']]);
const market:StatMarket={id:'m',market_type:'passing_yards',subject_team_id:'h',subject_external_id:'qb'};
const summary:FinalSummary={header:{id:'123',season:{year:2026,type:2},competitions:[{status:{type:{completed:true,state:'post'}},
 competitors:[{homeAway:'home',team:{id:'1'},score:'24'},{homeAway:'away',team:{id:'2'},score:'17'}]}]},
 boxscore:{players:[{team:{id:'1'},statistics:[{name:'passing',keys:['passingTouchdowns','passingYards'],athletes:[{athlete:{id:'qb'},stats:['0','241']}]}]}]}};
describe('Verified final NFL statistics',()=>{
 it('accepts real score zero but rejects missing or malformed scoreboard scores',()=>{
  for(const value of ['', ' ', null, undefined, NaN, Infinity, '-1', '2.5', '14 points']) expect(parseNflScore(value)).toBeNull();
  expect(parseNflScore('0')).toBe(0);
  expect(parseNflScore(' 24 ')).toBe(24);
 });
 it('validates event, season, teams, scores and final status before using player data',()=>{
  expect(verifyFinalSummary(summary,game,teams,2026)).toBe(true);
  expect(verifyFinalSummary(summary,{...game,external_id:'other'},teams,2026)).toBe(false);
  expect(verifyFinalSummary(summary,game,teams,2025)).toBe(false);
  expect(verifyFinalSummary(summary,{...game,status:'live'},teams,2026)).toBe(false);
  expect(verifyFinalSummary(summary,{...game,home_score:0},teams,2026)).toBe(false);
  expect(verifyFinalSummary(summary,game,new Map(),2026)).toBe(false);
 });
 it('uses named statistic keys, never a hard-coded column position',()=>{
  expect(finalMarketValue(market,game,summary,teams)).toEqual({actual:241,voided:false});
  expect(finalMarketValue({...market,market_type:'passing_touchdowns'},game,summary,teams)).toEqual({actual:0,voided:false});
 });
 it('keeps missing players, missing categories, and missing identities pending',()=>{
  for(const change of [{subject_external_id:'absent'},{subject_external_id:null},{market_type:'receiving_yards'}])
    expect(finalMarketValue({...market,...change},game,summary,teams)).toHaveProperty('pending');
  expect(finalMarketValue(market,game,null,teams)).toHaveProperty('pending');
 });
 it('does not coerce empty strings, dashes, null, malformed totals or NaN into zero',()=>{
  for(const value of ['', '—',null,undefined,'20 yards','1/2',NaN,Infinity]){
    const data=structuredClone(summary);data.boxscore!.players![0].statistics![0].athletes![0].stats![1]=value;
    expect(finalMarketValue(market,game,data,teams)).toHaveProperty('pending');
  }
 });
 it('voids only an explicit DNP row; allows legitimate negative yardage',()=>{
  const data=structuredClone(summary);const row=data.boxscore!.players![0].statistics![0].athletes![0];
  row.stats![1]='-4';expect(finalMarketValue(market,game,data,teams)).toEqual({actual:-4,voided:false});
  row.didNotPlay=true;expect(finalMarketValue(market,game,data,teams)).toEqual({actual:null,voided:true});
 });
 it('grades team totals and ties from complete scores, not a missing winner field',()=>{
  expect(finalMarketValue({...market,market_type:'team_win'},game,null,teams)).toEqual({actual:1,voided:false});
  expect(finalMarketValue({...market,market_type:'team_win'},{...game,away_score:24},null,teams)).toEqual({actual:0,voided:false});
  expect(finalMarketValue({...market,market_type:'team_points'},{...game,home_score:null},null,teams)).toHaveProperty('pending');
  expect(finalMarketValue({...market,market_type:'team_points',subject_team_id:'other'},game,null,teams)).toHaveProperty('pending');
 });
 it('keeps unsupported stats and in-progress games pending',()=>{
  expect(finalMarketValue({...market,market_type:'anytime_touchdown'},game,summary,teams)).toHaveProperty('pending');
  expect(finalMarketValue(market,{...game,status:'live'},summary,teams)).toHaveProperty('pending');
 });
});
describe('48-hour NFL deadlines',()=>{
 it('reads beyond the first page instead of dropping later season results',async()=>{
  const rows=Array.from({length:1250},(_,id)=>({id}));
  const result=await readAllNflRows(async(from,to)=>({data:rows.slice(from,to+1),error:null}));
  expect(result.data).toEqual(rows);
  await expect(readAllNflRows(async()=>({data:null,error:{message:'Provider unavailable'}}))).rejects.toThrow('Provider unavailable');
 });
 it('uses absolute hours across daylight-saving boundaries',()=>{
  const g={kickoff_at:'2026-11-01T18:00:00Z',status:'scheduled'};
  expect(new Date(chainGameLockAt(g)).toISOString()).toBe('2026-10-30T18:00:00.000Z');
  expect(chainGameIsOpen(g,chainGameLockAt(g)-1)).toBe(true);
  expect(chainGameIsOpen(g,chainGameLockAt(g))).toBe(false);
 });
 it('fails closed for invalid dates and respects a frozen earlier deadline',()=>{
  expect(chainGameIsOpen({kickoff_at:'bad',status:'scheduled'})).toBe(false);
  expect(chainGameIsOpen({kickoff_at:'2026-10-01T18:00:00Z',chain_lock_at:'2026-09-01T18:00:00Z',status:'scheduled'},Date.parse('2026-09-02'))).toBe(false);
 });
});
