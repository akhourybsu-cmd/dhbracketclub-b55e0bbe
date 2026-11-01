-- DH Showdown: sealed asynchronous matches. All ranked writes are authoritative RPCs.
begin;

create table public.showdown_games (
  game_key text primary key check(game_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  name text not null, description text not null, current_rules_version integer not null check(current_rules_version>0),
  enabled boolean not null default true
);
create table public.showdown_rules (
  game_key text not null references public.showdown_games(game_key), rules_version integer not null check(rules_version>0),
  scoring_key text not null, round_count integer not null check(round_count between 1 and 10),
  primary key(game_key,rules_version)
);
insert into public.showdown_games values('prism_break','Prism Break','Turn crystal mirrors. Route every beam. Three boards, one rivalry.',1,true);
insert into public.showdown_rules values('prism_break',1,'prism_v1',3);
create table public.showdown_puzzles (
  game_key text not null, rules_version integer not null, puzzle_id text not null, puzzle_version integer not null check(puzzle_version>0),
  difficulty text not null check(difficulty in('easy','medium','hard')), title text not null,
  definition jsonb not null, minimum_rotations integer not null check(minimum_rotations between 1 and 16),
  validation jsonb not null, published boolean not null default false, sealed boolean not null default false, created_at timestamptz not null default now(),
  primary key(game_key,rules_version,puzzle_id,puzzle_version),
  foreign key(game_key,rules_version) references public.showdown_rules(game_key,rules_version)
);
create index showdown_puzzle_selection on public.showdown_puzzles(game_key,rules_version,difficulty) where published;
create table public.showdown_challenges (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
  game_key text not null, rules_version integer not null,
  challenger_id uuid not null references public.profiles(id), recipient_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '72 hours',
  status text not null default 'pending' check(status in('pending','active','completed','declined','cancelled','expired')),
  winner_id uuid references public.profiles(id), outcome text check(outcome in('winner','draw')),
  completed_at timestamptz, closed_reason text, rematch_of uuid references public.showdown_challenges(id),
  foreign key(game_key,rules_version) references public.showdown_rules(game_key,rules_version),
  check(challenger_id<>recipient_id), check(expires_at>created_at),
  check(winner_id is null or winner_id in(challenger_id,recipient_id)),
  check((status='completed')=(completed_at is not null and outcome is not null)),
  check((outcome='winner')=(winner_id is not null))
);
create index showdown_challenger_history on public.showdown_challenges(club_id,challenger_id,created_at desc,id desc);
create index showdown_recipient_history on public.showdown_challenges(club_id,recipient_id,created_at desc,id desc);
create index showdown_expiration on public.showdown_challenges(expires_at) where status in('pending','active');
create table public.showdown_challenge_rounds (
  challenge_id uuid not null references public.showdown_challenges(id), round_number integer not null check(round_number between 1 and 10),
  puzzle_id text not null, puzzle_version integer not null, difficulty text not null check(difficulty in('easy','medium','hard')),
  title text not null, definition jsonb not null, minimum_rotations integer not null check(minimum_rotations>0),
  primary key(challenge_id,round_number)
);
create table public.showdown_attempts (
  challenge_id uuid not null references public.showdown_challenges(id), user_id uuid not null references public.profiles(id),
  started_at timestamptz, finished_at timestamptz, total_score integer not null default 0 check(total_score between 0 and 1500),
  solved_count integer not null default 0 check(solved_count between 0 and 3), rotations integer not null default 0 check(rotations>=0),
  primary key(challenge_id,user_id)
);
create table public.showdown_round_states (
  challenge_id uuid not null, user_id uuid not null, round_number integer not null,
  actions jsonb not null default '[]' check(jsonb_typeof(actions)='array' and jsonb_array_length(actions)<=512),
  revision integer not null default 0 check(revision>=0), submitted boolean not null default false,
  skipped boolean not null default false, solved boolean not null default false,
  score integer check(score between 0 and 500), rotations integer not null default 0 check(rotations>=0), submitted_at timestamptz,
  primary key(challenge_id,user_id,round_number),
  foreign key(challenge_id,user_id) references public.showdown_attempts(challenge_id,user_id),
  foreign key(challenge_id,round_number) references public.showdown_challenge_rounds(challenge_id,round_number),
  check(submitted=(score is not null and submitted_at is not null)), check(not skipped or (submitted and score=0))
);
create table public.showdown_requests (
  request_id uuid primary key, club_id uuid not null references public.clubs(id), user_id uuid not null references public.profiles(id),
  challenge_id uuid not null references public.showdown_challenges(id), operation text not null, payload jsonb not null,
  created_at timestamptz not null default now()
);
create index showdown_request_throttle on public.showdown_requests(user_id,created_at desc);
create table public.showdown_events (
  challenge_id uuid not null references public.showdown_challenges(id), user_id uuid not null references public.profiles(id),
  event text not null check(event in('incoming','attempt_finished','result','expiring','rematch')),
  notification_id uuid references public.notifications(id) on delete set null, created_at timestamptz not null default now(),
  primary key(challenge_id,user_id,event)
);

-- No base-table API exposes frozen answers, opponent progress, or mutable scores.
do $$ declare t text; begin
  foreach t in array array['showdown_games','showdown_rules','showdown_puzzles','showdown_challenges','showdown_challenge_rounds','showdown_attempts','showdown_round_states','showdown_requests','showdown_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
create trigger zz_dh_private_guard before insert or update on public.showdown_challenges for each row execute function public.dh_private_write_guard('challenger_id','recipient_id','winner_id');
create trigger zz_dh_private_guard before insert or update on public.showdown_requests for each row execute function public.dh_private_write_guard('user_id');

create or replace function public.prism_trace_v1(p_definition jsonb,p_orientations jsonb default '{}') returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $$
declare w integer:=(p_definition->>'width')::integer; h integer:=(p_definition->>'height')::integer;
  tiles jsonb:=p_definition->'tiles'; tile jsonb; ray jsonb; rule jsonb; output jsonb; queue jsonb:='[]';
  visited text[]:=array[]::text[]; active integer[]:=array[]::integer[]; required integer:=0;
  cell integer; next_cell integer; d text; color text; orientation text; x integer; y integer; i integer; key text; matched boolean;
begin
  for i in 0..jsonb_array_length(tiles)-1 loop
    tile:=tiles->i;
    if tile->>'kind'='receiver' then required:=required+1; end if;
    if tile->>'kind'='emitter' then
      d:=tile->>'direction'; x:=i%w+case d when 'E' then 1 when 'W' then -1 else 0 end;
      y:=i/w+case d when 'S' then 1 when 'N' then -1 else 0 end;
      if x>=0 and x<w and y>=0 and y<h then queue:=queue||jsonb_build_array(jsonb_build_object('cell',y*w+x,'direction',d,'color',tile->>'color')); end if;
    end if;
  end loop;
  while jsonb_array_length(queue)>0 loop
    ray:=queue->0; queue:=queue-0; cell:=(ray->>'cell')::integer;d:=ray->>'direction';color:=ray->>'color';
    key:=cell::text||':'||d||':'||color;
    if key=any(visited) then continue; end if; visited:=array_append(visited,key);
    if cardinality(visited)>4096 then raise exception 'Beam state limit exceeded'; end if;
    tile:=tiles->cell;
    if tile->>'kind' in('wall','emitter') then continue;
    elsif tile->>'kind'='receiver' then
      if tile->>'color'=color and not(cell=any(active)) then active:=array_append(active,cell); end if;
      continue;
    elsif tile->>'kind'='mirror' then
      orientation:=case when coalesce((tile->>'rotatable')::boolean,false) then coalesce(p_orientations->>cell::text,tile->>'orientation') else tile->>'orientation' end;
      if orientation='/' then d:=case d when 'N' then 'E' when 'E' then 'N' when 'S' then 'W' when 'W' then 'S' end;
      else d:=case d when 'N' then 'W' when 'W' then 'N' when 'S' then 'E' when 'E' then 'S' end; end if;
    elsif tile->>'kind'='filter' then
      if not (tile->'accepts' ? color) then continue; end if; color:=coalesce(tile->>'output',color);
    elsif tile->>'kind'='splitter' then
      for rule in select value from jsonb_array_elements(tile->'rules') loop
        if rule->>'incoming'=d and rule->>'inputColor'=color then
          for output in select value from jsonb_array_elements(rule->'outputs') loop
            x:=cell%w+case output->>'direction' when 'E' then 1 when 'W' then -1 else 0 end;
            y:=cell/w+case output->>'direction' when 'S' then 1 when 'N' then -1 else 0 end;
            if x>=0 and x<w and y>=0 and y<h then queue:=queue||jsonb_build_array(jsonb_build_object('cell',y*w+x,'direction',output->>'direction','color',output->>'color')); end if;
          end loop;
        end if;
      end loop;
      continue;
    end if;
    x:=cell%w+case d when 'E' then 1 when 'W' then -1 else 0 end;
    y:=cell/w+case d when 'S' then 1 when 'N' then -1 else 0 end;
    if x>=0 and x<w and y>=0 and y<h then queue:=queue||jsonb_build_array(jsonb_build_object('cell',y*w+x,'direction',d,'color',color)); end if;
  end loop;
  return jsonb_build_object('solved',required>0 and cardinality(active)=required,'activated',to_jsonb(active),'required',required);
end $$;

create or replace function public.prism_validate_v1(p_definition jsonb) returns void
language plpgsql immutable set search_path=public,pg_temp as $$
declare tile jsonb; rule jsonb; output jsonb; k text; kind text; w integer;h integer; i integer; mirrors integer:=0;emitters integer:=0;receivers integer:=0;
  colors text[]:=array['cyan','magenta','gold','white','red','green','blue']; dirs text[]:=array['N','E','S','W']; keys text[];pairs text[];labels text[]:=array[]::text[];outputs_seen text[];
begin
  if jsonb_typeof(p_definition) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_definition) x where x not in('id','version','difficulty','width','height','tiles')) then raise exception 'Invalid puzzle definition'; end if;
  if jsonb_typeof(p_definition->'width') is distinct from 'number' or jsonb_typeof(p_definition->'height') is distinct from 'number' or (p_definition->>'width')!~'^([2-9]|10)$' or (p_definition->>'height')!~'^([2-9]|10)$' then raise exception 'Invalid puzzle dimensions'; end if;
  w:=(p_definition->>'width')::integer;h:=(p_definition->>'height')::integer;
  if coalesce(p_definition->>'id','')!~'^[a-z0-9][a-z0-9_-]{0,79}$' or jsonb_typeof(p_definition->'version') is distinct from 'number' or coalesce(p_definition->>'version','')!~'^[1-9][0-9]{0,5}$' or coalesce(p_definition->>'difficulty','') not in('easy','medium','hard') or jsonb_typeof(p_definition->'tiles') is distinct from 'array' or jsonb_array_length(p_definition->'tiles')<>w*h then raise exception 'Invalid puzzle definition'; end if;
  for tile in select value from jsonb_array_elements(p_definition->'tiles') loop
    kind:=tile->>'kind';
    keys:=case kind when 'empty' then array['kind'] when 'wall' then array['kind'] when 'emitter' then array['kind','direction','color'] when 'mirror' then array['kind','orientation','rotatable'] when 'receiver' then array['kind','color','label'] when 'filter' then array['kind','accepts','output'] when 'splitter' then array['kind','rules'] else null end;
    if jsonb_typeof(tile) is distinct from 'object' or keys is null or exists(select 1 from jsonb_object_keys(tile) x where not(x=any(keys))) then raise exception 'Invalid puzzle tile'; end if;
    if kind in('emitter','receiver') and not(coalesce(tile->>'color','')=any(colors)) then raise exception 'Invalid beam color'; end if;
    if kind='emitter' then emitters:=emitters+1; if not(coalesce(tile->>'direction','')=any(dirs)) then raise exception 'Invalid emitter direction'; end if;
    elsif kind='receiver' then receivers:=receivers+1; if jsonb_typeof(tile->'label') is distinct from 'string' or length(btrim(coalesce(tile->>'label',''))) not between 1 and 24 or length(tile->>'label')>24 or (tile->>'label')=any(labels) then raise exception 'Invalid receiver label'; end if;labels:=array_append(labels,tile->>'label');
    elsif kind='mirror' then
      if jsonb_typeof(tile->'rotatable') is distinct from 'boolean' or coalesce(tile->>'orientation','') not in('/',E'\\') then raise exception 'Invalid mirror'; end if;
      if (tile->>'rotatable')::boolean then mirrors:=mirrors+1; end if;
    elsif kind='filter' then
      if jsonb_typeof(tile->'accepts') is distinct from 'array' or jsonb_array_length(tile->'accepts') not between 1 and 7 or exists(select 1 from jsonb_array_elements_text(tile->'accepts') c where not(c=any(colors))) or (select count(*)<>count(distinct value) from jsonb_array_elements(tile->'accepts')) or (tile?'output' and not(coalesce(tile->>'output','')=any(colors))) then raise exception 'Invalid color filter'; end if;
    elsif kind='splitter' then
      if jsonb_typeof(tile->'rules') is distinct from 'array' or jsonb_array_length(tile->'rules') not between 1 and 28 then raise exception 'Invalid splitter'; end if;
      pairs:=array[]::text[];
      for rule in select value from jsonb_array_elements(tile->'rules') loop
        if jsonb_typeof(rule) is distinct from 'object' or exists(select 1 from jsonb_object_keys(rule) x where x not in('incoming','inputColor','outputs')) or not(coalesce(rule->>'incoming','')=any(dirs)) or not(coalesce(rule->>'inputColor','')=any(colors)) or ((rule->>'incoming')||':'||(rule->>'inputColor'))=any(pairs) or jsonb_typeof(rule->'outputs') is distinct from 'array' or jsonb_array_length(rule->'outputs') not between 1 and 4 then raise exception 'Invalid splitter rule'; end if;
        pairs:=array_append(pairs,(rule->>'incoming')||':'||(rule->>'inputColor'));
        outputs_seen:=array[]::text[];
        for output in select value from jsonb_array_elements(rule->'outputs') loop
          if ((output->>'direction')||':'||(output->>'color'))=any(outputs_seen) then raise exception 'Duplicate splitter output';end if;
          outputs_seen:=array_append(outputs_seen,(output->>'direction')||':'||(output->>'color'));
          if jsonb_typeof(output) is distinct from 'object' or exists(select 1 from jsonb_object_keys(output) x where x not in('direction','color')) or not(coalesce(output->>'direction','')=any(dirs)) or not(coalesce(output->>'color','')=any(colors)) then raise exception 'Invalid splitter output'; end if;
        end loop;
      end loop;
    end if;
  end loop;
  if mirrors not between 1 and 16 or emitters not between 1 and 8 or receivers not between 1 and 12 then raise exception 'Puzzle complexity is outside supported bounds'; end if;
