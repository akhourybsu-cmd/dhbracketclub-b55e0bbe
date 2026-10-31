// Isolated PostgreSQL integration checks. Uses no Supabase connection or credentials.
// Run: node scripts/test-draft-commissioner-db.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// PGlite attaches the entire migration to SQL errors; keep failed checks readable.
process.on('uncaughtException',error=>{
  console.error(error.message);
  if(error.code) console.error(`SQLSTATE ${error.code}`);
  if(error.where) console.error(error.where);
  process.exit(1);
});

const db = new PGlite();
const id = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
let checks = 0;
const check = async (name, run) => {
  await run();
  checks++;
  console.log(`PASS ${name}`);
};

await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.user',true),'')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('test.role',true),'')
  $$;
  create table auth.users(id uuid primary key);
  create table public.clubs(id uuid primary key, name text not null);
  create table public.profiles(id uuid primary key references auth.users(id), display_name text);
  create table public.user_roles(user_id uuid references auth.users(id), role text not null);
  create table public.club_members(
    id uuid primary key default gen_random_uuid(),
    club_id uuid not null references public.clubs(id),
    user_id uuid not null unique references auth.users(id), role text not null default 'member'
  );
  create function public.current_user_club_id() returns uuid language sql stable security definer set search_path=public as $$
    select club_id from public.club_members where user_id=auth.uid() limit 1
  $$;
  create function public.is_app_admin(p_user uuid) returns boolean language sql stable security definer set search_path=public as $$
    select exists(select 1 from public.user_roles where user_id=p_user and role in ('admin','owner'))
  $$;
  create function public.is_platform_owner(p_user uuid) returns boolean language sql stable security definer set search_path=public as $$
    select exists(select 1 from public.user_roles where user_id=p_user and role='owner')
  $$;
  create function public.is_club_admin(p_user uuid,p_club uuid) returns boolean language sql stable security definer set search_path=public as $$
    select exists(select 1 from public.club_members where user_id=p_user and club_id=p_club and role='admin')
  $$;
  create function public.dh_public_member(p_user uuid) returns boolean language sql stable as $$ select p_user is distinct from '${id(7)}'::uuid $$;
  create function public.dh_visible_member(p_user uuid) returns boolean language sql stable as $$ select p_user=auth.uid() or public.dh_public_member(p_user) $$;
  create function public.dh_visible_club(p_club uuid) returns boolean language sql stable as $$ select p_club is distinct from '${id(12)}'::uuid or auth.uid()='${id(7)}'::uuid $$;
  create function public.dh_private_write_guard() returns trigger language plpgsql as $$
  declare field text;
  begin
    if new.club_id is distinct from '${id(12)}'::uuid then
      if auth.uid()='${id(7)}'::uuid then raise exception 'Private activity cannot enter a shared club' using errcode='42501'; end if;
      foreach field in array tg_argv loop
        if to_jsonb(new)->>field='${id(7)}' then raise exception 'Private activity cannot enter a shared club' using errcode='42501'; end if;
      end loop;
    end if;
    return new;
  end $$;
  create function public.update_updated_at_column() returns trigger language plpgsql as $$
    begin new.updated_at=now(); return new; end
  $$;
  create table public.draft_seasons(
    id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
    commissioner_user_id uuid references public.profiles(id), name text not null,
    status text not null default 'regular_season', starts_at timestamptz not null default now(),
    ends_at timestamptz not null default now()+interval '1 year',
    regular_season_drafts integer not null default 12, regular_season_weeks integer not null default 12,
    best_of integer not null default 10, updated_at timestamptz not null default now(),
    created_at timestamptz not null default now(), subtitle text,
    champion_user_id uuid, runner_up_user_id uuid, third_place_user_id uuid,
    regular_season_champion_user_id uuid, archived_at timestamptz, summary jsonb
  );
  create table public.competitions(
    id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),
    created_by uuid not null references public.profiles(id),type text not null,title text not null,
    status text not null default 'setup',description text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
  );
  create table public.drafts(
    id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
    competition_id uuid references public.competitions(id) on delete cascade,
    created_by uuid not null references public.profiles(id), topic text not null,
    status text not null default 'setup', num_rounds integer not null default 5,
    category text, is_live boolean not null default false, live_settings jsonb not null default '{}'::jsonb,
    ai_context text, ai_context_override text, ai_context_updated_at timestamptz, ai_context_updated_by uuid,
    current_pick_number integer not null default 1, current_round integer not null default 1,
    current_pick_user_id uuid, pick_deadline_at timestamptz, clock_started_at timestamptz,
    clock_paused_at timestamptz, timer_seconds integer, created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create table public.draft_participants(
    id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
    draft_id uuid not null references public.drafts(id) on delete cascade, user_id uuid not null references public.profiles(id),
    pick_order integer not null, unique(draft_id,user_id), unique(draft_id,pick_order)
  );
  create table public.draft_picks(
    id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
    draft_id uuid not null references public.drafts(id) on delete cascade, user_id uuid not null references public.profiles(id),
    pick_number integer not null, round integer not null, pick_text text not null,
    picked_at timestamptz not null default now()
  );
  create table public.draft_results(
    id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
    draft_id uuid not null references public.drafts(id) on delete cascade, user_id uuid not null references public.profiles(id),
    rank integer not null, total_score numeric not null default 0, points_awarded integer not null default 0,
    pick_ratings jsonb not null default '[]'::jsonb, summary text, created_at timestamptz not null default now(),
    unique(draft_id,user_id)
  );
  create table public.draft_skips(
    id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),
    draft_id uuid not null references public.drafts(id) on delete cascade,user_id uuid not null references public.profiles(id),
    pick_number integer not null,round integer not null,created_at timestamptz not null default now()
  );
  create table public.draft_season_entries(
    id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
    season_id uuid not null references public.draft_seasons(id), draft_id uuid not null unique references public.drafts(id) on delete cascade,
    week_number integer not null, is_playoff boolean not null default false,
    season_points_awarded jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
  );
  create table public.draft_season_standings(
    id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
    season_id uuid not null references public.draft_seasons(id), user_id uuid not null references public.profiles(id),
    season_points integer not null default 0, drafts_played integer not null default 0,
    wins integer not null default 0, podiums integer not null default 0, avg_finish numeric not null default 0,
    avg_score numeric not null default 0, best_score numeric not null default 0, worst_score numeric not null default 999,
    consistency numeric not null default 0, rank integer, playoff_seed integer,
    is_eliminated boolean not null default false, updated_at timestamptz not null default now(), unique(season_id,user_id)
  );
  create table public.draft_playoff_matches(
    id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
    season_id uuid not null references public.draft_seasons(id), draft_id uuid references public.drafts(id),
    round text not null, match_number integer not null default 1, status text not null default 'awaiting_topic',
    user_a uuid, user_b uuid, seed_a integer, seed_b integer, topic_picker_user_id uuid,
    winner_user_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
  );
  create table public.draft_pick_disputes(
    id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
    draft_id uuid not null references public.drafts(id), pick_id uuid not null references public.draft_picks(id),
    user_id uuid not null references public.profiles(id), reason text not null,
    status text not null default 'pending', resolution text, commissioner_rationale text,
    resolved_at timestamptz, resolved_by uuid, created_at timestamptz not null default now()
  );
  create table public.notifications(
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
    club_id uuid references public.clubs(id), type text not null, title text not null, body text, url text,
    actor_user_id uuid references auth.users(id), read_at timestamptz, created_at timestamptz not null default now()
  );
  create table public.item_enrichments(
    id uuid primary key default gen_random_uuid(),item_id uuid not null,item_type text not null default 'draft_pick',
    image_url text,status text not null default 'matched',created_at timestamptz not null default now()
  );
  create table public.rankings(
    id uuid primary key default gen_random_uuid(),competition_id uuid not null references public.competitions(id) on delete cascade,title text not null
  );
  create table public.draft_desk_items(
    id uuid primary key default gen_random_uuid(),draft_id uuid not null references public.drafts(id) on delete cascade,user_id uuid not null,title text not null
  );
  alter table public.drafts enable row level security;
  create policy "Legacy draft read" on public.drafts for select to authenticated using(club_id=public.current_user_club_id());
  create policy "Legacy draft delete" on public.drafts for delete to authenticated using(club_id=public.current_user_club_id() and(created_by=auth.uid() or public.is_app_admin(auth.uid())));
  alter table public.notifications enable row level security;
  create policy "read own" on public.notifications for select to authenticated using(user_id=auth.uid());
  grant usage on schema public,auth to anon,authenticated,service_role;
  grant select on all tables in schema public to authenticated;
  grant all on all tables in schema public to service_role;
  grant delete on public.drafts to authenticated;
  grant insert,update,delete on public.draft_seasons,public.draft_season_entries,public.draft_season_standings,public.draft_pick_disputes to authenticated;
  do $$ declare t text; begin
    foreach t in array array['draft_seasons','draft_season_entries','draft_season_standings','draft_pick_disputes'] loop
      execute format('alter table public.%I enable row level security',t);
      execute format('create policy "Legacy club read" on public.%I for select to authenticated using(club_id=public.current_user_club_id())',t);
      execute format('create policy "Legacy club write" on public.%I for all to authenticated using(club_id=public.current_user_club_id()) with check(club_id=public.current_user_club_id())',t);
      execute format('create policy dh_private_visibility on public.%I as restrictive for all to authenticated using(public.dh_visible_club(club_id)) with check(public.dh_visible_club(club_id))',t);
    end loop;
  end $$;
