ALTER TABLE public.polls DROP CONSTRAINT IF EXISTS polls_poll_type_check;
ALTER TABLE public.polls ADD CONSTRAINT polls_poll_type_check CHECK (poll_type = ANY (ARRAY['single'::text,'multi'::text,'date'::text]));
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS allow_maybe boolean NOT NULL DEFAULT true;

ALTER TABLE public.poll_options ADD COLUMN IF NOT EXISTS option_date date;
CREATE INDEX IF NOT EXISTS poll_options_poll_date_idx ON public.poll_options (poll_id, option_date);

ALTER TABLE public.poll_votes ADD COLUMN IF NOT EXISTS response text NOT NULL DEFAULT 'yes';
ALTER TABLE public.poll_votes DROP CONSTRAINT IF EXISTS poll_votes_response_check;
ALTER TABLE public.poll_votes ADD CONSTRAINT poll_votes_response_check CHECK (response = ANY (ARRAY['yes'::text,'maybe'::text,'no'::text]));
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_unique_user_option_idx ON public.poll_votes (poll_id, user_id, option_id);