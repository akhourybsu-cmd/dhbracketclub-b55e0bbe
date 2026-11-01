-- Deep Claim Phase 4: permanent company development and finite delivery orders.
-- Field configuration three and every existing geological/job snapshot survive.
begin;
-- Authorized calls lock the asset before the company. Take the metadata row
-- first as well, so callers cannot hold its SHARE lock behind our table barrier.
update public.platform_assets set full_description='Build a persistent private mining company inside your club. Explore finite deposits and new-chunk caverns, hire and equip workers, run surveys, and construct four kinds of underground infrastructure. Bounded incidents delay setup without stealing ore or injuring staff. Recover specimens to keep, sell or salvage. Develop seven paid research branches, fulfill twelve permanent delivery orders, refine metals and gems including bronze, steel and gold, and claim source-backed company milestones. Shaft technology supports 599 metres. Frozen server timestamps preserve offline work. Company credits and progression remain separate from DH Score; shared club projects and social rewards belong to future phases.',updated_at=now() where slug='deep-claim';
lock table public.dc_companies in access exclusive mode;
lock table public.dc_production_jobs in share row exclusive mode;
update public.dc_companies set revision=revision+1;

-- Catalog is generated from the shared, reviewed public business definitions.
insert into public.dc_rules(version,config) values(4,$dc_business_catalog${"version":4,"research":[{"key":"excavation_1","name":"Cutting Methods","branch":"excavation","tier":1,"description":"Improves mining by 4.","requires":[],"required_building_level":1,"cash_cost":70,"inputs":{"stone":12,"clay":6},"duration_seconds":300,"stat_bonuses":{"mining":4},"processing_speed_percent":0,"unlocks_recipes":[]},{"key":"excavation_2","name":"Precision Extraction","branch":"excavation","tier":2,"description":"Improves mining by 6.","requires":["excavation_1","geology_1"],"required_building_level":2,"cash_cost":280,"inputs":{"iron_bar":3,"polished_quartz":2},"duration_seconds":1200,"stat_bonuses":{"mining":6},"processing_speed_percent":0,"unlocks_recipes":[]},{"key":"geology_1","name":"Field Assaying","branch":"geology","tier":1,"description":"Improves geology by 4.","requires":[],"required_building_level":1,"cash_cost":60,"inputs":{"quartz":4,"clay":4},"duration_seconds":300,"stat_bonuses":{"geology":4},"processing_speed_percent":0,"unlocks_recipes":[]},{"key":"geology_2","name":"Crystal Analysis","branch":"geology","tier":2,"description":"Improves geology by 6.","requires":["geology_1","deep_operations_1"],"required_building_level":2,"cash_cost":300,"inputs":{"silver_bar":1,"polished_quartz":4},"duration_seconds":1200,"stat_bonuses":{"geology":6},"processing_speed_percent":0,"unlocks_recipes":[]},{"key":"processing_1","name":"Alloy Practice","branch":"processing","tier":1,"description":"Reduces future production times by 5 additional percent. Unlocks new industrial recipes.","requires":[],"required_building_level":1,"cash_cost":80,"inputs":{"copper_bar":1,"tin_bar":1,"coal":4},"duration_seconds":300,"stat_bonuses":{},"processing_speed_percent":5,"unlocks_recipes":["smelt_bronze"]},{"key":"processing_2","name":"Industrial Metallurgy","branch":"processing","tier":2,"description":"Reduces future production times by 10 additional percent. Unlocks new industrial recipes.","requires":["processing_1","excavation_2"],"required_building_level":2,"cash_cost":400,"inputs":{"iron_bar":4,"silver_bar":1,"polished_quartz":3},"duration_seconds":1200,"stat_bonuses":{},"processing_speed_percent":10,"unlocks_recipes":["smelt_steel","smelt_gold"]},{"key":"logistics_1","name":"Route Planning","branch":"logistics","tier":1,"description":"Improves logistics by 4.","requires":[],"required_building_level":1,"cash_cost":60,"inputs":{"stone":10,"clay":8},"duration_seconds":300,"stat_bonuses":{"logistics":4},"processing_speed_percent":0,"unlocks_recipes":[]},{"key":"logistics_2","name":"Freight Engineering","branch":"logistics","tier":2,"description":"Improves logistics by 6. Unlocks new industrial recipes.","requires":["logistics_1","processing_2"],"required_building_level":2,"cash_cost":300,"inputs":{"steel_bar":2,"copper_bar":2},"duration_seconds":1200,"stat_bonuses":{"logistics":6},"processing_speed_percent":0,"unlocks_recipes":["craft_steel_cargo_harness"]},{"key":"workforce_1","name":"Crew Coordination","branch":"workforce","tier":1,"description":"Improves leadership by 4.","requires":[],"required_building_level":1,"cash_cost":70,"inputs":{"clay":8,"coal":4},"duration_seconds":300,"stat_bonuses":{"leadership":4},"processing_speed_percent":0,"unlocks_recipes":[]},{"key":"workforce_2","name":"Long Shift Training","branch":"workforce","tier":2,"description":"Improves endurance by 6.","requires":["workforce_1","safety_1"],"required_building_level":2,"cash_cost":220,"inputs":{"iron_bar":2,"polished_quartz":2},"duration_seconds":1200,"stat_bonuses":{"endurance":6},"processing_speed_percent":0,"unlocks_recipes":[]},{"key":"safety_1","name":"Safe Work Practice","branch":"safety","tier":1,"description":"Improves safety by 4.","requires":[],"required_building_level":1,"cash_cost":60,"inputs":{"stone":10,"coal":4},"duration_seconds":300,"stat_bonuses":{"safety":4},"processing_speed_percent":0,"unlocks_recipes":[]},{"key":"safety_2","name":"Reliable Operations","branch":"safety","tier":2,"description":"Improves safety by 6.","requires":["safety_1","deep_operations_1"],"required_building_level":2,"cash_cost":260,"inputs":{"iron_bar":3,"copper_bar":2},"duration_seconds":1200,"stat_bonuses":{"safety":6},"processing_speed_percent":0,"unlocks_recipes":[]},{"key":"deep_operations_1","name":"Worksite Engineering","branch":"deep_operations","tier":1,"description":"Improves engineering by 4.","requires":[],"required_building_level":1,"cash_cost":90,"inputs":{"copper_bar":1,"stone":10},"duration_seconds":300,"stat_bonuses":{"engineering":4},"processing_speed_percent":0,"unlocks_recipes":[]},{"key":"deep_operations_2","name":"Deep Cutting Systems","branch":"deep_operations","tier":2,"description":"Improves engineering by 6. Unlocks new industrial recipes.","requires":["deep_operations_1","excavation_2","processing_2"],"required_building_level":2,"cash_cost":450,"inputs":{"steel_bar":3,"cut_amethyst":1},"duration_seconds":1200,"stat_bonuses":{"engineering":6},"processing_speed_percent":0,"unlocks_recipes":["craft_steel_pickaxe"]}],"contracts":[{"key":"yard_foundations","version":1,"name":"Yard Foundations","description":"Deliver the complete collected order for a one-time credit payout.","tier":1,"requires_contracts":[],"required_research":[],"inputs":{"stone":20},"reward":24},{"key":"boiler_fuel","version":1,"name":"Boiler Fuel","description":"Deliver the complete collected order for a one-time credit payout.","tier":1,"requires_contracts":["yard_foundations"],"required_research":[],"inputs":{"coal":10},"reward":46},{"key":"pottery_clay","version":1,"name":"Pottery Clay","description":"Deliver the complete collected order for a one-time credit payout.","tier":1,"requires_contracts":["yard_foundations"],"required_research":[],"inputs":{"clay":20},"reward":46},{"key":"copper_assay","version":1,"name":"Copper Assay","description":"Deliver the complete collected order for a one-time credit payout.","tier":1,"requires_contracts":["boiler_fuel"],"required_research":[],"inputs":{"copper_ore":10},"reward":92},{"key":"copper_fittings","version":1,"name":"Copper Fittings","description":"Deliver the complete collected order for a one-time credit payout.","tier":2,"requires_contracts":["copper_assay"],"required_research":[],"inputs":{"copper_bar":4},"reward":250},{"key":"structural_iron","version":1,"name":"Structural Iron","description":"Deliver the complete collected order for a one-time credit payout.","tier":2,"requires_contracts":["copper_assay"],"required_research":[],"inputs":{"iron_bar":6},"reward":483},{"key":"alloy_stock","version":1,"name":"Alloy Stock","description":"Deliver the complete collected order for a one-time credit payout.","tier":2,"requires_contracts":["copper_fittings"],"required_research":["processing_1"],"inputs":{"bronze_bar":4},"reward":368},{"key":"optical_quartz","version":1,"name":"Optical Quartz","description":"Deliver the complete collected order for a one-time credit payout.","tier":2,"requires_contracts":["pottery_clay"],"required_research":[],"inputs":{"polished_quartz":8},"reward":257},{"key":"steel_bracing","version":1,"name":"Steel Bracing","description":"Deliver the complete collected order for a one-time credit payout.","tier":3,"requires_contracts":["structural_iron"],"required_research":["processing_2"],"inputs":{"steel_bar":4},"reward":483},{"key":"gold_commission","version":1,"name":"Gold Commission","description":"Deliver the complete collected order for a one-time credit payout.","tier":3,"requires_contracts":["copper_fittings"],"required_research":["processing_2"],"inputs":{"gold_bar":2},"reward":483},{"key":"crystal_instruments","version":1,"name":"Crystal Instruments","description":"Deliver the complete collected order for a one-time credit payout.","tier":3,"requires_contracts":["optical_quartz"],"required_research":["geology_2"],"inputs":{"cut_amethyst":4,"polished_quartz":4},"reward":703},{"key":"frontier_industry","version":1,"name":"Frontier Industry","description":"Deliver the complete collected order for a one-time credit payout.","tier":3,"requires_contracts":["steel_bracing","gold_commission","crystal_instruments"],"required_research":["deep_operations_2","logistics_2"],"inputs":{"steel_bar":4,"bronze_bar":4,"gold_bar":2},"reward":1334}],"milestones":[{"key":"first_shift","name":"First Shift","description":"Complete the recorded company objective and claim its one-time credit award.","metric":"completed_mining_expeditions","target":1,"reward":10},{"key":"first_batch","name":"First Batch","description":"Complete the recorded company objective and claim its one-time credit award.","metric":"collected_production_batches","target":1,"reward":20},{"key":"first_installation","name":"Built to Last","description":"Complete the recorded company objective and claim its one-time credit award.","metric":"installed_infrastructure","target":1,"reward":30},{"key":"first_research","name":"Better Methods","description":"Complete the recorded company objective and claim its one-time credit award.","metric":"completed_research","target":1,"reward":40},{"key":"depth_100","name":"One Hundred Down","description":"Complete the recorded company objective and claim its one-time credit award.","metric":"max_completed_mining_depth","target":100,"reward":50},{"key":"three_deliveries","name":"Trusted Supplier","description":"Complete the recorded company objective and claim its one-time credit award.","metric":"completed_contracts","target":3,"reward":70},{"key":"three_kept_finds","name":"Cabinet Curator","description":"Complete the recorded company objective and claim its one-time credit award.","metric":"kept_discoveries","target":3,"reward":80},{"key":"industrialist","name":"Industrialist","description":"Complete the recorded company objective and claim its one-time credit award.","metric":"collected_processed_units","target":40,"reward":100}],"caps":{"active_research":1},"buildings":{"research_office":{"costs":[80,250]},"trading_post":{"costs":[60,200,500]}},"resources":[{"id":"bronze_bar","name":"Bronze bar","sell_price":80,"color":"#b68b52","description":"Copper and tin alloy used for industrial fittings."},{"id":"steel_bar","name":"Steel bar","sell_price":105,"color":"#aabecb","description":"Carbon-strengthened structural metal for advanced crew equipment."},{"id":"gold_bar","name":"Gold bar","sell_price":210,"color":"#e3bd61","description":"Refined gold for high-value industrial commissions."}],"equipment":[{"key":"steel_pickaxe","name":"Steel Pickaxe","slot":"tool","tier":3,"max_durability":180,"bonuses":{"mining":26,"engineering":8,"endurance":4},"repair_rate":0.5,"repair_materials":{"steel_bar":1,"polished_quartz":1}},{"key":"steel_cargo_harness","name":"Steel Cargo Harness","slot":"utility","tier":3,"max_durability":180,"bonuses":{"logistics":26,"endurance":8,"leadership":4},"repair_rate":0.4,"repair_materials":{"steel_bar":1,"bronze_bar":1}}],"recipes":[{"key":"smelt_bronze","version":1,"name":"Smelt Bronze","station":"smeltery","required_station_level":1,"duration_seconds":360,"cash_cost":12,"inputs":{"copper_bar":1,"tin_bar":1,"coal":2},"outputs":{"bronze_bar":2},"equipment_output":null,"max_batches":10,"required_research":["processing_1"]},{"key":"smelt_steel","version":1,"name":"Smelt Steel","station":"smeltery","required_station_level":2,"duration_seconds":600,"cash_cost":18,"inputs":{"iron_bar":2,"coal":4},"outputs":{"steel_bar":2},"equipment_output":null,"max_batches":10,"required_research":["processing_2"]},{"key":"smelt_gold","version":1,"name":"Smelt Gold","station":"smeltery","required_station_level":2,"duration_seconds":600,"cash_cost":18,"inputs":{"gold_ore":8,"coal":3},"outputs":{"gold_bar":2},"equipment_output":null,"max_batches":10,"required_research":["processing_2"]},{"key":"craft_steel_pickaxe","version":1,"name":"Craft Steel Pickaxe","station":"tool_station","required_station_level":3,"duration_seconds":900,"cash_cost":95,"inputs":{"steel_bar":3,"bronze_bar":1,"polished_quartz":2},"outputs":{},"equipment_output":"steel_pickaxe","max_batches":10,"required_research":["deep_operations_2"]},{"key":"craft_steel_cargo_harness","version":1,"name":"Craft Steel Cargo Harness","station":"tool_station","required_station_level":3,"duration_seconds":840,"cash_cost":85,"inputs":{"steel_bar":3,"bronze_bar":2,"clay":8},"outputs":{},"equipment_output":"steel_cargo_harness","max_batches":10,"required_research":["logistics_2"]}]}$dc_business_catalog$::jsonb);
alter table public.dc_companies alter column rules_version set default 4;
alter table public.dc_companies add column research_office_level integer not null default 0 check(research_office_level between 0 and 2),
 add column trading_post_level integer not null default 0 check(trading_post_level between 0 and 3);