`);

async function asOwner(work) {
  await db.exec('reset role');
  try { return await work(); }
  finally { await db.exec('set role authenticated'); }
}
async function actor(user) {
  await db.query("select set_config('test.user',$1,false),set_config('test.role','authenticated',false)", [user ? id(user) : '']);
  await db.exec('set role authenticated');
}
async function asService(work) {
  await db.exec('reset role');
  await db.query("select set_config('test.user','',false),set_config('test.role','service_role',false)");
  await db.exec('set role service_role');
  try { return await work(); }
  finally { await actor(1); }
}
async function rpc(name, args = []) {
  return (await db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) as result`, args)).rows[0].result;
}
async function rows(sql, args = []) { return (await db.query(sql, args)).rows; }
async function insert(table, value) {
  const columns = Object.keys(value);
  await db.query(`insert into public.${table}(${columns.join(',')}) values(${columns.map((_, i) => `$${i + 1}`).join(',')})`,
    Object.values(value).map(v => v !== null && typeof v === 'object' ? JSON.stringify(v) : v));
}

await db.exec(`
  insert into auth.users(id) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,9) n;
  insert into auth.users(id) values('${id(20)}'),('${id(21)}');
  insert into public.profiles(id,display_name) select id,'Member '||right(id::text,1) from auth.users;
  insert into public.clubs(id,name) values('${id(10)}','Club A'),('${id(11)}','Club B'),('${id(12)}','Private workspace');
  insert into public.club_members(club_id,user_id,role) values
    ('${id(10)}','${id(1)}','member'),('${id(10)}','${id(2)}','member'),
    ('${id(10)}','${id(3)}','admin'),('${id(11)}','${id(4)}','member'),
    ('${id(10)}','${id(5)}','member'),('${id(11)}','${id(6)}','admin'),
    ('${id(12)}','${id(7)}','admin'),('${id(10)}','${id(9)}','member'),
    ('${id(10)}','${id(20)}','member'),('${id(10)}','${id(21)}','member');
  insert into public.user_roles values('${id(3)}','admin'),('${id(6)}','admin');
  insert into public.draft_seasons(id,club_id,commissioner_user_id,name,best_of) values
    ('${id(100)}','${id(10)}','${id(1)}','Season A',2),
    ('${id(101)}','${id(11)}','${id(4)}','Season B',2);
  insert into public.draft_seasons(id,club_id,commissioner_user_id,name,best_of,status) values
    ('${id(102)}','${id(10)}','${id(1)}','Archived A',2,'complete'),
    ('${id(103)}','${id(10)}','${id(1)}','Playoffs A',2,'playoffs');
`);

