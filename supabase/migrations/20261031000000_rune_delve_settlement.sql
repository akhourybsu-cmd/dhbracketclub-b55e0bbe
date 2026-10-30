-- Rune Delve: acknowledged, atomic campaign settlement and relic purchases.
-- Existing progress and run rows are preserved; no player reset.
create table if not exists public.rune_delve_action_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  action_kind text not null,
  action_key jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id, request_id)
);
alter table public.rune_delve_action_receipts enable row level security;
drop policy if exists "Rune receipts: own read" on public.rune_delve_action_receipts;
create policy "Rune receipts: own read" on public.rune_delve_action_receipts for select to authenticated using(user_id=auth.uid());
revoke all on public.rune_delve_action_receipts from anon,authenticated;
grant select on public.rune_delve_action_receipts to authenticated;

create or replace function public.rune_delve_class_title(p_class text,p_level integer)
returns text language sql immutable set search_path=public,pg_temp as $fn$
  select entry->>'title' from jsonb_array_elements($titles${"warrior":[{"level":1,"title":"Squire of Steel"},{"level":10,"title":"Rune Sellsword"},{"level":20,"title":"Iron Delver"},{"level":30,"title":"Crypt Vanguard"},{"level":40,"title":"Shieldbearer"},{"level":50,"title":"Vaultbreaker"},{"level":60,"title":"Warden of Stone"},{"level":70,"title":"Crimson Bastion"},{"level":80,"title":"Relic Guardian"},{"level":90,"title":"Runeblade Captain"},{"level":100,"title":"Mythic Warlord"},{"level":110,"title":"Deepforge Sentinel"},{"level":120,"title":"Titan of the Vault"},{"level":130,"title":"Doomgate Marshal"},{"level":140,"title":"Ember Crown"},{"level":150,"title":"Eternal Warforged"}],"mage":[{"level":1,"title":"Candle Adept"},{"level":10,"title":"Rune Scholar"},{"level":20,"title":"Arcane Delver"},{"level":30,"title":"Sigil Weaver"},{"level":40,"title":"Vault Magus"},{"level":50,"title":"Crystal Sage"},{"level":60,"title":"Spellwarden"},{"level":70,"title":"Astral Channeler"},{"level":80,"title":"Relic Arcanist"},{"level":90,"title":"Keeper of Sigils"},{"level":100,"title":"Mythic Sorcerer"},{"level":110,"title":"Starvault Seer"},{"level":120,"title":"Archon of Runes"},{"level":130,"title":"Eclipse Magister"},{"level":140,"title":"Voidglass Oracle"},{"level":150,"title":"Eternal Archsage"}],"rogue":[{"level":1,"title":"Alley Cutpurse"},{"level":10,"title":"Shadow Initiate"},{"level":20,"title":"Rune Stalker"},{"level":30,"title":"Crypt Skirmisher"},{"level":40,"title":"Silent Fang"},{"level":50,"title":"Vault Runner"},{"level":60,"title":"Nightblade"},{"level":70,"title":"Relic Thief"},{"level":80,"title":"Veilstrider"},{"level":90,"title":"Master of Locks"},{"level":100,"title":"Mythic Shade"},{"level":110,"title":"Deep Crypt Phantom"},{"level":120,"title":"Dagger Sovereign"},{"level":130,"title":"Eclipse Stalker"},{"level":140,"title":"Whisper King"},{"level":150,"title":"Eternal Shadow"}],"cleric":[{"level":1,"title":"Shrine Acolyte"},{"level":10,"title":"Lightbearer"},{"level":20,"title":"Rune Healer"},{"level":30,"title":"Crypt Warden"},{"level":40,"title":"Sanctum Keeper"},{"level":50,"title":"Vault Priest"},{"level":60,"title":"Soul Mendicant"},{"level":70,"title":"Dawn Channeler"},{"level":80,"title":"Relic Shepherd"},{"level":90,"title":"Guardian of Grace"},{"level":100,"title":"Mythic Hierophant"},{"level":110,"title":"Deep Chapel Saint"},{"level":120,"title":"Luminary of Runes"},{"level":130,"title":"Eclipse Vicar"},{"level":140,"title":"Halo Sovereign"},{"level":150,"title":"Eternal Beacon"}]}$titles$::jsonb->p_class) entry
  where (entry->>'level')::integer<=p_level order by (entry->>'level')::integer desc limit 1
$fn$;

