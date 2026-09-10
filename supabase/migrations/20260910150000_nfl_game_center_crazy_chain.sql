-- NFL Game Center + Crazy Chain.
-- Adds provider-neutral markets, secure weekly cards, deterministic settlement,
-- standings reconstruction, and a user-facing asset rename.

update public.platform_assets
set
  name = 'NFL Game Center',
  short_description = 'NFL scores, weekly Pick''em, and Crazy Chain.',
  full_description = 'Your club''s NFL headquarters: follow the weekly slate, make Pick''em selections, build all-or-nothing Crazy Chains, and chase season records.',
  updated_at = now()
where slug = 'nfl-pickem';

create table if not exists public.nfl_chain_markets (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.current_user_club_id()
    references public.clubs(id) on delete cascade,
  season_id uuid not null references public.nfl_seasons(id) on delete cascade,
  week_id uuid not null references public.nfl_weeks(id) on delete cascade,
  game_id uuid not null references public.nfl_games(id) on delete cascade,
  market_type text not null check (market_type in (
    'team_win', 'team_points', 'game_total',
    'passing_touchdowns', 'passing_yards', 'rushing_yards',
    'receiving_yards', 'receptions', 'anytime_touchdown',
    'team_sacks', 'team_turnovers'
  )),
  subject_label text not null check (btrim(subject_label) <> ''),
  subject_team_id uuid references public.nfl_teams(id) on delete set null,
  subject_external_id text,
  operator text not null default 'gte' check (operator in ('gte', 'lte', 'eq')),
  threshold numeric not null,
  display_text text not null check (btrim(display_text) <> ''),
  source_provider text not null default 'admin',
  external_id text,
  status text not null default 'open' check (status in ('open', 'settled', 'void')),
  actual_value numeric,
  result boolean,
  settled_at timestamptz,
  settled_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, week_id, external_id),
  check (status <> 'settled' or (actual_value is not null and result is not null)),
  check (status <> 'void' or result is null)
);

create index if not exists idx_nfl_chain_markets_week_status
  on public.nfl_chain_markets (club_id, week_id, status);
create index if not exists idx_nfl_chain_markets_game
  on public.nfl_chain_markets (game_id);

create table if not exists public.nfl_chain_entries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.nfl_seasons(id) on delete cascade,
  week_id uuid not null references public.nfl_weeks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'locked' check (status in ('locked', 'won', 'lost', 'void')),
  links_risked integer not null check (links_risked > 0),
  hit_legs integer not null default 0 check (hit_legs >= 0),
  missed_legs integer not null default 0 check (missed_legs >= 0),
  void_legs integer not null default 0 check (void_legs >= 0),
  links_won integer not null default 0 check (links_won >= 0),
  locked_at timestamptz not null default now(),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, user_id, week_id),
  check (hit_legs + missed_legs + void_legs <= links_risked),
  check (status <> 'won' or (missed_legs = 0 and hit_legs > 0 and links_won = hit_legs)),
  check (status <> 'lost' or missed_legs > 0),
  check (status <> 'void' or (hit_legs = 0 and missed_legs = 0 and links_won = 0))
);

create index if not exists idx_nfl_chain_entries_season_user
  on public.nfl_chain_entries (club_id, season_id, user_id);
create index if not exists idx_nfl_chain_entries_week_status
  on public.nfl_chain_entries (week_id, status);

create table if not exists public.nfl_chain_legs (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.nfl_chain_entries(id) on delete cascade,
  market_id uuid not null references public.nfl_chain_markets(id) on delete restrict,
  position integer not null check (position > 0),
  display_text text not null,
  market_type text not null,
  subject_label text not null,
  operator text not null,
  threshold numeric not null,
  status text not null default 'pending' check (status in ('pending', 'hit', 'miss', 'void')),
  actual_value numeric,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (entry_id, market_id),
  unique (entry_id, position)
);

create index if not exists idx_nfl_chain_legs_market
  on public.nfl_chain_legs (market_id);

