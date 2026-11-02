-- Deep Claim: Ancient Deep. Apply inside the caller's transaction.
-- Existing geology, plans, production rules and earned awards are immutable.
update public.platform_assets set full_description='Build a private mining company with persistent finite geology, a hired crew, owned gear, industry and research. Develop cooperative projects and optional curated club records. The Ancient Deep extends earned shaft technology to 999m with a real route-weighted lift, nickel and sulfur mining, nickel-alloy industry and functional heat protection. Heat affects future productive work predictably; existing jobs and worlds retain their frozen rules. Company money, inventory, staff, maps and active work remain private.',updated_at=now() where slug='deep-claim';
lock table public.dc_companies in access exclusive mode;
lock table public.dc_expeditions in share row exclusive mode;
update public.dc_companies set revision=revision+1;
-- Pin every outstanding legacy footprint using the OLD selector before changing
-- eligible new chunks. No cell is revealed or plan/clock/economic field edited.
do $pin_legacy$
declare point record;world_seed uuid;version_value integer;begin
 for point in select distinct q.company_id,(q.cell->>'x')::integer x,(q.cell->>'y')::integer y from(
  select m.company_id,p.value cell from public.dc_milestones m join public.dc_expeditions e on e.id=m.job_id cross join lateral jsonb_array_elements(coalesce(m.payload->'reveals','[]')||coalesce(m.payload->'extractions','[]'))p where m.applied_at is null and e.config_version in(1,2,3)
  union all select e.company_id,p.value from public.dc_expeditions e join public.dc_plans plan on plan.job_id=e.id cross join lateral jsonb_array_elements(coalesce(plan.content->'reveals','[]')||coalesce(plan.content->'extractions','[]')||e.path||jsonb_build_array(jsonb_build_object('x',e.target_x,'y',e.target_y)))p where e.status='active' and e.config_version in(1,2,3)
 )q loop
  version_value:=public.dc_chunk_version_v2(point.company_id,point.x,point.y);select seed into world_seed from public.dc_worlds where company_id=point.company_id;
  insert into public.dc_chunks values(point.company_id,point.x/32,point.y/32,version_value,md5(world_seed::text||':'||version_value||':'||point.x/32||':'||point.y/32)) on conflict do nothing;
 end loop;
