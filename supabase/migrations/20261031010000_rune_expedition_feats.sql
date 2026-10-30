-- Three new, source-backed Expedition families. Existing feat definitions,
-- progress and permanent unlock receipts are preserved.
begin;
insert into public.dh_feat_catalog select * from jsonb_populate_recordset(null::public.dh_feat_catalog,$catalog$[{"key":"rune_expedition_rooms","category":"rune","title":"Vault Wayfarer","description":"Bank cleared rooms in Rune Delve Expeditions. Abandoned and active runs do not count.","thresholds":[6,30,120,360,1200],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":63},{"key":"rune_expedition_clears","category":"rune","title":"Beyond the Seal","description":"Finish all six rooms and bank victorious Rune Delve Expeditions.","thresholds":[1,5,20,60,200],"points":[10,20,40,80,150],"kind":"volume","unit":"count","sort_order":64},{"key":"rune_expedition_ascension","category":"rune","title":"Rune Ascendant","description":"Clear higher Ascensions in Rune Delve Expeditions. The first descent is Ascension 1.","thresholds":[1,2,4,6,8],"points":[10,20,40,80,150],"kind":"mastery","unit":"count","sort_order":65}]$catalog$::jsonb)
on conflict(key) do update set category=excluded.category,title=excluded.title,description=excluded.description,
  thresholds=excluded.thresholds,points=excluded.points,kind=excluded.kind,unit=excluded.unit,sort_order=excluded.sort_order;

-- Extend the currently deployed evaluator instead of replacing unrelated
-- source/balance/privacy fixes with an older copied definition. Guards make a
-- changed upstream contract fail explicitly instead of dropping other metrics.
do $patch$
declare definition text; metrics_anchor text:='  select count(*) into features from (values';
  days_anchor text:='select (coalesce(last_played_at,completed_at,created_at) at time zone ''UTC'')::date from rune_delve_runs where user_id=uid and (clears>0 or dungeon_cleared) union';
begin
  definition:=pg_get_functiondef('public.dh_feat_metrics(uuid)'::regprocedure);
  if position('rune_expedition_rooms' in definition)=0 then
    if position(metrics_anchor in definition)=0 or position(days_anchor in definition)=0 or position('(dh_feat_number(m->>''rune_clears''))' in definition)=0 then
      raise exception 'DH Feats evaluator changed; review Expedition source extension before applying';
    end if;
    definition:=replace(definition,metrics_anchor,$addition$
  select jsonb_build_object('rune_expedition_rooms',coalesce(sum(rooms),0),
    'rune_expedition_clears',count(*) filter(where cleared),
    'rune_expedition_ascension',coalesce(max(ascension+1) filter(where cleared),0)) into piece
    from rune_delve_expedition_runs where user_id=uid and status='banked' and rooms>0;
  m:=m||piece;
  select count(*) into features from (values$addition$);
    definition:=replace(definition,'(dh_feat_number(m->>''rune_clears''))','(greatest(dh_feat_number(m->>''rune_clears''),dh_feat_number(m->>''rune_expedition_rooms'')))');
    definition:=replace(definition,days_anchor,days_anchor||E'\n    select (finished_at at time zone ''UTC'')::date from rune_delve_expedition_runs where user_id=uid and status=''banked'' and rooms>0 union');
    execute definition;
  end if;
end $patch$;

drop trigger if exists dh_feat_dirty on public.rune_delve_expedition_runs;
create trigger dh_feat_dirty after insert or update or delete on public.rune_delve_expedition_runs
  for each row execute function public.dh_feat_dirty('user_id');
-- Only source invalidation; normal server evaluation creates any earned
-- receipts. No direct award/backfill or monthly leaderboard writes.
update public.dh_feat_accounts set dirty=true where user_id in
  (select distinct user_id from public.rune_delve_expedition_runs where status='banked' and rooms>0);
commit;