for (let i = 0; i < 3; i++) {
  await insert('drafts', { id:id(200+i),club_id:id(10),created_by:id(1),topic:`Regular topic ${i}`,status:'complete',num_rounds:1 });
  await insert('draft_season_entries', { season_id:id(100),club_id:id(10),draft_id:id(200+i),week_number:i+1 });
  for (const [place,user] of [1,2,5,9,20,21].entries()) {
    const ranks = { 1:[1,3,2],2:[2,1,3],5:[3,2,1],9:[6,5,4],20:[4,6,5],21:[5,4,6] };
    const scores = { 1:[90,75,84],2:[85,88,79],5:[80,85,91],9:[70,72,74],20:[73,69,72],21:[71,74,70] };
    await insert('draft_participants', { club_id:id(10),draft_id:id(200+i),user_id:id(user),pick_order:place+1 });
    await insert('draft_picks', { id:id(1000+i*100+user),club_id:id(10),draft_id:id(200+i),user_id:id(user),pick_number:place+1,round:1,pick_text:`Pick ${i}-${user}` });
    await insert('draft_results', { club_id:id(10),draft_id:id(200+i),user_id:id(user),rank:ranks[user][i],total_score:scores[user][i],points_awarded:100+user,
      pick_ratings:[{pick_id:id(1000+i*100+user),pick_text:`Pick ${i}-${user}`,score:scores[user][i]/10,explanation:'Persisted standalone rating'}] });
  }
}
await insert('drafts', { id:id(210),club_id:id(10),created_by:id(1),topic:'Unassigned regular',status:'setup' });
await insert('drafts', { id:id(211),club_id:id(11),created_by:id(4),topic:'Other club',status:'setup' });
await insert('drafts', { id:id(212),club_id:id(10),created_by:id(1),topic:'LIVE stays independent',status:'setup',is_live:true });
await insert('draft_playoff_matches', { id:id(400),club_id:id(10),season_id:id(100),round:'qf',seed_a:1,seed_b:4,user_a:id(5),user_b:id(9),topic_picker_user_id:id(5) });
await insert('draft_pick_disputes', { id:id(500),club_id:id(10),draft_id:id(200),pick_id:id(1001),user_id:id(1),reason:'Review this category fit' });
await insert('drafts', { id:id(214),club_id:id(10),created_by:id(1),topic:'Active regular room',status:'in_progress',current_pick_user_id:id(2),current_pick_number:2 });
await insert('draft_season_entries', { season_id:id(100),club_id:id(10),draft_id:id(214),week_number:4 });
await insert('draft_participants', { club_id:id(10),draft_id:id(214),user_id:id(1),pick_order:1 });
await insert('draft_participants', { club_id:id(10),draft_id:id(214),user_id:id(2),pick_order:2 });
await insert('draft_picks', { id:id(1500),club_id:id(10),draft_id:id(214),user_id:id(1),pick_number:1,round:1,pick_text:'Opening contender' });

const migration = await readFile(new URL('../supabase/migrations/20261031120000_draft_commissioner_workspace.sql',import.meta.url),'utf8');
await db.exec(migration);
let request = 8000;
const workspace = (season=100) => rpc('draft_commissioner_workspace',[id(season)]);
const manage = (season=100) => rpc('draft_commissioner_can_manage',[id(season)]);
const mutate = (action,payload={},reason='Commissioner review',requestId=id(request++),season=100) =>
  rpc('draft_commissioner_mutate',[id(season),action,JSON.stringify(payload),reason,requestId]);
const recalc = (season=100) => rpc('recalculate_draft_season_standings',[id(season)]);
const deleteDraft = draft => rpc('delete_unassigned_draft',[id(draft)]);
const auditCount = () => asOwner(async() => Number((await rows('select count(*) as n from public.draft_commissioner_audit'))[0].n));
const standings = () => rows('select user_id,season_points,drafts_played,wins,podiums,avg_finish,avg_score,best_score,worst_score,consistency,rank,playoff_seed from public.draft_season_standings where season_id=$1 order by playoff_seed,user_id',[id(100)]);
const sourceResults = () => asOwner(() => rows('select * from public.draft_results order by id'));
const denied = (work) => assert.rejects(work, error => error.code === '42501');
const writeBlocked = async(work)=>{
  try { assert.equal((await work()).rows.length,0); }
  catch(error) { if(error.code!=='42501') throw error; }
};
const defaultSettings = {pickSeconds:90,timeoutBehavior:'alert',sound:true,ticker:true,autoStartClock:true,announce:true,ceremony:true,broadcast:true,reportBroadcast:true};
const planPayload = (extra={}) => ({topic:'Planned draft night',notes:'Club gathering',ai_context:'Any medium',num_rounds:5,is_live:false,live_settings:defaultSettings,
  scheduled_at:new Date(Date.now()+86400000).toISOString(),due_at:new Date(Date.now()+172800000).toISOString(),status:'planned',...extra});
await actor(1);

await check('migration preserves existing restrictive privacy policies and exposes an empty operations workspace',async()=>{
  const policies = await asOwner(() => rows("select tablename,permissive from pg_policies where policyname='dh_private_visibility' and tablename in ('draft_seasons','draft_season_entries','draft_season_standings','draft_pick_disputes') order by tablename"));
  assert.equal(policies.length,4);
  assert.ok(policies.every(policy=>policy.permissive==='RESTRICTIVE'));
  const empty=await workspace();
  for(const field of ['plans','presets','adjustments','audit','reminders']) assert.deepEqual(empty[field],[]);
});

await check('commissioner and same-club app admin are authorized; members, anonymous and cross-club admins are not',async()=>{
  assert.equal(await manage(),true);
  await actor(3); assert.equal(await manage(),true); await workspace();
  for(const user of [0,2,4,6,8]) {
    await actor(user);
    assert.equal(await manage(),false);
    await denied(workspace);
    await denied(()=>mutate('update_season',{subtitle:'Unauthorized'}));
  }
  await actor(2);
  await recalc(); // Automatic board refresh does not grant commissioner control.
  await denied(()=>rpc('draft_commissioner_actor_can_manage',[id(100),id(1)]));
  await actor(1);
  await denied(()=>workspace(101));
  await denied(()=>mutate('update_season',{subtitle:'Cross club'},'Not allowed',id(request++),101));
  await denied(()=>recalc(101));
  await db.exec('set role anon');
  await denied(workspace);
  await denied(recalc);
  await actor(1);
});

await check('direct writes cannot bypass the RPC even for the commissioner',async()=>{
  for(const table of ['draft_commissioner_plans','draft_commissioner_presets','draft_commissioner_adjustments','draft_commissioner_audit','draft_commissioner_reminders']) {
    await denied(()=>db.exec(`insert into public.${table} default values`));
  }
  await actor(2);
  await denied(()=>db.query('update public.draft_seasons set subtitle=$1 where id=$2',['Bypass',id(100)]));
  await denied(()=>db.query('delete from public.draft_season_entries where season_id=$1',[id(100)]));
  await denied(()=>db.query('insert into public.draft_season_standings(club_id,season_id,user_id,season_points) values($1,$2,$3,999)',[id(10),id(100),id(2)]));
  await writeBlocked(()=>db.query("update public.draft_pick_disputes set status='dismissed' where id=$1 returning id",[id(500)]));
  await actor(1);
});

