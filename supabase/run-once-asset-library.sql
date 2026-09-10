-- ═══════════════════════════════════════════════════════════════════
-- DH Club — Asset Library setup (run once in Supabase SQL Editor)
-- Combines migrations: 20260509210000, 20260509220000, 20260509230000
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Tables ────────────────────────────────────────────────────────

create table if not exists public.platform_assets (
  id                        uuid        primary key default gen_random_uuid(),
  name                      text        not null,
  slug                      text        not null unique,
  category                  text        not null default 'general',
  short_description         text        not null default '',
  full_description          text        not null default '',
  icon_name                 text        not null default 'Star',
  placement_area            text        not null default 'games',
  requires_configuration    boolean     not null default false,
  default_configuration_json jsonb      not null default '{}',
  is_active                 boolean     not null default true,
  is_premium                boolean     not null default false,
  sort_order                integer     not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table if not exists public.club_installed_assets (
  id                  uuid        primary key default gen_random_uuid(),
  club_id             uuid        not null references public.clubs(id) on delete cascade,
  asset_id            uuid        not null references public.platform_assets(id) on delete cascade,
  installed_by        uuid        references auth.users(id),
  installed_at        timestamptz not null default now(),
  enabled             boolean     not null default true,
  visible_to_members  boolean     not null default true,
  configuration_json  jsonb       not null default '{}',
  sort_order          integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(club_id, asset_id)
);

-- ── 2. Triggers ──────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_platform_assets_updated_at on public.platform_assets;
create trigger trg_platform_assets_updated_at
  before update on public.platform_assets
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_club_installed_assets_updated_at on public.club_installed_assets;
create trigger trg_club_installed_assets_updated_at
  before update on public.club_installed_assets
  for each row execute procedure public.set_updated_at();

-- ── 3. RLS ───────────────────────────────────────────────────────────

alter table public.platform_assets        enable row level security;
alter table public.club_installed_assets  enable row level security;

drop policy if exists "Read active platform assets"        on public.platform_assets;
drop policy if exists "Admins manage platform assets"      on public.platform_assets;
drop policy if exists "Club members read installed assets" on public.club_installed_assets;
drop policy if exists "Club admins manage installed assets" on public.club_installed_assets;

create policy "Read active platform assets"
  on public.platform_assets for select to authenticated
  using (is_active = true);

create policy "Admins manage platform assets"
  on public.platform_assets for all to authenticated
  using (exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin','owner')
  ))
  with check (exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin','owner')
  ));

create policy "Club members read installed assets"
  on public.club_installed_assets for select to authenticated
  using (exists (
    select 1 from public.club_members
    where club_id = club_installed_assets.club_id and user_id = auth.uid()
  ));

create policy "Club admins manage installed assets"
  on public.club_installed_assets for all to authenticated
  using (
    exists (select 1 from public.club_members
            where club_id = club_installed_assets.club_id
              and user_id = auth.uid() and role = 'admin')
    or exists (select 1 from public.user_roles
               where user_id = auth.uid() and role in ('admin','owner'))
  )
  with check (
    exists (select 1 from public.club_members
            where club_id = club_installed_assets.club_id
              and user_id = auth.uid() and role = 'admin')
    or exists (select 1 from public.user_roles
               where user_id = auth.uid() and role in ('admin','owner'))
  );

-- ── 4. Seed catalog ──────────────────────────────────────────────────

insert into public.platform_assets
  (name, slug, category, short_description, full_description, icon_name, placement_area, requires_configuration, is_premium, sort_order)
