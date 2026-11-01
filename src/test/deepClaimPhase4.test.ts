import { describe,expect,it } from 'vitest';
import { ALL_EQUIPMENT_CATALOG,ALL_RECIPE_CATALOG,BUSINESS_CATALOG,EQUIPMENT_BY_KEY,EQUIPMENT_CATALOG,RECIPE_BY_KEY,RECIPE_CATALOG,RESEARCH_BY_KEY,buildingBenefits,buildingEffect,resourceSaleValue } from '@/lib/deepClaim/catalog';
import { applyResearchBonuses,businessProgress,contractEligibility,contractPremium,fulfillContract,researchEffects,researchEligibility,resourceShortfalls,validateBusinessCatalog } from '@/lib/deepClaim/business';
import { equipmentRepairQuote,productionQuote,recipeDurationSeconds,recipeUnitDurationSeconds,recipeValueAdded,workerStatsWithEquipment } from '@/lib/deepClaim/production';
import { calculateCrewPlan } from '@/lib/deepClaim/simulation';
import { validateDeepClaimSnapshot } from '@/lib/deepClaim/world';
import type { DeepClaimProductionJob,DeepClaimRecipe,DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { companySnapshot } from './fixtures/deepClaim';
import { phaseTwoSnapshot } from './fixtures/deepClaimPhase2';
import { phaseThreeSnapshot } from './fixtures/deepClaimPhase3';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';

function completeResearch(snapshot:DeepClaimSnapshot,keys:string[]){
 snapshot.business!.research=keys.map(key=>({key,status:'completed',started_at:'2026-10-31T00:00:00Z',completes_at:new Date(Date.parse('2026-10-31T00:00:00Z')+RESEARCH_BY_KEY[key].duration_seconds*1000).toISOString(),completed_at:new Date(Date.parse('2026-10-31T00:00:00Z')+RESEARCH_BY_KEY[key].duration_seconds*1000).toISOString()}));
 const effects=researchEffects(keys);snapshot.business!.research_bonuses=effects.stat_bonuses;snapshot.business!.processing_speed_percent=effects.processing_speed_percent;snapshot.business!.stats.completed_research=keys.length;
 snapshot.business!.milestones.forEach(m=>{const definition=BUSINESS_CATALOG.milestones.find(d=>d.key===m.key)!;m.progress=Math.min(definition.target,snapshot.business!.stats[definition.metric]);});
 snapshot.workers.forEach(worker=>{worker.stats=applyResearchBonuses(workerStatsWithEquipment(worker.base_stats!,worker.xp,[]),effects.stat_bonuses);});
 snapshot.recipes!.forEach(recipe=>{recipe.research_speed_percent=effects.processing_speed_percent;recipe.locked=(recipe.required_research??[]).some(key=>!keys.includes(key));recipe.effective_duration_seconds=recipeUnitDurationSeconds(recipe,Math.max(1,snapshot.buildings.find(b=>b.key===recipe.station)!.level),effects.processing_speed_percent);});
}
function frozenJob(speed=0):DeepClaimProductionJob{
 const recipe=RECIPE_BY_KEY.smelt_copper,{effective_duration_seconds:_,...base}=recipe,quote=productionQuote(recipe,2,1,speed);
 return {id:'old-order',recipe_key:recipe.key,recipe_version:1,recipe_snapshot:base,research_speed_percent:speed,batches:2,station:'smeltery',status:'active',started_at:'2026-11-01T12:00:00Z',completes_at:new Date(Date.parse('2026-11-01T12:00:00Z')+quote.duration_seconds*1000).toISOString(),...quote};
}

describe('Deep Claim schema4 development and legacy preservation',()=>{
 it('preserves schema1/2/3 and original recipe/gear definitions while extending only the current public catalog',()=>{
  for(const snapshot of [companySnapshot(),phaseTwoSnapshot(),phaseThreeSnapshot(),phaseFourSnapshot()])expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
  expect(RECIPE_CATALOG).toHaveLength(16);expect(EQUIPMENT_CATALOG).toHaveLength(10);expect(ALL_RECIPE_CATALOG).toHaveLength(21);expect(ALL_EQUIPMENT_CATALOG).toHaveLength(12);
  const old=phaseThreeSnapshot(4),next=phaseFourSnapshot();expect(next.world).toEqual(old.world);expect(next.workers).toEqual(old.workers);expect(next.resources).toEqual(old.resources);
 });
 it('accepts actual fresh-null schema4 catalogs with empty business records and rejects any awarded progress',()=>{
  const fresh=phaseFourSnapshot(0);fresh.company=null;fresh.world=null;fresh.resources={};fresh.workers=[];fresh.expeditions=[];fresh.buildings=[];fresh.log=[];fresh.business!.contracts=[];fresh.business!.milestones=[];
  expect(()=>validateDeepClaimSnapshot(fresh)).not.toThrow();fresh.business!.stats.completed_contracts=1;expect(()=>validateDeepClaimSnapshot(fresh)).toThrow(/fresh|setup/);
 });
 it('requires canonical business metadata and all12/8 founded records without private pay/reward authority',()=>{
  const missing=phaseFourSnapshot();delete missing.business;expect(()=>validateDeepClaimSnapshot(missing)).toThrow();
  const catalog=phaseFourSnapshot();catalog.business_catalog!.contracts[0].reward=999;expect(()=>validateDeepClaimSnapshot(catalog)).toThrow(/catalog/);
  const missingOrder=phaseFourSnapshot();missingOrder.business!.contracts.pop();expect(()=>validateDeepClaimSnapshot(missingOrder)).toThrow(/finite/);
  const privateField=phaseFourSnapshot();Object.assign(privateField.business!,{seed:'hidden'});expect(()=>validateDeepClaimSnapshot(privateField)).toThrow();
 });
 it('adds two genuinely usable surface buildings without changing previous operating capacities',()=>{
  expect(buildingBenefits('research_office',0)).toEqual({research_tier:0});expect(buildingBenefits('research_office',2)).toEqual({research_tier:2});expect(buildingEffect('research_office',2)).toContain('tier 2');
  expect(buildingBenefits('trading_post',3)).toEqual({contract_tier:3});expect(buildingEffect('trading_post',3)).toContain('tier 3');expect(()=>buildingBenefits('research_office',3)).toThrow();
  expect(phaseFourSnapshot().company!.warehouse_capacity).toBe(120);expect(phaseFourSnapshot().company!.equipment_capacity).toBe(48);
 });
});

describe('Deep Claim research dependency and paid benefit model',()=>{
 it('validates all14nodes, cross-branch dependencies, useful unlocks and finite costs',()=>{
  expect(()=>validateBusinessCatalog()).not.toThrow();expect(BUSINESS_CATALOG.research).toHaveLength(14);
  for(const branch of ['excavation','geology','processing','logistics','workforce','safety','deep_operations']){const nodes=BUSINESS_CATALOG.research.filter(n=>n.branch===branch);expect(nodes.map(n=>n.tier)).toEqual([1,2]);expect(nodes[1].requires).toContain(`${branch}_1`);expect(nodes[1].requires.some(key=>!key.startsWith(branch))).toBe(true);}
  expect(BUSINESS_CATALOG.research.reduce((sum,n)=>sum+n.cash_cost,0)).toBe(2700);expect(BUSINESS_CATALOG.research.reduce((sum,n)=>sum+resourceSaleValue(n.inputs),0)).toBe(2673);
 });
 it('requires actual collected inputs, one slot, building level, prior nodes and a cash reserve',()=>{
  const node=RESEARCH_BY_KEY.excavation_2;
  expect(researchEligibility(node,{completed:[],active:true,office_level:1,cash:280,resources:{}})).toHaveLength(5);
  expect(researchEligibility(node,{completed:node.requires,active:false,office_level:2,cash:282,resources:{...node.inputs}})).toEqual([]);
  expect(researchEligibility(node,{completed:[...node.requires,node.key],active:false,office_level:2,cash:1000,resources:{...node.inputs}})).toContain('This research is already completed.');
 });
 it('sums completed research once and applies benefits after XP/gear with a100stat cap',()=>{
  const all=researchEffects(BUSINESS_CATALOG.research.map(node=>node.key));expect(all).toEqual({stat_bonuses:{mining:10,geology:10,logistics:10,leadership:4,endurance:6,safety:10,engineering:10},processing_speed_percent:15});
  expect(researchEffects(['excavation_1','excavation_1']).stat_bonuses.mining).toBe(4);
  const worker=phaseFourSnapshot().workers[0],gear=workerStatsWithEquipment(worker.base_stats!,60,[{definition_key:'steel_pickaxe',durability:180}]);
  expect(applyResearchBonuses(gear,{mining:10}).mining).toBe(87);expect(applyResearchBonuses({...gear,mining:99},{mining:10}).mining).toBe(100);
 });
 it('keeps benefits absent during paid research and verifies completed-node benefits exactly once',()=>{
  const snapshot=phaseFourSnapshot();snapshot.business!.research=[{key:'excavation_1',status:'active',started_at:'2026-11-01T11:59:00Z',completes_at:'2026-11-01T12:04:00Z',completed_at:null}];expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
  snapshot.business!.research_bonuses={mining:4};expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/benefits/);
  const complete=phaseFourSnapshot();completeResearch(complete,['excavation_1']);expect(()=>validateDeepClaimSnapshot(complete)).not.toThrow();complete.workers[0].stats.mining+=4;expect(()=>validateDeepClaimSnapshot(complete)).toThrow(/once/);
 });
 it('rejects free research prerequisites, impossible clocks, duplicate records and multiple active projects',()=>{
  const free=phaseFourSnapshot();completeResearch(free,['excavation_2']);expect(()=>validateDeepClaimSnapshot(free)).toThrow(/prerequisites/);
  const clock=phaseFourSnapshot();clock.business!.research=[{key:'excavation_1',status:'active',started_at:'2026-11-01T11:59:00Z',completes_at:'2026-11-01T12:00:00Z',completed_at:null}];expect(()=>validateDeepClaimSnapshot(clock)).toThrow(/order/);
  const doubled=phaseFourSnapshot();doubled.business!.research=['excavation_1','geology_1'].map(key=>({key,status:'active',started_at:'2026-11-01T11:59:00Z',completes_at:'2026-11-01T12:04:00Z',completed_at:null}));expect(()=>validateDeepClaimSnapshot(doubled)).toThrow(/one research/);
 });
 it('changes future crew productivity through effective stats without changing existing plan values or energy rules',()=>{
  const worker=phaseFourSnapshot().workers[0],input={workers:[worker],mode:'extract' as const,duration_minutes:20 as const,path_edges:4,target_depth:1,tool_level:1,material:'stone' as const,remaining:500};
  const old=calculateCrewPlan(input),future=calculateCrewPlan({...input,workers:[{...worker,stats:applyResearchBonuses(worker.stats,{mining:10})}]});
  expect(future.quantity).toBeGreaterThan(old.quantity);expect(future.energy_per_worker).toBe(old.energy_per_worker);expect(old.averages.mining).toBe(50);
 });
});