let plan;
await check('planner changes persist once, audit the actor and payload, and replay the same request safely',async()=>{
  const key=id(request++),payload=planPayload();
  const first=await mutate('upsert_plan',payload,'Organize draft night',key);
  assert.equal(first.ok,true);
  assert.ok(first.audit_id);
  plan=first.record;
  assert.equal(plan.topic,payload.topic);
  assert.equal(plan.version,1);
  const replay=await mutate('upsert_plan',payload,'Organize draft night',key);
  assert.deepEqual(replay,first);
  await assert.rejects(()=>mutate('upsert_plan',{...payload,topic:'Different request'},'Organize draft night',key),/Request identity already used/);
  await assert.rejects(()=>mutate('upsert_plan',payload,'Changed explanation',key),/Request identity already used/);
  const state=await workspace();
  assert.equal(state.plans.length,1);
  assert.equal(state.audit.length,1);
  assert.equal(state.audit[0].actor_user_id,id(1));
  assert.equal(state.audit[0].reason,'Organize draft night');
  assert.equal(state.audit[0].request_id,key);
  assert.equal(state.audit[0].after_data.topic,payload.topic);
});

await check('optimistic versions reject stale edits without appending an audit or overwriting the newer plan',async()=>{
  const next=await mutate('upsert_plan',planPayload({id:plan.id,expected_version:plan.version,topic:'Updated night'}));
  plan=next.record;
  assert.equal(plan.version,2);
  const before=await auditCount();
  await assert.rejects(()=>mutate('upsert_plan',planPayload({id:plan.id,expected_version:1,topic:'Stale overwrite'})),error=>error.code==='40001');
  assert.equal(await auditCount(),before);
  assert.equal((await workspace()).plans[0].topic,'Updated night');
});

await check('a failed audit insert rolls back its product mutation atomically',async()=>{
  const before=await workspace();
  await asOwner(()=>db.exec(`create function public.test_reject_commissioner_audit() returns trigger language plpgsql as $$ begin if new.reason='Force audit rollback' then raise exception 'test audit failure'; end if; return new; end $$;
    create trigger test_reject_audit before insert on public.draft_commissioner_audit for each row execute function public.test_reject_commissioner_audit();`));
  try {
    await assert.rejects(()=>mutate('upsert_plan',planPayload({topic:'Must not persist'}),'Force audit rollback'),/test audit failure/);
    assert.deepEqual(await workspace(),before);
  } finally {
    await asOwner(()=>db.exec('drop trigger test_reject_audit on public.draft_commissioner_audit; drop function public.test_reject_commissioner_audit()'));
  }
});

await check('presets enforce versions and remain within their season',async()=>{
  const preset=(await mutate('upsert_preset',{name:'Classic draft',config:{num_rounds:5,ai_context:'All media',is_live:false,live_settings:defaultSettings}})).record;
  assert.equal(preset.version,1);
  const edited=(await mutate('upsert_preset',{id:preset.id,expected_version:1,name:'Classic room',config:preset.config})).record;
  assert.equal(edited.version,2);
  await assert.rejects(()=>mutate('delete_preset',{id:preset.id,expected_version:1}),error=>error.code==='40001');
  await mutate('delete_preset',{id:preset.id,expected_version:2});
  assert.equal((await workspace()).presets.length,0);
});

await check('ordinary club members may use presets but cannot open commissioner snapshots or see other clubs',async()=>{
  const preset=(await mutate('upsert_preset',{name:'Reusable format',config:{num_rounds:5,ai_context:'All media',is_live:false,live_settings:defaultSettings}})).record;
  await actor(2);
  assert.equal((await rows('select id from public.draft_commissioner_presets where id=$1',[preset.id])).length,1);
  assert.equal((await rows('select id from public.draft_commissioner_plans')).length,0);
  await denied(workspace);
  await actor(4);
  assert.equal((await rows('select id from public.draft_commissioner_presets where id=$1',[preset.id])).length,0);
  await denied(workspace);
  await actor(1);
  await mutate('delete_preset',{id:preset.id,expected_version:1});
});

await check('playoff recalculation preserves existing standing identity, locked rank/seed and elimination status',async()=>{
  await asOwner(async()=>{
    await insert('drafts',{id:id(220),club_id:id(10),created_by:id(1),topic:'Locked season result',status:'complete'});
    await insert('draft_season_entries',{season_id:id(103),club_id:id(10),draft_id:id(220),week_number:1});
    await insert('draft_results',{draft_id:id(220),club_id:id(10),user_id:id(1),rank:1,total_score:91});
    await insert('draft_season_standings',{id:id(900),season_id:id(103),club_id:id(10),user_id:id(1),rank:4,playoff_seed:4,is_eliminated:true});
  });
  await recalc(103);
  const standing=(await rows('select * from public.draft_season_standings where id=$1',[id(900)]))[0];
  assert.ok(standing);
  assert.equal(standing.rank,4);
  assert.equal(standing.playoff_seed,4);
  assert.equal(standing.is_eliminated,true);
  assert.equal(standing.season_points,10);
  await recalc(103);
  assert.equal((await rows('select id from public.draft_season_standings where season_id=$1 and user_id=$2',[id(103),id(1)]))[0].id,id(900));
});

await check('removing the final regular result drops its projection but retains the adjustment ledger and report',async()=>{
  await asOwner(async()=>{
    await insert('draft_seasons',{id:id(104),club_id:id(10),commissioner_user_id:id(1),name:'Single result season',best_of:2});
    await insert('drafts',{id:id(221),club_id:id(10),created_by:id(1),topic:'Only result',status:'complete'});
    await insert('draft_season_entries',{season_id:id(104),club_id:id(10),draft_id:id(221),week_number:1});
    await insert('draft_participants',{club_id:id(10),draft_id:id(221),user_id:id(2),pick_order:1});
    await insert('draft_results',{draft_id:id(221),club_id:id(10),user_id:id(2),rank:1,total_score:90});
  });
  const added=await mutate('add_adjustment',{user_id:id(2),delta:5},'Keep a documented correction',id(request++),104);
  assert.equal((await rows('select season_points from public.draft_season_standings where season_id=$1',[id(104)]))[0].season_points,15);
  await mutate('remove_draft',{draft_id:id(221)},'Move this event out of the season',id(request++),104);
  assert.equal((await rows('select id from public.draft_season_standings where season_id=$1',[id(104)])).length,0);
  const retained=await workspace(104);
  assert.equal(retained.adjustments[0].id,added.record.id);
  assert.equal(retained.adjustments[0].delta,5);
  assert.equal(retained.adjustments[0].revoked_at,null);
  assert.equal((await asOwner(()=>rows('select id from public.draft_results where draft_id=$1',[id(221)]))).length,1);
});

