// Independent shared-data/privacy proofs against actual isolated PostgreSQL.
// Owner-only fixtures create bounded history/pagination cases; earned scenarios
// use genuine paid dispatch, reconciliation, collection and discovery decisions.
import assert from 'node:assert/strict';
import { fixtureId } from './deep-claim-db.mjs';

export async function runPhase5StandingsTests(h){
 const {check,db,one,A,B,CLUB,actors,request,bootstrap,get,dispatch,finish,collect,sell,resolveDiscovery,getClub,setSocialPreferences,fixture}=h;
 const denied=error=>{assert.equal(error.code,'42501');return true;};
 async function earnedReturn(user=A){let snapshot=await bootstrap(user);snapshot=await dispatch(user,snapshot,{tutorial:true});snapshot=await finish(user,snapshot);return snapshot;}
 async function earnedGeode(user=A){
  let snapshot=await earnedReturn(user);snapshot=await collect(user,snapshot.expeditions.find(job=>job.status==='ready').id);
  for(const y of [2,3]){snapshot=await dispatch(user,snapshot,{x:47,y});snapshot=await finish(user,snapshot);snapshot=await collect(user,snapshot.expeditions.find(job=>job.status==='ready').id);}
  const find=snapshot.discoveries.find(find=>find.kind==='banded_geode'&&find.status==='pending');assert.ok(find,'Fully mining the original quartz assay must recover its finite geode');
  snapshot=await resolveDiscovery(user,snapshot,find.id,'keep');return {snapshot,find:snapshot.discoveries.find(item=>item.id===find.id)};
 }
 async function newPublicMembers(count){
  const ids=[];
  for(let index=0;index<count;index++){const id=fixtureId(50000+index);ids.push(id);await db.query('insert into public.profiles(id,display_name) values($1,$2)',[id,`Public ${index}`]);await db.query('insert into auth.users(id) values($1)',[id]);await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[CLUB,id]);}
  return ids;
 }
 async function cleanupMembers(ids){
  // Every company in this module is isolated. Remove dependent histories first.
  await db.exec('truncate public.dc_companies cascade');
  for(const id of ids){await db.query('delete from public.club_members where user_id=$1',[id]);await db.query('delete from auth.users where id=$1',[id]);await db.query('delete from public.profiles where id=$1',[id]);}
 }
 function noPrivateIdentity(view,companyIDs=[]){
  const forbidden=new Set(['company_id','world','workers','resources','cash','inventory','job_id','x','y','seed','plans','salvage','sale_value']);
  function walk(value){if(!value||typeof value!=='object')return;for(const[key,child]of Object.entries(value)){assert.ok(!forbidden.has(key),`Private field in shared projection:${key}`);walk(child);}}
  // Catalog project goals contain resources by their canonical material names,
  // never a private inventory/resources field. Displayed value is consented.
  walk(view);for(const id of companyIDs)assert.ok(!JSON.stringify(view).includes(id),'Private company ID must never enter shared JSON');
 }
 await check('Phase5 standings default to private, opt in explicitly, and exclude a different club',async()=>{
  let a=await bootstrap(A),b=await bootstrap(B),other=await bootstrap(actors.other);
  assert.deepEqual((await getClub(A)).standings,[]);assert.equal((await getClub(A)).showcases.total,0);
  b=await setSocialPreferences(B,b,{standings:true,showcase:true});other=await setSocialPreferences(actors.other,other,{standings:true,showcase:true});
  const view=await getClub(A);assert.deepEqual(view.standings.map(row=>row.user_id),[B]);assert.deepEqual(view.showcases.companies.map(card=>card.user_id),[B]);noPrivateIdentity(view,[a.company.id,b.company.id,other.company.id]);
  try{for(const avatar of ['', 'javascript:alert(1)', 'data:image/svg+xml,hidden', 'https://bad host/avatar']){await db.query('update public.profiles set avatar_url=$2 where id=$1',[B,avatar]);const normalized=await getClub(A);assert.equal(normalized.standings[0].avatar_url,null);assert.equal(normalized.showcases.companies[0].avatar_url,null);}}finally{await db.query('update public.profiles set avatar_url=null where id=$1',[B]);}
  const foreign=await getClub(actors.other);assert.equal(foreign.club_id,actors.otherClub);assert.deepEqual(foreign.standings.map(row=>row.user_id),[actors.other]);
  a=await setSocialPreferences(A,a,{standings:true});const own=await getClub(A);assert.equal(own.standings.filter(row=>row.user_id===A).length,1);assert.equal(own.standings.filter(row=>row.is_you).length,1);
 });
 await check('Phase5 weekly standings use frozen original haul after partial collection, sales and full collection',async()=>{
  let snapshot=await earnedReturn(A);snapshot=await setSocialPreferences(A,snapshot,{standings:true});const job=snapshot.expeditions.find(job=>job.status==='ready');
  const plan=(await one('select content from public.dc_plans where job_id=$1',[job.id])).content;
  assert.equal((await getClub(A)).standings[0].value,52);
  await db.query("insert into public.dc_inventory(company_id,resource_key,quantity) values($1,'stone',119) on conflict(company_id,resource_key) do update set quantity=119",[snapshot.company.id]);
  snapshot=await collect(A,job.id);assert.equal(snapshot.expeditions.find(item=>item.id===job.id).status,'ready');assert.equal((await getClub(A)).standings[0].value,52);
  snapshot=await sell(A,snapshot,'stone',snapshot.resources.stone);snapshot=await collect(A,job.id);assert.equal(snapshot.expeditions.find(item=>item.id===job.id).status,'collected');
  assert.equal((await getClub(A)).standings[0].value,52);assert.deepEqual((await one('select content from public.dc_plans where job_id=$1',[job.id])).content,plan);
  const current=await getClub(A),preceding=(await one("select public.dc_club_week_v5($1,$2::timestamptz-interval '1 second') data",[CLUB,current.week.starts_at])).data;
  const outside=(await one('select public.dc_standings_v5($1,$2,$3::jsonb) data',[CLUB,'weekly_mining_value',JSON.stringify(preceding)])).data;assert.equal(outside.find(row=>row.user_id===A).value,0,'A current-week return must not enter a different local Monday week');
 });
 await check('Phase5 standings never reconcile another company or publish an elapsed but unrecorded return',async()=>{
  await bootstrap(A);let b=await bootstrap(B);b=await setSocialPreferences(B,b,{standings:true});b=await dispatch(B,b,{tutorial:true});const job=b.expeditions.find(job=>job.status==='active');await fixture.advanceJob(B,job.id,job.duration_seconds+1);
  assert.equal((await getClub(A)).standings.find(row=>row.user_id===B).value,0);assert.equal((await one('select status from public.dc_expeditions where id=$1',[job.id])).status,'active');
  await get(B);assert.equal((await getClub(A)).standings.find(row=>row.user_id===B).value,52);
 });
 await check('Phase5 weekly boundaries follow New York Monday through both daylight-saving changes and valid timezone fallback',async()=>{
  const spring=(await one("select public.dc_club_week_v5($1,'2026-03-05T12:00:00Z') data",[CLUB])).data;
  assert.equal(spring.timezone,'America/New_York');assert.equal(new Date(spring.starts_at).toISOString(),'2026-03-02T05:00:00.000Z');assert.equal(new Date(spring.ends_at).toISOString(),'2026-03-09T04:00:00.000Z');
  const fall=(await one("select public.dc_club_week_v5($1,'2026-10-30T12:00:00Z') data",[CLUB])).data;assert.equal((Date.parse(fall.ends_at)-Date.parse(fall.starts_at))/3600000,169);
  const boundary=(await one('select public.dc_club_week_v5($1,$2::timestamptz) data',[CLUB,spring.ends_at])).data;assert.equal(boundary.starts_at,spring.ends_at);
  await db.query('update public.clubs set settings=$2::jsonb where id=$1',[CLUB,JSON.stringify({timezone:'Moon/Invalid'})]);assert.equal((await getClub(A)).week.timezone,'America/New_York');
 });
 await check('Phase5 project-free standings retain true shared ranks and immediately hide opted-out or removed members',async()=>{
  let a=await bootstrap(A),b=await bootstrap(B),c=await bootstrap(actors.casey);
  a=await setSocialPreferences(A,a,{standings:true,showcase:true});b=await setSocialPreferences(B,b,{standings:true,showcase:true});c=await setSocialPreferences(actors.casey,c,{standings:true,showcase:true});
  const tied=await getClub(A,'operational_depth');assert.deepEqual(tied.standings.map(row=>row.rank),[1,1,1]);assert.deepEqual(tied.standings.map(row=>row.user_id),[A,B,actors.casey]);
  b=await setSocialPreferences(B,b,{standings:false,showcase:false});assert.ok(!(await getClub(A)).standings.some(row=>row.user_id===B));assert.ok(!(await getClub(A)).showcases.companies.some(card=>card.user_id===B));
  await db.query('delete from public.club_members where user_id=$1',[actors.casey]);assert.ok(!(await getClub(A)).standings.some(row=>row.user_id===actors.casey));assert.ok(!(await getClub(A)).showcases.companies.some(card=>card.user_id===actors.casey));await assert.rejects(()=>getClub(actors.casey),denied);
 });
 await check('Phase5 top-fifty standings append an outside tied You once and showcase pages never duplicate identities',async()=>{
  const ids=await newPublicMembers(52);
  try{
   // A high UUID is outside a zero-value tie ordered by stable member identity.
   for(const id of [A,...ids]){let snapshot=await bootstrap(id);snapshot=await setSocialPreferences(id,snapshot,{standings:true,showcase:true});}
   const last=ids.at(-1),view=await getClub(last,'operational_depth');assert.equal(view.standings.length,51);assert.equal(view.standings.filter(row=>row.user_id===last).length,1);assert.ok(view.standings.every(row=>row.rank===1));assert.equal(new Set(view.standings.map(row=>row.user_id)).size,51);
   const pages=await Promise.all([getClub(A,'best_find',0),getClub(A,'best_find',1),getClub(A,'best_find',2)]);assert.deepEqual(pages.map(view=>view.showcases.companies.length),[24,24,5]);assert.deepEqual(pages.map(view=>view.showcases.has_more),[true,true,false]);assert.equal(new Set(pages.flatMap(view=>view.showcases.companies.map(card=>card.user_id))).size,53);
  }finally{await cleanupMembers(ids);}
 });
 await check('Phase5 showcase publishes only explicitly selected owned kept finds with no private value, coordinates or jobs',async()=>{
  const a=await earnedGeode(A),b=await earnedGeode(B);
  const foreignRequest=request();await assert.rejects(()=>setSocialPreferences(A,a.snapshot,{showcase:true,featured:[b.find.id]},foreignRequest),/owned|kept|showcase|discover/i);
  assert.equal((await one('select count(*)::int n from public.dc_requests where request_id=$1',[foreignRequest])).n,0);
  let snapshot=await setSocialPreferences(A,a.snapshot,{showcase:true,featured:[a.find.id]});const view=await getClub(B);assert.equal(view.showcases.companies.length,1);assert.equal(view.showcases.companies[0].user_id,A);
  assert.deepEqual(Object.keys(view.showcases.companies[0].specimens[0]).sort(),['detail','kind','name','quality']);assert.equal(view.showcases.companies[0].specimens[0].kind,'banded_geode');noPrivateIdentity(view,[snapshot.company.id,b.snapshot.company.id]);
  snapshot=await setSocialPreferences(A,snapshot,{showcase:false,featured:[a.find.id]});assert.equal((await getClub(B)).showcases.total,0);const own=await getClub(A);assert.deepEqual(own.own.featured_discovery_ids,[a.find.id]);assert.equal(own.own.featured_specimens.length,1);
 });
 await check('Phase5 retains an explicitly featured older kept specimen beyond the private twenty-four-item history',async()=>{
  const earned=await earnedGeode(A);let snapshot=await setSocialPreferences(A,earned.snapshot,{showcase:true,featured:[earned.find.id]});
  const template=(await one('select * from public.dc_discoveries where id=$1',[earned.find.id]));
  // Bounded owner history fixture: immutable kept records, not earned rewards.
  for(let i=0;i<25;i++)await db.query("insert into public.dc_discoveries(company_id,job_id,x,y,kind,name,quality,detail,sale_value,salvage,status,discovered_at,resolved_at) values($1,$2,$3,10,$4,$5,$6,$7,$8,$9::jsonb,'kept',clock_timestamp(),clock_timestamp())",[snapshot.company.id,template.job_id,i,template.kind,template.name,template.quality,template.detail,template.sale_value,JSON.stringify(template.salvage)]);
  snapshot=await get(A);assert.equal(snapshot.discoveries.filter(find=>find.status==='kept').length,24);assert.ok(!snapshot.discoveries.some(find=>find.id===earned.find.id));
  const own=await getClub(A);assert.deepEqual(own.own.featured_discovery_ids,[earned.find.id]);assert.equal(own.own.featured_specimens.length,1);assert.equal((await getClub(B)).showcases.companies[0].specimens.length,1);
  snapshot=await setSocialPreferences(A,snapshot,{showcase:false,featured:[earned.find.id]});assert.deepEqual((await getClub(A)).own.featured_discovery_ids,[earned.find.id]);
  await setSocialPreferences(A,snapshot,{showcase:false,featured:[]});assert.deepEqual((await getClub(A)).own.featured_specimens,[]);
 });
 await check('Phase5 private accounts retain solo work but cannot read or mutate shared settings, boards or projects',async()=>{
  const hidden=await bootstrap(actors.private);assert.equal(hidden.schema_version,h.currentSchema);await assert.rejects(()=>getClub(actors.private),denied);
  await assert.rejects(()=>setSocialPreferences(actors.private,hidden,{standings:true,showcase:true}),denied);
  const view=await getClub(A);assert.ok(!JSON.stringify(view).includes(actors.private));assert.ok(!view.standings.some(row=>row.user_id===actors.private));
 });
}
