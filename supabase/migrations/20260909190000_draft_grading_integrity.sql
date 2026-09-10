-- Draft grading integrity: one active grading job per draft, transactional
-- report replacement, and transactional dispute regrading.

CREATE TABLE IF NOT EXISTS public.draft_grading_jobs (
  draft_id UUID PRIMARY KEY REFERENCES public.drafts(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.draft_grading_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_draft_grading_jobs_status_started
  ON public.draft_grading_jobs(status, started_at);

-- Existing malformed rows remain visible for diagnosis, but all new or
-- updated reports must contain real positive totals and at least one rating.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.draft_results'::regclass
      AND conname = 'draft_results_positive_total_check'
  ) THEN
    ALTER TABLE public.draft_results
      ADD CONSTRAINT draft_results_positive_total_check
      CHECK (total_score > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.draft_results'::regclass
      AND conname = 'draft_results_nonempty_ratings_check'
  ) THEN
    ALTER TABLE public.draft_results
      ADD CONSTRAINT draft_results_nonempty_ratings_check
      CHECK (
        jsonb_typeof(pick_ratings) = 'array'
        AND jsonb_array_length(pick_ratings) > 0
      ) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.begin_draft_grading(
  _draft_id UUID,
  _request_id UUID,
  _lease_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  claimed BOOLEAN := false;
BEGIN
  INSERT INTO public.draft_grading_jobs (
    draft_id, request_id, status, attempt_count,
    started_at, completed_at, last_error, updated_at
  )
  VALUES (
    _draft_id, _request_id, 'running', 1,
    now(), NULL, NULL, now()
  )
  ON CONFLICT (draft_id) DO UPDATE
  SET
    request_id = EXCLUDED.request_id,
    status = 'running',
    attempt_count = public.draft_grading_jobs.attempt_count + 1,
    started_at = now(),
    completed_at = NULL,
    last_error = NULL,
    updated_at = now()
  WHERE public.draft_grading_jobs.status <> 'running'
     OR public.draft_grading_jobs.started_at
        < now() - make_interval(secs => GREATEST(_lease_seconds, 60))
  RETURNING true INTO claimed;

  RETURN COALESCE(claimed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_draft_grading(
  _draft_id UUID,
  _request_id UUID,
  _status TEXT,
  _error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  changed INTEGER := 0;
BEGIN
  IF _status NOT IN ('succeeded', 'failed') THEN
    RAISE EXCEPTION 'Invalid terminal grading status';
  END IF;

  UPDATE public.draft_grading_jobs
  SET
    status = _status,
    completed_at = now(),
    last_error = CASE WHEN _status = 'failed' THEN LEFT(_error, 1000) ELSE NULL END,
    updated_at = now()
  WHERE draft_id = _draft_id
    AND request_id = _request_id
    AND status = 'running';

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_draft_results_atomic(
  _draft_id UUID,
  _request_id UUID,
  _results JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  expected_participants INTEGER;
  unique_users INTEGER;
  unique_ranks INTEGER;
  result_item JSONB;
  result_user UUID;
  expected_picks INTEGER;
  supplied_picks INTEGER;
  unique_picks INTEGER;
  owned_picks INTEGER;
  computed_total NUMERIC;
BEGIN
  PERFORM 1
  FROM public.draft_grading_jobs
  WHERE draft_id = _draft_id
    AND request_id = _request_id
    AND status = 'running'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft grading lease is not active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.drafts
    WHERE id = _draft_id AND status = 'complete'
  ) THEN
    RAISE EXCEPTION 'Draft is not complete';
  END IF;

  IF COALESCE(jsonb_typeof(_results), '') <> 'array'
     OR jsonb_array_length(_results) = 0 THEN
    RAISE EXCEPTION 'Draft results must be a non-empty array';
  END IF;

  SELECT count(*) INTO expected_participants
  FROM public.draft_participants
  WHERE draft_id = _draft_id;

  IF jsonb_array_length(_results) <> expected_participants THEN
    RAISE EXCEPTION 'Draft result participant count mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_results) AS item
    WHERE COALESCE(jsonb_typeof(item->'user_id'), '') <> 'string'
       OR COALESCE(jsonb_typeof(item->'rank'), '') <> 'number'
       OR COALESCE(jsonb_typeof(item->'total_score'), '') <> 'number'
       OR COALESCE(jsonb_typeof(item->'pick_ratings'), '') <> 'array'
       OR COALESCE(jsonb_typeof(item->'summary'), '') <> 'string'
       OR COALESCE(jsonb_typeof(item->'points_awarded'), '') <> 'number'
       OR btrim(item->>'summary') = ''
       OR (item->>'total_score')::numeric <= 0
       OR (item->>'rank')::numeric < 1
       OR (item->>'rank')::numeric > expected_participants
       OR (item->>'rank')::numeric <> trunc((item->>'rank')::numeric)
       OR (item->>'points_awarded')::numeric < 1
  ) THEN
    RAISE EXCEPTION 'Draft result contains invalid fields';
  END IF;

  SELECT count(DISTINCT item->>'user_id'), count(DISTINCT item->>'rank')
  INTO unique_users, unique_ranks
  FROM jsonb_array_elements(_results) AS item;

  IF unique_users <> expected_participants OR unique_ranks <> expected_participants THEN
    RAISE EXCEPTION 'Draft results contain duplicate users or ranks';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_results) AS item
    WHERE NOT EXISTS (
      SELECT 1 FROM public.draft_participants AS participant
      WHERE participant.draft_id = _draft_id
        AND participant.user_id::text = item->>'user_id'
    )
  ) THEN
    RAISE EXCEPTION 'Draft result contains a non-participant user';
  END IF;

  FOR result_item IN SELECT value FROM jsonb_array_elements(_results)
  LOOP
    result_user := (result_item->>'user_id')::uuid;

    SELECT count(*) INTO expected_picks
    FROM public.draft_picks
    WHERE draft_id = _draft_id AND user_id = result_user;

    supplied_picks := jsonb_array_length(result_item->'pick_ratings');
    IF expected_picks = 0 OR supplied_picks <> expected_picks THEN
      RAISE EXCEPTION 'Draft result pick count mismatch for participant';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(result_item->'pick_ratings') AS rating
      WHERE COALESCE(jsonb_typeof(rating->'pick_id'), '') <> 'string'
         OR COALESCE(jsonb_typeof(rating->'pick_text'), '') <> 'string'
         OR COALESCE(jsonb_typeof(rating->'score'), '') <> 'number'
         OR COALESCE(jsonb_typeof(rating->'explanation'), '') <> 'string'
         OR btrim(rating->>'pick_text') = ''
         OR btrim(rating->>'explanation') = ''
         OR (rating->>'score')::numeric < 1
         OR (rating->>'score')::numeric > 10
    ) THEN
      RAISE EXCEPTION 'Draft result contains an invalid pick rating';
    END IF;

    SELECT count(DISTINCT rating->>'pick_id') INTO unique_picks
    FROM jsonb_array_elements(result_item->'pick_ratings') AS rating;

    SELECT count(*) INTO owned_picks
    FROM jsonb_array_elements(result_item->'pick_ratings') AS rating
    JOIN public.draft_picks AS pick
      ON pick.id::text = rating->>'pick_id'
     AND pick.draft_id = _draft_id
     AND pick.user_id = result_user;

    IF unique_picks <> expected_picks OR owned_picks <> expected_picks THEN
      RAISE EXCEPTION 'Draft result contains missing, duplicate, or misowned picks';
    END IF;

    SELECT round(sum((rating->>'score')::numeric), 1) INTO computed_total
    FROM jsonb_array_elements(result_item->'pick_ratings') AS rating;

    IF abs(computed_total - (result_item->>'total_score')::numeric) > 0.001 THEN
      RAISE EXCEPTION 'Draft total does not equal its pick ratings';
    END IF;
  END LOOP;

  -- Delete and insert live in this single function transaction. Any failure
  -- rolls the deletion back, preserving the last known-good report.
  DELETE FROM public.draft_results WHERE draft_id = _draft_id;

  INSERT INTO public.draft_results (
    draft_id, user_id, rank, total_score,
    pick_ratings, summary, points_awarded
  )
  SELECT
    _draft_id,
    row_data.user_id::uuid,
    row_data.rank,
    row_data.total_score,
    row_data.pick_ratings,
    row_data.summary,
    row_data.points_awarded
  FROM jsonb_to_recordset(_results) AS row_data(
    user_id TEXT,
    rank INTEGER,
    total_score NUMERIC,
    pick_ratings JSONB,
    summary TEXT,
    points_awarded INTEGER
  );

  UPDATE public.draft_grading_jobs
  SET
    status = 'succeeded',
    completed_at = now(),
    last_error = NULL,
    updated_at = now()
  WHERE draft_id = _draft_id AND request_id = _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_draft_pick_regrade_atomic(
  _dispute_id UUID,
  _result_id UUID,
  _pick_id UUID,
  _new_score NUMERIC,
  _new_explanation TEXT,
  _resolution_note TEXT,
  _resolved_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_draft_id UUID;
  target_pick_id UUID;
  result_user_id UUID;
  current_ratings JSONB;
  updated_ratings JSONB;
  matching_ratings INTEGER;
  updated_total NUMERIC;
BEGIN
  IF _new_score IS NULL OR _new_score < 1 OR _new_score > 10
     OR btrim(COALESCE(_new_explanation, '')) = ''
     OR btrim(COALESCE(_resolution_note, '')) = '' THEN
    RAISE EXCEPTION 'Invalid regrade payload';
  END IF;

  SELECT draft_id, pick_id INTO target_draft_id, target_pick_id
  FROM public.draft_pick_disputes
  WHERE id = _dispute_id AND status = 'pending'
  FOR UPDATE;

  IF target_draft_id IS NULL THEN
    RAISE EXCEPTION 'Pending dispute not found';
  END IF;

  SELECT user_id, pick_ratings
  INTO result_user_id, current_ratings
  FROM public.draft_results
  WHERE id = _result_id AND draft_id = target_draft_id
  FOR UPDATE;

  IF result_user_id IS NULL OR target_pick_id <> _pick_id OR NOT EXISTS (
    SELECT 1 FROM public.draft_picks
    WHERE id = _pick_id
      AND draft_id = target_draft_id
      AND user_id = result_user_id
  ) THEN
    RAISE EXCEPTION 'Result and disputed pick do not match';
  END IF;

  SELECT
    jsonb_agg(
      CASE WHEN rating->>'pick_id' = _pick_id::text
        THEN jsonb_set(
          jsonb_set(rating, '{score}', to_jsonb(round(_new_score, 1))),
          '{explanation}', to_jsonb(btrim(_new_explanation))
        )
        ELSE rating
      END
      ORDER BY ordinal
    ),
    count(*) FILTER (WHERE rating->>'pick_id' = _pick_id::text)
  INTO updated_ratings, matching_ratings
  FROM jsonb_array_elements(current_ratings) WITH ORDINALITY AS entries(rating, ordinal);

  IF matching_ratings <> 1 THEN
    RAISE EXCEPTION 'Disputed pick rating is missing or duplicated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(updated_ratings) AS rating
    WHERE COALESCE(jsonb_typeof(rating->'score'), '') <> 'number'
       OR (rating->>'score')::numeric < 1
       OR (rating->>'score')::numeric > 10
  ) THEN
    RAISE EXCEPTION 'Existing result contains invalid pick scores';
  END IF;

  SELECT round(sum((rating->>'score')::numeric), 1)
  INTO updated_total
  FROM jsonb_array_elements(updated_ratings) AS rating;

  UPDATE public.draft_results
  SET pick_ratings = updated_ratings, total_score = updated_total
  WHERE id = _result_id;

  WITH metrics AS (
    SELECT
      result.id,
      result.total_score,
      rating_metrics.highest_pick,
      rating_metrics.elite_picks,
      rating_metrics.lowest_pick,
      rating_metrics.average_pick,
      pick_metrics.last_pick_at
    FROM public.draft_results AS result
    CROSS JOIN LATERAL (
      SELECT
        max((rating->>'score')::numeric) AS highest_pick,
        count(*) FILTER (WHERE (rating->>'score')::numeric >= 8) AS elite_picks,
        min((rating->>'score')::numeric) AS lowest_pick,
        avg((rating->>'score')::numeric) AS average_pick
      FROM jsonb_array_elements(result.pick_ratings) AS rating
    ) AS rating_metrics
    LEFT JOIN LATERAL (
      SELECT max(picked_at) AS last_pick_at
      FROM public.draft_picks AS pick
      WHERE pick.draft_id = result.draft_id AND pick.user_id = result.user_id
    ) AS pick_metrics ON true
    WHERE result.draft_id = target_draft_id
  ),
  ranked AS (
    SELECT
      id,
      row_number() OVER (
        ORDER BY total_score DESC, highest_pick DESC, elite_picks DESC,
                 lowest_pick DESC, average_pick DESC, last_pick_at ASC NULLS LAST, id ASC
      )::integer AS new_rank,
      count(*) OVER ()::integer AS participant_count
    FROM metrics
  )
  UPDATE public.draft_results AS result
  SET
    rank = ranked.new_rank,
    points_awarded = GREATEST(1, ranked.participant_count - ranked.new_rank + 1)
  FROM ranked
  WHERE result.id = ranked.id;

  UPDATE public.draft_pick_disputes
  SET
    status = 'resolved',
    resolution = btrim(_resolution_note),
    resolved_at = now(),
    resolved_by = _resolved_by
  WHERE id = _dispute_id;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_draft_grading(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_draft_grading(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replace_draft_results_atomic(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_draft_pick_regrade_atomic(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.begin_draft_grading(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_draft_grading(UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.replace_draft_results_atomic(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_draft_pick_regrade_atomic(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
