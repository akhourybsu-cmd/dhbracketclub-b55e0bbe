// Executes the committed migration in disposable PostgreSQL (PGlite), never production.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const A = id(1), B = id(2), CLUB = id(10), OTHER = id(11), ASSET = id(20);
let count = 0, sequence = 100;
const check = async (name, work) => { await work(); console.log(`PASS ${name}`); count++; };
const state = (slot = 1, playtime = 0) => ({ schemaVersion: 1, slot, player: { name: 'Tavian', mapId: 'ship', x: 3, y: 4, facing: 'down' }, party: [], collection: {}, inventory: { tincture: 2 }, questFlags: {}, settings: {}, playtimeSeconds: playtime });
await db.exec(`
create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table auth.users(id uuid primary key);
create table public.clubs(id uuid primary key,status text default 'active');
create table public.club_members(user_id uuid not null references auth.users(id),club_id uuid not null references public.clubs(id));
create table public.platform_assets(id uuid primary key,slug text unique,is_active boolean default true);
create table public.club_installed_assets(club_id uuid,asset_id uuid,enabled boolean default true,visible_to_members boolean default true);
create function public.current_user_club_id() returns uuid language sql stable security definer set search_path=public as $$select club_id from club_members where user_id=auth.uid() limit 1$$;
create function public.dh_visible_club(uuid) returns boolean language sql stable as $$select true$$;
create function public.dh_visible_member(uuid) returns boolean language sql stable as $$select true$$;
create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now(); return new; end$$;
grant usage on schema public,auth to anon,authenticated;
insert into auth.users values('${A}'),('${B}');
insert into clubs values('${CLUB}'),('${OTHER}');
insert into club_members values('${A}','${CLUB}'),('${B}','${CLUB}');
insert into platform_assets values('${ASSET}','mesomon',true);
insert into club_installed_assets values('${CLUB}','${ASSET}',true,true);
`);
await db.exec(await readFile('supabase/migrations/20261125193000_mesomon.sql', 'utf8'));
await db.exec(await readFile('supabase/migrations/20261127170000_mesomon_delete_save.sql', 'utf8'));
async function actor(user, sql, args = [], role = 'authenticated') {
  return db.transaction(async tx => { await tx.exec(`set local role ${role}`); await tx.query("select set_config('test.uid',$1,true)", [user ?? '']); return tx.query(sql, args); });
}
async function save(user, value, revision = 0, request = id(++sequence), club = CLUB, expectedUser = user) {
  const result = await actor(user, 'select public.mesomon_save($1::uuid,$2::smallint,$3::bigint,$4::uuid,$5::jsonb,$6::uuid) result', [club, value.slot, revision, request, JSON.stringify(value), expectedUser]);
  return result.rows[0].result;
}
const blocked = work => assert.rejects(work, /permission denied|needs an active club|Invalid Mesomon|three Mesomon|already used|account changed/i);
let first;
await check('authenticated own slot creation and trusted initial revision', async () => {
  first = await save(A, state(), 0, id(500)); assert.equal(first.conflict, false); assert.equal(first.save.revision, 1); assert.equal(first.save.user_id, A);
});
await check('lost-response retry returns same revision and no duplicate slot', async () => {
  const retry = await save(A, state(), 0, id(500)); assert.equal(retry.replayed, true); assert.equal(retry.save.revision, 1);
  assert.equal((await db.query('select count(*)::int n from mesomon_save_slots')).rows[0].n, 1);
});
await check('request id cannot be reused for changed contents', async () => blocked(save(A, state(1, 5), 0, id(500))));
await check('CAS refuses a stale or second-device revision without changing contents', async () => {
  const stale = await save(A, state(1, 9), 0); assert.equal(stale.conflict, true); assert.equal(stale.save.state.playtimeSeconds, 0);
});
await check('matching revision increments atomically and returns server timestamp', async () => {
  const next = await save(A, state(1, 12), 1); assert.equal(next.save.revision, 2); assert.equal(next.save.playtime_seconds, 12); assert.ok(Date.parse(next.save.updated_at) >= Date.parse(first.save.updated_at));
});
await check('older request after another save cannot duplicate or regress progress', async () => {
  const response = await save(A, state(), 0, id(500)); assert.equal(response.conflict, true); assert.equal(response.save.revision, 2);
});
await check('RLS hides another account even within the same club', async () => {
  const result = await actor(B, 'select * from mesomon_save_slots'); assert.equal(result.rows.length, 0);
});
await check('second member creates a separate account-owned slot', async () => {
  const result = await save(B, state()); assert.equal(result.save.user_id, B); assert.notEqual(result.save.id, first.save.id);
});
await check('clients cannot bypass revision checks with direct writes', async () => {
  await blocked(actor(A, "update mesomon_save_slots set revision=999 where user_id=auth.uid()"));
  await blocked(actor(A, 'delete from mesomon_save_slots where user_id=auth.uid()'));
  await blocked(actor(A, "insert into mesomon_save_slots(user_id,slot,state,last_request_id) values(auth.uid(),2,'{}',gen_random_uuid())"));
});
await check('anonymous queries and RPC calls are denied', async () => {
  await blocked(actor(null, 'select * from mesomon_save_slots', [], 'anon'));
  await blocked(actor(null, "select mesomon_save($1::uuid,1::smallint,0,gen_random_uuid(),$2::jsonb,$3::uuid)", [CLUB, JSON.stringify(state()), A], 'anon'));
});
await check('foreign club ids cannot access an account-owned save', async () => blocked(save(A, state(), 2, id(++sequence), OTHER)));
await check('a queued old-session write cannot attach its state to a new account', async () => {
  await blocked(save(B, state(2), 0, id(++sequence), CLUB, A));
  assert.equal((await actor(B, 'select * from mesomon_save_slots where slot=2')).rows.length, 0);
});
await check('all three slots work and slots outside range are rejected', async () => {
  assert.equal((await save(A, state(2))).save.slot, 2); assert.equal((await save(A, state(3))).save.slot, 3);
  await blocked(save(A, state(4))); await blocked(save(A, state(0)));
});
await check('invalid schema, owner identity, arrays and oversized state are rejected', async () => {
  for (const value of [{ ...state(), schemaVersion: 2 }, { ...state(), schemaVersion: '1' }, { ...state(), playtimeSeconds: '12' }, { ...state(), player: { name: 'Other' } }, { ...state(), inventory: [] }, { ...state(), party: [1, 2, 3, 4] }, { ...state(), questFlags: { large: 'x'.repeat(140000) } }, { ...state(), playtimeSeconds: -1 }]) await blocked(save(A, value, 2));
});
await check('disabled or invisible install blocks both reads and writes', async () => {
  for (const column of ['enabled', 'visible_to_members']) {
    await db.exec(`update club_installed_assets set ${column}=false`);
    assert.equal((await actor(A, 'select * from mesomon_save_slots')).rows.length, 0); await blocked(save(A, state(), 2));
    await db.exec(`update club_installed_assets set ${column}=true`);
  }
});
await check('removed member cannot read or write private progress', async () => {
  await db.query('delete from club_members where user_id=$1', [A]); assert.equal((await actor(A, 'select * from mesomon_save_slots')).rows.length, 0); await blocked(save(A, state(), 2));
  await db.query('insert into club_members values($1,$2)', [A, CLUB]);
});
await check('inactive club blocks cloud operations without deleting saved data', async () => {
  await db.exec("update clubs set status='archived'"); await blocked(save(A, state(), 2)); assert.equal((await actor(A, 'select * from mesomon_save_slots')).rows.length, 0); await db.exec("update clubs set status='active'");
  assert.equal((await actor(A, 'select * from mesomon_save_slots')).rows.length, 3);
});
await check('competing expected revisions admit one writer and preserve the others', async () => {
  const responses = await Promise.all(Array.from({ length: 8 }, (_, index) => save(A, state(1, 100 + index), 2)));
  assert.equal(responses.filter(value => !value.conflict).length, 1); assert.equal(responses.filter(value => value.conflict).length, 7);
  assert.equal((await db.query('select revision from mesomon_save_slots where user_id=$1 and slot=1', [A])).rows[0].revision, 3);
});
await check('new user has no authority to impersonate the owner in payload fields', async () => {
  const result = await save(B, { ...state(), user_id: A, revision: 400 }, 1); assert.equal(result.save.user_id, B); assert.equal(result.save.revision, 2);
});
async function erase(user, slot, revision, club = CLUB, expected = user) {
  const result = await actor(user, 'select public.mesomon_delete_save($1::uuid,$2::smallint,$3::bigint,$4::uuid) result', [club, slot, revision, expected]);
  return result.rows[0].result;
}
await check('deletion requires the same owner, club, installed game and a valid slot', async () => {
  await blocked(erase(A, 1, 3, OTHER)); await blocked(erase(B, 1, 3, CLUB, A));
  await blocked(erase(A, 0, 3)); await blocked(erase(A, 1, -1));
  await blocked(actor(null, 'select mesomon_delete_save($1,1::smallint,3,$2)', [CLUB, A], 'anon'));
  await db.exec('update club_installed_assets set enabled=false');
  await blocked(erase(A, 1, 3));
  await db.exec('update club_installed_assets set enabled=true');
});
await check('deleting one file clears its data, retains its revision, and leaves every other file intact', async () => {
  assert.deepEqual(await erase(A, 1, 2), { deleted:false, revision:3 });
  assert.deepEqual(await erase(A, 1, 3), { deleted:true, revision:4 });
  assert.deepEqual(await erase(A, 1, 3), { deleted:true, revision:4 });
  const erased = (await actor(A, 'select state, playtime_seconds from mesomon_save_slots where slot=1')).rows[0];
  assert.equal(erased.state, null); assert.equal(erased.playtime_seconds, 0);
  assert.equal((await actor(A,'select slot from mesomon_save_slots where state is not null')).rows.length, 2);
  assert.equal((await actor(B,'select state from mesomon_save_slots where slot=1')).rows[0].state.player.name, 'Tavian');
});
await check('delayed writes and repeated deletes cannot overwrite the next journey in the slot', async () => {
  for (const revision of [0,1,2,3]) assert.equal((await save(A,state(1,190),revision)).conflict, true);
  const fresh = await save(A,state(1,0),4); assert.equal(fresh.conflict, false); assert.equal(fresh.save.revision, 5);
  assert.deepEqual(await erase(A,1,3), { deleted:false,revision:5 });
  assert.equal((await save(A,state(1,190),1)).conflict, true);
});
await check('an unsynced first chapter can be deleted even while its first upload is delayed', async () => {
  assert.deepEqual(await erase(B,3,0), { deleted:true,revision:1 });
  assert.equal((await save(B,state(3),0)).conflict, true);
  assert.equal((await save(B,state(3),1)).save.revision, 2);
});
console.log(`PASS Mesomon database: ${count} groups (PGlite serializes connections; not a native multi-session benchmark)`);
await db.close();
