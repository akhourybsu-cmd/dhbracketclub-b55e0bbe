// Actual pre-business companies and immutable tickets, migrated in isolation.
import assert from 'node:assert/strict';
import { createDeepClaimDatabase } from './deep-claim-db.mjs';

export async function runPhase4PreservationTests(h) {
  const { check, A, request, engine } = h;
  for (const partial of [false, true]) await check(`Phase4 cutover preserves ${partial ? 'partially elapsed' : 'whole'} field plans, staged production, finds, gear and acknowledged receipts`, async () => {
    const legacy = await createDeepClaimDatabase({ phase: 3 });
    const one = async (sql, args = []) => (await legacy.db.query(sql, args)).rows[0];
    const call = (name, args = {}) => legacy.rpc(A, name, args);
    let snapshot = await call('dc_bootstrap', { p_name: 'Old Working Claim', p_request_id: request() });
    const company = snapshot.company.id;
    const upgrade = async key => { snapshot = await call('dc_upgrade', { p_building_key: key, p_expected_revision: snapshot.revision, p_request_id: request() }); };
    const production = async key => {
      const args = { p_recipe_key: key, p_batches: 1, p_expected_revision: snapshot.revision, p_request_id: request() };
      snapshot = await call('dc_start_production', args); return { args, job: snapshot.production_jobs.find(job => job.status === 'active' && job.recipe_key === key && !orders.some(old => old.job.id === job.id)) };
    };
    const orders = [];
    const operation = async (worker, mode, x, y, infrastructure = null) => {
      const args = { p_worker_ids: [worker.id], p_mode: mode, p_target_x: x, p_target_y: y, p_duration_minutes: 20,
        p_tutorial: false, p_infrastructure_key: infrastructure, p_expected_revision: snapshot.revision, p_request_id: request() };
      snapshot = await call('dc_dispatch_operation', args); return { args, job: snapshot.expeditions.find(job => job.status === 'active' && job.worker_ids.includes(worker.id)) };
    };
    try {
      assert.equal(snapshot.schema_version, 3);
      await legacy.db.query('update public.dc_companies set cash=20000,warehouse_level=3 where id=$1', [company]); snapshot = await call('dc_get');
      for (const key of ['mine_office', 'mine_office', 'smeltery', 'gem_workshop']) await upgrade(key);
      for (const [key, amount] of Object.entries({ coal: 20, stone: 24, clay: 10, copper_ore: 40, copper_bar: 1, quartz: 6 })) await legacy.db.query('update public.dc_inventory set quantity=$3 where company_id=$1 and resource_key=$2', [company, key, amount]);
      snapshot = await call('dc_get'); const mara = snapshot.workers.find(worker => worker.name === 'Mara Flint'), ivo = snapshot.workers.find(worker => worker.name === 'Ivo Vale'), tessa = snapshot.workers.find(worker => worker.name === 'Tessa Pike');
      const recovered = await operation(mara, 'extract', 47, 3);
      await legacy.advanceJob(A, recovered.job.id, recovered.job.duration_seconds + 1); snapshot = await call('dc_collect', { p_job_id: recovered.job.id, p_request_id: request() });
      assert.ok(snapshot.discoveries.some(find => find.x === 47 && find.y === 3 && find.status === 'pending'));
      const crafted = await production('craft_copper_pickaxe');
      await legacy.advanceProduction(A, crafted.job.id, crafted.job.duration_seconds + 1); snapshot = await call('dc_collect_production', { p_job_id: crafted.job.id, p_request_id: request() });
      const item = snapshot.equipment[0]; snapshot = await call('dc_assign_equipment', { p_item_id: item.id, p_worker_id: mara.id, p_expected_revision: snapshot.revision, p_request_id: request() });
      const mining = await operation(mara, 'extract', 49, 3), survey = await operation(ivo, 'survey', 48, 4), construction = await operation(tessa, 'infrastructure', 48, 5, 'supports');
      const active = [mining, survey, construction]; assert.ok(active.every(value => value.job?.config_version === 3));
      if (partial) for (const { job } of active) {
        const first = await one('select due_at from public.dc_milestones where job_id=$1 and kind=\'work\' order by sequence limit 1', [job.id]);
        await legacy.advanceJob(A, job.id, Math.ceil((new Date(first.due_at).getTime() - Date.parse(job.started_at)) / 1000) + 1); snapshot = await call('dc_get');
      }
      orders.push(await production('smelt_copper')); orders.push(await production('smelt_copper')); orders.push(await production('polish_quartz'));
      await legacy.advanceProduction(A, orders[0].job.id, orders[0].job.duration_seconds + 1); snapshot = await call('dc_get');
      await legacy.db.query("update public.dc_inventory set quantity=case resource_key when 'clay' then 479 else 0 end where company_id=$1", [company]);
      const collectArgs = { p_job_id: orders[0].job.id, p_request_id: request() };
      snapshot = await call('dc_collect_production', collectArgs);
      assert.equal(snapshot.production_jobs.find(job => job.id === orders[0].job.id).outputs.copper_bar, 1);
      assert.equal(snapshot.production_jobs.find(job => job.id === orders[0].job.id).status, 'ready');
      assert.equal(snapshot.production_jobs.find(job => job.id === orders[1].job.id).status, 'active');
      assert.equal(snapshot.production_jobs.find(job => job.id === orders[2].job.id).status, 'ready');
      const frozen = {};
      for (const table of ['dc_worlds','dc_chunks','dc_tiles','dc_workers','dc_expeditions','dc_plans','dc_milestones','dc_job_equipment','dc_equipment','dc_inventory','dc_requests','dc_field_events','dc_discoveries','dc_infrastructure','dc_production_jobs','dc_recipes','dc_equipment_catalog']) frozen[table] = (await legacy.db.query(`select to_jsonb(t) record from public.${table} t order by to_jsonb(t)::text`)).rows;
      const oldCash = snapshot.company.cash;
      const definition = (await one("select pg_get_functiondef('public.dc_start_production(text,integer,integer,uuid)'::regprocedure) definition")).definition;
      const alias = definition.replace('FUNCTION public.dc_start_production(', 'FUNCTION public.qa_cached_production('); assert.notEqual(alias, definition); await legacy.db.exec(alias);
      await legacy.applyPendingMigrations({ phase: 4 });
      for (const [table, records] of Object.entries(frozen)) {
        const current = (await legacy.db.query(`select to_jsonb(t) record from public.${table} t order by to_jsonb(t)::text`)).rows;
        for (const previous of records) assert.ok(current.some(row => Object.entries(previous.record).every(([key, value]) => JSON.stringify(row.record[key]) === JSON.stringify(value))), `${table} changed an original committed field`);
        if (['dc_worlds','dc_tiles','dc_chunks','dc_plans','dc_milestones','dc_field_events','dc_discoveries','dc_infrastructure'].includes(table)) assert.equal(current.length, records.length);
      }
      snapshot = await call('dc_get'); engine.validateDeepClaimSnapshot(snapshot); assert.equal(snapshot.schema_version, 4); assert.equal(snapshot.company.cash, oldCash);
      assert.equal(snapshot.business.research.length, 0); assert.ok(snapshot.business.milestones.every(milestone => milestone.claimed_at === null));
      await call('dc_dispatch_operation', mining.args); await call('dc_start_production', orders[1].args); await call('dc_collect_production', collectArgs);
      assert.equal((await call('dc_get')).company.cash, oldCash, 'Acknowledged pre-migration receipts replay without a second debit or reward');
      for (const { job } of active) await legacy.advanceJob(A, job.id, job.duration_seconds + 1);
      snapshot = await call('dc_get'); engine.validateDeepClaimSnapshot(snapshot);
      assert.equal(snapshot.expeditions.find(job => job.id === mining.job.id).status, 'ready');
      for (const auxiliary of [survey, construction]) assert.equal(snapshot.expeditions.find(job => job.id === auxiliary.job.id).status, 'collected');
      assert.equal(snapshot.equipment.find(gear => gear.id === item.id).durability, item.max_durability - 2);
      assert.equal(snapshot.infrastructure.find(project => project.job_id === construction.job.id).status, 'installed');
      assert.ok(snapshot.business.stats.completed_surveys >= 1); assert.ok(snapshot.business.stats.installed_infrastructure >= 1);
      await legacy.advanceProduction(A, orders[1].job.id, orders[1].job.duration_seconds + 1); snapshot = await call('dc_get');
      await legacy.db.query('update public.dc_inventory set quantity=0 where company_id=$1', [company]);
      for (const order of orders) snapshot = await call('dc_collect_production', { p_job_id: order.job.id, p_request_id: request() });
      assert.ok(snapshot.production_jobs.filter(job => orders.some(old => old.job.id === job.id)).every(job => job.status === 'collected' && job.research_speed_percent === 0));
      for (const order of orders) assert.equal((await one('select config_version from public.dc_production_jobs where id=$1', [order.job.id])).config_version, 2);
      assert.equal(snapshot.resources.copper_bar, 3); assert.equal(snapshot.resources.polished_quartz, 3);
      await legacy.db.query("update public.dc_inventory set quantity=20 where company_id=$1 and resource_key in('copper_bar','tin_bar','coal')", [company]); snapshot = await call('dc_get');
      const beforeGuard = { cash: snapshot.company.cash, resources: snapshot.resources };
      const bronzeRecipe = snapshot.recipes.find(recipe => recipe.outputs.bronze_bar); assert.ok(bronzeRecipe);
      await assert.rejects(legacy.actorQuery(A, 'select public.qa_cached_production($1,$2,$3,$4)', [bronzeRecipe.key, 1, snapshot.revision, request()]), error => error.code === '40001');
      snapshot = await call('dc_get'); assert.deepEqual({ cash: snapshot.company.cash, resources: snapshot.resources }, beforeGuard);
    } finally { await legacy.close(); }
  });
}
