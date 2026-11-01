import { describe, expect, it } from 'vitest';
import { CANDIDATE_PROFILES, EQUIPMENT_BY_KEY, EQUIPMENT_CAPACITY, EQUIPMENT_CATALOG, RECIPE_BY_KEY, RECIPE_CATALOG, RESOURCE_BY_ID } from '@/lib/deepClaim/catalog';
import { calculateCrewPlan } from '@/lib/deepClaim/simulation';
import { availableEquipmentCapacity, equipmentAfterCompletedJob, equipmentRepairQuote, housingCapacity, productionQuote, recipeValueAdded, trainingQuote, workerStatsWithEquipment } from '@/lib/deepClaim/production';
import { validateDeepClaimSnapshot, validateDeepClaimWorld } from '@/lib/deepClaim/world';
import { DEEP_CLAIM_MINERAL_IDS, DEEP_CLAIM_SPECIALTIES, type DeepClaimEquipment, type DeepClaimProductionJob, type DeepClaimResources } from '@/lib/deepClaim/types';
import { companySnapshot } from './fixtures/deepClaim';
import { phaseTwoSnapshot } from './fixtures/deepClaimPhase2';

function item(id = 'item-a', key = 'copper_pickaxe'): DeepClaimEquipment {
  const definition=EQUIPMENT_BY_KEY[key];
  return {id,definition_key:key,worker_id:null,durability:definition.max_durability,max_durability:definition.max_durability,repair_cost:0,repair_materials:{}};
}
function job(id='production-a', key='smelt_copper', batches=1): DeepClaimProductionJob {
  const recipe=RECIPE_BY_KEY[key], quote=productionQuote(recipe,batches,1);
  return {id,recipe_key:key,recipe_version:1,batches,station:recipe.station,status:'active',started_at:'2026-11-01T12:00:00.000Z',completes_at:new Date(Date.parse('2026-11-01T12:00:00.000Z')+quote.duration_seconds*1000).toISOString(),...quote};
}
const identity={userId:'user-a',clubId:'club-a'};

