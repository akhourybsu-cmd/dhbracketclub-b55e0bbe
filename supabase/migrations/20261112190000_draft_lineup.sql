-- Lineup Drafts: the existing Draft Arena records, with server-owned turns and
-- slot assignments. Classic and Live Draft writes retain their prior behavior.
begin;

create or replace function public.draft_lineup_valid_config(p_config jsonb)
returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare piece jsonb; ids text[]:=array[]::text[];
begin
  if p_config is null or jsonb_typeof(p_config)<>'object'
    or (p_config-array['version','template_id','slots'])<>'{}'::jsonb
    or p_config->'version' is distinct from '1'::jsonb
    or jsonb_typeof(p_config->'template_id') is distinct from 'string'
    or (p_config->>'template_id') !~ '^[a-z][a-z0-9_-]{0,47}$'
    or jsonb_typeof(p_config->'slots') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_config->'slots') not between 2 and 20 then return false; end if;
  for piece in select value from jsonb_array_elements(p_config->'slots') loop
    if jsonb_typeof(piece)<>'object' or (piece-array['id','label','description'])<>'{}'::jsonb
      or jsonb_typeof(piece->'id') is distinct from 'string'
      or (piece->>'id') !~ '^[a-z][a-z0-9_-]{0,47}$'
      or jsonb_typeof(piece->'label') is distinct from 'string'
      or length(btrim(piece->>'label')) not between 1 and 36
      or (piece->>'label')<>btrim(piece->>'label')
      or (piece?'description' and (jsonb_typeof(piece->'description') is distinct from 'string' or length(piece->>'description')>120))
      or (piece->>'id')=any(ids) then return false; end if;
    ids:=array_append(ids,piece->>'id');
  end loop;
  return true;
end $$;
revoke all on function public.draft_lineup_valid_config(jsonb) from public,anon;
grant execute on function public.draft_lineup_valid_config(jsonb) to authenticated,service_role;

alter table public.drafts add column if not exists draft_format text not null default 'classic';
alter table public.drafts add column if not exists lineup_config jsonb;
alter table public.draft_picks add column if not exists lineup_slot_id text;
alter table public.drafts drop constraint if exists drafts_status_check;
alter table public.drafts add constraint drafts_status_check check(status in('setup','in_progress','complete','cancelled'));
alter table public.drafts drop constraint if exists drafts_lineup_config_check;
alter table public.drafts add constraint drafts_lineup_config_check check(
  (draft_format='classic' and lineup_config is null and status<>'cancelled')
  or (draft_format='lineup' and public.draft_lineup_valid_config(lineup_config)
    and num_rounds=jsonb_array_length(lineup_config->'slots') and not is_live)
);
alter table public.draft_picks drop constraint if exists draft_picks_lineup_slot_check;
alter table public.draft_picks add constraint draft_picks_lineup_slot_check
  check(lineup_slot_id is null or lineup_slot_id~'^[a-z][a-z0-9_-]{0,47}$');
create unique index if not exists draft_lineup_member_slot_key on public.draft_picks(draft_id,user_id,lineup_slot_id) where lineup_slot_id is not null;
create unique index if not exists draft_lineup_pick_number_key on public.draft_picks(draft_id,pick_number) where lineup_slot_id is not null;
create index if not exists drafts_lineup_club_status_idx on public.drafts(club_id,draft_format,status,created_at desc);

create table if not exists public.draft_lineup_receipts(
  actor_user_id uuid not null references public.profiles(id),
  request_id uuid not null,
  club_id uuid not null references public.clubs(id),
  draft_id uuid not null references public.drafts(id),
  action text not null check(action in('create','join','leave','start','pick','edit_pick','cancel')),
  request_payload jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_user_id,request_id)
);
create index if not exists draft_lineup_receipts_actor_time_idx on public.draft_lineup_receipts(actor_user_id,created_at desc);
alter table public.draft_lineup_receipts enable row level security;
revoke all on public.draft_lineup_receipts from public,anon,authenticated;
grant all on public.draft_lineup_receipts to service_role;

-- A child row's forged club_id must not hide its real parent behind RLS.
-- This helper exposes no parent records and can only reject a direct write.
create or replace function public.draft_lineup_reject_direct_child(p_draft_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.drafts where id=p_draft_id and draft_format='lineup') then
    raise exception 'Use the Lineup Draft action to change this roster' using errcode='42501';
  end if;
