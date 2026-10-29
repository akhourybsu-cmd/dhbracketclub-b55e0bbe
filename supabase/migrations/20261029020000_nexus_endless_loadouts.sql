-- Endless is the only new deployment. Preserve old balances, research and receipts.
alter table public.nexus_core_profiles add column if not exists unlocks text[] not null default '{}';
alter table public.nexus_core_profiles add column if not exists loadout jsonb not null default '{"weapons":[],"module":null}';
alter table public.nexus_core_profiles add column if not exists total_waves integer not null default 0;
alter table public.nexus_core_profiles add column if not exists endless_best integer not null default 0;
alter table public.nexus_core_sessions add column if not exists loadout jsonb;
alter table public.nexus_core_sessions add column if not exists balance_version integer not null default 3;
alter table public.nexus_core_runs add column if not exists loadout jsonb;
alter table public.nexus_core_ledger drop constraint if exists nexus_core_ledger_kind_check;
alter table public.nexus_core_ledger add constraint nexus_core_ledger_kind_check check (kind in ('run','research','unlock'));

create or replace function public.nexus_core_loadout_valid(p_loadout jsonb,p_unlocks text[])
returns boolean language plpgsql immutable set search_path=public as $$
declare equipment text; used integer:=0; seen text[]:='{}';
begin
  if jsonb_typeof(p_loadout) is distinct from 'object' or jsonb_typeof(p_loadout->'weapons') is distinct from 'array'
    or jsonb_array_length(p_loadout->'weapons')>2 or not (p_loadout ? 'module') then return false; end if;
  for equipment in select jsonb_array_elements_text(p_loadout->'weapons') loop
    if equipment is null or equipment not in ('orbit','arc','rail','mortar') or equipment=any(seen) or not equipment=any(p_unlocks) then return false; end if;
    seen:=array_append(seen,equipment);
    used:=used+case equipment when 'orbit' then 1 when 'rail' then 3 else 2 end;
  end loop;
  equipment:=p_loadout->>'module';
  if equipment is not null and (equipment not in ('repair','siphon','stasis') or not equipment=any(p_unlocks)) then return false; end if;
  return used<=4;
end; $$;
revoke all on function public.nexus_core_loadout_valid(jsonb,text[]) from public,anon,authenticated;

