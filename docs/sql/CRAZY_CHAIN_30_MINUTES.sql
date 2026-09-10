-- Crazy Chain ONLY: picks close 30 minutes before each kickoff.
-- Run after the per-game/live migrations. Weekly Pick'em and its tiebreaker
-- retain their exact existing 48-hour deadlines. Saved selections are preserved.
begin;

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
