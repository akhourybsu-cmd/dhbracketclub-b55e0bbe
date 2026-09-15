CREATE OR REPLACE FUNCTION public.pw_join_season(_season_id uuid, _user_id uuid DEFAULT auth.uid())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.pw_seasons;
  pid uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'User required'; END IF;
  SELECT * INTO s FROM public.pw_seasons WHERE id = _season_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.club_members WHERE club_id = s.club_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a member of this club';
  END IF;

  SELECT id INTO pid FROM public.pw_portfolios
   WHERE season_id = _season_id AND user_id = _user_id;
  IF pid IS NULL THEN
    INSERT INTO public.pw_portfolios (season_id, club_id, user_id, cash, total_value, holdings_value)
    VALUES (_season_id, s.club_id, _user_id, s.starting_cash, s.starting_cash, 0)
    RETURNING id INTO pid;
  END IF;
  RETURN pid;
END;
$function$;

REVOKE ALL ON FUNCTION public.pw_join_season(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pw_join_season(uuid, uuid) TO service_role;
DROP FUNCTION IF EXISTS public.pw_join_season(uuid);