alter table public.dc_inventory drop constraint dc_inventory_resource_key_check;
alter table public.dc_inventory add constraint dc_inventory_resource_key_check check(resource_key in('stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore','amethyst','gold_ore','copper_bar','tin_bar','iron_bar','silver_bar','polished_quartz','cut_amethyst','bronze_bar','steel_bar','gold_bar'));
alter table public.dc_production_jobs add column config_version integer not null default 2 references public.dc_rules(version),
 add column research_speed_percent integer not null default 0 check(research_speed_percent between 0 and 15);

create table public.dc_research_orders(company_id uuid not null references public.dc_companies(id),research_key text not null,
 definition_snapshot jsonb not null,cash_cost integer not null check(cash_cost>0),inputs jsonb not null,
 started_at timestamptz not null,completes_at timestamptz not null,completed_at timestamptz,
 primary key(company_id,research_key),check(completes_at=started_at+(definition_snapshot->>'duration_seconds')::integer*interval '1 second'),
 check(completed_at is null or completed_at>=completes_at));
create unique index dc_one_active_research on public.dc_research_orders(company_id) where completed_at is null;
create table public.dc_company_contracts(company_id uuid not null references public.dc_companies(id),contract_key text not null,
 definition_snapshot jsonb not null,completed_at timestamptz,primary key(company_id,contract_key));
