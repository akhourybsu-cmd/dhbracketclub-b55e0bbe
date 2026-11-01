-- Deep Claim Phase 5 core. Sharing is explicit; the private company protocol,
-- field rules and every existing job/geological snapshot remain unchanged.
begin;
-- Match authorization's asset -> company order if metadata waits for a reader.
update public.platform_assets set full_description='Build a persistent private mining company with a hired crew, owned equipment, finite geological exploration, industry, paid research and delivery contracts. Optional club boards compare explicit recorded accomplishments. Publish a curated company showcase, contribute collected materials to six finite cooperative projects and claim a bounded proportional credit award. Company money, inventory, workers, maps and active jobs stay private. Server timestamps preserve offline work; research and progression keep frozen rules.',updated_at=now() where slug='deep-claim';
insert into public.dc_rules(version,config) values(5,$dc_social_catalog${"version":5,"projects":[{"key":"camp_supply","name":"Camp Supply","description":"Equip the shared frontier camp with construction stock.","requires":[],"goals":{"stone":80,"coal":40,"clay":30},"reward_pool":90},{"key":"haul_extension","name":"Haul Extension","description":"Extend shared freight works with structural iron and fuel.","requires":["camp_supply"],"goals":{"iron_bar":12,"coal":40,"stone":100},"reward_pool":330},{"key":"clean_air","name":"Clean Air Works","description":"Build club ventilation works with metal fittings and fuel.","requires":["haul_extension"],"goals":{"copper_bar":10,"iron_bar":8,"coal":50},"reward_pool":393},{"key":"assay_observatory","name":"Assay Observatory","description":"Prepare shared instruments for the club geological archive.","requires":["clean_air"],"goals":{"polished_quartz":24,"silver_bar":6,"bronze_bar":12},"reward_pool":750},{"key":"deep_freight","name":"Deep Freight Works","description":"Assemble a shared freight exhibit from advanced structural metals.","requires":["assay_observatory"],"goals":{"steel_bar":16,"bronze_bar":12,"iron_bar":16},"reward_pool":1128},{"key":"geological_pavilion","name":"Geological Pavilion","description":"Finish the club geological pavilion with crystals and refined gold.","requires":["deep_freight"],"goals":{"cut_amethyst":12,"gold_bar":6,"polished_quartz":30},"reward_pool":1080}],"standings":[{"key":"weekly_mining_value","name":"Weekly Mining Value","description":"Original finite haul value from recorded crew returns in this club-local week. Other returns appear when their companies sync.","unit":"credits of haul"},{"key":"operational_depth","name":"Operational Depth","description":"Deepest recorded completed mining or exploration expedition.","unit":"m"},{"key":"best_find","name":"Best Find","description":"Highest frozen sale value among recovered discoveries; specimen identity stays private.","unit":"credits of find value"}],"caps":{"standings_limit":50,"showcase_page_size":24,"showcase_max_page":19,"featured_specimens":3,"qualified_percent":5}}$dc_social_catalog$::jsonb);
create unique index dc_company_club_identity on public.dc_companies(id,club_id);
-- Shared boards read only committed outcomes; index their per-company history.
create index dc_returned_mining_board on public.dc_expeditions(company_id,completes_at,target_y) where mode in('extract','explore') and status in('ready','collected');
create index dc_recovered_find_board on public.dc_discoveries(company_id,sale_value desc) where status<>'planned';
create table public.dc_social_preferences(company_id uuid primary key references public.dc_companies(id),
 standings_enabled boolean not null default false,showcase_enabled boolean not null default false,
 featured_discovery_ids uuid[] not null default array[]::uuid[],updated_at timestamptz not null default now(),check(cardinality(featured_discovery_ids) between 0 and 3));
create table public.dc_club_projects(club_id uuid not null references public.clubs(id),project_key text not null,
 definition_snapshot jsonb not null,unit_values jsonb not null,total_value integer not null check(total_value>0),
 reward_pool integer not null check(reward_pool>=0 and reward_pool<=floor(total_value*0.4)),
 frozen_member_count integer not null check(frozen_member_count>=1),frozen_cap_percent integer not null check(frozen_cap_percent in(40,60,100)),
 progress jsonb not null default '{}',created_at timestamptz not null default now(),completed_at timestamptz,primary key(club_id,project_key));
