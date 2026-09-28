ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS missed_picks jsonb;
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS missed_picks_generated_at timestamptz;