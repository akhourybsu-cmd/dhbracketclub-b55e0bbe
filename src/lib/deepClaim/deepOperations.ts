/** Version7 public explanation/headless math. The server alone validates routes, freezes plans and grants results. */
import { DEEP_CATALOG,EQUIPMENT_BY_KEY,hasDeepOperations } from './catalog';
import { applicableInfrastructure,fieldConditions } from './field';
import { calculateCrewPlan,calculateMiningCapacity,routeEdges,type DeepClaimCrewPlan } from './simulation';
import type {DeepClaimDeepModifiers,DeepClaimEquipment,DeepClaimMode,DeepClaimPoint,DeepClaimTile,DeepClaimSnapshot,DeepClaimWorker,DeepClaimInfrastructure,DeepClaimDuration,DeepClaimMineralId} from './types';
function whole(value:number,min=0,max=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error('Invalid Ancient Deep input.');return value;}
export function deepOperationsState(snapshot:DeepClaimSnapshot){return hasDeepOperations(snapshot)?snapshot.deep_operations!:null;}
export function poweredLiftEdges(tiles:readonly DeepClaimTile[],shaftLevel:number,completedResearch:readonly string[]):ReadonlySet<number>{
 const edges=new Set<number>(),maximum=DEEP_CATALOG.shaft.corridor_depth;
 if(shaftLevel<6||DEEP_CATALOG.shaft.required_research.some(key=>!completedResearch.includes(key)))return edges;
 const known=new Set(tiles.filter(tile=>tile.x===48&&tile.y>=0&&tile.y<=maximum&&tile.terrain==='excavated'&&tile.remaining===0).map(tile=>tile.y));
 // Every owned shaft has its fixed surface landing, but the public world
 // intentionally projects y>=1. Infer only that entrance, never underground
 // cells; an explicitly contradictory landing is not replaced.
 if(!tiles.some(tile=>tile.x===48&&tile.y===0))known.add(0);
 for(let y=0;y<maximum;y++)if(known.has(y)&&known.has(y+1))edges.add(y);return edges;
}
export function liftTravelDiscount(route:readonly DeepClaimPoint[],tiles:readonly DeepClaimTile[],shaftLevel:number,completedResearch:readonly string[]):{eligible_length:number;total_length:number;discount_percent:number}{
 const total_length=routeEdges(route);whole(total_length);const maximum=DEEP_CATALOG.shaft.corridor_depth,edges=poweredLiftEdges(tiles,shaftLevel,completedResearch);
 const prefix=[0];for(let y=0;y<maximum;y++)prefix.push(prefix[y]+Number(edges.has(y)));
 let eligible_length=0;for(let index=1;index<route.length;index++){const a=route[index-1],b=route[index];if(a.x!==48||b.x!==48)continue;const lo=Math.max(0,Math.min(a.y,b.y)),hi=Math.min(maximum,Math.max(a.y,b.y));whole(lo);whole(hi);if(hi>lo)eligible_length+=prefix[hi]-prefix[lo];}
 return {eligible_length,total_length,discount_percent:total_length?Math.floor(DEEP_CATALOG.shaft.lift_discount_percent*eligible_length/total_length):0};
}
export function applyLiftTravel(forward:number,back:number,liftPercent:number,railPercent:number):{travel:number;return:number}{
 whole(forward);whole(back);whole(liftPercent,0,75);whole(railPercent,0,40);
 const apply=(seconds:number)=>Math.max(20,Math.ceil(Math.ceil(seconds*(100-liftPercent)/100)*(100-railPercent)/100));
 return {travel:apply(forward),return:apply(back)};
}
export function crewThermalReduction(workerIds:readonly string[],equipment:readonly DeepClaimEquipment[]):number{
 if(!workerIds.length||workerIds.length>3||new Set(workerIds).size!==workerIds.length)throw new Error('Choose a valid heat-protected crew.');
 const sum=equipment.reduce((total,item)=>total+(item.worker_id!==null&&workerIds.includes(item.worker_id)&&item.durability>0?(EQUIPMENT_BY_KEY[item.definition_key]?.thermal_reduction_percent??0):0),0);
 return Math.min(DEEP_CATALOG.thermal.gear_reduction_cap,Math.floor(sum/workerIds.length));
}
export function calculateDeepModifiers(input:{mode:DeepClaimMode;depth:number;raw_work_seconds:number;engineering:number;ventilation_strength:number;gear_reduction_percent:number;lift_discount_percent:number;tutorial?:boolean}):DeepClaimDeepModifiers{
 const raw=whole(input.raw_work_seconds),engineering=whole(input.engineering,1,100),vent=whole(input.ventilation_strength,0,13),gear=whole(input.gear_reduction_percent,0,15),lift=whole(input.lift_discount_percent,0,75),thermal=DEEP_CATALOG.thermal;
 const applies=!input.tutorial&&input.depth>=thermal.min_depth&&(input.mode==='extract'||input.mode==='explore');whole(input.depth);
 const load=applies?Math.min(thermal.cap_percent,thermal.base_percent+thermal.step_percent*Math.floor((input.depth-thermal.min_depth)/thermal.step_depth)):0;
 const engineeringReduction=applies?Math.floor(engineering/thermal.engineering_divisor):0,ventilationReduction=applies?vent*thermal.ventilation_multiplier:0,gearReduction=applies?gear:0;
 const penalty=Math.max(0,load-engineeringReduction-ventilationReduction-gearReduction);
 return {lift_discount_percent:input.tutorial?0:lift,thermal_load_percent:load,engineering_mitigation_percent:engineeringReduction,ventilation_mitigation_percent:ventilationReduction,gear_mitigation_percent:gearReduction,heat_penalty_percent:penalty,raw_work_seconds:raw,effective_work_seconds:Math.floor(raw*(100-penalty)/100)};
}
export function heatAdjustedExploreQuota(rawQuota:number,penaltyPercent:number):number{whole(rawQuota);whole(penaltyPercent,0,40);return rawQuota?Math.max(1,Math.floor(rawQuota*(100-penaltyPercent)/100)):0;}
export interface DeepClaimDeepCrewPlanInput {
 workers:readonly DeepClaimWorker[];mode:DeepClaimMode;duration_minutes:DeepClaimDuration;route:readonly DeepClaimPoint[];tiles:readonly DeepClaimTile[];
 shaft_level:number;completed_research:readonly string[];equipment:readonly DeepClaimEquipment[];infrastructure:readonly DeepClaimInfrastructure[];
 tool_level:number;material?:DeepClaimMineralId;remaining?:number;tutorial?:boolean;
}
/** Legacy/shallow coefficients remain exact; heat changes useful work, never elapsed stage clocks. */
export function calculateDeepCrewPlan(input:DeepClaimDeepCrewPlanInput):DeepClaimCrewPlan&{deep_modifiers:DeepClaimDeepModifiers}{
 const target=input.route.at(-1);if(!target)throw new Error('Choose a connected route.');
 const base=calculateCrewPlan({...input,path_edges:routeEdges(input.route),target_depth:target.y,transport_bonus_percent:0});
 const conditions=fieldConditions({depth:target.y,safety:base.averages.safety,energy:base.energy_per_worker,target,route:input.route,infrastructure:input.infrastructure,tutorial:input.tutorial});
 const lift=liftTravelDiscount(input.route,input.tiles,input.shaft_level,input.completed_research);
 const travel=input.tutorial?{travel:base.stages[0].duration_seconds,return:base.stages[4].duration_seconds}:applyLiftTravel(base.stages[0].duration_seconds,base.stages[4].duration_seconds,lift.discount_percent,conditions.transport_bonus_percent);
 const rawWork=base.duration_seconds-travel.travel-travel.return-base.stages[1].duration_seconds-base.stages[3].duration_seconds;
 const ventilation=applicableInfrastructure(target,input.route,input.infrastructure).find(item=>item.key==='ventilation')?.strength??0;
 const modifiers=calculateDeepModifiers({mode:input.mode,depth:target.y,raw_work_seconds:Math.max(0,rawWork),engineering:base.averages.engineering,ventilation_strength:ventilation,gear_reduction_percent:crewThermalReduction(input.workers.map(worker=>worker.id),input.equipment),lift_discount_percent:lift.discount_percent,tutorial:input.tutorial});
 const mining=input.mode==='extract'&&!input.tutorial?calculateMiningCapacity({work_seconds:modifiers.effective_work_seconds,crew_count:input.workers.length,averages:base.averages,max_leadership:base.max_leadership,energy:base.energy_per_worker,tool_level:input.tool_level,material:input.material??'stone',sure_swing:input.workers.filter(worker=>worker.traits.includes('sure_swing')).length,deliberate:input.workers.filter(worker=>worker.traits.includes('deliberate')).length}):base.mining_capacity;
 const scoutQuota=base.wages+2*input.workers.length+Math.floor(base.averages.mining/20)+Math.floor(base.averages.geology/30)+Math.floor(base.averages.endurance/30);
 const rawQuantity=input.tutorial?base.quantity:input.mode==='explore'?heatAdjustedExploreQuota(scoutQuota,modifiers.heat_penalty_percent):input.mode==='extract'?Math.max(1,mining):0;
 const feasible=input.tutorial===true||rawWork>=30;
 const quantity=feasible?Math.min(base.capacity,rawQuantity,input.remaining??Number.MAX_SAFE_INTEGER):0;
 return {...base,stages:base.stages.map(stage=>({...stage,duration_seconds:stage.key==='travel'?travel.travel:stage.key==='return'?travel.return:stage.key==='work'?Math.max(0,rawWork):stage.duration_seconds})),work_seconds:rawWork,feasible_work_time:feasible,mining_capacity:mining,quantity,deep_modifiers:modifiers,
  estimated_yield:{min:input.mode==='explore'?0:Math.floor(quantity*.8),max:Math.min(base.capacity,input.remaining??Number.MAX_SAFE_INTEGER,Math.ceil(quantity*1.2))}};
}
