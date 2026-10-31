-- Append connected adventures. Released definitions, records and frozen receipts
-- remain intact; the active definition frontier opens the new chapters naturally.
begin;

create or replace function public.rune_puzzle_area_count(p_definition jsonb)
returns integer language sql immutable set search_path=public,pg_temp as $$
  select case when jsonb_typeof(p_definition->'areas')='array'
    then jsonb_array_length(p_definition->'areas') else 1 end
$$;

-- Neighbors stay on their own 6x6 board, even when global cell IDs span areas.
create or replace function public.rune_puzzle_neighbor(p_cell integer,p_direction text)
returns integer language sql immutable set search_path=public,pg_temp as $$
  select case when p_cell not between 0 and 107 then null
    when p_direction='up' and p_cell%36>=6 then p_cell-6
    when p_direction='right' and p_cell%6<5 then p_cell+1
    when p_direction='down' and p_cell%36<30 then p_cell+6
    when p_direction='left' and p_cell%6>0 then p_cell-1 else null end
$$;

create or replace function public.rune_puzzle_passage_destination(p_definition jsonb,p_cell integer)
returns integer language sql immutable set search_path=public,pg_temp as $$
  select case when (passage->>'a')::integer=p_cell then (passage->>'b')::integer
    else (passage->>'a')::integer end
  from jsonb_array_elements(coalesce(p_definition->'passages','[]'::jsonb)) passage
  where (passage->>'a')::integer=p_cell or (passage->>'b')::integer=p_cell
  limit 1
$$;

create or replace function public.rune_puzzle_blocked(p_definition jsonb,p_state jsonb,p_cell integer,p_ignore_stone text default null)
returns text language plpgsql immutable set search_path=public,pg_temp as $$
begin
  if p_cell is null or p_cell<0 or p_cell>=36*public.rune_puzzle_area_count(p_definition)
    or (p_definition->'walls') @> jsonb_build_array(p_cell) then return 'wall'; end if;
  if exists(select 1 from jsonb_array_elements(p_state->'stones') stone
    where (stone->>'cell')::integer=p_cell and (p_ignore_stone is null or stone->>'id'<>p_ignore_stone)) then return 'stone'; end if;
  if (p_definition->'gates') @> jsonb_build_array(p_cell)
    and not exists(select 1 from jsonb_array_elements(p_definition->'plates') plate where
      (plate#>>'{}')::integer=(p_state->>'player')::integer or exists(select 1 from jsonb_array_elements(p_state->'stones') stone where (stone->>'cell')::integer=(plate#>>'{}')::integer))
    and (p_state->>'player')::integer<>p_cell
    and not exists(select 1 from jsonb_array_elements(p_state->'stones') stone where (stone->>'cell')::integer=p_cell)
    then return 'gate'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_definition->'doors','[]'::jsonb)) door
    where (door->>'cell')::integer=p_cell and not coalesce(p_state->'keys','[]'::jsonb) @> jsonb_build_array(door->>'color'))
    then return 'door'; end if;
  if (p_definition->'guardian'->>'cell')::integer=p_cell and not public.rune_puzzle_guardian_calm(p_definition,p_state) then return 'guardian'; end if;
  return null;
end $$;

create or replace function public.rune_puzzle_stone_blocked(p_definition jsonb,p_state jsonb,p_cell integer,p_ignore_stone text default null)
returns text language plpgsql immutable set search_path=public,pg_temp as $$
declare reason text;
begin
  reason:=public.rune_puzzle_blocked(p_definition,p_state,p_cell,p_ignore_stone);
  if reason is not null then return reason; end if;
  if public.rune_puzzle_passage_destination(p_definition,p_cell) is not null then return 'passage'; end if;
  return null;
end $$;

