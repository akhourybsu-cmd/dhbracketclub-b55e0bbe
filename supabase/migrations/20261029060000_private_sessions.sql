-- Private sessions have their own club, never a public roster or game seat.
-- The registry and reversible identity/membership snapshots are server-only.
begin;
create table if not exists public.dh_private_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  workspace_id uuid not null unique references public.clubs(id),
  profile_snapshot jsonb not null,
  membership_snapshot jsonb not null,
  display_metadata_snapshot jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.dh_private_accounts enable row level security;
revoke all on public.dh_private_accounts from public,anon,authenticated;

create or replace function public.dh_public_member(uid uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select not exists(select 1 from dh_private_accounts where user_id=uid)
$$;
create or replace function public.dh_visible_member(uid uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select uid=auth.uid() or dh_public_member(uid)
$$;
create or replace function public.dh_visible_club(cid uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select not exists(select 1 from dh_private_accounts where workspace_id=cid)
    or exists(select 1 from dh_private_accounts where workspace_id=cid and user_id=auth.uid())
$$;
revoke all on function public.dh_public_member(uuid) from public,anon,authenticated;
revoke all on function public.dh_visible_member(uuid),public.dh_visible_club(uuid) from public;
grant execute on function public.dh_visible_member(uuid),public.dh_visible_club(uuid) to anon,authenticated;

-- Register an explicit identity once; names/emails are never ongoing filters.
do $$
declare uid constant uuid:='bea76765-545c-4b48-a24d-861c1918c3d6'; workspace uuid; original_club uuid;
begin
  if not exists(select 1 from profiles where id=uid) then return; end if;
  select workspace_id into workspace from dh_private_accounts where user_id=uid;
  if workspace is null then
    select club_id into original_club from club_members where user_id=uid;
    insert into clubs(name,slug,owner_admin_id,visibility,settings)
      values('Private workspace','private-'||gen_random_uuid(),uid,'private','{"private_session":true}') returning id into workspace;
    insert into dh_private_accounts(user_id,workspace_id,profile_snapshot,membership_snapshot,display_metadata_snapshot)
      select uid,workspace,to_jsonb(p),coalesce((select to_jsonb(m) from club_members m where m.user_id=uid),'{}'),
        coalesce((select jsonb_build_object('display_name',raw_user_meta_data->'display_name','name',raw_user_meta_data->'name','full_name',raw_user_meta_data->'full_name') from auth.users where id=uid),'{}')
      from profiles p where p.id=uid;
    insert into club_installed_assets(club_id,asset_id,installed_by,enabled,visible_to_members,configuration_json,sort_order)
      select workspace,asset_id,uid,enabled,visible_to_members,configuration_json,sort_order
      from club_installed_assets where club_id=original_club on conflict(club_id,asset_id) do nothing;
    update club_members set club_id=workspace,role='admin' where user_id=uid;
    insert into club_members(club_id,user_id,role) select workspace,uid,'admin'
      where not exists(select 1 from club_members where user_id=uid);
    -- The only preexisting game container is empty. Preserve it privately.
    if exists(select 1 from pools p where p.owner_user_id=uid and (
      exists(select 1 from brackets b where b.pool_id=p.id) or exists(select 1 from pool_members m where m.pool_id=p.id)
      or exists(select 1 from standings s where s.pool_id=p.id))) then
      raise exception 'Private workspace move needs review of shared pool history';
    end if;
    update pools set club_id=workspace,visibility='private' where owner_user_id=uid;
    update notifications set club_id=workspace where user_id=uid;
  end if;
  update profiles set display_name='Private session',avatar_url=null where id=uid;
  -- Preserve the login email, password, identities and all global access roles.
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}') ||
    '{"display_name":"Private session","name":"Private session","full_name":"Private session"}'::jsonb,
    raw_app_meta_data=coalesce(raw_app_meta_data,'{}') || '{"dh_private_session":true}'::jsonb where id=uid;
end $$;

create or replace function public.dh_private_write_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare payload jsonb:=to_jsonb(new); cid uuid; workspace uuid; actor uuid; col text; parent record; private_workspaces uuid[]:='{}';
begin
  if tg_table_name='profiles' then
    if not dh_public_member(new.id) then new.display_name:='Private session'; new.avatar_url:=null; end if;
    return new;
  end if;
  select workspace_id into workspace from dh_private_accounts where user_id=auth.uid();
  if workspace is not null then private_workspaces:=array_append(private_workspaces,workspace); end if;
  foreach col in array coalesce(tg_argv,'{}'::text[]) loop
    actor:=nullif(payload->>col,'')::uuid;
    select workspace_id into workspace from dh_private_accounts where user_id=actor;
    if workspace is not null then private_workspaces:=array_append(private_workspaces,workspace); end if;
  end loop;
  if cardinality(private_workspaces)=0 then return new; end if;
  if payload ? 'club_id' then
    cid:=nullif(payload->>'club_id','')::uuid;
    if exists(select 1 from unnest(private_workspaces) w where w is distinct from cid) then
      raise exception 'Private activity cannot enter a shared club' using errcode='42501';
    end if;
  else
    -- Child rows (Drop reactions, campaign messages, standings, etc.) inherit
    -- isolation from their actual foreign-key parent, not a client club value.
    for parent in select p.relname tbl, a.attname child_col, b.attname parent_col
      from pg_constraint f join pg_class p on p.oid=f.confrelid
      join pg_attribute a on a.attrelid=f.conrelid and a.attnum=f.conkey[1]
      join pg_attribute b on b.attrelid=f.confrelid and b.attnum=f.confkey[1]
      where f.conrelid=tg_relid and f.contype='f' and cardinality(f.conkey)=1
      and exists(select 1 from pg_attribute c where c.attrelid=p.oid and c.attname='club_id' and not c.attisdropped) loop
      if nullif(payload->>parent.child_col,'') is null then continue; end if;
      execute format('select club_id from public.%I where %I=$1::uuid',parent.tbl,parent.parent_col)
        into cid using payload->>parent.child_col;
      if exists(select 1 from unnest(private_workspaces) w where w is distinct from cid) then
        raise exception 'Private activity cannot enter a shared club' using errcode='42501';
      end if;
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.dh_private_write_guard() from public,anon,authenticated;
drop trigger if exists zz_dh_private_guard on public.profiles;
create trigger zz_dh_private_guard before insert or update on public.profiles for each row execute function public.dh_private_write_guard();

-- Restrictive policies also constrain existing platform-admin ALL policies.
-- Preserve each table's existing permissions and do not enable client access.
do $$
declare tbl record; col record; checks text; actors text; has_club boolean;
begin
  for tbl in select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname<>'dh_private_accounts' loop
    checks:=''; actors:=''; has_club:=false;
    for col in select column_name from information_schema.columns where table_schema='public' and table_name=tbl.relname
      and udt_name='uuid' and column_name in('club_id','user_id','actor_user_id','created_by','attacker_id','sender_id','owner_id','owner_user_id','owner_admin_id','reader_user_id','user_a','user_b','winner_user_id',
        'installed_by','gm_id','proposed_gm_id','approved_by','invited_by','current_pick_user_id','frame_target_user_id','guessed_user_id',
        'commissioner_user_id','champion_user_id','runner_up_user_id','third_place_user_id','regular_season_champion_user_id','resolved_by','reviewed_by','requested_by') loop
      if col.column_name='club_id' then
        has_club:=true;
        checks:=checks||format(' and public.dh_visible_club(%I)',col.column_name);
      else
        checks:=checks||format(' and public.dh_visible_member(%I)',col.column_name);
        actors:=actors||case when actors='' then '' else ',' end||quote_literal(col.column_name);
      end if;
    end loop;
    if tbl.relname='profiles' then checks:=checks||' and public.dh_visible_member(id)'; end if;
    if tbl.relname='clubs' then checks:=checks||' and public.dh_visible_club(id)'; end if;
    if checks<>'' and tbl.relrowsecurity then
      execute format('drop policy if exists dh_private_visibility on public.%I',tbl.relname);
      execute format('create policy dh_private_visibility on public.%I as restrictive for all to anon,authenticated using (true %s) with check (true %s)',tbl.relname,checks,checks);
    end if;
    if tbl.relname<>'profiles' and (has_club or actors<>'') then
      execute format('drop trigger if exists zz_dh_private_guard on public.%I',tbl.relname);
      execute format('create trigger zz_dh_private_guard before insert or update on public.%I for each row execute function public.dh_private_write_guard(%s)',tbl.relname,actors);
    end if;
  end loop;
end $$;

-- Presence broadcasts are untrusted; clients use this canonical public roster.
create or replace function public.dh_presence_directory(p_club_id uuid)
returns table(id uuid,display_name text,avatar_url text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not exists(select 1 from club_members m where m.club_id=p_club_id and m.user_id=auth.uid()) then
    raise exception 'Club membership required';
  end if;
  return query select p.id,p.display_name,p.avatar_url from profiles p
    where dh_public_member(p.id) and exists(select 1 from club_members m where m.user_id=p.id and m.club_id=p_club_id);
end $$;
revoke all on function public.dh_presence_directory(uuid) from public,anon;
grant execute on function public.dh_presence_directory(uuid) to authenticated;
commit;
