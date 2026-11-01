-- CIPHER DUEL v1: two private, immutable codes inside the existing Showdown
-- challenge lifecycle. No manufactured puzzle rounds or competing match ledger.
begin;

insert into public.showdown_games(game_key,name,description,current_rules_version,enabled)
values('cipher_duel','CIPHER DUEL','Lock a secret. Break your rival''s code in ten guesses. Play on your time.',1,true)
on conflict(game_key) do update set name=excluded.name,description=excluded.description;
insert into public.showdown_rules(game_key,rules_version,scoring_key,round_count)
values('cipher_duel',1,'cipher_v1',1) on conflict(game_key,rules_version) do nothing;

alter table public.showdown_challenges
  add column if not exists invitation_expires_at timestamptz,
  add column if not exists gameplay_started_at timestamptz,
  add column if not exists gameplay_expires_at timestamptz;
alter table public.showdown_challenges add constraint cipher_duel_clocks check(game_key<>'cipher_duel' or
  (invitation_expires_at is not null and invitation_expires_at=created_at+interval '72 hours' and
   ((gameplay_started_at is null and gameplay_expires_at is null and expires_at=invitation_expires_at) or
    (gameplay_started_at is not null and gameplay_expires_at is not null and gameplay_expires_at=gameplay_started_at+interval '72 hours' and expires_at=gameplay_expires_at))));
alter table public.showdown_events drop constraint showdown_events_event_check;
alter table public.showdown_events add constraint showdown_events_event_check
  check(event in('incoming','attempt_finished','result','expiring','rematch','code_locked','ready'));

create or replace function public.cipher_code_valid_v1(p_code text[]) returns boolean
language sql immutable set search_path=public,pg_temp as $$
  select coalesce(array_ndims(p_code)=1 and array_lower(p_code,1)=1 and cardinality(p_code)=4
    and not exists(select 1 from unnest(p_code) c where c is null or c not in('red','blue','green','yellow','purple','orange')),false)
$$;
create or replace function public.cipher_validate_code_v1(p_code text[]) returns void
language plpgsql immutable set search_path=public,pg_temp as $$
begin
  if not public.cipher_code_valid_v1(p_code) then raise exception 'Choose four colors from the six-color palette';end if;
end $$;
create or replace function public.cipher_feedback_v1(p_secret text[],p_guess text[]) returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $$
declare matches integer:=0;all_matches integer:=0;i integer;c text;n_secret integer;n_guess integer;
begin
  perform public.cipher_validate_code_v1(p_secret);perform public.cipher_validate_code_v1(p_guess);
  for i in 1..4 loop if p_secret[i]=p_guess[i] then matches:=matches+1;end if;end loop;
  foreach c in array array['red','blue','green','yellow','purple','orange'] loop
    select count(*) into n_secret from unnest(p_secret) v where v=c;
    select count(*) into n_guess from unnest(p_guess) v where v=c;
    all_matches:=all_matches+least(n_secret,n_guess);
  end loop;
  return jsonb_build_object('exact',matches,'color_only',all_matches-matches);
end $$;