create table if not exists public.nfl_chain_standings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.nfl_seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_chain integer not null default 0 check (current_chain >= 0),
  best_chain integer not null default 0 check (best_chain >= 0),
  perfect_weeks integer not null default 0 check (perfect_weeks >= 0),
  total_hit_legs integer not null default 0 check (total_hit_legs >= 0),
  total_cards integer not null default 0 check (total_cards >= 0),
  busted_cards integer not null default 0 check (busted_cards >= 0),
  longest_card integer not null default 0 check (longest_card >= 0),
  last_settled_week integer,
  rank integer,
  updated_at timestamptz not null default now(),
  unique (club_id, season_id, user_id)
);

create index if not exists idx_nfl_chain_standings_rank
  on public.nfl_chain_standings (club_id, season_id, rank);

alter table public.nfl_chain_markets enable row level security;
alter table public.nfl_chain_entries enable row level security;
alter table public.nfl_chain_legs enable row level security;
alter table public.nfl_chain_standings enable row level security;

drop policy if exists "NflChainMarkets: club read" on public.nfl_chain_markets;
create policy "NflChainMarkets: club read"
on public.nfl_chain_markets for select to authenticated
using (club_id = public.current_user_club_id() or public.is_platform_owner(auth.uid()));

drop policy if exists "NflChainMarkets: admin manage" on public.nfl_chain_markets;
create policy "NflChainMarkets: admin manage"
on public.nfl_chain_markets for all to authenticated
using (
  (club_id = public.current_user_club_id() and public.is_app_admin(auth.uid()))
  or public.is_platform_owner(auth.uid())
)
with check (
  (club_id = public.current_user_club_id() and public.is_app_admin(auth.uid()))
  or public.is_platform_owner(auth.uid())
);

drop policy if exists "NflChainEntries: fair play read" on public.nfl_chain_entries;
create policy "NflChainEntries: fair play read"
on public.nfl_chain_entries for select to authenticated
using (
  (club_id = public.current_user_club_id()
    and (user_id = auth.uid() or not public.is_nfl_week_unlocked(week_id)))
  or public.is_platform_owner(auth.uid())
);

drop policy if exists "NflChainLegs: fair play read" on public.nfl_chain_legs;
create policy "NflChainLegs: fair play read"
on public.nfl_chain_legs for select to authenticated
using (
  exists (
    select 1
    from public.nfl_chain_entries entry
    where entry.id = nfl_chain_legs.entry_id
      and (
        (entry.club_id = public.current_user_club_id()
          and (entry.user_id = auth.uid() or not public.is_nfl_week_unlocked(entry.week_id)))
        or public.is_platform_owner(auth.uid())
      )
  )
);

drop policy if exists "NflChainStandings: club read" on public.nfl_chain_standings;
create policy "NflChainStandings: club read"
on public.nfl_chain_standings for select to authenticated
using (club_id = public.current_user_club_id() or public.is_platform_owner(auth.uid()));