create or replace function public.rune_puzzle_collect_keys(p_definition jsonb,p_state jsonb,p_cell integer)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare collected jsonb;
begin
  if jsonb_array_length(coalesce(p_definition->'keys','[]'::jsonb))=0
    and jsonb_array_length(coalesce(p_definition->'doors','[]'::jsonb))=0 then return p_state; end if;
  select coalesce(jsonb_agg(color order by color),'[]'::jsonb) into collected from (
    select distinct value as color from jsonb_array_elements_text(coalesce(p_state->'keys','[]'::jsonb))
    union
    select key->>'color' from jsonb_array_elements(coalesce(p_definition->'keys','[]'::jsonb)) key where (key->>'cell')::integer=p_cell
  ) colors;
  return jsonb_set(p_state,'{keys}',collected);
end $$;

create or replace function public.rune_puzzle_replay(p_definition jsonb,p_actions jsonb)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare
  state jsonb; action jsonb; direction text; actionindex integer:=0;
  target integer; landing integer; slide integer; destination integer; areas integer;
  moving jsonb; movingindex integer; reason text; collected jsonb; startcell integer;
begin
  -- Only canonical administrator-authored definitions reach the public RPC.
  areas:=public.rune_puzzle_area_count(p_definition);
  if p_definition is null or (p_definition->>'width')::integer<>6 or (p_definition->>'height')::integer<>6
    or areas not between 1 and 3 then raise exception 'invalid_puzzle_definition'; end if;
  startcell:=(p_definition->>'start')::integer;
  state:=jsonb_build_object('player',startcell,'stones',p_definition->'stones',
    'collected',case when (p_definition->'treasures') @> jsonb_build_array(startcell) then jsonb_build_array(startcell) else '[]'::jsonb end,
    'moves',0,'pushes',0,'status','playing');
  -- Keep the exact original state shape for the released single-room puzzles.
  state:=public.rune_puzzle_collect_keys(p_definition,state,startcell);
  if areas>1 then state:=jsonb_set(state,'{visitedAreas}',jsonb_build_array(startcell/36)); end if;
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
    reason:=public.rune_puzzle_blocked(p_definition,state,target,moving->>'id');
    if reason is null then
      reason:=case when moving is null then public.rune_puzzle_blocked(p_definition,state,landing)
        else public.rune_puzzle_stone_blocked(p_definition,state,landing,moving->>'id') end;
    end if;
    -- A walking delver traverses an endpoint once; runestones never enter it.
    destination:=case when moving is null then public.rune_puzzle_passage_destination(p_definition,target) else null end;
    if reason is null and destination is not null then reason:=public.rune_puzzle_blocked(p_definition,state,destination); end if;
    if reason is not null then return jsonb_build_object('state',state,'valid',false,'error',reason||':'||actionindex); end if;
    if destination is not null then target:=destination; end if;
    state:=jsonb_set(state,'{player}',to_jsonb(target));
    state:=jsonb_set(state,'{moves}',to_jsonb((state->>'moves')::integer+1));
    -- Entry and initial push checks used the pre-action inventory. A newly
    -- revealed key can now open a later door during a pushed stone's slide.
    state:=public.rune_puzzle_collect_keys(p_definition,state,target);
    if moving is not null then
      state:=jsonb_set(state,array['stones',movingindex::text,'cell'],to_jsonb(landing));
      state:=jsonb_set(state,'{pushes}',to_jsonb((state->>'pushes')::integer+1));
      while (p_definition->'ice') @> jsonb_build_array(landing) loop
        slide:=public.rune_puzzle_neighbor(landing,direction);
        exit when public.rune_puzzle_stone_blocked(p_definition,state,slide,moving->>'id') is not null;
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
    if areas>1 and not (state->'visitedAreas') @> jsonb_build_array(target/36) then
      select jsonb_agg(area order by area) into collected from (
        select (value#>>'{}')::integer area from jsonb_array_elements((state->'visitedAreas')||jsonb_build_array(target/36))
      ) visits;
      state:=jsonb_set(state,'{visitedAreas}',collected);
    end if;
    if target=(p_definition->>'exit')::integer and public.rune_puzzle_sigils_filled(p_definition,state)=jsonb_array_length(p_definition->'sigils') then
      state:=jsonb_set(state,'{status}','"solved"');
    end if;
    actionindex:=actionindex+1;
  end loop;
  return jsonb_build_object('state',state,'valid',true);
end $$;

revoke all on function public.rune_puzzle_area_count(jsonb),public.rune_puzzle_neighbor(integer,text),public.rune_puzzle_passage_destination(jsonb,integer),public.rune_puzzle_blocked(jsonb,jsonb,integer,text),public.rune_puzzle_stone_blocked(jsonb,jsonb,integer,text),public.rune_puzzle_collect_keys(jsonb,jsonb,integer),public.rune_puzzle_replay(jsonb,jsonb) from public,anon,authenticated;

-- ADVENTURE_DEFINITIONS_SEED: appended, solution-verified immutable definitions.
do $seed$
declare entry jsonb; existing jsonb;
begin
  for entry in select value from jsonb_array_elements($rune_adventures$[{"id":"galleries-01","version":1,"order":19,"chapter":4,"title":"A Door Beyond","lesson":"Follow the archway. A second room remembers your first.","mechanic":"passages","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,17,18,23,24,29,30,31,32,33,34,35,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,56,57,58,59,64,65,66,68,69,70,71],"start":7,"exit":10,"stones":[{"id":"area-1-rune-1","color":"red","cell":55}],"sigils":[{"color":"red","cell":43}],"plates":[],"gates":[],"ice":[],"treasures":[60],"areas":[{"id":"room-1","title":"Arrival Court"},{"id":"room-2","title":"First Annex"}],"passages":[{"a":28,"b":67}],"parPushes":2},{"id":"galleries-02","version":1,"order":20,"chapter":4,"title":"Two Seals, One Portal","lesson":"Both rooms share one portal. Restore a seal, then find the other.","mechanic":"passages","width":6,"height":6,"walls":[0,1,2,3,4,5,6,8,9,10,11,12,14,15,16,17,18,30,32,33,34,35,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,56,57,58,59,64,65,66,68,69,70,71],"start":26,"exit":27,"stones":[{"id":"area-0-rune-1","color":"red","cell":22},{"id":"area-1-rune-1","color":"blue","cell":55}],"sigils":[{"color":"red","cell":7},{"color":"blue","cell":43}],"plates":[],"gates":[],"ice":[],"treasures":[24,60],"areas":[{"id":"room-1","title":"Ember Hall"},{"id":"room-2","title":"Aqua Annex"}],"passages":[{"a":31,"b":67}],"parPushes":7},{"id":"galleries-03","version":1,"order":21,"chapter":4,"title":"The Distant Shutter","lesson":"A restored seal can hold a distant pressure gate open.","mechanic":"passages","width":6,"height":6,"walls":[0,1,2,3,4,5,6,8,9,10,11,12,14,15,16,17,18,30,32,33,34,35,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,56,57,58,59,64,65,66,68,69,70,71],"start":26,"exit":27,"stones":[{"id":"area-0-rune-1","color":"red","cell":22},{"id":"area-1-rune-1","color":"blue","cell":55}],"sigils":[{"color":"red","cell":7},{"color":"blue","cell":43}],"plates":[43],"gates":[29],"ice":[],"treasures":[24,60],"areas":[{"id":"room-1","title":"Shutter Hall"},{"id":"room-2","title":"Counterweight Room"}],"passages":[{"a":31,"b":67}],"parPushes":7},{"id":"galleries-04","version":1,"order":22,"chapter":4,"title":"The Borrowed Brake","lesson":"The annex has its own ice problem. Leave every room ready for your return.","mechanic":"passages","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,14,15,17,18,20,21,30,33,34,36,37,38,39,40,41,42,47,48,53,54,57,59,60,65,66,67,68,69,70,71],"start":8,"exit":9,"stones":[{"id":"area-0-rune-1","color":"gold","cell":16},{"id":"area-1-rune-1","color":"red","cell":50},{"id":"area-1-rune-2","color":"blue","cell":58}],"sigils":[{"color":"gold","cell":7},{"color":"red","cell":51}],"plates":[],"gates":[],"ice":[51],"treasures":[24,63],"areas":[{"id":"room-1","title":"Turning Gallery"},{"id":"room-2","title":"Frozen Workshop"}],"passages":[{"a":35,"b":43}],"parPushes":10},{"id":"galleries-05","version":1,"order":23,"chapter":4,"title":"The Keeper's Far Room","lesson":"Restore the far seal to reopen the rear lane; return for the keeper’s cache.","mechanic":"passages","width":6,"height":6,"walls":[1,2,3,4,5,8,9,10,11,14,15,16,17,18,30,32,33,34,35,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,66,68,69,70,71],"start":26,"exit":27,"stones":[{"id":"area-0-rune-1","color":"red","cell":22},{"id":"area-1-rune-1","color":"blue","cell":58}],"sigils":[{"color":"red","cell":7},{"color":"blue","cell":43}],"plates":[43],"gates":[29],"ice":[],"treasures":[0,24,60],"areas":[{"id":"room-1","title":"Keeper's Hall"},{"id":"room-2","title":"Blue Counterweight"}],"passages":[{"a":31,"b":67}],"parPushes":10,"guardian":{"cell":6,"color":"red","archetypeId":"stone_golem","name":"Stone Golem"}},{"id":"galleries-06","version":1,"order":24,"chapter":4,"title":"The Gallery Relay","lesson":"Lend the shutter a weight, restore the far room, then finish the exchange.","mechanic":"passages","width":6,"height":6,"walls":[0,1,2,3,4,5,6,9,11,12,17,18,23,24,29,30,31,32,33,35,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,66,68,69,70,71],"start":26,"exit":8,"stones":[{"id":"area-0-rune-1","color":"blue","cell":19},{"id":"area-0-rune-2","color":"red","cell":20},{"id":"area-1-rune-1","color":"gold","cell":58}],"sigils":[{"color":"red","cell":10},{"color":"blue","cell":25},{"color":"gold","cell":43}],"plates":[13],"gates":[15,21,27,65],"ice":[],"treasures":[22,60],"areas":[{"id":"room-1","title":"The Shutter Exchange"},{"id":"room-2","title":"Gold Carry"}],"passages":[{"a":34,"b":67}],"parPushes":12},{"id":"keep-01","version":1,"order":25,"chapter":5,"title":"The First Brass Key","lesson":"A key opens every matching lock. Find it beyond the archway, then return.","mechanic":"keys","width":6,"height":6,"walls":[0,1,2,3,4,5,6,8,9,10,11,12,14,15,16,17,18,30,32,33,34,35,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,56,57,58,59,64,65,66,68,69,70,71],"start":26,"exit":27,"stones":[{"id":"area-0-rune-1","color":"red","cell":22},{"id":"area-1-rune-1","color":"green","cell":55}],"sigils":[{"color":"red","cell":7},{"color":"green","cell":43}],"plates":[],"gates":[],"ice":[],"treasures":[24,60],"areas":[{"id":"room-1","title":"Brass Lock Hall"},{"id":"room-2","title":"Key Shrine"}],"passages":[{"a":31,"b":67}],"parPushes":7,"keys":[{"color":"gold","cell":49}],"doors":[{"color":"gold","cell":29}]},{"id":"keep-02","version":1,"order":26,"chapter":5,"title":"Unlock the Turning Room","lesson":"Park the rune at a turn if its final pushing side is locked away.","mechanic":"keys","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,14,15,17,18,20,21,30,33,34,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,56,57,58,59,64,65,66,68,69,70,71],"start":8,"exit":9,"stones":[{"id":"area-0-rune-1","color":"red","cell":16},{"id":"area-1-rune-1","color":"green","cell":55}],"sigils":[{"color":"red","cell":7},{"color":"green","cell":43}],"plates":[],"gates":[],"ice":[],"treasures":[24,60],"areas":[{"id":"room-1","title":"Three-Turn Hall"},{"id":"room-2","title":"Blue Key Shrine"}],"passages":[{"a":35,"b":67}],"parPushes":10,"keys":[{"color":"blue","cell":49}],"doors":[{"color":"blue","cell":31}]},{"id":"keep-03","version":1,"order":27,"chapter":5,"title":"One Key Leads to Another","lesson":"Read both locks. The first key opens the route to the second.","mechanic":"keys","width":6,"height":6,"walls":[0,1,2,3,4,5,6,8,9,10,11,12,14,15,16,17,18,30,32,33,34,35,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,66,68,69,70,71],"start":26,"exit":27,"stones":[{"id":"area-0-rune-1","color":"red","cell":22},{"id":"area-1-rune-1","color":"blue","cell":58}],"sigils":[{"color":"red","cell":7},{"color":"blue","cell":43}],"plates":[],"gates":[],"ice":[],"treasures":[24,63],"areas":[{"id":"room-1","title":"Gold Key Hall"},{"id":"room-2","title":"Blue Key Annex"}],"passages":[{"a":31,"b":67}],"parPushes":10,"keys":[{"color":"blue","cell":60},{"color":"gold","cell":13}],"doors":[{"color":"blue","cell":29},{"color":"gold","cell":65}]},{"id":"keep-04","version":1,"order":28,"chapter":5,"title":"The Frozen Key","lesson":"A far key opens the last pushing side. Solve the ice room without spending it.","mechanic":"keys","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,14,15,17,18,20,21,30,33,34,36,37,38,39,40,41,42,45,47,48,53,54,59,60,65,66,68,69,70,71],"start":8,"exit":9,"stones":[{"id":"area-0-rune-1","color":"gold","cell":16},{"id":"area-1-rune-1","color":"green","cell":49},{"id":"area-1-rune-2","color":"red","cell":50}],"sigils":[{"color":"gold","cell":7},{"color":"red","cell":46}],"plates":[43],"gates":[51,57,63],"ice":[51],"treasures":[24,62],"areas":[{"id":"room-1","title":"Turning Keep"},{"id":"room-2","title":"Ice Key Room"}],"passages":[{"a":35,"b":67}],"parPushes":11,"keys":[{"color":"blue","cell":64}],"doors":[{"color":"blue","cell":31}]},{"id":"keep-05","version":1,"order":29,"chapter":5,"title":"The Three-Room Circuit","lesson":"Three rooms make one circuit: a key, a counterweight, and a return route.","mechanic":"keys","width":6,"height":6,"walls":[0,1,2,3,4,5,6,8,9,10,11,12,14,15,16,17,18,30,32,33,34,35,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,56,57,58,59,64,65,66,68,69,70,71,72,73,74,75,76,77,78,80,81,82,83,84,86,87,88,89,90,92,93,94,95,100,101,102,104,105,106,107],"start":26,"exit":27,"stones":[{"id":"area-0-rune-1","color":"red","cell":22},{"id":"area-1-rune-1","color":"blue","cell":55},{"id":"area-2-rune-1","color":"green","cell":91}],"sigils":[{"color":"red","cell":7},{"color":"blue","cell":43},{"color":"green","cell":79}],"plates":[43],"gates":[97],"ice":[],"treasures":[24,60,96],"areas":[{"id":"room-1","title":"Outer Lock"},{"id":"room-2","title":"Counterweight"},{"id":"room-3","title":"Inner Key"}],"passages":[{"a":31,"b":67},{"a":63,"b":103}],"parPushes":9,"keys":[{"color":"gold","cell":85}],"doors":[{"color":"gold","cell":29}]},{"id":"keep-06","version":1,"order":30,"chapter":5,"title":"The Keep's Returning Seal","lesson":"The final key lies beyond a borrowed weight. Return before sealing your route.","mechanic":"keys","width":6,"height":6,"walls":[0,1,2,3,4,5,6,9,11,12,17,18,23,24,29,30,31,32,33,35,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,66,68,69,70,71,72,73,74,75,76,77,78,80,81,82,83,84,86,87,88,89,90,92,93,94,95,100,101,102,104,105,106,107],"start":26,"exit":8,"stones":[{"id":"area-0-rune-1","color":"blue","cell":19},{"id":"area-0-rune-2","color":"red","cell":20},{"id":"area-1-rune-1","color":"green","cell":58},{"id":"area-2-rune-1","color":"gold","cell":91}],"sigils":[{"color":"red","cell":10},{"color":"blue","cell":25},{"color":"green","cell":43},{"color":"gold","cell":79}],"plates":[13],"gates":[15,21,27,64],"ice":[],"treasures":[22,60,96],"areas":[{"id":"room-1","title":"Shutter Keep"},{"id":"room-2","title":"Blue Lock Gallery"},{"id":"room-3","title":"Key of the Keep"}],"passages":[{"a":34,"b":67},{"a":63,"b":103}],"parPushes":14,"keys":[{"color":"blue","cell":85}],"doors":[{"color":"blue","cell":65}]},{"id":"astral-01","version":1,"order":31,"chapter":6,"title":"A Fold in the Room","lesson":"Rifts move you, not runestones. Use the fold to reach the pushing side.","mechanic":"rifts","width":6,"height":6,"walls":[0,1,2,3,4,5,6,9,10,11,12,14,15,16,17,18,28,30,32,33,34,35,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,56,57,58,59,64,65,66,68,69,70,71],"start":26,"exit":27,"stones":[{"id":"area-0-rune-1","color":"red","cell":22},{"id":"area-1-rune-1","color":"blue","cell":55}],"sigils":[{"color":"red","cell":7},{"color":"blue","cell":43}],"plates":[],"gates":[],"ice":[],"treasures":[24,60],"areas":[{"id":"room-1","title":"Folded Hall"},{"id":"room-2","title":"Quiet Annex"}],"passages":[{"a":31,"b":67},{"a":8,"b":29,"kind":"rift"}],"parPushes":7},{"id":"astral-02","version":1,"order":32,"chapter":6,"title":"The Rift at the Last Turn","lesson":"A rift can reach a pushing position that an ordinary corridor cannot.","mechanic":"rifts","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,15,17,18,20,21,30,32,33,34,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,56,57,58,59,64,65,66,68,69,70,71],"start":8,"exit":9,"stones":[{"id":"area-0-rune-1","color":"gold","cell":16},{"id":"area-1-rune-1","color":"blue","cell":55}],"sigils":[{"color":"gold","cell":7},{"color":"blue","cell":43}],"plates":[],"gates":[],"ice":[],"treasures":[24,60],"areas":[{"id":"room-1","title":"Star Turning Room"},{"id":"room-2","title":"Blue Annex"}],"passages":[{"a":35,"b":67},{"a":14,"b":31,"kind":"rift"}],"parPushes":10},{"id":"astral-03","version":1,"order":33,"chapter":6,"title":"Return Through Starlight","lesson":"Carry a key through the fold, then come back to release the waiting rune.","mechanic":"rifts","width":6,"height":6,"walls":[0,1,2,3,4,5,6,9,10,11,12,14,15,16,17,18,28,30,32,33,34,35,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,66,68,69,70,71],"start":26,"exit":27,"stones":[{"id":"area-0-rune-1","color":"red","cell":22},{"id":"area-1-rune-1","color":"green","cell":58}],"sigils":[{"color":"red","cell":7},{"color":"green","cell":43}],"plates":[],"gates":[],"ice":[],"treasures":[24,60],"areas":[{"id":"room-1","title":"Folded Lock"},{"id":"room-2","title":"Green Key Gallery"}],"passages":[{"a":31,"b":67},{"a":8,"b":29,"kind":"rift"}],"parPushes":10,"keys":[{"color":"green","cell":49}],"doors":[{"color":"green","cell":23}]},{"id":"astral-04","version":1,"order":34,"chapter":6,"title":"The Frozen Constellation","lesson":"Ice carries stones; rifts carry you. Plan where each journey ends.","mechanic":"rifts","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,15,17,18,20,21,30,32,33,34,36,37,38,39,40,41,42,45,47,48,53,54,59,60,65,66,68,69,70,71],"start":8,"exit":9,"stones":[{"id":"area-0-rune-1","color":"gold","cell":16},{"id":"area-1-rune-1","color":"green","cell":49},{"id":"area-1-rune-2","color":"red","cell":50}],"sigils":[{"color":"gold","cell":7},{"color":"red","cell":46}],"plates":[43],"gates":[51,57,63],"ice":[51],"treasures":[24,62],"areas":[{"id":"room-1","title":"Folded Turning Room"},{"id":"room-2","title":"Frozen Shutter"}],"passages":[{"a":35,"b":67},{"a":14,"b":31,"kind":"rift"}],"parPushes":11},{"id":"astral-05","version":1,"order":35,"chapter":6,"title":"The Observatory Circuit","lesson":"Restore the counterweight, cross the fold, then recover the key behind the last seal.","mechanic":"rifts","width":6,"height":6,"walls":[0,1,2,3,4,5,6,9,10,11,12,14,15,16,17,18,28,30,32,33,34,35,36,37,38,39,40,41,42,45,47,48,53,54,59,60,65,66,68,69,70,71,72,73,74,75,76,77,78,80,81,82,83,84,86,87,88,89,90,92,93,94,95,100,101,102,104,105,106,107],"start":26,"exit":27,"stones":[{"id":"area-0-rune-1","color":"red","cell":22},{"id":"area-1-rune-1","color":"green","cell":49},{"id":"area-1-rune-2","color":"red","cell":50},{"id":"area-2-rune-1","color":"blue","cell":91}],"sigils":[{"color":"red","cell":7},{"color":"red","cell":46},{"color":"blue","cell":79}],"plates":[43],"gates":[51,57,63,97],"ice":[51],"treasures":[24,62,96],"areas":[{"id":"room-1","title":"Star Lock"},{"id":"room-2","title":"Frozen Counterweight"},{"id":"room-3","title":"Green Key Shrine"}],"passages":[{"a":31,"b":67},{"a":64,"b":103},{"a":8,"b":29,"kind":"rift"}],"parPushes":10,"keys":[{"color":"green","cell":85}],"doors":[{"color":"green","cell":23}]},{"id":"astral-06","version":1,"order":36,"chapter":6,"title":"The Living Hollow","lesson":"Every discovery has a purpose. Read the three rooms before sealing the final route.","mechanic":"rifts","width":6,"height":6,"walls":[0,1,2,3,4,5,6,11,12,15,17,18,20,21,30,32,33,34,36,37,38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,66,68,69,70,71,72,73,74,75,76,77,78,80,81,82,83,84,86,87,88,89,90,92,93,94,95,100,101,102,104,105,106,107],"start":8,"exit":9,"stones":[{"id":"area-0-rune-1","color":"gold","cell":16},{"id":"area-1-rune-1","color":"red","cell":58},{"id":"area-2-rune-1","color":"blue","cell":91}],"sigils":[{"color":"gold","cell":7},{"color":"red","cell":43},{"color":"blue","cell":79}],"plates":[43],"gates":[23],"ice":[],"treasures":[24,60,96],"areas":[{"id":"room-1","title":"The Last Turning Room"},{"id":"room-2","title":"Keeper's Red Gallery"},{"id":"room-3","title":"Green Key Sanctuary"}],"passages":[{"a":35,"b":67},{"a":63,"b":103},{"a":14,"b":31,"kind":"rift"}],"parPushes":15,"keys":[{"color":"green","cell":85}],"doors":[{"color":"green","cell":65}]}]$rune_adventures$::jsonb) loop
    if (entry->>'order')::integer not between 19 and 36 then raise exception 'invalid_adventure_ordinal'; end if;
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
-- END_ADVENTURE_DEFINITIONS_SEED

commit;
