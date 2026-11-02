import { DEEP_CATALOG,DEEP_EQUIPMENT_CATALOG,DEEP_RECIPE_CATALOG } from '@/lib/deepClaim/catalog';
import type {DeepClaimSnapshot} from '@/lib/deepClaim/types';
import {phaseFourSnapshot} from './deepClaimPhase4';
/** Current public schema, no invented late-game achievements or hidden geology. */
export function phaseSevenSnapshot(revision=7):DeepClaimSnapshot{
 const snapshot=phaseFourSnapshot(revision);snapshot.schema_version=5;snapshot.deep_catalog=structuredClone(DEEP_CATALOG);snapshot.deep_operations={infrastructure_capacity:128,lift_discount_percent:0};
 snapshot.buildings=snapshot.buildings.map(building=>({...building,max_level:building.key==='mine_shaft'?6:building.max_level}));
 snapshot.equipment_catalog=structuredClone(DEEP_EQUIPMENT_CATALOG);snapshot.recipes=structuredClone(DEEP_RECIPE_CATALOG).map(recipe=>({...recipe,required_research:recipe.required_research??[],research_speed_percent:0,locked:(recipe.required_research??[]).length>0}));
 return snapshot;
}
