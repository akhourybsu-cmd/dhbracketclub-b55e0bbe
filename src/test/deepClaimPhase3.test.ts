import { describe, expect, it } from 'vitest';
import { FIELD_CATALOG, RESOURCE_BY_ID, buildingBenefits, buildingEffect, resourceSaleValue } from '@/lib/deepClaim/catalog';
import { applicableInfrastructure, discoverySpecimen, fieldConditions, infrastructureQuote, railStageSeconds, routeTransportBonus, salvageFits, selectSurveyTiles, surveyPlan } from '@/lib/deepClaim/field';
import { calculateCrewPlan, retainsOperatingCapital } from '@/lib/deepClaim/simulation';
import { equipmentAfterCompletedJob } from '@/lib/deepClaim/production';
import { validateDeepClaimSnapshot, validateDeepClaimPreview, validateDeepClaimWorld } from '@/lib/deepClaim/world';
import type { DeepClaimDiscovery, DeepClaimInfrastructure, DeepClaimPreview } from '@/lib/deepClaim/types';
import { companySnapshot } from './fixtures/deepClaim';
import { phaseTwoSnapshot } from './fixtures/deepClaimPhase2';
import { phaseThreeSnapshot } from './fixtures/deepClaimPhase3';

const target={x:48,y:100}, route=[{x:48,y:0},{x:48,y:90},{x:48,y:100}];
function structure(key:DeepClaimInfrastructure['key'],id:string=key,grade=1):DeepClaimInfrastructure {
  const quote=infrastructureQuote(key,grade===1?20:grade===2?60:180,50);
  return {...quote.installation,id,x:48,y:100,status:'installed',job_id:'historical-job',installed_at:'2026-11-01T10:00:00Z'};
}
function specimen(id='find-a',quality:DeepClaimDiscovery['quality']='common'):DeepClaimDiscovery {
  const {mass_grams:_,...details}=discoverySpecimen('banded_geode',quality);
  return {...details,id,x:47,y:3,job_id:'historical-job',kind:'banded_geode',quality,status:'pending',discovered_at:'2026-11-01T10:00:00Z',resolved_at:null};
}
function preview():DeepClaimPreview {
  return {allowed:true,reasons:[],company_revision:3,server_now:'2026-11-01T12:00:00Z',wages:2,energy_per_worker:1,duration_seconds:1200,estimated_yield:{min:0,max:0},route,cargo_capacity:60,risk_level:'moderate',accessible_depth:149,expected_resources:[],projected_completion_at:'2026-11-01T12:20:00Z',stages:[],operation_version:3,operation_cost:0,materials_cost:{},conditions:fieldConditions({depth:100,safety:50,energy:1,target,route,infrastructure:[]}),survey:surveyPlan(20,50),installation:null};
}

