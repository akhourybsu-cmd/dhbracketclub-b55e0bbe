/** Explanatory business arithmetic; authoritative payments and progress use the secured dc_* RPCs. */
import { BUSINESS_CATALOG, CONTRACT_BY_KEY, RESEARCH_BY_KEY, resourceSaleValue, resourceTotal } from './catalog';
import { DEEP_CLAIM_RESOURCE_IDS, DEEP_CLAIM_STAT_IDS, type DeepClaimBusinessStats, type DeepClaimContractDefinition, type DeepClaimResearchDefinition, type DeepClaimResources, type DeepClaimStats } from './types';
function integer(value:number,min=0,max=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error('Invalid company business input.');return value;}
export function researchEffects(completed:readonly string[]):{stat_bonuses:Partial<DeepClaimStats>;processing_speed_percent:number}{
 const bonuses:Partial<DeepClaimStats>={};let speed=0;
 for(const key of new Set(completed)){const node=RESEARCH_BY_KEY[key];if(!node)throw new Error('Unknown company research.');speed+=node.processing_speed_percent;for(const stat of DEEP_CLAIM_STAT_IDS){const bonus=node.stat_bonuses[stat]??0;if(bonus)bonuses[stat]=(bonuses[stat]??0)+bonus;}}
 return {stat_bonuses:bonuses,processing_speed_percent:Math.min(15,speed)};
}
export function applyResearchBonuses(effective:DeepClaimStats,bonuses:Partial<DeepClaimStats>):DeepClaimStats{
 return Object.fromEntries(DEEP_CLAIM_STAT_IDS.map(stat=>[stat,Math.min(100,integer(effective[stat],1,100)+integer(bonuses[stat]??0,0,10))])) as DeepClaimStats;
}
export function resourceShortfalls(owned:DeepClaimResources,needed:DeepClaimResources):DeepClaimResources{
 const missing:DeepClaimResources={};for(const id of DEEP_CLAIM_RESOURCE_IDS){const short=Math.max(0,integer(needed[id]??0)-integer(owned[id]??0));if(short)missing[id]=short;}return missing;
}
export function researchEligibility(node:DeepClaimResearchDefinition,input:{completed:readonly string[];active:boolean;office_level:number;cash:number;resources:DeepClaimResources}):string[]{
 const reasons:string[]=[];
 if(input.completed.includes(node.key))reasons.push('This research is already completed.');
 if(input.active)reasons.push('Complete the active research project first.');
 if(integer(input.office_level,0,2)<node.required_building_level)reasons.push(`Requires Research Office level ${node.required_building_level}.`);
 if(node.requires.some(key=>!input.completed.includes(key)))reasons.push('Complete the prerequisite research first.');
 if(integer(input.cash)-node.cash_cost<2)reasons.push('Keep $2 operating cash after research.');
 if(resourceTotal(resourceShortfalls(input.resources,node.inputs)))reasons.push('Not enough collected materials for this research.');
 return reasons;
}
export function contractEligibility(contract:DeepClaimContractDefinition,input:{completed_contracts:readonly string[];completed_research:readonly string[];trading_level:number;resources:DeepClaimResources}):string[]{
 const reasons:string[]=[];
 if(input.completed_contracts.includes(contract.key))reasons.push('This delivery order is already completed.');
 if(integer(input.trading_level,0,3)<contract.tier)reasons.push(`Requires Trading Post level ${contract.tier}.`);
 if(contract.requires_contracts.some(key=>!input.completed_contracts.includes(key)))reasons.push('Complete the preceding delivery orders first.');
 if(contract.required_research.some(key=>!input.completed_research.includes(key)))reasons.push('Complete the required research first.');
 if(resourceTotal(resourceShortfalls(input.resources,contract.inputs)))reasons.push('Collect the complete order before delivery.');
 return reasons;
}
/** Full atomic delivery model. Staged cargo must never be passed as owned inventory. */
export function fulfillContract(owned:DeepClaimResources,cash:number,key:string):{resources:DeepClaimResources;cash:number;reward:number}{
 const contract=CONTRACT_BY_KEY[key];if(!contract)throw new Error('Unknown delivery order.');
 if(resourceTotal(resourceShortfalls(owned,contract.inputs)))throw new Error('The complete collected order is required.');
 const resources={...owned};for(const id of DEEP_CLAIM_RESOURCE_IDS)if(contract.inputs[id])resources[id]=(owned[id]??0)-contract.inputs[id]!;
 return {resources,cash:integer(cash)+contract.reward,reward:contract.reward};
}
export function contractPremium(contract:DeepClaimContractDefinition):number{return contract.reward-resourceSaleValue(contract.inputs);}
export function businessProgress(stats:DeepClaimBusinessStats):Record<string,number>{
 return Object.fromEntries(BUSINESS_CATALOG.milestones.map(milestone=>[milestone.key,Math.min(milestone.target,integer(stats[milestone.metric]))]));
}
/** Catalog proof: dependency graphs, concrete resource costs, reachable industry and finite rewards. */
export function validateBusinessCatalog():void{
 const visit=(key:string,get:(key:string)=>readonly string[]|undefined,done=new Set<string>(),visiting=new Set<string>())=>{
  if(done.has(key))return;if(visiting.has(key))throw new Error('Company development dependency cycle.');const dependencies=get(key);if(!dependencies)throw new Error('Unknown company dependency.');visiting.add(key);for(const dependency of dependencies)visit(dependency,get,done,visiting);visiting.delete(key);done.add(key);
 };
 for(const node of BUSINESS_CATALOG.research){visit(node.key,key=>RESEARCH_BY_KEY[key]?.requires);if(node.tier===2&&!node.requires.includes(`${node.branch}_1`))throw new Error('Advanced research requires its first tier.');}
 for(const contract of BUSINESS_CATALOG.contracts){visit(contract.key,key=>CONTRACT_BY_KEY[key]?.requires_contracts);if(contract.required_research.some(key=>!RESEARCH_BY_KEY[key]))throw new Error('Unknown contract research.');const value=resourceSaleValue(contract.inputs);if(contract.reward<=value||contract.reward*100>value*120)throw new Error('Delivery premium exceeds its bounded input value.');}
 if(BUSINESS_CATALOG.milestones.reduce((sum,milestone)=>sum+milestone.reward,0)>600)throw new Error('Company milestones exceed the finite credit budget.');
 for(const recipe of BUSINESS_CATALOG.recipes){if(recipe.required_research?.some(key=>!RESEARCH_BY_KEY[key]))throw new Error('Unknown industry research.');if(!recipe.equipment_output){const margin=resourceSaleValue(recipe.outputs)-resourceSaleValue(recipe.inputs)-recipe.cash_cost;if(margin<=0||margin>40)throw new Error('Industrial processing margin is out of bounds.');}}
}