create table public.showdown_cipher_codes(
  challenge_id uuid not null,user_id uuid not null,code text[] not null check(public.cipher_code_valid_v1(code)),
  locked_at timestamptz not null default clock_timestamp(),primary key(challenge_id,user_id),
  foreign key(challenge_id,user_id) references public.showdown_attempts(challenge_id,user_id)
);
create table public.showdown_cipher_states(
  challenge_id uuid not null,user_id uuid not null,
  status text not null default 'pending' check(status in('pending','playing','solved','exhausted','surrendered')),
  guess_count integer not null default 0 check(guess_count between 0 and 10),
  primary key(challenge_id,user_id),foreign key(challenge_id,user_id) references public.showdown_attempts(challenge_id,user_id),
  check((status='pending' and guess_count=0) or (status='playing' and guess_count<10) or
    (status='solved' and guess_count between 1 and 10) or (status='exhausted' and guess_count=10) or (status='surrendered' and guess_count<10))
);
create table public.showdown_cipher_guesses(
  challenge_id uuid not null,user_id uuid not null,guess_number integer not null check(guess_number between 1 and 10),
  guess text[] not null check(public.cipher_code_valid_v1(guess)),exact integer not null check(exact between 0 and 4),
  color_only integer not null check(color_only between 0 and 4),created_at timestamptz not null default clock_timestamp(),
  primary key(challenge_id,user_id,guess_number),foreign key(challenge_id,user_id) references public.showdown_cipher_states(challenge_id,user_id),
  check(exact+color_only<=4)
);
do $$ declare t text;begin
  foreach t in array array['showdown_cipher_codes','showdown_cipher_states','showdown_cipher_guesses'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

-- Immutable codes and append-only feedback are protected even for maintenance
-- owners. A shared challenge lock serializes all ordinary gameplay transitions.
create or replace function public.cipher_guard_records_v1() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;s public.showdown_cipher_states%rowtype;opponent uuid;feedback jsonb;last_exact integer;
begin
  if tg_op='DELETE' then raise exception 'Ranked Cipher records are immutable';end if;
  if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new;end if;
  if tg_op='UPDATE' and tg_table_name in('showdown_cipher_codes','showdown_cipher_guesses') then raise exception 'Ranked Cipher records are immutable';end if;
  select * into c from public.showdown_challenges where id=new.challenge_id;
  if c.game_key is distinct from 'cipher_duel' or c.rules_version<>1 or new.user_id not in(c.challenger_id,c.recipient_id) then raise exception 'Invalid Cipher participant';end if;
  if c.status not in('pending','active') then raise exception 'This challenge is closed';end if;
  if tg_table_name='showdown_cipher_codes' then
    if c.gameplay_started_at is not null then raise exception 'Both codes are already locked';end if;
  elsif tg_table_name='showdown_cipher_guesses' then
    select * into s from public.showdown_cipher_states where challenge_id=c.id and user_id=new.user_id;
    if s.status<>'playing' or new.guess_number<>s.guess_count+1 or c.gameplay_started_at is null then raise exception 'Invalid Cipher guess sequence';end if;
    opponent:=case when new.user_id=c.challenger_id then c.recipient_id else c.challenger_id end;
    select public.cipher_feedback_v1(code,new.guess) into feedback from public.showdown_cipher_codes where challenge_id=c.id and user_id=opponent;
    if feedback is null or new.exact<>(feedback->>'exact')::integer or new.color_only<>(feedback->>'color_only')::integer then raise exception 'Cipher feedback failed validation';end if;
  elsif tg_op='INSERT' then
    if new.status<>'pending' or new.guess_count<>0 then raise exception 'A Cipher attempt must begin pending';end if;
  else
    if old.status in('solved','exhausted','surrendered') then raise exception 'This ranked attempt is already sealed';end if;
    if new.challenge_id<>old.challenge_id or new.user_id<>old.user_id or new.guess_count<old.guess_count or new.guess_count>old.guess_count+1 then raise exception 'Invalid Cipher attempt transition';end if;
    if new.status='pending' or c.gameplay_started_at is null or (select count(*) from public.showdown_cipher_codes where challenge_id=c.id)<>2 then raise exception 'Both players must lock a code first';end if;
    if old.status='pending' and (new.status<>'playing' or new.guess_count<>0) then raise exception 'A Cipher attempt must begin playing';end if;
    if new.guess_count<>(select count(*) from public.showdown_cipher_guesses where challenge_id=c.id and user_id=new.user_id) then raise exception 'Cipher guess count failed validation';end if;
    select exact into last_exact from public.showdown_cipher_guesses where challenge_id=c.id and user_id=new.user_id order by guess_number desc limit 1;
    if (new.status='solved') is distinct from (coalesce(last_exact,0)=4) or
      (new.status='exhausted' and new.guess_count<>10) or (new.status='playing' and new.guess_count=10) then raise exception 'Cipher outcome failed validation';end if;
  end if;
  return new;
end $$;
create trigger cipher_sealed_codes before insert or update or delete on public.showdown_cipher_codes for each row execute function public.cipher_guard_records_v1();
create trigger cipher_sealed_guesses before insert or update or delete on public.showdown_cipher_guesses for each row execute function public.cipher_guard_records_v1();
create trigger cipher_ranked_states before insert or update or delete on public.showdown_cipher_states for each row execute function public.cipher_guard_records_v1();

create or replace function public.cipher_guard_clocks_v1() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if old.game_key='cipher_duel' then
    if new.game_key<>old.game_key or new.rules_version<>old.rules_version or new.invitation_expires_at is distinct from old.invitation_expires_at then raise exception 'Cipher invitation clocks are immutable';end if;
    if old.gameplay_started_at is not null and (new.gameplay_started_at is distinct from old.gameplay_started_at or new.gameplay_expires_at is distinct from old.gameplay_expires_at or new.expires_at is distinct from old.expires_at) then raise exception 'The Cipher gameplay window cannot be restarted';end if;
    if old.gameplay_started_at is null and new.gameplay_started_at is not null and (select count(*) from public.showdown_cipher_codes where challenge_id=old.id)<>2 then raise exception 'Both players must lock a code first';end if;
  end if;
  return new;
end $$;
create trigger cipher_frozen_clocks before update on public.showdown_challenges for each row execute function public.cipher_guard_clocks_v1();

-- Copy implementations instead of renaming their OIDs: cached callers must
-- keep calling the secured public dispatcher rather than an older projection.
do $extend$
declare definition text;item text;anchor text;
begin
  foreach item in array array['showdown_summary','showdown_snapshot','showdown_get'] loop
    if to_regprocedure('public.'||item||'_v2_base(uuid' ||case when item='showdown_get' then ',boolean)' else ')' end) is null then
      definition:=pg_get_functiondef(to_regprocedure('public.'||item||'(uuid'||case when item='showdown_get' then ',boolean)' else ')' end));
      if position('cipher_' in definition)>0 then raise exception 'Cipher dispatcher base needs review';end if;
      execute replace(definition,'FUNCTION public.'||item||'(','FUNCTION public.'||item||'_v2_base(');
    end if;
  end loop;
  if to_regprocedure('public.showdown_lobby_v2_base(text,jsonb,integer)') is null then
    definition:=pg_get_functiondef('public.showdown_lobby(text,jsonb,integer)'::regprocedure);
    if position('cipher_statistics_v1' in definition)>0 then raise exception 'Cipher lobby base needs review';end if;
    execute replace(definition,'FUNCTION public.showdown_lobby(','FUNCTION public.showdown_lobby_v2_base(');
  end if;
  -- Keep the installed cron and reminder workflow while making its shared copy
  -- accurate for puzzle, memory and codebreaking games alike.
  definition:=pg_get_functiondef('public.showdown_maintenance()'::regprocedure);
  anchor:='Finish your boards before the deadline.';
  if position(anchor in definition)>0 then execute replace(definition,anchor,'Finish your challenge before the deadline.');
  elsif position('Finish your challenge before the deadline.' in definition)=0 then raise exception 'Showdown reminder copy changed; review before extending';end if;
end $extend$;

create or replace function public.cipher_lock_challenge_v1(p_id uuid) returns public.showdown_challenges
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
  if c.game_key<>'cipher_duel' or c.rules_version<>1 then raise exception 'This challenge uses different game controls';end if;
  perform public.showdown_reconcile(c.id);select * into c from public.showdown_challenges where id=p_id;
  -- Use the actual clock after waiting for a concurrent device, not the start
  -- of its transaction. An expired challenge remains an unscored no-contest.
  if c.status in('pending','active') and c.expires_at<=clock_timestamp() then
    update public.showdown_challenges set status='expired',closed_reason='The 72-hour challenge window has ended.' where id=c.id;
    select * into c from public.showdown_challenges where id=p_id;
  end if;
  return c;
end $$;
create or replace function public.cipher_attempt_view_v1(p_id uuid,p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('status',s.status,'guesses_used',s.guess_count,'solved',s.status='solved','finished_at',a.finished_at)
    from public.showdown_cipher_states s join public.showdown_attempts a using(challenge_id,user_id) where s.challenge_id=p_id and s.user_id=p_user
$$;
create or replace function public.cipher_guesses_view_v1(p_id uuid,p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('sequence',guess_number,'colors',guess,'exact',exact,'color_only',color_only,'submitted_at',created_at) order by guess_number),'[]')
    from public.showdown_cipher_guesses where challenge_id=p_id and user_id=p_user
$$;
create or replace function public.cipher_statistics_v1(p_user uuid,p_club uuid,p_opponent uuid default null) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;current_streak integer:=0;longest_streak integer:=0;running integer:=0;recent boolean:=true;r record;
begin
  select public.showdown_record(p_user,p_club,'cipher_duel',p_opponent)||jsonb_build_object(
    'solved_count',count(*) filter(where s.status='solved'),'failed_count',count(*) filter(where s.status in('exhausted','surrendered')),
    'successful_guesses_total',coalesce(sum(s.guess_count) filter(where s.status='solved'),0),
    'average_guesses_to_solve',round(avg(s.guess_count) filter(where s.status='solved'),2),
    'best_guess_count',min(s.guess_count) filter(where s.status='solved'),
    'first_guess_solves',count(*) filter(where s.status='solved' and s.guess_count=1)) into result
    from public.showdown_challenges c join public.showdown_cipher_states s on s.challenge_id=c.id and s.user_id=p_user
    where c.club_id=p_club and c.game_key='cipher_duel' and c.status='completed' and p_user in(c.challenger_id,c.recipient_id)
      and public.showdown_member_valid(p_club,p_user) and public.dh_visible_member(c.challenger_id) and public.dh_visible_member(c.recipient_id)
      and (p_opponent is null or p_opponent in(c.challenger_id,c.recipient_id));
  for r in select c.winner_id from public.showdown_challenges c where c.club_id=p_club and c.game_key='cipher_duel' and c.status='completed'
    and p_user in(c.challenger_id,c.recipient_id) and public.showdown_member_valid(p_club,p_user)
    and public.dh_visible_member(c.challenger_id) and public.dh_visible_member(c.recipient_id)
    and (p_opponent is null or p_opponent in(c.challenger_id,c.recipient_id)) order by c.completed_at desc,c.id desc loop
    if r.winner_id=p_user then running:=running+1;if recent then current_streak:=current_streak+1;end if;longest_streak:=greatest(longest_streak,running);
    else running:=0;recent:=false;end if;
  end loop;
  return result||jsonb_build_object('current_win_streak',current_streak,'longest_win_streak',longest_streak);
end $$;

create or replace function public.showdown_summary(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb:=public.showdown_summary_v2_base(p_id);c public.showdown_challenges%rowtype;opponent uuid;s public.showdown_cipher_states%rowtype;
begin
  if result->>'game_key'='cipher_duel' then
    select * into c from public.showdown_challenges where id=p_id;
    opponent:=case when auth.uid()=c.challenger_id then c.recipient_id else c.challenger_id end;
    select * into s from public.showdown_cipher_states where challenge_id=p_id and user_id=auth.uid();
    result:=result||jsonb_build_object('cipher',jsonb_build_object(
      'own_code_locked',exists(select 1 from public.showdown_cipher_codes where challenge_id=p_id and user_id=auth.uid()),
      'opponent_code_locked',exists(select 1 from public.showdown_cipher_codes where challenge_id=p_id and user_id=opponent),
      'own_status',s.status,'own_guesses_used',s.guess_count,
      'opponent_finished',exists(select 1 from public.showdown_attempts where challenge_id=p_id and user_id=opponent and finished_at is not null),
      'gameplay_started_at',c.gameplay_started_at));
  end if;
  return result;
end $$;
create or replace function public.cipher_snapshot_v1(p_id uuid,p_server_now timestamptz) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;s public.showdown_cipher_states%rowtype;mine public.showdown_cipher_codes%rowtype;
  opponent uuid;opponent_locked boolean;opponent_finished boolean;phase text;view jsonb;
begin
  select * into c from public.showdown_challenges where id=p_id;
  opponent:=case when auth.uid()=c.challenger_id then c.recipient_id else c.challenger_id end;
  select * into s from public.showdown_cipher_states where challenge_id=p_id and user_id=auth.uid();
  select * into mine from public.showdown_cipher_codes where challenge_id=p_id and user_id=auth.uid();
  opponent_locked:=exists(select 1 from public.showdown_cipher_codes where challenge_id=p_id and user_id=opponent);
  opponent_finished:=exists(select 1 from public.showdown_attempts where challenge_id=p_id and user_id=opponent and finished_at is not null);
  phase:=case when c.status='completed' then 'completed' when c.status in('declined','cancelled','expired') then 'closed'
    when mine.code is null then 'create_code' when not opponent_locked then 'waiting_code'
    when s.status in('solved','exhausted','surrendered') then 'attempt_sealed' else 'codebreaking' end;
  view:=jsonb_build_object('phase',phase,'own_code',mine.code,'own_code_locked_at',mine.locked_at,'opponent_code_locked',opponent_locked,
    'opponent_finished',opponent_finished,'invitation_expires_at',c.invitation_expires_at,'gameplay_started_at',c.gameplay_started_at,'gameplay_expires_at',c.gameplay_expires_at,
    'own_guesses',public.cipher_guesses_view_v1(p_id,auth.uid()),'own_attempt',public.cipher_attempt_view_v1(p_id,auth.uid()),
    'results',case when c.status='completed' then (select jsonb_agg(jsonb_build_object('user_id',a.user_id,'code',code.code,
      'guesses',public.cipher_guesses_view_v1(p_id,a.user_id),'attempt',public.cipher_attempt_view_v1(p_id,a.user_id)) order by case when a.user_id=c.challenger_id then 0 else 1 end)
      from public.showdown_attempts a join public.showdown_cipher_codes code using(challenge_id,user_id) where a.challenge_id=p_id) else null end);
  return jsonb_build_object('challenge',public.showdown_summary(p_id),'current_round',null,'rounds','[]'::jsonb,'server_now',p_server_now,
    'can_play',phase='codebreaking','can_decline',phase='create_code' and auth.uid()=c.recipient_id,
    'can_cancel',phase='waiting_code' and auth.uid()=c.challenger_id,
    'readonly_reason',case when phase='closed' then coalesce(c.closed_reason,'This challenge is closed.') when phase='attempt_sealed' then 'Your attempt is sealed. Waiting for your opponent.' when phase='waiting_code' then 'Waiting for your rival to lock a code.' else null end,
    'record',public.showdown_record(auth.uid(),c.club_id,c.game_key),
    'rivalry',(public.showdown_profile(opponent,c.club_id)-'user_id')||jsonb_build_object('opponent_id',opponent)||public.showdown_record(auth.uid(),c.club_id,c.game_key,opponent),
    'cipher_statistics',public.cipher_statistics_v1(auth.uid(),c.club_id),'cipher',view);
end $$;
create or replace function public.showdown_snapshot(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare game text;moment timestamptz:=clock_timestamp();
begin
  select game_key into game from public.showdown_challenges where id=p_id;
  if game='cipher_duel' then return public.cipher_snapshot_v1(p_id,moment);end if;
  return public.showdown_snapshot_v2_base(p_id);
end $$;
create or replace function public.showdown_get(p_challenge_id uuid,p_start boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;
begin
  if exists(select 1 from public.showdown_challenges where id=p_challenge_id and game_key='cipher_duel') then
    c:=public.cipher_lock_challenge_v1(p_challenge_id);
    -- Looking at an invitation is not acceptance. Only a locked recipient code
    -- starts their attempt and removes their decline control.
    return public.showdown_snapshot(c.id);
  end if;
  return public.showdown_get_v2_base(p_challenge_id,p_start);
end $$;
create or replace function public.showdown_lobby(p_game_key text default 'prism_break',p_cursor jsonb default null,p_limit integer default 30) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb:=public.showdown_lobby_v2_base(p_game_key,p_cursor,p_limit);
begin
  if p_game_key='cipher_duel' then result:=result||jsonb_build_object('cipher_statistics',public.cipher_statistics_v1(auth.uid(),public.showdown_actor_club()));end if;
  return result;
end $$;

create or replace function public.showdown_create_cipher(p_recipient_id uuid,p_code text[],p_request_id uuid,p_rematch_of uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid:=public.showdown_actor_club();actor uuid:=auth.uid();q public.showdown_requests%rowtype;c public.showdown_challenges%rowtype;
  payload jsonb:=jsonb_build_object('recipient_id',p_recipient_id,'game_key','cipher_duel','rematch_of',p_rematch_of);lock_id uuid;moment timestamptz;
begin
  perform public.cipher_validate_code_v1(p_code);
  perform pg_advisory_xact_lock(hashtextextended('showdown-create:'||u::text,0)) from unnest(array[actor,p_recipient_id]) u where u is not null order by u;
  if p_request_id is null then raise exception 'Request identity required';end if;
  select * into q from public.showdown_requests where request_id=p_request_id;
  if found then
    if q.user_id<>actor or q.club_id<>cid or q.operation<>'create_cipher' or q.payload<>payload or
      not exists(select 1 from public.showdown_cipher_codes where challenge_id=q.challenge_id and user_id=actor and code=p_code) then raise exception 'Request identity already used';end if;
    return public.showdown_get(q.challenge_id,false);
  end if;
  if p_recipient_id is null or p_recipient_id=actor then raise exception 'Choose another club member';end if;
  perform public.showdown_lock_members(cid,actor,p_recipient_id);
  if not public.showdown_member_valid(cid,actor) then raise exception 'Active club membership required' using errcode='42501';end if;
  if not public.showdown_member_valid(cid,p_recipient_id) then raise exception 'Recipient unavailable' using errcode='42501';end if;
  if not exists(select 1 from public.showdown_games g join public.showdown_rules r on r.game_key=g.game_key and r.rules_version=g.current_rules_version
    where g.game_key='cipher_duel' and g.enabled and g.current_rules_version=1 and r.scoring_key='cipher_v1' and r.round_count=1) then raise exception 'This game is not available';end if;
  if p_rematch_of is not null and not exists(select 1 from public.showdown_challenges where id=p_rematch_of and club_id=cid and game_key='cipher_duel' and status='completed'
    and actor in(challenger_id,recipient_id) and p_recipient_id in(challenger_id,recipient_id)) then raise exception 'Rematch unavailable';end if;
  for lock_id in select x.id from public.showdown_challenges x where x.club_id=cid and x.status in('pending','active')
    and (actor in(x.challenger_id,x.recipient_id) or p_recipient_id in(x.challenger_id,x.recipient_id)) order by x.id loop perform public.showdown_reconcile(lock_id);end loop;
  if (select count(*) from public.showdown_challenges where club_id=cid and challenger_id=actor and created_at>now()-interval '1 hour')>=12 then raise exception 'Challenge limit reached. Try again later.';end if;
  if (select count(*) from public.showdown_challenges where club_id=cid and status in('pending','active') and actor in(challenger_id,recipient_id))>=30
    or (select count(*) from public.showdown_challenges where club_id=cid and status in('pending','active') and p_recipient_id in(challenger_id,recipient_id))>=30 then raise exception 'Finish an open challenge before creating another.';end if;
  moment:=clock_timestamp();
  insert into public.showdown_challenges(club_id,game_key,rules_version,challenger_id,recipient_id,created_at,expires_at,invitation_expires_at,rematch_of)
    values(cid,'cipher_duel',1,actor,p_recipient_id,moment,moment+interval '72 hours',moment+interval '72 hours',p_rematch_of) returning * into c;
  insert into public.showdown_attempts(challenge_id,user_id,started_at) values(c.id,actor,moment),(c.id,p_recipient_id,null);
  insert into public.showdown_cipher_states(challenge_id,user_id) values(c.id,actor),(c.id,p_recipient_id);
  insert into public.showdown_cipher_codes(challenge_id,user_id,code,locked_at) values(c.id,actor,p_code,moment);
  -- Code values are intentionally absent from idempotency receipts, hashes,
  -- notifications and activity feeds. Retries compare the private own-code row.
  insert into public.showdown_requests values(p_request_id,cid,actor,c.id,'create_cipher',payload,now());
  perform public.showdown_notify(c.id,p_recipient_id,case when p_rematch_of is null then 'incoming' else 'rematch' end,
    case when p_rematch_of is null then 'New CIPHER DUEL challenge' else 'CIPHER DUEL rematch' end,
    'Your rival has locked a secret code. Lock yours within 72 hours to begin.');
  return public.showdown_snapshot(c.id);
end $$;
create or replace function public.showdown_lock_cipher_code(p_challenge_id uuid,p_code text[],p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;q public.showdown_requests%rowtype;actor uuid:=auth.uid();own_code text[];moment timestamptz;
begin
  c:=public.cipher_lock_challenge_v1(p_challenge_id);
  if p_request_id is null then raise exception 'Request identity required';end if;
  perform public.cipher_validate_code_v1(p_code);
  select code into own_code from public.showdown_cipher_codes where challenge_id=c.id and user_id=actor;
  select * into q from public.showdown_requests where request_id=p_request_id;
  if found then
    if q.user_id<>actor or q.challenge_id<>c.id or q.operation<>'lock_cipher' or q.payload<>'{}'::jsonb or own_code is distinct from p_code then raise exception 'Request identity already used';end if;
    return public.showdown_snapshot(c.id);
  end if;
  if c.status in('expired','declined','cancelled') then return public.showdown_snapshot(c.id);end if;
  if (select count(*) from public.showdown_requests where user_id=actor and created_at>now()-interval '1 minute')>=600 then raise exception 'Too many updates. Wait a moment.';end if;
  if own_code is not null then
    if own_code is distinct from p_code then raise exception 'Your secret code is already locked';end if;
    insert into public.showdown_requests values(p_request_id,c.club_id,actor,c.id,'lock_cipher','{}',now());
    return public.showdown_snapshot(c.id);
  end if;
  if actor<>c.recipient_id or c.status='completed' or c.gameplay_started_at is not null then raise exception 'Your secret code is already locked';end if;
  moment:=clock_timestamp();
  insert into public.showdown_cipher_codes(challenge_id,user_id,code,locked_at) values(c.id,actor,p_code,moment);
  update public.showdown_challenges set status='active',gameplay_started_at=moment,gameplay_expires_at=moment+interval '72 hours',expires_at=moment+interval '72 hours' where id=c.id;
  update public.showdown_cipher_states set status='playing' where challenge_id=c.id;
  update public.showdown_attempts set started_at=moment where challenge_id=c.id;
  insert into public.showdown_requests values(p_request_id,c.club_id,actor,c.id,'lock_cipher','{}',now());
  perform public.showdown_notify(c.id,c.challenger_id,'code_locked','CIPHER DUEL is ready','Both secret codes are locked. You each have 72 hours and ten guesses.');
  perform public.showdown_notify(c.id,c.recipient_id,'ready','CIPHER DUEL is ready','Both secret codes are locked. You each have 72 hours and ten guesses.');
  return public.showdown_snapshot(c.id);
end $$;

create or replace function public.cipher_finish_attempt_v1(p_id uuid,p_user uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;s public.showdown_cipher_states%rowtype;other public.showdown_cipher_states%rowtype;opponent uuid;winner uuid;
begin
  select * into c from public.showdown_challenges where id=p_id;
  select * into s from public.showdown_cipher_states where challenge_id=p_id and user_id=p_user;
  if s.status not in('solved','exhausted','surrendered') then return;end if;
  update public.showdown_attempts set total_score=0,solved_count=case when s.status='solved' then 1 else 0 end,rotations=0,finished_at=clock_timestamp()
    where challenge_id=p_id and user_id=p_user and finished_at is null;
  opponent:=case when p_user=c.challenger_id then c.recipient_id else c.challenger_id end;
  select * into other from public.showdown_cipher_states where challenge_id=p_id and user_id=opponent;
  if other.status not in('solved','exhausted','surrendered') then
    perform public.showdown_notify(c.id,opponent,'attempt_finished','Your rival has finished','Their result stays sealed until you finish your CIPHER DUEL attempt.');
    return;
  end if;
  winner:=case when s.status='solved' and other.status<>'solved' then p_user when other.status='solved' and s.status<>'solved' then opponent
    when s.status='solved' and other.status='solved' and s.guess_count<other.guess_count then p_user
    when s.status='solved' and other.status='solved' and other.guess_count<s.guess_count then opponent else null end;
  update public.showdown_challenges set status='completed',winner_id=winner,outcome=case when winner is null then 'draw' else 'winner' end,completed_at=clock_timestamp() where id=c.id;
  perform public.showdown_notify(c.id,p_user,'result','CIPHER DUEL result',case when winner is null then 'A true draw. Open the full codebreaking debrief.' when winner=p_user then 'You won this Showdown. Open the full codebreaking debrief.' else 'Your rival won this Showdown. Open the full codebreaking debrief.' end);
  perform public.showdown_notify(c.id,opponent,'result','CIPHER DUEL result',case when winner is null then 'A true draw. Open the full codebreaking debrief.' when winner=opponent then 'You won this Showdown. Open the full codebreaking debrief.' else 'Your rival won this Showdown. Open the full codebreaking debrief.' end);
end $$;
create or replace function public.cipher_write_guess_v1(p_challenge_id uuid,p_guess text[],p_expected_guess_count integer,p_request_id uuid,p_surrender boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.showdown_challenges%rowtype;q public.showdown_requests%rowtype;s public.showdown_cipher_states%rowtype;actor uuid:=auth.uid();opponent uuid;feedback jsonb;
  op text:=case when p_surrender then 'surrender_cipher' else 'guess_cipher' end;
  payload jsonb:=jsonb_build_object('guess',case when p_surrender then null else to_jsonb(p_guess) end,'expected_guess_count',p_expected_guess_count);
begin
  c:=public.cipher_lock_challenge_v1(p_challenge_id);
  if p_request_id is null then raise exception 'Request identity required';end if;
  select * into q from public.showdown_requests where request_id=p_request_id;
  if found then
    if q.user_id<>actor or q.challenge_id<>c.id or q.operation<>op or q.payload<>payload then raise exception 'Request identity already used';end if;
    return public.showdown_snapshot(c.id);
  end if;
  if c.status in('cancelled','declined','expired') then return public.showdown_snapshot(c.id);end if;
  select * into s from public.showdown_cipher_states where challenge_id=c.id and user_id=actor for update;
  if s.status in('solved','exhausted','surrendered') then raise exception 'Your attempt is already sealed';end if;
  if c.gameplay_started_at is null or s.status<>'playing' then raise exception 'Both players must lock a code first';end if;
  if p_expected_guess_count is null or p_expected_guess_count<>s.guess_count then raise exception 'Your guess history changed on another device. Reload to continue.' using errcode='40001';end if;
  if (select count(*) from public.showdown_requests where user_id=actor and created_at>now()-interval '1 minute')>=600 then raise exception 'Too many updates. Wait a moment.';end if;
  if p_surrender then
    update public.showdown_cipher_states set status='surrendered' where challenge_id=c.id and user_id=actor;
  else
    perform public.cipher_validate_code_v1(p_guess);
    opponent:=case when actor=c.challenger_id then c.recipient_id else c.challenger_id end;
    select public.cipher_feedback_v1(code,p_guess) into feedback from public.showdown_cipher_codes where challenge_id=c.id and user_id=opponent;
    insert into public.showdown_cipher_guesses(challenge_id,user_id,guess_number,guess,exact,color_only)
      values(c.id,actor,s.guess_count+1,p_guess,(feedback->>'exact')::integer,(feedback->>'color_only')::integer);
    update public.showdown_cipher_states set guess_count=s.guess_count+1,status=case when (feedback->>'exact')::integer=4 then 'solved' when s.guess_count+1=10 then 'exhausted' else 'playing' end
      where challenge_id=c.id and user_id=actor;
  end if;
  insert into public.showdown_requests values(p_request_id,c.club_id,actor,c.id,op,payload,now());
  perform public.cipher_finish_attempt_v1(c.id,actor);
  return public.showdown_snapshot(c.id);
end $$;
create or replace function public.showdown_submit_cipher_guess(p_challenge_id uuid,p_guess text[],p_expected_guess_count integer,p_request_id uuid) returns jsonb
language sql security definer set search_path=public,pg_temp as $$
  select public.cipher_write_guess_v1(p_challenge_id,p_guess,p_expected_guess_count,p_request_id,false)
$$;
create or replace function public.showdown_surrender_cipher(p_challenge_id uuid,p_expected_guess_count integer,p_request_id uuid) returns jsonb
language sql security definer set search_path=public,pg_temp as $$
  select public.cipher_write_guess_v1(p_challenge_id,null,p_expected_guess_count,p_request_id,true)
$$;

-- Only the four explicit endpoints are public. Pure feedback, secret storage,
-- statistics and all historical dispatcher implementations remain private.
do $$ declare f record;begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and
    (p.proname like 'cipher_%' or p.proname in('showdown_summary_v2_base','showdown_snapshot_v2_base','showdown_get_v2_base','showdown_lobby_v2_base',
      'showdown_create_cipher','showdown_lock_cipher_code','showdown_submit_cipher_guess','showdown_surrender_cipher')) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
grant execute on function public.showdown_create_cipher(uuid,text[],uuid,uuid),public.showdown_lock_cipher_code(uuid,text[],uuid),
  public.showdown_submit_cipher_guess(uuid,text[],integer,uuid),public.showdown_surrender_cipher(uuid,integer,uuid) to authenticated;

commit;
