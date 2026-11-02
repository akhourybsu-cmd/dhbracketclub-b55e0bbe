// Real multi-connection PostgreSQL17 journal checks. The reused adapter rejects
// every database except its fixed localhost port and explicit disposable marker.
// There is no production URL, environment-variable fallback or remote test data.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createDeepClaimNativeDatabase, nativeActorQuery } from './fixtures/deep-claim-native-db.mjs';
import { createDeepClaimTutorialDatabase } from './fixtures/deep-claim-tutorial-db.mjs';
import { buildDeepClaimTrainingRelease, DEEP_CLAIM_TRAINING_CRITICAL_PATTERN } from './lib/deep-claim-training-release.mjs';

const database = await createDeepClaimNativeDatabase({ reset: process.argv.includes('--reset') });
let fixture;
const checks = [], connectionInfo = database.info;
const row = async (text, args = []) => (await database.query(text, args)).rows[0];
// postgres.js encodes parameters inferred as JSONB itself. Keep native patch
// objects raw here; the older PGlite-compatible fixture intentionally retains
// its own serialization and is not changed by these educational checks.
const call = async (user, name, args = {}) => {
  assert.ok(['dc_tutorial_get', 'dc_tutorial_save'].includes(name));
  const statement = name === 'dc_tutorial_get' ? 'select public.dc_tutorial_get() data'
    : 'select public.dc_tutorial_save($1::jsonb,$2::integer,$3::uuid) data';
  const parameters = name === 'dc_tutorial_get' ? [] : [args.p_patch, args.p_expected_revision, args.p_request_id];
  return (await nativeActorQuery(database, user, statement, parameters)).rows[0].data;
};
const get = user => call(user, 'dc_tutorial_get');
const save = (user, patch, revision, requestId = randomUUID()) => call(user, 'dc_tutorial_save', { p_patch: patch, p_expected_revision: revision, p_request_id: requestId });
const semantic = ({ server_now: _clock, ...state }) => state;
const test = async (label, run) => { await run(); await fixture.assertEconomicUnchanged(); checks.push(label); console.log('PASS native tutorial', label); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const expectedError = (codes, message) => error => { assert.ok(codes.includes(error.code), `${error.code}: ${error.message}`); if (message) assert.match(error.message, message); return true; };
const criticalBodies = async (db = database) => Object.fromEntries((await db.query("select p.oid::regprocedure::text signature,md5(p.prosrc) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ $1 order by signature", [DEEP_CLAIM_TRAINING_CRITICAL_PATTERN])).rows.map(item => [item.signature, item.body]));

/** Force both real client transactions to overlap before either may save. */
async function underJournalLocks(companyIds, operations) {
  const acquired = deferred(), released = deferred();
  const holder = database.transaction(async transaction => {
    const locked = await transaction.query('select company_id from public.dc_tutorial_progress where company_id=any($1::uuid[]) order by company_id for update', [companyIds]);
    assert.equal(locked.rows.length, companyIds.length, 'Every barrier requires an actual owned journal row');
    acquired.resolve(); await released.promise;
  });
  void holder.catch(acquired.reject);
  await acquired.promise;
  const settled = Promise.allSettled(operations.map(operation => operation()));
  try {
    const deadline = Date.now() + 2000; let waiting = 0;
    while (Date.now() < deadline) {
      waiting = (await row("select count(*)::integer n from pg_stat_activity where datname=current_database() and application_name='dh_deep_claim_phase7_native_qa' and pid<>pg_backend_pid() and wait_event_type='Lock' and query like '%dc_tutorial_save%'")).n;
      if (waiting >= operations.length) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.ok(waiting >= operations.length, 'Independent save transactions must both reach the held journal lock');
  } finally { released.resolve(); }
  const results = await settled; await holder; return results;
}

try {
  fixture = await createDeepClaimTutorialDatabase({ database, applyTutorial: false, beforeApply: async old => {
    const A = old.id(1), B = old.id(2), CLUB = old.id(10), otherClub = old.id(11);
    let a = await old.rpc(A, 'dc_bootstrap', { p_name: 'Native existing paid company', p_request_id: randomUUID() });
    const b = await old.rpc(B, 'dc_bootstrap', { p_name: 'Native other owner company', p_request_id: randomUUID() });
    a = await old.rpc(A, 'dc_dispatch_operation', { p_worker_ids: [a.workers[0].id], p_mode: 'extract', p_target_x: 47, p_target_y: 1,
      p_duration_minutes: 20, p_tutorial: false, p_infrastructure_key: null, p_expected_revision: a.revision, p_request_id: randomUUID() });
    const overdue = a.expeditions.find(job => job.status === 'active'); assert.ok(overdue);
    await old.advanceJob(A, overdue.id, overdue.duration_seconds);
    await old.db.query('update public.club_members set club_id=$2 where user_id=$1', [A, otherClub]);
    const other = await old.rpc(A, 'dc_bootstrap', { p_name: 'Native separate club company', p_request_id: randomUUID() });
    await old.db.query('update public.club_members set club_id=$2 where user_id=$1', [A, CLUB]);
    return { A, B, CLUB, otherClub, companyA: a.company.id, companyB: b.company.id, otherCompanyA: other.company.id, overdueJob: overdue.id };
  } });
  const { A, B, CLUB, otherClub, companyA, companyB, otherCompanyA, overdueJob } = fixture.setup;
  let registry, steps;
  const cursor = index => ({ active_lesson_id: registry[index], active_step_id: steps.find(step => step.startsWith(registry[index] + '.')), campaign_status: 'active' });
  const rollback = new Error('Expected isolated authorization rollback');
  async function authorizationScope(change, action) {
    try {
      await database.transaction(async transaction => {
        await change(transaction);
        await transaction.exec('set local role authenticated');
        await transaction.query("select set_config('test.user',$1,true),set_config('test.role','authenticated',true)", [A]);
        await action(transaction); throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
  }

  let baselineBodies, expectedBodies, releaseArgs, releaseSQL;
  await test('native rollback derives the exact161-body educational proof while preserving the released baseline', async () => {
    baselineBodies = await criticalBodies(); assert.equal(Object.keys(baselineBodies).length, 153);
    const expectedRollback = new Error('Expected educational DDL derivation rollback');
    await assert.rejects(database.transaction(async transaction => {
      await transaction.exec(fixture.source); expectedBodies = await criticalBodies(transaction);
      assert.equal(Object.keys(expectedBodies).length, 161); throw expectedRollback;
    }), error => error === expectedRollback);
    assert.deepEqual(await criticalBodies(), baselineBodies);
    assert.equal((await row("select to_regclass('public.dc_tutorial_progress') value")).value, null);
    await database.exec('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])');
    const priorMigrations = [];
    for (const [path, text] of [...fixture.sources].filter(([path]) => /^supabase\/migrations\/20261102\d{6}_deep_claim.*\.sql$/.test(path) && path < 'supabase/migrations/20261102080000_').sort(([a], [b]) => a.localeCompare(b))) {
      const file = path.split('/').at(-1), version = file.slice(0, 14), name = file.slice(15, -4);
      await database.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,array[$3::text])', [version, name, text]);
      priorMigrations.push({ version, name, md5: createHash('md5').update(text).digest('hex') });
    }
    assert.equal(priorMigrations.length, 8);
    releaseArgs = { source: fixture.source, baselineBodies, expectedBodies, priorMigrations };
    releaseSQL = buildDeepClaimTrainingRelease(releaseArgs);
    for (const boundary of ['BEGIN;', 'COMMIT;', 'ROLLBACK;', 'START TRANSACTION;']) assert.throws(() => buildDeepClaimTrainingRelease({ ...releaseArgs, source: boundary + '\n' + fixture.source }), /transaction boundaries/);
    assert.throws(() => buildDeepClaimTrainingRelease({ ...releaseArgs, source: fixture.source + '\n-- untested change' }), /frozen0800/);
    assert.throws(() => buildDeepClaimTrainingRelease({ ...releaseArgs, priorMigrations: [] }), /eight prior/);
  });
  await test('a deliberately wrong guarded postcondition rolls back tables, functions, history and every old record', async () => {
    const wrong = buildDeepClaimTrainingRelease({ ...releaseArgs, expectedBodies: { ...expectedBodies, 'dc_tutorial_get()': '0'.repeat(32) } });
    await writeFile('/tmp/deep-claim-tutorial-release-negative.sql', wrong);
    try { await assert.rejects(database.exec(wrong), /Training postflight: expected function bodies mismatch/); }
    finally { await database.exec('rollback'); }
    assert.deepEqual(await criticalBodies(), baselineBodies);
    assert.equal((await row("select to_regclass('public.dc_tutorial_progress') value")).value, null);
    assert.equal((await row("select count(*)::integer n from supabase_migrations.schema_migrations where version='20261102080000'")).n, 0);
  });
  await test('the exact guarded release waits on a real company lock and commits with no company revision change', async () => {
    const revision = (await row('select revision from public.dc_companies where id=$1', [companyA])).revision;
    const acquired = deferred(), released = deferred();
    const holder = database.transaction(async transaction => { await transaction.query('select id from public.dc_companies where id=$1 for update', [companyA]); acquired.resolve(); await released.promise; });
    void holder.catch(acquired.reject); await acquired.promise;
    let finished = false; const migration = database.exec(releaseSQL).then(() => { finished = true; });
    // Attach rejection handling before polling so a failed postcondition cannot
    // become an unhandled promise while the owner barrier is being released.
    const migrated = Promise.allSettled([migration]);
    try {
      const deadline = Date.now() + 2000; let waiting = 0;
      while (Date.now() < deadline) {
        waiting = (await database.transaction(transaction => transaction.query("select count(*)::integer n from pg_stat_activity where datname=current_database() and application_name='dh_deep_claim_phase7_native_qa' and wait_event_type='Lock' and query like '%lock table public.dc_companies in access exclusive mode%'"))).rows[0].n;
        if (waiting > 0) break;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.ok(waiting > 0 && !finished, 'The exact deployment transaction must actually wait for the held company row');
    } finally { released.resolve(); }
    const result = await migrated; await holder; assert.equal(result[0].status, 'fulfilled', result[0].reason?.message);
    assert.equal((await row('select revision from public.dc_companies where id=$1', [companyA])).revision, revision);
    assert.deepEqual(await criticalBodies(), expectedBodies);
    fixture.installedBodies = await fixture.functionBodies(); assert.equal(fixture.installedBodies.length, 161);
    const recorded = await row("select cardinality(statements) count,md5(statements[1]) md5,encode(sha256(convert_to(statements[1],'UTF8')),'hex') sha256 from supabase_migrations.schema_migrations where version='20261102080000'");
    assert.equal(recorded.count, 1); assert.equal(recorded.md5, createHash('md5').update(fixture.source).digest('hex')); assert.equal(recorded.sha256, createHash('sha256').update(fixture.source).digest('hex'));
  });
  await test('repeating the guarded deployment is rejected without touching history or any player state', async () => {
    try { await assert.rejects(database.exec(releaseSQL), /Training release already recorded/); }
    finally { await database.exec('rollback'); }
    assert.deepEqual(await criticalBodies(), expectedBodies);
    assert.equal((await row("select count(*)::integer n from supabase_migrations.schema_migrations where version='20261102080000'")).n, 1);
  });
  registry = (await row("select public.dc_tutorial_ids_v1('lessons') lessons")).lessons;
  steps = (await row("select public.dc_tutorial_ids_v1('steps') steps")).steps;

  await test('native17 actor sessions genuinely overlap on distinct backend PIDs', async () => {
    const responses = await Promise.all([nativeActorQuery(database, A, 'select pg_backend_pid() pid,pg_sleep(.08)'), nativeActorQuery(database, A, 'select pg_backend_pid() pid,pg_sleep(.08)')]);
    assert.notEqual(responses[0].rows[0].pid, responses[1].rows[0].pid);
    assert.equal(fixture.beforeBodies.length, 153); assert.equal(fixture.installedBodies.length, 161);
  });
  await test('journal GET stays read-only and never settles an overdue paid expedition', async () => {
    const first = await get(A); assert.equal(first.revision, 0); assert.equal(first.company_id, companyA);
    assert.equal((await row('select count(*)::integer n from public.dc_tutorial_progress')).n, 0);
    assert.equal((await row('select status from public.dc_expeditions where id=$1', [overdueJob])).status, 'active');
    await save(A, { reviewed_lessons: [] }, 0); await save(B, { reviewed_lessons: [] }, 0);
  });

  let acknowledged;
  await test('overlapping identical UUID saves commit exactly one revision and return the same current progress', async () => {
    const before = await get(A), requestId = randomUUID(), patch = cursor(0);
    const outcomes = await underJournalLocks([companyA], [() => save(A, patch, before.revision, requestId), () => save(A, patch, before.revision, requestId)]);
    assert.ok(outcomes.every(outcome => outcome.status === 'fulfilled'));
    const responses = outcomes.map(outcome => outcome.value);
    assert.equal(responses[0].revision, before.revision + 1); assert.deepEqual(semantic(responses[0]), semantic(responses[1]));
    assert.equal((await row('select count(*)::integer n from public.dc_tutorial_requests where request_id=$1', [requestId])).n, 1);
    assert.equal((await get(A)).revision, before.revision + 1);
    acknowledged = { patch, revision: before.revision, requestId };
  });
  await test('competing cursor CAS permits one winner and never overwrites its selected lesson', async () => {
    const before = await get(A), patches = [cursor(1), cursor(2)], keys = [randomUUID(), randomUUID()];
    const outcomes = await underJournalLocks([companyA], patches.map((patch, index) => () => save(A, patch, before.revision, keys[index])));
    assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(outcome => outcome.status === 'rejected' && outcome.reason.code === '40001').length, 1);
    const winner = outcomes.findIndex(outcome => outcome.status === 'fulfilled'), after = await get(A);
    assert.equal(after.revision, before.revision + 1); assert.equal(after.active_lesson_id, patches[winner].active_lesson_id); assert.equal(after.active_step_id, patches[winner].active_step_id);
    assert.equal((await row('select count(*)::integer n from public.dc_tutorial_requests where request_id=any($1::uuid[])', [keys])).n, 1);
  });
  await test('concurrent stale-safe set merges both survive without moving the cursor', async () => {
    const before = await get(A), patches = [{ reviewed_lessons: [registry[10]] }, { practiced_lessons: [registry[11]] }];
    const outcomes = await underJournalLocks([companyA], patches.map(patch => () => save(A, patch, before.revision)));
    assert.ok(outcomes.every(outcome => outcome.status === 'fulfilled'));
    const after = await get(A); assert.equal(after.revision, before.revision + 2);
    assert.ok(after.reviewed_lessons.includes(registry[10])); assert.ok(after.practiced_lessons.includes(registry[11]));
    assert.equal(after.active_lesson_id, before.active_lesson_id); assert.equal(after.active_step_id, before.active_step_id);
  });
  await test('a committed lost acknowledgement returns newer authorized state and never rewinds another device', async () => {
    const before = await get(A), after = await save(A, { commentary_enabled: false }, before.revision);
    const replay = await save(A, acknowledged.patch, acknowledged.revision, acknowledged.requestId);
    assert.deepEqual(semantic(replay), semantic(after)); assert.equal(replay.commentary_enabled, false);
    await assert.rejects(save(A, { ...acknowledged.patch, campaign_status: 'paused' }, acknowledged.revision, acknowledged.requestId), expectedError(['42501'], /already used/));
  });
  await test('simultaneous cross-owner UUID collision rolls back only the losing educational write', async () => {
    const a = await get(A), b = await get(B), requestId = randomUUID(), patch = { reviewed_lessons: [registry[20]] };
    const outcomes = await underJournalLocks([companyA, companyB], [() => save(A, patch, a.revision, requestId), () => save(B, patch, b.revision, requestId)]);
    assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(outcome => outcome.status === 'rejected' && outcome.reason.code === '42501').length, 1);
    const winner = outcomes.findIndex(outcome => outcome.status === 'fulfilled'), after = [await get(A), await get(B)], before = [a, b];
    for (let index = 0; index < 2; index++) {
      if (index === winner) { assert.equal(after[index].revision, before[index].revision + 1); assert.ok(after[index].reviewed_lessons.includes(registry[20])); }
      else assert.deepEqual(semantic(after[index]), semantic(before[index]));
    }
    assert.equal((await row('select count(*)::integer n from public.dc_tutorial_requests where request_id=$1', [requestId])).n, 1);
  });
  await test('another owner sees only their own company and direct metadata access remains forbidden', async () => {
    const a = await get(A), b = await get(B); assert.notEqual(a.company_id, b.company_id); assert.equal(b.company_id, companyB);
    assert.ok(!b.reviewed_lessons.includes(registry[10]));
    await assert.rejects(nativeActorQuery(database, B, 'select * from public.dc_tutorial_progress'), /permission denied/i);
    await assert.rejects(nativeActorQuery(database, null, 'select public.dc_tutorial_get()', [], 'anon'), /permission denied/i);
    await assert.rejects(save(B, { company_id: companyA }, b.revision), expectedError(['22023'], /Unsupported/));
  });
  await test('same-member club scoping and active-asset checks apply before receipt replay', async () => {
    await authorizationScope(transaction => transaction.query('update public.club_members set club_id=$2 where user_id=$1', [A, otherClub]), async transaction => {
      const other = (await transaction.query('select public.dc_tutorial_get() data')).rows[0].data;
      assert.equal(other.club_id, otherClub); assert.equal(other.company_id, otherCompanyA); assert.deepEqual(other.reviewed_lessons, []);
      await assert.rejects(transaction.query('select public.dc_tutorial_save($1::jsonb,$2,$3::uuid)', [acknowledged.patch, acknowledged.revision, acknowledged.requestId]), expectedError(['42501'], /already used/));
    });
    for (const kind of ['get','retry']) await authorizationScope(transaction => transaction.query("update public.club_installed_assets set enabled=false where club_id=$1 and asset_id=(select id from public.platform_assets where slug='deep-claim')", [CLUB]), async transaction => {
      const statement = kind === 'get' ? transaction.query('select public.dc_tutorial_get()') : transaction.query('select public.dc_tutorial_save($1::jsonb,$2,$3::uuid)', [acknowledged.patch, acknowledged.revision, acknowledged.requestId]);
      await assert.rejects(statement, expectedError(['42501']));
    });
  });
  await test('final native journal activity leaves all old153 functions and every economic/ledger record exact', async () => {
    await fixture.assertEconomicUnchanged(); await fixture.assertSourcesUnchanged();
    assert.deepEqual(await fixture.functionBodies(), fixture.installedBodies);
    assert.equal((await row('select status from public.dc_expeditions where id=$1', [overdueJob])).status, 'active');
    assert.equal((await row('select count(*)::integer n from public.dc_milestones where job_id=$1 and applied_at is not null', [overdueJob])).n, 0);
  });

  const report = { passed: true, native: true, postgres_version: connectionInfo.version, connections: connectionInfo.connections, checks, checks_passed: checks.length,
    critical_functions_before: 153, critical_functions_after: 161, old_economic_tables_exact: 33, member_rpcs: 27, old_rows_exact: true, real_overlapping_save_locks: true,
    response_clock_note: 'Idempotent replies share identical educational state; server_now is the fresh read clock.',
    source_sha256: createHash('sha256').update(fixture.source).digest('hex'), source_md5: createHash('md5').update(fixture.source).digest('hex'),
    guarded_release_sha256: createHash('sha256').update(releaseSQL).digest('hex'), guarded_release_md5: createHash('md5').update(releaseSQL).digest('hex'), live_writes: false };
  if (process.argv.includes('--proof')) {
    await writeFile('/tmp/deep-claim-tutorial-release.sql', releaseSQL);
    await writeFile('/tmp/deep-claim-tutorial-release-baseline.json', JSON.stringify(baselineBodies, null, 2));
    await writeFile('/tmp/deep-claim-tutorial-release-expected.json', JSON.stringify(expectedBodies, null, 2));
    await writeFile('/tmp/deep-claim-tutorial-native-report.json', JSON.stringify(report, null, 2));
    await writeFile('/tmp/deep-claim-tutorial-native-expected-bodies.json', JSON.stringify(Object.fromEntries((await fixture.functionBodies()).map(fn => [fn.signature, fn.body])), null, 2));
  }
  console.log(`${checks.length} native Training Journal multi-connection groups passed.`);
} catch (error) {
  console.error(JSON.stringify({ message: error.message, code: error.code, where: error.where, internalQuery: error.internalQuery, stack: error.stack }, null, 2)); process.exitCode = 1;
} finally { await (fixture ? fixture.close() : database.close()); }
