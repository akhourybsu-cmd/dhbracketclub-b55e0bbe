// Runs the released SQL against disposable PostgreSQL in PGlite. No network,
// application account, production credentials or production records are used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

process.on('uncaughtException', error => {
  console.error(error.message);
  if (error.code) console.error(`SQLSTATE ${error.code}`);
  if (error.where) console.error(error.where);
  process.exit(1);
});

const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CLUB = id(10), OTHER_CLUB = id(11), PRIVATE_CLUB = id(12);
const HOST = id(1), B = id(2), C = id(3), OTHER = id(4), ADMIN = id(5), PRIVATE = id(7);
let sequence = 100000, checks = 0;
const request = () => id(++sequence);
const config = { version: 1, template_id: 'breakfast', slots: [
  { id: 'drink', label: 'Drink', description: 'Something to drink.' },
  { id: 'main', label: 'Entrée' },
] };
const payload = (topic = 'Most complete breakfast') => ({ topic, description: 'Build your breakfast.', ai_context: 'Food and drink.', lineup_config: config });
const check = async (label, work) => { await work(); checks++; console.log(`PASS ${label}`); };
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const all = async (sql, args = []) => (await db.query(sql, args)).rows;
async function actorQuery(user, sql, args = [], role = 'authenticated') {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('test.user',$1,true),set_config('test.role',$2,true)", [user || '', role]);
    return tx.query(sql, args);
  });
}
async function action(user, draft, name, value = {}, key = request(), club = CLUB, role = 'authenticated') {
  const result = await actorQuery(user, 'select public.draft_lineup_action($1::uuid,$2::uuid,$3::uuid,$4::text,$5::jsonb) result',
    [club, draft, key, name, JSON.stringify(value)], role);
  return result.rows[0].result;
}
const create = (topic, key = request(), user = HOST, club = CLUB) => action(user, null, 'create', payload(topic), key, club);
const rowsFor = (table, draft) => all(`select * from public.${table} where draft_id=$1 order by ${table === 'draft_picks' ? 'pick_number' : 'id'}`, [draft]);
const get = draft => one('select * from public.drafts where id=$1', [draft]);
const expectBlocked = (work, pattern = /required|unavailable|locked|cannot|Use the|another player|already|not enabled|not accepting|not have|no skipped|complete|Cancel|Check|Invalid|Choose|Enter|plain text|extra fields|too many|finish|full/i) => assert.rejects(work, pattern);
const migrationPath = 'supabase/migrations/20261112190000_draft_lineup.sql';

