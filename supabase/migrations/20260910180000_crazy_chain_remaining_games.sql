-- Copy/paste this entire file into the DH Club database SQL editor.
-- Crazy Chain only: Pick'em's week lock and its picks are not changed.
begin;

create table if not exists public.nfl_chain_boards (
  club_id uuid not null references public.clubs(id) on delete cascade,
  week_id uuid not null references public.nfl_weeks(id) on delete cascade,
  season_id uuid not null references public.nfl_seasons(id) on delete cascade,
  eligible_game_ids uuid[] not null,
  lock_at timestamptz not null,
  catch_up boolean not null default false,
  checked_at timestamptz,
  warnings jsonb not null default '[]'::jsonb,
  primary key (club_id, week_id)
);
alter table public.nfl_chain_boards enable row level security;
drop policy if exists "ChainBoards: club read" on public.nfl_chain_boards;
create policy "ChainBoards: club read" on public.nfl_chain_boards for select to authenticated
using (club_id = public.current_user_club_id() or public.is_platform_owner(auth.uid()));
grant select on public.nfl_chain_boards to authenticated;
grant all on public.nfl_chain_boards to service_role;

alter table public.nfl_chain_markets
  add column if not exists availability_status text not null default 'review'
    check (availability_status in ('verified', 'review')),
  add column if not exists availability_checked_at timestamptz,
  add column if not exists availability_note text;

-- Preserve existing slates. A remaining-games board imported before this migration
-- gets its cutoff from the actual published games, never a completed excluded game.
insert into public.nfl_chain_boards (club_id, week_id, season_id, eligible_game_ids, lock_at, catch_up)
select m.club_id, m.week_id, m.season_id, array_agg(distinct m.game_id),
  min(g.kickoff_at) - make_interval(mins => coalesce(s.pick_lock_minutes, 10)),
  min(g.kickoff_at) > (select min(x.kickoff_at) from public.nfl_games x where x.week_id = m.week_id)
from public.nfl_chain_markets m join public.nfl_games g on g.id = m.game_id
join public.nfl_seasons s on s.id = m.season_id
group by m.club_id, m.week_id, m.season_id, s.pick_lock_minutes
on conflict (club_id, week_id) do nothing;

create or replace function public.nfl_chain_board_unlocked(_week_id uuid, _club_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select now() < least(b.lock_at,
    (select min(g.kickoff_at) - make_interval(mins => coalesce(s.pick_lock_minutes, 10))
     from public.nfl_games g where g.id = any(b.eligible_game_ids)))
    and not exists (select 1 from public.nfl_games g where g.id = any(b.eligible_game_ids) and g.status <> 'scheduled')
    from public.nfl_chain_boards b join public.nfl_seasons s on s.id = b.season_id
    where b.week_id = _week_id and b.club_id = _club_id), public.is_nfl_week_unlocked(_week_id), false)
$$;
revoke all on function public.nfl_chain_board_unlocked(uuid,uuid) from public, anon, authenticated;

create or replace function public.get_nfl_chain_board(_week_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'lock_at', least(b.lock_at, (select min(g.kickoff_at) - make_interval(mins => coalesce(s.pick_lock_minutes,10))
      from public.nfl_games g where g.id = any(b.eligible_game_ids))),
    'unlocked', public.nfl_chain_board_unlocked(_week_id, b.club_id),
    'catch_up', b.catch_up, 'game_ids', b.eligible_game_ids, 'checked_at', b.checked_at, 'warnings', b.warnings)
  from public.nfl_chain_boards b join public.nfl_seasons s on s.id = b.season_id
  where b.week_id = _week_id and b.club_id = public.current_user_club_id()
$$;
revoke all on function public.get_nfl_chain_board(uuid) from public, anon;
grant execute on function public.get_nfl_chain_board(uuid) to authenticated;

