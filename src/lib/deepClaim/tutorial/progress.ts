import {BEGINNER_LESSONS,getTutorialLesson,getTutorialStep,TUTORIAL_STEP_IDS} from './chapters';
import {DIALOGUE_LINE_IDS} from './dialogue';
import {lessonAvailability,sameTutorialScope} from './completion';
import {TUTORIAL_LESSON_IDS,type TutorialLessonId,type TutorialLessonStatus,type TutorialProgress,type TutorialProgressPatch,type TutorialScope} from './types';
import type {DeepClaimSnapshot} from '../types';
const lessons=new Set<string>(TUTORIAL_LESSON_IDS),steps=new Set(TUTORIAL_STEP_IDS),lines=new Set(DIALOGUE_LINE_IDS);
const sets=['completed_steps','reviewed_lessons','practiced_lessons','skipped_lessons','seen_dialogue'] as const;
const scalar=['active_lesson_id','active_step_id','campaign_status','commentary_enabled'] as const;
const patchKeys=new Set<string>([...sets,...scalar]);
const scopeKeys=['user_id','club_id','company_id'] as const;
const identity=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=128;
const time=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value));
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`Invalid training journal: ${message}`);}
function validateFields(value:Record<string,unknown>,partial:boolean):void{
 for(const key of sets){const array=value[key];if(partial&&array===undefined)continue;const known=key==='completed_steps'?steps:key==='seen_dialogue'?lines:lessons;assert(Array.isArray(array)&&array.length<=(key==='completed_steps'||key==='seen_dialogue'?512:42)&&Array.from(array).every(item=>typeof item==='string'&&known.has(item))&&new Set(array).size===array.length,`${key} contains unknown, duplicate or excessive entries`);}
 if(!partial||value.active_lesson_id!==undefined)assert(value.active_lesson_id===null||typeof value.active_lesson_id==='string'&&lessons.has(value.active_lesson_id),'active lesson');
 if(!partial||value.active_step_id!==undefined)assert(value.active_step_id===null||typeof value.active_step_id==='string'&&steps.has(value.active_step_id),'active step');
 if(!partial||value.campaign_status!==undefined)assert(['not_started','active','paused','completed'].includes(value.campaign_status as string),'campaign status');
 if(!partial||value.commentary_enabled!==undefined)assert(typeof value.commentary_enabled==='boolean','commentary preference');
 if(value.active_lesson_id===null)assert(value.active_step_id==null,'step without lesson');
 if(typeof value.active_lesson_id==='string'&&typeof value.active_step_id==='string')assert(getTutorialLesson(value.active_lesson_id)?.steps.some(step=>step.id===value.active_step_id),'step belongs to another lesson');
}
export function createTutorialProgress(scope:TutorialScope,serverNow=new Date().toISOString()):TutorialProgress{
 return {version:1,...scope,server_now:serverNow,revision:0,active_lesson_id:null,active_step_id:null,completed_steps:[],reviewed_lessons:[],practiced_lessons:[],skipped_lessons:[],seen_dialogue:[],campaign_status:'not_started',commentary_enabled:true,updated_at:null};
}
export function validateTutorialProgress(value:unknown,scope?:TutorialScope):asserts value is TutorialProgress{
 assert(record(value),'object required');assert(Object.keys(value).every(key=>patchKeys.has(key)||['version','server_now','revision','updated_at',...scopeKeys].includes(key)),'unknown field');
 assert(value.version===1,'version');assert(identity(value.user_id)&&identity(value.club_id)&&(value.company_id===null||identity(value.company_id)),'identity');
 assert(time(value.server_now)&&Number.isSafeInteger(value.revision)&&(value.revision as number)>=0,'clock or revision');assert(value.updated_at===null||time(value.updated_at),'update clock');validateFields(value,false);
 if(scope)assert(sameTutorialScope(value as unknown as TutorialScope,scope),'journal belongs to another company');
}
export function validateTutorialPatch(value:unknown):asserts value is TutorialProgressPatch{
 assert(record(value)&&Object.keys(value).every(key=>patchKeys.has(key)),'patch fields');validateFields(value,true);
}
export function applyTutorialPatch(progress:TutorialProgress,patch:TutorialProgressPatch,serverNow=progress.server_now,revision=progress.revision):TutorialProgress{
 validateTutorialProgress(progress);validateTutorialPatch(patch);
 const next={...progress,server_now:serverNow,revision};for(const key of sets){const known=key==='completed_steps'?TUTORIAL_STEP_IDS:key==='seen_dialogue'?DIALOGUE_LINE_IDS:TUTORIAL_LESSON_IDS;const union=new Set<string>([...progress[key],...(patch[key]??[])]);(next[key] as string[])=known.filter(id=>union.has(id));}
 for(const key of scalar)if(patch[key]!==undefined)Object.assign(next,{[key]:patch[key]});
 if(patch.active_lesson_id!==undefined&&patch.active_step_id===undefined&&next.active_step_id&&!getTutorialLesson(next.active_lesson_id??'')?.steps.some(step=>step.id===next.active_step_id))next.active_step_id=null;
 if(next.active_lesson_id===null){assert(patch.active_step_id==null,'step without lesson');next.active_step_id=null;}
 validateTutorialProgress(next);return next;
}
/** Merge only one company's monotonic educational sets; the newest server cursor wins. */
export function mergeTutorialProgress(local:TutorialProgress,remote:TutorialProgress):TutorialProgress{
 validateTutorialProgress(local);validateTutorialProgress(remote,local);const newer=remote.revision>=local.revision?remote:local;
 const merged=applyTutorialPatch(newer,Object.fromEntries(sets.map(key=>[key,[...new Set([...local[key],...remote[key]])]])) as TutorialProgressPatch);return merged;
}
export function isFirstDescentComplete(progress:TutorialProgress):boolean{
 return BEGINNER_LESSONS.every(lesson=>progress.reviewed_lessons.includes(lesson.id)||progress.practiced_lessons.includes(lesson.id)||lesson.steps.every(step=>progress.completed_steps.includes(step.id)));
}
export function getTutorialLessonStatus(id:TutorialLessonId,progress:TutorialProgress,snapshot:DeepClaimSnapshot|null=null):TutorialLessonStatus{
 if(progress.practiced_lessons.includes(id))return 'completed';
 if(progress.reviewed_lessons.includes(id))return 'reviewed';
 const lesson=getTutorialLesson(id);if(lesson?.steps.every(step=>progress.completed_steps.includes(step.id)))return 'completed';
 if(progress.active_lesson_id===id||lesson?.steps.some(step=>progress.completed_steps.includes(step.id)))return 'in_progress';
 if(progress.skipped_lessons.includes(id))return 'skipped';return lessonAvailability(id,snapshot).status;
}
/** Resolve a stored cursor without trusting stale step names from an old build. */
export function tutorialResumeStep(progress:TutorialProgress):string|null{
 const lesson=getTutorialLesson(progress.active_lesson_id??'');if(!lesson)return null;
 return getTutorialStep(progress.active_step_id??'')?.id??lesson.steps.find(step=>!progress.completed_steps.includes(step.id))?.id??lesson.steps[0]?.id??null;
}
