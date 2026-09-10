import { describe, expect, it } from 'vitest';
import { collectConfirmedAbsences, confirmedAbsenceStatus, type EligibilitySummary } from '../../supabase/functions/_shared/chainEligibility';
import type { BoardGame, BoardTeam } from '../../supabase/functions/_shared/chainBoardData';

const now = Date.parse('2026-09-10T20:00:00Z');
const game: BoardGame = { id:'game',week_id:'week',season_id:'season',external_id:'100',external_provider:'espn',
  kickoff_at:'2026-09-11T00:15:00Z',status:'scheduled',home_team_id:'home',away_team_id:'away' };
const teams: BoardTeam[] = ['home','away'].map((id,i)=>({id,external_id:String(i+1),external_provider:'espn',city:id,name:id}));
const report = (status = 'Out'): EligibilitySummary => ({
  header:{id:'100',season:{year:2026,type:2},competitions:[{id:'100',date:game.kickoff_at,
    competitors:[{homeAway:'home',team:{id:'1'}},{homeAway:'away',team:{id:'2'}}],status:{type:{state:'pre',completed:false}}}]},
  injuries:[{team:{id:'1'},injuries:[{status,date:'2026-09-10T19:00:00Z',athlete:{id:'qb'},details:{returnDate:'2026-09-18'}}]}],
});
const collect=(summary=report(),g=game,t=teams,at=now)=>collectConfirmedAbsences(summary,g,t,2026,at);

describe('Confirmed pregame eligibility',()=>{
  it('matches the exact player, team, event, season and kickoff for an Out report',()=>{
    expect(collect()).toEqual([{player_id:'qb',team_id:'home',team_external_id:'1',status:'out',reported_at:'2026-09-10T19:00:00.000Z',return_date:'2026-09-18'}]);
  });
  it.each(['Out','Injured Reserve','Suspended','Inactive','PUP','NFI'])('recognizes an explicit %s status',status=>{
    expect(collect(report(status))).toHaveLength(1);
  });
  it.each(['Questionable','Doubtful','Probable','Active','Day-To-Day','Not out',''])('does not cancel an uncertain or unrecognized %s status',status=>{
    expect(collect(report(status))).toEqual([]);
  });
  it('never treats a missing athlete/injury/team row as an absence',()=>{
    const summary=report();delete summary.injuries;expect(collect(summary)).toEqual([]);
    summary.injuries=[{team:{id:'99'},injuries:report().injuries![0].injuries}];expect(collect(summary)).toEqual([]);
    summary.injuries=report().injuries;delete summary.injuries![0].injuries![0].athlete;expect(collect(summary)).toEqual([]);
  });
  it('rejects a stale schedule, different event/season, or wrong team identity',()=>{
    expect(()=>collect(report(),{...game,external_id:'other'})).toThrow('event');
    expect(()=>collect(report(),{...game,kickoff_at:'2026-09-11T01:15:00Z'})).toThrow('kickoff');
    expect(()=>collect(report(),game,[{...teams[0],external_id:'99'},teams[1]])).toThrow('team');
    const summary=report();summary.header!.season!.year=2025;expect(()=>collect(summary)).toThrow('season');
  });
  it('keeps checking inside the 30-minute lock, but never at/after kickoff or next week',()=>{
    expect(collect(report(),game,teams,Date.parse(game.kickoff_at)-1)).toHaveLength(1);
    expect(()=>collect(report(),game,teams,Date.parse(game.kickoff_at))).toThrow('before kickoff');
    expect(()=>collect(report(),game,teams,now-86400_000)).toThrow('24 hours');
    const summary=report();summary.header!.competitions![0].status!.type!.state='in';expect(()=>collect(summary)).toThrow('scheduled');
  });
  it('ignores missing, future and previous-season report dates',()=>{
    for(const date of [undefined,'invalid','2026-09-12T19:00:00Z','2025-09-10T19:00:00Z']) {
      const summary=report();summary.injuries![0].injuries![0].date=date;expect(collect(summary)).toEqual([]);
    }
  });
  it('leaves earlier expected returns and conflicting duplicate reports for review',()=>{
    const summary=report();summary.injuries![0].injuries![0].details!.returnDate='2026-09-10';expect(collect(summary)).toEqual([]);
    summary.injuries=report().injuries;summary.injuries![0].injuries!.push({...summary.injuries![0].injuries![0],status:'Questionable'});
    expect(collect(summary)).toEqual([]);
    expect(confirmedAbsenceStatus({status:'Out',type:{name:'INJURY_STATUS_QUESTIONABLE'}})).toBeNull();
  });
});
