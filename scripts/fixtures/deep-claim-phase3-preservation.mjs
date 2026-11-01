// Genuine pre-cutover operations exercised through the actual migrations.
// Owner-only terrain setup creates a reachable border, never live rewards.
import assert from 'node:assert/strict';
import { createDeepClaimDatabase } from './deep-claim-db.mjs';

export async function runPhase3PreservationTests(h) {
  const { check, A, request, engine } = h;
  for (const scenario of [
    { partial: false, revealOnly: false }, { partial: false, revealOnly: true },
    { partial: true, revealOnly: false }, { partial: true, revealOnly: true },
  ]) await check(`Phase3 cutover preserves ${scenario.partial ? 'partially applied' : 'pending'} config2 ${scenario.revealOnly ? 'reveal-only' : 'extraction'} border chunks`, async () => {
    const legacy = await createDeepClaimDatabase({ phase: 2 });
    const one = async (sql, parameters = []) => (await legacy.db.query(sql, parameters)).rows[0];
    const call = (name, args = {}) => legacy.rpc(A, name, args);
    try {
      let snapshot = await call('dc_bootstrap', { p_name: 'Saved Border Company', p_request_id: request() });
      assert.equal(snapshot.schema_version, 2);
      const company = snapshot.company.id;
      await legacy.db.query('update public.dc_companies set cash=30000 where id=$1', [company]);
      snapshot = await call('dc_get');
      for (let level = 1; level < 4; level++) snapshot = await call('dc_upgrade', { p_building_key: 'mine_shaft', p_expected_revision: snapshot.revision, p_request_id: request() });
      // The real shaft reaches256. A controlled, connected old tunnel reaches
      // the y299/cy9 border, where later geology can otherwise reroll old plans.
      const corridor = [];
      for (let y = 256; y <= 299; y++) corridor.push([47, y]);
      for (let x = scenario.revealOnly ? 34 : 32; x <= 47; x++) corridor.push([x, 299]);
      for (const [x, y] of corridor) {
        await legacy.db.query('select public.dc_reveal_v1($1,$2,$3)', [company, x, y]);
        await legacy.db.query('update public.dc_tiles set remaining=0 where company_id=$1 and x=$2 and y=$3', [company, x, y]);
      }
      const worker = snapshot.workers.find(person => person.name === 'Ivo Vale');
      const stats = { mining: 1, geology: 50, engineering: 1, logistics: 1, safety: 1, endurance: 1, leadership: 1 };
      await legacy.db.query('update public.dc_workers set stats=$2::jsonb where id=$1', [worker.id, JSON.stringify(stats)]);
      // Real crafting establishes an owned tool and an actual frozen v2 wear
      // record, so migration cannot silently add or repeat equipment wear.
      await legacy.db.query("update public.dc_inventory set quantity=case resource_key when 'copper_bar' then 1 when 'stone' then 4 else quantity end where company_id=$1", [company]);
      snapshot = await call('dc_get');
      snapshot = await call('dc_start_production', { p_recipe_key: 'craft_copper_pickaxe', p_batches: 1, p_expected_revision: snapshot.revision, p_request_id: request() });
      const production = snapshot.production_jobs[0];
      await legacy.advanceProduction(A, production.id, production.duration_seconds + 1);
      snapshot = await call('dc_collect_production', { p_job_id: production.id, p_request_id: request() });
      const item = snapshot.equipment[0];
      snapshot = await call('dc_assign_equipment', { p_item_id: item.id, p_worker_id: worker.id, p_expected_revision: snapshot.revision, p_request_id: request() });
      const target = { x: scenario.revealOnly ? 33 : 31, y: 299 };
      const dispatchArgs = { p_worker_ids: [worker.id], p_mode: 'explore', p_target_x: target.x, p_target_y: target.y, p_duration_minutes: 180,
        p_tutorial: false, p_expected_revision: snapshot.revision, p_request_id: request() };
      snapshot = await call('dc_dispatch', dispatchArgs);
      const job = snapshot.expeditions.find(operation => operation.status === 'active');
      assert.equal(job.config_version, 2); assert.equal(job.duration_seconds, 10800);
      const plan = (await one('select content from public.dc_plans where job_id=$1', [job.id])).content;
      const futureCells = [...new Map([...plan.extractions, ...plan.reveals].map(point => [`${point.x}:${point.y}`, { x: point.x, y: point.y }])).values()];
      const expectedCells = new Map();
      for (const point of futureCells) expectedCells.set(`${point.x}:${point.y}`, (await one('select public.dc_cell_v1($1,$2,$3) cell', [company, point.x, point.y])).cell);
      assert.equal((await one('select count(*)::int n from public.dc_chunks where company_id=$1 and chunk_x=0 and chunk_y=9', [company])).n, 0);
      if (scenario.revealOnly) {
        assert.ok(plan.extractions.every(point => Math.floor(point.x / 32) === 1));
        assert.ok(plan.reveals.some(point => Math.floor(point.x / 32) === 0));
      } else assert.ok(plan.extractions.some(point => Math.floor(point.x / 32) === 0));
      if (scenario.partial) {
        const due = await one('select due_at from public.dc_milestones where job_id=$1 and sequence=1', [job.id]);
        await legacy.advanceJob(A, job.id, Math.ceil((new Date(due.due_at).getTime() - Date.parse(job.started_at)) / 1000) + 1);
        snapshot = await call('dc_get');
        assert.equal((await one('select count(*)::int n from public.dc_milestones where job_id=$1 and applied_at is not null', [job.id])).n, 1);
        if (scenario.revealOnly) assert.equal((await one('select count(*)::int n from public.dc_chunks where company_id=$1 and chunk_x=0 and chunk_y=9', [company])).n, 0);
      }
      const frozen = {};
      for (const table of ['dc_worlds', 'dc_chunks', 'dc_tiles', 'dc_workers', 'dc_expeditions', 'dc_plans', 'dc_milestones', 'dc_job_equipment', 'dc_requests']) {
        frozen[table] = (await legacy.db.query(`select row_to_json(t) record from public.${table} t order by row_to_json(t)::text`)).rows;
      }
      const beforeCash = snapshot.company.cash;
      const beforeRevision = snapshot.revision;
      const oldDefinition = (await one("select pg_get_functiondef('public.dc_dispatch(uuid[],text,integer,integer,integer,boolean,integer,uuid)'::regprocedure) source")).source;
      const pausedDefinition = oldDefinition.replace('FUNCTION public.dc_dispatch(', 'FUNCTION public.qa_paused_dispatch(');
      assert.notEqual(pausedDefinition, oldDefinition);
      await legacy.db.exec(pausedDefinition);
      await legacy.applyPendingMigrations({ phase: 3 });
      for (const table of Object.keys(frozen)) {
        const after = (await legacy.db.query(`select row_to_json(t) record from public.${table} t order by row_to_json(t)::text`)).rows;
        for (const original of frozen[table]) assert.ok(after.some(current => Object.entries(original.record).every(([field, value]) => JSON.stringify(current.record[field]) === JSON.stringify(value))), `${table} old fields changed during cutover`);
        if (table === 'dc_tiles') assert.equal(after.length, frozen[table].length, 'Pinning metadata must not reveal future terrain');
      }
      for (const point of futureCells) {
        const metadata = await one('select world_version,seed from public.dc_chunks where company_id=$1 and chunk_x=$2 and chunk_y=$3', [company, Math.floor(point.x / 32), Math.floor(point.y / 32)]);
        assert.equal(metadata.world_version, 2);
        const seed = await one("select md5(seed::text||':2:'||$2::text||':'||$3::text) seed from public.dc_worlds where company_id=$1", [company, Math.floor(point.x / 32), Math.floor(point.y / 32)]);
        assert.equal(metadata.seed, seed.seed);
        const current = (await one('select public.dc_cell_v1($1,$2,$3) cell', [company, point.x, point.y])).cell;
        const expected = expectedCells.get(`${point.x}:${point.y}`);
        assert.equal(current.material, expected.material); assert.equal(current.initial_amount, expected.initial_amount);
      }
      snapshot = await call('dc_get'); engine.validateDeepClaimSnapshot(snapshot); assert.equal(snapshot.schema_version, 3);
      assert.equal(snapshot.revision, beforeRevision + 1, 'The cutover invalidates old quotes with one metadata revision');
      assert.equal(snapshot.company.cash, beforeCash); assert.equal(snapshot.equipment.find(gear => gear.id === item.id).durability, item.durability);
      const retriedReceipt = await call('dc_dispatch', dispatchArgs);
      assert.equal(retriedReceipt.company.cash, beforeCash); assert.equal(retriedReceipt.expeditions.filter(operation => operation.id === job.id).length, 1);
      assert.equal(retriedReceipt.revision, snapshot.revision, 'A committed old dispatch UUID replays before the new revision check');
      await assert.rejects(call('dc_dispatch', { ...dispatchArgs, p_request_id: request() }), error => error.code === '40001');
      await legacy.advanceJob(A, job.id, 10801); snapshot = await call('dc_get'); engine.validateDeepClaimSnapshot(snapshot);
      const complete = snapshot.expeditions.find(operation => operation.id === job.id);
      assert.equal(complete.status, 'ready'); assert.equal(complete.config_version, 2); assert.deepEqual(complete.cargo, plan.cargo);
      assert.equal(snapshot.workers.find(person => person.id === worker.id).xp, 36); assert.equal(snapshot.workers.find(person => person.id === worker.id).energy, 3);
      assert.equal(snapshot.equipment.find(gear => gear.id === item.id).durability, item.max_durability - 6);
      assert.deepEqual((await one('select content from public.dc_plans where job_id=$1', [job.id])).content, plan);
      assert.equal((await one('select count(*)::int n from public.dc_field_events where job_id=$1', [job.id])).n, 0);
      assert.equal(snapshot.discovery_summary.pending, 0, 'Legacy mining must not gain retroactive finds');
      for (const extraction of plan.extractions) {
        const current = await one('select material,initial_amount,remaining from public.dc_tiles where company_id=$1 and x=$2 and y=$3', [company, extraction.x, extraction.y]);
        const expected = expectedCells.get(`${extraction.x}:${extraction.y}`);
        assert.equal(current.material, expected.material); assert.equal(current.initial_amount, expected.initial_amount); assert.equal(current.remaining, expected.initial_amount - extraction.quantity);
      }
      const repeated = await call('dc_get'); assert.equal(repeated.equipment.find(gear => gear.id === item.id).durability, item.max_durability - 6);
      snapshot = await call('dc_collect', { p_job_id: job.id, p_request_id: request() });
      const pausedArgs = [[worker.id], 'extract', 47, 2, 20, false, snapshot.revision, request()];
      await assert.rejects(legacy.actorQuery(A, 'select public.qa_paused_dispatch($1::uuid[],$2::text,$3::integer,$4::integer,$5::integer,$6::boolean,$7::integer,$8::uuid)', pausedArgs), error => error.code === '40001');
      assert.equal((await call('dc_get')).company.cash, snapshot.company.cash);
      const latest = await call('dc_dispatch', { p_worker_ids: [worker.id], p_mode: 'extract', p_target_x: 47, p_target_y: 2, p_duration_minutes: 20,
        p_tutorial: false, p_expected_revision: snapshot.revision, p_request_id: request() });
      assert.equal(latest.expeditions.find(operation => operation.status === 'active').config_version, 3);
    } finally { await legacy.close(); }
  });
}
