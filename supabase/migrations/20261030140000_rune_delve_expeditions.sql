-- Rune Delve Expeditions. Campaign saves and rewards remain intact.
-- Client combat is not replayed in PostgreSQL. Server-issued, scoped tickets,
-- progress gates, bounded telemetry and locked receipts limit rewards and make
-- retries exactly-once; no client-supplied shard amount is accepted.
create table if not exists public.rune_delve_expedition_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  highest_ascension integer not null default 0 check (highest_ascension between 0 and 7),
  best_score integer not null default 0,
  total_runs integer not null default 0,
  total_clears integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, club_id)
);
create table if not exists public.rune_delve_expedition_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  seed integer not null,
  hero_class text not null check (hero_class in ('warrior','mage','rogue','cleric')),
  ascension integer not null check (ascension between 0 and 7),
  status text not null default 'active' check (status in ('active','banked','abandoned')),
  rooms integer not null default 0 check (rooms between 0 and 6),
  score integer not null default 0,
  turns integer not null default 0,
  cleared boolean not null default false,
  reward integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists rune_expedition_active_idx on public.rune_delve_expedition_runs(user_id, club_id, started_at desc) where status='active';
alter table public.rune_delve_expedition_progress enable row level security;
alter table public.rune_delve_expedition_runs enable row level security;
drop policy if exists rune_expedition_progress_read on public.rune_delve_expedition_progress;
create policy rune_expedition_progress_read on public.rune_delve_expedition_progress for select to authenticated using (
  user_id=auth.uid() and exists(select 1 from public.club_members m where m.club_id=rune_delve_expedition_progress.club_id and m.user_id=auth.uid())
);
drop policy if exists rune_expedition_runs_read on public.rune_delve_expedition_runs;
create policy rune_expedition_runs_read on public.rune_delve_expedition_runs for select to authenticated using (
  user_id=auth.uid() and exists(select 1 from public.club_members m where m.club_id=rune_delve_expedition_runs.club_id and m.user_id=auth.uid())
);
revoke all on public.rune_delve_expedition_progress, public.rune_delve_expedition_runs from anon, authenticated;
grant select on public.rune_delve_expedition_progress, public.rune_delve_expedition_runs to authenticated;

create or replace function public.rune_delve_expedition_profile(p_club_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_progress public.rune_delve_expedition_progress; v_ticket jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from public.club_members where user_id=v_uid and club_id=p_club_id) then raise exception 'club_membership_required'; end if;
  select * into v_progress from public.rune_delve_expedition_progress where user_id=v_uid and club_id=p_club_id;
  select jsonb_build_object('id',id,'seed',seed,'hero_class',hero_class,'ascension',ascension,'started_at',started_at) into v_ticket
    from public.rune_delve_expedition_runs where user_id=v_uid and club_id=p_club_id and status='active' order by started_at desc limit 1;
  return jsonb_build_object('highest_ascension',coalesce(v_progress.highest_ascension,0),'best_score',coalesce(v_progress.best_score,0),
    'total_runs',coalesce(v_progress.total_runs,0),'total_clears',coalesce(v_progress.total_clears,0),'active_run',v_ticket);
end; $$;

create or replace function public.rune_delve_expedition_begin(p_id uuid,p_club_id uuid,p_hero_class text,p_ascension integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_run public.rune_delve_expedition_runs; v_gate integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_id is null or p_hero_class is null or p_hero_class not in ('warrior','mage','rogue','cleric') or p_ascension is null or p_ascension not between 0 and 7 then raise exception 'invalid_expedition'; end if;
  if not exists(select 1 from public.club_members where user_id=v_uid and club_id=p_club_id) then raise exception 'club_membership_required'; end if;
  if not exists(select 1 from public.club_installed_assets i join public.platform_assets a on a.id=i.asset_id where i.club_id=p_club_id and i.enabled and a.slug='rune-delve') then raise exception 'rune_delve_not_installed'; end if;
  if not exists(select 1 from public.rune_delve_heroes where user_id=v_uid) then raise exception 'create_your_hero_first'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_club_id::text,491));
  select * into v_run from public.rune_delve_expedition_runs where id=p_id;
  if found then
    if v_run.user_id<>v_uid or v_run.club_id<>p_club_id or v_run.status<>'active' or v_run.hero_class<>p_hero_class or v_run.ascension<>p_ascension then raise exception 'expedition_ticket_mismatch'; end if;
    return jsonb_build_object('id',v_run.id,'seed',v_run.seed,'hero_class',v_run.hero_class,'ascension',v_run.ascension,'started_at',v_run.started_at);
  end if;
  select highest_ascension into v_gate from public.rune_delve_expedition_progress where user_id=v_uid and club_id=p_club_id;
  if p_ascension>coalesce(v_gate,0) then raise exception 'clear_the_previous_ascension_first'; end if;
  update public.rune_delve_expedition_runs set status='abandoned',finished_at=now() where user_id=v_uid and club_id=p_club_id and status='active';
  insert into public.rune_delve_expedition_runs(id,user_id,club_id,seed,hero_class,ascension)
    values(p_id,v_uid,p_club_id,floor(random()*2000000000)::integer,p_hero_class,p_ascension) returning * into v_run;
  return jsonb_build_object('id',v_run.id,'seed',v_run.seed,'hero_class',v_run.hero_class,'ascension',v_run.ascension,'started_at',v_run.started_at);
