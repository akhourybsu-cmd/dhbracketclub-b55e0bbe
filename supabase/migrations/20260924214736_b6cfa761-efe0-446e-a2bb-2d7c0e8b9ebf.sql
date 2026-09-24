create table public.daily_finds (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  find_date date not null default current_date,
  kind text not null default 'learned',
  title text not null,
  note text,
  url text,
  image_path text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_finds_kind_chk check (kind in ('learned','article','photo')),
  constraint daily_finds_title_len check (char_length(title) between 1 and 160),
  constraint daily_finds_note_len check (note is null or char_length(note) <= 2000),
  unique (club_id, user_id, find_date)
);
create index daily_finds_club_date_idx on public.daily_finds (club_id, find_date desc);
create index daily_finds_tags_idx on public.daily_finds using gin (tags);

grant select, insert, update, delete on public.daily_finds to authenticated;
grant all on public.daily_finds to service_role;
alter table public.daily_finds enable row level security;

create policy "Members read club finds" on public.daily_finds for select to authenticated
  using (exists (select 1 from public.club_members m where m.club_id = daily_finds.club_id and m.user_id = auth.uid()));
create policy "Members create own finds" on public.daily_finds for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.club_members m where m.club_id = daily_finds.club_id and m.user_id = auth.uid()));
create policy "Owners update finds" on public.daily_finds for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Owners or admins delete finds" on public.daily_finds for delete to authenticated
  using (user_id = auth.uid() or public.is_club_admin(auth.uid(), club_id));

create trigger daily_finds_updated_at before update on public.daily_finds
  for each row execute function public.set_updated_at();

create table public.daily_find_reactions (
  id uuid primary key default gen_random_uuid(),
  find_id uuid not null references public.daily_finds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint daily_find_reactions_emoji_len check (char_length(emoji) <= 16),
  unique (find_id, user_id, emoji)
);
grant select, insert, delete on public.daily_find_reactions to authenticated;
grant all on public.daily_find_reactions to service_role;
alter table public.daily_find_reactions enable row level security;
create policy "Members read find reactions" on public.daily_find_reactions for select to authenticated
  using (exists (select 1 from public.daily_finds f join public.club_members m on m.club_id = f.club_id where f.id = find_id and m.user_id = auth.uid()));
create policy "Members add own reactions" on public.daily_find_reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.daily_finds f join public.club_members m on m.club_id = f.club_id where f.id = find_id and m.user_id = auth.uid()));
create policy "Members remove own reactions" on public.daily_find_reactions for delete to authenticated
  using (user_id = auth.uid());

create table public.daily_find_comments (
  id uuid primary key default gen_random_uuid(),
  find_id uuid not null references public.daily_finds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint daily_find_comments_len check (char_length(body) between 1 and 1000)
);
create index daily_find_comments_find_idx on public.daily_find_comments (find_id, created_at);
grant select, insert, delete on public.daily_find_comments to authenticated;
grant all on public.daily_find_comments to service_role;
alter table public.daily_find_comments enable row level security;
create policy "Members read find comments" on public.daily_find_comments for select to authenticated
  using (exists (select 1 from public.daily_finds f join public.club_members m on m.club_id = f.club_id where f.id = find_id and m.user_id = auth.uid()));
create policy "Members add own comments" on public.daily_find_comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.daily_finds f join public.club_members m on m.club_id = f.club_id where f.id = find_id and m.user_id = auth.uid()));
create policy "Owners or admins delete comments" on public.daily_find_comments for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.daily_finds f where f.id = find_id and public.is_club_admin(auth.uid(), f.club_id)));

-- Private photo storage: path = <club_id>/<user_id>/<file>
create policy "Club members view find photos" on storage.objects for select to authenticated
  using (bucket_id = 'daily-finds' and exists (select 1 from public.club_members m where m.club_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()));
create policy "Members upload own find photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'daily-finds' and (storage.foldername(name))[2] = auth.uid()::text
    and exists (select 1 from public.club_members m where m.club_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()));
create policy "Members delete own find photos" on storage.objects for delete to authenticated
  using (bucket_id = 'daily-finds' and (storage.foldername(name))[2] = auth.uid()::text);

insert into public.platform_assets
  (name, slug, category, short_description, full_description, icon_name, placement_area, requires_configuration, is_premium, sort_order)
values
  ('Daily Find', 'daily-find', 'social',
   'One thing you learned today — shared with the club.',
   'Every day, drop one interesting thing: something you learned, an article, a photo or screenshot. Add a quick note and tags. Each find lands on that day in your personal calendar archive, and the whole club can react, comment and share finds into chat.',
   'Lightbulb', 'community', false, false, 60)
on conflict (slug) do update set name = excluded.name, short_description = excluded.short_description,
  full_description = excluded.full_description, icon_name = excluded.icon_name;

insert into public.club_installed_assets (club_id, asset_id, enabled, visible_to_members)
select c.id, a.id, true, true from public.clubs c cross join public.platform_assets a
where a.slug = 'daily-find'
  and not exists (select 1 from public.club_installed_assets i where i.club_id = c.id and i.asset_id = a.id);