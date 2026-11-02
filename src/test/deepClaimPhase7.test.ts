import {describe,expect,it} from 'vitest';
import {DEEP_CATALOG,DEEP_EQUIPMENT_CATALOG,DEEP_RECIPE_CATALOG,EQUIPMENT_BY_KEY,RECIPE_BY_KEY,buildingBenefits,equipmentCatalogForSchema,hasDeepOperations,recipeCatalogForSchema,resourceCatalogForSchema,resourceSaleValue} from '@/lib/deepClaim/catalog';
import {applyLiftTravel,calculateDeepCrewPlan,calculateDeepModifiers,crewThermalReduction,heatAdjustedExploreQuota,liftTravelDiscount,poweredLiftEdges} from '@/lib/deepClaim/deepOperations';
import {equipmentAfterCompletedJob,equipmentRepairQuote,recipeUnitDurationSeconds,workerStatsWithEquipment} from '@/lib/deepClaim/production';
import {applyResearchBonuses,researchEffects} from '@/lib/deepClaim/business';
import {calculateCrewPlan,withdrawFinite} from '@/lib/deepClaim/simulation';
import {validateDeepClaimPreview,validateDeepClaimSnapshot} from '@/lib/deepClaim/world';
import type {DeepClaimDeepModifiers,DeepClaimEquipment,DeepClaimInfrastructure,DeepClaimPoint,DeepClaimPreview,DeepClaimSnapshot,DeepClaimTile} from '@/lib/deepClaim/types';
import {companySnapshot} from './fixtures/deepClaim';
import {phaseTwoSnapshot} from './fixtures/deepClaimPhase2';
import {phaseThreeSnapshot} from './fixtures/deepClaimPhase3';
import {phaseFourSnapshot} from './fixtures/deepClaimPhase4';
import {phaseSevenSnapshot} from './fixtures/deepClaimPhase7';
const research=['deep_operations_2'];
const shaft=(depth=956):DeepClaimTile[]=>Array.from({length:depth+1},(_,y)=>({x:48,y,terrain:'excavated',material:null,remaining:0,initial_amount:0}));
function shield(id='shield',worker='worker-a',durability=180):DeepClaimEquipment{const repair=equipmentRepairQuote(EQUIPMENT_BY_KEY.nickel_heatshield,durability);return {id,definition_key:'nickel_heatshield',worker_id:worker,durability,max_durability:180,repair_cost:repair.cash_cost,repair_materials:repair.materials};}
function deepReady():DeepClaimSnapshot{
 const snapshot=phaseSevenSnapshot();snapshot.buildings.find(b=>b.key==='mine_shaft')!.level=6;snapshot.world!.max_depth=999;snapshot.deep_operations={infrastructure_capacity:192,lift_discount_percent:75};
 const completed=snapshot.business_catalog!.research.map(node=>node.key),effects=researchEffects(completed);
 snapshot.business!.research=snapshot.business_catalog!.research.map(node=>({key:node.key,status:'completed',started_at:'2026-10-30T00:00:00Z',completes_at:new Date(Date.parse('2026-10-30T00:00:00Z')+node.duration_seconds*1000).toISOString(),completed_at:new Date(Date.parse('2026-10-30T00:00:00Z')+node.duration_seconds*1000).toISOString()}));
 snapshot.business!.research_bonuses=effects.stat_bonuses;snapshot.business!.processing_speed_percent=effects.processing_speed_percent;snapshot.business!.stats.completed_research=completed.length;snapshot.business!.milestones.find(m=>m.key==='first_research')!.progress=1;
 snapshot.workers.forEach(worker=>{worker.stats=applyResearchBonuses(workerStatsWithEquipment(worker.base_stats!,worker.xp,[]),effects.stat_bonuses);});
 snapshot.recipes!.forEach(recipe=>{recipe.locked=false;recipe.research_speed_percent=15;recipe.effective_duration_seconds=recipeUnitDurationSeconds(recipe,Math.max(1,snapshot.buildings.find(building=>building.key===recipe.station)!.level),15);});
 return snapshot;
}
function modifiers(overrides:Partial<Parameters<typeof calculateDeepModifiers>[0]>={}):DeepClaimDeepModifiers{return calculateDeepModifiers({mode:'extract',depth:600,raw_work_seconds:1000,engineering:50,ventilation_strength:0,gear_reduction_percent:0,lift_discount_percent:0,...overrides});}
function crewInput(depth=650){const snapshot=phaseSevenSnapshot(),route:DeepClaimPoint[]=[{x:48,y:0},{x:48,y:depth},{x:47,y:depth}];return {workers:snapshot.workers,mode:'extract' as const,duration_minutes:60 as const,route,tiles:shaft(),shaft_level:6,completed_research:research,equipment:[] as DeepClaimEquipment[],infrastructure:[] as DeepClaimInfrastructure[],tool_level:3,material:'nickel_ore' as const,remaining:999};}