values
  ('Draft Arena',    'draft-arena',    'games',
   'Run live snake drafts with your crew',
   'Create and manage live snake drafts for any sport or topic. Club members draft in order, track their picks in real time, and compete head-to-head for the best roster. Supports any number of rounds and custom pick timers.',
   'Bookmark', 'games', false, false, 10),

  ('Rune Delve',     'rune-delve',     'games',
   'Roguelike dungeon crawler for your club',
   'A turn-based dungeon exploration game where club members delve into procedurally generated dungeons, collect runes, and compete for the deepest floor cleared each week.',
   'Sparkles', 'games', false, false, 20),

  ('Nexus Defense',  'nexus-defense',  'games',
   'Cooperative tower defense strategy game',
   'Defend the club nexus against endless waves of enemies. Members place towers, coordinate strategy, and earn defense points that roll into the weekly club standings.',
   'Shield', 'games', false, false, 30),

  ('NFL Game Center', 'nfl-pickem',    'games',
   'NFL scores, weekly Pick''em, and Crazy Chain',
   'Your club''s NFL headquarters: follow the weekly slate, make Pick''em selections, build all-or-nothing Crazy Chains, and chase season records.',
   'Trophy', 'games', false, false, 40),

  ('Brackets',       'brackets',       'games',
   'Create and run tournament brackets',
   'Build single or double-elimination brackets for any competition your club is running — video games, trivia, hot-takes, anything. Invite members to enter, advance rounds, and crown a champion.',
   'Brackets', 'games', false, false, 50),

  ('Portfolio Wars', 'portfolio-wars', 'games',
   'Stock picking competition',
   'Members pick five stocks at the start of each weekly challenge. Returns are tracked in real time via live price snapshots. The member with the best-performing virtual portfolio wins the week.',
   'TrendingUp', 'games', true, false, 60),

  ('Lockbox',        'lockbox',        'games',
   'Daily lock — your most confident prediction',
   'Once a day, members submit their single most confident prediction: a sports pick, a hot take, anything with a clear yes/no outcome. Accuracy is tracked over time on a personal record and a club leaderboard.',
   'Lock', 'games', false, false, 70),

  ('Chat',           'chat',           'social',
   'Real-time channel-based messaging',
   'Channel-based messaging for your entire club. Create topic channels, reply in threads, react to messages, share images, and keep the conversation organized. Includes unread badges and typing indicators.',
   'MessageSquareText', 'social', false, false, 80),

  ('Events',         'events',         'events',
   'Club event calendar with RSVPs',
   'Create events your club can RSVP to — game nights, watch parties, IRL meetups, and more. Members can mark attending, maybe, or skip. Supports recurring events and calendar export.',
   'CalendarDays', 'navigation', false, false, 90),

  ('Lore',           'lore',           'social',
   'Club history, rivalries, and legend',
   'A living document of your club''s greatest moments, internal rivalries, running jokes, and history. Admins write entries; members read and relive the lore.',
   'ScrollText', 'navigation', false, false, 100),

  ('Feed',           'feed',           'social',
   'Scrollable club activity stream',
   'A real-time feed of club activity — picks made, games won, posts published, and events coming up. The easiest way for members to stay up to date without diving into every section.',
   'Newspaper', 'navigation', false, false, 110),

  ('Polls',          'polls',          'social',
   'Quick club polls on anything',
   'Create quick polls for your club to vote on — game decisions, match predictions, hangout plans, or just settling debates. Results are visible after voting.',
   'MessageCircle', 'community', false, false, 120),

  ('Rankings',       'rankings',       'social',
   'Cross-game member leaderboards',
   'A unified leaderboard that aggregates member performance across all installed games and activities. Automatically updates as scores come in. Sortable by game and time range.',
   'BarChart3', 'community', false, false, 130),

  ('Posts',          'posts',          'social',
   'Long-form club posts and articles',
   'Members can publish longer posts, match recaps, analysis, and announcements to the club. Supports rich text, images, and reactions. Think of it as your club''s internal blog.',
   'FileText', 'community', false, false, 140),

  ('Shared Media',   'shared-media',   'social',
   'Curated club links and media',
   'A shared bookmark wall for videos, articles, clips, and links that members want to surface to the whole club. Items can be reacted to and sorted by recency or popularity.',
   'Link2', 'community', false, false, 150)

on conflict (slug) do update set
  name                   = excluded.name,
  short_description      = excluded.short_description,
  full_description       = excluded.full_description,
  icon_name              = excluded.icon_name,
  is_active              = excluded.is_active,
  sort_order             = excluded.sort_order;

-- ── 5. Pre-install ALL assets for Dry Horse only ─────────────────────

insert into public.club_installed_assets (club_id, asset_id, enabled, visible_to_members)
select c.id, a.id, true, true
from   public.clubs c
cross join public.platform_assets a
where  lower(c.name) = 'dry horse'
  and  a.is_active = true
on conflict (club_id, asset_id) do nothing;

-- ── 6. Make sure no other clubs have pre-installed assets ─────────────

delete from public.club_installed_assets
where club_id in (
  select id from public.clubs where lower(name) != 'dry horse'
);
