-- Afterimage v1 extends DH Showdown's existing identity, frozen content,
-- notifications, ranked states and result workflow. No parallel challenge system.
begin;

insert into public.showdown_games(game_key,name,description,current_rules_version,enabled)
values('afterimage','Afterimage','Study an illustrated scene. Restore what vanished. Play three rounds on your time.',1,true)
on conflict(game_key) do update set name=excluded.name,description=excluded.description;
insert into public.showdown_rules(game_key,rules_version,scoring_key,round_count)
values('afterimage',1,'afterimage_v1',3) on conflict(game_key,rules_version) do nothing;

-- A mirror minimum is not meaningful for a memory scene. Existing Prism rows
-- retain their verified values and publishing still independently verifies them.
alter table public.showdown_puzzles alter column minimum_rotations drop not null;
alter table public.showdown_challenge_rounds alter column minimum_rotations drop not null;
alter table public.showdown_round_states
  add column if not exists study_started_at timestamptz,
  add column if not exists study_expires_at timestamptz,
  add column if not exists placements jsonb not null default '[]',
  add column if not exists correct_count integer,
  add column if not exists perfect boolean;
alter table public.showdown_round_states add constraint afterimage_study_interval check(
  (study_started_at is null and study_expires_at is null) or
  (study_started_at is not null and study_expires_at is not null and study_expires_at=study_started_at+interval '7 seconds'));
alter table public.showdown_round_states add constraint afterimage_placement_array check(jsonb_typeof(placements)='array' and jsonb_array_length(placements)<=5);
alter table public.showdown_round_states add constraint afterimage_correct_count check(correct_count is null or correct_count between 0 and 5);
alter table public.showdown_round_states add constraint afterimage_score_pair check((correct_count is null)=(perfect is null));

-- Match ECMAScript String.trim for authored labels and accessibility text,
-- including tabs, line endings and Unicode whitespace rather than spaces only.
create or replace function public.afterimage_trim_v1(p_value text) returns text
language sql immutable set search_path=public,pg_temp as $$
  select btrim(p_value,' '||chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(160)||chr(5760)||
    chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||
    chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279))
$$;

create or replace function public.afterimage_validate_v1(p_definition jsonb) returns void
language plpgsql immutable set search_path=public,pg_temp as $$
declare d text:=p_definition->>'difficulty'; expected_objects integer;expected_missing integer;expected_distractors integer;
  piece jsonb;other jsonb;slot jsonb;ids text[]:=array[]::text[];assets text[]:=array[]::text[];labels text[]:=array[]::text[];object_ids text[]:=array[]::text[];
  slot_ids text[]:=array[]::text[];missing text[];tray_ids text[];
  allowed_assets text[]:=array['book','lantern','key','orb','flask','compass','cup','clock','flower','shell','anchor','fish','bell','telescope','candle','teapot','crown','crystal','quill','globe','scroll','acorn','pear','watering_can','gear','bottle','star','map','satchel','feather'];
  themes text[]:=array['workshop','greenhouse','harbor','clockmaker','kitchen','observatory'];
