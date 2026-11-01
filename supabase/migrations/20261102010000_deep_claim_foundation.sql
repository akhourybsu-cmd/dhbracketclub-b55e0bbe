-- Deep Claim Phase 1. Private company simulation, lazy authoritative settlement,
-- finite sparse excavation and retry-safe wallets. No client table access.
begin;

create table public.dc_rules(version integer primary key check(version>0),config jsonb not null,created_at timestamptz not null default now());
insert into public.dc_rules values(1,'{"energy_per_day":6,"durations":[20,60,180],"energy_costs":[1,2,3],"world_width":96,"chunk_size":32,"tutorial_seconds":30,"operating_reserve":2}',now());
create table public.dc_companies(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),user_id uuid not null references public.profiles(id),
 name text not null check(length(btrim(name)) between 2 and 40),rules_version integer not null default 1 references public.dc_rules(version),
 cash integer not null default 180 check(cash>=0),timezone text not null,energy_day date not null,energy_reset_at timestamptz not null,
 tutorial_used boolean not null default false,office_level integer not null default 1 check(office_level between 1 and 3),
 shaft_level integer not null default 1 check(shaft_level between 1 and 3),warehouse_level integer not null default 1 check(warehouse_level between 1 and 3),
 tool_level integer not null default 1 check(tool_level between 1 and 3),revision integer not null default 1 check(revision>0),created_at timestamptz not null default now(),
 unique(club_id,user_id)
);
create table public.dc_worlds(company_id uuid primary key references public.dc_companies(id),seed uuid not null default gen_random_uuid(),version integer not null default 1 check(version=1));
create table public.dc_chunks(company_id uuid not null references public.dc_companies(id),chunk_x integer not null check(chunk_x between 0 and 2),chunk_y integer not null check(chunk_y>=0),world_version integer not null,seed text not null,primary key(company_id,chunk_x,chunk_y));
create table public.dc_tiles(company_id uuid not null references public.dc_companies(id),x integer not null check(x between 0 and 95),y integer not null check(y>=0),
 material text check(material in('stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore')),initial_amount integer not null check(initial_amount>=0),
 remaining integer not null check(remaining>=0 and remaining<=initial_amount),revealed_at timestamptz not null default now(),primary key(company_id,x,y));
create table public.dc_workers(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.dc_companies(id),template_key text not null,
 name text not null,specialty text not null,traits text[] not null,stats jsonb not null,wage integer not null check(wage>0),xp integer not null default 0 check(xp>=0),
 energy integer not null default 6 check(energy between 0 and 6),assigned_job_id uuid,unique(company_id,template_key));
create table public.dc_expeditions(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.dc_companies(id),
 mode text not null check(mode in('explore','extract')),status text not null default 'active' check(status in('active','ready','collected')),
 target_x integer not null,target_y integer not null,path jsonb not null,stages jsonb not null,started_at timestamptz not null,completes_at timestamptz not null,
 duration_minutes integer not null check(duration_minutes in(20,60,180)),duration_seconds integer not null check(duration_seconds in(30,1200,3600,10800)),
 tutorial boolean not null,wages integer not null check(wages>=0),energy_per_worker integer not null check(energy_per_worker between 1 and 3),
 config_version integer not null references public.dc_rules(version),cargo jsonb not null default '{}',collected_at timestamptz,check(completes_at=started_at+duration_seconds*interval '1 second'));
alter table public.dc_workers add constraint dc_worker_assignment foreign key(assigned_job_id) references public.dc_expeditions(id);
create table public.dc_expedition_workers(job_id uuid not null references public.dc_expeditions(id),worker_id uuid not null references public.dc_workers(id),primary key(job_id,worker_id));
create table public.dc_plans(job_id uuid primary key references public.dc_expeditions(id),content jsonb not null);
create table public.dc_milestones(job_id uuid not null references public.dc_expeditions(id),sequence integer not null,company_id uuid not null references public.dc_companies(id),due_at timestamptz not null,
 kind text not null check(kind in('work','ready')),payload jsonb not null,applied_at timestamptz,primary key(job_id,sequence));
create index dc_due_milestones on public.dc_milestones(company_id,due_at) where applied_at is null;
create table public.dc_reservations(company_id uuid not null references public.dc_companies(id),x integer not null,y integer not null,job_id uuid not null references public.dc_expeditions(id),primary key(company_id,x,y));
create table public.dc_inventory(company_id uuid not null references public.dc_companies(id),resource_key text not null check(resource_key in('stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore')),quantity integer not null default 0 check(quantity>=0),primary key(company_id,resource_key));
create table public.dc_requests(request_id uuid primary key,company_id uuid not null references public.dc_companies(id),club_id uuid not null references public.clubs(id),user_id uuid not null references public.profiles(id),operation text not null,payload jsonb not null,created_at timestamptz not null default now());
create index dc_request_rate on public.dc_requests(user_id,created_at desc);
create table public.dc_logs(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.dc_companies(id),kind text not null,title text not null,created_at timestamptz not null default now());
create index dc_company_log on public.dc_logs(company_id,created_at desc,id desc);
do $$ declare t text;begin
 foreach t in array array['dc_rules','dc_companies','dc_worlds','dc_chunks','dc_tiles','dc_workers','dc_expeditions','dc_expedition_workers','dc_plans','dc_milestones','dc_reservations','dc_inventory','dc_requests','dc_logs'] loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create trigger zz_dh_private_guard before insert or update on public.dc_companies for each row execute function public.dh_private_write_guard('user_id');
create trigger zz_dh_private_guard before insert or update on public.dc_requests for each row execute function public.dh_private_write_guard('user_id');

create or replace function public.dc_resources_v1() returns text[] language sql immutable as $$select array['stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore']::text[]$$;
create or replace function public.dc_price_v1(p_key text) returns integer language sql immutable as $$select case p_key when 'stone' then 1 when 'clay' then 2 when 'coal' then 4 when 'copper_ore' then 8 when 'tin_ore' then 10 when 'iron_ore' then 14 when 'quartz' then 12 when 'silver_ore' then 30 end$$;
create or replace function public.dc_hardness_v1(p_key text) returns numeric language sql immutable as $$select case p_key when 'clay' then 0.7 when 'copper_ore' then 1.2 when 'tin_ore' then 1.2 when 'iron_ore' then 1.5 when 'quartz' then 1.3 when 'silver_ore' then 1.8 else 1 end::numeric$$;
create or replace function public.dc_access_v1() returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.current_user_club_id();
begin
 if auth.uid() is null or cid is null then raise exception 'Active club membership required' using errcode='42501';end if;
 perform 1 from public.club_members where club_id=cid and user_id=auth.uid() for share;if not found then raise exception 'Active club membership required' using errcode='42501';end if;
 perform 1 from public.clubs where id=cid and status='active' and public.dh_visible_club(id) and public.dh_visible_member(auth.uid()) for share;
 if not found then raise exception 'Club unavailable' using errcode='42501';end if;
 perform 1 from public.club_installed_assets i join public.platform_assets a on a.id=i.asset_id where i.club_id=cid and a.slug='deep-claim' and a.is_active and i.enabled and i.visible_to_members for share of i,a;
 if not found then raise exception 'Deep Claim is not available in this club' using errcode='42501';end if;
 return cid;
