-- Keep later scans incremental while retaining the initial Inbox scan.
BEGIN;

ALTER TABLE public.gmail_integrations
  ADD COLUMN scan_cursor_at timestamptz;

ALTER TABLE public.gmail_processed_messages
  ADD COLUMN incremental_eligible boolean NOT NULL DEFAULT false;

ALTER TABLE public.gmail_processed_messages
  DROP CONSTRAINT gmail_processed_messages_status_check;
ALTER TABLE public.gmail_processed_messages
  ADD CONSTRAINT gmail_processed_messages_status_check
  CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'skipped'));

CREATE INDEX gmail_incremental_pending_messages
  ON public.gmail_processed_messages (user_id, account_email, created_at)
  WHERE incremental_eligible AND status IN ('pending', 'failed');

-- Discard any historical backlog; messages from the next scan window are
-- rediscovered from Gmail and individually reactivated by their received date.
UPDATE public.gmail_processed_messages
SET status = 'skipped'
WHERE status IN ('pending', 'failed');

-- Existing connected users resume from their most recent successful scan.
UPDATE public.gmail_integrations AS integration
SET scan_cursor_at = (
  SELECT run.created_at
  FROM public.gmail_scan_runs AS run
  WHERE run.user_id = integration.user_id
    AND run.account_email = integration.account_email
    AND run.status = 'completed'
  ORDER BY run.created_at DESC
  LIMIT 1
)
WHERE integration.connected;

CREATE OR REPLACE FUNCTION public.set_gmail_integration_secret(p_user_id uuid, p_account_email text, p_refresh_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE secret_id uuid;
BEGIN
  IF p_refresh_token IS NULL OR length(p_refresh_token) NOT BETWEEN 1 AND 10000
    OR p_account_email IS NULL OR length(p_account_email) NOT BETWEEN 3 AND 320 THEN
    RAISE EXCEPTION 'Invalid Gmail integration';
  END IF;
  INSERT INTO public.gmail_integrations(user_id, account_email)
    VALUES (p_user_id, lower(p_account_email)) ON CONFLICT (user_id) DO NOTHING;
  SELECT token_secret_id INTO secret_id FROM public.gmail_integrations
    WHERE user_id = p_user_id FOR UPDATE;
  IF secret_id IS NULL THEN
    secret_id := vault.create_secret(p_refresh_token);
  ELSE
    PERFORM vault.update_secret(secret_id, p_refresh_token);
  END IF;
  UPDATE public.gmail_integrations SET
    start_at = CASE WHEN account_email = lower(p_account_email) THEN start_at ELSE now() END,
    scan_cursor_at = CASE WHEN account_email = lower(p_account_email) THEN scan_cursor_at ELSE NULL END,
    account_email = lower(p_account_email), token_secret_id = secret_id, connected = true
    WHERE user_id = p_user_id;
END;
$$;

COMMIT;
