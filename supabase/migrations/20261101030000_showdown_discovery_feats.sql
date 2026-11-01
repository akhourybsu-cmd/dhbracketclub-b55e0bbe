-- Add Showdown to the existing feature library and permanent DH Feats ledger.
-- Normalized Showdown standings award 3 for a win / 1 for a draw; raw scores
-- remain game specific. Those standings points are not direct DH Score awards.
begin;

insert into public.platform_assets(name,slug,category,short_description,full_description,icon_name,placement_area,
  requires_configuration,is_premium,default_configuration_json,sort_order)
values('DH Showdown','dh-showdown','games','Three puzzles. One club rivalry. Play on your time.',
  'Challenge a club member to asynchronous head-to-head mini-games. Both players receive the same frozen puzzles and can play at different times. Prism Break opens with three certified light-routing boards, authoritative rotation scoring, saved progress, results, rivalry records and rematches. Overall Showdown standings use 3 points per win and 1 per draw, never incomparable raw game scores.',
  'Swords','games',false,false,'{}'::jsonb,45)
on conflict(slug) do update set name=excluded.name,category=excluded.category,short_description=excluded.short_description,
  full_description=excluded.full_description,icon_name=excluded.icon_name,placement_area=excluded.placement_area,updated_at=now();

-- Follow the club's existing game-discovery opt-in; do not change an existing
-- installation's enabled state, visibility, order or configuration. New clubs
-- retain the application's existing blank-library setup policy.
insert into public.club_installed_assets(club_id,asset_id,enabled,visible_to_members,configuration_json)
select distinct draft.club_id,showdown.id,true,true,'{}'::jsonb
from public.club_installed_assets draft
join public.platform_assets arena on arena.id=draft.asset_id and arena.slug='draft-arena' and arena.is_active
cross join public.platform_assets showdown
where showdown.slug='dh-showdown' and showdown.is_active and draft.enabled and draft.visible_to_members
  and public.dh_visible_club(draft.club_id)
on conflict(club_id,asset_id) do nothing;

insert into public.dh_feat_catalog
select * from jsonb_populate_recordset(null::public.dh_feat_catalog,$showdown_catalog$[{"key":"showdown_matches","category":"showdown","title":"Answer the Bell","description":"Finish Showdown matches with at least one solved round of your own. Both players must finish; all-skip attempts do not count.","thresholds":[1,5,20,75,200],"points":[5,10,15,25,40],"kind":"volume","unit":"count","sort_order":70},{"key":"showdown_wins","category":"showdown","title":"Rival Conqueror","description":"Win completed Showdown matches after solving at least one round yourself. Cancelled, declined and expired invitations are excluded.","thresholds":[1,3,10,30,75],"points":[5,10,20,30,50],"kind":"mastery","unit":"count","sort_order":71},{"key":"showdown_prism_solved","category":"showdown","title":"Light the Way","description":"Activate every receiver in Prism Break rounds from completed matches. Skips and rounds still waiting for an opponent do not count.","thresholds":[3,15,60,180,450],"points":[5,10,15,25,40],"kind":"volume","unit":"count","sort_order":72},{"key":"showdown_prism_optimal","category":"showdown","title":"Crystal Precision","description":"Solve Prism Break rounds in the verified minimum rotations. Only completed matches count; resets never refund used rotations.","thresholds":[1,5,20,60,150],"points":[5,10,20,30,50],"kind":"mastery","unit":"count","sort_order":73},{"key":"showdown_prism_best","category":"showdown","title":"Prismatic Peak","description":"Reach these three-round Prism Break totals in a completed match. This is your best single match, never a sum across games.","thresholds":[1000,1200,1350,1450,1500],"points":[5,10,15,25,40],"kind":"mastery","unit":"count","sort_order":74},{"key":"showdown_rivals","category":"showdown","title":"Club Circuit","description":"Finish Showdown matches against different club rivals, solving at least one round yourself. Repeat matches against one rival count once.","thresholds":[1,2,3,5,10],"points":[5,10,15,20,30],"kind":"variety","unit":"count","sort_order":75}]$showdown_catalog$::jsonb)
on conflict(key) do update set category=excluded.category,title=excluded.title,description=excluded.description,
  thresholds=excluded.thresholds,points=excluded.points,kind=excluded.kind,unit=excluded.unit,sort_order=excluded.sort_order;

