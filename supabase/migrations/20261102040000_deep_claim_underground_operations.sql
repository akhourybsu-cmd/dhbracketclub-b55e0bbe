-- Deep Claim Phase 3. Versioned field operations, delay-only incidents and
-- finite recovered finds. Existing worlds, chunks and tickets are preserved.
begin;

-- Match the application's company -> expedition lock order before pinning any
-- pending old plan. This waits out old writes and closes the cutover race.
lock table public.dc_companies in access exclusive mode;
lock table public.dc_expeditions in share row exclusive mode;
-- Invalidate pre-cutover quotes without touching economic or worker state.
-- Already committed requests still replay before the revision check.
update public.dc_companies set revision=revision+1;
do $pin_old$
declare coordinate record;seed_value uuid;version_value integer;
begin
 for coordinate in
  select distinct q.company_id,(q.point->>'x')::integer x,(q.point->>'y')::integer y from(
   select m.company_id,p.value point from public.dc_milestones m join public.dc_expeditions e on e.id=m.job_id
    cross join lateral jsonb_array_elements(coalesce(m.payload->'reveals','[]')||coalesce(m.payload->'extractions','[]'))p
    where e.config_version in(1,2) and m.kind='work' and m.applied_at is null
   union all
   select e.company_id,p.value from public.dc_expeditions e join public.dc_plans plan on plan.job_id=e.id
    cross join lateral jsonb_array_elements(coalesce(plan.content->'reveals','[]')||coalesce(plan.content->'extractions','[]'))p
    where e.config_version in(1,2) and e.status='active'
  )q
 loop
  version_value:=public.dc_chunk_version_v2(coordinate.company_id,coordinate.x,coordinate.y);
  select seed into seed_value from public.dc_worlds where company_id=coordinate.company_id;
  insert into public.dc_chunks values(coordinate.company_id,coordinate.x/32,coordinate.y/32,version_value,
   md5(seed_value::text||':'||version_value||':'||coordinate.x/32||':'||coordinate.y/32)) on conflict do nothing;
 end loop;
end $pin_old$;

insert into public.dc_rules(version,config) values(3,$dc_phase3_catalog${"version":3,"infrastructure":[{"key":"supports","name":"Timber Supports","description":"Reduces instability incident chance at covered sites.","cash_cost":12,"materials":{"stone":8,"clay":2}},{"key":"ventilation","name":"Ventilation","description":"Reduces gas incident chance at covered sites.","cash_cost":18,"materials":{"copper_bar":1,"coal":2}},{"key":"pump","name":"Drainage Pump","description":"Reduces water incident chance at covered sites.","cash_cost":22,"materials":{"iron_bar":1,"stone":4}},{"key":"rail","name":"Haul Rail","description":"Shortens travel and return along a covered known route.","cash_cost":16,"materials":{"iron_bar":1,"stone":2}}],"discoveries":[{"key":"banded_geode","name":"Banded Geode","description":"Pale quartz bands curl around a sealed crystal pocket.","min_depth":0,"base_value":30,"base_mass_grams":320,"salvage":{"quartz":2,"stone":3}},{"key":"fern_fossil","name":"Fern Fossil","description":"A branching fern impression rests in a dark sediment plate.","min_depth":32,"base_value":45,"base_mass_grams":480,"salvage":{"coal":3,"clay":2}},{"key":"survey_journal","name":"Survey Journal","description":"A copper-bound field book preserves a long-abandoned survey.","min_depth":32,"base_value":60,"base_mass_grams":180,"salvage":{"copper_bar":1,"stone":2}},{"key":"rail_relic","name":"Rail Relic","description":"A stamped iron gauge marks an earlier underground railway.","min_depth":50,"base_value":80,"base_mass_grams":1700,"salvage":{"iron_bar":1,"stone":4}},{"key":"crystal_cluster","name":"Crystal Cluster","description":"Interlocking violet points grew undisturbed in the deep rock.","min_depth":160,"base_value":150,"base_mass_grams":760,"salvage":{"amethyst":2,"quartz":2}},{"key":"meteorite_fragment","name":"Meteorite Fragment","description":"A dense silver-flecked fragment carries an ancient impact crust.","min_depth":320,"base_value":180,"base_mass_grams":2100,"salvage":{"iron_bar":1,"silver_ore":2,"stone":4}}],"qualities":[{"key":"common","name":"Common","weight":60,"value_percent":100,"mass_percent":100,"salvage_multiplier":1},{"key":"fine","name":"Fine","weight":25,"value_percent":150,"mass_percent":115,"salvage_multiplier":1},{"key":"exceptional","name":"Exceptional","weight":12,"value_percent":220,"mass_percent":135,"salvage_multiplier":2},{"key":"flawless","name":"Flawless","weight":3,"value_percent":300,"mass_percent":160,"salvage_multiplier":3}],"caps":{"infrastructure":128,"pending_dispatch":24,"pending_max":48,"finds_per_job":8,"kept_visible":24,"resolved_visible":12,"reports_visible":24},"survey":{"radius_cap":4,"tile_limit_cap":41},"hazards":{"chance_cap":25,"delay_cap_seconds":300,"safe_depth":8,"kind_order":["rockfall","gas","water"]},"shaft":{"max_level":5,"upgrade_cost":12000,"max_depth":599,"corridor_depth":556},"regions":[{"key":"surface","name":"Surface","min_depth":0,"max_depth":49},{"key":"ironworks","name":"Ironworks","min_depth":50,"max_depth":159},{"key":"glittering","name":"Glittering","min_depth":160,"max_depth":319},{"key":"forgotten","name":"Forgotten","min_depth":320,"max_depth":599}],"generation":{"version":3,"min_chunk_y":1,"macro_size":24,"activation_percent":55,"center_offset_min":4,"center_offset_range":17,"radius_x_min":3,"radius_x_range":6,"radius_y_min":2,"radius_y_range":4}}$dc_phase3_catalog$::jsonb);
alter table public.dc_companies alter column rules_version set default 3;
alter table public.dc_companies drop constraint dc_companies_shaft_level_check;
alter table public.dc_companies add constraint dc_companies_shaft_level_check check(shaft_level between 1 and 5);
alter table public.dc_expeditions drop constraint dc_expeditions_mode_check;
alter table public.dc_expeditions add constraint dc_expeditions_mode_check check(mode in('explore','extract','survey','infrastructure'));
alter table public.dc_expeditions drop constraint dc_expeditions_duration_seconds_check;
alter table public.dc_expeditions add constraint dc_expeditions_duration_seconds_check check(
 (config_version in(1,2) and duration_seconds in(30,1200,3600,10800)) or
 (config_version=3 and ((tutorial and duration_seconds=30) or (not tutorial and duration_seconds between duration_minutes*60 and duration_minutes*60+300))));
alter table public.dc_tiles add column formation text check(formation in('cavern','wet_cavern','crystal_cavern','ruins'));

create table public.dc_infrastructure(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.dc_companies(id),
 job_id uuid not null unique references public.dc_expeditions(id),key text not null check(key in('supports','ventilation','pump','rail')),
 x integer not null check(x between 0 and 95),y integer not null check(y>=1),grade integer not null check(grade between 1 and 3),
 radius integer not null check(radius between 6 and 12),strength integer not null check(strength between 5 and 40),
 status text not null default 'building' check(status in('building','installed')),installed_at timestamptz,unique(company_id,x,y),check((status='installed')=(installed_at is not null)));
