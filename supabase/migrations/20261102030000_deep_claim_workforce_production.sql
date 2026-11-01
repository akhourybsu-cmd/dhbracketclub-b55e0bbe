-- Deep Claim Phase 2: workforce, owned equipment and bounded production.
-- Existing world seeds/chunks/terrain and immutable v1 expedition plans survive.
begin;

insert into public.dc_rules(version,config) values(2,$dc_phase2_catalog${"version":2,"training":{"cash_cost":30,"stat_gain":3},"wear_per_energy":2,"housing_capacities":[3,6,9,12],"station_speed_percent":[100,85,70],"building_costs":{"mine_office":[90,1200],"mine_shaft":[80,2000,5000],"warehouse":[60,1000],"tool_station":[50,1600],"workers_quarters":[90,450,1200],"smeltery":[90,350,900],"gem_workshop":[120,450,1100]},"candidate_profiles":[{"key":"miner","name":"Bram Holt","specialty":"miner","stats":{"mining":66,"geology":38,"engineering":45,"logistics":42,"safety":58,"endurance":70,"leadership":43},"traits":["sure_swing","heavy_boots"],"wage":3,"hire_cost":80},{"key":"geologist","name":"Ada Rowan","specialty":"geologist","stats":{"mining":38,"geology":76,"engineering":43,"logistics":45,"safety":63,"endurance":52,"leadership":55},"traits":["ore_eye","deliberate"],"wage":2,"hire_cost":95},{"key":"hauler","name":"Nell Mercer","specialty":"hauler","stats":{"mining":44,"geology":40,"engineering":50,"logistics":77,"safety":55,"endurance":70,"leadership":48},"traits":["pack_mule","short_stride"],"wage":2,"hire_cost":85},{"key":"engineer","name":"Oren Wren","specialty":"engineer","stats":{"mining":48,"geology":46,"engineering":78,"logistics":50,"safety":62,"endurance":55,"leadership":52},"traits":["sure_swing","deliberate"],"wage":3,"hire_cost":110},{"key":"surveyor","name":"Lena Vale","specialty":"surveyor","stats":{"mining":42,"geology":74,"engineering":52,"logistics":60,"safety":58,"endurance":66,"leadership":55},"traits":["ore_eye","short_stride"],"wage":3,"hire_cost":115},{"key":"demolitionist","name":"Rafe Cinder","specialty":"demolitionist","stats":{"mining":78,"geology":40,"engineering":72,"logistics":40,"safety":43,"endurance":69,"leadership":48},"traits":["sure_swing","heavy_boots"],"wage":4,"hire_cost":125},{"key":"safety_officer","name":"Mae Stone","specialty":"safety_officer","stats":{"mining":38,"geology":50,"engineering":58,"logistics":47,"safety":84,"endurance":63,"leadership":72},"traits":["pack_mule","deliberate"],"wage":3,"hire_cost":105}],"equipment":[{"key":"copper_pickaxe","name":"Copper Pickaxe","slot":"tool","tier":1,"max_durability":100,"bonuses":{"mining":10},"repair_rate":0.2,"repair_materials":{"stone":2}},{"key":"iron_pickaxe","name":"Iron Pickaxe","slot":"tool","tier":2,"max_durability":140,"bonuses":{"mining":18},"repair_rate":0.3,"repair_materials":{"stone":3,"iron_bar":1}},{"key":"miner_lantern","name":"Miner Lantern","slot":"utility","tier":1,"max_durability":100,"bonuses":{"engineering":8,"mining":4},"repair_rate":0.2,"repair_materials":{"coal":2}},{"key":"prism_lantern","name":"Prism Lantern","slot":"utility","tier":2,"max_durability":140,"bonuses":{"engineering":12,"mining":6},"repair_rate":0.3,"repair_materials":{"coal":3,"polished_quartz":1}},{"key":"copper_helmet","name":"Copper Helmet","slot":"head","tier":1,"max_durability":100,"bonuses":{"safety":8},"repair_rate":0.2,"repair_materials":{"stone":2}},{"key":"iron_helmet","name":"Iron Helmet","slot":"head","tier":2,"max_durability":140,"bonuses":{"safety":14},"repair_rate":0.3,"repair_materials":{"stone":3,"iron_bar":1}},{"key":"cargo_pack","name":"Cargo Pack","slot":"utility","tier":1,"max_durability":100,"bonuses":{"logistics":12},"repair_rate":0.2,"repair_materials":{"clay":2}},{"key":"hauler_frame","name":"Hauler Frame","slot":"utility","tier":2,"max_durability":140,"bonuses":{"logistics":20},"repair_rate":0.3,"repair_materials":{"clay":3,"iron_bar":1}},{"key":"survey_kit","name":"Survey Kit","slot":"utility","tier":1,"max_durability":100,"bonuses":{"geology":12},"repair_rate":0.2,"repair_materials":{"quartz":1}},{"key":"prism_survey_kit","name":"Prism Survey Kit","slot":"utility","tier":2,"max_durability":140,"bonuses":{"geology":20},"repair_rate":0.3,"repair_materials":{"quartz":2,"cut_amethyst":1}}],"recipes":[{"key":"smelt_copper","version":1,"name":"Smelt Copper","station":"smeltery","required_station_level":1,"duration_seconds":180,"cash_cost":8,"inputs":{"copper_ore":10,"coal":2},"outputs":{"copper_bar":2},"equipment_output":null,"max_batches":10},{"key":"smelt_tin","version":1,"name":"Smelt Tin","station":"smeltery","required_station_level":1,"duration_seconds":240,"cash_cost":10,"inputs":{"tin_ore":10,"coal":2},"outputs":{"tin_bar":2},"equipment_output":null,"max_batches":10},{"key":"smelt_iron","version":1,"name":"Smelt Iron","station":"smeltery","required_station_level":1,"duration_seconds":300,"cash_cost":12,"inputs":{"iron_ore":12,"coal":3},"outputs":{"iron_bar":3},"equipment_output":null,"max_batches":10},{"key":"smelt_silver","version":1,"name":"Smelt Silver","station":"smeltery","required_station_level":1,"duration_seconds":420,"cash_cost":16,"inputs":{"silver_ore":8,"coal":3},"outputs":{"silver_bar":2},"equipment_output":null,"max_batches":10},{"key":"polish_quartz","version":1,"name":"Polish Quartz","station":"gem_workshop","required_station_level":1,"duration_seconds":180,"cash_cost":6,"inputs":{"quartz":6},"outputs":{"polished_quartz":3},"equipment_output":null,"max_batches":10},{"key":"cut_amethyst","version":1,"name":"Cut Amethyst","station":"gem_workshop","required_station_level":1,"duration_seconds":480,"cash_cost":16,"inputs":{"amethyst":4},"outputs":{"cut_amethyst":2},"equipment_output":null,"max_batches":10},{"key":"craft_copper_pickaxe","version":1,"name":"Craft Copper Pickaxe","station":"tool_station","required_station_level":1,"duration_seconds":240,"cash_cost":20,"inputs":{"copper_bar":1,"stone":4},"outputs":{},"equipment_output":"copper_pickaxe","max_batches":10},{"key":"craft_iron_pickaxe","version":1,"name":"Craft Iron Pickaxe","station":"tool_station","required_station_level":2,"duration_seconds":480,"cash_cost":45,"inputs":{"iron_bar":2,"polished_quartz":1},"outputs":{},"equipment_output":"iron_pickaxe","max_batches":10},{"key":"craft_miner_lantern","version":1,"name":"Craft Miner Lantern","station":"tool_station","required_station_level":1,"duration_seconds":240,"cash_cost":18,"inputs":{"copper_bar":1,"tin_bar":1,"coal":2},"outputs":{},"equipment_output":"miner_lantern","max_batches":10},{"key":"craft_prism_lantern","version":1,"name":"Craft Prism Lantern","station":"tool_station","required_station_level":2,"duration_seconds":600,"cash_cost":55,"inputs":{"silver_bar":1,"cut_amethyst":1,"iron_bar":1},"outputs":{},"equipment_output":"prism_lantern","max_batches":10},{"key":"craft_copper_helmet","version":1,"name":"Craft Copper Helmet","station":"tool_station","required_station_level":1,"duration_seconds":240,"cash_cost":15,"inputs":{"copper_bar":1,"tin_bar":1,"stone":2},"outputs":{},"equipment_output":"copper_helmet","max_batches":10},{"key":"craft_iron_helmet","version":1,"name":"Craft Iron Helmet","station":"tool_station","required_station_level":2,"duration_seconds":420,"cash_cost":35,"inputs":{"iron_bar":2,"polished_quartz":1},"outputs":{},"equipment_output":"iron_helmet","max_batches":10},{"key":"craft_cargo_pack","version":1,"name":"Craft Cargo Pack","station":"tool_station","required_station_level":1,"duration_seconds":180,"cash_cost":15,"inputs":{"clay":6,"copper_bar":1},"outputs":{},"equipment_output":"cargo_pack","max_batches":10},{"key":"craft_hauler_frame","version":1,"name":"Craft Hauler Frame","station":"tool_station","required_station_level":2,"duration_seconds":420,"cash_cost":40,"inputs":{"iron_bar":2,"clay":8},"outputs":{},"equipment_output":"hauler_frame","max_batches":10},{"key":"craft_survey_kit","version":1,"name":"Craft Survey Kit","station":"tool_station","required_station_level":1,"duration_seconds":300,"cash_cost":25,"inputs":{"polished_quartz":2,"copper_bar":1},"outputs":{},"equipment_output":"survey_kit","max_batches":10},{"key":"craft_prism_survey_kit","version":1,"name":"Craft Prism Survey Kit","station":"tool_station","required_station_level":2,"duration_seconds":600,"cash_cost":65,"inputs":{"cut_amethyst":2,"gold_ore":2,"iron_bar":1},"outputs":{},"equipment_output":"prism_survey_kit","max_batches":10}],"resources":[{"id":"amethyst","name":"Amethyst","sell_price":50},{"id":"gold_ore","name":"Gold ore","sell_price":45},{"id":"copper_bar","name":"Copper bar","sell_price":55},{"id":"tin_bar","name":"Tin bar","sell_price":65},{"id":"iron_bar","name":"Iron bar","sell_price":70},{"id":"silver_bar","name":"Silver bar","sell_price":145},{"id":"polished_quartz","name":"Polished quartz","sell_price":28},{"id":"cut_amethyst","name":"Cut amethyst","sell_price":125}],"equipment_capacity":48}$dc_phase2_catalog$::jsonb);
alter table public.dc_companies alter column rules_version set default 2;
alter table public.dc_companies drop constraint dc_companies_shaft_level_check;
alter table public.dc_companies add constraint dc_companies_shaft_level_check check(shaft_level between 1 and 4);
alter table public.dc_companies add column quarters_level integer not null default 0 check(quarters_level between 0 and 3),
 add column smeltery_level integer not null default 0 check(smeltery_level between 0 and 3),
 add column gem_workshop_level integer not null default 0 check(gem_workshop_level between 0 and 3);