end $$;
revoke all on function public.draft_lineup_reject_direct_child(uuid) from public,anon;
grant execute on function public.draft_lineup_reject_direct_child(uuid) to authenticated;

-- This trigger is intentionally SECURITY INVOKER. RPC execution inherits its
-- trusted owner; an ordinary authenticated query cannot spoof current_user.
create or replace function public.draft_lineup_write_guard()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare d public.drafts%rowtype; linked uuid; trusted boolean;
begin
  trusted:=current_user='service_role' or current_user=pg_get_userbyid((select proowner from pg_proc where oid='public.draft_lineup_action(uuid,uuid,uuid,text,jsonb)'::regprocedure));
  if tg_table_name='drafts' then
    if tg_op='DELETE' then
      if old.draft_format='lineup' then raise exception 'Cancel a Lineup Draft instead of deleting its history' using errcode='42501'; end if;
      return old;
    end if;
    if new.draft_format='classic' and (tg_op='INSERT' or old.draft_format='classic') then return new; end if;
    if not trusted then raise exception 'Use the Lineup Draft action to change this draft' using errcode='42501'; end if;
    if tg_op='UPDATE' and old.draft_format='lineup' then
      if new.draft_format<>old.draft_format or new.id<>old.id or new.club_id<>old.club_id
        or new.created_by<>old.created_by or new.competition_id<>old.competition_id
        or (old.status<>'setup' and (new.lineup_config is distinct from old.lineup_config
          or new.num_rounds<>old.num_rounds or new.topic<>old.topic
          or new.ai_context is distinct from old.ai_context
          or new.ai_context_override is distinct from old.ai_context_override)) then
        raise exception 'This Lineup Draft configuration is locked' using errcode='42501';
      end if;
      if (old.status='setup' and new.status not in('setup','in_progress','cancelled'))
        or (old.status='in_progress' and new.status not in('in_progress','complete','cancelled'))
        or (old.status in('complete','cancelled') and (new.status<>old.status
          or new.current_pick_number<>old.current_pick_number or new.current_round<>old.current_round
          or new.current_pick_user_id is distinct from old.current_pick_user_id)) then
        raise exception 'This Lineup Draft phase is locked' using errcode='42501';
      end if;
    end if;
    return new;
  end if;

  linked:=case when tg_op='DELETE' then old.draft_id else new.draft_id end;
  if not trusted then
    perform public.draft_lineup_reject_direct_child(linked);
    if tg_op='UPDATE' and old.draft_id<>new.draft_id then perform public.draft_lineup_reject_direct_child(old.draft_id); end if;
  end if;
  select * into d from public.drafts where id=linked;
  -- A caller cannot move a Lineup row into a Classic draft to evade the guard.
  if tg_op='UPDATE' and old.draft_id<>new.draft_id and exists(select 1 from public.drafts where id=old.draft_id and draft_format='lineup') then
    raise exception 'A Lineup Draft row cannot change drafts' using errcode='42501';
  end if;
  if d.draft_format is distinct from 'lineup' then
    if tg_table_name='draft_picks' and tg_op<>'DELETE' then
      if new.lineup_slot_id is not null then raise exception 'Classic picks do not have lineup slots' using errcode='23514'; end if;
    end if;
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if not trusted then raise exception 'Use the Lineup Draft action to change this roster' using errcode='42501'; end if;
  if tg_table_name='draft_skips' then raise exception 'Lineup Drafts have no skipped turns' using errcode='42501'; end if;
  if tg_table_name='draft_results' then
    if d.status<>'complete' then raise exception 'Complete the Lineup Draft before grading it' using errcode='42501'; end if;
    if tg_op='DELETE' then return old; end if;
    if new.club_id<>d.club_id or not exists(select 1 from public.draft_participants p where p.draft_id=d.id and p.user_id=new.user_id) then
      raise exception 'A report must belong to this lineup roster' using errcode='23514';
    end if;
    if jsonb_typeof(new.pick_ratings) is distinct from 'array' then
      raise exception 'Lineup reports require current slot-aware grading' using errcode='23514';
    end if;
    if jsonb_array_length(new.pick_ratings)<>d.num_rounds
      or (select count(distinct r->>'pick_id') from jsonb_array_elements(new.pick_ratings) r)<>d.num_rounds
      or exists(select 1 from jsonb_array_elements(new.pick_ratings) r where jsonb_typeof(r)<>'object'
        or r->>'scoring_version' is distinct from 'lineup_v1'
        or not exists(select 1 from public.draft_picks p
          join lateral jsonb_array_elements(d.lineup_config->'slots') s on s->>'id'=p.lineup_slot_id
          where p.draft_id=d.id and p.user_id=new.user_id and p.id::text=r->>'pick_id'
            and p.lineup_slot_id=r->>'lineup_slot_id' and s->>'label'=r->>'lineup_slot_label'
            and p.pick_text=r->>'pick_text')) then
      raise exception 'Lineup reports require current slot-aware grading' using errcode='23514';
    end if;
    return new;
  end if;
  if tg_table_name='draft_participants' then
    if d.status<>'setup' then raise exception 'The Lineup Draft roster is locked' using errcode='42501'; end if;
    if tg_op<>'DELETE' and (new.club_id<>d.club_id or not public.dh_visible_member(new.user_id)
      or not exists(select 1 from public.club_members m where m.club_id=d.club_id and m.user_id=new.user_id)
      or exists(select 1 from public.dh_private_accounts a where a.user_id=new.user_id and a.workspace_id<>d.club_id)) then
      raise exception 'An available member of this club is required' using errcode='42501';
    end if;
    if tg_op='UPDATE' and (new.user_id<>old.user_id or new.draft_id<>old.draft_id or new.club_id<>old.club_id) then
      raise exception 'A Lineup Draft seat cannot change owners' using errcode='42501';
    end if;
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_table_name='draft_picks' then
    if tg_op='DELETE' or d.status<>'in_progress' then raise exception 'Locked Lineup Draft picks cannot be removed or replayed' using errcode='42501'; end if;
    if new.club_id<>d.club_id or new.lineup_slot_id is null
      or not exists(select 1 from jsonb_array_elements(d.lineup_config->'slots') s where s->>'id'=new.lineup_slot_id)
      or not exists(select 1 from public.draft_participants p where p.draft_id=d.id and p.user_id=new.user_id) then
      raise exception 'The pick must fill one of this member''s lineup slots' using errcode='23514';
    end if;
    if tg_op='UPDATE' and (new.id<>old.id or new.draft_id<>old.draft_id or new.user_id<>old.user_id
      or new.club_id<>old.club_id or new.lineup_slot_id<>old.lineup_slot_id or new.round<>old.round
      or new.pick_number<>old.pick_number or new.picked_at<>old.picked_at) then
      raise exception 'A saved Lineup Draft slot cannot be reassigned' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.draft_lineup_write_guard() from public,anon,authenticated;