let originalResults;
await check('authoritative recalculation preserves best-of placement points and existing tiebreak ordering',async()=>{
  originalResults=await sourceResults();
  await recalc();
  const current=await standings();
  assert.deepEqual(current.slice(0,3).map(row=>[row.user_id,row.season_points,row.rank,row.playoff_seed]),[
    [id(5),17,1,1],[id(2),17,1,2],[id(1),17,1,3],
  ]);
  assert.ok(current.slice(0,3).every(row=>row.drafts_played===3&&row.wins===1&&row.podiums===3&&Number(row.avg_finish)===2));
  assert.equal(current.find(row=>row.user_id===id(9)).season_points,5);
  assert.equal(Number(current.find(row=>row.user_id===id(1)).consistency),6.16);
  assert.deepEqual(await sourceResults(),originalResults);
});

await check('manual adjustments are separate from report scores, survive recalculation and revoke with history',async()=>{
  const adjustment=(await mutate('add_adjustment',{user_id:id(1),delta:5},'Documented season correction')).record;
  assert.equal(adjustment.delta,5);
  assert.equal(adjustment.reason,'Documented season correction');
  assert.equal((await standings())[0].user_id,id(1));
  assert.equal((await standings())[0].season_points,22);
  await recalc();
  assert.equal((await standings())[0].season_points,22);
  assert.deepEqual(await sourceResults(),originalResults);
  await mutate('revoke_adjustment',{id:adjustment.id},'Correction withdrawn');
  const ledger=(await workspace()).adjustments.find(row=>row.id===adjustment.id);
  assert.ok(ledger.revoked_at);
  assert.equal(ledger.revoked_by,id(1));
  assert.equal(ledger.revocation_reason,'Correction withdrawn');
  assert.deepEqual((await standings()).slice(0,3).map(row=>[row.user_id,row.season_points]),[[id(5),17],[id(2),17],[id(1),17]]);
  assert.deepEqual(await sourceResults(),originalResults);
});

await check('invalid amounts, missing reasons, cross-club targets and nonparticipants cannot enter the ledger',async()=>{
  const before=await workspace();
  for(const payload of [{user_id:id(1),delta:0},{user_id:id(1),delta:101},{user_id:id(1),delta:1.5},{user_id:id(4),delta:5},{user_id:id(3),delta:5}]) {
    await assert.rejects(()=>mutate('add_adjustment',payload));
  }
  await assert.rejects(()=>mutate('add_adjustment',{user_id:id(1),delta:5},' '));
  assert.deepEqual(await workspace(),before);
});

await check('private legacy identities remain hidden and cannot receive shared reminders or adjustments',async()=>{
  const privateTables=['draft_commissioner_presets','draft_commissioner_plans','draft_commissioner_audit','draft_commissioner_adjustments','draft_commissioner_reminders'];
  await asOwner(async()=>{
    for(const table of privateTables) await db.exec(`alter table public.${table} disable trigger zz_dh_private_guard`);
    try {
      await insert('draft_commissioner_presets',{id:id(910),club_id:id(10),season_id:id(100),name:'Legacy private preset',config:{},created_by:id(7),updated_by:id(7)});
      await insert('draft_commissioner_plans',{id:id(911),club_id:id(10),season_id:id(100),topic:'Legacy private plan',created_by:id(7),updated_by:id(7)});
      await insert('draft_commissioner_audit',{id:id(912),club_id:id(10),season_id:id(100),actor_user_id:id(7),action:'legacy',reason:'Historical private activity',request_id:id(920)});
      await insert('draft_commissioner_adjustments',{id:id(913),club_id:id(10),season_id:id(100),user_id:id(7),delta:2,reason:'Historical private activity',created_by:id(7)});
      await insert('draft_commissioner_reminders',{id:id(914),club_id:id(10),season_id:id(100),target_user_id:id(7),kind:'topic',match_id:id(400),created_by:id(1)});
    } finally {
      for(const table of privateTables) await db.exec(`alter table public.${table} enable trigger zz_dh_private_guard`);
    }
  });
  const visible=await workspace();
  for(const collection of ['presets','plans','audit','adjustments','reminders']) {
    assert.ok(visible[collection].every(row=>![id(910),id(911),id(912),id(913),id(914)].includes(row.id)));
  }
  assert.equal((await rows('select id from public.draft_commissioner_plans where id=$1',[id(911)])).length,0);
  const notices=await asOwner(()=>rows('select count(*)::int as n from public.notifications'));
  await assert.rejects(()=>mutate('send_reminder',{kind:'plan',plan_id:plan.id,target_user_id:id(7)}));
  await assert.rejects(()=>mutate('add_adjustment',{user_id:id(7),delta:5}));
  assert.deepEqual(await asOwner(()=>rows('select count(*)::int as n from public.notifications')),notices);
  await actor(7);
  assert.equal(await manage(),false);
  await denied(workspace);
  await actor(1);
});

await check('direct dispute creation requires the caller’s actual completed pick and a clean pending state',async()=>{
  await asOwner(async()=>{
    await insert('drafts',{id:id(222),club_id:id(10),created_by:id(1),topic:'Standalone review',status:'complete'});
    for(const user of [1,2]) {
      await insert('draft_participants',{club_id:id(10),draft_id:id(222),user_id:id(user),pick_order:user});
      await insert('draft_picks',{id:id(1700+user),club_id:id(10),draft_id:id(222),user_id:id(user),pick_number:user,round:1,pick_text:`Standalone ${user}`});
    }
  });
  await actor(2);
  const base={club_id:id(10),draft_id:id(222),pick_id:id(1702),user_id:id(2),reason:'Please review my own pick'};
  await insert('draft_pick_disputes',{id:id(503),...base});
  for(const invalid of [
    {pick_id:id(1701)}, {user_id:id(1)}, {draft_id:id(200)}, {status:'resolved'},
    {resolution:'Already handled'}, {resolved_by:id(2)}, {resolved_at:new Date().toISOString()}, {commissioner_rationale:'Forged decision'},
  ]) await denied(()=>insert('draft_pick_disputes',{id:id(request++),...base,...invalid}));
  const persisted=(await rows('select * from public.draft_pick_disputes where id=$1',[id(503)]))[0];
  assert.equal(persisted.status,'pending');
  assert.equal(persisted.resolved_by,null);
  await actor(1);
});