create index dc_infrastructure_coverage on public.dc_infrastructure(company_id,key) where status='installed';
create table public.dc_discoveries(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.dc_companies(id),
 job_id uuid not null references public.dc_expeditions(id),x integer not null check(x between 0 and 95),y integer not null check(y>=1),
 kind text not null check(kind in('banded_geode','fern_fossil','survey_journal','rail_relic','crystal_cluster','meteorite_fragment')),
 name text not null,quality text not null check(quality in('common','fine','exceptional','flawless')),detail text not null,
 sale_value integer not null check(sale_value between 15 and 500),salvage jsonb not null,
 status text not null default 'planned' check(status in('planned','pending','kept','sold','salvaged')),
 discovered_at timestamptz,resolved_at timestamptz,unique(company_id,x,y),
 check((status='planned')=(discovered_at is null)),check((status in('kept','sold','salvaged'))=(resolved_at is not null)));
create index dc_discovery_collection on public.dc_discoveries(company_id,status,discovered_at desc,id desc);
create table public.dc_field_events(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.dc_companies(id),
 job_id uuid not null references public.dc_expeditions(id),event_key text not null,kind text not null check(kind in('incident','survey','infrastructure','discovery')),
 due_at timestamptz not null,payload jsonb not null,result jsonb not null default '{}',applied_at timestamptz,unique(job_id,event_key));
create index dc_field_due on public.dc_field_events(company_id,due_at) where applied_at is null;
create index dc_field_reports on public.dc_field_events(company_id,due_at desc,id desc) where applied_at is not null;
do $$ declare t text;begin
 foreach t in array array['dc_infrastructure','dc_discoveries','dc_field_events'] loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create or replace function public.dc_current_ticket_v3() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.config_version<>3 then raise exception 'Expedition rules changed. Refresh and review the new quote.' using errcode='40001';end if;return new;
end $$;
create trigger dc_current_ticket before insert on public.dc_expeditions for each row execute function public.dc_current_ticket_v3();

do $bases$
declare item text;signature text;definition text;
begin
 foreach item in array array['dc_preview_v1','dc_snapshot_v1','dc_reconcile_v1','dc_buildings_v2','dc_upgrade'] loop
  signature:=case item when 'dc_preview_v1' then '(uuid,uuid[],text,integer,integer,integer,boolean,timestamptz)' when 'dc_buildings_v2' then '(dc_companies)' when 'dc_upgrade' then '(text,integer,uuid)' else '(uuid,timestamptz)' end;
  definition:=pg_get_functiondef(to_regprocedure('public.'||item||signature));
  if to_regprocedure('public.'||item||'_phase2_base'||signature) is not null then raise exception 'Deep Claim Phase 3 adapter already exists';end if;
  execute replace(definition,'FUNCTION public.'||item||'(','FUNCTION public.'||item||'_phase2_base(');
 end loop;
 -- The private quote copy alone needs the new technological ceiling. Old
 -- tickets retain their stored route, quantities and exact timestamps.
 definition:=pg_get_functiondef('public.dc_preview_v1_phase2_base(uuid,uuid[],text,integer,integer,integer,boolean,timestamptz)'::regprocedure);
 if position('when 3 then 149 else 299 end' in definition)=0 then raise exception 'Deep Claim quote depth adapter changed';end if;
 execute replace(definition,'when 3 then 149 else 299 end','when 3 then 149 when 4 then 299 else 599 end');
end $bases$;

create or replace function public.dc_field_catalog_v3() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$select config from public.dc_rules where version=3$$;
create or replace function public.dc_hash_v3(p_company uuid,p_namespace text,p_x integer,p_y integer) returns bigint language sql stable security definer set search_path=public,pg_temp as $$
 select ('x'||substr(md5('dc3:'||p_namespace||':'||seed::text||':'||p_x||':'||p_y),1,8))::bit(32)::bigint from public.dc_worlds where company_id=p_company
$$;
create or replace function public.dc_server_entropy_v3() returns uuid language sql volatile security definer set search_path=public,pg_temp as $$select gen_random_uuid()$$;
create or replace function public.dc_incident_roll_v3(p_seed uuid,p_chance integer) returns boolean language sql immutable as $$
 select ('x'||substr(md5('dc3:incident:'||p_seed::text),1,8))::bit(32)::bigint%100<greatest(0,least(25,p_chance))
