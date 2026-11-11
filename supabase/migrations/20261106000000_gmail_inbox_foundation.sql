-- Step 1 only: connection, filter and processing ledger. No scans are scheduled.
-- Requires Supabase Vault from 20261020000004_private_google_tokens.sql.
BEGIN;

CREATE TABLE public.gmail_integrations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_email text NOT NULL CHECK (length(account_email) BETWEEN 3 AND 320),
  connected boolean NOT NULL DEFAULT false,
  label_name text NOT NULL DEFAULT 'AI Inbox'
    CHECK (length(btrim(label_name)) BETWEEN 1 AND 100 AND label_name !~ '[[:cntrl:]]'),
  start_at timestamptz NOT NULL DEFAULT now(),
  token_secret_id uuid,
  CHECK (connected = (token_secret_id IS NOT NULL))
);
ALTER TABLE public.gmail_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY gmail_owner_read ON public.gmail_integrations FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY gmail_owner_label ON public.gmail_integrations FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.gmail_integrations FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id, account_email, connected, label_name, start_at)
  ON public.gmail_integrations TO authenticated;
GRANT UPDATE (label_name) ON public.gmail_integrations TO authenticated;
GRANT ALL ON public.gmail_integrations TO service_role;

-- No email bodies or credentials in the ledger. Preserve rows on disconnect so
-- reconnecting or relabeling an email cannot silently process it a second time.
CREATE TABLE public.gmail_processed_messages (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_email text NOT NULL CHECK (length(account_email) BETWEEN 3 AND 320),
  message_id text NOT NULL CHECK (length(message_id) BETWEEN 1 AND 256),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  PRIMARY KEY (user_id, account_email, message_id),
  CHECK ((status = 'processed') = (processed_at IS NOT NULL))
);
CREATE INDEX gmail_pending_messages ON public.gmail_processed_messages (user_id, created_at)
  WHERE status IN ('pending', 'failed');
ALTER TABLE public.gmail_processed_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY gmail_message_owner_read ON public.gmail_processed_messages FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.gmail_processed_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gmail_processed_messages TO authenticated;
GRANT ALL ON public.gmail_processed_messages TO service_role;

CREATE FUNCTION public.set_gmail_integration_secret(p_user_id uuid, p_account_email text, p_refresh_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE secret_id uuid;
BEGIN
  IF p_refresh_token IS NULL OR length(p_refresh_token) NOT BETWEEN 1 AND 10000
    OR p_account_email IS NULL OR length(p_account_email) NOT BETWEEN 3 AND 320 THEN
    RAISE EXCEPTION 'Invalid Gmail integration';
  END IF;
  -- Insert and lock the user's row, serializing initial connection and rotation.
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
    account_email = lower(p_account_email), token_secret_id = secret_id, connected = true
    WHERE user_id = p_user_id;
END;
$$;

CREATE FUNCTION public.get_gmail_integration_secret(p_user_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.decrypted_secret FROM public.gmail_integrations i
  JOIN vault.decrypted_secrets s ON s.id = i.token_secret_id
  WHERE i.user_id = p_user_id AND i.connected;
$$;

CREATE FUNCTION public.clear_gmail_integration_secret(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE secret_id uuid;
BEGIN
  SELECT token_secret_id INTO secret_id FROM public.gmail_integrations
    WHERE user_id = p_user_id FOR UPDATE;
  UPDATE public.gmail_integrations SET token_secret_id = NULL, connected = false
    WHERE user_id = p_user_id;
  IF secret_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = secret_id; END IF;
END;
$$;

CREATE FUNCTION public.cleanup_gmail_integration_secret()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.token_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = OLD.token_secret_id;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER cleanup_gmail_secret BEFORE DELETE ON public.gmail_integrations
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_gmail_integration_secret();

REVOKE ALL ON FUNCTION public.set_gmail_integration_secret(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_gmail_integration_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_gmail_integration_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_gmail_integration_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_gmail_integration_secret(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_gmail_integration_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_gmail_integration_secret(uuid) TO service_role;
COMMIT;