await check('a standalone creator can record a decision but cannot rewrite dispute identity or ownership',async()=>{
  const changed=await db.query("update public.draft_pick_disputes set status='rejected',resolved_at=now(),resolved_by=$1,commissioner_rationale=$2 where id=$3 returning *",[id(1),'Standalone category ruling',id(503)]);
  assert.equal(changed.rows.length,1);
  assert.equal(changed.rows[0].status,'rejected');
  assert.equal(changed.rows[0].resolved_by,id(1));
  for(const [column,value] of [['id',id(999)],['user_id',id(1)],['pick_id',id(1701)],['draft_id',id(200)],['club_id',id(11)]]) {
    await denied(()=>db.query(`update public.draft_pick_disputes set ${column}=$1 where id=$2 returning id`,[value,id(503)]));
  }
  const preserved=(await rows('select * from public.draft_pick_disputes where id=$1',[id(503)]))[0];
  assert.equal(preserved.user_id,id(2));
  assert.equal(preserved.pick_id,id(1702));
  assert.equal(preserved.draft_id,id(222));
  assert.equal(preserved.club_id,id(10));
});

await check('normal draft assignment is audited and rejects cross-club or LIVE season candidates',async()=>{
  const before=await auditCount();
  for(const target of [211,212]) await assert.rejects(()=>mutate('add_draft',{draft_id:id(target)}));
  assert.equal(await auditCount(),before);
  await mutate('add_draft',{draft_id:id(210)},'Include the club draft');
  assert.equal((await rows('select count(*)::int as n from draft_season_entries where season_id=$1 and draft_id=$2',[id(100),id(210)]))[0].n,1);
  await mutate('remove_draft',{draft_id:id(210)},'Reschedule this event');
  assert.equal((await rows('select count(*)::int as n from draft_season_entries where draft_id=$1',[id(210)]))[0].n,0);
  assert.deepEqual(await sourceResults(),originalResults);
});

await check('season rule edits recalculate only the season projection and reject invalid or archived changes',async()=>{
  const change=await mutate('update_season',{best_of:1,subtitle:'The spring league'},'Count one result per player');
  assert.equal(change.record.best_of,1);
  assert.ok((await standings()).slice(0,3).every(row=>row.season_points===10));
  await mutate('update_season',{best_of:2},'Restore the season format');
  assert.ok((await standings()).slice(0,3).every(row=>row.season_points===17));
  const before=await auditCount();
  await assert.rejects(()=>mutate('update_season',{best_of:0}));
  await assert.rejects(()=>mutate('update_season',{regular_season_drafts:1}));
  await assert.rejects(()=>mutate('update_season',{best_of:1},'Archived rule change',id(request++),102));
  assert.equal(await auditCount(),before);
  assert.deepEqual(await sourceResults(),originalResults);
});

await check('reminders create an actual private inbox record and enforce a cooldown',async()=>{
  const sent=await mutate('send_reminder',{kind:'pick',target_user_id:id(2),draft_id:id(214)},'Waiting on your selection');
  assert.ok(sent.record.notification_id);
  const inbox=await asOwner(()=>rows('select * from public.notifications where id=$1',[sent.record.notification_id]));
  assert.equal(inbox.length,1);
  assert.equal(inbox[0].user_id,id(2));
  assert.equal(inbox[0].club_id,id(10));
  assert.ok(inbox[0].url.includes(id(214)));
  const before=await auditCount();
  await assert.rejects(()=>mutate('send_reminder',{kind:'pick',target_user_id:id(2),draft_id:id(214)}));
  assert.equal(await auditCount(),before);
  assert.equal((await asOwner(()=>rows('select count(*)::int as n from public.notifications')))[0].n,1);
  assert.equal((await rows('select * from public.notifications')).length,0);
  await actor(2);
  assert.equal((await rows('select * from public.notifications')).length,1);
  await actor(1);
});

await check('reminder targets must match the actual pending turn or topic and remain in the club',async()=>{
  const before=await auditCount();
  for(const payload of [
    {kind:'pick',target_user_id:id(1),draft_id:id(214)},
    {kind:'pick',target_user_id:id(4),draft_id:id(211)},
    {kind:'topic',target_user_id:id(2),match_id:id(400)},
  ]) await assert.rejects(()=>mutate('send_reminder',payload));
  assert.equal(await auditCount(),before);
  const sent=await mutate('send_reminder',{kind:'topic',target_user_id:id(5),match_id:id(400)});
  assert.ok(sent.record.notification_id);
});

await check('audit failure rolls back reminder delivery and a completed cooldown allows a new notice',async()=>{
  const before=await asOwner(()=>rows('select count(*)::int as n from public.notifications'));
  const reminderCount=(await workspace()).reminders.length;
  await asOwner(()=>db.exec(`create function public.test_reject_commissioner_audit() returns trigger language plpgsql as $$ begin if new.reason='Force audit rollback' then raise exception 'test audit failure'; end if; return new; end $$;
    create trigger test_reject_audit before insert on public.draft_commissioner_audit for each row execute function public.test_reject_commissioner_audit();`));
  try {
    await assert.rejects(()=>mutate('send_reminder',{kind:'plan',target_user_id:id(2),plan_id:plan.id},'Force audit rollback'),/test audit failure/);
    assert.deepEqual(await asOwner(()=>rows('select count(*)::int as n from public.notifications')),before);
    assert.equal((await workspace()).reminders.length,reminderCount);
  } finally {
    await asOwner(()=>db.exec('drop trigger test_reject_audit on public.draft_commissioner_audit; drop function public.test_reject_commissioner_audit()'));
  }
  await asOwner(()=>db.exec("update public.draft_commissioner_reminders set created_at=now()-interval '61 minutes' where kind='pick'"));
  const sent=await mutate('send_reminder',{kind:'pick',target_user_id:id(2),draft_id:id(214)},'Still waiting on your selection');
  assert.ok(sent.record.notification_id);
  assert.equal((await asOwner(()=>rows('select count(*)::int as n from public.notifications')))[0].n,before[0].n+1);
});

