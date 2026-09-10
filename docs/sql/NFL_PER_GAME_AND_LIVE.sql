-- DH Club: Crazy Chain 30-minute / Pickem 48-hour per-game deadlines and live results.
-- Copy/paste this ENTIRE file. Rerunnable; preserves saved picks and targets.
-- Requires original Crazy Chain tables; replaces the previous catch-up SQL.
-- Deploy the six functions listed in docs/NFL_CRAZY_CHAIN_DATA.md afterward.
begin;

create table if not exists public.nfl_chain_boards (
  club_id uuid not null references public.clubs(id) on delete cascade,
  week_id uuid not null references public.nfl_weeks(id) on delete cascade,
  season_id uuid not null references public.nfl_seasons(id) on delete cascade,
  eligible_game_ids uuid[] not null, lock_at timestamptz not null,
  catch_up boolean not null default false, checked_at timestamptz,
  warnings jsonb not null default '[]'::jsonb, primary key(club_id,week_id)
);
alter table public.nfl_chain_boards enable row level security;
drop policy if exists "ChainBoards: club read" on public.nfl_chain_boards;
create policy "ChainBoards: club read" on public.nfl_chain_boards for select to authenticated
using (club_id = public.current_user_club_id() or public.is_platform_owner(auth.uid()));
grant select on public.nfl_chain_boards to authenticated;
grant all on public.nfl_chain_boards to service_role;
alter table public.nfl_chain_markets
  add column if not exists availability_status text not null default 'review' check(availability_status in ('verified','review')),
  add column if not exists availability_checked_at timestamptz,
  add column if not exists availability_note text,
  add column if not exists result_source text,
  add column if not exists result_checked_at timestamptz;

-- Absolute elapsed hours (not local calendar days). Postponements never reopen a
-- deadline; earlier reschedules move it earlier. This column affects Crazy Chain only.
alter table public.nfl_games add column if not exists chain_lock_at timestamptz;
update public.nfl_games set chain_lock_at = kickoff_at - interval '48 hours' where chain_lock_at is null;
create or replace function public.freeze_nfl_chain_game_lock()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then new.chain_lock_at := new.kickoff_at - interval '48 hours';
  else new.chain_lock_at := least(old.chain_lock_at, new.kickoff_at - interval '48 hours'); end if;
  return new;
end $$;
drop trigger if exists trg_freeze_nfl_chain_game_lock on public.nfl_games;
create trigger trg_freeze_nfl_chain_game_lock before insert or update of kickoff_at,chain_lock_at on public.nfl_games
for each row execute function public.freeze_nfl_chain_game_lock();

create or replace function public.nfl_chain_game_unlocked(_game_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select status = 'scheduled' and now() < least(chain_lock_at,kickoff_at - interval '48 hours')
    from public.nfl_games where id = _game_id),false)
$$;
revoke all on function public.nfl_chain_game_unlocked(uuid) from public,anon;
grant execute on function public.nfl_chain_game_unlocked(uuid) to authenticated,service_role;
create or replace function public.nfl_chain_board_unlocked(_week_id uuid,_club_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.nfl_games g where g.week_id = _week_id and public.nfl_chain_game_unlocked(g.id))
$$;
revoke all on function public.nfl_chain_board_unlocked(uuid,uuid) from public,anon;
grant execute on function public.nfl_chain_board_unlocked(uuid,uuid) to authenticated,service_role;

