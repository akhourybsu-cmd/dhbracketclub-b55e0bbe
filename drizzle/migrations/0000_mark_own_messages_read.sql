DELETE FROM public.channel_read_states a USING public.channel_read_states b
WHERE a.channel_id = b.channel_id AND a.user_id = b.user_id
  AND (a.last_read_at < b.last_read_at OR (a.last_read_at = b.last_read_at AND a.id < b.id));

CREATE UNIQUE INDEX IF NOT EXISTS channel_read_states_channel_user_uidx
  ON public.channel_read_states (channel_id, user_id);

CREATE OR REPLACE FUNCTION public.mark_sender_channel_read()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.parent_message_id IS NULL AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.channel_read_states (channel_id, user_id, last_read_at)
    VALUES (NEW.channel_id, NEW.user_id, NEW.created_at)
    ON CONFLICT (channel_id, user_id)
    DO UPDATE SET last_read_at = GREATEST(public.channel_read_states.last_read_at, EXCLUDED.last_read_at);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_sender_channel_read() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mark_sender_channel_read ON public.messages;
CREATE TRIGGER trg_mark_sender_channel_read AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.mark_sender_channel_read();