await check('commissioner dispute decisions are scoped and preserve authoritative report rows',async()=>{
  const decision=await mutate('reject_dispute',{dispute_id:id(500)},'The existing category interpretation is correct');
  assert.equal(decision.record.status,'rejected');
  assert.equal(decision.record.resolved_by,id(1));
  assert.equal(decision.record.commissioner_rationale,'The existing category interpretation is correct');
  assert.deepEqual(await sourceResults(),originalResults);
  const before=await auditCount();
  await assert.rejects(()=>mutate('dismiss_dispute',{dispute_id:id(500)}));
  assert.equal(await auditCount(),before);
});

await check('service regrades commit report, dispute, adjusted projection and audit together or roll them all back',async()=>{
  await asOwner(()=>insert('draft_pick_disputes',{id:id(504),club_id:id(10),draft_id:id(200),pick_id:id(1002),user_id:id(2),reason:'Review the second pick'}));
  await mutate('add_adjustment',{user_id:id(2),delta:3},'Preserve the separate season correction');
  const before=(await rows('select total_score from public.draft_results where draft_id=$1 and user_id=$2',[id(200),id(2)]))[0];
  const beforeStanding=(await standings()).find(row=>row.user_id===id(2));
  assert.equal(beforeStanding.season_points,20);
  const beforeAudit=await auditCount();
  await asOwner(()=>db.exec(`create function public.test_reject_regrade_audit() returns trigger language plpgsql as $$ begin if new.action='resolve_dispute' and new.reason='Force regrade rollback' then raise exception 'test regrade audit failure'; end if; return new; end $$;
    create trigger test_reject_regrade_audit before insert on public.draft_commissioner_audit for each row execute function public.test_reject_regrade_audit();`));
  const regrade=async(resolution)=>asService(()=>db.transaction(async tx=>{
    await tx.query('update public.draft_results set total_score=total_score+1 where draft_id=$1 and user_id=$2',[id(200),id(2)]);
    await tx.query("update public.draft_pick_disputes set status='resolved',resolved_by=$1,resolved_at=now(),resolution=$2 where id=$3",[id(1),resolution,id(504)]);
  }));
  try {
    await assert.rejects(()=>regrade('Force regrade rollback'),/test regrade audit failure/);
    assert.deepEqual((await rows('select total_score from public.draft_results where draft_id=$1 and user_id=$2',[id(200),id(2)]))[0],before);
    assert.equal((await rows('select status from public.draft_pick_disputes where id=$1',[id(504)]))[0].status,'pending');
    assert.deepEqual((await standings()).find(row=>row.user_id===id(2)),beforeStanding);
    assert.equal(await auditCount(),beforeAudit);
  } finally {
    await asOwner(()=>db.exec('drop trigger test_reject_regrade_audit on public.draft_commissioner_audit; drop function public.test_reject_regrade_audit()'));
  }
  await regrade('Re-evaluated against the same category rules');
  assert.equal(Number((await rows('select total_score from public.draft_results where draft_id=$1 and user_id=$2',[id(200),id(2)]))[0].total_score),Number(before.total_score)+1);
  const projected=(await standings()).find(row=>row.user_id===id(2));
  assert.equal(projected.season_points,20);
  assert.equal(Number(projected.avg_score),84.33);
  const audit=(await workspace()).audit.find(item=>item.action==='resolve_dispute');
  assert.ok(audit);
  assert.equal(audit.actor_user_id,id(1));
  assert.equal(audit.before_data.status,'pending');
  assert.equal(audit.after_data.status,'resolved');
  assert.equal(await auditCount(),beforeAudit+1);
  await asService(()=>db.query("update public.draft_pick_disputes set status='resolved' where id=$1",[id(504)]));
  assert.equal(await auditCount(),beforeAudit+1);
});

const deletionTables=['competitions','drafts','draft_participants','draft_picks','draft_results','draft_pick_disputes','draft_skips','draft_season_entries','draft_season_standings','item_enrichments','rankings','draft_desk_items','draft_commissioner_plans','draft_commissioner_reminders','draft_commissioner_audit','notifications'];
const deletionSnapshot=()=>asOwner(async()=>Object.fromEntries(await Promise.all(deletionTables.map(async table=>[table,await rows(`select * from public.${table} order by id`)]))));
async function seedDeletion(draft,competition,{creator=1,competitionCreator=creator,type='draft'}={}) {
  await asOwner(async()=>{
    await insert('competitions',{id:id(competition),club_id:id(10),created_by:id(competitionCreator),type,title:`Container ${competition}`});
    await insert('drafts',{id:id(draft),competition_id:id(competition),club_id:id(10),created_by:id(creator),topic:`Removable ${draft}`,status:'complete'});
    for(const [index,user] of [1,2].entries()) {
      await insert('draft_participants',{club_id:id(10),draft_id:id(draft),user_id:id(user),pick_order:index+1});
      const pickId=id(draft*10+user);
      await insert('draft_picks',{id:pickId,club_id:id(10),draft_id:id(draft),user_id:id(user),round:1,pick_number:index+1,pick_text:`Delete candidate ${draft}-${user}`});
      await insert('draft_results',{club_id:id(10),draft_id:id(draft),user_id:id(user),rank:index+1,total_score:90-index*5});
      await insert('item_enrichments',{item_id:pickId,item_type:'draft_pick',image_url:`https://art.invalid/${draft}-${user}`});
      await insert('draft_desk_items',{draft_id:id(draft),user_id:id(user),title:'Saved private idea'});
    }
    await insert('draft_pick_disputes',{club_id:id(10),draft_id:id(draft),pick_id:id(draft*10+2),user_id:id(2),reason:'Historical review'});
    await insert('draft_skips',{club_id:id(10),draft_id:id(draft),user_id:id(1),round:2,pick_number:3});
  });
}

await check('an assigned draft cannot be deleted through RPC, raw DELETE or a cascading parent container',async()=>{
  await asOwner(async()=>{
    await insert('competitions',{id:id(1800),club_id:id(10),created_by:id(1),type:'draft',title:'Assigned competition'});
    await db.query('update public.drafts set competition_id=$1 where id=$2',[id(1800),id(200)]);
    await insert('item_enrichments',{item_id:id(1001),item_type:'draft_pick',image_url:'https://art.invalid/assigned'});
  });
  const before=await deletionSnapshot();
  await denied(()=>deleteDraft(200));
  await writeBlocked(()=>db.query('delete from public.drafts where id=$1 returning id',[id(200)]));
  await assert.rejects(()=>asOwner(()=>db.query('delete from public.competitions where id=$1',[id(1800)])),/Remove this draft from its season/);
  assert.deepEqual(await deletionSnapshot(),before);
});