end $pin_legacy$;
insert into public.dc_rules(version,config) values(7,$dc_deep_catalog${"version":7,"name":"The Ancient Deep","shaft":{"max_level":6,"upgrade_cost":24000,"max_depth":999,"corridor_depth":956,"required_research":["deep_operations_2"],"lift_discount_percent":75},"regions":[{"key":"ancient","name":"Ancient Deep","min_depth":600,"max_depth":999,"description":"Hydrothermal basalt, nickel-bearing seams and sulfur beds. Engineering, installed ventilation and heat shields preserve productive work."}],"infrastructure":{"base_capacity":128,"deep_capacity":192},"thermal":{"min_depth":600,"base_percent":30,"step_depth":100,"step_percent":2,"cap_percent":40,"engineering_divisor":10,"ventilation_multiplier":1,"gear_reduction_cap":15},"generation":{"version":4,"min_chunk_y":19,"cluster_width":4,"cluster_height":3,"nickel_percent":8,"sulfur_percent":14,"nickel_min_units":18,"nickel_unit_range":19,"sulfur_min_units":24,"sulfur_unit_range":25},"resources":[{"id":"nickel_ore","name":"Nickel ore","sell_price":28,"color":"#a3b9a5","description":"Finite nickel-bearing rock from hydrothermal formations below the old claim.","mineral":true,"hardness_tenths":26},{"id":"sulfur","name":"Sulfur","sell_price":6,"color":"#d4bd63","description":"Sulfur beds supply industrial protection and equipment maintenance.","mineral":true,"hardness_tenths":12},{"id":"nickel_alloy","name":"Nickel alloy","sell_price":195,"color":"#b9c1ac","description":"A heat-resistant alloy refined using nickel, iron and coal.","mineral":false}],"equipment":[{"key":"nickel_heatshield","name":"Nickel Heat Shield","slot":"head","tier":3,"max_durability":180,"bonuses":{"safety":10,"endurance":6},"repair_rate":0.5,"repair_materials":{"nickel_alloy":1,"sulfur":2},"thermal_reduction_percent":15}],"recipes":[{"key":"smelt_nickel_alloy","version":1,"name":"Smelt Nickel Alloy","station":"smeltery","required_station_level":3,"duration_seconds":780,"cash_cost":10,"inputs":{"nickel_ore":3,"iron_bar":1,"coal":2},"outputs":{"nickel_alloy":1},"equipment_output":null,"max_batches":10,"required_research":["processing_2","deep_operations_2"]},{"key":"craft_nickel_heatshield","version":1,"name":"Craft Nickel Heat Shield","station":"tool_station","required_station_level":3,"duration_seconds":900,"cash_cost":80,"inputs":{"nickel_alloy":2,"polished_quartz":2,"sulfur":2},"outputs":{},"equipment_output":"nickel_heatshield","max_batches":10,"required_research":["deep_operations_2","safety_2"]}]}$dc_deep_catalog$::jsonb);
alter table public.dc_companies drop constraint dc_companies_shaft_level_check;
alter table public.dc_companies add constraint dc_companies_shaft_level_check check(shaft_level between 1 and 6);
alter table public.dc_inventory drop constraint dc_inventory_resource_key_check;
alter table public.dc_inventory add constraint dc_inventory_resource_key_check check(resource_key in('stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore','amethyst','gold_ore','copper_bar','tin_bar','iron_bar','silver_bar','polished_quartz','cut_amethyst','bronze_bar','steel_bar','gold_bar','nickel_ore','sulfur','nickel_alloy'));
alter table public.dc_tiles drop constraint dc_tiles_material_check;
alter table public.dc_tiles add constraint dc_tiles_material_check check(material in('stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore','amethyst','gold_ore','nickel_ore','sulfur'));
alter table public.dc_expeditions add column deep_modifiers jsonb;
alter table public.dc_expeditions add constraint dc_deep_modifiers_frozen check((config_version=7)=(deep_modifiers is not null));
alter table public.dc_expeditions drop constraint dc_expeditions_duration_seconds_check;
alter table public.dc_expeditions add constraint dc_expeditions_duration_seconds_check check(
 (config_version in(1,2) and duration_seconds in(30,1200,3600,10800)) or
 (config_version in(3,7) and ((tutorial and duration_seconds=30) or (not tutorial and duration_seconds between duration_minutes*60 and duration_minutes*60+300))));

-- OIDs and old callers retain exact old private implementations. The new
-- preview/upgrade wrappers use new bases rather than broadening old helpers.
do $bases$
declare item text;signature text;definition text;begin
 foreach item in array array['dc_preview_v1_phase2_base','dc_preview_operation_v3','dc_snapshot_v1','dc_upgrade','dc_reconcile_v1','dc_price_v1','dc_hardness_v1','dc_mining_value_v5'] loop
  signature:=case item when 'dc_preview_v1_phase2_base' then '(uuid,uuid[],text,integer,integer,integer,boolean,timestamptz)' when 'dc_preview_operation_v3' then '(uuid,uuid[],text,integer,integer,integer,boolean,text,timestamptz)' when 'dc_upgrade' then '(text,integer,uuid)' when 'dc_price_v1' then '(text)' when 'dc_hardness_v1' then '(text)' when 'dc_mining_value_v5' then '(jsonb)' else '(uuid,timestamptz)' end;
  if to_regprocedure('public.'||item||'_pre_v7'||signature) is not null then raise exception 'Ancient Deep adapter already exists';end if;
  definition:=pg_get_functiondef(to_regprocedure('public.'||item||signature));execute replace(definition,'FUNCTION public.'||item||'(','FUNCTION public.'||item||'_pre_v7(');
 end loop;
