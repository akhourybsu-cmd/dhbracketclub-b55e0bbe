-- Ruleset 5: faster pacing and specialist weapon tuning.
-- Keep the three-argument call working for cached ruleset-4 clients.
-- Existing tickets, research, unlocks, balances and milestone history are retained.
drop function if exists public.nexus_core_begin_endless(uuid,uuid,jsonb);

create or replace function public.nexus_core_begin_endless(p_id uuid,p_club_id uuid,p_loadout jsonb,p_balance_version integer default 4)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); p public.nexus_core_profiles; ticket public.nexus_core_sessions;
begin
  if uid is null or not exists(select 1 from club_members where user_id=uid and club_id=p_club_id) then raise exception 'Club membership required'; end if;
  if p_balance_version is null or p_balance_version not in (4,5) then raise exception 'Unsupported combat rules'; end if;
  if p_id is null then raise exception 'Invalid deployment'; end if;
  insert into nexus_core_profiles(user_id) values(uid) on conflict do nothing;
  select * into p from nexus_core_profiles where user_id=uid for update;
  select * into ticket from nexus_core_sessions where id=p_id;
  if found then
    if ticket.user_id<>uid or ticket.club_id<>p_club_id or ticket.balance_version not in (4,5) then raise exception 'Invalid deployment'; end if;
    if ticket.status<>'active' then raise exception 'Deployment already closed'; end if;
    return to_jsonb(ticket);
  end if;
  if not nexus_core_loadout_valid(p_loadout,p.unlocks) then raise exception 'Invalid loadout: unlock equipment, use two auxiliary slots and at most 4 power'; end if;
  update nexus_core_sessions set status='abandoned' where user_id=uid and status='active';
  update nexus_core_profiles set loadout=p_loadout,updated_at=now() where user_id=uid;
  insert into nexus_core_sessions(id,user_id,club_id,scenario_id,research,seed,loadout,balance_version)
    values(p_id,uid,p_club_id,'endless',p.research,floor(random()*4294967296)::bigint,p_loadout,p_balance_version) returning * into ticket;
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
    if saved.user_id<>uid or saved.club_id<>p_club_id or saved.balance_version not in (4,5) then raise exception 'Invalid run'; end if;
    return jsonb_build_object('profile',to_jsonb(p),'reward',saved.reward,'stars',0,'waves',saved.wave_reward,'bonus',saved.clear_bonus);
  end if;
  select * into ticket from nexus_core_sessions where id=rid and user_id=uid and club_id=p_club_id and status='active' and balance_version in (4,5) for update;
  if not found then raise exception 'Deploy your nexus before submitting a run'; end if;
  if (ticket.balance_version=5 or p_run ? 'balanceVersion') and (p_run->>'balanceVersion') is distinct from ticket.balance_version::text then raise exception 'Combat rules do not match deployment'; end if;
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
    values(rid,uid,p_club_id,'endless','endless',false,cleared,points,k,secs,0,payout,wave_pay,bonus,ticket.balance_version,ticket.loadout);
  update nexus_core_sessions set status='finished' where id=rid;
  update nexus_core_profiles set credits=credits+payout,total_runs=total_runs+1,total_waves=total_waves+cleared,
    endless_best=greatest(endless_best,cleared),updated_at=now() where user_id=uid returning * into p;
  if payout>0 then insert into nexus_core_ledger(user_id,run_id,kind,delta,balance,details)
    values(uid,rid,'run',payout,p.credits,jsonb_build_object('scenario','endless','waves',wave_pay,'milestones',bonus)); end if;
  return jsonb_build_object('profile',to_jsonb(p),'reward',payout,'stars',0,'waves',wave_pay,'bonus',bonus);
end; $$;

revoke all on function public.nexus_core_begin_endless(uuid,uuid,jsonb,integer),public.nexus_core_finish_endless(jsonb,uuid) from public,anon;
grant execute on function public.nexus_core_begin_endless(uuid,uuid,jsonb,integer),public.nexus_core_finish_endless(jsonb,uuid) to authenticated;

-- Rank the current combat rules; earlier runs remain stored and payable.
create or replace function public.nexus_core_records(p_club_id uuid,p_mode text)
returns table(user_id uuid,score integer,waves integer,scenario_id text,display_name text)
language sql stable security invoker set search_path=public as $$
  select best.user_id,best.score,best.waves,best.scenario_id,p.display_name
  from (
    select distinct on (r.user_id) r.* from public.nexus_core_runs r
    where r.club_id=p_club_id and r.mode='endless' and p_mode='endless' and r.balance_version=5
    order by r.user_id,r.waves desc,r.score desc,r.created_at asc
  ) best join public.profiles p on p.id=best.user_id
  order by best.waves desc,best.score desc,best.user_id limit 50;
$$;

notify pgrst, 'reload schema';
