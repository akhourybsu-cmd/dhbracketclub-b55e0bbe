import type {DeepClaimSnapshot} from '../types';
import type {GusAdvice,TutorialContext} from './types';
import {tutorialSnapshot} from './completion';
/** Gus reads only already returned public company facts. Never predicts ore, private plans or rolls. */
export function getGusAdvice(snapshot:DeepClaimSnapshot|null,context?:TutorialContext):GusAdvice[]{
 const source=context?tutorialSnapshot({...context,snapshot}):snapshot;
 if(!source?.company)return [{id:'sign_deed',priority:100,title:'Read before you sign',text:'Start with a company name and the actual founding review. If you already own this claim, Continue opens that save; it never makes a second one.',speaker:'gus',expression:'amused',lesson_id:'beginner.claim',open:{type:'found_company'},source:'general_reference'}];
 const advice:GusAdvice[]=[];
 const add=(item:Omit<GusAdvice,'speaker'|'source'>)=>advice.push({...item,speaker:'gus',source:'public_snapshot'});
 const company=source.company;
 const ready=source.expeditions.filter(job=>job.status==='ready'&&Object.values(job.cargo??{}).some(value=>(value??0)>0));
 if(ready.length)add({id:'ready_haul',priority:100,title:'Something to bring home',text:`${ready.length===1?'A returned haul is':`${ready.length} returned hauls are`} waiting. Review the actual cargo and warehouse space before collecting. A partial transfer keeps the rest safe.`,expression:'proud',lesson_id:'beginner.haul',open:{type:'tab',tab:'surface'}});
 if(company.warehouse_used>=company.warehouse_capacity*.85)add({id:'storage',priority:95,title:'Mind the doorway',text:`Your warehouse holds ${company.warehouse_used} of ${company.warehouse_capacity} units. Compare selling, planned inputs or a real storage upgrade; I won’t throw anything away for you.`,expression:'concerned',lesson_id:'industry.warehouse',open:{type:'tab',tab:'stores',view:'stock'}});
 if(source.production_jobs?.some(job=>job.status==='ready'))add({id:'ready_production',priority:90,title:'Finished, not yet owned',text:'A production order is ready. Its output remains staged until a confirmed collection transfers it. Check storage and equipment room first.',expression:'proud',lesson_id:'industry.queues',open:{type:'tab',tab:'stores',view:'workshop'}});
 if(source.equipment?.some(item=>item.worker_id&&item.durability===0))add({id:'broken_gear',priority:85,title:'That tool has earned a rest',text:'An assigned item is broken. It supplies no working bonus to future plans. Review a real repair or an idle-worker loadout change; active jobs keep their frozen plan.',expression:'concerned',lesson_id:'workforce.repairs',open:{type:'worker',view:'gear'}});
 const idle=source.workers.filter(worker=>worker.assigned_job_id===null&&worker.energy>0);
 if(!idle.length)add({id:'crew_busy',priority:80,title:'Let the crew finish',text:'No rested idle employee is currently available. Paid work keeps its server clock, and daily energy resets on the company-local day. Refreshing does not make a second shift free.',expression:'neutral',lesson_id:'beginner.waiting',open:{type:'tab',tab:'crew'}});
 if(company.cash<10)add({id:'liquidity',priority:75,title:'Keep wages in reach',text:`You currently have ${company.cash} company credits. Review collected stock and upcoming wages before a commitment; a staged haul or an unclaimed reward is not available cash.`,expression:'concerned',lesson_id:'business.strategy',open:{type:'tab',tab:'stores',view:'stock'}});
 if((source.discovery_summary?.pending??0)>0)add({id:'discovery',priority:70,title:'A decision worth reading',text:'A recovered discovery awaits a decision. Keep, Sell and Salvage are permanent alternatives. Review its actual frozen value and goods; I will not choose or publish it for you.',expression:'excited',lesson_id:'field.discoveries',open:{type:'tab',tab:'log',view:'finds'}});
 if(source.business?.research.some(order=>order.status==='active'))add({id:'research_running',priority:60,title:'Knowledge takes its own time',text:'A paid research order is active. It completes when the server clock is due; its benefit applies to future work. Existing jobs do not get rewritten.',expression:'neutral',lesson_id:'business.research',open:{type:'office',view:'research'}});
 const knownDeep=source.world?.tiles.some(tile=>tile.y>=600)===true;
 if(knownDeep)add({id:'deep_heat',priority:55,title:'Prepare for the heat',text:'Your revealed map includes Ancient Deep ground. Read the actual quote: Engineering, installed ventilation and working assigned shields reduce productive heat. A deep destination alone guarantees no ore.',expression:'concerned',lesson_id:'field.hazards',open:{type:'dispatch'}});
 add({id:'next_decision',priority:10,title:'Read the next constraint',text:'Compare current cash, rested people, known connected ground and useful stock. A good next step solves the constraint you actually have. The Training Journal is here when you want another perspective.',expression:'amused',lesson_id:'business.strategy',open:{type:'journal',lesson_id:'business.strategy'}});
 return advice.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).slice(0,6);
}
export const getAdvice=getGusAdvice;