describe('Deep Claim schema2 and historical boundary', () => {
  it('preserves the exact Phase1 save while accepting all additive Phase2 catalogs and unbuilt structures', () => {
    const legacy=companySnapshot(), next=phaseTwoSnapshot();
    expect(() => validateDeepClaimSnapshot(legacy,identity)).not.toThrow();
    expect(() => validateDeepClaimSnapshot(next,identity)).not.toThrow();
    expect(next.company!.id).toBe(legacy.company!.id); expect(next.workers.map(worker=>worker.id)).toEqual(legacy.workers.map(worker=>worker.id));
    expect(next.world!.tiles).toEqual(legacy.world!.tiles); expect(next.resources).toEqual(legacy.resources);
    expect(next.buildings.filter(building=>building.level===0)).toHaveLength(3);
  });
  it('accepts a truly fresh schema2 company response before catalogs exist, without relaxing founded-company validation', () => {
    const fresh={schema_version:2,server_now:'2026-11-01T12:00:00.000Z',revision:0,company:null,world:null,resources:{},workers:[],expeditions:[],buildings:[],log:[],candidates:[],equipment:[],production_jobs:[],recipes:[],equipment_catalog:[]};
    expect(()=>validateDeepClaimSnapshot(fresh)).not.toThrow();
    const canonicalFresh={...fresh,recipes:RECIPE_CATALOG,equipment_catalog:EQUIPMENT_CATALOG};
    expect(()=>validateDeepClaimSnapshot(canonicalFresh)).not.toThrow();
    expect(()=>validateDeepClaimSnapshot({...fresh,revision:1})).toThrow();
    const founded=phaseTwoSnapshot();founded.recipes=[];founded.equipment_catalog=[];expect(()=>validateDeepClaimSnapshot(founded)).toThrow(/catalog/);
    expect(()=>validateDeepClaimSnapshot({...fresh,equipment_catalog:EQUIPMENT_CATALOG})).toThrow(/catalog/);
  });
  it('requires complete schema2 data and rejects private/fabricated catalog rules', () => {
    const missing=phaseTwoSnapshot(); delete missing.equipment_catalog; expect(()=>validateDeepClaimSnapshot(missing)).toThrow();
    const wages=phaseTwoSnapshot(); delete wages.workers[0].wage; expect(()=>validateDeepClaimSnapshot(wages)).toThrow(/training or equipment/);
    const price=phaseTwoSnapshot(); price.recipes![0].cash_cost=0; expect(()=>validateDeepClaimSnapshot(price)).toThrow(/recipe/);
    const bonus=phaseTwoSnapshot(); bonus.equipment_catalog![0].bonuses.mining=100; expect(()=>validateDeepClaimSnapshot(bonus)).toThrow(/equipment rules/);
    const secret=phaseTwoSnapshot(); Object.assign(secret.world!,{seed:'private'}); expect(()=>validateDeepClaimSnapshot(secret)).toThrow();
  });
  it('supports workforce capacity6/9/12 and299m technology while detecting an invented housing capacity', () => {
    for (const level of [1,2,3]) {
      const snapshot=phaseTwoSnapshot(), capacity=housingCapacity(level);
      snapshot.buildings.find(building=>building.key==='workers_quarters')!.level=level; snapshot.company!.worker_capacity=capacity;
      for (let i=3;i<capacity;i++) snapshot.workers.push({...snapshot.workers[0],id:`hire-${i}`,equipment_ids:[]});
      expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
      snapshot.workers.push({...snapshot.workers[0],id:'too-many',equipment_ids:[]}); expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/workforce/);
    }
    const deep=phaseTwoSnapshot(); deep.buildings.find(building=>building.key==='mine_shaft')!.level=4; deep.world!.max_depth=299;
    deep.world!.tiles.push({x:47,y:170,terrain:'stone',material:'amethyst',remaining:20,initial_amount:20});
    expect(()=>validateDeepClaimSnapshot(deep)).not.toThrow();
    const fake=phaseTwoSnapshot(); fake.company!.worker_capacity=12; expect(()=>validateDeepClaimSnapshot(fake)).toThrow(/actual buildings/);
  });
  it('separates raw geology from processed inventory and does not manufacture refined deposits', () => {
    const snapshot=phaseTwoSnapshot(); snapshot.resources.copper_bar=2; snapshot.company!.warehouse_used+=2;
    expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
    snapshot.world!.tiles[0]={x:47,y:1,terrain:'stone',material:'copper_bar' as never,remaining:1,initial_amount:1};
    expect(()=>validateDeepClaimWorld(snapshot.world)).toThrow();
    expect(DEEP_CLAIM_MINERAL_IDS).toContain('amethyst'); expect(DEEP_CLAIM_MINERAL_IDS).toContain('gold_ore');
    expect(DEEP_CLAIM_MINERAL_IDS).not.toContain('cut_amethyst');
  });
  it('accepts immutable config1 and config2 expedition histories through the same parser', () => {
    const snapshot=phaseTwoSnapshot();
    const stages=['travel','setup','work','haul','return'].map((key,index)=>({key:key as 'travel',starts_at:new Date(Date.parse(snapshot.server_now)+index*1000).toISOString(),ends_at:new Date(Date.parse(snapshot.server_now)+(index+1)*1000).toISOString()}));
    const base={id:'old-job',mode:'extract' as const,status:'collected' as const,worker_ids:[snapshot.workers[0].id],target:{x:47,y:1},path:[{x:48,y:0},{x:48,y:1},{x:47,y:1}],stages,stage:'collected' as const,started_at:stages[0].starts_at,completes_at:stages[4].ends_at,duration_minutes:20 as const,duration_seconds:5,tutorial:false,wages:3,energy_per_worker:1,cargo:{coal:1}};
    snapshot.expeditions=[{...base,config_version:1},{...base,id:'new-job',config_version:2}];
    expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
  });
});

