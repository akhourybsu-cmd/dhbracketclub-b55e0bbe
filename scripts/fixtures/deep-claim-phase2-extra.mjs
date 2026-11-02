// Additional real-SQL Phase 2 invariants. The main suite supplies an isolated
// PostgreSQL fixture; this module never connects to a remote database.
import assert from 'node:assert/strict';

export async function runPhase2ExtraTests(h) {
  const { check, db, rpc, one, A, B, request, bootstrap, get, preview, dispatch, collect, finish, fixture } = h;
  const revised = (user, name, snapshot, args, key = request()) => rpc(user, name, { ...args, p_expected_revision: snapshot.revision, p_request_id: key });
  const assign = (user, snapshot, item, worker, key) => revised(user, 'dc_assign_equipment', snapshot, { p_item_id: item, p_worker_id: worker }, key);
  const repair = (user, snapshot, item, key) => revised(user, 'dc_repair_equipment', snapshot, { p_item_id: item }, key);
  const retire = (user, snapshot, item, key) => revised(user, 'dc_retire_equipment', snapshot, { p_item_id: item }, key);
  const start = (user, snapshot, recipe, batches = 1, key) => revised(user, 'dc_start_production', snapshot, { p_recipe_key: recipe, p_batches: batches }, key);
  const collectProduction = (user, job, key = request()) => rpc(user, 'dc_collect_production', { p_job_id: job, p_request_id: key });
  const jobById = (snapshot, id) => snapshot.production_jobs.find(job => job.id === id);
  const stockTotal = snapshot => Object.values(snapshot.resources).reduce((sum, value) => sum + value, 0);
  const moneyAndStock = snapshot => ({ cash: snapshot.company.cash, resources: snapshot.resources });
  async function fund(snapshot, amounts = { stone: 80, clay: 40, coal: 40, copper_ore: 120, copper_bar: 40, tin_bar: 20, iron_bar: 20, polished_quartz: 10 }, user = A) {
    // Controlled owner setup: no fake rewards are produced by clock helpers.
    await db.query('update public.dc_companies set cash=100000,warehouse_level=3 where id=$1', [snapshot.company.id]);
    await db.query('update public.dc_inventory set quantity=0 where company_id=$1', [snapshot.company.id]);
    for (const [resource, quantity] of Object.entries(amounts)) await db.query('insert into public.dc_inventory(company_id,resource_key,quantity) values($1,$2,$3) on conflict(company_id,resource_key) do update set quantity=excluded.quantity', [snapshot.company.id, resource, quantity]);
    const result = await get(user);
    assert.ok(stockTotal(result) <= result.company.warehouse_capacity);
    return result;
  }
  async function completeProduction(user, snapshot, recipeKey, batches = 1) {
    const previous = new Set(snapshot.production_jobs.map(job => job.id));
    snapshot = await start(user, snapshot, recipeKey, batches);
    const job = snapshot.production_jobs.find(job => !previous.has(job.id));
    assert.ok(job, 'Starting a recipe must create exactly one owned job');
    await fixture.advanceProduction(user, job.id, job.duration_seconds + 1);
    snapshot = await get(user);
    assert.equal(jobById(snapshot, job.id).status, 'ready');
    snapshot = await collectProduction(user, job.id);
    assert.equal(jobById(snapshot, job.id).status, 'collected');
    return { snapshot, job };
  }
  async function craft(snapshot, batches = 1, user = A) {
    const recipe = snapshot.recipes.find(recipe => recipe.equipment_output === 'copper_pickaxe');
    assert.ok(recipe);
    return (await completeProduction(user, snapshot, recipe.key, batches)).snapshot;
  }

  await check('Phase2 equipment: crafting pays real inputs and creates owned gear only on collection', async () => {
    let snapshot = await fund(await bootstrap());
    const recipe = snapshot.recipes.find(value => value.equipment_output === 'copper_pickaxe');
    const before = moneyAndStock(snapshot), key = request();
    snapshot = await start(A, snapshot, recipe.key, 1, key);
    const job = snapshot.production_jobs[0];
    assert.equal(snapshot.equipment.length, 0);
    assert.equal(snapshot.company.cash, before.cash - recipe.cash_cost);
    for (const [resource, amount] of Object.entries(recipe.inputs)) assert.equal(snapshot.resources[resource], before.resources[resource] - amount);
    await assert.rejects(collectProduction(A, job.id), /not|ready|finished|complete|processing/i);
    await fixture.advanceProduction(A, job.id, job.duration_seconds + 1);
    snapshot = await get(); assert.equal(snapshot.equipment.length, 0);
    const receipt = request(); snapshot = await collectProduction(A, job.id, receipt);
    assert.equal(snapshot.equipment.length, 1);
    const item = snapshot.equipment[0]; assert.equal(item.definition_key, 'copper_pickaxe'); assert.equal(item.worker_id, null); assert.equal(item.durability, item.max_durability);
    const repeated = await collectProduction(A, job.id, receipt);
    assert.deepEqual(repeated.equipment, snapshot.equipment);
    assert.deepEqual((await collectProduction(A, job.id)).equipment, snapshot.equipment);
    assert.deepEqual(moneyAndStock(await get()), moneyAndStock(snapshot));
  });

  await check('Phase2 equipment: foreign items and workers cannot be assigned, repaired or retired', async () => {
    const mine = await craft(await fund(await bootstrap()));
    const other = await craft(await fund(await bootstrap(B), undefined, B), 1, B);
    const mineBefore = moneyAndStock(mine), otherBefore = moneyAndStock(other);
    await assert.rejects(assign(A, mine, other.equipment[0].id, mine.workers[0].id));
    await assert.rejects(assign(A, mine, mine.equipment[0].id, other.workers[0].id));
    await assert.rejects(repair(A, mine, other.equipment[0].id));
    await assert.rejects(retire(A, mine, other.equipment[0].id));
    assert.deepEqual(moneyAndStock(await get()), mineBefore);
    assert.deepEqual(moneyAndStock(await get(B)), otherBefore);
    assert.equal((await get()).equipment[0].worker_id, null);
    assert.equal((await get(B)).equipment[0].worker_id, null);
  });

  await check('Phase2 equipment: each item and worker slot has one assignment and retries never duplicate it', async () => {
    let snapshot = await craft(await fund(await bootstrap()), 2);
    const [first, second] = snapshot.equipment;
    const worker = snapshot.workers[0].id, receipt = request(), revision = snapshot.revision;
    snapshot = await assign(A, snapshot, first.id, worker, receipt);
    const repeat = await revised(A, 'dc_assign_equipment', { revision }, { p_item_id: first.id, p_worker_id: worker }, receipt);
    assert.equal(repeat.equipment.filter(item => item.worker_id === worker).length, 1);
    try { snapshot = await assign(A, snapshot, second.id, worker); }
    catch (error) {
      assert.match(error.code ?? '', /^(P0001|23505)$/);
      assert.match(error.message, /slot|occupied|assigned|equipment/i);
      snapshot = await get();
    }
    assert.equal(snapshot.equipment.filter(item => item.worker_id === worker).length, 1);
    const assigned = snapshot.equipment.find(item => item.worker_id === worker);
    snapshot = await assign(A, snapshot, assigned.id, snapshot.workers[1].id);
    assert.equal(snapshot.equipment.filter(item => item.id === assigned.id && item.worker_id === snapshot.workers[1].id).length, 1);
    assert.equal(snapshot.workers.filter(person => person.equipment_ids.includes(assigned.id)).length, 1);
  });

  await check('Phase2 equipment: bonuses affect new quotes, old public dispatch uses latest config, busy gear cannot move', async () => {
    let snapshot = await craft(await fund(await bootstrap()));
    const worker = snapshot.workers.find(person => person.specialty === 'miner'), item = snapshot.equipment[0];
    await db.query('insert into public.dc_tiles(company_id,x,y,material,initial_amount,remaining) values($1,47,5,\'coal\',500,500) on conflict(company_id,x,y) do update set material=excluded.material,initial_amount=excluded.initial_amount,remaining=excluded.remaining', [snapshot.company.id]);
    const plain = await preview(A, snapshot, { mode: 'extract', x: 47, y: 5, workers: [worker.id] });
    snapshot = await assign(A, snapshot, item.id, worker.id);
    const geared = await preview(A, snapshot, { mode: 'extract', x: 47, y: 5, workers: [worker.id] });
    assert.ok(snapshot.workers.find(person => person.id === worker.id).stats.mining > worker.stats.mining);
    assert.ok(geared.estimated_yield.max > plain.estimated_yield.max);
    snapshot = await dispatch(A, snapshot, { mode: 'extract', x: 47, y: 5, workers: [worker.id] });
    const job = snapshot.expeditions.find(job => job.status === 'active'); assert.equal(job.config_version, h.currentFieldRules);
    const frozen = await one('select content from public.dc_plans where job_id=$1', [job.id]);
    const frozenBefore = JSON.stringify(frozen.content);
    await assert.rejects(assign(A, snapshot, item.id, null), /busy|away|expedition|idle|return/i);
    await assert.rejects(assign(A, snapshot, item.id, snapshot.workers.find(person => person.id !== worker.id).id), /busy|away|expedition|idle|return/i);
    assert.equal(JSON.stringify((await one('select content from public.dc_plans where job_id=$1', [job.id])).content), frozenBefore);
    assert.equal((await get()).equipment.find(gear => gear.id === item.id).durability, item.durability, 'dispatch itself causes no completed-job wear');
  });

  await check('Phase2 equipment: completed jobs apply wear once and paid repair consumes exact current inputs', async () => {
    let snapshot = await craft(await fund(await bootstrap()));
    const worker = snapshot.workers[0].id, item = snapshot.equipment[0];
    snapshot = await assign(A, snapshot, item.id, worker);
    snapshot = await dispatch(A, snapshot, { workers: [worker] });
    const job = snapshot.expeditions.find(job => job.status === 'active');
    snapshot = await finish(A, snapshot);
    const worn = snapshot.equipment.find(gear => gear.id === item.id);
    assert.ok(worn.durability < item.durability && worn.durability > 0);
    assert.equal((await get()).equipment.find(gear => gear.id === item.id).durability, worn.durability);
    snapshot = await collect(A, job.id);
    const before = moneyAndStock(snapshot), receipt = request(), revision = snapshot.revision;
    snapshot = await repair(A, snapshot, item.id, receipt);
    assert.equal(snapshot.company.cash, before.cash - worn.repair_cost);
    for (const [resource, quantity] of Object.entries(worn.repair_materials)) assert.equal(snapshot.resources[resource], before.resources[resource] - quantity);
    assert.equal(snapshot.equipment.find(gear => gear.id === item.id).durability, item.max_durability);
    const repeat = await revised(A, 'dc_repair_equipment', { revision }, { p_item_id: item.id }, receipt);
    assert.deepEqual(moneyAndStock(repeat), moneyAndStock(snapshot));
    assert.equal(repeat.equipment.find(gear => gear.id === item.id).durability, item.max_durability);
  });

  await check('Phase2 equipment: broken gear loses bonuses, permits baseline work and cannot be repaired away', async () => {
    let snapshot = await craft(await fund(await bootstrap()));
    const worker = snapshot.workers.find(person => person.specialty === 'miner'), item = snapshot.equipment[0];
    snapshot = await assign(A, snapshot, item.id, worker.id);
    assert.ok(snapshot.workers.find(person => person.id === worker.id).stats.mining > worker.stats.mining);
    await db.query('update public.dc_equipment set durability=0 where id=$1', [item.id]);
    snapshot = await get();
    assert.equal(snapshot.workers.find(person => person.id === worker.id).stats.mining, worker.stats.mining);
    const quote = await preview(A, snapshot, { mode: 'extract', x: 47, y: 1, workers: [worker.id] });
    assert.equal(quote.allowed, true, 'A broken optional tool must not prevent baseline paid work');
    snapshot = await dispatch(A, snapshot, { workers: [worker.id] });
    await assert.rejects(repair(A, snapshot, item.id), /busy|away|expedition|idle|return/i);
    snapshot = await finish(A, snapshot);
    assert.equal(snapshot.equipment.find(gear => gear.id === item.id).durability, 0);
    snapshot = await repair(A, snapshot, item.id);
    assert.equal(snapshot.equipment.find(gear => gear.id === item.id).durability, item.max_durability);
    assert.ok(snapshot.workers.find(person => person.id === worker.id).stats.mining > worker.stats.mining);
  });

  await check('Phase2 production: invalid quantities, unknown recipes and insufficient stock roll back all inputs', async () => {
    let snapshot = await fund(await bootstrap()); snapshot = await h.upgrade(A, snapshot, 'smeltery');
    const recipe = snapshot.recipes.find(value => value.key === 'smelt_copper'), before = moneyAndStock(snapshot);
    for (const batches of [0, -1, 11, null, 'NaN', 1.5]) await assert.rejects(start(A, snapshot, recipe.key, batches));
    await assert.rejects(start(A, snapshot, 'not_a_recipe'));
    assert.deepEqual(moneyAndStock(await get()), before);
    await db.query('update public.dc_inventory set quantity=0 where company_id=$1 and resource_key=\'coal\'', [snapshot.company.id]);
    snapshot = await get();
    const noFuel = moneyAndStock(snapshot);
    await assert.rejects(start(A, snapshot, recipe.key), /stock|material|input|coal|resource/i);
    assert.deepEqual(moneyAndStock(await get()), noFuel);
    assert.equal((await get()).production_jobs.length, 0);
  });

  await check('Phase2 production: queue timing is frozen, bounded and nonoverlapping for a station', async () => {
    let snapshot = await fund(await bootstrap()); snapshot = await h.upgrade(A, snapshot, 'smeltery');
    let rejected = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      const before = moneyAndStock(snapshot);
      try { snapshot = await start(A, snapshot, 'smelt_copper'); }
      catch (error) {
        assert.equal(error.code, 'P0001');
        assert.match(error.message, /queue|lane|station|processing|production|outstanding/i);
        rejected = true; assert.deepEqual(moneyAndStock(await get()), before); break;
      }
    }
    assert.ok(rejected, 'A finite company/station queue must reject a fourth outstanding order');
    const jobs = snapshot.production_jobs.filter(job => job.status !== 'collected').sort((left, right) => Date.parse(left.started_at) - Date.parse(right.started_at));
    assert.ok(jobs.length >= 1 && jobs.length <= 3);
    for (let i = 1; i < jobs.length; i++) assert.ok(Date.parse(jobs[i].started_at) >= Date.parse(jobs[i - 1].completes_at));
    for (const job of jobs) assert.equal(Date.parse(job.completes_at) - Date.parse(job.started_at), job.duration_seconds * 1000);
  });

  await check('Phase2 production: real timers gate outputs and duplicate collection cannot award twice', async () => {
    let snapshot = await fund(await bootstrap()); snapshot = await h.upgrade(A, snapshot, 'smeltery');
    const recipe = snapshot.recipes.find(value => value.key === 'smelt_copper'), quantity = snapshot.resources.copper_bar;
    const receipt = request(), revision = snapshot.revision;
    snapshot = await start(A, snapshot, recipe.key, 1, receipt);
    const job = snapshot.production_jobs[0];
    const repeatedStart = await revised(A, 'dc_start_production', { revision }, { p_recipe_key: recipe.key, p_batches: 1 }, receipt);
    assert.equal(repeatedStart.production_jobs.length, 1);
    assert.equal(repeatedStart.resources.copper_bar, quantity);
    await assert.rejects(collectProduction(A, job.id));
    await fixture.advanceProduction(A, job.id, job.duration_seconds + 1);
    snapshot = await get(); assert.equal(jobById(snapshot, job.id).status, 'ready'); assert.equal(snapshot.resources.copper_bar, quantity);
    const collection = request(); snapshot = await collectProduction(A, job.id, collection);
    assert.equal(snapshot.resources.copper_bar, quantity + recipe.outputs.copper_bar);
    const after = moneyAndStock(snapshot);
    assert.deepEqual(moneyAndStock(await collectProduction(A, job.id, collection)), after);
    assert.deepEqual(moneyAndStock(await collectProduction(A, job.id)), after);
  });

  await check('Phase2 production: another company cannot collect an order or manufacture goods from its stock', async () => {
    let snapshot = await fund(await bootstrap()); snapshot = await h.upgrade(A, snapshot, 'smeltery');
    snapshot = await start(A, snapshot, 'smelt_copper');
    const job = snapshot.production_jobs[0]; await fixture.advanceProduction(A, job.id, job.duration_seconds + 1);
    snapshot = await get(); const other = await bootstrap(B);
    await assert.rejects(collectProduction(B, job.id));
    assert.equal(jobById(await get(), job.id).status, 'ready');
    assert.deepEqual(moneyAndStock(await get(B)), moneyAndStock(other));
  });

  await check('Phase2 production: failed receipt write rolls back the queued job, upfront cash and every input', async () => {
    let snapshot = await fund(await bootstrap()); snapshot = await h.upgrade(A, snapshot, 'smeltery');
    const before = moneyAndStock(snapshot), company = snapshot.company.id, receipt = request();
    await db.exec("create function public.dc_test_receipt_failure() returns trigger language plpgsql as $$begin raise exception 'Injected Phase2 receipt failure';end$$;create trigger dc_test_receipt_failure after insert on public.dc_requests for each row execute function public.dc_test_receipt_failure()");
    try { await assert.rejects(start(A, snapshot, 'smelt_copper', 1, receipt), /Injected Phase2 receipt failure/); }
    finally { await db.exec('drop trigger dc_test_receipt_failure on public.dc_requests;drop function public.dc_test_receipt_failure()'); }
    assert.deepEqual(moneyAndStock(await get()), before);
    assert.equal((await one('select count(*)::integer count from public.dc_production_jobs where company_id=$1', [company])).count, 0);
    assert.equal((await one('select count(*)::integer count from public.dc_requests where request_id=$1', [receipt])).count, 0);
    const retried = await start(A, snapshot, 'smelt_copper', 1, receipt);
    assert.equal(retried.production_jobs.length, 1);
    assert.equal(retried.company.cash, before.cash - snapshot.recipes.find(recipe => recipe.key === 'smelt_copper').cash_cost);
  });

  await check('Phase2 equipment: failed item creation rolls collection back and retries mint exactly one item', async () => {
    let snapshot = await fund(await bootstrap()); snapshot = await start(A, snapshot, 'craft_copper_pickaxe');
    const job = snapshot.production_jobs[0], receipt = request();
    await fixture.advanceProduction(A, job.id, job.duration_seconds + 1);
    snapshot = await get();
    await db.exec("create function public.dc_test_equipment_failure() returns trigger language plpgsql as $$begin raise exception 'Injected Phase2 item creation failure';end$$;create trigger dc_test_equipment_failure after insert on public.dc_equipment for each row execute function public.dc_test_equipment_failure()");
    try { await assert.rejects(collectProduction(A, job.id, receipt), /Injected Phase2 item creation failure/); }
    finally { await db.exec('drop trigger dc_test_equipment_failure on public.dc_equipment;drop function public.dc_test_equipment_failure()'); }
    const beforeRetry = await get(); assert.equal(beforeRetry.equipment.length, 0); assert.equal(jobById(beforeRetry, job.id).status, 'ready');
    assert.equal((await one('select count(*)::integer count from public.dc_requests where request_id=$1', [receipt])).count, 0);
    snapshot = await collectProduction(A, job.id, receipt);
    assert.equal(snapshot.equipment.length, 1); assert.equal(jobById(snapshot, job.id).status, 'collected');
    assert.equal((await collectProduction(A, job.id, receipt)).equipment.length, 1);
  });

  await check('Phase2 production: warehouse overflow remains staged, then collects without loss or duplication', async () => {
    let snapshot = await fund(await bootstrap()); snapshot = await h.upgrade(A, snapshot, 'smeltery');
    snapshot = await start(A, snapshot, 'smelt_copper', 10);
    const job = snapshot.production_jobs[0], total = job.outputs.copper_bar;
    await fixture.advanceProduction(A, job.id, job.duration_seconds + 1);
    snapshot = await get();
    await db.query('update public.dc_inventory set quantity=0 where company_id=$1', [snapshot.company.id]);
    await db.query('update public.dc_inventory set quantity=$2 where company_id=$1 and resource_key=\'stone\'', [snapshot.company.id, snapshot.company.warehouse_capacity - 1]);
    snapshot = await get(); snapshot = await collectProduction(A, job.id);
    assert.equal(snapshot.resources.copper_bar, 1);
    assert.equal(jobById(snapshot, job.id).status, 'ready');
    assert.ok(jobById(snapshot, job.id).outputs.copper_bar >= total - 1);
    await db.query('update public.dc_inventory set quantity=0 where company_id=$1 and resource_key=\'stone\'', [snapshot.company.id]);
    snapshot = await collectProduction(A, job.id);
    assert.equal(snapshot.resources.copper_bar, total);
    assert.equal(jobById(snapshot, job.id).status, 'collected');
    assert.equal((await collectProduction(A, job.id)).resources.copper_bar, total);
  });

  await check('Phase2 economy: recipes have finite paid inputs and no recursive input/output minting loop', async () => {
    const snapshot = await bootstrap(), recipes = snapshot.recipes;
    const legacy = (await one("select config->'recipes' recipes from public.dc_rules where version=2")).recipes;
    assert.equal(legacy.length, 16);
    assert.equal(snapshot.business_catalog.recipes.length, 5);
    assert.equal(snapshot.deep_catalog.recipes.length, 2);
    const authored = [...legacy, ...snapshot.business_catalog.recipes, ...snapshot.deep_catalog.recipes];
    assert.equal(recipes.length, authored.length);
    const producers = new Map();
    for (const recipe of recipes) {
      const original = authored.find(definition => definition.key === recipe.key); assert.ok(original);
      for (const [field, value] of Object.entries(original)) assert.deepEqual(recipe[field], value, `${recipe.key} changed authored ${field}`);
      assert.ok(recipe.cash_cost > 0);
      if (legacy.some(definition => definition.key === recipe.key)) assert.ok(recipe.duration_seconds >= 120 && recipe.duration_seconds <= 600);
      else assert.equal(recipe.duration_seconds, original.duration_seconds);
      assert.equal(recipe.max_batches, 10);
      assert.ok(Object.values(recipe.inputs).reduce((sum, quantity) => sum + quantity, 0) > 0);
      for (const [resource, quantity] of Object.entries(recipe.inputs)) assert.ok(Number.isSafeInteger(quantity) && quantity > 0 && !(resource in recipe.outputs));
      for (const resource of Object.keys(recipe.outputs)) { const list = producers.get(resource) ?? []; list.push(recipe); producers.set(resource, list); }
    }
    function visit(resource, seen) {
      assert.ok(!seen.has(resource), `Recipe cycle would permit recursive material conversion: ${resource}`);
      const next = new Set(seen); next.add(resource);
      for (const producer of producers.get(resource) ?? []) for (const input of Object.keys(producer.inputs)) visit(input, next);
    }
    for (const resource of producers.keys()) visit(resource, new Set());
    assert.equal(snapshot.company.cash, 180, 'Reading public recipes does not mint business cash');
  });

  await check('Phase2 equipment: capacity includes pending outputs and retirement is owned, unassigned and nonrefundable', async () => {
    let snapshot = await fund(await bootstrap(), { stone: 240, copper_bar: 60 });
    for (let batch = 0; batch < 4; batch++) snapshot = await craft(snapshot, 10);
    snapshot = await craft(snapshot, 8);
    assert.equal(snapshot.equipment.length, 48);
    const before = moneyAndStock(snapshot);
    await assert.rejects(start(A, snapshot, 'craft_copper_pickaxe'));
    assert.deepEqual(moneyAndStock(await get()), before);
    const item = snapshot.equipment[0], worker = snapshot.workers[0].id;
    snapshot = await assign(A, snapshot, item.id, worker);
    await assert.rejects(retire(A, snapshot, item.id), /unassigned|assigned|unequip/i);
    snapshot = await assign(A, snapshot, item.id, null);
    const paid = moneyAndStock(snapshot), receipt = request(), revision = snapshot.revision;
    snapshot = await retire(A, snapshot, item.id, receipt);
    assert.equal(snapshot.equipment.length, 47); assert.equal(snapshot.equipment.some(gear => gear.id === item.id), false);
    assert.deepEqual(moneyAndStock(snapshot), paid);
    const repeat = await revised(A, 'dc_retire_equipment', { revision }, { p_item_id: item.id }, receipt);
    assert.deepEqual(moneyAndStock(repeat), paid); assert.equal(repeat.equipment.length, 47);
    await assert.rejects(assign(A, snapshot, item.id, worker)); await assert.rejects(repair(A, snapshot, item.id));
    snapshot = await start(A, snapshot, 'craft_copper_pickaxe');
    assert.equal(snapshot.equipment.length, 47);
    await assert.rejects(start(A, snapshot, 'craft_copper_pickaxe'), /capacity|limit|equipment|gear|48/i);
    const job = snapshot.production_jobs.find(job => job.status === 'active');
    await fixture.advanceProduction(A, job.id, job.duration_seconds + 1);
    snapshot = await get(); snapshot = await collectProduction(A, job.id);
    assert.equal(snapshot.equipment.length, 48);
    assert.equal(new Set(snapshot.equipment.map(gear => gear.id)).size, 48);
  });
}