end; $$;

create or replace function public.rune_delve_expedition_finish(p_id uuid,p_rooms integer,p_score integer,p_turns integer,p_cleared boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_run public.rune_delve_expedition_runs; v_progress public.rune_delve_expedition_progress; v_reward integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  -- Shared account lock precedes wallet writes and nested quest updates.
  perform pg_advisory_xact_lock(hashtextextended('rune:'||v_uid::text,0));
  select * into v_run from public.rune_delve_expedition_runs where id=p_id for update;
  if not found or v_run.user_id<>v_uid then raise exception 'expedition_not_found'; end if;
  if not exists(select 1 from public.club_members where user_id=v_uid and club_id=v_run.club_id) then raise exception 'club_membership_required'; end if;
  if v_run.status='abandoned' then raise exception 'expedition_was_replaced'; end if;
  if v_run.status='banked' then
    select * into v_progress from public.rune_delve_expedition_progress where user_id=v_uid and club_id=v_run.club_id;
    return jsonb_build_object('reward',v_run.reward,'rooms',v_run.rooms,'cleared',v_run.cleared,'highest_ascension',coalesce(v_progress.highest_ascension,0),'best_score',coalesce(v_progress.best_score,0));
  end if;
  if p_rooms is null or p_rooms not between 0 and 6 or p_score is null or p_score not between 0 and 250000 or p_turns is null or p_turns not between 0 and 180 or p_turns<p_rooms or p_cleared is null or p_cleared<>(p_rooms=6) then raise exception 'invalid_expedition_result'; end if;
  if p_rooms>0 and p_score=0 then raise exception 'invalid_expedition_score'; end if;
  v_reward:=p_rooms*(12+v_run.ascension*2)+case when p_cleared then 40+v_run.ascension*6 else 0 end;
  insert into public.rune_delve_expedition_progress(user_id,club_id,highest_ascension,best_score,total_runs,total_clears)
    values(v_uid,v_run.club_id,case when p_cleared then least(7,v_run.ascension+1) else 0 end,p_score,1,case when p_cleared then 1 else 0 end)
    on conflict(user_id,club_id) do update set highest_ascension=greatest(rune_delve_expedition_progress.highest_ascension,excluded.highest_ascension),
      best_score=greatest(rune_delve_expedition_progress.best_score,excluded.best_score),total_runs=rune_delve_expedition_progress.total_runs+1,
      total_clears=rune_delve_expedition_progress.total_clears+excluded.total_clears,updated_at=now() returning * into v_progress;
  if v_reward>0 then
    insert into public.rune_delve_wallet(user_id,shards,lifetime_shards_earned,slots_unlocked) values(v_uid,v_reward,v_reward,2)
      on conflict(user_id) do update set shards=rune_delve_wallet.shards+excluded.shards,lifetime_shards_earned=rune_delve_wallet.lifetime_shards_earned+excluded.lifetime_shards_earned;
  end if;
  update public.rune_delve_expedition_runs set status='banked',rooms=p_rooms,score=p_score,turns=p_turns,cleared=p_cleared,reward=v_reward,finished_at=now() where id=p_id;
  -- The optional guard keeps this base migration independently runnable;
  -- the complete deployment installs the settlement/quest protocol next.
  -- Banked receipt retries return above, so these source events occur once.
  if to_regprocedure('public.rune_delve_report_quest(jsonb)') is not null then
    if v_reward>0 then perform public.rune_delve_report_quest(jsonb_build_object('type','shards_earned','amount',v_reward,'heroClass',v_run.hero_class)); end if;
    if p_score>0 then perform public.rune_delve_report_quest(jsonb_build_object('type','total_score','amount',p_score,'heroClass',v_run.hero_class)); end if;
    if p_cleared then
      perform public.rune_delve_report_quest(jsonb_build_object('type','class_run_complete','amount',1,'heroClass',v_run.hero_class));
      perform public.rune_delve_report_quest(jsonb_build_object('type','bosses_defeated','amount',1,'heroClass',v_run.hero_class,'meta',jsonb_build_object('isBoss',true)));
    end if;
  end if;
  return jsonb_build_object('reward',v_reward,'rooms',p_rooms,'cleared',p_cleared,'highest_ascension',v_progress.highest_ascension,'best_score',v_progress.best_score);
end; $$;
revoke all on function public.rune_delve_expedition_profile(uuid),public.rune_delve_expedition_begin(uuid,uuid,text,integer),public.rune_delve_expedition_finish(uuid,integer,integer,integer,boolean) from public,anon;
grant execute on function public.rune_delve_expedition_profile(uuid),public.rune_delve_expedition_begin(uuid,uuid,text,integer),public.rune_delve_expedition_finish(uuid,integer,integer,integer,boolean) to authenticated;