create or replace function public.get_nfl_chain_board(_week_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('mode','per_game_48h','lock_hours',48,
    'lock_at',(select min(chain_lock_at) from public.nfl_games where week_id = w.id and public.nfl_chain_game_unlocked(id)),
    'unlocked',public.nfl_chain_board_unlocked(w.id,public.current_user_club_id()),
    'catch_up',false,'game_ids',(select coalesce(jsonb_agg(id),'[]'::jsonb) from public.nfl_games where week_id = w.id),
    'games',(select coalesce(jsonb_agg(jsonb_build_object('game_id',id,'lock_at',chain_lock_at,
      'unlocked',public.nfl_chain_game_unlocked(id)) order by kickoff_at,id),'[]'::jsonb) from public.nfl_games where week_id = w.id),
    'checked_at',b.checked_at,'warnings',coalesce(b.warnings,'[]'::jsonb))
  from public.nfl_weeks w left join public.nfl_chain_boards b on b.week_id = w.id and b.club_id = public.current_user_club_id()
  where w.id = _week_id and public.current_user_club_id() is not null
$$;
revoke all on function public.get_nfl_chain_board(uuid) from public,anon;
grant execute on function public.get_nfl_chain_board(uuid) to authenticated;

-- The weekly entry remains a private storage envelope. Its legs and IDs survive.
-- Game results are derived, so replaying or correcting stats cannot double-credit.
create or replace view public.nfl_chain_game_cards with (security_invoker = true) as
with counts as (
  select e.id as entry_id,e.club_id,e.season_id,e.week_id,e.user_id,g.id as game_id,g.kickoff_at,g.chain_lock_at,
    g.status as game_status,w.week_number,g.home_team_id,g.away_team_id,
    count(*)::integer as links_risked,
    count(*) filter(where l.status = 'hit')::integer as hits,
    count(*) filter(where l.status = 'miss')::integer as misses,
    count(*) filter(where l.status = 'void')::integer as voids,
    count(*) filter(where l.status = 'pending')::integer as pending,
    max(l.settled_at) as settled_at
  from public.nfl_chain_entries e join public.nfl_chain_legs l on l.entry_id = e.id
  join public.nfl_chain_markets m on m.id = l.market_id join public.nfl_games g on g.id = m.game_id
  join public.nfl_weeks w on w.id = e.week_id
  group by e.id,g.id,w.week_number
)
select *, case when now() < chain_lock_at or (game_status <> 'final' and voids <> links_risked) then 'locked'
  when misses > 0 then 'lost' when pending > 0 then 'locked' when hits = 0 then 'void' else 'won' end as status
from counts;
grant select on public.nfl_chain_game_cards to authenticated,service_role;
alter table public.nfl_chain_standings
  add column if not exists perfect_games integer not null default 0,
  add column if not exists pending_games integer not null default 0;

create or replace function public.rebuild_nfl_chain_standings(_season_id uuid,_club_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare member record; slot record; active_links integer; best_links integer; final_week integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('chain-season:' || _club_id || ':' || _season_id,0));
  delete from public.nfl_chain_standings s where s.club_id = _club_id and s.season_id = _season_id
    and not exists(select 1 from public.nfl_chain_entries e where e.club_id = s.club_id and e.season_id = s.season_id and e.user_id = s.user_id);
  for member in select distinct user_id from public.nfl_chain_entries where club_id = _club_id and season_id = _season_id loop
    active_links := 0; best_links := 0; final_week := null;
    -- Kickoff order, not provider arrival order. Same-time games form one step:
    -- a miss resets that step; no arbitrary UUID ordering changes the winner.
    for slot in select kickoff_at,bool_or(status = 'locked') as waiting,bool_or(status = 'lost') as busted,
      sum(hits) filter(where status = 'won') as links,max(week_number) as week_number
      from public.nfl_chain_game_cards where club_id = _club_id and season_id = _season_id and user_id = member.user_id
      group by kickoff_at order by kickoff_at
    loop
      exit when slot.waiting;
      if slot.busted then active_links := 0; else active_links := active_links + coalesce(slot.links,0); end if;
      best_links := greatest(best_links,active_links); final_week := slot.week_number;
    end loop;
    insert into public.nfl_chain_standings(club_id,season_id,user_id,current_chain,best_chain,perfect_weeks,
      total_hit_legs,total_cards,busted_cards,longest_card,last_settled_week,perfect_games,pending_games,updated_at)
    select _club_id,_season_id,member.user_id,active_links,best_links,
      (select count(*) from public.nfl_chain_entries e where e.club_id = _club_id and e.season_id = _season_id
        and e.user_id = member.user_id and e.status = 'won' and not public.nfl_chain_board_unlocked(e.week_id,_club_id)),
      coalesce(sum(hits) filter(where now() >= chain_lock_at),0),count(*) filter(where status in ('won','lost')),
      count(*) filter(where status = 'lost'),coalesce(max(links_risked) filter(where status in ('won','lost')),0),final_week,
      count(*) filter(where status = 'won'),count(*) filter(where status = 'locked' and now() >= chain_lock_at),now()
    from public.nfl_chain_game_cards where club_id = _club_id and season_id = _season_id and user_id = member.user_id
    on conflict(club_id,season_id,user_id) do update set current_chain = excluded.current_chain,best_chain = excluded.best_chain,
      perfect_weeks = excluded.perfect_weeks,total_hit_legs = excluded.total_hit_legs,total_cards = excluded.total_cards,
      busted_cards = excluded.busted_cards,longest_card = excluded.longest_card,last_settled_week = excluded.last_settled_week,
      perfect_games = excluded.perfect_games,pending_games = excluded.pending_games,updated_at = now();
  end loop;
  with ranks as (select id,rank() over(order by current_chain desc,best_chain desc,perfect_games desc,total_hit_legs desc)::integer as n
    from public.nfl_chain_standings where club_id = _club_id and season_id = _season_id)
  update public.nfl_chain_standings s set rank = r.n from ranks r where s.id = r.id;
end $$;
revoke all on function public.rebuild_nfl_chain_standings(uuid,uuid) from public,anon,authenticated;
grant execute on function public.rebuild_nfl_chain_standings(uuid,uuid) to service_role;

create or replace function public.refresh_nfl_chain_entry(_entry_id uuid)
returns void language sql security definer set search_path = public, pg_temp as $$
  with a as (select count(*)::integer as total,count(*) filter(where status='hit')::integer as hits,
    count(*) filter(where status='miss')::integer as misses,count(*) filter(where status='void')::integer as voids,
    count(*) filter(where status='pending')::integer as pending from public.nfl_chain_legs where entry_id = _entry_id)
  update public.nfl_chain_entries e set links_risked=a.total,hit_legs=a.hits,missed_legs=a.misses,void_legs=a.voids,
    status=case when a.misses>0 then 'lost' when a.pending>0 then 'locked' when a.hits=0 then 'void' else 'won' end,
    links_won=case when a.misses=0 and a.pending=0 then a.hits else 0 end,
    settled_at=case when a.pending=0 then now() else null end,updated_at=now()
  from a where e.id=_entry_id and a.total>0
$$;
revoke all on function public.refresh_nfl_chain_entry(uuid) from public,anon,authenticated;

create or replace function public.save_nfl_chain_card(_week_id uuid,_market_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare caller uuid := auth.uid(); club uuid := public.current_user_club_id(); season uuid; target uuid;
  selected_count integer := coalesce(cardinality(_market_ids),0); valid_count integer;
begin
  if caller is null or club is null then raise exception 'Authentication and an active club are required'; end if;
  if selected_count > 1000 or _market_ids is null then raise exception 'Invalid prediction selection'; end if;
  select season_id into season from public.nfl_weeks where id=_week_id;
  if season is null then raise exception 'Week not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chain-season:' || club || ':' || season,0));
  -- Serialize against score/schedule changes as well as another tab saving picks.
  perform id from public.nfl_games where week_id=_week_id order by id for share;
  select id into target from public.nfl_chain_entries where club_id=club and week_id=_week_id and user_id=caller for update;
  if exists(select 1 from public.nfl_chain_legs l join public.nfl_chain_markets m on m.id=l.market_id
    where l.entry_id=target and not (l.market_id=any(_market_ids)) and not public.nfl_chain_game_unlocked(m.game_id))
    then raise exception 'Locked game selections cannot be removed or changed'; end if;
  select count(distinct m.id) into valid_count from public.nfl_chain_markets m join public.nfl_games g on g.id=m.game_id
  where m.id=any(_market_ids) and m.club_id=club and m.week_id=_week_id and m.season_id=season
    and g.week_id=_week_id and g.season_id=season and (
      exists(select 1 from public.nfl_chain_legs l where l.entry_id=target and l.market_id=m.id)
      or (public.nfl_chain_game_unlocked(g.id) and m.status='open' and
        (m.source_provider<>'espn-roster' or m.subject_external_id is null or
          (m.availability_status='verified' and m.availability_checked_at between now()-interval '24 hours' and now()+interval '1 minute'))));
  if valid_count<>selected_count then raise exception 'A prediction is duplicated, past its 48-hour deadline, or needs an availability recheck'; end if;
  if selected_count=0 then
    delete from public.nfl_chain_entries where id=target;
    perform public.rebuild_nfl_chain_standings(season,club);
    return jsonb_build_object('entry_id',null,'links_risked',0);
  end if;
  if target is null then
    insert into public.nfl_chain_entries(club_id,season_id,week_id,user_id,links_risked)
      values(club,season,_week_id,caller,selected_count) returning id into target;
  end if;
  delete from public.nfl_chain_legs where entry_id=target and not (market_id=any(_market_ids));
  update public.nfl_chain_legs set position=position+100000 where entry_id=target;
  insert into public.nfl_chain_legs(entry_id,market_id,position,display_text,market_type,subject_label,operator,threshold,status)
    select target,m.id,p.ordinality::integer,m.display_text,m.market_type,m.subject_label,m.operator,m.threshold,'pending'
    from unnest(_market_ids) with ordinality p(id,ordinality) join public.nfl_chain_markets m on m.id=p.id
    on conflict(entry_id,market_id) do update set position=excluded.position;
  perform public.refresh_nfl_chain_entry(target);
  perform public.rebuild_nfl_chain_standings(season,club);
  return jsonb_build_object('entry_id',target,'links_risked',selected_count);
