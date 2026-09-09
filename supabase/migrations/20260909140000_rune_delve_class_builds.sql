-- Rune Delve: make campaign state and run records truly class-specific.
--
-- The hero row remains the player's shared identity and the existing
-- rune_delve_progress row remains the aggregate leaderboard record. The
-- class_progress row now owns the campaign position for each class.

ALTER TABLE public.rune_delve_class_progress
  ADD COLUMN IF NOT EXISTS highest_unlocked_level INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS highest_completed_level INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_levels_cleared INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_chapter INTEGER NOT NULL DEFAULT 1;

-- Preserve the existing campaign on the class that was active when this
-- migration landed. Other class tracks intentionally keep the fresh defaults.
UPDATE public.rune_delve_class_progress AS cp
SET
  highest_unlocked_level = GREATEST(cp.highest_unlocked_level, p.highest_unlocked_level),
  highest_completed_level = GREATEST(cp.highest_completed_level, p.highest_completed_level),
  total_levels_cleared = GREATEST(cp.total_levels_cleared, p.total_levels_cleared),
  current_chapter = GREATEST(cp.current_chapter, p.current_chapter)
FROM public.rune_delve_progress AS p
JOIN public.rune_delve_heroes AS h ON h.user_id = p.user_id
WHERE cp.user_id = p.user_id
  AND cp.class = h.class;

-- A personal best belongs to a build/class, not only to a level. This keeps a
-- Warrior clear from overwriting the Mage's independent attempt history.
DROP INDEX IF EXISTS public.rune_delve_runs_user_level_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS rune_delve_runs_user_level_class_uniq
  ON public.rune_delve_runs(user_id, level_id, hero_class)
  WHERE level_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rune_delve_runs_user_class
  ON public.rune_delve_runs(user_id, hero_class, level_number);

-- Failure assistance also resets per class. Existing help follows the class
-- that was active when it was earned; all other classes begin at zero.
ALTER TABLE public.rune_delve_failure_rewards
  ADD COLUMN IF NOT EXISTS hero_class TEXT;

UPDATE public.rune_delve_failure_rewards AS f
SET hero_class = COALESCE(h.class, 'warrior')
FROM public.rune_delve_heroes AS h
WHERE f.user_id = h.user_id
  AND f.hero_class IS NULL;

UPDATE public.rune_delve_failure_rewards
SET hero_class = 'warrior'
WHERE hero_class IS NULL;

ALTER TABLE public.rune_delve_failure_rewards
  ALTER COLUMN hero_class SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.rune_delve_failure_rewards'::regclass
      AND conname = 'rune_delve_failure_rewards_hero_class_check'
  ) THEN
    ALTER TABLE public.rune_delve_failure_rewards
      ADD CONSTRAINT rune_delve_failure_rewards_hero_class_check
      CHECK (hero_class IN ('warrior', 'mage', 'rogue', 'cleric'));
  END IF;
END $$;

ALTER TABLE public.rune_delve_failure_rewards
  DROP CONSTRAINT IF EXISTS rune_delve_failure_rewards_user_id_level_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS rune_delve_failure_rewards_user_level_class_uniq
  ON public.rune_delve_failure_rewards(user_id, level_number, hero_class);

CREATE INDEX IF NOT EXISTS idx_rune_delve_class_progress_campaign
  ON public.rune_delve_class_progress(user_id, class, highest_unlocked_level);
