-- NFL Pick'em integrity + fair-play privacy.
-- Picks and tiebreakers remain private until the configured weekly lock.
-- Writes are bound to the signed-in user's club and validated against the slate.

create or replace function public.is_nfl_week_unlocked(_week_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    now() < public.nfl_week_lock_at(_week_id)
    and not exists (
      select 1
      from public.nfl_games g
      where g.week_id = _week_id
        and g.status <> 'scheduled'
    ),
    false
  )
$$;

revoke all on function public.is_nfl_week_unlocked(uuid) from public;
grant execute on function public.is_nfl_week_unlocked(uuid) to authenticated;

drop policy if exists "NflPicks: club read" on public.nfl_picks;
drop policy if exists "Picks viewable by authenticated" on public.nfl_picks;
drop policy if exists "Users can create own picks while unlocked" on public.nfl_picks;
drop policy if exists "Users can update own picks while unlocked" on public.nfl_picks;
drop policy if exists "Users can delete own picks while unlocked" on public.nfl_picks;
drop policy if exists "Admins can update any pick" on public.nfl_picks;

create policy "NflPicks: own before lock, club after lock"
on public.nfl_picks for select to authenticated
using (
  club_id = public.current_user_club_id()
  and (user_id = auth.uid() or not public.is_nfl_week_unlocked(week_id))
);

create policy "NflPicks: create own valid unlocked pick"
on public.nfl_picks for insert to authenticated
with check (
  user_id = auth.uid()
  and club_id = public.current_user_club_id()
  and public.is_pick_unlocked(game_id)
  and exists (
    select 1
    from public.nfl_games g
    where g.id = nfl_picks.game_id
      and g.week_id = nfl_picks.week_id
      and g.season_id = nfl_picks.season_id
      and nfl_picks.picked_team_id in (g.home_team_id, g.away_team_id)
  )
);

create policy "NflPicks: update own valid unlocked pick"
on public.nfl_picks for update to authenticated
using (
  user_id = auth.uid()
  and club_id = public.current_user_club_id()
  and public.is_pick_unlocked(game_id)
)
with check (
  user_id = auth.uid()
  and club_id = public.current_user_club_id()
  and public.is_pick_unlocked(game_id)
  and exists (
    select 1
    from public.nfl_games g
    where g.id = nfl_picks.game_id
      and g.week_id = nfl_picks.week_id
      and g.season_id = nfl_picks.season_id
      and nfl_picks.picked_team_id in (g.home_team_id, g.away_team_id)
  )
);

create policy "NflPicks: delete own unlocked pick"
on public.nfl_picks for delete to authenticated
using (
  user_id = auth.uid()
  and club_id = public.current_user_club_id()
  and public.is_pick_unlocked(game_id)
);

drop policy if exists "NflTiebreakers: club read" on public.nfl_tiebreakers;
drop policy if exists "Tiebreakers viewable by authenticated" on public.nfl_tiebreakers;
drop policy if exists "Users can create own tiebreakers before featured kickoff" on public.nfl_tiebreakers;
drop policy if exists "Users can update own tiebreakers before featured kickoff" on public.nfl_tiebreakers;
drop policy if exists "Admins can update tiebreakers" on public.nfl_tiebreakers;

create policy "NflTiebreakers: own before lock, club after lock"
on public.nfl_tiebreakers for select to authenticated
using (
  club_id = public.current_user_club_id()
  and (user_id = auth.uid() or not public.is_nfl_week_unlocked(week_id))
);

create policy "NflTiebreakers: create own valid unlocked entry"
on public.nfl_tiebreakers for insert to authenticated
with check (
  user_id = auth.uid()
  and club_id = public.current_user_club_id()
  and public.is_nfl_week_unlocked(week_id)
  and exists (
    select 1
    from public.nfl_weeks w
    where w.id = nfl_tiebreakers.week_id
      and w.season_id = nfl_tiebreakers.season_id
      and w.featured_game_id is not null
  )
);

create policy "NflTiebreakers: update own valid unlocked entry"
on public.nfl_tiebreakers for update to authenticated
using (
  user_id = auth.uid()
  and club_id = public.current_user_club_id()
  and public.is_nfl_week_unlocked(week_id)
)
with check (
  user_id = auth.uid()
  and club_id = public.current_user_club_id()
  and public.is_nfl_week_unlocked(week_id)
  and exists (
    select 1
    from public.nfl_weeks w
    where w.id = nfl_tiebreakers.week_id
      and w.season_id = nfl_tiebreakers.season_id
      and w.featured_game_id is not null
  )
);

create policy "NflTiebreakers: delete own unlocked entry"
on public.nfl_tiebreakers for delete to authenticated
using (
  user_id = auth.uid()
  and club_id = public.current_user_club_id()
  and public.is_nfl_week_unlocked(week_id)
);

create index if not exists idx_nfl_picks_club_week_game
  on public.nfl_picks (club_id, week_id, game_id);

create index if not exists idx_nfl_tiebreakers_club_week
  on public.nfl_tiebreakers (club_id, week_id);

-- Existing imported weeks may predate automatic featured-game selection.
-- Default to the latest kickoff (typically Monday night) without replacing
-- any commissioner's explicit tiebreaker choice.
update public.nfl_weeks w
set featured_game_id = (
  select g.id
  from public.nfl_games g
  where g.week_id = w.id
  order by g.kickoff_at desc, g.id
  limit 1
)
where w.featured_game_id is null
  and exists (select 1 from public.nfl_games g where g.week_id = w.id);

-- ESPN sends zero-valued score fields before kickoff. They are placeholders,
-- not results, so clean existing imports and re-derive every week status.
update public.nfl_games
set away_score = null,
    home_score = null,
    winner_team_id = null
where status = 'scheduled';

do $$
declare
  week_row record;
begin
  for week_row in select id from public.nfl_weeks loop
    perform public.recompute_nfl_week_status(week_row.id);
  end loop;
end
$$;
