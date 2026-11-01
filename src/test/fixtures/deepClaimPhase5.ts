import { SOCIAL_CATALOG,resourceSaleValue } from '@/lib/deepClaim/catalog';
import type { DeepClaimClubView,DeepClaimStandingMetric } from '@/lib/deepClaim/types';
export function phaseFiveClubView(options:{metric?:DeepClaimStandingMetric;page?:number;ownRevision?:number}={}):DeepClaimClubView{
 return {version:1,server_now:'2026-11-02T12:00:00Z',club_id:'club-a',user_id:'user-a',own_revision:options.ownRevision??4,catalog:structuredClone(SOCIAL_CATALOG),
  own:{standings_enabled:false,showcase_enabled:false,featured_discovery_ids:[],featured_specimens:[]},metric:options.metric??'weekly_mining_value',week:{starts_at:'2026-11-02T05:00:00Z',ends_at:'2026-11-09T05:00:00Z',timezone:'America/New_York'},standings:[],
  projects:SOCIAL_CATALOG.projects.map((project,index)=>({key:project.key,status:index===0?'open':'locked',goals:{...project.goals},progress:{},own_contribution:{},own_value:0,total_value:resourceSaleValue(project.goals),reward_pool:project.reward_pool,reward_amount:0,qualified:false,claimed_at:null,effective_cap_percent:40,contributors:0,completed_at:null})),
  showcases:{page:options.page??0,total:0,has_more:false,companies:[]}};
}