end $$;
revoke all on function public.save_nfl_chain_card(uuid,uuid[]) from public,anon;
grant execute on function public.save_nfl_chain_card(uuid,uuid[]) to authenticated;

create or replace function public.save_nfl_chain_game(_game_id uuid,_market_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare game public.nfl_games%rowtype; other_ids uuid[]; club uuid := public.current_user_club_id();
begin
  if auth.uid() is null or club is null then raise exception 'Authentication required'; end if;
  select * into game from public.nfl_games where id=_game_id;
  if game.id is null then raise exception 'Game not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chain-season:' || club || ':' || game.season_id,0));
  perform id from public.nfl_games where id=_game_id for share;
  if not public.nfl_chain_game_unlocked(_game_id) then raise exception 'This game locked 48 hours before kickoff'; end if;
  if _market_ids is null or exists(select 1 from unnest(_market_ids) x where not exists(
    select 1 from public.nfl_chain_markets m where m.id=x and m.game_id=_game_id and m.club_id=club))
    then raise exception 'Choose predictions from this game only'; end if;
  select coalesce(array_agg(l.market_id order by l.position),'{}'::uuid[]) into other_ids
    from public.nfl_chain_entries e join public.nfl_chain_legs l on l.entry_id=e.id
    join public.nfl_chain_markets m on m.id=l.market_id
    where e.club_id=club and e.user_id=auth.uid() and e.week_id=game.week_id and m.game_id<>_game_id;
  return public.save_nfl_chain_card(game.week_id,other_ids || _market_ids);
end $$;
revoke all on function public.save_nfl_chain_game(uuid,uuid[]) from public,anon;
grant execute on function public.save_nfl_chain_game(uuid,uuid[]) to authenticated;

