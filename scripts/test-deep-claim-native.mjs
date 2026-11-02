// Real concurrent PostgreSQL 17 checks against a guarded disposable local DB.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createDeepClaimFeatsDatabase } from './fixtures/deep-claim-feats-db.mjs';
import { createDeepClaimNativeDatabase, nativeActorQuery, nativeRpc } from './fixtures/deep-claim-native-db.mjs';
import { buildDeepClaimPhase7Release, DEEP_CLAIM_PHASE7_CRITICAL_PATTERN } from './lib/deep-claim-release.mjs';

const database = await createDeepClaimNativeDatabase({ reset: process.argv.includes('--reset') });
let fixture;
const checks = [], info = database.info;
async function test(label, run) { await run(); checks.push(label); console.log(`PASS native ${label}`); }
const call = (user, name, args = {}) => nativeRpc(database, user, name, args);
const row = async (sql, args = []) => (await database.query(sql, args)).rows[0];
const expansionPath = 'supabase/migrations/20261102070000_deep_claim_ancient_deep.sql';
async function criticalBodies(db = database) {
  const result = await db.query("select p.oid::regprocedure::text signature,md5(p.prosrc) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ $1 order by signature", [DEEP_CLAIM_PHASE7_CRITICAL_PATTERN]);
  return Object.fromEntries(result.rows.map(item => [item.signature, item.body]));
}
async function successfulTogether(promises) {
  const settled = await Promise.allSettled(promises);
  assert.ok(settled.every(result => result.status === 'fulfilled'), settled.map(result => result.status === 'rejected' ? result.reason.message : 'ok').join(' | '));
  return settled.map(result => result.value);
}
async function availableWork(user, tutorial = false) {
  const state = await call(user, 'dc_get');
  const worker = state.workers.find(item => !item.assigned_job_id && item.energy >= 1);
  assert.ok(worker, 'A real available worker is required');
  for (const tile of state.world.tiles.filter(item => item.remaining > 0).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const input = { p_worker_ids: [worker.id], p_mode: 'extract', p_target_x: tile.x, p_target_y: tile.y, p_duration_minutes: 20, p_tutorial: tutorial, p_infrastructure_key: null };
    const quote = await call(user, 'dc_preview_operation', input);
    if (quote.allowed) return { state, quote, input };
  }
  throw new Error('The native fixture has no legal finite worksite');
}
async function dispatch(user, tutorial = false) {
  const { quote, input } = await availableWork(user, tutorial), request = randomUUID();
  const args = { ...input, p_expected_revision: quote.company_revision, p_request_id: request };
  const responses = await successfulTogether([call(user, 'dc_dispatch_operation', args), call(user, 'dc_dispatch_operation', args)]);
  const jobs = responses.map(state => state.expeditions.find(job => job.status === 'active'));
  assert.ok(jobs[0]); assert.equal(jobs[0].id, jobs[1].id);
  assert.equal((await row('select count(*)::integer n from public.dc_requests where request_id=$1', [request])).n, 1);
  return { job: jobs[0], state: responses.at(-1), request };
}
async function captureCompany(user) {
  const company = await row('select id from public.dc_companies where user_id=$1', [user]);
  const result = {};
  for (const table of ['dc_workers', 'dc_worlds', 'dc_chunks', 'dc_tiles', 'dc_expeditions', 'dc_plans', 'dc_inventory', 'dc_logs']) {
    const value = table === 'dc_expeditions' ? "to_jsonb(t)-'deep_modifiers'" : 'to_jsonb(t)';
    const owned = table === 'dc_plans' ? 'job_id in(select id from public.dc_expeditions where company_id=$1)' : 'company_id=$1';
    result[table] = (await row(`select coalesce(jsonb_agg(${value} order by ${value}::text),'[]') value from public.${table} t where ${owned}`, [company.id])).value;
  }
  result.company = (await row("select to_jsonb(c)-'revision'-'updated_at' value from public.dc_companies c where id=$1", [company.id])).value;
  return result;
}