describe('Deep Claim version3 public contract and preservation',()=>{
  it('reads schema1,2,3 without changing any prior persistent terrain or worker identity',()=>{
    for(const snapshot of [companySnapshot(),phaseTwoSnapshot(),phaseThreeSnapshot()]) expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
    const old=phaseTwoSnapshot(), next=phaseThreeSnapshot();
    expect(next.company!.id).toBe(old.company!.id);expect(next.workers).toEqual(old.workers);
    expect(next.world!.tiles.map(({formation:_,...tile})=>tile)).toEqual(old.world!.tiles);
    expect(next.resources).toEqual(old.resources);
  });
  it('accepts canonical catalogs at the fresh revision-zero boundary and rejects fabricated field state',()=>{
    const fresh=phaseThreeSnapshot(0);fresh.company=null;fresh.world=null;fresh.resources={};fresh.workers=[];fresh.expeditions=[];fresh.buildings=[];fresh.log=[];
    expect(()=>validateDeepClaimSnapshot(fresh)).not.toThrow();
    fresh.infrastructure=[structure('supports')];expect(()=>validateDeepClaimSnapshot(fresh)).toThrow(/setup state/);
    const wrongVersion=phaseThreeSnapshot();Object.assign(wrongVersion,{schema_version:'3'});expect(()=>validateDeepClaimSnapshot(wrongVersion)).toThrow();
    const missing=phaseThreeSnapshot();delete missing.field_reports;expect(()=>validateDeepClaimSnapshot(missing)).toThrow();
    const catalog=phaseThreeSnapshot();catalog.field_catalog!.hazards.chance_cap=100;expect(()=>validateDeepClaimSnapshot(catalog)).toThrow(/catalog/);
  });
  it('accepts actual formations and legacy null/absent values while rejecting hidden terrain and processed minerals',()=>{
    const snapshot=phaseThreeSnapshot();
    for(const formation of [undefined,null,'cavern','wet_cavern','crystal_cavern','ruins'] as const){snapshot.world!.tiles[0].formation=formation;expect(()=>validateDeepClaimWorld(snapshot.world)).not.toThrow();}
    Object.assign(snapshot.world!.tiles[0],{formation:'undiscovered_room'});expect(()=>validateDeepClaimWorld(snapshot.world)).toThrow();
    Object.assign(snapshot.world!.tiles[0],{formation:null,seed:'private'});expect(()=>validateDeepClaimWorld(snapshot.world)).toThrow();
  });
  it('extends only version3 shaft levels to599m and requires actual matching company depth',()=>{
    const snapshot=phaseThreeSnapshot(),shaft=snapshot.buildings.find(b=>b.key==='mine_shaft')!;shaft.level=5;snapshot.world!.max_depth=599;
    expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();expect(buildingBenefits('mine_shaft',5)).toEqual({max_depth:599,shaft_depth:556});expect(buildingEffect('mine_shaft',5)).toContain('599');
    const old=phaseTwoSnapshot();old.buildings.find(b=>b.key==='mine_shaft')!.level=5;expect(()=>validateDeepClaimSnapshot(old)).toThrow(/building/);
  });
  it('requires all quote fields together and rejects private incident rolls and future event payloads',()=>{
    const quote=preview();expect(()=>validateDeepClaimPreview(quote)).not.toThrow();
    Object.assign(quote.conditions!,{incident_roll:12});expect(()=>validateDeepClaimPreview(quote)).toThrow(/conditions/);
    const missing=preview();delete missing.installation;expect(()=>validateDeepClaimPreview(missing)).toThrow();
    const legacy=preview();for(const key of ['operation_version','operation_cost','materials_cost','conditions','survey','installation'] as const) delete legacy[key];expect(()=>validateDeepClaimPreview(legacy)).not.toThrow();
  });
});

