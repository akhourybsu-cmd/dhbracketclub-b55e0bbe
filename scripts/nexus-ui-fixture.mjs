// Shared in-memory account/backend for local Nexus browser checks.
export async function installNexusFixture(page) {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.route("**/src/contexts/AuthContext.tsx*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'export const useAuth=()=>({user:{id:"member"}});',
    }),
  );
  await page.route("**/src/contexts/ClubContext.tsx*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'export const useClub=()=>({club:{id:"club",name:"Dry My Horse"}});',
    }),
  );
  await page.route("**/src/integrations/supabase/client.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
    const initial={credits:180,research:{},campaign:{},challenges:{},best_wave:0,total_runs:0};
    window.nexusQa={tickets:JSON.parse(sessionStorage.getItem('nexus-qa-tickets')||'{}'),logs:JSON.parse(sessionStorage.getItem('nexus-qa-logs')||'[]'),profile:JSON.parse(sessionStorage.getItem('nexus-qa-profile')||'null')||initial,claims:0,failClaims:sessionStorage.getItem('nexus-qa-fail')==='1',claimed:new Map()};
    const persist=()=>{sessionStorage.setItem('nexus-qa-profile',JSON.stringify(window.nexusQa.profile));sessionStorage.setItem('nexus-qa-tickets',JSON.stringify(window.nexusQa.tickets));sessionStorage.setItem('nexus-qa-logs',JSON.stringify(window.nexusQa.logs));};
    export const supabase={rpc:async(name,args)=>{
      if(name==='nexus_core_records')return{data:[],error:null};
      const qa=window.nexusQa; let data=qa.profile;
      if(name==='nexus_core_begin'){data=qa.tickets[args.p_id]||{id:args.p_id,seed:42,research:structuredClone(qa.profile.research)};qa.tickets[args.p_id]=data;}
      if(name==='nexus_core_research'){
        const track=args.p_track,level=qa.profile.research[track]||0,base={weapons:35,reactor:40,plating:30,barrier:30,salvage:35,nova:40}[track],cost=Math.round(base*1.35**level);
        if(qa.profile.credits<cost)return{data:null,error:{message:'Not enough credits'}};
        qa.profile={...qa.profile,credits:qa.profile.credits-cost,research:{...qa.profile.research,[track]:level+1}};data=qa.profile;qa.logs.unshift({id:qa.logs.length+1,kind:'research',delta:-cost,balance:qa.profile.credits,details:{track,level:level+1},created_at:new Date().toISOString()});
      }
      if(name==='nexus_core_finish'){
        qa.claims++;
        if(qa.failClaims)return{data:null,error:{message:'Offline'}};
        const run=args.p_run;
        if(!qa.claimed.has(run.id)){
          const waves=20,bonus=qa.profile.campaign[run.scenarioId]?0:70,reward=waves+bonus,stars=3;
          qa.profile={...qa.profile,credits:qa.profile.credits+reward,total_runs:qa.profile.total_runs+1,campaign:{...qa.profile.campaign,[run.scenarioId]:stars}};
          qa.claimed.set(run.id,{reward,stars,waves,bonus});qa.logs.unshift({id:qa.logs.length+1,kind:'run',delta:reward,balance:qa.profile.credits,details:{scenario:run.scenarioId,first_clear:bonus},created_at:new Date().toISOString()});
        }
        data={profile:qa.profile,...qa.claimed.get(run.id)};
      }
      persist();return{data,error:null};
    },from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:async()=>({data:window.nexusQa.logs,error:null})};return q;}};
  `,
    }),
  );
}
