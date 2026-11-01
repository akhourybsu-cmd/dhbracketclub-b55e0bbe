// Real schema-four activity survives the additive social migration untouched.
import assert from 'node:assert/strict';
import { createDeepClaimDatabase } from './deep-claim-db.mjs';

export async function runPhase5PreservationTests({ check, A, request, engine }) {
  await check('Phase5 cutover preserves private active field/research/production, decisions, economy and exact acknowledged requests', async () => {
    const old = await createDeepClaimDatabase({ phase: 4 }), one = async (sql, args = []) => (await old.db.query(sql, args)).rows[0], call = (name, args = {}) => old.rpc(A, name, args);
    let snapshot = await call('dc_bootstrap', { p_name: 'Private Before Sharing', p_request_id: request() }); const company = snapshot.company.id;
    const upgrade = async key => { snapshot = await call('dc_upgrade', { p_building_key: key, p_expected_revision: snapshot.revision, p_request_id: request() }); };
    const operation = async (worker, mode, x, y, infrastructure = null) => {
      const args = { p_worker_ids: [worker.id], p_mode: mode, p_target_x: x, p_target_y: y, p_duration_minutes: 20, p_tutorial: false, p_infrastructure_key: infrastructure, p_expected_revision: snapshot.revision, p_request_id: request() };
      snapshot = await call('dc_dispatch_operation', args); return { args, job: snapshot.expeditions.find(job => job.status === 'active' && job.worker_ids.includes(worker.id)) };
    };
    try {
      await old.db.query('update public.dc_companies set cash=20000,warehouse_level=3 where id=$1', [company]); snapshot = await call('dc_get');
      for (const key of ['mine_office','mine_office','research_office','trading_post','smeltery']) await upgrade(key);
      await old.db.query('update public.dc_inventory set quantity=20 where company_id=$1', [company]); snapshot = await call('dc_get');
      const mara = snapshot.workers.find(worker => worker.name === 'Mara Flint'), ivo = snapshot.workers.find(worker => worker.name === 'Ivo Vale'), tessa = snapshot.workers.find(worker => worker.name === 'Tessa Pike');
      const quartz = await operation(mara, 'extract', 47, 3); await old.advanceJob(A, quartz.job.id, quartz.job.duration_seconds + 1);
      snapshot = await call('dc_collect', { p_job_id: quartz.job.id, p_request_id: request() });
      const specimen = snapshot.discoveries.find(find => find.x === 47 && find.y === 3);
      snapshot = await call('dc_resolve_discovery', { p_discovery_id: specimen.id, p_choice: 'keep', p_expected_revision: snapshot.revision, p_request_id: request() });
      snapshot = await call('dc_fulfill_contract', { p_contract_key: 'yard_foundations', p_expected_revision: snapshot.revision, p_request_id: request() });
      snapshot = await call('dc_claim_milestone', { p_milestone_key: 'first_shift', p_expected_revision: snapshot.revision, p_request_id: request() });
      const researchArgs = { p_research_key: 'geology_1', p_expected_revision: snapshot.revision, p_request_id: request() };
      snapshot = await call('dc_start_research', researchArgs);
      const productionArgs = { p_recipe_key: 'smelt_copper', p_batches: 1, p_expected_revision: snapshot.revision, p_request_id: request() };
      snapshot = await call('dc_start_production', productionArgs); const production = snapshot.production_jobs.find(job => job.status === 'active');
      const field = [await operation(mara, 'extract', 49, 3), await operation(ivo, 'survey', 48, 4), await operation(tessa, 'infrastructure', 48, 5, 'ventilation')];
      const tables = (await old.db.query("select tablename from pg_tables where schemaname='public' and tablename like 'dc_%' order by tablename")).rows.map(row => row.tablename), saved = {};
      for (const table of tables) saved[table] = (await old.db.query(`select to_jsonb(t) record from public.${table} t order by to_jsonb(t)::text`)).rows;
      await old.applyPendingMigrations({ phase: 5 });
      for (const table of tables) assert.deepEqual((await old.db.query(`select to_jsonb(t) record from public.${table} t ${table === 'dc_rules' ? 'where version<=4' : ''} order by to_jsonb(t)::text`)).rows, saved[table], `${table} original rows must be byte-for-byte unchanged by the social extension`);
      const shared = await call('dc_get_club'); engine.validateDeepClaimClubView(shared);
      assert.equal(shared.own.standings_enabled, false); assert.equal(shared.own.showcase_enabled, false); assert.deepEqual(shared.own.featured_discovery_ids, []); assert.deepEqual(shared.standings, []); assert.deepEqual(shared.showcases.companies, []);
      const cash = snapshot.company.cash;
      await call('dc_start_research', researchArgs); await call('dc_start_production', productionArgs); await call('dc_dispatch_operation', field[0].args);
      assert.equal((await call('dc_get')).company.cash, cash);
      await old.advanceResearch(A, 'geology_1', 301); await old.advanceProduction(A, production.id, production.duration_seconds + 1);
      for (const { job } of field) await old.advanceJob(A, job.id, job.duration_seconds + 1);
      snapshot = await call('dc_get'); engine.validateDeepClaimSnapshot(snapshot);
      assert.equal(snapshot.schema_version, 4); assert.equal(snapshot.business.research.find(order => order.key === 'geology_1').status, 'completed');
      assert.equal(snapshot.production_jobs.find(job => job.id === production.id).research_speed_percent, 0);
      assert.equal(snapshot.discoveries.find(find => find.id === specimen.id).status, 'kept'); assert.ok(snapshot.business.milestones.find(item => item.key === 'first_shift').claimed_at);
      assert.equal(snapshot.business.contracts.find(item => item.key === 'yard_foundations').status, 'completed');
      assert.ok(field.every(({ job }) => snapshot.expeditions.find(current => current.id === job.id).config_version === 3));
      assert.equal((await one('select config_version from public.dc_production_jobs where id=$1', [production.id])).config_version, 4);
    } finally { await old.close(); }
  });
}
