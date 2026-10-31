-- Commissioner operations are club scoped, audited and transactional. Judged
-- draft_results remain authoritative; manual season points live in a ledger.
begin;

create or replace function public.draft_commissioner_actor_can_manage(p_season_id uuid,p_actor_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select p_actor_id is not null and exists(
    select 1 from public.draft_seasons s join public.club_members m on m.club_id=s.club_id and m.user_id=p_actor_id
    where s.id=p_season_id and public.dh_visible_club(s.club_id)
      and public.dh_visible_member(p_actor_id) and public.dh_visible_member(s.commissioner_user_id)
      and (s.commissioner_user_id=p_actor_id or public.is_app_admin(p_actor_id))
  )
$$;
revoke all on function public.draft_commissioner_actor_can_manage(uuid,uuid) from public,anon,authenticated;
grant execute on function public.draft_commissioner_actor_can_manage(uuid,uuid) to service_role;

create or replace function public.draft_commissioner_can_manage(p_season_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and exists(select 1 from public.draft_seasons s
    where s.id=p_season_id and s.club_id=public.current_user_club_id()
      and public.draft_commissioner_actor_can_manage(s.id,auth.uid()))
$$;
revoke all on function public.draft_commissioner_can_manage(uuid) from public,anon;
grant execute on function public.draft_commissioner_can_manage(uuid) to authenticated,service_role;

-- Historical audit JSON must obey the same private-identity rules as typed
-- rows. Checking the actor alone could expose a target who became private.
create or replace function public.draft_commissioner_visible_payload(p_data jsonb)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select not exists(select 1 from jsonb_each(case when jsonb_typeof(p_data)='object' then p_data else '{}'::jsonb end) x
    where x.key in('user_id','created_by','updated_by','revoked_by','target_user_id','actor_user_id','commissioner_user_id','resolved_by',
      'champion_user_id','runner_up_user_id','third_place_user_id','regular_season_champion_user_id')
      and case when x.value='null'::jsonb then false
        when jsonb_typeof(x.value)='string' and (x.value#>>'{}')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then not public.dh_visible_member((x.value#>>'{}')::uuid)
        else true end)
$$;
revoke all on function public.draft_commissioner_visible_payload(jsonb) from public,anon;
grant execute on function public.draft_commissioner_visible_payload(jsonb) to authenticated,service_role;

create table public.draft_commissioner_presets (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
  season_id uuid not null references public.draft_seasons(id), name text not null check(length(btrim(name)) between 1 and 80),
  config jsonb not null check(jsonb_typeof(config)='object'), version integer not null default 1,
  created_by uuid not null references public.profiles(id), updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.draft_commissioner_plans (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
  season_id uuid not null references public.draft_seasons(id), topic text not null check(length(btrim(topic)) between 1 and 500),
  notes text not null default '' check(length(notes)<=2000), ai_context text not null default '' check(length(ai_context)<=1000),
  num_rounds integer not null default 5 check(num_rounds between 1 and 20), is_live boolean not null default false,
  live_settings jsonb not null default '{}' check(jsonb_typeof(live_settings)='object'),
  scheduled_at timestamptz, due_at timestamptz, draft_id uuid references public.drafts(id),
  preset_id uuid references public.draft_commissioner_presets(id) on delete set null,
  status text not null default 'planned' check(status in('planned','ready','launched','cancelled')),
  version integer not null default 1, created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  check(due_at is null or scheduled_at is null or due_at>=scheduled_at),
  check(status<>'launched' or draft_id is not null)
);
create unique index draft_commissioner_plan_draft_key on public.draft_commissioner_plans(draft_id) where draft_id is not null;
create table public.draft_commissioner_adjustments (
  id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),
  season_id uuid not null references public.draft_seasons(id),user_id uuid not null references public.profiles(id),
  delta integer not null check(delta between -100 and 100 and delta<>0),reason text not null check(length(btrim(reason)) between 3 and 1000),
  created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
  revoked_at timestamptz,revoked_by uuid references public.profiles(id),revocation_reason text
);
create table public.draft_commissioner_audit (
  id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),season_id uuid not null references public.draft_seasons(id),
  actor_user_id uuid not null references public.profiles(id),action text not null,reason text not null,
  before_data jsonb,after_data jsonb,request_id uuid not null unique,request_payload jsonb not null default '{}',created_at timestamptz not null default now()
);
create table public.draft_commissioner_reminders (
  id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),season_id uuid not null references public.draft_seasons(id),
  target_user_id uuid not null references public.profiles(id),draft_id uuid references public.drafts(id) on delete set null,match_id uuid references public.draft_playoff_matches(id),
  plan_id uuid references public.draft_commissioner_plans(id) on delete set null,kind text not null check(kind in('pick','topic','plan')),
  notification_id uuid references public.notifications(id) on delete set null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create index draft_commissioner_reminder_cooldown on public.draft_commissioner_reminders(season_id,target_user_id,kind,created_at desc);

-- New tables never accept raw client writes, even from a commissioner. The
-- operation and its audit record must commit together through the RPC.
do $$ declare t text; actors text; checks text;
begin
  foreach t in array array['draft_commissioner_plans','draft_commissioner_presets','draft_commissioner_adjustments','draft_commissioner_audit','draft_commissioner_reminders'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    if t='draft_commissioner_presets' then
      execute format('create policy commissioner_read on public.%I for select to authenticated using(club_id=public.current_user_club_id() and exists(select 1 from public.club_members m where m.club_id=%I.club_id and m.user_id=auth.uid()))',t,t);
    else
      execute format('create policy commissioner_read on public.%I for select to authenticated using(public.draft_commissioner_can_manage(season_id))',t);
    end if;
    actors:=case t when 'draft_commissioner_audit' then '''actor_user_id''' when 'draft_commissioner_adjustments' then '''user_id'',''created_by'',''revoked_by''' when 'draft_commissioner_reminders' then '''target_user_id'',''created_by''' else '''created_by'',''updated_by''' end;
    checks:=case t when 'draft_commissioner_audit' then 'public.dh_visible_member(actor_user_id) and public.draft_commissioner_visible_payload(before_data) and public.draft_commissioner_visible_payload(after_data) and public.draft_commissioner_visible_payload(request_payload)' when 'draft_commissioner_adjustments' then 'public.dh_visible_member(user_id) and public.dh_visible_member(created_by) and public.dh_visible_member(revoked_by)' when 'draft_commissioner_reminders' then 'public.dh_visible_member(target_user_id) and public.dh_visible_member(created_by)' else 'public.dh_visible_member(created_by) and public.dh_visible_member(updated_by)' end;
    execute format('create policy dh_private_visibility on public.%I as restrictive for all to anon,authenticated using(public.dh_visible_club(club_id) and %s) with check(public.dh_visible_club(club_id) and %s)',t,checks,checks);
    execute format('create trigger zz_dh_private_guard before insert or update on public.%I for each row execute function public.dh_private_write_guard(%s)',t,actors);
  end loop;
end $$;

-- Remove overlapping permissive write policies, including legacy ALL policies.
-- Restrictive dh_private_visibility is deliberately never dropped.
do $$ declare p record;
begin
  for p in select tablename,policyname from pg_policies where schemaname='public'
    and tablename in('draft_seasons','draft_season_entries','draft_season_standings','draft_pick_disputes')
    and permissive='PERMISSIVE' and cmd in('ALL','INSERT','UPDATE','DELETE') loop
    execute format('drop policy %I on public.%I',p.policyname,p.tablename);
  end loop;
end $$;
create or replace function public.draft_commissioner_can_create(p_club_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and p_club_id=public.current_user_club_id()
    and public.dh_visible_club(p_club_id) and public.dh_visible_member(auth.uid())
    and exists(select 1 from public.club_members m where m.club_id=p_club_id and m.user_id=auth.uid())
    and (public.is_app_admin(auth.uid()) or public.is_club_admin(auth.uid(),p_club_id)
      or exists(select 1 from public.draft_seasons s where s.club_id=p_club_id and s.commissioner_user_id=auth.uid()))
$$;
revoke all on function public.draft_commissioner_can_create(uuid) from public,anon;
grant execute on function public.draft_commissioner_can_create(uuid) to authenticated;
create policy commissioner_create_season on public.draft_seasons for insert to authenticated
  with check(public.draft_commissioner_can_create(club_id) and public.dh_visible_member(commissioner_user_id)
    and exists(select 1 from public.club_members m where m.club_id=draft_seasons.club_id and m.user_id=draft_seasons.commissioner_user_id));
-- Existing read policies survive the removal of broad ALL policies.
create policy commissioner_season_read on public.draft_seasons for select to authenticated using(club_id=public.current_user_club_id());
create policy commissioner_entries_read on public.draft_season_entries for select to authenticated using(club_id=public.current_user_club_id());
create policy commissioner_standings_read on public.draft_season_standings for select to authenticated using(club_id=public.current_user_club_id());
revoke update,delete on public.draft_seasons from authenticated;
revoke insert,update,delete on public.draft_season_entries,public.draft_season_standings from authenticated;
create policy commissioner_disputes_read on public.draft_pick_disputes for select to authenticated using(club_id=public.current_user_club_id());
create policy commissioner_disputes_submit on public.draft_pick_disputes for insert to authenticated with check(
  user_id=auth.uid() and club_id=public.current_user_club_id() and exists(select 1 from public.drafts d
    join public.draft_participants p on p.draft_id=d.id and p.user_id=auth.uid()
    where d.id=draft_pick_disputes.draft_id and d.club_id=draft_pick_disputes.club_id and d.status='complete')
    and status='pending' and resolved_at is null and resolved_by is null and commissioner_rationale is null and resolution is null
    and exists(select 1 from public.draft_picks dp where dp.id=draft_pick_disputes.pick_id and dp.draft_id=draft_pick_disputes.draft_id and dp.user_id=auth.uid()));
create policy commissioner_standalone_disputes_update on public.draft_pick_disputes for update to authenticated
  using(club_id=public.current_user_club_id() and not exists(select 1 from public.draft_season_entries e where e.draft_id=draft_pick_disputes.draft_id)
    and exists(select 1 from public.drafts d where d.id=draft_pick_disputes.draft_id and d.club_id=draft_pick_disputes.club_id
      and (d.created_by=auth.uid() or public.is_app_admin(auth.uid()))))
  with check(club_id=public.current_user_club_id() and not exists(select 1 from public.draft_season_entries e where e.draft_id=draft_pick_disputes.draft_id));
revoke update,delete on public.draft_pick_disputes from authenticated;
grant update(status,resolved_at,resolved_by,commissioner_rationale) on public.draft_pick_disputes to authenticated;

create or replace function public.recalculate_draft_season_standings(p_season_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.draft_seasons%rowtype; locked boolean;
begin
  select * into s from public.draft_seasons where id=p_season_id for update;
  if not found then raise exception 'Season unavailable' using errcode='42501'; end if;
  if coalesce(auth.role(),'')<>'service_role' and not(auth.uid() is not null and s.club_id=public.current_user_club_id()
    and public.dh_visible_club(s.club_id) and public.dh_visible_member(auth.uid())
    and exists(select 1 from public.club_members m where m.club_id=s.club_id and m.user_id=auth.uid())) then
    raise exception 'Season unavailable' using errcode='42501';
  end if;
  locked:=s.status in('playoffs','complete');
  if exists(select 1 from public.draft_results r join public.draft_season_entries e on e.draft_id=r.draft_id
    where e.season_id=s.id and not e.is_playoff and (r.rank<1 or r.total_score::text in('NaN','Infinity','-Infinity'))) then
    raise exception 'Season report data needs review';
  end if;
  with raw as (
    select r.user_id,r.rank,r.total_score,r.draft_id,e.week_number,
      case r.rank when 1 then 10 when 2 then 7 when 3 then 5 when 4 then 3 when 5 then 2 else 1 end pts
    from public.draft_results r join public.draft_season_entries e on e.draft_id=r.draft_id
      join public.drafts d on d.id=r.draft_id
    where e.season_id=s.id and not e.is_playoff and e.club_id=s.club_id and r.club_id=s.club_id and d.club_id=s.club_id
      and public.dh_visible_member(r.user_id)
  ), counted as (
    select *,row_number() over(partition by user_id order by pts desc,week_number,draft_id) counted_position from raw
  ), aggregate as (
    select user_id,sum(pts) filter(where counted_position<=greatest(1,s.best_of))::integer base_points,
      count(*)::integer drafts_played,count(*) filter(where rank=1)::integer wins,count(*) filter(where rank<=3)::integer podiums,
      round(avg(rank),2) avg_finish,round(avg(total_score),2) avg_score,round(max(total_score),2) best_score,
      round(min(total_score),2) worst_score,round(stddev_pop(total_score),2) consistency from counted group by user_id
  ), adjusted as (
    select a.*,a.base_points+coalesce((select sum(x.delta)::integer from public.draft_commissioner_adjustments x
      where x.season_id=s.id and x.club_id=s.club_id and x.user_id=a.user_id and x.revoked_at is null
        and public.dh_visible_member(x.created_by)),0) total_points from aggregate a
  ), ranked as (
    select *,rank() over(order by total_points desc)::integer season_rank,
      row_number() over(order by total_points desc,wins desc,podiums desc,avg_finish asc,avg_score desc,user_id)::integer seed from adjusted
  )
  insert into public.draft_season_standings(club_id,season_id,user_id,season_points,drafts_played,wins,podiums,avg_finish,avg_score,best_score,worst_score,consistency,rank,playoff_seed)
    select s.club_id,s.id,user_id,total_points,drafts_played,wins,podiums,avg_finish,avg_score,best_score,worst_score,consistency,
      case when locked then null else season_rank end,case when locked then null else seed end from ranked
  on conflict(season_id,user_id) do update set season_points=excluded.season_points,drafts_played=excluded.drafts_played,
    wins=excluded.wins,podiums=excluded.podiums,avg_finish=excluded.avg_finish,avg_score=excluded.avg_score,
    best_score=excluded.best_score,worst_score=excluded.worst_score,consistency=excluded.consistency,
    rank=case when locked then draft_season_standings.rank else excluded.rank end,
    playoff_seed=case when locked then draft_season_standings.playoff_seed else excluded.playoff_seed end,updated_at=now();
  delete from public.draft_season_standings x where x.season_id=s.id and not locked and not exists(
    select 1 from public.draft_results r join public.draft_season_entries e on e.draft_id=r.draft_id
    where e.season_id=s.id and not e.is_playoff and r.user_id=x.user_id and r.club_id=s.club_id and public.dh_visible_member(r.user_id));
  update public.draft_season_entries e set season_points_awarded=coalesce((select jsonb_object_agg(r.user_id::text,
    case r.rank when 1 then 10 when 2 then 7 when 3 then 5 when 4 then 3 when 5 then 2 else 1 end)
    from public.draft_results r where r.draft_id=e.draft_id and r.club_id=s.club_id and public.dh_visible_member(r.user_id)),'{}'::jsonb)
    where e.season_id=s.id and e.club_id=s.club_id and not e.is_playoff;
end $$;
revoke all on function public.recalculate_draft_season_standings(uuid) from public,anon;
grant execute on function public.recalculate_draft_season_standings(uuid) to authenticated,service_role;

create or replace function public.draft_commissioner_workspace(p_season_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if not public.draft_commissioner_can_manage(p_season_id) then raise exception 'Commissioner access required' using errcode='42501'; end if;
  select jsonb_build_object(
    'plans',coalesce((select jsonb_agg(to_jsonb(p) order by p.scheduled_at nulls last,p.created_at) from public.draft_commissioner_plans p where p.season_id=p_season_id and public.dh_visible_member(p.created_by) and public.dh_visible_member(p.updated_by)),'[]'::jsonb),
    'presets',coalesce((select jsonb_agg(to_jsonb(p) order by p.name,p.id) from public.draft_commissioner_presets p where p.season_id=p_season_id and public.dh_visible_member(p.created_by) and public.dh_visible_member(p.updated_by)),'[]'::jsonb),
    'adjustments',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from public.draft_commissioner_adjustments p where p.season_id=p_season_id and public.dh_visible_member(p.user_id) and public.dh_visible_member(p.created_by) and public.dh_visible_member(p.revoked_by)),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from (select * from public.draft_commissioner_audit a where a.season_id=p_season_id and public.dh_visible_member(a.actor_user_id)
      and public.draft_commissioner_visible_payload(a.before_data) and public.draft_commissioner_visible_payload(a.after_data) and public.draft_commissioner_visible_payload(a.request_payload)
      order by a.created_at desc,a.id limit 200) p),'[]'::jsonb),
    'reminders',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from (select * from public.draft_commissioner_reminders a where a.season_id=p_season_id and public.dh_visible_member(a.target_user_id) and public.dh_visible_member(a.created_by) order by a.created_at desc,a.id limit 200) p),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.draft_commissioner_workspace(uuid) from public,anon;
grant execute on function public.draft_commissioner_workspace(uuid) to authenticated;

create or replace function public.draft_commissioner_validate_config(p_config jsonb)
returns void language plpgsql immutable set search_path=public,pg_temp as $$
declare k text; live jsonb;
begin
  if p_config is null or jsonb_typeof(p_config)<>'object' or exists(select 1 from jsonb_object_keys(p_config) x where x not in('topic','description','category','num_rounds','ai_context','is_live','live_settings')) then raise exception 'Invalid preset configuration'; end if;
  foreach k in array array['topic','description','category','ai_context'] loop
    if p_config?k and jsonb_typeof(p_config->k) not in('string','null') then raise exception 'Invalid preset text'; end if;
  end loop;
  if p_config?'num_rounds' and jsonb_typeof(p_config->'num_rounds')<>'number' then raise exception 'Invalid round count'; end if;
  if coalesce(p_config->>'num_rounds','5')!~'^([1-9]|1[0-9]|20)$' or length(coalesce(p_config->>'topic',''))>500
    or length(coalesce(p_config->>'ai_context',''))>1000 or length(coalesce(p_config->>'description',''))>2000
    or length(coalesce(p_config->>'category',''))>100 then raise exception 'Invalid preset configuration'; end if;
  if p_config ? 'is_live' and jsonb_typeof(p_config->'is_live')<>'boolean' then raise exception 'Invalid draft mode'; end if;
  live:=coalesce(p_config->'live_settings','{}'::jsonb);
  if jsonb_typeof(live)<>'object' then raise exception 'Invalid live settings'; end if;
  for k in select jsonb_object_keys(live) loop
    if k='pickSeconds' then
      if jsonb_typeof(live->k)<>'number' or (live->>k)::numeric not between 10 and 600 then raise exception 'Invalid pick clock'; end if;
    elsif k='timeoutBehavior' then
      if live->>k not in('alert','auto_skip','none') then raise exception 'Invalid clock behavior'; end if;
    elsif k in('sound','ticker','autoStartClock','announce','ceremony','broadcast','reportBroadcast') then
      if jsonb_typeof(live->k)<>'boolean' then raise exception 'Invalid presentation setting'; end if;
    else raise exception 'Unsupported live setting'; end if;
  end loop;
end $$;
revoke all on function public.draft_commissioner_validate_config(jsonb) from public,anon,authenticated;

create or replace function public.draft_commissioner_mutate(p_season_id uuid,p_action text,p_payload jsonb,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.draft_seasons%rowtype; actor uuid:=auth.uid(); old_data jsonb; new_data jsonb; aid uuid; existing public.draft_commissioner_audit%rowtype;
  rid uuid; uid uuid; did uuid; mid uuid; pid uuid; v_config jsonb; n_id uuid; target_topic text; target_url text;
  plan public.draft_commissioner_plans%rowtype; preset public.draft_commissioner_presets%rowtype;
  adj public.draft_commissioner_adjustments%rowtype; dispute public.draft_pick_disputes%rowtype; match public.draft_playoff_matches%rowtype;
  d public.drafts%rowtype; n integer; next_number integer; actual_picker uuid; allowed text[];
begin
  select * into s from public.draft_seasons where id=p_season_id for update;
  if not found or not public.draft_commissioner_can_manage(p_season_id) then raise exception 'Commissioner access required' using errcode='42501'; end if;
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'A reason and request identity are required'; end if;
  allowed:=case p_action
    when 'upsert_plan' then array['id','expected_version','topic','notes','ai_context','num_rounds','is_live','live_settings','scheduled_at','due_at','draft_id','preset_id','status']
    when 'upsert_preset' then array['id','expected_version','name','config']
    when 'delete_plan' then array['id','expected_version'] when 'delete_preset' then array['id','expected_version']
    when 'add_adjustment' then array['user_id','delta'] when 'revoke_adjustment' then array['id']
    when 'add_draft' then array['draft_id'] when 'remove_draft' then array['draft_id']
    when 'update_season' then array['subtitle','regular_season_drafts','best_of']
    when 'transfer_commissioner' then array['user_id']
    when 'dismiss_dispute' then array['dispute_id'] when 'reject_dispute' then array['dispute_id']
    when 'send_reminder' then array['kind','target_user_id','draft_id','match_id','plan_id']
    when 'recalculate' then array[]::text[] else null end;
  if allowed is null or exists(select 1 from jsonb_object_keys(p_payload) k where not(k=any(allowed))) then raise exception 'Unsupported commissioner payload'; end if;
  select * into existing from public.draft_commissioner_audit where request_id=p_request_id;
  if found then
    if existing.season_id<>s.id or existing.actor_user_id<>actor or existing.action<>p_action
      or existing.request_payload<>p_payload or existing.reason<>btrim(p_reason) then raise exception 'Request identity already used'; end if;
    return jsonb_build_object('ok',true,'record',existing.after_data,'audit_id',existing.id);
  end if;
  if p_action in('upsert_plan','delete_plan','upsert_preset','delete_preset','add_adjustment','revoke_adjustment','add_draft','remove_draft','update_season') and s.status='complete' then raise exception 'Archived season is read-only'; end if;

  if p_action='upsert_preset' then
    v_config:=p_payload->'config'; perform public.draft_commissioner_validate_config(v_config);
    if nullif(btrim(p_payload->>'name'),'') is null then raise exception 'Preset name required'; end if;
    rid:=nullif(p_payload->>'id','')::uuid;
    if rid is null then
      insert into public.draft_commissioner_presets(club_id,season_id,name,config,created_by,updated_by)
        values(s.club_id,s.id,btrim(p_payload->>'name'),v_config,actor,actor) returning to_jsonb(draft_commissioner_presets.*) into new_data;
    else
      select * into preset from public.draft_commissioner_presets where id=rid and season_id=s.id
        and public.dh_visible_member(created_by) and public.dh_visible_member(updated_by) for update;
      if not found or preset.version is distinct from (p_payload->>'expected_version')::integer then raise exception 'Preset changed. Reload before saving' using errcode='40001'; end if;
      old_data:=to_jsonb(preset);
      update public.draft_commissioner_presets set name=btrim(p_payload->>'name'),config=v_config,version=version+1,updated_by=actor,updated_at=now()
        where id=rid returning to_jsonb(draft_commissioner_presets.*) into new_data;
    end if;
  elsif p_action='delete_preset' then
    select * into preset from public.draft_commissioner_presets where id=(p_payload->>'id')::uuid and season_id=s.id
      and public.dh_visible_member(created_by) and public.dh_visible_member(updated_by) for update;
    if not found or preset.version is distinct from (p_payload->>'expected_version')::integer then raise exception 'Preset changed. Reload before deleting' using errcode='40001'; end if;
    old_data:=to_jsonb(preset); delete from public.draft_commissioner_presets where id=preset.id;
  elsif p_action='upsert_plan' then
    v_config:=jsonb_build_object('topic',p_payload->>'topic','num_rounds',coalesce((p_payload->>'num_rounds')::integer,5),
      'ai_context',coalesce(p_payload->>'ai_context',''),'is_live',coalesce((p_payload->>'is_live')::boolean,false),'live_settings',coalesce(p_payload->'live_settings','{}'));
    perform public.draft_commissioner_validate_config(v_config);
    did:=nullif(p_payload->>'draft_id','')::uuid; pid:=nullif(p_payload->>'preset_id','')::uuid;
    if did is not null and (not exists(select 1 from public.drafts where id=did and club_id=s.club_id and public.dh_visible_member(created_by)
      and is_live=(v_config->>'is_live')::boolean) or exists(select 1 from public.draft_season_entries where draft_id=did and season_id<>s.id)) then raise exception 'Draft unavailable'; end if;
    if pid is not null and not exists(select 1 from public.draft_commissioner_presets where id=pid and season_id=s.id and club_id=s.club_id
      and public.dh_visible_member(created_by) and public.dh_visible_member(updated_by)) then raise exception 'Preset unavailable'; end if;
    rid:=nullif(p_payload->>'id','')::uuid;
    if rid is null then
      insert into public.draft_commissioner_plans(club_id,season_id,topic,notes,ai_context,num_rounds,is_live,live_settings,scheduled_at,due_at,draft_id,preset_id,status,created_by,updated_by)
        values(s.club_id,s.id,btrim(p_payload->>'topic'),coalesce(p_payload->>'notes',''),v_config->>'ai_context',(v_config->>'num_rounds')::integer,
          (v_config->>'is_live')::boolean,v_config->'live_settings',nullif(p_payload->>'scheduled_at','')::timestamptz,nullif(p_payload->>'due_at','')::timestamptz,
          did,pid,coalesce(p_payload->>'status','planned'),actor,actor) returning to_jsonb(draft_commissioner_plans.*) into new_data;
    else
      select * into plan from public.draft_commissioner_plans where id=rid and season_id=s.id
        and public.dh_visible_member(created_by) and public.dh_visible_member(updated_by) for update;
      if not found or plan.version is distinct from (p_payload->>'expected_version')::integer then raise exception 'Plan changed. Reload before saving' using errcode='40001'; end if;
      old_data:=to_jsonb(plan);
      update public.draft_commissioner_plans set topic=btrim(p_payload->>'topic'),notes=coalesce(p_payload->>'notes',''),ai_context=v_config->>'ai_context',
        num_rounds=(v_config->>'num_rounds')::integer,is_live=(v_config->>'is_live')::boolean,live_settings=v_config->'live_settings',
        scheduled_at=nullif(p_payload->>'scheduled_at','')::timestamptz,due_at=nullif(p_payload->>'due_at','')::timestamptz,draft_id=did,preset_id=pid,
        status=coalesce(p_payload->>'status','planned'),version=version+1,updated_by=actor,updated_at=now()
        where id=rid returning to_jsonb(draft_commissioner_plans.*) into new_data;
    end if;
  elsif p_action='delete_plan' then
    select * into plan from public.draft_commissioner_plans where id=(p_payload->>'id')::uuid and season_id=s.id
      and public.dh_visible_member(created_by) and public.dh_visible_member(updated_by) for update;
    if not found or plan.version is distinct from (p_payload->>'expected_version')::integer then raise exception 'Plan changed. Reload before deleting' using errcode='40001'; end if;
    old_data:=to_jsonb(plan); delete from public.draft_commissioner_plans where id=plan.id;
  elsif p_action='add_adjustment' then
    uid:=(p_payload->>'user_id')::uuid;
    if not public.dh_visible_member(uid) or not exists(select 1 from public.club_members where user_id=uid and club_id=s.club_id)
      or not exists(select 1 from public.draft_participants p join public.draft_season_entries e on e.draft_id=p.draft_id where e.season_id=s.id and not e.is_playoff and p.user_id=uid) then raise exception 'Season participant required'; end if;
    insert into public.draft_commissioner_adjustments(club_id,season_id,user_id,delta,reason,created_by)
      values(s.club_id,s.id,uid,(p_payload->>'delta')::integer,btrim(p_reason),actor) returning to_jsonb(draft_commissioner_adjustments.*) into new_data;
    perform public.recalculate_draft_season_standings(s.id);
  elsif p_action='revoke_adjustment' then
    select * into adj from public.draft_commissioner_adjustments where id=(p_payload->>'id')::uuid and season_id=s.id
      and public.dh_visible_member(user_id) and public.dh_visible_member(created_by) for update;
    if not found or adj.revoked_at is not null then raise exception 'Active adjustment unavailable'; end if;
    old_data:=to_jsonb(adj);
    update public.draft_commissioner_adjustments set revoked_at=now(),revoked_by=actor,revocation_reason=btrim(p_reason)
      where id=adj.id returning to_jsonb(draft_commissioner_adjustments.*) into new_data;
    perform public.recalculate_draft_season_standings(s.id);
  elsif p_action='add_draft' then
    if s.status<>'regular_season' then raise exception 'Regular season is locked'; end if;
    did:=(p_payload->>'draft_id')::uuid;
    select * into d from public.drafts where id=did and club_id=s.club_id and not is_live and public.dh_visible_member(created_by) for update;
    if not found or exists(select 1 from public.draft_season_entries where draft_id=did) then raise exception 'Unassigned regular draft required'; end if;
    select count(*),coalesce(max(week_number),0)+1 into n,next_number from public.draft_season_entries where season_id=s.id and not is_playoff;
    if n>=coalesce(s.regular_season_drafts,s.regular_season_weeks,12) then raise exception 'Season draft slots are full'; end if;
    insert into public.draft_season_entries(club_id,season_id,draft_id,week_number,is_playoff) values(s.club_id,s.id,did,next_number,false)
      returning to_jsonb(draft_season_entries.*) into new_data;
    perform public.recalculate_draft_season_standings(s.id);
  elsif p_action='remove_draft' then
    if s.status<>'regular_season' then raise exception 'Regular season is locked'; end if;
    select to_jsonb(e) into old_data from public.draft_season_entries e where e.season_id=s.id and e.draft_id=(p_payload->>'draft_id')::uuid and not e.is_playoff;
    if old_data is null then raise exception 'Season draft unavailable'; end if;
    delete from public.draft_season_entries where id=(old_data->>'id')::uuid;
    with ranked as(select id,row_number() over(order by week_number,id)::integer n from public.draft_season_entries where season_id=s.id and not is_playoff)
      update public.draft_season_entries e set week_number=r.n from ranked r where e.id=r.id;
    perform public.recalculate_draft_season_standings(s.id);
  elsif p_action='update_season' then
    if s.status<>'regular_season' then raise exception 'Season rules are locked'; end if;
    if exists(select 1 from jsonb_object_keys(p_payload) k where k not in('subtitle','regular_season_drafts','best_of')) then raise exception 'Unsupported season setting'; end if;
    n:=coalesce((p_payload->>'regular_season_drafts')::integer,s.regular_season_drafts,s.regular_season_weeks,12);
    if n not between 1 and 50 or coalesce((p_payload->>'best_of')::integer,s.best_of) not between 1 and n
      or n<(select count(*) from public.draft_season_entries where season_id=s.id and not is_playoff)
      or length(coalesce(p_payload->>'subtitle',s.subtitle,''))>60 then raise exception 'Invalid season settings'; end if;
    old_data:=to_jsonb(s);
    update public.draft_seasons set subtitle=case when p_payload?'subtitle' then nullif(btrim(p_payload->>'subtitle'),'') else subtitle end,
      regular_season_drafts=n,regular_season_weeks=n,best_of=coalesce((p_payload->>'best_of')::integer,best_of)
      where id=s.id returning to_jsonb(draft_seasons.*) into new_data;
    perform public.recalculate_draft_season_standings(s.id);
  elsif p_action='transfer_commissioner' then
    uid:=(p_payload->>'user_id')::uuid;
    if not public.dh_visible_member(uid) or not exists(select 1 from public.club_members where club_id=s.club_id and user_id=uid) then raise exception 'Club member required'; end if;
    old_data:=jsonb_build_object('commissioner_user_id',s.commissioner_user_id);
    update public.draft_seasons set commissioner_user_id=uid where id=s.id returning jsonb_build_object('commissioner_user_id',commissioner_user_id) into new_data;
  elsif p_action in('dismiss_dispute','reject_dispute') then
    select q.* into dispute from public.draft_pick_disputes q join public.draft_season_entries e on e.draft_id=q.draft_id
      where q.id=(p_payload->>'dispute_id')::uuid and e.season_id=s.id and q.club_id=s.club_id and public.dh_visible_member(q.user_id) for update of q;
    if not found or dispute.status<>'pending' then raise exception 'Pending season dispute unavailable'; end if;
    old_data:=to_jsonb(dispute);
    update public.draft_pick_disputes set status=case when p_action='dismiss_dispute' then 'dismissed' else 'rejected' end,
      resolved_at=now(),resolved_by=actor,commissioner_rationale=btrim(p_reason)
      where id=dispute.id returning to_jsonb(draft_pick_disputes.*) into new_data;
  elsif p_action='recalculate' then
    perform public.recalculate_draft_season_standings(s.id); new_data:=jsonb_build_object('season_id',s.id);
  elsif p_action='send_reminder' then
    if s.status='complete' then raise exception 'Archived season is read-only'; end if;
    uid:=(p_payload->>'target_user_id')::uuid; did:=nullif(p_payload->>'draft_id','')::uuid;
    mid:=nullif(p_payload->>'match_id','')::uuid; pid:=nullif(p_payload->>'plan_id','')::uuid;
    if uid is null or not public.dh_visible_member(uid) or not exists(select 1 from public.club_members where user_id=uid and club_id=s.club_id) then raise exception 'Recipient unavailable'; end if;
    if p_payload->>'kind'='topic' then
      select * into match from public.draft_playoff_matches where id=mid and season_id=s.id and club_id=s.club_id and status='awaiting_topic' and topic_picker_user_id=uid;
      if not found then raise exception 'Topic is no longer waiting for this player'; end if;
      target_topic:='Choose your playoff topic'; target_url:='/drafts?tab=season'; did:=null;pid:=null;
    elsif p_payload->>'kind'='pick' then
      select x.* into d from public.drafts x join public.draft_season_entries e on e.draft_id=x.id
        where x.id=did and x.club_id=s.club_id and e.season_id=s.id and x.status='in_progress';
      if not found then raise exception 'Draft is not waiting for a pick'; end if;
      select count(*) into n from public.draft_participants where draft_id=did;
      select (select count(*) from public.draft_picks where draft_id=did)+case when d.is_live then (select count(*) from public.draft_skips where draft_id=did) else 0 end into next_number;
      if n<1 or next_number>=n*d.num_rounds then raise exception 'Draft is not waiting for a pick'; end if;
      select user_id into actual_picker from public.draft_participants where draft_id=did order by pick_order
        offset(case when (next_number/n)%2=0 then next_number%n else n-1-next_number%n end) limit 1;
      if actual_picker is distinct from uid then raise exception 'That player is no longer on the clock'; end if;
      target_topic:='Your draft pick is waiting'; target_url:=case when d.is_live then '/drafts/live/' else '/drafts/' end||did::text;mid:=null;pid:=null;
    elsif p_payload->>'kind'='plan' then
      select * into plan from public.draft_commissioner_plans where id=pid and season_id=s.id and club_id=s.club_id and status in('planned','ready')
        and public.dh_visible_member(created_by) and public.dh_visible_member(updated_by);
      if not found or not exists(select 1 from public.draft_participants p join public.draft_season_entries e on e.draft_id=p.draft_id where e.season_id=s.id and p.user_id=uid) then raise exception 'Scheduled season recipient unavailable'; end if;
      target_topic:='Upcoming draft: '||left(plan.topic,160);target_url:='/drafts?tab=season';did:=null;mid:=null;
    else raise exception 'Unsupported reminder'; end if;
    if exists(select 1 from public.draft_commissioner_reminders r where r.season_id=s.id and r.target_user_id=uid
      and r.kind=p_payload->>'kind' and r.draft_id is not distinct from did and r.match_id is not distinct from mid and r.plan_id is not distinct from pid
      and r.created_at>now()-interval '1 hour') then raise exception 'A reminder was already sent recently. Try again later'; end if;
    insert into public.notifications(user_id,club_id,type,title,body,url,actor_user_id)
      values(uid,s.club_id,'draft',target_topic,btrim(p_reason),target_url,actor) returning id into n_id;
    insert into public.draft_commissioner_reminders(club_id,season_id,target_user_id,draft_id,match_id,plan_id,kind,notification_id,created_by)
      values(s.club_id,s.id,uid,did,mid,pid,p_payload->>'kind',n_id,actor) returning to_jsonb(draft_commissioner_reminders.*) into new_data;
  else raise exception 'Unsupported commissioner action'; end if;

  insert into public.draft_commissioner_audit(club_id,season_id,actor_user_id,action,reason,before_data,after_data,request_id,request_payload)
    values(s.club_id,s.id,actor,p_action,btrim(p_reason),old_data,new_data,p_request_id,p_payload) returning id into aid;
  return jsonb_build_object('ok',true,'record',new_data,'audit_id',aid);
end $$;
revoke all on function public.draft_commissioner_mutate(uuid,text,jsonb,text,uuid) from public,anon;
grant execute on function public.draft_commissioner_mutate(uuid,text,jsonb,text,uuid) to authenticated;

-- Regrade applies results + dispute status in the existing atomic grading RPC.
-- This trigger keeps the season ledger projection/audit in that transaction.
create or replace function public.draft_commissioner_regrade_audit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare e record;
begin
  if old.status='pending' and new.status='resolved' then
    for e in select season_id from public.draft_season_entries where draft_id=new.draft_id loop
      if not public.draft_commissioner_actor_can_manage(e.season_id,new.resolved_by) then
        raise exception 'Commissioner access changed. Reload before resolving' using errcode='42501';
      end if;
      perform public.recalculate_draft_season_standings(e.season_id);
      insert into public.draft_commissioner_audit(club_id,season_id,actor_user_id,action,reason,before_data,after_data,request_id)
        values(new.club_id,e.season_id,new.resolved_by,'resolve_dispute',coalesce(new.resolution,'Pick re-evaluated'),to_jsonb(old),to_jsonb(new),gen_random_uuid());
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.draft_commissioner_regrade_audit() from public,anon,authenticated;
create trigger draft_commissioner_regrade_audit after update on public.draft_pick_disputes for each row execute function public.draft_commissioner_regrade_audit();

-- Explicit user deletion is atomic. The same draft-row lock is acquired by
-- add_draft above, so an assignment cannot slip between eligibility and cleanup.
create policy commissioner_assigned_draft_delete_guard on public.drafts as restrictive for delete to authenticated
  using(not exists(select 1 from public.draft_season_entries e where e.draft_id=drafts.id));
create or replace function public.draft_commissioner_guard_draft_delete()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.draft_season_entries e where e.draft_id=old.id) then
    raise exception 'Remove this draft from its season in Commissioner Points before deleting it' using errcode='42501';
  end if;
  return old;
end $$;
revoke all on function public.draft_commissioner_guard_draft_delete() from public,anon,authenticated;
create trigger draft_commissioner_guard_draft_delete before delete on public.drafts
  for each row execute function public.draft_commissioner_guard_draft_delete();

create or replace function public.delete_unassigned_draft(p_draft_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.drafts%rowtype; actor uuid:=auth.uid(); pick_ids uuid[]; relation record; has_reference boolean:=false;
begin
  select * into d from public.drafts where id=p_draft_id for update;
  if not found or actor is null or d.club_id is distinct from public.current_user_club_id()
    or not public.dh_visible_club(d.club_id) or not public.dh_visible_member(actor) or not public.dh_visible_member(d.created_by)
    or not exists(select 1 from public.club_members m where m.club_id=d.club_id and m.user_id=actor)
    or not(d.created_by=actor or public.is_app_admin(actor)) then
    raise exception 'Draft manager access required' using errcode='42501';
  end if;
  if exists(select 1 from public.draft_season_entries e where e.draft_id=d.id) then
    raise exception 'Remove this draft from its season in Commissioner Points before deleting it' using errcode='42501';
  end if;
  if exists(select 1 from public.draft_commissioner_plans p where p.draft_id=d.id) then
    raise exception 'This draft is linked to a commissioner plan. Ask its commissioner to unlink it in Planner before deleting.';
  end if;
  select coalesce(array_agg(p.id),array[]::uuid[]) into pick_ids from public.draft_picks p where p.draft_id=d.id;
  delete from public.item_enrichments where item_type='draft_pick' and item_id=any(pick_ids);
  -- Legacy dispute rows do not have a cascading draft FK.
  delete from public.draft_pick_disputes where draft_id=d.id;
  delete from public.draft_results where draft_id=d.id;
  delete from public.draft_picks where draft_id=d.id;
  delete from public.draft_participants where draft_id=d.id;
  delete from public.drafts where id=d.id;

  -- A competition may be referenced by another feature. Keep that container
  -- whenever any FK still references it; never cascade unrelated club content.
  perform 1 from public.competitions c where c.id=d.competition_id and c.club_id=d.club_id
    and c.created_by=d.created_by and c.type='draft' for update;
  if found then
    for relation in select ns.nspname schema_name,cl.relname table_name,a.attname column_name
      from pg_constraint f join pg_class cl on cl.oid=f.conrelid join pg_namespace ns on ns.oid=cl.relnamespace
      join pg_attribute a on a.attrelid=f.conrelid and a.attnum=f.conkey[1]
      where f.confrelid='public.competitions'::regclass and f.contype='f' and cardinality(f.conkey)=1 loop
      execute format('select exists(select 1 from %I.%I where %I=$1)',relation.schema_name,relation.table_name,relation.column_name)
        into has_reference using d.competition_id;
      exit when has_reference;
    end loop;
    if not has_reference then delete from public.competitions where id=d.competition_id; end if;
  end if;
end $$;
revoke all on function public.delete_unassigned_draft(uuid) from public,anon;
grant execute on function public.delete_unassigned_draft(uuid) to authenticated;
commit;