alter table public.dc_tiles drop constraint dc_tiles_material_check;
alter table public.dc_tiles add constraint dc_tiles_material_check check(material in('stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore','amethyst','gold_ore'));
alter table public.dc_inventory drop constraint dc_inventory_resource_key_check;
alter table public.dc_inventory add constraint dc_inventory_resource_key_check check(resource_key in('stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore','amethyst','gold_ore','copper_bar','tin_bar','iron_bar','silver_bar','polished_quartz','cut_amethyst'));

create table public.dc_equipment_catalog(definition_key text not null,version integer not null check(version>0),definition jsonb not null,primary key(definition_key,version));
create table public.dc_recipes(recipe_key text not null,version integer not null check(version>0),definition jsonb not null,primary key(recipe_key,version));
insert into public.dc_equipment_catalog select d->>'key',1,d from public.dc_rules r cross join lateral jsonb_array_elements(r.config->'equipment') d where r.version=2;
insert into public.dc_recipes select d->>'key',(d->>'version')::integer,d from public.dc_rules r cross join lateral jsonb_array_elements(r.config->'recipes') d where r.version=2;
create table public.dc_candidates(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.dc_companies(id),
 operating_day date not null,position integer not null check(position between 0 and 2),profile jsonb not null,
 hired_worker_id uuid unique references public.dc_workers(id),hired_at timestamptz,unique(company_id,operating_day,position),check((hired_worker_id is null)=(hired_at is null)));
create table public.dc_equipment(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.dc_companies(id),
 definition_key text not null,definition_version integer not null default 1,definition_snapshot jsonb not null,
 slot text not null check(slot in('tool','head','utility')),worker_id uuid references public.dc_workers(id),
 durability integer not null,max_durability integer not null check(max_durability>0),created_at timestamptz not null default now(),retired_at timestamptz,
 foreign key(definition_key,definition_version) references public.dc_equipment_catalog(definition_key,version),
 check(durability between 0 and max_durability),check(retired_at is null or worker_id is null));
