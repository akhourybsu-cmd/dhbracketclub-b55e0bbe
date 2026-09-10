-- Crazy Chain: uncertain availability is advisory, not a selection veto.
-- Apply after the 30-minute/per-game migrations. Pick'em rules are unchanged.
begin;
alter table public.nfl_chain_markets add column if not exists void_reason text;
alter table public.nfl_chain_markets add column if not exists availability_evidence jsonb;
alter table public.nfl_chain_legs add column if not exists void_reason text;
alter table public.nfl_games add column if not exists crazy_chain_availability_checked_at timestamptz;

create or replace function public.get_nfl_chain_board(_week_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('mode','per_game_30m','lock_minutes',30,'pickem_lock_hours',48,'availability_mode','pick_then_void',
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
      or (public.nfl_chain_game_unlocked(g.id) and m.status='open'));
  if valid_count<>selected_count then raise exception 'A prediction is duplicated, past its 30-minute deadline, or is no longer open'; end if;
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
    subject_external_id,operator,threshold,display_text,source_provider,external_id,availability_status,availability_checked_at,availability_note)
    select _club_id,season,_week_id,(m->>'game_id')::uuid,m->>'market_type',m->>'subject_label',(m->>'subject_team_id')::uuid,
      m->>'subject_external_id',m->>'operator',(m->>'threshold')::numeric,m->>'display_text','espn-roster',m->>'external_id',case when coalesce(m->>'availability_note','')<>'' then 'review' else 'verified' end,_checked_at,m->>'availability_note'
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

