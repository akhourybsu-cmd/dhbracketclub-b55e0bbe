/** Optional public club projection and explanatory project math. Every economic change remains server-authorized. */
import { CLUB_PROJECT_BY_KEY, DEEP_CATALOG, SOCIAL_CATALOG, resourceSaleValue } from './catalog';
import { discoverySpecimen } from './field';
import { DEEP_CLAIM_DISCOVERY_KINDS, DEEP_CLAIM_DISCOVERY_QUALITIES, DEEP_CLAIM_STANDING_METRICS, type DeepClaimClubProjectDefinition, type DeepClaimClubView, type DeepClaimDiscoveryKind, type DeepClaimDiscoveryQuality,  type DeepClaimPublicSpecimen, type DeepClaimResources } from './types';
export type {DeepClaimClubView,DeepClaimStandingMetric,DeepClaimSocialPreferencesInput} from './types';

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const keys=(value:Record<string,unknown>,allowed:readonly string[])=>Object.keys(value).every(key=>allowed.includes(key));
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):value is number=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;
const text=(value:unknown,max=128):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const timestamp=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value));
function fail(message:string):never{throw new Error(message);}
function whole(value:number,min=0,max=Number.MAX_SAFE_INTEGER){if(!integer(value,min,max))fail('Invalid club project input.');return value;}
const equalJSON=(value:unknown):string=>Array.isArray(value)?`[${value.map(equalJSON).join(',')}]`:object(value)?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${equalJSON(value[key])}`).join(',')}}`:JSON.stringify(value);
export function projectCapPercent(publicMembers:number):40|60|100{whole(publicMembers,1);return publicMembers===1?100:publicMembers===2?60:40;}
export function effectiveProjectCap(frozen:40|60|100,publicMembers:number):40|60|100{
 if(![40,60,100].includes(frozen))fail('Invalid frozen project cap.');return Math.max(frozen,projectCapPercent(publicMembers)) as 40|60|100;
}
export function projectQualificationValue(totalValue:number):number{whole(totalValue,1);return Math.ceil(totalValue*5/100);}
export function projectReward(pool:number,ownValue:number,totalValue:number):{qualified:boolean;amount:number}{
 whole(pool);whole(totalValue,1);whole(ownValue,0,totalValue);const qualified=ownValue>=projectQualificationValue(totalValue);
 // Integer-rational arithmetic keeps the exact floor identical to PostgreSQL numeric.
 return {qualified,amount:qualified?Number(BigInt(pool)*BigInt(ownValue)/BigInt(totalValue)):0};
}
/** Reject the entire requested debit on invalid stock, remaining goal, or individual cap. */
export function projectContributionReasons(input:{project:DeepClaimClubProjectDefinition;requested:DeepClaimResources;stock:DeepClaimResources;progress:DeepClaimResources;own:DeepClaimResources;cap_percent:40|60|100;cash:number}):string[]{
 const {project,requested,stock,progress,own}=input,reasons:string[]=[];
 if(!object(requested)||!Object.keys(requested).length||Object.keys(requested).some(id=>!Object.prototype.hasOwnProperty.call(project.goals,id)))return ['Choose resources required by this project.'];
 if(![40,60,100].includes(input.cap_percent))return ['The project contribution limit is unavailable.'];
 for(const [id,quantity]of Object.entries(requested)){
  const resource=id as keyof DeepClaimResources;
  if(!integer(quantity,1)){reasons.push('Contributions must use positive whole quantities.');continue;}
  if(quantity>(stock[resource]??0))reasons.push('Collect the requested resources before contributing.');
  if(quantity>(project.goals[resource]??0)-(progress[resource]??0))reasons.push('This contribution exceeds the remaining project goal.');
  if(quantity+(own[resource]??0)>Math.floor((project.goals[resource]??0)*input.cap_percent/100))reasons.push('This contribution exceeds your project resource limit.');
 }
 const remaining={...stock};
 if(Object.values(requested).every(quantity=>integer(quantity,1))){for(const[id,quantity]of Object.entries(requested))remaining[id as keyof DeepClaimResources]=(stock[id as keyof DeepClaimResources]??0)-quantity!;if(whole(input.cash)+resourceSaleValue(remaining)<2)reasons.push('Keep $2 operating cash or collected stock after a project contribution.');}
 return [...new Set(reasons)];
}
export function validateSocialCatalog():void{
 if(SOCIAL_CATALOG.projects.length!==6)fail('The club project catalog must be finite.');
 SOCIAL_CATALOG.projects.forEach((project,index)=>{
  const expected=index?[SOCIAL_CATALOG.projects[index-1].key]:[];
  if(equalJSON(project.requires)!==equalJSON(expected))fail('Club projects must preserve their authored linear prerequisites.');
  const value=resourceSaleValue(project.goals);if(!value||!integer(project.reward_pool,1)||project.reward_pool*100>value*40)fail('Club reward pool exceeds its finite contribution budget.');
 });
}
function amounts(value:unknown,goals:DeepClaimResources):asserts value is DeepClaimResources{
 if(!object(value)||!keys(value,Object.keys(goals))||Object.entries(value).some(([id,quantity])=>!integer(quantity)||quantity>(goals[id as keyof DeepClaimResources]??0)))fail('Invalid shared project quantities.');
}
function identity(value:Record<string,unknown>){
 if(!text(value.user_id)||!text(value.display_name,120)||!text(value.company_name,64)||value.avatar_url!==null&&(!text(value.avatar_url,2048)||!/^https?:\/\//i.test(String(value.avatar_url))))fail('Invalid public club identity.');
}
const maximumRecoveredFindValue=Math.max(...DEEP_CLAIM_DISCOVERY_KINDS.flatMap(kind=>DEEP_CLAIM_DISCOVERY_QUALITIES.map(quality=>discoverySpecimen(kind,quality).sale_value)));
function specimen(value:unknown):asserts value is DeepClaimPublicSpecimen{
 if(!object(value)||!keys(value,['kind','name','quality','detail'])||!DEEP_CLAIM_DISCOVERY_KINDS.includes(value.kind as DeepClaimDiscoveryKind)||!DEEP_CLAIM_DISCOVERY_QUALITIES.includes(value.quality as DeepClaimDiscoveryQuality))fail('Invalid public specimen.');
 const canonical=discoverySpecimen(value.kind as DeepClaimDiscoveryKind,value.quality as DeepClaimDiscoveryQuality);
 if(value.name!==canonical.name||value.detail!==canonical.detail)fail('Public specimen does not match its recovered definition.');
}
function week(value:unknown,serverNow:string){
 if(!object(value)||!keys(value,['starts_at','ends_at','timezone'])||!timestamp(value.starts_at)||!timestamp(value.ends_at)||!text(value.timezone,80))fail('Invalid club-local standings week.');
 const start=Date.parse(value.starts_at),end=Date.parse(value.ends_at),now=Date.parse(serverNow);
 if(end<=start||start>now||end<=now)fail('Invalid current club-local week.');
 try{
  const format=new Intl.DateTimeFormat('en-US',{timeZone:value.timezone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const civilDates=[start,end].map(date=>{const parts=format.formatToParts(date),part=(type:string)=>parts.find(p=>p.type===type)?.value;if(part('weekday')!=='Mon'||part('hour')!=='00'||part('minute')!=='00'||part('second')!=='00')fail('Club weeks must start and end at local Monday midnight.');return Date.UTC(Number(part('year')),Number(part('month'))-1,Number(part('day')));});
  if(civilDates[1]-civilDates[0]!==7*86400000)fail('Club weeks must contain exactly seven local calendar dates.');
 }catch{fail('Invalid club-local standings timezone.');}
}
/** Strict privacy boundary: unknown fields (including private company/world IDs and plans) are rejected. */
export function validateDeepClaimClubView(value:unknown,expected?:{clubId:string;userId:string}):asserts value is DeepClaimClubView{
 if(!object(value)||!keys(value,['version','server_now','club_id','user_id','own_revision','catalog','own','metric','week','standings','projects','showcases'])||value.version!==1||!timestamp(value.server_now)||!text(value.club_id)||!text(value.user_id)||!integer(value.own_revision)
  ||expected&&(value.club_id!==expected.clubId||value.user_id!==expected.userId)||equalJSON(value.catalog)!==equalJSON(SOCIAL_CATALOG)||!DEEP_CLAIM_STANDING_METRICS.includes(value.metric as import('./types').DeepClaimStandingMetric))fail('Invalid scoped Deep Claim club view.');
 week(value.week,value.server_now);
 const own=value.own;
 if(!object(own)||!keys(own,['standings_enabled','showcase_enabled','featured_discovery_ids','featured_specimens'])||typeof own.standings_enabled!=='boolean'||typeof own.showcase_enabled!=='boolean'||!Array.isArray(own.featured_discovery_ids)||own.featured_discovery_ids.length>3||own.featured_discovery_ids.some(id=>!text(id))||new Set(own.featured_discovery_ids).size!==own.featured_discovery_ids.length||!Array.isArray(own.featured_specimens)||own.featured_specimens.length!==own.featured_discovery_ids.length)fail('Invalid own club-sharing preferences.');
 own.featured_specimens.forEach(specimen);
 if(!Array.isArray(value.standings)||value.standings.length>51)fail('Invalid bounded club standings.');
 const standingIds=new Set<string>();let lastValue=Number.MAX_SAFE_INTEGER,groupRank=1;
 for(let i=0;i<value.standings.length;i++){
  const row=value.standings[i];if(!object(row)||!keys(row,['user_id','display_name','avatar_url','company_name','value','rank','is_you']))fail('Invalid public standings row.');identity(row);
  if(!integer(row.value)||!integer(row.rank,1)||typeof row.is_you!=='boolean'||row.is_you!==(row.user_id===value.user_id)||standingIds.has(String(row.user_id))||row.value>lastValue||row.is_you&&!own.standings_enabled||i===50&&!row.is_you)fail('Invalid unique club ranking.');
  if(i<50){if(row.value<lastValue)groupRank=i+1;if(row.rank!==groupRank)fail('Club standings must retain true tied ranks.');}
  else if(row.rank<1+value.standings.slice(0,50).filter(previous=>(previous as {value:number}).value>Number(row.value)).length)fail('Invalid own outside-top ranking.');
  if(value.metric==='operational_depth'&&row.value>DEEP_CATALOG.shaft.max_depth||value.metric==='best_find'&&row.value>maximumRecoveredFindValue)fail('Invalid source-backed standings value.');
  standingIds.add(String(row.user_id));lastValue=row.value;
 }
 if(!Array.isArray(value.projects)||value.projects.length!==6)fail('The club view requires all six finite projects.');
 const projectKeys=new Set<string>();
 for(const project of value.projects){
  if(!object(project)||!keys(project,['key','status','goals','progress','own_contribution','own_value','total_value','reward_pool','reward_amount','qualified','claimed_at','effective_cap_percent','contributors','completed_at'])||!text(project.key)||projectKeys.has(project.key)||!['locked','open','completed'].includes(String(project.status)))fail('Invalid club project.');
  const definition=CLUB_PROJECT_BY_KEY[project.key];if(!definition||equalJSON(project.goals)!==equalJSON(definition.goals))fail('Unsupported frozen club project goals.');
  amounts(project.progress,definition.goals);amounts(project.own_contribution,definition.goals);
  const total=resourceSaleValue(definition.goals),ownValue=resourceSaleValue(project.own_contribution),reward=projectReward(definition.reward_pool,ownValue,total);
  if(!integer(project.total_value,1)||project.total_value!==total||project.own_value!==ownValue||project.reward_pool!==definition.reward_pool||project.reward_amount!==reward.amount||project.qualified!==reward.qualified||![40,60,100].includes(project.effective_cap_percent as number)||!integer(project.contributors)||ownValue>0&&project.contributors===0
   ||Object.keys(definition.goals).some(id=>(project.own_contribution as DeepClaimResources)[id as keyof DeepClaimResources]!>((project.progress as DeepClaimResources)[id as keyof DeepClaimResources]??0))
   ||project.claimed_at!==null&&(!timestamp(project.claimed_at)||Date.parse(String(project.claimed_at))>Date.parse(value.server_now)||project.status!=='completed'||!reward.qualified)
   ||(project.status==='completed'? !timestamp(project.completed_at)||Date.parse(String(project.completed_at))>Date.parse(value.server_now)||equalJSON({...project.progress})!==equalJSON(definition.goals):project.completed_at!==null))fail('Invalid authoritative club project progress or reward.');
  if(project.status==='locked'&&(resourceSaleValue(project.progress)>0||ownValue>0||project.contributors>0))fail('Locked projects cannot contain paid contributions.');
  projectKeys.add(project.key);
 }
 for(const project of value.projects as import('./types').DeepClaimClubProjectView[]){
  const ready=CLUB_PROJECT_BY_KEY[project.key].requires.every(key=>(value.projects as import('./types').DeepClaimClubProjectView[]).some(parent=>parent.key===key&&parent.status==='completed'));
  if(project.status==='locked'&&ready||project.status!=='locked'&&!ready)fail('Club project prerequisites must preserve the finite sequence.');
 }
 const showcases=value.showcases;
 if(!object(showcases)||!keys(showcases,['page','total','has_more','companies'])||!integer(showcases.page,0,19)||!integer(showcases.total)||typeof showcases.has_more!=='boolean'||!Array.isArray(showcases.companies)||showcases.companies.length>24
  ||showcases.companies.length!==Math.max(0,Math.min(24,showcases.total-showcases.page*24))||showcases.has_more!==(showcases.page<19&&(showcases.page+1)*24<showcases.total))fail('Invalid bounded club showcases.');
 const companyIds=new Set<string>();
 for(const company of showcases.companies){if(!object(company)||!keys(company,['user_id','display_name','avatar_url','company_name','specimens'])||!Array.isArray(company.specimens)||company.specimens.length>3)fail('Invalid public company showcase.');identity(company);if(companyIds.has(String(company.user_id))||company.user_id===value.user_id&&!own.showcase_enabled)fail('Duplicate or unshared company showcase.');company.specimens.forEach(specimen);companyIds.add(String(company.user_id));}
}