end $$;
create or replace function public.dc_timezone_v1(p_club uuid) returns text language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select name from pg_timezone_names where name=(select settings->>'timezone' from public.clubs where id=p_club) limit 1),'America/New_York')
$$;
create or replace function public.dc_calendar_v1(p_now timestamptz,p_zone text) returns jsonb language sql stable as $$
 select jsonb_build_object('day',(p_now at time zone p_zone)::date,'next_reset_at',(((p_now at time zone p_zone)::date+1)::timestamp at time zone p_zone))
$$;
create or replace function public.dc_stats_v1(p_worker public.dc_workers) returns jsonb language sql immutable as $$
 select jsonb_object_agg(key,least(100,(value::text)::integer+least(9,p_worker.xp/60))) from jsonb_each(p_worker.stats)
$$;
create or replace function public.dc_world_hash_v1(p_company uuid,p_x integer,p_y integer) returns bigint language sql stable security definer set search_path=public,pg_temp as $$
 select ('x'||substr(md5(seed::text||':'||version||':'||p_x||':'||p_y),1,8))::bit(32)::bigint from public.dc_worlds where company_id=p_company
$$;
create or replace function public.dc_cell_v1(p_company uuid,p_x integer,p_y integer) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare h bigint;vein bigint;roll integer;resource text;amount integer;
begin
 if p_x not between 0 and 95 or p_y<0 then raise exception 'Invalid mine coordinate';end if;
 h:=public.dc_world_hash_v1(p_company,p_x,p_y);
 -- Global 4x3 geological clusters cross chunk boundaries consistently. Two
 -- horizontal coal-bearing layers recur every twenty metres, interrupted by
 -- local geology; host-rock edges soften rectangular cluster outlines.
 vein:=public.dc_world_hash_v1(p_company,p_x/4,p_y/3);roll:=(vein%100)::integer;
 resource:=case when p_x=48 then null when p_y=1 and p_x=47 then 'coal' when p_y=1 and p_x=49 then 'stone' when p_y=1 and p_x=46 then 'clay'
 when p_y=1 and p_x=50 then 'copper_ore' when p_y=2 and p_x=47 then 'tin_ore' when p_y=2 and p_x=49 then 'iron_ore'
 when p_y=3 and p_x=47 then 'quartz' when p_y=3 and p_x=49 then 'silver_ore'
 when p_y%20 in(8,9) and vein%5<>0 then 'coal'
 when (p_x%4 in(0,3) or p_y%3 in(0,2)) and h%100<10 then 'stone'
 when p_y<50 then case when roll<32 then 'stone' when roll<52 then 'clay' when roll<67 then 'coal' when roll<80 then 'copper_ore' when roll<90 then 'tin_ore' when roll<94 then 'iron_ore' when roll<99 then 'quartz' else 'silver_ore' end
 when p_y<100 then case when roll<30 then 'stone' when roll<35 then 'clay' when roll<50 then 'coal' when roll<62 then 'copper_ore' when roll<70 then 'tin_ore' when roll<90 then 'iron_ore' when roll<96 then 'quartz' else 'silver_ore' end
 else case when roll<25 then 'stone' when roll<28 then 'clay' when roll<40 then 'coal' when roll<50 then 'copper_ore' when roll<58 then 'tin_ore' when roll<83 then 'iron_ore' when roll<91 then 'quartz' else 'silver_ore' end end;
 amount:=case when resource is null then 0 when p_y=1 and p_x=47 then 10 when p_y=1 and p_x=49 then 12 when p_y=1 and p_x=46 then 16 when p_y=1 and p_x=50 then 18
  when p_y=2 and p_x=47 then 12 when p_y=2 and p_x=49 then 15 when p_y=3 and p_x=47 then 8 when p_y=3 and p_x=49 then 3
  when resource='stone' then 8+h%12 when resource='clay' then 6+h%10 when resource='coal' then 80+h%80
  when resource in('copper_ore','tin_ore') then 35+h%55 when resource='iron_ore' then 50+h%80 when resource='quartz' then 10+h%30 else 8+h%16 end;
 return jsonb_build_object('material',resource,'initial_amount',amount);
