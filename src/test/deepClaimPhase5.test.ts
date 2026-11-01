import { describe,expect,it } from 'vitest';
import { SOCIAL_CATALOG,resourceSaleValue } from '@/lib/deepClaim/catalog';
import { discoverySpecimen } from '@/lib/deepClaim/field';
import { effectiveProjectCap,projectCapPercent,projectContributionReasons,projectQualificationValue,projectReward,validateDeepClaimClubView,validateSocialCatalog } from '@/lib/deepClaim/social';
import type { DeepClaimPublicSpecimen,DeepClaimPublicStanding } from '@/lib/deepClaim/types';
import { phaseFiveClubView } from './fixtures/deepClaimPhase5';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';
const scope={clubId:'club-a',userId:'user-a'};
function specimen():DeepClaimPublicSpecimen{const found=discoverySpecimen('banded_geode','fine');return {kind:'banded_geode',name:found.name,quality:'fine',detail:found.detail};}
function row(user_id:string,value:number,rank:number,is_you=false):DeepClaimPublicStanding{return {user_id,display_name:`Member ${user_id}`,avatar_url:null,company_name:`${user_id} Mining`,value,rank,is_you};}

describe('Deep Claim social catalog and finite project arithmetic',()=>{
 it('publishes six linear projects with fixed goals and30percent bounded shared credit pools',()=>{
  expect(()=>validateSocialCatalog()).not.toThrow();expect(SOCIAL_CATALOG.projects.map(project=>resourceSaleValue(project.goals))).toEqual([300,1100,1310,2502,3760,3600]);
  expect(SOCIAL_CATALOG.projects.map(project=>project.reward_pool)).toEqual([90,330,393,750,1128,1080]);expect(SOCIAL_CATALOG.projects.reduce((n,p)=>n+p.reward_pool,0)).toBe(3771);
  for(const [i,project]of SOCIAL_CATALOG.projects.entries())expect(project.requires).toEqual(i?[SOCIAL_CATALOG.projects[i-1].key]:[]);
 });
 it('freezes per-resource percentages but permits a shrinking club to finish without invalidating earlier donations',()=>{
  expect([1,2,3,100].map(projectCapPercent)).toEqual([100,60,40,40]);
  expect(effectiveProjectCap(40,2)).toBe(60);expect(effectiveProjectCap(40,1)).toBe(100);expect(effectiveProjectCap(100,100)).toBe(100);expect(effectiveProjectCap(60,3)).toBe(60);
  expect(()=>projectCapPercent(0)).toThrow();expect(Math.floor(SOCIAL_CATALOG.projects[5].goals.gold_bar!*40/100)).toBe(2);
 });
 it('uses an exact ceiling5percent qualifying threshold and an integer floor of the frozen reward share',()=>{
  expect(projectQualificationValue(2502)).toBe(126);expect(projectReward(750,125,2502)).toEqual({qualified:false,amount:0});expect(projectReward(750,126,2502)).toEqual({qualified:true,amount:37});
  expect(projectReward(90,300,300)).toEqual({qualified:true,amount:90});expect(()=>projectReward(90,301,300)).toThrow();
 });
 it('never distributes more than a project pool across arbitrary full contribution partitions',()=>{
  for(const project of SOCIAL_CATALOG.projects){const total=resourceSaleValue(project.goals);for(let people=1;people<=60;people++){const base=Math.floor(total/people),values=Array.from({length:people},(_,i)=>base+(i<total%people?1:0)),rewards=values.map(value=>projectReward(project.reward_pool,value,total));expect(rewards.reduce((n,r)=>n+r.amount,0)).toBeLessThanOrEqual(project.reward_pool);expect(rewards.filter(r=>r.qualified).length).toBeLessThanOrEqual(20);}}
 });
 it('preserves actual operating liquidity and never counts an unclaimed future project award',()=>{
  const base={project:SOCIAL_CATALOG.projects[0],progress:{},own:{},cap_percent:40 as const,cash:0};
  const reserve='Keep $2 operating cash or collected stock after a project contribution.';
  expect(projectContributionReasons({...base,requested:{stone:2},stock:{stone:2}})).toContain(reserve);
  expect(projectContributionReasons({...base,requested:{stone:1},stock:{stone:2}})).toContain(reserve);
  expect(projectContributionReasons({...base,requested:{stone:1},stock:{stone:3}})).toEqual([]);
  expect(projectContributionReasons({...base,cash:2,requested:{stone:2},stock:{stone:2}})).toEqual([]);
 });
 it('rejects an entire contribution for missing stock, another resource, fractions, negative input, caps or filled goals',()=>{
  const project=SOCIAL_CATALOG.projects[0],base={project,stock:{stone:100,coal:100,clay:100},progress:{},own:{},cap_percent:40 as const,cash:180};
  expect(projectContributionReasons({...base,requested:{stone:32,coal:16,clay:12}})).toEqual([]);
  expect(projectContributionReasons({...base,requested:{stone:33}})).toContain('This contribution exceeds your project resource limit.');
  expect(projectContributionReasons({...base,requested:{stone:1},stock:{}})).toContain('Collect the requested resources before contributing.');
  expect(projectContributionReasons({...base,requested:{stone:1},progress:{stone:80}})).toContain('This contribution exceeds the remaining project goal.');
  for(const requested of [{},{iron_bar:1},{stone:-1},{stone:0},{stone:1.5}])expect(projectContributionReasons({...base,requested})).not.toEqual([]);
  expect(projectContributionReasons({...base,requested:{stone:1},own:{stone:32}})).toContain('This contribution exceeds your project resource limit.');
 });
});

