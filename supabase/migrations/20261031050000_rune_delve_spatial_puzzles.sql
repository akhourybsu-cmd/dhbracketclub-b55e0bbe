-- A fresh puzzle progression track. Legacy campaign, wallets, XP and DH Score
-- remain intact. Every completion is replayed against an immutable definition.
begin;

create table if not exists public.rune_puzzle_definitions (
  room_id text not null,
  definition_version integer not null check (definition_version > 0),
  ordinal integer not null check (ordinal between 1 and 10000),
  definition jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (room_id, definition_version),
  check (definition->>'id'=room_id),
  check ((definition->>'version')::integer=definition_version),
  check ((definition->>'order')::integer=ordinal),
  check ((definition->>'width')::integer=6 and (definition->>'height')::integer=6)
);
create unique index if not exists rune_puzzle_active_order on public.rune_puzzle_definitions(ordinal) where active;
create unique index if not exists rune_puzzle_active_room on public.rune_puzzle_definitions(room_id) where active;

create table if not exists public.rune_puzzle_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  avatar text not null default 'warrior' check (avatar in ('warrior','mage','rogue','cleric')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.rune_puzzle_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id text not null,
  definition_version integer not null,
  stars integer not null check (stars between 1 and 3),
  best_pushes integer not null check (best_pushes between 0 and 1200),
  best_moves integer not null check (best_moves between 1 and 1200 and best_moves>=best_pushes),
  treasure_collected boolean not null default false,
  first_completed_at timestamptz not null default now(),
  last_completed_at timestamptz not null default now(),
  primary key (user_id,room_id,definition_version),
  foreign key (room_id,definition_version) references public.rune_puzzle_definitions(room_id,definition_version)
);
create table if not exists public.rune_puzzle_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  room_id text not null,
  definition_version integer not null,
  actions jsonb not null check (jsonb_typeof(actions)='array' and jsonb_array_length(actions)<=1200),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,request_id),
  foreign key(room_id,definition_version) references public.rune_puzzle_definitions(room_id,definition_version)
);
alter table public.rune_puzzle_definitions enable row level security;
alter table public.rune_puzzle_profiles enable row level security;
alter table public.rune_puzzle_results enable row level security;
alter table public.rune_puzzle_receipts enable row level security;
revoke all on public.rune_puzzle_definitions,public.rune_puzzle_profiles,public.rune_puzzle_results,public.rune_puzzle_receipts from public,anon,authenticated;
grant select on public.rune_puzzle_profiles,public.rune_puzzle_results to authenticated;
drop policy if exists rune_puzzle_own_profile on public.rune_puzzle_profiles;
create policy rune_puzzle_own_profile on public.rune_puzzle_profiles for select to authenticated using(user_id=auth.uid());
drop policy if exists rune_puzzle_own_results on public.rune_puzzle_results;
create policy rune_puzzle_own_results on public.rune_puzzle_results for select to authenticated using(user_id=auth.uid());

create or replace function public.rune_puzzle_neighbor(p_cell integer,p_direction text)
returns integer language sql immutable set search_path=public,pg_temp as $$
  select case when p_cell not between 0 and 35 then null
    when p_direction='up' and p_cell>=6 then p_cell-6
    when p_direction='right' and p_cell%6<5 then p_cell+1
    when p_direction='down' and p_cell<30 then p_cell+6
    when p_direction='left' and p_cell%6>0 then p_cell-1 else null end
$$;

create or replace function public.rune_puzzle_sigils_filled(p_definition jsonb,p_state jsonb,p_color text default null)
returns integer language sql immutable set search_path=public,pg_temp as $$
  select count(*)::integer from jsonb_array_elements(p_definition->'sigils') sigil
  where (p_color is null or sigil->>'color'=p_color)
    and exists(select 1 from jsonb_array_elements(p_state->'stones') stone
      where stone->>'color'=sigil->>'color' and (stone->>'cell')::integer=(sigil->>'cell')::integer)
$$;

