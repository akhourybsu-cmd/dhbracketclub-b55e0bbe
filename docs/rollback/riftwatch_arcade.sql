-- Manual rollback of 20261128180000_arcade_scores.sql. Archive ranked records first.
-- Refuse removal once another game uses the platform.
begin;
do $$ begin
  if exists(select 1 from public.arcade_rulesets where game_key<>'riftwatch') then
    raise exception 'Other cartridges use this platform. Roll back only the Riftwatch registration.';
  end if;
end $$;
drop policy arcade_runs_own on public.arcade_run_sessions;
drop policy arcade_scores_in_club on public.arcade_scores;
drop function public.arcade_finish_run(uuid,uuid,uuid,text,jsonb,text);
drop function public.arcade_claim_run(uuid,uuid,uuid,text,text,text,integer);
drop function public.arcade_run_status(uuid);
drop function public.arcade_start_run(uuid,text,text,text,uuid);
drop function public.arcade_envelope(public.arcade_run_sessions);
drop function public.arcade_leaderboard(uuid,text,text,text);
drop function public.arcade_board_data(uuid,uuid,text,text,text);
drop function public.arcade_period_start(text,timestamptz);
drop function public.arcade_row_visible(uuid,text,text,uuid);
drop function public.arcade_lock_access(uuid,uuid,text,text);
drop function public.arcade_member_eligible(uuid,uuid,text,text);
drop table public.arcade_scores,public.arcade_run_sessions;
drop table public.arcade_rulesets;
-- Keep the established asset catalog and club install rows for every other title.
delete from public.platform_assets where slug='riftwatch';
commit;
