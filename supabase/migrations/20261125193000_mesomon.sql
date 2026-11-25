begin;

-- Private, account-owned chapter saves. Club membership controls access to the
-- installed game; changing clubs never changes the owner of an existing slot.
create or replace function public.mesomon_can_play()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and exists (
    select 1 from public.club_members m
    join public.clubs c on c.id=m.club_id and c.status='active'
    join public.club_installed_assets i on i.club_id=m.club_id
    join public.platform_assets a on a.id=i.asset_id
    where m.user_id=auth.uid() and m.club_id=public.current_user_club_id()
      and a.slug='mesomon' and a.is_active and i.enabled and i.visible_to_members
      and public.dh_visible_club(c.id) and public.dh_visible_member(m.user_id)
  );
$$;
revoke all on function public.mesomon_can_play() from public,anon;
grant execute on function public.mesomon_can_play() to authenticated;

create table if not exists public.mesomon_save_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  schema_version integer not null default 1 check (schema_version=1),
  revision bigint not null default 1 check (revision between 1 and 9007199254740991),
  state jsonb not null check (jsonb_typeof(state)='object' and octet_length(state::text)<=131072),
  playtime_seconds integer not null default 0 check (playtime_seconds between 0 and 315360000),
  last_request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mesomon_save_slots_user_slot_key unique(user_id,slot)
);
create index if not exists mesomon_save_slots_user_id_idx on public.mesomon_save_slots(user_id);
alter table public.mesomon_save_slots enable row level security;
drop policy if exists "mesomon saves select own" on public.mesomon_save_slots;
create policy "mesomon saves select own" on public.mesomon_save_slots for select to authenticated
  using (user_id=auth.uid() and public.mesomon_can_play());
-- Revision and identity changes are RPC-only. In particular, an ordinary
-- upsert cannot defeat the compare-and-swap check on another device.
revoke all on public.mesomon_save_slots from public,anon,authenticated;
grant select on public.mesomon_save_slots to authenticated;
drop trigger if exists set_mesomon_save_updated_at on public.mesomon_save_slots;
create trigger set_mesomon_save_updated_at before update on public.mesomon_save_slots
  for each row execute function public.set_updated_at();

-- The expected owner is an identity assertion, never client authority. A queued
-- write from a former session cannot attach its chapter to a new account.
drop function if exists public.mesomon_save(uuid,smallint,bigint,uuid,jsonb);
create or replace function public.mesomon_save(
  p_club_id uuid,p_slot smallint,p_expected_revision bigint,p_request_id uuid,p_state jsonb,p_expected_user_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); existing public.mesomon_save_slots%rowtype; v_playtime integer;
begin
  if p_expected_user_id is null or actor is distinct from p_expected_user_id then
    raise exception 'Save account changed. Reload before syncing' using errcode='42501';
  end if;
  if actor is null or p_club_id is null or p_club_id is distinct from public.current_user_club_id()
    or not public.mesomon_can_play() then
    raise exception 'Mesomon needs an active club with the game enabled' using errcode='42501';
  end if;
  if p_slot is null or p_slot not between 1 and 3 or p_request_id is null
    or p_expected_revision is null or p_expected_revision not between 0 and 9007199254740990
    or p_state is null or jsonb_typeof(p_state)<>'object' or octet_length(p_state::text)>131072
    or p_state->'schemaVersion' is distinct from '1'::jsonb or p_state->'slot' is distinct from to_jsonb(p_slot)
    or p_state#>>'{player,name}' is distinct from 'Tavian'
    or jsonb_typeof(p_state->'player') is distinct from 'object'
    or jsonb_typeof(p_state->'party') is distinct from 'array'
    or jsonb_typeof(p_state->'collection') is distinct from 'object'
    or jsonb_typeof(p_state->'inventory') is distinct from 'object'
    or jsonb_typeof(p_state->'questFlags') is distinct from 'object'
    or jsonb_typeof(p_state->'settings') is distinct from 'object'
    or jsonb_typeof(p_state->'playtimeSeconds') is distinct from 'number'
    or coalesce(p_state->>'playtimeSeconds','') !~ '^[0-9]{1,9}$'
    or (p_state->>'playtimeSeconds')::bigint>315360000 then
    raise exception 'Invalid Mesomon save' using errcode='22023';
  end if;
  if jsonb_array_length(p_state->'party')>3 then raise exception 'A party holds three Mesomon' using errcode='22023'; end if;
  v_playtime:=(p_state->>'playtimeSeconds')::integer;
  -- Serializes first creation as well as existing slots, including two devices
  -- creating slot one at the same instant. No client-supplied user id is used.
  perform pg_advisory_xact_lock(hashtextextended('mesomon_save:'||actor::text||':'||p_slot::text,0));
  select * into existing from public.mesomon_save_slots where user_id=actor and slot=p_slot for update;
  if found then
    if existing.last_request_id=p_request_id then
      if existing.state<>p_state then raise exception 'Save request already used for different contents' using errcode='22023'; end if;
      return jsonb_build_object('conflict',false,'replayed',true,'save',to_jsonb(existing)-'last_request_id');
    end if;
    if existing.revision<>p_expected_revision then
      return jsonb_build_object('conflict',true,'save',to_jsonb(existing)-'last_request_id');
    end if;
    update public.mesomon_save_slots set state=p_state,playtime_seconds=v_playtime,
      revision=revision+1,last_request_id=p_request_id where id=existing.id returning * into existing;
  else
    if p_expected_revision<>0 then return jsonb_build_object('conflict',true,'save',null); end if;
    insert into public.mesomon_save_slots(user_id,slot,state,playtime_seconds,last_request_id)
      values(actor,p_slot,p_state,v_playtime,p_request_id) returning * into existing;
  end if;
  return jsonb_build_object('conflict',false,'replayed',false,'save',to_jsonb(existing)-'last_request_id');
end;
$$;
revoke all on function public.mesomon_save(uuid,smallint,bigint,uuid,jsonb,uuid) from public,anon;
grant execute on function public.mesomon_save(uuid,smallint,bigint,uuid,jsonb,uuid) to authenticated;

commit;