-- Only a trusted server fetch can cancel for availability. Never expose this
-- RPC to members or accept browser-supplied injury evidence.
create or replace function public.apply_nfl_chain_availability(
  _game_id uuid,_event_id text,_kickoff_at timestamptz,_checks jsonb,_checked_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare game public.nfl_games%rowtype; club uuid; clubs uuid[]; target record;
  checked_year integer; check_now timestamptz; changed_ids uuid[] := '{}'; changed_legs integer := 0; n integer;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server availability checks only'; end if;
  if coalesce(jsonb_typeof(_checks),'null')<>'array' or jsonb_array_length(_checks)>250 then raise exception 'Invalid availability payload'; end if;
  select * into game from public.nfl_games where id=_game_id;
  if game.id is null then raise exception 'Game not found'; end if;
  -- Match save/scoring lock order. Frozen selection deadlines do NOT stop injury
  -- checks: a player can be ruled out during the last 30 minutes.
  select coalesce(array_agg(distinct club_id order by club_id),'{}'::uuid[]) into clubs
    from public.nfl_chain_markets where game_id=_game_id;
  foreach club in array clubs loop
    perform pg_advisory_xact_lock(hashtextextended('chain-season:' || club || ':' || game.season_id,0));
  end loop;
  select * into game from public.nfl_games where id=_game_id for share;
  check_now := clock_timestamp();
  if _checked_at is null or _checked_at not between check_now-interval '5 minutes' and check_now
    then raise exception 'Availability evidence is expired or future dated'; end if;
  if game.external_provider is distinct from 'espn' or game.external_id is distinct from _event_id
    or game.kickoff_at is distinct from _kickoff_at then raise exception 'Availability event or kickoff mismatch'; end if;
  if game.status<>'scheduled' or game.kickoff_at<=check_now or game.kickoff_at>check_now+interval '24 hours'
    then raise exception 'Availability cancellation must occur within 24 hours before kickoff'; end if;
  if game.crazy_chain_availability_checked_at>_checked_at then return jsonb_build_object('cancelled',0,'picks_cancelled',0,'stale',true); end if;
  select year into checked_year from public.nfl_seasons where id=game.season_id;
  if exists(select 1 from jsonb_array_elements(_checks) c where
      coalesce(c->>'player_id','')='' or coalesce(c->>'status','') not in ('out','inactive','injured_reserve','suspended','reserve')
      or c->>'reported_at' is null or (c->>'reported_at')::timestamptz>_checked_at
      or (c->>'reported_at')::timestamptz<make_date(checked_year,1,1)::timestamptz
      or (c->>'return_date' is not null and (c->>'return_date')::date<(_kickoff_at at time zone 'UTC')::date)
      or not exists(select 1 from public.nfl_teams t where t.id=(c->>'team_id')::uuid
        and t.id in (game.home_team_id,game.away_team_id) and t.external_provider='espn' and t.external_id=c->>'team_external_id'))
    then raise exception 'Unconfirmed or mismapped player availability'; end if;
  if exists(select 1 from jsonb_array_elements(_checks) c group by c->>'team_id',c->>'player_id' having count(*)>1)
    then raise exception 'Conflicting player availability records'; end if;

  for target in
    select m.id,c as evidence from public.nfl_chain_markets m join jsonb_array_elements(_checks) c
      on m.subject_external_id=c->>'player_id' and m.subject_team_id=(c->>'team_id')::uuid
    where m.game_id=_game_id and m.club_id=any(clubs) and m.season_id=game.season_id and m.week_id=game.week_id
      and m.source_provider='espn-roster' and m.status='open'
      and coalesce(m.result_checked_at,'-infinity'::timestamptz)<=_checked_at
    order by m.id for update of m
  loop
    update public.nfl_chain_markets set status='void',actual_value=null,result=null,settled_at=check_now,
      result_source='espn-eligibility',result_checked_at=_checked_at,availability_status='review',
      availability_checked_at=_checked_at,
      void_reason='Player ' || replace(target.evidence->>'status','_',' ') || ' before kickoff. Pick cancelled; no chain penalty.',
      availability_note='Confirmed unavailable before kickoff.',
      availability_evidence=target.evidence || jsonb_build_object('event_id',_event_id,'kickoff_at',_kickoff_at,'checked_at',_checked_at)
      where id=target.id;
    update public.nfl_chain_legs l set status='void',actual_value=null,settled_at=check_now,void_reason=m.void_reason
      from public.nfl_chain_markets m where m.id=target.id and l.market_id=m.id and l.status='pending';
    get diagnostics n=row_count; changed_legs:=changed_legs+n;
    changed_ids:=array_append(changed_ids,target.id);
  end loop;
  for target in select distinct entry_id from public.nfl_chain_legs where market_id=any(changed_ids) loop
    perform public.refresh_nfl_chain_entry(target.entry_id);
  end loop;
  foreach club in array clubs loop
    if exists(select 1 from public.nfl_chain_markets where id=any(changed_ids) and club_id=club) then
      perform public.rebuild_nfl_chain_standings(game.season_id,club);
    end if;
  end loop;
  update public.nfl_games set crazy_chain_availability_checked_at=_checked_at where id=_game_id;
  return jsonb_build_object('cancelled',cardinality(changed_ids),'picks_cancelled',changed_legs);
end $$;
revoke all on function public.apply_nfl_chain_availability(uuid,text,timestamptz,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_nfl_chain_availability(uuid,text,timestamptz,jsonb,timestamptz) to service_role;

-- An independent job means failed final-score imports cannot block pregame checks.
-- Reuse the existing protected request without exposing its secret in source.
do $$
declare request_sql text;
begin
  if to_regclass('cron.job') is not null then
    execute 'select command from cron.job where command like ''%/functions/v1/pickem-week-reminder%'' and active order by jobid limit 1' into request_sql;
    if request_sql is not null then
      perform cron.schedule('nfl-chain-availability','*/5 * * * *',
        replace(request_sql,'/functions/v1/pickem-week-reminder','/functions/v1/refresh-nfl-chain-availability'));
    else raise notice 'Configure protected refresh-nfl-chain-availability every five minutes.'; end if;
  else raise notice 'No cron extension found. Configure protected availability checks every five minutes.'; end if;
end $$;
notify pgrst,'reload schema';
commit;
