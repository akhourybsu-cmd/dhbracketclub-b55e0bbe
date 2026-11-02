// Paid, timed research and new production through the actual secured SQL.
import assert from 'node:assert/strict';

export async function runPhase4ResearchTests(h) {
  const { check, db, one, A, B, request, bootstrap, get, upgrade, fixture, rpc, startResearch, fulfillContract, claimMilestone, dispatchOperation, engine } = h;
  const state = snapshot => ({ revision: snapshot.revision, company: snapshot.company, workers: snapshot.workers, resources: snapshot.resources, research: snapshot.business.research });
  async function funded({ office = 1 } = {}) {
    let snapshot = await bootstrap();
    await db.query('update public.dc_companies set cash=100000,warehouse_level=3 where id=$1', [snapshot.company.id]);
    await db.query('update public.dc_inventory set quantity=20 where company_id=$1', [snapshot.company.id]); snapshot = await get();
    for (let level = 0; level < office; level++) snapshot = await upgrade(A, snapshot, 'research_office');
    return snapshot;
  }
  async function complete(snapshot, key) {
    const node = snapshot.business_catalog.research.find(node => node.key === key); assert.ok(node);
    snapshot = await startResearch(A, snapshot, key); await fixture.advanceResearch(A, key, node.duration_seconds + 1); return get();
  }
  async function allResearch(snapshot) {
    const pending = new Set(snapshot.business_catalog.research.map(node => node.key));
    while (pending.size) {
      const completed = snapshot.business.research.filter(order => order.status === 'completed').map(order => order.key);
      const next = snapshot.business_catalog.research.find(node => pending.has(node.key) && node.requires.every(key => completed.includes(key))); assert.ok(next, 'Research dependency tree must be reachable');
      await db.query('update public.dc_inventory set quantity=20 where company_id=$1', [snapshot.company.id]); snapshot = await get();
      snapshot = await complete(snapshot, next.key); pending.delete(next.key);
    }
    return snapshot;
  }

  await check('Phase4 research: fresh snapshots publish canonical business definitions without free unlocks, goods or credits', async () => {
    const empty = await get(); assert.equal(empty.schema_version, h.currentSchema); assert.equal(empty.company, null);
    assert.equal(empty.business_catalog.research.length, 14); assert.equal(empty.business_catalog.contracts.length, 12); assert.equal(empty.business_catalog.milestones.length, 8);
    assert.deepEqual(empty.business.research, []); assert.equal(empty.business.processing_speed_percent, 0); assert.deepEqual(empty.business.research_bonuses, {});
    const snapshot = await bootstrap(); assert.equal(snapshot.company.cash, 180); assert.equal(snapshot.recipes.length, 23); assert.equal(snapshot.equipment_catalog.length, 13); assert.equal(snapshot.buildings.length, 9);
    assert.equal(snapshot.recipes.filter(recipe => !['smelt_nickel_alloy','craft_nickel_heatshield'].includes(recipe.key)).length, 21);
    assert.equal(snapshot.equipment_catalog.filter(item => item.key !== 'nickel_heatshield').length, 12);
    for (const key of ['bronze_bar','steel_bar','gold_bar']) assert.equal(snapshot.resources[key], 0);
    for (const key of ['research_office','trading_post']) assert.equal(snapshot.buildings.find(building => building.key === key).level, 0);
    assert.ok(snapshot.business.milestones.every(milestone => milestone.progress === 0 && milestone.claimed_at === null));
    assert.ok(snapshot.business.contracts.every(contract => contract.status === 'offered' && contract.completed_at === null));
    engine.validateBusinessCatalog();
  });

  await check('Phase4 research: building, dependency, cash reserve, complete inputs and one-active gates reject atomically', async () => {
    let snapshot = await funded({ office: 0 }); const first = snapshot.business_catalog.research.find(node => node.key === 'excavation_1');
    const beforeBuilding = state(snapshot); await assert.rejects(startResearch(A, snapshot, first.key), /office|building/i); assert.deepEqual(state(await get()), beforeBuilding);
    snapshot = await upgrade(A, snapshot, 'research_office');
    for (const key of ['excavation_2','processing_2','unknown_node','']) await assert.rejects(startResearch(A, snapshot, key));
    await db.query('update public.dc_companies set cash=$2 where id=$1', [snapshot.company.id, first.cash_cost + 1]); snapshot = await get();
    const insufficient = state(snapshot); await assert.rejects(startResearch(A, snapshot, first.key), /cash|reserve/i); assert.deepEqual(state(await get()), insufficient);
    await db.query('update public.dc_companies set cash=100000 where id=$1', [snapshot.company.id]);
    await db.query("update public.dc_inventory set quantity=0 where company_id=$1 and resource_key='clay'", [snapshot.company.id]); snapshot = await get();
    const missing = state(snapshot); await assert.rejects(startResearch(A, snapshot, first.key), /material|stock|collect/i); assert.deepEqual(state(await get()), missing);
    await db.query("update public.dc_inventory set quantity=20 where company_id=$1 and resource_key='clay'", [snapshot.company.id]); snapshot = await get();
    snapshot = await startResearch(A, snapshot, first.key); const active = state(snapshot);
    await assert.rejects(startResearch(A, snapshot, 'geology_1'), /active|complete|progress/i); assert.deepEqual(state(await get()), active);
  });

  await check('Phase4 research: server clocks, frozen paid inputs and exact UUID retries unlock once without a collect click', async () => {
    let snapshot = await funded(); const first = snapshot.business_catalog.research.find(node => node.key === 'excavation_1'), before = snapshot, receipt = request();
    snapshot = await startResearch(A, snapshot, first.key, receipt); const order = snapshot.business.research.find(order => order.key === first.key);
    assert.equal(order.status, 'active'); assert.equal(order.completed_at, null); assert.equal(Date.parse(order.completes_at) - Date.parse(order.started_at), 300000);
    assert.equal(snapshot.company.cash, before.company.cash - first.cash_cost);
    for (const [key, units] of Object.entries(first.inputs)) assert.equal(snapshot.resources[key], before.resources[key] - units);
    assert.deepEqual(snapshot.business.research_bonuses, {}); assert.deepEqual(snapshot.workers.map(worker => worker.stats), before.workers.map(worker => worker.stats));
    const frozen = await one('select * from public.dc_research_orders where company_id=$1 and research_key=$2', [snapshot.company.id, first.key]);
    assert.deepEqual(frozen.definition_snapshot, first);
    const retry = await startResearch(A, before, first.key, receipt); assert.deepEqual(state(retry), state(snapshot));
    await assert.rejects(startResearch(A, snapshot, first.key));
    await assert.rejects(db.query("update public.dc_research_orders set completes_at=completes_at-interval '1 minute' where company_id=$1", [snapshot.company.id]), /immutable|frozen/i);
    await fixture.advanceResearch(A, first.key, 299); snapshot = await get(); assert.equal(snapshot.business.research[0].status, 'active');
    await fixture.advanceResearch(A, first.key, 2); snapshot = await get();
    assert.equal(snapshot.business.research[0].status, 'completed'); assert.ok(snapshot.business.research[0].completed_at);
    assert.deepEqual(snapshot.business.research_bonuses, { mining: 4 }); assert.equal(snapshot.business.stats.completed_research, 1);
    for (const worker of snapshot.workers) assert.equal(worker.stats.mining, Math.min(100, before.workers.find(old => old.id === worker.id).stats.mining + 4));
    const completed = state(snapshot); assert.deepEqual(state(await get()), completed); assert.deepEqual(state(await startResearch(A, before, first.key, receipt)), completed);
    await assert.rejects(startResearch(A, snapshot, first.key));
  });

  await check('Phase4 research: failed receipt rolls back the order, credits, materials and revision', async () => {
    let snapshot = await funded(); const receipt = request(), before = state(snapshot);
    await db.exec("create function public.dc_test_research_receipt_failure() returns trigger language plpgsql as $$begin raise exception 'Injected research receipt failure';end$$;create trigger dc_test_research_receipt_failure after insert on public.dc_requests for each row execute function public.dc_test_research_receipt_failure()");
    try { await assert.rejects(startResearch(A, snapshot, 'excavation_1', receipt), /Injected research receipt failure/); }
    finally { await db.exec('drop trigger dc_test_research_receipt_failure on public.dc_requests;drop function public.dc_test_research_receipt_failure()'); }
    assert.deepEqual(state(await get()), before); assert.equal((await one('select count(*)::int n from public.dc_requests where request_id=$1', [receipt])).n, 0);
    snapshot = await startResearch(A, snapshot, 'excavation_1', receipt); assert.equal(snapshot.business.research.length, 1);
  });

  await check('Phase4 research: permanent stats improve only future work while active private mining plans stay frozen', async () => {
    let snapshot = await funded(); snapshot = await upgrade(A, snapshot, 'mine_office');
    const mara = snapshot.workers.find(worker => worker.name === 'Mara Flint'), tessa = snapshot.workers.find(worker => worker.name === 'Tessa Pike');
    snapshot = await dispatchOperation(A, snapshot, { workers: [mara.id], mode: 'extract', x: 49, y: 3 });
    const job = snapshot.expeditions.find(job => job.status === 'active'), frozen = await one('select to_jsonb(e) ticket,p.content from public.dc_expeditions e join public.dc_plans p on p.job_id=e.id where e.id=$1', [job.id]);
    const oldStats = snapshot.workers.find(worker => worker.id === tessa.id).stats;
    snapshot = await complete(snapshot, 'excavation_1');
    assert.deepEqual(await one('select to_jsonb(e) ticket,p.content from public.dc_expeditions e join public.dc_plans p on p.job_id=e.id where e.id=$1', [job.id]), frozen);
    assert.equal(snapshot.workers.find(worker => worker.id === tessa.id).stats.mining, oldStats.mining + 4);
    const begun = await dispatchOperation(A, snapshot, { workers: [tessa.id], mode: 'extract', x: 47, y: 2 });
    const later = begun.expeditions.find(operation => operation.id !== job.id && operation.status === 'active'); assert.ok(later); assert.equal(later.config_version, h.currentFieldRules);
    assert.deepEqual((await one('select content from public.dc_plans where job_id=$1', [job.id])).content, frozen.content);
  });

  await check('Phase4 research: all fourteen dependency nodes are reachable and effective bonuses apply once with a cap of one hundred', async () => {
    let snapshot = await funded({ office: 2 }); const before = snapshot.workers.map(worker => ({ id: worker.id, stats: worker.stats, base: worker.base_stats }));
    snapshot = await allResearch(snapshot); const completed = snapshot.business.research.filter(order => order.status === 'completed').map(order => order.key), expected = engine.researchEffects(completed);
    assert.equal(completed.length, 14); assert.deepEqual(snapshot.business.research_bonuses, expected.stat_bonuses); assert.equal(snapshot.business.processing_speed_percent, 15);
    for (const worker of snapshot.workers) {
      const old = before.find(old => old.id === worker.id); assert.deepEqual(worker.base_stats, old.base);
      assert.deepEqual(worker.stats, engine.applyResearchBonuses(old.stats, expected.stat_bonuses));
    }
    assert.equal(snapshot.business.stats.completed_research, 14); assert.deepEqual(state(await get()), state(snapshot));
  });

  await check('Phase4 research: completed processing speeds only new production and locked new recipes require real research', async () => {
    let snapshot = await funded(); snapshot = await upgrade(A, snapshot, 'smeltery');
    const bronze = snapshot.business_catalog.recipes.find(recipe => recipe.key === 'smelt_bronze'); assert.ok(bronze);
    await assert.rejects(rpc(A, 'dc_start_production', { p_recipe_key: bronze.key, p_batches: 1, p_expected_revision: snapshot.revision, p_request_id: request() }), /research|unlock/i);
    const start = async key => rpc(A, 'dc_start_production', { p_recipe_key: key, p_batches: 1, p_expected_revision: snapshot.revision, p_request_id: request() });
    snapshot = await start('smelt_copper'); const first = snapshot.production_jobs[0], frozen = await one('select * from public.dc_production_jobs where id=$1', [first.id]);
    snapshot = await complete(snapshot, 'processing_1'); assert.equal(snapshot.business.processing_speed_percent, 5); assert.deepEqual(await one('select * from public.dc_production_jobs where id=$1', [first.id]), frozen);
    snapshot = await start('smelt_copper'); const second = snapshot.production_jobs.find(job => job.id !== first.id); assert.equal((await one('select config_version from public.dc_production_jobs where id=$1', [second.id])).config_version, 4); assert.equal(second.research_speed_percent, 5);
    assert.equal(second.duration_seconds, Math.max(20, Math.ceil(first.duration_seconds * 95 / 100)));
    snapshot = await start(bronze.key); const advanced = snapshot.production_jobs.find(job => job.recipe_key === bronze.key); assert.ok(advanced); assert.equal((await one('select config_version from public.dc_production_jobs where id=$1', [advanced.id])).config_version, 4);
    await fixture.advanceProduction(A, advanced.id, 86400); snapshot = await get();
    snapshot = await rpc(A, 'dc_collect_production', { p_job_id: advanced.id, p_request_id: request() }); assert.equal(snapshot.resources.bronze_bar, 20 + bronze.outputs.bronze_bar);
  });

  await check('Phase4 industry: every new alloy and tier-three item has paid timed output, real ownership and working equipment bonuses', async () => {
    let snapshot = await funded({ office: 2 }); snapshot = await allResearch(snapshot);
    for (const key of ['smeltery','smeltery','gem_workshop','gem_workshop','tool_station','tool_station']) snapshot = await upgrade(A, snapshot, key);
    for (const recipe of snapshot.business_catalog.recipes) {
      await db.query('update public.dc_inventory set quantity=20 where company_id=$1', [snapshot.company.id]); snapshot = await get();
      const before = snapshot;
      snapshot = await rpc(A, 'dc_start_production', { p_recipe_key: recipe.key, p_batches: 1, p_expected_revision: snapshot.revision, p_request_id: request() });
      const job = snapshot.production_jobs.find(job => job.recipe_key === recipe.key); assert.ok(job); assert.equal((await one('select config_version from public.dc_production_jobs where id=$1', [job.id])).config_version, 4); assert.equal(job.research_speed_percent, 15); assert.deepEqual(job.recipe_snapshot, recipe);
      for (const [key, units] of Object.entries(recipe.inputs)) assert.equal(snapshot.resources[key], before.resources[key] - units);
      assert.equal(snapshot.company.cash, before.company.cash - recipe.cash_cost);
      await assert.rejects(rpc(A, 'dc_collect_production', { p_job_id: job.id, p_request_id: request() }), /finish|complete|ready/i);
      await fixture.advanceProduction(A, job.id, job.duration_seconds + 1); snapshot = await get(); snapshot = await rpc(A, 'dc_collect_production', { p_job_id: job.id, p_request_id: request() });
      if (recipe.equipment_output) {
        const item = snapshot.equipment.find(item => item.production_job_id === job.id || item.definition_key === recipe.equipment_output); assert.ok(item); assert.equal(item.definition_key, recipe.equipment_output);
        const worker = snapshot.workers[0], beforeStats = worker.stats;
        snapshot = await rpc(A, 'dc_assign_equipment', { p_item_id: item.id, p_worker_id: worker.id, p_expected_revision: snapshot.revision, p_request_id: request() });
        const definition = snapshot.equipment_catalog.find(definition => definition.key === recipe.equipment_output); assert.equal(definition.tier, 3);
        for (const [stat, bonus] of Object.entries(definition.bonuses)) assert.equal(snapshot.workers.find(person => person.id === worker.id).stats[stat], Math.min(100, beforeStats[stat] + bonus));
      } else for (const [key, units] of Object.entries(recipe.outputs)) assert.equal(snapshot.resources[key], before.resources[key] - (recipe.inputs[key] || 0) + units);
    }
  });

  await check('Phase4 business: disabled assets, removed membership, other clubs and reused operation identities never authorize a mutation', async () => {
    let snapshot = await funded(); const receipt = request(); snapshot = await startResearch(A, snapshot, 'excavation_1', receipt);
    await assert.rejects(fulfillContract(A, snapshot, 'yard_foundations', receipt), error => /22023|P0001/.test(error.code));
    await bootstrap(B); const before = state(snapshot);
    await db.exec("update public.club_installed_assets set enabled=false where asset_id=(select id from public.platform_assets where slug='deep-claim')");
    for (const action of [() => startResearch(A, snapshot, 'excavation_1', receipt), () => fulfillContract(A, snapshot, 'yard_foundations'), () => claimMilestone(A, snapshot, 'first_research')]) await assert.rejects(action(), error => error.code === '42501');
    await db.exec("update public.club_installed_assets set enabled=true where asset_id=(select id from public.platform_assets where slug='deep-claim')");
    await db.query('delete from public.club_members where user_id=$1', [A]);
    for (const action of [() => startResearch(A, snapshot, 'excavation_1', receipt), () => fulfillContract(A, snapshot, 'yard_foundations'), () => claimMilestone(A, snapshot, 'first_research')]) await assert.rejects(action(), error => error.code === '42501');
    assert.equal((await one('select cash from public.dc_companies where id=$1', [snapshot.company.id])).cash, before.company.cash);
  });
}
