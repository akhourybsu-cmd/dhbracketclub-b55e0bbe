// Actual local PostgreSQL Ancient Deep edge cases. Late-game company/research
// history and finite source stock are explicit isolated owner fixtures; paid
// upgrades, dispatch, production, collection, wear and repairs use real RPCs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function runPhase7ExtraTests(h) {
  const { check, db, one, rpc, A, B, request, bootstrap, get, upgrade, fixture, deepEngine,
    previewOperation, dispatchOperation, collect } = h;
  const canonical = JSON.parse(await readFile('supabase/seed/deep-claim-phase7-catalog.json', 'utf8'));
  const economic = snapshot => ({ revision: snapshot.revision, cash: snapshot.company.cash, resources: snapshot.resources,
    workers: snapshot.workers, equipment: snapshot.equipment, jobs: snapshot.expeditions, production: snapshot.production_jobs });
  const domainFailure = pattern => error => { assert.match(error.code ?? '', /^(P0001|40001|42501|23505)$/); assert.match(error.message, pattern); return true; };
  const revised = (snapshot, name, args, key = request()) => rpc(A, name, { ...args, p_expected_revision: snapshot.revision, p_request_id: key });
  async function prepared({ omitted = [], shaft6 = true, user = A } = {}) {
    let snapshot = await bootstrap(user); const company = snapshot.company.id;
    // Frozen, completed pre-expansion research is an earned-history fixture,
    // not an instant research feature or a production reward granted by QA.
    await db.query(`insert into public.dc_research_orders(company_id,research_key,definition_snapshot,cash_cost,inputs,started_at,completes_at,completed_at)
      select $1,d->>'key',d,(d->>'cash_cost')::integer,d->'inputs',timestamp with time zone '2025-01-01',
       timestamp with time zone '2025-01-01'+(d->>'duration_seconds')::integer*interval '1 second',
       timestamp with time zone '2025-01-01'+(d->>'duration_seconds')::integer*interval '1 second'
      from jsonb_array_elements($2::jsonb)d where not(d->>'key'=any($3::text[]))`, [company, JSON.stringify(snapshot.business_catalog.research), omitted]);
    await db.query('update public.dc_companies set cash=100000,warehouse_level=3,shaft_level=5,office_level=3,tool_level=3,smeltery_level=3,gem_workshop_level=3,research_office_level=2 where id=$1', [company]);
    await db.query('select public.dc_reveal_v1($1,48,y) from generate_series(0,556)y', [company]);
    snapshot = await get(user);
    if (shaft6) snapshot = await upgrade(user, snapshot, 'mine_shaft');
    return snapshot;
  }
  async function stock(snapshot, quantities, user = A) {
    assert.ok(Object.values(quantities).reduce((sum, amount) => sum + amount, 0) <= 480);
    await db.query('update public.dc_inventory set quantity=0 where company_id=$1', [snapshot.company.id]);
    for (const [key, quantity] of Object.entries(quantities)) await db.query('insert into public.dc_inventory values($1,$2,$3) on conflict(company_id,resource_key) do update set quantity=excluded.quantity', [snapshot.company.id, key, quantity]);
    return get(user);
  }
  async function seam(snapshot, x, y, material = 'nickel_ore', units = 36) {
    await db.query('insert into public.dc_tiles(company_id,x,y,material,initial_amount,remaining,formation) values($1,$2,$3,$4,$5,$5,null) on conflict(company_id,x,y) do update set material=excluded.material,initial_amount=excluded.initial_amount,remaining=excluded.remaining,formation=null', [snapshot.company.id, x, y, material, units]);
    return get();
  }
  const lift = async (snapshot, route) => (await one('select public.dc_lift_discount_v7($1,$2::jsonb) value', [snapshot.company.id, JSON.stringify(route)])).value;
  const modifiers = async (snapshot, ids, mode, depth, route, raw = 301) => (await one('select public.dc_deep_modifiers_v7($1,$2::uuid[],$3,47,$4,$5::jsonb,$6) value', [snapshot.company.id, ids, mode, depth, JSON.stringify(route), raw])).value;
  const averageEngineering = (snapshot, ids) => Math.floor(snapshot.workers.filter(worker => ids.includes(worker.id)).reduce((sum, worker) => sum + worker.stats.engineering, 0) / ids.length);
  async function item(snapshot, worker = null, durability = 180, key = 'nickel_heatshield') {
    const row = await one(`insert into public.dc_equipment(company_id,definition_key,definition_version,definition_snapshot,slot,worker_id,durability,max_durability)
      select $1,definition_key,version,definition,definition->>'slot',$2,$3,(definition->>'max_durability')::integer
      from public.dc_equipment_catalog where definition_key=$4 and version=1 returning id`, [snapshot.company.id, worker, durability, key]);
    assert.ok(row); return { snapshot: await get(snapshot.company.user_id), id: row.id };
  }
  async function finishJob(snapshot, id) {
    const job = snapshot.expeditions.find(value => value.id === id); assert.ok(job);
    await fixture.advanceJob(A, id, job.duration_seconds + 2); return get();
  }
  async function install(snapshot, key, x, y, duration, worker) {
    snapshot = await stock(snapshot, { stone: 60, clay: 30, coal: 30, copper_bar: 10, iron_bar: 10 });
    const before = snapshot; snapshot = await dispatchOperation(A, snapshot, { workers: [worker], mode: 'infrastructure', x, y, infrastructure: key, duration });
    const job = snapshot.expeditions.find(value => !before.expeditions.some(old => old.id === value.id)); assert.ok(job);
    return finishJob(snapshot, job.id);
  }
  async function production(snapshot, recipe, batches = 1) {
    const before = snapshot;
    snapshot = await revised(snapshot, 'dc_start_production', { p_recipe_key: recipe, p_batches: batches });
    const job = snapshot.production_jobs.find(value => !before.production_jobs.some(old => old.id === value.id)); assert.ok(job);
    await fixture.advanceProduction(A, job.id, job.duration_seconds + 1); snapshot = await get();
    snapshot = await rpc(A, 'dc_collect_production', { p_job_id: job.id, p_request_id: request() });
    return { snapshot, job };
  }
  async function historicalInfrastructure(source, count, start = 0) {
    // Storage-cap boundary history only. Every clone is a correctly shaped
    // completed owned ticket; no private milestone is replayed or paid twice.
    await db.query("insert into public.dc_tiles(company_id,x,y,material,initial_amount,remaining) select $1,x,y,'stone',1,0 from generate_series(1,95)x cross join generate_series(20,23)y on conflict(company_id,x,y) do nothing", [source.company_id]);
    for (let index = start; index < start + count; index++) {
      const jobId = request(), structureId = request();
      await db.query(`insert into public.dc_expeditions select (jsonb_populate_record(null::public.dc_expeditions,to_jsonb(e)||jsonb_build_object(
        'id',$2::uuid,'status','collected','cargo','{}'::jsonb,'collected_at',clock_timestamp(),
        'started_at',e.started_at-(e.duration_seconds+10)*interval '1 second','completes_at',e.completes_at-(e.duration_seconds+10)*interval '1 second',
        'stages',(select jsonb_agg(value||jsonb_build_object('starts_at',(value->>'starts_at')::timestamptz-(e.duration_seconds+10)*interval '1 second','ends_at',(value->>'ends_at')::timestamptz-(e.duration_seconds+10)*interval '1 second') order by ordinality) from jsonb_array_elements(e.stages) with ordinality)
      ))).* from public.dc_expeditions e where e.id=$1`, [source.job_id, jobId]);
      await db.query('insert into public.dc_expedition_workers select $2,worker_id from public.dc_expedition_workers where job_id=$1', [source.job_id, jobId]);
      await db.query('insert into public.dc_plans select $2,content from public.dc_plans where job_id=$1', [source.job_id, jobId]);
      await db.query(`insert into public.dc_infrastructure select (jsonb_populate_record(null::public.dc_infrastructure,to_jsonb(i)||jsonb_build_object(
        'id',$2::uuid,'job_id',$3::uuid,'x',$4::integer,'y',$5::integer))).* from public.dc_infrastructure i where i.id=$1`,
      [source.id, structureId, jobId, 1 + index % 90, 20 + Math.floor(index / 90)]);
    }
  }

  await check('Phase7 lift: exact Manhattan length, compressed edges and constructed limits match public math', async () => {
    const snapshot = await prepared();
    const cases = [[], [{ x: 48, y: 0 }], [{ x: 48, y: 0 }, { x: 48, y: 900 }],
      [{ x: 48, y: 0 }, { x: 48, y: 900 }, { x: 52, y: 900 }],
      [{ x: 48, y: 0 }, { x: 48, y: 999 }], [{ x: 48, y: 999 }, { x: 48, y: 0 }],
      [{ x: 47, y: 0 }, { x: 47, y: 900 }], [{ x: 48, y: 950 }, { x: 48, y: 999 }]];
    for (const route of cases) assert.equal(await lift(snapshot, route), deepEngine.liftTravelDiscount(route, snapshot.world.tiles, 6, ['deep_operations_2']).discount_percent, JSON.stringify(route));
    assert.equal(await lift(snapshot, cases[4]), 71);
    assert.equal(await lift(snapshot, cases[3]), 74);
  });

  await check('Phase7 lift: hidden and solid shaft gaps, missing research and old shaft levels supply no invented transport', async () => {
    let snapshot = await prepared(); const company = snapshot.company.id, route = [{ x: 48, y: 0 }, { x: 48, y: 100 }];
    const original = (await one('select to_jsonb(t) value from public.dc_tiles t where company_id=$1 and x=48 and y=50', [company])).value;
    await db.query('delete from public.dc_tiles where company_id=$1 and x=48 and y=50', [company]);
    assert.equal(await lift(snapshot, route), 73, 'One unknown interior point removes both adjacent unit edges');
    await db.query('insert into public.dc_tiles select (jsonb_populate_record(null::public.dc_tiles,$1::jsonb)).*', [JSON.stringify(original)]);
    await db.query("update public.dc_tiles set material='stone',initial_amount=1,remaining=1 where company_id=$1 and x=48 and y=50", [company]);
    assert.equal(await lift(snapshot, route), 73, 'A known solid point is not lift access');
    await db.query('update public.dc_tiles set material=$2,initial_amount=$3,remaining=$4 where company_id=$1 and x=48 and y=50', [company, original.material, original.initial_amount, original.remaining]);
    await db.query('update public.dc_companies set shaft_level=5 where id=$1', [company]);
    assert.equal(await lift(snapshot, route), 0);
    // Query the pure helper at an owner-fixture boundary; do not expose an
    // invalid paid-upgrade state or change a sealed research receipt.
    snapshot = await prepared({ omitted: ['deep_operations_2'], shaft6: false, user: B });
    await db.query('update public.dc_companies set shaft_level=6 where id=$1', [snapshot.company.id]);
    assert.equal(await lift(snapshot, route), 0);
  });

  await check('Phase7 thermal: depth boundaries, mode exclusions and useful-work flooring match actual SQL', async () => {
    const snapshot = await prepared(), ids = [snapshot.workers[0].id];
    for (const depth of [599, 600, 699, 700, 799, 800, 899, 900, 999]) for (const mode of ['extract', 'explore', 'survey', 'infrastructure']) {
      const route = [{ x: 48, y: 0 }, { x: 48, y: Math.min(depth, 956) }, { x: 47, y: depth }];
      const actual = await modifiers(snapshot, ids, mode, depth, route);
      assert.deepEqual(actual, deepEngine.calculateDeepModifiers({ mode, depth, raw_work_seconds: 301, engineering: averageEngineering(snapshot, ids), ventilation_strength: 0, gear_reduction_percent: 0, lift_discount_percent: await lift(snapshot, route) }));
      if (mode === 'survey' || mode === 'infrastructure' || depth < 600) assert.equal(actual.effective_work_seconds, 301);
    }
  });

  await check('Phase7 tutorial: an unused starter shift retains original clocks and no lift or heat after a shaft6 upgrade', async () => {
    const snapshot = await prepared(), worker = snapshot.workers[0];
    assert.equal(snapshot.company.tutorial_used, false);
    const options = { workers: [worker.id], mode: 'extract', x: 47, y: 1, duration: 20, tutorial: true };
    const quote = await previewOperation(A, snapshot, options);
    assert.equal(quote.allowed, true, quote.reasons.join(' '));
    assert.deepEqual(quote.stages.map(stage => stage.duration_seconds), [5, 3, 15, 3, 4]);
    const expected = deepEngine.calculateDeepCrewPlan({ workers: [worker], mode: 'extract', duration_minutes: 20,
      route: quote.route, tiles: snapshot.world.tiles, shaft_level: 6,
      completed_research: snapshot.business.research.map(value => value.key), equipment: snapshot.equipment,
      infrastructure: snapshot.infrastructure, tool_level: 3, material: 'stone', tutorial: true });
    assert.deepEqual(quote.deep_modifiers, expected.deep_modifiers);
    assert.equal(quote.deep_modifiers.lift_discount_percent, 0);
    assert.equal(quote.deep_modifiers.heat_penalty_percent, 0);
    const started = await dispatchOperation(A, snapshot, options);
    const job = started.expeditions.find(value => !snapshot.expeditions.some(old => old.id === value.id));
    assert.ok(job); assert.equal(job.config_version, 7); assert.equal(job.duration_seconds, 30);
    assert.deepEqual(job.deep_modifiers, quote.deep_modifiers);
    assert.equal(started.company.tutorial_used, true);
  });

  await check('Phase7 thermal gear: protection averages only working assigned selected-crew shields', async () => {
    let snapshot = await prepared(); const workers = snapshot.workers.map(worker => worker.id), route = [{ x: 48, y: 0 }, { x: 48, y: 600 }];
    const first = await item(snapshot, workers[0]); snapshot = first.snapshot;
    const reduction = async ids => (await modifiers(snapshot, ids, 'extract', 600, route)).gear_mitigation_percent;
    assert.equal(await reduction([workers[0]]), 15); assert.equal(await reduction(workers.slice(0, 2)), 7); assert.equal(await reduction(workers), 5);
    const second = await item(snapshot, workers[1]); snapshot = second.snapshot;
    assert.equal(await reduction(workers), 10); assert.equal(await reduction([workers[2]]), 0);
    await db.query('update public.dc_equipment set durability=0 where id=$1', [first.id]); snapshot = await get(); assert.equal(await reduction(workers), 5);
    snapshot = await revised(snapshot, 'dc_assign_equipment', { p_item_id: second.id, p_worker_id: null }); assert.equal(await reduction(workers), 0);
    const peer = await prepared({ user: B }), peerBefore = economic(peer), before = economic(snapshot);
    await assert.rejects(dispatchOperation(A, snapshot, { mode: 'extract', x: 47, y: 3, workers: [peer.workers[0].id] }), domainFailure(/worker|crew|owned|available/i));
    assert.deepEqual(economic(await get()), before); assert.deepEqual(economic(await get(B)), peerBefore);
  });

  await check('Phase7 thermal ventilation: strongest installed project applies without stacking and auxiliary jobs remain usable', async () => {
    let snapshot = await prepared(); const [miner, geologist, hauler] = snapshot.workers;
    snapshot = await install(snapshot, 'ventilation', 48, 600, 60, hauler.id);
    snapshot = await install(snapshot, 'ventilation', 48, 601, 180, geologist.id);
    const strongest = Math.max(...snapshot.infrastructure.map(value => value.strength));
    const route = [{ x: 48, y: 0 }, { x: 48, y: 600 }, { x: 47, y: 600 }];
    const actual = await modifiers(snapshot, [miner.id], 'extract', 600, route);
    assert.equal(actual.ventilation_mitigation_percent, strongest);
    assert.deepEqual(actual, deepEngine.calculateDeepModifiers({ mode: 'extract', depth: 600, raw_work_seconds: 301, engineering: averageEngineering(snapshot, [miner.id]), ventilation_strength: strongest, gear_reduction_percent: 0, lift_discount_percent: await lift(snapshot, route) }));
    const survey = await modifiers(snapshot, [miner.id], 'survey', 999, route);
    assert.equal(survey.heat_penalty_percent, 0); assert.equal(survey.effective_work_seconds, 301);
  });

  await check('Phase7 actual dispatch: quoted useful work is frozen once, wear cannot undo protection and retries cannot spend twice', async () => {
    let snapshot = await seam(await prepared(), 47, 600, 'nickel_ore', 36);
    const worker = snapshot.workers[0], shield = await item(snapshot, worker.id, 2); snapshot = shield.snapshot;
    const options = { mode: 'extract', x: 47, y: 600, duration: 60, workers: [worker.id] };
    const quote = await previewOperation(A, snapshot, options); assert.equal(quote.allowed, true, quote.reasons.join(' '));
    const expected = deepEngine.calculateDeepCrewPlan({ workers: snapshot.workers.filter(value => value.id === worker.id), mode: 'extract', duration_minutes: 60,
      route: quote.route, tiles: snapshot.world.tiles, shaft_level: 6, completed_research: snapshot.business.research.filter(value => value.status === 'completed').map(value => value.key),
      equipment: snapshot.equipment, infrastructure: snapshot.infrastructure, tool_level: 3, material: 'nickel_ore', remaining: 36 });
    assert.deepEqual(quote.deep_modifiers, expected.deep_modifiers); assert.equal(quote.deep_modifiers.gear_mitigation_percent, 15);
    const previous = snapshot, receipt = request(); snapshot = await dispatchOperation(A, snapshot, options, receipt);
    const job = snapshot.expeditions.find(value => !previous.expeditions.some(old => old.id === value.id)); assert.ok(job);
    assert.equal(job.config_version, 7); assert.deepEqual(job.deep_modifiers, quote.deep_modifiers);
    const plan = (await one('select content from public.dc_plans where job_id=$1', [job.id])).content;
    assert.deepEqual(plan.deep_modifiers, quote.deep_modifiers);
    snapshot = await finishJob(snapshot, job.id);
    assert.equal(snapshot.equipment.find(value => value.id === shield.id).durability, 0);
    assert.deepEqual(snapshot.expeditions.find(value => value.id === job.id).deep_modifiers, quote.deep_modifiers);
    assert.deepEqual(snapshot.expeditions.find(value => value.id === job.id).cargo, plan.cargo);
    const after = economic(snapshot); snapshot = await dispatchOperation(A, previous, options, receipt); assert.deepEqual(economic(snapshot), after);
    assert.equal((await modifiers(snapshot, [worker.id], 'extract', 600, quote.route)).gear_mitigation_percent, 0);
    await assert.rejects(db.query("update public.dc_expeditions set deep_modifiers=jsonb_set(deep_modifiers,'{heat_penalty_percent}','0') where id=$1", [job.id]), /immutable|frozen|committed/i);
  });

  await check('Phase7 actual quote: powered lift precedes weighted rail and preserves elapsed stage totals', async () => {
    let snapshot = await seam(await prepared(), 47, 100, 'coal', 150);
    snapshot = await install(snapshot, 'rail', 48, 1, 20, snapshot.workers[1].id);
    const worker = snapshot.workers.find(value => value.specialty === 'hauler');
    const quote = await previewOperation(A, snapshot, { mode: 'extract', x: 47, y: 100, duration: 60, workers: [worker.id] }); assert.equal(quote.allowed, true, quote.reasons.join(' '));
    const expected = deepEngine.calculateDeepCrewPlan({ workers: [worker], mode: 'extract', duration_minutes: 60, route: quote.route, tiles: snapshot.world.tiles,
      shaft_level: 6, completed_research: snapshot.business.research.map(value => value.key), equipment: snapshot.equipment, infrastructure: snapshot.infrastructure, tool_level: 3, material: 'coal', remaining: 150 });
    assert.ok(quote.deep_modifiers.lift_discount_percent > 0); assert.ok(quote.conditions.transport_bonus_percent > 0 && quote.conditions.transport_bonus_percent < snapshot.infrastructure[0].strength);
    assert.deepEqual(quote.deep_modifiers, expected.deep_modifiers);
    for (const stage of quote.stages) assert.equal(stage.duration_seconds, expected.stages.find(value => value.key === stage.key).duration_seconds);
    assert.equal(quote.stages.reduce((sum, stage) => sum + stage.duration_seconds, 0), 3600);
  });

  await check('Phase7 economy: real nickel alloy production conserves finite inputs and adds exactly23 sale credits per batch', async () => {
    let snapshot = await stock(await prepared(), { nickel_ore: 3, iron_bar: 1, coal: 2 }); const before = snapshot;
    const result = await production(snapshot, 'smelt_nickel_alloy'); snapshot = result.snapshot;
    assert.equal(snapshot.company.cash, before.company.cash - 10); assert.equal(snapshot.resources.nickel_ore, 0); assert.equal(snapshot.resources.iron_bar, 0); assert.equal(snapshot.resources.coal, 0); assert.equal(snapshot.resources.nickel_alloy, 1);
    assert.equal(195 - (3 * 28 + 70 + 2 * 4) - 10, 23);
    const stored = await one('select config_version,recipe_snapshot,research_speed_percent from public.dc_production_jobs where id=$1', [result.job.id]);
    assert.equal(stored.config_version, 4); assert.deepEqual(stored.recipe_snapshot, canonical.recipes[0]); assert.equal(stored.research_speed_percent, 15);
    assert.equal(snapshot.business.stats.collected_processed_units, 1);
    const after = economic(snapshot); await rpc(A, 'dc_collect_production', { p_job_id: result.job.id, p_request_id: request() }); assert.deepEqual(economic(await get()), after);
  });

  await check('Phase7 economy: new gear crafting and repairs consume actual alloy, sulfur and credits without free material recovery', async () => {
    let snapshot = await stock(await prepared(), { nickel_alloy: 2, polished_quartz: 2, sulfur: 2 }); const before = snapshot;
    const result = await production(snapshot, 'craft_nickel_heatshield'); snapshot = result.snapshot;
    const shield = snapshot.equipment.find(value => value.definition_key === 'nickel_heatshield'); assert.ok(shield);
    assert.equal(snapshot.company.cash, before.company.cash - 80); assert.equal(snapshot.resources.nickel_alloy, 0); assert.equal(snapshot.resources.polished_quartz, 0); assert.equal(snapshot.resources.sulfur, 0); assert.equal(shield.durability, 180);
    await db.query('update public.dc_equipment set durability=0 where id=$1', [shield.id]); snapshot = await stock(await get(), { nickel_alloy: 1, sulfur: 1 });
    const blocked = economic(snapshot); await assert.rejects(revised(snapshot, 'dc_repair_equipment', { p_item_id: shield.id }), domainFailure(/material|repair/i)); assert.deepEqual(economic(await get()), blocked);
    snapshot = await stock(snapshot, { nickel_alloy: 1, sulfur: 2 }); const cash = snapshot.company.cash;
    snapshot = await revised(snapshot, 'dc_repair_equipment', { p_item_id: shield.id }); assert.equal(snapshot.company.cash, cash - 90); assert.equal(snapshot.resources.nickel_alloy, 0); assert.equal(snapshot.resources.sulfur, 0); assert.equal(snapshot.equipment.find(value => value.id === shield.id).durability, 180);
    const after = economic(snapshot); await assert.rejects(revised(snapshot, 'dc_repair_equipment', { p_item_id: shield.id }), domainFailure(/full|repair|condition/i)); assert.deepEqual(economic(await get()), after);
  });

  await check('Phase7 prerequisite and reserve gates: entry and new industry cannot be bought around existing research', async () => {
    let snapshot = await prepared({ omitted: ['deep_operations_2'], shaft6: false }); const before = economic(snapshot);
    await assert.rejects(upgrade(A, snapshot, 'mine_shaft'), domainFailure(/research|Deep Cutting/i)); assert.deepEqual(economic(await get()), before);
    snapshot = await stock(snapshot, { nickel_ore: 3, iron_bar: 1, coal: 2 }); const stocked = economic(snapshot);
    await assert.rejects(revised(snapshot, 'dc_start_production', { p_recipe_key: 'smelt_nickel_alloy', p_batches: 1 }), domainFailure(/research/i)); assert.deepEqual(economic(await get()), stocked);
    const peer = await prepared({ omitted: ['safety_2'], user: B });
    await db.query("update public.dc_inventory set quantity=case resource_key when 'nickel_alloy' then 2 when 'polished_quartz' then 2 when 'sulfur' then 2 else 0 end where company_id=$1", [peer.company.id]);
    const peerBefore = await get(B);
    await assert.rejects(rpc(B, 'dc_start_production', { p_recipe_key: 'craft_nickel_heatshield', p_batches: 1, p_expected_revision: peerBefore.revision, p_request_id: request() }), domainFailure(/research/i)); assert.deepEqual(economic(await get(B)), economic(peerBefore));
  });

  await check('Phase7 shaft investment: exact24000 cost retains two operating credits and the frozen research prerequisite', async () => {
    let snapshot = await prepared({ shaft6: false }); const company = snapshot.company.id;
    await db.query('update public.dc_companies set cash=24001 where id=$1', [company]); snapshot = await get(); const before = economic(snapshot);
    await assert.rejects(upgrade(A, snapshot, 'mine_shaft'), domainFailure(/operating|\$2|reserve/i)); assert.deepEqual(economic(await get()), before);
    await db.query('update public.dc_companies set cash=24002 where id=$1', [company]); snapshot = await get();
    snapshot = await upgrade(A, snapshot, 'mine_shaft'); assert.equal(snapshot.company.cash, 2); assert.equal(snapshot.world.max_depth, 999);
    assert.equal(snapshot.world.tiles.find(value => value.x === 48 && value.y === 956).remaining, 0);
    assert.equal(snapshot.deep_operations.infrastructure_capacity, 192); assert.equal(snapshot.deep_operations.lift_discount_percent, 75);
  });

  await check('Phase7 infrastructure:128 old-cap records survive shaft6 and192 includes actual building reservations', async () => {
    let snapshot = await prepared({ shaft6: false }); const worker = snapshot.workers[0].id;
    snapshot = await install(snapshot, 'supports', 48, 1, 20, worker);
    const source = await one('select * from public.dc_infrastructure where company_id=$1', [snapshot.company.id]);
    await historicalInfrastructure(source, 127); snapshot = await get(); assert.equal(snapshot.infrastructure.length, 128);
    assert.equal(snapshot.deep_operations.infrastructure_capacity, 128); const capped = economic(snapshot);
    await assert.rejects(dispatchOperation(A, snapshot, { workers: [worker], mode: 'infrastructure', x: 48, y: 2, infrastructure: 'supports', duration: 20 }), domainFailure(/limit|capacity/i)); assert.deepEqual(economic(await get()), capped);
    snapshot = await upgrade(A, snapshot, 'mine_shaft'); assert.equal(snapshot.infrastructure.length, 128); assert.equal(snapshot.deep_operations.infrastructure_capacity, 192);
    snapshot = await install(snapshot, 'supports', 48, 600, 60, worker); assert.equal(snapshot.infrastructure.length, 129);
    await historicalInfrastructure(source, 62, 127); snapshot = await stock(await get(), { stone: 40, clay: 12 }); assert.equal(snapshot.infrastructure.length, 191);
    snapshot = await dispatchOperation(A, snapshot, { workers: [worker], mode: 'infrastructure', x: 48, y: 601, infrastructure: 'supports', duration: 60 });
    assert.equal(snapshot.infrastructure.length, 192); assert.equal(snapshot.infrastructure.filter(value => value.status === 'building').length, 1);
    const before = economic(snapshot);
    await assert.rejects(dispatchOperation(A, snapshot, { workers: [snapshot.workers[1].id], mode: 'infrastructure', x: 48, y: 602, infrastructure: 'supports', duration: 60 }), domainFailure(/limit|capacity/i));
    assert.deepEqual(economic(await get()), before); assert.equal(snapshot.field_catalog.caps.infrastructure, 128, 'Original field catalog is immutable; schema5 supplies the actual expanded cap');
  });

  await check('Phase7 valuation: original prices remain fixed and nickel/sulfur never use client or processed-goods prices', async () => {
    const old = { stone: 1, clay: 2, coal: 4, copper_ore: 8, tin_ore: 10, iron_ore: 14, quartz: 12, silver_ore: 30, amethyst: 50, gold_ore: 45 };
    for (const [key, price] of Object.entries(old)) assert.equal((await one('select public.dc_mining_value_v5($1::jsonb) value', [JSON.stringify({ [key]: 3 })])).value, 3 * price);
    assert.equal((await one('select public.dc_mining_value_v5($1::jsonb) value', [JSON.stringify({ nickel_ore: 3, sulfur: 2, nickel_alloy: 1, invented_ore: 100000 })])).value, 96);
    const snapshot = await prepared(); assert.deepEqual(snapshot.deep_catalog, canonical);
    assert.equal(snapshot.field_catalog.version, 3); assert.equal(snapshot.business_catalog.version, 4);
    assert.equal(snapshot.business_catalog.research.length, 14); assert.equal(snapshot.business_catalog.contracts.length, 12); assert.equal(snapshot.business_catalog.milestones.length, 8);
  });
}