await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
  create function auth.role() returns text language sql stable as $$select nullif(current_setting('test.role',true),'')$$;
  create table public.clubs(id uuid primary key,name text not null,status text not null default 'active');
  create table public.profiles(id uuid primary key,display_name text not null);
  create table public.club_members(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),user_id uuid not null unique references public.profiles(id),role text not null default 'member');
  create table public.dh_private_accounts(user_id uuid primary key references public.profiles(id),workspace_id uuid not null unique references public.clubs(id));
  create function public.current_user_club_id() returns uuid language sql stable security definer set search_path=public as $$select club_id from public.club_members where user_id=auth.uid()$$;
  create function public.dh_public_member(uid uuid) returns boolean language sql stable security definer set search_path=public as $$select not exists(select 1 from public.dh_private_accounts where user_id=uid)$$;
  create function public.dh_visible_member(uid uuid) returns boolean language sql stable security definer set search_path=public as $$select uid=auth.uid() or public.dh_public_member(uid)$$;
  create function public.dh_visible_club(cid uuid) returns boolean language sql stable security definer set search_path=public as $$select not exists(select 1 from public.dh_private_accounts where workspace_id=cid) or exists(select 1 from public.dh_private_accounts where workspace_id=cid and user_id=auth.uid())$$;
  create function public.is_app_admin(uid uuid) returns boolean language sql stable as $$select uid='${ADMIN}'::uuid$$;
  create function public.is_club_admin(uid uuid,cid uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.club_members where user_id=uid and club_id=cid and role='admin')$$;
  create table public.platform_assets(id uuid primary key default gen_random_uuid(),slug text not null unique,is_active boolean not null default true);
  create table public.club_installed_assets(club_id uuid references public.clubs(id),asset_id uuid references public.platform_assets(id),enabled boolean not null default true,visible_to_members boolean not null default true,primary key(club_id,asset_id));
  create table public.competitions(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),created_by uuid not null references public.profiles(id),type text not null check(type in('draft','poll','ranking','bracket_pool')),title text not null,description text,status text not null default 'active' check(status in('active','closed','archived')));
  create table public.drafts(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),competition_id uuid not null references public.competitions(id) on delete cascade,created_by uuid not null references public.profiles(id),topic text not null,category text,ai_context text,ai_context_override text,num_rounds integer not null default 5,status text not null default 'setup' check(status in('setup','in_progress','complete')),is_live boolean not null default false,current_pick_number integer not null default 1,current_round integer not null default 1,current_pick_user_id uuid references public.profiles(id),pick_deadline_at timestamptz,clock_started_at timestamptz,clock_paused_at timestamptz,created_at timestamptz not null default now());
  create table public.draft_participants(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),draft_id uuid not null references public.drafts(id) on delete cascade,user_id uuid not null references public.profiles(id),pick_order integer not null,unique(draft_id,user_id),unique(draft_id,pick_order));
  create table public.draft_picks(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),draft_id uuid not null references public.drafts(id) on delete cascade,user_id uuid not null references public.profiles(id),pick_text text not null,pick_number integer not null,round integer not null,picked_at timestamptz not null default now(),unique(draft_id,round,pick_number));
  create table public.draft_skips(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),draft_id uuid not null references public.drafts(id) on delete cascade,user_id uuid not null references public.profiles(id),pick_number integer not null,round integer not null,unique(draft_id,pick_number));
  create table public.draft_results(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),draft_id uuid not null references public.drafts(id),user_id uuid not null references public.profiles(id),total_score numeric not null,rank integer not null,pick_ratings jsonb default '[]',unique(draft_id,user_id));
  create table public.draft_seasons(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),commissioner_user_id uuid references public.profiles(id));
  create table public.draft_season_entries(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),draft_id uuid not null unique references public.drafts(id),season_id uuid not null references public.draft_seasons(id),is_playoff boolean not null default false);
  create function public.draft_commissioner_can_manage(sid uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.draft_seasons where id=sid and commissioner_user_id=auth.uid() and club_id=public.current_user_club_id())$$;
  create table public.item_enrichments(id uuid primary key default gen_random_uuid(),item_id uuid not null,item_type text not null,image_url text);
  create table public.activity_feed(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),actor_user_id uuid not null references public.profiles(id),event_type text not null,target_type text,target_id uuid,metadata jsonb);
  create table public.notifications(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),user_id uuid not null references public.profiles(id),actor_user_id uuid references public.profiles(id),type text not null,title text not null,body text,url text,created_at timestamptz not null default now());
  grant usage on schema public,auth to anon,authenticated,service_role;
  grant all on all tables in schema public to authenticated,service_role;
  do $$declare t text;begin foreach t in array array['drafts','draft_participants','draft_picks','draft_skips','draft_results'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy legacy_club_write on public.%I for all to authenticated using(club_id=public.current_user_club_id()) with check(club_id=public.current_user_club_id())',t);
  end loop;end$$;
  insert into public.clubs(id,name) values('${CLUB}','Club A'),('${OTHER_CLUB}','Club B'),('${PRIVATE_CLUB}','Private workspace');
  insert into public.profiles(id,display_name) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Member '||n from generate_series(1,9) n;
  insert into public.club_members(club_id,user_id,role) values('${CLUB}','${HOST}','member'),('${CLUB}','${B}','member'),('${CLUB}','${C}','member'),('${OTHER_CLUB}','${OTHER}','member'),('${CLUB}','${ADMIN}','admin'),('${PRIVATE_CLUB}','${PRIVATE}','admin');
  insert into public.dh_private_accounts values('${PRIVATE}','${PRIVATE_CLUB}');
  insert into public.platform_assets(id,slug) values('${id(100)}','draft-arena');
  insert into public.club_installed_assets(club_id,asset_id) values('${CLUB}','${id(100)}'),('${OTHER_CLUB}','${id(100)}'),('${PRIVATE_CLUB}','${id(100)}');
  insert into public.competitions(id,club_id,created_by,type,title) values('${id(2000)}','${CLUB}','${HOST}','draft','Classic fixture'),('${id(2002)}','${CLUB}','${HOST}','draft','Live fixture');
  insert into public.drafts(id,club_id,competition_id,created_by,topic) values('${id(2001)}','${CLUB}','${id(2000)}','${HOST}','Classic fixture');
  insert into public.drafts(id,club_id,competition_id,created_by,topic,is_live) values('${id(2003)}','${CLUB}','${id(2002)}','${HOST}','Live fixture',true);
`);
await db.exec(await readFile('supabase/migrations/20260928014750_3e1e1654-2c44-4f07-a473-d988c52a84ce.sql', 'utf8'));
await db.exec(await readFile('supabase/migrations/20260805164934_d05907f6-0f57-4c49-95fd-6fbee7717520.sql', 'utf8'));
await db.exec(await readFile('supabase/migrations/20260805165005_b882be53-529a-4a87-b4d4-c901f1cc2f6f.sql', 'utf8'));
const duplicateBefore = (await one("select pg_get_functiondef('public.guard_draft_pick_duplicates()'::regprocedure) body")).body;
const source = await readFile(migrationPath, 'utf8');
await check('forward migration applies and repeats without touching classic or live records', async () => {
  await db.exec(source); await db.exec(source);
  const drafts = await all('select id,topic,status,is_live,draft_format,lineup_config from public.drafts order by id');
  assert.equal(drafts.length, 2); assert.deepEqual(drafts.map(row => row.draft_format), ['classic','classic']);
  assert.deepEqual(drafts.map(row => row.lineup_config), [null,null]);
  assert.deepEqual(drafts.map(row => row.status), ['setup','setup']);
  assert.deepEqual(drafts.map(row => row.is_live), [false,true]);
  assert.equal((await one("select pg_get_functiondef('public.guard_draft_pick_duplicates()'::regprocedure) body")).body, duplicateBefore);
});

await check('versioned slot validator rejects malformed and ambiguous configurations', async () => {
  const valid = async value => (await one('select public.draft_lineup_valid_config($1::jsonb) valid', [JSON.stringify(value)])).valid;
  assert.equal(await valid(config), true);
  for (const value of [null, {}, [], { ...config, version: '1' }, { ...config, template_id: 'Not a key' },
    { ...config, slots: [config.slots[0]] }, { ...config, slots: Array.from({ length: 21 }, (_, n) => ({ id: `slot-${n}`, label: 'Slot' })) },
    { ...config, slots: [config.slots[0], config.slots[0]] }, { ...config, slots: [config.slots[0], { id: 'new', label: ' ' }] },
    { ...config, slots: [config.slots[0], { id: 'new', label: 'x'.repeat(37) }] },
    { ...config, slots: [config.slots[0], { id: 'new', label: ' New ' }] },
    { ...config, slots: [config.slots[0], { id: 'new', label: 'New', description: null }] },
    { ...config, unexpected: true }]) assert.equal(await valid(value), false, JSON.stringify(value));
});

await check('only authenticated members can execute actions; receipts have no client access', async () => {
  const privileges = await one(`select has_function_privilege('anon','public.draft_lineup_action(uuid,uuid,uuid,text,jsonb)','execute') anonymous,
    has_function_privilege('authenticated','public.draft_lineup_action(uuid,uuid,uuid,text,jsonb)','execute') member,
    has_table_privilege('authenticated','public.draft_lineup_receipts','select') receipts_read,
    has_table_privilege('authenticated','public.draft_lineup_receipts','insert') receipts_write`);
  assert.deepEqual(privileges, { anonymous: false, member: true, receipts_read: false, receipts_write: false });
  await expectBlocked(() => create('Unauthorized', request(), null));
  await assert.rejects(() => action(null, null, 'create', payload(), request(), CLUB, 'anon'), /permission denied/i);
  await expectBlocked(() => create('Wrong club', request(), OTHER));
  await expectBlocked(() => create('No membership', request(), id(9)));
});

let main, createKey;
await check('company-free atomic creation freezes one validated lineup and autojoins its host', async () => {
  createKey = request(); const result = await create('Breakfast builders', createKey); main = result.draft_id;
  assert.deepEqual(result, { draft_id: main, action: 'create', replayed: false });
  const d = await get(main); assert.equal(d.draft_format, 'lineup'); assert.equal(d.num_rounds, 2);
  assert.deepEqual(d.lineup_config, config); assert.equal(d.is_live, false); assert.equal(d.status, 'setup');
  assert.equal((await rowsFor('draft_participants', main)).length, 1);
  assert.equal((await one('select status from public.competitions where id=$1', [d.competition_id])).status, 'active');
  assert.equal((await one("select count(*)::integer n from public.activity_feed where target_id=$1 and event_type='draft_created'", [main])).n, 1);
  const retry = await create('Breakfast builders', createKey); assert.equal(retry.draft_id, main); assert.equal(retry.replayed, true);
  await expectBlocked(() => create('Changed payload', createKey), /different action/i);
  assert.equal((await one('select count(*)::integer n from public.draft_lineup_receipts where actor_user_id=$1 and request_id=$2', [HOST, createKey])).n, 1);
});

await check('invalid setup rolls back every write and rejects client-owned score fields', async () => {
  const before = await one('select (select count(*) from public.drafts) drafts,(select count(*) from public.competitions) competitions');
  await expectBlocked(() => action(HOST, null, 'create', { ...payload(), topic: 'x'.repeat(101) }));
  await expectBlocked(() => action(HOST, null, 'create', { ...payload(), lineup_config: { ...config, slots: [config.slots[0]] } }));
  await expectBlocked(() => action(HOST, null, 'create', { ...payload(), score: 500 }));
  assert.deepEqual(await one('select (select count(*) from public.drafts) drafts,(select count(*) from public.competitions) competitions'), before);
});

await check('setup self-join and leave preserve membership and cannot remove the host', async () => {
  await expectBlocked(() => action(HOST, main, 'start'), /two players/i);
  await expectBlocked(() => action(HOST, main, 'leave'), /host stays/i);
  await action(B, main, 'join'); await action(B, main, 'join');
  assert.equal((await rowsFor('draft_participants', main)).length, 2);
  await action(B, main, 'leave'); assert.equal((await rowsFor('draft_participants', main)).length, 1);
  await action(B, main, 'join'); await action(C, main, 'join');
  assert.equal((await rowsFor('draft_participants', main)).length, 3);
  await expectBlocked(() => action(OTHER, main, 'join', {}, request(), OTHER_CLUB));
  await expectBlocked(() => action(B, main, 'start'), /host or commissioner/i);
});

let order, startKey;
await check('server start shuffles complete seats exactly once and records the authoritative first turn', async () => {
  startKey = request(); await action(HOST, main, 'start', {}, startKey);
  order = (await all('select user_id,pick_order from public.draft_participants where draft_id=$1 order by pick_order', [main])).map(row => row.user_id);
  assert.equal(new Set(order).size, 3);
  assert.deepEqual((await all('select pick_order from public.draft_participants where draft_id=$1 order by pick_order', [main])).map(row => row.pick_order), [1,2,3]);
  let d = await get(main); assert.equal(d.status, 'in_progress'); assert.equal(d.current_pick_user_id, order[0]);
  assert.equal(d.current_pick_number, 1); assert.equal(d.current_round, 1); assert.equal(d.pick_deadline_at, null);
  const retry = await action(HOST, main, 'start', {}, startKey); assert.equal(retry.replayed, true);
  assert.deepEqual((await all('select user_id from public.draft_participants where draft_id=$1 order by pick_order', [main])).map(row => row.user_id), order);
  assert.equal((await one("select count(*)::integer n from public.notifications where url=$1", [`/drafts/lineup/${main}`])).n, 3);
  await expectBlocked(() => action(HOST, main, 'start'));
  await expectBlocked(() => action(B, main, 'leave'));
});

await check('started configuration and roster remain frozen even through a trusted write path', async () => {
  const q = (sql, values = []) => actorQuery(null, sql, values, 'service_role');
  await expectBlocked(() => q("update public.drafts set topic='A different contest' where id=$1", [main]));
  await expectBlocked(() => q("update public.drafts set ai_context_override='Different scoring rules' where id=$1", [main]));
  await expectBlocked(() => q('update public.drafts set lineup_config=$2::jsonb where id=$1', [main, JSON.stringify({ ...config, template_id: 'changed' })]));
  await expectBlocked(() => q('update public.draft_participants set pick_order=pick_order+10 where draft_id=$1', [main]));
  assert.equal((await get(main)).topic, 'Breakfast builders');
});

await check('turn, slot and payload authority remain server-owned', async () => {
  await expectBlocked(() => action(order[1], main, 'pick', { text: 'Toast', slot_id: 'main' }), /another player/i);
  await expectBlocked(() => action(order[0], main, 'pick', { text: 'Toast', slot_id: 'missing' }));
  await expectBlocked(() => action(order[0], main, 'pick', { text: 'Toast', slot_id: 'main', user_id: order[1] }));
  await expectBlocked(() => action(order[0], main, 'pick', { text: 'Toast', slot_id: 'main', score: 100 }));
  await expectBlocked(() => action(order[0], main, 'pick', { text: '!!!', slot_id: 'main' }));
  await expectBlocked(() => action(order[0], main, 'pick', { text: 'A\nB', slot_id: 'main' }));
  assert.equal((await rowsFor('draft_picks', main)).length, 0);
});

let firstPick, firstKey;
await check('any open slot can be picked first and exact retries consume one turn', async () => {
  firstKey = request(); firstPick = await action(order[0], main, 'pick', { text: 'Pancakes', slot_id: 'main' }, firstKey);
  assert.ok(firstPick.pick_id);
  const parallelRetries = await Promise.all(Array.from({ length: 6 }, () => action(order[0], main, 'pick', { text: 'Pancakes', slot_id: 'main' }, firstKey)));
  assert.ok(parallelRetries.every(row => row.pick_id === firstPick.pick_id && row.replayed));
  let d = await get(main); assert.equal(d.current_pick_user_id, order[1]); assert.equal(d.current_pick_number, 2);
  const picks = await rowsFor('draft_picks', main); assert.equal(picks.length, 1); assert.equal(picks[0].lineup_slot_id, 'main');
  assert.equal(picks[0].pick_number, 1); assert.equal(picks[0].round, 1);
  await expectBlocked(() => action(order[0], main, 'pick', { text: 'Waffles', slot_id: 'main' }, firstKey), /different action/i);
});

await check('in-progress correction preserves slot and turn; unauthorized edits and duplicates fail', async () => {
  await db.query("insert into public.item_enrichments(item_type,item_id,image_url) values('draft_pick',$1,'old-image')", [firstPick.pick_id]);
  const old = (await rowsFor('draft_picks', main))[0], turn = await get(main);
  const unauthorized = [B,C].find(user => user !== order[0]);
  await expectBlocked(() => action(unauthorized, main, 'edit_pick', { pick_id: firstPick.pick_id, text: 'Waffles' }), /cannot edit/i);
  await action(order[0], main, 'edit_pick', { pick_id: firstPick.pick_id, text: 'Buttermilk pancakes' });
  const saved = (await rowsFor('draft_picks', main))[0]; assert.equal(saved.pick_text, 'Buttermilk pancakes');
  assert.deepEqual({ ...saved, pick_text: old.pick_text }, old);
  assert.equal((await one('select count(*)::integer n from public.item_enrichments where item_id=$1', [firstPick.pick_id])).n, 0);
  assert.equal((await get(main)).current_pick_number, turn.current_pick_number);
});

await check('all direct Lineup mutations fail despite permissive legacy club policies', async () => {
  const q = (sql, values = []) => actorQuery(HOST, sql, values);
  await expectBlocked(() => q("update public.drafts set status='complete' where id=$1", [main]));
  await expectBlocked(() => q("update public.drafts set draft_format='classic',lineup_config=null where id=$1", [main]));
  await expectBlocked(() => q("update public.drafts set current_pick_user_id=$2 where id=$1", [main, HOST]));
  await expectBlocked(() => q("update public.draft_picks set lineup_slot_id='drink' where id=$1", [firstPick.pick_id]));
  await expectBlocked(() => q("update public.draft_picks set pick_text='Forged' where id=$1", [firstPick.pick_id]));
  await expectBlocked(() => q('delete from public.draft_picks where id=$1', [firstPick.pick_id]));
  await expectBlocked(() => q('delete from public.draft_participants where draft_id=$1 and user_id=$2', [main, B]));
  await expectBlocked(() => q('delete from public.drafts where id=$1', [main]));
  await expectBlocked(() => q("insert into public.draft_skips(club_id,draft_id,user_id,pick_number,round) values($1,$2,$3,2,1)", [CLUB, main, HOST]));
  await expectBlocked(() => q("insert into public.draft_results(club_id,draft_id,user_id,total_score,rank) values($1,$2,$3,100,1)", [CLUB, main, HOST]));
  await expectBlocked(async () => {
    await actorQuery(HOST, "select set_config('lineup.trusted','true',true)");
    return q("update public.drafts set status='complete' where id=$1", [main]);
  });
  await assert.rejects(() => q('select * from public.draft_lineup_receipts'), /permission denied/i);
  assert.equal((await get(main)).status, 'in_progress');
});

await check('forged child club IDs cannot hide a foreign Lineup parent behind RLS', async () => {
  const q = (sql, values = []) => actorQuery(OTHER, sql, values);
  assert.equal((await q('select id from public.drafts where id=$1', [main])).rows.length, 0);
  await expectBlocked(() => q("insert into public.draft_picks(club_id,draft_id,user_id,pick_text,pick_number,round) values($1,$2,$3,'Foreign injection',2,1)", [OTHER_CLUB, main, OTHER]));
  await expectBlocked(() => q('insert into public.draft_participants(club_id,draft_id,user_id,pick_order) values($1,$2,$3,9)', [OTHER_CLUB, main, OTHER]));
  await expectBlocked(() => q('insert into public.draft_skips(club_id,draft_id,user_id,pick_number,round) values($1,$2,$3,2,1)', [OTHER_CLUB, main, OTHER]));
  await expectBlocked(() => q('insert into public.draft_results(club_id,draft_id,user_id,total_score,rank) values($1,$2,$3,100,1)', [OTHER_CLUB, main, OTHER]));
  assert.equal((await rowsFor('draft_participants', main)).length, 3);
  assert.equal((await rowsFor('draft_picks', main)).length, 1);
});

let finalKey, finalPick;
await check('full snake order fills each player slot exactly once and finalizes atomically', async () => {
  await expectBlocked(() => action(order[1], main, 'pick', { text: 'Buttermilk pancakes!', slot_id: 'drink' }), /already been picked/i);
  await action(order[1], main, 'pick', { text: 'Orange juice', slot_id: 'drink' });
  await action(order[2], main, 'pick', { text: 'French toast', slot_id: 'main' });
  assert.equal((await get(main)).current_pick_user_id, order[2]); // snake boundary: same player twice.
  await expectBlocked(() => action(order[2], main, 'pick', { text: 'Bagel', slot_id: 'main' }), /already filled/i);
  await expectBlocked(() => action(order[2], main, 'pick', { text: 'Orange juice!', slot_id: 'drink' }), /already been picked/i);
  await action(order[2], main, 'pick', { text: 'Coffee', slot_id: 'drink' });
  await action(order[1], main, 'pick', { text: 'Eggs Benedict', slot_id: 'main' });
  finalKey = request(); finalPick = await action(order[0], main, 'pick', { text: 'Tea', slot_id: 'drink' }, finalKey);
  const picks = await rowsFor('draft_picks', main);
  assert.deepEqual(picks.map(row => row.user_id), [order[0],order[1],order[2],order[2],order[1],order[0]]);
  assert.deepEqual(picks.map(row => row.pick_number), [1,2,3,4,5,6]);
  assert.deepEqual(picks.map(row => row.round), [1,1,1,2,2,2]);
  for (const user of order) assert.deepEqual(picks.filter(row => row.user_id === user).map(row => row.lineup_slot_id).sort(), ['drink','main']);
  const d = await get(main); assert.equal(d.status, 'complete'); assert.equal(d.current_pick_number, 7);
  assert.equal(d.current_round, 2); assert.equal(d.current_pick_user_id, null);
  assert.equal((await rowsFor('draft_results', main)).length, 0, 'The backend does not invent AI grades.');
  assert.equal((await one('select status from public.competitions where id=$1', [d.competition_id])).status, 'closed');
  assert.equal((await one("select count(*)::integer n from public.activity_feed where target_id=$1 and event_type='draft_completed'", [main])).n, 1);
});

await check('lost final response retries reveal the same result without duplicate completion or notifications', async () => {
  const count = (await one('select count(*)::integer n from public.notifications where url=$1', [`/drafts/lineup/${main}`])).n;
  const retry = await action(order[0], main, 'pick', { text: 'Tea', slot_id: 'drink' }, finalKey);
  assert.equal(retry.pick_id, finalPick.pick_id); assert.equal(retry.replayed, true);
  assert.equal((await rowsFor('draft_picks', main)).length, 6);
  assert.equal((await one('select count(*)::integer n from public.notifications where url=$1', [`/drafts/lineup/${main}`])).n, count);
  await expectBlocked(() => action(order[0], main, 'pick', { text: 'Tea', slot_id: 'drink' }));
  await expectBlocked(() => action(HOST, main, 'edit_pick', { pick_id: firstPick.pick_id, text: 'Changed after grading' }));
  await expectBlocked(() => action(HOST, main, 'cancel'));
});

await check('trusted grading can replace complete reports while clients cannot fabricate them', async () => {
  const owned = (await rowsFor('draft_picks', main)).filter(pick => pick.user_id === HOST);
  const ratings = owned.map((pick, index) => ({ pick_id: pick.id, pick_text: pick.pick_text, score: index ? 8.3 : 8.2,
    explanation: 'A defensible choice for the assigned role.', scoring_version: 'lineup_v1',
    lineup_slot_id: pick.lineup_slot_id, lineup_slot_label: config.slots.find(slot => slot.id === pick.lineup_slot_id).label }));
  const insertReport = value => actorQuery(null, 'insert into public.draft_results(club_id,draft_id,user_id,total_score,rank,pick_ratings) values($1,$2,$3,16.5,1,$4::jsonb)', [CLUB, main, HOST, JSON.stringify(value)], 'service_role');
  await expectBlocked(() => insertReport([]), /slot-aware grading/i);
  await expectBlocked(() => insertReport(ratings.map(({ scoring_version, ...rating }) => rating)), /slot-aware grading/i);
  await expectBlocked(() => insertReport([ratings[0], ratings[0]]), /slot-aware grading/i);
  await expectBlocked(() => insertReport(ratings.map(rating => ({ ...rating, lineup_slot_label: 'Changed slot' }))), /slot-aware grading/i);
  await insertReport(ratings);
  await expectBlocked(() => actorQuery(HOST, 'update public.draft_results set total_score=1000 where draft_id=$1', [main]));
  await expectBlocked(() => actorQuery(HOST, 'delete from public.draft_results where draft_id=$1', [main]));
  await actorQuery(null, 'delete from public.draft_results where draft_id=$1', [main], 'service_role');
  assert.equal((await rowsFor('draft_results', main)).length, 0);
});

let cancelled;
await check('cancellation preserves progress, is retry-safe, and produces no competitive results', async () => {
  cancelled = (await create('Cancellation example')).draft_id; await action(B, cancelled, 'join'); await action(HOST, cancelled, 'start');
  const first = (await get(cancelled)).current_pick_user_id; await action(first, cancelled, 'pick', { text: 'A breakfast choice', slot_id: 'drink' });
  await expectBlocked(() => action(B, cancelled, 'cancel'), /host or commissioner/i);
  const key = request(); await action(HOST, cancelled, 'cancel', {}, key);
  assert.equal((await get(cancelled)).status, 'cancelled'); assert.equal((await rowsFor('draft_picks', cancelled)).length, 1);
  assert.equal((await rowsFor('draft_results', cancelled)).length, 0);
  assert.equal((await action(HOST, cancelled, 'cancel', {}, key)).replayed, true);
  await expectBlocked(() => action(first, cancelled, 'pick', { text: 'Another pick', slot_id: 'main' }));
});

await check('disabled or hidden installation and inactive club block new actions without losing saves', async () => {
  const snapshots = await get(cancelled);
  for (const flag of ['enabled','visible_to_members']) {
    await db.query(`update public.club_installed_assets set ${flag}=false where club_id=$1`, [CLUB]);
    await expectBlocked(() => create('Unavailable asset'), /not enabled/i);
    await db.query(`update public.club_installed_assets set ${flag}=true where club_id=$1`, [CLUB]);
  }
  await db.query('update public.platform_assets set is_active=false'); await expectBlocked(() => create('Inactive asset'), /not enabled/i);
  await db.query('update public.platform_assets set is_active=true');
  await db.query("update public.clubs set status='suspended' where id=$1", [CLUB]); await expectBlocked(() => create('Inactive club'));
  await db.query("update public.clubs set status='active' where id=$1", [CLUB]);
  assert.deepEqual(await get(cancelled), snapshots);
});

await check('member removal stops play safely and an authorized manager can close the abandoned draft', async () => {
  const draft = (await create('Member departure')).draft_id; await action(B, draft, 'join'); await action(HOST, draft, 'start');
  await db.query('delete from public.club_members where user_id=$1', [B]);
  await expectBlocked(() => action(B, draft, 'pick', { text: 'Missing member', slot_id: 'drink' }));
  await expectBlocked(() => action(HOST, draft, 'pick', { text: 'Remaining member', slot_id: 'drink' }), /player left/i);
  await action(ADMIN, draft, 'cancel'); assert.equal((await get(draft)).status, 'cancelled');
  await db.query('insert into public.club_members(club_id,user_id) values($1,$2)', [CLUB, B]);
});

await check('private account cannot enter a shared club roster even through a stale membership', async () => {
  await db.query('update public.club_members set club_id=$1 where user_id=$2', [CLUB, PRIVATE]);
  await expectBlocked(() => create('Private member leak', request(), PRIVATE));
  const draft = (await create('Private roster check')).draft_id;
  await expectBlocked(() => action(PRIVATE, draft, 'join'));
  await db.query('update public.club_members set club_id=$1 where user_id=$2', [PRIVATE_CLUB, PRIVATE]);
  await expectBlocked(() => action(PRIVATE, draft, 'join', {}, request(), PRIVATE_CLUB));
  await action(HOST, draft, 'cancel');
});

await check('existing season roster guards still reject ineligible joins and recognize its commissioner', async () => {
  const season = id(6000), draft = (await create('Season lineup')).draft_id;
  await db.query('insert into public.draft_seasons(id,club_id,commissioner_user_id) values($1,$2,$3)', [season, CLUB, C]);
  await db.query('insert into public.draft_season_entries(club_id,draft_id,season_id) values($1,$2,$3)', [CLUB, main, season]);
  await db.query('insert into public.draft_season_entries(club_id,draft_id,season_id) values($1,$2,$3)', [CLUB, draft, season]);
  // Three established players belong to main. A fourth club member does not.
  await expectBlocked(() => action(ADMIN, draft, 'join'), /season roster.*locked/i);
  await action(B, draft, 'join'); await action(C, draft, 'start');
  assert.equal((await get(draft)).status, 'in_progress'); await action(HOST, draft, 'cancel');
});

await check('classic and live draft writes, skips, and duplicate checks retain their original behavior', async () => {
  await actorQuery(HOST, "update public.drafts set status='in_progress',current_pick_user_id=$2 where id=$1", [id(2001), HOST]);
  await actorQuery(HOST, 'insert into public.draft_participants(club_id,draft_id,user_id,pick_order) values($1,$2,$3,1)', [CLUB, id(2001), HOST]);
  await actorQuery(HOST, "insert into public.draft_picks(club_id,draft_id,user_id,pick_text,pick_number,round) values($1,$2,$3,'Classic selection',1,1)", [CLUB, id(2001), HOST]);
  await assert.rejects(() => actorQuery(HOST, "insert into public.draft_picks(club_id,draft_id,user_id,pick_text,pick_number,round) values($1,$2,$3,'Classic selection!',2,2)", [CLUB, id(2001), HOST]), /already been picked/i);
  await actorQuery(HOST, 'insert into public.draft_skips(club_id,draft_id,user_id,pick_number,round) values($1,$2,$3,1,1)', [CLUB, id(2003), HOST]);
  await expectBlocked(() => actorQuery(HOST, "insert into public.draft_picks(club_id,draft_id,user_id,pick_text,pick_number,round,lineup_slot_id) values($1,$2,$3,'Bad classic slot',2,2,'drink')", [CLUB, id(2001), HOST]));
  assert.equal((await get(id(2001))).status, 'in_progress'); assert.equal((await rowsFor('draft_picks', id(2001))).length, 1);
  assert.equal((await rowsFor('draft_skips', id(2003))).length, 1);
  await assert.rejects(() => actorQuery(HOST, "update public.drafts set status='cancelled' where id=$1", [id(2001)]), /check constraint/i);
});

await check('creation budget is enforced without duplicate drafts on failed or repeated requests', async () => {
  // Use a separate active member so prior test creation receipts do not matter.
  await db.query('insert into public.club_members(club_id,user_id) values($1,$2)', [CLUB, id(8)]);
  for (let n = 0; n < 8; n++) await create(`Budget ${n}`, request(), id(8));
  await expectBlocked(() => create('Over budget', request(), id(8)), /Finish an open/i);
  assert.equal((await one("select count(*)::integer n from public.drafts where created_by=$1 and draft_format='lineup'", [id(8)])).n, 8);
});

await check('reapplying the migration preserves complete, active and cancelled history and receipts', async () => {
  const snapshot = async () => one(`select
    (select jsonb_agg(to_jsonb(d) order by id) from public.drafts d) drafts,
    (select jsonb_agg(to_jsonb(p) order by id) from public.draft_picks p) picks,
    (select jsonb_agg(to_jsonb(r) order by actor_user_id,request_id) from public.draft_lineup_receipts r) receipts`);
  const before = await snapshot(); await db.exec(source); assert.deepEqual(await snapshot(), before);
});

await db.close();
console.log(`PASS Lineup Draft SQL: ${checks} groups. PGlite queues concurrent requests; this is not a multi-session server contention benchmark.`);