describe('Ancient Deep weighted lift on actual constructed known shaft edges',()=>{
 it('requires shaftsix and completed existing research; every edge requires both revealed excavated endpoints',()=>{
  const tiles=shaft(10),route=[{x:48,y:0},{x:48,y:10}];expect(liftTravelDiscount(route,tiles,5,research).discount_percent).toBe(0);expect(liftTravelDiscount(route,tiles,6,[]).discount_percent).toBe(0);
  expect(poweredLiftEdges(tiles,6,research).size).toBe(10);expect(liftTravelDiscount(route,tiles,6,research)).toEqual({eligible_length:10,total_length:10,discount_percent:75});
  const missing=tiles.filter(tile=>tile.y!==5);expect(liftTravelDiscount(route,missing,6,research)).toEqual({eligible_length:8,total_length:10,discount_percent:60});expect(poweredLiftEdges(tiles.slice(1),6,research).has(0)).toBe(true);expect(poweredLiftEdges(tiles.slice(2),6,research).has(0)).toBe(false);
 });
 it('counts the guaranteed surface landing omitted by the actual public DTO without inferring underground gaps',()=>{
  const publicTiles=shaft(900).slice(1),route=[{x:48,y:0},{x:48,y:900}];expect(liftTravelDiscount(route,publicTiles,6,research)).toEqual({eligible_length:900,total_length:900,discount_percent:75});
  const gap=publicTiles.filter(tile=>tile.y!==450);expect(liftTravelDiscount(route,gap,6,research)).toEqual({eligible_length:898,total_length:900,discount_percent:74});
  expect(poweredLiftEdges([],6,research).size).toBe(0);expect(poweredLiftEdges(publicTiles,5,research).size).toBe(0);
 });
 it('weights vertical edge length against the entire route and does not discount branching or unconstructed corridors',()=>{
  expect(liftTravelDiscount([{x:48,y:0},{x:48,y:10},{x:43,y:10}],shaft(10),6,research)).toEqual({eligible_length:10,total_length:15,discount_percent:50});
  expect(liftTravelDiscount([{x:48,y:0},{x:48,y:999}],shaft(999),6,research)).toEqual({eligible_length:956,total_length:999,discount_percent:71});
  expect(liftTravelDiscount([{x:47,y:0},{x:47,y:999}],shaft(),6,research).eligible_length).toBe(0);expect(liftTravelDiscount([],shaft(),6,research).discount_percent).toBe(0);
 });
 it('does not use known walls or merely zero material to create a powered path through unknown ground',()=>{
  const tiles=shaft(3);tiles[1]={...tiles[1],terrain:'stone',material:'stone',initial_amount:2,remaining:2};expect([...poweredLiftEdges(tiles,6,research)]).toEqual([2]);
 });
 it('applies liftceil then weightedrailceil and the ordinary twenty-second minimum exactly',()=>{
  expect(applyLiftTravel(86,101,74,3)).toEqual({travel:23,return:27});expect(applyLiftTravel(20,20,75,40)).toEqual({travel:20,return:20});expect(applyLiftTravel(101,103,0,0)).toEqual({travel:101,return:103});
 });
});