create table public.dc_club_contributions(request_id uuid primary key references public.dc_requests(request_id) deferrable initially deferred,
 club_id uuid not null,project_key text not null,company_id uuid not null,resources jsonb not null,frozen_value integer not null check(frozen_value>0),created_at timestamptz not null default now(),
 foreign key(club_id,project_key) references public.dc_club_projects(club_id,project_key),foreign key(company_id,club_id) references public.dc_companies(id,club_id));
create index dc_company_project_contributions on public.dc_club_contributions(company_id,club_id,project_key);
create index dc_project_contributions on public.dc_club_contributions(club_id,project_key,company_id);
create table public.dc_club_claims(company_id uuid not null,club_id uuid not null,project_key text not null,reward integer not null check(reward>0),
 claimed_at timestamptz not null default now(),request_id uuid not null unique references public.dc_requests(request_id) deferrable initially deferred,
 primary key(company_id,club_id,project_key),foreign key(company_id,club_id) references public.dc_companies(id,club_id),foreign key(club_id,project_key) references public.dc_club_projects(club_id,project_key));
do $$ declare t text;begin
 foreach t in array array['dc_social_preferences','dc_club_projects','dc_club_contributions','dc_club_claims'] loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create or replace function public.dc_social_catalog_v5() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$select config from public.dc_rules where version=5$$;
create or replace function public.dc_shared_club_v5() returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.dc_access_v1();begin
 if not public.dh_public_member(auth.uid()) then raise exception 'Club operations are unavailable' using errcode='42501';end if;return cid;end $$;
create or replace function public.dc_public_company_v5(p_company uuid,p_club uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.dc_companies c join public.club_members m on m.club_id=c.club_id and m.user_id=c.user_id join public.clubs club on club.id=c.club_id
  where c.id=p_company and c.club_id=p_club and club.status='active' and public.dh_public_member(c.user_id) and public.dh_visible_club(c.club_id)
   and exists(select 1 from public.club_installed_assets i join public.platform_assets a on a.id=i.asset_id where i.club_id=c.club_id and a.slug='deep-claim' and a.is_active and i.enabled and i.visible_to_members))
$$;
create or replace function public.dc_member_cap_v5(p_club uuid) returns integer language sql stable security definer set search_path=public,pg_temp as $$
 select case count(*) when 0 then 100 when 1 then 100 when 2 then 60 else 40 end from public.club_members where club_id=p_club and public.dh_public_member(user_id)
$$;
-- Historical mine prices are fixed for all ten minerals shipped through field
-- rules three. Read immutable original cargo, never a mutable staged remainder
-- or a later market-price helper. New mineral rules need a new valuation version.
create or replace function public.dc_mining_value_v5(p_cargo jsonb) returns bigint language sql immutable as $$
 select coalesce(sum((value::text)::bigint*case key when 'stone' then 1 when 'clay' then 2 when 'coal' then 4 when 'copper_ore' then 8 when 'tin_ore' then 10 when 'iron_ore' then 14 when 'quartz' then 12 when 'silver_ore' then 30 when 'amethyst' then 50 when 'gold_ore' then 45 else 0 end),0)::bigint from jsonb_each(coalesce(p_cargo,'{}'))
$$;
create or replace function public.dc_club_week_v5(p_club uuid,p_now timestamptz) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare zone text:=public.dc_timezone_v1(p_club);week_start timestamp;begin
 week_start:=date_trunc('week',p_now at time zone zone);
 return jsonb_build_object('starts_at',week_start at time zone zone,'ends_at',(week_start+interval '7 days') at time zone zone,'timezone',zone);end $$;
create or replace function public.dc_public_specimens_v5(p_company uuid,p_ids uuid[]) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('kind',d.kind,'name',d.name,'quality',d.quality,'detail',d.detail) order by ids.ord),'[]')
 from unnest(p_ids) with ordinality ids(id,ord) join public.dc_discoveries d on d.id=ids.id and d.company_id=p_company and d.status='kept'
