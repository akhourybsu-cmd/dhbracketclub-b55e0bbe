-- Nexus Defense v2. Separate progression and scores from the retired path game.
create table if not exists public.nexus_core_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  research jsonb not null default '{}',
  campaign jsonb not null default '{}',
  challenges jsonb not null default '{}',
  best_wave integer not null default 0,
  total_runs integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.nexus_core_runs (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  scenario_id text not null,
  mode text not null check (mode in ('campaign', 'endless', 'challenge')),
  victory boolean not null,
  waves integer not null check (waves >= 0),
  score integer not null check (score >= 0),
  kills integer not null check (kills >= 0),
  duration_seconds integer not null check (duration_seconds >= 0),
  stars integer not null check (stars between 0 and 3),
  reward integer not null,
  created_at timestamptz not null default now()
);
create index if not exists nexus_core_runs_club_mode on public.nexus_core_runs(club_id, mode, score desc);
alter table public.nexus_core_profiles enable row level security;
alter table public.nexus_core_runs enable row level security;
drop policy if exists "Read own core progress" on public.nexus_core_profiles;
create policy "Read own core progress" on public.nexus_core_profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists "Read club core scores" on public.nexus_core_runs;
create policy "Read club core scores" on public.nexus_core_runs for select to authenticated using (
  exists (select 1 from public.club_members m where m.club_id = nexus_core_runs.club_id and m.user_id = auth.uid())
);
-- All writes go through authenticated RPCs. Research purchases are serialized by
-- a row lock. Run UUIDs make reward claims safe to retry after a network failure.
revoke all on public.nexus_core_profiles, public.nexus_core_runs from anon, authenticated;
grant select on public.nexus_core_profiles, public.nexus_core_runs to authenticated;

drop function if exists public.nexus_core_profile();
create function public.nexus_core_profile()
returns jsonb language plpgsql security definer set search_path = public as $$
declare result public.nexus_core_profiles;
begin
  if auth.uid() is null then raise exception 'Sign in to access your core'; end if;
  insert into public.nexus_core_profiles(user_id) values (auth.uid()) on conflict do nothing;
  select * into result from public.nexus_core_profiles where user_id = auth.uid();
  return to_jsonb(result);
end;
$$;

