-- Cipher Duel uses attempts rather than scored rounds. Extend the existing
-- permanent DH Feats evaluator and ledger; never mint rewards from invitations.
begin;

do $guard$
declare definition text;
begin
  definition:=pg_get_functiondef('public.showdown_member_metrics(uuid,uuid)'::regprocedure);
  if position('qualified_played' in definition)=0 or position('best_prism_score' in definition)=0
    or (position('a.total_score>0' in definition)=0 and position('cipher_qualified_attempts_v1' in definition)=0) then
    raise exception 'Showdown metrics contract changed; review Cipher extension before applying';
  end if;
end $guard$;

create or replace function public.showdown_member_metrics(p_user_id uuid,p_club_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  -- cipher_qualified_attempts_v1: aggregate each attempt once, including games
  -- with no puzzle-round rows. Prism and Afterimage retain positive-score rules.
  with eligible as (
    select c.*,a.total_score,
      case when c.game_key='cipher_duel' then coalesce(cs.guess_count>=1,false) else a.total_score>0 end qualified
    from public.showdown_challenges c
    join public.showdown_attempts a on a.challenge_id=c.id and a.user_id=p_user_id
    left join public.showdown_cipher_states cs on cs.challenge_id=c.id and cs.user_id=p_user_id
    where c.club_id=p_club_id and c.status='completed' and p_user_id in(c.challenger_id,c.recipient_id)
      and public.showdown_member_valid(p_club_id,p_user_id)
      and public.dh_visible_member(c.challenger_id) and public.dh_visible_member(c.recipient_id)
  ), rounds as (
    select s.challenge_id,count(*) filter(where s.solved and not s.skipped) solved,
      count(*) filter(where s.solved and not s.skipped and s.rotations=r.minimum_rotations) optimal,
      coalesce(sum(s.score),0) score
    from public.showdown_round_states s
    join public.showdown_challenge_rounds r on r.challenge_id=s.challenge_id and r.round_number=s.round_number
    where s.user_id=p_user_id group by s.challenge_id
  )
  select jsonb_build_object('played',count(c.id),'wins',count(c.id) filter(where c.winner_id=p_user_id),
    'losses',count(c.id) filter(where c.winner_id is not null and c.winner_id<>p_user_id),'draws',count(c.id) filter(where c.outcome='draw'),
    'prism_solved',coalesce(sum(r.solved) filter(where c.game_key='prism_break'),0),
    'optimum_rounds',coalesce(sum(r.optimal) filter(where c.game_key='prism_break'),0),
    'prism_score',coalesce(sum(r.score) filter(where c.game_key='prism_break'),0),
    'qualified_played',count(c.id) filter(where c.qualified),
    'qualified_wins',count(c.id) filter(where c.qualified and c.winner_id=p_user_id),
    'rival_count',count(distinct case when c.challenger_id=p_user_id then c.recipient_id else c.challenger_id end) filter(where c.qualified),
    'best_prism_score',coalesce(max(c.total_score) filter(where c.game_key='prism_break'),0))
  from eligible c left join rounds r on r.challenge_id=c.id
$$;
revoke all on function public.showdown_member_metrics(uuid,uuid) from public,anon,authenticated;
grant execute on function public.showdown_member_metrics(uuid,uuid) to service_role;

create or replace function public.cipher_feat_metrics_v1(p_user uuid,p_club uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  with eligible as (
    select c.id,c.winner_id,s.status,s.guess_count,opponent.status opponent_status,
      case when c.challenger_id=p_user then c.recipient_id else c.challenger_id end rival
    from public.showdown_challenges c
    join public.showdown_attempts a on a.challenge_id=c.id and a.user_id=p_user and a.finished_at is not null
    join public.showdown_cipher_states s on s.challenge_id=c.id and s.user_id=p_user
    join public.showdown_cipher_states opponent on opponent.challenge_id=c.id
      and opponent.user_id=case when c.challenger_id=p_user then c.recipient_id else c.challenger_id end
    where c.club_id=p_club and c.game_key='cipher_duel' and c.status='completed' and c.completed_at is not null
      and p_user in(c.challenger_id,c.recipient_id) and public.showdown_member_valid(p_club,p_user)
      and public.dh_visible_member(c.challenger_id) and public.dh_visible_member(c.recipient_id)
      and s.guess_count>=1 and s.status in('solved','exhausted','surrendered')
      and opponent.status in('solved','exhausted','surrendered')
  )
  select jsonb_build_object(
    'showdown_cipher_first_break',count(*) filter(where winner_id=p_user),
    'showdown_cipher_code_cracker',count(*) filter(where status='solved' and guess_count<=4),
    'showdown_cipher_master_decoder',count(*) filter(where status='solved' and guess_count<=3),
    'showdown_cipher_unbreakable',count(*) filter(where winner_id=p_user and status='solved' and opponent_status in('exhausted','surrendered')),
    'showdown_cipher_rivalry',coalesce((select max(matches) from(select count(*) matches from eligible group by rival) rivals),0),
    'showdown_cipher_perfect_read',count(*) filter(where status='solved' and guess_count=1))
  from eligible
$$;
revoke all on function public.cipher_feat_metrics_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cipher_feat_metrics_v1(uuid,uuid) to service_role;

insert into public.dh_feat_catalog
select * from jsonb_populate_recordset(null::public.dh_feat_catalog,$cipher_catalog$[{"key":"showdown_cipher_first_break","category":"showdown","title":"FIRST BREAK","description":"Win a completed Cipher Duel after submitting at least one guess. Awarded once.","thresholds":[1],"points":[5],"kind":"mastery","unit":"count","sort_order":76},{"key":"showdown_cipher_code_cracker","category":"showdown","title":"CODE CRACKER","description":"Solve a Cipher Duel code in four guesses or fewer. Both players must finish; awarded once.","thresholds":[1],"points":[10],"kind":"mastery","unit":"count","sort_order":77},{"key":"showdown_cipher_master_decoder","category":"showdown","title":"MASTER DECODER","description":"Solve a Cipher Duel code in three guesses or fewer. Both players must finish; awarded once.","thresholds":[1],"points":[15],"kind":"mastery","unit":"count","sort_order":78},{"key":"showdown_cipher_unbreakable","category":"showdown","title":"UNBREAKABLE","description":"Win a completed Cipher Duel while your opponent fails to solve your code. Submit at least one guess; awarded once.","thresholds":[1],"points":[15],"kind":"mastery","unit":"count","sort_order":79},{"key":"showdown_cipher_rivalry","category":"showdown","title":"RIVALRY","description":"Complete ten Cipher Duels against the same member, submitting at least one guess in each. Awarded once.","thresholds":[10],"points":[10],"kind":"volume","unit":"count","sort_order":80},{"key":"showdown_cipher_perfect_read","category":"showdown","title":"PERFECT READ","description":"Solve a Cipher Duel code on your first guess. Both players must finish; awarded once.","thresholds":[1],"points":[20],"kind":"mastery","unit":"count","sort_order":81}]$cipher_catalog$::jsonb)
on conflict(key) do update set category=excluded.category,title=excluded.title,description=excluded.description,
  thresholds=excluded.thresholds,points=excluded.points,kind=excluded.kind,unit=excluded.unit,sort_order=excluded.sort_order;

update public.dh_feat_catalog set description='Finish completed Showdown matches with at least one point of your own, or at least one submitted Cipher Duel guess. Both players must finish.' where key='showdown_matches';
update public.dh_feat_catalog set description='Win completed Showdown matches after scoring at least one point or submitting at least one Cipher Duel guess. Closed invitations do not count.' where key='showdown_wins';
update public.dh_feat_catalog set description='Finish Showdown matches against different members after scoring at least one point or submitting at least one Cipher Duel guess. Each rival counts once.' where key='showdown_rivals';

do $metrics$
declare definition text;anchor text:='  select count(*) into features from (values';
  days_anchor text:='where c.status=''completed'' and c.completed_at is not null and a.finished_at is not null and a.total_score>0';
begin
  definition:=pg_get_functiondef('public.dh_feat_metrics(uuid)'::regprocedure);
  if position('cipher_feat_metrics_v1' in definition)=0 then
    if position(anchor in definition)=0 or position('showdown_completed_activity_days_v1' in definition)=0
      or position(days_anchor in definition)=0 or position('showdown_prism_best' in definition)=0 then
      raise exception 'DH Feats evaluator changed; review Cipher extension before applying';
    end if;
    definition:=replace(definition,anchor,$extension$
  -- cipher_completed_metrics_v1: completed authoritative attempts only.
  piece:=public.cipher_feat_metrics_v1(uid,(select cm.club_id from public.club_members cm where cm.user_id=uid limit 1));
  m:=m||piece;
  select count(*) into features from (values$extension$);
    definition:=replace(definition,days_anchor,$days$where c.status='completed' and c.completed_at is not null and a.finished_at is not null
      -- cipher_completed_activity_days_v1: no zero-guess surrender activity.
      and (case when c.game_key='cipher_duel' then exists(select 1 from public.showdown_cipher_states cs
        where cs.challenge_id=c.id and cs.user_id=uid and cs.guess_count>=1) else a.total_score>0 end)$days$);
    execute definition;
  elsif position('cipher_completed_activity_days_v1' in definition)=0 or position('cipher_completed_metrics_v1' in definition)=0 then
    raise exception 'DH Feats Cipher extension is incomplete; review evaluator before applying';
  end if;
end $metrics$;

-- Refresh discovery text in place; club opt-ins and asset configuration remain
-- entirely under their existing controls.
do $discovery$
begin
  if to_regclass('public.platform_assets') is not null then
    update public.platform_assets set
      short_description='Three asynchronous mini-games. One club rivalry.',
      full_description='Challenge a club member to asynchronous head-to-head mini-games and play at different times. Prism Break features three certified light-routing boards with authoritative rotation scoring. Afterimage gives each player seven seconds to study an illustrated scene, then restore its missing objects across three rounds. Cipher Duel lets both players set a secret four-peg code using six colors, then try to solve their rival''s code within ten guesses; fewer successful guesses wins. All three games include saved progress, sealed opponent attempts, results, rivalry records and rematches. Overall Showdown standings use 3 points per win and 1 per draw, never incomparable raw game scores.',
      updated_at=now()
    where slug='dh-showdown';
  end if;
end $discovery$;

-- Completion already invalidates both members through showdown_feat_completion.
-- Historical qualifying attempts need evaluation, never hand-written unlocks.
update public.dh_feat_accounts account set dirty=true where exists(
  select 1 from public.showdown_challenges c join public.showdown_cipher_states s on s.challenge_id=c.id and s.user_id=account.user_id
  where c.game_key='cipher_duel' and c.status='completed' and c.completed_at is not null and s.guess_count>=1
    and public.showdown_member_valid(c.club_id,account.user_id)
    and public.dh_visible_member(c.challenger_id) and public.dh_visible_member(c.recipient_id));
commit;