end $$;

create or replace function public.prism_replay_v1(p_definition jsonb,p_actions jsonb) returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $$
declare action jsonb; orientations jsonb:='{}'; tile jsonb; trace jsonb; rotations integer:=0;cell integer;orientation text;
begin
  if p_actions is null or jsonb_typeof(p_actions) is distinct from 'array' or jsonb_array_length(p_actions)>512 then raise exception 'Invalid move sequence'; end if;
  trace:=public.prism_trace_v1(p_definition,orientations);
  for action in select value from jsonb_array_elements(p_actions) loop
    if coalesce((trace->>'solved')::boolean,false) then raise exception 'The puzzle was already solved'; end if;
    if jsonb_typeof(action) is distinct from 'object' then raise exception 'Invalid move sequence'; end if;
    if action->>'type'='reset' then
      if exists(select 1 from jsonb_object_keys(action) k where k<>'type') then raise exception 'Invalid reset action'; end if;
      orientations:='{}';
    elsif action->>'type'='rotate' then
      if exists(select 1 from jsonb_object_keys(action) k where k not in('type','cell')) or coalesce(action->>'cell','')!~'^(0|[1-9][0-9]{0,2})$' or jsonb_typeof(action->'cell') is distinct from 'number' then raise exception 'Invalid rotation action'; end if;
      cell:=(action->>'cell')::integer;tile:=p_definition->'tiles'->cell;
      if cell<0 or cell>=jsonb_array_length(p_definition->'tiles') or coalesce(tile->>'kind','')<>'mirror' or not coalesce((tile->>'rotatable')::boolean,false) then raise exception 'Only marked mirrors can rotate'; end if;
      orientation:=coalesce(orientations->>cell::text,tile->>'orientation');
      orientations:=jsonb_set(orientations,array[cell::text],to_jsonb(case when orientation='/' then E'\\' else '/' end));rotations:=rotations+1;
    else raise exception 'Invalid move action'; end if;
    trace:=public.prism_trace_v1(p_definition,orientations);
  end loop;
  return trace||jsonb_build_object('rotations',rotations,'orientations',orientations);
