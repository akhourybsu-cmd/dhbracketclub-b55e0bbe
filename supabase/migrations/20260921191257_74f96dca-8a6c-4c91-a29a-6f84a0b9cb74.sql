ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS is_live boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pick_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS clock_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS clock_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS kiosk_code text;

CREATE UNIQUE INDEX IF NOT EXISTS drafts_kiosk_code_key ON public.drafts (kiosk_code) WHERE kiosk_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.draft_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  pick_number integer NOT NULL,
  round integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, pick_number)
);

GRANT SELECT, INSERT, DELETE ON public.draft_skips TO authenticated;
GRANT ALL ON public.draft_skips TO service_role;

ALTER TABLE public.draft_skips ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_set_club_id ON public.draft_skips;
CREATE TRIGGER trg_set_club_id BEFORE INSERT ON public.draft_skips
  FOR EACH ROW EXECUTE FUNCTION public.set_club_id_from_user();

DROP POLICY IF EXISTS "Draft skips: club members read" ON public.draft_skips;
CREATE POLICY "Draft skips: club members read" ON public.draft_skips
  FOR SELECT TO authenticated
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

DROP POLICY IF EXISTS "Draft skips: host writes" ON public.draft_skips;
CREATE POLICY "Draft skips: host writes" ON public.draft_skips
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.drafts d
      WHERE d.id = draft_id
        AND (d.created_by = auth.uid() OR public.is_app_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Draft skips: host deletes" ON public.draft_skips;
CREATE POLICY "Draft skips: host deletes" ON public.draft_skips
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.drafts d
      WHERE d.id = draft_id
        AND (d.created_by = auth.uid() OR public.is_app_admin(auth.uid()))
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_skips;