end $bases$;
create or replace function public.dc_deep_catalog_v7() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$select config from public.dc_rules where version=7$$;
insert into public.dc_recipes select d->>'key',(d->>'version')::integer,d from jsonb_array_elements(public.dc_deep_catalog_v7()->'recipes')d;
insert into public.dc_equipment_catalog select d->>'key',1,d from jsonb_array_elements(public.dc_deep_catalog_v7()->'equipment')d;
create or replace function public.dc_resources_v1() returns text[] language sql immutable as $$select array['stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore','amethyst','gold_ore','copper_bar','tin_bar','iron_bar','silver_bar','polished_quartz','cut_amethyst','bronze_bar','steel_bar','gold_bar','nickel_ore','sulfur','nickel_alloy']::text[]$$;
create or replace function public.dc_minerals_v2() returns text[] language sql immutable as $$select array['stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore','amethyst','gold_ore','nickel_ore','sulfur']::text[]$$;
create or replace function public.dc_price_v1(p_key text) returns integer language sql stable security definer set search_path=public,pg_temp as $$select coalesce(public.dc_price_v1_pre_v7(p_key),(select (value->>'sell_price')::integer from jsonb_array_elements(public.dc_deep_catalog_v7()->'resources') where value->>'id'=p_key))$$;
create or replace function public.dc_hardness_v1(p_key text) returns numeric language sql immutable as $$select case p_key when 'nickel_ore' then 2.6 when 'sulfur' then 1.2 else public.dc_hardness_v1_pre_v7(p_key) end$$;
create or replace function public.dc_mining_value_v5(p_cargo jsonb) returns bigint language sql immutable as $$select public.dc_mining_value_v5_pre_v7(p_cargo)+coalesce((p_cargo->>'nickel_ore')::bigint,0)*28+coalesce((p_cargo->>'sulfur')::bigint,0)*6$$;
create or replace function public.dc_infrastructure_capacity_v7(p_company uuid) returns integer language sql stable security definer set search_path=public,pg_temp as $$select case when shaft_level=6 then 192 else 128 end from public.dc_companies where id=p_company$$;

create or replace function public.dc_chunk_version_v2(p_company uuid,p_x integer,p_y integer) returns integer language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select world_version from public.dc_chunks where company_id=p_company and chunk_x=p_x/32 and chunk_y=p_y/32),case when p_y/32>=19 then 4 when p_y/32>=1 then 3 else 1 end)
$$;
create or replace function public.dc_cell_v4(p_company uuid,p_x integer,p_y integer) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare base jsonb;world_seed uuid;h bigint;vein bigint;roll integer;mineral text;amount integer;begin
 base:=public.dc_cell_v3(p_company,p_x,p_y);
 if p_y<600 or p_x=48 or (base->>'initial_amount')::integer=0 then return base;end if;
 select seed into world_seed from public.dc_worlds where company_id=p_company;
 h:=('x'||substr(md5('ancient-v4:units:'||world_seed||':'||p_x||':'||p_y),1,8))::bit(32)::bigint;
 vein:=('x'||substr(md5('ancient-v4:cluster:'||world_seed||':'||p_x/4||':'||p_y/3),1,8))::bit(32)::bigint;roll:=(vein%100)::integer;
 if roll<8 then mineral:='nickel_ore';amount:=18+(h%19)::integer;elsif roll<22 then mineral:='sulfur';amount:=24+(h%25)::integer;else return base;end if;
 return base||jsonb_build_object('material',mineral,'initial_amount',amount);
end $$;
create or replace function public.dc_cell_v1(p_company uuid,p_x integer,p_y integer) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v integer:=public.dc_chunk_version_v2(p_company,p_x,p_y);begin
 if v=4 then return public.dc_cell_v4(p_company,p_x,p_y);elsif v=3 then return public.dc_cell_v3(p_company,p_x,p_y);elsif v=2 then return public.dc_cell_v2(p_company,p_x,p_y);end if;return public.dc_cell_v1_phase1_base(p_company,p_x,p_y);end $$;
create or replace function public.dc_lift_discount_v7(p_company uuid,p_route jsonb) returns integer language plpgsql stable security definer set search_path=public,pg_temp as $$
declare total numeric;eligible numeric;begin
 if not exists(select 1 from public.dc_companies c where c.id=p_company and c.shaft_level=6 and exists(select 1 from public.dc_research_orders r where r.company_id=c.id and r.research_key='deep_operations_2' and r.completed_at is not null)) then return 0;end if;
 with points as(select (value->>'x')::integer x,(value->>'y')::integer y,ord from jsonb_array_elements(p_route) with ordinality e(value,ord)),
 edges as(select x,y,lag(x) over(order by ord) px,lag(y) over(order by ord) py from points),
 known_shaft_edges as(select 1 from edges e
  cross join lateral generate_series(greatest(0,least(e.y,e.py)),least(956,greatest(e.y,e.py))-1)g(edge_y)
  where e.x=48 and e.px=48
   and exists(select 1 from public.dc_tiles t where t.company_id=p_company and t.x=48 and t.y=g.edge_y and t.remaining=0)
   and exists(select 1 from public.dc_tiles t where t.company_id=p_company and t.x=48 and t.y=g.edge_y+1 and t.remaining=0))
 select (select coalesce(sum(abs(x-px)+abs(y-py)),0) from edges where px is not null),
  (select count(*) from known_shaft_edges) into total,eligible;
 return case when total>0 then floor(75*eligible/total)::integer else 0 end;
