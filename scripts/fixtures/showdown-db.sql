-- Minimal existing application infrastructure for isolated PostgreSQL checks.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.user',true),'')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('test.role',true),'')
$$;
create table public.clubs(id uuid primary key,name text not null,status text not null default 'active');
create table public.profiles(id uuid primary key,display_name text not null,avatar_url text);
create table public.club_members(
  id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),
  user_id uuid not null unique references public.profiles(id),role text not null default 'member',created_at timestamptz not null default now()
);
create function public.current_user_club_id() returns uuid language sql stable security definer set search_path=public as $$
  select club_id from public.club_members where user_id=auth.uid() limit 1
$$;
create function public.dh_public_member(uid uuid) returns boolean language sql stable as $$
  select uid is distinct from '00000000-0000-4000-8000-000000000007'::uuid
$$;
create function public.dh_visible_member(uid uuid) returns boolean language sql stable as $$
  select uid=auth.uid() or public.dh_public_member(uid)
$$;
create function public.dh_visible_club(cid uuid) returns boolean language sql stable as $$
  select cid is distinct from '00000000-0000-4000-8000-000000001003'::uuid
    or exists(select 1 from public.club_members where user_id=auth.uid() and club_id=cid)
$$;
create function public.dh_private_write_guard() returns trigger language plpgsql as $$
declare field text;
begin
  if new.club_id is distinct from '00000000-0000-4000-8000-000000001003'::uuid then
    if auth.uid()='00000000-0000-4000-8000-000000000007'::uuid then raise exception 'Private activity cannot enter a shared club' using errcode='42501';end if;
    foreach field in array tg_argv loop
      if to_jsonb(new)->>field='00000000-0000-4000-8000-000000000007' then raise exception 'Private activity cannot enter a shared club' using errcode='42501';end if;
    end loop;
  end if;
  return new;
end $$;
create table public.notifications(
  id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),club_id uuid references public.clubs(id),
  type text not null,title text not null,body text,url text,actor_user_id uuid references public.profiles(id),
  read_at timestamptz,created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
grant select,update,delete on public.notifications to authenticated;
create policy notification_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy notification_update on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy notification_delete on public.notifications for delete to authenticated using(user_id=auth.uid());
create trigger zz_dh_private_guard before insert or update on public.notifications for each row execute function public.dh_private_write_guard('user_id','actor_user_id');
grant usage on schema public,auth to anon,authenticated,service_role;
insert into public.clubs(id,name,status) values
  ('00000000-0000-4000-8000-000000001001','Club One','active'),
  ('00000000-0000-4000-8000-000000001002','Club Two','active'),
  ('00000000-0000-4000-8000-000000001003','Private Club','active');
insert into public.profiles(id,display_name) values
  ('00000000-0000-4000-8000-000000000001','Alex'),
  ('00000000-0000-4000-8000-000000000002','Blair'),
  ('00000000-0000-4000-8000-000000000003','Casey'),
  ('00000000-0000-4000-8000-000000000004','Darcy'),
  ('00000000-0000-4000-8000-000000000005','Erin'),
  ('00000000-0000-4000-8000-000000000006','Not a member'),
  ('00000000-0000-4000-8000-000000000007','Private member'),
  ('00000000-0000-4000-8000-000000000008','Private peer');
insert into public.club_members(club_id,user_id) values
  ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000005'),
  ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000007'),
  ('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000008');
