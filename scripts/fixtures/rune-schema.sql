-- Production Rune schema contract captured 2026-10-30. No player data.
-- Keep defaults, nullability, checks, unique keys and club foreign keys in
-- isolated settlement tests so a permissive mock cannot hide deployment bugs.

create table public.rune_delve_heroes (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  hero_name text default 'Adventurer'::text not null,
  class text default 'warrior'::text not null,
  level integer default 1 not null,
  xp integer default 0 not null,
  current_streak integer default 0 not null,
  best_streak integer default 0 not null,
  lifetime_runs integer default 0 not null,
  lifetime_score bigint default 0 not null,
  cosmetic_title text,
  last_run_date date,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  club_id uuid default '11111111-1111-1111-1111-111111111111'::uuid not null
);

create table public.rune_delve_class_progress (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  class text not null,
  xp integer default 0 not null,
  level integer default 1 not null,
  cosmetic_title text,
  lifetime_runs integer default 0 not null,
  lifetime_score bigint default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  club_id uuid default '11111111-1111-1111-1111-111111111111'::uuid not null,
  highest_unlocked_level integer default 1 not null,
  highest_completed_level integer default 0 not null,
  total_levels_cleared integer default 0 not null,
  current_chapter integer default 1 not null
);

create table public.rune_delve_progress (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  highest_unlocked_level integer default 1 not null,
  highest_completed_level integer default 0 not null,
  total_levels_cleared integer default 0 not null,
  current_chapter integer default 1 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  club_id uuid default '11111111-1111-1111-1111-111111111111'::uuid not null
);