-- Extend the current evaluator, never replace it with an older copy. These
-- guards deliberately fail if an upstream metrics contract needs review.
do $patch$
declare
  definition text;
  metrics_anchor text:='  select count(*) into features from (values';
  days_anchor text:='select (created_at at time zone ''UTC'')::date d from daily_finds where user_id=uid union';
begin
  definition:=pg_get_functiondef('public.dh_feat_metrics(uuid)'::regprocedure);
  if position('showdown_matches' in definition)=0 then
    if position(metrics_anchor in definition)=0 or position(days_anchor in definition)=0
      or to_regprocedure('public.showdown_member_metrics(uuid,uuid)') is null then
      raise exception 'DH Feats evaluator changed; review Showdown source extension before applying';
    end if;
    definition:=replace(definition,metrics_anchor,$metrics$
  piece:=public.showdown_member_metrics(uid,(select cm.club_id from public.club_members cm where cm.user_id=uid limit 1));
  m:=m||jsonb_build_object('showdown_matches',dh_feat_number(piece->>'qualified_played'),
    'showdown_wins',dh_feat_number(piece->>'qualified_wins'),
    'showdown_prism_solved',dh_feat_number(piece->>'prism_solved'),
    'showdown_prism_optimal',dh_feat_number(piece->>'optimum_rounds'),
    'showdown_prism_best',dh_feat_number(piece->>'best_prism_score'),
    'showdown_rivals',dh_feat_number(piece->>'rival_count'));
  select count(*) into features from (values
    (dh_feat_number(m->>'showdown_matches')),$metrics$);
    definition:=replace(definition,days_anchor,$days$
    -- showdown_completed_activity_days_v1: the member's actual finish date,
    -- eligible only once the entire match completes, never an opponent's later day.
    select (a.finished_at at time zone 'UTC')::date d from public.showdown_challenges c
      join public.showdown_attempts a on a.challenge_id=c.id and a.user_id=uid
      where c.status='completed' and c.completed_at is not null and a.finished_at is not null and a.solved_count>=1
        and c.club_id=(select cm.club_id from public.club_members cm where cm.user_id=uid limit 1)
        and public.showdown_member_valid(c.club_id,uid)
        and public.dh_visible_member(c.challenger_id) and public.dh_visible_member(c.recipient_id) union
    $days$||days_anchor);
    execute definition;
  elsif position('showdown_prism_best' in definition)=0 or position('showdown_rivals' in definition)=0
    or position('showdown_completed_activity_days_v1' in definition)=0
    or position('qualified_played' in definition)=0 then
    raise exception 'DH Feats Showdown extension is incomplete; review evaluator before applying';
  end if;
end $patch$;

create or replace function public.showdown_feat_dirty() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status='completed' and old.status is distinct from new.status then
    insert into public.dh_feat_accounts(user_id,dirty)
      select member_id,true from unnest(array[new.challenger_id,new.recipient_id]) member_id
      where public.showdown_member_valid(new.club_id,member_id) order by member_id
      on conflict(user_id) do update set dirty=true where not dh_feat_accounts.dirty;
  end if;
  return new;
end $$;
revoke all on function public.showdown_feat_dirty() from public,anon,authenticated;
grant execute on function public.showdown_feat_dirty() to service_role;
drop trigger if exists showdown_feat_completion on public.showdown_challenges;
create trigger showdown_feat_completion after update of status on public.showdown_challenges
  for each row when(old.status is distinct from new.status and new.status='completed')
  execute function public.showdown_feat_dirty();

-- Invalidation only: the existing evaluator creates finite permanent receipts.
-- Never directly award points, rewrite previous awards, or reward invitations.
update public.dh_feat_accounts account set dirty=true where exists(
  select 1 from public.showdown_challenges c join public.showdown_attempts a on a.challenge_id=c.id and a.user_id=account.user_id
  where c.status='completed' and a.solved_count>=1 and public.showdown_member_valid(c.club_id,account.user_id));
commit;