create unique index dc_one_equipment_per_slot on public.dc_equipment(worker_id,slot) where worker_id is not null and retired_at is null;
create index dc_company_equipment on public.dc_equipment(company_id) where retired_at is null;
create table public.dc_training(worker_id uuid not null references public.dc_workers(id),operating_day date not null,
 stat text not null check(stat in('mining','geology','engineering','logistics','safety','endurance','leadership')),
 old_value integer not null check(old_value between 1 and 99),new_value integer not null check(new_value between 2 and 100),
 cash_cost integer not null check(cash_cost>0),request_id uuid not null unique,created_at timestamptz not null default now(),primary key(worker_id,operating_day),
 foreign key(request_id) references public.dc_requests(request_id) deferrable initially deferred);
create table public.dc_production_jobs(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.dc_companies(id),
 recipe_key text not null,recipe_version integer not null,recipe_snapshot jsonb not null,equipment_snapshot jsonb,
 batches integer not null check(batches between 1 and 10),station text not null check(station in('smeltery','gem_workshop','tool_station')),
 status text not null default 'active' check(status in('active','ready','collected')),started_at timestamptz not null,completes_at timestamptz not null,
 duration_seconds integer not null check(duration_seconds>0),cash_cost integer not null check(cash_cost>=0),inputs jsonb not null,outputs jsonb not null,equipment_outputs jsonb not null,
 equipment_collected boolean not null default false,collected_at timestamptz,
 foreign key(recipe_key,recipe_version) references public.dc_recipes(recipe_key,version),check(completes_at=started_at+duration_seconds*interval '1 second'));
create index dc_production_queue on public.dc_production_jobs(company_id,station,completes_at) where status<>'collected';
alter table public.dc_equipment add column production_job_id uuid references public.dc_production_jobs(id);
create table public.dc_job_equipment(job_id uuid not null references public.dc_expeditions(id),item_id uuid not null references public.dc_equipment(id),
 wear_amount integer not null check(wear_amount between 2 and 6),initial_durability integer not null check(initial_durability>=0),applied_at timestamptz,primary key(job_id,item_id));

do $$ declare t text;begin
 foreach t in array array['dc_equipment_catalog','dc_recipes','dc_candidates','dc_equipment','dc_training','dc_production_jobs','dc_job_equipment'] loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create trigger dc_frozen_equipment_catalog before update or delete on public.dc_equipment_catalog for each row execute function public.dc_immutable_v1();
create trigger dc_frozen_recipes before update or delete on public.dc_recipes for each row execute function public.dc_immutable_v1();
create trigger dc_frozen_training before update or delete on public.dc_training for each row execute function public.dc_immutable_v1();

-- Preserve original OIDs for every existing caller. Private copies retain v1
-- behavior where immutable old jobs/chunks still require it.
do $bases$
declare item text;signature text;definition text;
begin
 foreach item in array array['dc_cell_v1','dc_snapshot_v1','dc_reconcile_v1','dc_price_v1'] loop
  signature:=case item when 'dc_cell_v1' then '(uuid,integer,integer)' when 'dc_price_v1' then '(text)' else '(uuid,timestamptz)' end;
  definition:=pg_get_functiondef(to_regprocedure('public.'||item||signature));
  if position('dc_phase2_' in definition)>0 or to_regprocedure('public.'||item||'_phase1_base'||signature) is not null then raise exception 'Deep Claim Phase 2 adapter already exists; review migration history';end if;
  execute replace(definition,'FUNCTION public.'||item||'(','FUNCTION public.'||item||'_phase1_base(');
 end loop;
end $bases$;

create or replace function public.dc_phase2_config_v2() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$select config from public.dc_rules where version=2$$;
create or replace function public.dc_resources_v1() returns text[] language sql immutable as $$select array['stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore','amethyst','gold_ore','copper_bar','tin_bar','iron_bar','silver_bar','polished_quartz','cut_amethyst']::text[]$$;
create or replace function public.dc_minerals_v2() returns text[] language sql immutable as $$select array['stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore','amethyst','gold_ore']::text[]$$;
create or replace function public.dc_price_v1(p_key text) returns integer language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(public.dc_price_v1_phase1_base(p_key),(select (value->>'sell_price')::integer from jsonb_array_elements(public.dc_phase2_config_v2()->'resources') where value->>'id'=p_key))
$$;
create or replace function public.dc_hardness_v1(p_key text) returns numeric language sql immutable as $$select case p_key when 'clay' then 0.7 when 'copper_ore' then 1.2 when 'tin_ore' then 1.2 when 'iron_ore' then 1.5 when 'quartz' then 1.3 when 'silver_ore' then 1.8 when 'amethyst' then 2.0 when 'gold_ore' then 2.2 else 1 end::numeric$$;
create or replace function public.dc_building_level_v2(p_company public.dc_companies,p_key text) returns integer language sql immutable as $$
 select case p_key when 'mine_office' then p_company.office_level when 'mine_shaft' then p_company.shaft_level when 'warehouse' then p_company.warehouse_level when 'tool_station' then p_company.tool_level when 'workers_quarters' then p_company.quarters_level when 'smeltery' then p_company.smeltery_level when 'gem_workshop' then p_company.gem_workshop_level end
$$;
create or replace function public.dc_stats_v1(p_worker public.dc_workers) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_object_agg(s.key,least(100,(s.value::text)::integer+least(9,p_worker.xp/60)+coalesce((select sum((e.definition_snapshot->'bonuses'->>s.key)::integer)
  from public.dc_equipment e where e.company_id=p_worker.company_id and e.worker_id=p_worker.id and e.retired_at is null and e.durability>0),0))) from jsonb_each(p_worker.stats)s
$$;

create or replace function public.dc_chunk_version_v2(p_company uuid,p_x integer,p_y integer) returns integer language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select world_version from public.dc_chunks where company_id=p_company and chunk_x=p_x/32 and chunk_y=p_y/32),case when p_y/32>=5 then 2 else 1 end)
$$;
create or replace function public.dc_cell_v2(p_company uuid,p_x integer,p_y integer) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare seed_value uuid;h bigint;vein bigint;roll integer;material text;amount integer;
begin
 if p_x not between 0 and 95 or p_y<0 then raise exception 'Invalid mine coordinate';end if;
 select seed into seed_value from public.dc_worlds where company_id=p_company;
 h:=('x'||substr(md5('deep-v2:'||seed_value||':'||p_x||':'||p_y),1,8))::bit(32)::bigint;
 vein:=('x'||substr(md5('deep-v2:'||seed_value||':'||p_x/4||':'||p_y/3),1,8))::bit(32)::bigint;roll:=(vein%100)::integer;
 material:=case when p_x=48 then null when p_y%20 in(8,9) and vein%5<>0 then 'coal'
  when (p_x%4 in(0,3) or p_y%3 in(0,2)) and h%100<10 then 'stone'
  when roll<20 then 'stone' when roll<26 then 'clay' when roll<42 then 'coal' when roll<50 then 'copper_ore' when roll<58 then 'tin_ore'
  when roll<74 then 'iron_ore' when roll<80 then 'quartz' when roll<86 then 'silver_ore' when roll<95 then 'amethyst' else 'gold_ore' end;
 amount:=case when material is null then 0 when material='stone' then 8+h%12 when material='clay' then 6+h%10 when material='coal' then 80+h%80
  when material in('copper_ore','tin_ore') then 35+h%55 when material='iron_ore' then 50+h%80 when material='quartz' then 10+h%30 when material='silver_ore' then 8+h%16
  when material='amethyst' then 8+h%18 else 6+h%14 end;
 return jsonb_build_object('material',material,'initial_amount',amount);
