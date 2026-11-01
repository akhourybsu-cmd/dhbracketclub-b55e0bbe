/** Public v3 arithmetic for explanation/tests. SQL freezes every operation and alone grants state. */
import { DISCOVERY_BY_KEY, DISCOVERY_QUALITY_BY_KEY, FIELD_CATALOG, INFRASTRUCTURE_BY_KEY, resourceTotal } from './catalog';
import type { DeepClaimConditions, DeepClaimDiscoveryKind, DeepClaimDiscoveryQuality, DeepClaimDuration, DeepClaimInfrastructure, DeepClaimInfrastructureKey, DeepClaimInstallation, DeepClaimPoint, DeepClaimResources, DeepClaimSurvey } from './types';

function whole(value: number, min=0, max=Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || value<min || value>max) throw new Error('Invalid Deep Claim field input.');
  return value;
}
export function operationGrade(minutes: DeepClaimDuration): number {
  if (![20,60,180].includes(minutes)) throw new Error('Unsupported field duration.');
  return minutes===20 ? 1 : minutes===60 ? 2 : 3;
}
export function surveyPlan(minutes: DeepClaimDuration, geology: number, oreEyes=0): DeepClaimSurvey {
  const grade=operationGrade(minutes); whole(geology,1,100); whole(oreEyes,0,3);
  return { radius:Math.min(4,grade+Math.floor(geology/50)), tile_limit:Math.min(41,grade*8+Math.floor(geology/10)+2*oreEyes) };
}
/** Stable unknown-only selection. Callers must independently authorize the depleted, connected site. */
export function selectSurveyTiles(target: DeepClaimPoint, known: readonly DeepClaimPoint[], maxDepth: number, plan: DeepClaimSurvey): DeepClaimPoint[] {
  whole(target.x,0,95); whole(target.y,1); whole(maxDepth,1); whole(plan.radius,1,4); whole(plan.tile_limit,1,41);
  const seen=new Set(known.map(point=>`${point.x}:${point.y}`)), candidates:DeepClaimPoint[]=[];
  for(let x=Math.max(0,target.x-plan.radius);x<=Math.min(95,target.x+plan.radius);x++) for(let y=Math.max(1,target.y-plan.radius);y<=Math.min(maxDepth,target.y+plan.radius);y++) {
    if(Math.abs(x-target.x)+Math.abs(y-target.y)<=plan.radius && !seen.has(`${x}:${y}`)) candidates.push({x,y});
  }
  return candidates.sort((a,b)=>(Math.abs(a.x-target.x)+Math.abs(a.y-target.y))-(Math.abs(b.x-target.x)+Math.abs(b.y-target.y)) || a.x-b.x || a.y-b.y).slice(0,plan.tile_limit);
}
export function infrastructureQuote(key:DeepClaimInfrastructureKey, minutes:DeepClaimDuration, engineering:number): { installation:DeepClaimInstallation; cash_cost:number; materials:DeepClaimResources } {
  whole(engineering,1,100);
  const grade=operationGrade(minutes), definition=INFRASTRUCTURE_BY_KEY[key];
  if(!definition) throw new Error('Unknown infrastructure.');
  return { installation:{ key,grade,radius:6+2*(grade-1)+Math.floor(engineering/50),
    strength:key==='rail' ? Math.min(40,5+10*grade+Math.floor(engineering/20)) : 3+2*grade+Math.floor(engineering/25) },
    cash_cost:definition.cash_cost*grade, materials:Object.fromEntries(Object.entries(definition.materials).map(([id,count])=>[id,count!*grade])) };
}
const distance=(a:DeepClaimPoint,b:DeepClaimPoint)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
/** Building records have no effect. Same-type hazard protection never stacks.
 * Rails are selected per actual route point so a short entrance track cannot
 * discount an entire deep expedition. Ties choose stable IDs.
 */
