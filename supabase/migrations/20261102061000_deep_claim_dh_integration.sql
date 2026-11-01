-- Deep Claim extends the existing permanent DH Feats ledger and inbox.
-- No new score currency, public save data, cron delivery or device push.
begin;
lock table public.dc_companies in access exclusive mode;

alter table public.notification_preferences add column deep_claim boolean not null default true;
create table public.dc_notification_state(
 company_id uuid primary key references public.dc_companies(id),
 eligible_after timestamptz not null default clock_timestamp(),
 suppressed_through timestamptz,
 last_sent_at timestamptz,last_sent_day date,sent_count integer not null default 0 check(sent_count between 0 and 4));
create table public.dc_notification_events(
 company_id uuid not null references public.dc_companies(id),event_key text not null,
 kind text not null check(kind in('crew','production','research','find','project')),
 project_key text,occurred_at timestamptz not null,consumed_at timestamptz,
 notification_id uuid references public.notifications(id) on delete set null,
 primary key(company_id,event_key));
create index dc_pending_notifications on public.dc_notification_events(company_id,occurred_at) where consumed_at is null;
do $$declare item text;begin
 foreach item in array array['dc_notification_state','dc_notification_events'] loop
  execute format('alter table public.%I enable row level security',item);
  execute format('revoke all on public.%I from public,anon,authenticated',item);
  execute format('grant all on public.%I to service_role',item);
 end loop;
end $$;
-- Only future completions can notify or add general engagement dates. Seven
-- dedicated Feat families below intentionally count eligible saved history.
insert into public.dc_notification_state(company_id) select id from public.dc_companies;

insert into public.dh_feat_catalog
select * from jsonb_populate_recordset(null::public.dh_feat_catalog,$dc_feat_catalog$[{"key":"deep_claim_shifts","category":"deep_claim","title":"Shift by Shift","description":"Return from mining or exploration expeditions. Previews, active crews and survey work do not count.","thresholds":[1,10,40,120,300],"points":[5,10,15,25,40],"kind":"volume","unit":"count","sort_order":82},{"key":"deep_claim_depth","category":"deep_claim","title":"Below the Frontier","description":"Complete mining or exploration at these depths. Access upgrades and unworked ground do not count.","thresholds":[25,100,200,400,599],"points":[5,10,15,25,40],"kind":"mastery","unit":"count","sort_order":83},{"key":"deep_claim_processed","category":"deep_claim","title":"Made from the Mine","description":"Fully collect processed material units from paid production. Staged outputs, partial orders and equipment are excluded.","thresholds":[10,50,250,1000,5000],"points":[5,10,15,25,40],"kind":"volume","unit":"count","sort_order":84},{"key":"deep_claim_research","category":"deep_claim","title":"Better Ways to Work","description":"Complete permanent Deep Claim research nodes. Starting or paying for research alone does not count.","thresholds":[1,4,8,14],"points":[5,10,20,35],"kind":"mastery","unit":"count","sort_order":85},{"key":"deep_claim_deliveries","category":"deep_claim","title":"A Company of Its Word","description":"Fulfill distinct permanent delivery contracts with collected goods. Each order counts once.","thresholds":[1,3,6,12],"points":[5,10,20,35],"kind":"volume","unit":"count","sort_order":86},{"key":"deep_claim_infrastructure","category":"deep_claim","title":"Built Underground","description":"Finish installing functional supports, ventilation, pumps or rail. Construction still in progress does not count.","thresholds":[1,5,20,60,128],"points":[5,10,15,25,40],"kind":"volume","unit":"count","sort_order":87},{"key":"deep_claim_club_projects","category":"deep_claim","title":"Built Together","description":"Help complete different club projects with at least 5% of each project's frozen goal value. Claims and contribution clicks do not add progress.","thresholds":[1,2,4,6],"points":[5,10,20,35],"kind":"volume","unit":"count","sort_order":88}]$dc_feat_catalog$::jsonb)
on conflict(key) do update set category=excluded.category,title=excluded.title,description=excluded.description,
 thresholds=excluded.thresholds,points=excluded.points,kind=excluded.kind,unit=excluded.unit,sort_order=excluded.sort_order;