describe('Ancient Deep one-time productive heat reduction',()=>{
 it('uses deterministic600m load steps while preserving actual elapsed work seconds',()=>{
  expect([600,699,700,800,999].map(depth=>modifiers({depth}).thermal_load_percent)).toEqual([30,30,32,34,36]);const result=modifiers();expect(result).toMatchObject({thermal_load_percent:30,engineering_mitigation_percent:5,heat_penalty_percent:25,raw_work_seconds:1000,effective_work_seconds:750});
  expect(modifiers({engineering:99,ventilation_strength:13,gear_reduction_percent:15}).heat_penalty_percent).toBe(0);
 });
 it('does not penalize shallow mining, surveying, infrastructure or tutorial operations',()=>{
  for(const input of [{depth:599},{mode:'survey' as const},{mode:'infrastructure' as const},{tutorial:true}])expect(modifiers({...input,gear_reduction_percent:15,ventilation_strength:13})).toMatchObject({thermal_load_percent:0,engineering_mitigation_percent:0,ventilation_mitigation_percent:0,gear_mitigation_percent:0,heat_penalty_percent:0,effective_work_seconds:1000});
 });
 it('averages only working assigned selected-worker shields and ignores broken, unassigned and foreign-worker gear',()=>{
  const gear=[shield('a','worker-a'),shield('b','worker-b'),shield('broken','worker-c',0),shield('unassigned',null as unknown as string),shield('foreign','outsider')];expect(crewThermalReduction(['worker-a','worker-b','worker-c'],gear)).toBe(10);expect(crewThermalReduction(['worker-a'],gear)).toBe(15);expect(crewThermalReduction(['worker-c'],gear)).toBe(0);
  expect(crewThermalReduction(['worker-a','worker-b','worker-c'],[shield('a','worker-a')])).toBe(5);expect(equipmentAfterCompletedJob({durability:1},1,7)).toBe(0);expect(equipmentAfterCompletedJob({durability:1},1,1)).toBe(1);expect(()=>crewThermalReduction(['worker-a','worker-a'],gear)).toThrow();
 });
 it('scales scouting quota once rather than multiplying it by a rounded work ratio',()=>{
  const result=modifiers({raw_work_seconds:1133,engineering:100,ventilation_strength:10});expect(result.heat_penalty_percent).toBe(10);expect(result.effective_work_seconds).toBe(1019);expect(heatAdjustedExploreQuota(20,10)).toBe(18);expect(Math.floor(20*1019/1133)).toBe(17);expect(heatAdjustedExploreQuota(1,40)).toBe(1);expect(heatAdjustedExploreQuota(0,40)).toBe(0);
 });
 it('changes ore recovery rather than stage duration and gives real protection value to shields and installed ventilation',()=>{
  const input=crewInput(),plain=calculateDeepCrewPlan(input),protectedPlan=calculateDeepCrewPlan({...input,equipment:input.workers.map(worker=>shield(worker.id,worker.id)),infrastructure:[{id:'vent',key:'ventilation',grade:3,x:47,y:650,radius:12,strength:13,status:'installed',job_id:'old-job',installed_at:'2026-10-30T00:00:00Z'}]});
  expect(protectedPlan.deep_modifiers.heat_penalty_percent).toBe(0);expect(protectedPlan.deep_modifiers.effective_work_seconds).toBeGreaterThan(plain.deep_modifiers.effective_work_seconds);expect(protectedPlan.quantity).toBeGreaterThan(plain.quantity);expect(protectedPlan.stages).toEqual(plain.stages);expect(plain.stages.reduce((n,s)=>n+s.duration_seconds,0)).toBe(3600);
 });
 it('makes deep standard travel feasible through actual paid lift technology and honestly keeps impossible quick trips infeasible',()=>{
  const input=crewInput(999),lifted=calculateDeepCrewPlan(input),walking=calculateDeepCrewPlan({...input,shaft_level:5});expect(lifted.feasible_work_time).toBe(true);expect(walking.feasible_work_time).toBe(false);expect(calculateDeepCrewPlan({...input,duration_minutes:20}).feasible_work_time).toBe(false);
 });
 it('keeps shallow extraction coefficients identical and never withdraws more finite nickel than exists',()=>{
  const input=crewInput(3),current=calculateDeepCrewPlan({...input,shaft_level:1,completed_research:[],material:'stone'}),legacy=calculateCrewPlan({workers:input.workers,mode:'extract',duration_minutes:60,path_edges:4,target_depth:3,tool_level:3,material:'stone',remaining:999});
  expect(current.stages).toEqual(legacy.stages);expect(current.quantity).toBe(legacy.quantity);expect(current.deep_modifiers.heat_penalty_percent).toBe(0);
  for(const remaining of [0,1,18,36]){const plan=calculateDeepCrewPlan({...crewInput(),duration_minutes:180,remaining});expect(plan.quantity).toBeLessThanOrEqual(remaining);expect(withdrawFinite(remaining,plan.quantity).remaining+plan.quantity).toBe(remaining);}
 });
});

