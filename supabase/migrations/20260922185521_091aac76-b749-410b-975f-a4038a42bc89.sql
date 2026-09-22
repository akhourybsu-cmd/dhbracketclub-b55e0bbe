ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS ceremony_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ceremony_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ceremony_reveal_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ceremony_started_at timestamptz;

ALTER TABLE public.drafts
  DROP CONSTRAINT IF EXISTS drafts_ceremony_status_check;
ALTER TABLE public.drafts
  ADD CONSTRAINT drafts_ceremony_status_check
  CHECK (ceremony_status IN ('pending', 'revealing', 'complete'));

ALTER TABLE public.drafts
  DROP CONSTRAINT IF EXISTS drafts_ceremony_reveal_index_check;
ALTER TABLE public.drafts
  ADD CONSTRAINT drafts_ceremony_reveal_index_check
  CHECK (ceremony_reveal_index >= 0);

CREATE TABLE public.draft_desk_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  is_favorite boolean NOT NULL DEFAULT false,
  is_on_deck boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.draft_desk_items TO authenticated;
GRANT ALL ON public.draft_desk_items TO service_role;

ALTER TABLE public.draft_desk_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Draft desk: owner reads"
ON public.draft_desk_items FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Draft desk: participants create"
ON public.draft_desk_items FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.draft_participants participant
    WHERE participant.draft_id = draft_desk_items.draft_id
      AND participant.user_id = auth.uid()
  )
);

CREATE POLICY "Draft desk: owner updates"
ON public.draft_desk_items FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Draft desk: owner deletes"
ON public.draft_desk_items FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX draft_desk_items_owner_order_idx
ON public.draft_desk_items (draft_id, user_id, position, created_at);

CREATE UNIQUE INDEX draft_desk_items_one_on_deck_idx
ON public.draft_desk_items (draft_id, user_id)
WHERE is_on_deck;

DROP TRIGGER IF EXISTS set_draft_desk_items_updated_at ON public.draft_desk_items;
CREATE TRIGGER set_draft_desk_items_updated_at
BEFORE UPDATE ON public.draft_desk_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_desk_items;