describe('Deep Claim daily workers, training and equipment', () => {
  it('publishes all seven useful role profiles with actual wages and functional positive/negative traits', () => {
    expect(CANDIDATE_PROFILES.map(profile=>profile.specialty)).toEqual([...DEEP_CLAIM_SPECIALTIES]);
    for (const profile of CANDIDATE_PROFILES) {
      expect(profile.wage).toBeGreaterThan(0); expect(profile.hire_cost).toBeGreaterThan(0); expect(profile.traits).toHaveLength(2);
      expect(Object.values(profile.stats).every(value=>value>=1&&value<=100)).toBe(true);
    }
  });
  it('uses a hired worker’s server wage rather than guessing from their name', () => {
    const worker=phaseTwoSnapshot().workers[0]; worker.name='A newly hired engineer';worker.specialty='engineer';worker.wage=4;
    const plan=calculateCrewPlan({workers:[worker],mode:'extract',duration_minutes:60,path_edges:2,target_depth:1,tool_level:1,material:'stone',remaining:100});
    expect(plan.wages).toBe(8);
  });
  it('trains an idle worker once per operating day, charges30 and caps permanent base skill at100', () => {
    const base=phaseTwoSnapshot().workers[0].base_stats!;
    expect(trainingQuote(base,'mining',null,'2026-11-01')).toMatchObject({cash_cost:30,gain:3,stats:{mining:53}});
    expect(trainingQuote({...base,mining:99},'mining',null,'2026-11-01')).toMatchObject({gain:1,stats:{mining:100}});
    expect(()=>trainingQuote({...base,mining:100},'mining',null,'2026-11-01')).toThrow(/cap/);
    expect(()=>trainingQuote(base,'mining','2026-11-01','2026-11-01')).toThrow(/already trained/);
    expect(()=>trainingQuote(base,'mining',null,'2026-11-01','away-job')).toThrow(/returns/);
    expect(base.mining).toBe(50);
  });
  it('applies only unbroken owned-item bonuses, caps stats, and never applies effective stats a second time', () => {
    const base=phaseTwoSnapshot().workers[0].base_stats!;
    const gear=[{definition_key:'iron_pickaxe',durability:140},{definition_key:'iron_helmet',durability:0}];
    const effective=workerStatsWithEquipment(base,60,gear);
    expect(effective.mining).toBe(69); expect(effective.safety).toBe(51);
    const worker={...phaseTwoSnapshot().workers[0],stats:effective,xp:60,level:2};
    const quote=calculateCrewPlan({workers:[worker],mode:'extract',duration_minutes:20,path_edges:2,target_depth:1,tool_level:1,material:'stone',remaining:100});
    expect(quote.averages.mining).toBe(69);
    expect(workerStatsWithEquipment({...base,mining:99},540,gear).mining).toBe(100);
    expect(()=>workerStatsWithEquipment(base,0,[gear[0],{definition_key:'copper_pickaxe',durability:100}])).toThrow(/one item/);
  });
  it('enforces exclusive item assignment and one gear item per worker slot', () => {
    const snapshot=phaseTwoSnapshot(), first=item(); first.worker_id=snapshot.workers[0].id;
    snapshot.equipment=[first];snapshot.workers[0].equipment_ids=[first.id];snapshot.workers[0].stats=workerStatsWithEquipment(snapshot.workers[0].base_stats!,0,[first]);expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
    const second=item('second','iron_pickaxe');second.worker_id=snapshot.workers[0].id;snapshot.equipment.push(second);snapshot.workers[0].equipment_ids.push(second.id);
    expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/one worker slot/);
    snapshot.equipment.pop();snapshot.workers[0].equipment_ids.pop();snapshot.workers[1].equipment_ids=[first.id];
    expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/assignment/);
  });
  it('wears config2 gear deterministically and leaves config1 jobs entirely unchanged', () => {
    expect(equipmentAfterCompletedJob({durability:100},3,1)).toBe(100);
    expect(equipmentAfterCompletedJob({durability:100},3,2)).toBe(94);
    expect(equipmentAfterCompletedJob({durability:1},3,2)).toBe(0);
    const repaired=equipmentRepairQuote(EQUIPMENT_BY_KEY.copper_pickaxe,0);
    expect(repaired).toEqual({cash_cost:20,materials:{stone:2},repaired_durability:100});
    expect(equipmentRepairQuote(EQUIPMENT_BY_KEY.iron_pickaxe,0)).toEqual({cash_cost:42,materials:{stone:3,iron_bar:1},repaired_durability:140});
    expect(equipmentRepairQuote(EQUIPMENT_BY_KEY.copper_pickaxe,100)).toMatchObject({cash_cost:0,materials:{}});
  });
  it('counts pending craft outputs toward48capacity and recovers a slot by retiring an unassigned item without refunds', () => {
    expect(EQUIPMENT_CAPACITY).toBe(48);expect(availableEquipmentCapacity(47,1)).toBe(0);
    const snapshot=phaseTwoSnapshot();snapshot.equipment=Array.from({length:48},(_,index)=>item(`item-${index}`));
    expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
    const cash=snapshot.company!.cash, stock={...snapshot.resources};snapshot.production_jobs=[job('craft','craft_copper_pickaxe')];
    expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/capacity/);
    snapshot.equipment.pop();expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
    expect(snapshot.company!.cash).toBe(cash);expect(snapshot.resources).toEqual(stock);
  });
});