describe('Deep Claim frozen research production and advanced industry',()=>{
 it('applies station ceil then research ceil perbatch, preserving legacy timing with speed0',()=>{
  const recipe={...RECIPE_BY_KEY.smelt_copper,duration_seconds:181};expect(recipeDurationSeconds(recipe,3,2,5)).toBe(441);expect(recipeDurationSeconds(recipe,3,2,15)).toBe(393);
  expect(recipeDurationSeconds(RECIPE_BY_KEY.smelt_copper,2,1,0)).toBe(360);expect(recipeDurationSeconds({...recipe,duration_seconds:1},2,3,15)).toBe(40);
 });
 it('validates old orders at their frozen speed after new research completes, rejecting retroactive output/clock edits',()=>{
  const snapshot=phaseFourSnapshot();completeResearch(snapshot,['processing_1']);snapshot.production_jobs=[frozenJob(0)];expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
  const oldTime=snapshot.production_jobs[0].duration_seconds;snapshot.production_jobs[0].research_speed_percent=5;expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/timing/);expect(oldTime).toBe(360);
  const mutated=phaseFourSnapshot();mutated.production_jobs=[frozenJob()];mutated.production_jobs[0].recipe_snapshot!.outputs={copper_bar:200};expect(()=>validateDeepClaimSnapshot(mutated)).toThrow(/immutable/);
 });
 it('keeps original16recipes usable and locks only new paid research recipes',()=>{
  const snapshot=phaseFourSnapshot();expect(snapshot.recipes!.filter(recipe=>!recipe.locked)).toHaveLength(16);expect(snapshot.recipes!.filter(recipe=>recipe.locked)).toHaveLength(5);
  completeResearch(snapshot,['processing_1']);expect(snapshot.recipes!.find(recipe=>recipe.key==='smelt_bronze')!.locked).toBe(false);expect(snapshot.recipes!.find(recipe=>recipe.key==='smelt_steel')!.locked).toBe(true);expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
 });
 it('has positive bounded alloy margins and tier3gear with actual repair/skill effects',()=>{
  expect(BUSINESS_CATALOG.recipes.filter(recipe=>!recipe.equipment_output).map(recipe=>recipeValueAdded({...recipe,effective_duration_seconds:recipe.duration_seconds}))).toEqual([20,36,30]);
  expect(EQUIPMENT_BY_KEY.steel_pickaxe).toMatchObject({tier:3,max_durability:180,bonuses:{mining:26,engineering:8}});
  expect(equipmentRepairQuote(EQUIPMENT_BY_KEY.steel_pickaxe,160)).toMatchObject({cash_cost:10,materials:{steel_bar:1,polished_quartz:1}});
  expect(equipmentRepairQuote(EQUIPMENT_BY_KEY.steel_cargo_harness,0).cash_cost).toBe(72);
 });
});