create or replace function public.settle_nfl_chain_market(_market_id uuid,_actual_value numeric default null,_void boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.nfl_chain_markets%rowtype; calculated_result boolean; affected record; changed integer := 0;
begin
  select * into target from public.nfl_chain_markets where id=_market_id;
  if target.id is null then raise exception 'Prediction not found'; end if;
  if coalesce(auth.role(),'')<>'service_role' and not coalesce(
    target.club_id=public.current_user_club_id() and (public.is_app_admin(auth.uid()) or public.is_platform_owner(auth.uid())),false)
    then raise exception 'Club commissioner access required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chain-season:' || target.club_id || ':' || target.season_id,0));
  select * into target from public.nfl_chain_markets where id=_market_id for update;
  if _void is null or (not _void and (_actual_value is null or _actual_value::text in ('NaN','Infinity','-Infinity')))
    then raise exception 'A finite verified actual value is required'; end if;
  if not _void and not exists(select 1 from public.nfl_games where id=target.game_id and status='final')
    then raise exception 'Wait for the final game result'; end if;
  calculated_result := case when _void then null when target.operator='gte' then _actual_value>=target.threshold
    when target.operator='lte' then _actual_value<=target.threshold else _actual_value=target.threshold end;
  update public.nfl_chain_markets set status=case when _void then 'void' else 'settled' end,
    actual_value=case when _void then null else _actual_value end,result=calculated_result,settled_at=coalesce(settled_at,now()),
    settled_by=auth.uid(),result_source=case when auth.role()='service_role' then 'espn-final' else 'commissioner' end,
    result_checked_at=now(),updated_at=now() where id=_market_id;
  -- Grade against each immutable saved target, not an editable market threshold.
  update public.nfl_chain_legs l set status=case when _void then 'void'
    when (case when l.operator='gte' then _actual_value>=l.threshold when l.operator='lte' then _actual_value<=l.threshold
      else _actual_value=l.threshold end) then 'hit' else 'miss' end,
    actual_value=case when _void then null else _actual_value end,settled_at=coalesce(l.settled_at,now()) where market_id=_market_id;
  for affected in select distinct entry_id from public.nfl_chain_legs where market_id=_market_id loop
    perform public.refresh_nfl_chain_entry(affected.entry_id); changed:=changed+1;
  end loop;
  if not (coalesce(auth.role(),'')='service_role' and coalesce(current_setting('app.chain_batch',true),'')='on') then
    perform public.rebuild_nfl_chain_standings(target.season_id,target.club_id);
  end if;
  return jsonb_build_object('market_id',_market_id,'result',calculated_result,'affected_entries',changed);
end $$;
revoke all on function public.settle_nfl_chain_market(uuid,numeric,boolean) from public,anon;
grant execute on function public.settle_nfl_chain_market(uuid,numeric,boolean) to authenticated,service_role;

