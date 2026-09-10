// Verified final-game scoring; missing statistics never become synthetic zeroes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { finalMarketValue, verifyFinalSummary, type FinalGame, type FinalSummary, type StatMarket } from '../_shared/chainFinalStats.ts';
import { readAllNflRows } from '../_shared/nflReadAll.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type,x-cron-secret'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
const deadline=()=>AbortSignal.timeout(15_000);
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response(null,{headers});
  if(req.method!=='POST') return reply({error:'POST required'},405);
  try{
    const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db=createClient(url,key),secret=Deno.env.get('CRON_SHARED_SECRET');
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
    const trusted=token===key || (!!secret && req.headers.get('x-cron-secret')===secret);
    let clubId:string|null=null;
    if(!trusted){
      const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+token}}});
      const {data,error}=await client.auth.getUser();
      if(error || !data.user) return reply({error:'Unauthorized'},401);
      const [club,admin,owner]=await Promise.all([
        client.rpc('current_user_club_id').abortSignal(deadline()),client.rpc('is_app_admin',{_user_id:data.user.id}).abortSignal(deadline()),
        client.rpc('is_platform_owner',{_user:data.user.id}).abortSignal(deadline()),
      ]);
      if(club.error || admin.error || owner.error || !club.data || (!admin.data && !owner.data)) return reply({error:'Club commissioner access required'},403);
      clubId=club.data;
    }
    const {week_id:weekId}=await req.json().catch(()=>({}));
    if(typeof weekId!=='string') return reply({error:'week_id required'},400);
    const [gamesResult,teamsResult,weekResult]=await Promise.all([
      db.from('nfl_games').select('*').eq('week_id',weekId).eq('status','final').abortSignal(deadline()),
      db.from('nfl_teams').select('id,external_id').eq('external_provider','espn').abortSignal(deadline()),
      db.from('nfl_weeks').select('nfl_seasons!inner(year)').eq('id',weekId).abortSignal(deadline()).single(),
    ]);
    for(const result of [gamesResult,teamsResult,weekResult]) if(result.error) throw result.error;
    const teams=new Map<string,string>((teamsResult.data||[]).filter(t=>t.external_id).map(t=>[t.id,t.external_id]));
    const year=(weekResult.data?.nfl_seasons as unknown as {year:number}).year;
    const results:Array<Record<string,unknown>>=[];
    let settled=0,skipped=0;
    const started=Date.now();
    for(const game of (gamesResult.data||[]) as FinalGame[]){
      if(Date.now()-started>85_000) return reply({ok:true,settled,skipped,results,deferred:true});
      let marketQuery=db.from('nfl_chain_markets').select('id,market_type,subject_team_id,subject_external_id,status,result_source,actual_value')
        .eq('game_id',game.id).or('status.eq.open,result_source.eq.espn-final');
      if(clubId) marketQuery=marketQuery.eq('club_id',clubId);
      const {data:markets,error}=await readAllNflRows((from,to)=>marketQuery.order('id').range(from,to).abortSignal(deadline()));
      if(error) throw error;
      if(!markets?.length) continue;
      let summary:FinalSummary|null=null;
      try{
        const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event='+encodeURIComponent(game.external_id||''),{signal:deadline()});
        if(response.ok){
          const candidate=await response.json();
          if(verifyFinalSummary(candidate,game,teams,year)) summary=candidate;
        }
      }catch{ /* team results still use verified stored final scores */ }
      const values=[];
      for(const market of markets as StatMarket[]){
        const value=finalMarketValue(market,game,summary,teams);
        if('pending' in value){skipped++;results.push({market_id:market.id,status:'pending',reason:value.pending});}
        else values.push({id:market.id,actual:value.actual,voided:value.voided});
      }
      for(let start=0;start<values.length;start+=500){
        const applied=await db.rpc('apply_nfl_chain_game_results',{_game_id:game.id,_results:values.slice(start,start+500),_checked_at:new Date().toISOString()})
          .abortSignal(AbortSignal.timeout(30_000));
        if(applied.error) {results.push({game_id:game.id,error:applied.error.message});continue;}
        settled+=applied.data?.changed||0;
        results.push({game_id:game.id,...applied.data});
      }
    }
    return reply({ok:!results.some(r=>r.error),week_id:weekId,settled,skipped,results});
  }catch(error){console.error('NFL chain scoring failed',error);return reply({error:'Scoring could not complete. Check function logs and retry.'},500);}
});