describe('Deep Claim finite contracts and durable milestones',()=>{
 it('has12nonexpiring once-only orders and a bounded finite premium pool',()=>{
  expect(BUSINESS_CATALOG.contracts.map(c=>c.tier)).toEqual([1,1,1,1,2,2,2,2,3,3,3,3]);expect(BUSINESS_CATALOG.contracts.reduce((n,c)=>n+contractPremium(c),0)).toBe(593);expect(BUSINESS_CATALOG.contracts.reduce((n,c)=>n+c.reward,0)).toBe(4569);
 });
 it('requires preceding contracts/research/trading level and exact collected inventory before atomic delivery',()=>{
  const contract=BUSINESS_CATALOG.contracts.find(c=>c.key==='alloy_stock')!;
  expect(contractEligibility(contract,{completed_contracts:[],completed_research:[],trading_level:1,resources:{bronze_bar:3}})).toHaveLength(4);
  expect(contractEligibility(contract,{completed_contracts:contract.requires_contracts,completed_research:contract.required_research,trading_level:2,resources:{bronze_bar:4}})).toEqual([]);
  expect(resourceShortfalls({bronze_bar:3},contract.inputs)).toEqual({bronze_bar:1});expect(()=>fulfillContract({bronze_bar:3},100,contract.key)).toThrow(/complete/);
  expect(fulfillContract({bronze_bar:4,stone:7},100,contract.key)).toEqual({resources:{bronze_bar:0,stone:7},cash:468,reward:368});
 });
 it('derives milestone progress from uncapped durable stats and caps the finite credit awards',()=>{
  const snapshot=phaseFourSnapshot();snapshot.business!.stats.completed_mining_expeditions=100;snapshot.business!.stats.max_completed_mining_depth=599;
  const progress=businessProgress(snapshot.business!.stats);expect(progress.first_shift).toBe(1);expect(progress.depth_100).toBe(100);expect(BUSINESS_CATALOG.milestones.reduce((n,m)=>n+m.reward,0)).toBe(400);
  snapshot.business!.milestones.forEach(m=>m.progress=progress[m.key]);expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();snapshot.business!.milestones.find(m=>m.key==='first_research')!.claimed_at='2026-11-01T10:00:00Z';expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/durable/);
 });
 it('checks permanent contract totals and rejects duplicate public records or fabricated reward counts',()=>{
  const snapshot=phaseFourSnapshot();snapshot.business!.contracts[0].status='completed';snapshot.business!.contracts[0].completed_at='2026-11-01T10:00:00Z';snapshot.business!.stats.completed_contracts=1;snapshot.business!.stats.total_contract_credits=24;snapshot.business!.milestones.find(m=>m.key==='three_deliveries')!.progress=1;expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
  snapshot.business!.stats.total_contract_credits=48;expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/totals/);
 });
});
