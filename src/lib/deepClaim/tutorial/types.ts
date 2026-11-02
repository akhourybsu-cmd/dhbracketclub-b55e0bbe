import type {DeepClaimBuildingId,DeepClaimMode,DeepClaimPreview,DeepClaimResourceId,DeepClaimResources,DeepClaimSnapshot,DeepClaimProductionStation,DeepClaimSpecialty,DeepClaimStatId} from '../types';

export const DEEP_CLAIM_TUTORIAL_VERSION=1 as const;
export const TUTORIAL_LESSON_IDS=[
 'beginner.claim','beginner.camp','beginner.crew','beginner.mine','beginner.worksite','beginner.plan','beginner.descent','beginner.waiting','beginner.haul','beginner.sale','beginner.upgrade','beginner.graduate',
 'workforce.hiring','workforce.stats','workforce.training','workforce.equipment','workforce.repairs',
 'industry.ore','industry.warehouse','industry.smeltery','industry.gems','industry.crafting','industry.queues',
 'field.exploration','field.survey','field.infrastructure','field.hazards','field.reports','field.discoveries',
 'business.office','business.research','business.contracts','business.milestones','business.strategy',
 'club.projects','club.standings','club.showcase','club.privacy','club.updates',
 'settings.sound','settings.main_menu','settings.exit',
] as const;
export type TutorialLessonId=typeof TUTORIAL_LESSON_IDS[number];
export const TUTORIAL_SECTIONS=['beginner','workforce','industry','field','business','club','settings'] as const;
export type TutorialSectionId=typeof TUTORIAL_SECTIONS[number];
export const TUTORIAL_SPEAKERS=['gus','mara','ivo','tessa'] as const;
export type TutorialSpeakerId=typeof TUTORIAL_SPEAKERS[number];
export const TUTORIAL_EXPRESSIONS=['neutral','amused','skeptical','excited','concerned','proud'] as const;
export type TutorialExpression=typeof TUTORIAL_EXPRESSIONS[number];
export type TutorialCampaignStatus='not_started'|'active'|'paused'|'completed';
export type TutorialLessonStatus='ready'|'available_for_practice'|'not_yet_unlocked'|'completed'|'reviewed'|'skipped'|'in_progress';
export const TUTORIAL_TARGETS=['company-name','company-found','nav-surface','nav-mine','nav-crew','nav-stores','nav-log','nav-settings','crew-list','crew-file','worker-stats','worker-stat-mining','worker-stat-geology','worker-stat-engineering','worker-stat-logistics','worker-stat-safety','worker-stat-endurance','worker-stat-leadership','worker-energy','worker-traits','worker-training','worker-gear','hire-office','map-viewport','map-controls','dispatch-plan','dispatch-mode','dispatch-target','dispatch-crew','dispatch-duration','dispatch-induction','dispatch-review','dispatch-quote','dispatch-conditions','dispatch-confirm','jobs-active','jobs-ready','haul-collect','stores-stock','stores-capacity','stores-resource','sale-review','buildings-list','building-review','production-queue','production-station','production-recipes','production-recipe','production-review','office-company','office-research','office-contracts','office-records','research-review','contract-review','milestone-review','field-operations','field-depth','field-infrastructure','field-log','field-finds','field-reports','discovery-review','club-projects','club-standings','club-showcase','club-privacy','club-project-review','settings-sound','settings-visuals','settings-updates','settings-main-menu','training-journal','ask-gus','main-menu-open','game-exit'] as const;
export type TutorialTargetId=typeof TUTORIAL_TARGETS[number];
/** Navigation/introspection only. No tutorial action contains an economic mutation. */
export type TutorialOpenAction=
 |{type:'tab';tab:'surface'|'mine'|'crew'|'stores'|'log'|'settings';view?:string;station?:DeepClaimProductionStation}
 |{type:'office';view:'company'|'research'|'contracts'|'records'|'club';club_view?:'projects'|'standings'|'showcase'}
 |{type:'dispatch';mode?:DeepClaimMode}
 |{type:'building';building:DeepClaimBuildingId}
 |{type:'worker';name?:string;specialty?:DeepClaimSpecialty;view?:'overview'|'training'|'gear'}
 |{type:'found_company'}|{type:'main_menu'}|{type:'return_to_club'}|{type:'journal';lesson_id?:TutorialLessonId};
