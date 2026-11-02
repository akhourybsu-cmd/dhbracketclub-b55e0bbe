// Independent0800 extension proof over the complete released game and DH ledger.
// No credentials, remote endpoints, production companies or real player data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { createDeepClaimTutorialDatabase, TUTORIAL_MIGRATION } from './fixtures/deep-claim-tutorial-db.mjs';

let sequence = 1_800_000, checks = 0, fixture;
const filter = process.env.DEEP_CLAIM_TUTORIAL_DB_FILTER ? new RegExp(process.env.DEEP_CLAIM_TUTORIAL_DB_FILTER) : null;
assert.ok(!filter || !process.argv.includes('--proof'), 'A release proof must run the whole independent extension suite');
const request = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
const check = async (name, run) => { if (filter && !filter.test(name)) return; await run(); checks++; console.log('PASS', name); };
const rejected = (pattern, codes = ['22023','P0001','40001','42501']) => error => { assert.ok(codes.includes(error.code), `${error.code}: ${error.message}`); if (pattern) assert.match(error.message, pattern); return true; };

try {
  const bundle = await build({ stdin: { contents: "export {validateTutorialProgress} from './src/lib/deepClaim/tutorial/progress.ts';export {TUTORIAL_LESSON_IDS} from './src/lib/deepClaim/tutorial/types.ts';export {TUTORIAL_STEP_IDS} from './src/lib/deepClaim/tutorial/chapters.ts';export {DIALOGUE_LINE_IDS} from './src/lib/deepClaim/tutorial/dialogue.ts';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
  const engine = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const lessons = engine.TUTORIAL_LESSON_IDS, steps = engine.TUTORIAL_STEP_IDS, dialogue = engine.DIALOGUE_LINE_IDS;
  fixture = await createDeepClaimTutorialDatabase({ beforeApply: async old => {
    const A = old.id(1), B = old.id(2), CLUB = old.id(10), otherClub = old.id(11);
    let a = await old.rpc(A, 'dc_bootstrap', { p_name: 'Existing paid training company', p_request_id: request() });
    const b = await old.rpc(B, 'dc_bootstrap', { p_name: 'Other member private company', p_request_id: request() });
    a = await old.rpc(A, 'dc_dispatch_operation', { p_worker_ids: a.workers.map(worker => worker.id), p_mode: 'extract', p_target_x: 47, p_target_y: 1, p_duration_minutes: 20, p_tutorial: true, p_infrastructure_key: null, p_expected_revision: a.revision, p_request_id: request() });
    const first = a.expeditions.find(job => job.status === 'active'); assert.ok(first);
    await old.advanceJob(A, first.id, first.duration_seconds);
    a = await old.rpc(A, 'dc_collect', { p_job_id: first.id, p_request_id: request() });
    await old.rpc(A, 'dh_feats_board', { p_club_id: CLUB });
    assert.ok((await old.db.query("select count(*)::integer n from public.dh_feat_unlocks where user_id=$1 and feat_key='deep_claim_shifts'", [A])).rows[0].n > 0);
    a = await old.rpc(A, 'dc_dispatch_operation', { p_worker_ids: [a.workers[0].id], p_mode: 'extract', p_target_x: 46, p_target_y: 1, p_duration_minutes: 20, p_tutorial: false, p_infrastructure_key: null, p_expected_revision: a.revision, p_request_id: request() });
    const overdue = a.expeditions.find(job => job.status === 'active'); assert.ok(overdue);
    await old.advanceJob(A, overdue.id, overdue.duration_seconds);
    // Create the same member's separate legitimate club company before the
    // preservation baseline; journal saves never bootstrap either company.
    await old.db.query('update public.club_members set club_id=$2 where user_id=$1', [A, otherClub]);
    const other = await old.rpc(A, 'dc_bootstrap', { p_name: 'Separate club training company', p_request_id: request() });
    await old.db.query('update public.club_members set club_id=$2 where user_id=$1', [A, CLUB]);
    return { A, B, C: old.id(3), CLUB, otherClub, companyA: a.company.id, companyB: b.company.id, otherCompanyA: other.company.id, overdueJob: overdue.id };
  } });
  const { db, rpc, actorQuery, setup } = fixture;
  const { A, B, C, CLUB, otherClub, companyA, otherCompanyA, overdueJob } = setup;
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const get = (user = A) => rpc(user, 'dc_tutorial_get');
  const save = (patch, revision, key = request(), user = A) => rpc(user, 'dc_tutorial_save', { p_patch: patch, p_expected_revision: revision, p_request_id: key });
  const validate = progress => { engine.validateTutorialProgress(progress); return progress; };
  const state = async (user = A) => validate(await get(user));
  const receiptCount = async company => (await one('select count(*)::integer n from public.dc_tutorial_requests where company_id=$1', [company])).n;
  const journalRows = async () => fixture.tableHashes(['dc_tutorial_progress','dc_tutorial_requests']);
  const scope = { user_id: A, club_id: CLUB, company_id: companyA };
  const cursor = (lesson = lessons[0]) => ({ active_lesson_id: lesson, active_step_id: steps.find(step => step.startsWith(lesson + '.')), campaign_status: 'active' });
  const rollback = Symbol('isolated permission scope rollback');
  async function scopedTransaction(setupChange, run, user = A) {
    try {
      await db.transaction(async transaction => {
        await setupChange(transaction);
        await transaction.exec('set local role authenticated');
        await transaction.query("select set_config('test.user',$1,true),set_config('test.role','authenticated',true)", [user]);
        await run(transaction);
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
  }

  await check('journal migration preserves every old153 function OID/body and all33 economic tables plus permanent awards', async () => {
    assert.equal(fixture.beforeBodies.length, 153); assert.equal(fixture.installedBodies.length, 161);
    assert.equal(fixture.installedBodies.filter(row => !fixture.beforeBodies.some(old => old.signature === row.signature)).length, 8);
    await fixture.assertEconomicUnchanged();
  });
  await check('journal access has exactly two member RPCs, eight secured functions,35 RLS tables and no Realtime exposure', async () => {
    const functions = (await db.query("select p.oid::regprocedure::text signature,p.proname name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^dc_tutorial_' order by name")).rows;
    assert.equal(functions.length, 8);
    for (const fn of functions) for (const role of ['anon','authenticated','service_role']) assert.equal((await one('select has_function_privilege($1,$2,\'EXECUTE\') value', [role, fn.signature])).value, role === 'service_role' || role === 'authenticated' && ['dc_tutorial_get','dc_tutorial_save'].includes(fn.name), `${role} ${fn.signature}`);
    assert.equal((await one("select count(*)::integer n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^dc_' and has_function_privilege('authenticated',p.oid,'EXECUTE')")).n, 27);
    assert.equal((await one("select count(*)::integer n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname ~ '^dc_'")).n, 35);
    for (const table of ['dc_tutorial_progress','dc_tutorial_requests']) {
      assert.equal((await one('select relrowsecurity value from pg_class where oid=$1::regclass', [`public.${table}`])).value, true);
      for (const role of ['anon','authenticated']) assert.equal((await one('select has_table_privilege($1,$2,\'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER\') value', [role, `public.${table}`])).value, false);
      await assert.rejects(actorQuery(A, `select * from public.${table}`), /permission denied/);
    }
    assert.equal((await one("select count(*)::integer n from pg_publication_tables where schemaname='public' and tablename ~ '^dc_tutorial_'")).n, 0);
    await assert.rejects(actorQuery(null, 'select public.dc_tutorial_get()', [], 'anon'), /permission denied/);
  });
  await check('versioned educational registries exactly match all42 lessons,84 steps and67 dialogue lines', async () => {
    for (const [kind, ids] of Object.entries({ lessons, steps, dialogue })) assert.deepEqual((await one('select public.dc_tutorial_ids_v1($1) value', [kind])).value, ids);
  });
  await check('GET without a company returns verified revision-zero metadata without founding or inserting a journal', async () => {
    const before = await journalRows(), progress = validate(await get(C));
    assert.equal(progress.company_id, null); assert.equal(progress.revision, 0); assert.equal(progress.updated_at, null); assert.equal(progress.campaign_status, 'not_started');
    for (const key of ['completed_steps','reviewed_lessons','practiced_lessons','skipped_lessons','seen_dialogue']) assert.deepEqual(progress[key], []);
    await assert.rejects(save({ campaign_status: 'active' }, 0, request(), C), rejected(/Create your company/));
    assert.deepEqual(await journalRows(), before); await fixture.assertEconomicUnchanged();
  });
  await check('GET for an existing company is read-only and never settles even an overdue paid expedition', async () => {
    const before = await journalRows(), progress = await state(); engine.validateTutorialProgress(progress, scope);
    assert.equal(progress.company_id, companyA); assert.equal((await one('select status from public.dc_expeditions where id=$1', [overdueJob])).status, 'active');
    assert.deepEqual(await journalRows(), before); await fixture.assertEconomicUnchanged();
  });
  await check('cursor, dialogue and commentary save independently from real company revision and induction flag', async () => {
    const before = await state(), progress = validate(await save({ ...cursor(), seen_dialogue: [dialogue[0]], commentary_enabled: false }, before.revision));
    assert.equal(progress.revision, before.revision + 1); assert.equal(progress.active_step_id, cursor().active_step_id); assert.equal(progress.commentary_enabled, false); assert.ok(progress.updated_at);
    assert.ok(progress.seen_dialogue.includes(dialogue[0])); await fixture.assertEconomicUnchanged();
  });
  await check('same UUID retries before CAS and rate checks return current authorized progress without duplicate writes', async () => {
    const before = await state(), key = request(), patch = { ...cursor(lessons[1]), campaign_status: 'paused' };
    const saved = validate(await save(patch, before.revision, key));
    const newer = validate(await save({ commentary_enabled: !saved.commentary_enabled }, saved.revision));
    const afterCount = await receiptCount(companyA), replayed = validate(await save(patch, before.revision, key));
    assert.equal(replayed.revision, newer.revision); assert.equal(replayed.commentary_enabled, newer.commentary_enabled); assert.equal(await receiptCount(companyA), afterCount);
    await assert.rejects(save({ ...patch, campaign_status: 'active' }, before.revision, key), rejected(/already used/, ['42501']));
  });
  await check('stale cursor/status/commentary CAS rejects the entire patch, including accompanying sets', async () => {
    let before = await state(); before = await save({ commentary_enabled: !before.commentary_enabled }, before.revision); const rows = await journalRows();
    await assert.rejects(save({ campaign_status: 'active', completed_steps: [steps.at(-1)] }, Math.max(0, before.revision - 1)), rejected(/another device/, ['40001']));
    assert.deepEqual(await journalRows(), rows);
    await assert.rejects(save({ seen_dialogue: [dialogue.at(-1)] }, before.revision + 1), rejected(/another device/, ['40001']));
  });
  await check('stale array-only saves merge all five sets monotonically and never move another device cursor', async () => {
    const before = await state(), patch = { completed_steps: [steps[0], steps[0]], reviewed_lessons: [lessons[0]], practiced_lessons: [lessons[1]], skipped_lessons: [lessons[2]], seen_dialogue: [dialogue[1]] };
    const merged = validate(await save(patch, 0));
    assert.equal(merged.active_lesson_id, before.active_lesson_id); assert.equal(merged.active_step_id, before.active_step_id);
    for (const key of Object.keys(patch)) for (const id of patch[key]) assert.ok(merged[key].includes(id));
    const unchanged = validate(await save({ completed_steps: [], reviewed_lessons: [], practiced_lessons: [], skipped_lessons: [], seen_dialogue: [] }, merged.revision));
    assert.equal(unchanged.revision, merged.revision); assert.equal(unchanged.updated_at, merged.updated_at);
  });
  await check('lesson-only introductions, pause/resume and explicit cursor exit preserve all completed sets', async () => {
    let progress = await state(), priorSets = progress.completed_steps;
    progress = validate(await save({ active_lesson_id: lessons[3] }, progress.revision)); assert.equal(progress.active_step_id, null);
    progress = validate(await save({ active_step_id: steps.find(id => id.startsWith(lessons[3] + '.')), campaign_status: 'paused' }, progress.revision));
    progress = validate(await save({ campaign_status: 'active' }, progress.revision));
    progress = validate(await save({ active_lesson_id: null }, progress.revision)); assert.equal(progress.active_step_id, null); assert.deepEqual(progress.completed_steps, priorSets);
    await assert.rejects(save({ active_step_id: steps[0] }, progress.revision), rejected(/within its training lesson/));
    await assert.rejects(save({ active_lesson_id: lessons[0], active_step_id: steps.find(id => id.startsWith(lessons[1] + '.')) }, progress.revision), rejected(/within its training lesson/));
  });
  await check('unknown content, invalid shapes and oversized metadata never create a receipt or change progress', async () => {
    const before = await state(), rows = await journalRows();
    for (const patch of [null, [], 'wrong', { cash: 1_000_000 }, { company_id: setup.companyB }, { version: 2 }, { completed_steps: ['beginner.claim.fake'] }, { reviewed_lessons: ['unknown.lesson'] }, { seen_dialogue: ['opening.deed.fake'] }, { commentary_enabled: 'false' }, { campaign_status: null }, { active_step_id: 'x'.repeat(40000) }, { completed_steps: Array(513).fill(steps[0]) }, { seen_dialogue: [null] }]) await assert.rejects(save(patch, before.revision), rejected(undefined, ['22023']));
    assert.deepEqual(await journalRows(), rows);
  });
  await check('a different member cannot read or reuse another member educational request', async () => {
    const a = await state(), key = request(), patch = { reviewed_lessons: [lessons[3]] }; await save(patch, a.revision, key);
    const b = validate(await get(B)); assert.equal(b.user_id, B); assert.equal(b.company_id, setup.companyB); assert.deepEqual(b.reviewed_lessons, []);
    const before = await journalRows(); await assert.rejects(save(patch, b.revision, key, B), rejected(/already used/, ['42501'])); assert.deepEqual(await journalRows(), before);
  });
  await check('club switching scopes the same member to a separate company and rejects cross-club UUID replay', async () => {
    const a = await state(), key = request(), patch = { reviewed_lessons: [lessons[4]] }; await save(patch, a.revision, key);
    await scopedTransaction(transaction => transaction.query('update public.club_members set club_id=$2 where user_id=$1', [A, otherClub]), async transaction => {
      const other = (await transaction.query('select public.dc_tutorial_get() data')).rows[0].data; validate(other);
      assert.equal(other.club_id, otherClub); assert.equal(other.company_id, otherCompanyA); assert.deepEqual(other.reviewed_lessons, []);
      await assert.rejects(transaction.query('select public.dc_tutorial_save($1::jsonb,0,$2::uuid)', [JSON.stringify(patch), key]), rejected(/already used/, ['42501']));
    });
  });
  await check('authentication, current membership, active club and enabled visible asset are checked before reads and receipt retries', async () => {
    const progress = await state(), key = request(), patch = { seen_dialogue: [dialogue[2]] }; await save(patch, progress.revision, key);
    const changes = [
      transaction => transaction.query('delete from public.club_members where user_id=$1', [A]),
      transaction => transaction.query("update public.clubs set status='inactive' where id=$1", [CLUB]),
      transaction => transaction.query("update public.club_installed_assets set enabled=false where club_id=$1 and asset_id=(select id from public.platform_assets where slug='deep-claim')", [CLUB]),
      transaction => transaction.query("update public.club_installed_assets set visible_to_members=false where club_id=$1 and asset_id=(select id from public.platform_assets where slug='deep-claim')", [CLUB]),
      transaction => transaction.exec("update public.platform_assets set is_active=false where slug='deep-claim'"),
    ];
    for (const change of changes) for (const operation of ['get','retry']) await scopedTransaction(change, async transaction => {
      const statement = operation === 'get' ? transaction.query('select public.dc_tutorial_get()') : transaction.query('select public.dc_tutorial_save($1::jsonb,$2,$3::uuid)', [JSON.stringify(patch), progress.revision, key]);
      await assert.rejects(statement, rejected(undefined, ['42501']));
    });
    await assert.rejects(actorQuery(null, 'select public.dc_tutorial_get()'), rejected(undefined, ['42501']));
    await fixture.assertEconomicUnchanged();
  });
  await check('simultaneous device requests are idempotent and concurrent monotonic sets are both retained', async () => {
    let progress = await state(); const key = request(), patch = { ...cursor(lessons[5]), commentary_enabled: true };
    const responses = await Promise.all([save(patch, progress.revision, key), save(patch, progress.revision, key)]); assert.equal(responses[0].revision, responses[1].revision);
    progress = responses.at(-1);
    await Promise.all([save({ reviewed_lessons: [lessons[6]] }, progress.revision), save({ practiced_lessons: [lessons[7]] }, progress.revision)]);
    progress = await state(); assert.ok(progress.reviewed_lessons.includes(lessons[6])); assert.ok(progress.practiced_lessons.includes(lessons[7]));
    const pair = await Promise.allSettled([save({ campaign_status: 'paused' }, progress.revision), save({ active_lesson_id: lessons[8] }, progress.revision)]);
    assert.equal(pair.filter(value => value.status === 'fulfilled').length, 1); assert.equal(pair.filter(value => value.status === 'rejected' && value.reason.code === '40001').length, 1);
  });
  await check('failed educational receipt insertion rolls back cursor, sets and first-row creation atomically', async () => {
    const progress = await state(), key = request(), before = await journalRows();
    await db.exec("create function public.qa_tutorial_receipt_failure() returns trigger language plpgsql as $$begin raise exception 'Isolated tutorial receipt failure';end$$;create trigger qa_tutorial_receipt_failure before insert on public.dc_tutorial_requests for each row execute function public.qa_tutorial_receipt_failure()");
    try {
      await assert.rejects(save({ ...cursor(lessons[9]), completed_steps: [steps.at(-2)] }, progress.revision, key), /Isolated tutorial receipt failure/);
      const b = await state(B); await assert.rejects(save({ reviewed_lessons: [lessons[0]] }, b.revision, request(), B), /Isolated tutorial receipt failure/);
    }
    finally { await db.exec('drop trigger qa_tutorial_receipt_failure on public.dc_tutorial_requests;drop function public.qa_tutorial_receipt_failure()'); }
    assert.deepEqual(await journalRows(), before);
    validate(await save({ ...cursor(lessons[9]), completed_steps: [steps.at(-2)] }, progress.revision, key));
  });
  await check('record guards prevent shrinking educational sets, rewriting request payloads or deleting progress', async () => {
    const progress = await state(); await save({ completed_steps: [steps[0]] }, progress.revision);
    const before = await journalRows();
    await assert.rejects(db.query("update public.dc_tutorial_progress set completed_steps='{}',revision=revision+1,updated_at=clock_timestamp() where company_id=$1", [companyA]), /cannot be rewritten/);
    await assert.rejects(db.query("update public.dc_tutorial_requests set payload='{}' where company_id=$1", [companyA]), /cannot be rewritten/);
    await assert.rejects(db.query('delete from public.dc_tutorial_progress where company_id=$1', [companyA]), /cannot be rewritten/);
    assert.deepEqual(await journalRows(), before);
  });
  await check('the120-per-minute bound permits exact acknowledged retries while refusing new excess requests', async () => {
    await fixture.ageTutorialReceipts(companyA); let progress = await state(); const recent = [];
    for (let index = 0; index < 120; index++) { const key = request(), patch = { completed_steps: [] }; progress = await save(patch, progress.revision, key); recent.push({ key, patch, revision: progress.revision }); }
    const rows = await journalRows(); await assert.rejects(save({ completed_steps: [] }, progress.revision), rejected(/too quickly/)); assert.deepEqual(await journalRows(), rows);
    const replay = recent[0]; validate(await save(replay.patch, replay.revision, replay.key)); assert.deepEqual(await journalRows(), rows);
  });
  await check('last256 receipts stay bounded and an evicted ancient cursor cannot rewind a newer lesson', async () => {
    await fixture.ageTutorialReceipts(companyA); let progress = await state();
    const oldRevision = progress.revision, oldKey = request(), oldPatch = { ...cursor(lessons[10]) }; progress = await save(oldPatch, oldRevision, oldKey);
    progress = await save({ ...cursor(lessons[11]) }, progress.revision);
    for (let index = 0; index < 260; index++) { if (index % 80 === 0) await fixture.ageTutorialReceipts(companyA); progress = await save({ reviewed_lessons: [] }, progress.revision); }
    assert.equal(await receiptCount(companyA), 256); assert.equal((await one('select count(*)::integer n from public.dc_tutorial_requests where request_id=$1', [oldKey])).n, 0);
    const before = await journalRows(); await assert.rejects(save(oldPatch, oldRevision, oldKey), rejected(/another device/, ['40001'])); assert.deepEqual(await journalRows(), before);
    assert.equal((await state()).active_lesson_id, lessons[11]);
  });
  await check('all educational completions, practices and mentor history award no money, stock, source progress or DH Score', async () => {
    await fixture.ageTutorialReceipts(companyA); const progress = await state();
    validate(await save({ completed_steps: steps, reviewed_lessons: lessons, practiced_lessons: lessons, skipped_lessons: lessons, seen_dialogue: dialogue, campaign_status: 'completed', commentary_enabled: true }, progress.revision));
    await fixture.assertEconomicUnchanged();
    assert.equal((await one('select status from public.dc_expeditions where id=$1', [overdueJob])).status, 'active');
    assert.equal((await one('select count(*)::integer n from public.dc_milestones where job_id=$1 and applied_at is not null', [overdueJob])).n, 0);
  });

  await fixture.assertEconomicUnchanged(); await fixture.assertSourcesUnchanged();
  const finalBodies = await fixture.functionBodies(); assert.deepEqual(finalBodies, fixture.installedBodies, 'Extension tests changed a production function body');
  if (process.argv.includes('--proof')) {
    await writeFile('/tmp/deep-claim-tutorial-baseline-bodies.json', JSON.stringify(Object.fromEntries(fixture.beforeBodies.map(row => [row.signature, row.body])), null, 2));
    await writeFile('/tmp/deep-claim-tutorial-expected-bodies.json', JSON.stringify(Object.fromEntries(finalBodies.map(row => [row.signature, row.body])), null, 2));
    await writeFile('/tmp/deep-claim-tutorial-expected-sources.json', JSON.stringify(Object.fromEntries([...fixture.sources].map(([path, source]) => [path, { sha256: createHash('sha256').update(source).digest('hex'), md5: createHash('md5').update(source).digest('hex') }])), null, 2));
    await writeFile('/tmp/deep-claim-tutorial-body-diff.json', JSON.stringify({ baseline: fixture.beforeBodies.length, current: finalBodies.length, changed: [], removed: [], added: finalBodies.filter(row => !fixture.beforeBodies.some(old => old.signature === row.signature)) }, null, 2));
    await writeFile('/tmp/deep-claim-tutorial-db-report.json', JSON.stringify({ passed: true, checks, baseline_functions: fixture.beforeBodies.length, current_functions: finalBodies.length, old_private_tables: 33, private_tables: 35, member_rpcs: 27, receipts_retained: await receiptCount(companyA), old_rows_exact: true, old_function_oids_and_bodies_exact: true, source_sha256: createHash('sha256').update(fixture.source).digest('hex'), source_md5: createHash('md5').update(fixture.source).digest('hex'), live_writes: false }, null, 2));
  }
  console.log(`${checks} independent Training Journal PostgreSQL groups passed; all153 released function bodies and every old economic record remain exact.`);
} catch (error) {
  console.error(JSON.stringify({ message: error.message, code: error.code, where: error.where, internalQuery: error.internalQuery, stack: error.stack }, null, 2)); process.exitCode = 1;
} finally { await fixture?.close(); }
