// Actual released SQL creates every saved operation. Owner-only setup prepares
// a reachable late-game test border; no production database or rewards exist.
import assert from 'node:assert/strict';
import { createDeepClaimDatabase } from './deep-claim-db.mjs';

export async function runPhase7PreservationTests(h) {
  const { check, A, request, engine } = h;
  for (const mode of ['explore', 'survey', 'infrastructure']) for (const partial of [false, true]) {
    await check(`Phase7 preservation: ${partial ? 'partially applied' : 'pending'} actual config3 ${mode} keeps frozen plans and original geology`, async () => {
      const old = await createDeepClaimDatabase({ phase: 5 });
      const one = async (sql, args = []) => (await old.db.query(sql, args)).rows[0];
      const call = (name, args = {}) => old.rpc(A, name, args);
      try {
        let snapshot = await call('dc_bootstrap', { p_name: 'Saved Deep Frontier', p_request_id: request() });
        assert.equal(snapshot.schema_version, 4); const company = snapshot.company.id;
        await old.db.query('update public.dc_companies set cash=100000,warehouse_level=3 where id=$1', [company]);
        await old.db.query('update public.dc_workers set stats=$2::jsonb where company_id=$1', [company, JSON.stringify({ mining: 100, geology: 100, engineering: 100, logistics: 100, safety: 100, endurance: 100, leadership: 100 })]);
        snapshot = await call('dc_get');
        if (mode === 'survey' && !partial) snapshot = await call('dc_upgrade', { p_building_key: 'mine_office', p_expected_revision: snapshot.revision, p_request_id: request() });
        for (let level = 1; level < 5; level++) snapshot = await call('dc_upgrade', { p_building_key: 'mine_shaft', p_expected_revision: snapshot.revision, p_request_id: request() });
        // Connected old ground stops at the old supported boundary. The scout
        // and survey still commit unknown cells in the neighboring chunk.
        for (let y = 557; y <= 599; y++) {
          await old.db.query('select public.dc_reveal_v1($1,48,$2)', [company, y]);
          await old.db.query('update public.dc_tiles set remaining=0 where company_id=$1 and x=48 and y=$2', [company, y]);
        }
        for (let x = 32; x < 48; x++) {
          await old.db.query('select public.dc_reveal_v1($1,$2,599)', [company, x]);
          await old.db.query('update public.dc_tiles set remaining=0 where company_id=$1 and x=$2 and y=599', [company, x]);
        }
        await old.db.query("update public.dc_inventory set quantity=case resource_key when 'stone' then 50 when 'clay' then 10 when 'iron_bar' then 5 else 0 end where company_id=$1", [company]);
        snapshot = await call('dc_get');
        const worker = snapshot.workers.find(worker => worker.name === 'Ivo Vale');
        const args = { p_worker_ids: [worker.id], p_mode: mode, p_target_x: mode === 'explore' ? 31 : 32, p_target_y: 599,
          p_duration_minutes: 180, p_tutorial: false, p_infrastructure_key: mode === 'infrastructure' ? 'rail' : null,
          p_expected_revision: snapshot.revision, p_request_id: request() };
        const quote = await call('dc_preview_operation', Object.fromEntries(Object.entries(args).filter(([key]) => !['p_expected_revision','p_request_id'].includes(key))));
        assert.equal(quote.allowed, true, quote.reasons.join(' '));
        snapshot = await call('dc_dispatch_operation', args);
        const job = snapshot.expeditions.find(job => job.status === 'active'); assert.ok(job); assert.equal(job.config_version, 3);
        const plan = (await one('select content from public.dc_plans where job_id=$1', [job.id])).content;
        const points = [...new Map([...(plan.reveals ?? []), ...(plan.extractions ?? []), ...(job.route ?? []), { x: job.target.x, y: job.target.y }].map(point => [`${point.x}:${point.y}`, point])).values()];
        assert.ok(points.length > 0);
        const geology = new Map();
        for (const point of points) geology.set(`${point.x}:${point.y}`, (await one('select public.dc_cell_v1($1,$2,$3) cell', [company, point.x, point.y])).cell);
        if (partial) {
          const first = await one('select due_at from public.dc_milestones where job_id=$1 and applied_at is null order by due_at,sequence limit 1', [job.id]);
          assert.ok(first); await old.advanceJob(A, job.id, Math.ceil((Date.parse(first.due_at) - Date.parse(job.started_at)) / 1000) + 1);
          snapshot = await call('dc_get');
          assert.ok((await one('select count(*)::int n from public.dc_milestones where job_id=$1 and applied_at is not null', [job.id])).n > 0);
        }
        // Exercise defense for older queued rows lacking future metadata. Only
        // absent terrain chunks are unpinned, so committed public cells retain
        // their original metadata and no owner fixture erases real terrain.
        if (mode !== 'infrastructure') {
          await old.db.exec('alter table public.dc_chunks disable trigger dc_frozen_chunks');
          await old.db.query('delete from public.dc_chunks c where company_id=$1 and not exists(select 1 from public.dc_tiles t where t.company_id=c.company_id and t.x/32=c.chunk_x and t.y/32=c.chunk_y)', [company]);
          await old.db.exec('alter table public.dc_chunks enable trigger dc_frozen_chunks');
        }
        const saved = {}, tables = (await old.db.query("select tablename from pg_tables where schemaname='public' and tablename like 'dc_%' order by tablename")).rows.map(row => row.tablename);
        for (const table of tables) saved[table] = (await old.db.query(`select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`)).rows.map(row => row.row);
        const previousRevision = (await one('select revision from public.dc_companies where id=$1', [company])).revision, previousCash = snapshot.company.cash;
        const originalDispatch = (await one("select pg_get_functiondef('public.dc_dispatch_operation(uuid[],text,integer,integer,integer,boolean,text,integer,uuid)'::regprocedure) source")).source;
        const paused = originalDispatch.replace('FUNCTION public.dc_dispatch_operation(', 'FUNCTION public.qa_phase7_paused_dispatch('); assert.notEqual(paused, originalDispatch); await old.db.exec(paused);
        await old.applyPendingMigrations({ phase: 7 });
        assert.equal((await one('select revision from public.dc_companies where id=$1', [company])).revision, previousRevision + 1, 'Cutover itself invalidates quotes exactly once before any lazy RPC reconciliation');
        for (const table of tables) {
          const current = (await old.db.query(`select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`)).rows.map(row => row.row);
          for (const before of saved[table]) assert.ok(current.some(after => Object.entries(before).every(([key, value]) => table === 'dc_companies' && ['revision','updated_at'].includes(key) || JSON.stringify(after[key]) === JSON.stringify(value))), `${table} existing content changed`);
          if (table === 'dc_tiles') assert.equal(current.length, saved[table].length, 'Cutover must not reveal future terrain');
        }
        snapshot = await call('dc_get'); engine.validateDeepClaimSnapshot(snapshot);
        assert.equal(snapshot.schema_version, 5); assert.ok(snapshot.revision >= previousRevision + 1); assert.equal(snapshot.company.cash, previousCash);
        assert.equal(snapshot.expeditions.find(operation => operation.id === job.id).config_version, 3);
        for (const point of points) {
          const cell = (await one('select public.dc_cell_v1($1,$2,$3) cell', [company, point.x, point.y])).cell, expected = geology.get(`${point.x}:${point.y}`);
          assert.equal(cell.material, expected.material); assert.equal(cell.initial_amount, expected.initial_amount);
          assert.ok(await one('select 1 ok from public.dc_chunks where company_id=$1 and chunk_x=$2 and chunk_y=$3', [company, Math.floor(point.x / 32), Math.floor(point.y / 32)]));
        }
        const receipt = await call('dc_dispatch_operation', args);
        assert.equal(receipt.company.cash, previousCash); assert.equal(receipt.revision, snapshot.revision);
        assert.equal(receipt.expeditions.filter(operation => operation.id === job.id).length, 1);
        await assert.rejects(call('dc_dispatch_operation', { ...args, p_request_id: request() }), error => error.code === '40001');
        if (mode === 'survey' && !partial) {
          const other = snapshot.workers.find(person => person.id !== worker.id);
          const mixed = await call('dc_dispatch_operation', { ...args, p_target_x: 33, p_worker_ids: [other.id], p_expected_revision: snapshot.revision, p_request_id: request() });
          const current = mixed.expeditions.find(operation => operation.id !== job.id && operation.status === 'active'); assert.ok(current); assert.equal(current.config_version, 7);
          const knownBefore = new Set(mixed.world.tiles.map(tile => `${tile.x}:${tile.y}`));
          const newerPlan = (await one('select content from public.dc_plans where job_id=$1', [current.id])).content;
          const newerReveals = new Set(newerPlan.reveals.map(point => `${point.x}:${point.y}`).filter(key => !knownBefore.has(key)));
          const oldReveals = new Set(plan.reveals.map(point => `${point.x}:${point.y}`).filter(key => !knownBefore.has(key)));
          assert.ok([...oldReveals].some(key => newerReveals.has(key)), 'Distinct legal survey anchors must have genuinely overlapping frozen forecasts');
          // The newer rules ticket is deliberately due FIRST. A version-first
          // executor would incorrectly let the old survey consume its reveals.
          await old.advanceJob(A, current.id, current.duration_seconds * 2 + 600);
          await old.advanceJob(A, job.id, job.duration_seconds + 1);
          snapshot = await call('dc_get');
          const currentReport = snapshot.field_reports.find(report => report.job_id === current.id && report.kind === 'survey');
          const oldReport = snapshot.field_reports.find(report => report.job_id === job.id && report.kind === 'survey');
          assert.ok(currentReport && oldReport); assert.equal(currentReport.tiles_revealed, newerReveals.size);
          assert.equal(oldReport.tiles_revealed, [...oldReveals].filter(key => !newerReveals.has(key)).length);
          assert.equal(snapshot.world.tiles.length - knownBefore.size, currentReport.tiles_revealed + oldReport.tiles_revealed);
          assert.equal(snapshot.expeditions.find(operation => operation.id === current.id).status, 'collected', 'A zero-cargo field survey settles without a haul collection');
        } else { await old.advanceJob(A, job.id, job.duration_seconds + 1); snapshot = await call('dc_get'); }
        engine.validateDeepClaimSnapshot(snapshot);
        const returned = snapshot.expeditions.find(operation => operation.id === job.id);
        assert.equal(returned.status, mode === 'explore' ? 'ready' : 'collected'); assert.equal(returned.config_version, 3); assert.deepEqual(returned.cargo, plan.cargo);
        assert.deepEqual((await one('select content from public.dc_plans where job_id=$1', [job.id])).content, plan);
        const wear = (await old.db.query('select item_id,wear_amount,applied_at from public.dc_job_equipment where job_id=$1 order by item_id', [job.id])).rows;
        await call('dc_get'); assert.deepEqual((await old.db.query('select item_id,wear_amount,applied_at from public.dc_job_equipment where job_id=$1 order by item_id', [job.id])).rows, wear);
        if (returned.status === 'ready') await call('dc_collect', { p_job_id: job.id, p_request_id: request() });
        await assert.rejects(old.actorQuery(A, 'select public.qa_phase7_paused_dispatch($1::uuid[],$2::text,$3::integer,$4::integer,$5::integer,$6::boolean,$7::text,$8::integer,$9::uuid)', [[worker.id],'survey',48,4,20,false,null,(await call('dc_get')).revision,request()]), error => error.code === '40001');
      } finally { await old.close(); }
    });
  }
  await check('Phase7 preservation: real paid research, cfg4 partial production, owned gear, kept finds and acknowledged receipts survive cutover', async () => {
    const old = await createDeepClaimDatabase({ phase: 5 }), call = (name, args = {}) => old.rpc(A, name, args);
    const one = async (sql, args = []) => (await old.db.query(sql, args)).rows[0];
    try {
      let snapshot = await call('dc_bootstrap', { p_name: 'Working Before Expansion', p_request_id: request() }); const company = snapshot.company.id;
      await old.db.query('update public.dc_companies set cash=100000,warehouse_level=3 where id=$1', [company]);
      await old.db.query('update public.dc_workers set stats=$2::jsonb where company_id=$1', [company, JSON.stringify({ mining: 100, geology: 100, engineering: 100, logistics: 100, safety: 100, endurance: 100, leadership: 100 })]);
      await old.db.query("update public.dc_inventory set quantity=case resource_key when 'stone' then 80 when 'clay' then 20 when 'copper_bar' then 5 when 'copper_ore' then 30 when 'coal' then 20 when 'quartz' then 20 else 0 end where company_id=$1", [company]); snapshot = await call('dc_get');
      for (const key of ['research_office','smeltery','gem_workshop']) snapshot = await call('dc_upgrade', { p_building_key: key, p_expected_revision: snapshot.revision, p_request_id: request() });
      snapshot = await call('dc_start_production', { p_recipe_key: 'craft_copper_pickaxe', p_batches: 1, p_expected_revision: snapshot.revision, p_request_id: request() });
      let production = snapshot.production_jobs.find(job => job.status === 'active'); await old.advanceProduction(A, production.id, production.duration_seconds + 1);
      snapshot = await call('dc_collect_production', { p_job_id: production.id, p_request_id: request() });
      const item = snapshot.equipment[0], worker = snapshot.workers.find(worker => worker.name === 'Mara Flint'); assert.ok(item);
      snapshot = await call('dc_assign_equipment', { p_item_id: item.id, p_worker_id: worker.id, p_expected_revision: snapshot.revision, p_request_id: request() });
      const work = async (x, y) => {
        const args = { p_worker_ids: [worker.id], p_mode: 'extract', p_target_x: x, p_target_y: y, p_duration_minutes: 20, p_tutorial: false, p_expected_revision: snapshot.revision, p_request_id: request() };
        snapshot = await call('dc_dispatch', args); return { args, job: snapshot.expeditions.find(job => job.status === 'active') };
      };
      const quartz = await work(47, 3); await old.advanceJob(A, quartz.job.id, quartz.job.duration_seconds + 1); snapshot = await call('dc_collect', { p_job_id: quartz.job.id, p_request_id: request() });
      const find = snapshot.discoveries.find(find => find.x === 47 && find.y === 3); assert.ok(find);
      const keepArgs = { p_discovery_id: find.id, p_choice: 'keep', p_expected_revision: snapshot.revision, p_request_id: request() };
      snapshot = await call('dc_resolve_discovery', keepArgs);
      const active = await work(47, 2), oldWear = snapshot.equipment.find(gear => gear.id === item.id).durability;
      const researchArgs = { p_research_key: 'geology_1', p_expected_revision: snapshot.revision, p_request_id: request() }; snapshot = await call('dc_start_research', researchArgs);
      const firstArgs = { p_recipe_key: 'smelt_copper', p_batches: 1, p_expected_revision: snapshot.revision, p_request_id: request() }; snapshot = await call('dc_start_production', firstArgs);
      const staged = snapshot.production_jobs.find(job => job.status === 'active'); await old.advanceProduction(A, staged.id, staged.duration_seconds + 1); snapshot = await call('dc_get');
      await old.db.query("update public.dc_inventory set quantity=case resource_key when 'stone' then 479 else 0 end where company_id=$1", [company]);
      const collectArgs = { p_job_id: staged.id, p_request_id: request() }; snapshot = await call('dc_collect_production', collectArgs);
      assert.equal(snapshot.resources.copper_bar, 1); assert.equal(snapshot.production_jobs.find(job => job.id === staged.id).outputs.copper_bar, 1);
      snapshot = await call('dc_sell', { p_resource_key: 'stone', p_quantity: 100, p_expected_revision: snapshot.revision, p_request_id: request() });
      await old.db.query("update public.dc_inventory set quantity=10 where company_id=$1 and resource_key='quartz'", [company]); snapshot = await call('dc_get');
      const productionArgs = { p_recipe_key: 'polish_quartz', p_batches: 1, p_expected_revision: snapshot.revision, p_request_id: request() }; snapshot = await call('dc_start_production', productionArgs);
      production = snapshot.production_jobs.find(job => job.status === 'active');
      const tables = (await old.db.query("select tablename from pg_tables where schemaname='public' and tablename like 'dc_%' order by tablename")).rows.map(row => row.tablename), saved = {};
      for (const table of tables) saved[table] = (await old.db.query(`select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`)).rows.map(row => row.row);
      const revision = (await one('select revision from public.dc_companies where id=$1', [company])).revision, cash = snapshot.company.cash;
      await old.applyPendingMigrations({ phase: 7 });
      assert.equal((await one('select revision from public.dc_companies where id=$1', [company])).revision, revision + 1, 'Migration revision is measured directly before any lazy read');
      for (const table of tables) {
        const current = (await old.db.query(`select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`)).rows.map(row => row.row);
        for (const before of saved[table]) assert.ok(current.some(after => Object.entries(before).every(([key, value]) => table === 'dc_companies' && ['revision','updated_at'].includes(key) || JSON.stringify(after[key]) === JSON.stringify(value))), `${table} old business/stock/history changed`);
      }
      snapshot = await call('dc_get'); engine.validateDeepClaimSnapshot(snapshot); assert.ok(snapshot.revision >= revision + 1); assert.equal(snapshot.company.cash, cash);
      assert.equal(snapshot.resources.nickel_ore, 0); assert.equal(snapshot.resources.sulfur, 0); assert.equal(snapshot.resources.nickel_alloy, 0);
      for (const [name, args] of [['dc_dispatch',active.args],['dc_start_research',researchArgs],['dc_start_production',productionArgs],['dc_collect_production',collectArgs],['dc_resolve_discovery',keepArgs]]) await call(name, args);
      snapshot = await call('dc_get'); assert.equal(snapshot.company.cash, cash); assert.equal(snapshot.resources.copper_bar, 1); assert.equal(snapshot.production_jobs.find(job => job.id === staged.id).outputs.copper_bar, 1);
      await old.advanceJob(A, active.job.id, active.job.duration_seconds + 1); await old.advanceResearch(A, 'geology_1', 301); await old.advanceProduction(A, production.id, production.duration_seconds + 1);
      snapshot = await call('dc_get'); engine.validateDeepClaimSnapshot(snapshot);
      assert.equal(snapshot.expeditions.find(job => job.id === active.job.id).config_version, 3);
      assert.equal(snapshot.equipment.find(gear => gear.id === item.id).durability, oldWear - 2);
      assert.equal(snapshot.discoveries.find(record => record.id === find.id).status, 'kept');
      assert.equal(snapshot.business.research.find(order => order.key === 'geology_1').status, 'completed');
      assert.equal((await one('select config_version from public.dc_production_jobs where id=$1', [production.id])).config_version, 4);
      assert.deepEqual(snapshot.production_jobs.find(job => job.id === production.id).recipe_snapshot, saved.dc_production_jobs.find(job => job.id === production.id).recipe_snapshot);
      await call('dc_get'); assert.equal((await call('dc_get')).equipment.find(gear => gear.id === item.id).durability, oldWear - 2);
    } finally { await old.close(); }
  });
}