end $$;
create or replace function public.dc_cell_v1(p_company uuid,p_x integer,p_y integer) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if public.dc_chunk_version_v2(p_company,p_x,p_y)=2 then return public.dc_cell_v2(p_company,p_x,p_y);end if;
 return public.dc_cell_v1_phase1_base(p_company,p_x,p_y);
end $$;
create or replace function public.dc_reveal_v1(p_company uuid,p_x integer,p_y integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare cell jsonb;world public.dc_worlds%rowtype;chunk_version integer;
begin
 if exists(select 1 from public.dc_tiles where company_id=p_company and x=p_x and y=p_y) then return;end if;
 chunk_version:=public.dc_chunk_version_v2(p_company,p_x,p_y);cell:=public.dc_cell_v1(p_company,p_x,p_y);select * into world from public.dc_worlds where company_id=p_company;
 insert into public.dc_chunks values(p_company,p_x/32,p_y/32,chunk_version,md5(world.seed::text||':'||chunk_version||':'||p_x/32||':'||p_y/32)) on conflict do nothing;
 insert into public.dc_tiles values(p_company,p_x,p_y,cell->>'material',(cell->>'initial_amount')::integer,(cell->>'initial_amount')::integer,clock_timestamp());
end $$;

create or replace function public.dc_ensure_candidates_v2(p_company uuid,p_day date) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare i integer;position_index integer;profile jsonb;offset_value integer;inserted integer;changed boolean:=false;name_offset integer;attempt integer;candidate_name text;
 surnames text[]:=array['Holt','Rowan','Mercer','Wren','Vale','Cinder','Stone','Ashford','Finch','Ember','Brass','Reed','Flint','Brooks'];
begin
 if p_day is null then raise exception 'Operating day required';end if;
 offset_value:=((p_day-date '2026-01-01')%7+7)%7;
 for i in 0..2 loop
  position_index:=(offset_value+i)%7;profile:=public.dc_phase2_config_v2()->'candidate_profiles'->position_index;
  name_offset:=(public.dc_world_hash_v1(p_company,position_index,p_day-date '2026-01-01')%14)::integer;
  for attempt in 0..13 loop
   candidate_name:=split_part(profile->>'name',' ',1)||' '||surnames[1+(name_offset+attempt)%14];
   exit when not exists(select 1 from public.dc_workers where company_id=p_company and name=candidate_name);
  end loop;
  profile:=jsonb_set(profile,'{name}',to_jsonb(candidate_name));
  insert into public.dc_candidates(company_id,operating_day,position,profile) values(p_company,p_day,i,profile) on conflict(company_id,operating_day,position) do nothing;
  get diagnostics inserted=row_count;changed:=changed or inserted>0;
 end loop;
 return changed;
end $$;
create or replace function public.dc_freeze_equipment_v2(p_company uuid,p_job uuid,p_workers uuid[],p_energy integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.dc_expeditions where id=p_job and company_id=p_company and config_version=2) then raise exception 'Equipment snapshot requires a current expedition';end if;
 insert into public.dc_job_equipment(job_id,item_id,wear_amount,initial_durability)
  select p_job,id,2*p_energy,durability from public.dc_equipment where company_id=p_company and worker_id=any(p_workers) and retired_at is null;
end $$;

create or replace function public.dc_reconcile_v1(p_company uuid,p_now timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.dc_companies%rowtype;wear public.dc_job_equipment%rowtype;production public.dc_production_jobs%rowtype;r text;inserted integer;changed boolean:=false;
begin
 -- This is the unchanged v1 milestone executor: old active plans are neither
 -- rewritten nor recalculated using equipment, new prices or new generation.
 perform public.dc_reconcile_v1_phase1_base(p_company,p_now);
 select * into c from public.dc_companies where id=p_company;
 foreach r in array public.dc_resources_v1() loop
  insert into public.dc_inventory values(p_company,r,0) on conflict do nothing;get diagnostics inserted=row_count;changed:=changed or inserted>0;
 end loop;
 changed:=public.dc_ensure_candidates_v2(p_company,c.energy_day) or changed;
 for wear in select w.* from public.dc_job_equipment w join public.dc_expeditions e on e.id=w.job_id
  where e.company_id=p_company and e.config_version=2 and e.status in('ready','collected') and w.applied_at is null order by w.job_id,w.item_id for update of w loop
  update public.dc_equipment set durability=greatest(0,durability-wear.wear_amount) where id=wear.item_id;
  update public.dc_job_equipment set applied_at=p_now where job_id=wear.job_id and item_id=wear.item_id;changed:=true;
 end loop;
 for production in update public.dc_production_jobs set status='ready' where company_id=p_company and status='active' and completes_at<=p_now returning * loop
  insert into public.dc_logs(company_id,kind,title) values(p_company,'production_ready','Production finished. Outputs await collection.');changed:=true;
 end loop;
 if changed then update public.dc_companies set revision=revision+1 where id=p_company;end if;
end $$;

create or replace function public.dc_buildings_v2(p_company public.dc_companies) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare key text;level integer;maximum integer;costs jsonb;new_building boolean;next_cost integer;effect text;result jsonb:='[]';
begin
 foreach key in array array['mine_office','mine_shaft','warehouse','tool_station','workers_quarters','smeltery','gem_workshop'] loop
  level:=public.dc_building_level_v2(p_company,key);costs:=public.dc_phase2_config_v2()->'building_costs'->key;new_building:=key in('workers_quarters','smeltery','gem_workshop');
  maximum:=jsonb_array_length(costs)+case when new_building then 0 else 1 end;
  next_cost:=case when level>=maximum then null else (costs->>greatest(0,level-case when new_building then 0 else 1 end))::integer end;
  effect:=case key when 'mine_office' then level||' simultaneous crew slots' when 'mine_shaft' then case level when 1 then '49 m operating depth' when 2 then '99 m operating depth' when 3 then '149 m operating depth' else '299 m operating depth' end
   when 'warehouse' then (120*(2^(level-1))::integer)||' units of storage' when 'tool_station' then (100+25*(level-1))||'% extraction output; equipment crafting'
   when 'workers_quarters' then (3+3*level)||' worker capacity' when 'smeltery' then case when level=0 then 'Build to refine metal ores' else 'One smelting lane; '||(array[100,85,70])[level]||'% recipe time' end
   else case when level=0 then 'Build to polish minerals and cut gems' else 'One gem-working lane; '||(array[100,85,70])[level]||'% recipe time' end end;
  result:=result||jsonb_build_array(jsonb_build_object('key',key,'level',level,'max_level',maximum,'upgrade_cost',next_cost,'effect',effect));
 end loop;return result;
end $$;
create or replace function public.dc_recipes_view_v2(p_company public.dc_companies) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(r.definition||jsonb_build_object('effective_duration_seconds',ceil((r.definition->>'duration_seconds')::numeric*
  (array[100,85,70])[greatest(1,coalesce(public.dc_building_level_v2(p_company,r.definition->>'station'),0))]/100)::integer) order by r.recipe_key),'[]') from public.dc_recipes r where r.version=1
$$;
create or replace function public.dc_snapshot_v1(p_company uuid,p_now timestamptz) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb:=public.dc_snapshot_v1_phase1_base(p_company,p_now);c public.dc_companies%rowtype;workers jsonb;
begin
 if p_company is null then return result||jsonb_build_object('schema_version',2,'candidates','[]'::jsonb,'equipment','[]'::jsonb,'production_jobs','[]'::jsonb,
  'recipes',public.dc_recipes_view_v2(null::public.dc_companies),'equipment_catalog',(select jsonb_agg(definition order by definition_key) from public.dc_equipment_catalog where version=1));end if;
 select * into c from public.dc_companies where id=p_company;
 select jsonb_agg(value||jsonb_build_object('wage',w.wage,'base_stats',w.stats,
  'trained_day',(select max(operating_day) from public.dc_training where worker_id=w.id),'training_cost',30,'training_gain',3,
  'equipment_ids',(select coalesce(jsonb_agg(id order by slot,id),'[]') from public.dc_equipment where worker_id=w.id and retired_at is null)) order by ord)
  into workers from jsonb_array_elements(result->'workers') with ordinality j(value,ord) join public.dc_workers w on w.id=(value->>'id')::uuid;
 result:=jsonb_set(result,'{workers}',workers);result:=jsonb_set(result,'{company}',result->'company'||jsonb_build_object('worker_capacity',3+3*c.quarters_level,'equipment_capacity',48));
 result:=jsonb_set(result,'{buildings}',public.dc_buildings_v2(c));
 if c.shaft_level=4 then result:=jsonb_set(result,'{world,max_depth}','299'::jsonb);end if;
 return result||jsonb_build_object('schema_version',2,
 'candidates',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',profile->>'name','specialty',profile->>'specialty','traits',profile->'traits','stats',profile->'stats','wage',(profile->>'wage')::integer,'hire_cost',(profile->>'hire_cost')::integer,'operating_day',operating_day,'hired',hired_worker_id is not null) order by position),'[]') from public.dc_candidates where company_id=p_company and operating_day=c.energy_day),
 'equipment',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'definition_key',definition_key,'worker_id',worker_id,'durability',durability,'max_durability',max_durability,
  'repair_cost',ceil((max_durability-durability)*(definition_snapshot->>'repair_rate')::numeric)::integer,'repair_materials',case when durability=max_durability then '{}'::jsonb else definition_snapshot->'repair_materials' end) order by created_at,id),'[]') from public.dc_equipment where company_id=p_company and retired_at is null),
 'production_jobs',(select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'recipe_key',j.recipe_key,'recipe_version',j.recipe_version,'batches',j.batches,'station',j.station,'status',j.status,
  'started_at',j.started_at,'completes_at',j.completes_at,'duration_seconds',j.duration_seconds,'cash_cost',j.cash_cost,'inputs',j.inputs,'outputs',j.outputs,'equipment_outputs',j.equipment_outputs) order by j.started_at,j.id),'[]')
  from public.dc_production_jobs j where j.company_id=p_company and (j.status<>'collected' or j.id in(select id from public.dc_production_jobs where company_id=p_company and status='collected' order by completes_at desc limit 12))),
 'recipes',public.dc_recipes_view_v2(c),'equipment_catalog',(select jsonb_agg(definition order by definition_key) from public.dc_equipment_catalog where version=1));
