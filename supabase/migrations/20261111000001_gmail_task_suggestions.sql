-- Persist only suggested task text and minimal source metadata; never store email bodies.
BEGIN;

CREATE TABLE public.gmail_task_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_email text NOT NULL CHECK (length(account_email) BETWEEN 3 AND 320),
  message_id text NOT NULL CHECK (length(message_id) BETWEEN 1 AND 256),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 500),
  subject text NOT NULL DEFAULT '' CHECK (length(subject) <= 500),
  sender text NOT NULL DEFAULT '' CHECK (length(sender) <= 500),
  received_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (user_id, account_email, message_id),
  CHECK ((status = 'pending') = (decided_at IS NULL))
);
CREATE INDEX gmail_pending_task_suggestions ON public.gmail_task_suggestions (user_id, created_at)
  WHERE status = 'pending';
ALTER TABLE public.gmail_task_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY gmail_suggestions_owner_read ON public.gmail_task_suggestions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.gmail_task_suggestions FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, user_id, message_id, title, subject, sender, received_at, created_at)
  ON public.gmail_task_suggestions TO authenticated;
GRANT ALL ON public.gmail_task_suggestions TO service_role;

CREATE FUNCTION public.accept_gmail_task_suggestion(p_user_id uuid, p_suggestion_id uuid, p_title text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE suggestion public.gmail_task_suggestions%ROWTYPE;
BEGIN
  IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Invalid task title';
  END IF;
  SELECT * INTO suggestion FROM public.gmail_task_suggestions
    WHERE id = p_suggestion_id AND user_id = p_user_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Suggestion unavailable'; END IF;
  PERFORM 1 FROM public.gmail_processed_messages
    WHERE user_id = suggestion.user_id AND account_email = suggestion.account_email
      AND message_id = suggestion.message_id AND status = 'processing' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source email is no longer available'; END IF;

  INSERT INTO public.tasks(id, user_id, title, status)
    VALUES (suggestion.id, p_user_id, btrim(p_title), 'inbox')
    ON CONFLICT (id) DO NOTHING;
  UPDATE public.gmail_task_suggestions SET status = 'accepted', decided_at = now()
    WHERE id = suggestion.id;
  UPDATE public.gmail_processed_messages SET status = 'processed', processed_at = now()
    WHERE user_id = suggestion.user_id AND account_email = suggestion.account_email
      AND message_id = suggestion.message_id AND status = 'processing';
END; $$;

CREATE FUNCTION public.dismiss_gmail_task_suggestion(p_user_id uuid, p_suggestion_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE suggestion public.gmail_task_suggestions%ROWTYPE;
BEGIN
  SELECT * INTO suggestion FROM public.gmail_task_suggestions
    WHERE id = p_suggestion_id AND user_id = p_user_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Suggestion unavailable'; END IF;
  PERFORM 1 FROM public.gmail_processed_messages
    WHERE user_id = suggestion.user_id AND account_email = suggestion.account_email
      AND message_id = suggestion.message_id AND status = 'processing' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source email is no longer available'; END IF;
  UPDATE public.gmail_task_suggestions SET status = 'dismissed', decided_at = now()
    WHERE id = suggestion.id;
  UPDATE public.gmail_processed_messages SET status = 'processed', processed_at = now()
    WHERE user_id = suggestion.user_id AND account_email = suggestion.account_email
      AND message_id = suggestion.message_id AND status = 'processing';
END; $$;

REVOKE ALL ON FUNCTION public.accept_gmail_task_suggestion(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dismiss_gmail_task_suggestion(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_gmail_task_suggestion(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dismiss_gmail_task_suggestion(uuid,uuid) TO service_role;
COMMIT;