begin
  if jsonb_typeof(p_definition) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_definition) k where k not in('id','version','difficulty','width','height','title','theme','background','objects','missingIds','distractors','slots','trayOrder','a11y')) then raise exception 'Invalid Afterimage scene';end if;
  if jsonb_typeof(p_definition->'id') is distinct from 'string' or coalesce(p_definition->>'id','')!~'^[a-z0-9][a-z0-9_-]{0,95}$' or jsonb_typeof(p_definition->'version') is distinct from 'number' or coalesce(p_definition->>'version','')!~'^[1-9][0-9]*$'
    or jsonb_typeof(p_definition->'width') is distinct from 'number' or p_definition->>'width'<>'1000' or jsonb_typeof(p_definition->'height') is distinct from 'number' or p_definition->>'height'<>'700'
    or jsonb_typeof(p_definition->'title') is distinct from 'string' or public.afterimage_trim_v1(p_definition->>'title')='' or length(p_definition->>'title')>80
    or not(coalesce(p_definition->>'theme','')=any(themes)) or not(coalesce(p_definition->>'background','')=any(themes)) then raise exception 'Invalid Afterimage scene metadata';end if;
  expected_objects:=case d when 'easy' then 9 when 'medium' then 12 when 'hard' then 15 end;
  expected_missing:=case d when 'easy' then 3 when 'medium' then 4 when 'hard' then 5 end;
  expected_distractors:=case d when 'easy' then 0 when 'medium' then 1 when 'hard' then 2 end;
  if expected_objects is null or jsonb_typeof(p_definition->'objects') is distinct from 'array' or jsonb_array_length(p_definition->'objects')<>expected_objects
    or jsonb_typeof(p_definition->'missingIds') is distinct from 'array' or jsonb_array_length(p_definition->'missingIds')<>expected_missing
    or jsonb_typeof(p_definition->'distractors') is distinct from 'array' or jsonb_array_length(p_definition->'distractors')<>expected_distractors
    or jsonb_typeof(p_definition->'slots') is distinct from 'array' or jsonb_array_length(p_definition->'slots')<>expected_missing
    or jsonb_typeof(p_definition->'trayOrder') is distinct from 'array' or jsonb_array_length(p_definition->'trayOrder')<>expected_missing+expected_distractors then raise exception 'Invalid Afterimage scene counts';end if;
  if jsonb_typeof(p_definition->'a11y') is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_definition->'a11y') k where k not in('label','instructions'))
    or jsonb_typeof(p_definition->'a11y'->'label') is distinct from 'string' or public.afterimage_trim_v1(p_definition->'a11y'->>'label')='' or length(p_definition->'a11y'->>'label')>160
    or jsonb_typeof(p_definition->'a11y'->'instructions') is distinct from 'string' or public.afterimage_trim_v1(p_definition->'a11y'->>'instructions')='' or length(p_definition->'a11y'->>'instructions')>320 then raise exception 'Invalid scene accessibility text';end if;
  for piece in select value from jsonb_array_elements((p_definition->'objects')||(p_definition->'distractors')) loop
    if jsonb_typeof(piece) is distinct from 'object' or exists(select 1 from jsonb_object_keys(piece) k where k not in('id','assetId','label','orientation','variant','x','y','layer'))
      or jsonb_typeof(piece->'id') is distinct from 'string' or coalesce(piece->>'id','')!~'^[a-z0-9][a-z0-9_-]{0,95}$' or (piece->>'id')=any(ids)
      or not(coalesce(piece->>'assetId','')=any(allowed_assets)) or (piece->>'assetId')=any(assets)
      or jsonb_typeof(piece->'label') is distinct from 'string' or public.afterimage_trim_v1(piece->>'label')='' or length(piece->>'label')>80 or lower(public.afterimage_trim_v1(piece->>'label'))=any(labels) then raise exception 'Invalid or ambiguous scene object';end if;
    if piece?'orientation' and (jsonb_typeof(piece->'orientation') is distinct from 'number' or (piece->>'orientation')::numeric not between -360 and 360) then raise exception 'Invalid object orientation';end if;
    if piece?'variant' and (jsonb_typeof(piece->'variant') is distinct from 'string' or public.afterimage_trim_v1(piece->>'variant')='' or length(piece->>'variant')>40) then raise exception 'Invalid object variant';end if;
    ids:=array_append(ids,piece->>'id');assets:=array_append(assets,piece->>'assetId');labels:=array_append(labels,lower(public.afterimage_trim_v1(piece->>'label')));
  end loop;
  for piece in select value from jsonb_array_elements(p_definition->'objects') loop
    if jsonb_typeof(piece->'x') is distinct from 'number' or jsonb_typeof(piece->'y') is distinct from 'number' or (piece->>'x')::numeric not between 90 and 910 or (piece->>'y')::numeric not between 80 and 620
      or jsonb_typeof(piece->'layer') is distinct from 'number' or coalesce(piece->>'layer','')!~'^(0|[1-9][0-9]?|100)$' then raise exception 'Scene object is outside the illustration';end if;
    object_ids:=array_append(object_ids,piece->>'id');
    for other in select value from jsonb_array_elements(p_definition->'objects') where value->>'id'>piece->>'id' loop
      if abs((piece->>'x')::numeric-(other->>'x')::numeric)<160 and abs((piece->>'y')::numeric-(other->>'y')::numeric)<150 then raise exception 'Scene objects overlap';end if;
    end loop;
  end loop;
  for piece in select value from jsonb_array_elements(p_definition->'distractors') loop
    if piece?'x' or piece?'y' or piece?'layer' then raise exception 'Distractors cannot carry canonical positions';end if;
  end loop;
  if exists(select 1 from jsonb_array_elements((p_definition->'missingIds')||(p_definition->'trayOrder')) v where jsonb_typeof(v) is distinct from 'string') then raise exception 'Object and tray identities must be strings';end if;
  select array_agg(value) into missing from jsonb_array_elements_text(p_definition->'missingIds');
  if (select count(*)<>count(distinct value) from jsonb_array_elements(p_definition->'missingIds')) or exists(select 1 from unnest(missing) m where not(m=any(object_ids))) then raise exception 'Invalid missing-object set';end if;
  for slot in select value from jsonb_array_elements(p_definition->'slots') loop
    if jsonb_typeof(slot) is distinct from 'object' or exists(select 1 from jsonb_object_keys(slot) k where k not in('id','objectId','x','y','width','height','label','layer'))
      or jsonb_typeof(slot->'id') is distinct from 'string' or jsonb_typeof(slot->'objectId') is distinct from 'string' or coalesce(slot->>'id','')!~'^[a-z0-9][a-z0-9_-]{0,95}$' or (slot->>'id')=any(ids||slot_ids) or not(coalesce(slot->>'objectId','')=any(missing))
      or jsonb_typeof(slot->'x') is distinct from 'number' or jsonb_typeof(slot->'y') is distinct from 'number'
      or jsonb_typeof(slot->'width') is distinct from 'number' or slot->>'width'<>'180' or jsonb_typeof(slot->'height') is distinct from 'number' or slot->>'height'<>'160'
      or jsonb_typeof(slot->'layer') is distinct from 'number' or coalesce(slot->>'layer','')!~'^(0|[1-9][0-9]?|100)$'
      or jsonb_typeof(slot->'label') is distinct from 'string' or public.afterimage_trim_v1(slot->>'label')='' or length(slot->>'label')>80 then raise exception 'Invalid reconstruction slot';end if;
    select value into piece from jsonb_array_elements(p_definition->'objects') where value->>'id'=slot->>'objectId';
    if (slot->>'x')::numeric<>(piece->>'x')::numeric or (slot->>'y')::numeric<>(piece->>'y')::numeric or (slot->>'layer')::integer<>(piece->>'layer')::integer then raise exception 'Slot does not match its original location';end if;
    if exists(select 1 from jsonb_array_elements((p_definition->'objects')||(p_definition->'distractors')) p where position(lower(public.afterimage_trim_v1(p->>'label')) in lower(public.afterimage_trim_v1(slot->>'label')))>0 or position(p->>'id' in slot->>'id')>0) then raise exception 'Slot labels and identities must be neutral';end if;
    for other in select value from jsonb_array_elements(p_definition->'slots') where value->>'id'>slot->>'id' loop
      if abs((slot->>'x')::numeric-(other->>'x')::numeric)<188 and abs((slot->>'y')::numeric-(other->>'y')::numeric)<168 then raise exception 'Reconstruction slots overlap';end if;
    end loop;
    for other in select value from jsonb_array_elements(p_definition->'objects') where not(value->>'id'=any(missing)) loop
      if abs((slot->>'x')::numeric-(other->>'x')::numeric)<168 and abs((slot->>'y')::numeric-(other->>'y')::numeric)<153 then raise exception 'A fixed object overlaps a reconstruction slot';end if;
    end loop;
    slot_ids:=array_append(slot_ids,slot->>'id');
  end loop;
  if (select count(distinct value->>'objectId') from jsonb_array_elements(p_definition->'slots'))<>expected_missing then raise exception 'Every missing object needs exactly one slot';end if;
  select array_agg(value) into tray_ids from jsonb_array_elements_text(p_definition->'trayOrder');
  if (select count(*)<>count(distinct value) from jsonb_array_elements(p_definition->'trayOrder')) or exists(select 1 from unnest(tray_ids) t where not(t=any(missing)) and not exists(select 1 from jsonb_array_elements(p_definition->'distractors') o where o->>'id'=t)) then raise exception 'Invalid frozen tray order';end if;
