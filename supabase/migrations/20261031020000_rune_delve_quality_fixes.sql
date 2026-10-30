-- Rune Delve quality fixes: preserve account progress and acknowledged receipts.
-- Campaign quest sources now commit with their run; boss failures include
-- the same bounded phase progress used by the reward preview.
begin;

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
  limitturns integer; totalenemies integer; bonus integer:=0; maxbonus integer; today date:=(now() at time zone 'UTC')::date; streak integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null then raise exception 'missing_request_id'; end if;
  if cls not in ('warrior','mage','rogue','cleric') or cls is null or n is null or n<1 or n>100000
    or score is null or score<0 or score>10000000 or turns is null or turns<0 or turns>1000
    or damage is null or damage<0 or damage>10000000 or chain is null or chain<0 or chain>25
    or hp is null or hp<0 or hp>10000 or kills is null or kills<0 or kills>10000 then raise exception 'invalid_run'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rune:'||uid::text,0));
  select * into receipt from rune_delve_action_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.action_kind<>'run' or receipt.action_key<>p_run then raise exception 'request_id_reused'; end if;
    return receipt.result;
  end if;
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
  xp:=case when newbest then least(120,score/30)+case when cleared then 20 else 0 end else 0 end;
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
  while remaining>=100+(newlevel-1)*50 and newlevel<150 loop remaining:=remaining-(100+(newlevel-1)*50); newlevel:=newlevel+1; end loop;
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
    base:=case when firstclear then 10+n+case when n<=15 then 5 else 0 end else 3+n/10 end;
    if n%25=0 then base:=base+50; end if;
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
  pathmult:=case context->>'path' when 'treasure' then 1.25 when 'elite' then 1.5 else 1 end;
  shards:=round(shards*pathmult)::integer;
  -- Current chamber catalog has at most four persistent treasure cells.
  -- Each can pay 5 shards, tripled by Treasure Hunter. At most one bonus
  -- chain occurs per enemy cycle; +2 covers a final clear before endTurn.
  maxbonus:=(turns*2+2)*4*5*3;
  bonus:=greatest(0,least(maxbonus,coalesce((context->>'treasure_shards')::integer,0)));
  if cls='rogue' and oldlevel>=75 then bonus:=bonus+greatest(0,least(turns*2+2,coalesce((context->>'mastery_shards')::integer,0))); end if;
  if cleared and coalesce((context->>'secondary_met')::boolean,false) then bonus:=bonus+10; end if;
  shards:=shards+bonus;
  select greatest(2,case when greatest(newlevel,coalesce(max(level),1))>=25 then 3 else 2 end) into slots from rune_delve_class_progress where user_id=uid;
  insert into rune_delve_wallet(user_id,shards,lifetime_shards_earned,slots_unlocked) values(uid,shards,shards,slots)
    on conflict(user_id) do update set shards=rune_delve_wallet.shards+excluded.shards,
      lifetime_shards_earned=rune_delve_wallet.lifetime_shards_earned+excluded.lifetime_shards_earned,
      slots_unlocked=greatest(rune_delve_wallet.slots_unlocked,excluded.slots_unlocked) returning slots_unlocked into slots;
  -- Only clients explicitly handing quest reporting to this transaction
  -- send quest_context. Cached older clients still report their own events
  -- after settlement, so producing them here too would count twice.
  if jsonb_typeof(p_run->'quest_context')='object' then
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
  end if;
  result:=jsonb_build_object('row',to_jsonb(saved),'wasNewBest',newbest,'firstClear',firstclear,'improvedChain',betterchain,'improvedTurns',betterturns,'improvedHp',betterhp,
    'shardsAwarded',shards,'xpAwarded',xp,'previousClassLevel',oldlevel,'classLevel',newlevel,'classXp',track.xp+xp,'cosmeticTitle',title,'slotsUnlocked',slots,'completedQuests',completions);
  insert into rune_delve_action_receipts(user_id,request_id,action_kind,action_key,result) values(uid,p_request_id,'run',p_run,result);
  return result;
end $fn$;


revoke all on function public.rune_delve_save_run(jsonb,uuid) from public,anon;
grant execute on function public.rune_delve_save_run(jsonb,uuid) to authenticated;


