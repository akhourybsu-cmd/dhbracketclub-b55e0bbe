// Lightweight five-minute results job, separate from reminders/roster publishing.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
Deno.serve(async req=>{
  const secret=Deno.env.get('CRON_SHARED_SECRET');
  if(req.method!=='POST' || !secret || req.headers.get('x-cron-secret')!==secret) return new Response('Unauthorized',{status:401});
  const headers={'Content-Type':'application/json'};
  try{
    const url=Deno.env.get('SUPABASE_URL')!;
    const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Dates, not current_week, include overtime and late statistics across rollover.
    const {data,error}=await db.from('nfl_games').select('week_id,nfl_weeks!inner(week_number,nfl_seasons!inner(year))')
      .gte('kickoff_at',new Date(Date.now()-7*86400_000).toISOString())
      .lte('kickoff_at',new Date(Date.now()+30*60_000).toISOString()).order('kickoff_at',{ascending:false})
      .abortSignal(AbortSignal.timeout(15_000));
    if(error) throw error;
    const weeks=new Map((data||[]).map(row=>[row.week_id,row.nfl_weeks as unknown as {week_number:number;nfl_seasons:{year:number}}]));
    const results:Array<Record<string,unknown>>=[];
    // Normally one or two weeks. Bound total work without running roster imports.
    await Promise.all([...weeks.entries()].slice(0,3).map(async([weekId,week])=>{
      try{
        const response=await fetch(url+'/functions/v1/sync-nfl-week',{
          method:'POST',headers:{...headers,'x-cron-secret':secret},signal:AbortSignal.timeout(120_000),
          body:JSON.stringify({season_year:week.nfl_seasons.year,week_number:week.week_number,seasontype:2}),
        });
        const result=await response.json();
        results.push({week_id:weekId,http_status:response.status,...result,
          ok:response.ok && result?.ok===true && result?.scored?.crazy_chain?.ok!==false});
      }catch{results.push({week_id:weekId,ok:false,error:'Results refresh did not complete; next tick will retry.'});}
    }));
    const ok=results.every(r=>r.ok===true && !r.error);
    if(!ok) console.error('NFL live refresh incomplete',results.filter(r=>r.ok!==true).map(r=>({week_id:r.week_id,http_status:r.http_status,error:r.error})));
    return new Response(JSON.stringify({ok,results,deferred:weeks.size>3}),{status:ok?200:502,headers});
  }catch(error){console.error('NFL live sync failed',error);return new Response(JSON.stringify({ok:false,error:'Live sync failed; check function logs.'}),{status:500,headers});}
});