end $$;

create or replace function public.afterimage_validate_placements_v1(p_definition jsonb,p_placements jsonb) returns void
language plpgsql immutable set search_path=public,pg_temp as $$
declare placement jsonb;objects text[]:=array[]::text[];slots text[]:=array[]::text[];
begin
  if p_placements is null or jsonb_typeof(p_placements) is distinct from 'array' or jsonb_array_length(p_placements)>jsonb_array_length(p_definition->'slots') then raise exception 'Invalid reconstruction placements';end if;
  for placement in select value from jsonb_array_elements(p_placements) loop
    if jsonb_typeof(placement) is distinct from 'object' or exists(select 1 from jsonb_object_keys(placement) k where k not in('object_id','slot_id'))
      or jsonb_typeof(placement->'object_id') is distinct from 'string' or jsonb_typeof(placement->'slot_id') is distinct from 'string'
      or not(p_definition->'trayOrder' ? (placement->>'object_id')) or not exists(select 1 from jsonb_array_elements(p_definition->'slots') s where s->>'id'=placement->>'slot_id')
      or (placement->>'object_id')=any(objects) or (placement->>'slot_id')=any(slots) then raise exception 'Each tray object and slot may be used once';end if;
    objects:=array_append(objects,placement->>'object_id');slots:=array_append(slots,placement->>'slot_id');
  end loop;
end $$;
create or replace function public.afterimage_score_v1(p_definition jsonb,p_placements jsonb) returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $$
declare n integer:=jsonb_array_length(p_definition->'slots');correct integer;perfect boolean;
begin
  perform public.afterimage_validate_placements_v1(p_definition,p_placements);
  select count(*) into correct from jsonb_array_elements(p_placements) p join jsonb_array_elements(p_definition->'slots') s on s->>'id'=p->>'slot_id' and s->>'objectId'=p->>'object_id';
  perfect:=correct=n and jsonb_array_length(p_placements)=n;
  return jsonb_build_object('score',floor(100.0*correct/n+0.5)::integer+case when perfect then 25 else 0 end,'correct_count',correct,'required_count',n,'perfect',perfect);
