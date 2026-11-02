// Uses the actual permanent DH ledger and notification wrappers, including the
// exact pre-expansion composition. No live awards/accounts are involved.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createDeepClaimFeatsDatabase } from './deep-claim-feats-db.mjs';

export async function runPhase7FeatsTests(h) {
  const { check, fixture, db, id, rpc, request, one, metrics, notifications, board, catalog } = h;
  await check('Phase7 integration: actual pre-expansion catalog, genuine old awards, active plans and acknowledged receipts remain permanent', async () => {
    const legacy = await createDeepClaimFeatsDatabase({ phase: 5 }), user = legacy.id(1);
    const call = (name, args = {}) => legacy.rpc(user,name,args);
    try {
      let snapshot=await call('dc_bootstrap',{p_name:'Permanent Before Ancient Deep',p_request_id:request()});
      const args={p_worker_ids:snapshot.workers.map(worker=>worker.id),p_mode:'extract',p_target_x:47,p_target_y:1,p_duration_minutes:20,p_tutorial:true,p_expected_revision:snapshot.revision,p_request_id:request()};
      snapshot=await call('dc_dispatch',args);let job=snapshot.expeditions.find(job=>job.status==='active');await legacy.advanceJob(user,job.id,job.duration_seconds);snapshot=await call('dc_collect',{p_job_id:job.id,p_request_id:request()});
      await call('dh_feats_board',{p_club_id:legacy.id(10)});
      const beforeAwards=(await legacy.db.query('select to_jsonb(t) row from public.dh_feat_unlocks t order by user_id,feat_key,tier')).rows;
      assert.ok(beforeAwards.some(row=>row.row.feat_key==='deep_claim_shifts'));
      const beforeCatalog=(await legacy.db.query('select to_jsonb(t) row from public.dh_feat_catalog t order by key')).rows;
      snapshot=await call('dc_upgrade',{p_building_key:'mine_office',p_expected_revision:snapshot.revision,p_request_id:request()});
      const activeArgs={...args,p_worker_ids:[snapshot.workers[0].id],p_tutorial:false,p_target_y:2,p_expected_revision:snapshot.revision,p_request_id:request()};snapshot=await call('dc_dispatch',activeArgs);job=snapshot.expeditions.find(job=>job.status==='active');
      const savedPlan=(await legacy.db.query('select to_jsonb(p) row from public.dc_plans p where job_id=$1',[job.id])).rows[0].row;
      const beforeBodies=(await legacy.db.query("select p.oid::regprocedure::text signature,md5(p.prosrc) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^(dc_|dh_feat|dh_feats|dh_home_progress|dh_public_member|dh_visible)' order by signature")).rows;
      assert.equal(beforeBodies.length,133);
      const cash=snapshot.company.cash,revision=(await legacy.db.query('select revision from public.dc_companies where id=$1',[snapshot.company.id])).rows[0].revision;
      await legacy.applyExpansion();
      assert.equal((await legacy.db.query('select revision from public.dc_companies where id=$1',[snapshot.company.id])).rows[0].revision,revision+1);
      assert.deepEqual((await legacy.db.query('select to_jsonb(t) row from public.dh_feat_unlocks t order by user_id,feat_key,tier')).rows,beforeAwards);
      assert.deepEqual((await legacy.db.query('select to_jsonb(t) row from public.dh_feat_catalog t order by key')).rows,beforeCatalog);
      assert.deepEqual((await legacy.db.query('select to_jsonb(p) row from public.dc_plans p where job_id=$1',[job.id])).rows[0].row,savedPlan);
      snapshot=await call('dc_dispatch',activeArgs);assert.equal(snapshot.schema_version,5);assert.equal(snapshot.company.cash,cash);assert.ok(snapshot.revision>=revision+1);assert.equal(snapshot.expeditions.filter(value=>value.id===job.id).length,1);
      const pairedArgs={p_worker_ids:[snapshot.workers[1].id],p_mode:'extract',p_target_x:46,p_target_y:1,p_duration_minutes:20,p_tutorial:false,p_expected_revision:snapshot.revision,p_request_id:request()};
      snapshot=await call('dc_dispatch',pairedArgs);const paired=snapshot.expeditions.find(value=>value.status==='active'&&value.id!==job.id);assert.ok(paired);assert.equal(paired.config_version,7);
      const priorNotices=(await legacy.db.query("select * from public.notifications where user_id=$1 and type='deep_claim'",[user])).rows.length;
      await legacy.db.query("update public.dc_notification_state set last_sent_at=clock_timestamp()-interval '16 minutes' where company_id=$1",[snapshot.company.id]);
      await legacy.advanceJob(user,job.id,job.duration_seconds);await legacy.advanceJob(user,paired.id,paired.duration_seconds);snapshot=await call('dc_get');assert.equal(snapshot.expeditions.find(value=>value.id===job.id).status,'ready');assert.equal(snapshot.expeditions.find(value=>value.id===job.id).config_version,3);assert.equal(snapshot.expeditions.find(value=>value.id===paired.id).status,'ready');
      assert.equal((await legacy.db.query('select public.dc_feat_metrics_v5($1) value',[user])).rows[0].value.deep_claim_shifts,3);
      assert.equal((await legacy.db.query("select count(*)::int n from public.dc_notification_events where company_id=$1 and (event_key like '%'||$2::text||'%' or event_key like '%'||$3::text||'%')",[snapshot.company.id,job.id,paired.id])).rows[0].n,2);
      const summaries=(await legacy.db.query("select * from public.notifications where user_id=$1 and type='deep_claim' order by created_at,id",[user])).rows;assert.equal(summaries.length,priorNotices+1);assert.match(summaries.at(-1).body,/2 completed company events/);
      const afterBodies=(await legacy.db.query("select p.oid::regprocedure::text signature,md5(p.prosrc) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^(dc_|dh_feat|dh_feats|dh_home_progress|dh_public_member|dh_visible)' order by signature")).rows;
      const before=new Map(beforeBodies.map(row=>[row.signature,row.body])),after=new Map(afterBodies.map(row=>[row.signature,row.body]));
      const diff={baseline_count:before.size,current_count:after.size,changed:afterBodies.filter(row=>before.has(row.signature)&&before.get(row.signature)!==row.body),added:afterBodies.filter(row=>!before.has(row.signature)),removed:beforeBodies.filter(row=>!after.has(row.signature))};
      assert.deepEqual(diff.removed,[]);for(const row of beforeBodies.filter(row=>!row.signature.startsWith('dc_')))assert.equal(after.get(row.signature),row.body,'Existing Feats/privacy functions must remain exact');
      const releasedOuter=beforeBodies.find(row=>row.signature.startsWith('dc_reconcile_v1(')),retainedOuter=afterBodies.find(row=>row.signature.startsWith('dc_reconcile_v1_pre_v7('));assert.ok(releasedOuter&&retainedOuter);
      assert.equal(retainedOuter.body,releasedOuter.body,'The actual released outer Feats/inbox wrapper is retained byte-for-byte');
      if(process.argv.includes('--proof'))await writeFile('/tmp/deep-claim-phase7-integrated-body-diff.json',JSON.stringify(diff,null,2));
      await legacy.assertSourcesUnchanged();
    } finally {await legacy.close();}
  });

  const user=id(71);let snapshot;
  await check('Phase7 integration: shaft access alone grants no completed-depth source progress or new Feat families', async () => {
    await db.query('insert into auth.users(id) values($1)',[user]);await db.query("insert into public.profiles(id,display_name) values($1,'Ancient Deep ledger fixture')",[user]);await db.query('insert into public.club_members(user_id,club_id) values($1,$2)',[user,h.CLUB]);
    snapshot=await rpc(user,'dc_bootstrap',{p_name:'Actual Deep Source History',p_request_id:request()});
    await db.query('update public.dc_companies set cash=200000,warehouse_level=3 where id=$1',[snapshot.company.id]);
    await db.query('update public.dc_workers set stats=$2::jsonb where company_id=$1',[snapshot.company.id,JSON.stringify({mining:100,geology:100,engineering:100,logistics:100,safety:100,endurance:100,leadership:100})]);snapshot=await rpc(user,'dc_get');
    for(const key of ['research_office','research_office','smeltery','smeltery','smeltery','tool_station','tool_station'])snapshot=await rpc(user,'dc_upgrade',{p_building_key:key,p_expected_revision:snapshot.revision,p_request_id:request()});
    const remaining=new Set(snapshot.business_catalog.research.map(node=>node.key));
    while(remaining.size){const completed=new Set(snapshot.business.research.filter(order=>order.status==='completed').map(order=>order.key));const next=snapshot.business_catalog.research.find(node=>remaining.has(node.key)&&node.requires.every(key=>completed.has(key)));assert.ok(next);assert.ok(Object.keys(next.inputs).every(key=>!['nickel_ore','sulfur','nickel_alloy'].includes(key)));await db.query('update public.dc_inventory set quantity=coalesce(($2::jsonb->>resource_key)::integer,0) where company_id=$1',[snapshot.company.id,JSON.stringify(next.inputs)]);snapshot=await rpc(user,'dc_get');snapshot=await rpc(user,'dc_start_research',{p_research_key:next.key,p_expected_revision:snapshot.revision,p_request_id:request()});await fixture.advanceResearch(user,next.key,next.duration_seconds);snapshot=await rpc(user,'dc_get');remaining.delete(next.key);}
    await board(user);const awards=await h.unlocks(user),before=await metrics(user);
    for(let level=1;level<6;level++)snapshot=await rpc(user,'dc_upgrade',{p_building_key:'mine_shaft',p_expected_revision:snapshot.revision,p_request_id:request()});
    await board(user);assert.equal((await metrics(user)).deep_claim_depth,before.deep_claim_depth);assert.deepEqual(await h.unlocks(user),awards);
    assert.equal((await one("select count(*)::int n from public.dh_feat_catalog where key like 'deep_claim_%'")).n,7);
    const current=(await db.query("select key,category,title,description,thresholds,points,kind,unit,sort_order from public.dh_feat_catalog where key like 'deep_claim_%' order by sort_order")).rows.map(row=>({...row,thresholds:row.thresholds.map(Number)}));assert.deepEqual(current,catalog);
    await db.query("update public.dc_inventory set quantity=case when resource_key in('nickel_ore','sulfur','nickel_alloy') then 0 else 10 end where company_id=$1",[snapshot.company.id]);snapshot=await rpc(user,'dc_get');
  });
  await check('Phase7 integration: actual new deep returns update existing depth and notification sources once while cargo stays out of processed progress', async () => {
    const before=await metrics(user),beforeNotices=(await notifications(user)).length;
    const rows=(await db.query("select x,y,public.dc_cell_v1($1,x,y) cell from(values(47),(49))v(x) cross join generate_series(608,956)y",[snapshot.company.id])).rows;
    for(const material of ['nickel_ore','sulfur']){
      const beforeDepth=(await metrics(user)).deep_claim_depth;
      const target=rows.find(row=>row.cell.material===material&&!snapshot.world.tiles.some(tile=>tile.x===row.x&&tile.y===row.y));assert.ok(target);
      snapshot=await rpc(user,'dc_dispatch_operation',{p_worker_ids:[snapshot.workers[0].id],p_mode:'explore',p_target_x:target.x,p_target_y:target.y,p_duration_minutes:60,p_tutorial:false,p_infrastructure_key:null,p_expected_revision:snapshot.revision,p_request_id:request()});const job=snapshot.expeditions.find(job=>job.status==='active');
      assert.equal((await metrics(user)).deep_claim_depth,beforeDepth);
      await fixture.advanceJob(user,job.id,job.duration_seconds);snapshot=await rpc(user,'dc_collect',{p_job_id:job.id,p_request_id:request()});assert.ok(snapshot.resources[material]>0);
      assert.ok((await metrics(user)).deep_claim_depth>=target.y);const events=(await db.query("select * from public.dc_notification_events where company_id=$1 and event_key like '%'||$2||'%'",[snapshot.company.id,job.id])).rows;assert.equal(events.length,1);
      await rpc(user,'dc_get');assert.equal((await db.query("select count(*)::int n from public.dc_notification_events where company_id=$1 and event_key like '%'||$2||'%'",[snapshot.company.id,job.id])).rows[0].n,1);
    }
    assert.equal((await metrics(user)).deep_claim_shifts,before.deep_claim_shifts+2);assert.equal((await metrics(user)).deep_claim_processed,before.deep_claim_processed);
    assert.ok((await notifications(user)).length<=beforeNotices+1,'Existing cooldown and daily cap must still bound summaries');
  });
  await check('Phase7 integration: fully collected nickel alloy counts once from frozen cfg4 outputs and crafted heat shields add no processed units', async () => {
    const before=await metrics(user);
    snapshot=await rpc(user,'dc_start_production',{p_recipe_key:'smelt_nickel_alloy',p_batches:2,p_expected_revision:snapshot.revision,p_request_id:request()});let job=snapshot.production_jobs.find(job=>job.status==='active');
    assert.equal((await metrics(user)).deep_claim_processed,before.deep_claim_processed);await fixture.advanceProduction(user,job.id,job.duration_seconds);snapshot=await rpc(user,'dc_get');assert.equal((await metrics(user)).deep_claim_processed,before.deep_claim_processed);
    const key=request();snapshot=await rpc(user,'dc_collect_production',{p_job_id:job.id,p_request_id:key});assert.equal((await metrics(user)).deep_claim_processed,before.deep_claim_processed+2);
    await rpc(user,'dc_collect_production',{p_job_id:job.id,p_request_id:key});assert.equal((await metrics(user)).deep_claim_processed,before.deep_claim_processed+2);
    snapshot=await rpc(user,'dc_get');snapshot=await rpc(user,'dc_start_production',{p_recipe_key:'craft_nickel_heatshield',p_batches:1,p_expected_revision:snapshot.revision,p_request_id:request()});job=snapshot.production_jobs.find(job=>job.status==='active');await fixture.advanceProduction(user,job.id,job.duration_seconds);snapshot=await rpc(user,'dc_collect_production',{p_job_id:job.id,p_request_id:request()});
    assert.ok(snapshot.equipment.some(item=>item.definition_key==='nickel_heatshield'));assert.equal((await metrics(user)).deep_claim_processed,before.deep_claim_processed+2);
    await board(user);assert.equal((await one("select count(*)::int n from public.dh_feat_catalog where key like 'deep_claim_%'")).n,7);
  });
}