describe('Deep Claim survey and infrastructure deterministic arithmetic',()=>{
  it('makes geology and ore-eye traits useful with bounded duration grades',()=>{
    expect(surveyPlan(20,34)).toEqual({radius:1,tile_limit:11});expect(surveyPlan(20,82,1)).toEqual({radius:2,tile_limit:18});
    expect(surveyPlan(180,100,3)).toEqual({radius:4,tile_limit:40});expect(surveyPlan(60,50)).toEqual({radius:3,tile_limit:21});
  });
  it('reveals unknown cells only, clipped to the map in stable Manhattan/distance/x/y order',()=>{
    const points=selectSurveyTiles({x:0,y:1},[{x:0,y:1}],2,{radius:2,tile_limit:41});
    expect(points).toEqual([{x:0,y:2},{x:1,y:1},{x:1,y:2},{x:2,y:1}]);
    expect(selectSurveyTiles({x:0,y:1},[{x:0,y:1},...points],2,{radius:2,tile_limit:41})).toEqual([]);
    expect(selectSurveyTiles({x:48,y:100},[],599,{radius:4,tile_limit:10})).toHaveLength(10);
  });
  it('multiplies real project fees/materials by grade and freezes engineering into radius/strength',()=>{
    expect(infrastructureQuote('supports',20,49)).toEqual({installation:{key:'supports',grade:1,radius:6,strength:6},cash_cost:12,materials:{stone:8,clay:2}});
    expect(infrastructureQuote('supports',180,100)).toEqual({installation:{key:'supports',grade:3,radius:12,strength:13},cash_cost:36,materials:{stone:24,clay:6}});
    expect(infrastructureQuote('rail',180,100).installation.strength).toBe(40);
    for(const definition of FIELD_CATALOG.infrastructure) expect(infrastructureQuote(definition.key,60,50).cash_cost).toBe(definition.cash_cost*2);
  });
  it('does not stack same-type coverage, excludes building projects, and requires actual rail route intersection',()=>{
    const a=structure('supports','a'),b=structure('supports','b',3), rail=structure('rail'),building={...structure('pump'),status:'building' as const,installed_at:null};
    expect(applicableInfrastructure(target,route,[a,b,rail,building]).map(item=>item.id)).toEqual(['b','rail']);
    expect(applicableInfrastructure(target,[{x:0,y:0}],[rail])).toEqual([]);
    expect(applicableInfrastructure({x:0,y:100},route,[a])).toEqual([]);
    expect(fieldConditions({depth:100,safety:50,energy:1,target,route,infrastructure:[{...a,id:'z-support'},{...rail,id:'a-rail'}]}).infrastructure_ids).toEqual(['a-rail','z-support']);
  });
  it('weights rail strength by actual covered route points and never stacks overlapping rail',()=>{
    const points=Array.from({length:101},(_,y)=>({x:48,y})), entrance={...structure('rail','entrance'),y:1};
    expect(routeTransportBonus(points,[entrance])).toBe(Math.floor(entrance.strength*9/101));
    const deep=structure('rail','deep',3);expect(routeTransportBonus(points,[entrance,deep])).toBeGreaterThan(routeTransportBonus(points,[entrance]));
    expect(routeTransportBonus(points,[entrance,{...entrance,id:'duplicate'}])).toBe(routeTransportBonus(points,[entrance]));
    expect(routeTransportBonus([],[])).toBe(0);
  });
  it('rail shortens travel/return and frees real work/output within the same preset without altering old calculations',()=>{
    const input={workers:[phaseThreeSnapshot().workers[0]],mode:'extract' as const,duration_minutes:20 as const,path_edges:70,target_depth:100,tool_level:1,material:'iron_ore' as const,remaining:1000};
    const base=calculateCrewPlan(input),rail=calculateCrewPlan({...input,transport_bonus_percent:35});
    expect(rail.work_seconds).toBeGreaterThan(base.work_seconds);expect(rail.quantity).toBeGreaterThanOrEqual(base.quantity);expect(rail.stages.reduce((n,s)=>n+s.duration_seconds,0)).toBe(1200);
    expect(calculateCrewPlan({...input,transport_bonus_percent:0})).toEqual(base);
    expect(railStageSeconds(21,40)).toBe(20);expect(railStageSeconds(101,15)).toBe(86);
  });
  it('survey and infrastructure consume real wages/energy while minting no ore or cargo',()=>{
    const worker=phaseThreeSnapshot().workers[0];
    for(const mode of ['survey','infrastructure'] as const){const plan=calculateCrewPlan({workers:[worker],mode,duration_minutes:60,path_edges:10,target_depth:50,tool_level:1});expect(plan.quantity).toBe(0);expect(plan.mining_capacity).toBe(0);expect(plan.wages).toBe(4);expect(plan.energy_per_worker).toBe(2);}
    expect(retainsOperatingCapital(2,2,{},{})).toBe(false);expect(retainsOperatingCapital(2,2,{stone:2},{})).toBe(true);
  });
});