$$;
create or replace function public.dc_ensure_projects_v5(p_club uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare definition jsonb;resource record;prices jsonb;total integer;members integer;cap integer;begin
 -- Locked future projects have no frozen cohort yet. Completing a prerequisite
 -- opens its successor with the public membership and prices at that moment.
 for definition in select value from jsonb_array_elements(public.dc_social_catalog_v5()->'projects') loop
  if exists(select 1 from public.dc_club_projects where club_id=p_club and project_key=definition->>'key') then continue;end if;
  if exists(select 1 from jsonb_array_elements_text(definition->'requires')k where not exists(select 1 from public.dc_club_projects p where p.club_id=p_club and p.project_key=k and p.completed_at is not null)) then continue;end if;
  prices:='{}';total:=0;
  for resource in select key,(value::text)::integer quantity from jsonb_each(definition->'goals') loop
   prices:=prices||jsonb_build_object(resource.key,public.dc_price_v1(resource.key));total:=total+resource.quantity*public.dc_price_v1(resource.key);
  end loop;
  select greatest(1,count(*))::integer into members from public.club_members where club_id=p_club and public.dh_public_member(user_id);
  cap:=case members when 1 then 100 when 2 then 60 else 40 end;
  insert into public.dc_club_projects(club_id,project_key,definition_snapshot,unit_values,total_value,reward_pool,frozen_member_count,frozen_cap_percent)
   values(p_club,definition->>'key',definition,prices,total,(definition->>'reward_pool')::integer,members,cap) on conflict do nothing;
 end loop;
end $$;
create or replace function public.dc_projects_view_v5(p_club uuid,p_company uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare definition jsonb;project public.dc_club_projects%rowtype;own_resources jsonb;own_value bigint;contributors integer;claim_time timestamptz;total integer;resource record;result jsonb:='[]';cap integer;begin
 for definition in select value from jsonb_array_elements(public.dc_social_catalog_v5()->'projects') loop
  select * into project from public.dc_club_projects where club_id=p_club and project_key=definition->>'key';
  if found then definition:=project.definition_snapshot;total:=project.total_value;cap:=greatest(project.frozen_cap_percent,public.dc_member_cap_v5(p_club));
  else total:=0;for resource in select key,(value::text)::integer quantity from jsonb_each(definition->'goals') loop total:=total+resource.quantity*public.dc_price_v1(resource.key);end loop;cap:=public.dc_member_cap_v5(p_club);end if;
  select coalesce(jsonb_object_agg(key,quantity),'{}') into own_resources from(select r.key,sum((r.value::text)::integer)::integer quantity from public.dc_club_contributions c cross join lateral jsonb_each(c.resources)r where c.club_id=p_club and c.project_key=definition->>'key' and c.company_id=p_company group by r.key)s;
  select coalesce(sum(frozen_value),0) into own_value from public.dc_club_contributions where club_id=p_club and project_key=definition->>'key' and company_id=p_company;
  select count(distinct company_id)::integer into contributors from public.dc_club_contributions where club_id=p_club and project_key=definition->>'key';
  select claimed_at into claim_time from public.dc_club_claims where club_id=p_club and project_key=definition->>'key' and company_id=p_company;
  result:=result||jsonb_build_array(jsonb_build_object('key',definition->>'key','status',case when project.club_id is null then 'locked' when project.completed_at is null then 'open' else 'completed' end,
   'goals',definition->'goals','progress',coalesce(project.progress,'{}'),'own_contribution',own_resources,'own_value',own_value,'total_value',total,'reward_pool',(definition->>'reward_pool')::integer,
   'reward_amount',case when own_value>=ceil(total*0.05) then floor((definition->>'reward_pool')::numeric*own_value/total)::integer else 0 end,
   'qualified',own_value>=ceil(total*0.05),'claimed_at',claim_time,'effective_cap_percent',cap,'contributors',contributors,'completed_at',project.completed_at));
 end loop;return result;end $$;
create or replace function public.dc_standings_v5(p_club uuid,p_metric text,p_week jsonb) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with eligible as(select c.id,c.user_id,c.name company_name,left(coalesce(nullif(btrim(p.display_name),''),'Club member'),80) display_name,case when octet_length(p.avatar_url)<=2048 and p.avatar_url~*'^https?://[^[:space:]/?#]+[^[:space:]]*$' then p.avatar_url else null end avatar_url
  from public.dc_companies c join public.dc_social_preferences pref on pref.company_id=c.id join public.profiles p on p.id=c.user_id
  where c.club_id=p_club and pref.standings_enabled and public.dc_public_company_v5(c.id,p_club)),
 values_by_company as(select e.*,case p_metric
  when 'weekly_mining_value' then (select coalesce(sum(public.dc_mining_value_v5(plan.content->'cargo')),0) from public.dc_expeditions j join public.dc_plans plan on plan.job_id=j.id where j.company_id=e.id and j.mode in('extract','explore') and j.status in('ready','collected') and j.completes_at>=(p_week->>'starts_at')::timestamptz and j.completes_at<(p_week->>'ends_at')::timestamptz)
  when 'operational_depth' then (select coalesce(max(target_y),0) from public.dc_expeditions where company_id=e.id and mode in('extract','explore') and status in('ready','collected'))
  else (select coalesce(max(sale_value),0) from public.dc_discoveries where company_id=e.id and status<>'planned') end value from eligible e),
 ranked as(select *,rank() over(order by value desc) rank from values_by_company),
 page as(select *,row_number() over(order by value desc,user_id) position from ranked)
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'display_name',display_name,'avatar_url',avatar_url,'company_name',company_name,'value',value,'rank',rank,'is_you',user_id=auth.uid()) order by position),'[]') from page where position<=50 or user_id=auth.uid()
$$;
create or replace function public.dc_showcases_v5(p_club uuid,p_page integer) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with eligible as(select c.id,c.user_id,c.name company_name,left(coalesce(nullif(btrim(p.display_name),''),'Club member'),80) display_name,case when octet_length(p.avatar_url)<=2048 and p.avatar_url~*'^https?://[^[:space:]/?#]+[^[:space:]]*$' then p.avatar_url else null end avatar_url,pref.featured_discovery_ids
  from public.dc_companies c join public.dc_social_preferences pref on pref.company_id=c.id join public.profiles p on p.id=c.user_id where c.club_id=p_club and pref.showcase_enabled and public.dc_public_company_v5(c.id,p_club)),
 page as(select * from eligible order by company_name,user_id offset p_page*24 limit 24)
 select jsonb_build_object('page',p_page,'total',(select count(*) from eligible),'has_more',p_page<19 and (select count(*) from eligible)>(p_page+1)*24,
 'companies',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'display_name',display_name,'avatar_url',avatar_url,'company_name',company_name,'specimens',public.dc_public_specimens_v5(id,featured_discovery_ids)) order by company_name,user_id),'[]') from page))
