begin;

-- An empty slot retains only its revision. Reusing the slot advances that
-- revision, so a delayed write from the deleted journey cannot replace it.
alter table public.mesomon_save_slots alter column state drop not null;

create or replace function public.mesomon_delete_save(
  p_club_id uuid, p_slot smallint, p_expected_revision bigint, p_expected_user_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor uuid := auth.uid();
  existing public.mesomon_save_slots%rowtype;
begin
  if actor is null or actor is distinct from p_expected_user_id then
    raise exception 'Save account changed. Reload before deleting' using errcode='42501';
  end if;
  if p_club_id is null or p_club_id is distinct from public.current_user_club_id()
    or not public.mesomon_can_play() then
    raise exception 'Mesomon needs an active club with the game enabled' using errcode='42501';
  end if;
  if p_slot is null or p_slot not between 1 and 3 or p_expected_revision is null
    or p_expected_revision not between 0 and 9007199254740990 then
    raise exception 'Invalid Mesomon delete request' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('mesomon_save:'||actor::text||':'||p_slot::text,0));
  select * into existing from public.mesomon_save_slots where user_id=actor and slot=p_slot for update;
  if not found then
    if p_expected_revision <> 0 then return jsonb_build_object('deleted',false,'revision',0); end if;
    -- A device-only chapter can still have a delayed first cloud save.
    insert into public.mesomon_save_slots(user_id,slot,state,last_request_id)
      values(actor,p_slot,null,gen_random_uuid()) returning * into existing;
  elsif existing.state is null then
    return jsonb_build_object('deleted',true,'revision',existing.revision);
  elsif existing.revision <> p_expected_revision then
    return jsonb_build_object('deleted',false,'revision',existing.revision);
  else
    update public.mesomon_save_slots set state=null, playtime_seconds=0,
      revision=revision+1, last_request_id=gen_random_uuid()
      where id=existing.id returning * into existing;
  end if;
  return jsonb_build_object('deleted',true,'revision',existing.revision);
end;
$$;
revoke all on function public.mesomon_delete_save(uuid,smallint,bigint,uuid) from public,anon;
grant execute on function public.mesomon_delete_save(uuid,smallint,bigint,uuid) to authenticated;

commit;
