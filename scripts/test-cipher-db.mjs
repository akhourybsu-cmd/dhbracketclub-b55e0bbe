// Cipher Duel's real SQL in isolated PostgreSQL. No credentials, network or live writes.
import assert from 'node:assert/strict';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { build } from 'esbuild';

const db = new PGlite(), sources = new Map();
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A = uuid(1), B = uuid(2), C = uuid(3), OTHER = uuid(4), OUTSIDER = uuid(6), PRIVATE = uuid(7), CLUB = uuid(1001);
const colors = { R: 'red', B: 'blue', G: 'green', Y: 'yellow', P: 'purple', O: 'orange' };
const code = value => value.split('').map(letter => colors[letter]);
const secretA = code('RRBG'), secretB = code('BBOO'), wrong = code('YYYY');
let sequence = 900000, checks = 0, calculateFeedback, validateCipherView, solvePuzzle;
const request = () => uuid(++sequence);
const signatures = {
  showdown_get: ['uuid', 'boolean'], showdown_create: ['uuid', 'text', 'uuid', 'uuid'], showdown_lobby: ['text', 'jsonb', 'integer'], showdown_act: ['uuid', 'text', 'uuid'],
  showdown_create_cipher: ['uuid', 'text[]', 'uuid', 'uuid'], showdown_lock_cipher_code: ['uuid', 'text[]', 'uuid'],
  showdown_submit_cipher_guess: ['uuid', 'text[]', 'integer', 'uuid'], showdown_surrender_cipher: ['uuid', 'integer', 'uuid'],
  showdown_submit_round: ['uuid', 'integer', 'jsonb', 'integer', 'uuid', 'boolean'],
  showdown_start_study: ['uuid', 'integer', 'uuid'], showdown_submit_reconstruction: ['uuid', 'integer', 'jsonb', 'integer', 'uuid'],
};
async function actorQuery(user, sql, values = [], role = 'authenticated') {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('test.user',$1,true),set_config('test.role',$2,true)", [user ?? '', role]);
    return tx.query(sql, values);
  });
}
async function rpc(user, name, values, role = 'authenticated') {
  const types = signatures[name]; assert.ok(types, name); assert.equal(types.length, values.length);
  const result = await actorQuery(user, `select public.${name}(${types.map((type, i) => `$${i + 1}::${type}`).join(',')}) data`, values.map((value, i) => types[i] === 'jsonb' && value !== null ? JSON.stringify(value) : value), role);
  return result.rows[0].data;
}
const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
const create = (user = A, recipient = B, secret = secretA, key = request(), rematch = null) => rpc(user, 'showdown_create_cipher', [recipient, secret, key, rematch]);
const get = (user, id, start = false) => rpc(user, 'showdown_get', [id, start]);
const lock = (user, id, secret = secretB, key = request()) => rpc(user, 'showdown_lock_cipher_code', [id, secret, key]);
const guess = (user, id, pegs, expected, key = request()) => rpc(user, 'showdown_submit_cipher_guess', [id, pegs, expected, key]);
const surrender = (user, id, expected, key = request()) => rpc(user, 'showdown_surrender_cipher', [id, expected, key]);
const lobby = (user, game = 'cipher_duel') => rpc(user, 'showdown_lobby', [game, null, 30]);
async function reset() {
  await db.exec('truncate public.showdown_challenges,public.showdown_requests,public.notifications cascade');
  await db.exec("update public.clubs set status='active';update public.showdown_games set enabled=true");
  for (const [user, club] of [[A, CLUB], [B, CLUB], [C, CLUB], [OTHER, uuid(1002)]]) await db.query('insert into public.club_members(user_id,club_id) values($1,$2) on conflict(user_id) do update set club_id=excluded.club_id', [user, club]);
}
async function check(name, fn) { await reset(); await fn(); checks++; console.log(`PASS ${name}`); }
async function started() { const view = await create(); await lock(B, view.challenge.id); return view.challenge.id; }
async function solveAt(user, id, pegs, count) {
  let result;
  for (let index = 0; index < count; index++) result = await guess(user, id, index === count - 1 ? pegs : wrong, index);
  return result;
}
function publicView(detail, user) {
  assert.deepEqual(detail.rounds, []); assert.equal(detail.current_round, null);
  validateCipherView(detail.cipher, { completed: detail.challenge.status === 'completed', viewerId: user, participantIds: [A, B] });
  if (detail.challenge.status !== 'completed') {
    assert.equal(detail.cipher.results, null);
    for (const field of ['opponent_code', 'opponent_guesses', 'opponent_feedback', 'secret']) assert.equal(detail.cipher[field], undefined);
  }
  return detail.cipher;
}
/** Advance persistent clocks in this isolated owner fixture only, preserving all 72-hour durations. */
async function shiftClock(id, phase, offset) {
  await db.exec('alter table public.showdown_challenges disable trigger cipher_frozen_clocks');
  try {
    if (phase === 'invitation') await db.query("with clock as(select clock_timestamp()+$2::interval expires) update public.showdown_challenges set created_at=clock.expires-interval '72 hours',invitation_expires_at=clock.expires,expires_at=clock.expires from clock where id=$1", [id, offset]);
    else await db.query("with clock as(select clock_timestamp()+$2::interval expires) update public.showdown_challenges set created_at=clock.expires-interval '73 hours',invitation_expires_at=clock.expires-interval '1 hour',gameplay_started_at=clock.expires-interval '72 hours',gameplay_expires_at=clock.expires,expires_at=clock.expires from clock where id=$1", [id, offset]);
  } finally { await db.exec('alter table public.showdown_challenges enable trigger cipher_frozen_clocks'); }
}
async function proof() {
  for (const [path, source] of sources) assert.equal(await readFile(path, 'utf8'), source, `${path} changed during verification`);
  if (!process.argv.includes('--proof')) return;
  const rows = (await db.query("select p.oid::regprocedure::text signature,md5(p.prosrc) body_md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^(cipher_|showdown_|afterimage_|prism_)' order by signature")).rows;
  await writeFile('/tmp/cipher-expected-bodies.json', JSON.stringify(Object.fromEntries(rows.map(row => [row.signature, row.body_md5])), null, 2));
  await writeFile('/tmp/cipher-expected-sources.json', JSON.stringify(Object.fromEntries([...sources].map(([path, source]) => [path, { sha256: createHash('sha256').update(source).digest('hex'), md5: createHash('md5').update(source).digest('hex') }])), null, 2));
  const catalog = (await db.query("select game_key,rules_version,puzzle_id,puzzle_version,difficulty,md5(definition::text) definition_md5,validation->>'definitionSha256' validation_sha256,published,sealed,minimum_rotations from public.showdown_puzzles where game_key in('prism_break','afterimage') order by game_key,rules_version,puzzle_id,puzzle_version")).rows;
  assert.equal(catalog.length, 36); assert.ok(catalog.every(row => row.sealed && row.published));
  assert.equal((await one("select count(*)::int n from public.showdown_puzzles where game_key='cipher_duel'")).n, 0);
  await writeFile('/tmp/cipher-expected-catalog.json', JSON.stringify(Object.fromEntries(catalog.map(row => [`${row.game_key}/${row.rules_version}/${row.puzzle_id}/${row.puzzle_version}`, row])), null, 2));
  console.log(`PASS proof: ${rows.length} exact function bodies, ${sources.size} migration sources and ${catalog.length} preserved puzzle versions`);
}
try {
  if (process.argv.includes('--proof')) for (const path of ['/tmp/cipher-expected-bodies.json', '/tmp/cipher-expected-sources.json', '/tmp/cipher-expected-catalog.json']) await rm(path, { force: true });
  await db.exec(await readFile('scripts/fixtures/showdown-db.sql', 'utf8'));
  const migrations = await readdir('supabase/migrations');
  for (const prefix of ['20261101010000_', '20261101020000_', '20261101040000_', '20261101050000_', '20261101060000_']) {
    const matches = migrations.filter(path => path.startsWith(prefix)); assert.equal(matches.length, 1, prefix);
    const path = `supabase/migrations/${matches[0]}`, source = await readFile(path, 'utf8'); sources.set(path, source); await db.exec(source);
  }
  const built = await build({ entryPoints: ['src/lib/showdown/cipher/engine.ts', 'src/lib/showdown/prism/solver.ts'], bundle: true, platform: 'node', format: 'esm', write: false, outdir: '/tmp/cipher-db-engine', outbase: 'src/lib/showdown' });
  const load = suffix => import(`data:text/javascript;base64,${Buffer.from(built.outputFiles.find(file => file.path.endsWith(suffix)).text).toString('base64')}`);
  ({ calculateFeedback, validateCipherView } = await load('/cipher/engine.js')); ({ solvePuzzle } = await load('/prism/solver.js'));
  if (process.argv.includes('--schema-only')) { console.log('PASS Cipher migration compiles with both existing games'); await db.close(); process.exit(0); }

  await check('six prescribed feedback examples consume duplicate colors only once', async () => {
    for (const [secret, choice, exact, color_only] of [['RGBY', 'RGBY', 4, 0], ['RRBG', 'RBRY', 1, 2], ['RRBB', 'RRRR', 2, 0], ['RRBB', 'BBRR', 0, 4], ['RRRR', 'GGGG', 0, 0], ['RGBY', 'POPO', 0, 0]]) {
      assert.deepEqual((await one('select public.cipher_feedback_v1($1::text[],$2::text[]) feedback', [code(secret), code(choice)])).feedback, { exact, color_only });
    }
  });
  await check('SQL feedback matches the independent frequency oracle across all 1296 codes and duplicate-rich guesses', async () => {
    const all = [], ids = Object.values(colors);
    for (const a of ids) for (const b of ids) for (const c of ids) for (const d of ids) all.push([a, b, c, d]);
    assert.equal(all.length, 1296);
    const cases = all.flatMap(secret => [secret, [...secret].reverse(), code('RRRR'), code('RRBB'), code('RBRY'), code('POPO')].map(choice => ({ secret, choice })));
    const rows = (await db.query("select item.ordinality::int n,public.cipher_feedback_v1(array(select jsonb_array_elements_text(item.value->'secret')),array(select jsonb_array_elements_text(item.value->'choice'))) feedback from jsonb_array_elements($1::jsonb) with ordinality item(value,ordinality)", [JSON.stringify(cases)])).rows;
    assert.equal(rows.length, 7776);
    for (const row of rows) {
      const { secret, choice } = cases[row.n - 1], exact = secret.filter((color, i) => color === choice[i]).length;
      const common = ids.reduce((sum, color) => sum + Math.min(secret.filter(value => value === color).length, choice.filter(value => value === color).length), 0);
      assert.deepEqual(row.feedback, { exact, color_only: common - exact }); assert.deepEqual(row.feedback, calculateFeedback(secret, choice));
    }
  });
  await check('codes, histories and internal projection/statistics APIs have no direct member or anonymous access', async () => {
    for (const table of ['showdown_cipher_codes', 'showdown_cipher_states', 'showdown_cipher_guesses']) for (const role of ['anon', 'authenticated']) {
      assert.deepEqual(await one("select has_table_privilege($1,$2,'SELECT') r,has_table_privilege($1,$2,'INSERT') i,has_table_privilege($1,$2,'UPDATE') u,has_table_privilege($1,$2,'DELETE') d", [role, `public.${table}`]), { r: false, i: false, u: false, d: false });
      assert.equal((await one('select relrowsecurity enabled from pg_class where oid=$1::regclass', [`public.${table}`])).enabled, true);
    }
    const publicRpcs = new Set(['showdown_create', 'showdown_get', 'showdown_lobby', 'showdown_act', 'showdown_save_round', 'showdown_submit_round', 'showdown_start_study', 'showdown_save_reconstruction', 'showdown_submit_reconstruction', 'showdown_create_cipher', 'showdown_lock_cipher_code', 'showdown_submit_cipher_guess', 'showdown_surrender_cipher']);
    const functions = (await db.query("select p.proname name,p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^(cipher_|showdown_|afterimage_|prism_)'")).rows;
    assert.ok(functions.length >= 5);
    for (const row of functions) {
      assert.equal((await one("select has_function_privilege('authenticated',$1,'EXECUTE') allowed", [row.signature])).allowed, publicRpcs.has(row.name), `Member ${row.signature}`);
      assert.equal((await one("select has_function_privilege('anon',$1,'EXECUTE') allowed", [row.signature])).allowed, false, `Anonymous ${row.signature}`);
      assert.equal((await one("select has_function_privilege('service_role',$1,'EXECUTE') allowed", [row.signature])).allowed, true, `Service ${row.signature}`);
    }
    await assert.rejects(actorQuery(A, 'select * from public.showdown_cipher_codes'), /permission denied/);
    await assert.rejects(rpc(null, 'showdown_create_cipher', [B, secretA, request(), null], 'anon'), /permission denied/);
  });
  await check('only another visible active member of the same club may receive a complete valid code', async () => {
    for (const recipient of [A, OTHER, OUTSIDER, PRIVATE]) await assert.rejects(create(A, recipient));
    for (const invalid of [null, [], ['red'], ['red', 'blue', 'green', null], ['red', 'blue', 'green', 'cyan'], ['RED', 'blue', 'green', 'yellow'], [...secretA, 'red']]) await assert.rejects(create(A, B, invalid));
    await assert.rejects(create(OUTSIDER, A));
    await assert.rejects(rpc(A, 'showdown_create', [B, 'cipher_duel', request(), null]));
    assert.equal((await one('select count(*)::int n from public.showdown_challenges')).n, 0); assert.equal((await one('select count(*)::int n from public.notifications')).n, 0);
  });
  await check('the challenger locks before invitation and Cipher creates no fake puzzle rounds', async () => {
    const detail = await create(), view = publicView(detail, A), id = detail.challenge.id;
    assert.equal(detail.challenge.game_key, 'cipher_duel'); assert.equal(detail.challenge.status, 'pending'); assert.equal(view.phase, 'waiting_code'); assert.deepEqual(view.own_code, secretA);
    assert.equal(view.opponent_code_locked, false); assert.equal(view.gameplay_started_at, null); assert.equal(view.gameplay_expires_at, null);
    assert.equal(new Date(view.invitation_expires_at) - new Date(detail.challenge.created_at), 72 * 3600000);
    assert.equal((await one('select count(*)::int n from public.showdown_challenge_rounds where challenge_id=$1', [id])).n, 0);
    assert.equal((await one('select count(*)::int n from public.showdown_round_states where challenge_id=$1', [id])).n, 0);
    assert.equal((await one('select count(*)::int n from public.showdown_cipher_codes where challenge_id=$1', [id])).n, 1);
  });
  await check('generic GET cannot accept or start a recipient before their immutable code confirmation', async () => {
    const detail = await create(), id = detail.challenge.id;
    for (const start of [false, true, true]) {
      const recipient = await get(B, id, start), view = publicView(recipient, B);
      assert.equal(view.phase, 'create_code'); assert.equal(view.own_code, null); assert.equal(view.own_attempt.status, 'pending'); assert.equal(recipient.can_decline, true);
      assert.equal(recipient.challenge.players.find(player => player.user_id === B).started_at, null);
    }
    await assert.rejects(guess(A, id, secretB, 0)); await assert.rejects(surrender(A, id, 0));
    const locked = await lock(B, id), view = publicView(locked, B);
    assert.equal(locked.challenge.status, 'active'); assert.equal(view.phase, 'codebreaking'); assert.deepEqual(view.own_code, secretB); assert.equal(view.own_attempt.status, 'playing'); assert.equal(locked.can_decline, false);
    assert.equal(new Date(view.gameplay_expires_at) - new Date(view.gameplay_started_at), 72 * 3600000);
  });
  await check('locking near invitation expiry grants a fresh full 72 hours exactly once', async () => {
    const detail = await create(), id = detail.challenge.id; await shiftClock(id, 'invitation', '1 minute');
    const before = await get(A, id), originalInvite = before.cipher.invitation_expires_at;
    const locked = await lock(B, id), view = publicView(locked, B);
    assert.equal(view.invitation_expires_at, originalInvite); assert.equal(new Date(view.gameplay_expires_at) - new Date(view.gameplay_started_at), 72 * 3600000);
    assert.ok(new Date(view.gameplay_expires_at) - new Date(originalInvite) > 71 * 3600000);
    const again = await lock(B, id); assert.equal(again.cipher.gameplay_started_at, view.gameplay_started_at); assert.equal(again.cipher.gameplay_expires_at, view.gameplay_expires_at);
    await assert.rejects(db.query("update public.showdown_challenges set gameplay_started_at=gameplay_started_at+interval '1 minute',gameplay_expires_at=gameplay_expires_at+interval '1 minute',expires_at=expires_at+interval '1 minute' where id=$1", [id]), /clock|immutable|frozen|window|restart/i);
  });
  await check('code locks and create receipts are idempotent, immutable and contain no plaintext secrets', async () => {
    const key = request(), detail = await create(A, B, secretA, key), id = detail.challenge.id;
    assert.equal((await create(A, B, secretA, key)).challenge.id, id); await assert.rejects(create(A, B, secretB, key), /identity|request|code/i);
    const lockKey = request(), first = await lock(B, id, secretB, lockKey), repeated = await lock(B, id, secretB, lockKey);
    assert.equal(repeated.cipher.own_code_locked_at, first.cipher.own_code_locked_at); await assert.rejects(lock(B, id, secretA), /locked|immutable|different/i);
    await assert.rejects(lock(A, id, secretB), /locked|immutable|different|recipient/i);
    await assert.rejects(db.query('update public.showdown_cipher_codes set code=$1::text[] where challenge_id=$2 and user_id=$3', [secretB, id, A]), /immutable|locked|sealed/i);
    const receipts = (await db.query('select payload from public.showdown_requests where challenge_id=$1', [id])).rows;
    for (const row of receipts) { assert.equal(Array.isArray(row.payload.code), false); assert.equal(row.payload.code, undefined); }
    assert.equal((await one('select count(*)::int n from public.notifications')).n, 3);
    assert.equal((await one("select count(*)::int n from public.showdown_events where challenge_id=$1 and event in('ready','code_locked')", [id])).n, 2);
  });
  await check('bystanders, another club and former members cannot read secrets or mutate attempts', async () => {
    const id = await started();
    for (const user of [C, OTHER, OUTSIDER]) {
      await assert.rejects(get(user, id, true)); await assert.rejects(lock(user, id)); await assert.rejects(guess(user, id, secretB, 0)); await assert.rejects(surrender(user, id, 0));
    }
    assert.equal((await lobby(C)).challenges.length, 0); assert.equal((await lobby(OTHER)).challenges.length, 0);
  });
  await check('only own secret and aggregate own feedback are visible until both attempts end', async () => {
    const id = await started(), first = await guess(A, id, code('RBRY'), 0), own = publicView(first, A);
    assert.deepEqual(own.own_code, secretA); assert.deepEqual(own.own_guesses[0].colors, code('RBRY')); assert.deepEqual({ exact: own.own_guesses[0].exact, color_only: own.own_guesses[0].color_only }, calculateFeedback(secretB, code('RBRY')));
    assert.equal(own.own_guesses[0].positions, undefined);
    const rival = publicView(await get(B, id), B); assert.deepEqual(rival.own_code, secretB); assert.deepEqual(rival.own_guesses, []); assert.equal(rival.opponent_finished, false);
    const sealed = await guess(A, id, secretB, 1); assert.equal(publicView(sealed, A).phase, 'attempt_sealed');
    const unfinished = publicView(await get(B, id), B); assert.equal(unfinished.opponent_finished, true); assert.equal(unfinished.results, null);
  });
  await check('guess UUID retries and multiple open devices cannot duplicate or overwrite a turn', async () => {
    const id = await started(), key = request(), first = await guess(A, id, wrong, 0, key), retry = await guess(A, id, wrong, 0, key);
    assert.deepEqual(retry.cipher.own_guesses, first.cipher.own_guesses); assert.equal(retry.cipher.own_attempt.guesses_used, 1);
    await assert.rejects(guess(A, id, secretB, 0), /newer|changed|count|device/i); await assert.rejects(guess(A, id, secretB, 1, key), /identity|request/i);
    await Promise.allSettled([guess(A, id, code('RRRR'), 1), guess(A, id, code('GGGG'), 1)]);
    const after = publicView(await get(A, id), A); assert.equal(after.own_attempt.guesses_used, 2); assert.deepEqual(after.own_guesses.map(row => row.sequence), [1, 2]);
    assert.equal((await one('select count(*)::int n from public.showdown_cipher_guesses where challenge_id=$1 and user_id=$2', [id, A])).n, 2);
  });
  await check('invalid guesses and optimistic counts leave no feedback or state changes', async () => {
    const id = await started();
    for (const invalid of [null, [], ['red'], ['red', 'blue', 'green', 'cyan'], [...secretB, 'red']]) await assert.rejects(guess(A, id, invalid, 0));
    for (const expected of [null, -1, 11, 1]) await assert.rejects(guess(A, id, wrong, expected));
    const view = publicView(await get(A, id), A); assert.equal(view.own_attempt.guesses_used, 0); assert.deepEqual(view.own_guesses, []);
  });
  await check('first-guess and tenth-guess solutions are accepted, with the smaller successful count winning', async () => {
    const id = await started(); await solveAt(A, id, secretB, 1); const done = await solveAt(B, id, secretA, 10);
    assert.equal(done.challenge.status, 'completed'); assert.equal(done.challenge.winner_id, A); assert.equal(done.challenge.outcome, 'winner');
    const view = publicView(done, B); assert.deepEqual(view.results.map(row => row.attempt.guesses_used), [1, 10]);
    await assert.rejects(guess(B, id, secretA, 10), /finished|complete|sealed|terminal/i);
    assert.equal(done.record.losses, 1);
  });
  await check('ten unsuccessful guesses exhaust the attempt and no eleventh guess can be submitted', async () => {
    const id = await started(); let view;
    for (let i = 0; i < 10; i++) view = await guess(A, id, wrong, i);
    assert.equal(view.cipher.own_attempt.status, 'exhausted'); assert.equal(view.cipher.own_attempt.guesses_used, 10); assert.equal(view.cipher.phase, 'attempt_sealed');
    await assert.rejects(guess(A, id, secretB, 10), /finished|complete|sealed|terminal/i); const done = await solveAt(B, id, secretA, 8); assert.equal(done.challenge.winner_id, B);
  });
  await check('equal successful counts draw regardless of timestamps and both unsuccessful attempts also draw', async () => {
    const id = await started(); await solveAt(A, id, secretB, 3); const done = await solveAt(B, id, secretA, 3);
    assert.equal(done.challenge.outcome, 'draw'); assert.equal(done.challenge.winner_id, null); publicView(done, B);
    const second = await started(); for (let i = 0; i < 10; i++) await guess(A, second, wrong, i); const failed = await surrender(B, second, 0);
    assert.equal(failed.challenge.outcome, 'draw'); assert.equal(failed.challenge.winner_id, null);
  });
  await check('surrender is terminal, idempotent and never reveals an unfinished opponent history', async () => {
    const id = await started(), key = request(); const first = await surrender(A, id, 0, key); assert.equal(first.cipher.own_attempt.status, 'surrendered'); assert.equal(first.cipher.results, null);
    const same = await surrender(A, id, 0, key); assert.equal(same.cipher.own_attempt.finished_at, first.cipher.own_attempt.finished_at);
    await assert.rejects(guess(A, id, secretB, 0), /finished|complete|sealed|terminal/i);
    const done = await surrender(B, id, 0); assert.equal(done.challenge.outcome, 'draw'); assert.equal(publicView(done, B).results.length, 2);
  });
  await check('simultaneous terminal deliveries declare one immutable outcome and notify each member exactly once', async () => {
    const id = await started(), key = request(); await Promise.all([guess(A, id, secretB, 0, key), guess(B, id, secretA, 0)]); await guess(A, id, secretB, 0, key);
    const done = await get(A, id); assert.equal(done.challenge.outcome, 'draw'); publicView(done, A);
    assert.equal((await one("select count(*)::int n from public.showdown_events where challenge_id=$1 and event='result'", [id])).n, 2);
    await assert.rejects(db.query('update public.showdown_cipher_guesses set exact=0 where challenge_id=$1', [id]), /immutable|sealed/i);
    await assert.rejects(db.query("update public.showdown_cipher_states set status='playing' where challenge_id=$1", [id]), /immutable|sealed|terminal|closed/i);
  });
  await check('invitation and gameplay expiration are no-contest, even if one player already solved', async () => {
    const invite = await create(); await shiftClock(invite.challenge.id, 'invitation', '-1 second');
    const expired = await get(B, invite.challenge.id, true); assert.equal(expired.challenge.status, 'expired'); assert.equal(expired.cipher.phase, 'closed'); assert.equal(expired.cipher.results, null);
    const rejectedLock = await lock(B, invite.challenge.id); assert.equal(rejectedLock.challenge.status, 'expired'); assert.equal(rejectedLock.cipher.own_code, null);
    assert.equal((await one('select count(*)::int n from public.showdown_cipher_codes where challenge_id=$1', [invite.challenge.id])).n, 1);
    const id = await started(); await guess(A, id, secretB, 0); await shiftClock(id, 'gameplay', '-1 second');
    const closed = await get(B, id); assert.equal(closed.challenge.status, 'expired'); assert.equal(closed.cipher.results, null);
    assert.equal((await lobby(A)).record.played, 0); assert.equal(closed.cipher_statistics.played, 0);
    assert.equal((await one("select count(*)::int n from public.showdown_events where event='result'")).n, 0);
  });
  await check('member removal, club deactivation and private-club boundaries never award a result', async () => {
    const id = await started(); await guess(A, id, secretB, 0); await db.query('delete from public.club_members where user_id=$1', [B]);
    const closed = await get(A, id); assert.equal(closed.challenge.status, 'cancelled'); assert.equal(closed.cipher.results, null); await assert.rejects(get(B, id)); assert.equal((await lobby(A)).record.played, 0);
    await assert.rejects(create(PRIVATE, A));
    await db.query("update public.clubs set status='inactive' where id=$1", [CLUB]); await assert.rejects(get(A, id));
  });
  await check('declining or cancelling before the second code lock does not count as play', async () => {
    const first = await create(); await rpc(B, 'showdown_act', [first.challenge.id, 'decline', request()]);
    const second = await create(); await rpc(A, 'showdown_act', [second.challenge.id, 'cancel', request()]);
    assert.equal((await lobby(A)).record.played, 0);
    const id = await started(); await assert.rejects(rpc(A, 'showdown_act', [id, 'cancel', request()])); await assert.rejects(rpc(B, 'showdown_act', [id, 'decline', request()]));
  });
  await check('completed-only statistics report exact solve averages, failures, first guesses and win streaks', async () => {
    const first = await started(); await solveAt(A, first, secretB, 2); await surrender(B, first, 0);
    const second = await started(); await solveAt(A, second, secretB, 1); await solveAt(B, second, secretA, 2);
    const third = await started(); await solveAt(A, third, secretB, 3); await solveAt(B, third, secretA, 3);
    const fourth = await started(); await surrender(A, fourth, 0); await solveAt(B, fourth, secretA, 1);
    const pending = await started(); await guess(A, pending, secretB, 0);
    const stats = (await get(A, fourth)).cipher_statistics;
    assert.equal(stats.played, 4); assert.equal(stats.wins, 2); assert.equal(stats.draws, 1); assert.equal(stats.losses, 1); assert.equal(stats.solved_count, 3); assert.equal(stats.failed_count, 1);
    assert.equal(stats.successful_guesses_total, 6); assert.equal(stats.average_guesses_to_solve, 2); assert.equal(stats.best_guess_count, 1); assert.equal(stats.first_guess_solves, 1); assert.equal(stats.current_win_streak, 0); assert.equal(stats.longest_win_streak, 2);
    assert.equal((await lobby(A, 'prism_break')).record.played, 0); assert.equal((await lobby(A, 'afterimage')).record.played, 0);
  });
  await check('notifications contain no secrets and a rematch requires a fresh newly confirmed code', async () => {
    const id = await started(); await solveAt(A, id, secretB, 2); await solveAt(B, id, secretA, 3);
    const notices = (await db.query('select * from public.notifications where url=$1', [`/showdown/${id}`])).rows;
    assert.ok(notices.length >= 4); assert.ok(notices.every(row => row.type === 'showdown'));
    for (const row of notices) for (const color of Object.values(colors)) assert.equal(`${row.title} ${row.body}`.includes(color), false);
    const rematch = await create(A, B, code('GGGG'), request(), id); assert.equal(rematch.challenge.rematch_of, id); assert.deepEqual(rematch.cipher.own_code, code('GGGG')); assert.equal(rematch.cipher.phase, 'waiting_code');
    const recipient = await get(B, rematch.challenge.id, true); assert.equal(recipient.cipher.phase, 'create_code'); assert.equal(recipient.cipher.own_code, null);
  });
  await check('request identities cannot cross actors, challenges or code/guess/surrender operations', async () => {
    const createKey = request(), first = await create(A, B, secretA, createKey), id = first.challenge.id;
    await assert.rejects(create(B, A, secretB, createKey), /identity|request/i);
    await assert.rejects(lock(B, id, secretB, createKey), /identity|request/i);
    const lockKey = request(); await lock(B, id, secretB, lockKey);
    await assert.rejects(guess(B, id, wrong, 0, lockKey), /identity|request/i);
    const guessKey = request(); await guess(A, id, wrong, 0, guessKey);
    await assert.rejects(guess(B, id, wrong, 0, guessKey), /identity|request/i);
    await assert.rejects(surrender(A, id, 1, guessKey), /identity|request/i);
    const other = await started(); await assert.rejects(guess(A, other, wrong, 0, guessKey), /identity|request/i);
    const view = publicView(await get(A, id), A); assert.equal(view.own_attempt.status, 'playing'); assert.equal(view.own_attempt.guesses_used, 1);
  });
  await check('request flood limits reject new locks and guesses without breaking acknowledged retries', async () => {
    const detail = await create(), id = detail.challenge.id, lockKey = request(), guessKey = request(); await lock(B, id, secretB, lockKey); await guess(A, id, wrong, 0, guessKey);
    for (const user of [A, B]) await db.query("insert into public.showdown_requests(request_id,club_id,user_id,challenge_id,operation,payload) select gen_random_uuid(),$1,$2,$3,'fixture_flood','{}'::jsonb from generate_series(1,600)", [CLUB, user, id]);
    await assert.rejects(lock(B, id, secretB), /Too many updates/i);
    await assert.rejects(guess(A, id, secretB, 1), /Too many updates/i); await assert.rejects(surrender(A, id, 1), /Too many updates/i);
    assert.equal((await lock(B, id, secretB, lockKey)).cipher.phase, 'codebreaking');
    const retry = await guess(A, id, wrong, 0, guessKey); assert.equal(retry.cipher.own_attempt.guesses_used, 1); assert.equal(retry.cipher.own_guesses.length, 1);
  });
  await check('hourly creation limits leave existing receipt retries usable without duplicate invitations', async () => {
    const key = request(), first = await create(A, B, secretA, key);
    for (let i = 1; i < 12; i++) await create();
    await assert.rejects(create(), /Challenge limit reached/i);
    assert.equal((await create(A, B, secretA, key)).challenge.id, first.challenge.id);
    assert.equal((await one('select count(*)::int n from public.showdown_challenges')).n, 12); assert.equal((await one('select count(*)::int n from public.notifications')).n, 12);
  });
  await check('a failed invitation delivery rolls back the secret, challenge and retry receipt together', async () => {
    const key = request();
    await db.exec("create function test_cipher_inbox_failure() returns trigger language plpgsql as $$ begin raise exception 'forced Cipher inbox failure';end $$;create trigger test_cipher_inbox_failure before insert on public.notifications for each row execute function test_cipher_inbox_failure();");
    try { await assert.rejects(create(A, B, secretA, key), /forced Cipher inbox failure/); }
    finally { await db.exec('drop trigger test_cipher_inbox_failure on public.notifications;drop function test_cipher_inbox_failure();'); }
    for (const table of ['showdown_challenges', 'showdown_cipher_codes', 'showdown_cipher_states', 'showdown_requests']) assert.equal((await one(`select count(*)::int n from public.${table}`)).n, 0);
    const retried = await create(A, B, secretA, key); assert.equal(retried.cipher.phase, 'waiting_code'); assert.equal((await one('select count(*)::int n from public.notifications')).n, 1);
  });
  await check('failed ready delivery rolls back the second code and gameplay clock, then retries once', async () => {
    const detail = await create(), id = detail.challenge.id, key = request();
    await db.exec("create function test_cipher_ready_failure() returns trigger language plpgsql as $$ begin if new.event in('code_locked','ready') then raise exception 'forced Cipher ready failure';end if;return new;end $$;create trigger test_cipher_ready_failure before insert on public.showdown_events for each row execute function test_cipher_ready_failure();");
    try { await assert.rejects(lock(B, id, secretB, key), /forced Cipher ready failure/); }
    finally { await db.exec('drop trigger test_cipher_ready_failure on public.showdown_events;drop function test_cipher_ready_failure();'); }
    const before = await get(B, id); assert.equal(before.cipher.own_code, null); assert.equal(before.cipher.gameplay_started_at, null); assert.equal(before.cipher.gameplay_expires_at, null); assert.equal(before.challenge.status, 'pending');
    assert.equal((await one('select count(*)::int n from public.showdown_requests where request_id=$1', [key])).n, 0);
    await lock(B, id, secretB, key); await lock(B, id, secretB, key);
    assert.equal((await one("select count(*)::int n from public.showdown_events where challenge_id=$1 and event in('ready','code_locked')", [id])).n, 2);
  });
  await check('failed result delivery rolls back a final guess and can retry one immutable outcome', async () => {
    const id = await started(), key = request(); await guess(A, id, secretB, 0);
    await db.exec("create function test_cipher_result_failure() returns trigger language plpgsql as $$ begin if new.event='result' then raise exception 'forced Cipher result failure';end if;return new;end $$;create trigger test_cipher_result_failure before insert on public.showdown_events for each row execute function test_cipher_result_failure();");
    try { await assert.rejects(guess(B, id, secretA, 0, key), /forced Cipher result failure/); }
    finally { await db.exec('drop trigger test_cipher_result_failure on public.showdown_events;drop function test_cipher_result_failure();'); }
    const before = await get(B, id); assert.equal(before.challenge.status, 'active'); assert.equal(before.cipher.own_attempt.status, 'playing'); assert.equal(before.cipher.own_attempt.guesses_used, 0); assert.deepEqual(before.cipher.own_guesses, []); assert.equal(before.cipher.results, null);
    assert.equal((await one('select count(*)::int n from public.showdown_requests where request_id=$1', [key])).n, 0);
    const done = await guess(B, id, secretA, 0, key); await guess(B, id, secretA, 0, key); assert.equal(done.challenge.status, 'completed'); assert.equal(done.challenge.outcome, 'draw');
    assert.equal((await one("select count(*)::int n from public.showdown_events where challenge_id=$1 and event='result'", [id])).n, 2);
  });
  await check('statistics have null solve averages before any success and a positive current streak after a later win', async () => {
    const first = await started(); await surrender(A, first, 0); await surrender(B, first, 0);
    const empty = (await lobby(A)).cipher_statistics; assert.equal(empty.played, 1); assert.equal(empty.solved_count, 0); assert.equal(empty.average_guesses_to_solve, null); assert.equal(empty.best_guess_count, null); assert.equal(empty.current_win_streak, 0);
    const second = await started(); await guess(A, second, secretB, 0); await surrender(B, second, 0);
    const won = (await lobby(A)).cipher_statistics; assert.equal(won.played, 2); assert.equal(won.wins, 1); assert.equal(won.draws, 1); assert.equal(won.failed_count, 1); assert.equal(won.solved_count, 1); assert.equal(won.current_win_streak, 1); assert.equal(won.longest_win_streak, 1); assert.equal(won.first_guess_solves, 1); assert.equal(won.average_guesses_to_solve, 1); assert.equal(won.best_guess_count, 1);
    const third = await started(); await surrender(A, third, 0); await surrender(B, third, 0);
    const drawn = (await lobby(A)).cipher_statistics; assert.equal(drawn.current_win_streak, 0); assert.equal(drawn.longest_win_streak, 1);
  });
  await check('Prism and Afterimage still use their original scoring, frozen content and study workflow', async () => {
    const prism = await rpc(A, 'showdown_create', [B, 'prism_break', request(), null]), id = prism.challenge.id;
    await assert.rejects(lock(B, id)); await assert.rejects(guess(A, id, secretB, 0));
    for (const user of [A, B]) { let view = await get(user, id, true); while (view.can_play && view.current_round !== null) { const round = view.rounds[view.current_round - 1], solution = solvePuzzle(round.puzzle); assert.ok(solution.solvable); view = await rpc(user, 'showdown_submit_round', [id, round.round_number, solution.actions, round.me.revision, request(), false]); } }
    assert.deepEqual((await get(A, id)).challenge.players.map(player => player.total_score), [1500, 1500]);
    const memory = await rpc(A, 'showdown_create', [B, 'afterimage', request(), null]); assert.equal(memory.rounds[0].scene.phase, 'ready'); assert.deepEqual(memory.rounds[0].scene.objects, []);
    const study = await rpc(A, 'showdown_start_study', [memory.challenge.id, 1, request()]); assert.equal(study.rounds[0].scene.phase, 'study'); assert.equal(study.rounds[0].scene.objects.length, 9);
    assert.equal(new Date(study.rounds[0].scene.study_expires_at) - new Date(study.rounds[0].scene.study_started_at), 7000);
    assert.equal((await lobby(A)).record.played, 0);
  });
  await proof(); console.log(`PASS Cipher PostgreSQL: ${checks} integration groups`);
} catch (error) { console.error(error.stack ?? String(error)); if (error.where) console.error(error.where); if (error.internalQuery) console.error(error.internalQuery.slice(0, 4000)); process.exitCode = 1; }
finally { await db.close(); }