drop function if exists public.nexus_core_research(text);
create function public.nexus_core_research(p_track text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result public.nexus_core_profiles; lv integer; base_cost integer; price integer;
begin
  if auth.uid() is null then raise exception 'Sign in to upgrade your core'; end if;
  base_cost := case p_track when 'weapons' then 35 when 'reactor' then 40 when 'plating' then 30 when 'barrier' then 30 when 'salvage' then 35 when 'nova' then 40 else null end;
  if base_cost is null then raise exception 'Unknown research'; end if;
  select * into result from public.nexus_core_profiles where user_id = auth.uid() for update;
  if not found then raise exception 'Initialize your core first'; end if;
  lv := coalesce((result.research->>p_track)::integer, 0);
  if lv >= 10 then raise exception 'Research complete'; end if;
  price := round(base_cost * power(1.5::numeric, lv));
  if result.credits < price then raise exception 'Not enough credits'; end if;
  update public.nexus_core_profiles set credits = credits - price,
    research = jsonb_set(research, array[p_track], to_jsonb(lv + 1)), updated_at = now()
    where user_id = auth.uid() returning * into result;
  return to_jsonb(result);
end;
$$;

create or replace function public.nexus_core_finish(p_run jsonb, p_club_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); result public.nexus_core_profiles; saved public.nexus_core_runs;
  run_id uuid := (p_run->>'id')::uuid; scenario text := p_run->>'scenarioId';
  game_mode text; goal integer; bonus integer; cleared integer; won boolean; star_count integer; payout integer;
begin
  if uid is null or not exists(select 1 from public.club_members where user_id = uid and club_id = p_club_id) then
    raise exception 'Club membership required';
  end if;
  insert into public.nexus_core_profiles(user_id) values (uid) on conflict do nothing;
  select * into result from public.nexus_core_profiles where user_id = uid for update;
  select * into saved from public.nexus_core_runs where id = run_id;
  if found then
    if saved.user_id <> uid then raise exception 'Invalid run'; end if;
    return jsonb_build_object('profile', to_jsonb(result), 'reward', saved.reward, 'stars', saved.stars);
  end if;
  if scenario ~ '^[1-8]$' then
    game_mode := 'campaign'; goal := (array[5,6,7,8,9,10,11,12])[scenario::integer];
    bonus := (array[70,85,100,120,140,160,180,220])[scenario::integer];
    if scenario::integer > 1 and not (result.campaign ? (scenario::integer - 1)::text) then raise exception 'Clear the previous sector first'; end if;
  elsif scenario = 'endless' then game_mode := 'endless'; goal := null; bonus := 0;
  elsif scenario in ('rush','glass','siege','blackout') then
    game_mode := 'challenge'; goal := case scenario when 'glass' then 6 when 'siege' then 9 else 8 end;
    bonus := case scenario when 'rush' then 120 when 'blackout' then 130 else 150 end;
  else raise exception 'Unknown scenario'; end if;
  if p_run->>'phase' is null or p_run->>'phase' not in ('victory','defeat') then raise exception 'Run is not complete'; end if;
  cleared := (p_run->>'cleared')::integer;
  if cleared is null or cleared < 0 or cleared > 100000 or (goal is not null and cleared > goal) then raise exception 'Invalid wave count'; end if;
  won := p_run->>'phase' = 'victory' and goal is not null and cleared = goal;
  if p_run->>'phase' = 'victory' and not won then raise exception 'Invalid victory'; end if;
  if (p_run->>'hpRatio') is null or (p_run->>'hpRatio')::numeric not between 0 and 1 then raise exception 'Invalid hull ratio'; end if;
  star_count := case when not won then 0 when (p_run->>'hpRatio')::numeric >= 0.8 then 3 when (p_run->>'hpRatio')::numeric >= 0.4 then 2 else 1 end;
  payout := 5 + least(500, cleared * 6) + case when won then bonus else 0 end;
  insert into public.nexus_core_runs(id,user_id,club_id,scenario_id,mode,victory,waves,score,kills,duration_seconds,stars,reward)
    values (run_id,uid,p_club_id,scenario,game_mode,won,cleared,
      greatest(0,least(100000000,(p_run->>'score')::integer)), greatest(0,least(10000000,(p_run->>'kills')::integer)),
      greatest(0,least(10000000,(p_run->>'time')::integer)),star_count,payout);
  update public.nexus_core_profiles set credits = credits + payout, total_runs = total_runs + 1,
    campaign = case when won and game_mode = 'campaign' then jsonb_set(campaign, array[scenario], to_jsonb(greatest(coalesce((campaign->>scenario)::integer,0),star_count))) else campaign end,
    challenges = case when won and game_mode = 'challenge' then jsonb_set(challenges, array[scenario], to_jsonb(greatest(coalesce((challenges->>scenario)::integer,0),star_count))) else challenges end,
    best_wave = case when game_mode = 'endless' then greatest(best_wave,cleared) else best_wave end,
    updated_at = now() where user_id = uid returning * into result;
  return jsonb_build_object('profile',to_jsonb(result),'reward',payout,'stars',star_count);
end;
$$;
revoke all on function public.nexus_core_profile() from public, anon;
revoke all on function public.nexus_core_research(text) from public, anon;
revoke all on function public.nexus_core_finish(jsonb, uuid) from public, anon;
grant execute on function public.nexus_core_profile() to authenticated;
grant execute on function public.nexus_core_research(text) to authenticated;
grant execute on function public.nexus_core_finish(jsonb, uuid) to authenticated;

-- Pick each member's best run before limiting the leaderboard. A prolific
-- player's repeated runs cannot crowd other members out of the standings.
create or replace function public.nexus_core_records(p_club_id uuid, p_mode text)
returns table(user_id uuid, score integer, waves integer, scenario_id text, display_name text)
language sql stable security invoker set search_path = public as $$
  select best.user_id,best.score,best.waves,best.scenario_id,p.display_name
  from (
    select distinct on (r.user_id) r.* from public.nexus_core_runs r
    where r.club_id = p_club_id and r.mode = p_mode
    order by r.user_id, case when p_mode = 'endless' then r.waves else 0 end desc, r.score desc, r.created_at asc
  ) best join public.profiles p on p.id = best.user_id
  order by case when p_mode = 'endless' then best.waves else 0 end desc,best.score desc,best.user_id
  limit 50;
$$;
revoke all on function public.nexus_core_records(uuid,text) from public,anon;
grant execute on function public.nexus_core_records(uuid,text) to authenticated;

update public.platform_assets set short_description = 'Fortify a central core against enemies from every direction.', full_description = 'A 360-degree survival game. Upgrade your nexus during battle, secure eight campaign sectors, face four challenge rulesets, and push into endless waves. Earn permanent research upgrades and compete on club records.' where slug = 'nexus-defense';

notify pgrst, 'reload schema';