end $$;

-- Keep the installed Prism implementation intact behind private base helpers;
-- replace the original OIDs so existing cached callers use the new dispatcher.
do $extend$
declare definition text;anchor text;
begin
  if to_regprocedure('public.showdown_snapshot_v1_base(uuid)') is null then
    definition:=pg_get_functiondef('public.showdown_snapshot(uuid)'::regprocedure);
    if position('afterimage_snapshot_v1' in definition)>0 then raise exception 'Showdown snapshot base needs review';end if;
    execute replace(definition,'FUNCTION public.showdown_snapshot(','FUNCTION public.showdown_snapshot_v1_base(');
  end if;
  if to_regprocedure('public.showdown_summary_v1_base(uuid)') is null then
    definition:=pg_get_functiondef('public.showdown_summary(uuid)'::regprocedure);
    if position('showdown_summary_v1_base' in definition)>0 then raise exception 'Showdown summary base needs review';end if;
    execute replace(definition,'FUNCTION public.showdown_summary(','FUNCTION public.showdown_summary_v1_base(');
  end if;
  definition:=pg_get_functiondef('public.showdown_create(uuid,text,uuid,uuid)'::regprocedure);
  if position('afterimage_v1' in definition)=0 then
    anchor:='scoring_key=''prism_v1'' and round_count=3';
    if position(anchor in definition)=0 then raise exception 'Showdown creation adapter changed; review before extending';end if;
    execute replace(definition,anchor,'scoring_key in(''prism_v1'',''afterimage_v1'') and round_count=3');
  end if;
  definition:=pg_get_functiondef('public.showdown_guard_puzzle()'::regprocedure);
  if position('afterimage_validate_v1' in definition)=0 then
    anchor:='if new.game_key<>''prism_break'' or new.rules_version<>1 then raise exception ''Unsupported puzzle rules'';end if;';
    if position(anchor in definition)=0 then raise exception 'Showdown publication guard changed; review before extending';end if;
    definition:=replace(definition,anchor,$adapter$
    if new.game_key='afterimage' and new.rules_version=1 then
      if (new.definition->>'id') is distinct from new.puzzle_id or (new.definition->>'version')::integer is distinct from new.puzzle_version
        or (new.definition->>'difficulty') is distinct from new.difficulty or new.minimum_rotations is not null
        or jsonb_typeof(new.validation) is distinct from 'object' or new.validation->'validated' is distinct from 'true'::jsonb then
        raise exception 'Afterimage validation metadata is required';
      end if;
      perform public.afterimage_validate_v1(new.definition);
      return new;
    elsif new.game_key<>'prism_break' or new.rules_version<>1 then raise exception 'Unsupported puzzle rules';end if;
    $adapter$);
    anchor:='if minimum is null or minimum<1 or minimum<>new.minimum_rotations then';
    if position(anchor in definition)=0 then raise exception 'Prism minimum validator changed; review before extending';end if;
    definition:=replace(definition,anchor,'if new.minimum_rotations is null or minimum is null or minimum<1 or minimum<>new.minimum_rotations then');
    execute definition;
  end if;
end $extend$;

create or replace function public.afterimage_round_view_v1(p_id uuid,p_user uuid,p_round integer) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select public.showdown_round_view(p_id,p_user,p_round)||jsonb_build_object('placements',s.placements,
    'study_started_at',s.study_started_at,'study_expires_at',s.study_expires_at,
    'correct_count',case when s.submitted then s.correct_count else null end,
    'perfect',case when s.submitted then s.perfect else null end)
  from public.showdown_round_states s where s.challenge_id=p_id and s.user_id=p_user and s.round_number=p_round
