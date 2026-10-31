-- New connected-adventure goals. Every existing family, tier and permanent
-- award stays unchanged; exploration does not inflate the clear counter.
begin;
insert into public.dh_feat_catalog(key,category,title,description,thresholds,points,kind,unit,sort_order) values
  ('rune_adventure_rooms','rune','Beyond the Seal',
   'Complete distinct connected-room adventures in chapters 4–6. Visiting areas or replaying an adventure does not add clears.',
   array[1,6,12,18],array[5,10,15,25],'volume','count',68),
  ('rune_adventure_stars','rune','Secrets of the Hollow',
   'Earn mastery stars in connected-room adventures. Each adventure contributes only its best result.',
   array[3,12,24,42,54],array[5,10,15,20,30],'mastery','count',69)
on conflict(key) do update set category=excluded.category,title=excluded.title,
  description=excluded.description,thresholds=excluded.thresholds,points=excluded.points,
  kind=excluded.kind,unit=excluded.unit,sort_order=excluded.sort_order;

do $patch$
declare definition text; anchor text:='  select count(*) into features from (values';
begin
  definition:=pg_get_functiondef('public.dh_feat_metrics(uuid)'::regprocedure);
  if position('rune_adventure_rooms' in definition)=0 then
    if position(anchor in definition)=0 or position('rune_puzzle_rooms' in definition)=0 then
      raise exception 'DH Feats evaluator changed; review adventure source extension before applying';
    end if;
    definition:=replace(definition,anchor,$addition$
  with current_adventures as (
    select r.room_id,max(r.stars) as stars from rune_puzzle_results r
      join rune_puzzle_definitions d using(room_id,definition_version)
      where r.user_id=uid and d.active and d.ordinal>18 group by r.room_id
  ) select jsonb_build_object('rune_adventure_rooms',count(*),'rune_adventure_stars',coalesce(sum(stars),0)) into piece
    from current_adventures;
  m:=m||piece;
  select count(*) into features from (values$addition$);
    execute definition;
  elsif position('rune_adventure_stars' in definition)=0 or position('from current_adventures' in definition)=0 then
    raise exception 'DH Feats adventure extension is incomplete; review evaluator before applying';
  end if;
end $patch$;
-- Normal source evaluation awards only newly earned tiers through the existing
-- ledger. Do not directly insert points or alter prior achievements.
update public.dh_feat_accounts set dirty=true where user_id in
  (select distinct user_id from public.rune_puzzle_results);

update public.platform_assets
set short_description='Explore connected rooms, restore runes and uncover the Hollow.',
    full_description='Explore 36 puzzle adventures across six chapters. Learn through a guided opening, then discover connected rooms, reusable keys, locked passages and spatial rifts. Combine them with pressure gates, sliding ice and guardians, uncover optional treasure, and master 108 stars. Free undo, restarts and hints support experimentation. The original combat modes and their saved progression remain in the clearly marked Combat Archive.',
    updated_at=now()
where slug='rune-delve'
  and (short_description,full_description) is distinct from (
    'Explore connected rooms, restore runes and uncover the Hollow.',
    'Explore 36 puzzle adventures across six chapters. Learn through a guided opening, then discover connected rooms, reusable keys, locked passages and spatial rifts. Combine them with pressure gates, sliding ice and guardians, uncover optional treasure, and master 108 stars. Free undo, restarts and hints support experimentation. The original combat modes and their saved progression remain in the clearly marked Combat Archive.');
commit;