end $$;

-- Extend the same dispatch and quote endpoints. Calling an older public client
-- cannot opt out of gear wear, staged production or the current config version.
do $adapters$
declare definition text;anchor text;
begin
 definition:=pg_get_functiondef('public.dc_preview_v1(uuid,uuid[],text,integer,integer,integer,boolean,timestamptz)'::regprocedure);
 anchor:='depth:=case c.shaft_level when 1 then 49 when 2 then 99 else 149 end;';
 if position(anchor in definition)=0 then raise exception 'Deep Claim depth quote contract changed';end if;
 definition:=replace(definition,anchor,'depth:=case c.shaft_level when 1 then 49 when 2 then 99 when 3 then 149 else 299 end;');
 anchor:='if exists(select 1 from public.dc_expeditions where company_id=c.id and status=''ready'') then';
 if position(anchor in definition)=0 then raise exception 'Deep Claim staged cargo contract changed';end if;
 definition:=replace(definition,anchor,'if exists(select 1 from public.dc_expeditions where company_id=c.id and status=''ready'') or exists(select 1 from public.dc_production_jobs where company_id=c.id and status=''ready'') then');
 anchor:='else public.dc_resources_v1() end;';if position(anchor in definition)=0 then raise exception 'Deep Claim mineral quote contract changed';end if;
 execute replace(definition,anchor,'else public.dc_minerals_v2() end;');

 definition:=pg_get_functiondef('public.dc_dispatch(uuid[],text,integer,integer,integer,boolean,integer,uuid)'::regprocedure);
 anchor:='(quote->>''energy_per_worker'')::integer,1) returning id into job;';
 if position(anchor in definition)=0 then raise exception 'Deep Claim dispatch version contract changed';end if;
 definition:=replace(definition,anchor,'(quote->>''energy_per_worker'')::integer,2) returning id into job;');
 anchor:='jsonb_build_object(''config_version'',1,''crew''';if position(anchor in definition)=0 then raise exception 'Deep Claim frozen plan contract changed';end if;
 definition:=replace(definition,anchor,'jsonb_build_object(''config_version'',2,''crew''');
 anchor:='select sum((value->>''quantity'')::integer) into total_units from jsonb_array_elements(extractions);';
 if position(anchor in definition)=0 then raise exception 'Deep Claim equipment freeze contract changed';end if;
 execute replace(definition,anchor,'perform public.dc_freeze_equipment_v2(company,job,p_worker_ids,(quote->>''energy_per_worker'')::integer);'||chr(10)||anchor);

 definition:=pg_get_functiondef('public.dc_bootstrap(text,uuid)'::regprocedure);
 anchor:='return public.dc_snapshot_v1(company,clock_timestamp());';if position(anchor in definition)=0 then raise exception 'Deep Claim bootstrap contract changed';end if;
 -- Both the retry and final return may use this anchor; reconciliation is
 -- idempotent and initializes zero stock keys/current candidate day safely.
 execute replace(definition,anchor,'perform public.dc_reconcile_v1(company,clock_timestamp());'||chr(10)||anchor);