$$;
create or replace function public.dc_get_club(p_metric text default 'weekly_mining_value',p_page integer default 0) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.dc_shared_club_v5();company uuid;revision integer:=0;pref public.dc_social_preferences%rowtype;moment timestamptz;week jsonb;begin
 if p_metric is null or p_metric not in('weekly_mining_value','operational_depth','best_find') or p_page is null or p_page not between 0 and 19 then raise exception 'Choose a supported club board and page';end if;
 select id into company from public.dc_companies where club_id=cid and user_id=auth.uid() for update;
 if company is not null then perform public.dc_reconcile_v1(company,clock_timestamp());select c.revision into revision from public.dc_companies c where c.id=company;end if;
 perform public.dc_ensure_projects_v5(cid);moment:=clock_timestamp();week:=public.dc_club_week_v5(cid,moment);
 select * into pref from public.dc_social_preferences where company_id=company;
 return jsonb_build_object('version',1,'server_now',moment,'club_id',cid,'user_id',auth.uid(),'own_revision',revision,'catalog',public.dc_social_catalog_v5(),
  'own',jsonb_build_object('standings_enabled',coalesce(pref.standings_enabled,false),'showcase_enabled',coalesce(pref.showcase_enabled,false),'featured_discovery_ids',coalesce(pref.featured_discovery_ids,array[]::uuid[]),'featured_specimens',public.dc_public_specimens_v5(company,pref.featured_discovery_ids)),
  'metric',p_metric,'week',week,'standings',public.dc_standings_v5(cid,p_metric,week),'projects',public.dc_projects_view_v5(cid,company),'showcases',public.dc_showcases_v5(cid,p_page));end $$;