-- Only commissioners or the authenticated server scheduler can publish evidence.
-- Serialized with card saves. Existing target text/thresholds/results are immutable
-- during refresh; uncertain availability never turns a saved leg into a loss.
create or replace function public.publish_nfl_chain_board(
  _week_id uuid, _club_id uuid, _markets jsonb, _availability jsonb,
  _checked_at timestamptz, _warnings jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  board public.nfl_chain_boards%rowtype;
  season uuid; offset_minutes integer; eligible uuid[]; cutoff timestamptz;
  added integer := 0; reviewed integer := 0; existing integer; paused integer;
  can_publish boolean;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not coalesce((
    _club_id = public.current_user_club_id()
    and (public.is_app_admin(auth.uid()) or public.is_platform_owner(auth.uid()))
  ), false) then raise exception 'Club commissioner access required'; end if;
  if _club_id is null or _checked_at is null or _checked_at < now() - interval '10 minutes'
    or _checked_at > now() + interval '1 minute' then raise exception 'Refresh the expired preview'; end if;
  if coalesce(jsonb_typeof(_markets),'null') <> 'array' or coalesce(jsonb_typeof(_availability),'null') <> 'array'
    or coalesce(jsonb_typeof(_warnings),'null') <> 'array' then raise exception 'Invalid board payload'; end if;
  if jsonb_array_length(_markets) not between 1 and 1000 then raise exception 'Empty or oversized board payload'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chain:' || _club_id || ':' || _week_id, 0));
  select w.season_id, coalesce(s.pick_lock_minutes,10) into season, offset_minutes
    from public.nfl_weeks w join public.nfl_seasons s on s.id = w.season_id where w.id = _week_id;
  if season is null then raise exception 'Week not found'; end if;
  select array_agg(g.id order by g.kickoff_at, g.id), min(g.kickoff_at) - make_interval(mins => offset_minutes)
    into eligible, cutoff from public.nfl_games g where g.week_id = _week_id
    and g.status = 'scheduled' and now() < g.kickoff_at - make_interval(mins => offset_minutes);
  if eligible is null then raise exception 'No remaining unlocked games'; end if;
  if exists (select 1 from jsonb_array_elements(_markets) m where not exists (
    select 1 from public.nfl_games g where g.id = (m->>'game_id')::uuid
      and g.id = any(eligible) and g.season_id = season and g.week_id = _week_id
      and (m->>'club_id')::uuid = _club_id and (m->>'week_id')::uuid = _week_id
      and (m->>'season_id')::uuid = season and m->>'source_provider' = 'espn-roster'
      and coalesce(m->>'external_id','') <> ''
      and (m->>'subject_team_id' is null or (m->>'subject_team_id')::uuid in (g.home_team_id,g.away_team_id))
  )) then raise exception 'A prediction is outside the remaining validated slate'; end if;

  insert into public.nfl_chain_boards (club_id, week_id, season_id, eligible_game_ids, lock_at, catch_up)
  values (_club_id, _week_id, season, eligible, cutoff,
    exists (select 1 from public.nfl_games g where g.week_id = _week_id and not (g.id = any(eligible))))
  on conflict (club_id, week_id) do nothing;
  select * into board from public.nfl_chain_boards where club_id = _club_id and week_id = _week_id for update;
  can_publish := public.nfl_chain_board_unlocked(_week_id, _club_id);
  select count(*) into existing from public.nfl_chain_markets where club_id = _club_id and week_id = _week_id;

  if can_publish then
    insert into public.nfl_chain_markets (
      club_id, season_id, week_id, game_id, market_type, subject_label, subject_team_id,
      subject_external_id, operator, threshold, display_text, source_provider, external_id,
      availability_status, availability_checked_at
    ) select _club_id, season, _week_id, (m->>'game_id')::uuid, m->>'market_type', m->>'subject_label',
      (m->>'subject_team_id')::uuid, m->>'subject_external_id', m->>'operator', (m->>'threshold')::numeric,
      m->>'display_text', 'espn-roster', m->>'external_id', 'verified', _checked_at
    from jsonb_array_elements(_markets) m
    where (m->>'game_id')::uuid = any(board.eligible_game_ids)
      and not exists (select 1 from public.nfl_chain_markets old where old.club_id = _club_id and old.week_id = _week_id
        and old.game_id = (m->>'game_id')::uuid and old.market_type = m->>'market_type'
        and old.operator = m->>'operator' and old.threshold = (m->>'threshold')::numeric
        and (old.subject_external_id is not distinct from m->>'subject_external_id')
        and (old.subject_team_id is not distinct from (m->>'subject_team_id')::uuid))
    on conflict (club_id, week_id, external_id) do nothing;
    get diagnostics added = row_count;
  end if;

  update public.nfl_chain_markets m set
    availability_status = case when (a->>'verified')::boolean then 'verified' else 'review' end,
    availability_checked_at = _checked_at, availability_note = a->>'note'
  from jsonb_array_elements(_availability) a
  where m.id = (a->>'id')::uuid and m.club_id = _club_id and m.week_id = _week_id
    and m.source_provider = 'espn-roster' and m.subject_external_id is not null and m.status = 'open'
    and m.game_id = any(eligible) and coalesce(m.availability_checked_at, '-infinity'::timestamptz) <= _checked_at;
  get diagnostics reviewed = row_count;
  select count(*) into paused from public.nfl_chain_markets where club_id = _club_id and week_id = _week_id
    and status = 'open' and subject_external_id is not null and availability_status = 'review';
  update public.nfl_chain_boards set checked_at = _checked_at, warnings = _warnings
    where club_id = _club_id and week_id = _week_id and coalesce(checked_at,'-infinity'::timestamptz) <= _checked_at;
  return jsonb_build_object('inserted',added,'existing',existing,'reviewed',reviewed,'paused',paused,
    'lock_at',board.lock_at,'locked',not can_publish);
end $$;
revoke all on function public.publish_nfl_chain_board(uuid,uuid,jsonb,jsonb,timestamptz,jsonb) from public, anon;
grant execute on function public.publish_nfl_chain_board(uuid,uuid,jsonb,jsonb,timestamptz,jsonb) to authenticated, service_role;

create or replace function public.save_nfl_chain_card(_week_id uuid, _market_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  caller uuid := auth.uid(); caller_club uuid := public.current_user_club_id();
  target_season uuid; selected_count integer := coalesce(cardinality(_market_ids),0);
  valid_count integer; target_entry uuid; existing_status text;
begin
  if caller is null or caller_club is null then raise exception 'Authentication and an active club are required'; end if;
  if selected_count < 1 then raise exception 'Choose at least one prediction'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chain:' || caller_club || ':' || _week_id, 0));
  if not public.nfl_chain_board_unlocked(_week_id,caller_club) then raise exception 'This Crazy Chain card is locked'; end if;
  select season_id into target_season from public.nfl_weeks where id = _week_id;
  select id,status into target_entry,existing_status from public.nfl_chain_entries
    where club_id = caller_club and user_id = caller and week_id = _week_id for update;
  if target_entry is not null and existing_status <> 'locked' then raise exception 'A settled card cannot be changed'; end if;
  select count(distinct m.id) into valid_count from public.nfl_chain_markets m
    join public.nfl_games g on g.id = m.game_id join public.nfl_seasons s on s.id = g.season_id
    where m.id = any(_market_ids) and m.club_id = caller_club and m.week_id = _week_id
      and m.season_id = target_season and g.week_id = _week_id and g.season_id = target_season
      and m.status = 'open' and g.status = 'scheduled'
      and now() < g.kickoff_at - make_interval(mins => coalesce(s.pick_lock_minutes,10))
      and (not exists (select 1 from public.nfl_chain_boards b where b.club_id = caller_club and b.week_id = _week_id)
        or exists (select 1 from public.nfl_chain_boards b where b.club_id = caller_club and b.week_id = _week_id and m.game_id = any(b.eligible_game_ids)))
      and (m.source_provider <> 'espn-roster' or m.subject_external_id is null
        or (m.availability_status = 'verified' and m.availability_checked_at >= now() - interval '24 hours')
        or exists (select 1 from public.nfl_chain_legs l where l.entry_id = target_entry and l.market_id = m.id));
  if valid_count <> selected_count then raise exception 'A prediction is duplicated, locked, or waiting for an availability recheck'; end if;
  insert into public.nfl_chain_entries (club_id,season_id,week_id,user_id,status,links_risked)
    values (caller_club,target_season,_week_id,caller,'locked',selected_count)
    on conflict (club_id,user_id,week_id) do update set links_risked = excluded.links_risked,
      hit_legs = 0, missed_legs = 0, void_legs = 0, links_won = 0, settled_at = null,
      locked_at = now(), updated_at = now()
    returning id into target_entry;
  -- Upsert only new legs; retain existing snapshots and IDs when a card is edited.
  delete from public.nfl_chain_legs where entry_id = target_entry and not (market_id = any(_market_ids));
  update public.nfl_chain_legs set position = position + 100000 where entry_id = target_entry;
  insert into public.nfl_chain_legs (entry_id,market_id,position,display_text,market_type,subject_label,operator,threshold,status)
    select target_entry,m.id,p.ordinality::integer,m.display_text,m.market_type,m.subject_label,m.operator,m.threshold,'pending'
    from unnest(_market_ids) with ordinality p(market_id,ordinality) join public.nfl_chain_markets m on m.id = p.market_id
    on conflict (entry_id,market_id) do update set position = excluded.position;
  return jsonb_build_object('entry_id',target_entry,'links_risked',selected_count,'locked_at',now());
end $$;

-- Other members' cards remain private until THIS club's board cutoff, not the
-- completed excluded game's cutoff. Existing own-card and owner visibility remain.
drop policy if exists "NflChainEntries: fair play read" on public.nfl_chain_entries;
create policy "NflChainEntries: fair play read" on public.nfl_chain_entries for select to authenticated
using ((club_id = public.current_user_club_id() and (user_id = auth.uid()
  or not public.nfl_chain_board_unlocked(week_id,club_id))) or public.is_platform_owner(auth.uid()));
drop policy if exists "NflChainLegs: fair play read" on public.nfl_chain_legs;
create policy "NflChainLegs: fair play read" on public.nfl_chain_legs for select to authenticated
using (exists (select 1 from public.nfl_chain_entries e where e.id = entry_id));
-- RLS invokes this helper as the querying role; it reveals only a board's lock state.
grant execute on function public.nfl_chain_board_unlocked(uuid,uuid) to authenticated, service_role;
notify pgrst, 'reload schema';
commit;