end $adapters$;

create or replace function public.dc_upgrade(p_building_key text,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;payload jsonb:=jsonb_build_object('building',p_building_key,'expected_revision',p_expected_revision);building jsonb;cost integer;level integer;y integer;
begin
 if public.dc_receipt_v1(company,p_request_id,'upgrade',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 select value into building from jsonb_array_elements(public.dc_buildings_v2(c)) where value->>'key'=p_building_key;
 if building is null then raise exception 'Building unavailable';end if;cost:=(building->>'upgrade_cost')::integer;level:=(building->>'level')::integer;
 if cost is null then raise exception 'This building is fully upgraded';end if;
 if c.cash-cost<2 then raise exception 'Keep $2 operating cash after an upgrade';end if;
 update public.dc_companies set cash=cash-cost,revision=revision+1,
  office_level=office_level+case when p_building_key='mine_office' then 1 else 0 end,shaft_level=shaft_level+case when p_building_key='mine_shaft' then 1 else 0 end,
  warehouse_level=warehouse_level+case when p_building_key='warehouse' then 1 else 0 end,tool_level=tool_level+case when p_building_key='tool_station' then 1 else 0 end,
  quarters_level=quarters_level+case when p_building_key='workers_quarters' then 1 else 0 end,smeltery_level=smeltery_level+case when p_building_key='smeltery' then 1 else 0 end,
  gem_workshop_level=gem_workshop_level+case when p_building_key='gem_workshop' then 1 else 0 end where id=company;
 if p_building_key='mine_shaft' then for y in 0..(case level when 1 then 56 when 2 then 106 else 256 end) loop perform public.dc_reveal_v1(company,48,y);end loop;end if;
 insert into public.dc_logs(company_id,kind,title) values(company,'upgraded',replace(p_building_key,'_',' ')||case when level=0 then ' built.' else ' upgraded to level '||(level+1)||'.' end);
 perform public.dc_store_receipt_v1(company,p_request_id,'upgrade',payload);return public.dc_snapshot_v1(company,clock_timestamp());
end $$;

create or replace function public.dc_hire(p_candidate_id uuid,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;candidate public.dc_candidates%rowtype;cost integer;
 payload jsonb:=jsonb_build_object('candidate_id',p_candidate_id,'expected_revision',p_expected_revision);
begin
 if public.dc_receipt_v1(company,p_request_id,'hire',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 select * into candidate from public.dc_candidates where id=p_candidate_id and company_id=company for update;
 if not found then raise exception 'Candidate unavailable' using errcode='42501';end if;
 if candidate.hired_worker_id is not null then raise exception 'This candidate has already been hired';end if;
 if candidate.operating_day<>c.energy_day then raise exception 'This candidate roster has expired';end if;
 if (select count(*) from public.dc_workers where company_id=company)>=3+3*c.quarters_level then raise exception 'Build or upgrade workers quarters before hiring';end if;
 cost:=(candidate.profile->>'hire_cost')::integer;if c.cash-cost<2 then raise exception 'Keep $2 operating cash after hiring';end if;
 -- Reuse the server-created candidate UUID to preserve visual identity.
 insert into public.dc_workers(id,company_id,template_key,name,specialty,traits,stats,wage)
 values(candidate.id,company,'hire:'||candidate.id,candidate.profile->>'name',candidate.profile->>'specialty',array(select jsonb_array_elements_text(candidate.profile->'traits')),candidate.profile->'stats',(candidate.profile->>'wage')::integer);
 update public.dc_candidates set hired_worker_id=candidate.id,hired_at=clock_timestamp() where id=candidate.id;
 update public.dc_companies set cash=cash-cost,revision=revision+1 where id=company;
 insert into public.dc_logs(company_id,kind,title) values(company,'hired',candidate.profile->>'name'||' joined the crew.');
 perform public.dc_store_receipt_v1(company,p_request_id,'hire',payload);return public.dc_snapshot_v1(company,clock_timestamp());
end $$;
create or replace function public.dc_train(p_worker_id uuid,p_stat text,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;w public.dc_workers%rowtype;old_value integer;new_value integer;
 payload jsonb:=jsonb_build_object('worker_id',p_worker_id,'stat',p_stat,'expected_revision',p_expected_revision);
begin
 if public.dc_receipt_v1(company,p_request_id,'train',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 select * into w from public.dc_workers where id=p_worker_id and company_id=company for update;
 if not found then raise exception 'Worker unavailable' using errcode='42501';end if;
 if w.assigned_job_id is not null then raise exception 'Wait for this worker to return before training';end if;
 if p_stat is null or p_stat not in('mining','geology','engineering','logistics','safety','endurance','leadership') then raise exception 'Choose a valid worker stat';end if;
 if exists(select 1 from public.dc_training where worker_id=w.id and operating_day=c.energy_day) then raise exception 'This worker has already trained today';end if;
 old_value:=(w.stats->>p_stat)::integer;if old_value>=100 then raise exception 'This base stat is already at its cap';end if;
 if c.cash-30<2 then raise exception 'Keep $2 operating cash after training';end if;new_value:=least(100,old_value+3);
 update public.dc_workers set stats=jsonb_set(stats,array[p_stat],to_jsonb(new_value)) where id=w.id;
 insert into public.dc_training values(w.id,c.energy_day,p_stat,old_value,new_value,30,p_request_id,clock_timestamp());
 update public.dc_companies set cash=cash-30,revision=revision+1 where id=company;
 insert into public.dc_logs(company_id,kind,title) values(company,'trained',w.name||' completed a permanent '||p_stat||' course.');
 perform public.dc_store_receipt_v1(company,p_request_id,'train',payload);return public.dc_snapshot_v1(company,clock_timestamp());
end $$;

create or replace function public.dc_assign_equipment(p_item_id uuid,p_worker_id uuid,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;item public.dc_equipment%rowtype;w public.dc_workers%rowtype;
 payload jsonb:=jsonb_build_object('item_id',p_item_id,'worker_id',p_worker_id,'expected_revision',p_expected_revision);
begin
 if public.dc_receipt_v1(company,p_request_id,'assign_equipment',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 select * into item from public.dc_equipment where id=p_item_id and company_id=company and retired_at is null for update;
 if not found then raise exception 'Equipment unavailable' using errcode='42501';end if;
 if item.worker_id is not null and exists(select 1 from public.dc_workers where id=item.worker_id and assigned_job_id is not null) then raise exception 'Wait for this worker to return before changing gear';end if;
 if p_worker_id is not null then
  select * into w from public.dc_workers where id=p_worker_id and company_id=company;
  if not found then raise exception 'Worker unavailable' using errcode='42501';end if;
  if w.assigned_job_id is not null then raise exception 'Wait for this worker to return before changing gear';end if;
  update public.dc_equipment set worker_id=null where company_id=company and worker_id=p_worker_id and slot=item.slot and id<>item.id and retired_at is null;
 end if;
 update public.dc_equipment set worker_id=p_worker_id where id=item.id;
 update public.dc_companies set revision=revision+1 where id=company;
 insert into public.dc_logs(company_id,kind,title) values(company,'equipped',case when p_worker_id is null then 'Equipment returned to unassigned storage.' else 'Equipment assigned to '||w.name||'.' end);
 perform public.dc_store_receipt_v1(company,p_request_id,'assign_equipment',payload);return public.dc_snapshot_v1(company,clock_timestamp());
end $$;
create or replace function public.dc_repair_equipment(p_item_id uuid,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;item public.dc_equipment%rowtype;cost integer;resource record;
 payload jsonb:=jsonb_build_object('item_id',p_item_id,'expected_revision',p_expected_revision);
begin
 if public.dc_receipt_v1(company,p_request_id,'repair_equipment',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 select * into item from public.dc_equipment where id=p_item_id and company_id=company and retired_at is null for update;
 if not found then raise exception 'Equipment unavailable' using errcode='42501';end if;
 if item.worker_id is not null and exists(select 1 from public.dc_workers where id=item.worker_id and assigned_job_id is not null) then raise exception 'Wait for this worker to return before repairing gear';end if;
 if item.durability=item.max_durability then raise exception 'This equipment does not need repair';end if;
 cost:=ceil((item.max_durability-item.durability)*(item.definition_snapshot->>'repair_rate')::numeric)::integer;
 if c.cash-cost<2 then raise exception 'Keep $2 operating cash after repairs';end if;
 for resource in select key,(value::text)::integer quantity from jsonb_each(item.definition_snapshot->'repair_materials') loop
  update public.dc_inventory set quantity=quantity-resource.quantity where company_id=company and resource_key=resource.key and quantity>=resource.quantity;
  if not found then raise exception 'Not enough materials to repair this equipment';end if;
 end loop;
 update public.dc_equipment set durability=max_durability where id=item.id;
 update public.dc_companies set cash=cash-cost,revision=revision+1 where id=company;
 insert into public.dc_logs(company_id,kind,title) values(company,'repaired','Equipment restored to full durability.');
 perform public.dc_store_receipt_v1(company,p_request_id,'repair_equipment',payload);return public.dc_snapshot_v1(company,clock_timestamp());
end $$;
create or replace function public.dc_retire_equipment(p_item_id uuid,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;item public.dc_equipment%rowtype;
 payload jsonb:=jsonb_build_object('item_id',p_item_id,'expected_revision',p_expected_revision);
begin
 if public.dc_receipt_v1(company,p_request_id,'retire_equipment',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 select * into item from public.dc_equipment where id=p_item_id and company_id=company and retired_at is null for update;
 if not found then raise exception 'Equipment unavailable' using errcode='42501';end if;
 if item.worker_id is not null then raise exception 'Unequip this item before permanently retiring it';end if;
 update public.dc_equipment set retired_at=clock_timestamp() where id=item.id;
 update public.dc_companies set revision=revision+1 where id=company;
 insert into public.dc_logs(company_id,kind,title) values(company,'retired','Equipment permanently retired. No cash or materials were refunded.');
 perform public.dc_store_receipt_v1(company,p_request_id,'retire_equipment',payload);return public.dc_snapshot_v1(company,clock_timestamp());
end $$;

create or replace function public.dc_start_production(p_recipe_key text,p_batches integer,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;recipe jsonb;equipment_definition jsonb;station_key text;station_level integer;cost integer;duration integer;start_time timestamptz;
 resource record;input_stock jsonb:='{}';output_stock jsonb:='{}';equipment_outputs jsonb:='[]';pending integer;owned integer;job uuid;
 payload jsonb:=jsonb_build_object('recipe_key',p_recipe_key,'batches',p_batches,'expected_revision',p_expected_revision);
begin
 if public.dc_receipt_v1(company,p_request_id,'start_production',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 if p_batches is null or p_batches not between 1 and 10 then raise exception 'Choose one to ten recipe batches';end if;
 select definition into recipe from public.dc_recipes where recipe_key=p_recipe_key and version=1;
 if recipe is null then raise exception 'Recipe unavailable';end if;
 station_key:=recipe->>'station';station_level:=public.dc_building_level_v2(c,station_key);
 if station_level<(recipe->>'required_station_level')::integer then raise exception 'Build or upgrade the required production station';end if;
 if (select count(*) from public.dc_production_jobs where company_id=company and status<>'collected')>=3 then raise exception 'Collect production outputs before adding to the three-job queue';end if;
 cost:=(recipe->>'cash_cost')::integer*p_batches;if c.cash-cost<2 then raise exception 'Keep $2 operating cash after production costs';end if;
 if recipe->>'equipment_output' is not null then
  select count(*) into owned from public.dc_equipment where company_id=company and retired_at is null;
  select coalesce(sum(jsonb_array_length(pj.equipment_outputs)),0) into pending from public.dc_production_jobs pj where pj.company_id=company and pj.status<>'collected' and not pj.equipment_collected;
  if owned+pending+p_batches>48 then raise exception 'Equipment storage is full. Retire unassigned gear before crafting more.';end if;
  select definition into equipment_definition from public.dc_equipment_catalog where definition_key=recipe->>'equipment_output' and version=1;
  select jsonb_agg(recipe->>'equipment_output') into equipment_outputs from generate_series(1,p_batches);
 end if;
 for resource in select key,(value::text)::integer*p_batches quantity from jsonb_each(recipe->'inputs') loop
  update public.dc_inventory set quantity=quantity-resource.quantity where company_id=company and resource_key=resource.key and quantity>=resource.quantity;
  if not found then raise exception 'Not enough collected materials for this recipe';end if;input_stock:=input_stock||jsonb_build_object(resource.key,resource.quantity);
 end loop;
 for resource in select key,(value::text)::integer*p_batches quantity from jsonb_each(recipe->'outputs') loop output_stock:=output_stock||jsonb_build_object(resource.key,resource.quantity);end loop;
 duration:=ceil((recipe->>'duration_seconds')::numeric*(array[100,85,70])[station_level]/100)::integer*p_batches;
 select greatest(clock_timestamp(),coalesce(max(pj.completes_at),clock_timestamp())) into start_time from public.dc_production_jobs pj where pj.company_id=company and pj.station=station_key and pj.status='active';
 insert into public.dc_production_jobs(company_id,recipe_key,recipe_version,recipe_snapshot,equipment_snapshot,batches,station,started_at,completes_at,duration_seconds,cash_cost,inputs,outputs,equipment_outputs)
 values(company,p_recipe_key,1,recipe,equipment_definition,p_batches,station_key,start_time,start_time+duration*interval '1 second',duration,cost,input_stock,output_stock,equipment_outputs) returning id into job;
 update public.dc_companies set cash=cash-cost,revision=revision+1 where id=company;
 insert into public.dc_logs(company_id,kind,title) values(company,'production_started',recipe->>'name'||' queued. Inputs and costs paid upfront.');
 perform public.dc_store_receipt_v1(company,p_request_id,'start_production',payload);return public.dc_snapshot_v1(company,clock_timestamp());
end $$;
create or replace function public.dc_collect_production(p_job_id uuid,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;j public.dc_production_jobs%rowtype;payload jsonb:=jsonb_build_object('job_id',p_job_id);
 space integer;take_units integer;r_key text;delivered integer:=0;owned integer;equipment_key jsonb;definition jsonb;
begin
 if public.dc_receipt_v1(company,p_request_id,'collect_production',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;select * into j from public.dc_production_jobs where id=p_job_id and company_id=company for update;
 if not found then raise exception 'Production job unavailable' using errcode='42501';end if;
 if j.status='active' then raise exception 'Production has not finished yet';end if;
 if j.status='ready' then
  select 120*(2^(c.warehouse_level-1))::integer-coalesce(sum(i.quantity),0) into space from public.dc_inventory i where company_id=company;
  foreach r_key in array public.dc_resources_v1() loop
   take_units:=least(greatest(0,space),coalesce((j.outputs->>r_key)::integer,0));
   if take_units>0 then update public.dc_inventory i set quantity=i.quantity+take_units where i.company_id=company and i.resource_key=r_key;
    j.outputs:=jsonb_set(j.outputs,array[r_key],to_jsonb((j.outputs->>r_key)::integer-take_units));space:=space-take_units;delivered:=delivered+take_units;end if;
  end loop;
  if not j.equipment_collected then
   select count(*) into owned from public.dc_equipment where company_id=company and retired_at is null;
   if owned+jsonb_array_length(j.equipment_outputs)>48 then raise exception 'Equipment storage is full. Retire unassigned gear before collecting.';end if;
   for equipment_key in select value from jsonb_array_elements(j.equipment_outputs) loop
    definition:=j.equipment_snapshot;
    insert into public.dc_equipment(company_id,definition_key,definition_version,definition_snapshot,slot,durability,max_durability,production_job_id)
     values(company,definition->>'key',1,definition,definition->>'slot',(definition->>'max_durability')::integer,(definition->>'max_durability')::integer,j.id);delivered:=delivered+1;
   end loop;
   j.equipment_collected:=true;
  end if;
  update public.dc_production_jobs set outputs=j.outputs,equipment_collected=j.equipment_collected,
   status=case when not exists(select 1 from jsonb_each(j.outputs)e where (e.value::text)::integer>0) and j.equipment_collected then 'collected' else 'ready' end,
   collected_at=case when not exists(select 1 from jsonb_each(j.outputs)e where (e.value::text)::integer>0) and j.equipment_collected then clock_timestamp() else null end where id=j.id;
  if delivered>0 then update public.dc_companies set revision=revision+1 where id=company;insert into public.dc_logs(company_id,kind,title) values(company,'production_collected','Finished production outputs moved into company stock.');end if;
 end if;
 perform public.dc_store_receipt_v1(company,p_request_id,'collect_production',payload);return public.dc_snapshot_v1(company,clock_timestamp());
end $$;

create or replace function public.dc_phase2_guard() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new;end if;
 if tg_op='UPDATE' then
  if tg_table_name='dc_candidates' then
   if old.hired_worker_id is null and new.hired_worker_id is not null and new.hired_at is not null and (to_jsonb(new)-array['hired_worker_id','hired_at'])=(to_jsonb(old)-array['hired_worker_id','hired_at']) then return new;end if;
  elsif tg_table_name='dc_job_equipment' then
   if old.applied_at is null and new.applied_at is not null and (to_jsonb(new)-'applied_at')=(to_jsonb(old)-'applied_at') then return new;end if;
  elsif tg_table_name='dc_equipment' then
   if old.retired_at is null and (to_jsonb(new)-array['worker_id','durability','retired_at'])=(to_jsonb(old)-array['worker_id','durability','retired_at']) then return new;end if;
  elsif tg_table_name='dc_production_jobs' then
   if old.status<>'collected' and (to_jsonb(new)-array['status','outputs','equipment_collected','collected_at'])=(to_jsonb(old)-array['status','outputs','equipment_collected','collected_at']) then return new;end if;
  end if;
 end if;
 raise exception 'Committed Deep Claim workforce and production records are immutable';
end $$;
create trigger dc_candidate_guard before update or delete on public.dc_candidates for each row execute function public.dc_phase2_guard();
create trigger dc_equipment_guard before update or delete on public.dc_equipment for each row execute function public.dc_phase2_guard();
create trigger dc_wear_guard before update or delete on public.dc_job_equipment for each row execute function public.dc_phase2_guard();
create trigger dc_production_guard before update or delete on public.dc_production_jobs for each row execute function public.dc_phase2_guard();

-- Discovery copy only: preserve every existing club installation and setting.
update public.platform_assets set short_description='Build a crew. Equip a company. Turn deep discoveries into an empire.',
 full_description='A persistent private mining company inside your club. Explore a 96-tile-wide mine, clear finite tunnels, dispatch real-time crews and collect staged cargo. Hire seven worker specialties, train permanent stats, craft and repair owned equipment, refine metals and gems through bounded production queues, and extend shaft technology to 299 metres. Work continues on server timestamps while you are away. Company credits remain separate from DH Score. Further hazards, contracts and shared projects are future phases.',updated_at=now()
 where slug='deep-claim';

do $$ declare f record;begin
 for f in select p.proname,p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);
  if f.proname in('dc_bootstrap','dc_get','dc_reconcile','dc_preview','dc_dispatch','dc_collect','dc_sell','dc_upgrade','dc_hire','dc_train','dc_assign_equipment','dc_repair_equipment','dc_start_production','dc_collect_production','dc_retire_equipment') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end $$;
commit;