-- This only creates the FK identity for a deterministic client-generated
-- chamber. Gameplay fields are always regenerated/hydrated on read. An
-- existing canonical row is never changed by this RPC.
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

create or replace function public.rune_delve_buy_relic(p_relic_id text,p_expected_rank integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
#variable_conflict use_variable
declare
  uid uuid:=auth.uid(); item jsonb; owned rune_delve_relic_unlocks; receipt rune_delve_action_receipts;
  cost integer; tier integer; depth integer; result jsonb; action jsonb:=jsonb_build_object('relic',p_relic_id,'rank',p_expected_rank);
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null then raise exception 'missing_request_id'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rune:'||uid::text,0));
  select * into receipt from rune_delve_action_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.action_kind<>'relic' or receipt.action_key<>action then raise exception 'request_id_reused'; end if;
    return receipt.result;
  end if;
  select entry into item from jsonb_array_elements($catalog$[{"id":"ember_edge","tier":1,"cost":100},{"id":"aether_spark","tier":1,"cost":100},{"id":"iron_resolve","tier":1,"cost":120},{"id":"verdant_heart","tier":1,"cost":100},{"id":"keysight","tier":1,"cost":120},{"id":"quickstep","tier":1,"cost":110},{"id":"shrine_ward","tier":1,"cost":130},{"id":"wanderers_compass","tier":1,"cost":150},{"id":"mirror_shard","tier":1,"cost":140},{"id":"brambleward","tier":1,"cost":130},{"id":"crimson_tide","tier":2,"cost":280},{"id":"sapphire_flow","tier":2,"cost":300},{"id":"last_stand","tier":2,"cost":380},{"id":"cleansing_touch","tier":2,"cost":320},{"id":"momentum","tier":2,"cost":280},{"id":"foresight","tier":2,"cost":350},{"id":"bulwark","tier":2,"cost":320},{"id":"spiked_aegis","tier":2,"cost":340},{"id":"vampiric_sigil","tier":2,"cost":360},{"id":"rune_echo","tier":2,"cost":340},{"id":"executioners_mark","tier":3,"cost":600},{"id":"first_light","tier":3,"cost":650},{"id":"bloodbond","tier":3,"cost":700},{"id":"desperate_surge","tier":3,"cost":600},{"id":"cracked_crown","tier":3,"cost":750},{"id":"foreseers_lens","tier":3,"cost":700},{"id":"void_pact","tier":3,"cost":800},{"id":"phoenix_heart","tier":3,"cost":850}]$catalog$::jsonb) entry where entry->>'id'=p_relic_id;
  if item is null then raise exception 'unknown_relic'; end if;
  select * into owned from rune_delve_relic_unlocks where user_id=uid and relic_id=p_relic_id for update;
  if p_expected_rank is null and owned.id is not null then
    result:=to_jsonb(owned);
  else
    cost:=(item->>'cost')::integer; tier:=(item->>'tier')::integer;
    if p_expected_rank is null then
      select coalesce(max(cp.highest_unlocked_level),1) into depth from rune_delve_class_progress cp join rune_delve_heroes h on h.user_id=cp.user_id and h.class=cp.class where cp.user_id=uid;
      if ((depth-1)/50)+1<tier then raise exception 'Relic tier is still locked'; end if;
    else
      if owned.id is null then raise exception 'Relic not owned'; end if;
      if owned.rank<>p_expected_rank then raise exception 'Rank changed — please retry'; end if;
      if owned.rank>=5 or p_expected_rank<1 then raise exception 'Already at max rank'; end if;
      cost:=round(cost*0.6*power(2,p_expected_rank-1))::integer;
    end if;
    update rune_delve_wallet set shards=shards-cost where user_id=uid and shards>=cost;
    if not found then raise exception 'Not enough Rune Shards'; end if;
    if p_expected_rank is null then
      insert into rune_delve_relic_unlocks(user_id,relic_id,rank,acquired_at_level)
      values(uid,p_relic_id,1,coalesce((select level from rune_delve_heroes where user_id=uid),1)) returning * into owned;
    else
      update rune_delve_relic_unlocks set rank=rank+1 where id=owned.id returning * into owned;
    end if;
    result:=to_jsonb(owned);
  end if;
  insert into rune_delve_action_receipts(user_id,request_id,action_kind,action_key,result) values(uid,p_request_id,'relic',action,result);
  return result;
end $fn$;

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
  base integer; shards integer; progress numeric; enemyprogress numeric; turnprogress numeric; pathmult numeric:=1;
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
    progress:=0.4+0.6*(enemyprogress*case when coalesce((context->>'boss_rule')::boolean,false) then 0.4 else 0.8 end+turnprogress*0.2);
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
  result:=jsonb_build_object('row',to_jsonb(saved),'wasNewBest',newbest,'firstClear',firstclear,'improvedChain',betterchain,'improvedTurns',betterturns,'improvedHp',betterhp,
    'shardsAwarded',shards,'xpAwarded',xp,'previousClassLevel',oldlevel,'classLevel',newlevel,'classXp',track.xp+xp,'cosmeticTitle',title,'slotsUnlocked',slots);
  insert into rune_delve_action_receipts(user_id,request_id,action_kind,action_key,result) values(uid,p_request_id,'run',p_run,result);
  return result;
end $fn$;

revoke all on function public.rune_delve_class_title(text,integer),public.rune_delve_ensure_level(jsonb),public.rune_delve_buy_relic(text,integer,uuid),public.rune_delve_save_run(jsonb,uuid) from public,anon;
grant execute on function public.rune_delve_class_title(text,integer),public.rune_delve_ensure_level(jsonb),public.rune_delve_buy_relic(text,integer,uuid),public.rune_delve_save_run(jsonb,uuid) to authenticated;

-- Internal relative-XP helper shared by daily and quest transactions. It is
-- not callable by members; public entry points always derive user/reward.
create or replace function public.rune_delve_credit_xp(p_uid uuid,p_class text,p_xp integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
#variable_conflict use_variable
declare track rune_delve_class_progress; nextlevel integer:=1; remaining integer; title text; slots integer;
begin
  insert into rune_delve_class_progress(user_id,class) values(p_uid,p_class) on conflict(user_id,class) do nothing;
  select * into strict track from rune_delve_class_progress where user_id=p_uid and class=p_class for update;
  remaining:=track.xp+p_xp;
  while remaining>=100+(nextlevel-1)*50 and nextlevel<150 loop remaining:=remaining-(100+(nextlevel-1)*50); nextlevel:=nextlevel+1; end loop;
  title:=coalesce(rune_delve_class_title(p_class,nextlevel),track.cosmetic_title);
  update rune_delve_class_progress set xp=track.xp+p_xp,level=nextlevel,cosmetic_title=title where id=track.id;
  update rune_delve_heroes set xp=track.xp+p_xp,level=nextlevel,cosmetic_title=title where user_id=p_uid and class=p_class;
  select case when coalesce(max(level),1)>=25 then 3 else 2 end into slots from rune_delve_class_progress where user_id=p_uid;
  insert into rune_delve_wallet(user_id,slots_unlocked) values(p_uid,slots) on conflict(user_id) do update set slots_unlocked=greatest(rune_delve_wallet.slots_unlocked,excluded.slots_unlocked);
  return jsonb_build_object('previousClassLevel',track.level,'classLevel',nextlevel,'classXp',track.xp+p_xp,'cosmeticTitle',title,'slotsUnlocked',slots);
end $fn$;
revoke all on function public.rune_delve_credit_xp(uuid,text,integer) from public,anon,authenticated;

create or replace function public.rune_delve_save_daily(p_kills integer,p_score integer,p_class text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
#variable_conflict use_variable
declare
  uid uuid:=auth.uid(); today date:=(now() at time zone 'UTC')::date; old rune_delve_daily_runs; receipt rune_delve_action_receipts;
  result jsonb; progress jsonb; action jsonb; shards integer:=0; xp integer:=0; stars integer; title text; rewarded boolean;
  streak rune_delve_daily_streaks; nextstreak integer;
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
  stars:=case when p_kills>=25 then 3 when p_kills>=15 then 2 when p_kills>=5 then 1 else 0 end;
  select * into old from rune_delve_daily_runs where user_id=uid and daily_date=today for update;
  rewarded:=old.id is null;
  if rewarded or p_kills>coalesce(old.kills_count,0) or(p_kills=old.kills_count and p_score>old.score) then
    insert into rune_delve_daily_runs(user_id,daily_date,score,stars,dungeon_cleared,modifiers,hero_class,kills_count,completed_at)
    values(uid,today,p_score,stars,false,'[]'::jsonb,p_class,p_kills,now())
    on conflict(user_id,daily_date) do update set score=excluded.score,stars=excluded.stars,hero_class=excluded.hero_class,kills_count=excluded.kills_count,completed_at=now();
  end if;
  if rewarded then
    shards:=case when p_kills>=50 then 900 when p_kills>=30 then 600 when p_kills>=20 then 400 when p_kills>=15 then 250 when p_kills>=10 then 150 when p_kills>=5 then 75 else 25 end;
    xp:=least(500,p_kills*10);
    title:=case when p_kills>=50 then 'Eternal' when p_kills>=30 then 'Endless Conqueror' else null end;
    progress:=rune_delve_credit_xp(uid,p_class,xp);
    update rune_delve_class_progress set lifetime_runs=lifetime_runs+1,lifetime_score=lifetime_score+p_score where user_id=uid and class=p_class;
    update rune_delve_heroes set lifetime_runs=lifetime_runs+1,lifetime_score=lifetime_score+p_score where user_id=uid;
    update rune_delve_wallet set shards=rune_delve_wallet.shards+shards,lifetime_shards_earned=lifetime_shards_earned+shards where user_id=uid;
    -- The first acknowledged daily is the single source event for its UTC
    -- day. Better records and lost-response retries never advance quests twice.
    perform public.rune_delve_report_quest(jsonb_build_object('type','daily_challenges_completed','amount',1,'heroClass',p_class));
    perform public.rune_delve_report_quest(jsonb_build_object('type','class_run_complete','amount',1,'heroClass',p_class));
    perform public.rune_delve_report_quest(jsonb_build_object('type','enemies_defeated','amount',p_kills,'heroClass',p_class));
    perform public.rune_delve_report_quest(jsonb_build_object('type','total_score','amount',p_score,'heroClass',p_class));
    perform public.rune_delve_report_quest(jsonb_build_object('type','shards_earned','amount',shards,'heroClass',p_class));
    perform public.rune_delve_report_quest(jsonb_build_object('type','class_xp_earned','amount',xp,'heroClass',p_class));
  else
    select jsonb_build_object('previousClassLevel',level,'classLevel',level,'slotsUnlocked',(select slots_unlocked from rune_delve_wallet where user_id=uid)) into progress from rune_delve_class_progress where user_id=uid and class=p_class;
  end if;
  if p_kills>=5 then
    select * into streak from rune_delve_daily_streaks where user_id=uid for update;
    nextstreak:=case when streak.last_completed_date=today then streak.current_streak when streak.last_completed_date=today-1 then streak.current_streak+1 else 1 end;
    insert into rune_delve_daily_streaks(user_id,current_streak,best_streak,last_completed_date,lifetime_clears)
    values(uid,nextstreak,greatest(coalesce(streak.best_streak,0),nextstreak),today,coalesce(streak.lifetime_clears,0)+case when streak.last_completed_date=today then 0 else 1 end)
    on conflict(user_id) do update set current_streak=excluded.current_streak,best_streak=excluded.best_streak,last_completed_date=excluded.last_completed_date,lifetime_clears=excluded.lifetime_clears;
  end if;
  result:=coalesce(progress,'{}'::jsonb)||jsonb_build_object('stars',stars,'reward',jsonb_build_object('shards',shards,'xp',xp,'title',title),'dateStr',today::text,'kills',p_kills,'rewarded',rewarded);
  insert into rune_delve_action_receipts(user_id,request_id,action_kind,action_key,result) values(uid,p_request_id,'daily',action,result);
  return result;
end $fn$;

create or replace function public.rune_delve_claim_quest(p_quest_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
#variable_conflict use_variable
declare uid uuid:=auth.uid(); quest rune_delve_active_quests; definition rune_delve_quest_definitions; cls text; progress jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rune:'||uid::text,0));
  select * into quest from rune_delve_active_quests where id=p_quest_id and user_id=uid for update;
  if not found then raise exception 'Quest unavailable'; end if;
  select * into strict definition from rune_delve_quest_definitions where id=quest.quest_id;
  if quest.status='claimed' then return jsonb_build_object('shards',0,'xp',0,'title',definition.title,'scope',quest.scope,'alreadyClaimed',true); end if;
  if quest.status<>'completed' or quest.progress<quest.target_value then raise exception 'Quest not completed'; end if;
  select coalesce(definition.hero_class,class) into cls from rune_delve_heroes where user_id=uid;
  if cls is null then raise exception 'Create a hero first'; end if;
  progress:=rune_delve_credit_xp(uid,cls,greatest(0,definition.xp_reward));
  update rune_delve_wallet set shards=shards+greatest(0,definition.shard_reward),lifetime_shards_earned=lifetime_shards_earned+greatest(0,definition.shard_reward) where user_id=uid;
  update rune_delve_active_quests set status='claimed',claimed_at=now() where id=quest.id;
  return progress||jsonb_build_object('shards',definition.shard_reward,'xp',definition.xp_reward,'title',definition.title,'scope',quest.scope,'alreadyClaimed',false);
end $fn$;
revoke all on function public.rune_delve_save_daily(integer,integer,text,uuid),public.rune_delve_claim_quest(uuid) from public,anon;
grant execute on function public.rune_delve_save_daily(integer,integer,text,uuid),public.rune_delve_claim_quest(uuid) to authenticated;

create or replace function public.rune_delve_report_quest(p_event jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
#variable_conflict use_variable
declare uid uuid:=auth.uid(); q record; amount integer:=greatest(0,least(1000000,coalesce((p_event->>'amount')::integer,0))); delta integer; nextprogress integer; completed jsonb:='[]'::jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rune:'||uid::text,0));
  for q in select a.*,d.title,d.objective_type,d.is_personal,d.hero_class from rune_delve_active_quests a join rune_delve_quest_definitions d on d.id=a.quest_id
    where a.user_id=uid and a.status='active' and d.objective_type=p_event->>'type'
      and a.period_key in(to_char(now() at time zone 'UTC','YYYY-MM-DD'),to_char(now() at time zone 'UTC','IYYY-"W"IW'))
      and (not(p_event?'questIds') or exists(select 1 from jsonb_array_elements_text(p_event->'questIds') requested where requested=a.id::text))
    for update of a loop
    if q.is_personal and q.hero_class is not null and q.hero_class is distinct from p_event->>'heroClass' then continue; end if;
    delta:=case q.objective_type
      when 'longest_chain' then greatest(0,least(25,coalesce((p_event->'meta'->>'chainLength')::integer,amount))-q.progress)
      when 'high_level_clears' then case when coalesce((p_event->'meta'->>'levelNumber')::integer,0)>=30 then amount else 0 end
      when 'bosses_defeated' then case when coalesce((p_event->'meta'->>'isBoss')::boolean,false) then amount else 0 end
      else amount end;
    if delta<=0 then continue; end if;
    nextprogress:=least(q.target_value,q.progress+delta);
    update rune_delve_active_quests set progress=nextprogress,status=case when nextprogress>=q.target_value then 'completed'::rd_quest_status else 'active'::rd_quest_status end where id=q.id;
    if nextprogress>=q.target_value then completed:=completed||jsonb_build_array(q.title); end if;
  end loop;
  return completed;
end $fn$;
revoke all on function public.rune_delve_report_quest(jsonb) from public,anon;
grant execute on function public.rune_delve_report_quest(jsonb) to authenticated;

create or replace function public.rune_delve_equip(p_class text,p_slot_1 text,p_slot_2 text,p_slot_3 text)
returns public.rune_delve_loadouts language plpgsql security definer set search_path=public,pg_temp as $fn$
declare uid uuid:=auth.uid(); slots text[]:=array_remove(array[p_slot_1,p_slot_2,p_slot_3],null); row rune_delve_loadouts;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_class is null or p_class not in('warrior','mage','rogue','cleric') then raise exception 'Invalid class'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rune:'||uid::text,0));
  if cardinality(slots)<>(select count(distinct item) from unnest(slots) item) then raise exception 'Each relic can only be equipped once.'; end if;
  if p_slot_3 is not null and coalesce((select slots_unlocked from rune_delve_wallet where user_id=uid),2)<3 then raise exception 'Third relic slot is still locked'; end if;
  if exists(select 1 from unnest(slots) item where not exists(select 1 from rune_delve_relic_unlocks where user_id=uid and relic_id=item)) then raise exception 'Unlock a relic before equipping it'; end if;
  insert into rune_delve_loadouts(user_id,class,slot_1,slot_2,slot_3) values(uid,p_class,p_slot_1,p_slot_2,p_slot_3)
    on conflict(user_id,class) do update set slot_1=excluded.slot_1,slot_2=excluded.slot_2,slot_3=excluded.slot_3 returning * into row;
  return row;
end $fn$;
revoke all on function public.rune_delve_equip(text,text,text,text) from public,anon;
grant execute on function public.rune_delve_equip(text,text,text,text) to authenticated;
