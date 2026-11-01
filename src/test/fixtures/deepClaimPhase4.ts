import { ALL_EQUIPMENT_CATALOG, ALL_RECIPE_CATALOG, BUILDING_UPGRADE_COSTS, BUSINESS_CATALOG } from '@/lib/deepClaim/catalog';
import { DEEP_CLAIM_BUSINESS_METRICS, type DeepClaimBusinessStats, type DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseThreeSnapshot } from './deepClaimPhase3';
export function phaseFourSnapshot(revision=4):DeepClaimSnapshot{
 const snapshot=phaseThreeSnapshot(revision);snapshot.schema_version=4;
 snapshot.buildings.push({key:'research_office',level:0,max_level:2,upgrade_cost:BUILDING_UPGRADE_COSTS.research_office[0],effect:'Build to develop company methods.'},{key:'trading_post',level:0,max_level:3,upgrade_cost:BUILDING_UPGRADE_COSTS.trading_post[0],effect:'Build to fulfill delivery orders.'});
 snapshot.business_catalog=structuredClone(BUSINESS_CATALOG);snapshot.business={research:[],contracts:BUSINESS_CATALOG.contracts.map(contract=>({key:contract.key,status:'offered',completed_at:null})),milestones:BUSINESS_CATALOG.milestones.map(milestone=>({key:milestone.key,progress:0,claimed_at:null})),stats:Object.fromEntries(DEEP_CLAIM_BUSINESS_METRICS.map(metric=>[metric,0])) as DeepClaimBusinessStats,research_bonuses:{},processing_speed_percent:0};
 snapshot.equipment_catalog=structuredClone(ALL_EQUIPMENT_CATALOG);snapshot.recipes=structuredClone(ALL_RECIPE_CATALOG).map(recipe=>({...recipe,required_research:recipe.required_research??[],research_speed_percent:0,locked:(recipe.required_research??[]).length>0}));
 return snapshot;
}
