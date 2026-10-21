-- Stage 2: apply only after the matching web release is serving traffic.
BEGIN;
DO $$
DECLARE connection record;
BEGIN
  FOR connection IN SELECT * FROM public.user_integrations
    WHERE google_refresh_token IS NOT NULL FOR UPDATE
  LOOP
    IF connection.google_token_secret_id IS NULL THEN
      UPDATE public.user_integrations SET
        google_token_secret_id = vault.create_secret(connection.google_refresh_token),
        google_refresh_token = NULL, google_connected = true
      WHERE id = connection.id;
    ELSE
      PERFORM vault.update_secret(connection.google_token_secret_id, connection.google_refresh_token);
      UPDATE public.user_integrations SET google_refresh_token = NULL, google_connected = true
      WHERE id = connection.id;
    END IF;
  END LOOP;
END;
$$;

-- RLS still limits the visible connection status to its owner.
-- Revoke column grants too, so a prior explicit grant cannot survive.
REVOKE ALL ON public.user_integrations FROM PUBLIC, anon, authenticated;
REVOKE ALL (google_refresh_token, google_token_secret_id) ON public.user_integrations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,user_id,google_calendar_id,calendar_connected,google_connected,created_at)
  ON public.user_integrations TO authenticated;
COMMIT;
