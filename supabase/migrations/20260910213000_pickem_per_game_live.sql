-- Run after 20260910210000_crazy_chain_per_game_live.sql.
-- Both NFL games now share an absolute 48-hour deadline per matchup.
begin;
create or replace function public.is_pick_unlocked(_game_id uuid)
returns boolean language sql stable security definer set search_path = public,pg_temp as $$
  select public.nfl_chain_game_unlocked(_game_id)
$$;
create or replace function public.is_nfl_week_unlocked(_week_id uuid)
returns boolean language sql stable security definer set search_path = public,pg_temp as $$
  select exists(select 1 from public.nfl_games g where g.week_id=_week_id and public.is_pick_unlocked(g.id))
$$;
create or replace function public.nfl_week_lock_at(_week_id uuid)
returns timestamptz language sql stable security definer set search_path = public,pg_temp as $$
  select coalesce(min(chain_lock_at) filter(where public.is_pick_unlocked(id)),max(chain_lock_at))
  from public.nfl_games where week_id=_week_id
$$;
create or replace function public.nfl_tiebreaker_unlocked(_week_id uuid)
returns boolean language sql stable security definer set search_path = public,pg_temp as $$
  select coalesce((select public.is_pick_unlocked(featured_game_id) from public.nfl_weeks where id=_week_id),false)
$$;
revoke all on function public.is_pick_unlocked(uuid),public.is_nfl_week_unlocked(uuid),public.nfl_week_lock_at(uuid),public.nfl_tiebreaker_unlocked(uuid) from public,anon;
grant execute on function public.is_pick_unlocked(uuid),public.is_nfl_week_unlocked(uuid),public.nfl_week_lock_at(uuid),public.nfl_tiebreaker_unlocked(uuid) to authenticated,service_role;

drop policy if exists "NflPicks: own before lock, club after lock" on public.nfl_picks;
create policy "NflPicks: own before lock, club after lock" on public.nfl_picks for select to authenticated
using (club_id=public.current_user_club_id() and (user_id=auth.uid() or not public.is_pick_unlocked(game_id)));
-- Existing insert/update/delete policies already use is_pick_unlocked(game_id).
-- Also bind identity and result fields: members cannot move a row or award points.
create or replace function public.guard_nfl_pick_write()
returns trigger language plpgsql security definer set search_path = public,pg_temp as $$
declare game public.nfl_games%rowtype;
begin
  if coalesce(auth.role(),'')='service_role' then return new; end if;
  select * into game from public.nfl_games where id=new.game_id for share;
  if not coalesce(public.is_pick_unlocked(new.game_id),false) then raise exception 'This game locked 48 hours before kickoff'; end if;
  if new.user_id is distinct from auth.uid() or new.club_id is distinct from public.current_user_club_id()
    or new.week_id is distinct from game.week_id or new.season_id is distinct from game.season_id
    or new.picked_team_id not in (game.home_team_id,game.away_team_id) then raise exception 'Invalid pick identity or matchup'; end if;
  if tg_op='UPDATE' and (new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.club_id is distinct from old.club_id or new.game_id is distinct from old.game_id
    or new.week_id is distinct from old.week_id or new.season_id is distinct from old.season_id)
    then raise exception 'Pick identity cannot change'; end if;
  new.is_correct:=null; new.points_awarded:=0;
  return new;
end $$;
drop trigger if exists trg_guard_nfl_pick_write on public.nfl_picks;
create trigger trg_guard_nfl_pick_write before insert or update on public.nfl_picks for each row execute function public.guard_nfl_pick_write();

drop policy if exists "NflTiebreakers: own before lock, club after lock" on public.nfl_tiebreakers;
create policy "NflTiebreakers: own before lock, club after lock" on public.nfl_tiebreakers for select to authenticated
using (club_id=public.current_user_club_id() and (user_id=auth.uid() or not public.nfl_tiebreaker_unlocked(week_id)));
drop policy if exists "NflTiebreakers: create own valid unlocked entry" on public.nfl_tiebreakers;
create policy "NflTiebreakers: create own valid unlocked entry" on public.nfl_tiebreakers for insert to authenticated
with check (user_id=auth.uid() and club_id=public.current_user_club_id() and public.nfl_tiebreaker_unlocked(week_id)
  and exists(select 1 from public.nfl_weeks w where w.id=week_id and w.season_id=nfl_tiebreakers.season_id));
drop policy if exists "NflTiebreakers: update own valid unlocked entry" on public.nfl_tiebreakers;
create policy "NflTiebreakers: update own valid unlocked entry" on public.nfl_tiebreakers for update to authenticated
using (user_id=auth.uid() and club_id=public.current_user_club_id() and public.nfl_tiebreaker_unlocked(week_id))
with check (user_id=auth.uid() and club_id=public.current_user_club_id() and public.nfl_tiebreaker_unlocked(week_id)
  and exists(select 1 from public.nfl_weeks w where w.id=week_id and w.season_id=nfl_tiebreakers.season_id));
drop policy if exists "NflTiebreakers: delete own unlocked entry" on public.nfl_tiebreakers;
create policy "NflTiebreakers: delete own unlocked entry" on public.nfl_tiebreakers for delete to authenticated
using (user_id=auth.uid() and club_id=public.current_user_club_id() and public.nfl_tiebreaker_unlocked(week_id));

create or replace function public.guard_nfl_tiebreaker_write()
returns trigger language plpgsql security definer set search_path = public,pg_temp as $$
begin
  if coalesce(auth.role(),'')='service_role' then return new; end if;
  if new.user_id is distinct from auth.uid() or new.club_id is distinct from public.current_user_club_id()
    or not public.nfl_tiebreaker_unlocked(new.week_id) or new.predicted_total is null or new.predicted_total<0
    then raise exception 'Invalid or locked tiebreaker'; end if;
  if tg_op='UPDATE' and (new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.club_id is distinct from old.club_id or new.week_id is distinct from old.week_id
    or new.season_id is distinct from old.season_id) then raise exception 'Tiebreaker identity cannot change'; end if;
  new.actual_total:=null; new.delta:=null;
  return new;
end $$;
drop trigger if exists trg_guard_nfl_tiebreaker_write on public.nfl_tiebreakers;
create trigger trg_guard_nfl_tiebreaker_write before insert or update on public.nfl_tiebreakers for each row execute function public.guard_nfl_tiebreaker_write();

-- If the protected reminder cron exists, reuse its stored request (including its
-- server-only authentication) for a separate lightweight five-minute results job.
-- No credentials are printed or copied into this file. Deployment is still needed.
do $$ declare request_sql text; begin
  if to_regclass('cron.job') is not null then
    execute 'select command from cron.job where command like ''%/functions/v1/pickem-week-reminder%'' and active order by jobid limit 1' into request_sql;
    if request_sql is not null then
      perform cron.schedule('nfl-live-results','*/5 * * * *',replace(request_sql,'/functions/v1/pickem-week-reminder','/functions/v1/sync-nfl-live'));
    else raise notice 'Configure sync-nfl-live every five minutes with the existing protected cron secret.'; end if;
  else raise notice 'No cron extension found. Configure the protected five-minute results schedule.'; end if;
end $$;
notify pgrst,'reload schema';
commit;