end $$;
create or replace function public.dc_deep_modifiers_v7(p_company uuid,p_workers uuid[],p_mode text,p_x integer,p_y integer,p_route jsonb,p_raw_work integer) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare crew jsonb:=public.dc_crew_v3(p_company,p_workers);load integer:=0;engineering integer:=0;vent integer:=0;gear integer:=0;penalty integer:=0;n integer:=(crew->>'count')::integer;begin
 if p_y>=600 and p_mode in('extract','explore') then
  load:=least(40,30+2*((p_y-600)/100));engineering:=(crew->>'engineering')::integer/10;
  select coalesce(max(strength),0) into vent from public.dc_infrastructure where company_id=p_company and key='ventilation' and status='installed' and abs(x-p_x)+abs(y-p_y)<=radius;
  select case when n>0 then least(15,floor(coalesce(sum((definition_snapshot->>'thermal_reduction_percent')::numeric),0)/n)::integer) else 0 end into gear from public.dc_equipment where company_id=p_company and worker_id=any(p_workers) and durability>0 and retired_at is null;
  penalty:=greatest(0,load-engineering-vent-gear);
 end if;
 return jsonb_build_object('lift_discount_percent',public.dc_lift_discount_v7(p_company,p_route),'thermal_load_percent',load,'engineering_mitigation_percent',engineering,'ventilation_mitigation_percent',vent,'gear_mitigation_percent',gear,'heat_penalty_percent',penalty,'raw_work_seconds',p_raw_work,'effective_work_seconds',floor(p_raw_work::numeric*(100-penalty)/100)::integer);
end $$;

do $quotes$
declare definition text;begin
 definition:=pg_get_functiondef('public.dc_preview_v1_phase2_base_pre_v7(uuid,uuid[],text,integer,integer,integer,boolean,timestamptz)'::regprocedure);
 execute public.dc_replace_required_v3(definition,'when 3 then 149 when 4 then 299 else 599 end','when 3 then 149 when 4 then 299 when 5 then 599 else 999 end');
 definition:=pg_get_functiondef('public.dc_preview_operation_v3_pre_v7(uuid,uuid[],text,integer,integer,integer,boolean,text,timestamptz)'::regprocedure);
 definition:=replace(definition,'FUNCTION public.dc_preview_operation_v3_pre_v7(','FUNCTION public.dc_preview_operation_v7_base(');
 definition:=public.dc_replace_required_v3(definition,'p_y not between 1 and 599','p_y not between 1 and 999');
 definition:=public.dc_replace_required_v3(definition,'when 3 then 149 when 4 then 299 else 599 end','when 3 then 149 when 4 then 299 when 5 then 599 else 999 end');
 definition:=public.dc_replace_required_v3(definition,'public.dc_preview_v1_phase2_base(','public.dc_preview_v1_phase2_base_pre_v7(');
 definition:=public.dc_replace_required_v3(definition,'where company_id=p_company)>=128','where company_id=p_company)>=public.dc_infrastructure_capacity_v7(p_company)');
 definition:=public.dc_replace_required_v3(definition,'bonus integer;','bonus integer;lift integer;');
 definition:=public.dc_replace_required_v3(definition,'bonus:=(conditions->>''transport_bonus_percent'')::integer;','bonus:=(conditions->>''transport_bonus_percent'')::integer;lift:=public.dc_lift_discount_v7(p_company,quote->''route'');');
 definition:=public.dc_replace_required_v3(definition,'new_travel:=old_travel;new_return:=old_return;','if not p_tutorial then old_travel:=ceil(old_travel*(100-lift)/100.0)::integer;old_return:=ceil(old_return*(100-lift)/100.0)::integer;end if;new_travel:=old_travel;new_return:=old_return;');
 definition:=replace(definition,'bonus>0','(bonus>0 or lift>0)');execute definition;