await check('a linked commissioner plan refuses deletion before cleanup and stays unchanged after explicit unlinking',async()=>{
  await seedDeletion(225,1825);
  const linked=(await mutate('upsert_plan',planPayload({topic:'Launched planned event',status:'launched',draft_id:id(225)}),'Record the planned launch')).record;
  const before=await deletionSnapshot();
  await assert.rejects(()=>deleteDraft(225),/linked to a commissioner plan/);
  assert.deepEqual(await deletionSnapshot(),before);
  const unlinked=(await mutate('upsert_plan',planPayload({id:linked.id,expected_version:linked.version,topic:linked.topic,draft_id:null,status:'planned'}),'Unlink this archived event')).record;
  await deleteDraft(225);
  assert.deepEqual((await workspace()).plans.find(row=>row.id===linked.id),unlinked);
  assert.equal((await rows('select id from public.drafts where id=$1',[id(225)])).length,0);
});

await check('creator deletion removes only the selected draft family and preserves actual notification history',async()=>{
  await seedDeletion(226,1826);
  await asOwner(async()=>{
    await insert('competitions',{id:id(1830),club_id:id(10),created_by:id(2),type:'poll',title:'Unrelated poll'});
    await insert('item_enrichments',{id:id(1901),item_id:id(2261),item_type:'ranking_item',image_url:'https://art.invalid/other-feature'});
    await insert('notifications',{id:id(1900),user_id:id(2),club_id:id(10),type:'draft',title:'Historical draft reminder',url:`/drafts/${id(226)}`,actor_user_id:id(1)});
    await insert('draft_commissioner_reminders',{id:id(1902),season_id:id(100),club_id:id(10),target_user_id:id(2),draft_id:id(226),kind:'pick',notification_id:id(1900),created_by:id(1)});
  });
  const before=await deletionSnapshot();
  const receipt=before.draft_commissioner_reminders.find(row=>row.id===id(1902));
  await deleteDraft(226);
  const after=await deletionSnapshot();
  for(const table of ['drafts','draft_participants','draft_picks','draft_results','draft_pick_disputes','draft_skips','draft_desk_items']) {
    assert.deepEqual(after[table],before[table].filter(row=>table==='drafts'?row.id!==id(226):row.draft_id!==id(226)));
  }
  assert.deepEqual(after.competitions,before.competitions.filter(row=>row.id!==id(1826)));
  assert.deepEqual(after.item_enrichments,before.item_enrichments.filter(row=>!(row.item_type==='draft_pick'&&[id(2261),id(2262)].includes(row.item_id))));
  assert.deepEqual(after.notifications,before.notifications);
  assert.deepEqual(after.draft_commissioner_reminders.find(row=>row.id===id(1902)),{...receipt,draft_id:null});
  assert.deepEqual(after.draft_commissioner_plans,before.draft_commissioner_plans);
  assert.deepEqual(after.draft_commissioner_audit,before.draft_commissioner_audit);
});

await check('competition cleanup never cascades another draft, ranking, different owner or feature container',async()=>{
  await seedDeletion(227,1827);
  await seedDeletion(229,1829,{competitionCreator:2});
  await seedDeletion(230,1831,{type:'poll'});
  await seedDeletion(231,1832);
  await asOwner(async()=>{
    await insert('drafts',{id:id(228),competition_id:id(1827),club_id:id(10),created_by:id(1),topic:'Another draft in the container'});
    await insert('rankings',{id:id(1910),competition_id:id(1832),title:'Ranking tied to a shared container'});
  });
  const before=await deletionSnapshot();
  for(const draft of [227,229,230,231]) await deleteDraft(draft);
  const after=await deletionSnapshot();
  assert.deepEqual(after.competitions,before.competitions);
  assert.deepEqual(after.rankings,before.rankings);
  assert.deepEqual(after.drafts.find(row=>row.id===id(228)),before.drafts.find(row=>row.id===id(228)));
});

await check('unassigned deletion requires the actual same-club creator or app admin, never another member or anonymous caller',async()=>{
  await seedDeletion(232,1833);
  await seedDeletion(235,1835,{creator:7}); // A historical hidden creator does not become public admin work.
  const before=await deletionSnapshot();
  for(const user of [0,2,4,6,8]) {
    await actor(user);
    await denied(()=>deleteDraft(232));
  }
  await db.exec('set role anon');
  await denied(()=>deleteDraft(232));
  await actor(3);
  await denied(()=>deleteDraft(235));
  await actor(1);
  assert.deepEqual(await deletionSnapshot(),before);
  await actor(3);
  await deleteDraft(232);
  assert.equal((await rows('select id from public.drafts where id=$1',[id(232)])).length,0);
  await actor(1);
});

await check('a cleanup constraint failure rolls back enrichments, results, picks, participants, draft and container',async()=>{
  await seedDeletion(234,1834);
  await asOwner(()=>db.exec(`create table public.test_delete_blocker(id uuid primary key default gen_random_uuid(),draft_id uuid not null references public.drafts(id) on delete restrict);
    insert into public.test_delete_blocker(draft_id) values('${id(234)}');`));
  const before=await deletionSnapshot();
  await assert.rejects(()=>deleteDraft(234),error=>error.code==='23503');
  assert.deepEqual(await deletionSnapshot(),before);
  await asOwner(()=>db.exec('drop table public.test_delete_blocker'));
  await deleteDraft(234);
  assert.equal((await rows('select id from public.drafts where id=$1',[id(234)])).length,0);
});

await check('service role may rebuild standings without gaining unauthenticated commissioner mutations',async()=>{
  await db.exec('reset role');
  await db.query("select set_config('test.user','',false),set_config('test.role','service_role',false)");
  await db.exec('set role service_role');
  await recalc();
  await denied(()=>mutate('update_season',{subtitle:'Service impersonation'}));
  await actor(1);
});

await check('commissioner transfer changes authority atomically and remains audited',async()=>{
  const result=await mutate('transfer_commissioner',{user_id:id(2)},'Hand over the next event');
  assert.equal(result.record.commissioner_user_id,id(2));
  assert.equal(await manage(),false);
  await denied(workspace);
  await actor(2);
  assert.equal(await manage(),true);
  const state=await workspace();
  assert.ok(state.audit.some(item=>item.audit_id===result.audit_id||item.id===result.audit_id));
  await actor(3); assert.equal(await manage(),true);
});

await db.close();
console.log(`${checks} commissioner database integration checks passed.`);
