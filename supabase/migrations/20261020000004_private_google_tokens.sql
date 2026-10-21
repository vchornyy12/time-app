-- Requires SUPABASE_SERVICE_ROLE_KEY on the web server and matching web release.
-- Stage 1: run before deploying. Stage 2 removes legacy plaintext after deploy.
-- Supabase Vault keeps tokens encrypted on disk and in backups.
BEGIN;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS google_token_secret_id uuid,
  ADD COLUMN IF NOT EXISTS google_connected boolean NOT NULL DEFAULT false;

-- Serialize changes to a connection while moving its existing token.
DO $$
DECLARE connection record;
BEGIN
  FOR connection IN SELECT * FROM public.user_integrations
    WHERE google_refresh_token IS NOT NULL FOR UPDATE
  LOOP
    IF connection.google_token_secret_id IS NULL THEN
      UPDATE public.user_integrations SET
        google_token_secret_id = vault.create_secret(connection.google_refresh_token),
        google_connected = true
      WHERE id = connection.id;
    ELSE
      PERFORM vault.update_secret(connection.google_token_secret_id, connection.google_refresh_token);
      UPDATE public.user_integrations SET google_connected = true
      WHERE id = connection.id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_google_integration_secret(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('google_refresh_token', s.decrypted_secret,
    'google_calendar_id', i.google_calendar_id)
  FROM public.user_integrations i
  LEFT JOIN vault.decrypted_secrets s ON s.id = i.google_token_secret_id
  WHERE i.user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.set_google_integration_secret(
  p_user_id uuid, p_refresh_token text, p_calendar_connected boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE secret_id uuid;
BEGIN
  IF p_refresh_token IS NULL OR length(p_refresh_token) NOT BETWEEN 1 AND 10000
    OR p_calendar_connected IS NULL THEN RAISE EXCEPTION 'Invalid integration'; END IF;
  INSERT INTO public.user_integrations(user_id) VALUES(p_user_id)
    ON CONFLICT(user_id) DO NOTHING;
  SELECT google_token_secret_id INTO secret_id FROM public.user_integrations
    WHERE user_id = p_user_id FOR UPDATE;
  IF secret_id IS NULL THEN
    secret_id := vault.create_secret(p_refresh_token);
  ELSE
    PERFORM vault.update_secret(secret_id, p_refresh_token);
  END IF;
  UPDATE public.user_integrations SET google_token_secret_id = secret_id,
    google_refresh_token = NULL, google_calendar_id = 'primary',
    google_connected = true, calendar_connected = p_calendar_connected
    WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_google_integration_secret(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE secret_id uuid;
BEGIN
  SELECT google_token_secret_id INTO secret_id FROM public.user_integrations
    WHERE user_id = p_user_id FOR UPDATE;
  UPDATE public.user_integrations SET google_token_secret_id = NULL,
    google_refresh_token = NULL, google_calendar_id = NULL,
    google_connected = false, calendar_connected = false WHERE user_id = p_user_id;
  IF secret_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = secret_id; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_google_integration_secret()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.google_token_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = OLD.google_token_secret_id;
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS cleanup_google_secret ON public.user_integrations;
CREATE TRIGGER cleanup_google_secret BEFORE DELETE ON public.user_integrations
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_google_integration_secret();

REVOKE ALL ON FUNCTION public.get_google_integration_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_google_integration_secret(uuid,text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_google_integration_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_google_integration_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_google_integration_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_google_integration_secret(uuid,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_google_integration_secret(uuid) TO service_role;

-- Keep legacy code working during rollout without exposing or allowing writes
-- to the new Vault reference. Stage 2 removes these legacy token grants.
REVOKE ALL ON public.user_integrations FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,user_id,google_refresh_token,google_calendar_id,calendar_connected,google_connected,created_at)
  ON public.user_integrations TO authenticated;
GRANT INSERT (id,user_id,google_refresh_token,google_calendar_id,calendar_connected,created_at)
  ON public.user_integrations TO authenticated;
GRANT UPDATE (user_id,google_refresh_token,google_calendar_id,calendar_connected)
  ON public.user_integrations TO authenticated;
GRANT DELETE ON public.user_integrations TO authenticated;
COMMIT;
