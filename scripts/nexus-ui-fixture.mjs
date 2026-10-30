// Shared isolated backend for browser checks. Actual pages, hook, engine and CSS.
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
    import { ARMORY, STARTER_LOADOUT, loadoutError, milestoneCredits } from '/src/lib/nexus/core/progression.ts';
    import { researchCost } from '/src/lib/nexus/core/systems.ts';
    import { endlessCredits } from '/src/lib/nexus/core/economy.ts';
    import { getDifficulty } from '/src/lib/nexus/core/difficulty.ts';
    const initial={credits:0,research:{},campaign:{},challenges:{},best_wave:0,endless_best:0,total_runs:0,total_waves:0,unlocks:[],loadout:STARTER_LOADOUT};
    window.nexusQa={tickets:JSON.parse(sessionStorage.getItem('nexus-qa-tickets')||'{}'),logs:JSON.parse(sessionStorage.getItem('nexus-qa-logs')||'[]'),profile:JSON.parse(sessionStorage.getItem('nexus-qa-profile')||'null')||initial,claims:0,failClaims:sessionStorage.getItem('nexus-qa-fail')==='1',claimed:JSON.parse(sessionStorage.getItem('nexus-qa-claimed')||'{}')};
    const persist=()=>{for(const [key,value] of Object.entries({profile:window.nexusQa.profile,tickets:window.nexusQa.tickets,logs:window.nexusQa.logs,claimed:window.nexusQa.claimed}))sessionStorage.setItem('nexus-qa-'+key,JSON.stringify(value));};
    window.setNexusProfile=(patch)=>{window.nexusQa.profile={...window.nexusQa.profile,...patch};persist();};
    const log=(kind,delta,details)=>{const qa=window.nexusQa;qa.logs.unshift({id:qa.logs.length+1,kind,delta,balance:qa.profile.credits,details,created_at:new Date().toISOString()});};
    export const supabase={rpc:async(name,args)=>{
      if(name==='nexus_core_records')return{data:JSON.parse(sessionStorage.getItem('nexus-qa-records')||'[]'),error:null};
      const qa=window.nexusQa;let data=qa.profile;
      const fail=(message)=>({data:null,error:{message}});
      if(name==='nexus_core_loadout'){
        const error=loadoutError(args.p_loadout,qa.profile.unlocks);if(error)return fail(error);
        qa.profile={...qa.profile,loadout:structuredClone(args.p_loadout)};data=qa.profile;
      }
      if(name==='nexus_core_begin_endless'){
        const error=loadoutError(args.p_loadout,qa.profile.unlocks);if(error)return fail(error);
        const difficulty=getDifficulty(args.p_difficulty??1);if(qa.profile.total_waves<difficulty.waves)return fail('Threat level locked');
        data=qa.tickets[args.p_id]||{id:args.p_id,seed:42,research:structuredClone(qa.profile.research),loadout:structuredClone(args.p_loadout),balance_version:args.p_balance_version??4,difficulty:difficulty.id};
        qa.tickets[args.p_id]=data;qa.profile={...qa.profile,loadout:data.loadout};
      }
      if(name==='nexus_core_unlock'){
        if(qa.failUnlock)return fail('Armory offline');
        const item=ARMORY.find(a=>a.id===args.p_item);if(!item)return fail('Unknown equipment');
        if(!qa.profile.unlocks.includes(item.id)){
          if(qa.profile.total_waves<item.waves||qa.profile.credits<item.cost)return fail('Not enough progress or credits');
          qa.profile={...qa.profile,credits:qa.profile.credits-item.cost,unlocks:[...qa.profile.unlocks,item.id]};log('unlock',-item.cost,{item:item.id});
        }
        data=qa.profile;
      }
      if(name==='nexus_core_research'){
        const track=args.p_track,level=qa.profile.research[track]||0,cost=researchCost(track,level);
        if(qa.profile.credits<cost)return fail('Not enough credits');
        qa.profile={...qa.profile,credits:qa.profile.credits-cost,research:{...qa.profile.research,[track]:level+1}};data=qa.profile;log('research',-cost,{track,level:level+1});
      }
      if(name==='nexus_core_finish_endless'){
        qa.claims++;if(qa.failClaims)return fail('Offline');
        const run=args.p_run;
        if(!qa.claimed[run.id]){
          const waves=Math.floor(endlessCredits(run.cleared)*((run.balanceVersion??4)>=6?getDifficulty(run.difficulty??1).reward:1)),bonus=milestoneCredits(run.cleared,qa.profile.endless_best),reward=waves+bonus,stars=0;
          qa.profile={...qa.profile,credits:qa.profile.credits+reward,total_runs:qa.profile.total_runs+1,total_waves:qa.profile.total_waves+run.cleared,endless_best:Math.max(qa.profile.endless_best,run.cleared)};
          qa.claimed[run.id]={reward,stars,waves,bonus};if(reward)log('run',reward,{scenario:'endless',milestones:bonus});
        }
        data={profile:qa.profile,...qa.claimed[run.id]};
      }
      persist();return{data,error:null};
    },from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:async()=>({data:window.nexusQa.logs,error:null})};return q;}};
  `,
    }),
  );
}
