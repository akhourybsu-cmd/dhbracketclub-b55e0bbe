-- One authoritative ledger for Home, Profile, and both standings periods.
begin;
-- Active days use submitted activity, never passive statistics updates.
create or replace function public.dh_feat_metrics(uid uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare m jsonb:='{}'; piece jsonb; features integer;
begin
  select jsonb_build_object('drop_posts',count(*),'drop_days',count(distinct (created_at at time zone 'UTC')::date),
    'drop_learned',count(*) filter(where kind='learned'),'drop_articles',count(*) filter(where kind='article'),
    'drop_photos',count(*) filter(where kind='photo')) into piece from daily_finds where user_id=uid;
  m:=m||piece;
  select jsonb_build_object('drop_variety',count(*)) into piece from
    (select (created_at at time zone 'UTC')::date from daily_finds where user_id=uid group by 1 having count(distinct kind)=3) t;
  m:=m||piece;
  select jsonb_build_object('drop_comments',count(distinct c.find_id)) into piece
    from daily_find_comments c join daily_finds f on f.id=c.find_id where c.user_id=uid and f.user_id<>uid and length(trim(c.body))>0;
  m:=m||piece;
  select jsonb_build_object('drop_appreciation',count(distinct (r.find_id,r.user_id))) into piece
    from daily_find_reactions r join daily_finds f on f.id=r.find_id where f.user_id=uid and r.user_id<>uid;
  m:=m||piece;
  select jsonb_build_object('posts_created',count(*)) into piece from posts where user_id=uid and length(trim(content))>0;
  m:=m||piece;
  select jsonb_build_object('post_comments',count(distinct c.post_id)) into piece from post_comments c join posts p on p.id=c.post_id
    where c.user_id=uid and p.user_id<>uid and length(trim(c.content))>0;
  m:=m||piece;
  select jsonb_build_object('post_days',count(distinct d)) into piece from
    (select (created_at at time zone 'UTC')::date d from posts where user_id=uid and length(trim(content))>0 union
     select (created_at at time zone 'UTC')::date from post_comments where user_id=uid and length(trim(content))>0) t;
  m:=m||piece;
  select jsonb_build_object('lore_entries',count(*)) into piece from lore_entries where created_by=uid;
  m:=m||piece;
  select jsonb_build_object('lore_contributions',count(distinct c.lore_id)) into piece from lore_contributions c join lore_entries l on l.id=c.lore_id
    where c.user_id=uid and l.created_by<>uid and length(trim(c.content))>0;
  m:=m||piece;
  select jsonb_build_object('poll_votes',count(distinct poll_id)) into piece from poll_votes where user_id=uid;
  m:=m||piece;
  select jsonb_build_object('ranking_submissions',count(distinct ranking_id)) into piece from ranking_submissions where user_id=uid and submitted_at is not null;
  m:=m||piece;
  with qualified as (
    select r.*,(select count(*) from draft_results other where other.draft_id=r.draft_id) players,
      case when jsonb_typeof(r.pick_ratings)='array' then r.pick_ratings else '[]'::jsonb end ratings
    from draft_results r join drafts d on d.id=r.draft_id where r.user_id=uid and d.status='completed'
  ) select jsonb_build_object('drafts_completed',count(*),'draft_wins',count(*) filter(where rank=1),
      'draft_podiums',count(*) filter(where rank<=3 and players>=4),
      'draft_rated_picks',coalesce(sum(jsonb_array_length(ratings)),0),
      'draft_perfect_boards',count(*) filter(where jsonb_array_length(ratings)>=4 and not exists
        (select 1 from jsonb_array_elements(ratings) x where dh_feat_number(x->>'score')<8)))
    into piece from qualified where players>=3;
  m:=m||piece;
  select jsonb_build_object('nexus_waves',coalesce(sum(waves),0),'nexus_best',coalesce(max(waves),0),
    'nexus_kills',coalesce(sum(kills),0),'nexus_builds',count(distinct jsonb_build_object(
      'weapons',coalesce((select jsonb_agg(w order by w) from jsonb_array_elements_text(coalesce(loadout->'weapons','[]')) w),'[]'),
      'module',loadout->'module')) filter(where waves>=5)) into piece
    from nexus_core_runs where user_id=uid and mode='endless' and balance_version>=4;
  m:=m||piece;
  select jsonb_build_object('nexus_weapons',coalesce(max((select count(distinct x) from unnest(unlocks) x where x in ('orbit','arc','rail','mortar'))),0))
    into piece from nexus_core_profiles where user_id=uid;
  m:=m||piece;
  select jsonb_build_object('rune_clears',coalesce(sum(greatest(coalesce(clears,0),case when dungeon_cleared then 1 else 0 end)),0),
    'rune_enemies',coalesce(sum(enemies_defeated),0),'rune_chain',coalesce(max(longest_chain),0),
    'rune_level',coalesce(max(level_number) filter(where dungeon_cleared or clears>0),0)) into piece from rune_delve_runs where user_id=uid;
  m:=m||piece;
  with a as (select a.*,e.name from workout_activities a join workout_exercises e on e.id=a.exercise_id where a.user_id=uid and a.status='active' and a.raw_value>0),
  entry as (
    select e.*,s.activity_local_date,
      coalesce((select sum(dh_feat_number(x->>'reps')) from jsonb_array_elements(case when jsonb_typeof(e.sets)='array' then e.sets else '[]'::jsonb end) x),0) set_reps
    from workout_log_entries e join workout_log_sessions s on s.id=e.session_id where e.user_id=uid and s.status='completed'
  ), e as (select * from entry where reps>0 or seconds>0 or distance_mi>0 or set_reps>0 or log_kind='completion'),
  days as (select activity_local_date d from a union select activity_local_date from e),
  names as (select lower(trim(name)) n from a union select lower(trim(exercise_name)) from e)
  select jsonb_build_object('forge_days',(select count(*) from days where d is not null),'forge_movements',(select count(*) from names where length(n)>0),
    'forge_sessions',(select count(distinct session_id) from e),
    'forge_reps',coalesce((select sum(raw_value) from a where measurement_type in ('reps','sets_reps')),0)+coalesce((select sum(case when log_kind='weight_reps' then set_reps when log_kind='reps' then greatest(0,reps) else 0 end) from e),0),
    'forge_minutes',(coalesce((select sum(raw_value) from a where measurement_type in ('timed_hold','duration','countdown')),0)+coalesce((select sum(greatest(0,seconds)) from e),0))/60,
    'forge_miles',coalesce((select sum(raw_value) from a where measurement_type='distance'),0)+coalesce((select sum(greatest(0,distance_mi)) from e),0)) into piece;
  m:=m||piece;
  with p as (select p.*,s.starting_cash from pw_portfolios p join pw_seasons s on s.id=p.season_id where p.user_id=uid and s.starting_cash>0
    and exists(select 1 from pw_trades t where t.portfolio_id=p.id)),
  valuations as (select id portfolio_id,total_value value,starting_cash from p where valued_at is not null union all
    select v.portfolio_id,v.value,p.starting_cash from pw_daily_values v join p on p.id=v.portfolio_id),
  daily as (select v.*,lag(value) over(partition by portfolio_id order by trading_date) prev,
    lag(trading_date) over(partition by portfolio_id order by trading_date) prev_day from pw_daily_values v join p on p.id=v.portfolio_id),
  consecutive as (select d.* from daily d where prev>0 and trading_date=(
    select min(day::date) from generate_series(d.prev_day+interval '1 day',d.prev_day+interval '10 day',interval '1 day') day
    where extract(isodow from day)<6 and not exists(select 1 from pw_market_holidays h where h.holiday_date=day::date and not coalesce(h.early_close,false))))
  select jsonb_build_object('pw_equity',coalesce((select max(value) from valuations where value>starting_cash),0),
    'pw_profit',greatest(0,coalesce((select max(value-starting_cash) from valuations),0)),
    'pw_return',greatest(0,coalesce((select max(100*(value-starting_cash)/starting_cash) from valuations),0)),
    'pw_day_gain',greatest(0,coalesce((select max(value-prev) from consecutive),0)),
    'pw_green_days',(select count(distinct trading_date) from consecutive where value>prev and trading_date<(now() at time zone 'America/New_York')::date)) into piece;
  m:=m||piece;
  select jsonb_build_object('pw_trade_days',count(distinct trading_date),'pw_profitable_sales',count(*) filter(where side='sell' and realized_pl>0)) into piece from pw_trades where user_id=uid;
  m:=m||piece;
  select jsonb_build_object('pw_wins',
    (select count(*) from pw_portfolios p join pw_seasons s on s.id=p.season_id where p.user_id=uid and p.final_rank=1 and s.status='completed'
      and (select count(*) from pw_portfolios allp where allp.season_id=p.season_id)>=3)+
    (select count(*) from pw_entries e join pw_challenges c on c.id=e.challenge_id where e.user_id=uid and e.final_rank=1 and c.status='completed'
      and (select count(*) from pw_entries alle where alle.challenge_id=e.challenge_id and alle.submitted_at is not null)>=3)) into piece;
  m:=m||piece;
  select jsonb_build_object('readshift_rounds',coalesce(sum(rounds_played),0),'readshift_reads',coalesce(sum(correct_reads),0),
    'readshift_games',coalesce(sum(games_played),0),'readshift_wins',coalesce(sum(games_won),0)) into piece from readshift_stats where user_id=uid;
  m:=m||piece;
  select jsonb_build_object('nfl_correct',count(*) filter(where is_correct)) into piece from nfl_picks where user_id=uid;
  m:=m||piece;
  select jsonb_build_object('nfl_chain',coalesce(max(best_chain),0),'nfl_perfect_games',coalesce(sum(perfect_games),0)) into piece from nfl_chain_standings where user_id=uid;
  m:=m||piece;
  select jsonb_build_object('brackets_submitted',count(distinct pool_id)) into piece from brackets where user_id=uid and status='submitted' and submitted_at is not null;
  m:=m||piece;
  select jsonb_build_object('brackets_correct',coalesce(sum(correct_picks),0)) into piece from standings where user_id=uid;
  m:=m||piece;
  select jsonb_build_object('locks_solved',count(distinct a.lock_id)) into piece from lockbox_attempts a join lockbox_locks l on l.id=a.lock_id where a.attacker_id=uid and a.is_solved and l.user_id<>uid;
  m:=m||piece;
  select jsonb_build_object('locks_created',count(distinct week_id)) into piece from lockbox_locks where user_id=uid;
  m:=m||piece;
  select jsonb_build_object('events_created',count(*)) into piece from events where created_by=uid;
  m:=m||piece;
  select jsonb_build_object('events_going',count(distinct event_id)) into piece from event_rsvps where user_id=uid and status='going';
  m:=m||piece;
  select jsonb_build_object('narrative_days',count(distinct (created_at at time zone 'UTC')::date),'narrative_posts',count(*)) into piece
    from narrative_messages where sender_id=uid and character_id is not null and message_type in ('player','character_action') and visibility='public' and length(trim(body))>0;
  m:=m||piece;
  select jsonb_build_object('journey_choices',count(*)) into piece from journey_run_choice_history c join journey_campaign_runs r on r.id=c.run_id
    where c.user_id=uid and r.user_id=uid and not r.is_test_run;
  m:=m||piece;
  select jsonb_build_object('journey_finishes',count(*),'journey_endings',count(distinct(campaign_id,ending_key))) into piece
    from journey_campaign_runs where user_id=uid and not is_test_run and status='completed' and ending_key is not null;
  m:=m||piece;
  select count(*) into features from (values
    (greatest(dh_feat_number(m->>'drop_posts'),dh_feat_number(m->>'drop_comments'))),
    (greatest(dh_feat_number(m->>'posts_created'),dh_feat_number(m->>'post_comments'))),
    (greatest(dh_feat_number(m->>'lore_entries'),dh_feat_number(m->>'lore_contributions'))),
    (dh_feat_number(m->>'poll_votes')),(dh_feat_number(m->>'ranking_submissions')),
    (dh_feat_number(m->>'drafts_completed')),(dh_feat_number(m->>'nexus_waves')),(dh_feat_number(m->>'rune_clears')),
    (dh_feat_number(m->>'forge_days')),(dh_feat_number(m->>'pw_trade_days')),(dh_feat_number(m->>'readshift_rounds')),
    (dh_feat_number(m->>'nfl_correct')),(dh_feat_number(m->>'brackets_submitted')),
    (greatest(dh_feat_number(m->>'locks_solved'),dh_feat_number(m->>'locks_created'))),
    (greatest(dh_feat_number(m->>'events_created'),dh_feat_number(m->>'events_going'))),
    (dh_feat_number(m->>'narrative_posts')),(dh_feat_number(m->>'journey_choices'))
  ) f(n) where n>0;
  select jsonb_build_object('active_days',count(distinct d),'feature_explorer',features) into piece from (
    select (created_at at time zone 'UTC')::date d from daily_finds where user_id=uid union
    select (created_at at time zone 'UTC')::date from daily_find_comments where user_id=uid and length(trim(body))>0 union
    select (created_at at time zone 'UTC')::date from posts where user_id=uid and length(trim(content))>0 union
    select (created_at at time zone 'UTC')::date from post_comments where user_id=uid and length(trim(content))>0 union
    select (created_at at time zone 'UTC')::date from lore_entries where created_by=uid union
    select (created_at at time zone 'UTC')::date from lore_contributions where user_id=uid and length(trim(content))>0 union
    select (created_at at time zone 'UTC')::date from poll_votes where user_id=uid union
    select (submitted_at at time zone 'UTC')::date from ranking_submissions where user_id=uid and submitted_at is not null union
    select (r.created_at at time zone 'UTC')::date from draft_results r join drafts dr on dr.id=r.draft_id where r.user_id=uid and dr.status='completed' and (select count(*) from draft_results o where o.draft_id=r.draft_id)>=3 union
    select (created_at at time zone 'UTC')::date from nexus_core_runs where user_id=uid and waves>0 and mode='endless' and balance_version>=4 union
    select (coalesce(last_played_at,completed_at,created_at) at time zone 'UTC')::date from rune_delve_runs where user_id=uid and (clears>0 or dungeon_cleared) union
    select activity_local_date from workout_activities where user_id=uid and status='active' and raw_value>0 union
    select s.activity_local_date from workout_log_sessions s where s.user_id=uid and s.status='completed' and exists(select 1 from workout_log_entries e where e.session_id=s.id and (e.reps>0 or e.seconds>0 or e.distance_mi>0 or e.log_kind='completion' or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(e.sets)='array' then e.sets else '[]'::jsonb end) x where dh_feat_number(x->>'reps')>0))) union
    select trading_date from pw_trades where user_id=uid union
    select (created_at at time zone 'UTC')::date from readshift_answers where user_id=uid and locked and length(trim(body))>0 union
    select (created_at at time zone 'UTC')::date from readshift_guesses where reader_user_id=uid and guessed_user_id is not null union
    select (created_at at time zone 'UTC')::date from nfl_picks where user_id=uid and is_correct is not null union
    select (submitted_at at time zone 'UTC')::date from brackets where user_id=uid and status='submitted' and submitted_at is not null union
    select (a.solved_at at time zone 'UTC')::date from lockbox_attempts a join lockbox_locks l on l.id=a.lock_id where a.attacker_id=uid and a.is_solved and l.user_id<>uid union
    select (created_at at time zone 'UTC')::date from lockbox_locks where user_id=uid union
    select (created_at at time zone 'UTC')::date from events where created_by=uid union
    select (created_at at time zone 'UTC')::date from event_rsvps where user_id=uid and status='going' union
    select (created_at at time zone 'UTC')::date from narrative_messages where sender_id=uid and character_id is not null and message_type in ('player','character_action') and visibility='public' and length(trim(body))>0 union
    select (c.created_at at time zone 'UTC')::date from journey_run_choice_history c join journey_campaign_runs r on r.id=c.run_id where c.user_id=uid and r.user_id=uid and not r.is_test_run
  ) days where d is not null and d<=(now() at time zone 'UTC')::date;
  return m||piece;
