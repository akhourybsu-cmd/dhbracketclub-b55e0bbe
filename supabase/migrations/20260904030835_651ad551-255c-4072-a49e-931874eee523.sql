-- Clear auto-classified draft sub-categories.
-- Drafts are judged on their TITLE alone (e.g. "Scents that evoke a memory"),
-- with no narrower sub-category (e.g. "Food") narrowing the AI judging scope.
-- The enrichment classifier still runs internally as an image/metadata hint,
-- but its category is no longer persisted to drafts.category.

UPDATE public.drafts SET category = NULL WHERE category IS NOT NULL;