describe('Deep Claim material production and real value', () => {
  it('publishes16 paid recipes and gives material processing small positive value on finite consumed inputs', () => {
    expect(RECIPE_CATALOG).toHaveLength(16);expect(EQUIPMENT_CATALOG).toHaveLength(10);
    expect(RECIPE_CATALOG.filter(recipe=>recipe.equipment_output===null).map(recipeValueAdded)).toEqual([14,12,18,22,6,34]);
    for (const recipe of RECIPE_CATALOG) {
      expect(Object.keys(recipe.inputs).length).toBeGreaterThan(0);expect(recipe.cash_cost).toBeGreaterThan(0);
      expect(recipe.duration_seconds).toBeGreaterThanOrEqual(120);expect(recipe.duration_seconds).toBeLessThanOrEqual(600);
      if (!recipe.equipment_output) expect(recipeValueAdded(recipe)).toBeLessThanOrEqual(34);
    }
  });
  it('scales bounded batches, station timing and every actual input without free outputs', () => {
    const quote=productionQuote(RECIPE_BY_KEY.smelt_copper,10,3);
    expect(quote).toEqual({inputs:{coal:20,copper_ore:100},outputs:{copper_bar:20},cash_cost:80,equipment_outputs:[],duration_seconds:1260});
    expect(()=>productionQuote(RECIPE_BY_KEY.smelt_copper,0,1)).toThrow();expect(()=>productionQuote(RECIPE_BY_KEY.smelt_copper,11,1)).toThrow();
    expect(()=>productionQuote(RECIPE_BY_KEY.craft_iron_pickaxe,1,1)).toThrow(/Upgrade/);
  });
  it('can build a smelter, smelt real starter copper/coal and craft a pickaxe without buying inputs', () => {
    let cash=180-3-90-3; // solo tutorial wages, smelter, solo copper extraction wages
    let stock:DeepClaimResources={coal:10,stone:12,copper_ore:18};
    for (const key of ['smelt_copper','craft_copper_pickaxe']) {
      const quote=productionQuote(RECIPE_BY_KEY[key],1,1);cash-=quote.cash_cost;
      for (const [id,count] of Object.entries(quote.inputs)) { expect(stock[id as keyof typeof stock]??0).toBeGreaterThanOrEqual(count!);stock={...stock,[id]:(stock[id as keyof typeof stock]??0)-count!}; }
      for (const [id,count] of Object.entries(quote.outputs)) stock={...stock,[id]:(stock[id as keyof typeof stock]??0)+count!};
    }
    expect(cash).toBe(56);expect(stock).toMatchObject({coal:8,stone:8,copper_ore:8,copper_bar:1});
    expect(RESOURCE_BY_ID.copper_bar.sell_price).toBe(55);
  });
  it('bounds queued jobs to three while allowing a real later start on a serialized station lane', () => {
    const snapshot=phaseTwoSnapshot();snapshot.production_jobs=[job('a'),job('b'),job('c')];
    for (let i=0;i<3;i++) { snapshot.production_jobs[i].started_at=new Date(Date.parse(snapshot.server_now)+i*180_000).toISOString();snapshot.production_jobs[i].completes_at=new Date(Date.parse(snapshot.server_now)+(i+1)*180_000).toISOString(); }
    expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();snapshot.production_jobs.push(job('d'));expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/queue/);
  });
  it('detects altered recipe rules, wrong station timing and negative staged outputs', () => {
    const timing=phaseTwoSnapshot();timing.recipes![0].effective_duration_seconds=1;expect(()=>validateDeepClaimSnapshot(timing)).toThrow(/timing/);
    const staged=phaseTwoSnapshot();staged.production_jobs=[job()];staged.production_jobs[0].outputs.copper_bar=-1;expect(()=>validateDeepClaimSnapshot(staged)).toThrow(/quantities/);
    const rule=phaseTwoSnapshot();rule.recipes![0].outputs.copper_bar=100;expect(()=>validateDeepClaimSnapshot(rule)).toThrow(/quantities/);
    const forged=phaseTwoSnapshot();forged.production_jobs=[job()];forged.production_jobs[0].outputs.gold_ore=100;expect(()=>validateDeepClaimSnapshot(forged)).toThrow(/quantities/);
    const charged=phaseTwoSnapshot();charged.production_jobs=[job()];charged.production_jobs[0].cash_cost=0;expect(()=>validateDeepClaimSnapshot(charged)).toThrow(/quantities/);
    const doubled=phaseTwoSnapshot();doubled.workers[0].stats.mining++;expect(()=>validateDeepClaimSnapshot(doubled)).toThrow(/once/);
  });
});