end $quotes$;
create or replace function public.dc_preview_operation_v7(p_company uuid,p_workers uuid[],p_mode text,p_x integer,p_y integer,p_minutes integer,p_tutorial boolean,p_infrastructure_key text,p_now timestamptz) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare q jsonb:=public.dc_preview_operation_v7_base(p_company,p_workers,p_mode,p_x,p_y,p_minutes,p_tutorial,p_infrastructure_key,p_now);c public.dc_companies%rowtype;crew jsonb:=public.dc_crew_v3(p_company,p_workers);modifiers jsonb;raw_work integer;effective_work integer;quantity integer;remaining integer;mineral text;n integer:=(crew->>'count')::integer;energy integer:=(q->>'energy_per_worker')::integer;reasons jsonb:=q->'reasons';begin
 select * into c from public.dc_companies where id=p_company;
 select (value->>'duration_seconds')::integer into raw_work from jsonb_array_elements(q->'stages') where value->>'key'='work';
 modifiers:=public.dc_deep_modifiers_v7(p_company,p_workers,p_mode,p_x,p_y,q->'route',raw_work);
 -- The optional accelerated lesson keeps its original fixed30-second rules,
 -- even when an experienced company chooses to take it after earning a lift.
 if p_tutorial then modifiers:=jsonb_build_object('lift_discount_percent',0,'thermal_load_percent',0,'engineering_mitigation_percent',0,'ventilation_mitigation_percent',0,'gear_mitigation_percent',0,'heat_penalty_percent',0,'raw_work_seconds',raw_work,'effective_work_seconds',raw_work);end if;
 effective_work:=(modifiers->>'effective_work_seconds')::integer;
 if p_mode='extract' and not p_tutorial and n>0 then
  select t.material,t.remaining into mineral,remaining from public.dc_tiles t where t.company_id=p_company and t.x=p_x and t.y=p_y;
  quantity:=greatest(1,floor(greatest(0,effective_work)/60.0*n*(20+(crew->>'mining')::integer)/100*(70+(crew->>'safety')::integer)/100*(90+(crew->>'geology')::numeric/4)/100*
   (100-(energy-1)*greatest(0,80-(crew->>'endurance')::integer)/5.0)/100*(100+(crew->>'leadership')::numeric*(n-1)/10)/100*(100+25*(c.tool_level-1))/100*
   (100+(10.0*(crew->>'swing')::integer-5.0*(crew->>'deliberate')::integer)/n)/100/public.dc_hardness_v1(mineral))::integer);
  quantity:=least(quantity,coalesce(remaining,0),(q->>'cargo_capacity')::integer);
  q:=q||jsonb_build_object('_quantity',quantity,'estimated_yield',jsonb_build_object('min',floor(quantity*0.8)::integer,'max',least((q->>'cargo_capacity')::integer,coalesce(remaining,0),ceil(quantity*1.2)::integer)));
  select coalesce(jsonb_agg(value),'[]') into reasons from jsonb_array_elements(reasons)e(value) where value#>>'{}'<>'Keep enough operating cash or recoverable stock for another dispatch.';
  if c.cash-(q->>'wages')::integer+coalesce((select sum(i.quantity*public.dc_price_v1(i.resource_key)) from public.dc_inventory i where i.company_id=p_company),0)+quantity*coalesce(public.dc_price_v1(mineral),1)<2 then reasons:=reasons||jsonb_build_array('Keep enough operating cash or recoverable stock for another dispatch.');end if;
 elsif p_mode='explore' and (q->>'_quantity')::integer>0 then
  quantity:=greatest(1,floor((q->>'_quantity')::numeric*(100-(modifiers->>'heat_penalty_percent')::integer)/100)::integer);
  q:=q||jsonb_build_object('_quantity',quantity,'estimated_yield',jsonb_build_object('min',0,'max',least((q->>'cargo_capacity')::integer,ceil(quantity*1.2)::integer)));
 end if;
 return q||jsonb_build_object('operation_version',7,'allowed',jsonb_array_length(reasons)=0,'reasons',reasons,'deep_modifiers',modifiers);
