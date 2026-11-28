-- DH Pocket arcade. Canonical simulation stays in the shared TypeScript rules.
-- PostgreSQL owns admission, server seeds, verification leases, settlement and ranking.
begin;

insert into public.platform_assets (
  name, slug, category, short_description, full_description, icon_name, placement_area, sort_order
) values (
  'Riftwatch','riftwatch','games','Hold the line. Seal the sky.',
  'Pilot an Edenite ward-skiff against descending rifts. Play Practice or compete for your club’s verified arcade high score.',
  'Gamepad2','games',48
) on conflict (slug) do nothing;

create table public.arcade_rulesets (
  game_key text not null check (game_key ~ '^[a-z0-9_-]{1,80}$'),
  ruleset_version text not null check (length(ruleset_version) between 1 and 80),
  asset_slug text not null references public.platform_assets(slug),
  is_current boolean not null default false,
  tick_rate integer not null check (tick_rate between 1 and 240),
  max_ticks integer not null check (max_ticks between 1 and 2160000),
  primary key (game_key, ruleset_version)
);
create unique index arcade_rulesets_current on public.arcade_rulesets(game_key) where is_current;
insert into public.arcade_rulesets values ('riftwatch','riftwatch-1.0.0','riftwatch',true,60,108000);

create table public.arcade_run_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  game_key text not null,
  ruleset_version text not null,
  request_id uuid not null,
  seed text not null check (length(seed) between 1 and 128),
  client_build text check (length(client_build) <= 128),
  status text not null default 'started' check (status in ('started','submitted','verified','rejected','expired')),
  replay_encoding_version integer,
  replay_hash text check (replay_hash ~ '^[0-9a-f]{64}$'),
  lease_until timestamptz,
  rejection_code text check (rejection_code ~ '^[a-z][a-z0-9_]{0,47}$'),
  receipt jsonb,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null check(expires_at > started_at),
  submitted_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,request_id),
  foreign key(game_key,ruleset_version) references public.arcade_rulesets(game_key,ruleset_version)
);
create index arcade_runs_owner_started on public.arcade_run_sessions(user_id,started_at desc);
create index arcade_runs_owner_status on public.arcade_run_sessions(user_id,status,expires_at);
create index arcade_runs_expiry on public.arcade_run_sessions(status,expires_at) where status in ('started','submitted');
create trigger arcade_runs_touch before update on public.arcade_run_sessions
  for each row execute function public.set_updated_at();

create table public.arcade_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.arcade_run_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  game_key text not null,
  ruleset_version text not null,
  score bigint not null check(score between 0 and 9007199254740991),
  wave integer not null check(wave>=0),
  kills integer not null check(kills>=0),
  simulation_ticks integer not null check(simulation_ticks>0),
  summary jsonb not null check(jsonb_typeof(summary)='object'),
  achieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key(game_key,ruleset_version) references public.arcade_rulesets(game_key,ruleset_version)
);
create index arcade_scores_board on public.arcade_scores(club_id,game_key,ruleset_version,score desc,wave desc,achieved_at,id);
create index arcade_scores_member on public.arcade_scores(club_id,game_key,user_id,achieved_at desc);
create index arcade_scores_period on public.arcade_scores(club_id,game_key,ruleset_version,achieved_at desc);