create or replace function public.nexus_core_unlock(p_item text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.nexus_core_profiles; price integer; required integer;
begin
  if auth.uid() is null then raise exception 'Sign in to unlock equipment'; end if;
  price:=case p_item when 'orbit' then 90 when 'arc' then 160 when 'rail' then 300 when 'mortar' then 450 when 'repair' then 100 when 'siphon' then 180 when 'stasis' then 250 else null end;
  required:=case p_item when 'orbit' then 5 when 'arc' then 15 when 'rail' then 35 when 'mortar' then 60 when 'repair' then 10 when 'siphon' then 25 when 'stasis' then 40 else null end;
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

create or replace function public.nexus_core_loadout(p_loadout jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.nexus_core_profiles;
begin
  if auth.uid() is null then raise exception 'Sign in to save your loadout'; end if;
  select * into p from nexus_core_profiles where user_id=auth.uid() for update;
  if not found then raise exception 'Initialize your core first'; end if;
  if not nexus_core_loadout_valid(p_loadout,p.unlocks) then raise exception 'Invalid loadout: unlock equipment, use two auxiliary slots and at most 4 power'; end if;
  update nexus_core_profiles set loadout=p_loadout,updated_at=now() where user_id=auth.uid() returning * into p;
  return to_jsonb(p);
end; $$;

create or replace function public.nexus_core_begin_endless(p_id uuid,p_club_id uuid,p_loadout jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); p public.nexus_core_profiles; ticket public.nexus_core_sessions;
begin
  if uid is null or not exists(select 1 from club_members where user_id=uid and club_id=p_club_id) then raise exception 'Club membership required'; end if;
  if p_id is null then raise exception 'Invalid deployment'; end if;
  insert into nexus_core_profiles(user_id) values(uid) on conflict do nothing;
  select * into p from nexus_core_profiles where user_id=uid for update;
  select * into ticket from nexus_core_sessions where id=p_id;
  if found then
    if ticket.user_id<>uid or ticket.club_id<>p_club_id or ticket.balance_version<>4 then raise exception 'Invalid deployment'; end if;
    if ticket.status<>'active' then raise exception 'Deployment already closed'; end if;
    return to_jsonb(ticket);
  end if;
  if not nexus_core_loadout_valid(p_loadout,p.unlocks) then raise exception 'Invalid loadout: unlock equipment, use two auxiliary slots and at most 4 power'; end if;
  update nexus_core_sessions set status='abandoned' where user_id=uid and status='active';
  update nexus_core_profiles set loadout=p_loadout,updated_at=now() where user_id=uid;
  insert into nexus_core_sessions(id,user_id,club_id,scenario_id,research,seed,loadout,balance_version)
    values(p_id,uid,p_club_id,'endless',p.research,floor(random()*4294967296)::bigint,p_loadout,4) returning * into ticket;
  return to_jsonb(ticket);
end; $$;

create or replace function public.nexus_core_finish_endless(p_run jsonb,p_club_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid(); p public.nexus_core_profiles; saved public.nexus_core_runs; ticket public.nexus_core_sessions;
  rid uuid:=(p_run->>'id')::uuid; cleared integer; secs integer; k integer; points integer;
  u record; lv integer; base integer; cap integer; growth numeric; spend integer:=0; i integer; free integer;
  earned integer; energy integer; start_energy integer; bonus integer:=0; wave_pay integer; payout integer;
  milestone record; key text;
begin
  if uid is null or not exists(select 1 from club_members where user_id=uid and club_id=p_club_id) then raise exception 'Club membership required'; end if;
  select * into p from nexus_core_profiles where user_id=uid for update;
  if not found then raise exception 'Initialize your core first'; end if;
  select * into saved from nexus_core_runs where id=rid;
  if found then
    if saved.user_id<>uid or saved.club_id<>p_club_id or saved.balance_version<>4 then raise exception 'Invalid run'; end if;
    return jsonb_build_object('profile',to_jsonb(p),'reward',saved.reward,'stars',0,'waves',saved.wave_reward,'bonus',saved.clear_bonus);
  end if;
  select * into ticket from nexus_core_sessions where id=rid and user_id=uid and club_id=p_club_id and status='active' and balance_version=4 for update;
  if not found then raise exception 'Deploy your nexus before submitting a run'; end if;
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
    base:=case u.key when 'damage' then 28 when 'haste' then 34 when 'range' then 40 when 'multishot' then 110 when 'critical' then 30 when 'hull' then 36 when 'shield' then 40 when 'regen' then 60 when 'armor' then 50 when 'income' then 50 when 'orbit' then 75 when 'frost' then 65 when 'arc' then 100 when 'rail' then 135 when 'mortar' then 115 else null end;
    cap:=case u.key when 'damage' then 10 when 'haste' then 8 when 'range' then 6 when 'multishot' then 3 when 'critical' then 5 when 'hull' then 8 when 'shield' then 8 when 'armor' then 6 when 'income' then 6 when 'orbit' then 4 when 'frost' then 4 else 5 end;
    growth:=case u.key when 'multishot' then 1.85 when 'income' then 1.75 when 'orbit' then 1.65 when 'arc' then 1.6 when 'rail' then 1.6 when 'mortar' then 1.6 else 1.4 end;
    free:=case when ticket.loadout->'weapons' ? u.key then 1 else 0 end;
    if base is null or lv<free or lv>cap then raise exception 'Invalid upgrade ledger'; end if;
    if lv>0 and ((u.key in ('arc','rail','orbit','mortar') and free=0)
      or (u.key='regen' and ticket.loadout->>'module' is distinct from 'repair')
      or (u.key='income' and ticket.loadout->>'module' is distinct from 'siphon')
      or (u.key='frost' and ticket.loadout->>'module' is distinct from 'stasis')) then raise exception 'Upgrade is not in your deployed loadout'; end if;
    if lv>free then for i in free..lv-1 loop spend:=spend+round(base*power(growth,i)); end loop; end if;
  end loop;
  for key in select jsonb_array_elements_text(ticket.loadout->'weapons') loop
    if coalesce((p_run->'upgrades'->>key)::integer,0)<1 then raise exception 'Deployed weapon missing from upgrade ledger'; end if;
  end loop;
  start_energy:=80+coalesce((ticket.research->>'salvage')::integer,0)*12;
  if spend<>(p_run->>'spent')::integer or earned-spend<>energy
    or earned::numeric<start_energy+k::numeric*4+25*cleared::numeric+2.5*cleared::numeric*(cleared+1)
    or earned::bigint>start_energy+k::bigint*111+ceil((25*cleared::numeric+2.5*cleared::numeric*(cleared+1))*1.7)
    then raise exception 'Invalid energy ledger'; end if;
  wave_pay:=least(1800,3*cleared::numeric+floor(cleared::numeric*cleared/8))::integer;
  for milestone in select * from (values (5,20),(10,35),(15,55),(20,85),(25,120)) as m(wave,credits) loop
    if milestone.wave>p.endless_best and milestone.wave<=cleared then bonus:=bonus+milestone.credits; end if;
  end loop;
  payout:=wave_pay+bonus;
  insert into nexus_core_runs(id,user_id,club_id,scenario_id,mode,victory,waves,score,kills,duration_seconds,stars,reward,wave_reward,clear_bonus,balance_version,loadout)
    values(rid,uid,p_club_id,'endless','endless',false,cleared,points,k,secs,0,payout,wave_pay,bonus,4,ticket.loadout);
  update nexus_core_sessions set status='finished' where id=rid;
  update nexus_core_profiles set credits=credits+payout,total_runs=total_runs+1,total_waves=total_waves+cleared,
    endless_best=greatest(endless_best,cleared),updated_at=now() where user_id=uid returning * into p;
  if payout>0 then insert into nexus_core_ledger(user_id,run_id,kind,delta,balance,details)
    values(uid,rid,'run',payout,p.credits,jsonb_build_object('scenario','endless','waves',wave_pay,'milestones',bonus)); end if;
  return jsonb_build_object('profile',to_jsonb(p),'reward',payout,'stars',0,'waves',wave_pay,'bonus',bonus);
end; $$;

revoke all on function public.nexus_core_unlock(text),public.nexus_core_loadout(jsonb),public.nexus_core_begin_endless(uuid,uuid,jsonb),public.nexus_core_finish_endless(jsonb,uuid) from public,anon;
grant execute on function public.nexus_core_unlock(text),public.nexus_core_loadout(jsonb),public.nexus_core_begin_endless(uuid,uuid,jsonb),public.nexus_core_finish_endless(jsonb,uuid) to authenticated;

-- Club records use the same loadout-era ramp. Archived scores remain in storage.
create or replace function public.nexus_core_records(p_club_id uuid,p_mode text)
returns table(user_id uuid,score integer,waves integer,scenario_id text,display_name text)
language sql stable security invoker set search_path=public as $$
  select best.user_id,best.score,best.waves,best.scenario_id,p.display_name
  from (
    select distinct on (r.user_id) r.* from public.nexus_core_runs r
    where r.club_id=p_club_id and r.mode='endless' and p_mode='endless' and r.balance_version=4
    order by r.user_id,r.waves desc,r.score desc,r.created_at asc
  ) best join public.profiles p on p.id=best.user_id
  order by best.waves desc,best.score desc,best.user_id limit 50;
$$;

update public.platform_assets set short_description='One core. Endless waves. Build your arsenal.',
  full_description='Defend a central nexus against an endless 360-degree assault. Unlock distinctive weapons, build a loadout within its power budget, choose a support module and earn permanent core upgrades. Siege bosses arrive every fifth wave.' where slug='nexus-defense';
-- Archived registered runs can still finish. New runs must use the loadout RPCs.
create or replace function public.nexus_core_begin(p_id uuid,p_scenario text,p_club_id uuid,p_legacy boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); p public.nexus_core_profiles; ticket public.nexus_core_sessions;
begin
  if uid is null or not exists(select 1 from club_members where user_id=uid and club_id=p_club_id) then raise exception 'Club membership required'; end if;
  if p_id is null or p_scenario is null or p_scenario not in ('1','2','3','4','5','6','7','8','endless','rush','glass','siege','blackout') then raise exception 'Unknown deployment'; end if;
  insert into nexus_core_profiles(user_id) values(uid) on conflict do nothing;
  select * into p from nexus_core_profiles where user_id=uid for update;
  select * into ticket from nexus_core_sessions where id=p_id;
  if found then
    if ticket.user_id<>uid or ticket.club_id<>p_club_id or ticket.scenario_id<>p_scenario then raise exception 'Invalid deployment'; end if;
    if ticket.status<>'active' then raise exception 'Deployment already closed'; end if;
    return to_jsonb(ticket);
  end if;
  if not p_legacy then raise exception 'Deploy using the Endless loadout protocol'; end if;
  if p_scenario ~ '^[2-8]$' and not (p.campaign ? (p_scenario::integer-1)::text) then raise exception 'Clear the previous sector first'; end if;
  if p_legacy and not p.legacy_slot then raise exception 'This account has no legacy checkpoint to import'; end if;
  if p_legacy then update nexus_core_profiles set legacy_slot=false where user_id=uid; end if;
  update nexus_core_sessions set status='abandoned' where user_id=uid and status='active';
  insert into nexus_core_sessions(id,user_id,club_id,scenario_id,research,seed,legacy)
    values(p_id,uid,p_club_id,p_scenario,p.research,floor(random()*4294967296)::bigint,p_legacy) returning * into ticket;
  return to_jsonb(ticket);
end; $$;

create or replace function public.nexus_core_finish(p_run jsonb,p_club_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid(); p public.nexus_core_profiles; saved public.nexus_core_runs; ticket public.nexus_core_sessions;
  rid uuid:=(p_run->>'id')::uuid; scenario text; game_mode text; goal integer; bonus integer:=0;
  cleared integer; won boolean; stars integer; wave_pay integer; payout integer; secs integer; k integer; points integer; ratio numeric;
  upgrade record; lv integer; base integer; cap integer; growth numeric; spend integer:=0; i integer;
  earned integer; energy integer; start_energy integer;
begin
  if uid is null or not exists(select 1 from club_members where user_id=uid and club_id=p_club_id) then raise exception 'Club membership required'; end if;
  select * into p from nexus_core_profiles where user_id=uid for update;
  if not found then raise exception 'Initialize your core first'; end if;
  select * into saved from nexus_core_runs where id=rid;
  if found then
    if saved.user_id<>uid or saved.club_id<>p_club_id then raise exception 'Invalid run'; end if;
    return jsonb_build_object('profile',to_jsonb(p),'reward',saved.reward,'stars',saved.stars,'waves',saved.wave_reward,'bonus',saved.clear_bonus);
  end if;
  select * into ticket from nexus_core_sessions where id=rid and user_id=uid and club_id=p_club_id and status='active' for update;
  if not found then raise exception 'Deploy your nexus before submitting a run'; end if;
  if ticket.balance_version>=4 then raise exception 'Use the Endless reward protocol'; end if;
  scenario:=ticket.scenario_id;
  if p_run->>'scenarioId' is distinct from scenario then raise exception 'Run does not match deployment'; end if;
  if scenario ~ '^[1-8]$' then game_mode:='campaign';goal:=scenario::integer+4;
  elsif scenario='endless' then game_mode:='endless';goal:=null;
  else game_mode:='challenge';goal:=case scenario when 'glass' then 6 when 'siege' then 9 else 8 end;end if;
  if p_run->>'phase' is null or p_run->>'phase' not in ('victory','defeat') then raise exception 'Run is not complete'; end if;
  if jsonb_typeof(p_run->'cleared') is distinct from 'number' or jsonb_typeof(p_run->'time') is distinct from 'number' or jsonb_typeof(p_run->'kills') is distinct from 'number' or jsonb_typeof(p_run->'score') is distinct from 'number' or jsonb_typeof(p_run->'hpRatio') is distinct from 'number' then raise exception 'Invalid run counters';end if;
  if exists(select 1 from jsonb_each(p_run) v where case when v.key in ('cleared','time','kills','score') then (v.value::text)::numeric<>trunc((v.value::text)::numeric) else false end) then raise exception 'Invalid run counters';end if;
  cleared:=(p_run->>'cleared')::integer;secs:=(p_run->>'time')::integer;k:=(p_run->>'kills')::integer;points:=(p_run->>'score')::integer;ratio:=(p_run->>'hpRatio')::numeric;
  if cleared<0 or cleared>100000 or (goal is not null and cleared>goal) then raise exception 'Invalid wave count';end if;
  if ratio not between 0 and 1 or secs<0 or k<0 or k::bigint>(cleared::bigint+1)*450 or points<0 or points::bigint>k::bigint*650+cleared::bigint*(cleared+1)*50 then raise exception 'Invalid run counters';end if;
  if not ticket.legacy and (secs<cleared*4 or secs>extract(epoch from(clock_timestamp()-ticket.created_at))*2+3) then raise exception 'Run duration does not match deployment';end if;
  won:=p_run->>'phase'='victory' and goal is not null and cleared=goal;
  if p_run->>'phase'='victory' and not won then raise exception 'Invalid victory';end if;
  if not ticket.legacy then
    if jsonb_typeof(p_run->'upgrades') is distinct from 'object' then raise exception 'Invalid upgrade ledger';end if;
    for upgrade in select * from jsonb_each(p_run->'upgrades') loop
      if jsonb_typeof(upgrade.value) is distinct from 'number' then raise exception 'Invalid upgrade ledger';end if;
      lv:=upgrade.value::integer;
      if upgrade.value::text::numeric<>lv then raise exception 'Invalid upgrade ledger';end if;
      base:=case upgrade.key when 'damage' then 28 when 'haste' then 34 when 'range' then 40 when 'multishot' then 110 when 'critical' then 30 when 'hull' then 36 when 'shield' then 40 when 'regen' then 60 when 'armor' then 50 when 'income' then 50 when 'orbit' then 75 when 'frost' then 65 when 'arc' then 100 when 'rail' then 135 else null end;
      cap:=case upgrade.key when 'damage' then 10 when 'haste' then 8 when 'range' then 6 when 'multishot' then 3 when 'critical' then 5 when 'hull' then 8 when 'shield' then 8 when 'regen' then 5 when 'armor' then 6 when 'income' then 6 when 'orbit' then 4 when 'frost' then 4 else 5 end;
      growth:=case upgrade.key when 'multishot' then 1.85 when 'income' then 1.75 when 'orbit' then 1.65 when 'arc' then 1.6 when 'rail' then 1.6 else 1.4 end;
      if base is null or lv<0 or lv>cap or (scenario='glass' and upgrade.key in ('hull','shield','regen','armor') and lv>0) or (scenario='blackout' and upgrade.key='regen' and lv>0) then raise exception 'Invalid upgrade ledger';end if;
      if lv>0 then for i in 0..lv-1 loop spend:=spend+round(base*power(growth,i));end loop;end if;
    end loop;
    if jsonb_typeof(p_run->'earned') is distinct from 'number' or jsonb_typeof(p_run->'spent') is distinct from 'number' or jsonb_typeof(p_run->'energy') is distinct from 'number' then raise exception 'Invalid energy ledger';end if;
    earned:=(p_run->>'earned')::integer;energy:=(p_run->>'energy')::integer;start_energy:=80+coalesce((ticket.research->>'salvage')::integer,0)*12;
    if spend<>(p_run->>'spent')::integer or energy<0 or earned-spend<>energy or earned::numeric<start_energy+k::numeric*4+25*cleared::numeric+2.5*cleared::numeric*(cleared+1) or earned::bigint>start_energy+k::bigint*104+ceil((25*cleared::numeric+2.5*cleared::numeric*(cleared+1))*1.6) then raise exception 'Invalid energy ledger';end if;
  end if;
  wave_pay:=case game_mode when 'endless' then least(1500,4*cleared::numeric+floor(cleared::numeric*cleared/4))::integer when 'challenge' then cleared*6 else cleared*(4+scenario::integer/2) end;
  if won and not ((case when game_mode='campaign' then p.campaign else p.challenges end)?scenario) then
    bonus:=case when game_mode='campaign' then (array[70,85,100,120,140,160,180,220])[scenario::integer] else case scenario when 'rush' then 120 when 'blackout' then 130 else 150 end end;
  end if;
  payout:=wave_pay+bonus;stars:=case when not won then 0 when ratio>=0.8 then 3 when ratio>=0.4 then 2 else 1 end;
  insert into nexus_core_runs(id,user_id,club_id,scenario_id,mode,victory,waves,score,kills,duration_seconds,stars,reward,wave_reward,clear_bonus,balance_version)
    values(rid,uid,p_club_id,scenario,game_mode,won,cleared,points,k,secs,stars,payout,wave_pay,bonus,3);
  update nexus_core_sessions set status='finished' where id=rid;
  update nexus_core_profiles set credits=credits+payout,total_runs=total_runs+1,
    campaign=case when won and game_mode='campaign' then jsonb_set(campaign,array[scenario],to_jsonb(greatest(coalesce((campaign->>scenario)::integer,0),stars))) else campaign end,
    challenges=case when won and game_mode='challenge' then jsonb_set(challenges,array[scenario],to_jsonb(greatest(coalesce((challenges->>scenario)::integer,0),stars))) else challenges end,
    best_wave=case when game_mode='endless' then greatest(best_wave,cleared) else best_wave end,updated_at=now() where user_id=uid returning * into p;
  if payout>0 then insert into nexus_core_ledger(user_id,run_id,kind,delta,balance,details) values(uid,rid,'run',payout,p.credits,jsonb_build_object('scenario',scenario,'waves',wave_pay,'first_clear',bonus));end if;
  return jsonb_build_object('profile',to_jsonb(p),'reward',payout,'stars',stars,'waves',wave_pay,'bonus',bonus);
end; $$;
notify pgrst,'reload schema';