end $$;
create or replace function public.dc_freeze_equipment_v7(p_company uuid,p_job uuid,p_workers uuid[],p_energy integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin
 if not exists(select 1 from public.dc_expeditions where id=p_job and company_id=p_company and config_version=7) then raise exception 'Expedition rules changed. Refresh and review the quote.' using errcode='40001';end if;
 insert into public.dc_job_equipment(job_id,item_id,wear_amount,initial_durability) select p_job,id,2*p_energy,durability from public.dc_equipment where company_id=p_company and worker_id=any(p_workers) and retired_at is null;
end $$;
do $dispatch$
declare definition text;begin
 definition:=pg_get_functiondef('public.dc_dispatch_v3_impl(uuid[],text,integer,integer,integer,boolean,text,integer,uuid)'::regprocedure);
 definition:=replace(definition,'FUNCTION public.dc_dispatch_v3_impl(','FUNCTION public.dc_dispatch_v7_impl(');
 definition:=public.dc_replace_required_v3(definition,'public.dc_preview_operation_v3(','public.dc_preview_operation_v7(');
 definition:=public.dc_replace_required_v3(definition,'energy_per_worker,config_version)','energy_per_worker,config_version,deep_modifiers)');
 definition:=public.dc_replace_required_v3(definition,'(quote->>''energy_per_worker'')::integer,3) returning id into job;','(quote->>''energy_per_worker'')::integer,7,quote->''deep_modifiers'') returning id into job;');
 definition:=public.dc_replace_required_v3(definition,'jsonb_build_object(''config_version'',3,''incident''','jsonb_build_object(''config_version'',7,''deep_modifiers'',quote->''deep_modifiers'',''incident''');
 definition:=public.dc_replace_required_v3(definition,'public.dc_freeze_equipment_v2(','public.dc_freeze_equipment_v7(');execute definition;
 definition:=pg_get_functiondef('public.dc_dispatch(uuid[],text,integer,integer,integer,boolean,integer,uuid)'::regprocedure);execute public.dc_replace_required_v3(definition,'public.dc_dispatch_v3_impl(','public.dc_dispatch_v7_impl(');
end $dispatch$;
create or replace function public.dc_current_ticket_v7() returns trigger language plpgsql set search_path=public,pg_temp as $$begin
 if new.config_version<>7 then raise exception 'Expedition rules changed. Refresh and review the new quote.' using errcode='40001';end if;return new;end $$;
drop trigger dc_current_ticket on public.dc_expeditions;
create trigger dc_current_ticket before insert on public.dc_expeditions for each row execute function public.dc_current_ticket_v7();
create or replace function public.dc_preview_operation(p_worker_ids uuid[],p_mode text,p_target_x integer,p_target_y integer,p_duration_minutes integer,p_tutorial boolean,p_infrastructure_key text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();begin return public.dc_preview_operation_v7(company,p_worker_ids,p_mode,p_target_x,p_target_y,p_duration_minutes,p_tutorial,p_infrastructure_key,clock_timestamp())-'_quantity'-'_reveal_count'-'_survey_reveals';end $$;
create or replace function public.dc_dispatch_operation(p_worker_ids uuid[],p_mode text,p_target_x integer,p_target_y integer,p_duration_minutes integer,p_tutorial boolean,p_infrastructure_key text,p_expected_revision integer,p_request_id uuid) returns jsonb language sql security definer set search_path=public,pg_temp as $$select public.dc_dispatch_v7_impl(p_worker_ids,p_mode,p_target_x,p_target_y,p_duration_minutes,p_tutorial,p_infrastructure_key,p_expected_revision,p_request_id)$$;

-- Config3 and7 share the exact released field settlement branch, globally
-- ordered by their frozen clocks. The retained outer business/inbox wrapper
-- then handles old1/2 tickets and flushes durable completion-trigger events.
-- This pass never calls the old phase1 fallback ahead of pending field work.
do $settlement$
declare definition text;begin
 definition:=pg_get_functiondef('public.dc_reconcile_v1_phase3_base(uuid,timestamptz)'::regprocedure);
 definition:=replace(definition,'FUNCTION public.dc_reconcile_v1_phase3_base(','FUNCTION public.dc_reconcile_v7_fields(');
 definition:=public.dc_replace_required_v3(definition,'e.config_version=3','e.config_version in(3,7)');
 definition:=public.dc_replace_required_v3(definition,'perform public.dc_reconcile_v1_phase2_base(p_company,p_now);','-- Prior executors run through the retained outer wrapper.');
 definition:=public.dc_replace_required_v3(definition,'where company_id=p_company and kind=''incident''','where company_id=p_company and job_id in(select id from public.dc_expeditions where company_id=p_company and config_version in(3,7)) and kind=''incident''');execute definition;
end $settlement$;
create or replace function public.dc_reconcile_v1(p_company uuid,p_now timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin
 perform public.dc_reconcile_v7_fields(p_company,p_now);perform public.dc_reconcile_v1_pre_v7(p_company,p_now);
end $$;
create or replace function public.dc_buildings_v7(p_company public.dc_companies) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_agg(case when value->>'key'='mine_shaft' then value||jsonb_build_object('max_level',6,'upgrade_cost',case when p_company.shaft_level=5 then 24000 when p_company.shaft_level=6 then null else (value->>'upgrade_cost')::integer end,'effect',case when p_company.shaft_level=6 then '999 m operating depth; powered shaft lift' else value->>'effect' end) else value end order by ord)
 from jsonb_array_elements(public.dc_buildings_v4(p_company)) with ordinality e(value,ord)
$$;
do $upgrade$
declare definition text;begin
 definition:=pg_get_functiondef('public.dc_upgrade_pre_v7(text,integer,uuid)'::regprocedure);definition:=replace(definition,'FUNCTION public.dc_upgrade_pre_v7(','FUNCTION public.dc_upgrade(');
 definition:=public.dc_replace_required_v3(definition,'public.dc_buildings_v4(c)','public.dc_buildings_v7(c)');
 definition:=public.dc_replace_required_v3(definition,'if c.cash-cost<2 then', 'if p_building_key=''mine_shaft'' and level=5 and not exists(select 1 from public.dc_research_orders r where r.company_id=company and r.research_key=''deep_operations_2'' and r.completed_at is not null) then raise exception ''Complete Deep Cutting Systems research before extending the shaft'';end if;if c.cash-cost<2 then');
 definition:=public.dc_replace_required_v3(definition,'case level when 1 then 56 when 2 then 106 when 3 then 256 else 556 end','case level when 1 then 56 when 2 then 106 when 3 then 256 when 4 then 556 else 956 end');execute definition;
end $upgrade$;
create or replace function public.dc_snapshot_v1(p_company uuid,p_now timestamptz) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb:=public.dc_snapshot_v1_pre_v7(p_company,p_now);company public.dc_companies%rowtype;jobs jsonb;begin
 if p_company is not null then
  select * into company from public.dc_companies where id=p_company;
  result:=jsonb_set(result,'{buildings}',public.dc_buildings_v7(company));
  if company.shaft_level=6 then result:=jsonb_set(result,'{world,max_depth}','999'::jsonb);end if;
  select coalesce(jsonb_agg(j.value||case when e.config_version=7 then jsonb_build_object('deep_modifiers',e.deep_modifiers) else '{}'::jsonb end order by j.ord),'[]') into jobs
   from jsonb_array_elements(result->'expeditions') with ordinality j(value,ord) join public.dc_expeditions e on e.id=(j.value->>'id')::uuid;
  result:=jsonb_set(result,'{expeditions}',jobs);
 end if;
 return result||jsonb_build_object('schema_version',5,'deep_catalog',public.dc_deep_catalog_v7(),'deep_operations',jsonb_build_object('infrastructure_capacity',case when company.shaft_level=6 then 192 else 128 end,'lift_discount_percent',case when company.shaft_level=6 and exists(select 1 from public.dc_research_orders r where r.company_id=p_company and r.research_key='deep_operations_2' and r.completed_at is not null) then 75 else 0 end));
end $$;

do $$ declare f record;begin
 for f in select p.proname,p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);
  if f.proname in('dc_bootstrap','dc_get','dc_reconcile','dc_preview','dc_dispatch','dc_collect','dc_sell','dc_upgrade','dc_hire','dc_train','dc_assign_equipment','dc_repair_equipment','dc_start_production','dc_collect_production','dc_retire_equipment','dc_preview_operation','dc_dispatch_operation','dc_resolve_discovery','dc_start_research','dc_fulfill_contract','dc_claim_milestone','dc_get_club','dc_set_social_preferences','dc_contribute_project','dc_claim_project') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end $$;
notify pgrst,'reload schema';
