// Real PostgreSQL functions and private authored content in an isolated WASM database.
// No network, credentials, player accounts or production data are accessed.
import assert from 'node:assert/strict';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { build } from 'esbuild';

const db = new PGlite();
const uuid = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const A = uuid(1), B = uuid(2), C = uuid(3), OTHER_CLUB = uuid(4), OUTSIDER = uuid(6), PRIVATE = uuid(7), CLUB = uuid(1001);
let sequence = 500000, checks = 0, library, scoreScene, solvePuzzle;
const loadedSources = new Map();
const proofPaths = {
  bodies: '/tmp/afterimage-expected-bodies.json', sources: '/tmp/afterimage-expected-sources.json', catalog: '/tmp/afterimage-expected-catalog.json',
};
const hash = (source, algorithm = 'sha256') => createHash(algorithm).update(source).digest('hex');
const requestId = () => uuid(++sequence);
const signatures = {
  showdown_create: ['uuid', 'text', 'uuid', 'uuid'], showdown_get: ['uuid', 'boolean'],
  showdown_lobby: ['text', 'jsonb', 'integer'], showdown_act: ['uuid', 'text', 'uuid'],
  showdown_start_study: ['uuid', 'integer', 'uuid'],
  showdown_save_reconstruction: ['uuid', 'integer', 'jsonb', 'integer', 'uuid'],
  showdown_submit_reconstruction: ['uuid', 'integer', 'jsonb', 'integer', 'uuid'],
  showdown_submit_round: ['uuid', 'integer', 'jsonb', 'integer', 'uuid', 'boolean'],
};
async function actorQuery(user, sql, args = [], role = 'authenticated') {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('test.user',$1,true),set_config('test.role',$2,true)", [user ?? '', role]);
    return tx.query(sql, args);
  });
}
async function rpc(user, name, args, role = 'authenticated') {
  const types = signatures[name];
  assert.ok(types, `Unknown RPC ${name}`); assert.equal(args.length, types.length);
  const result = await actorQuery(user, `select public.${name}(${types.map((type, index) => `$${index + 1}::${type}`).join(',')}) data`,
    args.map((value, index) => types[index] === 'jsonb' && value !== null ? JSON.stringify(value) : value), role);
  return result.rows[0].data;
}
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const create = (user = A, recipient = B, rematch = null, key = requestId(), game = 'afterimage') => rpc(user, 'showdown_create', [recipient, game, key, rematch]);
const get = (user, id, start = false) => rpc(user, 'showdown_get', [id, start]);
const lobby = (user, game = 'afterimage') => rpc(user, 'showdown_lobby', [game, null, 30]);
const study = (user, id, round, key = requestId()) => rpc(user, 'showdown_start_study', [id, round, key]);
const save = (user, id, round, placements, revision, key = requestId()) => rpc(user, 'showdown_save_reconstruction', [id, round, placements, revision, key]);
const submit = (user, id, round, placements, revision, key = requestId()) => rpc(user, 'showdown_submit_reconstruction', [id, round, placements, revision, key]);
const roundOf = (detail, number) => detail.rounds.find(round => round.round_number === number);
const definitionFor = round => {
  const definition = library.find(entry => entry.definition.id === round.puzzle_id && entry.definition.version === round.puzzle_version)?.definition;
  assert.ok(definition, `Missing frozen scene ${round.puzzle_id}:${round.puzzle_version}`);
  return definition;
};
const answersFor = round => definitionFor(round).slots.map(slot => ({ object_id: slot.objectId, slot_id: slot.id }));
const expectedScore = (correct, required) => Math.round(100 * correct / required) + (correct === required ? 25 : 0);
async function resetMatches() {
  await db.exec('truncate public.showdown_challenges,public.showdown_requests,public.notifications cascade');
  await db.exec("update public.clubs set status='active'; update public.showdown_games set enabled=true;");
  for (const [user, club] of [[A, CLUB], [B, CLUB], [C, CLUB], [OTHER_CLUB, uuid(1002)]]) {
    await db.query('insert into public.club_members(user_id,club_id) values($1,$2) on conflict(user_id) do update set club_id=excluded.club_id', [user, club]);
  }
}
async function check(name, fn) { await resetMatches(); await fn(); checks++; console.log(`PASS ${name}`); }
/** Only this isolated fixture owner advances persisted time. Public APIs never bypass the clock guard. */
async function expireStudy(user, id, round) {
  const guard = await one("select tgrelid::regclass::text relation from pg_trigger where tgname='afterimage_clock_guard'");
  assert.ok(guard && /^(public\.)?showdown_round_states$/.test(guard.relation));
  await db.exec('alter table public.showdown_round_states disable trigger afterimage_clock_guard');
  try {
    await db.query("with clock as(select clock_timestamp()-interval '8 seconds' started) update public.showdown_round_states s set study_started_at=clock.started,study_expires_at=clock.started+interval '7 seconds' from clock where s.challenge_id=$1 and s.user_id=$2 and s.round_number=$3", [id, user, round]);
  } finally { await db.exec('alter table public.showdown_round_states enable trigger afterimage_clock_guard'); }
}
async function recall(user, id, number) {
  await study(user, id, number); await expireStudy(user, id, number);
  const detail = await get(user, id); assert.equal(roundOf(detail, number).scene.phase, 'reconstruct'); return detail;
}
async function finish(user, id, correctCounts = [3, 4, 5]) {
  let detail = await get(user, id, true);
  while (detail.can_play && detail.current_round !== null) {
    const number = detail.current_round;
    detail = await recall(user, id, number);
    const round = roundOf(detail, number), placements = answersFor(round).slice(0, correctCounts[number - 1]);
    detail = await submit(user, id, number, placements, round.me.revision);
  }
  return detail;
}
function assertRecallPrivacy(round) {
  const scene = round.scene, definition = definitionFor(round);
  assert.ok(scene && ['reconstruct', 'submitted'].includes(scene.phase));
  assert.ok(scene.objects.every(object => !definition.missingIds.includes(object.id)));
  assert.equal(scene.objects.length, definition.objects.length - definition.missingIds.length);
  assert.equal(scene.answers, undefined); assert.equal(scene.missingIds, undefined); assert.equal(scene.distractors, undefined);
  assert.ok(scene.slots.every(slot => !Object.hasOwn(slot, 'objectId')));
  assert.ok(scene.tray.every(piece => !Object.hasOwn(piece, 'x') && !Object.hasOwn(piece, 'y') && !Object.hasOwn(piece, 'slot_id')));
  assert.equal(round.puzzle, null); assert.equal(round.minimum_rotations, null);
}
async function rejectPublication(mutate, reason) {
  const definition = structuredClone(library[0].definition);
  definition.id = `afterimage-rejected-${++sequence}`;
  mutate(definition);
  await assert.rejects(db.query('select public.afterimage_validate_v1($1::jsonb)', [JSON.stringify(definition)]), reason);
  // Valid publication metadata ensures that the trigger reaches content validation.
  await assert.rejects(db.query("insert into public.showdown_puzzles(game_key,rules_version,puzzle_id,puzzle_version,difficulty,title,definition,minimum_rotations,validation,published) values('afterimage',1,$1,1,$2,$3,$4::jsonb,null,'{\"validated\":true}',true)", [definition.id, definition.difficulty, definition.title, JSON.stringify(definition)]), reason);
}
async function verifySourcesAndExportProof() {
  for (const [path, source] of loadedSources) assert.equal(await readFile(path, 'utf8'), source, `${path} changed during verification; rerun the database suite.`);
  if (!process.argv.includes('--proof')) return;
  const rows = (await db.query("select p.oid::regprocedure::text signature,md5(p.prosrc) body_md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^(afterimage_|showdown_|prism_)' order by signature")).rows;
  assert.ok(rows.length > 0);
  const bodies = Object.fromEntries(rows.map(row => [row.signature, row.body_md5]));
  const sources = Object.fromEntries([...loadedSources].map(([path, source]) => [path, { sha256: hash(source), md5: hash(source, 'md5') }]));
  const catalogRows = (await db.query("select game_key,rules_version,puzzle_id,puzzle_version,difficulty,md5(definition::text) definition_md5,validation->>'definitionSha256' validation_sha256,published,sealed,minimum_rotations from public.showdown_puzzles where game_key in('prism_break','afterimage') order by game_key,rules_version,puzzle_id,puzzle_version")).rows;
  assert.equal(catalogRows.length, 36);
  const catalog = Object.fromEntries(catalogRows.map(row => [`${row.game_key}/${row.rules_version}/${row.puzzle_id}/${row.puzzle_version}`, row]));
  for (const [path, value] of [[proofPaths.bodies, bodies], [proofPaths.sources, sources], [proofPaths.catalog, catalog]]) await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`PASS proof artifacts: ${rows.length} function bodies, ${loadedSources.size} exact migration sources, ${catalogRows.length} frozen puzzle versions`);
}

