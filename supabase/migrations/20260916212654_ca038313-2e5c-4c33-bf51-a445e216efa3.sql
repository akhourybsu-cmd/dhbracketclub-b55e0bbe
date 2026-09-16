CREATE OR REPLACE FUNCTION public.pw_ensure_season(_club_id uuid, _user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  et date := (timezone('America/New_York', now()))::date;
  y int := extract(year FROM et);
  q int := ceil(extract(month FROM et) / 3.0);
  sid uuid;
  cash numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members cm
     WHERE cm.club_id = _club_id AND cm.user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this club';
  END IF;

  SELECT s.id INTO sid FROM public.pw_seasons s
   WHERE s.club_id = _club_id AND s.year = y AND s.quarter = q;

  IF sid IS NULL THEN
    SELECT coalesce(ls.starting_cash, 50000) INTO cash
      FROM public.pw_league_settings ls WHERE ls.club_id = _club_id;
    cash := coalesce(cash, 50000);
    INSERT INTO public.pw_seasons (club_id, year, quarter, starts_on, ends_on, status, starting_cash)
    VALUES (
      _club_id, y, q,
      make_date(y, ((q - 1) * 3 + 1)::int, 1),
      (make_date(y, ((q - 1) * 3 + 1)::int, 1) + interval '3 months' - interval '1 day')::date,
      'active', cash
    )
    ON CONFLICT (club_id, year, quarter) DO UPDATE SET status = 'active'
    RETURNING id INTO sid;
  ELSE
    UPDATE public.pw_seasons SET status = 'active'
     WHERE id = sid AND status = 'upcoming';
  END IF;

  UPDATE public.pw_seasons SET status = 'completed'
   WHERE club_id = _club_id AND id <> sid AND status = 'active';

  RETURN sid;
END;
$function$;

REVOKE ALL ON FUNCTION public.pw_ensure_season(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pw_ensure_season(uuid, uuid) TO service_role;