create table public.dc_milestone_receipts(company_id uuid not null references public.dc_companies(id),milestone_key text not null,
 definition_snapshot jsonb not null,reward integer not null check(reward between 10 and 120),claimed_at timestamptz not null,
 request_id uuid not null unique references public.dc_requests(request_id) deferrable initially deferred,primary key(company_id,milestone_key));

do $$ declare t text;begin
 foreach t in array array['dc_research_orders','dc_company_contracts','dc_milestone_receipts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

-- Retain exact old implementations for compatibility and bounded adapters.
do $bases$
declare item text;signature text;definition text;
begin
 foreach item in array array['dc_stats_v1','dc_snapshot_v1','dc_reconcile_v1','dc_bootstrap','dc_price_v1','dc_start_production','dc_upgrade'] loop
  signature:=case item when 'dc_stats_v1' then '(dc_workers)' when 'dc_bootstrap' then '(text,uuid)' when 'dc_price_v1' then '(text)'
   when 'dc_start_production' then '(text,integer,integer,uuid)' when 'dc_upgrade' then '(text,integer,uuid)' else '(uuid,timestamptz)' end;
  if to_regprocedure('public.'||item||'_phase3_base'||signature) is not null then raise exception 'Deep Claim business adapter already exists';end if;
  definition:=pg_get_functiondef(to_regprocedure('public.'||item||signature));
  execute replace(definition,'FUNCTION public.'||item||'(','FUNCTION public.'||item||'_phase3_base(');
 end loop;
end $bases$;

create or replace function public.dc_business_catalog_v4() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$select config from public.dc_rules where version=4$$;
insert into public.dc_recipes select d->>'key',(d->>'version')::integer,d from jsonb_array_elements(public.dc_business_catalog_v4()->'recipes')d;
insert into public.dc_equipment_catalog select d->>'key',1,d from jsonb_array_elements(public.dc_business_catalog_v4()->'equipment')d;
create or replace function public.dc_resources_v1() returns text[] language sql immutable as $$select array['stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore','amethyst','gold_ore','copper_bar','tin_bar','iron_bar','silver_bar','polished_quartz','cut_amethyst','bronze_bar','steel_bar','gold_bar']::text[]$$;
create or replace function public.dc_price_v1(p_key text) returns integer language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(public.dc_price_v1_phase3_base(p_key),(select (value->>'sell_price')::integer from jsonb_array_elements(public.dc_business_catalog_v4()->'resources') where value->>'id'=p_key))
$$;
create or replace function public.dc_research_bonuses_v4(p_company uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_object_agg(key,bonus),'{}') from(select b.key,sum((b.value::text)::integer)::integer bonus from public.dc_research_orders r
 cross join lateral jsonb_each(r.definition_snapshot->'stat_bonuses')b where r.company_id=p_company and r.completed_at is not null group by b.key)s
$$;
create or replace function public.dc_processing_speed_v4(p_company uuid) returns integer language sql stable security definer set search_path=public,pg_temp as $$
 select least(15,coalesce(sum((definition_snapshot->>'processing_speed_percent')::integer),0))::integer from public.dc_research_orders where company_id=p_company and completed_at is not null
$$;
create or replace function public.dc_stats_v1(p_worker public.dc_workers) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_object_agg(s.key,least(100,(s.value::text)::integer+coalesce((public.dc_research_bonuses_v4(p_worker.company_id)->>s.key)::integer,0))) from jsonb_each(public.dc_stats_v1_phase3_base(p_worker))s
$$;
create or replace function public.dc_ensure_business_v4(p_company uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare inserted integer;begin
 insert into public.dc_company_contracts(company_id,contract_key,definition_snapshot)
 select p_company,value->>'key',value from jsonb_array_elements(public.dc_business_catalog_v4()->'contracts') on conflict do nothing;
 get diagnostics inserted=row_count;return inserted>0;
end $$;
create or replace function public.dc_business_stats_v4(p_company uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
 'completed_mining_expeditions',(select count(*) from public.dc_expeditions where company_id=p_company and mode in('extract','explore') and status in('ready','collected')),
 'completed_surveys',(select count(*) from public.dc_expeditions where company_id=p_company and mode='survey' and status='collected'),
 'total_surveyed_tiles',(select coalesce(sum((result->>'tiles_revealed')::integer),0) from public.dc_field_events where company_id=p_company and kind='survey' and applied_at is not null),
 'installed_infrastructure',(select count(*) from public.dc_infrastructure where company_id=p_company and status='installed'),
 'max_completed_mining_depth',(select coalesce(max(target_y),0) from public.dc_expeditions where company_id=p_company and mode in('extract','explore') and status in('ready','collected')),
 'collected_production_batches',(select coalesce(sum(batches),0) from public.dc_production_jobs where company_id=p_company and status='collected'),
 'collected_processed_units',(select coalesce(sum((o.value::text)::integer*j.batches),0) from public.dc_production_jobs j cross join lateral jsonb_each(j.recipe_snapshot->'outputs')o where j.company_id=p_company and j.status='collected'),
 'completed_research',(select count(*) from public.dc_research_orders where company_id=p_company and completed_at is not null),
 'completed_contracts',(select count(*) from public.dc_company_contracts where company_id=p_company and completed_at is not null),
 'total_contract_credits',(select coalesce(sum((definition_snapshot->>'reward')::integer),0) from public.dc_company_contracts where company_id=p_company and completed_at is not null),
 'kept_discoveries',(select count(*) from public.dc_discoveries where company_id=p_company and status='kept'))
$$;
create or replace function public.dc_business_view_v4(p_company uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare stats jsonb:=public.dc_business_stats_v4(p_company);
begin return jsonb_build_object(
 'research',(select coalesce(jsonb_agg(jsonb_build_object('key',research_key,'status',case when completed_at is null then 'active' else 'completed' end,'started_at',started_at,'completes_at',completes_at,'completed_at',completed_at) order by started_at,research_key),'[]') from public.dc_research_orders where company_id=p_company),
 'contracts',(select coalesce(jsonb_agg(jsonb_build_object('key',contract_key,'status',case when completed_at is null then 'offered' else 'completed' end,'completed_at',completed_at) order by contract_key),'[]') from public.dc_company_contracts where company_id=p_company),
 'milestones',(select coalesce(jsonb_agg(jsonb_build_object('key',d.value->>'key','progress',least((d.value->>'target')::bigint,coalesce((stats->>(d.value->>'metric'))::bigint,0)),'claimed_at',r.claimed_at) order by d.ord),'[]') from jsonb_array_elements(public.dc_business_catalog_v4()->'milestones') with ordinality d(value,ord)
 left join public.dc_milestone_receipts r on r.company_id=p_company and r.milestone_key=d.value->>'key' where p_company is not null),
 'stats',stats,'research_bonuses',public.dc_research_bonuses_v4(p_company),'processing_speed_percent',public.dc_processing_speed_v4(p_company));end $$;
create or replace function public.dc_reconcile_v1(p_company uuid,p_now timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare changed boolean;item public.dc_research_orders%rowtype;begin
 perform public.dc_reconcile_v1_phase3_base(p_company,p_now);
 changed:=public.dc_ensure_business_v4(p_company);
 for item in update public.dc_research_orders set completed_at=completes_at where company_id=p_company and completed_at is null and completes_at<=p_now returning * loop
  insert into public.dc_logs(company_id,kind,title) values(p_company,'research_completed',item.definition_snapshot->>'name'||' completed. New work now uses its permanent benefits.');changed:=true;
 end loop;
 if changed then update public.dc_companies set revision=revision+1 where id=p_company;end if;
end $$;

create or replace function public.dc_buildings_v4(p_company public.dc_companies) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb:=public.dc_buildings_v3(p_company);key text;level integer;maximum integer;cost integer;begin
 foreach key in array array['research_office','trading_post'] loop
  level:=case key when 'research_office' then p_company.research_office_level else p_company.trading_post_level end;maximum:=case key when 'research_office' then 2 else 3 end;
  cost:=case when level<maximum then (public.dc_business_catalog_v4()->'buildings'->key->'costs'->>level)::integer else null end;
  result:=result||jsonb_build_array(jsonb_build_object('key',key,'level',level,'max_level',maximum,'upgrade_cost',cost,'effect',case key when 'research_office' then 'Tier '||level||' company research' else 'Tier '||level||' permanent delivery orders' end));
 end loop;return result;end $$;
create or replace function public.dc_recipes_view_v4(p_company public.dc_companies) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(r.definition||jsonb_build_object('required_research',coalesce(r.definition->'required_research','[]'),
 'research_speed_percent',public.dc_processing_speed_v4(p_company.id),'locked',exists(select 1 from jsonb_array_elements_text(coalesce(r.definition->'required_research','[]'))k where not exists(select 1 from public.dc_research_orders o where o.company_id=p_company.id and o.research_key=k and o.completed_at is not null)),
 'effective_duration_seconds',greatest(20,ceil(ceil((r.definition->>'duration_seconds')::numeric*(array[100,85,70])[greatest(1,coalesce(public.dc_building_level_v2(p_company,r.definition->>'station'),0))]/100)*(100-public.dc_processing_speed_v4(p_company.id))/100)::integer)) order by r.recipe_key),'[]') from public.dc_recipes r where r.version=1
$$;
create or replace function public.dc_snapshot_v1(p_company uuid,p_now timestamptz) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb:=public.dc_snapshot_v1_phase3_base(p_company,p_now);company public.dc_companies%rowtype;jobs jsonb;begin
 if p_company is not null then
  select * into company from public.dc_companies where id=p_company;result:=jsonb_set(result,'{buildings}',public.dc_buildings_v4(company));
  select coalesce(jsonb_agg(j.value||jsonb_build_object('research_speed_percent',p.research_speed_percent,'recipe_snapshot',p.recipe_snapshot) order by j.ord),'[]') into jobs
   from jsonb_array_elements(result->'production_jobs') with ordinality j(value,ord) join public.dc_production_jobs p on p.id=(j.value->>'id')::uuid;
  result:=jsonb_set(result,'{production_jobs}',jobs);
 end if;
 return result||jsonb_build_object('schema_version',4,'recipes',public.dc_recipes_view_v4(company),'business_catalog',public.dc_business_catalog_v4(),'business',public.dc_business_view_v4(p_company));end $$;
create or replace function public.dc_bootstrap(p_name text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid;begin
 perform public.dc_bootstrap_phase3_base(p_name,p_request_id);company:=public.dc_lock_v1();return public.dc_snapshot_v1(company,clock_timestamp());end $$;

-- Preserve all existing arguments and receipt fingerprints on production and
-- upgrades; only new unpaid actions evaluate current research and building rules.
do $industry$
declare definition text;begin
 definition:=pg_get_functiondef('public.dc_start_production_phase3_base(text,integer,integer,uuid)'::regprocedure);
 definition:=public.dc_replace_required_v3(definition,'FUNCTION public.dc_start_production_phase3_base(','FUNCTION public.dc_start_production(');
 definition:=public.dc_replace_required_v3(definition,'start_time timestamptz;','start_time timestamptz;research_speed integer;');
 definition:=public.dc_replace_required_v3(definition,'station_key:=recipe->>''station'';',$gate$
 if exists(select 1 from jsonb_array_elements_text(coalesce(recipe->'required_research','[]'))k where not exists(select 1 from public.dc_research_orders o where o.company_id=company and o.research_key=k and o.completed_at is not null)) then raise exception 'Complete the required research before starting this recipe';end if;
 station_key:=recipe->>'station';$gate$);
 definition:=public.dc_replace_required_v3(definition,'duration:=ceil((recipe->>''duration_seconds'')::numeric*(array[100,85,70])[station_level]/100)::integer*p_batches;',
  'research_speed:=public.dc_processing_speed_v4(company);duration:=greatest(20,ceil(ceil((recipe->>''duration_seconds'')::numeric*(array[100,85,70])[station_level]/100)*(100-research_speed)/100)::integer)*p_batches;');
 definition:=public.dc_replace_required_v3(definition,'inputs,outputs,equipment_outputs)'||chr(10)||' values(company,p_recipe_key,1,recipe,equipment_definition,p_batches,station_key,start_time,start_time+duration*interval ''1 second'',duration,cost,input_stock,output_stock,equipment_outputs)',
  'inputs,outputs,equipment_outputs,config_version,research_speed_percent)'||chr(10)||' values(company,p_recipe_key,1,recipe,equipment_definition,p_batches,station_key,start_time,start_time+duration*interval ''1 second'',duration,cost,input_stock,output_stock,equipment_outputs,4,research_speed)');
 execute definition;
 definition:=pg_get_functiondef('public.dc_upgrade_phase3_base(text,integer,uuid)'::regprocedure);
 definition:=public.dc_replace_required_v3(definition,'FUNCTION public.dc_upgrade_phase3_base(','FUNCTION public.dc_upgrade(');
 definition:=public.dc_replace_required_v3(definition,'public.dc_buildings_v3(c)','public.dc_buildings_v4(c)');
 definition:=public.dc_replace_required_v3(definition,'gem_workshop_level=gem_workshop_level+case when p_building_key=''gem_workshop'' then 1 else 0 end where id=company;',
  'gem_workshop_level=gem_workshop_level+case when p_building_key=''gem_workshop'' then 1 else 0 end,research_office_level=research_office_level+case when p_building_key=''research_office'' then 1 else 0 end,trading_post_level=trading_post_level+case when p_building_key=''trading_post'' then 1 else 0 end where id=company;');
 execute definition;
end $industry$;
create or replace function public.dc_current_production_v4() returns trigger language plpgsql set search_path=public,pg_temp as $$begin
 if new.config_version<>4 then raise exception 'Production rules changed. Refresh and review the order.' using errcode='40001';end if;return new;end $$;
create trigger dc_current_production before insert on public.dc_production_jobs for each row execute function public.dc_current_production_v4();

create or replace function public.dc_start_research(p_research_key text,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;definition jsonb;resource record;moment timestamptz:=clock_timestamp();cost integer;
 payload jsonb:=jsonb_build_object('research_key',p_research_key,'expected_revision',p_expected_revision);begin
 if public.dc_receipt_v1(company,p_request_id,'start_research',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 select value into definition from jsonb_array_elements(public.dc_business_catalog_v4()->'research') where value->>'key'=p_research_key;
 if definition is null then raise exception 'Research unavailable';end if;
 if exists(select 1 from public.dc_research_orders where company_id=company and research_key=p_research_key) then raise exception 'This research has already been ordered';end if;
 if exists(select 1 from public.dc_research_orders where company_id=company and completed_at is null) then raise exception 'Complete the active research order before starting another';end if;
 if c.research_office_level<(definition->>'required_building_level')::integer then raise exception 'Build or upgrade the research office for this research tier';end if;
 if exists(select 1 from jsonb_array_elements_text(definition->'requires')k where not exists(select 1 from public.dc_research_orders o where o.company_id=company and o.research_key=k and o.completed_at is not null)) then raise exception 'Complete the prerequisite research first';end if;
 cost:=(definition->>'cash_cost')::integer;if c.cash-cost<2 then raise exception 'Keep $2 operating cash after research costs';end if;
 for resource in select key,(value::text)::integer quantity from jsonb_each(definition->'inputs') loop
  update public.dc_inventory set quantity=quantity-resource.quantity where company_id=company and resource_key=resource.key and quantity>=resource.quantity;
  if not found then raise exception 'Not enough collected materials for this research';end if;
 end loop;
 insert into public.dc_research_orders values(company,p_research_key,definition,cost,definition->'inputs',moment,moment+(definition->>'duration_seconds')::integer*interval '1 second',null);
 update public.dc_companies set cash=cash-cost,revision=revision+1 where id=company;
 insert into public.dc_logs(company_id,kind,title) values(company,'research_started',definition->>'name'||' commissioned. Paid work continues while you are away.');
 perform public.dc_store_receipt_v1(company,p_request_id,'start_research',payload);return public.dc_snapshot_v1(company,clock_timestamp());end $$;
create or replace function public.dc_fulfill_contract(p_contract_key text,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;contract public.dc_company_contracts%rowtype;definition jsonb;resource record;
 payload jsonb:=jsonb_build_object('contract_key',p_contract_key,'expected_revision',p_expected_revision);begin
 if public.dc_receipt_v1(company,p_request_id,'fulfill_contract',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 select * into contract from public.dc_company_contracts where company_id=company and contract_key=p_contract_key for update;
 if not found then raise exception 'Delivery order unavailable';end if;if contract.completed_at is not null then raise exception 'This delivery order has already been completed';end if;definition:=contract.definition_snapshot;
 if c.trading_post_level<(definition->>'tier')::integer then raise exception 'Build or upgrade the trading post for this delivery tier';end if;
 if exists(select 1 from jsonb_array_elements_text(definition->'requires_contracts')k where not exists(select 1 from public.dc_company_contracts o where o.company_id=company and o.contract_key=k and o.completed_at is not null)) then raise exception 'Complete the prerequisite delivery orders first';end if;
 if exists(select 1 from jsonb_array_elements_text(definition->'required_research')k where not exists(select 1 from public.dc_research_orders o where o.company_id=company and o.research_key=k and o.completed_at is not null)) then raise exception 'Complete the required research for this delivery order';end if;
 for resource in select key,(value::text)::integer quantity from jsonb_each(definition->'inputs') loop
  update public.dc_inventory set quantity=quantity-resource.quantity where company_id=company and resource_key=resource.key and quantity>=resource.quantity;
  if not found then raise exception 'Collect the entire delivery order before fulfilling it';end if;
 end loop;
 update public.dc_company_contracts set completed_at=clock_timestamp() where company_id=company and contract_key=p_contract_key;
 update public.dc_companies set cash=cash+(definition->>'reward')::integer,revision=revision+1 where id=company;
 insert into public.dc_logs(company_id,kind,title) values(company,'contract_completed',definition->>'name'||' delivered. Its one-time credit payment is recorded.');
 perform public.dc_store_receipt_v1(company,p_request_id,'fulfill_contract',payload);return public.dc_snapshot_v1(company,clock_timestamp());end $$;
create or replace function public.dc_claim_milestone(p_milestone_key text,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;definition jsonb;stats jsonb;reward integer;
 payload jsonb:=jsonb_build_object('milestone_key',p_milestone_key,'expected_revision',p_expected_revision);begin
 if public.dc_receipt_v1(company,p_request_id,'claim_milestone',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 select value into definition from jsonb_array_elements(public.dc_business_catalog_v4()->'milestones') where value->>'key'=p_milestone_key;
 if definition is null then raise exception 'Milestone unavailable';end if;
 if exists(select 1 from public.dc_milestone_receipts where company_id=company and milestone_key=p_milestone_key) then raise exception 'This milestone has already been claimed';end if;
 stats:=public.dc_business_stats_v4(company);
 if coalesce((stats->>(definition->>'metric'))::bigint,0)<(definition->>'target')::integer then raise exception 'Complete the company objective before claiming this milestone';end if;
 reward:=(definition->>'reward')::integer;
 insert into public.dc_milestone_receipts values(company,p_milestone_key,definition,reward,clock_timestamp(),p_request_id);
 update public.dc_companies set cash=cash+reward,revision=revision+1 where id=company;
 insert into public.dc_logs(company_id,kind,title) values(company,'milestone_claimed',definition->>'name'||' milestone recorded. Its one-time award is claimed.');
 perform public.dc_store_receipt_v1(company,p_request_id,'claim_milestone',payload);return public.dc_snapshot_v1(company,clock_timestamp());end $$;

create or replace function public.dc_business_guard_v4() returns trigger language plpgsql set search_path=public,pg_temp as $$begin
 if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new;end if;
 if tg_op='UPDATE' then
  if tg_table_name='dc_research_orders' then
   if old.completed_at is null and new.completed_at is not null and (to_jsonb(new)-'completed_at')=(to_jsonb(old)-'completed_at') then return new;end if;
  elsif tg_table_name='dc_company_contracts' then
   if old.completed_at is null and new.completed_at is not null and (to_jsonb(new)-'completed_at')=(to_jsonb(old)-'completed_at') then return new;end if;
  end if;
 end if;raise exception 'Committed Deep Claim business definitions and receipts are immutable';end $$;
create trigger dc_research_order_guard before update or delete on public.dc_research_orders for each row execute function public.dc_business_guard_v4();
create trigger dc_contract_guard before update or delete on public.dc_company_contracts for each row execute function public.dc_business_guard_v4();
create trigger dc_milestone_guard_v4 before update or delete on public.dc_milestone_receipts for each row execute function public.dc_business_guard_v4();



do $$ declare f record;begin
 for f in select p.proname,p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);
  if f.proname in('dc_bootstrap','dc_get','dc_reconcile','dc_preview','dc_dispatch','dc_collect','dc_sell','dc_upgrade','dc_hire','dc_train','dc_assign_equipment','dc_repair_equipment','dc_start_production','dc_collect_production','dc_retire_equipment','dc_preview_operation','dc_dispatch_operation','dc_resolve_discovery','dc_start_research','dc_fulfill_contract','dc_claim_milestone') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
