import type {DeepClaimSnapshot} from '../types';
import type {GusAdvice,TutorialContext} from './types';
import {tutorialSnapshot} from './completion';
/** Gus reads only already returned public company facts. Never predicts ore, private plans or rolls. */
export function getGusAdvice(snapshot:DeepClaimSnapshot|null,context?:TutorialContext):GusAdvice[]{
 const source=context?tutorialSnapshot({...context,snapshot}):snapshot;
 if(!source?.company)return [{id:'sign_deed',priority:100,title:'Name your company',text:'Choose a name, review the deed, then sign. If you already have a company here, use Continue to pick up where you left off.',speaker:'gus',expression:'amused',lesson_id:'beginner.claim',open:{type:'found_company'},source:'general_reference'}];
 const advice:GusAdvice[]=[];
 const add=(item:Omit<GusAdvice,'speaker'|'source'>)=>advice.push({...item,speaker:'gus',source:'public_snapshot'});
 const company=source.company;
 const ready=source.expeditions.filter(job=>job.status==='ready'&&Object.values(job.cargo??{}).some(value=>(value??0)>0));
 if(ready.length)add({id:'ready_haul',priority:100,title:'Your haul is back',text:`${ready.length===1?'There’s a haul':`There are ${ready.length} hauls`} ready to collect. Check the warehouse space first; anything that doesn’t fit will stay staged.`,expression:'proud',lesson_id:'beginner.haul',open:{type:'tab',tab:'surface'}});
 if(company.warehouse_used>=company.warehouse_capacity*.85)add({id:'storage',priority:95,title:'The warehouse is filling up',text:`You’re using ${company.warehouse_used} of ${company.warehouse_capacity} storage units. You can sell some stock, use it in production or add more storage.`,expression:'concerned',lesson_id:'industry.warehouse',open:{type:'tab',tab:'stores',view:'stock'}});
 if(source.production_jobs?.some(job=>job.status==='ready'))add({id:'ready_production',priority:90,title:'A batch is ready',text:'The workshop has finished an order. Collect it when you have room for the materials or equipment.',expression:'proud',lesson_id:'industry.queues',open:{type:'tab',tab:'stores',view:'workshop'}});
 if(source.equipment?.some(item=>item.worker_id&&item.durability===0))add({id:'broken_gear',priority:85,title:'An equipped item is broken',text:'It won’t help on the next shift until it’s repaired. Open the worker’s Gear tab to review a repair or replacement.',expression:'concerned',lesson_id:'workforce.repairs',open:{type:'worker',view:'gear'}});
 const idle=source.workers.filter(worker=>worker.assigned_job_id===null&&worker.energy>0);
 if(!idle.length)add({id:'crew_busy',priority:80,title:'The crew needs time',text:'No one is free with energy to spare. Working crews will return on their own; daily energy resets at midnight on the camp clock.',expression:'neutral',lesson_id:'beginner.waiting',open:{type:'tab',tab:'crew'}});
 if(company.cash<10)add({id:'liquidity',priority:75,title:'Keep enough for wages',text:`You’ve got ${company.cash} company credits. Have a look at what you can sell before committing to another shift or upgrade.`,expression:'concerned',lesson_id:'business.strategy',open:{type:'tab',tab:'stores',view:'stock'}});
 if((source.discovery_summary?.pending??0)>0)add({id:'discovery',priority:70,title:'You’ve brought back a find',text:'Open the find to see its value and options. Keeping, selling or salvaging it is a permanent choice, so take a moment before confirming.',expression:'excited',lesson_id:'field.discoveries',open:{type:'tab',tab:'log',view:'finds'}});
 if(source.business?.research.some(order=>order.status==='active'))add({id:'research_running',priority:60,title:'Research is underway',text:'You can leave this running while you manage the camp. Once it’s complete, the benefit will apply to new work.',expression:'neutral',lesson_id:'business.research',open:{type:'office',view:'research'}});
 const knownDeep=source.world?.tiles.some(tile=>tile.y>=600)===true;
 if(knownDeep)add({id:'deep_heat',priority:55,title:'Check the heat before going deeper',text:'Check the expedition estimate. Engineering and ventilation help with the heat, as do shields that are equipped and in good condition.',expression:'concerned',lesson_id:'field.hazards',open:{type:'dispatch'}});
 add({id:'next_decision',priority:10,title:'Plan your next shift',text:'Start with a worker who has energy and a worksite you can reach. If you’re saving for something, check its cost before selling useful materials.',expression:'amused',lesson_id:'business.strategy',open:{type:'journal',lesson_id:'business.strategy'}});
 return advice.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).slice(0,6);
}
export const getAdvice=getGusAdvice;
