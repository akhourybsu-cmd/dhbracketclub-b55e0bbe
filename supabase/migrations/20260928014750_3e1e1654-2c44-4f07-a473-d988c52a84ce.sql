CREATE OR REPLACE FUNCTION public.normalize_pick_text(t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT btrim(regexp_replace(regexp_replace(lower(coalesce(t,'')), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.guard_draft_pick_duplicates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('draft_pick:' || NEW.draft_id::text));
  IF EXISTS (
    SELECT 1 FROM public.draft_picks p
    WHERE p.draft_id = NEW.draft_id AND p.id <> NEW.id
      AND public.normalize_pick_text(p.pick_text) = public.normalize_pick_text(NEW.pick_text)
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_PICK: This has already been picked' USING ERRCODE = '23505';
  END IF;
  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1 FROM public.draft_picks p
    WHERE p.draft_id = NEW.draft_id AND p.pick_number = NEW.pick_number
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_SLOT: That pick slot was just filled' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_draft_pick_duplicates ON public.draft_picks;
CREATE TRIGGER guard_draft_pick_duplicates
BEFORE INSERT OR UPDATE OF pick_text ON public.draft_picks
FOR EACH ROW EXECUTE FUNCTION public.guard_draft_pick_duplicates();