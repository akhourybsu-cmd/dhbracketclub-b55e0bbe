-- Nexus long-game progression: new rules are immutable per deployment.
-- All prior tickets, receipts and account balances are retained.
alter table public.nexus_core_sessions add column if not exists difficulty integer not null default 1 check(difficulty between 1 and 6);
alter table public.nexus_core_runs add column if not exists difficulty integer not null default 1 check(difficulty between 1 and 6);
create index if not exists nexus_core_runs_tier on public.nexus_core_runs(club_id,balance_version,difficulty,waves desc,score desc);

create or replace function public.nexus_core_loadout_valid(p_loadout jsonb,p_unlocks text[])
returns boolean language plpgsql immutable set search_path=public as $$
declare equipment text; used integer:=0; seen text[]:='{}';
begin
  if jsonb_typeof(p_loadout) is distinct from 'object' or jsonb_typeof(p_loadout->'weapons') is distinct from 'array'
    or jsonb_array_length(p_loadout->'weapons')>2 or not (p_loadout ? 'module') then return false; end if;
  for equipment in select jsonb_array_elements_text(p_loadout->'weapons') loop
    if equipment is null or equipment not in ('orbit','arc','rail','mortar','laser','venom','flak') or equipment=any(seen) or not equipment=any(p_unlocks) then return false; end if;
    seen:=array_append(seen,equipment);
    used:=used+case equipment when 'orbit' then 1 when 'flak' then 1 when 'rail' then 3 else 2 end;
  end loop;
  equipment:=p_loadout->>'module';
  if equipment is not null and (equipment not in ('repair','siphon','stasis','capacitor','thorns') or not equipment=any(p_unlocks)) then return false; end if;
  return used<=4;
end; $$;
revoke all on function public.nexus_core_loadout_valid(jsonb,text[]) from public,anon,authenticated;

