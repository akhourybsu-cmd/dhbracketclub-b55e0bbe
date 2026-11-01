// Real-SQL underground-operation invariants, called by the isolated main suite.
// Owner setups below never connect to or fabricate records in production.
import assert from 'node:assert/strict';

export async function runPhase3ExtraTests(h) {
  const { check, db, one, A, B, request, bootstrap, get, upgrade, collect, sell, fixture, engine,
    previewOperation, dispatchOperation, resolveDiscovery } = h;
  const resources = snapshot => Object.values(snapshot.resources).reduce((sum, quantity) => sum + quantity, 0);
  const economy = snapshot => ({ cash: snapshot.company.cash, resources: snapshot.resources });
  const physical = snapshot => ({ revision: snapshot.revision, company: snapshot.company, resources: snapshot.resources,
    workers: snapshot.workers, world: snapshot.world, expeditions: snapshot.expeditions, infrastructure: snapshot.infrastructure, discoveries: snapshot.discoveries });
  const newJob = (before, after) => after.expeditions.find(job => !before.expeditions.some(old => old.id === job.id));
  const stageSeconds = stage => (Date.parse(stage.ends_at) - Date.parse(stage.starts_at)) / 1000;
  const conditions = value => ({ ...value, infrastructure_ids: [...value.infrastructure_ids].sort() });
  async function funded(depth = 0, user = A) {
    let snapshot = await bootstrap(user);
    await db.query('update public.dc_companies set cash=100000,warehouse_level=3 where id=$1', [snapshot.company.id]);
    await db.query('update public.dc_inventory set quantity=0 where company_id=$1', [snapshot.company.id]);
    for (const [key, quantity] of Object.entries({ stone: 160, clay: 80, coal: 40, copper_bar: 30, iron_bar: 30 })) await db.query('update public.dc_inventory set quantity=$3 where company_id=$1 and resource_key=$2', [snapshot.company.id, key, quantity]);
    snapshot = await get(user);
    while (snapshot.world.max_depth < depth || !snapshot.world.tiles.some(tile => tile.x === 48 && tile.y === depth)) {
      if (!depth) break;
      snapshot = await upgrade(user, snapshot, 'mine_shaft');
    }
    return snapshot;
  }
  async function knownDeposit(snapshot, x, y, amount = 500, user = A) {
    await db.query("insert into public.dc_tiles(company_id,x,y,material,initial_amount,remaining) values($1,$2,$3,'coal',$4,$4) on conflict(company_id,x,y) do update set material=excluded.material,initial_amount=excluded.initial_amount,remaining=excluded.remaining", [snapshot.company.id, x, y, amount]);
    return get(user);
  }
  async function complete(snapshot, id, user = A) {
    const job = snapshot.expeditions.find(job => job.id === id); assert.ok(job);
    await fixture.advanceJob(user, id, job.duration_seconds + 2);
    return get(user);
  }
  async function install(snapshot, { x = 48, y = 20, key = 'supports', duration, worker = snapshot.workers[0].id } = {}) {
    const before = snapshot;
    snapshot = await dispatchOperation(A, snapshot, { mode: 'infrastructure', x, y, infrastructure: key, duration: duration ?? (y >= 100 ? 60 : 20), workers: [worker] });
    const job = newJob(before, snapshot); assert.ok(job);
    return complete(snapshot, job.id);
  }
  async function recoveredFind() {
    let snapshot = await bootstrap();
    const before = snapshot;
    snapshot = await dispatchOperation(A, snapshot, { mode: 'extract', x: 47, y: 3, workers: [snapshot.workers.find(worker => worker.specialty === 'miner').id] });
    const job = newJob(before, snapshot); assert.ok(job);
    snapshot = await complete(snapshot, job.id);
    const find = snapshot.discoveries.find(find => find.job_id === job.id && find.x === 47 && find.y === 3);
    assert.ok(find, 'Fully mining the untouched starter quartz under v3 must recover the finite first geode');
    assert.equal(find.kind, 'banded_geode'); assert.equal(find.status, 'pending');
    return { snapshot, find, job };
  }
  async function historicalJob(sourceId) {
    // Boundary-only owner setup. Clone a real, correctly shaped owned ticket
    // into the past without executing it, awarding cargo or changing workers.
    const id = request();
    await db.query(`insert into public.dc_expeditions select (jsonb_populate_record(null::public.dc_expeditions,to_jsonb(e)||jsonb_build_object(
      'id',$2::uuid,'status','collected','cargo','{}'::jsonb,'collected_at',clock_timestamp(),
      'started_at',e.started_at-(e.duration_seconds+10)*interval '1 second','completes_at',e.completes_at-(e.duration_seconds+10)*interval '1 second',
      'stages',(select jsonb_agg(value||jsonb_build_object('starts_at',(value->>'starts_at')::timestamptz-(e.duration_seconds+10)*interval '1 second','ends_at',(value->>'ends_at')::timestamptz-(e.duration_seconds+10)*interval '1 second') order by ordinality) from jsonb_array_elements(e.stages) with ordinality)
    ))).* from public.dc_expeditions e where e.id=$1`, [sourceId, id]);
    await db.query('insert into public.dc_expedition_workers select $2,worker_id from public.dc_expedition_workers where job_id=$1', [sourceId, id]);
    await db.query('insert into public.dc_plans select $2,content from public.dc_plans where job_id=$1', [sourceId, id]);
    return id;
  }
  async function seedPendingFinds(source, count) {
    // Construct only the staging boundary; separate groups prove actual mining
    // eligibility. Keep at most eight finds per correctly shaped owned ticket.
    const jobs = [source.job_id];
    while (jobs.length < Math.ceil(count / 8)) jobs.push(await historicalJob(source.job_id));
    for (let index = 1; index < count; index++) {
      const id = request(), x = index % 45, y = 10 + Math.floor(index / 45), job = jobs[Math.floor(index / 8)];
      await db.query(`insert into public.dc_discoveries select (jsonb_populate_record(null::public.dc_discoveries,
        to_jsonb(d)||jsonb_build_object('id',$2::uuid,'job_id',$3::uuid,'x',$4::integer,'y',$5::integer))).*
        from public.dc_discoveries d where d.id=$1`, [source.id, id, job, x, y]);
    }
  }
  async function entropySeed(chance, hit) {
    const row = await one(`select seed from (select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid seed from generate_series(1,10000)i)s where public.dc_incident_roll_v3(seed,$1)=$2 limit 1`, [chance, hit]);
    assert.ok(row?.seed); return row.seed;
  }
  async function withEntropy(seed, run) {
    const original = await one("select pg_get_functiondef(p.oid) definition,md5(p.prosrc) body_hash,p.prosecdef,p.proconfig,p.proacl::text acl from pg_proc p where p.oid='public.dc_server_entropy_v3()'::regprocedure");
    assert.match(seed, /^[a-f\d-]{36}$/i);
    await db.exec(`create or replace function public.dc_server_entropy_v3() returns uuid language sql volatile security definer set search_path=public,pg_temp as $$select '${seed}'::uuid$$`);
    try { return await run(); }
    finally {
      await db.exec(original.definition);
      const restored = await one("select pg_get_functiondef(p.oid) definition,md5(p.prosrc) body_hash,p.prosecdef,p.proconfig,p.proacl::text acl from pg_proc p where p.oid='public.dc_server_entropy_v3()'::regprocedure");
      assert.deepEqual(restored, original, 'Only the isolated private entropy boundary may be temporarily replaced; its body and ACL must be restored');
    }
  }

  await check('Phase3 infrastructure: grade costs and crew energy are exact, installation waits for return and has no empty haul', async () => {
    let snapshot = await funded(20);
    const worker = snapshot.workers[0], before = snapshot;
    const quote = await previewOperation(A, snapshot, { mode: 'infrastructure', x: 48, y: 20, infrastructure: 'supports', duration: 60, workers: [worker.id] });
    assert.equal(quote.allowed, true);
    const expected = engine.infrastructureQuote('supports', 60, worker.stats.engineering);
    assert.deepEqual(quote.installation, expected.installation); assert.equal(quote.operation_cost, expected.cash_cost); assert.deepEqual(quote.materials_cost, expected.materials);
    snapshot = await dispatchOperation(A, snapshot, { mode: 'infrastructure', x: 48, y: 20, infrastructure: 'supports', duration: 60, workers: [worker.id] });
    const job = newJob(before, snapshot), structure = snapshot.infrastructure.find(record => record.job_id === job.id);
    assert.ok(structure); assert.equal(structure.status, 'building'); assert.equal(structure.installed_at, null);
    assert.equal(snapshot.company.cash, before.company.cash - quote.wages - quote.operation_cost);
    assert.equal(snapshot.workers.find(person => person.id === worker.id).energy, worker.energy - 2);
    for (const [key, quantity] of Object.entries(quote.materials_cost)) assert.equal(snapshot.resources[key], before.resources[key] - quantity);
    snapshot = await complete(snapshot, job.id);
    assert.equal(snapshot.infrastructure.find(record => record.id === structure.id).status, 'installed');
    const completed = snapshot.expeditions.find(record => record.id === job.id);
    assert.equal(completed.status, 'collected'); assert.deepEqual(completed.cargo, {});
    assert.ok(snapshot.field_reports.some(report => report.kind === 'infrastructure' && report.infrastructure_id === structure.id));
    assert.equal(snapshot.discoveries.length, 0);
  });

  await check('Phase3 infrastructure: missing inputs, unknown sites and unsupported keys cannot charge or reserve a project', async () => {
    let snapshot = await funded(20);
    await db.query("update public.dc_inventory set quantity=0 where company_id=$1 and resource_key='clay'", [snapshot.company.id]); snapshot = await get();
    const before = physical(snapshot);
    await assert.rejects(dispatchOperation(A, snapshot, { mode: 'infrastructure', x: 48, y: 20, infrastructure: 'supports' }));
    assert.deepEqual(physical(await get()), before);
    for (const options of [{ x: 0, y: 20, infrastructure: 'rail' }, { x: 48, y: 20, infrastructure: 'not_a_project' }, { x: 48, y: 20, infrastructure: null }]) await assert.rejects(dispatchOperation(A, snapshot, { mode: 'infrastructure', ...options }));
    assert.deepEqual(physical(await get()), before);
    assert.equal((await one('select count(*)::integer count from public.dc_infrastructure where company_id=$1', [snapshot.company.id])).count, 0);
  });

  await check('Phase3 infrastructure: failed receipt rolls back project, crew assignment, materials and wages', async () => {
    let snapshot = await funded(20); const before = physical(snapshot), receipt = request();
    await db.exec("create function public.dc_test_field_receipt_failure() returns trigger language plpgsql as $$begin raise exception 'Injected field receipt failure';end$$;create trigger dc_test_field_receipt_failure after insert on public.dc_requests for each row execute function public.dc_test_field_receipt_failure()");
    try { await assert.rejects(dispatchOperation(A, snapshot, { mode: 'infrastructure', x: 48, y: 20, infrastructure: 'rail' }, receipt), /Injected field receipt failure/); }
    finally { await db.exec('drop trigger dc_test_field_receipt_failure on public.dc_requests;drop function public.dc_test_field_receipt_failure()'); }
    assert.deepEqual(physical(await get()), before);
    assert.equal((await one('select count(*)::integer count from public.dc_requests where request_id=$1', [receipt])).count, 0);
    snapshot = await dispatchOperation(A, snapshot, { mode: 'infrastructure', x: 48, y: 20, infrastructure: 'rail' }, receipt);
    assert.equal(snapshot.infrastructure.length, 1);
  });

  await check('Phase3 infrastructure: one project per cell includes building reservations and different project types', async () => {
    let snapshot = await funded(20); snapshot = await upgrade(A, snapshot, 'mine_office');
    const before = snapshot;
    snapshot = await dispatchOperation(A, snapshot, { mode: 'infrastructure', x: 48, y: 20, infrastructure: 'supports', workers: [snapshot.workers[0].id] });
    const job = newJob(before, snapshot), paid = economy(snapshot);
    for (const key of ['supports', 'pump']) await assert.rejects(dispatchOperation(A, snapshot, { mode: 'infrastructure', x: 48, y: 20, infrastructure: key, workers: [snapshot.workers[1].id] }));
    assert.deepEqual(economy(await get()), paid); assert.equal((await get()).infrastructure.length, 1);
    snapshot = await complete(snapshot, job.id);
    await assert.rejects(dispatchOperation(A, snapshot, { mode: 'infrastructure', x: 48, y: 20, infrastructure: 'ventilation', workers: [snapshot.workers[1].id] }));
    assert.equal((await get()).infrastructure.length, 1);
  });

  await check('Phase3 infrastructure: installed strongest-only protection matches public engine arithmetic', async () => {
    let snapshot = await funded(120); snapshot = await knownDeposit(snapshot, 47, 120);
    const worker = snapshot.workers[1].id;
    const options = { mode: 'extract', x: 47, y: 120, duration: 60, workers: [worker] };
    const original = await previewOperation(A, snapshot, options); assert.ok(original.conditions.incident_chance_percent > 0);
    const hauler = snapshot.workers.find(person => person.specialty === 'hauler').id;
    snapshot = await install(snapshot, { y: 118, duration: 20, worker: hauler });
    const first = await previewOperation(A, snapshot, options);
    assert.ok(first.conditions.incident_chance_percent < original.conditions.incident_chance_percent);
    snapshot = await install(snapshot, { y: 117, duration: 20, worker: hauler });
    const second = await previewOperation(A, snapshot, options);
    assert.equal(second.conditions.incident_chance_percent, first.conditions.incident_chance_percent, 'Identical overlapping support strength must not stack');
    snapshot = await install(snapshot, { y: 119, duration: 60, worker: hauler });
    const stronger = await previewOperation(A, snapshot, options), person = snapshot.workers.find(person => person.id === worker);
    assert.ok(stronger.conditions.incident_chance_percent <= second.conditions.incident_chance_percent);
    assert.deepEqual(conditions(stronger.conditions), conditions(engine.fieldConditions({ depth: 120, safety: person.stats.safety, energy: 2, target: { x: 47, y: 120 }, route: stronger.route, infrastructure: snapshot.infrastructure })));
    assert.equal(new Set(stronger.conditions.infrastructure_ids).size, stronger.conditions.infrastructure_ids.length);
  });

  await check('Phase3 rail: route-weighted coverage unions tracks without stacking and leaves active plans frozen', async () => {
    let snapshot = await funded(80); snapshot = await upgrade(A, snapshot, 'mine_office');
    snapshot = await knownDeposit(snapshot, 47, 80); snapshot = await knownDeposit(snapshot, 49, 80);
    const first = snapshot.workers[0].id, second = snapshot.workers[1].id, hauler = snapshot.workers[2].id;
    const options = { mode: 'extract', x: 49, y: 80, workers: [first] };
    const plain = await previewOperation(A, snapshot, options); assert.equal(plain.conditions.transport_bonus_percent, 0);
    snapshot = await install(snapshot, { key: 'rail', y: 1, worker: first });
    const entrance = await previewOperation(A, snapshot, options), firstRail = snapshot.infrastructure.find(record => record.key === 'rail');
    assert.ok(entrance.conditions.transport_bonus_percent < firstRail.strength, 'A short entrance track cannot provide its full strength to a deep route');
    const beforeMining = snapshot;
    snapshot = await dispatchOperation(A, snapshot, { mode: 'extract', x: 47, y: 80, workers: [hauler] });
    const job = newJob(beforeMining, snapshot), frozen = (await one('select content from public.dc_plans where job_id=$1', [job.id])).content;
    for (const [index, y] of [2, 14, 27, 40, 53, 66, 79].entries()) snapshot = await install(snapshot, { key: 'rail', y, worker: index % 2 ? first : second });
    const connected = await previewOperation(A, snapshot, options), person = snapshot.workers.find(person => person.id === first);
    const expected = engine.fieldConditions({ depth: 80, safety: person.stats.safety, energy: 1, target: { x: 49, y: 80 }, route: connected.route, infrastructure: snapshot.infrastructure });
    assert.deepEqual(conditions(connected.conditions), conditions(expected));
    assert.ok(connected.conditions.transport_bonus_percent > entrance.conditions.transport_bonus_percent);
    assert.ok(connected.conditions.transport_bonus_percent <= Math.max(...snapshot.infrastructure.map(record => record.strength)));
    assert.deepEqual((await one('select content from public.dc_plans where job_id=$1', [job.id])).content, frozen);
    const sameJob = snapshot.expeditions.find(record => record.id === job.id);
    assert.deepEqual(sameJob.stages, job.stages); assert.equal(sameJob.duration_seconds, job.duration_seconds);
  });

  await check('Phase3 incidents: private entropy drives delay-only timing, exact retry cannot reroll or reveal future events', async () => {
    let snapshot = await funded(120); snapshot = await knownDeposit(snapshot, 47, 120);
    snapshot = await h.rpc(A, 'dc_start_production', { p_recipe_key: 'craft_copper_pickaxe', p_batches: 1, p_expected_revision: snapshot.revision, p_request_id: request() });
    const crafting = snapshot.production_jobs.find(job => job.status === 'active');
    await fixture.advanceProduction(A, crafting.id, crafting.duration_seconds + 1);
    snapshot = await get(); snapshot = await h.rpc(A, 'dc_collect_production', { p_job_id: crafting.id, p_request_id: request() });
    const worker = snapshot.workers[0].id, gear = snapshot.equipment.find(item => item.definition_key === 'copper_pickaxe'); assert.ok(gear);
    snapshot = await h.rpc(A, 'dc_assign_equipment', { p_item_id: gear.id, p_worker_id: worker, p_expected_revision: snapshot.revision, p_request_id: request() });
    const options = { mode: 'extract', x: 47, y: 120, duration: 60, workers: [worker] };
    const quote = await previewOperation(A, snapshot, options), chance = quote.conditions.incident_chance_percent;
    assert.ok(chance > 0 && chance <= 25); assert.ok(quote.conditions.max_delay_seconds > 0 && quote.conditions.max_delay_seconds <= 300);
    const seed = await entropySeed(chance, true), receipt = request(), before = snapshot;
    snapshot = await withEntropy(seed, () => dispatchOperation(A, before, options, receipt));
    const job = newJob(before, snapshot); assert.ok(job);
    assert.equal(job.duration_seconds, quote.duration_seconds + quote.conditions.max_delay_seconds);
    assert.equal(job.duration_minutes, 60); assert.equal(job.energy_per_worker, 2);
    for (const stage of job.stages) assert.equal(stageSeconds(stage), quote.stages.find(record => record.key === stage.key).duration_seconds + (stage.key === 'setup' ? quote.conditions.max_delay_seconds : 0));
    assert.equal(snapshot.field_reports.some(report => report.kind === 'incident' && report.job_id === job.id), false);
    assert.equal(JSON.stringify(snapshot).includes(seed), false);
    const records = (await db.query('select to_jsonb(e) value from public.dc_field_events e where job_id=$1 order by id', [job.id])).rows;
    const retry = await dispatchOperation(A, before, options, receipt);
    assert.equal(retry.expeditions.find(record => record.id === job.id).duration_seconds, job.duration_seconds);
    assert.deepEqual((await db.query('select to_jsonb(e) value from public.dc_field_events e where job_id=$1 order by id', [job.id])).rows, records);
    const elapsed = Math.ceil((Date.parse(job.stages.find(stage => stage.key === 'setup').ends_at) - Date.parse(job.started_at)) / 1000);
    await fixture.advanceJob(A, job.id, elapsed - 5); snapshot = await get();
    assert.equal(snapshot.field_reports.some(report => report.kind === 'incident' && report.job_id === job.id), false);
    await fixture.advanceJob(A, job.id, 6); snapshot = await get();
    const report = snapshot.field_reports.find(report => report.kind === 'incident' && report.job_id === job.id);
    assert.ok(report); assert.equal(report.delay_seconds, quote.conditions.max_delay_seconds);
    assert.equal(JSON.stringify(snapshot).includes(seed), false);
    const planned = (await one('select content from public.dc_plans where job_id=$1', [job.id])).content;
    const baseline = engine.calculateCrewPlan({ workers: before.workers.filter(person => person.id === worker), mode: 'extract', duration_minutes: 60,
      path_edges: quote.route.length - 1, target_depth: 120, tool_level: before.buildings.find(building => building.key === 'tool_station').level, material: 'coal', remaining: 500 });
    assert.equal(planned.cargo.coal, baseline.quantity, 'Delay extends the clock without changing baseline finite extraction');
    snapshot = await complete(snapshot, job.id);
    assert.deepEqual(snapshot.expeditions.find(record => record.id === job.id).cargo, planned.cargo);
    assert.deepEqual(snapshot.world.tiles.find(tile => tile.x === 47 && tile.y === 120).remaining, 500 - planned.cargo.coal);
    assert.equal(snapshot.equipment.find(item => item.id === gear.id).durability, gear.max_durability - 2 * job.energy_per_worker, 'An incident must not add wear beyond the frozen energy cost');
    const repeatAfterCompletion = await dispatchOperation(A, before, options, receipt);
    assert.equal(repeatAfterCompletion.equipment.find(item => item.id === gear.id).durability, gear.max_durability - 2 * job.energy_per_worker);
  });

  await check('Phase3 incidents: shallow and tutorial jobs keep zero chance and their exact original duration', async () => {
    let snapshot = await bootstrap();
    const options = { mode: 'extract', x: 47, y: 1, duration: 20, tutorial: true, workers: [snapshot.workers[0].id] };
    const quote = await previewOperation(A, snapshot, options);
    assert.equal(quote.conditions.incident_chance_percent, 0); assert.equal(quote.conditions.max_delay_seconds, 0);
    const seed = await entropySeed(25, true), before = snapshot;
    snapshot = await withEntropy(seed, () => dispatchOperation(A, before, options));
    const job = newJob(before, snapshot); assert.equal(job.duration_seconds, 30);
    snapshot = await complete(snapshot, job.id);
    assert.equal(snapshot.field_reports.some(report => report.kind === 'incident' && report.job_id === job.id), false);
    assert.deepEqual(snapshot.expeditions.find(record => record.id === job.id).cargo, { coal: 10, stone: 12 });
  });

  await check('Phase3 discoveries: a fully mined specimen stays private until crew return and never rerolls on reload', async () => {
    let snapshot = await bootstrap(); const before = snapshot;
    snapshot = await dispatchOperation(A, snapshot, { mode: 'extract', x: 47, y: 3, workers: [snapshot.workers[0].id] });
    const job = newJob(before, snapshot); assert.equal(snapshot.discoveries.length, 0);
    const workEnd = Math.ceil((Date.parse(job.stages.find(stage => stage.key === 'work').ends_at) - Date.parse(job.started_at)) / 1000);
    await fixture.advanceJob(A, job.id, workEnd + 1); snapshot = await get();
    assert.equal(snapshot.world.tiles.find(tile => tile.x === 47 && tile.y === 3).remaining, 0);
    assert.equal(snapshot.discoveries.length, 0);
    assert.equal(snapshot.field_reports.some(report => report.kind === 'discovery' && report.job_id === job.id), false);
    snapshot = await complete(snapshot, job.id);
    const find = snapshot.discoveries.find(find => find.x === 47 && find.y === 3); assert.ok(find);
    assert.ok(find.sale_value >= 15 && find.sale_value <= 500);
    assert.deepEqual(engine.discoverySpecimen(find.kind, find.quality), { name: find.name, detail: find.detail, sale_value: find.sale_value, salvage: find.salvage, mass_grams: engine.discoverySpecimen(find.kind, find.quality).mass_grams });
    const repeat = await get(); assert.deepEqual(repeat.discoveries.find(record => record.id === find.id), find);
    assert.equal(repeat.discoveries.filter(record => record.x === 47 && record.y === 3).length, 1);
  });

  await check('Phase3 discoveries: all six specimen definitions and four qualities match actual SQL formatting and bounds', async () => {
    const snapshot = await bootstrap(), catalog = snapshot.field_catalog;
    const original = await one("select pg_get_functiondef(p.oid) definition,md5(p.prosrc) body_hash,p.prosecdef,p.proconfig,p.proacl::text acl from pg_proc p where p.oid='public.dc_hash_v3(uuid,text,integer,integer)'::regprocedure");
    let compared = 0;
    try {
      for (const [kindIndex, definition] of catalog.discoveries.entries()) {
        let qualityStart = 0;
        for (const quality of catalog.qualities) {
          // Owner-only deterministic namespace inputs exercise the real SQL
          // specimen selector/formatter without rolling paid public jobs.
          await db.exec(`create or replace function public.dc_hash_v3(p_company uuid,p_namespace text,p_x integer,p_y integer) returns bigint language sql stable security definer set search_path=public,pg_temp as $$select case p_namespace when 'find_chance' then 0 when 'find_kind' then ${kindIndex} when 'find_quality' then ${qualityStart} else 0 end::bigint$$`);
          const specimen = (await one('select public.dc_specimen_v3($1,0,599) value', [snapshot.company.id])).value;
          const expected = engine.discoverySpecimen(definition.key, quality.key);
          assert.deepEqual(specimen, { kind: definition.key, name: expected.name, quality: quality.key, detail: expected.detail, sale_value: expected.sale_value, salvage: expected.salvage });
          assert.ok(specimen.sale_value >= 15 && specimen.sale_value <= 500);
          assert.ok(Object.values(specimen.salvage).every(quantity => Number.isSafeInteger(quantity) && quantity > 0));
          qualityStart += quality.weight; compared++;
        }
      }
    } finally {
      await db.exec(original.definition);
      assert.deepEqual(await one("select pg_get_functiondef(p.oid) definition,md5(p.prosrc) body_hash,p.prosecdef,p.proconfig,p.proacl::text acl from pg_proc p where p.oid='public.dc_hash_v3(uuid,text,integer,integer)'::regprocedure"), original);
    }
    assert.equal(compared, 24);
  });

  await check('Phase3 discoveries: keeping is permanent, nonmonetary and retry-safe without a second decision', async () => {
    const { snapshot: before, find } = await recoveredFind(), receipt = request();
    let snapshot = await resolveDiscovery(A, before, find.id, 'keep', receipt);
    assert.deepEqual(economy(snapshot), economy(before));
    assert.equal(snapshot.discoveries.find(record => record.id === find.id).status, 'kept');
    assert.equal(snapshot.discovery_summary.kept, 1); assert.equal(snapshot.discovery_summary.pending, 0);
    assert.deepEqual(economy(await resolveDiscovery(A, before, find.id, 'keep', receipt)), economy(snapshot));
    await assert.rejects(resolveDiscovery(A, snapshot, find.id, 'sell'));
    snapshot = await get(); assert.equal(snapshot.discovery_summary.kept, 1); assert.deepEqual(economy(snapshot), economy(before));
  });

  await check('Phase3 discoveries: sale uses frozen server value once and foreign IDs cannot be resolved', async () => {
    const { snapshot: before, find } = await recoveredFind(), receipt = request(), other = await bootstrap(B);
    await assert.rejects(resolveDiscovery(B, other, find.id, 'sell'));
    assert.deepEqual(economy(await get(B)), economy(other));
    let snapshot = await resolveDiscovery(A, before, find.id, 'sell', receipt);
    assert.equal(snapshot.company.cash, before.company.cash + find.sale_value); assert.deepEqual(snapshot.resources, before.resources);
    assert.equal(snapshot.discovery_summary.sold, 1); assert.equal(snapshot.discovery_summary.pending, 0);
    assert.deepEqual(economy(await resolveDiscovery(A, before, find.id, 'sell', receipt)), economy(snapshot));
    await assert.rejects(resolveDiscovery(A, snapshot, find.id, 'sell'));
    await assert.rejects(resolveDiscovery(A, before, find.id, 'salvage', receipt));
    snapshot = await get(); assert.equal(snapshot.company.cash, before.company.cash + find.sale_value);
  });

  await check('Phase3 discoveries: salvage rejects full storage atomically, then grants only the frozen materials once', async () => {
    let { snapshot, find } = await recoveredFind();
    await db.query("update public.dc_inventory set quantity=$2 where company_id=$1 and resource_key='stone'", [snapshot.company.id, snapshot.company.warehouse_capacity - 1]); snapshot = await get();
    const full = economy(snapshot), rejected = request();
    await assert.rejects(resolveDiscovery(A, snapshot, find.id, 'salvage', rejected), /space|warehouse|storage|capacity|fit/i);
    assert.deepEqual(economy(await get()), full);
    assert.equal((await get()).discoveries.find(record => record.id === find.id).status, 'pending');
    assert.equal((await one('select count(*)::integer count from public.dc_requests where request_id=$1', [rejected])).count, 0);
    snapshot = await sell(A, snapshot, 'stone', Math.min(20, snapshot.resources.stone));
    const before = snapshot, receipt = request(); snapshot = await resolveDiscovery(A, before, find.id, 'salvage', receipt);
    assert.equal(snapshot.company.cash, before.company.cash);
    for (const [key, quantity] of Object.entries(find.salvage)) assert.equal(snapshot.resources[key], before.resources[key] + quantity);
    assert.equal(snapshot.discovery_summary.salvaged, 1); assert.equal(snapshot.discovery_summary.pending, 0);
    assert.deepEqual(economy(await resolveDiscovery(A, before, find.id, 'salvage', receipt)), economy(snapshot));
    assert.ok(resources(snapshot) <= snapshot.company.warehouse_capacity);
  });

  await check('Phase3 discoveries: failed receipt rolls back payment and resolution, allowing the identical request to recover', async () => {
    const { snapshot: before, find } = await recoveredFind(), receipt = request();
    await db.exec("create function public.dc_test_find_receipt_failure() returns trigger language plpgsql as $$begin raise exception 'Injected discovery receipt failure';end$$;create trigger dc_test_find_receipt_failure after insert on public.dc_requests for each row execute function public.dc_test_find_receipt_failure()");
    try { await assert.rejects(resolveDiscovery(A, before, find.id, 'sell', receipt), /Injected discovery receipt failure/); }
    finally { await db.exec('drop trigger dc_test_find_receipt_failure on public.dc_requests;drop function public.dc_test_find_receipt_failure()'); }
    let snapshot = await get(); assert.deepEqual(economy(snapshot), economy(before));
    assert.equal(snapshot.discoveries.find(record => record.id === find.id).status, 'pending');
    assert.equal((await one('select count(*)::integer count from public.dc_requests where request_id=$1', [receipt])).count, 0);
    snapshot = await resolveDiscovery(A, before, find.id, 'sell', receipt);
    assert.equal(snapshot.company.cash, before.company.cash + find.sale_value); assert.equal(snapshot.discovery_summary.sold, 1);
  });

  await check('Phase3 infrastructure: the 128-record limit includes building reservations and rejects all extra costs', async () => {
    let snapshot = await funded(20); snapshot = await upgrade(A, snapshot, 'mine_office');
    const before = snapshot;
    snapshot = await dispatchOperation(A, snapshot, { mode: 'infrastructure', x: 48, y: 20, infrastructure: 'supports', workers: [snapshot.workers[0].id] });
    const source = snapshot.infrastructure.find(item => item.status === 'building'), job = newJob(before, snapshot); assert.ok(source);
    for (let index = 0; index < 127; index++) {
      const id = request(), jobId = await historicalJob(job.id), x = index % 64, y = 1 + Math.floor(index / 64);
      await db.query(`insert into public.dc_infrastructure select (jsonb_populate_record(null::public.dc_infrastructure,
        to_jsonb(i)||jsonb_build_object('id',$2::uuid,'job_id',$3::uuid,'x',$4::integer,'y',$5::integer,'status','installed','installed_at',clock_timestamp()))).*
        from public.dc_infrastructure i where i.id=$1`, [source.id, id, jobId, x, y]);
    }
    snapshot = await get(); assert.equal(snapshot.infrastructure.length, 128); assert.equal(snapshot.infrastructure.filter(item => item.status === 'building').length, 1);
    const paid = physical(snapshot), receipt = request();
    await assert.rejects(dispatchOperation(A, snapshot, { mode: 'infrastructure', x: 48, y: 21, infrastructure: 'rail', workers: [snapshot.workers[1].id] }, receipt), /128|limit|project|infrastructure/i);
    assert.deepEqual(physical(await get()), paid);
    assert.equal((await one('select count(*)::integer count from public.dc_requests where request_id=$1', [receipt])).count, 0);
  });

  await check('Phase3 discoveries: 24 pending choices stop dispatch and all 48 staged decisions stay visible without loss', async () => {
    let { snapshot, find, job } = await recoveredFind();
    snapshot = await collect(A, job.id);
    await seedPendingFinds(find, 24);
    snapshot = await get(); assert.equal(snapshot.discovery_summary.pending, 24); assert.equal(snapshot.discoveries.filter(item => item.status === 'pending').length, 24);
    const blocked = physical(snapshot);
    await assert.rejects(dispatchOperation(A, snapshot, { mode: 'extract', x: 47, y: 1, workers: [snapshot.workers[0].id] }), /find|discover|review|pending/i);
    assert.deepEqual(physical(await get()), blocked);
    snapshot = await resolveDiscovery(A, snapshot, find.id, 'keep');
    assert.equal(snapshot.discovery_summary.pending, 23);
    const quote = await previewOperation(A, snapshot, { mode: 'extract', x: 47, y: 1, workers: [snapshot.workers[0].id] });
    assert.equal(quote.allowed, true, 'Resolving enough decisions restores normal operations');
    // Add another24 boundary rows across three historical jobs, preserving
    // the already-kept record and all existing pending IDs.
    const pendingBefore = snapshot.discoveries.filter(item => item.status === 'pending').map(item => item.id);
    const source = snapshot.discoveries.find(item => item.status === 'pending');
    for (let group = 0; group < 3; group++) {
      const history = await historicalJob(job.id);
      for (let cell = 0; cell < 8; cell++) {
        const id = request(), x = group * 8 + cell, y = 30;
        await db.query(`insert into public.dc_discoveries select (jsonb_populate_record(null::public.dc_discoveries,
          to_jsonb(d)||jsonb_build_object('id',$2::uuid,'job_id',$3::uuid,'x',$4::integer,'y',$5::integer))).*
          from public.dc_discoveries d where d.id=$1`, [source.id, id, history, x, y]);
      }
    }
    // Return the one retained boundary record to pending through a new row,
    // rather than mutating the immutable kept choice.
    const finalJob = await historicalJob(job.id), finalId = request();
    await db.query(`insert into public.dc_discoveries select (jsonb_populate_record(null::public.dc_discoveries,
      to_jsonb(d)||jsonb_build_object('id',$2::uuid,'job_id',$3::uuid,'x',30,'y',30))).* from public.dc_discoveries d where d.id=$1`, [source.id, finalId, finalJob]);
    snapshot = await get(); assert.equal(snapshot.discovery_summary.pending, 48);
    const pending = snapshot.discoveries.filter(item => item.status === 'pending'); assert.equal(pending.length, 48);
    for (const id of pendingBefore) assert.ok(pending.some(item => item.id === id));
    assert.equal(snapshot.discovery_summary.kept, 1);
    assert.equal((await one("select count(*)::integer count from public.dc_discoveries where company_id=$1 and status='pending'", [snapshot.company.id])).count, 48);
  });
}