create table public.rune_delve_levels (
  id uuid default gen_random_uuid() not null,
  level_number integer not null,
  chapter integer default 1 not null,
  difficulty_tier integer default 1 not null,
  generation_seed bigint not null,
  board_size integer default 5 not null,
  starting_board_layout jsonb,
  enemy_config jsonb default '[]'::jsonb not null,
  turn_limit integer default 10 not null,
  objective_type text default 'defeat_all'::text not null,
  objective_target integer default 0 not null,
  modifiers jsonb default '{}'::jsonb not null,
  status text default 'active'::text not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.rune_delve_runs (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  dungeon_id uuid,
  run_date date,
  score integer default 0 not null,
  enemies_defeated integer default 0 not null,
  dungeon_cleared boolean default false not null,
  turns_used integer default 0 not null,
  total_damage integer default 0 not null,
  longest_chain integer default 0 not null,
  hp_remaining integer default 0 not null,
  xp_earned integer default 0 not null,
  ability_used boolean default false not null,
  hero_class text not null,
  pick_log jsonb default '[]'::jsonb not null,
  completed_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  level_id uuid,
  level_number integer,
  attempts integer default 1 not null,
  clears integer default 0 not null,
  best_turns_used integer,
  best_hp_remaining integer default 0 not null,
  last_played_at timestamp with time zone default now() not null,
  club_id uuid default '11111111-1111-1111-1111-111111111111'::uuid not null
);

create table public.rune_delve_wallet (
  user_id uuid not null,
  shards integer default 0 not null,
  lifetime_shards_earned integer default 0 not null,
  slots_unlocked integer default 2 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  club_id uuid default '11111111-1111-1111-1111-111111111111'::uuid not null
);

create table public.rune_delve_relic_unlocks (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  relic_id text not null,
  acquired_at timestamp with time zone default now() not null,
  acquired_at_level integer default 1 not null,
  rank smallint default 1 not null,
  club_id uuid default '11111111-1111-1111-1111-111111111111'::uuid not null
);

create table public.rune_delve_loadouts (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  class text not null,
  slot_1 text,
  slot_2 text,
  slot_3 text,
  updated_at timestamp with time zone default now() not null,
  club_id uuid default '11111111-1111-1111-1111-111111111111'::uuid not null
);

create table public.rune_delve_failure_rewards (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  level_number integer not null,
  failure_count integer default 0 not null,
  last_awarded_at timestamp with time zone default now() not null,
  club_id uuid default '11111111-1111-1111-1111-111111111111'::uuid not null,
  hero_class text not null
);

create table public.rune_delve_daily_runs (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  daily_date date not null,
  score integer default 0 not null,
  stars integer default 0 not null,
  dungeon_cleared boolean default false not null,
  modifiers jsonb default '[]'::jsonb not null,
  hero_class text not null,
  completed_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  club_id uuid default '11111111-1111-1111-1111-111111111111'::uuid not null,
  kills_count integer default 0 not null
);

create table public.rune_delve_daily_streaks (
  user_id uuid not null,
  current_streak integer default 0 not null,
  best_streak integer default 0 not null,
  last_completed_date date,
  lifetime_clears integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  club_id uuid default '11111111-1111-1111-1111-111111111111'::uuid not null
);

create table public.rune_delve_quest_definitions (
  id text not null,
  scope rd_quest_scope not null,
  title text not null,
  description text not null,
  objective_type text not null,
  target_value integer default 1 not null,
  shard_reward integer default 50 not null,
  xp_reward integer default 0 not null,
  is_personal boolean default false not null,
  hero_class text,
  weight integer default 10 not null,
  created_at timestamp with time zone default now() not null
);

create table public.rune_delve_active_quests (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  quest_id text not null,
  scope rd_quest_scope not null,
  period_key text not null,
  progress integer default 0 not null,
  target_value integer not null,
  status rd_quest_status default 'active'::rd_quest_status not null,
  claimed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  club_id uuid default '11111111-1111-1111-1111-111111111111'::uuid not null
);

create table public.rune_delve_dungeons (
  id uuid default gen_random_uuid() not null,
  run_date date not null,
  seed bigint not null,
  enemy_config jsonb default '[]'::jsonb not null,
  max_turns integer default 10 not null,
  created_at timestamp with time zone default now() not null
);
alter table public.rune_delve_daily_runs add constraint rune_delve_daily_runs_pkey PRIMARY KEY (id);
alter table public.rune_delve_daily_runs add constraint rune_delve_daily_runs_user_id_daily_date_key UNIQUE (user_id, daily_date);
alter table public.rune_delve_daily_streaks add constraint rune_delve_daily_streaks_pkey PRIMARY KEY (user_id);
alter table public.rune_delve_relic_unlocks add constraint rune_delve_relic_unlocks_pkey PRIMARY KEY (id);
alter table public.rune_delve_relic_unlocks add constraint rune_delve_relic_unlocks_rank_check CHECK (((rank >= 1) AND (rank <= 5)));
alter table public.rune_delve_relic_unlocks add constraint rune_delve_relic_unlocks_user_id_relic_id_key UNIQUE (user_id, relic_id);
alter table public.rune_delve_progress add constraint rune_delve_progress_pkey PRIMARY KEY (id);
alter table public.rune_delve_progress add constraint rune_delve_progress_user_id_key UNIQUE (user_id);
alter table public.rune_delve_levels add constraint rune_delve_levels_level_number_key UNIQUE (level_number);
alter table public.rune_delve_levels add constraint rune_delve_levels_pkey PRIMARY KEY (id);
alter table public.rune_delve_dungeons add constraint rune_delve_dungeons_pkey PRIMARY KEY (id);
alter table public.rune_delve_dungeons add constraint rune_delve_dungeons_run_date_key UNIQUE (run_date);
alter table public.rune_delve_wallet add constraint rune_delve_wallet_pkey PRIMARY KEY (user_id);
alter table public.rune_delve_active_quests add constraint rune_delve_active_quests_pkey PRIMARY KEY (id);
alter table public.rune_delve_active_quests add constraint rune_delve_active_quests_user_id_quest_id_period_key_key UNIQUE (user_id, quest_id, period_key);
alter table public.rune_delve_quest_definitions add constraint rune_delve_quest_definitions_pkey PRIMARY KEY (id);
alter table public.rune_delve_runs add constraint rune_delve_runs_pkey PRIMARY KEY (id);
alter table public.rune_delve_heroes add constraint rune_delve_heroes_class_check CHECK ((class = ANY (ARRAY['warrior'::text, 'mage'::text, 'rogue'::text, 'cleric'::text])));
alter table public.rune_delve_heroes add constraint rune_delve_heroes_pkey PRIMARY KEY (id);
alter table public.rune_delve_heroes add constraint rune_delve_heroes_user_id_key UNIQUE (user_id);
alter table public.rune_delve_loadouts add constraint rune_delve_loadouts_class_check CHECK ((class = ANY (ARRAY['warrior'::text, 'mage'::text, 'rogue'::text, 'cleric'::text])));
alter table public.rune_delve_loadouts add constraint rune_delve_loadouts_pkey PRIMARY KEY (id);
alter table public.rune_delve_loadouts add constraint rune_delve_loadouts_user_id_class_key UNIQUE (user_id, class);
alter table public.rune_delve_failure_rewards add constraint rune_delve_failure_rewards_hero_class_check CHECK ((hero_class = ANY (ARRAY['warrior'::text, 'mage'::text, 'rogue'::text, 'cleric'::text])));
alter table public.rune_delve_failure_rewards add constraint rune_delve_failure_rewards_pkey PRIMARY KEY (id);
alter table public.rune_delve_class_progress add constraint rune_delve_class_progress_class_check CHECK ((class = ANY (ARRAY['warrior'::text, 'mage'::text, 'rogue'::text, 'cleric'::text])));
alter table public.rune_delve_class_progress add constraint rune_delve_class_progress_pkey PRIMARY KEY (id);
alter table public.rune_delve_class_progress add constraint rune_delve_class_progress_user_id_class_key UNIQUE (user_id, class);

alter table public.rune_delve_daily_runs add constraint rune_delve_daily_runs_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.rune_delve_daily_streaks add constraint rune_delve_daily_streaks_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.rune_delve_relic_unlocks add constraint rune_delve_relic_unlocks_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.rune_delve_progress add constraint rune_delve_progress_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.rune_delve_wallet add constraint rune_delve_wallet_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.rune_delve_active_quests add constraint rune_delve_active_quests_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.rune_delve_active_quests add constraint rune_delve_active_quests_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES rune_delve_quest_definitions(id) ON DELETE CASCADE;
alter table public.rune_delve_runs add constraint rune_delve_runs_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.rune_delve_runs add constraint rune_delve_runs_dungeon_id_fkey FOREIGN KEY (dungeon_id) REFERENCES rune_delve_dungeons(id) ON DELETE CASCADE;
alter table public.rune_delve_runs add constraint rune_delve_runs_level_id_fkey FOREIGN KEY (level_id) REFERENCES rune_delve_levels(id) ON DELETE CASCADE;
alter table public.rune_delve_heroes add constraint rune_delve_heroes_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.rune_delve_loadouts add constraint rune_delve_loadouts_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.rune_delve_failure_rewards add constraint rune_delve_failure_rewards_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.rune_delve_class_progress add constraint rune_delve_class_progress_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

create unique index rune_delve_runs_user_level_class_uniq on rune_delve_runs(user_id,level_id,hero_class) where level_id is not null;
create unique index rune_delve_failure_rewards_user_level_class_uniq on rune_delve_failure_rewards(user_id,level_number,hero_class);

alter table public.rune_delve_heroes enable row level security;

alter table public.rune_delve_class_progress enable row level security;

alter table public.rune_delve_progress enable row level security;

alter table public.rune_delve_levels enable row level security;

alter table public.rune_delve_runs enable row level security;

alter table public.rune_delve_wallet enable row level security;

alter table public.rune_delve_relic_unlocks enable row level security;

alter table public.rune_delve_loadouts enable row level security;

alter table public.rune_delve_failure_rewards enable row level security;

alter table public.rune_delve_daily_runs enable row level security;

alter table public.rune_delve_daily_streaks enable row level security;

alter table public.rune_delve_quest_definitions enable row level security;

alter table public.rune_delve_active_quests enable row level security;

alter table public.rune_delve_dungeons enable row level security;
create policy "RDDailyRuns: club read" on public.rune_delve_daily_runs for SELECT to public using (((club_id = current_user_club_id()) OR is_platform_owner(auth.uid())));
create policy "Users can insert their own daily runs" on public.rune_delve_daily_runs for INSERT to authenticated with check ((auth.uid() = user_id));
create policy "Users can update their own daily runs" on public.rune_delve_daily_runs for UPDATE to authenticated using ((auth.uid() = user_id));
create policy "dh_private_visibility" on public.rune_delve_daily_runs as restrictive for ALL to anon, authenticated using ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id))) with check ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id)));
create policy "Users can insert their own streak" on public.rune_delve_daily_streaks for INSERT to authenticated with check ((auth.uid() = user_id));
create policy "Users can update their own streak" on public.rune_delve_daily_streaks for UPDATE to authenticated using ((auth.uid() = user_id));
create policy "Users can view their own streak" on public.rune_delve_daily_streaks for SELECT to authenticated using ((auth.uid() = user_id));
create policy "dh_private_visibility" on public.rune_delve_daily_streaks as restrictive for ALL to anon, authenticated using ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id))) with check ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id)));
create policy "Users insert own relics" on public.rune_delve_relic_unlocks for INSERT to public with check ((auth.uid() = user_id));
create policy "Users update own relics" on public.rune_delve_relic_unlocks for UPDATE to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users view own relics" on public.rune_delve_relic_unlocks for SELECT to public using ((auth.uid() = user_id));
create policy "dh_private_visibility" on public.rune_delve_relic_unlocks as restrictive for ALL to anon, authenticated using ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id))) with check ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id)));
create policy "RDProgress: club read" on public.rune_delve_progress for SELECT to public using (((club_id = current_user_club_id()) OR is_platform_owner(auth.uid())));
create policy "Users can insert own progress" on public.rune_delve_progress for INSERT to authenticated with check ((auth.uid() = user_id));
create policy "Users can update own progress" on public.rune_delve_progress for UPDATE to authenticated using ((auth.uid() = user_id));
create policy "dh_private_visibility" on public.rune_delve_progress as restrictive for ALL to anon, authenticated using ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id))) with check ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id)));
create policy "Admins can delete levels" on public.rune_delve_levels for DELETE to authenticated using (is_app_admin(auth.uid()));
create policy "Admins can update levels" on public.rune_delve_levels for UPDATE to authenticated using (is_app_admin(auth.uid()));
create policy "Levels viewable by authenticated" on public.rune_delve_levels for SELECT to authenticated using (true);
create policy "rune_delve_levels admin insert" on public.rune_delve_levels for INSERT to authenticated with check ((is_app_admin(auth.uid()) OR is_platform_owner(auth.uid())));
create policy "Dungeons viewable by authenticated" on public.rune_delve_dungeons for SELECT to authenticated using (true);
create policy "rune_delve_dungeons admin insert" on public.rune_delve_dungeons for INSERT to authenticated with check ((is_app_admin(auth.uid()) OR is_platform_owner(auth.uid())));
create policy "Users insert own wallet" on public.rune_delve_wallet for INSERT to public with check ((auth.uid() = user_id));
create policy "Users update own wallet" on public.rune_delve_wallet for UPDATE to public using ((auth.uid() = user_id));
create policy "Users view own wallet" on public.rune_delve_wallet for SELECT to public using ((auth.uid() = user_id));
create policy "dh_private_visibility" on public.rune_delve_wallet as restrictive for ALL to anon, authenticated using ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id))) with check ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id)));
create policy "Users insert own active quests" on public.rune_delve_active_quests for INSERT to authenticated with check ((auth.uid() = user_id));
create policy "Users update own active quests" on public.rune_delve_active_quests for UPDATE to authenticated using ((auth.uid() = user_id));
create policy "Users view own active quests" on public.rune_delve_active_quests for SELECT to authenticated using ((auth.uid() = user_id));
create policy "dh_private_visibility" on public.rune_delve_active_quests as restrictive for ALL to anon, authenticated using ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id))) with check ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id)));
create policy "Quest definitions readable by authenticated" on public.rune_delve_quest_definitions for SELECT to authenticated using (true);
create policy "RDRuns: club read" on public.rune_delve_runs for SELECT to public using (((club_id = current_user_club_id()) OR is_platform_owner(auth.uid())));
create policy "Users can insert own runs" on public.rune_delve_runs for INSERT to authenticated with check ((auth.uid() = user_id));
create policy "Users can update own runs" on public.rune_delve_runs for UPDATE to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "dh_private_visibility" on public.rune_delve_runs as restrictive for ALL to anon, authenticated using ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id))) with check ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id)));
create policy "RDHeroes: club read" on public.rune_delve_heroes for SELECT to public using (((club_id = current_user_club_id()) OR is_platform_owner(auth.uid())));
create policy "Users can create own hero" on public.rune_delve_heroes for INSERT to authenticated with check ((auth.uid() = user_id));
create policy "Users can update own hero" on public.rune_delve_heroes for UPDATE to authenticated using ((auth.uid() = user_id));
create policy "dh_private_visibility" on public.rune_delve_heroes as restrictive for ALL to anon, authenticated using ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id))) with check ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id)));
create policy "Users insert own loadouts" on public.rune_delve_loadouts for INSERT to public with check ((auth.uid() = user_id));
create policy "Users update own loadouts" on public.rune_delve_loadouts for UPDATE to public using ((auth.uid() = user_id));
create policy "Users view own loadouts" on public.rune_delve_loadouts for SELECT to public using ((auth.uid() = user_id));
create policy "dh_private_visibility" on public.rune_delve_loadouts as restrictive for ALL to anon, authenticated using ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id))) with check ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id)));
create policy "Users insert own failure rewards" on public.rune_delve_failure_rewards for INSERT to public with check ((auth.uid() = user_id));
create policy "Users update own failure rewards" on public.rune_delve_failure_rewards for UPDATE to public using ((auth.uid() = user_id));
create policy "Users view own failure rewards" on public.rune_delve_failure_rewards for SELECT to public using ((auth.uid() = user_id));
create policy "dh_private_visibility" on public.rune_delve_failure_rewards as restrictive for ALL to anon, authenticated using ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id))) with check ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id)));
create policy "RDClassProgress: club read" on public.rune_delve_class_progress for SELECT to public using (((club_id = current_user_club_id()) OR is_platform_owner(auth.uid())));
create policy "Users can insert own class progress" on public.rune_delve_class_progress for INSERT to authenticated with check ((auth.uid() = user_id));
create policy "Users can update own class progress" on public.rune_delve_class_progress for UPDATE to authenticated using ((auth.uid() = user_id));
create policy "dh_private_visibility" on public.rune_delve_class_progress as restrictive for ALL to anon, authenticated using ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id))) with check ((true AND dh_visible_member(user_id) AND dh_visible_club(club_id)));