describe('Deep Claim delay-only hazard protections',()=>{
  it('bounds public chance/delay and makes tutorial, shallow sites and protected jobs safe',()=>{
    for(let depth=0;depth<=599;depth++)for(const energy of [1,2,3]){const conditions=fieldConditions({depth,safety:1,energy,target:{x:48,y:Math.max(1,depth)},route,infrastructure:[]});expect(conditions.incident_chance_percent).toBeLessThanOrEqual(25);expect(conditions.max_delay_seconds).toBeLessThanOrEqual(300);if(depth<8)expect(conditions.incident_chance_percent).toBe(0);}
    expect(fieldConditions({depth:599,safety:1,energy:3,target,route,infrastructure:[structure('rail')],tutorial:true})).toMatchObject({max_delay_seconds:0,transport_bonus_percent:0,infrastructure_ids:[]});
    expect(fieldConditions({depth:100,safety:50,energy:1,target,route,infrastructure:[structure('supports'),structure('ventilation'),structure('pump')]}).incident_chance_percent).toBe(0);
  });
  it('applies mitigation only to present hazard types and does not multiply equipment wear for a delay',()=>{
    const shallow={depth:20,safety:1,energy:1,target,route,infrastructure:[structure('ventilation'),structure('pump')]};
    expect(fieldConditions(shallow).infrastructure_ids).toEqual([]);
    const base=fieldConditions({...shallow,infrastructure:[]});expect(fieldConditions(shallow).incident_chance_percent).toBe(base.incident_chance_percent);
    expect(equipmentAfterCompletedJob({durability:100},3,3)).toBe(94);expect(equipmentAfterCompletedJob({durability:100},3,2)).toBe(94);expect(equipmentAfterCompletedJob({durability:100},3,1)).toBe(100);
  });
});

describe('Deep Claim finite recovered discoveries and decisions',()=>{
  it('publishes six depth-appropriate kinds and four qualities with bounded values and no salvage arbitrage',()=>{
    expect(FIELD_CATALOG.discoveries).toHaveLength(6);expect(FIELD_CATALOG.qualities.reduce((n,q)=>n+q.weight,0)).toBe(100);
    for(const definition of FIELD_CATALOG.discoveries)for(const quality of FIELD_CATALOG.qualities){const find=discoverySpecimen(definition.key,quality.key);expect(find.sale_value).toBeGreaterThanOrEqual(15);expect(find.sale_value).toBeLessThanOrEqual(500);expect(resourceSaleValue(find.salvage)).toBeLessThanOrEqual(find.sale_value);expect(find.detail).toContain(`${find.mass_grams} g`);for(const key of Object.keys(find.salvage))expect(RESOURCE_BY_ID).toHaveProperty(key);}
  });
  it('requires whole salvage capacity and never partially consumes a find',()=>{
    const salvage=discoverySpecimen('banded_geode','common').salvage;
    expect(salvageFits({stone:116},salvage,120)).toBe(false);expect(salvageFits({stone:115},salvage,120)).toBe(true);
  });
  it('accepts frozen public specimens/reports without requiring bounded old jobs still visible and rejects false values/future results',()=>{
    const snapshot=phaseThreeSnapshot();snapshot.discoveries=[specimen()];snapshot.discovery_summary!.pending=1;expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
    snapshot.discoveries[0].sale_value=500;expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/definition/);
    const report=phaseThreeSnapshot();report.field_reports=[{id:'report',job_id:'old-hidden-job',kind:'survey',title:'Survey complete',description:'Known map extended.',point:{x:48,y:100},occurred_at:'2026-11-01T10:00:00Z',delay_seconds:0,tiles_revealed:18,infrastructure_id:null,discovery_id:null}];expect(()=>validateDeepClaimSnapshot(report)).not.toThrow();
    report.field_reports[0].occurred_at='2099-01-01T10:00:00Z';expect(()=>validateDeepClaimSnapshot(report)).toThrow(/report/);
  });
  it('requires complete pending finds and bounded kept/resolved windows consistent with full summary',()=>{
    const snapshot=phaseThreeSnapshot();snapshot.discovery_summary!.pending=1;expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/summary/);
    snapshot.discoveries=[specimen()];expect(()=>validateDeepClaimSnapshot(snapshot)).not.toThrow();
    snapshot.discoveries.push({...specimen('find-b'),x:46});expect(()=>validateDeepClaimSnapshot(snapshot)).toThrow(/summary/);
  });
});