$$;
create or replace function public.afterimage_scene_view_v1(p_definition jsonb,p_started_at timestamptz,p_expires_at timestamptz,p_submitted boolean,p_completed boolean,p_server_now timestamptz) returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $$
declare phase text;result jsonb;objects jsonb:='[]';slots jsonb:='[]';tray jsonb:='[]';
begin
  phase:=case when p_completed then 'review' when p_submitted then 'submitted' when p_started_at is null then 'ready' when p_server_now<p_expires_at then 'study' else 'reconstruct' end;
  if phase in('study','review') then objects:=p_definition->'objects';
  elsif phase in('reconstruct','submitted') then
    select coalesce(jsonb_agg(value order by ord),'[]') into objects from jsonb_array_elements(p_definition->'objects') with ordinality x(value,ord) where not(p_definition->'missingIds' ? (value->>'id'));
  end if;
  if phase in('reconstruct','submitted','review') then
    select coalesce(jsonb_agg(value-'objectId' order by ord),'[]') into slots from jsonb_array_elements(p_definition->'slots') with ordinality x(value,ord);
    select coalesce(jsonb_agg(p.value-'x'-'y'-'layer' order by t.ord),'[]') into tray
      from jsonb_array_elements_text(p_definition->'trayOrder') with ordinality t(id,ord)
      join jsonb_array_elements((p_definition->'objects')||(p_definition->'distractors')) p(value) on p.value->>'id'=t.id;
  end if;
  result:=jsonb_build_object('id',p_definition->>'id','version',(p_definition->>'version')::integer,'difficulty',p_definition->>'difficulty','title',p_definition->>'title',
    'width',1000,'height',700,'theme',p_definition->>'theme','background',p_definition->>'background','a11y',p_definition->'a11y',
    'phase',phase,'objects',objects,'slots',slots,'tray',tray,'study_started_at',p_started_at,'study_expires_at',p_expires_at,'server_now',p_server_now);
  if phase='review' then
    result:=result||jsonb_build_object('answers',(select jsonb_agg(jsonb_build_object('object_id',value->>'objectId','slot_id',value->>'id') order by ord) from jsonb_array_elements(p_definition->'slots') with ordinality x(value,ord)));
  end if;
  return result;
end $$;

