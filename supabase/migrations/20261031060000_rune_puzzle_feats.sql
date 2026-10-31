-- Add source-backed spatial-puzzle goals without changing prior Feat receipts.
begin;
insert into public.dh_feat_catalog select * from jsonb_populate_recordset(null::public.dh_feat_catalog,$catalog$[{"key":"rune_puzzle_rooms","category":"rune","title":"Chamber Solver","description":"Solve distinct chambers in the current Rune Delve puzzle campaign. Replaying a room does not count twice.","thresholds":[1,6,12,18],"points":[5,10,15,25],"kind":"volume","unit":"count","sort_order":66},{"key":"rune_puzzle_stars","category":"rune","title":"Runic Perfection","description":"Collect stars across Rune Delve puzzle chambers. Each room contributes only its best result.","thresholds":[3,12,24,42,54],"points":[5,10,15,20,30],"kind":"mastery","unit":"count","sort_order":67}]$catalog$::jsonb)
on conflict(key) do update set category=excluded.category,title=excluded.title,description=excluded.description,
  thresholds=excluded.thresholds,points=excluded.points,kind=excluded.kind,unit=excluded.unit,sort_order=excluded.sort_order;

-- Patch the current evaluator, preserving all existing metrics and privacy
-- fixes. An upstream contract change fails explicitly rather than replacing
-- the complete function with a stale copied version.
do $patch$
declare
  definition text;
  metrics_anchor text:='  select count(*) into features from (values';
  feature_anchor text:='(greatest(dh_feat_number(m->>''rune_clears''),dh_feat_number(m->>''rune_expedition_rooms'')))';
  feature_replacement text:='(greatest(dh_feat_number(m->>''rune_clears''),dh_feat_number(m->>''rune_expedition_rooms''),dh_feat_number(m->>''rune_puzzle_rooms'')))';
  days_anchor text:='select (coalesce(last_played_at,completed_at,created_at) at time zone ''UTC'')::date from rune_delve_runs where user_id=uid and (clears>0 or dungeon_cleared) union';
begin
  definition:=pg_get_functiondef('public.dh_feat_metrics(uuid)'::regprocedure);
  if position('rune_puzzle_rooms' in definition)=0 then
    if position(metrics_anchor in definition)=0 or position(feature_anchor in definition)=0 or position(days_anchor in definition)=0 then
      raise exception 'DH Feats evaluator changed; review spatial puzzle source extension before applying';
    end if;
    definition:=replace(definition,metrics_anchor,$addition$
  with current_puzzles as (
    select r.room_id,max(r.stars) as stars from rune_puzzle_results r
      join rune_puzzle_definitions d on d.room_id=r.room_id and d.definition_version=r.definition_version and d.active
      where r.user_id=uid group by r.room_id
  ) select jsonb_build_object('rune_puzzle_rooms',count(*),'rune_puzzle_stars',coalesce(sum(stars),0)) into piece
    from current_puzzles;
  m:=m||piece;
  select count(*) into features from (values$addition$);
    definition:=replace(definition,feature_anchor,feature_replacement);
    -- Only successful server completion receipts exist in normal operation.
    -- Validate their bounded result shape as well; mutable last_completed_at
    -- and progress/profile reads never create activity days. Old completed
    -- versions remain valid historical activity after a definition retires.
    definition:=replace(definition,days_anchor,days_anchor||$days$
    select (pr.created_at at time zone 'UTC')::date from rune_puzzle_receipts pr
      where pr.user_id=uid and jsonb_typeof(pr.result->'stars')='number'
        and pr.result->>'stars' in ('1','2','3')
        and pr.result->>'roomId'=pr.room_id
        and pr.result->>'definitionVersion'=pr.definition_version::text union$days$);
    execute definition;
  elsif position('rune_puzzle_stars' in definition)=0 or position('from rune_puzzle_receipts pr' in definition)=0
      or position(feature_replacement in definition)=0 then
    raise exception 'DH Feats spatial puzzle extension is incomplete; review evaluator before applying';
  end if;
end $patch$;

drop trigger if exists dh_feat_dirty on public.rune_puzzle_results;
create trigger dh_feat_dirty after insert or update or delete on public.rune_puzzle_results
  for each row execute function public.dh_feat_dirty('user_id');
-- Invalidate sources only. Normal server evaluation awards any newly earned
-- tier through the existing permanent ledger; no direct awards or backfill.
update public.dh_feat_accounts set dirty=true where user_id in
  (select distinct user_id from public.rune_puzzle_results);
commit;