create or replace function public.apply_nfl_chain_game_results(_game_id uuid,_results jsonb,_checked_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare r record; target public.nfl_chain_markets%rowtype; item jsonb; changed integer:=0;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server scoring only'; end if;
  if coalesce(jsonb_typeof(_results),'null')<>'array' or jsonb_array_length(_results)>1000
    or _checked_at is null or _checked_at not between now()-interval '10 minutes' and now()+interval '1 minute'
    then raise exception 'Invalid or expired scoring evidence'; end if;
  if not exists(select 1 from public.nfl_games where id=_game_id and status='final') then raise exception 'Game is not final'; end if;
  -- Acquire all season/club locks in the same order before changing any market.
  for r in select distinct m.club_id,m.season_id from public.nfl_chain_markets m
    where m.game_id=_game_id and m.id in(select (x->>'id')::uuid from jsonb_array_elements(_results) x) order by m.club_id,m.season_id loop
    perform pg_advisory_xact_lock(hashtextextended('chain-season:' || r.club_id || ':' || r.season_id,0));
  end loop;
  perform set_config('app.chain_batch','on',true);
  for item in select value from jsonb_array_elements(_results) loop
    select * into target from public.nfl_chain_markets where id=(item->>'id')::uuid and game_id=_game_id for update;
    if target.id is null then raise exception 'Result does not belong to this game'; end if;
    -- Never overwrite a commissioner's manual decision, even if it changed after
    -- the worker read its snapshot. Ignore older overlapping refreshes as well.
    if (target.status<>'open' and target.result_source is distinct from 'espn-final')
      or target.result_checked_at>_checked_at then continue; end if;
    if (target.status=case when (item->>'voided')::boolean then 'void' else 'settled' end)
      and target.actual_value is not distinct from (item->>'actual')::numeric then
      update public.nfl_chain_markets set result_checked_at=_checked_at where id=target.id;
      continue;
    end if;
    perform public.settle_nfl_chain_market(target.id,(item->>'actual')::numeric,(item->>'voided')::boolean);
    update public.nfl_chain_markets set result_checked_at=_checked_at where id=target.id;
    changed:=changed+1;
  end loop;
  perform set_config('app.chain_batch','off',true);
  if changed>0 then
    for r in select distinct club_id,season_id from public.nfl_chain_markets where game_id=_game_id loop
      perform public.rebuild_nfl_chain_standings(r.season_id,r.club_id);
    end loop;
  end if;
  return jsonb_build_object('changed',changed,'checked',jsonb_array_length(_results));
end $$;
revoke all on function public.apply_nfl_chain_game_results(uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_nfl_chain_game_results(uuid,jsonb,timestamptz) to service_role;

-- Whole-entry aggregates could reveal the size of a member's still-editable
-- Sunday selections. Keep them private until all game deadlines have passed.
drop policy if exists "NflChainEntries: fair play read" on public.nfl_chain_entries;
create policy "NflChainEntries: fair play read" on public.nfl_chain_entries for select to authenticated
using ((club_id=public.current_user_club_id() and (user_id=auth.uid() or not public.nfl_chain_board_unlocked(week_id,club_id)))
  or public.is_platform_owner(auth.uid()));
drop policy if exists "NflChainLegs: fair play read" on public.nfl_chain_legs;
create policy "NflChainLegs: fair play read" on public.nfl_chain_legs for select to authenticated
using (exists(select 1 from public.nfl_chain_entries e where e.id=entry_id));

create or replace function public.publish_nfl_chain_board(_week_id uuid,_club_id uuid,_markets jsonb,_availability jsonb,
  _checked_at timestamptz,_warnings jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare season uuid; eligible uuid[]; added integer; reviewed integer; existing integer; paused integer;
begin
  if coalesce(auth.role(),'')<>'service_role' and not coalesce(_club_id=public.current_user_club_id()
    and (public.is_app_admin(auth.uid()) or public.is_platform_owner(auth.uid())),false)
    then raise exception 'Club commissioner access required'; end if;
  if _club_id is null or _checked_at is null or _checked_at not between now()-interval '10 minutes' and now()+interval '1 minute'
    then raise exception 'Refresh the expired preview'; end if;
  if coalesce(jsonb_typeof(_markets),'null')<>'array' or coalesce(jsonb_typeof(_availability),'null')<>'array'
    or coalesce(jsonb_typeof(_warnings),'null')<>'array' then raise exception 'Invalid board payload'; end if;
  if jsonb_array_length(_markets)>1000 or jsonb_array_length(_availability)>1000 then raise exception 'Oversized board payload'; end if;
  select season_id into season from public.nfl_weeks where id=_week_id;
  if season is null then raise exception 'Week not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chain-season:' || _club_id || ':' || season,0));
  perform id from public.nfl_games where week_id=_week_id order by id for share;
  select coalesce(array_agg(id),'{}'::uuid[]) into eligible from public.nfl_games where week_id=_week_id and public.nfl_chain_game_unlocked(id);
  if exists(select 1 from jsonb_array_elements(_markets) m where not exists(select 1 from public.nfl_games g
    where g.id=(m->>'game_id')::uuid and g.id=any(eligible) and g.week_id=_week_id and g.season_id=season
      and (m->>'club_id')::uuid=_club_id and (m->>'week_id')::uuid=_week_id and (m->>'season_id')::uuid=season
      and m->>'source_provider'='espn-roster' and coalesce(m->>'external_id','')<>''
      and (m->>'subject_team_id' is null or (m->>'subject_team_id')::uuid in (g.home_team_id,g.away_team_id))))
    then raise exception 'A prediction is outside the remaining 48-hour slate'; end if;
  select count(*) into existing from public.nfl_chain_markets where club_id=_club_id and week_id=_week_id;
  insert into public.nfl_chain_markets(club_id,season_id,week_id,game_id,market_type,subject_label,subject_team_id,
    subject_external_id,operator,threshold,display_text,source_provider,external_id,availability_status,availability_checked_at)
    select _club_id,season,_week_id,(m->>'game_id')::uuid,m->>'market_type',m->>'subject_label',(m->>'subject_team_id')::uuid,
      m->>'subject_external_id',m->>'operator',(m->>'threshold')::numeric,m->>'display_text','espn-roster',m->>'external_id','verified',_checked_at
    from jsonb_array_elements(_markets) m where not exists(select 1 from public.nfl_chain_markets old
      where old.club_id=_club_id and old.week_id=_week_id and old.game_id=(m->>'game_id')::uuid
      and old.market_type=m->>'market_type' and old.operator=m->>'operator' and old.threshold=(m->>'threshold')::numeric
      and old.subject_external_id is not distinct from m->>'subject_external_id'
      and old.subject_team_id is not distinct from (m->>'subject_team_id')::uuid)
    on conflict(club_id,week_id,external_id) do nothing;
  get diagnostics added=row_count;
  update public.nfl_chain_markets m set availability_status=case when (a->>'verified')::boolean then 'verified' else 'review' end,
    availability_checked_at=_checked_at,availability_note=a->>'note' from jsonb_array_elements(_availability) a
    where m.id=(a->>'id')::uuid and m.club_id=_club_id and m.week_id=_week_id and m.source_provider='espn-roster'
      and m.subject_external_id is not null and m.status='open'
      and exists(select 1 from public.nfl_games g where g.id=m.game_id and g.status='scheduled' and g.kickoff_at>now())
      and coalesce(m.availability_checked_at,'-infinity'::timestamptz)<=_checked_at;
  get diagnostics reviewed=row_count;
  select count(*) into paused from public.nfl_chain_markets where club_id=_club_id and week_id=_week_id
    and status='open' and subject_external_id is not null and availability_status='review';
  insert into public.nfl_chain_boards(club_id,week_id,season_id,eligible_game_ids,lock_at,checked_at,warnings)
    values(_club_id,_week_id,season,eligible,coalesce((select min(chain_lock_at) from public.nfl_games where id=any(eligible)),now()),_checked_at,_warnings)
    on conflict(club_id,week_id) do update set eligible_game_ids=excluded.eligible_game_ids,checked_at=excluded.checked_at,warnings=excluded.warnings
    where coalesce(nfl_chain_boards.checked_at,'-infinity'::timestamptz)<=excluded.checked_at;
  return jsonb_build_object('inserted',added,'existing',existing,'reviewed',reviewed,'paused',paused,
    'lock_at',(select min(chain_lock_at) from public.nfl_games where id=any(eligible)),'locked',cardinality(eligible)=0);
end $$;
revoke all on function public.publish_nfl_chain_board(uuid,uuid,jsonb,jsonb,timestamptz,jsonb) from public,anon;
grant execute on function public.publish_nfl_chain_board(uuid,uuid,jsonb,jsonb,timestamptz,jsonb) to authenticated,service_role;

-- Recompute existing picks under game-by-game rules, without rewriting any leg.
do $$ declare r record; begin
  for r in select distinct season_id,club_id from public.nfl_chain_entries loop
    perform public.rebuild_nfl_chain_standings(r.season_id,r.club_id);
  end loop;
end $$;
notify pgrst,'reload schema';


-- Both NFL games now share an absolute 48-hour deadline per matchup.
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



-- Crazy Chain ONLY: picks close 30 minutes before each kickoff.
-- Run after the per-game/live migrations. Weekly Pick'em and its tiebreaker
-- retain their exact existing 48-hour deadlines. Saved selections are preserved.

-- Keep chain_lock_at as the legacy Pick'em deadline; do not move it.
-- The independent field prevents one game's rules from changing the other.
alter table public.nfl_games add column if not exists crazy_chain_lock_at timestamptz;
update public.nfl_games set crazy_chain_lock_at = least(kickoff_at - interval '30 minutes',
  chain_lock_at + interval '47 hours 30 minutes') where crazy_chain_lock_at is null;
comment on column public.nfl_games.chain_lock_at is 'Legacy name: frozen Weekly Pickem deadline, 48 hours before kickoff.';
comment on column public.nfl_games.crazy_chain_lock_at is 'Frozen Crazy Chain deadline, 30 minutes before kickoff.';

create or replace function public.freeze_crazy_chain_game_lock()
returns trigger language plpgsql set search_path = public,pg_temp as $$
begin
  if tg_op='INSERT' then new.crazy_chain_lock_at := new.kickoff_at - interval '30 minutes';
  else new.crazy_chain_lock_at := least(old.crazy_chain_lock_at,new.kickoff_at - interval '30 minutes'); end if;
  return new;
end $$;
drop trigger if exists trg_freeze_crazy_chain_game_lock on public.nfl_games;
create trigger trg_freeze_crazy_chain_game_lock before insert or update of kickoff_at,crazy_chain_lock_at on public.nfl_games
for each row execute function public.freeze_crazy_chain_game_lock();

-- Decouple Pick'em before extending Crazy Chain's selection window.
create or replace function public.is_pick_unlocked(_game_id uuid)
returns boolean language sql stable security definer set search_path = public,pg_temp as $$
  select coalesce((select status='scheduled' and now()<least(chain_lock_at,kickoff_at-interval '48 hours')
    from public.nfl_games where id=_game_id),false)
$$;
revoke all on function public.is_pick_unlocked(uuid) from public,anon;
grant execute on function public.is_pick_unlocked(uuid) to authenticated,service_role;

create or replace function public.nfl_chain_game_unlocked(_game_id uuid)
returns boolean language sql stable security definer set search_path = public,pg_temp as $$
  select coalesce((select status='scheduled' and now()<least(crazy_chain_lock_at,kickoff_at-interval '30 minutes')
    from public.nfl_games where id=_game_id),false)
$$;
revoke all on function public.nfl_chain_game_unlocked(uuid) from public,anon;
grant execute on function public.nfl_chain_game_unlocked(uuid) to authenticated,service_role;

create or replace function public.get_nfl_chain_board(_week_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('mode','per_game_30m','lock_minutes',30,'pickem_lock_hours',48,
    'lock_at',(select min(crazy_chain_lock_at) from public.nfl_games where week_id = w.id and public.nfl_chain_game_unlocked(id)),
    'unlocked',public.nfl_chain_board_unlocked(w.id,public.current_user_club_id()),
    'catch_up',false,'game_ids',(select coalesce(jsonb_agg(id),'[]'::jsonb) from public.nfl_games where week_id = w.id),
    'games',(select coalesce(jsonb_agg(jsonb_build_object('game_id',id,'lock_at',crazy_chain_lock_at,
      'unlocked',public.nfl_chain_game_unlocked(id)) order by kickoff_at,id),'[]'::jsonb) from public.nfl_games where week_id = w.id),
    'checked_at',b.checked_at,'warnings',coalesce(b.warnings,'[]'::jsonb))
  from public.nfl_weeks w left join public.nfl_chain_boards b on b.week_id = w.id and b.club_id = public.current_user_club_id()
  where w.id = _week_id and public.current_user_club_id() is not null
$$;
revoke all on function public.get_nfl_chain_board(uuid) from public,anon;
grant execute on function public.get_nfl_chain_board(uuid) to authenticated;


-- Preserve the view's output columns and saved result identities.
create or replace view public.nfl_chain_game_cards with (security_invoker = true) as
with counts as (
  select e.id as entry_id,e.club_id,e.season_id,e.week_id,e.user_id,g.id as game_id,g.kickoff_at,g.crazy_chain_lock_at as chain_lock_at,
    g.status as game_status,w.week_number,g.home_team_id,g.away_team_id,
    count(*)::integer as links_risked,
    count(*) filter(where l.status = 'hit')::integer as hits,
    count(*) filter(where l.status = 'miss')::integer as misses,
    count(*) filter(where l.status = 'void')::integer as voids,
    count(*) filter(where l.status = 'pending')::integer as pending,
    max(l.settled_at) as settled_at
  from public.nfl_chain_entries e join public.nfl_chain_legs l on l.entry_id = e.id
  join public.nfl_chain_markets m on m.id = l.market_id join public.nfl_games g on g.id = m.game_id
  join public.nfl_weeks w on w.id = e.week_id
  group by e.id,g.id,w.week_number
)
select *, case when now() < chain_lock_at or (game_status <> 'final' and voids <> links_risked) then 'locked'
  when misses > 0 then 'lost' when pending > 0 then 'locked' when hits = 0 then 'void' else 'won' end as status
from counts;
grant select on public.nfl_chain_game_cards to authenticated,service_role;

create or replace function public.save_nfl_chain_card(_week_id uuid,_market_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare caller uuid := auth.uid(); club uuid := public.current_user_club_id(); season uuid; target uuid;
  selected_count integer := coalesce(cardinality(_market_ids),0); valid_count integer;
begin
  if caller is null or club is null then raise exception 'Authentication and an active club are required'; end if;
  if selected_count > 1000 or _market_ids is null then raise exception 'Invalid prediction selection'; end if;
  select season_id into season from public.nfl_weeks where id=_week_id;
  if season is null then raise exception 'Week not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chain-season:' || club || ':' || season,0));
  -- Serialize against score/schedule changes as well as another tab saving picks.
  perform id from public.nfl_games where week_id=_week_id order by id for share;
  select id into target from public.nfl_chain_entries where club_id=club and week_id=_week_id and user_id=caller for update;
  if exists(select 1 from public.nfl_chain_legs l join public.nfl_chain_markets m on m.id=l.market_id
    where l.entry_id=target and not (l.market_id=any(_market_ids)) and not public.nfl_chain_game_unlocked(m.game_id))
    then raise exception 'Locked game selections cannot be removed or changed'; end if;
  select count(distinct m.id) into valid_count from public.nfl_chain_markets m join public.nfl_games g on g.id=m.game_id
  where m.id=any(_market_ids) and m.club_id=club and m.week_id=_week_id and m.season_id=season
    and g.week_id=_week_id and g.season_id=season and (
      exists(select 1 from public.nfl_chain_legs l where l.entry_id=target and l.market_id=m.id)
      or (public.nfl_chain_game_unlocked(g.id) and m.status='open' and
        (m.source_provider<>'espn-roster' or m.subject_external_id is null or
          (m.availability_status='verified' and m.availability_checked_at between now()-interval '24 hours' and now()+interval '1 minute'))));
  if valid_count<>selected_count then raise exception 'A prediction is duplicated, past its 30-minute deadline, or needs an availability recheck'; end if;
  if selected_count=0 then
    delete from public.nfl_chain_entries where id=target;
    perform public.rebuild_nfl_chain_standings(season,club);
    return jsonb_build_object('entry_id',null,'links_risked',0);
  end if;
  if target is null then
    insert into public.nfl_chain_entries(club_id,season_id,week_id,user_id,links_risked)
      values(club,season,_week_id,caller,selected_count) returning id into target;
  end if;
  delete from public.nfl_chain_legs where entry_id=target and not (market_id=any(_market_ids));
  update public.nfl_chain_legs set position=position+100000 where entry_id=target;
  insert into public.nfl_chain_legs(entry_id,market_id,position,display_text,market_type,subject_label,operator,threshold,status)
    select target,m.id,p.ordinality::integer,m.display_text,m.market_type,m.subject_label,m.operator,m.threshold,'pending'
    from unnest(_market_ids) with ordinality p(id,ordinality) join public.nfl_chain_markets m on m.id=p.id
    on conflict(entry_id,market_id) do update set position=excluded.position;
  perform public.refresh_nfl_chain_entry(target);
  perform public.rebuild_nfl_chain_standings(season,club);
  return jsonb_build_object('entry_id',target,'links_risked',selected_count);
end $$;
revoke all on function public.save_nfl_chain_card(uuid,uuid[]) from public,anon;
grant execute on function public.save_nfl_chain_card(uuid,uuid[]) to authenticated;

create or replace function public.save_nfl_chain_game(_game_id uuid,_market_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare game public.nfl_games%rowtype; other_ids uuid[]; club uuid := public.current_user_club_id();
begin
  if auth.uid() is null or club is null then raise exception 'Authentication required'; end if;
  select * into game from public.nfl_games where id=_game_id;
  if game.id is null then raise exception 'Game not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chain-season:' || club || ':' || game.season_id,0));
  perform id from public.nfl_games where id=_game_id for share;
  if not public.nfl_chain_game_unlocked(_game_id) then raise exception 'This game locked 30 minutes before kickoff'; end if;
  if _market_ids is null or exists(select 1 from unnest(_market_ids) x where not exists(
    select 1 from public.nfl_chain_markets m where m.id=x and m.game_id=_game_id and m.club_id=club))
    then raise exception 'Choose predictions from this game only'; end if;
  select coalesce(array_agg(l.market_id order by l.position),'{}'::uuid[]) into other_ids
    from public.nfl_chain_entries e join public.nfl_chain_legs l on l.entry_id=e.id
    join public.nfl_chain_markets m on m.id=l.market_id
    where e.club_id=club and e.user_id=auth.uid() and e.week_id=game.week_id and m.game_id<>_game_id;
  return public.save_nfl_chain_card(game.week_id,other_ids || _market_ids);