describe('Deep Claim separate scoped public club payload',()=>{
 it('accepts the separate opt-in view without changing privateSnapshot4 or publishing any private economy',()=>{
  const privateSave=phaseFourSnapshot(),view=phaseFiveClubView();expect(()=>validateDeepClaimClubView(view,scope)).not.toThrow();expect(privateSave.schema_version).toBe(4);
  expect(Object.keys(view)).not.toContain('company');expect(Object.keys(view)).not.toContain('world');expect(Object.keys(view)).not.toContain('resources');expect(view.own).toMatchObject({standings_enabled:false,showcase_enabled:false});
 });
 it('requires own_revision and exact current account/club identity',()=>{
  const view=phaseFiveClubView();expect(()=>validateDeepClaimClubView(view,{clubId:'club-b',userId:'user-a'})).toThrow(/scoped/);expect(()=>validateDeepClaimClubView(view,{clubId:'club-a',userId:'user-b'})).toThrow(/scoped/);
  const revision=phaseFiveClubView();delete (revision as Partial<typeof revision>).own_revision;expect(()=>validateDeepClaimClubView(revision)).toThrow();
 });
 it('rejects unknown fields at every public boundary rather than silently ignoring leaked companyIDs, stock or coordinates',()=>{
  for(const leak of ['company_id','world','cash','inventory','workers','seed','plans','active_jobs']){const view=phaseFiveClubView();Object.assign(view,{[leak]:'private'});expect(()=>validateDeepClaimClubView(view)).toThrow();}
  const view=phaseFiveClubView();view.standings=[row('member-b',5,1)];Object.assign(view.standings[0],{company_id:'private-company'});expect(()=>validateDeepClaimClubView(view)).toThrow();
  const showcase=phaseFiveClubView();showcase.showcases={page:0,total:1,has_more:false,companies:[{user_id:'member-b',display_name:'Member B',avatar_url:null,company_name:'B Mine',specimens:[specimen()]}]};Object.assign(showcase.showcases.companies[0].specimens[0],{x:47,y:3,job_id:'private-job'});expect(()=>validateDeepClaimClubView(showcase)).toThrow();
 });
 it('accepts club-local Monday weeks across both DST changes and rejects rolling UTC or invalid timezones',()=>{
  const spring=phaseFiveClubView();spring.server_now='2026-03-05T12:00:00Z';spring.week={starts_at:'2026-03-02T05:00:00Z',ends_at:'2026-03-09T04:00:00Z',timezone:'America/New_York'};expect(()=>validateDeepClaimClubView(spring)).not.toThrow();
  const fall=phaseFiveClubView();fall.server_now='2026-10-30T12:00:00Z';fall.week={starts_at:'2026-10-26T04:00:00Z',ends_at:'2026-11-02T05:00:00Z',timezone:'America/New_York'};expect(()=>validateDeepClaimClubView(fall)).not.toThrow();
  const twoHour=phaseFiveClubView();twoHour.server_now='2026-03-26T12:00:00Z';twoHour.week={starts_at:'2026-03-23T00:00:00Z',ends_at:'2026-03-29T22:00:00Z',timezone:'Antarctica/Troll'};expect(()=>validateDeepClaimClubView(twoHour)).not.toThrow();
  spring.week.ends_at='2026-03-09T05:00:00Z';expect(()=>validateDeepClaimClubView(spring)).toThrow(/week|timezone/);
  const invalid=phaseFiveClubView();invalid.week.timezone='Moon/Club';expect(()=>validateDeepClaimClubView(invalid)).toThrow();
 });
 it('requires the current half-open week and canonical catalog without exposing future weekly data',()=>{
  const view=phaseFiveClubView();view.server_now=view.week.ends_at;expect(()=>validateDeepClaimClubView(view)).toThrow(/week/);
  const catalog=phaseFiveClubView();catalog.catalog.projects[0].reward_pool=999;expect(()=>validateDeepClaimClubView(catalog)).toThrow(/scoped/);
 });
});

