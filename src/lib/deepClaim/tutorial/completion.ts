import type {DeepClaimSnapshot} from '../types';
import {getTutorialLesson} from './chapters';
import {TUTORIAL_CONFIRMED_EVENT_TYPES,type TutorialCompletion,type TutorialContext,type TutorialEvent,type TutorialLesson,type TutorialLessonId,type TutorialPredicate,type TutorialScope,type TutorialStep} from './types';
export function sameTutorialScope(a:TutorialScope,b:TutorialScope):boolean{return a.user_id===b.user_id&&a.club_id===b.club_id&&a.company_id===b.company_id;}
export function tutorialSnapshot(context:TutorialContext):DeepClaimSnapshot|null{
 const snapshot=context.snapshot;if(!snapshot?.company||!context.scope.company_id)return null;
 return snapshot.company.id===context.scope.company_id&&snapshot.company.user_id===context.scope.user_id&&snapshot.company.club_id===context.scope.club_id?snapshot:null;
}
const confirmed=new Set<string>(TUTORIAL_CONFIRMED_EVENT_TYPES);
export function tutorialEventIsCurrent(event:TutorialEvent,context:TutorialContext):boolean{
 if(!sameTutorialScope(event,context.scope)||!Number.isFinite(Date.parse(event.at)))return false;
 if(!confirmed.has(event.type))return true;
 const snapshot=tutorialSnapshot(context);return !!snapshot&&Number.isSafeInteger(event.snapshot_revision)&&event.snapshot_revision!>0&&event.snapshot_revision!<=snapshot.revision;
}
function eventMatches(predicate:Extract<TutorialPredicate,{kind:'event'}>,context:TutorialContext):boolean{
 return context.events.some(event=>event.type===predicate.type&&tutorialEventIsCurrent(event,context)&&Object.entries(predicate.detail??{}).every(([key,value])=>event.detail?.[key as keyof typeof event.detail]===value)&&
  (event.type!=='crew_selected'||(event.detail?.quantity??0)>0)&&
  (event.type!=='quote_reviewed'||!!tutorialSnapshot(context)&&Number.isSafeInteger(event.detail?.company_revision)&&event.detail!.company_revision!<=tutorialSnapshot(context)!.revision)&&
  (event.type!=='haul_collected'||Object.values(event.detail?.moved??{}).some(amount=>(amount??0)>0)));
}
function snapshotFact(fact:Extract<TutorialPredicate,{kind:'snapshot'}>['fact'],context:TutorialContext):boolean{
 const snapshot=tutorialSnapshot(context);if(!snapshot)return false;
 const log=(...kinds:string[])=>snapshot.log.some(entry=>kinds.includes(entry.kind));
 const mining=snapshot.expeditions.filter(job=>job.mode==='explore'||job.mode==='extract');
 const stats=snapshot.business?.stats;
 switch(fact){
  case 'expedition_exists':return mining.length>0||(stats?.completed_mining_expeditions??0)>0||eventMatches({kind:'event',type:'expedition_confirmed'},context);
  case 'return_ready':return mining.some(job=>job.status==='ready'||job.status==='collected')||(stats?.completed_mining_expeditions??0)>0||eventMatches({kind:'event',type:'expedition_returned'},context);
  case 'cargo_collected':return log('collected')||mining.some(job=>job.tutorial&&job.status==='collected')||eventMatches({kind:'event',type:'haul_collected'},context);
  case 'sale_confirmed':return log('sold')||eventMatches({kind:'event',type:'sale_confirmed'},context);
  case 'upgrade_confirmed':return log('upgraded')||eventMatches({kind:'event',type:'upgrade_confirmed'},context);
  case 'has_hire':return snapshot.workers.length>3||log('hired')||eventMatches({kind:'event',type:'hire_confirmed'},context);
  case 'has_training':return snapshot.workers.some(worker=>!!worker.trained_day)||log('trained')||eventMatches({kind:'event',type:'training_confirmed'},context);
  case 'has_equipment':return !!snapshot.equipment?.some(item=>!!item.worker_id)||eventMatches({kind:'event',type:'equipment_confirmed'},context);
  case 'has_repair':return log('repaired')||eventMatches({kind:'event',type:'repair_confirmed'},context);
  case 'has_production':return !!snapshot.production_jobs?.length||log('production_started')||(stats?.collected_production_batches??0)>0||eventMatches({kind:'event',type:'production_confirmed'},context);
  case 'production_collected':return !!snapshot.production_jobs?.some(job=>job.status==='collected')||log('production_collected')||(stats?.collected_production_batches??0)>0||eventMatches({kind:'event',type:'production_collected'},context);
  case 'survey_completed':return (stats?.completed_surveys??0)>0||snapshot.expeditions.some(job=>job.mode==='survey'&&job.status==='collected')||eventMatches({kind:'event',type:'survey_confirmed'},context);
  case 'infrastructure_installed':return !!snapshot.infrastructure?.some(item=>item.status==='installed')||(stats?.installed_infrastructure??0)>0||eventMatches({kind:'event',type:'infrastructure_confirmed'},context);
  case 'discovery_decided':return !!snapshot.discoveries?.some(find=>find.status!=='pending')||!!snapshot.discovery_summary&&snapshot.discovery_summary.kept+snapshot.discovery_summary.sold+snapshot.discovery_summary.salvaged>0||eventMatches({kind:'event',type:'discovery_confirmed'},context);
  case 'research_completed':return !!snapshot.business?.research.some(order=>order.status==='completed')||(stats?.completed_research??0)>0||eventMatches({kind:'event',type:'research_confirmed',detail:{view:'completed'}},context);
  case 'contract_completed':return !!snapshot.business?.contracts.some(order=>order.status==='completed')||(stats?.completed_contracts??0)>0||eventMatches({kind:'event',type:'contract_confirmed'},context);
  case 'milestone_claimed':return !!snapshot.business?.milestones.some(item=>!!item.claimed_at)||eventMatches({kind:'event',type:'milestone_confirmed'},context);
 }
}
/** Production proof follows the actual station and frozen recipe, never an unrelated aggregate counter. */
function productionMatches(predicate:Extract<TutorialPredicate,{kind:'production'}>,context:TutorialContext):boolean{
 const snapshot=tutorialSnapshot(context);if(!snapshot)return false;
 const recipeFor=(key:string,version?:number)=>snapshot.recipes?.find(recipe=>recipe.key===key&&(version===undefined||recipe.version===version));
 const jobs=snapshot.production_jobs??[];
 const sameStation=jobs.filter(job=>job.station===predicate.station);
 for(const job of sameStation){
  const recipe=job.recipe_snapshot??recipeFor(job.recipe_key,job.recipe_version);
  if(predicate.equipment_output&&!recipe?.equipment_output)continue;
  if(predicate.state==='started'||job.status==='collected')return true;
  // A ready order can already have transferred a real partial output. Compare only its frozen definition.
  if(job.status==='ready'&&recipe){
   const materialMoved=Object.entries(recipe.outputs).some(([key,amount])=>(amount??0)*job.batches>(job.outputs[key as keyof typeof job.outputs]??0));
   const gearMoved=!!recipe.equipment_output&&job.equipment_outputs.length<job.batches;
   if(predicate.equipment_output?gearMoved:materialMoved||gearMoved)return true;
  }
 }
 // Equipment ownership is created by actual collection. Merely assigning a borrowed-looking visual is insufficient.
 if(predicate.state==='collected'&&predicate.equipment_output&&snapshot.equipment?.some(item=>snapshot.recipes?.some(recipe=>recipe.station===predicate.station&&recipe.equipment_output===item.definition_key)))return true;
 return context.events.some(event=>{
  if(event.type!==(predicate.state==='started'?'production_confirmed':'production_collected')||!tutorialEventIsCurrent(event,context))return false;
  const job=jobs.find(value=>value.id===event.detail?.job_id);
  const recipe=job?.recipe_snapshot??recipeFor(event.detail?.recipe_key??job?.recipe_key??'',job?.recipe_version);
  if((job?.station??recipe?.station)!==predicate.station||predicate.equipment_output&&!recipe?.equipment_output)return false;
  return predicate.state==='started'||(event.detail?.quantity??0)>0||Object.values(event.detail?.moved??{}).some(amount=>(amount??0)>0);
 });
}
export function evaluateTutorialPredicate(predicate:TutorialPredicate,context:TutorialContext):TutorialCompletion{
 if(predicate.kind==='any')return predicate.predicates.map(item=>evaluateTutorialPredicate(item,context)).find(result=>result.complete)??{complete:false,basis:'pending',explanation:'Waiting for a matching real observation.'};
 if(predicate.kind==='production'){const complete=productionMatches(predicate,context);return {complete,basis:complete?'verified_snapshot':'pending',explanation:complete?'Verified actual production at the required station.':'Reviewing another station or assigning existing gear does not complete this production skill.'};}
 if(predicate.kind==='acknowledge')return {complete:true,basis:'explicit_review',explanation:'This is an educational review, not a paid action.'};
 const complete=predicate.kind==='company_exists'?!!tutorialSnapshot(context):predicate.kind==='event'?eventMatches(predicate,context):snapshotFact(predicate.fact,context);
 return {complete,basis:complete?(predicate.kind==='event'?(confirmed.has(predicate.type)?'verified_action':'ui_observation'):'verified_snapshot'):'pending',explanation:complete?'Verified in this company’s synchronized state or scoped interaction.':'Use the real control, wait for synchronization, or choose the clearly marked read-only alternative.'};
}
export function evaluateTutorialStep(step:TutorialStep,context:TutorialContext):TutorialCompletion{return evaluateTutorialPredicate(step.predicate,context);}
export function hasVerifiedSale(context:TutorialContext):boolean{
 if(!tutorialSnapshot(context))return false;
 return !!context.progress&&sameTutorialScope(context.progress,context.scope)&&context.progress.practiced_lessons.includes('beginner.sale')||snapshotFact('sale_confirmed',context);
}
export function isLessonPracticed(lesson:TutorialLesson,context:TutorialContext):boolean{
 if(lesson.practice_predicate)return evaluateTutorialPredicate(lesson.practice_predicate,context).complete;
 const practical=lesson.steps.filter(step=>step.predicate.kind!=='acknowledge');return practical.length>0&&practical.every(step=>evaluateTutorialStep(step,context).complete);
}
export interface TutorialLessonAvailability{status:'ready'|'available_for_practice'|'not_yet_unlocked';live:boolean;practice:true;reason:string}
export function lessonAvailability(id:TutorialLessonId|string,snapshot:DeepClaimSnapshot|null,clubAvailable=true):TutorialLessonAvailability{
 const lesson=getTutorialLesson(id);if(!lesson)return {status:'not_yet_unlocked',live:false,practice:true,reason:'Unknown lesson.'};
 if(lesson.id==='beginner.claim')return {status:'ready',live:true,practice:true,reason:snapshot?.company?'Your existing deed can be reviewed without founding again.':'Review the deed and found your company through the real action.'};
 if(!snapshot?.company)return {status:'available_for_practice',live:false,practice:true,reason:'Found or continue a company to use live controls. Read-only practice is available now.'};
 const required=lesson.live_requires;
 if(required==='club'&&!clubAvailable)return {status:'available_for_practice',live:false,practice:true,reason:'Shared club systems are unavailable here. The private read-only lesson remains available.'};
 const schema=required?.startsWith('schema')?Number(required.slice(6)):1;
 if(snapshot.schema_version<schema)return {status:'not_yet_unlocked',live:false,practice:true,reason:'This synchronized save does not yet expose the required feature. Review its practice safely.'};
 return {status:'ready',live:true,practice:true,reason:'Open the current controls or use read-only practice. No purchase is required to review.'};
}