end $$;
create or replace function public.dc_reveal_v1(p_company uuid,p_x integer,p_y integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare cell jsonb;world public.dc_worlds%rowtype;
begin
 if exists(select 1 from public.dc_tiles where company_id=p_company and x=p_x and y=p_y) then return;end if;
 cell:=public.dc_cell_v1(p_company,p_x,p_y);select * into world from public.dc_worlds where company_id=p_company;
 insert into public.dc_chunks values(p_company,p_x/32,p_y/32,world.version,md5(world.seed::text||':'||world.version||':'||p_x/32||':'||p_y/32)) on conflict do nothing;
 insert into public.dc_tiles values(p_company,p_x,p_y,cell->>'material',(cell->>'initial_amount')::integer,(cell->>'initial_amount')::integer,clock_timestamp());
end $$;

-- BFS through actual excavated cells, ending at the adjacent worksite. Revealed
-- walls and undiscovered terrain never become imaginary walkable passages.
create or replace function public.dc_route_v1(p_company uuid,p_x integer,p_y integer) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare head bigint:=0;node record;walk_x integer;walk_y integer;parent_x integer;parent_y integer;found_route boolean:=false;result jsonb:='[]';
begin
 -- Explicit temporary schema prevents search-path substitution. The queue is
 -- per transaction/session, indexed both for FIFO and globally visited cells;
 -- it contains only this company's already revealed coordinates. No shared
 -- world queue, procedural seed or hidden cell enters a public projection.
 drop table if exists pg_temp.dc_route_queue_v1;
 create temporary table pg_temp.dc_route_queue_v1(
  x integer not null,y integer not null,px integer,py integer,
  position bigint generated always as identity unique,primary key(x,y)
 ) on commit drop;
 insert into pg_temp.dc_route_queue_v1(x,y) values(48,0);
 loop
  select q.x,q.y,q.position into node from pg_temp.dc_route_queue_v1 q where q.position>head order by q.position limit 1;
  exit when not found;head:=node.position;
  if abs(node.x-p_x)+abs(node.y-p_y)=1 then found_route:=true;exit;end if;
  insert into pg_temp.dc_route_queue_v1(x,y,px,py)
   select t.x,t.y,node.x,node.y from(values(1,0,1),(-1,0,2),(0,1,3),(0,-1,4))d(dx,dy,ord)
   join public.dc_tiles t on t.company_id=p_company and t.x=node.x+d.dx and t.y=node.y+d.dy and t.remaining=0
   order by d.ord on conflict(x,y) do nothing;
 end loop;
 if not found_route then drop table pg_temp.dc_route_queue_v1;return '[]';end if;
 walk_x:=node.x;walk_y:=node.y;
 loop
  result:=jsonb_build_array(jsonb_build_object('x',walk_x,'y',walk_y))||result;
  select q.px,q.py into parent_x,parent_y from pg_temp.dc_route_queue_v1 q where q.x=walk_x and q.y=walk_y;
  exit when parent_x is null;walk_x:=parent_x;walk_y:=parent_y;
 end loop;
 drop table pg_temp.dc_route_queue_v1;
 return result||jsonb_build_array(jsonb_build_object('x',p_x,'y',p_y));
end $$;

create or replace function public.dc_reconcile_v1(p_company uuid,p_now timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.dc_companies%rowtype;m public.dc_milestones%rowtype;j public.dc_expeditions%rowtype;change jsonb;key text;qty integer;dirty boolean:=false;zone text;
begin
 select * into c from public.dc_companies where id=p_company;
 if p_now>=c.energy_reset_at then
  zone:=public.dc_timezone_v1(c.club_id);update public.dc_workers set energy=6 where company_id=c.id;
  update public.dc_companies set timezone=zone,energy_day=(public.dc_calendar_v1(p_now,zone)->>'day')::date,energy_reset_at=(public.dc_calendar_v1(p_now,zone)->>'next_reset_at')::timestamptz where id=c.id;dirty:=true;
 end if;
 for m in select * from public.dc_milestones where company_id=c.id and applied_at is null and due_at<=p_now order by due_at,job_id,sequence for update loop
  select * into j from public.dc_expeditions where id=m.job_id;
  if m.kind='work' then
   for change in select value from jsonb_array_elements(m.payload->'reveals') loop perform public.dc_reveal_v1(c.id,(change->>'x')::integer,(change->>'y')::integer);end loop;
   for change in select value from jsonb_array_elements(m.payload->'extractions') loop
    perform public.dc_reveal_v1(c.id,(change->>'x')::integer,(change->>'y')::integer);qty:=(change->>'quantity')::integer;key:=change->>'resource';
    update public.dc_tiles set remaining=remaining-qty where company_id=c.id and x=(change->>'x')::integer and y=(change->>'y')::integer and material=key and remaining>=qty;
    if not found then raise exception 'Frozen extraction failed verification';end if;
    update public.dc_expeditions set cargo=jsonb_set(cargo,array[key],to_jsonb(coalesce((cargo->>key)::integer,0)+qty),true) where id=j.id;
   end loop;
  else
   update public.dc_expeditions set status='ready' where id=j.id;
   update public.dc_workers set assigned_job_id=null,xp=xp+12*j.energy_per_worker where company_id=c.id and assigned_job_id=j.id;
   delete from public.dc_reservations where job_id=j.id;
   insert into public.dc_logs(company_id,kind,title) values(c.id,'haul_ready','Crew returned. A haul is ready at the mine office.');
  end if;
  update public.dc_milestones set applied_at=p_now where job_id=m.job_id and sequence=m.sequence;dirty:=true;
 end loop;
 if dirty then update public.dc_companies set revision=revision+1 where id=c.id;end if;
end $$;

create or replace function public.dc_snapshot_v1(p_company uuid,p_now timestamptz) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c public.dc_companies%rowtype;capacity integer;used integer;
begin
 if p_company is null then return jsonb_build_object('schema_version',1,'server_now',p_now,'revision',0,'company',null,'resources','{}'::jsonb,'workers','[]'::jsonb,'world',null,'expeditions','[]'::jsonb,'buildings','[]'::jsonb,'log','[]'::jsonb);end if;
 select * into c from public.dc_companies where id=p_company;capacity:=120*(2^(c.warehouse_level-1))::integer;select coalesce(sum(quantity),0) into used from public.dc_inventory where company_id=c.id;
 return jsonb_build_object('schema_version',1,'server_now',p_now,'revision',c.revision,
 'company',jsonb_build_object('id',c.id,'club_id',c.club_id,'user_id',c.user_id,'name',c.name,'cash',c.cash,'timezone',c.timezone,'energy_day',c.energy_day,'tutorial_used',c.tutorial_used,'warehouse_capacity',capacity,'warehouse_used',used,'crew_slots',c.office_level),
 'resources',(select coalesce(jsonb_object_agg(resource_key,quantity),'{}') from public.dc_inventory where company_id=c.id),
 'workers',(select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'specialty',w.specialty,'traits',w.traits,'stats',public.dc_stats_v1(w),'xp',w.xp,'level',least(10,1+w.xp/60),'energy',w.energy,'assigned_job_id',w.assigned_job_id) order by w.template_key),'[]') from public.dc_workers w where company_id=c.id),
 'world',jsonb_build_object('width',96,'chunk_size',32,'max_depth',case c.shaft_level when 1 then 49 when 2 then 99 else 149 end,'revision',c.revision,
  'tiles',(select coalesce(jsonb_agg(jsonb_build_object('x',x,'y',y,'terrain',case when remaining=0 then 'excavated' when material='clay' then 'soil' else 'stone' end,'material',material,'remaining',remaining,'initial_amount',initial_amount) order by y,x),'[]') from public.dc_tiles where company_id=c.id and y>=1)),
 'expeditions',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'mode',e.mode,'status',e.status,
  'worker_ids',(select jsonb_agg(worker_id order by worker_id) from public.dc_expedition_workers where job_id=e.id),'target',jsonb_build_object('x',e.target_x,'y',e.target_y),'path',e.path,'stages',e.stages,
  'stage',case when e.status<>'active' then e.status else coalesce((select value->>'key' from jsonb_array_elements(e.stages) where p_now>=(value->>'starts_at')::timestamptz and p_now<(value->>'ends_at')::timestamptz limit 1),'return') end,
  'started_at',e.started_at,'completes_at',e.completes_at,'duration_minutes',e.duration_minutes,'duration_seconds',e.duration_seconds,'tutorial',e.tutorial,'wages',e.wages,'energy_per_worker',e.energy_per_worker,'config_version',e.config_version,
  'cargo',case when e.status='active' then null when e.status='collected' then p.content->'cargo' else e.cargo end) order by e.started_at desc,e.id),'[]')
  from public.dc_expeditions e join public.dc_plans p on p.job_id=e.id where e.company_id=c.id and (e.status<>'collected' or e.id in(select id from public.dc_expeditions where company_id=c.id and status='collected' order by started_at desc limit 12))),
 'buildings',(select jsonb_agg(jsonb_build_object('key',key,'level',level,'max_level',3,'upgrade_cost',case when level=3 then null when key='mine_office' then case level when 1 then 90 else 1200 end when key='mine_shaft' then case level when 1 then 80 else 2000 end when key='warehouse' then case level when 1 then 60 else 1000 end else case level when 1 then 50 else 1600 end end,
  'effect',case key when 'mine_office' then level||' simultaneous crew slots' when 'mine_shaft' then case level when 1 then '49 m operating depth' when 2 then '99 m operating depth' else '149 m operating depth' end when 'warehouse' then (120*(2^(level-1))::integer)||' units of storage' else (100+25*(level-1))||'% extraction output' end) order by ord)
  from(values('mine_office',c.office_level,1),('mine_shaft',c.shaft_level,2),('warehouse',c.warehouse_level,3),('tool_station',c.tool_level,4))b(key,level,ord)),
 'log',(select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc,l.id),'[]') from(select id,kind,title,created_at from public.dc_logs where company_id=c.id order by created_at desc,id desc limit 20)l));