$$;
create or replace function public.dc_chunk_version_v2(p_company uuid,p_x integer,p_y integer) returns integer language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select world_version from public.dc_chunks where company_id=p_company and chunk_x=p_x/32 and chunk_y=p_y/32),case when p_y/32>=1 then 3 else 1 end)
$$;
create or replace function public.dc_pin_chunks_v3(p_company uuid,p_coordinates jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare point jsonb;world_seed uuid;version_value integer;
begin
 select seed into world_seed from public.dc_worlds where company_id=p_company;
 for point in select value from jsonb_array_elements(p_coordinates) loop
  version_value:=public.dc_chunk_version_v2(p_company,(point->>'x')::integer,(point->>'y')::integer);
  insert into public.dc_chunks values(p_company,(point->>'x')::integer/32,(point->>'y')::integer/32,version_value,
   md5(world_seed::text||':'||version_value||':'||(point->>'x')::integer/32||':'||(point->>'y')::integer/32)) on conflict do nothing;
 end loop;
end $$;
create or replace function public.dc_formation_v3(p_company uuid,p_x integer,p_y integer) returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare mx integer;my integer;cx integer;cy integer;rx integer;ry integer;h bigint;formation text;
begin
 if p_x=48 then return null;end if;
 for my in greatest(0,p_y/24-1)..p_y/24+1 loop
  for mx in greatest(0,p_x/24-1)..least(3,p_x/24+1) loop
   h:=public.dc_hash_v3(p_company,'room_active',mx,my);if h%100>=55 then continue;end if;
   cx:=24*mx+4+(public.dc_hash_v3(p_company,'room_x',mx,my)%17)::integer;
   cy:=24*my+4+(public.dc_hash_v3(p_company,'room_y',mx,my)%17)::integer;
   rx:=3+(public.dc_hash_v3(p_company,'room_rx',mx,my)%6)::integer;ry:=2+(public.dc_hash_v3(p_company,'room_ry',mx,my)%4)::integer;
   if (p_x-cx)^2*ry^2+(p_y-cy)^2*rx^2<=rx^2*ry^2 then
    formation:=case when cy>=320 then 'ruins' when cy>=160 then case h%3 when 0 then 'crystal_cavern' when 1 then 'wet_cavern' else 'cavern' end
     when cy>=50 and h%3=0 then 'wet_cavern' else 'cavern' end;return formation;
   end if;
  end loop;
 end loop;return null;
end $$;
create or replace function public.dc_cell_v3(p_company uuid,p_x integer,p_y integer) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare formation text;base jsonb;
begin
 if p_x not between 0 and 95 or p_y<0 then raise exception 'Invalid mine coordinate';end if;
 formation:=public.dc_formation_v3(p_company,p_x,p_y);
 if formation is not null then return jsonb_build_object('material',null,'initial_amount',0,'formation',formation);end if;
 base:=case when p_y<160 then public.dc_cell_v1_phase1_base(p_company,p_x,p_y) else public.dc_cell_v2(p_company,p_x,p_y) end;
 return base||jsonb_build_object('formation',null);
end $$;
create or replace function public.dc_cell_v1(p_company uuid,p_x integer,p_y integer) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare version_value integer:=public.dc_chunk_version_v2(p_company,p_x,p_y);
begin
 if version_value=3 then return public.dc_cell_v3(p_company,p_x,p_y);elsif version_value=2 then return public.dc_cell_v2(p_company,p_x,p_y);end if;
 return public.dc_cell_v1_phase1_base(p_company,p_x,p_y);
end $$;
create or replace function public.dc_reveal_v1(p_company uuid,p_x integer,p_y integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare cell jsonb;world_seed uuid;version_value integer;
begin
 if exists(select 1 from public.dc_tiles where company_id=p_company and x=p_x and y=p_y) then return;end if;
 version_value:=public.dc_chunk_version_v2(p_company,p_x,p_y);cell:=public.dc_cell_v1(p_company,p_x,p_y);select seed into world_seed from public.dc_worlds where company_id=p_company;
 insert into public.dc_chunks values(p_company,p_x/32,p_y/32,version_value,md5(world_seed::text||':'||version_value||':'||p_x/32||':'||p_y/32)) on conflict do nothing;
 insert into public.dc_tiles(company_id,x,y,material,initial_amount,remaining,revealed_at,formation)
 values(p_company,p_x,p_y,cell->>'material',(cell->>'initial_amount')::integer,(cell->>'initial_amount')::integer,clock_timestamp(),cell->>'formation');
end $$;

create or replace function public.dc_crew_v3(p_company uuid,p_workers uuid[]) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare w public.dc_workers%rowtype;s jsonb;key text;n integer:=0;totals jsonb:='{"mining":0,"geology":0,"engineering":0,"logistics":0,"safety":0,"endurance":0}';result jsonb:='{}';leadership integer:=0;swing integer:=0;deliberate integer:=0;eyes integer:=0;
begin
 for w in select * from public.dc_workers where company_id=p_company and id=any(p_workers) loop
  n:=n+1;s:=public.dc_stats_v1(w);leadership:=greatest(leadership,(s->>'leadership')::integer);
  foreach key in array array['mining','geology','engineering','logistics','safety','endurance'] loop totals:=jsonb_set(totals,array[key],to_jsonb((totals->>key)::integer+(s->>key)::integer));end loop;
  swing:=swing+case when 'sure_swing'=any(w.traits) then 1 else 0 end;deliberate:=deliberate+case when 'deliberate'=any(w.traits) then 1 else 0 end;eyes:=eyes+case when 'ore_eye'=any(w.traits) then 1 else 0 end;
 end loop;
 foreach key in array array['mining','geology','engineering','logistics','safety','endurance'] loop result:=result||jsonb_build_object(key,case when n=0 then 0 else (totals->>key)::integer/n end);end loop;
 return result||jsonb_build_object('count',n,'leadership',leadership,'swing',swing,'deliberate',deliberate,'ore_eye',eyes);
end $$;
create or replace function public.dc_conditions_v3(p_company uuid,p_x integer,p_y integer,p_energy integer,p_safety integer,p_route jsonb,p_tutorial boolean) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare instability integer:=least(3,1+p_y/100);gas integer:=case when p_y<50 then 0 else least(3,1+p_y/150) end;
 water integer:=case when p_y<100 then 0 else least(3,1+(p_y-100)/150) end;support integer:=0;vent integer:=0;pump integer:=0;
 chosen public.dc_infrastructure%rowtype;point jsonb;ids jsonb:='{}';rail_total integer:=0;rail_bonus integer:=0;chance integer;delay integer;kind text;
begin
 foreach kind in array array['supports','ventilation','pump'] loop
  if (kind='supports' and instability>0) or (kind='ventilation' and gas>0) or (kind='pump' and water>0) then
   select * into chosen from public.dc_infrastructure i where i.company_id=p_company and i.key=kind and i.status='installed' and abs(i.x-p_x)+abs(i.y-p_y)<=i.radius order by i.strength desc,i.id limit 1;
   if found then
    ids:=ids||jsonb_build_object(chosen.id::text,true);if kind='supports' then support:=chosen.strength;elsif kind='ventilation' then vent:=chosen.strength;else pump:=chosen.strength;end if;
   end if;
  end if;
 end loop;
 if not p_tutorial then
  for point in select value from jsonb_array_elements(p_route) loop
   select * into chosen from public.dc_infrastructure i where i.company_id=p_company and i.key='rail' and i.status='installed' and abs(i.x-(point->>'x')::integer)+abs(i.y-(point->>'y')::integer)<=i.radius order by i.strength desc,i.id limit 1;
   if found then rail_total:=rail_total+chosen.strength;ids:=ids||jsonb_build_object(chosen.id::text,true);end if;
  end loop;
  if jsonb_array_length(p_route)>0 then rail_bonus:=least(40,rail_total/jsonb_array_length(p_route));end if;
 end if;
 chance:=case when p_tutorial or p_y<8 then 0 else greatest(0,least(25,4+p_y/25+2*instability+gas+water)-p_safety/10-support-vent-pump) end;
 delay:=case when chance=0 then 0 else least(300,60*p_energy+p_y/10) end;
 return jsonb_build_object('instability',instability,'gas',gas,'water',water,'incident_chance_percent',chance,'max_delay_seconds',delay,
  'transport_bonus_percent',rail_bonus,'infrastructure_ids',(select coalesce(jsonb_agg(key order by key),'[]') from jsonb_object_keys(ids)key));
end $$;
create or replace function public.dc_preview_operation_v3(p_company uuid,p_workers uuid[],p_mode text,p_x integer,p_y integer,p_minutes integer,p_tutorial boolean,p_infrastructure_key text,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.dc_companies%rowtype;quote jsonb;crew jsonb;conditions jsonb;reasons jsonb;stage jsonb;stages jsonb:='[]';definition jsonb;
 auxiliary boolean:=p_mode in('survey','infrastructure');valid_input boolean;depth integer;grade integer;engineering integer;radius integer;tile_limit integer;fee integer:=0;materials jsonb:='{}';installation jsonb:=null;survey jsonb:=null;survey_reveals jsonb:='[]';resource record;
 old_travel integer;old_return integer;old_work integer;new_travel integer;new_return integer;new_work integer;fixed_seconds integer;bonus integer;quantity integer;n integer;energy integer;remaining integer;mineral text;
begin
 if p_mode is null or p_mode not in('explore','extract','survey','infrastructure') or p_x is null or p_x not between 0 and 95 or p_y is null or p_y not between 1 and 599
  or p_minutes is null or p_minutes not in(20,60,180) or p_tutorial is null or coalesce(cardinality(p_workers),0) not between 1 and 3
  or array_ndims(p_workers) is distinct from 1 or array_lower(p_workers,1) is distinct from 1 or exists(select 1 from unnest(p_workers)w where w is null)
  or (select count(distinct w) from unnest(p_workers)w)<>cardinality(p_workers) then raise exception 'Choose valid workers, operation, target and expedition preset.';end if;
 if p_tutorial and (p_mode<>'extract' or p_minutes<>20) then raise exception 'The accelerated starter expedition uses Quick extraction only.';end if;
 select * into c from public.dc_companies where id=p_company;depth:=case c.shaft_level when 1 then 49 when 2 then 99 when 3 then 149 when 4 then 299 else 599 end;
 valid_input:=coalesce(p_mode in('explore','extract','survey','infrastructure') and p_x between 0 and 95 and p_y between 1 and depth and p_minutes in(20,60,180) and p_tutorial is not null and (not p_tutorial or p_mode='extract'),false);
 quote:=public.dc_preview_v1_phase2_base(p_company,p_workers,case when auxiliary then 'extract' else p_mode end,p_x,p_y,p_minutes,p_tutorial,p_now);
 reasons:=quote->'reasons';crew:=public.dc_crew_v3(p_company,p_workers);n:=(crew->>'count')::integer;energy:=(quote->>'energy_per_worker')::integer;engineering:=(crew->>'engineering')::integer;
 if auxiliary then
  select coalesce(jsonb_agg(value),'[]') into reasons from jsonb_array_elements(reasons) e(value)
   where value#>>'{}'<>'Choose a revealed, undepleted deposit.' and not(valid_input and p_x=48 and value#>>'{}'='Choose a supported target and expedition preset.');
  if not exists(select 1 from public.dc_tiles target where target.company_id=p_company and target.x=p_x and target.y=p_y and target.remaining=0) then reasons:=reasons||jsonb_build_array('Choose a revealed, excavated worksite connected to the shaft.');end if;
  if p_tutorial then reasons:=reasons||jsonb_build_array('The accelerated starter expedition is for extraction only.');end if;
  quote:=quote||jsonb_build_object('_quantity',0,'estimated_yield',jsonb_build_object('min',0,'max',0),'expected_resources','[]'::jsonb);
 end if;
 if not valid_input then reasons:=reasons||jsonb_build_array('Choose a supported operation, target and expedition preset.');end if;
 if (p_mode<>'infrastructure' and p_infrastructure_key is not null) then reasons:=reasons||jsonb_build_array('Infrastructure choices belong to infrastructure operations.');end if;
 if (select count(*) from public.dc_discoveries where company_id=p_company and status='pending')>=24 then reasons:=reasons||jsonb_build_array('Review your recovered finds before dispatching another crew.');end if;
 grade:=case p_minutes when 20 then 1 when 60 then 2 when 180 then 3 else 0 end;
 if p_mode='survey' then
  radius:=least(4,grade+(crew->>'geology')::integer/50);tile_limit:=least(41,grade*8+(crew->>'geology')::integer/10+2*(crew->>'ore_eye')::integer);
  select coalesce(jsonb_agg(jsonb_build_object('x',q.x,'y',q.y) order by q.distance,q.x,q.y),'[]') into survey_reveals from(
   select p_x+o.dx x,p_y+o.dy y,abs(o.dx)+abs(o.dy) distance from generate_series(-radius,radius)gx(dx) cross join generate_series(-radius,radius)gy(dy) cross join lateral(select gx.dx,gy.dy)o
   where abs(o.dx)+abs(o.dy)<=radius and p_x+o.dx between 0 and 95 and p_y+o.dy between 1 and depth
    and not exists(select 1 from public.dc_tiles t where t.company_id=p_company and t.x=p_x+o.dx and t.y=p_y+o.dy)
   order by abs(o.dx)+abs(o.dy),p_x+o.dx,p_y+o.dy limit tile_limit
  )q;
  if jsonb_array_length(survey_reveals)=0 then reasons:=reasons||jsonb_build_array('This survey area has no unexplored cells. Choose another site.');end if;
  survey:=jsonb_build_object('radius',radius,'tile_limit',tile_limit);
 elsif p_mode='infrastructure' then
  select value into definition from jsonb_array_elements(public.dc_field_catalog_v3()->'infrastructure') where value->>'key'=p_infrastructure_key;
  if definition is null then reasons:=reasons||jsonb_build_array('Choose an infrastructure project.');
  else
   fee:=(definition->>'cash_cost')::integer*grade;radius:=6+2*(grade-1)+engineering/50;
   installation:=jsonb_build_object('key',p_infrastructure_key,'grade',grade,'radius',radius,'strength',case when p_infrastructure_key='rail' then least(40,5+10*grade+engineering/20) else 3+2*grade+engineering/25 end);
   for resource in select key,(value::text)::integer*grade units from jsonb_each(definition->'materials') loop
    materials:=materials||jsonb_build_object(resource.key,resource.units);
    if not exists(select 1 from public.dc_inventory stock where stock.company_id=p_company and stock.resource_key=resource.key and stock.quantity>=resource.units) then reasons:=reasons||jsonb_build_array('Not enough collected materials for this infrastructure project.');end if;
   end loop;
  end if;
  if exists(select 1 from public.dc_infrastructure where company_id=p_company and x=p_x and y=p_y) then reasons:=reasons||jsonb_build_array('This cell already has an infrastructure project.');end if;
  if (select count(*) from public.dc_infrastructure where company_id=p_company)>=128 then reasons:=reasons||jsonb_build_array('The company infrastructure limit has been reached.');end if;
 end if;

 conditions:=public.dc_conditions_v3(p_company,coalesce(p_x,0),coalesce(p_y,0),energy,(crew->>'safety')::integer,quote->'route',coalesce(p_tutorial,false));
 bonus:=(conditions->>'transport_bonus_percent')::integer;
 select (value->>'duration_seconds')::integer into old_travel from jsonb_array_elements(quote->'stages') where value->>'key'='travel';
 select (value->>'duration_seconds')::integer into old_return from jsonb_array_elements(quote->'stages') where value->>'key'='return';
 select (value->>'duration_seconds')::integer into old_work from jsonb_array_elements(quote->'stages') where value->>'key'='work';
 new_travel:=old_travel;new_return:=old_return;
 if not coalesce(p_tutorial,false) then new_travel:=greatest(20,ceil(old_travel*(100-bonus)/100.0)::integer);new_return:=greatest(20,ceil(old_return*(100-bonus)/100.0)::integer);end if;
 select sum((value->>'duration_seconds')::integer) into fixed_seconds from jsonb_array_elements(quote->'stages') where value->>'key' in('setup','haul');
 new_work:=(quote->>'duration_seconds')::integer-new_travel-new_return-fixed_seconds;
 if new_work<30 and not p_tutorial then raise exception 'Choose a longer expedition for this travel route.';end if;
 select coalesce(jsonb_agg(value),'[]') into reasons from jsonb_array_elements(reasons)e(value) where value#>>'{}'<>'Choose a longer expedition for this travel route.';
 for stage in select value from jsonb_array_elements(quote->'stages') loop
  stages:=stages||jsonb_build_array(case stage->>'key' when 'travel' then jsonb_set(stage,'{duration_seconds}',to_jsonb(new_travel)) when 'return' then jsonb_set(stage,'{duration_seconds}',to_jsonb(new_return)) when 'work' then jsonb_set(stage,'{duration_seconds}',to_jsonb(new_work)) else stage end);
 end loop;
 if p_mode='extract' and bonus>0 and n>0 and not coalesce(p_tutorial,false) then
  select t.material,t.remaining into mineral,remaining from public.dc_tiles t where t.company_id=p_company and t.x=p_x and t.y=p_y;
  quantity:=greatest(1,floor(greatest(0,new_work)/60.0*n*(20+(crew->>'mining')::integer)/100*(70+(crew->>'safety')::integer)/100*(90+(crew->>'geology')::numeric/4)/100*
   (100-(energy-1)*greatest(0,80-(crew->>'endurance')::integer)/5.0)/100*(100+(crew->>'leadership')::numeric*(n-1)/10)/100*(100+25*(c.tool_level-1))/100*
   (100+(10.0*(crew->>'swing')::integer-5.0*(crew->>'deliberate')::integer)/n)/100/public.dc_hardness_v1(mineral))::integer);
  quantity:=least(quantity,coalesce(remaining,0),(quote->>'cargo_capacity')::integer);
  quote:=quote||jsonb_build_object('_quantity',quantity,'estimated_yield',jsonb_build_object('min',floor(quantity*0.8)::integer,'max',least((quote->>'cargo_capacity')::integer,coalesce(remaining,0),ceil(quantity*1.2)::integer)));
 end if;
 -- A rail network may make an otherwise marginal known seam viable. Recheck
 -- the operating reserve using the final authoritative extraction quantity.
 if p_mode='extract' and bonus>0 and not p_tutorial then
  select coalesce(jsonb_agg(value),'[]') into reasons from jsonb_array_elements(reasons)e(value)
   where value#>>'{}'<>'Keep enough operating cash or recoverable stock for another dispatch.';
  if c.cash-(quote->>'wages')::integer+coalesce((select sum(stock.quantity*public.dc_price_v1(stock.resource_key)) from public.dc_inventory stock where stock.company_id=p_company),0)+
    coalesce((quote->>'_quantity')::integer,0)*coalesce(public.dc_price_v1(mineral),1)<2 then
   reasons:=reasons||jsonb_build_array('Keep enough operating cash or recoverable stock for another dispatch.');
  end if;
 end if;
 if auxiliary then
  select coalesce(jsonb_agg(value),'[]') into reasons from jsonb_array_elements(reasons)e(value)
   where value#>>'{}'<>'Keep enough operating cash or recoverable stock for another dispatch.';
  if c.cash<(quote->>'wages')::integer+fee then reasons:=reasons||jsonb_build_array('Not enough cash for upfront crew wages and project costs.');end if;
  if c.cash-(quote->>'wages')::integer-fee+
    coalesce((select sum(stock.quantity*public.dc_price_v1(stock.resource_key)) from public.dc_inventory stock where stock.company_id=p_company),0)-
    coalesce((select sum((cost.value::text)::integer*public.dc_price_v1(cost.key)) from jsonb_each(materials)cost),0)<2 then
   reasons:=reasons||jsonb_build_array('Keep $2 operating cash or collected stock after wages and project costs.');
  end if;
 end if;
 if p_mode='explore' then quote:=jsonb_set(quote,'{estimated_yield,min}','0'::jsonb);end if;
 return quote||jsonb_build_object('allowed',jsonb_array_length(reasons)=0,'reasons',reasons,'stages',stages,'operation_version',3,'operation_cost',fee,'materials_cost',materials,'conditions',conditions,'survey',survey,'installation',installation,'_survey_reveals',survey_reveals);
end $$;

create or replace function public.dc_incident_kind_v3(p_company uuid,p_conditions jsonb) returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare rock integer:=(p_conditions->>'instability')::integer*100;gas integer:=(p_conditions->>'gas')::integer*100;water integer:=(p_conditions->>'water')::integer*100;i public.dc_infrastructure%rowtype;
begin
 for i in select * from public.dc_infrastructure where company_id=p_company and id::text in(select jsonb_array_elements_text(p_conditions->'infrastructure_ids')) loop
  if i.key='supports' then rock:=rock-i.strength;elsif i.key='ventilation' then gas:=gas-i.strength;elsif i.key='pump' then water:=water-i.strength;end if;
 end loop;
 return case when rock>=gas and rock>=water then 'rockfall' when gas>=water then 'gas' else 'water' end;
end $$;
create or replace function public.dc_specimen_v3(p_company uuid,p_x integer,p_y integer) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare eligible jsonb;definition jsonb;quality jsonb;quality_roll integer;salvage jsonb:='{}';resource record;mass integer;
begin
 if p_x=47 and p_y=3 then select value into definition from jsonb_array_elements(public.dc_field_catalog_v3()->'discoveries') where value->>'key'='banded_geode';
 else
  if public.dc_hash_v3(p_company,'find_chance',p_x,p_y)%13<>0 then return null;end if;
  select jsonb_agg(value order by ord) into eligible from jsonb_array_elements(public.dc_field_catalog_v3()->'discoveries') with ordinality e(value,ord) where (value->>'min_depth')::integer<=p_y;
  definition:=eligible->(public.dc_hash_v3(p_company,'find_kind',p_x,p_y)%jsonb_array_length(eligible))::integer;
 end if;
 quality_roll:=(public.dc_hash_v3(p_company,'find_quality',p_x,p_y)%100)::integer;
 quality:=public.dc_field_catalog_v3()->'qualities'->case when quality_roll<60 then 0 when quality_roll<85 then 1 when quality_roll<97 then 2 else 3 end;
 mass:=floor((definition->>'base_mass_grams')::numeric*(quality->>'mass_percent')::integer/100)::integer;
 for resource in select key,(value::text)::integer units from jsonb_each(definition->'salvage') loop salvage:=salvage||jsonb_build_object(resource.key,resource.units*(quality->>'salvage_multiplier')::integer);end loop;
 return jsonb_build_object('kind',definition->>'key','name',definition->>'name','quality',quality->>'key','detail',(definition->>'description')||' Mass: '||mass||' g.',
  'sale_value',greatest(15,least(500,floor((definition->>'base_value')::numeric*(quality->>'value_percent')::integer/100)::integer)),'salvage',salvage);
end $$;
create or replace function public.dc_setup_field_operation_v3(p_company uuid,p_job uuid,p_quote jsonb,p_extractions jsonb,p_seed uuid,p_delay integer,p_incident_kind text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare job public.dc_expeditions%rowtype;installation jsonb;project uuid;change jsonb;specimen jsonb;discovery uuid;remaining integer;find_count integer:=0;point jsonb;setup_end timestamptz;title text;description text;
begin
 select * into job from public.dc_expeditions where id=p_job and company_id=p_company;
 point:=jsonb_build_object('x',job.target_x,'y',job.target_y);
 if p_delay>0 then
  select (value->>'ends_at')::timestamptz into setup_end from jsonb_array_elements(job.stages) where value->>'key'='setup';
  title:=case p_incident_kind when 'rockfall' then 'Loose rock cleared' when 'gas' then 'Gas pocket ventilated' else 'Water cleared from the worksite' end;
  description:='Setup was delayed by '||p_delay||' seconds. The crew and finite haul are safe.';
  insert into public.dc_field_events(company_id,job_id,event_key,kind,due_at,payload,result) values(p_company,p_job,'incident','incident',setup_end,
   jsonb_build_object('seed',p_seed,'incident_kind',p_incident_kind,'delay',p_delay),jsonb_build_object('title',title,'description',description,'point',point,'delay_seconds',p_delay,'tiles_revealed',0,'infrastructure_id',null,'discovery_id',null));
 end if;
 if job.mode='survey' then
  insert into public.dc_reservations values(p_company,job.target_x,job.target_y,p_job);
  insert into public.dc_field_events(company_id,job_id,event_key,kind,due_at,payload,result) values(p_company,p_job,'operation','survey',job.completes_at,p_quote->'survey',
   jsonb_build_object('title','Survey completed','description','Survey completed.','point',point,'delay_seconds',0,'tiles_revealed',0,'infrastructure_id',null,'discovery_id',null));
 elsif job.mode='infrastructure' then
  installation:=p_quote->'installation';insert into public.dc_reservations values(p_company,job.target_x,job.target_y,p_job);
  insert into public.dc_infrastructure(company_id,job_id,key,x,y,grade,radius,strength)
   values(p_company,p_job,installation->>'key',job.target_x,job.target_y,(installation->>'grade')::integer,(installation->>'radius')::integer,(installation->>'strength')::integer) returning id into project;
  insert into public.dc_field_events(company_id,job_id,event_key,kind,due_at,payload,result) values(p_company,p_job,'operation','infrastructure',job.completes_at,installation,
   jsonb_build_object('title','Infrastructure installed','description','The completed project now protects or improves covered operations.','point',point,'delay_seconds',0,'tiles_revealed',0,'infrastructure_id',project,'discovery_id',null));
 elsif job.mode in('explore','extract') then
  for change in select value from jsonb_array_elements(p_extractions) loop
   exit when find_count>=8;
   select t.remaining into remaining from public.dc_tiles t where t.company_id=p_company and t.x=(change->>'x')::integer and t.y=(change->>'y')::integer;
   if not found then remaining:=(public.dc_cell_v1(p_company,(change->>'x')::integer,(change->>'y')::integer)->>'initial_amount')::integer;end if;
   if remaining<=0 or (change->>'quantity')::integer<>remaining or exists(select 1 from public.dc_discoveries where company_id=p_company and x=(change->>'x')::integer and y=(change->>'y')::integer) then continue;end if;
   specimen:=public.dc_specimen_v3(p_company,(change->>'x')::integer,(change->>'y')::integer);if specimen is null then continue;end if;
   insert into public.dc_discoveries(company_id,job_id,x,y,kind,name,quality,detail,sale_value,salvage)
    values(p_company,p_job,(change->>'x')::integer,(change->>'y')::integer,specimen->>'kind',specimen->>'name',specimen->>'quality',specimen->>'detail',(specimen->>'sale_value')::integer,specimen->'salvage') returning id into discovery;
   insert into public.dc_field_events(company_id,job_id,event_key,kind,due_at,payload,result) values(p_company,p_job,'find:'||discovery,'discovery',job.completes_at,jsonb_build_object('discovery_id',discovery),
    jsonb_build_object('title','Recovered '||(specimen->>'name'),'description',specimen->>'detail','point',jsonb_build_object('x',(change->>'x')::integer,'y',(change->>'y')::integer),'delay_seconds',0,'tiles_revealed',0,'infrastructure_id',null,'discovery_id',discovery));
   find_count:=find_count+1;
  end loop;
 end if;
end $$;
create or replace function public.dc_freeze_equipment_v2(p_company uuid,p_job uuid,p_workers uuid[],p_energy integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.dc_expeditions where id=p_job and company_id=p_company and config_version=3) then raise exception 'Expedition rules changed. Refresh and review the new quote.' using errcode='40001';end if;
 insert into public.dc_job_equipment(job_id,item_id,wear_amount,initial_durability) select p_job,id,2*p_energy,durability from public.dc_equipment where company_id=p_company and worker_id=any(p_workers) and retired_at is null;
end $$;
create or replace function public.dc_replace_required_v3(p_source text,p_anchor text,p_replacement text) returns text language plpgsql immutable as $$
begin if position(p_anchor in p_source)=0 then raise exception 'Deep Claim operation adapter changed; review before applying';end if;return replace(p_source,p_anchor,p_replacement);end $$;

do $dispatch$
declare definition text;
begin
 definition:=pg_get_functiondef('public.dc_dispatch(uuid[],text,integer,integer,integer,boolean,integer,uuid)'::regprocedure);
 definition:=public.dc_replace_required_v3(definition,'FUNCTION public.dc_dispatch(','FUNCTION public.dc_dispatch_v3_impl(');
 definition:=public.dc_replace_required_v3(definition,'p_tutorial boolean, p_expected_revision integer','p_tutorial boolean, p_infrastructure_key text, p_expected_revision integer');
 definition:=public.dc_replace_required_v3(definition,'p_tutorial,''expected_revision'',p_expected_revision','p_tutorial,''infrastructure_key'',p_infrastructure_key,''expected_revision'',p_expected_revision');
 definition:=replace(definition,'''dispatch'',payload','''dispatch_operation'',payload');
 definition:=public.dc_replace_required_v3(definition,'quote:=public.dc_preview_v1(company,p_worker_ids,p_mode,p_target_x,p_target_y,p_duration_minutes,p_tutorial,moment);','quote:=public.dc_preview_operation_v3(company,p_worker_ids,p_mode,p_target_x,p_target_y,p_duration_minutes,p_tutorial,p_infrastructure_key,moment);');
 definition:=public.dc_replace_required_v3(definition,'offset_units integer;','offset_units integer; incident_seed uuid; incident_delay integer; incident_kind text; material_input record; stage_seconds integer;');
 definition:=public.dc_replace_required_v3(definition,'else'||chr(10)||'  -- Scouting progresses', 'elsif p_mode in(''survey'',''infrastructure'') then reveals:=quote->''_survey_reveals'';'||chr(10)||' else'||chr(10)||'  -- Scouting progresses');
 definition:=public.dc_replace_required_v3(definition,'seen:=seen||jsonb_build_object(cx||'':''||cy,true);','seen:=seen||jsonb_build_object(cx||'':''||cy,true); reveals:=reveals||jsonb_build_array(jsonb_build_object(''x'',cx,''y'',cy));');
 definition:=public.dc_replace_required_v3(definition,'if needed>0 then raise exception ''Choose a frontier with enough route space for this crew'';end if;','-- Natural rooms may contain no ore: preserve every visited reveal and the actual partial or empty haul.');
 definition:=public.dc_replace_required_v3(definition,'if c.cash-(quote->>''wages'')::integer+coalesce(',
  'if c.cash-(quote->>''wages'')::integer-(quote->>''operation_cost'')::integer-coalesce((select sum((cost.value::text)::integer*public.dc_price_v1(cost.key)) from jsonb_each(quote->''materials_cost'')cost),0)+coalesce(');
 definition:=public.dc_replace_required_v3(definition,'cursor_at:=moment;',$plan$
 for material_input in select key,(value::text)::integer units from jsonb_each(quote->'materials_cost') loop
  update public.dc_inventory set quantity=quantity-material_input.units where company_id=company and resource_key=material_input.key and quantity>=material_input.units;
  if not found then raise exception 'Not enough collected materials for this infrastructure project.';end if;
 end loop;
 perform public.dc_pin_chunks_v3(company,reveals||extractions);
 incident_seed:=public.dc_server_entropy_v3();incident_delay:=case when public.dc_incident_roll_v3(incident_seed,(quote->'conditions'->>'incident_chance_percent')::integer) then (quote->'conditions'->>'max_delay_seconds')::integer else 0 end;
 incident_kind:=public.dc_incident_kind_v3(company,quote->'conditions');
 cursor_at:=moment;$plan$);
 definition:=public.dc_replace_required_v3(definition,'for stage in select value from jsonb_array_elements(quote->''stages'') loop','for stage in select value from jsonb_array_elements(quote->''stages'') loop stage_seconds:=(stage->>''duration_seconds'')::integer+case when stage->>''key''=''setup'' then incident_delay else 0 end;');
 definition:=replace(definition,'cursor_at+(stage->>''duration_seconds'')::integer*interval ''1 second''','cursor_at+stage_seconds*interval ''1 second''');
 definition:=public.dc_replace_required_v3(definition,'(quote->>''duration_seconds'')::integer,p_tutorial','(quote->>''duration_seconds'')::integer+incident_delay,p_tutorial');
 definition:=public.dc_replace_required_v3(definition,'(quote->>''energy_per_worker'')::integer,2) returning id into job;','(quote->>''energy_per_worker'')::integer,3) returning id into job;');
 definition:=public.dc_replace_required_v3(definition,'jsonb_build_object(''config_version'',2,''crew''','jsonb_build_object(''config_version'',3,''incident'',jsonb_build_object(''seed'',incident_seed,''delay'',incident_delay,''kind'',incident_kind),''crew''');
 definition:=public.dc_replace_required_v3(definition,'perform public.dc_freeze_equipment_v2(company,job,p_worker_ids,(quote->>''energy_per_worker'')::integer);','perform public.dc_freeze_equipment_v2(company,job,p_worker_ids,(quote->>''energy_per_worker'')::integer); perform public.dc_setup_field_operation_v3(company,job,quote,extractions,incident_seed,incident_delay,incident_kind);');
 definition:=public.dc_replace_required_v3(definition,'cash=cash-(quote->>''wages'')::integer,tutorial_used','cash=cash-(quote->>''wages'')::integer-(quote->>''operation_cost'')::integer,tutorial_used');
 execute definition;
end $dispatch$;

create or replace function public.dc_preview_operation(p_worker_ids uuid[],p_mode text,p_target_x integer,p_target_y integer,p_duration_minutes integer,p_tutorial boolean,p_infrastructure_key text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();
begin return public.dc_preview_operation_v3(company,p_worker_ids,p_mode,p_target_x,p_target_y,p_duration_minutes,p_tutorial,p_infrastructure_key,clock_timestamp())-'_quantity'-'_reveal_count'-'_survey_reveals';end $$;
create or replace function public.dc_preview(p_worker_ids uuid[],p_mode text,p_target_x integer,p_target_y integer,p_duration_minutes integer,p_tutorial boolean default false) returns jsonb
language sql security definer set search_path=public,pg_temp as $$select public.dc_preview_operation(p_worker_ids,p_mode,p_target_x,p_target_y,p_duration_minutes,p_tutorial,null)$$;
create or replace function public.dc_dispatch_operation(p_worker_ids uuid[],p_mode text,p_target_x integer,p_target_y integer,p_duration_minutes integer,p_tutorial boolean,p_infrastructure_key text,p_expected_revision integer,p_request_id uuid) returns jsonb
language sql security definer set search_path=public,pg_temp as $$select public.dc_dispatch_v3_impl(p_worker_ids,p_mode,p_target_x,p_target_y,p_duration_minutes,p_tutorial,p_infrastructure_key,p_expected_revision,p_request_id)$$;
create or replace function public.dc_dispatch(p_worker_ids uuid[],p_mode text,p_target_x integer,p_target_y integer,p_duration_minutes integer,p_tutorial boolean,p_expected_revision integer,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();old_operation text;payload jsonb:=jsonb_build_object('worker_ids',p_worker_ids,'mode',p_mode,'x',p_target_x,'y',p_target_y,'minutes',p_duration_minutes,'tutorial',p_tutorial,'expected_revision',p_expected_revision);
begin
 select operation into old_operation from public.dc_requests where request_id=p_request_id;
 if old_operation='dispatch' then
  if public.dc_receipt_v1(company,p_request_id,'dispatch',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 end if;
 return public.dc_dispatch_v3_impl(p_worker_ids,p_mode,p_target_x,p_target_y,p_duration_minutes,p_tutorial,null,p_expected_revision,p_request_id);
end $$;

create or replace function public.dc_reconcile_v1(p_company uuid,p_now timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.dc_milestones%rowtype;job public.dc_expeditions%rowtype;change jsonb;qty integer;resource_key text;new_reveals integer;changed boolean:=false;wear public.dc_job_equipment%rowtype;event public.dc_field_events%rowtype;
begin
 -- New field events expose nothing until their actual due boundary. A caller
 -- can infer the delay from the honest ETA, but never receives seed/roll data.
 update public.dc_field_events set applied_at=p_now where company_id=p_company and kind='incident' and applied_at is null and due_at<=p_now;
 if found then changed:=true;end if;
 -- Consume config3 milestones first. The retained Phase2/Phase1 executor then
 -- sees only its old unapplied tickets, so old quantities and wear stay exact.
 for m in select milestone.* from public.dc_milestones milestone join public.dc_expeditions e on e.id=milestone.job_id
  where milestone.company_id=p_company and e.config_version=3 and milestone.applied_at is null and milestone.due_at<=p_now order by milestone.due_at,milestone.job_id,milestone.sequence for update of milestone loop
  select * into job from public.dc_expeditions where id=m.job_id;new_reveals:=0;
  if m.kind='work' then
   for change in select value from jsonb_array_elements(m.payload->'reveals') loop
    if not exists(select 1 from public.dc_tiles where company_id=p_company and x=(change->>'x')::integer and y=(change->>'y')::integer) then new_reveals:=new_reveals+1;end if;
    perform public.dc_reveal_v1(p_company,(change->>'x')::integer,(change->>'y')::integer);
   end loop;
   for change in select value from jsonb_array_elements(m.payload->'extractions') loop
    perform public.dc_reveal_v1(p_company,(change->>'x')::integer,(change->>'y')::integer);qty:=(change->>'quantity')::integer;resource_key:=change->>'resource';
    update public.dc_tiles set remaining=remaining-qty where company_id=p_company and x=(change->>'x')::integer and y=(change->>'y')::integer and material=resource_key and remaining>=qty;
    if not found then raise exception 'Frozen extraction failed verification';end if;
    update public.dc_expeditions set cargo=jsonb_set(cargo,array[resource_key],to_jsonb(coalesce((cargo->>resource_key)::integer,0)+qty),true) where id=job.id;
   end loop;
   if job.mode='survey' then update public.dc_field_events set result=jsonb_set(result,'{tiles_revealed}',to_jsonb(coalesce((result->>'tiles_revealed')::integer,0)+new_reveals)) where job_id=job.id and kind='survey' and applied_at is null;end if;
  else
   select * into job from public.dc_expeditions where id=job.id;
   update public.dc_expeditions set status=case when job.mode in('survey','infrastructure') or not exists(select 1 from jsonb_each(job.cargo)e where (e.value::text)::integer>0) then 'collected' else 'ready' end,
    collected_at=case when job.mode in('survey','infrastructure') or not exists(select 1 from jsonb_each(job.cargo)e where (e.value::text)::integer>0) then job.completes_at else null end where id=job.id;
   update public.dc_workers set assigned_job_id=null,xp=xp+12*job.energy_per_worker where company_id=p_company and assigned_job_id=job.id;
   delete from public.dc_reservations where job_id=job.id;
   if job.mode='infrastructure' then update public.dc_infrastructure set status='installed',installed_at=job.completes_at where job_id=job.id and status='building';end if;
   update public.dc_discoveries d set status='pending',discovered_at=job.completes_at where d.job_id=job.id and d.status='planned'
    and exists(select 1 from public.dc_tiles t where t.company_id=p_company and t.x=d.x and t.y=d.y and t.remaining=0);
   for event in select * from public.dc_field_events where job_id=job.id and kind<>'incident' and applied_at is null and due_at<=p_now for update loop
    if event.kind='survey' then update public.dc_field_events set result=jsonb_set(result,'{description}',to_jsonb((result->>'tiles_revealed')||' new cells were recorded by the survey.')) where id=event.id;end if;
    update public.dc_field_events set applied_at=p_now where id=event.id;
   end loop;
   insert into public.dc_logs(company_id,kind,title) values(p_company,'field_return',case when job.mode='survey' then 'Survey crew returned. Its field report is ready.' when job.mode='infrastructure' then 'Construction crew returned. Infrastructure is operational.'
    when exists(select 1 from jsonb_each(job.cargo)e where (e.value::text)::integer>0) then 'Crew returned. A finite haul is ready for collection.' else 'Exploration crew returned. Natural chambers were recorded without an ore haul.' end);
  end if;
  update public.dc_milestones set applied_at=p_now where job_id=m.job_id and sequence=m.sequence;changed:=true;
 end loop;
 perform public.dc_reconcile_v1_phase2_base(p_company,p_now);
 for wear in select w.* from public.dc_job_equipment w join public.dc_expeditions e on e.id=w.job_id
  where e.company_id=p_company and e.config_version=3 and e.status in('ready','collected') and w.applied_at is null order by w.job_id,w.item_id for update of w loop
  update public.dc_equipment set durability=greatest(0,durability-wear.wear_amount) where id=wear.item_id;
  update public.dc_job_equipment set applied_at=p_now where job_id=wear.job_id and item_id=wear.item_id;changed:=true;
 end loop;
 if changed then update public.dc_companies set revision=revision+1 where id=p_company;end if;
end $$;

create or replace function public.dc_buildings_v3(p_company public.dc_companies) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_agg(case when value->>'key'='mine_shaft' then value||jsonb_build_object('max_level',5,'upgrade_cost',case when p_company.shaft_level=4 then 12000 when p_company.shaft_level=5 then null else (value->>'upgrade_cost')::integer end,
  'effect',case when p_company.shaft_level=5 then '599 m operating depth' else value->>'effect' end) else value end order by ord)
 from jsonb_array_elements(public.dc_buildings_v2_phase2_base(p_company)) with ordinality e(value,ord)
$$;
do $shaft$
declare definition text;
begin
 definition:=pg_get_functiondef('public.dc_upgrade_phase2_base(text,integer,uuid)'::regprocedure);
 definition:=public.dc_replace_required_v3(definition,'FUNCTION public.dc_upgrade_phase2_base(','FUNCTION public.dc_upgrade(');
 definition:=public.dc_replace_required_v3(definition,'public.dc_buildings_v2(c)','public.dc_buildings_v3(c)');
 execute public.dc_replace_required_v3(definition,'case level when 1 then 56 when 2 then 106 else 256 end','case level when 1 then 56 when 2 then 106 when 3 then 256 else 556 end');
end $shaft$;
create or replace function public.dc_snapshot_v1(p_company uuid,p_now timestamptz) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb:=public.dc_snapshot_v1_phase2_base(p_company,p_now);company public.dc_companies%rowtype;tiles jsonb;
begin
 if p_company is not null then
  select * into company from public.dc_companies where id=p_company;
  result:=jsonb_set(result,'{world,max_depth}',to_jsonb(case company.shaft_level when 1 then 49 when 2 then 99 when 3 then 149 when 4 then 299 else 599 end));
  result:=jsonb_set(result,'{buildings}',public.dc_buildings_v3(company));
  select jsonb_agg(e.value||jsonb_build_object('formation',t.formation) order by e.ord) into tiles from jsonb_array_elements(result->'world'->'tiles') with ordinality e(value,ord)
   join public.dc_tiles t on t.company_id=p_company and t.x=(e.value->>'x')::integer and t.y=(e.value->>'y')::integer;
  result:=jsonb_set(result,'{world,tiles}',coalesce(tiles,'[]'));
 end if;
 return result||jsonb_build_object('schema_version',3,'field_catalog',public.dc_field_catalog_v3(),
 'infrastructure',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'key',key,'x',x,'y',y,'grade',grade,'radius',radius,'strength',strength,'status',status,'job_id',job_id,'installed_at',installed_at) order by y,x,id),'[]') from public.dc_infrastructure where company_id=p_company),
 'discoveries',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'x',d.x,'y',d.y,'job_id',d.job_id,'kind',d.kind,'name',d.name,'quality',d.quality,'detail',d.detail,'sale_value',d.sale_value,'salvage',d.salvage,'status',d.status,'discovered_at',d.discovered_at,'resolved_at',d.resolved_at) order by d.discovered_at desc,d.id),'[]')
  from public.dc_discoveries d where d.company_id=p_company and (d.status='pending' or d.id in(select id from public.dc_discoveries where company_id=p_company and status='kept' order by resolved_at desc,id desc limit 24)
   or d.id in(select id from public.dc_discoveries where company_id=p_company and status in('sold','salvaged') order by resolved_at desc,id desc limit 12))),
 'discovery_summary',(select jsonb_build_object('pending',count(*) filter(where status='pending'),'kept',count(*) filter(where status='kept'),'sold',count(*) filter(where status='sold'),'salvaged',count(*) filter(where status='salvaged')) from public.dc_discoveries where company_id=p_company),
 'field_reports',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'job_id',e.job_id,'kind',e.kind,'title',e.result->>'title','description',e.result->>'description','point',e.result->'point','occurred_at',e.due_at,
  'delay_seconds',coalesce((e.result->>'delay_seconds')::integer,0),'tiles_revealed',coalesce((e.result->>'tiles_revealed')::integer,0),'infrastructure_id',e.result->'infrastructure_id','discovery_id',e.result->'discovery_id') order by e.due_at desc,e.id),'[]')
  from(select * from public.dc_field_events where company_id=p_company and applied_at is not null order by due_at desc,id desc limit 24)e));