export const TUTORIAL_UI_EVENT_TYPES=['tab_opened','worker_inspected','stat_inspected','traits_inspected','energy_inspected','map_interacted','worksite_inspected','dispatch_opened','crew_selected','quote_reviewed','building_inspected','stock_inspected','recipe_inspected','production_inspected','research_inspected','contract_inspected','milestone_inspected','club_view_opened','privacy_reviewed','settings_opened','main_menu_opened','exit_reviewed','guide_reviewed'] as const;
export const TUTORIAL_CONFIRMED_EVENT_TYPES=['company_confirmed','expedition_confirmed','expedition_returned','haul_collected','sale_confirmed','upgrade_confirmed','hire_confirmed','training_confirmed','equipment_confirmed','repair_confirmed','production_confirmed','production_collected','survey_confirmed','infrastructure_confirmed','discovery_confirmed','research_confirmed','contract_confirmed','milestone_confirmed','club_contribution_confirmed','club_claim_confirmed','preferences_confirmed'] as const;
export type TutorialEventType=typeof TUTORIAL_UI_EVENT_TYPES[number]|typeof TUTORIAL_CONFIRMED_EVENT_TYPES[number];
export interface TutorialScope{user_id:string;club_id:string;company_id:string|null}
export interface TutorialEventDetail{
 tab?:string;view?:string;worker_id?:string;worker_name?:string;specialty?:DeepClaimSpecialty;stat?:DeepClaimStatId;
 mode?:DeepClaimMode;building_key?:DeepClaimBuildingId;recipe_key?:string;resource_key?:DeepClaimResourceId;job_id?:string;record_id?:string;
 interaction?:'pan'|'zoom'|'select'|'focus'|'keyboard';allowed?:boolean;company_revision?:number;quantity?:number;moved?:DeepClaimResources;
}
/** UI events are scoped observations; confirmed events are emitted only after a resolved authoritative action. */
export interface TutorialEvent extends TutorialScope {type:TutorialEventType;at:string;detail?:TutorialEventDetail;snapshot_revision?:number}
export interface TutorialProgress extends TutorialScope{
 version:1;server_now:string;revision:number;active_lesson_id:TutorialLessonId|null;active_step_id:string|null;
 completed_steps:string[];reviewed_lessons:TutorialLessonId[];practiced_lessons:TutorialLessonId[];skipped_lessons:TutorialLessonId[];seen_dialogue:string[];
 campaign_status:TutorialCampaignStatus;commentary_enabled:boolean;updated_at:string|null;
}
export interface TutorialProgressPatch{
 active_lesson_id?:TutorialLessonId|null;active_step_id?:string|null;completed_steps?:string[];reviewed_lessons?:TutorialLessonId[];
 practiced_lessons?:TutorialLessonId[];skipped_lessons?:TutorialLessonId[];seen_dialogue?:string[];campaign_status?:TutorialCampaignStatus;commentary_enabled?:boolean;
}
export type TutorialPredicate=
 |{kind:'company_exists'}|{kind:'event';type:TutorialEventType;detail?:Partial<TutorialEventDetail>}
 |{kind:'production';station:DeepClaimProductionStation;state:'started'|'collected';equipment_output?:boolean}
 |{kind:'snapshot';fact:'expedition_exists'|'return_ready'|'cargo_collected'|'has_production'|'production_collected'|'has_hire'|'has_training'|'has_equipment'|'has_repair'|'survey_completed'|'infrastructure_installed'|'discovery_decided'|'research_completed'|'contract_completed'|'milestone_claimed'|'sale_confirmed'|'upgrade_confirmed'}
 |{kind:'acknowledge'}|{kind:'any';predicates:TutorialPredicate[]};
export interface TutorialStep {
 id:string;title:string;instruction:string;target:TutorialTargetId|null;open:TutorialOpenAction|null;predicate:TutorialPredicate;
 more:string[];optional_practice:boolean;fallback_targets?:TutorialTargetId[];
}
export interface TutorialLesson {
 id:TutorialLessonId;version:1;section:TutorialSectionId;order:number;title:string;objective:string;speaker:TutorialSpeakerId;
 summary:string;reference:string[];steps:TutorialStep[];intro_scene_id:string;practice_id:string;practice_predicate?:TutorialPredicate;live_requires?:'company'|'schema2'|'schema3'|'schema4'|'schema5'|'club';
}
export interface DialogueLine {id:string;text_key:string;speaker:TutorialSpeakerId;expression:TutorialExpression;text:string;next:string|null;step_id?:string;condition?:'company_exists'|'company_missing'|'sale_confirmed';camera_focus?:'surface'|'mine'|'office'|'crew';animation?:'deed'|'lantern'|'crew_arrival';audio_cue?:'building'|'complete'|'dispatch'}
export interface DialogueScene {id:string;title:string;lines:DialogueLine[];lesson_id?:TutorialLessonId;estimated_read_seconds:number}
export interface TutorialContext {snapshot:DeepClaimSnapshot|null;progress?:TutorialProgress|null;events:readonly TutorialEvent[];scope:TutorialScope;preview?:DeepClaimPreview|null}
export interface TutorialCompletion {complete:boolean;basis:'verified_snapshot'|'verified_action'|'ui_observation'|'explicit_review'|'pending';explanation:string}
export interface TutorialPracticeChoice {id:string;label:string;feedback:string;recommended?:boolean}
export interface TutorialPractice {
 id:string;lesson_id:TutorialLessonId;title:string;notice:string;scenario:string;facts:{label:string;value:string}[];
 choices:TutorialPracticeChoice[];takeaway:string;readonly:true;
}
export interface GusAdvice {id:string;priority:number;title:string;text:string;speaker:TutorialSpeakerId;expression:TutorialExpression;lesson_id:TutorialLessonId;open:TutorialOpenAction;source:'public_snapshot'|'general_reference'}
export type DeepClaimTutorialProgress=TutorialProgress;
export type DeepClaimTutorialPatch=TutorialProgressPatch;