create or replace function public.save_nfl_chain_card(
  _week_id uuid,
  _market_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  caller_club uuid := public.current_user_club_id();
  target_season uuid;
  selected_count integer := coalesce(cardinality(_market_ids), 0);
  valid_count integer;
  target_entry uuid;
  existing_status text;
begin
  if caller is null or caller_club is null then
    raise exception 'Authentication and an active club are required';
  end if;
  if selected_count < 1 then
    raise exception 'Choose at least one Crazy Chain prediction';
  end if;

  select week.season_id into target_season
  from public.nfl_weeks week
  where week.id = _week_id
    and public.is_nfl_week_unlocked(week.id);
  if target_season is null then
    raise exception 'This Crazy Chain card is locked';
  end if;

  select count(distinct market.id) into valid_count
  from public.nfl_chain_markets market
  join public.nfl_games game on game.id = market.game_id
  where market.id = any(_market_ids)
    and market.club_id = caller_club
    and market.week_id = _week_id
    and market.season_id = target_season
    and market.status = 'open'
    and game.status = 'scheduled';
  if valid_count <> selected_count then
    raise exception 'One or more predictions are duplicated, unavailable, or already locked';
  end if;

  select entry.id, entry.status into target_entry, existing_status
  from public.nfl_chain_entries entry
  where entry.club_id = caller_club
    and entry.user_id = caller
    and entry.week_id = _week_id
  for update;

  if target_entry is not null and existing_status <> 'locked' then
    raise exception 'A settled Crazy Chain card cannot be changed';
  end if;

  insert into public.nfl_chain_entries (
    club_id, season_id, week_id, user_id, status, links_risked,
    hit_legs, missed_legs, void_legs, links_won, locked_at,
    settled_at, updated_at
  ) values (
    caller_club, target_season, _week_id, caller, 'locked', selected_count,
    0, 0, 0, 0, now(), null, now()
  )
  on conflict (club_id, user_id, week_id) do update set
    links_risked = excluded.links_risked,
    hit_legs = 0,
    missed_legs = 0,
    void_legs = 0,
    links_won = 0,
    locked_at = now(),
    settled_at = null,
    updated_at = now()
  returning id into target_entry;

  delete from public.nfl_chain_legs where entry_id = target_entry;

  insert into public.nfl_chain_legs (
    entry_id, market_id, position, display_text, market_type,
    subject_label, operator, threshold, status
  )
  select
    target_entry,
    market.id,
    selected.ordinality::integer,
    market.display_text,
    market.market_type,
    market.subject_label,
    market.operator,
    market.threshold,
    'pending'
  from unnest(_market_ids) with ordinality as selected(market_id, ordinality)
  join public.nfl_chain_markets market on market.id = selected.market_id
  order by selected.ordinality;

  return jsonb_build_object(
    'entry_id', target_entry,
    'links_risked', selected_count,
    'locked_at', now()
  );
end;
$$;

create or replace function public.rebuild_nfl_chain_standings(
  _season_id uuid,
  _club_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  member record;
  card record;
  active_links integer;
  best_links integer;
  perfect_count integer;
  hit_count integer;
  card_count integer;
  bust_count integer;
  longest_count integer;
  final_week integer;
begin
  delete from public.nfl_chain_standings
  where season_id = _season_id and club_id = _club_id;

  for member in
    select distinct entry.user_id
    from public.nfl_chain_entries entry
    where entry.season_id = _season_id and entry.club_id = _club_id
  loop
    active_links := 0;
    best_links := 0;
    perfect_count := 0;
    hit_count := 0;
    card_count := 0;
    bust_count := 0;
    longest_count := 0;
    final_week := null;

    for card in
      select entry.*, week.week_number
      from public.nfl_chain_entries entry
      join public.nfl_weeks week on week.id = entry.week_id
      where entry.season_id = _season_id
        and entry.club_id = _club_id
        and entry.user_id = member.user_id
        and entry.status in ('won', 'lost', 'void')
      order by week.week_number, entry.created_at, entry.id
    loop
      hit_count := hit_count + card.hit_legs;
      final_week := card.week_number;
      if card.status = 'won' then
        active_links := active_links + card.links_won;
        best_links := greatest(best_links, active_links);
        perfect_count := perfect_count + 1;
        card_count := card_count + 1;
        longest_count := greatest(longest_count, card.links_won);
      elsif card.status = 'lost' then
        active_links := 0;
        bust_count := bust_count + 1;
        card_count := card_count + 1;
        longest_count := greatest(longest_count, card.links_risked);
      end if;
    end loop;

    insert into public.nfl_chain_standings (
      club_id, season_id, user_id, current_chain, best_chain,
      perfect_weeks, total_hit_legs, total_cards, busted_cards,
      longest_card, last_settled_week, updated_at
    ) values (
      _club_id, _season_id, member.user_id, active_links, best_links,
      perfect_count, hit_count, card_count, bust_count,
      longest_count, final_week, now()
    );
  end loop;

  with ranked as (
    select
      standing.id,
      rank() over (
        order by
          standing.current_chain desc,
          standing.best_chain desc,
          standing.perfect_weeks desc,
          standing.total_hit_legs desc,
          standing.user_id
      )::integer as calculated_rank
    from public.nfl_chain_standings standing
    where standing.season_id = _season_id and standing.club_id = _club_id
  )
  update public.nfl_chain_standings standing
  set rank = ranked.calculated_rank, updated_at = now()
  from ranked
  where standing.id = ranked.id;
end;
$$;

create or replace function public.settle_nfl_chain_market(
  _market_id uuid,
  _actual_value numeric default null,
  _void boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.nfl_chain_markets%rowtype;
  calculated_result boolean;
  affected_entries integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.is_app_admin(auth.uid())
     and not public.is_platform_owner(auth.uid()) then
    raise exception 'Admin access required';
  end if;

  select * into target
  from public.nfl_chain_markets
  where id = _market_id
  for update;
  if target.id is null then raise exception 'Crazy Chain market not found'; end if;

  if not _void and _actual_value is null then
    raise exception 'An actual value is required';
  end if;

  if _void then
    calculated_result := null;
  elsif target.operator = 'gte' then
    calculated_result := _actual_value >= target.threshold;
  elsif target.operator = 'lte' then
    calculated_result := _actual_value <= target.threshold;
  else
    calculated_result := _actual_value = target.threshold;
  end if;

  update public.nfl_chain_markets
  set
    status = case when _void then 'void' else 'settled' end,
    actual_value = case when _void then null else _actual_value end,
    result = calculated_result,
    settled_at = now(),
    settled_by = auth.uid(),
    updated_at = now()
  where id = _market_id;

  update public.nfl_chain_legs
  set
    status = case when _void then 'void' when calculated_result then 'hit' else 'miss' end,
    actual_value = case when _void then null else _actual_value end,
    settled_at = now()
  where market_id = _market_id;

  with affected as (
    select distinct leg.entry_id
    from public.nfl_chain_legs leg
    where leg.market_id = _market_id
  ), aggregates as (
    select
      leg.entry_id,
      count(*) filter (where leg.status = 'hit')::integer as hits,
      count(*) filter (where leg.status = 'miss')::integer as misses,
      count(*) filter (where leg.status = 'void')::integer as voids,
      count(*) filter (where leg.status = 'pending')::integer as pending
    from public.nfl_chain_legs leg
    join affected on affected.entry_id = leg.entry_id
    group by leg.entry_id
  )
  update public.nfl_chain_entries entry
  set
    hit_legs = aggregates.hits,
    missed_legs = aggregates.misses,
    void_legs = aggregates.voids,
    status = case
      when aggregates.misses > 0 then 'lost'
      when aggregates.pending > 0 then 'locked'
      when aggregates.hits = 0 then 'void'
      else 'won'
    end,
    links_won = case
      when aggregates.misses = 0 and aggregates.pending = 0 then aggregates.hits
      else 0
    end,
    settled_at = case when aggregates.pending = 0 or aggregates.misses > 0 then now() else null end,
    updated_at = now()
  from aggregates
  where entry.id = aggregates.entry_id;

  get diagnostics affected_entries = row_count;
  perform public.rebuild_nfl_chain_standings(target.season_id, target.club_id);

  return jsonb_build_object(
    'market_id', target.id,
    'status', case when _void then 'void' else 'settled' end,
    'result', calculated_result,
    'affected_entries', affected_entries
  );
end;
$$;

revoke all on function public.save_nfl_chain_card(uuid, uuid[]) from public, anon;
grant execute on function public.save_nfl_chain_card(uuid, uuid[]) to authenticated;

revoke all on function public.rebuild_nfl_chain_standings(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rebuild_nfl_chain_standings(uuid, uuid) to service_role;

revoke all on function public.settle_nfl_chain_market(uuid, numeric, boolean) from public, anon;
grant execute on function public.settle_nfl_chain_market(uuid, numeric, boolean) to authenticated, service_role;

grant select on public.nfl_chain_markets to authenticated;
grant select on public.nfl_chain_entries to authenticated;
grant select on public.nfl_chain_legs to authenticated;
grant select on public.nfl_chain_standings to authenticated;

grant insert, update, delete on public.nfl_chain_markets to authenticated;

drop trigger if exists trg_nfl_chain_markets_updated on public.nfl_chain_markets;
create trigger trg_nfl_chain_markets_updated
before update on public.nfl_chain_markets
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_nfl_chain_entries_updated on public.nfl_chain_entries;
create trigger trg_nfl_chain_entries_updated
before update on public.nfl_chain_entries
for each row execute function public.update_updated_at_column();

notify pgrst, 'reload schema';
