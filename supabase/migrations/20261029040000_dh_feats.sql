-- DH Feats v1. Catalog seed is generated from src/lib/feats/catalog.json.
-- Saved source records determine progress. Clients cannot submit points.
begin;
create table if not exists public.dh_feat_catalog (
  key text primary key, category text not null, title text not null,
  description text not null, thresholds numeric[] not null, points integer[] not null,
  kind text not null check(kind in ('volume','mastery','variety')),
  unit text not null, sort_order integer not null,
  check(cardinality(thresholds) between 1 and 5),
  check(cardinality(thresholds)=cardinality(points))
);
-- BEGIN GENERATED CATALOG
insert into public.dh_feat_catalog select * from jsonb_populate_recordset(null::public.dh_feat_catalog, $catalog$[{"key":"active_days","category":"club","title":"Club Regular","description":"Complete a saved activity on distinct days across DH. Days use UTC; simply opening the app does not count.","thresholds":[1,7,30,100,365],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":0},{"key":"feature_explorer","category":"club","title":"All-Rounder","description":"Complete qualifying activities in different DH features.","thresholds":[2,3,5,8,12],"points":[10,20,40,80,150],"kind":"variety","unit":"count","sort_order":1},{"key":"drop_posts","category":"drop","title":"Make the Drop","description":"Publish contributions to The Drop.","thresholds":[1,5,20,75,250],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":2},{"key":"drop_days","category":"drop","title":"Daily Discovery","description":"Share a Drop on distinct days.","thresholds":[1,7,30,100,250],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":3},{"key":"drop_learned","category":"drop","title":"Today I Learned","description":"Share Learned contributions to The Drop.","thresholds":[1,5,20,50,150],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":4},{"key":"drop_articles","category":"drop","title":"Worth the Read","description":"Share Read contributions to The Drop.","thresholds":[1,5,20,50,150],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":5},{"key":"drop_photos","category":"drop","title":"Caught My Eye","description":"Share Saw contributions to The Drop.","thresholds":[1,5,20,50,150],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":6},{"key":"drop_comments","category":"drop","title":"Keep It Going","description":"Comment on different Drops by other members. Each Drop counts once.","thresholds":[1,10,40,120,400],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":7},{"key":"drop_appreciation","category":"drop","title":"Crowd Favorite","description":"Receive reactions on your Drops. Each member counts once per Drop; your own reactions do not count.","thresholds":[1,10,50,150,500],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":8},{"key":"drop_variety","category":"drop","title":"The Full Picture","description":"Share all three Drop types on the same day, on distinct days.","thresholds":[1,3,10,25,75],"points":[10,20,40,80,150],"kind":"variety","unit":"count","sort_order":9},{"key":"posts_created","category":"posts","title":"Start Something","description":"Publish club discussion posts.","thresholds":[1,5,20,75,200],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":10},{"key":"post_comments","category":"posts","title":"Conversation Starter","description":"Contribute a comment to different posts by other members. Each post counts once.","thresholds":[1,10,40,150,500],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":11},{"key":"post_days","category":"posts","title":"In the Conversation","description":"Publish a post or comment on distinct days.","thresholds":[1,7,30,100,250],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":12},{"key":"lore_entries","category":"lore","title":"Club Historian","description":"Publish entries in the club lore archive.","thresholds":[1,3,10,30,100],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":13},{"key":"lore_contributions","category":"lore","title":"Add to the Legend","description":"Contribute to different lore entries by other members.","thresholds":[1,5,15,50,150],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":14},{"key":"poll_votes","category":"polls","title":"Have Your Say","description":"Vote in different club polls. Changing a vote does not add progress.","thresholds":[1,10,30,100,250],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":15},{"key":"ranking_submissions","category":"rankings","title":"Set the Order","description":"Submit rankings in different club ranking boards.","thresholds":[1,5,20,60,150],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":16},{"key":"drafts_completed","category":"draft","title":"Iron Drafter","description":"Finish scored drafts with at least three scored participants.","thresholds":[1,5,15,40,100],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":17},{"key":"draft_wins","category":"draft","title":"Trophy Hunter","description":"Win completed drafts with at least three scored participants.","thresholds":[1,3,10,25,50],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":18},{"key":"draft_podiums","category":"draft","title":"Podium Regular","description":"Finish in the top three of completed drafts with at least four scored participants.","thresholds":[1,5,15,40,100],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":19},{"key":"draft_rated_picks","category":"draft","title":"Deep Bench","description":"Accumulate rated picks in qualifying completed drafts.","thresholds":[10,50,150,500,1500],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":20},{"key":"draft_perfect_boards","category":"draft","title":"Perfect Board","description":"Finish qualifying drafts with at least four rated picks, all rated eight or higher.","thresholds":[1,3,10,25,50],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":21},{"key":"nexus_waves","category":"nexus","title":"Hold the Line","description":"Bank cleared waves in current endless Nexus defenses.","thresholds":[10,100,500,2000,10000],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":22},{"key":"nexus_best","category":"nexus","title":"Last Line of Defense","description":"Reach these waves in one current endless defense.","thresholds":[5,10,15,25,40],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":23},{"key":"nexus_kills","category":"nexus","title":"Threat Neutralized","description":"Defeat enemies in saved current endless defenses.","thresholds":[100,1000,5000,20000,100000],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":24},{"key":"nexus_weapons","category":"nexus","title":"Armed to the Core","description":"Permanently unlock different auxiliary weapons.","thresholds":[1,2,3,4],"points":[10,20,40,80],"kind":"variety","unit":"count","sort_order":25},{"key":"nexus_builds","category":"nexus","title":"Field Tested","description":"Clear at least five waves with different saved weapon and support loadouts.","thresholds":[1,3,6,12,20],"points":[10,20,40,80,150],"kind":"variety","unit":"count","sort_order":26},{"key":"rune_clears","category":"rune","title":"Dungeon Regular","description":"Complete victorious Rune Delve runs, including saved repeat clears.","thresholds":[5,25,100,300,1000],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":27},{"key":"rune_enemies","category":"rune","title":"Monster Hunter","description":"Defeat enemies recorded in saved Rune Delve results.","thresholds":[50,250,1000,5000,20000],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":28},{"key":"rune_chain","category":"rune","title":"Chain Reaction","description":"Record a rune chain of this length in a saved result.","thresholds":[5,8,12,16,20],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":29},{"key":"rune_level","category":"rune","title":"Into the Depths","description":"Clear a Rune Delve campaign level of this number.","thresholds":[5,15,30,50,100],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":30},{"key":"forge_days","category":"forge","title":"Built Different","description":"Log positive workout activity on distinct workout dates. Completed nonempty freeform sessions count too.","thresholds":[1,10,30,100,250],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":31},{"key":"forge_reps","category":"forge","title":"Rep by Rep","description":"Accumulate repetitions from active rep logs and completed freeform sessions. Time and distance are excluded.","thresholds":[100,1000,5000,25000,100000],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":32},{"key":"forge_minutes","category":"forge","title":"Put in the Time","description":"Accumulate logged exercise minutes from timed activity and completed freeform sessions.","thresholds":[30,120,600,3000,10000],"points":[10,20,40,80,150],"kind":"volume","unit":"minutes","sort_order":33},{"key":"forge_miles","category":"forge","title":"Go the Distance","description":"Accumulate logged miles from distance activity and completed freeform cardio sessions.","thresholds":[1,10,50,250,1000],"points":[10,20,40,80,150],"kind":"volume","unit":"miles","sort_order":34},{"key":"forge_sessions","category":"forge","title":"Work Logged","description":"Complete freeform workout sessions containing positive exercise activity.","thresholds":[1,5,20,75,200],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":35},{"key":"forge_movements","category":"forge","title":"Move Every Way","description":"Log different named exercises with positive activity.","thresholds":[3,10,25,50,100],"points":[10,20,40,80,150],"kind":"variety","unit":"count","sort_order":36},{"key":"pw_equity","category":"portfolio","title":"Portfolio Milestones","description":"Reach a recorded portfolio value after trading and growing above the season starting cash. Uses game dollars.","thresholds":[75000,100000,150000,250000,500000],"points":[10,20,40,80,150],"kind":"mastery","unit":"money","sort_order":37},{"key":"pw_profit","category":"portfolio","title":"In the Green","description":"Grow a recorded portfolio above its own season starting cash by this many game dollars.","thresholds":[1000,5000,15000,50000,150000],"points":[10,20,40,80,150],"kind":"mastery","unit":"money","sort_order":38},{"key":"pw_day_gain","category":"portfolio","title":"Big Day","description":"Record this game-dollar gain within a trading day versus the previous market day closing snapshot. Missing market days do not count.","thresholds":[100,500,1000,5000,10000],"points":[10,20,40,80,150],"kind":"mastery","unit":"money","sort_order":39},{"key":"pw_return","category":"portfolio","title":"Growth Investor","description":"Reach a recorded percentage gain over season starting cash.","thresholds":[2,5,10,25,50],"points":[10,20,40,80,150],"kind":"mastery","unit":"percent","sort_order":40},{"key":"pw_green_days","category":"portfolio","title":"Green Days","description":"Finish positive market days versus the previous market day closing snapshot. These days need not be consecutive.","thresholds":[1,5,20,60,150],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":41},{"key":"pw_trade_days","category":"portfolio","title":"Market Regular","description":"Execute trades on distinct trading dates. Multiple orders on one date count once.","thresholds":[1,5,20,60,150],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":42},{"key":"pw_profitable_sales","category":"portfolio","title":"Profit Taken","description":"Complete sell trades with a positive recorded realized profit.","thresholds":[1,5,20,75,200],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":43},{"key":"pw_wins","category":"portfolio","title":"Closing Bell Champion","description":"Win completed Portfolio Wars seasons or weekly challenges with at least three entries.","thresholds":[1,3,10,25,50],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":44},{"key":"readshift_rounds","category":"readshift","title":"Read the Room","description":"Complete READSHIFT rounds.","thresholds":[5,25,100,300,1000],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":45},{"key":"readshift_reads","category":"readshift","title":"Mind Reader","description":"Make correct READSHIFT identifications.","thresholds":[10,50,200,1000,3000],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":46},{"key":"readshift_games","category":"readshift","title":"Shift Regular","description":"Finish READSHIFT games.","thresholds":[1,5,15,40,100],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":47},{"key":"readshift_wins","category":"readshift","title":"Unreadable","description":"Win completed READSHIFT games.","thresholds":[1,3,10,25,50],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":48},{"key":"nfl_correct","category":"nfl","title":"Good Call","description":"Make correct settled NFL picks.","thresholds":[10,50,150,500,1000],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":49},{"key":"nfl_chain","category":"nfl","title":"Chain Builder","description":"Reach a saved Crazy Chain length.","thresholds":[3,8,15,30,60],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":50},{"key":"nfl_perfect_games","category":"nfl","title":"Perfect Card","description":"Settle perfect Crazy Chain game cards.","thresholds":[1,3,10,25,50],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":51},{"key":"brackets_submitted","category":"brackets","title":"Bracketologist","description":"Submit brackets in different pools. Draft entries are excluded.","thresholds":[1,3,10,25,50],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":52},{"key":"brackets_correct","category":"brackets","title":"Called It","description":"Accumulate correct bracket picks from scored standings.","thresholds":[10,30,100,250,750],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":53},{"key":"locks_solved","category":"lockbox","title":"Codebreaker","description":"Solve different locks created by other members.","thresholds":[1,5,15,40,100],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":54},{"key":"locks_created","category":"lockbox","title":"Keep Out","description":"Set locks in different Lockbox weeks.","thresholds":[1,5,15,40,100],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":55},{"key":"events_created","category":"events","title":"Bring Us Together","description":"Create club events.","thresholds":[1,3,10,25,50],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":56},{"key":"events_going","category":"events","title":"Count Me In","description":"RSVP Going to different club events. This measures RSVPs, not verified attendance.","thresholds":[1,5,15,40,100],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":57},{"key":"narrative_days","category":"narrative","title":"Story Regular","description":"Post public character contributions in a campaign on distinct days.","thresholds":[1,7,30,100,250],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":58},{"key":"narrative_posts","category":"narrative","title":"In Character","description":"Post public character contributions to Narrative RPG campaigns.","thresholds":[1,10,50,200,1000],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":59},{"key":"journey_choices","category":"journey","title":"Choose Your Path","description":"Make saved choices in real Splendid Journey runs. Studio test runs are excluded.","thresholds":[1,10,50,200,1000],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":60},{"key":"journey_finishes","category":"journey","title":"Journey Complete","description":"Finish real Splendid Journey campaign runs with a saved ending.","thresholds":[1,3,10,25,50],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":61},{"key":"journey_endings","category":"journey","title":"Another Ending","description":"Discover different campaign and ending combinations in real runs.","thresholds":[1,3,5,10,20],"points":[10,20,40,80,150],"kind":"variety","unit":"count","sort_order":62}]$catalog$::jsonb)
on conflict(key) do update set category=excluded.category,title=excluded.title,description=excluded.description,thresholds=excluded.thresholds,points=excluded.points,kind=excluded.kind,unit=excluded.unit,sort_order=excluded.sort_order;
-- END GENERATED CATALOG
create table if not exists public.dh_feat_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  dirty boolean not null default true, evaluated_at timestamptz,
  seen_at timestamptz not null default now(), pinned text[] not null default '{}',
  check(cardinality(pinned)<=3)
);
create table if not exists public.dh_feat_progress (
  user_id uuid not null references public.dh_feat_accounts(user_id) on delete cascade,
  feat_key text not null references public.dh_feat_catalog(key),
  value numeric not null default 0 check(value>=0),
  primary key(user_id,feat_key)
);
create table if not exists public.dh_feat_unlocks (
  user_id uuid not null references public.dh_feat_accounts(user_id) on delete cascade,
  feat_key text not null references public.dh_feat_catalog(key),
  tier integer not null check(tier between 1 and 5),
  points integer not null check(points>0), target numeric not null check(target>0),
  earned_at timestamptz not null default now(), historical boolean not null default false,
  primary key(user_id,feat_key,tier)
);
create index if not exists dh_feat_unlocks_recent on public.dh_feat_unlocks(user_id,earned_at desc);

alter table public.dh_feat_catalog enable row level security;
alter table public.dh_feat_accounts enable row level security;
alter table public.dh_feat_progress enable row level security;
alter table public.dh_feat_unlocks enable row level security;
drop policy if exists "Read feat definitions" on public.dh_feat_catalog;
create policy "Read feat definitions" on public.dh_feat_catalog for select to authenticated using(true);
drop policy if exists "Read own feat account" on public.dh_feat_accounts;
create policy "Read own feat account" on public.dh_feat_accounts for select to authenticated using(user_id=auth.uid());
drop policy if exists "Read own feat progress" on public.dh_feat_progress;
create policy "Read own feat progress" on public.dh_feat_progress for select to authenticated using(user_id=auth.uid());
drop policy if exists "Read own feat unlocks" on public.dh_feat_unlocks;
create policy "Read own feat unlocks" on public.dh_feat_unlocks for select to authenticated using(user_id=auth.uid());
revoke all on public.dh_feat_accounts,public.dh_feat_progress,public.dh_feat_unlocks,public.dh_feat_catalog from anon,authenticated;
grant select on public.dh_feat_accounts,public.dh_feat_progress,public.dh_feat_unlocks,public.dh_feat_catalog to authenticated;

create or replace function public.dh_feat_number(v text) returns numeric
language sql immutable set search_path=public,pg_temp as $$
  select case when length(v)<=40 and v ~ '^-?[0-9]+([.][0-9]+)?$'
    then greatest(0,least(1000000000000,v::numeric)) else 0 end
$$;

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
  select jsonb_build_object('forge_days',(select count(*) from days),'forge_movements',(select count(*) from names where length(n)>0),
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
    select (updated_at at time zone 'UTC')::date from readshift_stats where user_id=uid and rounds_played>0 union
    select (created_at at time zone 'UTC')::date from nfl_picks where user_id=uid and is_correct is not null union
    select (submitted_at at time zone 'UTC')::date from brackets where user_id=uid and status='submitted' and submitted_at is not null union
    select (solved_at at time zone 'UTC')::date from lockbox_attempts where attacker_id=uid and is_solved union
    select (created_at at time zone 'UTC')::date from lockbox_locks where user_id=uid union
    select (created_at at time zone 'UTC')::date from events where created_by=uid union
    select (created_at at time zone 'UTC')::date from event_rsvps where user_id=uid and status='going' union
    select (created_at at time zone 'UTC')::date from narrative_messages where sender_id=uid and character_id is not null and message_type in ('player','character_action') and visibility='public' and length(trim(body))>0 union
    select (c.created_at at time zone 'UTC')::date from journey_run_choice_history c join journey_campaign_runs r on r.id=c.run_id where c.user_id=uid and r.user_id=uid and not r.is_test_run
  ) days where d is not null and d<=(now() at time zone 'UTC')::date;
  return m||piece;
end $$;

-- Capture valuation peaks even when a later quote falls before the board opens.
create or replace function public.dh_feat_capture_pw() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid; seed numeric; val numeric; prior numeric; prior_day date; day date; pid uuid; metrics jsonb;
begin
  if tg_table_name='pw_portfolios' then
    uid:=new.user_id; pid:=new.id; val:=new.total_value;
    if new.valued_at is null then return new; end if;
    select starting_cash into seed from pw_seasons where id=new.season_id;
  else
    pid:=new.portfolio_id; val:=new.value; day:=new.trading_date;
    select p.user_id,s.starting_cash into uid,seed from pw_portfolios p join pw_seasons s on s.id=p.season_id where p.id=pid;
  end if;
  if uid is null or seed<=0 or not exists(select 1 from pw_trades where portfolio_id=pid) then return new; end if;
  insert into dh_feat_accounts(user_id,dirty) values(uid,true) on conflict(user_id) do update set dirty=true;
  metrics:=jsonb_build_object('pw_equity',case when val>seed then val else 0 end,'pw_profit',greatest(0,val-seed),'pw_return',greatest(0,100*(val-seed)/seed));
  if day is not null then
    select value,trading_date into prior,prior_day from pw_daily_values where portfolio_id=pid and trading_date<day order by trading_date desc limit 1;
    if prior>0 and day=(select min(d::date) from generate_series(prior_day+interval '1 day',prior_day+interval '10 day',interval '1 day') d
      where extract(isodow from d)<6 and not exists(select 1 from pw_market_holidays h where h.holiday_date=d::date and not coalesce(h.early_close,false))) then
      metrics:=metrics||jsonb_build_object('pw_day_gain',greatest(0,val-prior));
    end if;
  end if;
  insert into dh_feat_progress(user_id,feat_key,value) select uid,key,dh_feat_number(value) from jsonb_each_text(metrics)
    on conflict(user_id,feat_key) do update set value=greatest(dh_feat_progress.value,excluded.value);
  return new;
end $$;

create or replace function public.dh_feat_dirty() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare oldj jsonb:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  newj jsonb:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  ids uuid[]; uid uuid; arg text:=tg_argv[0];
begin
  if arg='drop_reactions' then
    select array_agg(distinct user_id) into ids from daily_finds where id in ((oldj->>'find_id')::uuid,(newj->>'find_id')::uuid);
  elsif arg='draft' then
    select array_agg(distinct user_id) into ids from draft_results where draft_id in
      (case when tg_table_name='drafts' then (oldj->>'id')::uuid else (oldj->>'draft_id')::uuid end,
       case when tg_table_name='drafts' then (newj->>'id')::uuid else (newj->>'draft_id')::uuid end);
  elsif arg='season' then
    select array_agg(distinct user_id) into ids from pw_portfolios where season_id in ((oldj->>'id')::uuid,(newj->>'id')::uuid);
  elsif arg='challenge' then
    select array_agg(distinct user_id) into ids from pw_entries where challenge_id in ((oldj->>'id')::uuid,(newj->>'id')::uuid);
  elsif arg='entries' then
    select array_agg(distinct user_id) into ids from pw_entries where challenge_id in ((oldj->>'challenge_id')::uuid,(newj->>'challenge_id')::uuid);
  elsif arg='portfolio' then
    select array_agg(distinct user_id) into ids from pw_portfolios where id in ((oldj->>'portfolio_id')::uuid,(newj->>'portfolio_id')::uuid);
  else
    ids:=array[(oldj->>arg)::uuid,(newj->>arg)::uuid];
  end if;
  for uid in select distinct x from unnest(ids) x where x is not null order by x loop
    insert into dh_feat_accounts(user_id,dirty) select uid,true where exists(select 1 from profiles where id=uid)
      on conflict(user_id) do update set dirty=true where not dh_feat_accounts.dirty;
  end loop;
  return coalesce(new,old);
end $$;

-- Existing club-first indexes do not always cover account-wide aggregation.
-- Reuse a leading-owner index when present; add only the missing ones.
do $$ declare row record; begin
  for row in select * from (values
    ('daily_finds','user_id'),('daily_find_comments','user_id'),('posts','user_id'),('post_comments','user_id'),
    ('lore_entries','created_by'),('lore_contributions','user_id'),('poll_votes','user_id'),('ranking_submissions','user_id'),
    ('draft_results','user_id'),('nexus_core_runs','user_id'),('rune_delve_runs','user_id'),
    ('workout_activities','user_id'),('workout_log_entries','user_id'),('workout_log_sessions','user_id'),
    ('pw_portfolios','user_id'),('pw_trades','user_id'),('pw_entries','user_id'),('readshift_stats','user_id'),
    ('nfl_picks','user_id'),('nfl_chain_standings','user_id'),('brackets','user_id'),('standings','user_id'),
    ('lockbox_attempts','attacker_id'),('lockbox_locks','user_id'),('events','created_by'),('event_rsvps','user_id'),
    ('narrative_messages','sender_id'),('journey_run_choice_history','user_id'),('journey_campaign_runs','user_id')
  ) t(tbl,col) loop
    if not exists(select 1 from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=i.indkey[0]
      where i.indrelid=format('public.%I',row.tbl)::regclass and i.indisvalid and a.attname=row.col) then
      execute format('create index if not exists %I on public.%I(%I)','dh_feat_'||row.tbl||'_owner',row.tbl,row.col);
    end if;
  end loop;
end $$;

create or replace function public.dh_feat_new_member() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into dh_feat_accounts(user_id,evaluated_at) values(new.id,now()) on conflict do nothing;
  return new;
end $$;
drop trigger if exists dh_feat_new_member on public.profiles;
create trigger dh_feat_new_member after insert on public.profiles for each row execute function public.dh_feat_new_member();

-- Source writes only invalidate a small account row; they never run the full evaluator.
do $$ declare row record; begin
  for row in select * from (values
    ('daily_finds','user_id'),('daily_find_comments','user_id'),('daily_find_reactions','drop_reactions'),
    ('posts','user_id'),('post_comments','user_id'),('lore_entries','created_by'),('lore_contributions','user_id'),
    ('poll_votes','user_id'),('ranking_submissions','user_id'),('draft_results','draft'),('drafts','draft'),
    ('nexus_core_runs','user_id'),('nexus_core_profiles','user_id'),('rune_delve_runs','user_id'),
    ('workout_activities','user_id'),('workout_log_entries','user_id'),('workout_log_sessions','user_id'),
    ('pw_portfolios','user_id'),('pw_trades','user_id'),('pw_daily_values','portfolio'),('pw_seasons','season'),
    ('pw_entries','entries'),('pw_challenges','challenge'),('readshift_stats','user_id'),('nfl_picks','user_id'),('nfl_chain_standings','user_id'),
    ('brackets','user_id'),('standings','user_id'),('lockbox_attempts','attacker_id'),('lockbox_locks','user_id'),
    ('events','created_by'),('event_rsvps','user_id'),('narrative_messages','sender_id'),
    ('journey_run_choice_history','user_id'),('journey_campaign_runs','user_id')
  ) t(tbl,col) loop
    execute format('drop trigger if exists dh_feat_dirty on public.%I',row.tbl);
    execute format('create trigger dh_feat_dirty after insert or update or delete on public.%I for each row execute function public.dh_feat_dirty(%L)',row.tbl,row.col);
  end loop;
end $$;
drop trigger if exists dh_feat_capture_pw on public.pw_portfolios;
create trigger dh_feat_capture_pw after insert or update of total_value,valued_at on public.pw_portfolios for each row execute function public.dh_feat_capture_pw();
drop trigger if exists dh_feat_capture_pw on public.pw_daily_values;
create trigger dh_feat_capture_pw after insert or update of value on public.pw_daily_values for each row execute function public.dh_feat_capture_pw();

create or replace function public.dh_feats_refresh_user(uid uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare a dh_feat_accounts; metrics jsonb;
begin
  insert into dh_feat_accounts(user_id) values(uid) on conflict do nothing;
  select * into a from dh_feat_accounts where user_id=uid for update skip locked;
  if not found then return; end if;
  if not a.dirty then return; end if;
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

create or replace function public.dh_feats_summary(p_club_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); out jsonb;
begin
  if uid is null or not exists(select 1 from club_members where user_id=uid and club_id=p_club_id) then raise exception 'Club membership required'; end if;
  perform dh_feats_refresh_user(uid);
  select jsonb_build_object('score',coalesce(sum(points),0),'unlocked',count(*)) into out from dh_feat_unlocks where user_id=uid;
  return out;
end $$;

create or replace function public.dh_feats_board(p_club_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); member_id uuid; out jsonb; all_leaders jsonb; month_leaders jsonb; me jsonb; month_me jsonb;
begin
  if uid is null or not exists(select 1 from club_members where user_id=uid and club_id=p_club_id) then raise exception 'Club membership required'; end if;
  -- Consistent lock order also makes concurrent club board refreshes safe.
  for member_id in select distinct user_id from club_members where club_id=p_club_id order by user_id loop
    perform dh_feats_refresh_user(member_id);
  end loop;
  with totals as (select p.id user_id,p.display_name,p.avatar_url,coalesce(sum(u.points),0) score,count(u.feat_key) unlocked
    from club_members c join profiles p on p.id=c.user_id left join dh_feat_unlocks u on u.user_id=p.id where c.club_id=p_club_id group by p.id,p.display_name,p.avatar_url),
  ranked as (select *,rank() over(order by score desc) rank from totals)
  select coalesce(jsonb_agg(to_jsonb(r) order by rank,display_name,user_id) filter(where rank<=100),'[]'),
    (select to_jsonb(m) from ranked m where m.user_id=uid) into all_leaders,me from ranked r;
  with totals as (select p.id user_id,p.display_name,p.avatar_url,coalesce(sum(u.points),0) score,count(u.feat_key) unlocked
    from club_members c join profiles p on p.id=c.user_id left join dh_feat_unlocks u on u.user_id=p.id and not u.historical
      and u.earned_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'
    where c.club_id=p_club_id group by p.id,p.display_name,p.avatar_url),
  ranked as (select *,rank() over(order by score desc) rank from totals)
  select coalesce(jsonb_agg(to_jsonb(r) order by rank,display_name,user_id) filter(where rank<=100),'[]'),
    (select to_jsonb(m) from ranked m where m.user_id=uid) into month_leaders,month_me from ranked r;
  select jsonb_build_object('version',1,'as_of',now(),'seen_at',a.seen_at,'pinned',a.pinned,
    'score',coalesce((me->>'score')::bigint,0),'unlocked',coalesce((me->>'unlocked')::integer,0),
    'catalog',(select jsonb_agg(to_jsonb(c) order by sort_order) from dh_feat_catalog c),
    'progress',coalesce((select jsonb_object_agg(feat_key,value) from dh_feat_progress where user_id=uid),'{}'),
    'unlocks',coalesce((select jsonb_agg(to_jsonb(u)-'user_id' order by earned_at desc,feat_key,tier) from dh_feat_unlocks u where user_id=uid),'[]'),
    'leaders',all_leaders,'monthly_leaders',month_leaders,'me',me,'monthly_me',month_me,
    'members',(select count(*) from club_members where club_id=p_club_id)) into out from dh_feat_accounts a where user_id=uid;
  return out;
end $$;

create or replace function public.dh_feats_pin(p_keys text[]) returns text[]
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); keys text[];
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select coalesce(array_agg(key order by first),'{}') into keys from (select key,min(n) first from unnest(p_keys) with ordinality t(key,n) group by key) t;
  if cardinality(keys)>3 or exists(select 1 from unnest(keys) k where not exists(select 1 from dh_feat_catalog c where c.key=k)) then raise exception 'Choose up to three valid feats'; end if;
  insert into dh_feat_accounts(user_id,pinned) values(uid,keys) on conflict(user_id) do update set pinned=excluded.pinned;
  return keys;
end $$;
create or replace function public.dh_feats_seen(p_through timestamptz) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  update dh_feat_accounts set seen_at=greatest(seen_at,least(p_through,now())) where user_id=auth.uid();
end $$;

revoke all on function public.dh_feat_number(text),public.dh_feat_metrics(uuid),public.dh_feat_capture_pw(),public.dh_feat_dirty(),public.dh_feat_new_member(),public.dh_feats_refresh_user(uuid) from public,anon,authenticated;
revoke all on function public.dh_feats_summary(uuid),public.dh_feats_board(uuid),public.dh_feats_pin(text[]),public.dh_feats_seen(timestamptz) from public,anon;
grant execute on function public.dh_feats_summary(uuid),public.dh_feats_board(uuid),public.dh_feats_pin(text[]),public.dh_feats_seen(timestamptz) to authenticated;
insert into dh_feat_accounts(user_id) select id from profiles on conflict do nothing;
-- Re-evaluate after a catalog extension, without changing existing award receipts.
update dh_feat_accounts set dirty=true;
-- Credit the existing membership before new client activity starts. The initial
-- pass is historical; new profiles start with an evaluated empty account.
do $$ declare uid uuid; begin
  for uid in select user_id from dh_feat_accounts order by user_id loop
    perform dh_feats_refresh_user(uid);
  end loop;
end $$;
commit;
