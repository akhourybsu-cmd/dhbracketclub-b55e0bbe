alter table public.nfl_games add column if not exists pickem_unlock_until timestamptz;

create or replace function public.is_pick_unlocked(_game_id uuid)
returns boolean language sql stable security definer set search_path = public,pg_temp as $$
  select public.nfl_chain_game_unlocked(_game_id)
    or coalesce((select status = 'scheduled' and pickem_unlock_until is not null and now() < pickem_unlock_until
      from public.nfl_games where id = _game_id), false)
$$;
revoke all on function public.is_pick_unlocked(uuid) from public,anon;
grant execute on function public.is_pick_unlocked(uuid) to authenticated,service_role;

notify pgrst,'reload schema';