try {
  fixture = await createDeepClaimFeatsDatabase({ phase: 5, integration: true, database });
  const alice = fixture.id(1), bob = fixture.id(2), outsider = fixture.id(4);
  await test('distinct native backend sessions overlap', async () => {
    const results = await successfulTogether([nativeActorQuery(database, alice, 'select pg_backend_pid() pid,pg_sleep(.08)'), nativeActorQuery(database, bob, 'select pg_backend_pid() pid,pg_sleep(.08)')]);
    assert.notEqual(results[0].rows[0].pid, results[1].rows[0].pid);
  });
  let aliceState;
  await test('concurrent exact bootstrap creates one company and workforce', async () => {
    const request = randomUUID(), args = { p_name: 'Native Claim A', p_request_id: request };
    const states = await successfulTogether([call(alice, 'dc_bootstrap', args), call(alice, 'dc_bootstrap', args)]);
    assert.equal(states[0].company.id, states[1].company.id); assert.equal(states[0].workers.length, 3);
    assert.equal((await row('select count(*)::integer n from public.dc_companies where user_id=$1', [alice])).n, 1);
    assert.equal((await row('select count(*)::integer n from public.dc_requests where request_id=$1', [request])).n, 1);
    aliceState = states[0]; assert.equal(aliceState.schema_version, 4);
  });
  let old;
  await test('concurrent old dispatch charges one wage and energy reservation', async () => {
    old = await dispatch(alice); assert.equal(old.job.config_version, 3);
    assert.equal(old.state.company.cash, aliceState.company.cash - old.job.wages);
    assert.equal(old.state.workers.filter(worker => worker.assigned_job_id === old.job.id).length, 1);
  });
  let baselineBodies, expectedBodies, releaseSQL, releaseArgs;
  await test('native rollback derives a complete post-migration proof without changing old state', async () => {
    const before = await captureCompany(alice), revision = (await row('select revision from public.dc_companies where user_id=$1', [alice])).revision;
    baselineBodies = await criticalBodies(); assert.equal(Object.keys(baselineBodies).length, 133);
    const source = await readFile(expansionPath, 'utf8'), rollback = new Error('Expected native DDL rollback probe');
    await assert.rejects(database.transaction(async transaction => {
      await transaction.exec(source); expectedBodies = await criticalBodies(transaction);
      assert.equal(Object.keys(expectedBodies).length, 153); throw rollback;
    }), error => error === rollback);
    assert.deepEqual(await criticalBodies(), baselineBodies); assert.deepEqual(await captureCompany(alice), before);
    assert.equal((await row('select revision from public.dc_companies where user_id=$1', [alice])).revision, revision);
    await database.exec('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])');
    const priorMigrations = [];
    for (const file of (await readdir('supabase/migrations')).filter(file => /^20261102\d+_deep_claim.*\.sql$/.test(file) && file.slice(0, 14) < '20261102070000').sort()) {
      const text = await readFile(`supabase/migrations/${file}`, 'utf8'), version = file.slice(0, 14), name = file.slice(15, -4);
      await database.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,array[$3::text])', [version, name, text]);
      priorMigrations.push({ version, name, md5: createHash('md5').update(text).digest('hex') });
    }
    releaseArgs = { source, baselineBodies, expectedBodies, priorMigrations };
    releaseSQL = buildDeepClaimPhase7Release(releaseArgs);
    const wrong = buildDeepClaimPhase7Release({ source, baselineBodies, expectedBodies: { ...expectedBodies, 'dc_resources_v1()': '0'.repeat(32) }, priorMigrations });
    await writeFile('/tmp/deep-claim-phase7-release.sql', releaseSQL);
    await writeFile('/tmp/deep-claim-phase7-release-negative.sql', wrong);
    await writeFile('/tmp/deep-claim-phase7-release-baseline.json', JSON.stringify(baselineBodies, null, 2) + '\n');
    await writeFile('/tmp/deep-claim-phase7-release-expected.json', JSON.stringify(expectedBodies, null, 2) + '\n');
  });
  await test('release construction rejects transaction escapes and invalid history before SQL', async () => {
    for (const boundary of ['BEGIN;', 'COMMIT;', 'ROLLBACK;', 'START TRANSACTION;']) assert.throws(() => buildDeepClaimPhase7Release({ ...releaseArgs, source: `${boundary}\n${releaseArgs.source}` }), /transaction boundaries/);
    assert.throws(() => buildDeepClaimPhase7Release({ ...releaseArgs, priorMigrations: [] }), /seven released/);
    assert.throws(() => buildDeepClaimPhase7Release({ ...releaseArgs, baselineBodies: {} }), /133/);
    assert.equal(typeof buildDeepClaimPhase7Release({ ...releaseArgs, source: `${releaseArgs.source}\n/* BEGIN; /* COMMIT; */ ROLLBACK; */\nDO $safe$begin perform 'COMMIT;';end$safe$;` }), 'string');
  });
  await test('a wrong release postcondition rolls back DDL, money, jobs and history', async () => {
    const before = await captureCompany(alice), revision = (await row('select revision from public.dc_companies where user_id=$1', [alice])).revision;
    try { await assert.rejects(database.exec(await readFile('/tmp/deep-claim-phase7-release-negative.sql', 'utf8')), /Release postflight: expected function bodies mismatch/); }
    finally { await database.exec('rollback'); }
    assert.deepEqual(await criticalBodies(), baselineBodies); assert.deepEqual(await captureCompany(alice), before);
    assert.equal((await row('select revision from public.dc_companies where user_id=$1', [alice])).revision, revision);
    assert.equal((await row("select count(*)::integer n from supabase_migrations.schema_migrations where version='20261102070000'")).n, 0);
  });
  await test('native cutover waits for company locks and preserves paid pending legacy state', async () => {
    const before = await captureCompany(alice), { revision } = await row('select revision from public.dc_companies where user_id=$1', [alice]);
    let release, entered;
    const gate = new Promise(resolve => { release = resolve; }), acquired = new Promise(resolve => { entered = resolve; });
    const holder = database.transaction(async transaction => { await transaction.query('select id from public.dc_companies where user_id=$1 for update', [alice]); entered(); await gate; });
    await acquired; let finished = false;
    const migration = database.exec(releaseSQL).then(() => { finished = true; });
    try { await new Promise(resolve => setTimeout(resolve, 100)); assert.equal(finished, false, 'Cutover must wait for the held real company lock'); }
    finally { release(); }
    await Promise.all([holder, migration]);
    fixture.sources.set(expansionPath, await readFile(expansionPath, 'utf8'));
    assert.deepEqual(await captureCompany(alice), before);
    assert.deepEqual(await criticalBodies(), expectedBodies);
    assert.equal((await row('select revision from public.dc_companies where user_id=$1', [alice])).revision, revision + 1);
    aliceState = await call(alice, 'dc_get'); assert.equal(aliceState.schema_version, 5); assert.ok(aliceState.revision >= revision + 1);
    assert.equal(aliceState.expeditions.find(job => job.id === old.job.id).config_version, 3);
  });
  await test('repeating the release is rejected without another revision or history row', async () => {
    const before = await captureCompany(alice), revision = (await row('select revision from public.dc_companies where user_id=$1', [alice])).revision;
    try { await assert.rejects(database.exec(releaseSQL), /Release preflight/); } finally { await database.exec('rollback'); }
    assert.deepEqual(await captureCompany(alice), before); assert.deepEqual(await criticalBodies(), expectedBodies);
    assert.equal((await row('select revision from public.dc_companies where user_id=$1', [alice])).revision, revision);
    assert.equal((await row("select count(*)::integer n from supabase_migrations.schema_migrations where version='20261102070000'")).n, 1);
  });
  let fresh;
  await test('concurrent new dispatch retains immutable config7 modifiers', async () => {
    const args = { p_name: 'Native Claim B', p_request_id: randomUUID() };
    await successfulTogether([call(bob, 'dc_bootstrap', args), call(bob, 'dc_bootstrap', args)]);
    fresh = await dispatch(bob, true); assert.equal(fresh.job.config_version, 7);
    assert.equal(fresh.job.deep_modifiers.heat_penalty_percent, 0);
    assert.equal((await row('select count(*)::integer n from public.dc_expeditions where company_id=$1', [fresh.state.company.id])).n, 1);
  });
  let readyAlice, readyBob;
  await test('simultaneous legacy/new completion and repeated reconciliation settle each job once', async () => {
    await fixture.advanceJob(alice, old.job.id, old.job.duration_seconds + 1); await fixture.advanceJob(bob, fresh.job.id, fresh.job.duration_seconds + 1);
    const states = await successfulTogether([call(alice, 'dc_get'), call(alice, 'dc_get'), call(bob, 'dc_get'), call(bob, 'dc_get')]);
    readyAlice = states[0]; readyBob = states[2];
    assert.equal(readyAlice.expeditions.find(job => job.id === old.job.id).status, 'ready');
    assert.equal(readyBob.expeditions.find(job => job.id === fresh.job.id).status, 'ready');
    assert.deepEqual(states[0].workers, states[1].workers); assert.deepEqual(states[2].workers, states[3].workers);
    assert.equal(states[0].company.cash, states[1].company.cash); assert.equal(states[2].company.cash, states[3].company.cash);
    assert.equal((await row('select count(*)::integer n from public.dc_workers where assigned_job_id=any($1::uuid[])', [[old.job.id, fresh.job.id]])).n, 0);
  });
  await test('concurrent collection retries move each confirmed cargo unit once', async () => {
    for (const [user, state, id] of [[alice, readyAlice, old.job.id], [bob, readyBob, fresh.job.id]]) {
      const cargo = state.expeditions.find(job => job.id === id).cargo, args = { p_job_id: id, p_request_id: randomUUID() };
      const responses = await successfulTogether([call(user, 'dc_collect', args), call(user, 'dc_collect', args)]);
      assert.equal((await row('select count(*)::integer n from public.dc_requests where request_id=$1', [args.p_request_id])).n, 1);
      for (const [key, quantity] of Object.entries(cargo)) assert.equal(responses[0].resources[key] - (state.resources[key] ?? 0), quantity);
      assert.deepEqual(responses[0].resources, responses[1].resources);
    }
  });
  await test('competing sale intents cannot overspend the same collected stock', async () => {
    const state = await call(bob, 'dc_get'), [key, quantity] = Object.entries(state.resources).find(([, amount]) => amount > 0);
    const args = { p_resource_key: key, p_quantity: quantity, p_expected_revision: state.revision };
    const results = await Promise.allSettled([call(bob, 'dc_sell', { ...args, p_request_id: randomUUID() }), call(bob, 'dc_sell', { ...args, p_request_id: randomUUID() })]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    const after = await call(bob, 'dc_get'); assert.equal(after.resources[key] ?? 0, 0); assert.ok(after.company.cash > state.company.cash);
    assert.ok(Object.values(after.resources).every(amount => amount >= 0));
  });
  await test('concurrent paid upgrade retries charge once and retain a single new level', async () => {
    const state = await call(alice, 'dc_get'), args = { p_building_key: 'warehouse', p_expected_revision: state.revision, p_request_id: randomUUID() };
    const cost = state.buildings.find(building => building.key === 'warehouse').upgrade_cost;
    const results = await successfulTogether([call(alice, 'dc_upgrade', args), call(alice, 'dc_upgrade', args)]);
    assert.equal(results[0].company.cash, state.company.cash - cost); assert.equal(results[1].company.cash, results[0].company.cash);
    assert.equal(results[0].buildings.find(building => building.key === 'warehouse').level, 2);
    assert.equal((await row('select count(*)::integer n from public.dc_requests where request_id=$1', [args.p_request_id])).n, 1);
  });
  await test('native role and membership boundaries remain enforced', async () => {
    await assert.rejects(nativeActorQuery(database, alice, 'select * from public.dc_companies'), /permission denied/i);
    await assert.rejects(nativeActorQuery(database, null, 'select public.dc_get()', [], 'anon'), /permission denied/i);
    await assert.rejects(call(outsider, 'dc_collect', { p_job_id: old.job.id, p_request_id: randomUUID() }));
    const exposed = await row("select count(*)::integer n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' and has_function_privilege('authenticated',p.oid,'EXECUTE')"); assert.equal(exposed.n, 25);
    const anonymous = await row("select count(*)::integer n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' and has_function_privilege('anon',p.oid,'EXECUTE')"); assert.equal(anonymous.n, 0);
  });
  await fixture.assertSourcesUnchanged();
  const report = { passed: true, native: true, postgresVersion: info.version, connections: info.connections, checks, count: checks.length, source: 'Actual released Feats and Deep Claim migrations, local marked disposable PostgreSQL; independent role-scoped concurrent transactions.', liveWrites: false, errors: [] };
  if (process.argv.includes('--proof')) { await writeFile('/tmp/deep-claim-phase7-native-bodies.json', JSON.stringify(await criticalBodies(), null, 2) + '\n'); await writeFile('/tmp/deep-claim-phase7-native-report.json', JSON.stringify(report, null, 2) + '\n'); }
  console.log(`${checks.length} native PostgreSQL multi-connection groups passed.`);
} finally { await (fixture ? fixture.close() : database.close()); }