export function applicableInfrastructure(target:DeepClaimPoint, route:readonly DeepClaimPoint[], installed:readonly DeepClaimInfrastructure[]): DeepClaimInfrastructure[] {
  const strongest=(items:DeepClaimInfrastructure[])=>items.sort((a,b)=>b.strength-a.strength || a.id.localeCompare(b.id))[0];
  const result=FIELD_CATALOG.infrastructure.filter(definition=>definition.key!=='rail').flatMap(definition=> {
    const best=strongest(installed.filter(item=>item.key===definition.key && item.status==='installed' && distance(target,item)<=item.radius));
    return best?[best]:[];
  });
  const rails=new Map<string,DeepClaimInfrastructure>();
  for(const point of route){const best=strongest(installed.filter(item=>item.key==='rail' && item.status==='installed' && distance(point,item)<=item.radius));if(best)rails.set(best.id,best);}
  return [...result,...[...rails.values()].sort((a,b)=>a.id.localeCompare(b.id))];
}
export function routeTransportBonus(route:readonly DeepClaimPoint[], installed:readonly DeepClaimInfrastructure[]):number {
  if(route.length===0)return 0;
  const sum=route.reduce((total,point)=>total+installed.filter(item=>item.key==='rail' && item.status==='installed' && distance(point,item)<=item.radius).reduce((best,item)=>Math.max(best,item.strength),0),0);
  return Math.min(40,Math.floor(sum/route.length));
}
export function fieldConditions(input:{depth:number;safety:number;energy:number;target:DeepClaimPoint;route:readonly DeepClaimPoint[];infrastructure:readonly DeepClaimInfrastructure[];tutorial?:boolean}):DeepClaimConditions {
  const depth=whole(input.depth), safety=whole(input.safety,1,100), energy=whole(input.energy,1,3);
  const applicable=applicableInfrastructure(input.target,input.route,input.infrastructure), strength=(key:DeepClaimInfrastructureKey)=>applicable.find(item=>item.key===key)?.strength??0;
  const instability=Math.min(3,1+Math.floor(depth/100)), gas=depth<50?0:Math.min(3,1+Math.floor(depth/150)), water=depth<100?0:Math.min(3,1+Math.floor((depth-100)/150));
  const chance=input.tutorial || depth<8 ? 0 : Math.max(0,Math.min(25,4+Math.floor(depth/25)+2*instability+gas+water)-Math.floor(safety/10)-strength('supports')-(gas>0?strength('ventilation'):0)-(water>0?strength('pump'):0));
  const used=applicable.filter(item=>item.key==='rail' && !input.tutorial || item.key==='supports' && instability>0 || item.key==='ventilation' && gas>0 || item.key==='pump' && water>0);
  return {instability,gas,water,incident_chance_percent:chance,max_delay_seconds:chance?Math.min(300,60*energy+Math.floor(depth/10)):0,
    transport_bonus_percent:input.tutorial ? 0 : routeTransportBonus(input.route,input.infrastructure), infrastructure_ids:[...new Set(used.map(item=>item.id))].sort()};
}
export function railStageSeconds(baseSeconds:number, bonusPercent:number):number {
  whole(baseSeconds,1);whole(bonusPercent,0,40); return Math.max(20,Math.ceil(baseSeconds*(100-bonusPercent)/100));
}
/** No random roll here: this formats an already server-selected definition and quality. */
export function discoverySpecimen(kind:DeepClaimDiscoveryKind, quality:DeepClaimDiscoveryQuality): {name:string;detail:string;sale_value:number;salvage:DeepClaimResources;mass_grams:number} {
  const definition=DISCOVERY_BY_KEY[kind], grade=DISCOVERY_QUALITY_BY_KEY[quality];
  if(!definition || !grade) throw new Error('Unknown recovered specimen.');
  const mass_grams=Math.floor(definition.base_mass_grams*grade.mass_percent/100);
  return {name:definition.name, detail:`${definition.description} Mass: ${mass_grams} g.`, mass_grams,
    sale_value:Math.min(500,Math.max(15,Math.floor(definition.base_value*grade.value_percent/100))),
    salvage:Object.fromEntries(Object.entries(definition.salvage).map(([id,count])=>[id,count!*grade.salvage_multiplier]))};
}
/** Salvage is atomic; no partial transfer or consumed find when the full output does not fit. */
export function salvageFits(inventory:DeepClaimResources, salvage:DeepClaimResources, capacity:number):boolean {
  whole(capacity,1);return resourceTotal(inventory)+resourceTotal(salvage)<=capacity;
}
