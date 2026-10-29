// Isolated source data and peripheral hooks. Production Dashboard orchestration,
// Home queries, shared shell, progression, composer and dialogs remain real.
export async function installHomeFixture(page) {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.addInitScript(() => {
    const scenario =
      new URLSearchParams(location.search).get("scenario") || "full";
    const slugs =
      scenario === "empty"
        ? []
        : scenario === "limited"
          ? ["chat", "events"]
          : [
              "chat",
              "draft-arena",
              "daily-find",
              "nexus-defense",
              "portfolio-wars",
              "workout-competition",
              "events",
              "feed",
              "posts",
              "rune-delve",
            ];
    window.homeQa = {
      scenario,
      queries: [],
      rpcs: [],
      writes: [],
      widgetsMounted: 0,
      failTables: [],
      failProgress: false,
      assets: slugs.map((slug, index) => ({
        id: slug,
        sort_order: index,
        enabled: true,
        visible_to_members: true,
        asset: { id: slug, slug, name: slug },
      })),
    };
  });
  const stub = (path, body) =>
    page.route("**/" + path + "*", (route) =>
      route.fulfill({ contentType: "text/javascript", body }),
    );
  await stub(
    "src/contexts/AuthContext.tsx",
    `const user={id:'member',user_metadata:{display_name:'Alex'}};export const useAuth=()=>({user,signOut:async()=>{}});`,
  );
  await stub(
    "src/contexts/ClubContext.tsx",
    `const club={id:'club',name:'Dry My Horse',accent_color:'152 72% 46%'};export const useClub=()=>({club,isClubAdmin:false,isAppAdmin:false,isPlatformOwner:false});`,
  );
  await stub(
    "src/hooks/useClubAssets.ts",
    `import {NAV_ASSET_SLUGS} from '/src/types/assets.ts';const assets=window.homeQa.assets;const has=slug=>assets.some(a=>a.asset.slug===slug);const paths=list=>list.filter(p=>!NAV_ASSET_SLUGS[p]||has(NAV_ASSET_SLUGS[p]));export const useClubAssets=()=>({installedAssets:assets,allAssets:[],loading:false,isInstalled:has,isVisible:has,filterNavPaths:paths});`,
  );
  await stub(
    "src/hooks/usePwaInstall.ts",
    `export const usePwaInstall=()=>({canInstall:false,install:async()=>{}});`,
  );
  await stub(
    "src/hooks/useDraftSeasons.ts",
    `export const useCurrentSeason=()=>({season:null});export const useSeasonStandings=()=>({standings:[]});export const useSeasonEntries=()=>({entries:[]});export const getSeasonDraftTarget=()=>0;export const formatSeasonTitle=()=>'';`,
  );
  await stub(
    "src/hooks/useRealtimeSubscription.ts",
    `export const useActivityFeedUpdates=()=>{};export const useDraftListUpdates=()=>{};`,
  );
  await stub(
    "src/hooks/useNarrativeCampaigns.ts",
    `export const useNarrativeCampaigns=()=>({campaigns:[]});`,
  );
  await stub(
    "src/hooks/useCelebrations.ts",
    `export const useTodayCelebrations=()=>({today:[]});export const useUpcomingCelebrations=()=>({upcoming:[]});export const useCelebrationSettings=()=>({settings:{show_on_home:true}});`,
  );
  await stub(
    "src/hooks/useUnreadChannels.ts",
    `export const useUnreadChannels=()=>({unreadChannels:[]});`,
  );
  await stub(
    "src/hooks/useOnboarding.ts",
    `export const useClubOnboarding=()=>({needsFirstTime:false});export const useNewFeatures=()=>({newFeatures:[]});`,
  );
  await stub(
    "src/components/home/HomeWidgetHub.tsx",
    `export const HomeWidgetHub=()=>{window.homeQa.widgetsMounted++;return 'Your app details';};`,
  );
  await stub(
    "src/components/home/MembersOnline.tsx",
    `export const MembersOnline=()=>null;`,
  );
  await stub(
    "src/components/onboarding/ClubOnboardingFlow.tsx",
    `export const ClubOnboardingFlow=()=>null;`,
  );
  await stub(
    "src/integrations/supabase/client.ts",
    `
    import {createNotificationBackend,notificationRow} from '/src/test/fixtures/notificationBackend.ts';
    import catalog from '/src/lib/feats/catalog.json?import';
    const qa=window.homeQa,now=Date.now(),date=new Date(now).toISOString();
    const inbox=createNotificationBackend([notificationRow(1),notificationRow(2),notificationRow(3)]);
    const goal={key:'drop_posts',title:'Make the Drop',category:'drop',unit:'count',value:19,target:20,tier:3,points:40,progress:14/15,tracked:true};
    const progress=qa.scenario==='empty'?{score:0,unlocked:0,club_rank:1,goals:[]}:{score:1240,unlocked:34,club_rank:2,goals:[goal,{...goal,key:'active_days',category:'club',title:'Club Regular',value:5,target:7,tier:2,progress:4/6,tracked:false}]};
    const drops=[{id:'drop',club_id:'club',user_id:'jordan',title:'Saturday plans, sorted.',note:'A great read to get the weekend going.',url:'https://example.com/read',find_date:date.slice(0,10),kind:'article',image_path:null,tags:[],reactions:[],comments:[],created_at:date,updated_at:date,profiles:{id:'jordan',display_name:'Jordan',avatar_url:null}}];
    function data(table,filters,single){
      if(table==='profiles')return {display_name:'Alex',avatar_url:null};
      if(table==='drafts')return qa.scenario==='resume'?[]:[{id:'draft',topic:'All-time movie villains',status:'in_progress',num_rounds:5,current_pick_user_id:'stale',current_pick_number:1,current_round:1}];
      if(table==='draft_participants')return [{draft_id:'draft',user_id:'member',pick_order:1},{draft_id:'draft',user_id:'sam',pick_order:2}];
      if(table==='draft_picks')return [];
      if(table==='activity_feed')return [{id:'post-update',event_type:'post_created',target_type:'post',target_id:'post',created_at:date,profiles:{display_name:'Morgan'},metadata:{title:'Thursday night football: who are we taking?'}}];
      if(table==='events')return [{id:'event',title:'Sunday watch party',starts_at:new Date(now+3*86400000).toISOString()}];
      if(table==='daily_finds')return single?drops[0]:drops;
      if(table==='daily_find_comments')return [];
      if(table==='pw_portfolios')return {id:'portfolio',total_value:58250,valued_at:new Date(now-1800000).toISOString(),season:{starting_cash:50000,status:'active'}};
      if(table==='pw_daily_values')return [58250,57400,55100,54300,50900,51500,50000].map((value,n)=>({value,trading_date:'2026-10-'+(29-n)}));
      if(table==='nexus_core_profiles')return {endless_best:18};
      if(table==='workout_log_sessions')return {id:'session',title:'Push day'};
      if(['channels','messages','channel_read_states'].includes(table))return [];
      throw new Error('Unexpected source '+table);
    }
    function from(table){
      if(table==='notifications')return inbox.from(table);
      const filters=[],request={table,filters};qa.queries.push(request);let single=false;
      const builder={select:columns=>{request.columns=columns;return builder;},eq:(key,value)=>{filters.push({key,value});return builder;},in:()=>builder,gte:()=>builder,lte:()=>builder,order:()=>builder,limit:()=>builder,abortSignal:()=>builder,is:()=>builder,contains:()=>builder,or:()=>builder,
        maybeSingle:()=>{single=true;return builder;},single:()=>{single=true;return builder;},
        insert:()=>{qa.writes.push(table);throw new Error('Unexpected write');},update:()=>{qa.writes.push(table);throw new Error('Unexpected write');},delete:()=>{qa.writes.push(table);throw new Error('Unexpected write');},
        then:(resolve,reject)=>Promise.resolve(qa.failTables.includes(table)?{data:null,error:{message:'Fixture source failed'}}:{data:data(table,filters,single),error:null,count:0}).then(resolve,reject)};
      return builder;
    }
    export const supabase={from,channel:inbox.channel,removeChannel:inbox.removeChannel,rpc:async(name,args)=>{
      qa.rpcs.push({name,args});
      if(name==='dh_home_progress')return qa.failProgress?{data:null,error:{message:'Progress offline'}}:{data:progress,error:null};
      if(name==='dh_feats_summary')return {data:{score:progress.score,unlocked:progress.unlocked},error:null};
      if(name==='dh_feats_board')return {data:{version:1,as_of:date,seen_at:date,pinned:['drop_posts'],score:1240,unlocked:34,catalog,progress:{drop_posts:19},unlocks:[{feat_key:'drop_posts',tier:1,points:10,target:1,earned_at:date,historical:true},{feat_key:'drop_posts',tier:2,points:20,target:5,earned_at:date,historical:true}],leaders:[],monthly_leaders:[],me:null,monthly_me:null,members:4},error:null};
      return {data:null,error:{message:'Unexpected RPC '+name}};
    }};
  `,
  );
}