-- DH Score is account-lifetime. Leaving a club or removing its installed game
-- cannot erase legitimate saved activity; private testing workspaces never count.
create or replace function public.dc_feat_company_v5(p_company uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.dc_companies c join public.clubs club on club.id=c.club_id
  where c.id=p_company and public.dh_public_member(c.user_id)
   and (club.settings->>'private_session') is distinct from 'true'
   and not exists(select 1 from public.dh_private_accounts private where private.workspace_id=c.club_id))
$$;
create or replace function public.dc_feat_metrics_v5(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 with eligible as(
  select c.id,c.club_id from public.dc_companies c where c.user_id=p_user
   and public.dh_public_member(p_user) and public.dc_feat_company_v5(c.id)
 ), sources as(
  select public.dc_business_stats_v4(e.id) metrics from eligible e
 ), qualified as(
  select q.club_id,q.project_key from public.dc_club_contributions q join eligible e on e.id=q.company_id and e.club_id=q.club_id
  join public.dc_club_projects p on p.club_id=q.club_id and p.project_key=q.project_key
  where p.completed_at is not null group by q.club_id,q.project_key,p.total_value
  having sum(q.frozen_value)>=ceil(p.total_value::numeric*5/100)
 )
 select jsonb_build_object(
  'deep_claim_shifts',coalesce(sum((metrics->>'completed_mining_expeditions')::bigint),0),
  'deep_claim_depth',coalesce(max((metrics->>'max_completed_mining_depth')::integer),0),
  'deep_claim_processed',coalesce(sum((metrics->>'collected_processed_units')::bigint),0),
  'deep_claim_research',coalesce(sum((metrics->>'completed_research')::integer),0),
  'deep_claim_deliveries',coalesce(sum((metrics->>'completed_contracts')::integer),0),
  'deep_claim_infrastructure',coalesce(sum((metrics->>'installed_infrastructure')::integer),0),
  'deep_claim_club_projects',(select count(*) from qualified)) from sources
$$;

create or replace function public.dc_completed_activity_v5(p_user uuid) returns setof timestamptz
language sql stable security definer set search_path=public,pg_temp as $$
 with eligible as(
  select c.id,c.club_id,s.eligible_after from public.dc_companies c
  join public.dc_notification_state s on s.company_id=c.id
  where c.user_id=p_user and public.dh_public_member(p_user) and public.dc_feat_company_v5(c.id)
 ), activity as(
  select j.completes_at at_time,e.eligible_after from public.dc_expeditions j join eligible e on e.id=j.company_id where j.status in('ready','collected') union all
  select j.collected_at,e.eligible_after from public.dc_production_jobs j join eligible e on e.id=j.company_id where j.status='collected' union all
  select j.completed_at,e.eligible_after from public.dc_research_orders j join eligible e on e.id=j.company_id where j.completed_at is not null union all
  select j.completed_at,e.eligible_after from public.dc_company_contracts j join eligible e on e.id=j.company_id where j.completed_at is not null union all
  select p.completed_at,e.eligible_after from eligible e join public.dc_club_contributions q on q.company_id=e.id and q.club_id=e.club_id
   join public.dc_club_projects p on p.club_id=q.club_id and p.project_key=q.project_key where p.completed_at is not null
   group by q.club_id,q.project_key,p.completed_at,e.eligible_after,p.total_value having sum(q.frozen_value)>=ceil(p.total_value::numeric*5/100)
 ) select at_time from activity where at_time>=eligible_after and at_time<=clock_timestamp()
$$;

-- Keep every prior source expression and account/ledger security setting.
do $metrics$
declare definition text;anchor text:='  select count(*) into features from (values';days_anchor text:='  ) days where d is not null';
begin
 definition:=pg_get_functiondef('public.dh_feat_metrics(uuid)'::regprocedure);
 if position('dc_feat_metrics_v5' in definition)>0 or position(anchor in definition)=0 or position(days_anchor in definition)=0 then
  raise exception 'DH Feats source contract changed; review Deep Claim integration before applying';
 end if;
 definition:=replace(definition,anchor,$extension$
  -- deep_claim_metrics_v5: permanent source metrics, no preview/start awards.
  m:=m||public.dc_feat_metrics_v5(uid);
  select count(*) into features from (values
    ((case when exists(select 1 from public.dc_completed_activity_v5(uid)) then 1 else 0 end)),
$extension$);
 definition:=replace(definition,days_anchor,$days$
    union select (activity_at at time zone 'UTC')::date from public.dc_completed_activity_v5(uid) activity_at
  ) days where d is not null$days$);
 execute definition;
end $metrics$;

create or replace function public.dc_mark_feat_dirty_v5(p_company uuid,p_skip_busy boolean default false) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare owner uuid;begin
 select c.user_id into owner from public.dc_companies c where c.id=p_company and public.dh_public_member(c.user_id)
  and public.dc_feat_company_v5(c.id);
 if owner is null then return;end if;
 if p_skip_busy then
  -- A completed shared project must not wait for an account already held by a
  -- contributor who is waiting for this same project. The collector's existing
  -- five-minute reconciliation repairs a skipped busy account.
  perform 1 from public.dh_feat_accounts where user_id=owner for update skip locked;
  if not found and exists(select 1 from public.dh_feat_accounts where user_id=owner) then return;end if;
 end if;
 insert into public.dh_feat_accounts(user_id,dirty) values(owner,true)
  on conflict(user_id) do update set dirty=true where not dh_feat_accounts.dirty;
end $$;

create or replace function public.dc_notification_preference_v5() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if (tg_op='INSERT' and not new.deep_claim) or (tg_op='UPDATE' and old.deep_claim is distinct from new.deep_claim) then
  -- Separate from the lifetime integration gate used by general Feats dates.
  -- Re-enabling cannot replay work that completed while updates were muted.
  update public.dc_notification_state s set suppressed_through=clock_timestamp()
   from public.dc_companies c where c.id=s.company_id and c.user_id=new.user_id;
 end if;return new;
end $$;
create trigger dc_notification_preference after insert or update of deep_claim on public.notification_preferences
 for each row execute function public.dc_notification_preference_v5();

create or replace function public.dc_queue_notification_v5(p_company uuid,p_key text,p_kind text,p_occurred timestamptz,p_project text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare owner uuid;club uuid;gate timestamptz;cutoff timestamptz;allowed boolean;begin
 select c.user_id,c.club_id,s.eligible_after,s.suppressed_through into owner,club,gate,cutoff from public.dc_companies c
  join public.dc_notification_state s on s.company_id=c.id where c.id=p_company;
 if owner is null or p_occurred is null or p_occurred<gate or p_occurred<=cutoff then return;end if;
 allowed:=public.dh_public_member(owner) and public.dc_public_company_v5(p_company,club)
  and coalesce((select deep_claim from public.notification_preferences where user_id=owner),true);
 insert into public.dc_notification_events(company_id,event_key,kind,project_key,occurred_at,consumed_at)
  values(p_company,p_key,p_kind,p_project,p_occurred,case when allowed then null else clock_timestamp() end)
  on conflict(company_id,event_key) do nothing;
end $$;

create or replace function public.dc_integration_event_v5() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare contributor uuid;begin
 if tg_table_name='dc_companies' then
  insert into public.dc_notification_state(company_id) values(new.id) on conflict do nothing;return new;
 elsif tg_table_name='dc_club_projects' then
  if old.completed_at is null and new.completed_at is not null then
   for contributor in select distinct company_id from public.dc_club_contributions
    where club_id=new.club_id and project_key=new.project_key order by company_id loop
     perform public.dc_mark_feat_dirty_v5(contributor,true);
   end loop;
  end if;return new;
 elsif tg_table_name='dc_expeditions' then
  if old.status='active' and new.status in('ready','collected') then
   perform public.dc_mark_feat_dirty_v5(new.company_id);
   perform public.dc_queue_notification_v5(new.company_id,'crew:'||new.id,'crew',new.completes_at);
  end if;
 elsif tg_table_name='dc_production_jobs' then
  if old.status='active' and new.status='ready' then
   perform public.dc_queue_notification_v5(new.company_id,'production:'||new.id,'production',new.completes_at);
  elsif old.status<>'collected' and new.status='collected' then perform public.dc_mark_feat_dirty_v5(new.company_id);end if;
 elsif tg_table_name='dc_research_orders' then
  if old.completed_at is null and new.completed_at is not null then
   perform public.dc_mark_feat_dirty_v5(new.company_id);
   perform public.dc_queue_notification_v5(new.company_id,'research:'||new.research_key,'research',new.completed_at);
  end if;
 elsif tg_table_name='dc_company_contracts' then
  if old.completed_at is null and new.completed_at is not null then perform public.dc_mark_feat_dirty_v5(new.company_id);end if;
 elsif tg_table_name='dc_infrastructure' then
  if old.status<>'installed' and new.status='installed' then perform public.dc_mark_feat_dirty_v5(new.company_id);end if;
 elsif tg_table_name='dc_discoveries' then
  if old.status='planned' and new.status='pending' and (new.quality in('exceptional','flawless') or new.sale_value>=150) then
   perform public.dc_queue_notification_v5(new.company_id,'find:'||new.id,'find',new.discovered_at);
  end if;
 end if;return new;
end $$;
create trigger dc_notification_company after insert on public.dc_companies for each row execute function public.dc_integration_event_v5();
create trigger dc_integration_project after update of completed_at on public.dc_club_projects for each row execute function public.dc_integration_event_v5();
create trigger dc_integration_expedition after update of status on public.dc_expeditions for each row execute function public.dc_integration_event_v5();
create trigger dc_integration_production after update of status on public.dc_production_jobs for each row execute function public.dc_integration_event_v5();
create trigger dc_integration_research after update of completed_at on public.dc_research_orders for each row execute function public.dc_integration_event_v5();
create trigger dc_integration_contract after update of completed_at on public.dc_company_contracts for each row execute function public.dc_integration_event_v5();
create trigger dc_integration_infrastructure after update of status on public.dc_infrastructure for each row execute function public.dc_integration_event_v5();
create trigger dc_integration_discovery after update of status on public.dc_discoveries for each row execute function public.dc_integration_event_v5();

create or replace function public.dc_flush_notifications_v5(p_company uuid,p_now timestamptz) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare state public.dc_notification_state%rowtype;company public.dc_companies%rowtype;pending integer;project text;notification uuid;day date;sent integer;url text;begin
 select * into state from public.dc_notification_state where company_id=p_company for update;
 if not found then return;end if;
 update public.dc_notification_events set consumed_at=p_now where company_id=p_company and consumed_at is null
  and occurred_at<=state.suppressed_through;
 select count(*),min(project_key) filter(where kind='project') into pending,project from public.dc_notification_events where company_id=p_company and consumed_at is null;
 if pending=0 then return;end if;
 select * into company from public.dc_companies where id=p_company;
 if not public.dh_public_member(company.user_id) or not public.dc_public_company_v5(p_company,company.club_id)
  or not coalesce((select deep_claim from public.notification_preferences where user_id=company.user_id),true) then
  update public.dc_notification_events set consumed_at=p_now where company_id=p_company and consumed_at is null;return;
 end if;
 day:=(p_now at time zone public.dc_timezone_v1(company.club_id))::date;
 sent:=case when state.last_sent_day=day then state.sent_count else 0 end;
 if sent>=4 then update public.dc_notification_events set consumed_at=p_now where company_id=p_company and consumed_at is null;return;end if;
 if state.last_sent_at>p_now-interval '15 minutes' then return;end if;
 url:='/deep-claim?club='||company.club_id||case when project is null then '&office=company' else '&office=club&view=projects&project='||project end;
 insert into public.notifications(user_id,club_id,type,title,body,url,actor_user_id)
  values(company.user_id,company.club_id,'deep_claim',case when project is null then 'Your claim has an update' else 'Club project completed' end,
   case when pending=1 then 'One completed company event is ready to review.' else pending||' completed company events are ready to review.' end,url,null) returning id into notification;
 update public.dc_notification_events set consumed_at=p_now,notification_id=notification where company_id=p_company and consumed_at is null;
 update public.dc_notification_state set last_sent_at=p_now,last_sent_day=day,sent_count=sent+1 where company_id=p_company;
end $$;
do $reconcile$
declare definition text;begin
 if to_regprocedure('public.dc_reconcile_v1_phase5_core_base(uuid,timestamptz)') is not null then raise exception 'Deep Claim inbox integration already installed';end if;
 definition:=pg_get_functiondef('public.dc_reconcile_v1(uuid,timestamptz)'::regprocedure);
 execute replace(definition,'FUNCTION public.dc_reconcile_v1(','FUNCTION public.dc_reconcile_v1_phase5_core_base(');
end $reconcile$;
create or replace function public.dc_reconcile_v1(p_company uuid,p_now timestamptz) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare project record;begin
 perform public.dc_reconcile_v1_phase5_core_base(p_company,p_now);
 -- A notification event's company foreign key takes a KEY SHARE lock. Queue
 -- shared-project events only during the contributor's own later sync, never
 -- while another contributor holds that project and their own company lock.
 for project in select distinct p.club_id,p.project_key,p.completed_at
  from public.dc_club_projects p join public.dc_club_contributions q
   on q.club_id=p.club_id and q.project_key=p.project_key
  where q.company_id=p_company and p.completed_at is not null order by p.club_id,p.project_key loop
  perform public.dc_queue_notification_v5(p_company,'project:'||project.club_id||':'||project.project_key,'project',project.completed_at,project.project_key);
 end loop;
 perform public.dc_flush_notifications_v5(p_company,p_now);
end $$;

-- Historical import only the seven newly registered families. Existing account
-- state, old progress, point snapshots, earned timestamps and seen/pinned goals
-- remain untouched. These receipts never enter monthly standings or reveals.
insert into public.dh_feat_accounts(user_id)
 select distinct c.user_id from public.dc_companies c where public.dh_public_member(c.user_id) and public.dc_feat_company_v5(c.id)
 on conflict(user_id) do nothing;
with owners as(select distinct user_id from public.dc_companies c where public.dh_public_member(c.user_id) and public.dc_feat_company_v5(c.id))
insert into public.dh_feat_progress(user_id,feat_key,value)
 select o.user_id,m.key,public.dh_feat_number(m.value) from owners o cross join lateral jsonb_each_text(public.dc_feat_metrics_v5(o.user_id))m
 on conflict(user_id,feat_key) do update set value=greatest(dh_feat_progress.value,excluded.value);
insert into public.dh_feat_unlocks(user_id,feat_key,tier,points,target,historical)
 select p.user_id,c.key,t.ordinality,c.points[t.ordinality],t.target,true from public.dh_feat_progress p
 join public.dh_feat_catalog c on c.key=p.feat_key and c.key in('deep_claim_shifts','deep_claim_depth','deep_claim_processed','deep_claim_research','deep_claim_deliveries','deep_claim_infrastructure','deep_claim_club_projects')
 cross join lateral unnest(c.thresholds) with ordinality t(target,ordinality)
 where p.value>=t.target on conflict do nothing;

do $permissions$
declare signature text;begin
 foreach signature in array array[
  'dc_feat_company_v5(uuid)','dc_feat_metrics_v5(uuid)','dc_completed_activity_v5(uuid)','dc_mark_feat_dirty_v5(uuid,boolean)','dc_notification_preference_v5()',
  'dc_queue_notification_v5(uuid,text,text,timestamptz,text)','dc_integration_event_v5()',
  'dc_flush_notifications_v5(uuid,timestamptz)','dc_reconcile_v1_phase5_core_base(uuid,timestamptz)','dc_reconcile_v1(uuid,timestamptz)'] loop
  execute 'revoke all on function public.'||signature||' from public,anon,authenticated';
  execute 'grant execute on function public.'||signature||' to service_role';
 end loop;
end $permissions$;
notify pgrst,'reload schema';
commit;