end $$;

create or replace function public.prism_minimum_v1(p_definition jsonb) returns integer
language plpgsql immutable set search_path=public,pg_temp as $$
declare cells integer[]:=array[]::integer[];mask integer;bits integer;i integer;n integer;best integer:=1000;orientations jsonb; tile jsonb;
begin
  perform public.prism_validate_v1(p_definition);
  if (public.prism_trace_v1(p_definition)->>'solved')::boolean then return 0; end if;
  for i in 0..jsonb_array_length(p_definition->'tiles')-1 loop
    tile:=p_definition->'tiles'->i;
    if tile->>'kind'='mirror' and (tile->>'rotatable')::boolean then cells:=array_append(cells,i);end if;
  end loop;
  n:=cardinality(cells);
  for mask in 1..(1<<n)-1 loop
    bits:=length(replace((mask::bit(16))::text,'0',''));if bits>=best then continue;end if;
    orientations:='{}';
    for i in 0..n-1 loop
      if (mask&(1<<i))<>0 then orientations:=jsonb_set(orientations,array[cells[i+1]::text],to_jsonb(case when p_definition->'tiles'->cells[i+1]->>'orientation'='/' then E'\\' else '/' end));end if;
    end loop;
    if (public.prism_trace_v1(p_definition,orientations)->>'solved')::boolean then best:=bits;if best=1 then return 1;end if;end if;
  end loop;
  return case when best=1000 then null else best end;
end $$;

create or replace function public.showdown_guard_puzzle() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare minimum integer;
begin
  if tg_op='DELETE' then
    if old.sealed or exists(select 1 from public.showdown_challenge_rounds r join public.showdown_challenges c on c.id=r.challenge_id where c.game_key=old.game_key and c.rules_version=old.rules_version and r.puzzle_id=old.puzzle_id and r.puzzle_version=old.puzzle_version) then raise exception 'Published puzzle versions are immutable';end if;return old;
  end if;
  if tg_op='UPDATE' and old.sealed and (to_jsonb(new)-'published') is distinct from (to_jsonb(old)-'published') then raise exception 'Published puzzle versions are immutable';end if;
  if tg_op='INSERT' then new.sealed:=new.published;elsif not old.sealed then new.sealed:=new.published;end if;
  if new.published and (tg_op='INSERT' or not old.published) then
    if new.game_key<>'prism_break' or new.rules_version<>1 then raise exception 'Unsupported puzzle rules';end if;
    if (new.definition->>'id') is distinct from new.puzzle_id or (new.definition->>'version')::integer is distinct from new.puzzle_version or (new.definition->>'difficulty') is distinct from new.difficulty or jsonb_typeof(new.validation) is distinct from 'object' or not coalesce((new.validation->>'validated')::boolean,false) then raise exception 'Puzzle validation metadata is required';end if;
    if (new.definition->>'width')::integer not between 5 and 7 or (new.definition->>'height')::integer not between 5 and 7 then raise exception 'Published boards must fit a 5-7 cell mobile grid';end if;
    if (select count(*) from jsonb_array_elements(new.definition->'tiles') t where t->>'kind'='mirror' and coalesce((t->>'rotatable')::boolean,false))>12 then raise exception 'Published puzzle exceeds the 4096-state mobile validation budget';end if;
    minimum:=public.prism_minimum_v1(new.definition);
    if minimum is null or minimum<1 or minimum<>new.minimum_rotations then raise exception 'Puzzle minimum rotations failed independent validation';end if;
  end if;
  return new;