describe('Ancient Deep additive catalogs, validation and frozen history',()=>{
 it('keeps allolder schema catalogs visible exactly and exposes newgoods/actions only forschemafive',()=>{
  for(const snapshot of [companySnapshot(),phaseTwoSnapshot(),phaseThreeSnapshot(),phaseFourSnapshot(),phaseSevenSnapshot()])expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
  expect(resourceCatalogForSchema(4)).toHaveLength(19);expect(resourceCatalogForSchema(5)).toHaveLength(22);expect(recipeCatalogForSchema(4)).toHaveLength(21);expect(recipeCatalogForSchema(5)).toHaveLength(23);expect(equipmentCatalogForSchema(4)).toHaveLength(12);expect(equipmentCatalogForSchema(5)).toHaveLength(13);expect(DEEP_RECIPE_CATALOG).toHaveLength(23);expect(DEEP_EQUIPMENT_CATALOG).toHaveLength(13);expect(hasDeepOperations(phaseFourSnapshot())).toBe(false);expect(hasDeepOperations(phaseSevenSnapshot())).toBe(true);
 });
 it('retains oldfield3/business4 definitions, finite company objectives and unchanged productionresearch caps',()=>{
  const snapshot=phaseSevenSnapshot();expect(snapshot.field_catalog!.version).toBe(3);expect(snapshot.business_catalog!.version).toBe(4);expect(snapshot.business_catalog!.research).toHaveLength(14);expect(snapshot.business_catalog!.contracts).toHaveLength(12);expect(snapshot.business_catalog!.milestones).toHaveLength(8);expect(snapshot.company!.equipment_capacity).toBe(48);
  const recipe=RECIPE_BY_KEY.smelt_nickel_alloy;expect(resourceSaleValue(recipe.outputs)-resourceSaleValue(recipe.inputs)-recipe.cash_cost).toBe(23);expect(EQUIPMENT_BY_KEY.nickel_heatshield.thermal_reduction_percent).toBe(15);expect(equipmentRepairQuote(EQUIPMENT_BY_KEY.nickel_heatshield,0)).toMatchObject({cash_cost:90,materials:{nickel_alloy:1,sulfur:2}});
 });
 it('requires the actual shaftlevel/research to support999m and192infrastructure capacity',()=>{
  const snapshot=deepReady();expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();expect(buildingBenefits('mine_shaft',6)).toEqual({max_depth:999,shaft_depth:956});snapshot.deep_operations!.lift_discount_percent=0;expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/actual shaft/);
  const old=phaseFourSnapshot();old.buildings.find(b=>b.key==='mine_shaft')!.level=6;expect(()=>validateDeepClaimSnapshot(old)).toThrow(/building/);
 });
 it('supports truly freshschemafive and rejects leaked/fabricated deepfields orcatalogchanges',()=>{
  const fresh=phaseSevenSnapshot(0);fresh.company=null;fresh.world=null;fresh.resources={};fresh.workers=[];fresh.expeditions=[];fresh.buildings=[];fresh.log=[];fresh.business!.contracts=[];fresh.business!.milestones=[];expect(()=>validateDeepClaimSnapshot(fresh)).not.toThrow();
  const catalog=phaseSevenSnapshot();catalog.deep_catalog!.thermal.base_percent=0;expect(()=>validateDeepClaimSnapshot(catalog)).toThrow(/catalog/);const missing=phaseSevenSnapshot();delete missing.deep_operations;expect(()=>validateDeepClaimSnapshot(missing)).toThrow();const old=phaseFourSnapshot();Object.assign(old,{deep_catalog:DEEP_CATALOG});expect(()=>validateDeepClaimSnapshot(old)).toThrow(/schema five/);
 });
 it('validates frozen public productive seconds without recomputing historical gear from its current broken condition',()=>{
  const snapshot=phaseSevenSnapshot(),item=shield('worn','worker-a',0);snapshot.equipment=[item];snapshot.workers[0].equipment_ids=[item.id];const at=Date.parse('2026-10-30T00:00:00Z');let cursor=at;const durations=[50,50,1000,50,50],stages=(['travel','setup','work','haul','return'] as const).map((key,index)=>{const start=cursor;cursor+=durations[index]*1000;return {key,starts_at:new Date(start).toISOString(),ends_at:new Date(cursor).toISOString()};});
  snapshot.expeditions=[{id:'deep-history',mode:'extract',status:'collected',worker_ids:['worker-a'],target:{x:47,y:608},path:[{x:48,y:0},{x:48,y:608},{x:47,y:608}],stages,stage:'collected',started_at:new Date(at).toISOString(),completes_at:new Date(cursor).toISOString(),duration_minutes:20,duration_seconds:1200,tutorial:false,wages:2,energy_per_worker:1,config_version:7,cargo:{nickel_ore:1},deep_modifiers:modifiers({depth:608,gear_reduction_percent:15})}];
  expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();snapshot.expeditions[0].deep_modifiers!.effective_work_seconds++;expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/coefficients/);
 });
 it('rejects clientinvented usefulwork/heat and permits onlynewversionseven modifier quotes',()=>{
  const value:DeepClaimPreview={allowed:true,reasons:[],company_revision:1,server_now:'2026-11-01T12:00:00Z',wages:2,energy_per_worker:1,duration_seconds:1200,estimated_yield:{min:1,max:1},route:[{x:48,y:1}],cargo_capacity:65,risk_level:'high',accessible_depth:999,expected_resources:['nickel_ore'],projected_completion_at:'2026-11-01T12:20:00Z',stages:[],operation_version:7,operation_cost:0,materials_cost:{},conditions:{instability:3,gas:3,water:3,incident_chance_percent:0,max_delay_seconds:0,transport_bonus_percent:0,infrastructure_ids:[]},survey:null,installation:null,deep_modifiers:modifiers()};
  expect(()=>validateDeepClaimPreview(value)).not.toThrow();value.deep_modifiers!.effective_work_seconds=1000;expect(()=>validateDeepClaimPreview(value)).toThrow(/coefficients/);value.deep_modifiers=modifiers();value.operation_version=3;expect(()=>validateDeepClaimPreview(value)).toThrow(/version-seven/);
 });
});