create or replace function public.dc_set_social_preferences(p_standings boolean,p_showcase boolean,p_featured_discovery_ids uuid[],p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.dc_shared_club_v5();company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;
 payload jsonb:=jsonb_build_object('standings',p_standings,'showcase',p_showcase,'featured_discovery_ids',p_featured_discovery_ids,'expected_revision',p_expected_revision);begin
 if not public.dc_public_company_v5(company,cid) then raise exception 'Club operations are unavailable' using errcode='42501';end if;
 if public.dc_receipt_v1(company,p_request_id,'set_social_preferences',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 if p_standings is null or p_showcase is null or p_featured_discovery_ids is null or cardinality(p_featured_discovery_ids)>3
  or (cardinality(p_featured_discovery_ids)>0 and (array_ndims(p_featured_discovery_ids) is distinct from 1 or array_lower(p_featured_discovery_ids,1) is distinct from 1))
  or exists(select 1 from unnest(p_featured_discovery_ids)id where id is null) or (select count(distinct id) from unnest(p_featured_discovery_ids)id)<>cardinality(p_featured_discovery_ids) then raise exception 'Choose up to three different kept discoveries';end if;
 if (select count(*) from public.dc_discoveries where company_id=company and status='kept' and id=any(p_featured_discovery_ids))<>cardinality(p_featured_discovery_ids) then raise exception 'Only your kept discoveries can be featured';end if;
 insert into public.dc_social_preferences values(company,p_standings,p_showcase,p_featured_discovery_ids,clock_timestamp()) on conflict(company_id) do update set standings_enabled=excluded.standings_enabled,showcase_enabled=excluded.showcase_enabled,featured_discovery_ids=excluded.featured_discovery_ids,updated_at=excluded.updated_at;
 update public.dc_companies set revision=revision+1 where id=company;
 perform public.dc_store_receipt_v1(company,p_request_id,'set_social_preferences',payload);return public.dc_snapshot_v1(company,clock_timestamp());end $$;
create or replace function public.dc_contribute_project(p_project_key text,p_resources jsonb,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.dc_shared_club_v5();company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;project public.dc_club_projects%rowtype;resource record;
 units integer;own_quantity bigint;goal integer;cap integer;value integer:=0;next_progress jsonb;complete boolean;payload jsonb:=jsonb_build_object('project_key',p_project_key,'resources',p_resources,'expected_revision',p_expected_revision);begin
 if not public.dc_public_company_v5(company,cid) then raise exception 'Club operations are unavailable' using errcode='42501';end if;
 if public.dc_receipt_v1(company,p_request_id,'contribute_project',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 if p_resources is null or jsonb_typeof(p_resources)<>'object' or p_resources='{}' then raise exception 'Choose positive whole quantities to contribute';end if;
 perform public.dc_ensure_projects_v5(cid);
 select * into project from public.dc_club_projects where club_id=cid and project_key=p_project_key for update;
 if not found then raise exception 'Complete the preceding club project first';end if;
 if project.completed_at is not null then raise exception 'This club project has already been completed';end if;
 cap:=greatest(project.frozen_cap_percent,public.dc_member_cap_v5(cid));next_progress:=project.progress;
 for resource in select r.key,r.value from jsonb_each(p_resources)r loop
  if not(project.definition_snapshot->'goals'?resource.key) or jsonb_typeof(resource.value)<>'number' or (resource.value::text)!~'^[1-9][0-9]{0,8}$' then raise exception 'Choose positive whole quantities from this project goals';end if;
  units:=(resource.value::text)::integer;goal:=(project.definition_snapshot->'goals'->>resource.key)::integer;
  select coalesce(sum((resources->>resource.key)::integer),0) into own_quantity from public.dc_club_contributions where club_id=cid and project_key=p_project_key and company_id=company;
  if units>goal-coalesce((next_progress->>resource.key)::integer,0) then raise exception 'The contribution exceeds the remaining project requirement';end if;
  if own_quantity+units>floor(goal*cap/100.0) then raise exception 'The contribution exceeds your current per-resource club project cap';end if;
  update public.dc_inventory i set quantity=i.quantity-units where i.company_id=company and i.resource_key=resource.key and i.quantity>=units;
  if not found then raise exception 'Collect enough company stock before contributing';end if;
  next_progress:=jsonb_set(next_progress,array[resource.key],to_jsonb(coalesce((next_progress->>resource.key)::integer,0)+units),true);value:=value+units*(project.unit_values->>resource.key)::integer;
 end loop;
 -- An optional donation cannot consume the last liquid operating reserve.
 -- Unclaimed awards, staged cargo, gear and unfinished work are not cash.
 if c.cash+coalesce((select sum(stock.quantity*public.dc_price_v1(stock.resource_key)) from public.dc_inventory stock where stock.company_id=company),0)<2 then raise exception 'Keep $2 operating cash or collected stock after a project contribution';end if;
 insert into public.dc_club_contributions(request_id,club_id,project_key,company_id,resources,frozen_value) values(p_request_id,cid,p_project_key,company,p_resources,value);
 complete:=not exists(select 1 from jsonb_each(project.definition_snapshot->'goals')g where coalesce((next_progress->>g.key)::integer,0)<(g.value::text)::integer);
 update public.dc_club_projects set progress=next_progress,completed_at=case when complete then clock_timestamp() else null end where club_id=cid and project_key=p_project_key;
 update public.dc_companies set revision=revision+1 where id=company;
 perform public.dc_store_receipt_v1(company,p_request_id,'contribute_project',payload);
 if complete then perform public.dc_ensure_projects_v5(cid);end if;return public.dc_snapshot_v1(company,clock_timestamp());end $$;
create or replace function public.dc_claim_project(p_project_key text,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.dc_shared_club_v5();company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;project public.dc_club_projects%rowtype;own_value bigint;reward integer;
 payload jsonb:=jsonb_build_object('project_key',p_project_key,'expected_revision',p_expected_revision);begin
 if not public.dc_public_company_v5(company,cid) then raise exception 'Club operations are unavailable' using errcode='42501';end if;
 if public.dc_receipt_v1(company,p_request_id,'claim_project',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 select * into project from public.dc_club_projects where club_id=cid and project_key=p_project_key for update;
 if not found or project.completed_at is null then raise exception 'Complete this club project before claiming its reward';end if;
 if exists(select 1 from public.dc_club_claims where company_id=company and club_id=cid and project_key=p_project_key) then raise exception 'This club project reward has already been claimed';end if;
 select coalesce(sum(frozen_value),0) into own_value from public.dc_club_contributions where company_id=company and club_id=cid and project_key=p_project_key;
 if own_value<ceil(project.total_value*0.05) then raise exception 'Contribute at least five percent of this project value to qualify';end if;
 reward:=floor(project.reward_pool::numeric*own_value/project.total_value)::integer;
 if reward<=0 then raise exception 'No project reward is available';end if;
 insert into public.dc_club_claims(company_id,club_id,project_key,reward,request_id) values(company,cid,p_project_key,reward,p_request_id);
 update public.dc_companies set cash=cash+reward,revision=revision+1 where id=company;
 perform public.dc_store_receipt_v1(company,p_request_id,'claim_project',payload);return public.dc_snapshot_v1(company,clock_timestamp());end $$;

create or replace function public.dc_social_guard_v5() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare item record;complete boolean;begin
 if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new;end if;
 if tg_op='UPDATE' then
  if tg_table_name='dc_social_preferences' then
   if new.company_id=old.company_id then return new;end if;
  elsif tg_table_name='dc_club_projects' then
   if old.completed_at is null and (to_jsonb(new)-array['progress','completed_at'])=(to_jsonb(old)-array['progress','completed_at']) and jsonb_typeof(new.progress)='object' then
    for item in select key,value from jsonb_each(new.progress) loop
     if not(new.definition_snapshot->'goals'?item.key) or jsonb_typeof(item.value)<>'number' or (item.value::text)!~'^[0-9]{1,9}$' or (item.value::text)::integer>(new.definition_snapshot->'goals'->>item.key)::integer or (item.value::text)::integer<coalesce((old.progress->>item.key)::integer,0) then raise exception 'Committed project progress cannot be reduced or exceed its goals';end if;
    end loop;
    if exists(select 1 from jsonb_each(old.progress)e where coalesce((new.progress->>e.key)::integer,0)<(e.value::text)::integer) then raise exception 'Committed project progress cannot be reduced';end if;
    complete:=not exists(select 1 from jsonb_each(new.definition_snapshot->'goals')g where coalesce((new.progress->>g.key)::integer,0)<(g.value::text)::integer);
    if complete=(new.completed_at is not null) then return new;end if;
   end if;
  end if;
 end if;raise exception 'Committed Deep Claim sharing and project receipts are immutable';end $$;
create trigger dc_social_preferences_guard before update or delete on public.dc_social_preferences for each row execute function public.dc_social_guard_v5();
create trigger dc_club_project_guard before update or delete on public.dc_club_projects for each row execute function public.dc_social_guard_v5();
create trigger dc_club_contribution_guard before update or delete on public.dc_club_contributions for each row execute function public.dc_social_guard_v5();
create trigger dc_club_claim_guard before update or delete on public.dc_club_claims for each row execute function public.dc_social_guard_v5();

do $$ declare f record;begin
 for f in select p.proname,p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);
  if f.proname in('dc_bootstrap','dc_get','dc_reconcile','dc_preview','dc_dispatch','dc_collect','dc_sell','dc_upgrade','dc_hire','dc_train','dc_assign_equipment','dc_repair_equipment','dc_start_production','dc_collect_production','dc_retire_equipment','dc_preview_operation','dc_dispatch_operation','dc_resolve_discovery','dc_start_research','dc_fulfill_contract','dc_claim_milestone','dc_get_club','dc_set_social_preferences','dc_contribute_project','dc_claim_project') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