-- Explicit membership works for a selected club even if multi-club membership is enabled later.
-- The shared member helper checks active membership and existing private-session boundaries.
create function public.arcade_member_eligible(p_user uuid,p_club uuid,p_game text,p_rules text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select p_user is not null and public.dh_public_member(p_user)
    and public.dh_visible_club(p_club)
    and exists (
      select 1 from public.clubs c
      join public.club_installed_assets i on i.club_id=c.id
      join public.platform_assets a on a.id=i.asset_id
      join public.arcade_rulesets r on r.asset_slug=a.slug
      where c.id=p_club and c.status='active'
        and (public.showdown_member_valid(p_club,p_user) or c.owner_admin_id=p_user)
        and a.is_active and i.enabled
        and (i.visible_to_members or public.is_club_admin(p_user,p_club) or c.owner_admin_id=p_user)
        and r.game_key=p_game and r.ruleset_version=p_rules
    )
$$;
-- Hold the same active membership and installation through each ranked write.
-- A concurrent removal or disable either precedes the check or waits for commit.
create function public.arcade_lock_access(p_user uuid,p_club uuid,p_game text,p_rules text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.arcade_member_eligible(p_user,p_club,p_game,p_rules) then
    raise exception 'arcade_unavailable' using errcode='42501';
  end if;
  perform 1 from public.clubs where id=p_club for share;
  perform 1 from public.club_members where club_id=p_club and user_id=p_user for share;
  perform 1 from public.arcade_rulesets r
    join public.platform_assets a on a.slug=r.asset_slug
    join public.club_installed_assets i on i.asset_id=a.id and i.club_id=p_club
    where r.game_key=p_game and r.ruleset_version=p_rules for share of r,a,i;
  if not public.arcade_member_eligible(p_user,p_club,p_game,p_rules) then
    raise exception 'arcade_unavailable' using errcode='42501';
  end if;
end $$;
-- This wrapper never reports another member's standing/access to an unauthorized viewer.
create function public.arcade_row_visible(p_club uuid,p_game text,p_rules text,p_member uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.arcade_member_eligible(auth.uid(),p_club,p_game,p_rules)
     and public.arcade_member_eligible(p_member,p_club,p_game,p_rules)
$$;
alter table public.arcade_rulesets enable row level security;
alter table public.arcade_run_sessions enable row level security;
alter table public.arcade_scores enable row level security;
create policy arcade_runs_own on public.arcade_run_sessions for select to authenticated
  using(user_id=(select auth.uid()) and public.arcade_row_visible(club_id,game_key,ruleset_version,user_id));
create policy arcade_scores_in_club on public.arcade_scores for select to authenticated
  using(public.arcade_row_visible(club_id,game_key,ruleset_version,user_id));

-- Supabase installations can assign broad default privileges to API roles. Limit
-- raw reads to public score metrics or the caller's own non-secret run fields.
revoke all on public.arcade_rulesets,public.arcade_run_sessions,public.arcade_scores from public,anon,authenticated,service_role;
grant select(id,club_id,game_key,ruleset_version,seed,status,started_at,expires_at,submitted_at,verified_at,rejection_code)
  on public.arcade_run_sessions to authenticated;
grant select(id,club_id,game_key,ruleset_version,score,wave,kills,simulation_ticks,achieved_at)
  on public.arcade_scores to authenticated;

create function public.arcade_period_start(p_period text,p_at timestamptz)
returns timestamptz language plpgsql stable set search_path=public,pg_temp as $$
begin
  case p_period
    when 'all_time' then return '-infinity'::timestamptz;
    when 'today' then return date_trunc('day',p_at at time zone 'America/New_York') at time zone 'America/New_York';
    when 'week' then return date_trunc('week',p_at at time zone 'America/New_York') at time zone 'America/New_York';
    else raise exception 'invalid_period' using errcode='22023';
  end case;
end $$;

-- DISTINCT ON selects a single receipt for each still-eligible competitor. The
-- exact same total ordering determines that person's position across the club.
create function public.arcade_board_data(p_user uuid,p_club uuid,p_game text,p_rules text,p_period text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with best as (
    select distinct on (s.user_id) s.user_id,s.score,s.wave,s.achieved_at,s.id
    from public.arcade_scores s
    where s.club_id=p_club and s.game_key=p_game and s.ruleset_version=p_rules
      and s.achieved_at>=public.arcade_period_start(p_period,statement_timestamp())
      and s.achieved_at<=statement_timestamp()
    order by s.user_id,s.score desc,s.wave desc,s.achieved_at,s.id
  ), ranked as materialized (
    select b.*,row_number() over(order by b.score desc,b.wave desc,b.achieved_at,b.id) as pos
    from best b where public.arcade_member_eligible(b.user_id,p_club,p_game,p_rules)
  ), mine as (select pos from ranked where user_id=p_user),
  visible as (
    select r.pos,r.user_id=p_user as is_me,jsonb_build_object(
      'rank',r.pos,'isMe',r.user_id=p_user,'score',r.score,'wave',r.wave,'achievedAt',r.achieved_at,
      'displayName',case when nullif(trim(p.display_name),'') is null or p.display_name ~ '@'
        or position(r.user_id::text in lower(p.display_name))>0 then 'Club member' else left(trim(p.display_name),80) end,
      'avatarUrl',case when p.avatar_url ~ '^https://' and p.avatar_url !~ '@'
        and position(r.user_id::text in lower(p.avatar_url))=0 then p.avatar_url else null end
    ) as entry
    from ranked r left join public.profiles p on p.id=r.user_id
    where r.pos<=25 or abs(r.pos-(select pos from mine))<=2
  )
  select jsonb_build_object('period',p_period,'totalMembers',(select count(*) from ranked),
    'entries',coalesce((select jsonb_agg(entry order by pos) from visible),'[]'::jsonb),
    'personalBest',(select entry from visible where is_me))
$$;
create function public.arcade_leaderboard(p_club_id uuid,p_game_key text,p_ruleset_version text,p_period text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.arcade_member_eligible(auth.uid(),p_club_id,p_game_key,p_ruleset_version) then
    raise exception 'arcade_unavailable' using errcode='42501';
  end if;
  if not exists(select 1 from public.arcade_rulesets where game_key=p_game_key and ruleset_version=p_ruleset_version and is_current)
    or p_period is null or p_period not in ('all_time','week','today') then
    raise exception 'invalid_board' using errcode='22023';
  end if;
  return public.arcade_board_data(auth.uid(),p_club_id,p_game_key,p_ruleset_version,p_period);
end $$;

-- Keep ejection/retries cheap: only a verified receipt needs a board snapshot.
-- Fetch it on demand so a previously valid roster never leaks removed members.
create function public.arcade_envelope(s public.arcade_run_sessions)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('runId',s.id,'clubId',s.club_id,'gameKey',s.game_key,
    'rulesetVersion',s.ruleset_version,'seed',s.seed,'startedAt',s.started_at,'expiresAt',s.expires_at,
    'status',s.status,'rejectionCode',s.rejection_code,
    'result',case when s.status='verified' then s.receipt || jsonb_build_object(
      'leaderboard',public.arcade_board_data(s.user_id,s.club_id,s.game_key,s.ruleset_version,'all_time')) end)
$$;

create function public.arcade_start_run(
  p_club_id uuid,p_game_key text,p_ruleset_version text,p_client_build text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor uuid:=auth.uid();
  run public.arcade_run_sessions;
  started timestamptz;
begin
  perform public.arcade_lock_access(actor,p_club_id,p_game_key,p_ruleset_version);
  if p_request_id is null or length(p_client_build)>128 or not exists(
    select 1 from public.arcade_rulesets where game_key=p_game_key and ruleset_version=p_ruleset_version and is_current
  ) then raise exception 'invalid_start' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('arcade:start:'||actor::text,0));
  started:=clock_timestamp();
  update public.arcade_run_sessions set status='expired',lease_until=null
    where user_id=actor and status in ('started','submitted') and expires_at<=started;
  select * into run from public.arcade_run_sessions where user_id=actor and request_id=p_request_id;
  if found then
    if run.club_id<>p_club_id or run.game_key<>p_game_key or run.ruleset_version<>p_ruleset_version then
      raise exception 'different_request' using errcode='23505';
    end if;
    return public.arcade_envelope(run);
  end if;
  if (select count(*) from public.arcade_run_sessions
      where user_id=actor and started_at>=started-interval '10 minutes')>=12 then
    raise exception 'rate_limited' using errcode='P0001';
  end if;
  insert into public.arcade_run_sessions(user_id,club_id,game_key,ruleset_version,request_id,
    seed,client_build,started_at,expires_at)
  values(actor,p_club_id,p_game_key,p_ruleset_version,p_request_id,
    (('x'||left(gen_random_uuid()::text,8))::bit(32)::bigint)::text,
    p_client_build,started,started+interval '2 hours') returning * into run;
  return public.arcade_envelope(run);
end $$;

create function public.arcade_run_status(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare run public.arcade_run_sessions;
begin
  select * into run from public.arcade_run_sessions where id=p_run_id and user_id=auth.uid();
  if not found or not public.arcade_member_eligible(auth.uid(),run.club_id,run.game_key,run.ruleset_version) then
    raise exception 'arcade_unavailable' using errcode='42501';
  end if;
  if run.status in ('started','submitted') and run.expires_at<=clock_timestamp() then
    update public.arcade_run_sessions set status='expired',lease_until=null
      where id=run.id and status in ('started','submitted') returning * into run;
    if not found then select * into run from public.arcade_run_sessions where id=p_run_id; end if;
  end if;
  return public.arcade_envelope(run);
end $$;

-- Only the Edge verifier can claim. Bind the canonical replay hash on first
-- submission, and allow a crashed verifier to recover that exact payload.
create function public.arcade_claim_run(
  p_user_id uuid,p_club_id uuid,p_run_id uuid,p_game_key text,p_ruleset_version text,
  p_replay_hash text,p_encoding_version integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare run public.arcade_run_sessions;
begin
  select * into run from public.arcade_run_sessions
    where id=p_run_id and user_id=p_user_id and club_id=p_club_id for update;
  if not found then raise exception 'arcade_unavailable' using errcode='42501'; end if;
  perform public.arcade_lock_access(p_user_id,p_club_id,run.game_key,run.ruleset_version);
  if run.game_key is distinct from p_game_key or run.ruleset_version is distinct from p_ruleset_version
    or p_encoding_version is distinct from 1 or p_replay_hash is null or p_replay_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_submission' using errcode='22023';
  end if;
  if run.replay_hash is not null and run.replay_hash<>p_replay_hash then
    raise exception 'different_submission' using errcode='23505';
  end if;
  if run.status in ('started','submitted') and run.expires_at<=clock_timestamp() then
    update public.arcade_run_sessions set status='expired',lease_until=null where id=run.id returning * into run;
  end if;
  if run.status in ('verified','rejected','expired') or
     (run.status='submitted' and run.lease_until>clock_timestamp()) then
    return public.arcade_envelope(run)||jsonb_build_object('verifyNow',false);
  end if;
  update public.arcade_run_sessions set status='submitted',replay_hash=p_replay_hash,
    replay_encoding_version=p_encoding_version,submitted_at=coalesce(submitted_at,clock_timestamp()),
    lease_until=clock_timestamp()+interval '25 seconds' where id=run.id returning * into run;
  return public.arcade_envelope(run)||jsonb_build_object('verifyNow',true);
end $$;

create function public.arcade_finish_run(
  p_user_id uuid,p_club_id uuid,p_run_id uuid,p_replay_hash text,p_summary jsonb,p_rejection_code text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  run public.arcade_run_sessions;
  rules public.arcade_rulesets;
  previous_best jsonb;
  current_best jsonb;
  board jsonb;
  saved_receipt jsonb;
  points bigint;
  wave_no integer;
  enemies integer;
  ticks integer;
  earned timestamptz;
begin
  select * into run from public.arcade_run_sessions where id=p_run_id and user_id=p_user_id and club_id=p_club_id for update;
  if not found then raise exception 'arcade_unavailable' using errcode='42501'; end if;
  perform public.arcade_lock_access(p_user_id,p_club_id,run.game_key,run.ruleset_version);
  if run.replay_hash is null or run.replay_hash is distinct from p_replay_hash then
    raise exception 'different_submission' using errcode='23505';
  end if;
  if run.status in ('verified','rejected','expired') then return public.arcade_envelope(run); end if;
  if run.status<>'submitted' then raise exception 'invalid_submission' using errcode='22023'; end if;
  if run.expires_at<=clock_timestamp() then
    update public.arcade_run_sessions set status='expired',lease_until=null where id=run.id returning * into run;
    return public.arcade_envelope(run);
  end if;
  select * into strict rules from public.arcade_rulesets where game_key=run.game_key and ruleset_version=run.ruleset_version;
  if p_rejection_code is null then
    if jsonb_typeof(p_summary) is distinct from 'object'
      or coalesce(p_summary->>'score','') !~ '^[0-9]{1,16}$'
      or coalesce(p_summary->>'wave','') !~ '^[0-9]{1,7}$'
      or coalesce(p_summary->>'kills','') !~ '^[0-9]{1,7}$'
      or coalesce(p_summary->>'simulationTicks','') !~ '^[0-9]{1,7}$' then
      raise exception 'invalid_summary' using errcode='22023';
    end if;
    points:=(p_summary->>'score')::bigint; wave_no:=(p_summary->>'wave')::int;
    enemies:=(p_summary->>'kills')::int; ticks:=(p_summary->>'simulationTicks')::int;
    if ticks not between 1 and rules.max_ticks or points>9007199254740991 or
       ticks>rules.tick_rate*(extract(epoch from run.submitted_at-run.started_at)+2) then
      p_rejection_code:='invalid_duration';
    end if;
  end if;
  if p_rejection_code is not null then
    if p_rejection_code !~ '^[a-z][a-z0-9_]{0,47}$' then raise exception 'invalid_reason' using errcode='22023'; end if;
    update public.arcade_run_sessions set status='rejected',rejection_code=p_rejection_code,lease_until=null
      where id=run.id returning * into run;
    return public.arcade_envelope(run);
  end if;
  -- Serialize just this board's settlements. Rank movement is measured around
  -- this insert, even when two different players finish at the same time.
  perform pg_advisory_xact_lock(hashtextextended('arcade:board:'||p_club_id||':'||run.game_key||':'||run.ruleset_version,0));
  previous_best:=public.arcade_board_data(p_user_id,p_club_id,run.game_key,run.ruleset_version,'all_time')->'personalBest';
  earned:=run.submitted_at;
  insert into public.arcade_scores(run_id,user_id,club_id,game_key,ruleset_version,
    score,wave,kills,simulation_ticks,summary,achieved_at)
  values(run.id,p_user_id,p_club_id,run.game_key,run.ruleset_version,points,wave_no,enemies,ticks,
    jsonb_build_object('score',points,'wave',wave_no,'kills',enemies,'simulationTicks',ticks),earned);
  board:=public.arcade_board_data(p_user_id,p_club_id,run.game_key,run.ruleset_version,'all_time');
  current_best:=board->'personalBest';
  saved_receipt:=jsonb_build_object('score',points,'wave',wave_no,'kills',enemies,'simulationTicks',ticks,
    'personalBest',(current_best->>'score')::bigint,
    'newPersonalBest',previous_best='null'::jsonb or points>(previous_best->>'score')::bigint,
    'rank',(current_best->>'rank')::int,'previousRank',(previous_best->>'rank')::int,
    'rankChange',(previous_best->>'rank')::int-(current_best->>'rank')::int);
  update public.arcade_run_sessions set status='verified',verified_at=clock_timestamp(),lease_until=null,
    receipt=saved_receipt where id=run.id returning * into run;
  return public.arcade_envelope(run);
end $$;

-- Positive grants are deliberately enumerated. Internal functions accept
-- explicit identities for shared trusted use; browser roles cannot call them.
revoke all on function public.arcade_member_eligible(uuid,uuid,text,text),public.arcade_lock_access(uuid,uuid,text,text),
  public.arcade_row_visible(uuid,text,text,uuid),public.arcade_period_start(text,timestamptz),
  public.arcade_board_data(uuid,uuid,text,text,text),public.arcade_envelope(public.arcade_run_sessions),
  public.arcade_start_run(uuid,text,text,text,uuid),public.arcade_run_status(uuid),
  public.arcade_leaderboard(uuid,text,text,text),public.arcade_claim_run(uuid,uuid,uuid,text,text,text,integer),
  public.arcade_finish_run(uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.arcade_row_visible(uuid,text,text,uuid),public.arcade_start_run(uuid,text,text,text,uuid),
  public.arcade_run_status(uuid),public.arcade_leaderboard(uuid,text,text,text) to authenticated;
grant execute on function public.arcade_claim_run(uuid,uuid,uuid,text,text,text,integer),
  public.arcade_finish_run(uuid,uuid,uuid,text,jsonb,text) to service_role;
commit;