end $$;

create or replace function public.dc_lock_v1() returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.dc_access_v1();company uuid;
begin
 select id into company from public.dc_companies where club_id=cid and user_id=auth.uid() for update;
 if company is null then raise exception 'Create your company first';end if;
 perform public.dc_reconcile_v1(company,clock_timestamp());return company;
end $$;
create or replace function public.dc_get() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.dc_access_v1();company uuid;
begin
 select id into company from public.dc_companies where club_id=cid and user_id=auth.uid() for update;
 if company is not null then perform public.dc_reconcile_v1(company,clock_timestamp());end if;
 return public.dc_snapshot_v1(company,clock_timestamp());
end $$;
create or replace function public.dc_reconcile() returns jsonb language sql security definer set search_path=public,pg_temp as $$select public.dc_get()$$;
create or replace function public.dc_bootstrap(p_name text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.dc_access_v1();company uuid;q public.dc_requests%rowtype;zone text;moment timestamptz:=clock_timestamp();y integer;r text;
 payload jsonb:=jsonb_build_object('name',p_name);
begin
 if p_request_id is null then raise exception 'Request identity required';end if;
 if p_name is null or length(btrim(p_name)) not between 2 and 40 then raise exception 'Company names need 2–40 characters';end if;
 perform pg_advisory_xact_lock(hashtextextended('dc-company:'||cid||':'||auth.uid(),0));
 select id into company from public.dc_companies where club_id=cid and user_id=auth.uid() for update;
 moment:=clock_timestamp();
 select * into q from public.dc_requests where request_id=p_request_id;
 if found then
  if q.user_id<>auth.uid() or q.club_id<>cid or q.company_id is distinct from company or q.operation<>'bootstrap' or q.payload<>payload then raise exception 'Request identity already used';end if;
  perform public.dc_reconcile_v1(company,clock_timestamp());return public.dc_snapshot_v1(company,clock_timestamp());
 end if;
 if (select count(*) from public.dc_requests where user_id=auth.uid() and created_at>now()-interval '1 minute')>=120 then raise exception 'Too many updates. Wait a moment.';end if;
 if company is null then
  zone:=public.dc_timezone_v1(cid);
  insert into public.dc_companies(club_id,user_id,name,timezone,energy_day,energy_reset_at) values(cid,auth.uid(),btrim(p_name),zone,(public.dc_calendar_v1(moment,zone)->>'day')::date,(public.dc_calendar_v1(moment,zone)->>'next_reset_at')::timestamptz) returning id into company;
  insert into public.dc_worlds(company_id) values(company);
  insert into public.dc_workers(company_id,template_key,name,specialty,traits,stats,wage) values
   (company,'mara','Mara Flint','miner',array['sure_swing','heavy_boots'],'{"mining":72,"geology":34,"engineering":46,"logistics":38,"safety":61,"endurance":74,"leadership":46}',3),
   (company,'ivo','Ivo Vale','geologist',array['ore_eye','deliberate'],'{"mining":41,"geology":82,"engineering":42,"logistics":47,"safety":68,"endurance":55,"leadership":58}',2),
   (company,'tessa','Tessa Pike','hauler',array['pack_mule','short_stride'],'{"mining":48,"geology":45,"engineering":58,"logistics":83,"safety":56,"endurance":76,"leadership":51}',2);
  foreach r in array public.dc_resources_v1() loop insert into public.dc_inventory values(company,r,0);end loop;
  for y in 0..6 loop perform public.dc_reveal_v1(company,48,y);end loop;
  perform public.dc_reveal_v1(company,47,1);perform public.dc_reveal_v1(company,49,1);perform public.dc_reveal_v1(company,46,1);perform public.dc_reveal_v1(company,50,1);
  perform public.dc_reveal_v1(company,47,2);perform public.dc_reveal_v1(company,49,2);perform public.dc_reveal_v1(company,47,3);perform public.dc_reveal_v1(company,49,3);
  insert into public.dc_logs(company_id,kind,title) values(company,'founded','Company founded. Your crew and starter seams are ready.');
 else perform public.dc_reconcile_v1(company,moment);
 end if;
 insert into public.dc_requests values(p_request_id,company,cid,auth.uid(),'bootstrap',payload,now());
 return public.dc_snapshot_v1(company,clock_timestamp());
end $$;

create or replace function public.dc_preview_v1(p_company uuid,p_workers uuid[],p_mode text,p_x integer,p_y integer,p_minutes integer,p_tutorial boolean,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.dc_companies%rowtype;w public.dc_workers%rowtype;t public.dc_tiles%rowtype;stats jsonb;reason text[]:=array[]::text[];route jsonb:='[]';n integer:=coalesce(cardinality(p_workers),0);
 mining numeric:=0;geology numeric:=0;engineering numeric:=0;logistics numeric:=0;safety numeric:=0;endurance numeric:=0;leadership numeric:=0;
 heavy integer:=0;short_stride integer:=0;swing integer:=0;deliberate integer:=0;ore_eye integer:=0;capacity integer:=0;wages integer:=0;energy integer;total integer;
 travel integer:=0;setup integer:=0;work integer:=0;haul integer:=0;back integer:=0;base_out numeric;quantity integer:=0;reveal_count integer:=0;depth integer;risk integer;known boolean;expected text[];stages jsonb;
begin
 select * into c from public.dc_companies where id=p_company;depth:=case c.shaft_level when 1 then 49 when 2 then 99 else 149 end;
 energy:=case when p_tutorial then 1 else case p_minutes when 20 then 1 when 60 then 2 when 180 then 3 end end;total:=case when p_tutorial then 30 else p_minutes*60 end;
 if p_tutorial is null or energy is null or p_mode is null or p_mode not in('explore','extract') or p_x is null or p_y is null or p_x not between 0 and 95 or p_x=48 or p_y not between 1 and depth then reason:=array_append(reason,'Choose a supported target and expedition preset.');end if;
 if n not between 1 and 3 or array_ndims(p_workers) is distinct from 1 or array_lower(p_workers,1) is distinct from 1 or exists(select 1 from unnest(p_workers) v where v is null) or (select count(distinct v) from unnest(p_workers)v)<>n then reason:=array_append(reason,'Choose one to three different workers.');end if;
 if (select count(*) from public.dc_workers where company_id=c.id and id=any(p_workers))<>n then raise exception 'Crew unavailable' using errcode='42501';end if;
 for w in select * from public.dc_workers where company_id=c.id and id=any(p_workers) loop
  stats:=public.dc_stats_v1(w);mining:=mining+(stats->>'mining')::integer;geology:=geology+(stats->>'geology')::integer;engineering:=engineering+(stats->>'engineering')::integer;
  logistics:=logistics+(stats->>'logistics')::integer;safety:=safety+(stats->>'safety')::integer;endurance:=endurance+(stats->>'endurance')::integer;leadership:=greatest(leadership,(stats->>'leadership')::integer);
  wages:=wages+w.wage*coalesce(energy,1);capacity:=capacity+floor((40+(stats->>'logistics')::numeric/2)*case when 'pack_mule'=any(w.traits) then 1.2 else 1 end)::integer;
  heavy:=heavy+case when 'heavy_boots'=any(w.traits) then 1 else 0 end;short_stride:=short_stride+case when 'short_stride'=any(w.traits) then 1 else 0 end;
  swing:=swing+case when 'sure_swing'=any(w.traits) then 1 else 0 end;deliberate:=deliberate+case when 'deliberate'=any(w.traits) then 1 else 0 end;ore_eye:=ore_eye+case when 'ore_eye'=any(w.traits) then 1 else 0 end;
  if w.assigned_job_id is not null then reason:=array_append(reason,w.name||' is already on an expedition.');end if;
  if w.energy<coalesce(energy,1) then reason:=array_append(reason,w.name||' needs the next daily energy reset.');end if;
 end loop;
 if n>0 then mining:=floor(mining/n);geology:=floor(geology/n);engineering:=floor(engineering/n);logistics:=floor(logistics/n);safety:=floor(safety/n);endurance:=floor(endurance/n);end if;
 if exists(select 1 from public.dc_expeditions where company_id=c.id and status='ready') then reason:=array_append(reason,'Collect staged cargo before dispatching another crew.');end if;
 if (select count(*) from public.dc_expeditions where company_id=c.id and status='active')>=c.office_level then reason:=array_append(reason,'All mine office crew slots are occupied.');end if;
 if c.cash<wages then reason:=array_append(reason,'Not enough cash for upfront crew wages.');end if;
 select * into t from public.dc_tiles where company_id=c.id and x=p_x and y=p_y;known:=found;
 if p_mode='extract' and (not known or t.remaining=0) then reason:=array_append(reason,'Choose a revealed, undepleted deposit.');end if;
 if p_mode='explore' and known then reason:=array_append(reason,'Choose an unrevealed frontier tile.');end if;
 if exists(select 1 from public.dc_reservations where company_id=c.id and x=p_x and y=p_y) then reason:=array_append(reason,'Another expedition has reserved that deposit.');end if;
 if p_x between 0 and 95 and p_y between 1 and depth then route:=public.dc_route_v1(c.id,p_x,p_y);end if;
 if jsonb_array_length(route)=0 then reason:=array_append(reason,'This worksite has no excavated route from the shaft.');end if;
 if p_tutorial then
  if c.tutorial_used or p_minutes<>20 or p_mode<>'extract' or p_x<>47 or p_y<>1 or coalesce(t.remaining,0)<10 or not exists(select 1 from public.dc_tiles where company_id=c.id and x=49 and y=1 and remaining>=12)
   or exists(select 1 from public.dc_reservations where company_id=c.id and x in(47,49) and y=1) then reason:=array_append(reason,'The accelerated starter expedition is unavailable.');end if;
  travel:=5;setup:=3;work:=15;haul:=3;back:=4;quantity:=22;
 elsif n>0 and total is not null then
  base_out:=ceil(greatest(0,jsonb_array_length(route)-1)*6*100/(60+logistics)*(100+10.0*heavy/n)/100);
  travel:=greatest(20,base_out::integer);back:=greatest(20,ceil(base_out*(100+10.0*short_stride/n)/100)::integer);
  setup:=greatest(20,ceil(total*0.06*100/(70+engineering))::integer);haul:=greatest(20,ceil(total*0.04*100/(70+logistics))::integer);work:=total-travel-setup-haul-back;
  if work<30 then reason:=array_append(reason,'Choose a longer expedition for this travel route.');end if;
  if p_mode='explore' then quantity:=wages+2*n+floor(mining/20)::integer+floor(geology/30)::integer+floor(endurance/30)::integer;
  else quantity:=greatest(1,floor(greatest(0,work)/60.0*n*(20+mining)/100*(70+safety)/100*(90+geology/4)/100*(100-(energy-1)*greatest(0,80-endurance)/5)/100*(100+leadership*(n-1)/10)/100*(100+25*(c.tool_level-1))/100*(100+(10.0*swing-5.0*deliberate)/n)/100/public.dc_hardness_v1(t.material))::integer);end if;
  quantity:=least(capacity,quantity,case when known then t.remaining else 2147483647 end);
 end if;
 reveal_count:=3+floor(geology/20)::integer+floor(safety/30)::integer+ore_eye;
 if c.cash-wages+coalesce((select sum(inv.quantity*public.dc_price_v1(inv.resource_key)) from public.dc_inventory inv where inv.company_id=c.id),0)+
   quantity*(case when p_mode='extract' and known and not p_tutorial then coalesce(public.dc_price_v1(t.material),1) else 1 end)<2 then reason:=array_append(reason,'Keep enough operating cash or recoverable stock for another dispatch.');end if;
 risk:=floor(coalesce(p_y,0)/10.0)::integer+floor((100-safety)/10)::integer;
 expected:=case when p_tutorial then array['stone','coal'] when p_mode='extract' and known and t.remaining>0 then array[t.material] else public.dc_resources_v1() end;
 stages:=jsonb_build_array(jsonb_build_object('key','travel','duration_seconds',travel),jsonb_build_object('key','setup','duration_seconds',setup),jsonb_build_object('key','work','duration_seconds',greatest(0,work)),jsonb_build_object('key','haul','duration_seconds',haul),jsonb_build_object('key','return','duration_seconds',back));
 return jsonb_build_object('allowed',cardinality(reason)=0,'reasons',to_jsonb(reason),'company_revision',c.revision,'server_now',p_now,'wages',wages,'energy_per_worker',coalesce(energy,0),'duration_seconds',coalesce(total,0),
  'estimated_yield',jsonb_build_object('min',greatest(0,floor(quantity*0.8)::integer),'max',greatest(0,least(capacity,ceil(quantity*1.2)::integer,case when known and not p_tutorial then coalesce(t.remaining,0) else 2147483647 end))),'route',route,'stages',stages,'cargo_capacity',capacity,
  'risk_level',case when risk<8 then 'low' when risk<16 then 'moderate' else 'high' end,'accessible_depth',depth,'expected_resources',to_jsonb(expected),'projected_completion_at',p_now+coalesce(total,0)*interval '1 second',
  '_quantity',quantity,'_reveal_count',reveal_count);
end $$;
create or replace function public.dc_preview(p_worker_ids uuid[],p_mode text,p_target_x integer,p_target_y integer,p_duration_minutes integer,p_tutorial boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();
begin return public.dc_preview_v1(company,p_worker_ids,p_mode,p_target_x,p_target_y,p_duration_minutes,p_tutorial,clock_timestamp())-'_quantity'-'_reveal_count';end $$;

create or replace function public.dc_receipt_v1(p_company uuid,p_request uuid,p_operation text,p_payload jsonb) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.dc_requests%rowtype;c public.dc_companies%rowtype;
begin
 if p_request is null then raise exception 'Request identity required';end if;
 select * into c from public.dc_companies where id=p_company;
 select * into q from public.dc_requests where request_id=p_request;
 if found then
  if q.company_id<>c.id or q.club_id<>c.club_id or q.user_id<>auth.uid() or q.operation<>p_operation or q.payload<>p_payload then raise exception 'Request identity already used';end if;return true;
 end if;
 if (select count(*) from public.dc_requests where user_id=auth.uid() and created_at>now()-interval '1 minute')>=120 then raise exception 'Too many updates. Wait a moment.';end if;
 return false;
end $$;
create or replace function public.dc_store_receipt_v1(p_company uuid,p_request uuid,p_operation text,p_payload jsonb) returns void language sql security definer set search_path=public,pg_temp as $$
 insert into public.dc_requests select p_request,id,club_id,auth.uid(),p_operation,p_payload,now() from public.dc_companies where id=p_company
$$;

create or replace function public.dc_dispatch(p_worker_ids uuid[],p_mode text,p_target_x integer,p_target_y integer,p_duration_minutes integer,p_tutorial boolean,p_expected_revision integer,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;quote jsonb;job uuid;moment timestamptz:=clock_timestamp();cursor_at timestamptz;stage jsonb;stages jsonb:='[]';work_start timestamptz;work_seconds integer;
 payload jsonb:=jsonb_build_object('worker_ids',p_worker_ids,'mode',p_mode,'x',p_target_x,'y',p_target_y,'minutes',p_duration_minutes,'tutorial',p_tutorial,'expected_revision',p_expected_revision);
 extractions jsonb:='[]';reveals jsonb:='[]';cargo jsonb:='{}';change jsonb;chunk_extractions jsonb;chunk_reveals jsonb;qty integer;piece integer;k integer;r text;point record;limit_reveals integer;w uuid;cell jsonb;
 cx integer;cy integer;dx integer;dy integer;nx integer;ny integer;needed integer;take integer;seen jsonb:='{}';total_units integer;prior_budget integer;next_budget integer;offset_units integer;
begin
 if public.dc_receipt_v1(company,p_request_id,'dispatch',payload) then return public.dc_snapshot_v1(company,moment);end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 quote:=public.dc_preview_v1(company,p_worker_ids,p_mode,p_target_x,p_target_y,p_duration_minutes,p_tutorial,moment);
 if not (quote->>'allowed')::boolean then raise exception '%',quote->'reasons'->>0;end if;
 qty:=(quote->>'_quantity')::integer;
 if p_tutorial then
  extractions:='[{"x":47,"y":1,"resource":"coal","quantity":10},{"x":49,"y":1,"resource":"stone","quantity":12}]';cargo:='{"coal":10,"stone":12}';
 elsif p_mode='extract' then
  select material,least(remaining,qty) into r,qty from public.dc_tiles where company_id=company and x=p_target_x and y=p_target_y;
  if qty<=0 then raise exception 'This deposit is depleted';end if;
  extractions:=jsonb_build_array(jsonb_build_object('x',p_target_x,'y',p_target_y,'resource',r,'quantity',qty));cargo:=jsonb_build_object(r,qty);
 else
  -- Scouting progresses through finite adjacent cells in order. Soft host rock
  -- opens practical tunnels; a larger vein stops the route until extracted.
  cx:=p_target_x;cy:=p_target_y;needed:=qty;
  dx:=p_target_x-((quote->'route'->(jsonb_array_length(quote->'route')-2))->>'x')::integer;
  dy:=p_target_y-((quote->'route'->(jsonb_array_length(quote->'route')-2))->>'y')::integer;
  for k in 1..8 loop
   seen:=seen||jsonb_build_object(cx||':'||cy,true);
   select material,remaining into r,take from public.dc_tiles where company_id=company and x=cx and y=cy;
   if not found then cell:=public.dc_cell_v1(company,cx,cy);r:=cell->>'material';take:=(cell->>'initial_amount')::integer;end if;
   take:=least(take,needed);
   if take>0 then
    extractions:=extractions||jsonb_build_array(jsonb_build_object('x',cx,'y',cy,'resource',r,'quantity',take));
    cargo:=jsonb_set(cargo,array[r],to_jsonb(coalesce((cargo->>r)::integer,0)+take),true);needed:=needed-take;
   end if;
   exit when needed=0;
   select cx+v.x,cy+v.y into nx,ny from(values(dx,dy,0),(0,1,1),(-1,0,2),(1,0,3),(0,-1,4))v(x,y,ord)
    where cx+v.x between 0 and 95 and cx+v.x<>48 and cy+v.y between 1 and (quote->>'accessible_depth')::integer
     and not(seen?((cx+v.x)||':'||(cy+v.y))) and not exists(select 1 from public.dc_reservations reservation where reservation.company_id=company and reservation.x=cx+v.x and reservation.y=cy+v.y)
    order by v.ord limit 1;
   exit when not found;cx:=nx;cy:=ny;
  end loop;
  if needed>0 then raise exception 'Choose a frontier with enough route space for this crew';end if;
 end if;
 -- Scouting only reveals finite cells selected from a geometric frontier. Its
 -- actual geology stays private until a due work milestone commits it.
 if p_mode='explore' then
  limit_reveals:=(quote->>'_reveal_count')::integer;
  for point in select p_target_x+gx.offset_x x,p_target_y+gy.offset_y y from generate_series(-2,2)gx(offset_x) cross join generate_series(-2,2)gy(offset_y)
   where abs(gx.offset_x)+abs(gy.offset_y)<=2 and p_target_x+gx.offset_x between 0 and 95 and p_target_y+gy.offset_y between 1 and (quote->>'accessible_depth')::integer order by abs(gx.offset_x)+abs(gy.offset_y),gx.offset_x,gy.offset_y limit limit_reveals loop
   reveals:=reveals||jsonb_build_array(jsonb_build_object('x',point.x,'y',point.y));
  end loop;
 end if;
 -- Even a final partial seam cannot strand the company below its cheapest
 -- wage with no recoverable stock or guaranteed incoming haul.
 if c.cash-(quote->>'wages')::integer+coalesce((select sum(quantity*public.dc_price_v1(resource_key)) from public.dc_inventory where company_id=company),0)+
   coalesce((select sum((value::text)::integer*public.dc_price_v1(key)) from jsonb_each(cargo)),0)<2 then raise exception 'Keep enough operating cash or recoverable stock for another dispatch';end if;
 cursor_at:=moment;
 for stage in select value from jsonb_array_elements(quote->'stages') loop
  if stage->>'key'='work' then work_start:=cursor_at;work_seconds:=(stage->>'duration_seconds')::integer;end if;
  stages:=stages||jsonb_build_array(jsonb_build_object('key',stage->>'key','starts_at',cursor_at,'ends_at',cursor_at+(stage->>'duration_seconds')::integer*interval '1 second'));
  cursor_at:=cursor_at+(stage->>'duration_seconds')::integer*interval '1 second';
 end loop;
 insert into public.dc_expeditions(company_id,mode,target_x,target_y,path,stages,started_at,completes_at,duration_minutes,duration_seconds,tutorial,wages,energy_per_worker,config_version)
 values(company,p_mode,p_target_x,p_target_y,quote->'route',stages,moment,cursor_at,p_duration_minutes,(quote->>'duration_seconds')::integer,p_tutorial,(quote->>'wages')::integer,(quote->>'energy_per_worker')::integer,1) returning id into job;
 foreach w in array p_worker_ids loop insert into public.dc_expedition_workers values(job,w);end loop;
 for change in select value from jsonb_array_elements(extractions) loop insert into public.dc_reservations values(company,(change->>'x')::integer,(change->>'y')::integer,job);end loop;
 insert into public.dc_plans values(job,jsonb_build_object('config_version',1,'crew',(select jsonb_agg(jsonb_build_object('worker_id',worker.id,'stats',public.dc_stats_v1(worker),'traits',worker.traits)) from public.dc_workers worker where worker.id=any(p_worker_ids)),
  'extractions',extractions,'reveals',reveals,'cargo',cargo,'quote',quote));
 select sum((value->>'quantity')::integer) into total_units from jsonb_array_elements(extractions);
 for k in 1..3 loop
  chunk_extractions:='[]';chunk_reveals:='[]';
  prior_budget:=floor(total_units*(k-1)/3.0)::integer;next_budget:=floor(total_units*k/3.0)::integer;offset_units:=0;
  for change in select value from jsonb_array_elements(extractions) loop
   qty:=(change->>'quantity')::integer;
   piece:=least(qty,greatest(0,next_budget-offset_units))-least(qty,greatest(0,prior_budget-offset_units));offset_units:=offset_units+qty;
   if piece>0 then chunk_extractions:=chunk_extractions||jsonb_build_array(jsonb_set(change,'{quantity}',to_jsonb(piece)));end if;
  end loop;
  select coalesce(jsonb_agg(value order by ord),'[]') into chunk_reveals from jsonb_array_elements(reveals) with ordinality e(value,ord) where (ord-1)%3=k-1;
  insert into public.dc_milestones values(job,k,company,work_start+ceil(work_seconds*k/3.0)*interval '1 second','work',jsonb_build_object('extractions',chunk_extractions,'reveals',chunk_reveals),null);
 end loop;
 insert into public.dc_milestones values(job,4,company,cursor_at,'ready','{}',null);
 update public.dc_workers set energy=energy-(quote->>'energy_per_worker')::integer,assigned_job_id=job where company_id=company and id=any(p_worker_ids);
 update public.dc_companies set cash=cash-(quote->>'wages')::integer,tutorial_used=tutorial_used or p_tutorial,revision=revision+1 where id=company;
 insert into public.dc_logs(company_id,kind,title) values(company,'dispatched',case when p_tutorial then 'Starter expedition dispatched. The crew returns in 30 seconds.' else 'Crew dispatched. Wages paid upfront; work continues while you are away.' end);
 perform public.dc_store_receipt_v1(company,p_request_id,'dispatch',payload);return public.dc_snapshot_v1(company,clock_timestamp());
end $$;

create or replace function public.dc_collect(p_job_id uuid,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;j public.dc_expeditions%rowtype;payload jsonb:=jsonb_build_object('job_id',p_job_id);space integer;qty integer;r text;delivered integer:=0;
begin
 if public.dc_receipt_v1(company,p_request_id,'collect',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;select * into j from public.dc_expeditions where id=p_job_id and company_id=company for update;
 if not found then raise exception 'Expedition unavailable' using errcode='42501';end if;
 if j.status='active' then raise exception 'The crew has not returned yet';end if;
 if j.status='ready' then
  select 120*(2^(c.warehouse_level-1))::integer-coalesce(sum(quantity),0) into space from public.dc_inventory where company_id=company;
  foreach r in array public.dc_resources_v1() loop
   qty:=least(greatest(0,space),coalesce((j.cargo->>r)::integer,0));
   if qty>0 then update public.dc_inventory set quantity=quantity+qty where company_id=company and resource_key=r;space:=space-qty;delivered:=delivered+qty;j.cargo:=jsonb_set(j.cargo,array[r],to_jsonb((j.cargo->>r)::integer-qty));end if;
  end loop;
  update public.dc_expeditions set cargo=j.cargo,status=case when not exists(select 1 from jsonb_each(j.cargo) e where (e.value::text)::integer>0) then 'collected' else 'ready' end,
   collected_at=case when not exists(select 1 from jsonb_each(j.cargo) e where (e.value::text)::integer>0) then clock_timestamp() else null end where id=j.id;
  if delivered>0 then update public.dc_companies set revision=revision+1 where id=company;insert into public.dc_logs(company_id,kind,title) values(company,'collected',delivered||' units moved into the warehouse.');end if;
 end if;
 perform public.dc_store_receipt_v1(company,p_request_id,'collect',payload);return public.dc_snapshot_v1(company,clock_timestamp());
end $$;
create or replace function public.dc_sell(p_resource_key text,p_quantity integer,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;payload jsonb:=jsonb_build_object('resource',p_resource_key,'quantity',p_quantity,'expected_revision',p_expected_revision);price integer;
begin
 if public.dc_receipt_v1(company,p_request_id,'sell',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 price:=public.dc_price_v1(p_resource_key);if price is null or p_quantity is null or p_quantity not between 1 and 1000000 then raise exception 'Choose a valid resource and positive quantity';end if;
 update public.dc_inventory set quantity=quantity-p_quantity where company_id=company and resource_key=p_resource_key and quantity>=p_quantity;
 if not found then raise exception 'Not enough stock to sell';end if;
 update public.dc_companies set cash=cash+p_quantity*price,revision=revision+1 where id=company;
 insert into public.dc_logs(company_id,kind,title) values(company,'sold',p_quantity||' units sold for $'||p_quantity*price||'.');
 perform public.dc_store_receipt_v1(company,p_request_id,'sell',payload);return public.dc_snapshot_v1(company,clock_timestamp());
end $$;
create or replace function public.dc_upgrade(p_building_key text,p_expected_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare company uuid:=public.dc_lock_v1();c public.dc_companies%rowtype;payload jsonb:=jsonb_build_object('building',p_building_key,'expected_revision',p_expected_revision);level integer;cost integer;y integer;
begin
 if public.dc_receipt_v1(company,p_request_id,'upgrade',payload) then return public.dc_snapshot_v1(company,clock_timestamp());end if;
 select * into c from public.dc_companies where id=company;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Company changed on another device. Refresh to continue.' using errcode='40001';end if;
 level:=case p_building_key when 'mine_office' then c.office_level when 'mine_shaft' then c.shaft_level when 'warehouse' then c.warehouse_level when 'tool_station' then c.tool_level end;
 if level is null then raise exception 'Building unavailable';end if;if level=3 then raise exception 'This building is fully upgraded';end if;
 cost:=case p_building_key when 'mine_office' then case level when 1 then 90 else 1200 end when 'mine_shaft' then case level when 1 then 80 else 2000 end when 'warehouse' then case level when 1 then 60 else 1000 end else case level when 1 then 50 else 1600 end end;
 if c.cash-cost<2 then raise exception 'Keep $2 operating cash after an upgrade';end if;
 update public.dc_companies set cash=cash-cost,revision=revision+1,office_level=office_level+case when p_building_key='mine_office' then 1 else 0 end,
  shaft_level=shaft_level+case when p_building_key='mine_shaft' then 1 else 0 end,warehouse_level=warehouse_level+case when p_building_key='warehouse' then 1 else 0 end,tool_level=tool_level+case when p_building_key='tool_station' then 1 else 0 end where id=company;
 if p_building_key='mine_shaft' then for y in 0..(case level when 1 then 56 else 106 end) loop perform public.dc_reveal_v1(company,48,y);end loop;end if;
 insert into public.dc_logs(company_id,kind,title) values(company,'upgraded',replace(p_building_key,'_',' ')||' upgraded to level '||(level+1)||'.');
 perform public.dc_store_receipt_v1(company,p_request_id,'upgrade',payload);return public.dc_snapshot_v1(company,clock_timestamp());
end $$;

-- Immutable hidden versions/plans and once-only milestones. Owner fixtures may
-- disable these named guards to advance clocks; production clients cannot.
create or replace function public.dc_immutable_v1() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new;end if;
 if tg_table_name='dc_milestones' then
  if tg_op='UPDATE' and old.applied_at is null and new.applied_at is not null and (to_jsonb(new)-'applied_at')=(to_jsonb(old)-'applied_at') then return new;end if;
 elsif tg_table_name='dc_expeditions' then
  if tg_op='UPDATE' and old.status<>'collected' and (to_jsonb(new)-array['status','cargo','collected_at'])=(to_jsonb(old)-array['status','cargo','collected_at']) then return new;end if;
 end if;
 raise exception 'Committed Deep Claim plans and receipts are immutable';
end $$;
create trigger dc_frozen_rules before update or delete on public.dc_rules for each row execute function public.dc_immutable_v1();
create trigger dc_frozen_world before update or delete on public.dc_worlds for each row execute function public.dc_immutable_v1();
create trigger dc_frozen_chunks before update or delete on public.dc_chunks for each row execute function public.dc_immutable_v1();
create trigger dc_frozen_plan before update or delete on public.dc_plans for each row execute function public.dc_immutable_v1();
create trigger dc_job_guard before update or delete on public.dc_expeditions for each row execute function public.dc_immutable_v1();
create trigger dc_milestone_guard before update or delete on public.dc_milestones for each row execute function public.dc_immutable_v1();
create trigger dc_receipt_guard before update or delete on public.dc_requests for each row execute function public.dc_immutable_v1();

do $$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
grant execute on function public.dc_bootstrap(text,uuid),public.dc_get(),public.dc_reconcile(),public.dc_preview(uuid[],text,integer,integer,integer,boolean),
 public.dc_dispatch(uuid[],text,integer,integer,integer,boolean,integer,uuid),public.dc_collect(uuid,uuid),public.dc_sell(text,integer,integer,uuid),public.dc_upgrade(text,integer,uuid) to authenticated;
commit;
