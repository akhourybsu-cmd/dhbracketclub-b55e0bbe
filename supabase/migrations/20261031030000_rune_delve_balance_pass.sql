-- Rune economy v2: paced XP, meaningful replays and source-backed rewards.
-- No balances, XP totals, earned levels, unlocks or historical receipts reset.
begin;

create or replace function public.rune_delve_level_from_xp(p_xp bigint)
returns integer language plpgsql immutable set search_path=public,pg_temp as $$
declare remaining bigint:=greatest(0,coalesce(p_xp,0)); result integer:=1;
begin
  while result<150 and remaining>=100+(result-1)*10 loop
    remaining:=remaining-(100+(result-1)*10); result:=result+1;
  end loop;
  return result;
end $$;

create or replace function public.rune_delve_credit_xp(p_uid uuid,p_class text,p_xp integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare track rune_delve_class_progress; nextlevel integer; title text; slots integer;
begin
  if p_class not in('warrior','mage','rogue','cleric') or p_xp<0 then raise exception 'invalid_class_xp'; end if;
  insert into rune_delve_class_progress(user_id,class) values(p_uid,p_class) on conflict(user_id,class) do nothing;
  select * into strict track from rune_delve_class_progress where user_id=p_uid and class=p_class for update;
  nextlevel:=greatest(track.level,rune_delve_level_from_xp(track.xp::bigint+p_xp));
  title:=coalesce(rune_delve_class_title(p_class,nextlevel),track.cosmetic_title);
  update rune_delve_class_progress set xp=track.xp+p_xp,level=nextlevel,cosmetic_title=title where id=track.id;
  update rune_delve_heroes set xp=track.xp+p_xp,level=greatest(rune_delve_heroes.level,nextlevel),cosmetic_title=title where user_id=p_uid and class=p_class;
  select case when coalesce(max(level),1)>=25 then 3 else 2 end into slots from rune_delve_class_progress where user_id=p_uid;
  insert into rune_delve_wallet(user_id,slots_unlocked) values(p_uid,slots) on conflict(user_id) do update set slots_unlocked=greatest(rune_delve_wallet.slots_unlocked,excluded.slots_unlocked) returning rune_delve_wallet.slots_unlocked into slots;
  return jsonb_build_object('previousClassLevel',track.level,'classLevel',nextlevel,'classXp',track.xp+p_xp,'cosmeticTitle',title,'slotsUnlocked',slots);
end $$;
revoke all on function public.rune_delve_credit_xp(uuid,text,integer) from public,anon,authenticated;

-- Re-level upward only. Original XP and every previously earned entitlement stay.
update public.rune_delve_class_progress t set level=greatest(t.level,h.level) from public.rune_delve_heroes h where h.user_id=t.user_id and h.class=t.class;
update public.rune_delve_class_progress set level=greatest(level,public.rune_delve_level_from_xp(xp));
update public.rune_delve_class_progress set cosmetic_title=coalesce(public.rune_delve_class_title(class,level),cosmetic_title);
update public.rune_delve_heroes h set level=greatest(h.level,t.level),cosmetic_title=coalesce(t.cosmetic_title,h.cosmetic_title)
  from public.rune_delve_class_progress t where t.user_id=h.user_id and t.class=h.class;
insert into public.rune_delve_wallet(user_id,slots_unlocked)
  select user_id,3 from public.rune_delve_class_progress group by user_id having max(level)>=25
  on conflict(user_id) do update set slots_unlocked=greatest(rune_delve_wallet.slots_unlocked,3);

create or replace function public.rune_delve_bootstrap(p_class text default null,p_hero_name text default null,p_create_hero boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare uid uuid:=auth.uid(); hero rune_delve_heroes; track rune_delve_class_progress; wallet rune_delve_wallet; progress rune_delve_progress; cls text; slots integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_class is not null and p_class not in('warrior','mage','rogue','cleric') then raise exception 'Invalid class'; end if;
  if p_hero_name is not null and (length(btrim(p_hero_name))<2 or length(btrim(p_hero_name))>24) then raise exception 'Hero name must be 2–24 characters'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rune:'||uid::text,0));
  if p_create_hero then
    insert into rune_delve_heroes(user_id,hero_name,class) values(uid,coalesce(btrim(p_hero_name),'Adventurer'),coalesce(p_class,'warrior')) on conflict(user_id) do nothing;
  end if;
  select * into hero from rune_delve_heroes where user_id=uid;
  select * into progress from rune_delve_progress where user_id=uid;
  if hero.id is not null then
    cls:=coalesce(p_class,hero.class);
    insert into rune_delve_class_progress(user_id,class,xp,level,cosmetic_title,highest_unlocked_level,highest_completed_level,total_levels_cleared,current_chapter)
      values(uid,cls,case when cls=hero.class then hero.xp else 0 end,
        case when cls=hero.class then greatest(hero.level,rune_delve_level_from_xp(hero.xp)) else 1 end,
        case when cls=hero.class then hero.cosmetic_title else rune_delve_class_title(cls,1) end,
        case when cls=hero.class then coalesce(progress.highest_unlocked_level,1) else 1 end,
        case when cls=hero.class then coalesce(progress.highest_completed_level,0) else 0 end,
        case when cls=hero.class then coalesce(progress.total_levels_cleared,0) else 0 end,
        case when cls=hero.class then coalesce(progress.current_chapter,1) else 1 end)
      on conflict(user_id,class) do nothing;
    select * into strict track from rune_delve_class_progress where user_id=uid and class=cls;
    insert into rune_delve_progress(user_id) values(uid) on conflict(user_id) do nothing;
    select * into progress from rune_delve_progress where user_id=uid;
  end if;
  select case when coalesce(max(level),1)>=25 then 3 else 2 end into slots from rune_delve_class_progress where user_id=uid;
  insert into rune_delve_wallet(user_id,slots_unlocked) values(uid,slots)
    on conflict(user_id) do update set slots_unlocked=greatest(rune_delve_wallet.slots_unlocked,excluded.slots_unlocked);
  select * into strict wallet from rune_delve_wallet where user_id=uid;
  return jsonb_build_object('hero',case when hero.id is null then null else to_jsonb(hero) end,'track',case when track.id is null then null else to_jsonb(track) end,'wallet',to_jsonb(wallet),'progress',case when progress.user_id is null then null else to_jsonb(progress) end);
end $$;

create or replace function public.rune_delve_select_class(p_class text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare uid uuid:=auth.uid(); track rune_delve_class_progress; hero rune_delve_heroes;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_class is null or p_class not in('warrior','mage','rogue','cleric') then raise exception 'Invalid class'; end if;
  perform public.rune_delve_bootstrap(p_class,null,false);
  select * into strict track from rune_delve_class_progress where user_id=uid and class=p_class;
  update rune_delve_heroes set class=p_class,xp=track.xp,level=track.level,cosmetic_title=coalesce(track.cosmetic_title,rune_delve_class_title(p_class,track.level)) where user_id=uid returning * into hero;
  if hero.id is null then raise exception 'Create a hero first'; end if;
  return to_jsonb(hero);
end $$;

create or replace function public.rune_delve_assign_quests()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare uid uuid:=auth.uid(); cls text; period text; scope rd_quest_scope; q rune_delve_quest_definitions; existing integer; personal boolean; needed integer; result jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rune:'||uid::text,0));
  select class into cls from rune_delve_heroes where user_id=uid;
  if cls is null then return '[]'::jsonb; end if;
  foreach scope in array array['daily'::rd_quest_scope,'weekly'::rd_quest_scope] loop
    period:=case when scope='daily' then to_char(now() at time zone 'UTC','YYYY-MM-DD') else to_char(now() at time zone 'UTC','IYYY-"W"IW') end;
    foreach personal in array array[false,true] loop
      select count(*) into existing from rune_delve_active_quests a join rune_delve_quest_definitions d on d.id=a.quest_id
        where a.user_id=uid and a.scope=scope and a.period_key=period and d.is_personal=personal;
      needed:=greatest(0,case when personal then 1 else 2 end-existing);
      for q in select d.* from rune_delve_quest_definitions d where d.scope=scope and d.is_personal=personal
          and (not personal or d.hero_class is null or d.hero_class=cls)
          and not exists(select 1 from rune_delve_active_quests a where a.user_id=uid and a.quest_id=d.id and a.period_key=period)
          order by md5(scope::text||':'||period||':'||case when personal then uid::text else 'shared' end||':'||d.id) limit needed loop
        insert into rune_delve_active_quests(user_id,quest_id,scope,period_key,progress,target_value,status)
          values(uid,q.id,scope,period,0,q.target_value,'active') on conflict(user_id,quest_id,period_key) do nothing;
      end loop;
    end loop;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.scope,a.quest_id),'[]'::jsonb) into result from rune_delve_active_quests a
    where a.user_id=uid and a.period_key in(to_char(now() at time zone 'UTC','YYYY-MM-DD'),to_char(now() at time zone 'UTC','IYYY-"W"IW'));
  return result;
end $$;

-- Only this fixed catalog can deliver a drop; no caller chooses a free relic.
create or replace function public.rune_delve_treasure_cells(p_level integer,p_path text)
returns integer language sql immutable set search_path=public,pg_temp as $$
  select case when p_path='treasure' and p_level>1 and (p_level%10=0 or p_level%50=1) then 3
    when p_level>150 then case when p_level%50=0 or p_level%50=1 then 1
      when p_level%10=0 then case when (p_level/25)%2=0 then 3 else 4 end
      when (p_level-((p_level+49)/50))%4=2 then 2 else 1 end
    else (array[1,1,2,1,1,1,2,1,1,3,2,1,1,1,2,1,1,1,2,3,1,1,2,1,1,2,2,1,1,4,2,1,1,1,2,2,1,1,2,4,1,1,2,1,1,2,2,1,1,1,3,2,1,1,1,2,1,1,1,3,1,1,1,2,1,2,1,2,1,3,1,2,1,1,1,2,1,1,1,4,2,1,1,2,1,1,1,2,1,4,1,2,1,1,1,2,1,1,1,1,3,1,1,1,2,1,1,1,2,3,1,1,2,1,1,1,2,1,1,3,2,1,1,1,2,1,1,1,2,4,1,1,2,1,1,1,2,1,1,4,2,1,1,1,2,1,1,1,2,1])[greatest(1,least(150,p_level))] end
$$;

create or replace function public.rune_delve_roll_drop(p_uid uuid,p_level integer,p_path text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $drop$
#variable_conflict use_variable
declare chance numeric; roll numeric; item jsonb; owned rune_delve_relic_unlocks;
begin
  chance:=least(0.25,0.08+greatest(0,(p_level-1)/50)*0.01+case when p_level%50=0 then 0.05 when p_level%10=0 then 0.02 else 0 end+
    case when p_path='elite' and p_level>1 and(p_level%10=0 or p_level%50=1) then 0.08 else 0 end);
  roll:=((hashtextextended(p_uid::text||':'||p_request_id::text,177) & 9223372036854775807)%1000000)::numeric/1000000;
  if roll>=chance then return null; end if;
  select entry into item from jsonb_array_elements($catalog$[{"id":"ember_edge","tier":1,"cost":100},{"id":"aether_spark","tier":1,"cost":100},{"id":"iron_resolve","tier":1,"cost":120},{"id":"verdant_heart","tier":1,"cost":100},{"id":"keysight","tier":1,"cost":120},{"id":"quickstep","tier":1,"cost":110},{"id":"shrine_ward","tier":1,"cost":130},{"id":"wanderers_compass","tier":1,"cost":150},{"id":"mirror_shard","tier":1,"cost":140},{"id":"brambleward","tier":1,"cost":130},{"id":"crimson_tide","tier":2,"cost":280},{"id":"sapphire_flow","tier":2,"cost":300},{"id":"last_stand","tier":2,"cost":380},{"id":"cleansing_touch","tier":2,"cost":320},{"id":"momentum","tier":2,"cost":280},{"id":"foresight","tier":2,"cost":350},{"id":"bulwark","tier":2,"cost":320},{"id":"spiked_aegis","tier":2,"cost":340},{"id":"vampiric_sigil","tier":2,"cost":360},{"id":"rune_echo","tier":2,"cost":340},{"id":"executioners_mark","tier":3,"cost":600},{"id":"first_light","tier":3,"cost":650},{"id":"bloodbond","tier":3,"cost":700},{"id":"desperate_surge","tier":3,"cost":600},{"id":"cracked_crown","tier":3,"cost":750},{"id":"foreseers_lens","tier":3,"cost":700},{"id":"void_pact","tier":3,"cost":800},{"id":"phoenix_heart","tier":3,"cost":850}]$catalog$::jsonb) entry
    where (entry->>'tier')::integer<=least(3,((p_level-1)/50)+1)
      and not exists(select 1 from rune_delve_relic_unlocks r where r.user_id=p_uid and r.relic_id=entry->>'id')
    order by md5(p_request_id::text||':'||(entry->>'id')) limit 1;
  if item is null then return null; end if;
  insert into rune_delve_relic_unlocks(user_id,relic_id,rank,acquired_at_level) values(p_uid,item->>'id',1,p_level)
    on conflict(user_id,relic_id) do nothing returning * into owned;
  return case when owned.id is null then null else to_jsonb(owned) end;
end $drop$;
revoke all on function public.rune_delve_roll_drop(uuid,integer,text,uuid) from public,anon,authenticated;

create or replace function public.rune_delve_save_run(p_run jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
#variable_conflict use_variable
declare
  uid uuid:=auth.uid(); lid uuid:=(p_run->>'level_id')::uuid; n integer:=(p_run->>'level_number')::integer;
  cls text:=p_run->>'hero_class'; score integer:=(p_run->>'score')::integer; cleared boolean:=coalesce((p_run->>'dungeon_cleared')::boolean,false);
  turns integer:=(p_run->>'turns_used')::integer; damage integer:=(p_run->>'total_damage')::integer;
  chain integer:=(p_run->>'longest_chain')::integer; hp integer:=(p_run->>'hp_remaining')::integer; kills integer:=(p_run->>'enemies_defeated')::integer;
  old rune_delve_runs; saved rune_delve_runs; track rune_delve_class_progress; hero rune_delve_heroes; receipt rune_delve_action_receipts;
  result jsonb; newbest boolean; firstclear boolean; betterchain boolean; betterturns boolean; betterhp boolean;
  xp integer; oldlevel integer; newlevel integer:=1; remaining integer; title text; slots integer; newcampaign boolean;
  context jsonb:=coalesce(p_run->'reward_context','{}'::jsonb); failcount integer:=0; compass numeric:=1;
  base integer; shards integer; progress numeric; enemyprogress numeric; turnprogress numeric; bossprogress numeric:=0; pathmult numeric:=1;
  questcontext jsonb:=coalesce(p_run->'quest_context','{}'::jsonb); completions jsonb:='[]'::jsonb; event jsonb; events jsonb; abilities integer; bosses integer;
  xpbase integer; meaningful boolean; drop jsonb; path text;
  limitturns integer; totalenemies integer; bonus integer:=0; maxbonus integer; today date:=(now() at time zone 'UTC')::date; streak integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null then raise exception 'missing_request_id'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rune:'||uid::text,0));
  select * into receipt from rune_delve_action_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.action_kind<>'run' or receipt.action_key<>p_run then raise exception 'request_id_reused'; end if;
    return receipt.result;
  end if;
  if cls not in ('warrior','mage','rogue','cleric') or cls is null or n is null or n<1 or n>100000
    or score is null or score<0 or score>10000000 or turns is null or turns<0 or turns>1000
    or damage is null or damage<0 or damage>10000000 or chain is null or chain<0 or chain>25
    or hp is null or hp<0 or hp>10000 or kills is null or kills<0 or kills>10000 then raise exception 'invalid_run'; end if;
  if not exists(select 1 from rune_delve_levels where id=lid and level_number=n) then raise exception 'Chamber is unavailable. Please reload.'; end if;
  select * into strict hero from rune_delve_heroes where user_id=uid for update;
  insert into rune_delve_class_progress(user_id,class) values(uid,cls) on conflict(user_id,class) do nothing;
  select * into strict track from rune_delve_class_progress where user_id=uid and class=cls for update;
  if n>track.highest_unlocked_level then raise exception 'Level is still locked'; end if;
  select * into old from rune_delve_runs where user_id=uid and level_id=lid and hero_class=cls for update;
  newbest:=old.id is null or score>old.score;
  firstclear:=cleared and not coalesce(old.dungeon_cleared,false);
  betterchain:=chain>coalesce(old.longest_chain,0);
  betterturns:=cleared and (old.best_turns_used is null or turns<old.best_turns_used);
  betterhp:=cleared and hp>coalesce(old.best_hp_remaining,0);
  limitturns:=greatest(3,least(500,coalesce((context->>'turn_limit')::integer,18)));
  totalenemies:=greatest(1,least(1000,coalesce((context->>'total_enemies')::integer,1)));
  if not cleared then select coalesce((select failure_count from rune_delve_failure_rewards where user_id=uid and level_number=n and hero_class=cls),0)+1 into failcount; end if;
  enemyprogress:=least(1,kills::numeric/totalenemies); turnprogress:=least(1,turns::numeric/limitturns);
  bossprogress:=case when coalesce((context->>'boss_rule')::boolean,false) then greatest(0,least(3,coalesce((context->>'boss_phase_reached')::integer,0)))::numeric/3 else 0 end;
  progress:=0.4+0.6*(enemyprogress*case when coalesce((context->>'boss_rule')::boolean,false) then 0.4 else 0.8 end+bossprogress*0.4+turnprogress*0.2);
  xpbase:=30+floor(greatest(0,least(150,n)-50)*1.2)::integer+least(10,score/1000);
  meaningful:=cleared or(damage>0 and(turns>=2 or kills>0));
  xp:=case when not meaningful then 0
    when firstclear then xpbase+case when n%25=0 then 25 else 0 end
    when cleared then greatest(8,least(45,round(xpbase*0.25)::integer))+least(20,greatest(0,score-coalesce(old.score,score))/100)
    else greatest(1,round(xpbase*0.2*progress*case failcount when 1 then 1 when 2 then 0.7 when 3 then 0.5 when 4 then 0.3 else 0.15 end)::integer) end;
  if old.id is null then
    insert into rune_delve_runs(user_id,level_id,level_number,hero_class,score,enemies_defeated,dungeon_cleared,turns_used,total_damage,longest_chain,hp_remaining,xp_earned,ability_used,attempts,clears,best_turns_used,best_hp_remaining,last_played_at)
    values(uid,lid,n,cls,score,kills,cleared,turns,damage,chain,hp,xp,coalesce((p_run->>'ability_used')::boolean,false),1,case when cleared then 1 else 0 end,case when cleared then turns else null end,case when cleared then hp else 0 end,now()) returning * into saved;
  else
    update rune_delve_runs set
      score=greatest(old.score,score),enemies_defeated=greatest(old.enemies_defeated,kills),dungeon_cleared=old.dungeon_cleared or cleared,
      turns_used=case when newbest then turns else old.turns_used end,total_damage=greatest(old.total_damage,damage),
      longest_chain=greatest(old.longest_chain,chain),hp_remaining=case when newbest then hp else old.hp_remaining end,
      xp_earned=greatest(old.xp_earned,xp),ability_used=old.ability_used or coalesce((p_run->>'ability_used')::boolean,false),
      attempts=old.attempts+1,clears=old.clears+case when cleared then 1 else 0 end,
      best_turns_used=case when betterturns then turns else old.best_turns_used end,
      best_hp_remaining=greatest(old.best_hp_remaining,case when cleared then hp else 0 end),last_played_at=now()
    where id=old.id returning * into saved;
  end if;
  oldlevel:=track.level; remaining:=track.xp+xp;
  newlevel:=greatest(track.level,rune_delve_level_from_xp(remaining));
  title:=coalesce(rune_delve_class_title(cls,newlevel),track.cosmetic_title);
  newcampaign:=cleared and n>track.highest_completed_level;
  update rune_delve_class_progress set xp=track.xp+xp,level=newlevel,cosmetic_title=title,
    lifetime_runs=track.lifetime_runs+1,lifetime_score=track.lifetime_score+score,
    highest_unlocked_level=greatest(track.highest_unlocked_level,case when cleared then n+1 else 1 end),
    highest_completed_level=greatest(track.highest_completed_level,case when cleared then n else 0 end),
    total_levels_cleared=track.total_levels_cleared+case when newcampaign then 1 else 0 end,
    current_chapter=((greatest(track.highest_unlocked_level,case when cleared then n+1 else 1 end)-1)/50)+1
  where id=track.id;
  if cleared then
    insert into rune_delve_progress(user_id,highest_unlocked_level,highest_completed_level,total_levels_cleared,current_chapter)
    values(uid,n+1,n,case when newcampaign then 1 else 0 end,(n/50)+1)
    on conflict(user_id) do update set highest_unlocked_level=greatest(rune_delve_progress.highest_unlocked_level,n+1),
      highest_completed_level=greatest(rune_delve_progress.highest_completed_level,n),
      total_levels_cleared=rune_delve_progress.total_levels_cleared+case when newcampaign then 1 else 0 end,
      current_chapter=((greatest(rune_delve_progress.highest_unlocked_level,n+1)-1)/50)+1;
  end if;
  streak:=case when hero.last_run_date=today then hero.current_streak when hero.last_run_date=today-1 then hero.current_streak+1 else 1 end;
  update rune_delve_heroes set xp=case when class=cls then track.xp+xp else rune_delve_heroes.xp end,
    level=case when class=cls then newlevel else rune_delve_heroes.level end,
    cosmetic_title=case when class=cls then title else rune_delve_heroes.cosmetic_title end,
    lifetime_runs=hero.lifetime_runs+1,lifetime_score=hero.lifetime_score+score,current_streak=streak,best_streak=greatest(hero.best_streak,streak),last_run_date=today where user_id=uid;
  -- Compute the base reward from stored ownership, first-clear and failure
  -- state. Combat is still the existing client simulation; bounded pickups
  -- are telemetry, never an arbitrary wallet amount supplied by the client.
  select (array[1.15,1.18,1.21,1.24,1.27])[greatest(1,least(5,r.rank))] into compass
    from rune_delve_relic_unlocks r join rune_delve_loadouts l on l.user_id=r.user_id and l.class=cls
    where r.user_id=uid and r.relic_id='wanderers_compass' and r.relic_id in(l.slot_1,l.slot_2,l.slot_3);
  compass:=coalesce(compass,1);
  limitturns:=greatest(3,least(500,coalesce((context->>'turn_limit')::integer,18)));
  totalenemies:=greatest(1,least(1000,coalesce((context->>'total_enemies')::integer,1)));
  if cleared then
    base:=case when firstclear then 10+n+case when n<=15 then 5 else 0 end else 6+n/5 end;
    if n%25=0 then base:=base+case when firstclear then 50 else 8 end; end if;
    if firstclear and n%50=0 then base:=base+200; end if;
    shards:=greatest(1,round(base*compass)::integer);
    insert into rune_delve_failure_rewards(user_id,level_number,hero_class,failure_count,last_awarded_at) values(uid,n,cls,0,now())
      on conflict(user_id,level_number,hero_class) do update set failure_count=0,last_awarded_at=now();
  else
    insert into rune_delve_failure_rewards(user_id,level_number,hero_class,failure_count,last_awarded_at) values(uid,n,cls,1,now())
      on conflict(user_id,level_number,hero_class) do update set failure_count=rune_delve_failure_rewards.failure_count+1,last_awarded_at=now() returning failure_count into failcount;
    enemyprogress:=least(1,kills::numeric/totalenemies); turnprogress:=least(1,turns::numeric/limitturns);
    bossprogress:=case when coalesce((context->>'boss_rule')::boolean,false)
      then greatest(0,least(3,coalesce((context->>'boss_phase_reached')::integer,0)))::numeric/3 else 0 end;
    progress:=0.4+0.6*(enemyprogress*case when coalesce((context->>'boss_rule')::boolean,false) then 0.4 else 0.8 end+bossprogress*0.4+turnprogress*0.2);
    base:=greatest(1,round((10+n+case when n<=15 then 5 else 0 end)*0.2*progress)::integer);
    shards:=greatest(1,round(base*compass*case failcount when 1 then 1 when 2 then 0.7 when 3 then 0.5 when 4 then 0.3 else 0.15 end)::integer);
  end if;
  path:=case when n>1 and(n%10=0 or n%50=1) and context->>'path' in('treasure','elite') then context->>'path' else 'standard' end;
  pathmult:=case path when 'treasure' then 1.25 when 'elite' then 1.5 else 1 end;
  shards:=round(shards*pathmult)::integer;
  -- Finite authored coordinates, paid once. Reported turn counts cannot
  -- expand this budget; cached clients are safely capped to the new budget.
  maxbonus:=rune_delve_treasure_cells(n,path)*least(3,((n-1)/50)+1)*case when n>10 or path='treasure' then 3 else 1 end;
  bonus:=greatest(0,least(maxbonus,coalesce((context->>'treasure_shards')::integer,0)));
  if not cleared then bonus:=round(bonus*case failcount when 1 then 1 when 2 then 0.7 when 3 then 0.5 when 4 then 0.3 else 0.15 end)::integer; end if;
  if cls='rogue' and oldlevel>=75 then bonus:=bonus+greatest(0,least(turns*2+2,coalesce((context->>'mastery_shards')::integer,0))); end if;
  if cleared and coalesce((context->>'secondary_met')::boolean,false) then bonus:=bonus+10; end if;
  shards:=shards+bonus;
  select greatest(2,case when greatest(newlevel,coalesce(max(level),1))>=25 then 3 else 2 end) into slots from rune_delve_class_progress where user_id=uid;
  insert into rune_delve_wallet(user_id,shards,lifetime_shards_earned,slots_unlocked) values(uid,shards,shards,slots)
    on conflict(user_id) do update set shards=rune_delve_wallet.shards+excluded.shards,
      lifetime_shards_earned=rune_delve_wallet.lifetime_shards_earned+excluded.lifetime_shards_earned,
      slots_unlocked=greatest(rune_delve_wallet.slots_unlocked,excluded.slots_unlocked) returning rune_delve_wallet.slots_unlocked into slots;
  -- Quest sources are server-only. Cached direct reports are denied, so
  -- legacy settlements receive the same bounded default source events.
  perform public.rune_delve_assign_quests();
  -- The gameplay events and acknowledgement commit or roll back together.
    abilities:=case when coalesce((p_run->>'ability_used')::boolean,false)
      then greatest(1,least(1000,coalesce((questcontext->>'abilities_used')::integer,1))) else 0 end;
    bosses:=greatest(0,least(kills,coalesce((questcontext->>'bosses_defeated')::integer,0)));
    events:=jsonb_build_array(
      jsonb_build_object('type','enemies_defeated','amount',kills),
      jsonb_build_object('type','longest_chain','amount',chain,'meta',jsonb_build_object('chainLength',chain)),
      jsonb_build_object('type','total_score','amount',score),
      jsonb_build_object('type','class_run_complete','amount',1),
      jsonb_build_object('type','shards_earned','amount',shards),
      jsonb_build_object('type','class_xp_earned','amount',xp),
      jsonb_build_object('type','abilities_used','amount',abilities),
      jsonb_build_object('type','bosses_defeated','amount',bosses,'meta',jsonb_build_object('isBoss',true)));
    if cleared then
      events:=events||jsonb_build_array(
        jsonb_build_object('type','levels_cleared','amount',1),
        jsonb_build_object('type','high_level_clears','amount',1,'meta',jsonb_build_object('levelNumber',n)));
      if coalesce((questcontext->>'no_damage_clear')::boolean,false) then
        events:=events||jsonb_build_array(jsonb_build_object('type','no_damage_clear','amount',1));
      end if;
    end if;
    for event in select value from jsonb_array_elements(events) loop
      completions:=completions||public.rune_delve_report_quest(event||jsonb_build_object('heroClass',cls));
    end loop;
  if cleared then drop:=public.rune_delve_roll_drop(uid,n,path,p_request_id); end if;
  result:=jsonb_build_object('row',to_jsonb(saved),'wasNewBest',newbest,'firstClear',firstclear,'improvedChain',betterchain,'improvedTurns',betterturns,'improvedHp',betterhp,
    'shardsAwarded',shards,'xpAwarded',xp,'previousClassLevel',oldlevel,'classLevel',newlevel,'classXp',track.xp+xp,'cosmeticTitle',title,'slotsUnlocked',slots,'completedQuests',completions,'relicDrop',drop);
  insert into rune_delve_action_receipts(user_id,request_id,action_kind,action_key,result) values(uid,p_request_id,'run',p_run,result);
  return result;
end $fn$;

create or replace function public.rune_delve_ensure_level(p_definition jsonb)
returns public.rune_delve_levels language plpgsql security definer set search_path=public,pg_temp as $fn$
#variable_conflict use_variable
declare uid uuid:=auth.uid(); n integer:=(p_definition->>'level_number')::integer; row public.rune_delve_levels;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if n is null or n<1 or n>100000 then raise exception 'invalid_level'; end if;
  select * into row from rune_delve_levels where level_number=n;
  if found then return row; end if;
  insert into rune_delve_levels(level_number,chapter,difficulty_tier,generation_seed,board_size,enemy_config,turn_limit,objective_type,objective_target,modifiers)
  values(n,((n-1)/50)+1,greatest(1,least(10000,coalesce((p_definition->>'difficulty_tier')::integer,1))),
    coalesce((p_definition->>'generation_seed')::bigint,n::bigint),5,
    coalesce(p_definition->'enemy_config','[]'::jsonb),greatest(3,least(500,coalesce((p_definition->>'turn_limit')::integer,18))),
    coalesce(p_definition->>'objective_type','defeat_all'),greatest(0,coalesce((p_definition->>'objective_target')::integer,0)),coalesce(p_definition->'modifiers','{}'::jsonb))
  on conflict(level_number) do nothing;
  select * into strict row from rune_delve_levels where level_number=n;
  return row;
end $fn$;

alter table public.rune_delve_daily_runs add column if not exists reward_shards_awarded integer;
alter table public.rune_delve_daily_runs add column if not exists reward_xp_awarded integer;
alter table public.rune_delve_daily_runs add column if not exists completion_reported boolean;

create or replace function public.rune_delve_daily_reward(p_kills integer)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
  select jsonb_build_object('shards',case when p_kills>=30 then 900 when p_kills>=22 then 600 when p_kills>=15 then 400 when p_kills>=10 then 250 when p_kills>=6 then 150 when p_kills>=3 then 75 when p_kills>=1 then 25 else 0 end,
    'xp',least(500,greatest(0,p_kills)*10),'title',case when p_kills>=30 then 'Eternal' when p_kills>=22 then 'Endless Conqueror' else null end)
$$;

create or replace function public.rune_delve_save_daily(p_kills integer,p_score integer,p_class text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare
  uid uuid:=auth.uid(); today date:=(now() at time zone 'UTC')::date; old rune_delve_daily_runs; receipt rune_delve_action_receipts;
  result jsonb; progression jsonb; action jsonb; reward jsonb; firstattempt boolean; paidshards integer; paidxp integer; receiptcount integer;
  shards integer; xp integer; bestkills integer; bestscore integer; stars integer; previouskills integer;
  streak rune_delve_daily_streaks; nextstreak integer; completionreported boolean; firstmeaningful boolean;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null then raise exception 'missing_request_id'; end if;
  if p_kills is null or p_kills<0 or p_kills>10000 or p_score is null or p_score<0 or p_score>10000000 or p_class is null or p_class not in('warrior','mage','rogue','cleric') then raise exception 'invalid_daily'; end if;
  action:=jsonb_build_object('kills',p_kills,'score',p_score,'class',p_class);
  perform pg_advisory_xact_lock(hashtextextended('rune:'||uid::text,0));
  select * into receipt from rune_delve_action_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.action_kind<>'daily' or receipt.action_key<>action then raise exception 'request_id_reused'; end if;
    return receipt.result;
  end if;
  if not exists(select 1 from rune_delve_heroes where user_id=uid) then raise exception 'Create a hero first'; end if;
  perform rune_delve_bootstrap(p_class,null,false);
  select * into old from rune_delve_daily_runs where user_id=uid and daily_date=today for update;
  firstattempt:=old.id is null; previouskills:=coalesce(old.kills_count,0);
  completionreported:=coalesce(old.completion_reported,not firstattempt);
  bestkills:=greatest(previouskills,p_kills);
  bestscore:=case when firstattempt or p_kills>previouskills or(p_kills=previouskills and p_score>old.score) then p_score else old.score end;
  reward:=rune_delve_daily_reward(bestkills);
  firstmeaningful:=bestkills>0 and not completionreported;
  if firstattempt then paidshards:=0; paidxp:=0;
  elsif old.reward_shards_awarded is not null and old.reward_xp_awarded is not null then
    paidshards:=old.reward_shards_awarded; paidxp:=old.reward_xp_awarded;
  else
    -- Existing paid receipts are evidence. For older unreceipted records,
    -- assume the recorded tier was paid rather than minting it a second time.
    select count(*),coalesce(sum((r.result->'reward'->>'shards')::integer),0),coalesce(sum((r.result->'reward'->>'xp')::integer),0)
      into receiptcount,paidshards,paidxp from rune_delve_action_receipts r
      where r.user_id=uid and r.action_kind='daily' and r.result->>'dateStr'=today::text;
    if receiptcount=0 then
      paidshards:=case when previouskills>=50 then 900 when previouskills>=30 then 600 when previouskills>=20 then 400 when previouskills>=15 then 250 when previouskills>=10 then 150 when previouskills>=5 then 75 else 25 end;
      paidxp:=(rune_delve_daily_reward(previouskills)->>'xp')::integer;
    end if;
  end if;
  shards:=greatest(0,(reward->>'shards')::integer-paidshards);
  xp:=greatest(0,(reward->>'xp')::integer-paidxp);
  stars:=case when bestkills>=16 then 3 when bestkills>=8 then 2 when bestkills>=3 then 1 else 0 end;
  insert into rune_delve_daily_runs(user_id,daily_date,score,stars,dungeon_cleared,modifiers,hero_class,kills_count,completed_at,reward_shards_awarded,reward_xp_awarded,completion_reported)
    values(uid,today,bestscore,stars,false,'[]'::jsonb,case when firstattempt or p_kills>=previouskills then p_class else old.hero_class end,bestkills,now(),paidshards+shards,paidxp+xp,completionreported or bestkills>0)
    on conflict(user_id,daily_date) do update set score=excluded.score,stars=excluded.stars,hero_class=excluded.hero_class,kills_count=excluded.kills_count,
      completed_at=excluded.completed_at,reward_shards_awarded=excluded.reward_shards_awarded,reward_xp_awarded=excluded.reward_xp_awarded,completion_reported=excluded.completion_reported;
  progression:=rune_delve_credit_xp(uid,p_class,xp);
  if shards>0 then update rune_delve_wallet set shards=rune_delve_wallet.shards+shards,lifetime_shards_earned=lifetime_shards_earned+shards where user_id=uid; end if;
  if firstmeaningful then
    update rune_delve_class_progress set lifetime_runs=lifetime_runs+1,lifetime_score=lifetime_score+p_score where user_id=uid and class=p_class;
    update rune_delve_heroes set lifetime_runs=lifetime_runs+1,lifetime_score=lifetime_score+p_score where user_id=uid;
  end if;
  perform rune_delve_assign_quests();
  if firstmeaningful then
    perform rune_delve_report_quest(jsonb_build_object('type','daily_challenges_completed','amount',1,'heroClass',p_class));
    perform rune_delve_report_quest(jsonb_build_object('type','class_run_complete','amount',1,'heroClass',p_class));
  end if;
  if bestkills>previouskills then perform rune_delve_report_quest(jsonb_build_object('type','enemies_defeated','amount',bestkills-previouskills,'heroClass',p_class)); end if;
  if bestscore>coalesce(old.score,0) then perform rune_delve_report_quest(jsonb_build_object('type','total_score','amount',bestscore-coalesce(old.score,0),'heroClass',p_class)); end if;
  if shards>0 then perform rune_delve_report_quest(jsonb_build_object('type','shards_earned','amount',shards,'heroClass',p_class)); end if;
  if xp>0 then perform rune_delve_report_quest(jsonb_build_object('type','class_xp_earned','amount',xp,'heroClass',p_class)); end if;
  if bestkills>=3 then
    select * into streak from rune_delve_daily_streaks where user_id=uid for update;
    nextstreak:=case when streak.last_completed_date=today then streak.current_streak when streak.last_completed_date=today-1 then streak.current_streak+1 else 1 end;
    insert into rune_delve_daily_streaks(user_id,current_streak,best_streak,last_completed_date,lifetime_clears)
      values(uid,nextstreak,greatest(coalesce(streak.best_streak,0),nextstreak),today,coalesce(streak.lifetime_clears,0)+case when streak.last_completed_date=today then 0 else 1 end)
      on conflict(user_id) do update set current_streak=excluded.current_streak,best_streak=excluded.best_streak,last_completed_date=excluded.last_completed_date,lifetime_clears=excluded.lifetime_clears;
  end if;
  result:=progression||jsonb_build_object('stars',stars,'reward',jsonb_build_object('shards',shards,'xp',xp,'title',reward->'title'),
    'dateStr',today::text,'kills',p_kills,'rewarded',shards>0 or xp>0,'firstAttempt',firstattempt,'firstMeaningfulAttempt',firstmeaningful,'previousBestKills',previouskills,'bestKills',bestkills,
    'improvedReward',not firstattempt and(shards>0 or xp>0),'dailyRewardTotal',jsonb_build_object('shards',paidshards+shards,'xp',paidxp+xp));
  insert into rune_delve_action_receipts(user_id,request_id,action_kind,action_key,result) values(uid,p_request_id,'daily',action,result);
  return result;
end $$;

alter table public.rune_delve_expedition_runs add column if not exists xp_awarded integer not null default 0;
alter table public.rune_delve_expedition_runs add column if not exists settlement jsonb;

create or replace function public.rune_delve_expedition_finish(p_id uuid,p_rooms integer,p_score integer,p_turns integer,p_cleared boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare uid uuid:=auth.uid(); run rune_delve_expedition_runs; progress rune_delve_expedition_progress; reward integer; xp integer; classprogress jsonb; result jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rune:'||uid::text,0));
  select * into run from rune_delve_expedition_runs where id=p_id for update;
  if not found or run.user_id<>uid then raise exception 'expedition_not_found'; end if;
  if not exists(select 1 from club_members where user_id=uid and club_id=run.club_id) then raise exception 'club_membership_required'; end if;
  if run.status='abandoned' then raise exception 'expedition_was_replaced'; end if;
  if run.status='banked' then
    if run.settlement is not null then return run.settlement; end if;
    select * into progress from rune_delve_expedition_progress where user_id=uid and club_id=run.club_id;
    return jsonb_build_object('reward',run.reward,'xpAwarded',run.xp_awarded,'rooms',run.rooms,'cleared',run.cleared,'highest_ascension',coalesce(progress.highest_ascension,0),'best_score',coalesce(progress.best_score,0));
  end if;
  if p_rooms is null or p_rooms not between 0 and 6 or p_score is null or p_score not between 0 and 250000 or p_turns is null or p_turns not between 0 and 180 or p_turns<p_rooms or p_cleared is null or p_cleared<>(p_rooms=6) then raise exception 'invalid_expedition_result'; end if;
  if p_rooms>0 and p_score=0 then raise exception 'invalid_expedition_score'; end if;
  reward:=p_rooms*(12+run.ascension*2)+case when p_cleared then 40+run.ascension*6 else 0 end;
  xp:=reward;
  classprogress:=rune_delve_credit_xp(uid,run.hero_class,xp);
  insert into rune_delve_expedition_progress(user_id,club_id,highest_ascension,best_score,total_runs,total_clears)
    values(uid,run.club_id,case when p_cleared then least(7,run.ascension+1) else 0 end,p_score,1,case when p_cleared then 1 else 0 end)
    on conflict(user_id,club_id) do update set highest_ascension=greatest(rune_delve_expedition_progress.highest_ascension,excluded.highest_ascension),
      best_score=greatest(rune_delve_expedition_progress.best_score,excluded.best_score),total_runs=rune_delve_expedition_progress.total_runs+1,
      total_clears=rune_delve_expedition_progress.total_clears+excluded.total_clears,updated_at=now() returning * into progress;
  if reward>0 then
    update rune_delve_wallet set shards=shards+reward,lifetime_shards_earned=lifetime_shards_earned+reward where user_id=uid;
    update rune_delve_class_progress set lifetime_runs=lifetime_runs+1,lifetime_score=lifetime_score+p_score where user_id=uid and class=run.hero_class;
    update rune_delve_heroes set lifetime_runs=lifetime_runs+1,lifetime_score=lifetime_score+p_score where user_id=uid;
  end if;
  perform rune_delve_assign_quests();
  if reward>0 then
    perform rune_delve_report_quest(jsonb_build_object('type','shards_earned','amount',reward,'heroClass',run.hero_class));
    perform rune_delve_report_quest(jsonb_build_object('type','class_xp_earned','amount',xp,'heroClass',run.hero_class));
    perform rune_delve_report_quest(jsonb_build_object('type','class_run_complete','amount',1,'heroClass',run.hero_class));
  end if;
  if p_score>0 then perform rune_delve_report_quest(jsonb_build_object('type','total_score','amount',p_score,'heroClass',run.hero_class)); end if;
  if p_cleared then perform rune_delve_report_quest(jsonb_build_object('type','bosses_defeated','amount',1,'heroClass',run.hero_class,'meta',jsonb_build_object('isBoss',true))); end if;
  result:=classprogress||jsonb_build_object('reward',reward,'xpAwarded',xp,'rooms',p_rooms,'cleared',p_cleared,'highest_ascension',progress.highest_ascension,'best_score',progress.best_score);
  update rune_delve_expedition_runs set status='banked',rooms=p_rooms,score=p_score,turns=p_turns,cleared=p_cleared,reward=reward,xp_awarded=xp,settlement=result,finished_at=now() where id=p_id;
  return result;
end $$;

-- Source functions own all RPG value mutations. Keep existing read/privacy
-- policies, including current-club standings and account-owned saves.
do $permissions$
declare item record; columns text;
begin
  for item in select unnest(array['rune_delve_wallet','rune_delve_relic_unlocks','rune_delve_class_progress','rune_delve_progress','rune_delve_runs','rune_delve_daily_runs','rune_delve_daily_streaks','rune_delve_failure_rewards','rune_delve_loadouts','rune_delve_active_quests','rune_delve_quest_definitions','rune_delve_heroes']) as name loop
    execute format('revoke insert,update,delete,truncate,references,trigger on public.%I from public,anon,authenticated',item.name);
    select string_agg(quote_ident(attname),',') into columns from pg_attribute where attrelid=('public.'||item.name)::regclass and attnum>0 and not attisdropped;
    execute format('revoke insert(%s),update(%s),references(%s) on public.%I from public,anon,authenticated',columns,columns,columns,item.name);
  end loop;
  -- Keep the existing owner UPDATE policy, granting only the cosmetic column.
  grant update(hero_name) on public.rune_delve_heroes to authenticated;
  for item in select schemaname,tablename,policyname from pg_policies where schemaname='public'
    and tablename in('rune_delve_wallet','rune_delve_relic_unlocks','rune_delve_class_progress','rune_delve_progress','rune_delve_runs','rune_delve_daily_runs','rune_delve_daily_streaks','rune_delve_failure_rewards','rune_delve_loadouts','rune_delve_active_quests','rune_delve_quest_definitions')
    and permissive='PERMISSIVE' and cmd in('INSERT','UPDATE','DELETE') loop
    execute format('drop policy %I on %I.%I',item.policyname,item.schemaname,item.tablename);
  end loop;
  if to_regprocedure('public.rune_delve_earn_shards(integer)') is not null then execute 'revoke all on function public.rune_delve_earn_shards(integer) from public,anon,authenticated'; end if;
  if to_regprocedure('public.rune_delve_spend_shards(integer)') is not null then execute 'revoke all on function public.rune_delve_spend_shards(integer) from public,anon,authenticated'; end if;
end $permissions$;
revoke all on function public.rune_delve_report_quest(jsonb) from public,anon,authenticated;
revoke all on function public.rune_delve_bootstrap(text,text,boolean),public.rune_delve_select_class(text),public.rune_delve_assign_quests(),public.rune_delve_save_run(jsonb,uuid),public.rune_delve_save_daily(integer,integer,text,uuid),public.rune_delve_expedition_finish(uuid,integer,integer,integer,boolean) from public,anon;
grant execute on function public.rune_delve_bootstrap(text,text,boolean),public.rune_delve_select_class(text),public.rune_delve_assign_quests(),public.rune_delve_save_run(jsonb,uuid),public.rune_delve_save_daily(integer,integer,text,uuid),public.rune_delve_expedition_finish(uuid,integer,integer,integer,boolean) to authenticated;

-- Equipment slot entitlement derives from canonical tracks, never a client PATCH.
create or replace function public.rune_delve_equip(p_class text,p_slot_1 text,p_slot_2 text,p_slot_3 text)
returns public.rune_delve_loadouts language plpgsql security definer set search_path=public,pg_temp as $fn$
declare uid uuid:=auth.uid(); slots text[]:=array_remove(array[p_slot_1,p_slot_2,p_slot_3],null); row rune_delve_loadouts;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_class is null or p_class not in('warrior','mage','rogue','cleric') then raise exception 'Invalid class'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rune:'||uid::text,0));
  if cardinality(slots)<>(select count(distinct item) from unnest(slots) item) then raise exception 'Each relic can only be equipped once.'; end if;
  perform public.rune_delve_bootstrap(p_class,null,false);
  if p_slot_3 is not null and coalesce((select slots_unlocked from rune_delve_wallet where user_id=uid),2)<3 then raise exception 'Third relic slot is still locked'; end if;
  if exists(select 1 from unnest(slots) item where not exists(select 1 from rune_delve_relic_unlocks where user_id=uid and relic_id=item)) then raise exception 'Unlock a relic before equipping it'; end if;
  insert into rune_delve_loadouts(user_id,class,slot_1,slot_2,slot_3) values(uid,p_class,p_slot_1,p_slot_2,p_slot_3)
    on conflict(user_id,class) do update set slot_1=excluded.slot_1,slot_2=excluded.slot_2,slot_3=excluded.slot_3 returning * into row;
  return row;
end $fn$;
revoke all on function public.rune_delve_equip(text,text,text,text) from public,anon;
grant execute on function public.rune_delve_equip(text,text,text,text) to authenticated;

commit;