create or replace function public.nexus_core_unlock(p_item text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.nexus_core_profiles; price integer; required integer;
begin
  if auth.uid() is null then raise exception 'Sign in to unlock equipment'; end if;
  price:=case p_item when 'orbit' then 90 when 'arc' then 160 when 'rail' then 300 when 'mortar' then 450 when 'repair' then 100 when 'siphon' then 180 when 'stasis' then 250 when 'flak' then 850 when 'laser' then 1400 when 'venom' then 2800 when 'capacitor' then 1800 when 'thorns' then 3500 else null end;
  required:=case p_item when 'orbit' then 5 when 'arc' then 15 when 'rail' then 35 when 'mortar' then 60 when 'repair' then 10 when 'siphon' then 25 when 'stasis' then 40 when 'flak' then 140 when 'laser' then 250 when 'venom' then 650 when 'capacitor' then 400 when 'thorns' then 1000 else null end;
  if price is null then raise exception 'Unknown equipment'; end if;
  select * into p from nexus_core_profiles where user_id=auth.uid() for update;
  if not found then raise exception 'Initialize your core first'; end if;
  if p_item=any(p.unlocks) then return to_jsonb(p); end if;
  if p.total_waves<required then raise exception 'Earn more lifetime waves to unlock this equipment'; end if;
  if p.credits<price then raise exception 'Not enough credits'; end if;
  update nexus_core_profiles set credits=credits-price,unlocks=array_append(unlocks,p_item),updated_at=now() where user_id=auth.uid() returning * into p;
  insert into nexus_core_ledger(user_id,kind,delta,balance,details) values(auth.uid(),'unlock',-price,p.credits,jsonb_build_object('item',p_item));
  return to_jsonb(p);
end; $$;

create or replace function public.nexus_core_research(p_track text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.nexus_core_profiles; lv integer; base integer; price integer;
begin
  if auth.uid() is null then raise exception 'Sign in to upgrade your core'; end if;
  base:=case p_track when 'weapons' then 35 when 'reactor' then 40 when 'plating' then 30 when 'barrier' then 30 when 'salvage' then 35 when 'nova' then 40 else null end;
  if base is null then raise exception 'Unknown research'; end if;
  select * into p from nexus_core_profiles where user_id=auth.uid() for update;
  if not found then raise exception 'Initialize your core first'; end if;
  lv:=coalesce((p.research->>p_track)::integer,0); if lv>=30 then raise exception 'Research complete'; end if;
  price:=round(base*power(1.35::numeric,least(lv,10))*power(1.16::numeric,greatest(0,lv-10)));
  if p.credits<price then raise exception 'Not enough credits'; end if;
  update nexus_core_profiles set credits=credits-price,research=jsonb_set(research,array[p_track],to_jsonb(lv+1)),updated_at=now() where user_id=auth.uid() returning * into p;
  insert into nexus_core_ledger(user_id,kind,delta,balance,details) values(auth.uid(),'research',-price,p.credits,jsonb_build_object('track',p_track,'level',lv+1));
  return to_jsonb(p);
end; $$;

-- Replace the four-argument function rather than introducing ambiguous defaults.
drop function if exists public.nexus_core_begin_endless(uuid,uuid,jsonb,integer);
create or replace function public.nexus_core_begin_endless(p_id uuid,p_club_id uuid,p_loadout jsonb,p_balance_version integer default 4,p_difficulty integer default 1)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); p public.nexus_core_profiles; ticket public.nexus_core_sessions; required integer; snapshot jsonb;
begin
  if uid is null or not exists(select 1 from club_members where user_id=uid and club_id=p_club_id) then raise exception 'Club membership required'; end if;
  if p_balance_version is null or p_balance_version not in (4,5,6) then raise exception 'Unsupported combat rules'; end if;
  if p_id is null then raise exception 'Invalid deployment'; end if;
  insert into nexus_core_profiles(user_id) values(uid) on conflict do nothing;
  select * into p from nexus_core_profiles where user_id=uid for update;
  select * into ticket from nexus_core_sessions where id=p_id;
  if found then
    if ticket.user_id<>uid or ticket.club_id<>p_club_id or ticket.balance_version not in (4,5,6) then raise exception 'Invalid deployment'; end if;
    if ticket.status<>'active' then raise exception 'Deployment already closed'; end if;
    return to_jsonb(ticket);
  end if;
  if p_difficulty is null or p_difficulty not between 1 and 6 or (p_balance_version<6 and p_difficulty<>1) then raise exception 'Unsupported difficulty'; end if;
  required:=(array[0,150,600,1800,4200,9000])[p_difficulty];
  if p.total_waves<required then raise exception 'Earn more lifetime waves to unlock this difficulty'; end if;
  if not nexus_core_loadout_valid(p_loadout,p.unlocks) then raise exception 'Invalid loadout: unlock equipment, use two auxiliary slots and at most 4 power'; end if;
  if p_balance_version<6 and (p_loadout->'weapons' ?| array['laser','venom','flak'] or p_loadout->>'module' in ('capacitor','thorns')) then raise exception 'Equipment requires current combat rules'; end if;
  -- Cached clients never inherit research beyond the caps they understand.
  snapshot:=p.research;
  if p_balance_version<6 then select coalesce(jsonb_object_agg(key,to_jsonb(least(value::text::integer,10))),'{}'::jsonb) into snapshot from jsonb_each(p.research); end if;
  update nexus_core_sessions set status='abandoned' where user_id=uid and status='active';
  update nexus_core_profiles set loadout=p_loadout,updated_at=now() where user_id=uid;
  insert into nexus_core_sessions(id,user_id,club_id,scenario_id,research,seed,loadout,balance_version,difficulty)
    values(p_id,uid,p_club_id,'endless',snapshot,floor(random()*4294967296)::bigint,p_loadout,p_balance_version,p_difficulty) returning * into ticket;
  return to_jsonb(ticket);
end; $$;

create or replace function public.nexus_core_finish_endless(p_run jsonb,p_club_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid(); p public.nexus_core_profiles; saved public.nexus_core_runs; ticket public.nexus_core_sessions;
  rid uuid:=(p_run->>'id')::uuid; cleared integer; secs integer; k integer; points integer;
  u record; lv integer; base integer; cap integer; growth numeric; spend integer:=0; i integer; free integer;
  earned integer; energy integer; start_energy integer; bonus integer:=0; wave_pay integer; payout integer;
  milestone record; key text; multiplier numeric; income_max numeric;
begin
  if uid is null or not exists(select 1 from club_members where user_id=uid and club_id=p_club_id) then raise exception 'Club membership required'; end if;
  select * into p from nexus_core_profiles where user_id=uid for update;
  if not found then raise exception 'Initialize your core first'; end if;
  select * into saved from nexus_core_runs where id=rid;
  if found then
    if saved.user_id<>uid or saved.club_id<>p_club_id or saved.balance_version not in (4,5,6) then raise exception 'Invalid run'; end if;
    return jsonb_build_object('profile',to_jsonb(p),'reward',saved.reward,'stars',0,'waves',saved.wave_reward,'bonus',saved.clear_bonus);
  end if;
  select * into ticket from nexus_core_sessions where id=rid and user_id=uid and club_id=p_club_id and status='active' and balance_version in (4,5,6) for update;
  if not found then raise exception 'Deploy your nexus before submitting a run'; end if;
  if (ticket.balance_version>=5 or p_run ? 'balanceVersion') and (p_run->>'balanceVersion') is distinct from ticket.balance_version::text then raise exception 'Combat rules do not match deployment'; end if;
  if ticket.balance_version=6 and (p_run->>'difficulty') is distinct from ticket.difficulty::text then raise exception 'Difficulty does not match deployment'; end if;
  if p_run->>'scenarioId' is distinct from 'endless' or p_run->>'phase' is distinct from 'defeat' then raise exception 'Endless run is not complete'; end if;
  foreach key in array array['cleared','time','kills','score','earned','spent','energy'] loop
    if jsonb_typeof(p_run->key) is distinct from 'number' then raise exception 'Invalid run counters'; end if;
    if (p_run->>key)::numeric<>trunc((p_run->>key)::numeric) or (p_run->>key)::numeric<0 or (p_run->>key)::numeric>2000000000 then raise exception 'Invalid run counters'; end if;
  end loop;
  cleared:=(p_run->>'cleared')::integer; secs:=(p_run->>'time')::integer; k:=(p_run->>'kills')::integer; points:=(p_run->>'score')::integer;
  earned:=(p_run->>'earned')::integer; energy:=(p_run->>'energy')::integer;
  if cleared>100000 or k::bigint>(cleared::bigint+1)*450 or points::bigint>k::bigint*650+cleared::bigint*(cleared+1)*50 then raise exception 'Invalid run counters'; end if;
  if secs<cleared*4 or secs>extract(epoch from(clock_timestamp()-ticket.created_at))*2+3 then raise exception 'Run duration does not match deployment'; end if;
  if jsonb_typeof(p_run->'upgrades') is distinct from 'object' then raise exception 'Invalid upgrade ledger'; end if;
  for u in select * from jsonb_each(p_run->'upgrades') loop
    if jsonb_typeof(u.value) is distinct from 'number' then raise exception 'Invalid upgrade ledger'; end if;
    lv:=u.value::integer;
    if u.value::text::numeric<>lv then raise exception 'Invalid upgrade ledger'; end if;
    base:=case u.key when 'damage' then 28 when 'haste' then 34 when 'range' then 40 when 'multishot' then 110 when 'critical' then 30 when 'hull' then 36 when 'shield' then 40 when 'regen' then 60 when 'armor' then 50 when 'income' then 50 when 'orbit' then 75 when 'frost' then 65 when 'arc' then 100 when 'rail' then 135 when 'mortar' then 115 when 'laser' then 140 when 'venom' then 120 when 'flak' then 95 when 'cooldown' then 90 when 'thorns' then 85 else null end;
    cap:=case when ticket.balance_version=6 then case u.key when 'damage' then 30 when 'haste' then 16 when 'range' then 8 when 'multishot' then 4 when 'critical' then 10 when 'hull' then 30 when 'shield' then 30 when 'regen' then 15 when 'armor' then 10 when 'income' then 12 when 'orbit' then 8 when 'frost' then 8 when 'cooldown' then 8 when 'thorns' then 8 else 10 end else case u.key when 'damage' then 10 when 'haste' then 8 when 'range' then 6 when 'multishot' then 3 when 'critical' then 5 when 'hull' then 8 when 'shield' then 8 when 'armor' then 6 when 'income' then 6 when 'orbit' then 4 when 'frost' then 4 else 5 end end;
    growth:=case u.key when 'multishot' then 1.85 when 'income' then 1.75 when 'orbit' then 1.65 when 'arc' then 1.6 when 'rail' then 1.6 when 'mortar' then 1.6 when 'laser' then 1.6 when 'venom' then 1.6 when 'flak' then 1.6 else 1.4 end;
    free:=case when ticket.loadout->'weapons' ? u.key then 1 else 0 end;
    if ticket.balance_version<6 and u.key in ('laser','venom','flak','cooldown','thorns') then raise exception 'Upgrade is not available in archived rules'; end if;
    if base is null or lv<free or lv>cap then raise exception 'Invalid upgrade ledger'; end if;
    if lv>0 and ((u.key in ('arc','rail','orbit','mortar','laser','venom','flak') and free=0)
      or (u.key='regen' and ticket.loadout->>'module' is distinct from 'repair')
      or (u.key='income' and ticket.loadout->>'module' is distinct from 'siphon')
      or (u.key='frost' and ticket.loadout->>'module' is distinct from 'stasis')
      or (u.key='cooldown' and ticket.loadout->>'module' is distinct from 'capacitor')
      or (u.key='thorns' and ticket.loadout->>'module' is distinct from 'thorns')) then raise exception 'Upgrade is not in your deployed loadout'; end if;
    if lv>free then for i in free..lv-1 loop spend:=spend+round(base*power(growth,i)); end loop; end if;
  end loop;
  for key in select jsonb_array_elements_text(ticket.loadout->'weapons') loop
    if coalesce((p_run->'upgrades'->>key)::integer,0)<1 then raise exception 'Deployed weapon missing from upgrade ledger'; end if;
  end loop;
  start_energy:=80+coalesce((ticket.research->>'salvage')::integer,0)*12;
  income_max:=case when ticket.balance_version=6 then 2.3 else 1.7 end;
  if spend<>(p_run->>'spent')::integer or earned-spend<>energy
    or earned::numeric<start_energy+k::numeric*4+25*cleared::numeric+2.5*cleared::numeric*(cleared+1)
    or earned::bigint>start_energy+k::bigint*ceil(65*income_max)+ceil((25*cleared::numeric+2.5*cleared::numeric*(cleared+1))*income_max)
    then raise exception 'Invalid energy ledger'; end if;
  wave_pay:=least(1800,3*cleared::numeric+floor(cleared::numeric*cleared/8))::integer;
  multiplier:=case when ticket.balance_version=6 then (array[1,1.25,1.6,2.1,2.8,3.6]::numeric[])[ticket.difficulty] else 1 end;
  wave_pay:=floor(wave_pay*multiplier);
  for milestone in select * from (values (5,20),(10,35),(15,55),(20,85),(25,120)) as m(wave,credits) loop
    if milestone.wave>p.endless_best and milestone.wave<=cleared then bonus:=bonus+milestone.credits; end if;
  end loop;
  payout:=wave_pay+bonus;
  insert into nexus_core_runs(id,user_id,club_id,scenario_id,mode,victory,waves,score,kills,duration_seconds,stars,reward,wave_reward,clear_bonus,balance_version,loadout,difficulty)
    values(rid,uid,p_club_id,'endless','endless',false,cleared,points,k,secs,0,payout,wave_pay,bonus,ticket.balance_version,ticket.loadout,ticket.difficulty);
  update nexus_core_sessions set status='finished' where id=rid;
  update nexus_core_profiles set credits=credits+payout,total_runs=total_runs+1,total_waves=total_waves+cleared,
    endless_best=greatest(endless_best,cleared),updated_at=now() where user_id=uid returning * into p;
  if payout>0 then insert into nexus_core_ledger(user_id,run_id,kind,delta,balance,details)
    values(uid,rid,'run',payout,p.credits,jsonb_build_object('scenario','endless','waves',wave_pay,'milestones',bonus,'difficulty',ticket.difficulty)); end if;
  return jsonb_build_object('profile',to_jsonb(p),'reward',payout,'stars',0,'waves',wave_pay,'bonus',bonus);
end; $$;

revoke all on function public.nexus_core_unlock(text),public.nexus_core_research(text),public.nexus_core_begin_endless(uuid,uuid,jsonb,integer,integer),public.nexus_core_finish_endless(jsonb,uuid) from public,anon;
grant execute on function public.nexus_core_unlock(text),public.nexus_core_research(text),public.nexus_core_begin_endless(uuid,uuid,jsonb,integer,integer),public.nexus_core_finish_endless(jsonb,uuid) to authenticated;

drop function if exists public.nexus_core_records(uuid,text);
create or replace function public.nexus_core_records(p_club_id uuid,p_mode text,p_difficulty integer default 1)
returns table(user_id uuid,score integer,waves integer,scenario_id text,display_name text)
language sql stable security invoker set search_path=public as $$
  select best.user_id,best.score,best.waves,best.scenario_id,p.display_name
  from (
    select distinct on (r.user_id) r.* from public.nexus_core_runs r
    where r.club_id=p_club_id and r.mode='endless' and p_mode='endless' and r.balance_version=6 and r.difficulty=p_difficulty
    order by r.user_id,r.waves desc,r.score desc,r.created_at asc
  ) best join public.profiles p on p.id=best.user_id
  order by best.waves desc,best.score desc,best.user_id limit 50;
$$;
revoke all on function public.nexus_core_records(uuid,text,integer) from public,anon;
grant execute on function public.nexus_core_records(uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