end $$;
revoke all on function public.save_nfl_chain_game(uuid,uuid[]) from public,anon;
grant execute on function public.save_nfl_chain_game(uuid,uuid[]) to authenticated;


create or replace function public.publish_nfl_chain_board(_week_id uuid,_club_id uuid,_markets jsonb,_availability jsonb,
  _checked_at timestamptz,_warnings jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare season uuid; eligible uuid[]; added integer; reviewed integer; existing integer; paused integer;
begin
  if coalesce(auth.role(),'')<>'service_role' and not coalesce(_club_id=public.current_user_club_id()
    and (public.is_app_admin(auth.uid()) or public.is_platform_owner(auth.uid())),false)
    then raise exception 'Club commissioner access required'; end if;
  if _club_id is null or _checked_at is null or _checked_at not between now()-interval '10 minutes' and now()+interval '1 minute'
    then raise exception 'Refresh the expired preview'; end if;
  if coalesce(jsonb_typeof(_markets),'null')<>'array' or coalesce(jsonb_typeof(_availability),'null')<>'array'
    or coalesce(jsonb_typeof(_warnings),'null')<>'array' then raise exception 'Invalid board payload'; end if;
  if jsonb_array_length(_markets)>1000 or jsonb_array_length(_availability)>1000 then raise exception 'Oversized board payload'; end if;
  select season_id into season from public.nfl_weeks where id=_week_id;
  if season is null then raise exception 'Week not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chain-season:' || _club_id || ':' || season,0));
  perform id from public.nfl_games where week_id=_week_id order by id for share;
  select coalesce(array_agg(id),'{}'::uuid[]) into eligible from public.nfl_games where week_id=_week_id and public.nfl_chain_game_unlocked(id);
  if exists(select 1 from jsonb_array_elements(_markets) m where not exists(select 1 from public.nfl_games g
    where g.id=(m->>'game_id')::uuid and g.id=any(eligible) and g.week_id=_week_id and g.season_id=season
      and (m->>'club_id')::uuid=_club_id and (m->>'week_id')::uuid=_week_id and (m->>'season_id')::uuid=season
      and m->>'source_provider'='espn-roster' and coalesce(m->>'external_id','')<>''
      and (m->>'subject_team_id' is null or (m->>'subject_team_id')::uuid in (g.home_team_id,g.away_team_id))))
    then raise exception 'A prediction is outside the remaining 30-minute slate'; end if;
  select count(*) into existing from public.nfl_chain_markets where club_id=_club_id and week_id=_week_id;
  insert into public.nfl_chain_markets(club_id,season_id,week_id,game_id,market_type,subject_label,subject_team_id,
    subject_external_id,operator,threshold,display_text,source_provider,external_id,availability_status,availability_checked_at)
    select _club_id,season,_week_id,(m->>'game_id')::uuid,m->>'market_type',m->>'subject_label',(m->>'subject_team_id')::uuid,
      m->>'subject_external_id',m->>'operator',(m->>'threshold')::numeric,m->>'display_text','espn-roster',m->>'external_id','verified',_checked_at
    from jsonb_array_elements(_markets) m where not exists(select 1 from public.nfl_chain_markets old
      where old.club_id=_club_id and old.week_id=_week_id and old.game_id=(m->>'game_id')::uuid
      and old.market_type=m->>'market_type' and old.operator=m->>'operator' and old.threshold=(m->>'threshold')::numeric
      and old.subject_external_id is not distinct from m->>'subject_external_id'
      and old.subject_team_id is not distinct from (m->>'subject_team_id')::uuid)
    on conflict(club_id,week_id,external_id) do nothing;
  get diagnostics added=row_count;
  update public.nfl_chain_markets m set availability_status=case when (a->>'verified')::boolean then 'verified' else 'review' end,
    availability_checked_at=_checked_at,availability_note=a->>'note' from jsonb_array_elements(_availability) a
    where m.id=(a->>'id')::uuid and m.club_id=_club_id and m.week_id=_week_id and m.source_provider='espn-roster'
      and m.subject_external_id is not null and m.status='open'
      and exists(select 1 from public.nfl_games g where g.id=m.game_id and g.status='scheduled' and g.kickoff_at>now())
      and coalesce(m.availability_checked_at,'-infinity'::timestamptz)<=_checked_at;
  get diagnostics reviewed=row_count;
  select count(*) into paused from public.nfl_chain_markets where club_id=_club_id and week_id=_week_id
    and status='open' and subject_external_id is not null and availability_status='review';
  insert into public.nfl_chain_boards(club_id,week_id,season_id,eligible_game_ids,lock_at,checked_at,warnings)
    values(_club_id,_week_id,season,eligible,coalesce((select min(crazy_chain_lock_at) from public.nfl_games where id=any(eligible)),now()),_checked_at,_warnings)
    on conflict(club_id,week_id) do update set eligible_game_ids=excluded.eligible_game_ids,checked_at=excluded.checked_at,warnings=excluded.warnings
    where coalesce(nfl_chain_boards.checked_at,'-infinity'::timestamptz)<=excluded.checked_at;
  return jsonb_build_object('inserted',added,'existing',existing,'reviewed',reviewed,'paused',paused,
    'lock_at',(select min(crazy_chain_lock_at) from public.nfl_games where id=any(eligible)),'locked',cardinality(eligible)=0);
end $$;
revoke all on function public.publish_nfl_chain_board(uuid,uuid,jsonb,jsonb,timestamptz,jsonb) from public,anon;
grant execute on function public.publish_nfl_chain_board(uuid,uuid,jsonb,jsonb,timestamptz,jsonb) to authenticated,service_role;


-- Refresh derived standings/privacy against the new Crazy Chain cutoff only.
do $$ declare r record; begin
  for r in select distinct season_id,club_id from public.nfl_chain_entries loop
    perform public.rebuild_nfl_chain_standings(r.season_id,r.club_id);
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