create or replace function public.draft_lineup_action(
  p_club_id uuid,p_draft_id uuid,p_request_id uuid,p_action text,p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor uuid:=auth.uid(); d public.drafts%rowtype; receipt public.draft_lineup_receipts%rowtype;
  requested jsonb:=jsonb_build_object('draft_id',p_draft_id,'payload',p_payload); response jsonb;
  cid uuid; did uuid; pid uuid; config jsonb; topic_text text; description_text text; context_text text;
  manager boolean; members integer; consumed integer; next_user uuid; seat record; turn_index integer;
  v_pick_text text; slot_text text; existing_pick public.draft_picks%rowtype;
begin
  if actor is null or p_club_id is null or p_club_id is distinct from public.current_user_club_id()
    or not public.dh_visible_club(p_club_id) or not public.dh_visible_member(actor)
    or not exists(select 1 from public.club_members where club_id=p_club_id and user_id=actor)
    or exists(select 1 from public.dh_private_accounts a where a.user_id=actor and a.workspace_id<>p_club_id) then
    raise exception 'Active club membership required' using errcode='42501';
  end if;
  perform 1 from public.club_members where club_id=p_club_id and user_id=actor for share;
  if not found then raise exception 'Active club membership required' using errcode='42501'; end if;
  perform 1 from public.clubs where id=p_club_id and status='active' for share;
  if not found then raise exception 'This club is unavailable' using errcode='42501'; end if;
  perform 1 from public.club_installed_assets i join public.platform_assets a on a.id=i.asset_id
    where i.club_id=p_club_id and a.slug='draft-arena' and a.is_active and i.enabled and i.visible_to_members for share of i,a;
  if not found then raise exception 'Draft Arena is not enabled in this club' using errcode='42501'; end if;
  if p_request_id is null or p_action is null or p_action not in('create','join','leave','start','pick','edit_pick','cancel')
    or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>16000 then
    raise exception 'Invalid Lineup Draft request' using errcode='22023';
  end if;
  -- Same request is serialized even when create has no draft ID yet.
  perform pg_advisory_xact_lock(hashtextextended('draft_lineup_request:'||actor::text||':'||p_request_id::text,0));
  select * into receipt from public.draft_lineup_receipts where actor_user_id=actor and request_id=p_request_id;
  if found then
    if receipt.club_id<>p_club_id or receipt.action<>p_action or receipt.request_payload<>requested then
      raise exception 'This request was already used for a different action' using errcode='22023';
    end if;
    return receipt.response||jsonb_build_object('replayed',true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('draft_lineup_actor:'||actor::text,0));
  if (select count(*) from public.draft_lineup_receipts where actor_user_id=actor and created_at>now()-interval '1 minute')>=120 then
    raise exception 'Too many actions. Try again in a moment' using errcode='54000';
  end if;

  if p_action='create' then
    if p_draft_id is not null or (p_payload-array['topic','description','ai_context','lineup_config'])<>'{}'::jsonb then
      raise exception 'Invalid Lineup Draft setup' using errcode='22023';
    end if;
    if jsonb_typeof(p_payload->'topic') is distinct from 'string'
      or (p_payload?'description' and jsonb_typeof(p_payload->'description') is distinct from 'string')
      or (p_payload?'ai_context' and jsonb_typeof(p_payload->'ai_context') is distinct from 'string') then
      raise exception 'Draft text must be plain text' using errcode='22023';
    end if;
    topic_text:=btrim(p_payload->>'topic'); description_text:=btrim(coalesce(p_payload->>'description',''));
    context_text:=btrim(coalesce(p_payload->>'ai_context','')); config:=p_payload->'lineup_config';
    if length(topic_text) not between 1 and 100 or length(description_text)>200 or length(context_text)>1000
      or not public.draft_lineup_valid_config(config) then raise exception 'Check the topic and lineup slots' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended('draft_lineup_create:'||actor::text,0));
    if (select count(*) from public.draft_lineup_receipts where actor_user_id=actor and action='create' and created_at>now()-interval '1 hour')>=8
      or (select count(*) from public.drafts where created_by=actor and club_id=p_club_id and draft_format='lineup' and status in('setup','in_progress'))>=10 then
      raise exception 'Finish an open Lineup Draft before creating another' using errcode='54000';
    end if;
    insert into public.competitions(club_id,type,title,description,created_by,status)
      values(p_club_id,'draft',topic_text,nullif(description_text,''),actor,'active') returning id into cid;
    insert into public.drafts(club_id,competition_id,created_by,topic,ai_context,num_rounds,draft_format,lineup_config,is_live,status)
      values(p_club_id,cid,actor,topic_text,nullif(context_text,''),jsonb_array_length(config->'slots'),'lineup',config,false,'setup') returning * into d;
    insert into public.draft_participants(club_id,draft_id,user_id,pick_order) values(p_club_id,d.id,actor,1);
    insert into public.activity_feed(club_id,actor_user_id,event_type,target_type,target_id,metadata)
      values(p_club_id,actor,'draft_created','draft',d.id,jsonb_build_object('topic',d.topic,'draft_format','lineup','url','/drafts/lineup/'||d.id::text));
  else
    select * into d from public.drafts where id=p_draft_id and club_id=p_club_id and draft_format='lineup' for update;
    if not found or not public.dh_visible_member(d.created_by) then raise exception 'Lineup Draft unavailable' using errcode='42501'; end if;
    manager:=d.created_by=actor or public.is_app_admin(actor) or public.is_club_admin(actor,p_club_id)
      or exists(select 1 from public.draft_season_entries e where e.draft_id=d.id and public.draft_commissioner_can_manage(e.season_id));
    select count(*) into members from public.draft_participants where draft_id=d.id;
    if p_action in('join','leave','start','cancel') and p_payload<>'{}'::jsonb then raise exception 'This action takes no extra fields' using errcode='22023'; end if;
    if p_action in('join','leave','start') and d.status<>'setup' then raise exception 'The Lineup Draft roster is locked' using errcode='42501'; end if;
    if p_action='join' then
      if not exists(select 1 from public.draft_participants where draft_id=d.id and user_id=actor) then
        if members>=24 then raise exception 'This Lineup Draft is full'; end if;
        insert into public.draft_participants(club_id,draft_id,user_id,pick_order)
          select p_club_id,d.id,actor,coalesce(max(pick_order),0)+1 from public.draft_participants where draft_id=d.id;
      end if;
    elsif p_action='leave' then
      if d.created_by=actor then raise exception 'The host stays on the roster. Cancel the draft instead'; end if;
      delete from public.draft_participants where draft_id=d.id and user_id=actor;
    elsif p_action='start' then
      if not manager then raise exception 'Only the host or commissioner can start this draft' using errcode='42501'; end if;
      if members not between 2 and 24 then raise exception 'At least two players are needed'; end if;
      if exists(select 1 from public.draft_participants p where p.draft_id=d.id
        and (not public.dh_visible_member(p.user_id) or not exists(select 1 from public.club_members m where m.club_id=p_club_id and m.user_id=p.user_id)
          or exists(select 1 from public.dh_private_accounts a where a.user_id=p.user_id and a.workspace_id<>p_club_id))) then
        raise exception 'A player is no longer available in this club';
      end if;
      update public.draft_participants set pick_order=pick_order+100000 where draft_id=d.id;
      with shuffled as (select id,row_number() over(order by gen_random_uuid())::integer n from public.draft_participants where draft_id=d.id)
        update public.draft_participants p set pick_order=s.n from shuffled s where p.id=s.id;
      select user_id into next_user from public.draft_participants where draft_id=d.id order by pick_order limit 1;
      update public.drafts set status='in_progress',current_pick_number=1,current_round=1,current_pick_user_id=next_user,
        pick_deadline_at=null,clock_paused_at=null,clock_started_at=null where id=d.id returning * into d;
      insert into public.notifications(user_id,club_id,type,title,body,url,actor_user_id)
        select user_id,p_club_id,'draft',case when user_id=next_user then 'Your lineup turn' else 'Lineup Draft started' end,
          d.topic,'/drafts/lineup/'||d.id::text,actor from public.draft_participants where draft_id=d.id;
    elsif p_action='pick' then
      if (p_payload-array['text','slot_id'])<>'{}'::jsonb or jsonb_typeof(p_payload->'text') is distinct from 'string'
        or jsonb_typeof(p_payload->'slot_id') is distinct from 'string' then raise exception 'Choose a pick and an open slot' using errcode='22023'; end if;
      v_pick_text:=btrim(p_payload->>'text'); slot_text:=p_payload->>'slot_id';
      if length(v_pick_text) not between 1 and 100 or v_pick_text~'[[:cntrl:]]' or public.normalize_pick_text(v_pick_text)='' then
        raise exception 'Enter a pick between 1 and 100 characters' using errcode='22023'; end if;
      if d.status<>'in_progress' then raise exception 'This Lineup Draft is not accepting picks' using errcode='42501'; end if;
      if exists(select 1 from public.draft_participants p where p.draft_id=d.id and not exists(select 1 from public.club_members m where m.club_id=d.club_id and m.user_id=p.user_id)) then
        raise exception 'A player left this club. Ask the host to cancel the draft'; end if;
      select count(*) into consumed from public.draft_picks where draft_id=d.id;
      if members<2 or consumed>=members*d.num_rounds then raise exception 'This draft has no remaining turns'; end if;
      turn_index:=case when (consumed/members)%2=0 then consumed%members else members-1-consumed%members end;
      select user_id into next_user from public.draft_participants where draft_id=d.id order by pick_order offset turn_index limit 1;
      if next_user is distinct from actor then raise exception 'It is another player''s turn' using errcode='42501'; end if;
      if not exists(select 1 from jsonb_array_elements(d.lineup_config->'slots') s where s->>'id'=slot_text) then
        raise exception 'Choose one of this draft''s lineup slots' using errcode='22023'; end if;
      if exists(select 1 from public.draft_picks where draft_id=d.id and user_id=actor and lineup_slot_id=slot_text) then
        raise exception 'That lineup slot is already filled' using errcode='23505'; end if;
      insert into public.draft_picks(club_id,draft_id,user_id,pick_number,round,pick_text,lineup_slot_id)
        values(p_club_id,d.id,actor,consumed+1,consumed/members+1,v_pick_text,slot_text) returning id into pid;
      consumed:=consumed+1;
      if consumed=members*d.num_rounds then
        update public.drafts set status='complete',current_pick_number=consumed+1,current_round=d.num_rounds,current_pick_user_id=null where id=d.id returning * into d;
        update public.competitions set status='closed' where id=d.competition_id and club_id=d.club_id;
        insert into public.activity_feed(club_id,actor_user_id,event_type,target_type,target_id,metadata)
          values(p_club_id,actor,'draft_completed','draft',d.id,jsonb_build_object('topic',d.topic,'draft_format','lineup','url','/drafts/lineup/'||d.id::text));
        insert into public.notifications(user_id,club_id,type,title,body,url,actor_user_id)
          select user_id,p_club_id,'draft','Lineup Draft complete',d.topic,'/drafts/lineup/'||d.id::text,actor from public.draft_participants where draft_id=d.id;
      else
        turn_index:=case when (consumed/members)%2=0 then consumed%members else members-1-consumed%members end;
        select user_id into next_user from public.draft_participants where draft_id=d.id order by pick_order offset turn_index limit 1;
        update public.drafts set current_pick_number=consumed+1,current_round=consumed/members+1,current_pick_user_id=next_user where id=d.id;
        if next_user<>actor then insert into public.notifications(user_id,club_id,type,title,body,url,actor_user_id)
          values(next_user,p_club_id,'draft','Your lineup turn',d.topic,'/drafts/lineup/'||d.id::text,actor); end if;
      end if;
    elsif p_action='edit_pick' then
      if (p_payload-array['pick_id','text'])<>'{}'::jsonb or jsonb_typeof(p_payload->'text') is distinct from 'string'
        or jsonb_typeof(p_payload->'pick_id') is distinct from 'string' then raise exception 'Choose a saved pick and correction' using errcode='22023'; end if;
      v_pick_text:=btrim(p_payload->>'text');
      if length(v_pick_text) not between 1 and 100 or v_pick_text~'[[:cntrl:]]' or public.normalize_pick_text(v_pick_text)='' then raise exception 'Enter a pick between 1 and 100 characters' using errcode='22023'; end if;
      if d.status<>'in_progress' or exists(select 1 from public.draft_results where draft_id=d.id) then raise exception 'Completed picks are locked' using errcode='42501'; end if;
      select * into existing_pick from public.draft_picks where id=(p_payload->>'pick_id')::uuid and draft_id=d.id for update;
      if not found or not(existing_pick.user_id=actor or manager) then raise exception 'You cannot edit this pick' using errcode='42501'; end if;
      update public.draft_picks set pick_text=v_pick_text where id=existing_pick.id returning id into pid;
      delete from public.item_enrichments where item_type='draft_pick' and item_id=pid;
    elsif p_action='cancel' then
      if not manager then raise exception 'Only the host or commissioner can cancel this draft' using errcode='42501'; end if;
      if d.status not in('setup','in_progress') or exists(select 1 from public.draft_results where draft_id=d.id) then raise exception 'This draft can no longer be cancelled'; end if;
      update public.drafts set status='cancelled',current_pick_user_id=null,pick_deadline_at=null,clock_paused_at=null where id=d.id;
      update public.competitions set status='closed' where id=d.competition_id and club_id=d.club_id;
    end if;
  end if;
  response:=jsonb_build_object('draft_id',d.id,'action',p_action,'replayed',false);
  if pid is not null then response:=response||jsonb_build_object('pick_id',pid); end if;
  insert into public.draft_lineup_receipts(actor_user_id,request_id,club_id,draft_id,action,request_payload,response)
    values(actor,p_request_id,p_club_id,d.id,p_action,requested,response);
  return response;
end $$;
revoke all on function public.draft_lineup_action(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.draft_lineup_action(uuid,uuid,uuid,text,jsonb) to authenticated;

drop trigger if exists aaa_draft_lineup_guard on public.drafts;
create trigger aaa_draft_lineup_guard before insert or update or delete on public.drafts for each row execute function public.draft_lineup_write_guard();
drop trigger if exists aaa_draft_lineup_guard on public.draft_picks;
create trigger aaa_draft_lineup_guard before insert or update or delete on public.draft_picks for each row execute function public.draft_lineup_write_guard();
drop trigger if exists aaa_draft_lineup_guard on public.draft_participants;
create trigger aaa_draft_lineup_guard before insert or update or delete on public.draft_participants for each row execute function public.draft_lineup_write_guard();
drop trigger if exists aaa_draft_lineup_guard on public.draft_skips;
create trigger aaa_draft_lineup_guard before insert or update or delete on public.draft_skips for each row execute function public.draft_lineup_write_guard();
drop trigger if exists aaa_draft_lineup_guard on public.draft_results;
create trigger aaa_draft_lineup_guard before insert or update or delete on public.draft_results for each row execute function public.draft_lineup_write_guard();

commit;