end $$;

do $$ declare row record; begin
  for row in select * from (values ('readshift_answers','user_id'),('readshift_guesses','reader_user_id')) t(tbl,col) loop
    execute format('drop trigger if exists dh_feat_dirty on public.%I',row.tbl);
    execute format('create trigger dh_feat_dirty after insert or update or delete on public.%I for each row execute function public.dh_feat_dirty(%L)',row.tbl,row.col);
  end loop;
end $$;
create or replace function public.dh_feats_refresh_user(uid uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare a dh_feat_accounts; metrics jsonb;
begin
  insert into dh_feat_accounts(user_id) values(uid) on conflict do nothing;
  select * into a from dh_feat_accounts where user_id=uid for update skip locked;
  if not found then return; end if;
  -- Reconcile unmarked source changes as well as trigger-invalidated activity.
  if not a.dirty and a.evaluated_at > now()-interval '5 minutes' then return; end if;
  metrics:=dh_feat_metrics(uid);
  insert into dh_feat_progress(user_id,feat_key,value)
    select uid,c.key,dh_feat_number(metrics->>c.key) from dh_feat_catalog c
    on conflict(user_id,feat_key) do update set value=greatest(dh_feat_progress.value,excluded.value);
  insert into dh_feat_unlocks(user_id,feat_key,tier,points,target,historical)
    select uid,c.key,t.ordinality,c.points[t.ordinality],t.target,a.evaluated_at is null
    from dh_feat_catalog c join dh_feat_progress p on p.user_id=uid and p.feat_key=c.key
    cross join lateral unnest(c.thresholds) with ordinality t(target,ordinality)
    where p.value>=t.target on conflict do nothing;
  update dh_feat_accounts set dirty=false,evaluated_at=now() where user_id=uid;
end $$;

create or replace function public.dh_feats_refresh_club(cid uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare member_id uuid;
begin
  for member_id in select distinct user_id from club_members where club_id=cid and dh_public_member(user_id) order by user_id loop
    perform dh_feats_refresh_user(member_id);
  end loop;
end $$;
revoke all on function public.dh_feats_refresh_club(uuid) from public,anon,authenticated;
create or replace function public.dh_feats_board(p_club_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); out jsonb; all_leaders jsonb; month_leaders jsonb; me jsonb; month_me jsonb;
begin
  if uid is null or not exists(select 1 from club_members where user_id=uid and club_id=p_club_id) then raise exception 'Club membership required'; end if;
  perform dh_feats_refresh_club(p_club_id);
  perform dh_feats_refresh_user(uid);
  with totals as (select p.id user_id,p.display_name,p.avatar_url,coalesce(sum(u.points),0) score,count(u.feat_key) unlocked
    from (select distinct user_id from club_members where club_id=p_club_id and dh_public_member(user_id)) c join profiles p on p.id=c.user_id left join dh_feat_unlocks u on u.user_id=p.id group by p.id,p.display_name,p.avatar_url),
  ranked as (select *,rank() over(order by score desc) rank from totals)
  select coalesce(jsonb_agg(to_jsonb(r) order by rank,display_name,user_id) filter(where rank<=100),'[]'),
    (select to_jsonb(m) from ranked m where m.user_id=uid) into all_leaders,me from ranked r;
  with totals as (select p.id user_id,p.display_name,p.avatar_url,coalesce(sum(u.points),0) score,count(u.feat_key) unlocked
    from (select distinct user_id from club_members where club_id=p_club_id and dh_public_member(user_id)) c join profiles p on p.id=c.user_id left join dh_feat_unlocks u on u.user_id=p.id and not u.historical
      and u.earned_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'
    group by p.id,p.display_name,p.avatar_url),
  ranked as (select *,rank() over(order by score desc) rank from totals)
  select coalesce(jsonb_agg(to_jsonb(r) order by rank,display_name,user_id) filter(where rank<=100),'[]'),
    (select to_jsonb(m) from ranked m where m.user_id=uid) into month_leaders,month_me from ranked r;
  select jsonb_build_object('version',1,'as_of',now(),'seen_at',a.seen_at,'pinned',a.pinned,
    'score',(select coalesce(sum(points),0) from dh_feat_unlocks where user_id=uid),'unlocked',(select count(*) from dh_feat_unlocks where user_id=uid),
    'catalog',(select jsonb_agg(to_jsonb(c) order by sort_order) from dh_feat_catalog c),
    'progress',coalesce((select jsonb_object_agg(feat_key,value) from dh_feat_progress where user_id=uid),'{}'),
    'unlocks',coalesce((select jsonb_agg(to_jsonb(u)-'user_id' order by earned_at desc,feat_key,tier) from dh_feat_unlocks u where user_id=uid),'[]'),
    'leaders',all_leaders,'monthly_leaders',month_leaders,'me',me,'monthly_me',month_me,
    'members',(select count(distinct user_id) from club_members where club_id=p_club_id and dh_public_member(user_id))) into out from dh_feat_accounts a where user_id=uid;
  return out;
end $$;

create or replace function public.dh_home_progress(p_club_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); total bigint; earned integer; position bigint; goals jsonb; pins text[];
begin
  if uid is null or not exists(select 1 from club_members where club_id=p_club_id and user_id=uid) then
    raise exception 'Club membership required';
  end if;
  perform dh_feats_refresh_club(p_club_id);
  perform dh_feats_refresh_user(uid);
  select coalesce(sum(points),0),count(*) into total,earned from dh_feat_unlocks where user_id=uid;
  select pinned into pins from dh_feat_accounts where user_id=uid;
  select 1+count(*) into position from (
    select c.user_id,coalesce(sum(u.points),0) score from (select distinct user_id from club_members where club_id=p_club_id and dh_public_member(user_id)) c
    left join dh_feat_unlocks u on u.user_id=c.user_id group by c.user_id
  ) standing where score>total;
  if not dh_public_member(uid) then position:=null; end if;
  with candidates as (
    select c.key,c.title,c.category,c.unit,coalesce(p.value,0) value,t.target,t.tier::integer,
      c.points[t.tier] points,c.sort_order,array_position(pins,c.key) pin,
      greatest(0,least(1,(coalesce(p.value,0)-coalesce(c.thresholds[t.tier-1],0))/
        (t.target-coalesce(c.thresholds[t.tier-1],0)))) progress
    from dh_feat_catalog c left join dh_feat_progress p on p.feat_key=c.key and p.user_id=uid
    cross join lateral (
      select threshold target,ordinality tier from unnest(c.thresholds) with ordinality s(threshold,ordinality)
      where not exists(select 1 from dh_feat_unlocks u where u.user_id=uid and u.feat_key=c.key and u.tier=s.ordinality)
      order by ordinality limit 1
    ) t
  ), chosen as (
    select *,pin is not null tracked from candidates order by pin nulls last,progress desc,sort_order limit 8
  ) select coalesce(jsonb_agg(to_jsonb(g)-'pin'-'sort_order' order by pin nulls last,progress desc,sort_order),'[]') into goals from chosen g;
  return jsonb_build_object('score',total,'unlocked',earned,'club_rank',position,'goals',goals);
end $$;
-- Preserve earned history; recompute source high-water marks and missing tiers.
update dh_feat_accounts set dirty=true;
do $$ declare member_id uuid; begin
  for member_id in select id from profiles where dh_public_member(id) order by id loop
    perform dh_feats_refresh_user(member_id);
  end loop;
end $$;
commit;