end $$;
create or replace function public.dc_resolve_discovery(p_discovery_id uuid,p_choice text,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;discovery public.dc_discoveries%rowtype;payload jsonb:=jsonb_build_object('discovery_id',p_discovery_id,'choice',p_choice,'expected_revision',p_expected_revision);space integer;resource record;units integer;
begin
 if public.dc_receipt_v1(company,p_request_id,'resolve_discovery',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 if p_choice is null or p_choice not in('keep','sell','salvage') then raise exception 'Choose keep, sell or salvage for this find.';end if;
 select * into discovery from public.dc_discoveries where id=p_discovery_id and company_id=company and status<>'planned' for update;
 if not found then raise exception 'Discovery unavailable' using errcode='42501';end if;
 if discovery.status<>'pending' then raise exception 'This find has already been resolved.';end if;
 if p_choice='salvage' then
  select 120*(2^(c.warehouse_level-1))::integer-coalesce(sum(quantity),0) into space from public.dc_inventory where company_id=company;
  select coalesce(sum((value::text)::integer),0) into units from jsonb_each(discovery.salvage);
  if units>space then raise exception 'Make warehouse space for the entire salvage before resolving this find.';end if;
  for resource in select key,(value::text)::integer quantity from jsonb_each(discovery.salvage) loop update public.dc_inventory set quantity=quantity+resource.quantity where company_id=company and resource_key=resource.key;end loop;
 elsif p_choice='sell' then update public.dc_companies set cash=cash+discovery.sale_value where id=company;
 end if;
 update public.dc_discoveries set status=case p_choice when 'keep' then 'kept' when 'sell' then 'sold' else 'salvaged' end,resolved_at=clock_timestamp() where id=discovery.id;
 update public.dc_companies set revision=revision+1 where id=company;
 insert into public.dc_logs(company_id,kind,title) values(company,'find_resolved',discovery.name||case p_choice when 'keep' then ' added to the permanent cabinet.' when 'sell' then ' sold for its documented value.' else ' salvaged into company materials.' end);
 perform public.dc_store_receipt_v1(company,p_request_id,'resolve_discovery',payload);return public.dc_snapshot_v1(company,clock_timestamp());
end $$;

create or replace function public.dc_field_guard_v3() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new;end if;
 if tg_op='UPDATE' then
  if tg_table_name='dc_infrastructure' then
   if old.status='building' and new.status='installed' and new.installed_at is not null and (to_jsonb(new)-array['status','installed_at'])=(to_jsonb(old)-array['status','installed_at']) then return new;end if;
  elsif tg_table_name='dc_discoveries' then
   if ((old.status='planned' and new.status='pending' and new.discovered_at is not null and new.resolved_at is null) or
    (old.status='pending' and new.status in('kept','sold','salvaged') and new.discovered_at=old.discovered_at and new.resolved_at is not null))
    and (to_jsonb(new)-array['status','discovered_at','resolved_at'])=(to_jsonb(old)-array['status','discovered_at','resolved_at']) then return new;end if;
  elsif tg_table_name='dc_field_events' then
   if old.applied_at is null and (to_jsonb(new)-array['result','applied_at'])=(to_jsonb(old)-array['result','applied_at']) then return new;end if;
  end if;
 end if;raise exception 'Committed Deep Claim field configurations and decisions are immutable';
end $$;
create trigger dc_infrastructure_guard before update or delete on public.dc_infrastructure for each row execute function public.dc_field_guard_v3();
create trigger dc_discovery_guard before update or delete on public.dc_discoveries for each row execute function public.dc_field_guard_v3();
create trigger dc_field_event_guard before update or delete on public.dc_field_events for each row execute function public.dc_field_guard_v3();

update public.platform_assets set full_description='A persistent private mining company inside your club. Explore finite deposits, hire and equip a crew, refine metals and gems, and dispatch surveys and four kinds of underground infrastructure. New geological chunks contain connected natural formations; transparent bounded incidents delay setup without stealing ore or injuring staff. Recover finite specimens through mining and keep, sell or salvage each find once. Shaft technology supports 599 metres. Server timestamps preserve offline work. Company credits remain separate from DH Score; contracts and club projects belong to future phases.',updated_at=now() where slug='deep-claim';

do $$ declare f record;begin
 for f in select p.proname,p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);
  if f.proname in('dc_bootstrap','dc_get','dc_reconcile','dc_preview','dc_dispatch','dc_collect','dc_sell','dc_upgrade','dc_hire','dc_train','dc_assign_equipment','dc_repair_equipment','dc_start_production','dc_collect_production','dc_retire_equipment','dc_preview_operation','dc_dispatch_operation','dc_resolve_discovery') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