create or replace function public.showdown_summary(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb:=public.showdown_summary_v1_base(p_id);players jsonb;
begin
  if result->>'game_key'='afterimage' then
    select jsonb_agg(value||jsonb_build_object('perfect_count',case when value->>'user_id'=auth.uid()::text or result->>'status'='completed' then value->'solved_count' else 'null'::jsonb end) order by ord)
      into players from jsonb_array_elements(result->'players') with ordinality x(value,ord);
    result:=jsonb_set(result,'{players}',players);
  end if;
  return result;
end $$;
create or replace function public.afterimage_snapshot_v1(p_id uuid,p_server_now timestamptz) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;current_round integer;opponent uuid;started timestamptz;
begin
  select * into c from public.showdown_challenges where id=p_id;
  opponent:=case when c.challenger_id=auth.uid() then c.recipient_id else c.challenger_id end;
  select min(round_number) into current_round from public.showdown_round_states where challenge_id=c.id and user_id=auth.uid() and not submitted;
  select started_at into started from public.showdown_attempts where challenge_id=c.id and user_id=auth.uid();
  return jsonb_build_object('challenge',public.showdown_summary(c.id),'current_round',current_round,'server_now',p_server_now,
    'can_play',c.status in('pending','active') and started is not null and current_round is not null,
    'can_decline',c.status in('pending','active') and auth.uid()=c.recipient_id and started is null,
    'can_cancel',c.status in('pending','active') and auth.uid()=c.challenger_id and exists(select 1 from public.showdown_attempts where challenge_id=c.id and user_id=c.recipient_id and started_at is null),
    'readonly_reason',case when c.status in('declined','cancelled','expired') then coalesce(c.closed_reason,'This challenge is closed.') when c.status='completed' then null when current_round is null then 'Your attempt is sealed. Waiting for your opponent.' else null end,
    'record',public.showdown_record(auth.uid(),c.club_id,c.game_key),
    'rivalry',(public.showdown_profile(opponent,c.club_id)-'user_id')||jsonb_build_object('opponent_id',opponent)||public.showdown_record(auth.uid(),c.club_id,c.game_key,opponent),
    'rounds',(select jsonb_agg(jsonb_build_object('round_number',r.round_number,'difficulty',r.difficulty,'puzzle_id',r.puzzle_id,'puzzle_version',r.puzzle_version,'title',r.title,
      'puzzle',null,'minimum_rotations',null,
      'scene',case when c.status in('cancelled','declined','expired') then null when c.status='completed' or r.round_number<=coalesce(current_round,3) then public.afterimage_scene_view_v1(r.definition,s.study_started_at,s.study_expires_at,s.submitted,c.status='completed',p_server_now) else null end,
      'me',public.afterimage_round_view_v1(c.id,auth.uid(),r.round_number),
      'opponent',case when c.status='completed' then public.afterimage_round_view_v1(c.id,opponent,r.round_number) else null end) order by r.round_number)
      from public.showdown_challenge_rounds r join public.showdown_round_states s on s.challenge_id=r.challenge_id and s.round_number=r.round_number and s.user_id=auth.uid() where r.challenge_id=c.id));
end $$;
create or replace function public.showdown_snapshot(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare game text;moment timestamptz:=clock_timestamp();
begin
  select game_key into game from public.showdown_challenges where id=p_id;
  if game='afterimage' then return public.afterimage_snapshot_v1(p_id,moment);end if;
  return public.showdown_snapshot_v1_base(p_id)||jsonb_build_object('server_now',moment);
end $$;

create or replace function public.afterimage_clock_guard() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if old.study_started_at is not null and (new.study_started_at is distinct from old.study_started_at or new.study_expires_at is distinct from old.study_expires_at) then raise exception 'The study window cannot be restarted';end if;
  if old.study_started_at is null and new.study_started_at is not null and not exists(select 1 from public.showdown_challenges where id=new.challenge_id and game_key='afterimage' and rules_version=1) then raise exception 'This game has no study phase';end if;
  return new;
end $$;
create trigger afterimage_clock_guard before update on public.showdown_round_states for each row execute function public.afterimage_clock_guard();

create or replace function public.afterimage_lock_challenge_v1(p_id uuid) returns public.showdown_challenges
language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.showdown_actor_club();c public.showdown_challenges%rowtype;
begin
  select * into c from public.showdown_challenges where id=p_id and club_id=cid and auth.uid() in(challenger_id,recipient_id)
    and public.dh_visible_member(challenger_id) and public.dh_visible_member(recipient_id);
  if not found then raise exception 'Challenge unavailable' using errcode='42501';end if;
  perform public.showdown_lock_members(cid,c.challenger_id,c.recipient_id);
  if not public.showdown_member_valid(cid,auth.uid()) then raise exception 'Active club membership required' using errcode='42501';end if;
  select * into c from public.showdown_challenges where id=p_id and club_id=cid and auth.uid() in(challenger_id,recipient_id)
    and public.dh_visible_member(challenger_id) and public.dh_visible_member(recipient_id) for update;
  if not found then raise exception 'Challenge unavailable' using errcode='42501';end if;
  if c.game_key<>'afterimage' or c.rules_version<>1 then raise exception 'This challenge uses different game controls';end if;
  perform public.showdown_reconcile(c.id);select * into c from public.showdown_challenges where id=p_id;
  return c;
end $$;
create or replace function public.afterimage_finish_attempt_v1(p_id uuid,p_user uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;a public.showdown_attempts%rowtype;b public.showdown_attempts%rowtype;opponent uuid;winner uuid;game_name text;
begin
  select * into c from public.showdown_challenges where id=p_id;
  update public.showdown_attempts set total_score=(select coalesce(sum(score),0) from public.showdown_round_states where challenge_id=c.id and user_id=p_user),
    solved_count=(select count(*) from public.showdown_round_states where challenge_id=c.id and user_id=p_user and submitted and perfect),rotations=0,
    finished_at=case when not exists(select 1 from public.showdown_round_states where challenge_id=c.id and user_id=p_user and not submitted) then clock_timestamp() else null end
    where challenge_id=c.id and user_id=p_user;
  select * into a from public.showdown_attempts where challenge_id=c.id and user_id=p_user;
  opponent:=case when c.challenger_id=p_user then c.recipient_id else c.challenger_id end;
  select * into b from public.showdown_attempts where challenge_id=c.id and user_id=opponent;
  if a.finished_at is not null and b.finished_at is null then
    perform public.showdown_notify(c.id,opponent,'attempt_finished','Your opponent has finished','Their score stays sealed until you finish your three scenes.');
  elsif a.finished_at is not null and b.finished_at is not null then
    -- Reconstruction accuracy and perfect rounds decide Afterimage. There is
    -- deliberately no rotation, speed, network or device-performance tiebreaker.
    winner:=case when a.total_score>b.total_score then a.user_id when b.total_score>a.total_score then b.user_id
      when a.solved_count>b.solved_count then a.user_id when b.solved_count>a.solved_count then b.user_id else null end;
    update public.showdown_challenges set status='completed',winner_id=winner,outcome=case when winner is null then 'draw' else 'winner' end,completed_at=clock_timestamp() where id=c.id;
    select name into game_name from public.showdown_games where game_key=c.game_key;
    perform public.showdown_notify(c.id,p_user,'result',game_name||' result',case when winner is null then 'A true draw. Open your scene-by-scene comparison.' when winner=p_user then 'You won this Showdown. Open your scene-by-scene comparison.' else 'Your rival won this Showdown. Open your scene-by-scene comparison.' end);
    perform public.showdown_notify(c.id,opponent,'result',game_name||' result',case when winner is null then 'A true draw. Open your scene-by-scene comparison.' when winner=opponent then 'You won this Showdown. Open your scene-by-scene comparison.' else 'Your rival won this Showdown. Open your scene-by-scene comparison.' end);
  end if;
end $$;

create or replace function public.showdown_start_study(p_challenge_id uuid,p_round_number integer,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;q public.showdown_requests%rowtype;s public.showdown_round_states%rowtype;
  actor uuid:=auth.uid();current_round integer;moment timestamptz;payload jsonb:=jsonb_build_object('round_number',p_round_number);
begin
  c:=public.afterimage_lock_challenge_v1(p_challenge_id);
  if p_request_id is null then raise exception 'Request identity required';end if;
  select * into q from public.showdown_requests where request_id=p_request_id;
  if found then
    if q.user_id<>actor or q.challenge_id<>c.id or q.operation<>'afterimage_study' or q.payload<>payload then raise exception 'Request identity already used';end if;
    return public.showdown_snapshot(c.id);
  end if;
  if c.status not in('pending','active') then return public.showdown_snapshot(c.id);end if;
  select * into s from public.showdown_round_states where challenge_id=c.id and user_id=actor and round_number=p_round_number for update;
  if not found then raise exception 'Round unavailable';end if;
  if s.submitted then return public.showdown_snapshot(c.id);end if;
  select min(round_number) into current_round from public.showdown_round_states where challenge_id=c.id and user_id=actor and not submitted;
  if p_round_number<>current_round then raise exception 'Finish the current round first';end if;
  if not exists(select 1 from public.showdown_attempts where challenge_id=c.id and user_id=actor and started_at is not null) then raise exception 'Open the challenge before playing';end if;
  if (select count(*) from public.showdown_requests where user_id=actor and created_at>now()-interval '1 minute')>=600 then raise exception 'Too many updates. Wait a moment.';end if;
  if s.study_started_at is null then
    moment:=clock_timestamp();
    update public.showdown_round_states set study_started_at=moment,study_expires_at=moment+interval '7 seconds',revision=revision+1
      where challenge_id=c.id and user_id=actor and round_number=p_round_number;
    update public.showdown_challenges set status='active' where id=c.id;
  end if;
  insert into public.showdown_requests values(p_request_id,c.club_id,actor,c.id,'afterimage_study',payload,now());
  return public.showdown_snapshot(c.id);
end $$;

create or replace function public.afterimage_write_reconstruction_v1(p_challenge_id uuid,p_round_number integer,p_placements jsonb,p_expected_revision integer,p_request_id uuid,p_finish boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;q public.showdown_requests%rowtype;s public.showdown_round_states%rowtype;r public.showdown_challenge_rounds%rowtype;
  actor uuid:=auth.uid();current_round integer;scored jsonb;op text:=case when p_finish then 'afterimage_submit' else 'afterimage_save' end;
  payload jsonb:=jsonb_build_object('round_number',p_round_number,'placements',p_placements,'expected_revision',p_expected_revision,'finish',p_finish);
begin
  c:=public.afterimage_lock_challenge_v1(p_challenge_id);
  if p_request_id is null then raise exception 'Request identity required';end if;
  select * into q from public.showdown_requests where request_id=p_request_id;
  if found then
    if q.user_id<>actor or q.challenge_id<>c.id or q.operation<>op or q.payload<>payload then raise exception 'Request identity already used';end if;
    return public.showdown_snapshot(c.id);
  end if;
  if c.status in('cancelled','declined','expired') then return public.showdown_snapshot(c.id);end if;
  select * into s from public.showdown_round_states where challenge_id=c.id and user_id=actor and round_number=p_round_number for update;
  if not found then raise exception 'Round unavailable';end if;
  if (select count(*) from public.showdown_requests where user_id=actor and created_at>now()-interval '1 minute')>=600 then raise exception 'Too many updates. Wait a moment.';end if;
  if s.submitted then
    if p_finish and s.placements=p_placements then
      insert into public.showdown_requests values(p_request_id,c.club_id,actor,c.id,op,payload,now());return public.showdown_snapshot(c.id);
    end if;
    raise exception 'This ranked round is already submitted';
  end if;
  if c.status='completed' then raise exception 'This challenge is already complete';end if;
  select min(round_number) into current_round from public.showdown_round_states where challenge_id=c.id and user_id=actor and not submitted;
  if p_round_number<>current_round then raise exception 'Finish the current round first';end if;
  if s.study_started_at is null then raise exception 'Start the study phase before reconstructing';end if;
  if clock_timestamp()<s.study_expires_at then raise exception 'The study phase is still active';end if;
  if p_expected_revision is null or s.revision<>p_expected_revision then raise exception 'Round changed on another device. Reload to continue.' using errcode='40001';end if;
  select * into r from public.showdown_challenge_rounds where challenge_id=c.id and round_number=p_round_number;
  perform public.afterimage_validate_placements_v1(r.definition,p_placements);
  if p_finish then scored:=public.afterimage_score_v1(r.definition,p_placements);end if;
  update public.showdown_round_states set placements=p_placements,revision=revision+case when placements=p_placements and not p_finish then 0 else 1 end,
    submitted=p_finish,skipped=false,solved=case when p_finish then (scored->>'perfect')::boolean else false end,
    score=case when p_finish then (scored->>'score')::integer else null end,correct_count=case when p_finish then (scored->>'correct_count')::integer else null end,
    perfect=case when p_finish then (scored->>'perfect')::boolean else null end,submitted_at=case when p_finish then clock_timestamp() else null end
    where challenge_id=c.id and user_id=actor and round_number=p_round_number;
  insert into public.showdown_requests values(p_request_id,c.club_id,actor,c.id,op,payload,now());
  if p_finish then perform public.afterimage_finish_attempt_v1(c.id,actor);end if;
  return public.showdown_snapshot(c.id);
end $$;
create or replace function public.showdown_save_reconstruction(p_challenge_id uuid,p_round_number integer,p_placements jsonb,p_expected_revision integer,p_request_id uuid) returns jsonb
language sql security definer set search_path=public,pg_temp as $$
  select public.afterimage_write_reconstruction_v1(p_challenge_id,p_round_number,p_placements,p_expected_revision,p_request_id,false)
$$;
create or replace function public.showdown_submit_reconstruction(p_challenge_id uuid,p_round_number integer,p_placements jsonb,p_expected_revision integer,p_request_id uuid) returns jsonb
language sql security definer set search_path=public,pg_temp as $$
  select public.afterimage_write_reconstruction_v1(p_challenge_id,p_round_number,p_placements,p_expected_revision,p_request_id,true)
$$;

-- A positive scored Afterimage reconstruction is real engagement, even if it
-- is not a perfect scene. Prism's positive-score qualification is unchanged.
do $metrics$
declare definition text;anchor text;
begin
  definition:=pg_get_functiondef('public.showdown_member_metrics(uuid,uuid)'::regprocedure);
  if position('a.solved_count>=1' in definition)>0 then
    execute replace(definition,'a.solved_count>=1','a.total_score>0');
  elsif position('a.total_score>0' in definition)=0 then raise exception 'Showdown engagement metrics changed; review before extending';end if;
  if to_regprocedure('public.dh_feat_metrics(uuid)') is not null then
    definition:=pg_get_functiondef('public.dh_feat_metrics(uuid)'::regprocedure);
    anchor:='where c.status=''completed'' and c.completed_at is not null and a.finished_at is not null and a.solved_count>=1';
    if position(anchor in definition)>0 then execute replace(definition,anchor,'where c.status=''completed'' and c.completed_at is not null and a.finished_at is not null and a.total_score>0');
    elsif position('showdown_completed_activity_days_v1' in definition)>0 and position('a.total_score>0' in definition)=0 then raise exception 'Showdown activity metrics changed; review before extending';end if;
  end if;
end $metrics$;
-- The prior installations already have this catalog. Isolated backend fixtures
-- may omit Feats entirely; their dedicated integration suite verifies this part.
do $catalog$
begin
  if to_regclass('public.dh_feat_catalog') is not null then
    update public.dh_feat_catalog set description='Finish Showdown matches with at least one point of your own. Both players must finish; zero-score attempts do not count.' where key='showdown_matches';
    update public.dh_feat_catalog set description='Win completed Showdown matches after scoring at least one point yourself. Cancelled, declined and expired invitations are excluded.' where key='showdown_wins';
    update public.dh_feat_catalog set description='Finish Showdown matches against different club rivals, scoring at least one point yourself. Repeat matches against one rival count once.' where key='showdown_rivals';
  end if;
end $catalog$;

-- Refresh discovery copy in place. Existing club installations, visibility,
-- ordering and configuration stay exactly as the club configured them.
do $discovery$
begin
  if to_regclass('public.platform_assets') is not null then
    update public.platform_assets set
      short_description='Three quick rounds. One club rivalry. Play on your time.',
      full_description='Challenge a club member to asynchronous head-to-head mini-games. Both players receive the same frozen content and can play at different times. Prism Break features three certified light-routing boards with authoritative rotation scoring. Afterimage gives each player seven seconds to study an illustrated scene, then restore its missing objects across three rounds. Both games include saved progress, sealed opponent scores, results, rivalry records and rematches. Overall Showdown standings use 3 points per win and 1 per draw, never incomparable raw game scores.',
      updated_at=now()
    where slug='dh-showdown';
  end if;
end $discovery$;

-- The existing six RPC grants remain. Only these three new gameplay endpoints
-- are callable by members; all canonical scene/scoring/timing handlers are private.
do $$ declare f record;
begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and
    (p.proname like 'afterimage_%' or p.proname in('showdown_snapshot_v1_base','showdown_summary_v1_base','showdown_start_study','showdown_save_reconstruction','showdown_submit_reconstruction')) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
grant execute on function public.showdown_start_study(uuid,integer,uuid),public.showdown_save_reconstruction(uuid,integer,jsonb,integer,uuid),public.showdown_submit_reconstruction(uuid,integer,jsonb,integer,uuid) to authenticated;

commit;