describe('Deep Claim true tied standings and opt-in showcases',()=>{
 it('keeps shared true ranks and exactlyoneYou row with separate metric limits',()=>{
  const view=phaseFiveClubView({metric:'operational_depth'});view.own.standings_enabled=true;view.standings=[row('member-b',100,1),row('user-a',100,1,true),row('member-c',80,3)];expect(()=>validateDeepClaimClubView(view)).not.toThrow();
  view.standings.push(row('user-a',50,4,true));expect(()=>validateDeepClaimClubView(view)).toThrow(/unique/);
  const wrongRank=phaseFiveClubView();wrongRank.standings=[row('member-b',100,1),row('member-c',100,2)];expect(()=>validateDeepClaimClubView(wrongRank)).toThrow(/tied/);
  const invalid=phaseFiveClubView({metric:'best_find'});invalid.standings=[row('member-b',501,1)];expect(()=>validateDeepClaimClubView(invalid)).toThrow(/source/);
  const meteorite=phaseFiveClubView({metric:'best_find'});meteorite.standings=[row('member-b',discoverySpecimen('meteorite_fragment','flawless').sale_value,1)];expect(()=>validateDeepClaimClubView(meteorite)).not.toThrow();expect(meteorite.standings[0].value).toBe(500);meteorite.standings[0].value=540;expect(()=>validateDeepClaimClubView(meteorite)).toThrow(/source/);
 });
 it('permits top50 plus one own outside row without adding anotheruser or inventingrank51 for a tie',()=>{
  const view=phaseFiveClubView();view.own.standings_enabled=true;view.standings=Array.from({length:50},(_,i)=>row(`member-${i}`,1000-i,i+1));view.standings.push(row('user-a',20,100,true));expect(()=>validateDeepClaimClubView(view)).not.toThrow();
  view.standings[50].is_you=false;view.standings[50].user_id='member-extra';expect(()=>validateDeepClaimClubView(view)).toThrow();
  const tie=phaseFiveClubView();tie.own.standings_enabled=true;tie.standings=Array.from({length:50},(_,i)=>row(`member-${i}`,20,1));tie.standings.push(row('user-a',20,1,true));expect(()=>validateDeepClaimClubView(tie)).not.toThrow();
 });
 it('hides own rows after either consent is disabled and rejects unsafe avatar links',()=>{
  const view=phaseFiveClubView();view.standings=[row('user-a',20,1,true)];expect(()=>validateDeepClaimClubView(view)).toThrow();view.standings=[row('member-b',20,1)];view.standings[0].avatar_url='javascript:alert(1)';expect(()=>validateDeepClaimClubView(view)).toThrow(/identity/);
  const own=phaseFiveClubView();own.showcases={page:0,total:1,has_more:false,companies:[{user_id:'user-a',display_name:'You',avatar_url:null,company_name:'Own Mine',specimens:[]}]};expect(()=>validateDeepClaimClubView(own)).toThrow(/unshared/);
 });
 it('retains explicitly selected olderfind IDs and their sanitized specimens even when ownpublicsharing is disabled',()=>{
  const view=phaseFiveClubView();view.own.featured_discovery_ids=['older-than-private24'];view.own.featured_specimens=[specimen()];expect(()=>validateDeepClaimClubView(view)).not.toThrow();
  view.own.featured_specimens=[];expect(()=>validateDeepClaimClubView(view)).toThrow(/preferences/);
 });
 it('bounds showcase pages/cards/specimens andhas_more atpage19 withfulltotalcount',()=>{
  const view=phaseFiveClubView({page:19});view.showcases={page:19,total:1000,has_more:false,companies:Array.from({length:24},(_,i)=>({user_id:`member-${i}`,display_name:'Member',avatar_url:null,company_name:'Mine',specimens:[]}))};expect(()=>validateDeepClaimClubView(view)).not.toThrow();view.showcases.has_more=true;expect(()=>validateDeepClaimClubView(view)).toThrow(/bounded/);
  const duplicate=phaseFiveClubView();duplicate.showcases={page:0,total:2,has_more:false,companies:Array.from({length:2},()=>({user_id:'same',display_name:'Member',avatar_url:null,company_name:'Mine',specimens:[specimen()]}))};expect(()=>validateDeepClaimClubView(duplicate)).toThrow(/Duplicate/);
 });
});

describe('Deep Claim authoritative shared progress and claims',()=>{
 it('accepts qualifyingprojectprogress andreward estimates whileenforcingwholegoals beforecompletion',()=>{
  const view=phaseFiveClubView(),project=view.projects[0];project.progress={stone:80,coal:40,clay:30};project.own_contribution={stone:16};project.own_value=16;project.qualified=true;project.reward_amount=4;project.contributors=2;project.status='completed';project.completed_at='2026-11-02T11:00:00Z';project.claimed_at='2026-11-02T11:30:00Z';view.projects[1].status='open';expect(()=>validateDeepClaimClubView(view)).not.toThrow();
  project.reward_amount=90;expect(()=>validateDeepClaimClubView(view)).toThrow(/reward/);
 });
 it('rejects contributions tolockedprojects, fakeprerequisites andclaims beforecompletion',()=>{
  const locked=phaseFiveClubView();locked.projects[1].progress={stone:1};expect(()=>validateDeepClaimClubView(locked)).toThrow(/Locked/);
  const prerequisite=phaseFiveClubView();prerequisite.projects[1].status='open';expect(()=>validateDeepClaimClubView(prerequisite)).toThrow(/prerequisites/);
  const claim=phaseFiveClubView();claim.projects[0].claimed_at='2026-11-02T11:00:00Z';expect(()=>validateDeepClaimClubView(claim)).toThrow(/progress|reward/);
 });
});