create or replace function public.rune_puzzle_guardian_calm(p_definition jsonb,p_state jsonb)
returns boolean language sql immutable set search_path=public,pg_temp as $$
  select case when p_definition->'guardian' is null or p_definition->'guardian'='null'::jsonb then true else
    exists(select 1 from jsonb_array_elements(p_definition->'sigils') sigil where sigil->>'color'=p_definition->'guardian'->>'color')
    and not exists(select 1 from jsonb_array_elements(p_definition->'sigils') sigil
      where sigil->>'color'=p_definition->'guardian'->>'color' and not exists(
        select 1 from jsonb_array_elements(p_state->'stones') stone
        where stone->>'color'=sigil->>'color' and (stone->>'cell')::integer=(sigil->>'cell')::integer)) end
$$;

create or replace function public.rune_puzzle_blocked(p_definition jsonb,p_state jsonb,p_cell integer,p_ignore_stone text default null)
returns text language plpgsql immutable set search_path=public,pg_temp as $$
begin
  if p_cell is null or p_cell not between 0 and 35 or (p_definition->'walls') @> jsonb_build_array(p_cell) then return 'wall'; end if;
  if exists(select 1 from jsonb_array_elements(p_state->'stones') stone
    where (stone->>'cell')::integer=p_cell and (p_ignore_stone is null or stone->>'id'<>p_ignore_stone)) then return 'stone'; end if;
  if (p_definition->'gates') @> jsonb_build_array(p_cell)
    and not exists(select 1 from jsonb_array_elements(p_definition->'plates') plate where
      (plate#>>'{}')::integer=(p_state->>'player')::integer or exists(select 1 from jsonb_array_elements(p_state->'stones') stone where (stone->>'cell')::integer=(plate#>>'{}')::integer))
    and (p_state->>'player')::integer<>p_cell
    and not exists(select 1 from jsonb_array_elements(p_state->'stones') stone where (stone->>'cell')::integer=p_cell)
    then return 'gate'; end if;
  if (p_definition->'guardian'->>'cell')::integer=p_cell and not public.rune_puzzle_guardian_calm(p_definition,p_state) then return 'guardian'; end if;
  return null;
end $$;

create or replace function public.rune_puzzle_replay(p_definition jsonb,p_actions jsonb)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare
  state jsonb; action jsonb; direction text; actionindex integer:=0; target integer; landing integer; slide integer;
  moving jsonb; movingindex integer; reason text; collected jsonb; startcell integer;
begin
  -- Only canonical, administrator-authored definitions reach the public RPC.
  if p_definition is null or (p_definition->>'width')::integer<>6 or (p_definition->>'height')::integer<>6 then raise exception 'invalid_puzzle_definition'; end if;
  startcell:=(p_definition->>'start')::integer;
  state:=jsonb_build_object('player',startcell,'stones',p_definition->'stones',
    'collected',case when (p_definition->'treasures') @> jsonb_build_array(startcell) then jsonb_build_array(startcell) else '[]'::jsonb end,
    'moves',0,'pushes',0,'status','playing');
  if startcell=(p_definition->>'exit')::integer and public.rune_puzzle_sigils_filled(p_definition,state)=jsonb_array_length(p_definition->'sigils') then state:=jsonb_set(state,'{status}','"solved"'); end if;
  if p_actions is null or jsonb_typeof(p_actions)<>'array' or jsonb_array_length(p_actions)>1200 then
    return jsonb_build_object('state',state,'valid',false,'error','invalid_actions');
  end if;
  for action in select value from jsonb_array_elements(p_actions) loop
    direction:=case when jsonb_typeof(action)='string' then action#>>'{}' else null end;
    if direction is null or direction not in('up','right','down','left') then
      return jsonb_build_object('state',state,'valid',false,'error','invalid_direction:'||actionindex);
    end if;
    if state->>'status'='solved' then return jsonb_build_object('state',state,'valid',false,'error','finished:'||actionindex); end if;
    target:=public.rune_puzzle_neighbor((state->>'player')::integer,direction);
    moving:=null; movingindex:=null;
    select stone,ordinality::integer-1 into moving,movingindex from jsonb_array_elements(state->'stones') with ordinality as s(stone,ordinality)
      where (stone->>'cell')::integer=target limit 1;
    landing:=case when moving is null then target else public.rune_puzzle_neighbor((moving->>'cell')::integer,direction) end;
    -- The hero enters the adjacent cell too. A stone sitting on a ward that
    -- reactivated must not let its pusher walk through the living guardian.
    reason:=public.rune_puzzle_blocked(p_definition,state,target,moving->>'id');
    if reason is null then reason:=public.rune_puzzle_blocked(p_definition,state,landing,moving->>'id'); end if;
    if reason is not null then return jsonb_build_object('state',state,'valid',false,'error',reason||':'||actionindex); end if;
    state:=jsonb_set(state,'{player}',to_jsonb(target));
    state:=jsonb_set(state,'{moves}',to_jsonb((state->>'moves')::integer+1));
    if moving is not null then
      state:=jsonb_set(state,array['stones',movingindex::text,'cell'],to_jsonb(landing));
      state:=jsonb_set(state,'{pushes}',to_jsonb((state->>'pushes')::integer+1));
      while (p_definition->'ice') @> jsonb_build_array(landing) loop
        slide:=public.rune_puzzle_neighbor(landing,direction);
        exit when public.rune_puzzle_blocked(p_definition,state,slide,moving->>'id') is not null;
        state:=jsonb_set(state,array['stones',movingindex::text,'cell'],to_jsonb(slide));
        landing:=slide;
      end loop;
    end if;
    if (p_definition->'treasures') @> jsonb_build_array(target) and not (state->'collected') @> jsonb_build_array(target) then
      select jsonb_agg(cell order by cell) into collected from (
        select (value#>>'{}')::integer cell from jsonb_array_elements((state->'collected')||jsonb_build_array(target))
      ) cells;
      state:=jsonb_set(state,'{collected}',collected);
    end if;
    if target=(p_definition->>'exit')::integer and public.rune_puzzle_sigils_filled(p_definition,state)=jsonb_array_length(p_definition->'sigils') then
      state:=jsonb_set(state,'{status}','"solved"');
    end if;
    actionindex:=actionindex+1;
  end loop;
  return jsonb_build_object('state',state,'valid',true);
end $$;

create or replace function public.rune_puzzle_progress(p_uid uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'unlocked',greatest(1,least(coalesce((select max(ordinal) from public.rune_puzzle_definitions where active),1),
      coalesce((select max(d.ordinal) from public.rune_puzzle_results r join public.rune_puzzle_definitions d using(room_id,definition_version) where r.user_id=p_uid and d.active),0)+1)),
    'completed',(select count(*) from public.rune_puzzle_results r join public.rune_puzzle_definitions d using(room_id,definition_version) where r.user_id=p_uid and d.active),
    'stars',coalesce((select sum(r.stars) from public.rune_puzzle_results r join public.rune_puzzle_definitions d using(room_id,definition_version) where r.user_id=p_uid and d.active),0),
    'avatar',coalesce((select avatar from public.rune_puzzle_profiles where user_id=p_uid),'warrior'),
    'records',coalesce((select jsonb_agg(jsonb_build_object('room_id',r.room_id,'definition_version',r.definition_version,'stars',r.stars,'best_pushes',r.best_pushes,'best_moves',r.best_moves,'treasure_collected',r.treasure_collected) order by d.ordinal)
      from public.rune_puzzle_results r join public.rune_puzzle_definitions d using(room_id,definition_version) where r.user_id=p_uid and d.active),'[]'::jsonb))
$$;

create or replace function public.rune_puzzle_profile()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  insert into public.rune_puzzle_profiles(user_id) values(uid) on conflict(user_id) do nothing;
  return public.rune_puzzle_progress(uid);
end $$;

create or replace function public.rune_puzzle_select_avatar(p_avatar text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_avatar is null or p_avatar not in('warrior','mage','rogue','cleric') then raise exception 'invalid_puzzle_avatar'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rune-puzzle:'||uid::text,0));
  insert into public.rune_puzzle_profiles(user_id,avatar) values(uid,p_avatar)
    on conflict(user_id) do update set avatar=excluded.avatar,updated_at=now();
  return public.rune_puzzle_progress(uid);
end $$;

create or replace function public.rune_puzzle_complete(p_room_id text,p_definition_version integer,p_actions jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare
  uid uuid:=auth.uid(); receipt public.rune_puzzle_receipts; room public.rune_puzzle_definitions;
  old public.rune_puzzle_results; saved public.rune_puzzle_results; replay jsonb; finalstate jsonb;
  progress jsonb; result jsonb; stars integer; gained integer; moves integer; pushes integer; treasure boolean; firstclear boolean;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null then raise exception 'missing_request_id'; end if;
  if p_room_id is null or length(p_room_id)>80 or p_definition_version is null or p_definition_version<1
    or p_actions is null or jsonb_typeof(p_actions)<>'array' or jsonb_array_length(p_actions) not between 1 and 1200 then raise exception 'invalid_puzzle_result'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rune-puzzle:'||uid::text,0));
  select * into receipt from public.rune_puzzle_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.room_id<>p_room_id or receipt.definition_version<>p_definition_version or receipt.actions<>p_actions then raise exception 'request_id_reused'; end if;
    return receipt.result;
  end if;
  select * into room from public.rune_puzzle_definitions where room_id=p_room_id and definition_version=p_definition_version and active;
  if not found then raise exception 'puzzle_unavailable'; end if;
  insert into public.rune_puzzle_profiles(user_id) values(uid) on conflict(user_id) do nothing;
  progress:=public.rune_puzzle_progress(uid);
  if room.ordinal>(progress->>'unlocked')::integer then raise exception 'puzzle_locked'; end if;
  replay:=public.rune_puzzle_replay(room.definition,p_actions);
  if not coalesce((replay->>'valid')::boolean,false) then raise exception 'invalid_puzzle_actions: %',replay->>'error'; end if;
  finalstate:=replay->'state';
  if finalstate->>'status'<>'solved' then raise exception 'puzzle_not_solved'; end if;
  moves:=(finalstate->>'moves')::integer; pushes:=(finalstate->>'pushes')::integer;
  treasure:=not exists(select 1 from jsonb_array_elements(room.definition->'treasures') cell where not (finalstate->'collected') @> jsonb_build_array((cell#>>'{}')::integer));
  stars:=1+case when pushes<=(room.definition->>'parPushes')::integer then 1 else 0 end+case when treasure then 1 else 0 end;
  select * into old from public.rune_puzzle_results where user_id=uid and room_id=p_room_id and definition_version=p_definition_version for update;
  firstclear:=old.user_id is null;
  insert into public.rune_puzzle_results(user_id,room_id,definition_version,stars,best_pushes,best_moves,treasure_collected)
    values(uid,p_room_id,p_definition_version,stars,pushes,moves,treasure)
    on conflict(user_id,room_id,definition_version) do update set
      stars=greatest(rune_puzzle_results.stars,excluded.stars),
      best_pushes=least(rune_puzzle_results.best_pushes,excluded.best_pushes),
      best_moves=case when excluded.best_pushes<rune_puzzle_results.best_pushes then excluded.best_moves
        when excluded.best_pushes=rune_puzzle_results.best_pushes then least(rune_puzzle_results.best_moves,excluded.best_moves) else rune_puzzle_results.best_moves end,
      treasure_collected=rune_puzzle_results.treasure_collected or excluded.treasure_collected,last_completed_at=now()
    returning * into saved;
  gained:=saved.stars-coalesce(old.stars,0);
  progress:=public.rune_puzzle_progress(uid);
  result:=jsonb_build_object('requestId',p_request_id,'roomId',p_room_id,'definitionVersion',p_definition_version,
    'stars',saved.stars,'starsGained',gained,'pushes',pushes,'moves',moves,'treasureCollected',treasure,'firstClear',firstclear,
    'unlocked',(progress->>'unlocked')::integer,'progress',progress);
  insert into public.rune_puzzle_receipts(user_id,request_id,room_id,definition_version,actions,result)
    values(uid,p_request_id,p_room_id,p_definition_version,p_actions,result);
  return result;
end $$;

revoke all on function public.rune_puzzle_neighbor(integer,text),public.rune_puzzle_sigils_filled(jsonb,jsonb,text),public.rune_puzzle_guardian_calm(jsonb,jsonb),public.rune_puzzle_blocked(jsonb,jsonb,integer,text),public.rune_puzzle_replay(jsonb,jsonb),public.rune_puzzle_progress(uuid) from public,anon,authenticated;
revoke all on function public.rune_puzzle_profile(),public.rune_puzzle_select_avatar(text),public.rune_puzzle_complete(text,integer,jsonb,uuid) from public,anon;
grant execute on function public.rune_puzzle_profile(),public.rune_puzzle_select_avatar(text),public.rune_puzzle_complete(text,integer,jsonb,uuid) to authenticated;

-- ROOM_DEFINITIONS_SEED: authored, solution-verified immutable definitions.
do $seed$
declare entry jsonb; existing jsonb;
begin
  for entry in select value from jsonb_array_elements($puzzle_rooms$[{"id":"ember-01","version":1,"order":1,"chapter":1,"title":"First Light","lesson":"Push the ember rune onto its matching sigil.","mechanic":"runes","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,17,18,23,24,29,30,31,32,33,34,35],"start":7,"exit":22,"stones":[{"id":"rune-1","color":"red","cell":14}],"sigils":[{"color":"red","cell":15}],"plates":[],"gates":[],"ice":[],"treasures":[21],"parPushes":1},{"id":"ember-02","version":1,"order":2,"chapter":1,"title":"Behind the Rune","lesson":"Find the pushing side before choosing a route.","mechanic":"runes","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,17,18,23,24,29,30,31,32,33,34,35],"start":21,"exit":10,"stones":[{"id":"rune-1","color":"red","cell":15}],"sigils":[{"color":"red","cell":13}],"plates":[],"gates":[],"ice":[],"treasures":[20],"parPushes":2},{"id":"ember-03","version":1,"order":3,"chapter":1,"title":"Crossed Intentions","lesson":"A finished rune can block your next pushing position.","mechanic":"runes","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,17,18,23,24,29,30,31,32,33,34,35],"start":25,"exit":22,"stones":[{"id":"rune-1","color":"blue","cell":15},{"id":"rune-2","color":"red","cell":20}],"sigils":[{"color":"blue","cell":9},{"color":"red","cell":21}],"plates":[],"gates":[],"ice":[],"treasures":[26],"parPushes":2},{"id":"ember-04","version":1,"order":4,"chapter":1,"title":"The Narrow Exchange","lesson":"Use both corridors to reach the backs of the runes.","mechanic":"runes","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,14,17,18,23,24,29,30,31,32,33,34,35],"start":25,"exit":10,"stones":[{"id":"rune-1","color":"red","cell":13},{"id":"rune-2","color":"blue","cell":21}],"sigils":[{"color":"red","cell":7},{"color":"blue","cell":22}],"plates":[],"gates":[],"ice":[],"treasures":[26],"parPushes":2},{"id":"ember-05","version":1,"order":5,"chapter":1,"title":"The Patient Wraith","lesson":"Restore the blue sigil to calm the waiting wraith.","mechanic":"runes","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,17,18,23,24,29,30,31,32,33,34,35],"start":25,"exit":28,"stones":[{"id":"rune-1","color":"gold","cell":14},{"id":"rune-2","color":"blue","cell":20}],"sigils":[{"color":"gold","cell":15},{"color":"blue","cell":21}],"plates":[],"gates":[],"ice":[],"treasures":[10],"parPushes":2,"guardian":{"cell":22,"color":"blue","archetypeId":"rune_wraith","name":"Rune Wraith"}},{"id":"ember-06","version":1,"order":6,"chapter":1,"title":"The Threefold Seal","lesson":"Choose the order: three colors share a narrow workspace.","mechanic":"runes","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,17,18,23,24,29,30,31,32,33,34,35],"start":25,"exit":10,"stones":[{"id":"rune-1","color":"red","cell":13},{"id":"rune-2","color":"green","cell":15},{"id":"rune-3","color":"blue","cell":21}],"sigils":[{"color":"red","cell":7},{"color":"green","cell":9},{"color":"blue","cell":22}],"plates":[],"gates":[],"ice":[],"treasures":[26],"parPushes":3},{"id":"crystal-01","version":1,"order":7,"chapter":2,"title":"A Living Key","lesson":"Step from the plate into the gate; it waits until you leave.","mechanic":"gates","width":6,"height":6,"walls":[0,1,2,3,4,5,6,8,11,12,14,17,18,23,24,26,29,30,31,32,33,34,35],"start":25,"exit":10,"stones":[{"id":"rune-1","color":"red","cell":13}],"sigils":[{"color":"red","cell":7}],"plates":[19],"gates":[20],"ice":[],"treasures":[22],"parPushes":1},{"id":"crystal-02","version":1,"order":8,"chapter":2,"title":"A Patient Weight","lesson":"Leave the spare rune on the plate while you cross.","mechanic":"gates","width":6,"height":6,"walls":[0,1,2,3,4,5,6,9,11,12,17,18,23,24,27,29,30,31,32,33,34,35],"start":25,"exit":28,"stones":[{"id":"rune-1","color":"red","cell":13},{"id":"rune-2","color":"blue","cell":14}],"sigils":[{"color":"blue","cell":10}],"plates":[7],"gates":[15,21],"ice":[],"treasures":[26],"parPushes":4},{"id":"crystal-03","version":1,"order":9,"chapter":2,"title":"Two Duties","lesson":"One rune can restore a sigil and hold a gate open.","mechanic":"gates","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,17,18,20,23,24,29,30,31,32,33,34,35],"start":25,"exit":28,"stones":[{"id":"rune-1","color":"red","cell":13},{"id":"rune-2","color":"blue","cell":15}],"sigils":[{"color":"red","cell":7},{"color":"blue","cell":27}],"plates":[7],"gates":[21],"ice":[],"treasures":[26],"parPushes":3},{"id":"crystal-04","version":1,"order":10,"chapter":2,"title":"The Shutter Exchange","lesson":"Borrow a rune as a weight, then put it back on its sigil.","mechanic":"gates","width":6,"height":6,"walls":[0,1,2,3,4,5,6,9,11,12,17,18,23,24,29,30,31,32,33,34,35],"start":26,"exit":8,"stones":[{"id":"rune-1","color":"blue","cell":19},{"id":"rune-2","color":"red","cell":20}],"sigils":[{"color":"red","cell":10},{"color":"blue","cell":25}],"plates":[13],"gates":[15,21,27],"ice":[],"treasures":[22],"parPushes":7},{"id":"crystal-05","version":1,"order":11,"chapter":2,"title":"The Keeper's Shortcut","lesson":"Calm the golem to recover the cache on its guarded tile.","mechanic":"gates","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,15,17,18,23,24,29,30,31,32,33,34,35],"start":8,"exit":28,"stones":[{"id":"rune-1","color":"green","cell":19},{"id":"rune-2","color":"red","cell":20}],"sigils":[{"color":"red","cell":16}],"plates":[25],"gates":[21,27],"ice":[],"treasures":[26],"parPushes":4,"guardian":{"cell":26,"color":"red","archetypeId":"stone_golem","name":"Stone Golem"}},{"id":"crystal-06","version":1,"order":12,"chapter":2,"title":"The Crystal Lock","lesson":"Make room for each color before closing its route.","mechanic":"gates","width":6,"height":6,"walls":[0,1,3,4,5,6,11,12,17,18,23,24,29,30,31,32,33,34,35],"start":28,"exit":9,"stones":[{"id":"rune-1","color":"blue","cell":15},{"id":"rune-2","color":"green","cell":20},{"id":"rune-3","color":"red","cell":21}],"sigils":[{"color":"red","cell":7},{"color":"blue","cell":10},{"color":"green","cell":25}],"plates":[10],"gates":[8],"ice":[],"treasures":[2],"parPushes":8},{"id":"vault-01","version":1,"order":13,"chapter":3,"title":"First Drift","lesson":"Pushed runes slide across ice; your delver walks normally.","mechanic":"ice","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,17,18,23,24,29,30,31,32,33,34,35],"start":7,"exit":28,"stones":[{"id":"rune-1","color":"red","cell":14}],"sigils":[{"color":"red","cell":22}],"plates":[],"gates":[],"ice":[15,16],"treasures":[21],"parPushes":2},{"id":"vault-02","version":1,"order":14,"chapter":3,"title":"Make a Stop","lesson":"Use the spare rune as a brake beside the icy sigil.","mechanic":"ice","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,17,18,21,23,24,29,30,31,32,33,34,35],"start":7,"exit":25,"stones":[{"id":"rune-1","color":"red","cell":14},{"id":"rune-2","color":"blue","cell":22}],"sigils":[{"color":"red","cell":15}],"plates":[],"gates":[],"ice":[15],"treasures":[27],"parPushes":2},{"id":"vault-03","version":1,"order":15,"chapter":3,"title":"The Frozen Shutter","lesson":"Hold the gates before sending a rune across their ice.","mechanic":"ice","width":6,"height":6,"walls":[0,1,2,3,4,5,6,9,11,12,17,18,23,24,29,30,31,32,33,34,35],"start":25,"exit":28,"stones":[{"id":"rune-1","color":"green","cell":13},{"id":"rune-2","color":"red","cell":14}],"sigils":[{"color":"red","cell":10}],"plates":[7],"gates":[15,21,27],"ice":[15],"treasures":[26],"parPushes":3},{"id":"vault-04","version":1,"order":16,"chapter":3,"title":"Crosswind","lesson":"Slide the lower rune only after clearing the upper lane.","mechanic":"ice","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,17,18,23,24,29,30,31,32,33,34,35],"start":25,"exit":10,"stones":[{"id":"rune-1","color":"red","cell":14},{"id":"rune-2","color":"blue","cell":21}],"sigils":[{"color":"red","cell":7},{"color":"blue","cell":19}],"plates":[],"gates":[],"ice":[13,20,22],"treasures":[26],"parPushes":3},{"id":"vault-05","version":1,"order":17,"chapter":3,"title":"The Sleeping Sentinel","lesson":"Restore the blue sigil to open a lane behind the ember rune.","mechanic":"ice","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,15,17,18,23,24,29,30,31,32,33,34,35],"start":25,"exit":10,"stones":[{"id":"rune-1","color":"red","cell":14},{"id":"rune-2","color":"blue","cell":21}],"sigils":[{"color":"red","cell":7},{"color":"blue","cell":22}],"plates":[],"gates":[],"ice":[13],"treasures":[28],"parPushes":4,"guardian":{"cell":27,"color":"blue","archetypeId":"cursed_knight","name":"Cursed Knight"}},{"id":"vault-06","version":1,"order":18,"chapter":3,"title":"Heart of the Vault","lesson":"A temporary move can open the route to a permanent solution.","mechanic":"ice","width":6,"height":6,"walls":[0,1,2,4,5,6,11,12,17,18,23,24,29,30,31,32,33,34,35],"start":9,"exit":28,"stones":[{"id":"rune-1","color":"red","cell":14},{"id":"rune-2","color":"blue","cell":20},{"id":"rune-3","color":"green","cell":21}],"sigils":[{"color":"green","cell":7},{"color":"red","cell":10},{"color":"blue","cell":25}],"plates":[7],"gates":[13],"ice":[8],"treasures":[3],"parPushes":8}]$puzzle_rooms$::jsonb) loop
    select definition into existing from public.rune_puzzle_definitions
      where room_id=entry->>'id' and definition_version=(entry->>'version')::integer;
    if found then
      if existing<>entry then raise exception 'puzzle_definition_version_immutable: %',entry->>'id'; end if;
    else
      insert into public.rune_puzzle_definitions(room_id,definition_version,ordinal,definition)
        values(entry->>'id',(entry->>'version')::integer,(entry->>'order')::integer,entry);
    end if;
  end loop;
end $seed$;
-- END_ROOM_DEFINITIONS_SEED

commit;