-- These saves are account-wide, while new source rows must inherit the
-- member's club instead of the historical fixed club default. Existing rows
-- and balances stay untouched. Own reads survive a club transfer, and shared
-- standings follow current membership rather than a row's original club.
alter table if exists public.rune_delve_active_quests alter column club_id set default coalesce(public.current_user_club_id(),'11111111-1111-1111-1111-111111111111'::uuid);
alter table if exists public.rune_delve_bestiary alter column club_id set default coalesce(public.current_user_club_id(),'11111111-1111-1111-1111-111111111111'::uuid);
alter table if exists public.rune_delve_class_progress alter column club_id set default coalesce(public.current_user_club_id(),'11111111-1111-1111-1111-111111111111'::uuid);
alter table if exists public.rune_delve_daily_runs alter column club_id set default coalesce(public.current_user_club_id(),'11111111-1111-1111-1111-111111111111'::uuid);
alter table if exists public.rune_delve_daily_streaks alter column club_id set default coalesce(public.current_user_club_id(),'11111111-1111-1111-1111-111111111111'::uuid);
alter table if exists public.rune_delve_failure_rewards alter column club_id set default coalesce(public.current_user_club_id(),'11111111-1111-1111-1111-111111111111'::uuid);
alter table if exists public.rune_delve_heroes alter column club_id set default coalesce(public.current_user_club_id(),'11111111-1111-1111-1111-111111111111'::uuid);
alter table if exists public.rune_delve_loadouts alter column club_id set default coalesce(public.current_user_club_id(),'11111111-1111-1111-1111-111111111111'::uuid);
alter table if exists public.rune_delve_progress alter column club_id set default coalesce(public.current_user_club_id(),'11111111-1111-1111-1111-111111111111'::uuid);
alter table if exists public.rune_delve_relic_unlocks alter column club_id set default coalesce(public.current_user_club_id(),'11111111-1111-1111-1111-111111111111'::uuid);
alter table if exists public.rune_delve_runs alter column club_id set default coalesce(public.current_user_club_id(),'11111111-1111-1111-1111-111111111111'::uuid);
alter table if exists public.rune_delve_wallet alter column club_id set default coalesce(public.current_user_club_id(),'11111111-1111-1111-1111-111111111111'::uuid);

drop policy if exists "RDHeroes: club read" on public.rune_delve_heroes;
drop policy if exists "Rune account and current club read" on public.rune_delve_heroes;
create policy "Rune account and current club read" on public.rune_delve_heroes
  for select to authenticated using (
    user_id=auth.uid() or public.is_platform_owner(auth.uid()) or exists(
      select 1 from public.club_members member
      where member.user_id=rune_delve_heroes.user_id
        and member.club_id=public.current_user_club_id()
    )
  );

drop policy if exists "RDClassProgress: club read" on public.rune_delve_class_progress;
drop policy if exists "Rune account and current club read" on public.rune_delve_class_progress;
create policy "Rune account and current club read" on public.rune_delve_class_progress
  for select to authenticated using (
    user_id=auth.uid() or public.is_platform_owner(auth.uid()) or exists(
      select 1 from public.club_members member
      where member.user_id=rune_delve_class_progress.user_id
        and member.club_id=public.current_user_club_id()
    )
  );

drop policy if exists "RDProgress: club read" on public.rune_delve_progress;
drop policy if exists "Rune account and current club read" on public.rune_delve_progress;
create policy "Rune account and current club read" on public.rune_delve_progress
  for select to authenticated using (
    user_id=auth.uid() or public.is_platform_owner(auth.uid()) or exists(
      select 1 from public.club_members member
      where member.user_id=rune_delve_progress.user_id
        and member.club_id=public.current_user_club_id()
    )
  );

drop policy if exists "RDRuns: club read" on public.rune_delve_runs;
drop policy if exists "Rune account and current club read" on public.rune_delve_runs;
create policy "Rune account and current club read" on public.rune_delve_runs
  for select to authenticated using (
    user_id=auth.uid() or public.is_platform_owner(auth.uid()) or exists(
      select 1 from public.club_members member
      where member.user_id=rune_delve_runs.user_id
        and member.club_id=public.current_user_club_id()
    )
  );

drop policy if exists "RDDailyRuns: club read" on public.rune_delve_daily_runs;
drop policy if exists "Rune account and current club read" on public.rune_delve_daily_runs;
create policy "Rune account and current club read" on public.rune_delve_daily_runs
  for select to authenticated using (
    user_id=auth.uid() or public.is_platform_owner(auth.uid()) or exists(
      select 1 from public.club_members member
      where member.user_id=rune_delve_daily_runs.user_id
        and member.club_id=public.current_user_club_id()
    )
  );

commit;