end $$;
create trigger showdown_puzzle_versions before insert or update or delete on public.showdown_puzzles for each row execute function public.showdown_guard_puzzle();

create or replace function public.showdown_member_valid(p_club uuid,p_user uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select p_user is not null and public.dh_visible_club(p_club) and public.dh_visible_member(p_user)
    and exists(select 1 from public.clubs c join public.club_members m on m.club_id=c.id where c.id=p_club and c.status='active' and m.user_id=p_user)
$$;
create or replace function public.showdown_actor_club() returns uuid
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.current_user_club_id();begin
  if not public.showdown_member_valid(cid,auth.uid()) then raise exception 'Active club membership required' using errcode='42501';end if;return cid;
end $$;
-- Shared row locks serialize membership removal/moves with ranked mutations,
-- while allowing multiple independent matches for a member to save together.
create or replace function public.showdown_lock_members(p_club uuid,p_first uuid,p_second uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from public.club_members where club_id=p_club and user_id in(p_first,p_second) order by user_id for share;
end $$;
create or replace function public.showdown_reconcile(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;begin
  select * into c from public.showdown_challenges where id=p_id for update;
  if c.status in('pending','active') then
    if c.expires_at<=now() then update public.showdown_challenges set status='expired',closed_reason='The 72-hour challenge window has ended.' where id=c.id;
    elsif not public.showdown_member_valid(c.club_id,c.challenger_id) or not public.showdown_member_valid(c.club_id,c.recipient_id) then
      update public.showdown_challenges set status='cancelled',closed_reason='A player is no longer available in this club.' where id=c.id;
    end if;
  end if;
end $$;
create or replace function public.showdown_profile(p_user uuid,p_club uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('user_id',p_user,'display_name',case when public.showdown_member_valid(p_club,p_user) then coalesce(p.display_name,'Club member') else 'Former member' end,
    'avatar_url',case when public.showdown_member_valid(p_club,p_user) then p.avatar_url else null end) from public.profiles p where p.id=p_user
$$;
create or replace function public.showdown_record(p_user uuid,p_club uuid,p_game text,p_opponent uuid default null) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('played',count(*),'wins',count(*) filter(where winner_id=p_user),
    'losses',count(*) filter(where winner_id is not null and winner_id<>p_user),'draws',count(*) filter(where outcome='draw'))
  from public.showdown_challenges c where c.club_id=p_club and c.game_key=p_game and c.status='completed'
    and p_user in(c.challenger_id,c.recipient_id) and public.dh_visible_member(c.challenger_id) and public.dh_visible_member(c.recipient_id)
    and (p_opponent is null or p_opponent in(c.challenger_id,c.recipient_id))
$$;
create or replace function public.showdown_summary(p_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('id',c.id,'club_id',c.club_id,'game_key',c.game_key,'rules_version',c.rules_version,
    'challenger_id',c.challenger_id,'recipient_id',c.recipient_id,'created_at',c.created_at,'expires_at',c.expires_at,
    'status',c.status,'winner_id',c.winner_id,'outcome',c.outcome,'completed_at',c.completed_at,'rematch_of',c.rematch_of,
    'players',(select jsonb_agg(public.showdown_profile(a.user_id,c.club_id)||jsonb_build_object('started_at',a.started_at,'finished_at',a.finished_at,
      'rounds_completed',(select count(*) from public.showdown_round_states r where r.challenge_id=c.id and r.user_id=a.user_id and r.submitted),
      'total_score',case when a.user_id=auth.uid() or c.status='completed' then a.total_score else null end,
      'solved_count',case when a.user_id=auth.uid() or c.status='completed' then a.solved_count else null end,
      'rotations',case when a.user_id=auth.uid() or c.status='completed' then a.rotations else null end) order by case when a.user_id=c.challenger_id then 0 else 1 end)
      from public.showdown_attempts a where a.challenge_id=c.id))
  from public.showdown_challenges c where c.id=p_id
$$;
create or replace function public.showdown_round_view(p_id uuid,p_user uuid,p_round integer) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('actions',s.actions,'revision',s.revision,'submitted',s.submitted,'skipped',s.skipped,'solved',s.solved,'score',s.score,'rotations',s.rotations)
  from public.showdown_round_states s where s.challenge_id=p_id and s.user_id=p_user and s.round_number=p_round
$$;
create or replace function public.showdown_snapshot(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype; current_round integer; opponent uuid; started timestamptz;begin
  select * into c from public.showdown_challenges where id=p_id;
  opponent:=case when c.challenger_id=auth.uid() then c.recipient_id else c.challenger_id end;
  select min(round_number) into current_round from public.showdown_round_states where challenge_id=c.id and user_id=auth.uid() and not submitted;
  select started_at into started from public.showdown_attempts where challenge_id=c.id and user_id=auth.uid();
  return jsonb_build_object('challenge',public.showdown_summary(c.id),'current_round',current_round,
    'can_play',c.status in('pending','active') and started is not null and current_round is not null,
    'can_decline',c.status in('pending','active') and auth.uid()=c.recipient_id and started is null,
    'can_cancel',c.status in('pending','active') and auth.uid()=c.challenger_id and exists(select 1 from public.showdown_attempts where challenge_id=c.id and user_id=c.recipient_id and started_at is null),
    'readonly_reason',case when c.status in('declined','cancelled','expired') then coalesce(c.closed_reason,'This challenge is closed.') when c.status='completed' then null when current_round is null then 'Your attempt is sealed. Waiting for your opponent.' else null end,
    'record',public.showdown_record(auth.uid(),c.club_id,c.game_key),
    'rivalry',(public.showdown_profile(opponent,c.club_id)-'user_id')||jsonb_build_object('opponent_id',opponent)||public.showdown_record(auth.uid(),c.club_id,c.game_key,opponent),
    'rounds',(select jsonb_agg(jsonb_build_object('round_number',r.round_number,'difficulty',r.difficulty,'puzzle_id',r.puzzle_id,
      'puzzle_version',r.puzzle_version,'title',r.title,
      'puzzle',case when c.status='completed' or r.round_number<=coalesce(current_round,3) then r.definition else null end,
      'minimum_rotations',case when c.status='completed' or s.submitted then r.minimum_rotations else null end,
      'me',public.showdown_round_view(c.id,auth.uid(),r.round_number),
      'opponent',case when c.status='completed' then public.showdown_round_view(c.id,opponent,r.round_number) else null end) order by r.round_number)
      from public.showdown_challenge_rounds r join public.showdown_round_states s on s.challenge_id=r.challenge_id and s.round_number=r.round_number and s.user_id=auth.uid() where r.challenge_id=c.id));
end $$;
create or replace function public.showdown_notify(p_id uuid,p_user uuid,p_event text,p_title text,p_body text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;n uuid;begin
  select * into c from public.showdown_challenges where id=p_id;
  if not public.showdown_member_valid(c.club_id,p_user) or exists(select 1 from public.showdown_events where challenge_id=p_id and user_id=p_user and event=p_event) then return;end if;
  insert into public.notifications(user_id,club_id,type,title,body,url,actor_user_id)
    values(p_user,c.club_id,'showdown',p_title,p_body,'/showdown/'||c.id::text,case when p_user=c.challenger_id then c.recipient_id else c.challenger_id end) returning id into n;
  insert into public.showdown_events(challenge_id,user_id,event,notification_id) values(p_id,p_user,p_event,n);
end $$;

create or replace function public.showdown_get(p_challenge_id uuid,p_start boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;cid uuid:=public.showdown_actor_club();begin
  select * into c from public.showdown_challenges where id=p_challenge_id and club_id=cid and auth.uid() in(challenger_id,recipient_id)
    and public.dh_visible_member(challenger_id) and public.dh_visible_member(recipient_id);
  if not found then raise exception 'Challenge unavailable' using errcode='42501';end if;
  perform public.showdown_lock_members(cid,c.challenger_id,c.recipient_id);
  if not public.showdown_member_valid(cid,auth.uid()) then raise exception 'Active club membership required' using errcode='42501';end if;
  select * into c from public.showdown_challenges where id=p_challenge_id and club_id=cid and auth.uid() in(challenger_id,recipient_id)
    and public.dh_visible_member(challenger_id) and public.dh_visible_member(recipient_id) for update;
  if not found then raise exception 'Challenge unavailable' using errcode='42501';end if;
  perform public.showdown_reconcile(c.id);select * into c from public.showdown_challenges where id=c.id;
  if p_start and c.status in('pending','active') then
    update public.showdown_attempts set started_at=coalesce(started_at,now()) where challenge_id=c.id and user_id=auth.uid();
    update public.showdown_challenges set status='active' where id=c.id;
  end if;
  return public.showdown_snapshot(c.id);
end $$;

create or replace function public.showdown_create(p_recipient_id uuid,p_game_key text,p_request_id uuid,p_rematch_of uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.showdown_actor_club();actor uuid:=auth.uid();old_request public.showdown_requests%rowtype;
  payload jsonb:=jsonb_build_object('recipient_id',p_recipient_id,'game_key',p_game_key,'rematch_of',p_rematch_of);
  g public.showdown_games%rowtype;c public.showdown_challenges%rowtype;p public.showdown_puzzles%rowtype;prev public.showdown_challenges%rowtype;
  diff text;rn integer:=0;lock_id uuid;begin
  -- Lock both members in a stable order so simultaneous incoming invitations
  -- cannot bypass either active-match cap or deadlock reverse challenges.
  perform pg_advisory_xact_lock(hashtextextended('showdown-create:'||u::text,0)) from unnest(array[actor,p_recipient_id]) u where u is not null order by u;
  if p_request_id is null then raise exception 'Request identity required';end if;
  select * into old_request from public.showdown_requests where request_id=p_request_id;
  if found then
    if old_request.user_id<>actor or old_request.club_id<>cid or old_request.operation<>'create' or old_request.payload<>payload then raise exception 'Request identity already used';end if;
    return public.showdown_get(old_request.challenge_id,false);
  end if;
  if p_recipient_id is null or p_recipient_id=actor then raise exception 'Choose another club member';end if;
  perform public.showdown_lock_members(cid,actor,p_recipient_id);
  if not public.showdown_member_valid(cid,actor) then raise exception 'Active club membership required' using errcode='42501';end if;
  if not public.showdown_member_valid(cid,p_recipient_id) then raise exception 'Recipient unavailable' using errcode='42501';end if;
  select * into g from public.showdown_games where game_key=p_game_key and enabled;
  if not found or not exists(select 1 from public.showdown_rules where game_key=g.game_key and rules_version=g.current_rules_version and scoring_key='prism_v1' and round_count=3) then raise exception 'This game is not available';end if;
  if p_rematch_of is not null then
    select * into prev from public.showdown_challenges where id=p_rematch_of and club_id=cid and status='completed' and game_key=p_game_key and actor in(challenger_id,recipient_id) and p_recipient_id in(challenger_id,recipient_id);
    if not found then raise exception 'Rematch unavailable';end if;
  end if;
  for lock_id in select x.id from public.showdown_challenges x where x.club_id=cid and x.status in('pending','active') and (actor in(x.challenger_id,x.recipient_id) or p_recipient_id in(x.challenger_id,x.recipient_id)) order by x.id loop perform public.showdown_reconcile(lock_id);end loop;
  if (select count(*) from public.showdown_challenges where club_id=cid and challenger_id=actor and created_at>now()-interval '1 hour')>=12 then raise exception 'Challenge limit reached. Try again later.';end if;
  if (select count(*) from public.showdown_challenges where club_id=cid and status in('pending','active') and actor in(challenger_id,recipient_id))>=30
    or (select count(*) from public.showdown_challenges where club_id=cid and status in('pending','active') and p_recipient_id in(challenger_id,recipient_id))>=30 then raise exception 'Finish an open challenge before creating another.';end if;
  insert into public.showdown_challenges(club_id,game_key,rules_version,challenger_id,recipient_id,rematch_of) values(cid,g.game_key,g.current_rules_version,actor,p_recipient_id,p_rematch_of) returning * into c;
  foreach diff in array array['easy','medium','hard'] loop
    rn:=rn+1;
    select q.* into p from public.showdown_puzzles q where q.game_key=g.game_key and q.rules_version=g.current_rules_version and q.difficulty=diff and q.published
      order by (select max(ch.created_at) from public.showdown_challenge_rounds r join public.showdown_challenges ch on ch.id=r.challenge_id
        where ch.club_id=cid and ch.game_key=q.game_key and ch.rules_version=q.rules_version and (actor in(ch.challenger_id,ch.recipient_id) or p_recipient_id in(ch.challenger_id,ch.recipient_id)) and r.puzzle_id=q.puzzle_id and r.puzzle_version=q.puzzle_version) asc nulls first,
        md5(c.id::text||q.puzzle_id||q.puzzle_version::text),q.puzzle_id limit 1;
    if not found then raise exception 'Validated puzzle library is not available';end if;
    insert into public.showdown_challenge_rounds values(c.id,rn,p.puzzle_id,p.puzzle_version,diff,p.title,p.definition,p.minimum_rotations);
  end loop;
  insert into public.showdown_attempts(challenge_id,user_id,started_at) values(c.id,actor,now()),(c.id,p_recipient_id,null);
  insert into public.showdown_round_states(challenge_id,user_id,round_number) select c.id,u,r from unnest(array[actor,p_recipient_id]) u cross join generate_series(1,3) r;
  insert into public.showdown_requests values(p_request_id,cid,actor,c.id,'create',payload,now());
  perform public.showdown_notify(c.id,p_recipient_id,case when p_rematch_of is null then 'incoming' else 'rematch' end,case when p_rematch_of is null then 'New '||g.name||' challenge' else g.name||' rematch' end,'Identical puzzles. Play whenever you are ready within 72 hours.');
  return public.showdown_snapshot(c.id);
end $$;

create or replace function public.showdown_write_round(p_challenge_id uuid,p_round_number integer,p_actions jsonb,p_expected_revision integer,p_request_id uuid,p_finish boolean,p_skip boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.showdown_actor_club();actor uuid:=auth.uid();c public.showdown_challenges%rowtype;
  s public.showdown_round_states%rowtype;r public.showdown_challenge_rounds%rowtype;request public.showdown_requests%rowtype;
  payload jsonb:=jsonb_build_object('round_number',p_round_number,'actions',p_actions,'expected_revision',p_expected_revision,'finish',p_finish,'skip',p_skip);
  op text:=case when p_finish then 'submit_round' else 'save_round' end;replay jsonb;points integer;current_round integer; opponent uuid;
  a public.showdown_attempts%rowtype;b public.showdown_attempts%rowtype;winner uuid;
begin
  select * into c from public.showdown_challenges where id=p_challenge_id and club_id=cid and actor in(challenger_id,recipient_id)
    and public.dh_visible_member(challenger_id) and public.dh_visible_member(recipient_id);
  if not found then raise exception 'Challenge unavailable' using errcode='42501';end if;
  perform public.showdown_lock_members(cid,c.challenger_id,c.recipient_id);
  if not public.showdown_member_valid(cid,auth.uid()) then raise exception 'Active club membership required' using errcode='42501';end if;
  select * into c from public.showdown_challenges where id=p_challenge_id and club_id=cid and auth.uid() in(challenger_id,recipient_id)
    and public.dh_visible_member(challenger_id) and public.dh_visible_member(recipient_id) for update;
  if not found then raise exception 'Challenge unavailable' using errcode='42501';end if;
  if p_request_id is null then raise exception 'Request identity required';end if;
  select * into request from public.showdown_requests where request_id=p_request_id;
  if found then
    if request.user_id<>actor or request.challenge_id<>c.id or request.operation<>op or request.payload<>payload then raise exception 'Request identity already used';end if;
    perform public.showdown_reconcile(c.id);return public.showdown_snapshot(c.id);
  end if;
  perform public.showdown_reconcile(c.id);select * into c from public.showdown_challenges where id=c.id;
  if c.status in('cancelled','declined','expired') then return public.showdown_snapshot(c.id);end if;
  select * into s from public.showdown_round_states where challenge_id=c.id and user_id=actor and round_number=p_round_number for update;
  if not found then raise exception 'Round unavailable';end if;
  if s.submitted then
    if p_finish and s.actions=p_actions and s.skipped=p_skip then
      insert into public.showdown_requests values(p_request_id,cid,actor,c.id,op,payload,now());return public.showdown_snapshot(c.id);
    end if;
    raise exception 'This ranked round is already submitted';
  end if;
  if c.status='completed' then raise exception 'This challenge is already complete';end if;
  if c.game_key<>'prism_break' or c.rules_version<>1 then raise exception 'Rules version unavailable';end if;
  if not exists(select 1 from public.showdown_attempts where challenge_id=c.id and user_id=actor and started_at is not null) then raise exception 'Open the challenge before playing';end if;
  select min(round_number) into current_round from public.showdown_round_states where challenge_id=c.id and user_id=actor and not submitted;
  if p_round_number<>current_round then raise exception 'Finish the current round first';end if;
  if p_expected_revision is null or s.revision<>p_expected_revision then raise exception 'Round changed on another device. Reload to continue.' using errcode='40001';end if;
  if p_skip is null or p_finish is null or p_actions is null or jsonb_typeof(p_actions) is distinct from 'array' or jsonb_array_length(p_actions)>512 then raise exception 'Invalid move sequence';end if;
  if jsonb_array_length(p_actions)<jsonb_array_length(s.actions) or exists(select 1 from generate_series(0,jsonb_array_length(s.actions)-1) i where s.actions->i is distinct from p_actions->i) then raise exception 'Saved moves cannot be removed or changed';end if;
  if (select count(*) from public.showdown_requests where user_id=actor and created_at>now()-interval '1 minute')>=600 then raise exception 'Too many updates. Wait a moment.';end if;
  select * into r from public.showdown_challenge_rounds where challenge_id=c.id and round_number=p_round_number;
  replay:=public.prism_replay_v1(r.definition,p_actions);
  if p_finish and not p_skip then
    if not (replay->>'solved')::boolean then raise exception 'Activate every receiver before submitting';end if;
    if (replay->>'rotations')::integer<r.minimum_rotations then raise exception 'Invalid rotation total';end if;
    points:=300+least(200,floor(200.0*r.minimum_rotations/(replay->>'rotations')::integer+0.5)::integer);
  elsif p_finish then points:=0;end if;
  update public.showdown_round_states set actions=p_actions,revision=revision+case when actions=p_actions and not p_finish then 0 else 1 end,
    rotations=(replay->>'rotations')::integer,solved=(replay->>'solved')::boolean and not(p_finish and p_skip),
    submitted=p_finish,skipped=p_finish and p_skip,score=points,submitted_at=case when p_finish then now() else null end
    where challenge_id=c.id and user_id=actor and round_number=p_round_number;
  update public.showdown_challenges set status='active' where id=c.id;
  insert into public.showdown_requests values(p_request_id,cid,actor,c.id,op,payload,now());
  if p_finish then
    update public.showdown_attempts set total_score=(select coalesce(sum(score),0) from public.showdown_round_states where challenge_id=c.id and user_id=actor),
      solved_count=(select count(*) from public.showdown_round_states where challenge_id=c.id and user_id=actor and submitted and solved and not skipped),
      rotations=(select coalesce(sum(rotations),0) from public.showdown_round_states where challenge_id=c.id and user_id=actor),
      finished_at=case when not exists(select 1 from public.showdown_round_states where challenge_id=c.id and user_id=actor and not submitted) then now() else null end
      where challenge_id=c.id and user_id=actor;
    select * into a from public.showdown_attempts where challenge_id=c.id and user_id=actor;
    opponent:=case when c.challenger_id=actor then c.recipient_id else c.challenger_id end;
    select * into b from public.showdown_attempts where challenge_id=c.id and user_id=opponent;
    if a.finished_at is not null and b.finished_at is null then
      perform public.showdown_notify(c.id,opponent,'attempt_finished','Your opponent has finished','Their score stays sealed until you finish your three boards.');
    elsif a.finished_at is not null and b.finished_at is not null then
      winner:=case when a.total_score>b.total_score then a.user_id when b.total_score>a.total_score then b.user_id
        when a.solved_count>b.solved_count then a.user_id when b.solved_count>a.solved_count then b.user_id
        when a.rotations<b.rotations then a.user_id when b.rotations<a.rotations then b.user_id else null end;
      update public.showdown_challenges set status='completed',winner_id=winner,outcome=case when winner is null then 'draw' else 'winner' end,completed_at=now() where id=c.id;
      perform public.showdown_notify(c.id,actor,'result',(select name from public.showdown_games where game_key=c.game_key)||' result',case when winner is null then 'A true draw. Open your round-by-round comparison.' when winner=actor then 'You won this Showdown. Open your round-by-round comparison.' else 'Your rival won this Showdown. Open your round-by-round comparison.' end);
      perform public.showdown_notify(c.id,opponent,'result',(select name from public.showdown_games where game_key=c.game_key)||' result',case when winner is null then 'A true draw. Open your round-by-round comparison.' when winner=opponent then 'You won this Showdown. Open your round-by-round comparison.' else 'Your rival won this Showdown. Open your round-by-round comparison.' end);
    end if;
  end if;
  return public.showdown_snapshot(c.id);
end $$;
create or replace function public.showdown_save_round(p_challenge_id uuid,p_round_number integer,p_actions jsonb,p_expected_revision integer,p_request_id uuid) returns jsonb
language sql security definer set search_path=public,pg_temp as $$
  select public.showdown_write_round(p_challenge_id,p_round_number,p_actions,p_expected_revision,p_request_id,false,false)
$$;
create or replace function public.showdown_submit_round(p_challenge_id uuid,p_round_number integer,p_actions jsonb,p_expected_revision integer,p_request_id uuid,p_skip boolean default false) returns jsonb
language sql security definer set search_path=public,pg_temp as $$
  select public.showdown_write_round(p_challenge_id,p_round_number,p_actions,p_expected_revision,p_request_id,true,p_skip)
$$;
create or replace function public.showdown_act(p_challenge_id uuid,p_action text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.showdown_actor_club();actor uuid:=auth.uid();c public.showdown_challenges%rowtype;q public.showdown_requests%rowtype;
  payload jsonb:=jsonb_build_object('action',p_action);begin
  select * into c from public.showdown_challenges where id=p_challenge_id and club_id=cid and actor in(challenger_id,recipient_id)
    and public.dh_visible_member(challenger_id) and public.dh_visible_member(recipient_id);
  if not found then raise exception 'Challenge unavailable' using errcode='42501';end if;
  perform public.showdown_lock_members(cid,c.challenger_id,c.recipient_id);
  if not public.showdown_member_valid(cid,auth.uid()) then raise exception 'Active club membership required' using errcode='42501';end if;
  select * into c from public.showdown_challenges where id=p_challenge_id and club_id=cid and auth.uid() in(challenger_id,recipient_id)
    and public.dh_visible_member(challenger_id) and public.dh_visible_member(recipient_id) for update;
  if not found then raise exception 'Challenge unavailable' using errcode='42501';end if;
  if p_request_id is null then raise exception 'Request identity required';end if;
  select * into q from public.showdown_requests where request_id=p_request_id;
  if found then
    if q.user_id<>actor or q.challenge_id<>c.id or q.operation<>'act' or q.payload<>payload then raise exception 'Request identity already used';end if;
    perform public.showdown_reconcile(c.id);return public.showdown_snapshot(c.id);
  end if;
  perform public.showdown_reconcile(c.id);select * into c from public.showdown_challenges where id=c.id;
  if c.status in('expired','cancelled','declined') then return public.showdown_snapshot(c.id);end if;
  if c.status='completed' then raise exception 'This challenge is already complete';end if;
  if p_action='decline' and actor=c.recipient_id and exists(select 1 from public.showdown_attempts where challenge_id=c.id and user_id=actor and started_at is null) then
    update public.showdown_challenges set status='declined',closed_reason='The invitation was declined.' where id=c.id;
  elsif p_action='cancel' and actor=c.challenger_id and exists(select 1 from public.showdown_attempts where challenge_id=c.id and user_id=c.recipient_id and started_at is null) then
    update public.showdown_challenges set status='cancelled',closed_reason='The challenger cancelled before the recipient began.' where id=c.id;
  else raise exception 'This invitation can no longer be declined or cancelled';end if;
  insert into public.showdown_requests values(p_request_id,cid,actor,c.id,'act',payload,now());return public.showdown_snapshot(c.id);
end $$;

create or replace function public.showdown_lobby(p_game_key text default 'prism_break',p_cursor jsonb default null,p_limit integer default 30) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.showdown_actor_club();actor uuid:=auth.uid();c record;terminal_ids uuid[];all_ids uuid[];take integer:=greatest(1,least(coalesce(p_limit,30),50));more boolean;cursor_time timestamptz;cursor_id uuid;last public.showdown_challenges%rowtype;begin
  if not exists(select 1 from public.showdown_games where game_key=p_game_key) then raise exception 'This game is not available';end if;
  if p_cursor is not null then
    if jsonb_typeof(p_cursor) is distinct from 'object' or not(p_cursor?'created_at' and p_cursor?'id') then raise exception 'Invalid history cursor';end if;
    cursor_time:=(p_cursor->>'created_at')::timestamptz;cursor_id:=(p_cursor->>'id')::uuid;
  end if;
  for c in select id from public.showdown_challenges where club_id=cid and game_key=p_game_key and actor in(challenger_id,recipient_id) and status in('pending','active') and public.dh_visible_member(challenger_id) and public.dh_visible_member(recipient_id) order by id loop perform public.showdown_reconcile(c.id);end loop;
  select array_agg(id order by created_at desc,id desc) into terminal_ids from(select id,created_at from public.showdown_challenges where club_id=cid and game_key=p_game_key and actor in(challenger_id,recipient_id) and status not in('pending','active')
    and public.dh_visible_member(challenger_id) and public.dh_visible_member(recipient_id) and (p_cursor is null or (created_at,id)<(cursor_time,cursor_id)) order by created_at desc,id desc limit take+1) p;
  more:=coalesce(cardinality(terminal_ids),0)>take;terminal_ids:=coalesce(terminal_ids[1:take],array[]::uuid[]);
  select coalesce(array_agg(id order by created_at desc,id desc),array[]::uuid[]) into all_ids from public.showdown_challenges where club_id=cid and game_key=p_game_key and actor in(challenger_id,recipient_id) and status in('pending','active') and public.dh_visible_member(challenger_id) and public.dh_visible_member(recipient_id);
  all_ids:=all_ids||terminal_ids;
  if more then select * into last from public.showdown_challenges where id=terminal_ids[cardinality(terminal_ids)];end if;
  return jsonb_build_object('games',(select coalesce(jsonb_agg(to_jsonb(g) order by g.name),'[]') from public.showdown_games g),
    'members',(select coalesce(jsonb_agg(public.showdown_profile(m.user_id,cid) order by p.display_name,p.id),'[]') from public.club_members m join public.profiles p on p.id=m.user_id where m.club_id=cid and m.user_id<>actor and public.showdown_member_valid(cid,m.user_id)),
    'challenges',(select coalesce(jsonb_agg(public.showdown_summary(x.id) order by x.ord),'[]') from unnest(all_ids) with ordinality x(id,ord)),
    'next_cursor',case when more then jsonb_build_object('created_at',last.created_at,'id',last.id) else null end,
    'record',public.showdown_record(actor,cid,p_game_key),
    'rivalries',(select coalesce(jsonb_agg((public.showdown_profile(x.opponent,cid)-'user_id')||jsonb_build_object('opponent_id',x.opponent)||public.showdown_record(actor,cid,p_game_key,x.opponent) order by x.latest desc),'[]') from(
      select case when challenger_id=actor then recipient_id else challenger_id end opponent,max(completed_at) latest from public.showdown_challenges where club_id=cid and game_key=p_game_key and status='completed' and actor in(challenger_id,recipient_id) and public.dh_visible_member(challenger_id) and public.dh_visible_member(recipient_id) group by 1) x),
    'standings',(select coalesce(jsonb_agg(r.profile||r.record||jsonb_build_object('points',(r.record->>'wins')::integer*3+(r.record->>'draws')::integer) order by (r.record->>'wins')::integer*3+(r.record->>'draws')::integer desc,(r.record->>'wins')::integer desc,r.uid),'[]') from(
      select m.user_id uid,public.showdown_profile(m.user_id,cid) profile,public.showdown_record(m.user_id,cid,p_game_key) record from public.club_members m where m.club_id=cid and public.showdown_member_valid(cid,m.user_id)) r where (r.record->>'played')::integer>0));
end $$;

create or replace function public.showdown_member_metrics(p_user_id uuid,p_club_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('played',count(distinct c.id),'wins',count(distinct c.id) filter(where c.winner_id=p_user_id),
    'losses',count(distinct c.id) filter(where c.winner_id is not null and c.winner_id<>p_user_id),'draws',count(distinct c.id) filter(where c.outcome='draw'),
    'prism_solved',count(*) filter(where c.game_key='prism_break' and s.solved and not s.skipped),
    'optimum_rounds',count(*) filter(where c.game_key='prism_break' and s.solved and not s.skipped and s.rotations=r.minimum_rotations),
    'prism_score',coalesce(sum(s.score) filter(where c.game_key='prism_break'),0),
    'qualified_played',count(distinct c.id) filter(where a.solved_count>=1),
    'qualified_wins',count(distinct c.id) filter(where a.solved_count>=1 and c.winner_id=p_user_id),
    'rival_count',count(distinct case when c.challenger_id=p_user_id then c.recipient_id else c.challenger_id end) filter(where a.solved_count>=1),
    'best_prism_score',coalesce(max(a.total_score) filter(where c.game_key='prism_break'),0))
  from public.showdown_challenges c join public.showdown_attempts a on a.challenge_id=c.id and a.user_id=p_user_id
    join public.showdown_round_states s on s.challenge_id=c.id and s.user_id=p_user_id
    join public.showdown_challenge_rounds r on r.challenge_id=c.id and r.round_number=s.round_number
  where c.club_id=p_club_id and c.status='completed' and p_user_id in(c.challenger_id,c.recipient_id)
    and public.showdown_member_valid(p_club_id,p_user_id) and public.dh_visible_member(c.challenger_id) and public.dh_visible_member(c.recipient_id)
$$;
create or replace function public.showdown_maintenance() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;begin
  for c in select * from public.showdown_challenges where status in('pending','active') and expires_at<now()+interval '12 hours'
    and public.dh_visible_club(club_id) and public.dh_visible_member(challenger_id) and public.dh_visible_member(recipient_id)
    order by expires_at,id for update skip locked loop
    perform public.showdown_reconcile(c.id);
    if exists(select 1 from public.showdown_challenges where id=c.id and status in('pending','active')) then
      if exists(select 1 from public.showdown_attempts where challenge_id=c.id and user_id=c.challenger_id and finished_at is null) then
      perform public.showdown_notify(c.id,c.challenger_id,'expiring','Showdown closes soon','Your '||(select name from public.showdown_games where game_key=c.game_key)||' challenge closes at '||to_char(c.expires_at at time zone 'UTC','Mon DD, HH24:MI')||' UTC. Finish your boards before the deadline.');end if;
      if exists(select 1 from public.showdown_attempts where challenge_id=c.id and user_id=c.recipient_id and finished_at is null) then
      perform public.showdown_notify(c.id,c.recipient_id,'expiring','Showdown closes soon','Your '||(select name from public.showdown_games where game_key=c.game_key)||' challenge closes at '||to_char(c.expires_at at time zone 'UTC','Mon DD, HH24:MI')||' UTC. Finish your boards before the deadline.');end if;
    end if;
  end loop;
end $$;

-- Sealed ranked states and frozen boards remain immutable even for service-role
-- maintenance; retries must use receipts instead of updating a finished attempt.
create or replace function public.showdown_guard_immutable() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_table_name='showdown_challenge_rounds'
    or (tg_table_name='showdown_round_states' and coalesce((to_jsonb(old)->>'submitted')::boolean,false))
    or (tg_table_name='showdown_attempts' and to_jsonb(old)->>'finished_at' is not null)
    or (tg_table_name='showdown_challenges' and to_jsonb(old)->>'status' in('completed','declined','cancelled','expired')) then
    if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new;end if;
    raise exception 'Sealed Showdown records are immutable';
  end if;
  if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger showdown_frozen_boards before update or delete on public.showdown_challenge_rounds for each row execute function public.showdown_guard_immutable();
create trigger showdown_sealed_rounds before update or delete on public.showdown_round_states for each row execute function public.showdown_guard_immutable();
create trigger showdown_sealed_attempts before update or delete on public.showdown_attempts for each row execute function public.showdown_guard_immutable();
create trigger showdown_sealed_matches before update or delete on public.showdown_challenges for each row execute function public.showdown_guard_immutable();

-- Internal handlers cannot be used as alternate read APIs or CPU-heavy public solvers.
do $$ declare f record;begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'showdown_%' or p.proname in('prism_trace_v1','prism_validate_v1','prism_replay_v1','prism_minimum_v1')) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
grant execute on function public.showdown_lobby(text,jsonb,integer),public.showdown_get(uuid,boolean),public.showdown_create(uuid,text,uuid,uuid),public.showdown_save_round(uuid,integer,jsonb,integer,uuid),public.showdown_submit_round(uuid,integer,jsonb,integer,uuid,boolean),public.showdown_act(uuid,text,uuid) to authenticated;

-- Reuse the existing database scheduler where installed. One indexed sweep per half hour.
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    if not exists(select 1 from cron.job where jobname='showdown-expiry-and-reminders') then
      perform cron.schedule('showdown-expiry-and-reminders','*/30 * * * *','select public.showdown_maintenance()');
    end if;
  end if;
end $$;
commit;
