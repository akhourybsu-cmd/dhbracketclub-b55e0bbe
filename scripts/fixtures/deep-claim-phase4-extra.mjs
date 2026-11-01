// Independent business-economy invariants against the actual local PostgreSQL
// migrations. Owner writes below create bounded starting-stock/history fixtures;
// clocks advance existing paid orders only. No remote services or live writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function runPhase4ExtraTests(h) {
  const { check, db, rpc, one, A, B, request, bootstrap, get, upgrade, dispatch, finish, collect, sell, fixture,
    startResearch, fulfillContract, claimMilestone, dispatchOperation, resolveDiscovery } = h;
  const canonical = JSON.parse(await readFile('supabase/seed/deep-claim-phase4-catalog.json', 'utf8'));
  const original = JSON.parse(await readFile('supabase/seed/deep-claim-phase2-catalog.json', 'utf8'));
  const prices = { stone: 1, clay: 2, coal: 4, copper_ore: 8, tin_ore: 10, iron_ore: 14, quartz: 12, silver_ore: 30,
    ...Object.fromEntries([...original.resources, ...canonical.resources].map(item => [item.id, item.sell_price])) };
  const worth = inputs => Object.entries(inputs).reduce((sum, [key, amount]) => sum + prices[key] * amount, 0);
  const economic = snapshot => ({ revision: snapshot.revision, cash: snapshot.company.cash, resources: snapshot.resources,
    business: snapshot.business, workers: snapshot.workers, production: snapshot.production_jobs });
  const contract = (snapshot, key) => snapshot.business.contracts.find(item => item.key === key);
  const milestone = (snapshot, key) => snapshot.business.milestones.find(item => item.key === key);
  const domainFailure = pattern => error => { assert.match(error.code ?? '', /^(P0001|40001|23505)$/); assert.match(error.message, pattern); return true; };
  const startProduction = (snapshot, recipe, batches = 1) => rpc(A, 'dc_start_production', {
    p_recipe_key: recipe, p_batches: batches, p_expected_revision: snapshot.revision, p_request_id: request(),
  });
  async function stock(snapshot, amounts) {
    await db.query('update public.dc_inventory set quantity=0 where company_id=$1', [snapshot.company.id]);
    for (const [key, amount] of Object.entries(amounts)) await db.query('insert into public.dc_inventory(company_id,resource_key,quantity) values($1,$2,$3) on conflict(company_id,resource_key) do update set quantity=excluded.quantity', [snapshot.company.id, key, amount]);
    const result = await get();
    assert.ok(Object.values(result.resources).reduce((sum, amount) => sum + amount, 0) <= result.company.warehouse_capacity);
    return result;
  }
  async function funded(user = A) {
    const snapshot = await bootstrap(user);
    await db.query('update public.dc_companies set cash=100000,warehouse_level=3 where id=$1', [snapshot.company.id]);
    return get(user);
  }
  async function level(snapshot, key, target) {
    while (snapshot.buildings.find(item => item.key === key).level < target) snapshot = await upgrade(A, snapshot, key);
    return snapshot;
  }
  async function research(snapshot, key) {
    if (snapshot.business.research.some(item => item.key === key && item.status === 'completed')) return snapshot;
    const definition = canonical.research.find(item => item.key === key); assert.ok(definition);
    for (const prerequisite of definition.requires) snapshot = await research(snapshot, prerequisite);
    snapshot = await level(snapshot, 'research_office', definition.required_building_level);
    snapshot = await stock(snapshot, definition.inputs);
    snapshot = await startResearch(A, snapshot, key);
    await fixture.advanceResearch(A, key, definition.duration_seconds + 1);
    snapshot = await get(); assert.equal(snapshot.business.research.find(item => item.key === key).status, 'completed');
    return snapshot;
  }
  async function deliver(snapshot, key) {
    const definition = canonical.contracts.find(item => item.key === key); assert.ok(definition);
    if (contract(snapshot, key).status === 'completed') return snapshot;
    for (const prerequisite of definition.requires_contracts) snapshot = await deliver(snapshot, prerequisite);
    snapshot = await level(snapshot, 'trading_post', definition.tier);
    snapshot = await stock(snapshot, definition.inputs);
    return fulfillContract(A, snapshot, key);
  }
  async function production(snapshot, recipe, batches = 1, collectNow = true) {
    const definition = snapshot.recipes.find(item => item.key === recipe); assert.ok(definition);
    snapshot = await level(snapshot, definition.station, definition.required_station_level);
    snapshot = await stock(snapshot, Object.fromEntries(Object.entries(definition.inputs).map(([key, amount]) => [key, amount * batches])));
    const known = new Set(snapshot.production_jobs.map(item => item.id));
    snapshot = await startProduction(snapshot, recipe, batches);
    const job = snapshot.production_jobs.find(item => !known.has(item.id)); assert.ok(job);
    await fixture.advanceProduction(A, job.id, job.duration_seconds + 1);
    snapshot = await get();
    if (collectNow) snapshot = await rpc(A, 'dc_collect_production', { p_job_id: job.id, p_request_id: request() });
    return { snapshot, job };
  }
  async function injectReceiptFailure(action) {
    await db.exec("create function public.dc_test_business_receipt_failure() returns trigger language plpgsql as $$begin raise exception 'Injected business receipt failure';end$$;create trigger dc_test_business_receipt_failure after insert on public.dc_requests for each row execute function public.dc_test_business_receipt_failure()");
    try { await assert.rejects(action(), /Injected business receipt failure/); }
    finally { await db.exec('drop trigger dc_test_business_receipt_failure on public.dc_requests;drop function public.dc_test_business_receipt_failure()'); }
  }

  await check('Phase4 business: canonical catalog, finite reward budget and material dependency graph agree with real SQL', async () => {
    const snapshot = await bootstrap();
    assert.deepEqual(snapshot.business_catalog, canonical);
    assert.deepEqual((await one('select config from public.dc_rules where version=4')).config, canonical);
    assert.equal(canonical.research.length, 14); assert.equal(canonical.contracts.length, 12); assert.equal(canonical.milestones.length, 8);
    assert.equal(canonical.research.reduce((sum, item) => sum + item.cash_cost, 0), 2700);
    assert.equal(canonical.research.reduce((sum, item) => sum + worth(item.inputs), 0), 2673);
    const complete = new Set();
    while (complete.size < canonical.research.length) {
      const next = canonical.research.find(item => !complete.has(item.key) && item.requires.every(key => complete.has(key)));
      assert.ok(next, 'Research must have an acyclic dependency order'); complete.add(next.key);
    }
    const available = new Set(['stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore','amethyst','gold_ore']);
    const earned = new Set(), recipes = [...original.recipes, ...canonical.recipes];
    for (let pass = 0; pass < 30; pass++) {
      for (const item of recipes) if ((item.required_research ?? []).every(key => earned.has(key)) && Object.keys(item.inputs).every(key => available.has(key))) {
        for (const key of Object.keys(item.outputs)) available.add(key);
      }
      for (const item of canonical.research) if (item.requires.every(key => earned.has(key)) && Object.keys(item.inputs).every(key => available.has(key))) earned.add(item.key);
    }
    assert.equal(earned.size, 14, 'No research material may require its own locked recipe');
    for (const item of canonical.recipes) assert.ok(item.required_research.every(key => earned.has(key)) && Object.keys(item.inputs).every(key => available.has(key)));
    const deliveries = new Set();
    while (deliveries.size < canonical.contracts.length) {
      const next = canonical.contracts.find(item => !deliveries.has(item.key) && item.requires_contracts.every(key => deliveries.has(key)) && item.required_research.every(key => earned.has(key)) && Object.keys(item.inputs).every(key => available.has(key)));
      assert.ok(next, 'Every finite delivery must have a reachable prerequisite chain'); deliveries.add(next.key);
    }
    let premium = 0, payout = 0;
    for (const item of canonical.contracts) {
      const value = worth(item.inputs); assert.ok(item.reward > value && item.reward * 100 <= value * 120);
      premium += item.reward - value; payout += item.reward;
    }
    assert.equal(premium, 593); assert.equal(payout, 4569);
    assert.equal(canonical.milestones.reduce((sum, item) => sum + item.reward, 0), 400);
    for (const item of canonical.milestones) assert.ok(item.reward >= 10 && item.reward <= 120);
    for (const item of original.recipes) assert.deepEqual((await one('select definition from public.dc_recipes where recipe_key=$1 and version=$2', [item.key, item.version])).definition, item);
    for (const item of original.equipment) assert.deepEqual((await one('select definition from public.dc_equipment_catalog where definition_key=$1 and version=1', [item.key])).definition, item);
  });

  await check('Phase4 contracts: all permanent frozen orders survive reload and reject definition rewriting', async () => {
    let snapshot = await funded(); const company = snapshot.company.id;
    assert.equal(snapshot.business.contracts.length, 12);
    const rows = (await db.query('select contract_key,definition_snapshot,completed_at from public.dc_company_contracts where company_id=$1 order by contract_key', [company])).rows;
    assert.deepEqual(rows.map(item => item.definition_snapshot), [...canonical.contracts].sort((a, b) => a.key.localeCompare(b.key)));
    for (let reload = 0; reload < 3; reload++) assert.deepEqual((await get()).business.contracts, snapshot.business.contracts);
    await assert.rejects(db.query("update public.dc_company_contracts set definition_snapshot=jsonb_set(definition_snapshot,'{reward}','999999') where company_id=$1 and contract_key='yard_foundations'", [company]), /immutable/i);
    await assert.rejects(db.query("delete from public.dc_company_contracts where company_id=$1 and contract_key='yard_foundations'", [company]), /immutable/i);
    snapshot = await level(snapshot, 'trading_post', 1); snapshot = await stock(snapshot, { stone: 20 });
    snapshot = await fulfillContract(A, snapshot, 'yard_foundations');
    assert.deepEqual((await one("select definition_snapshot from public.dc_company_contracts where company_id=$1 and contract_key='yard_foundations'", [company])).definition_snapshot, canonical.contracts[0]);
  });

  await check('Phase4 contracts: building, prior delivery and research gates cannot be bypassed with stocked goods', async () => {
    let snapshot = await stock(await funded(), { stone: 20, coal: 10, bronze_bar: 4, gold_bar: 2 });
    let before = economic(snapshot);
    await assert.rejects(fulfillContract(A, snapshot, 'yard_foundations'), domainFailure(/trading post/i));
    assert.deepEqual(economic(await get()), before);
    snapshot = await level(snapshot, 'trading_post', 3); before = economic(snapshot);
    await assert.rejects(fulfillContract(A, snapshot, 'boiler_fuel'), domainFailure(/prerequisite/i));
    await assert.rejects(fulfillContract(A, snapshot, 'frontier_industry'), domainFailure(/prerequisite/i));
    for (const key of ['unknown_order', '', null]) await assert.rejects(fulfillContract(A, snapshot, key), domainFailure(/unavailable/i));
    assert.deepEqual(economic(await get()), before);
    snapshot = await deliver(snapshot, 'copper_fittings'); snapshot = await stock(snapshot, { bronze_bar: 4 }); before = economic(snapshot);
    await assert.rejects(fulfillContract(A, snapshot, 'alloy_stock'), domainFailure(/research/i));
    assert.deepEqual(economic(await get()), before);
    snapshot = await research(snapshot, 'processing_1'); snapshot = await stock(snapshot, { bronze_bar: 4 });
    assert.equal(contract(await fulfillContract(A, snapshot, 'alloy_stock'), 'alloy_stock').status, 'completed');
  });

  await check('Phase4 contracts: the entire exact collected bundle is consumed atomically and cannot be partially delivered', async () => {
    let snapshot = await level(await funded(), 'trading_post', 1);
    snapshot = await stock(snapshot, { stone: 19, clay: 7 }); const before = economic(snapshot);
    await assert.rejects(fulfillContract(A, snapshot, 'yard_foundations'), domainFailure(/entire delivery/i));
    assert.deepEqual(economic(await get()), before);
    snapshot = await stock(snapshot, { stone: 20, clay: 7 }); const cash = snapshot.company.cash;
    snapshot = await fulfillContract(A, snapshot, 'yard_foundations');
    assert.equal(snapshot.resources.stone, 0); assert.equal(snapshot.resources.clay, 7); assert.equal(snapshot.company.cash, cash + 24);
    assert.equal(snapshot.business.stats.completed_contracts, 1); assert.equal(snapshot.business.stats.total_contract_credits, 24);
  });

  await check('Phase4 contracts: stale exact retries pay once and a fresh completion request cannot repeat an order', async () => {
    let snapshot = await level(await funded(), 'trading_post', 1); snapshot = await stock(snapshot, { stone: 40 });
    const previous = snapshot, receipt = request(); snapshot = await fulfillContract(A, previous, 'yard_foundations', receipt);
    assert.deepEqual(economic(await fulfillContract(A, previous, 'yard_foundations', receipt)), economic(snapshot));
    await assert.rejects(fulfillContract(A, snapshot, 'yard_foundations'), domainFailure(/already.*completed/i));
    assert.deepEqual(economic(await get()), economic(snapshot)); assert.equal(snapshot.resources.stone, 20);
    assert.equal((await one("select count(*)::integer count from public.dc_requests where company_id=$1 and operation='fulfill_contract'", [snapshot.company.id])).count, 1);
    await assert.rejects(db.query("update public.dc_company_contracts set completed_at=null where company_id=$1 and contract_key='yard_foundations'", [snapshot.company.id]), /immutable/i);
  });

  await check('Phase4 contracts: request UUIDs bind payload and owner while identical order keys remain company-local', async () => {
    let snapshot = await level(await funded(), 'trading_post', 1); snapshot = await stock(snapshot, { stone: 20, coal: 10 });
    const peer = await funded(B), receipt = request(), previous = snapshot;
    snapshot = await fulfillContract(A, snapshot, 'yard_foundations', receipt); const peerBefore = await get(B);
    await assert.rejects(fulfillContract(A, previous, 'boiler_fuel', receipt), domainFailure(/identity.*used/i));
    await assert.rejects(fulfillContract(B, peer, 'yard_foundations', receipt), domainFailure(/identity.*used/i));
    assert.deepEqual(economic(await get(B)), economic(peerBefore)); assert.equal(contract(peerBefore, 'yard_foundations').status, 'offered');
    assert.deepEqual(economic(await get()), economic(snapshot));
  });

  await check('Phase4 contracts: receipt insertion failure restores inputs, credits, status and revision before same-UUID recovery', async () => {
    let snapshot = await level(await funded(), 'trading_post', 1); snapshot = await stock(snapshot, { stone: 20 });
    const before = economic(snapshot), receipt = request();
    await injectReceiptFailure(() => fulfillContract(A, snapshot, 'yard_foundations', receipt));
    assert.deepEqual(economic(await get()), before);
    assert.equal((await one('select count(*)::integer count from public.dc_requests where request_id=$1', [receipt])).count, 0);
    snapshot = await fulfillContract(A, snapshot, 'yard_foundations', receipt);
    assert.equal(snapshot.resources.stone, 0); assert.equal(snapshot.company.cash, before.cash + 24);
  });

  await check('Phase4 contracts: ready production is not spendable delivery stock until actual collection', async () => {
    let snapshot = await deliver(await funded(), 'copper_assay'); snapshot = await level(snapshot, 'trading_post', 2);
    const produced = await production(snapshot, 'smelt_copper', 2, false); snapshot = produced.snapshot;
    assert.equal(snapshot.resources.copper_bar, 0); const before = economic(snapshot);
    await assert.rejects(fulfillContract(A, snapshot, 'copper_fittings'), domainFailure(/entire delivery/i));
    assert.deepEqual(economic(await get()), before);
    snapshot = await rpc(A, 'dc_collect_production', { p_job_id: produced.job.id, p_request_id: request() });
    const cash = snapshot.company.cash; snapshot = await fulfillContract(A, snapshot, 'copper_fittings');
    assert.equal(snapshot.resources.copper_bar, 0); assert.equal(snapshot.company.cash, cash + 250);
  });

  await check('Phase4 contracts: all twelve finite orders pay the frozen catalog total and cannot become repeat income', async () => {
    let snapshot = await funded();
    for (const definition of canonical.research) snapshot = await research(snapshot, definition.key);
    snapshot = await level(snapshot, 'trading_post', 3); const cash = snapshot.company.cash;
    // Owner-provided finite source stock isolates payout accounting; each real
    // delivery still consumes its whole paid bundle through the public RPC.
    for (const definition of canonical.contracts) snapshot = await deliver(snapshot, definition.key);
    assert.equal(snapshot.company.cash, cash + 4569); assert.equal(snapshot.business.stats.completed_contracts, 12);
    assert.equal(snapshot.business.stats.total_contract_credits, 4569);
    assert.equal(snapshot.business.contracts.filter(item => item.status === 'completed').length, 12);
    for (const definition of canonical.contracts) await assert.rejects(fulfillContract(A, snapshot, definition.key), domainFailure(/already.*completed/i));
    assert.equal((await get()).company.cash, snapshot.company.cash);
  });

  await check('Phase4 milestones: unearned claims and narrative-log spam cannot mint a source-backed award', async () => {
    const snapshot = await funded(), before = economic(snapshot);
    await db.query("insert into public.dc_logs(company_id,kind,title) select $1,'haul_ready','1000 units collected; depth 599; milestone completed' from generate_series(1,30)", [snapshot.company.id]);
    for (const definition of canonical.milestones) await assert.rejects(claimMilestone(A, snapshot, definition.key), domainFailure(/objective/i));
    for (const key of ['', null, 'not_a_milestone']) await assert.rejects(claimMilestone(A, snapshot, key), domainFailure(/unavailable/i));
    assert.deepEqual(economic(await get()), before);
    assert.equal((await one('select count(*)::integer count from public.dc_milestone_receipts where company_id=$1', [snapshot.company.id])).count, 0);
  });

  await check('Phase4 milestones: completion is eligible without automatic payment and explicit retries cannot duplicate the claim', async () => {
    let snapshot = await funded(); const initialCash = snapshot.company.cash;
    snapshot = await finish(A, await dispatch(A, snapshot, { tutorial: true }));
    assert.equal(milestone(snapshot, 'first_shift').progress, 1); assert.equal(milestone(snapshot, 'first_shift').claimed_at, null);
    assert.equal(snapshot.company.cash, initialCash - 7);
    const previous = snapshot, receipt = request(); snapshot = await claimMilestone(A, snapshot, 'first_shift', receipt);
    assert.equal(snapshot.company.cash, previous.company.cash + 10); assert.ok(milestone(snapshot, 'first_shift').claimed_at);
    assert.deepEqual(economic(await claimMilestone(A, previous, 'first_shift', receipt)), economic(snapshot));
    await assert.rejects(claimMilestone(A, snapshot, 'first_shift'), domainFailure(/already.*claimed/i));
    await assert.rejects(claimMilestone(A, previous, 'first_batch', receipt), domainFailure(/identity.*used/i));
    const peer = await funded(B); await assert.rejects(claimMilestone(B, peer, 'first_shift', receipt), domainFailure(/identity.*used/i));
    await assert.rejects(db.query("update public.dc_milestone_receipts set reward=120 where company_id=$1", [snapshot.company.id]), /immutable/i);
    await assert.rejects(db.query('delete from public.dc_milestone_receipts where company_id=$1', [snapshot.company.id]), /immutable/i);
  });

  await check('Phase4 milestones: failure after reward writes rolls back the receipt and permits exact-UUID recovery', async () => {
    let snapshot = await finish(A, await dispatch(A, await funded(), { tutorial: true }));
    const before = economic(snapshot), receipt = request();
    await injectReceiptFailure(() => claimMilestone(A, snapshot, 'first_shift', receipt));
    assert.deepEqual(economic(await get()), before);
    assert.equal((await one('select count(*)::integer count from public.dc_milestone_receipts where company_id=$1', [snapshot.company.id])).count, 0);
    snapshot = await claimMilestone(A, snapshot, 'first_shift', receipt);
    assert.equal(snapshot.company.cash, before.cash + 10); assert.equal(milestone(snapshot, 'first_shift').progress, 1);
  });

  await check('Phase4 records: fully collected frozen recipe quantities survive zero remainder and bounded public history', async () => {
    let snapshot = await funded(), expectedBatches = 0, expectedUnits = 0;
    for (let index = 0; index < 13; index++) {
      const batches = index < 2 ? 10 : 1, result = await production(snapshot, 'smelt_copper', batches); snapshot = result.snapshot;
      expectedBatches += batches; expectedUnits += batches * 2;
      assert.equal(snapshot.business.stats.collected_production_batches, expectedBatches);
      assert.equal(snapshot.business.stats.collected_processed_units, expectedUnits);
    }
    assert.equal(expectedUnits, 62); assert.equal(snapshot.production_jobs.length, 12);
    assert.equal((await one('select count(*)::integer count from public.dc_production_jobs where company_id=$1 and status=\'collected\'', [snapshot.company.id])).count, 13);
    const staged = await production(snapshot, 'smelt_copper', 1, false); snapshot = staged.snapshot;
    assert.equal(snapshot.business.stats.collected_processed_units, expectedUnits);
    assert.equal((await one('select config_version from public.dc_production_jobs where id=$1', [staged.job.id])).config_version, 4);
    snapshot = await stock(snapshot, { stone: 479 });
    snapshot = await rpc(A, 'dc_collect_production', { p_job_id: staged.job.id, p_request_id: request() });
    const partial = snapshot.production_jobs.find(item => item.id === staged.job.id);
    assert.equal(partial.status, 'ready'); assert.equal(partial.outputs.copper_bar, 1);
    assert.equal(partial.recipe_snapshot.outputs.copper_bar, 2);
    assert.equal(snapshot.business.stats.collected_processed_units, expectedUnits);
    assert.equal(snapshot.business.stats.collected_production_batches, expectedBatches);
    snapshot = await sell(A, snapshot, 'stone', 479);
    snapshot = await rpc(A, 'dc_collect_production', { p_job_id: staged.job.id, p_request_id: request() }); expectedUnits += 2; expectedBatches++;
    const gear = await production(snapshot, 'craft_copper_pickaxe', 1); snapshot = gear.snapshot; expectedBatches++;
    assert.equal(snapshot.business.stats.collected_processed_units, expectedUnits);
    assert.equal(snapshot.business.stats.collected_production_batches, expectedBatches);
    const cash = snapshot.company.cash; snapshot = await claimMilestone(A, snapshot, 'industrialist');
    assert.equal(snapshot.company.cash, cash + 100); assert.equal(milestone(snapshot, 'industrialist').progress, 40);
    assert.equal(snapshot.business.stats.collected_processed_units, 64);
  });

  await check('Phase4 milestones: all eight source objectives award exactly 400 credits with durable evidence', async () => {
    let snapshot = await funded();
    snapshot = await finish(A, await dispatch(A, snapshot, { tutorial: true }));
    snapshot = await collect(A, snapshot.expeditions.find(item => item.status === 'ready').id);
    snapshot = await stock(snapshot, { stone: 8, clay: 2 });
    snapshot = await dispatchOperation(A, snapshot, { workers: [snapshot.workers[1].id], mode: 'infrastructure', x: 48, y: 1, infrastructure: 'supports' });
    snapshot = await finish(A, snapshot);
    snapshot = await research(snapshot, 'safety_1');
    for (const key of ['yard_foundations', 'boiler_fuel', 'pottery_clay']) snapshot = await deliver(snapshot, key);
    snapshot = (await production(snapshot, 'smelt_copper', 10)).snapshot;
    snapshot = (await production(snapshot, 'smelt_copper', 10)).snapshot;
    snapshot = await level(snapshot, 'mine_shaft', 3);
    // A bounded known finite seam isolates the 100m source metric from random
    // geology. Dispatch/withdrawal/return still run the real configuration3 SQL.
    await db.query('select public.dc_reveal_v1($1,47,100)', [snapshot.company.id]);
    await db.query("update public.dc_tiles set material='coal',initial_amount=8,remaining=8,formation=null where company_id=$1 and x=47 and y=100", [snapshot.company.id]);
    snapshot = await get();
    snapshot = await finish(A, await dispatchOperation(A, snapshot, { workers: [snapshot.workers[2].id], mode: 'extract', x: 47, y: 100, duration: 60 }));
    snapshot = await collect(A, snapshot.expeditions.find(item => item.status === 'ready').id);
    snapshot = await finish(A, await dispatchOperation(A, snapshot, { workers: [snapshot.workers[0].id], mode: 'extract', x: 47, y: 3 }));
    const specimen = snapshot.discoveries.find(item => item.x === 47 && item.y === 3); assert.ok(specimen);
    snapshot = await resolveDiscovery(A, snapshot, specimen.id, 'keep');
    // Existing source history can exceed a displayed window. These two kept
    // historical rows reuse the canonical frozen specimen and actual depleted
    // tutorial cells, without issuing a sale, salvage, cash or resource reward.
    const tutorial = snapshot.expeditions.find(item => item.tutorial);
    for (const x of [47, 49]) await db.query("insert into public.dc_discoveries(company_id,job_id,x,y,kind,name,quality,detail,sale_value,salvage,status,discovered_at,resolved_at) select company_id,$2,$3,1,kind,name,quality,detail,sale_value,salvage,'kept',discovered_at,resolved_at from public.dc_discoveries where id=$1 on conflict(company_id,x,y) do nothing", [specimen.id, tutorial.id, x]);
    snapshot = await get();
    // Random legitimate early finds can already occupy either cell. Resolve
    // those pending records rather than changing their immutable source data.
    for (const find of snapshot.discoveries.filter(item => item.status === 'pending' && [47, 49].includes(item.x) && item.y === 1)) snapshot = await resolveDiscovery(A, snapshot, find.id, 'keep');
    for (const definition of canonical.milestones) assert.ok(milestone(snapshot, definition.key).progress >= definition.target, definition.key);
    const cash = snapshot.company.cash;
    for (const definition of canonical.milestones) snapshot = await claimMilestone(A, snapshot, definition.key);
    assert.equal(snapshot.company.cash, cash + 400);
    assert.equal(snapshot.business.milestones.filter(item => item.claimed_at !== null).length, 8);
    assert.equal((await one('select count(*)::integer count,sum(reward)::integer total from public.dc_milestone_receipts where company_id=$1', [snapshot.company.id])).total, 400);
    assert.equal((await get()).company.cash, snapshot.company.cash);
  });
}