try {
  // Failed proof runs must never leave older artifacts looking current.
  if (process.argv.includes('--proof')) for (const path of Object.values(proofPaths)) await rm(path, { force: true });
  await db.exec(await readFile('scripts/fixtures/showdown-db.sql', 'utf8'));
  const migrations = await readdir('supabase/migrations');
  for (const prefix of ['20261101010000_', '20261101020000_', '20261101040000_', '20261101050000_']) {
    const matches = migrations.filter(file => file.startsWith(prefix)); assert.equal(matches.length, 1, `Expected one migration ${prefix}`);
    const path = `supabase/migrations/${matches[0]}`, source = await readFile(path, 'utf8');
    loadedSources.set(path, source); await db.exec(source);
  }
  library = JSON.parse(await readFile('supabase/seed/afterimage-library.json', 'utf8')).map(entry => {
    const { validation: _validation, ...definition } = entry;
    return { definition };
  });
  const compiled = await build({ entryPoints: ['src/lib/showdown/afterimage/engine.ts', 'src/lib/showdown/prism/solver.ts'], bundle: true, platform: 'node', format: 'esm', write: false, outdir: '/tmp/afterimage-db-engine', outbase: 'src/lib/showdown' });
  const load = path => import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles.find(file => file.path.endsWith(path)).text).toString('base64')}`);
  ({ scoreScene } = await load('/afterimage/engine.js')); ({ solvePuzzle } = await load('/prism/solver.js'));
  if (process.argv.includes('--schema-only')) { console.log('PASS Afterimage migration stack and private authored library installed'); await db.close(); process.exit(0); }

  await check('18 published scenes retain exact authored content and difficulty counts without replacing Prism', async () => {
    const rows = (await db.query("select puzzle_id,puzzle_version,definition from public.showdown_puzzles where game_key='afterimage' and published")).rows;
    assert.equal(rows.length, 18); assert.equal(library.length, 18);
    for (const difficulty of ['easy', 'medium', 'hard']) assert.equal(rows.filter(row => row.definition.difficulty === difficulty).length, 6);
    for (const row of rows) assert.deepEqual(row.definition, library.find(entry => entry.definition.id === row.puzzle_id && entry.definition.version === row.puzzle_version).definition);
    assert.equal((await one("select count(*)::int n from public.showdown_puzzles where game_key='prism_break' and published")).n, 18);
  });

  await check('catalog, clock, placements and scores have no direct member writes or private helper reads', async () => {
    for (const table of ['showdown_puzzles', 'showdown_challenge_rounds', 'showdown_round_states', 'showdown_attempts', 'showdown_requests']) {
      for (const role of ['anon', 'authenticated']) {
        const row = await one("select has_table_privilege($1,$2,'SELECT') r,has_table_privilege($1,$2,'INSERT') i,has_table_privilege($1,$2,'UPDATE') u,has_table_privilege($1,$2,'DELETE') d", [role, `public.${table}`]);
        assert.deepEqual(row, { r: false, i: false, u: false, d: false });
      }
    }
    const publicRpcs = new Set(['showdown_create', 'showdown_get', 'showdown_lobby', 'showdown_act', 'showdown_save_round', 'showdown_submit_round', 'showdown_start_study', 'showdown_save_reconstruction', 'showdown_submit_reconstruction']);
    const helpers = (await db.query("select p.proname name,p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^(afterimage_|showdown_|prism_)'")).rows;
    assert.ok(helpers.length > 0);
    for (const helper of helpers) {
      assert.equal((await one("select has_function_privilege('anon',$1,'EXECUTE') allowed", [helper.signature])).allowed, false, `Anonymous ${helper.signature}`);
      assert.equal((await one("select has_function_privilege('authenticated',$1,'EXECUTE') allowed", [helper.signature])).allowed, publicRpcs.has(helper.name), `Member ${helper.signature}`);
      assert.equal((await one("select has_function_privilege('service_role',$1,'EXECUTE') allowed", [helper.signature])).allowed, true, `Service ${helper.signature}`);
    }
    await assert.rejects(actorQuery(A, 'update public.showdown_round_states set study_started_at=now()'), /permission denied/);
    await assert.rejects(rpc(null, 'showdown_start_study', [requestId(), 1, requestId()], 'anon'), /permission denied/);
  });

  await check('creation freezes three shared scenes and no Ready screen exposes canonical objects', async () => {
    const a = await create(), id = a.challenge.id, b = await get(B, id, true);
    assert.equal(a.challenge.game_key, 'afterimage'); assert.equal(a.challenge.rules_version, 1);
    assert.equal(new Date(a.challenge.expires_at) - new Date(a.challenge.created_at), 72 * 3600000);
    assert.deepEqual(a.rounds.map(round => [round.puzzle_id, round.puzzle_version]), b.rounds.map(round => [round.puzzle_id, round.puzzle_version]));
    assert.deepEqual(a.rounds.map(round => round.difficulty), ['easy', 'medium', 'hard']);
    for (const detail of [a, b]) {
      assert.equal(detail.current_round, 1); const first = roundOf(detail, 1);
      assert.equal(first.scene.phase, 'ready'); assert.deepEqual(first.scene.objects, []); assert.deepEqual(first.scene.slots, []); assert.deepEqual(first.scene.tray, []);
      assert.equal(first.me.study_started_at ?? first.scene.study_started_at ?? null, null);
      assert.equal(detail.rounds[1].scene ?? null, null); assert.equal(detail.rounds[2].scene ?? null, null);
    }
  });

  await check('only visible same-club participants can create, open, study or reconstruct a private challenge', async () => {
    for (const recipient of [A, OTHER_CLUB, OUTSIDER, PRIVATE]) await assert.rejects(create(A, recipient));
    const detail = await create(), id = detail.challenge.id;
    for (const user of [C, OTHER_CLUB, OUTSIDER]) {
      await assert.rejects(get(user, id)); await assert.rejects(study(user, id, 1));
      await assert.rejects(save(user, id, 1, [], 0)); await assert.rejects(submit(user, id, 1, [], 0));
    }
    assert.equal((await lobby(C)).challenges.length, 0); assert.equal((await lobby(OTHER_CLUB)).challenges.length, 0);
  });

  await check('Ready starts one exact seven-second study window and repeat requests or reload cannot restart it', async () => {
    const detail = await create(), id = detail.challenge.id, key = requestId();
    const started = await study(A, id, 1, key), first = roundOf(started, 1);
    assert.equal(first.scene.phase, 'study'); assert.equal(first.scene.objects.length, 9); assert.equal(first.me.revision, 1);
    const start = first.scene.study_started_at, end = first.scene.study_expires_at;
    assert.equal(new Date(end) - new Date(start), 7000);
    for (const retry of [await study(A, id, 1, key), await study(A, id, 1), await get(A, id, true)]) {
      const round = roundOf(retry, 1); assert.equal(round.scene.study_started_at, start); assert.equal(round.scene.study_expires_at, end); assert.equal(round.me.revision, 1);
    }
    const opponent = roundOf(await get(B, id, true), 1); assert.equal(opponent.scene.phase, 'ready'); assert.deepEqual(opponent.scene.objects, []);
    const theirStudy = roundOf(await study(B, id, 1), 1); assert.deepEqual(theirStudy.scene.objects, first.scene.objects);
    await assert.rejects(db.query('update public.showdown_round_states set study_started_at=study_started_at+interval \'1 second\',study_expires_at=study_expires_at+interval \'1 second\' where challenge_id=$1 and user_id=$2 and round_number=1', [id, A]), /clock|study|immutable/i);
  });

  await check('placements cannot be saved or submitted before Ready or before its server deadline', async () => {
    const detail = await create(), id = detail.challenge.id, answers = answersFor(roundOf(detail, 1));
    await assert.rejects(save(A, id, 1, answers, 0)); await assert.rejects(submit(A, id, 1, answers, 0));
    await study(A, id, 1); await assert.rejects(save(A, id, 1, answers, 1)); await assert.rejects(submit(A, id, 1, answers, 1));
    await assert.rejects(study(A, id, 2));
    const after = roundOf(await get(A, id), 1); assert.equal(after.me.submitted, false); assert.equal(after.me.score, null); assert.deepEqual(after.me.placements, []);
  });

  await check('expired study reads and idempotent Ready receipts never return removed canonical positions', async () => {
    const detail = await create(), id = detail.challenge.id, key = requestId(); await study(A, id, 1, key); await expireStudy(A, id, 1);
    for (const response of [await get(A, id), await get(A, id, true), await study(A, id, 1, key), await study(A, id, 1)]) {
      const round = roundOf(response, 1); assert.equal(round.scene.phase, 'reconstruct'); assertRecallPrivacy(round);
      assert.ok(new Date(round.scene.study_expires_at) <= new Date(response.server_now ?? round.scene.server_now));
      assert.equal(round.me.correct_count, null); assert.equal(round.me.perfect, null); assert.equal(round.me.score, null);
    }
  });

  await check('reconstruction saves replace, swap, remove and reset arrangements without correctness feedback', async () => {
    const detail = await create(), id = detail.challenge.id, recallView = await recall(A, id, 1);
    const answers = answersFor(roundOf(recallView, 1)); let revision = roundOf(recallView, 1).me.revision;
    const swapped = [{ ...answers[0], slot_id: answers[1].slot_id }, { ...answers[1], slot_id: answers[0].slot_id }];
    for (const placements of [answers.slice(0, 1), answers.slice(0, 2), swapped, swapped.slice(0, 1), []]) {
      const result = roundOf(await save(A, id, 1, placements, revision), 1); revision = result.me.revision;
      assert.deepEqual(result.me.placements, placements); assert.equal(result.me.correct_count, null); assert.equal(result.me.perfect, null); assert.equal(result.me.score, null); assert.equal(result.me.rotations, 0);
      const reload = roundOf(await get(A, id), 1); assert.deepEqual(reload.me.placements, placements); assertRecallPrivacy(reload);
    }
  });

  await check('duplicate save requests are idempotent and stale devices cannot overwrite a newer arrangement', async () => {
    const detail = await create(), id = detail.challenge.id, view = await recall(A, id, 1), round = roundOf(view, 1), answers = answersFor(round), key = requestId();
    const first = roundOf(await save(A, id, 1, answers.slice(0, 1), round.me.revision, key), 1);
    const retry = roundOf(await save(A, id, 1, answers.slice(0, 1), round.me.revision, key), 1); assert.deepEqual(retry.me, first.me);
    await assert.rejects(save(A, id, 1, answers.slice(0, 2), round.me.revision), /device|revision|newer|changed/i);
    await assert.rejects(save(A, id, 1, [], first.me.revision, key), /identity|request/i);
    const authoritative = roundOf(await get(A, id), 1); assert.deepEqual(authoritative.me.placements, answers.slice(0, 1)); assert.equal(authoritative.me.revision, first.me.revision);
  });

  await check('unknown object and slot IDs, duplicates, extra score fields and malformed placements are rejected', async () => {
    const detail = await create(), id = detail.challenge.id, view = await recall(A, id, 1), round = roundOf(view, 1), answers = answersFor(round), revision = round.me.revision;
    for (const invalid of [null, {}, [null], [{ object_id: 'not-in-tray', slot_id: answers[0].slot_id }], [{ object_id: answers[0].object_id, slot_id: 'not-a-slot' }],
      [answers[0], answers[0]], [answers[0], { ...answers[1], object_id: answers[0].object_id }], [answers[0], { ...answers[1], slot_id: answers[0].slot_id }], [{ ...answers[0], score: 125 }]]) {
      await assert.rejects(save(A, id, 1, invalid, revision)); await assert.rejects(submit(A, id, 1, invalid, revision));
    }
    const after = roundOf(await get(A, id), 1); assert.equal(after.me.revision, revision); assert.deepEqual(after.me.placements, []);
  });

  await check('all 18 scenes have independent TypeScript/PostgreSQL partial and perfect scoring parity', async () => {
    for (const { definition } of library) {
      const answers = definition.slots.map(slot => ({ object_id: slot.objectId, slot_id: slot.id }));
      for (let correct = 0; correct <= answers.length; correct++) {
        const placements = answers.slice(0, correct), expected = scoreScene(definition, placements);
        const sql = await one('select public.afterimage_score_v1($1::jsonb,$2::jsonb) data', [JSON.stringify(definition), JSON.stringify(placements)]);
        assert.deepEqual(sql.data, expected, `${definition.id}:${correct}`);
        assert.equal(sql.data.score, expectedScore(correct, answers.length));
      }
      if (definition.distractors.length) {
        const placements = [{ object_id: definition.distractors[0].id, slot_id: definition.slots[0].id }];
        assert.deepEqual((await one('select public.afterimage_score_v1($1::jsonb,$2::jsonb) data', [JSON.stringify(definition), JSON.stringify(placements)])).data, scoreScene(definition, placements));
      }
    }
  });

  await check('all 18 public scene projections expose original positions only inside study or completed review', async () => {
    for (const { definition } of library) {
      for (const phase of ['ready', 'study', 'reconstruct', 'submitted', 'review']) {
        const started = phase === 'ready' ? null : '2026-11-01T00:00:00.000Z';
        const expires = phase === 'ready' ? null : '2026-11-01T00:00:07.000Z';
        const serverNow = phase === 'study' ? '2026-11-01T00:00:01.000Z' : '2026-11-01T00:00:08.000Z';
        const scene = (await one('select public.afterimage_scene_view_v1($1::jsonb,$2::timestamptz,$3::timestamptz,$4,$5,$6::timestamptz) data', [JSON.stringify(definition), started, expires, phase === 'submitted' || phase === 'review', phase === 'review', serverNow])).data;
        assert.equal(scene.phase, phase);
        assert.equal(scene.missingIds, undefined); assert.equal(scene.distractors, undefined); assert.equal(scene.trayOrder, undefined);
        if (phase === 'ready') { assert.deepEqual(scene.objects, []); assert.deepEqual(scene.slots, []); assert.deepEqual(scene.tray, []); }
        else if (phase === 'study') { assert.deepEqual(scene.objects, definition.objects); assert.deepEqual(scene.slots, []); assert.deepEqual(scene.tray, []); assert.equal(scene.answers, undefined); }
        else if (phase === 'review') { assert.deepEqual(scene.objects, definition.objects); assert.deepEqual(scene.answers, definition.slots.map(slot => ({ object_id: slot.objectId, slot_id: slot.id }))); }
        else {
          assert.ok(scene.objects.every(object => !definition.missingIds.includes(object.id)));
          assert.ok(scene.slots.every(slot => !Object.hasOwn(slot, 'objectId')));
          assert.ok(scene.tray.every(piece => !Object.hasOwn(piece, 'x') && !Object.hasOwn(piece, 'y'))); assert.equal(scene.answers, undefined);
        }
      }
    }
  });

  await check('all submitted correct-count combinations earn exact scores while one final placement is immutable', async () => {
    // Six real matches cover every correct count in each of the 3/4/5-slot rounds.
    for (let sample = 0; sample < 6; sample++) {
      const detail = await create(), id = detail.challenge.id, counts = [sample % 4, sample % 5, sample % 6];
      const done = await finish(A, id, counts);
      let total = 0;
      for (const round of done.rounds) {
        const correct = counts[round.round_number - 1], required = definitionFor(round).missingIds.length;
        assert.equal(round.me.score, expectedScore(correct, required)); assert.equal(round.me.correct_count, correct); assert.equal(round.me.perfect, correct === required); total += round.me.score;
        const same = await submit(A, id, round.round_number, round.me.placements, 0);
        assert.equal(roundOf(same, round.round_number).me.score, round.me.score);
        const different = correct === required ? [] : answersFor(round);
        await assert.rejects(submit(A, id, round.round_number, different, round.me.revision), /submitted|sealed|complete/i);
        await assert.rejects(save(A, id, round.round_number, different, round.me.revision), /submitted|sealed|complete/i);
      }
      assert.equal(done.challenge.players.find(player => player.user_id === A).total_score, total);
    }
  });

  await check('the first finished player cannot disclose scores, placements or originals to the unfinished rival', async () => {
    const detail = await create(), id = detail.challenge.id, finished = await finish(A, id);
    assert.equal(finished.current_round, null); assert.equal(finished.challenge.players.find(player => player.user_id === A).total_score, 375);
    for (const round of finished.rounds) { assert.equal(round.opponent, null); assertRecallPrivacy(round); }
    const rival = await get(B, id, true), hidden = rival.challenge.players.find(player => player.user_id === A);
    assert.equal(hidden.total_score, null); assert.equal(hidden.perfect_count, null);
    for (const round of rival.rounds) assert.equal(round.opponent, null);
    assert.equal(roundOf(rival, 1).scene.phase, 'ready'); assert.deepEqual(roundOf(rival, 1).scene.objects, []);
    assert.equal(roundOf(rival, 2).scene ?? null, null);
    const listing = await lobby(B); assert.equal(listing.challenges[0].players.find(player => player.user_id === A).total_score, null);
  });

  await check('two perfect attempts produce 375 each, a legitimate draw and a complete read-only review', async () => {
    const detail = await create(), id = detail.challenge.id; await finish(A, id); const done = await finish(B, id);
    assert.equal(done.challenge.status, 'completed'); assert.equal(done.challenge.outcome, 'draw'); assert.equal(done.challenge.winner_id, null);
    assert.deepEqual(done.challenge.players.map(player => player.total_score), [375, 375]); assert.deepEqual(done.challenge.players.map(player => player.perfect_count), [3, 3]);
    for (const round of done.rounds) {
      assert.equal(round.me.score, 125); assert.equal(round.opponent.score, 125); assert.equal(round.scene.phase, 'review');
      assert.deepEqual(round.scene.objects, definitionFor(round).objects); assert.deepEqual(round.scene.answers, answersFor(round));
    }
    assert.equal(done.record.draws, 1); assert.equal(done.rivalry.draws, 1);
    assert.equal((await one("select count(*)::int n from public.showdown_events where event='result'")).n, 2);
    await assert.rejects(db.query('update public.showdown_round_states set score=0 where challenge_id=$1 and user_id=$2 and round_number=1', [id, A]), /sealed|immutable/i);
    await assert.rejects(db.query('update public.showdown_attempts set total_score=0 where challenge_id=$1 and user_id=$2', [id, A]), /sealed|immutable/i);
  });

  await check('the higher total wins and Afterimage records and standings stay scoped to their game', async () => {
    const detail = await create(), id = detail.challenge.id; await finish(A, id); const done = await finish(B, id, [2, 3, 4]);
    assert.equal(done.challenge.winner_id, A); assert.equal(done.challenge.outcome, 'winner');
    assert.deepEqual(done.challenge.players.map(player => player.total_score), [375, 222]);
    const listing = await lobby(A); assert.equal(listing.record.wins, 1); assert.equal(listing.standings.find(player => player.user_id === A).points, 3);
    assert.equal((await lobby(A, 'prism_break')).record.played, 0);
    assert.equal(listing.rivalries.find(player => player.opponent_id === B).played, 1);
  });

  await check('empty final reconstructions earn zero without trapping players or leaking future content', async () => {
    const detail = await create(), id = detail.challenge.id; await finish(A, id, [0, 0, 0]); const done = await finish(B, id, [0, 0, 0]);
    assert.equal(done.challenge.outcome, 'draw'); assert.deepEqual(done.challenge.players.map(player => player.total_score), [0, 0]);
    assert.deepEqual(done.challenge.players.map(player => player.perfect_count), [0, 0]);
    assert.ok(done.rounds.every(round => round.me.correct_count === 0 && round.me.score === 0 && !round.me.perfect));
  });

  await check('simultaneous final deliveries complete once with one shared outcome and two result notifications', async () => {
    const detail = await create(), id = detail.challenge.id;
    for (const user of [A, B]) {
      await get(user, id, true);
      for (const number of [1, 2]) { const view = await recall(user, id, number), round = roundOf(view, number); await submit(user, id, number, answersFor(round), round.me.revision); }
      await recall(user, id, 3);
    }
    const a = roundOf(await get(A, id), 3), b = roundOf(await get(B, id), 3), key = requestId();
    await Promise.all([submit(A, id, 3, answersFor(a), a.me.revision, key), submit(B, id, 3, answersFor(b), b.me.revision)]);
    await submit(A, id, 3, answersFor(a), a.me.revision, key);
    const done = await get(A, id); assert.equal(done.challenge.status, 'completed'); assert.equal(done.challenge.outcome, 'draw');
    assert.equal((await one("select count(*)::int n from public.showdown_events where event='result'")).n, 2);
    assert.equal((await one('select count(*)::int n from public.showdown_attempts where challenge_id=$1 and finished_at is not null', [id])).n, 2);
  });

  await check('expired challenges close without results and cannot expose an in-progress original study', async () => {
    const detail = await create(), id = detail.challenge.id; await study(A, id, 1);
    await db.query("update public.showdown_challenges set created_at=now()-interval '73 hours',expires_at=now()-interval '1 hour' where id=$1", [id]);
    const expired = await get(A, id); assert.equal(expired.challenge.status, 'expired'); assert.equal(expired.can_play, false);
    for (const round of expired.rounds) assert.notEqual(round.scene?.phase, 'study');
    const closed = await submit(A, id, 1, [], 1); assert.equal(closed.challenge.status, 'expired');
    assert.equal((await lobby(A)).record.played, 0); assert.equal((await one("select count(*)::int n from public.showdown_events where event='result'")).n, 0);
  });

  await check('member removal cancels an active study and former members cannot read or submit it', async () => {
    const detail = await create(), id = detail.challenge.id; await study(A, id, 1);
    await db.query('delete from public.club_members where user_id=$1', [B]);
    const cancelled = await get(A, id); assert.equal(cancelled.challenge.status, 'cancelled'); assert.equal(cancelled.can_play, false);
    for (const round of cancelled.rounds) assert.notEqual(round.scene?.phase, 'study');
    await assert.rejects(get(B, id)); await assert.rejects(study(B, id, 1));
    assert.equal((await lobby(A)).record.played, 0);
  });

  await check('declines and cancellations do not count as play and rematches freeze alternative scene versions', async () => {
    const declined = await create(); await rpc(B, 'showdown_act', [declined.challenge.id, 'decline', requestId()]);
    const cancelled = await create(); await rpc(A, 'showdown_act', [cancelled.challenge.id, 'cancel', requestId()]); assert.equal((await lobby(A)).record.played, 0);
    const match = await create(), id = match.challenge.id; await finish(A, id); await finish(B, id);
    const rematch = await create(A, B, id), oldIds = new Set(match.rounds.map(round => `${round.puzzle_id}:${round.puzzle_version}`));
    assert.equal(rematch.challenge.rematch_of, id); assert.ok(rematch.rounds.every(round => !oldIds.has(`${round.puzzle_id}:${round.puzzle_version}`)));
    const notices = (await db.query('select * from public.notifications where url=$1', [`/showdown/${rematch.challenge.id}`])).rows;
    assert.equal(notices.length, 1); assert.equal(notices[0].user_id, B); assert.equal(notices[0].type, 'showdown'); assert.match(notices[0].title, /afterimage.*rematch/i); assert.match(notices[0].body ?? '', /72 hours/i);
  });

  await check('request identities cannot be reused by another actor or different reconstruction operation', async () => {
    const detail = await create(), id = detail.challenge.id, key = requestId(); await study(A, id, 1, key);
    await assert.rejects(study(B, id, 1, key), /identity|request/i);
    await expireStudy(A, id, 1); const view = await get(A, id), round = roundOf(view, 1);
    await assert.rejects(save(A, id, 1, answersFor(round), round.me.revision, key), /identity|request/i);
    await assert.rejects(study(C, id, 1, key));
    assert.equal(roundOf(await get(B, id, true), 1).scene.phase, 'ready');
  });

  await check('published scene snapshots and their historical versions remain immutable', async () => {
    const row = (await db.query("select * from public.showdown_puzzles where game_key='afterimage' and published order by puzzle_id limit 1")).rows[0];
    const args = [row.game_key, row.rules_version, row.puzzle_id, row.puzzle_version];
    await assert.rejects(db.query("update public.showdown_puzzles set definition=definition||'{\"title\":\"rewritten\"}'::jsonb where game_key=$1 and rules_version=$2 and puzzle_id=$3 and puzzle_version=$4", args), /immutable|sealed|published/i);
    await assert.rejects(db.query('delete from public.showdown_puzzles where game_key=$1 and rules_version=$2 and puzzle_id=$3 and puzzle_version=$4', args), /immutable|sealed|published/i);
    const detail = await create(); await assert.rejects(db.query("update public.showdown_challenge_rounds set definition='{}' where challenge_id=$1", [detail.challenge.id]), /sealed|immutable/i);
  });

  await check('invalid authored scenes cannot be published into the authoritative catalog', async () => {
    await rejectPublication(definition => { definition.slots[0].objectId = 'not-in-scene'; }, /Invalid reconstruction slot/i);
    assert.equal((await one("select count(*)::int n from public.showdown_puzzles where game_key='afterimage' and published")).n, 18);
  });

  await check('publication rejects malformed or mismatched slot layers instead of coercing them', async () => {
    for (const layer of [null, '1', -1, 1.5, 101]) await rejectPublication(definition => { definition.slots[0].layer = layer; }, /Invalid reconstruction slot/i);
    await rejectPublication(definition => { delete definition.slots[0].layer; }, /Invalid reconstruction slot/i);
    await rejectPublication(definition => { definition.slots[0].layer = definition.slots[0].layer + 1; }, /Slot does not match/i);
  });

  await check('publication rejects case-normalized duplicate labels and whitespace-only variants', async () => {
    await rejectPublication(definition => { definition.objects[1].label = ` ${definition.objects[0].label.toUpperCase()} `; }, /ambiguous scene object/i);
    for (const variant of ['   ', '\t \n', '', null, 5, 'v'.repeat(41)]) await rejectPublication(definition => { definition.objects[0].variant = variant; }, /Invalid object variant/i);
  });

  await check('publication rejects missing, empty, oversized and unexpected accessibility fields', async () => {
    for (const a11y of [null, {}, { label: '', instructions: 'Restore the scene.' }, { label: '\t \n', instructions: 'Restore the scene.' }, { label: 'x'.repeat(161), instructions: 'Restore.' }, { label: 'Workshop', instructions: 'x'.repeat(321) }, { label: 'Workshop', instructions: 'Restore.', solution: 'secret' }]) {
      await rejectPublication(definition => { definition.a11y = a11y; }, /Invalid scene accessibility text/i);
    }
  });

  await check('persisted study clocks reject missing endpoints and any interval other than seven seconds', async () => {
    const detail = await create(), id = detail.challenge.id;
    for (const [started, expires] of [['clock_timestamp()', 'null'], ['null', 'clock_timestamp()'], ['now()', "now()+interval '6 seconds'"], ['now()', "now()+interval '8 seconds'"]]) {
      await assert.rejects(db.query(`update public.showdown_round_states set study_started_at=${started},study_expires_at=${expires} where challenge_id=$1 and user_id=$2 and round_number=1`, [id, A]), /afterimage_study_interval/i);
    }
    const before = roundOf(await get(A, id), 1); assert.equal(before.scene.phase, 'ready'); assert.equal(before.me.revision, 0);
    await study(A, id, 1);
    await assert.rejects(db.query('update public.showdown_round_states set study_expires_at=null where challenge_id=$1 and user_id=$2 and round_number=1', [id, A]), /study window cannot be restarted/i);
    const after = roundOf(await get(A, id), 1); assert.equal(after.scene.phase, 'study'); assert.equal(new Date(after.scene.study_expires_at) - new Date(after.scene.study_started_at), 7000);
  });

  await check('Prism Break retains its original beam replay, 1500 maximum and rotation-based rules', async () => {
    const detail = await create(A, B, null, requestId(), 'prism_break'), id = detail.challenge.id;
    await assert.rejects(study(A, id, 1)); await assert.rejects(save(A, id, 1, [], 0));
    for (const user of [A, B]) {
      let view = await get(user, id, true);
      while (view.can_play && view.current_round !== null) {
        const round = roundOf(view, view.current_round), solved = solvePuzzle(round.puzzle);
        assert.ok(solved.solvable && !solved.exhausted);
        view = await rpc(user, 'showdown_submit_round', [id, round.round_number, solved.actions, round.me.revision, requestId(), false]);
      }
    }
    const done = await get(A, id); assert.equal(done.challenge.outcome, 'draw'); assert.deepEqual(done.challenge.players.map(player => player.total_score), [1500, 1500]);
    assert.ok(done.rounds.every(round => round.me.score === 500 && round.opponent.score === 500)); assert.equal((await lobby(A)).record.played, 0);
  });

  await verifySourcesAndExportProof();
  console.log(`PASS Afterimage PostgreSQL: ${checks} integration groups`);
} catch (error) {
  console.error(error.stack ?? String(error));
  if (error.where) console.error(error.where);
  if (error.internalQuery) console.error(error.internalQuery.slice(0, 4000));
  process.exitCode = 1;
} finally { await db.close(); }
