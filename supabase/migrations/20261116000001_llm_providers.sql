-- Let users connect either an OpenAI or an Anthropic API key (one provider at a time).
-- Backward compatible: the previous web build keeps working after this is applied,
-- so apply it before deploying the matching code. No provider requests are made here.
BEGIN;

ALTER TABLE public.user_llm_settings DROP CONSTRAINT user_llm_settings_provider_check;
ALTER TABLE public.user_llm_settings
  ADD CONSTRAINT user_llm_settings_provider_check CHECK (provider IN ('openai', 'anthropic'));
ALTER TABLE public.user_llm_settings ALTER COLUMN model SET DEFAULT 'gpt-6-luna';

CREATE FUNCTION public.set_user_llm_secret(p_user_id uuid, p_provider text, p_api_key text, p_model text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_secret uuid;
  previous_provider text;
BEGIN
  IF p_provider IS NULL OR p_provider NOT IN ('openai', 'anthropic')
    OR p_api_key IS NULL OR length(p_api_key) NOT BETWEEN 20 AND 500
    OR p_model IS NULL OR length(p_model) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid provider settings';
  END IF;
  INSERT INTO public.user_llm_settings(user_id, provider) VALUES (p_user_id, p_provider)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT secret_id, provider INTO current_secret, previous_provider FROM public.user_llm_settings
    WHERE user_id = p_user_id FOR UPDATE;
  IF current_secret IS NULL THEN
    current_secret := vault.create_secret(p_api_key, 'LLM API key for user ' || p_user_id::text);
  ELSE
    PERFORM vault.update_secret(current_secret, p_api_key, 'LLM API key for user ' || p_user_id::text);
  END IF;
  UPDATE public.user_llm_settings SET provider = p_provider, model = p_model,
    secret_id = current_secret, connected = true, updated_at = now() WHERE user_id = p_user_id;
  -- Consent to automatic scans named the previous provider as the recipient of
  -- email text. It does not carry over to a different company.
  IF previous_provider IS DISTINCT FROM p_provider THEN
    UPDATE public.gmail_integrations SET auto_scan_consent = false
      WHERE user_id = p_user_id AND auto_scan_consent;
  END IF;
END; $$;

-- Kept for the previously deployed build, which only knows OpenAI.
CREATE OR REPLACE FUNCTION public.set_user_llm_secret(p_user_id uuid, p_api_key text, p_model text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.set_user_llm_secret(p_user_id, 'openai', p_api_key, p_model);
$$;

REVOKE ALL ON FUNCTION public.set_user_llm_secret(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_llm_secret(uuid,text,text,text) TO service_role;

-- Scans accept any connected provider. Bodies are otherwise unchanged from 20261113000000.
CREATE OR REPLACE FUNCTION public.create_gmail_scan_run(p_user_id uuid, p_batch_size integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  integration public.gmail_integrations%ROWTYPE;
  active_id uuid;
  new_id uuid;
BEGIN
  IF p_batch_size NOT IN (25, 50, 100, 500) THEN RAISE EXCEPTION 'Invalid Gmail scan batch size'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  SELECT * INTO integration FROM public.gmail_integrations WHERE user_id = p_user_id AND connected FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Connect Gmail before scanning'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_llm_settings WHERE user_id = p_user_id AND connected) THEN
    RAISE EXCEPTION 'Connect an AI provider key before scanning';
  END IF;
  SELECT id INTO active_id FROM public.gmail_scan_runs WHERE user_id = p_user_id AND status IN ('queued', 'running');
  IF active_id IS NOT NULL THEN RETURN active_id; END IF;
  INSERT INTO public.gmail_scan_runs(user_id, account_email, kind, batch_size)
    VALUES (p_user_id, integration.account_email, 'manual', p_batch_size) RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.enqueue_due_gmail_scan_runs(p_limit integer DEFAULT 100)
RETURNS TABLE(run_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  integration public.gmail_integrations%ROWTYPE;
  candidate_user uuid;
  new_id uuid;
BEGIN
  -- Re-dispatch abandoned work after a background invocation hits its hard time limit.
  FOR new_id IN
    UPDATE public.gmail_scan_runs SET status = 'queued', worker_token = NULL, lease_until = NULL
    WHERE (status = 'running' AND lease_until < now())
      OR (status = 'queued' AND created_at < now() - interval '5 minutes')
    RETURNING id
  LOOP
    run_id := new_id;
    RETURN NEXT;
  END LOOP;

  FOR candidate_user IN
    SELECT g.user_id FROM public.gmail_integrations g
    WHERE g.connected AND g.auto_scan_consent AND g.scan_frequency <> 'manual'
      AND g.next_scan_at <= now()
      AND EXISTS (SELECT 1 FROM public.user_llm_settings l WHERE l.user_id = g.user_id AND l.connected)
    ORDER BY g.next_scan_at
    LIMIT greatest(1, least(p_limit, 100))
  LOOP
    -- Use the same lock order as manual run creation to avoid deadlocks.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(candidate_user::text, 0));
    SELECT * INTO integration FROM public.gmail_integrations g
      WHERE g.user_id = candidate_user AND g.connected AND g.auto_scan_consent
        AND g.scan_frequency <> 'manual' AND g.next_scan_at <= now()
      FOR UPDATE SKIP LOCKED;
    IF FOUND AND NOT EXISTS (SELECT 1 FROM public.gmail_scan_runs r WHERE r.user_id = integration.user_id AND r.status IN ('queued', 'running')) THEN
      INSERT INTO public.gmail_scan_runs(user_id, account_email, kind, batch_size)
        VALUES (integration.user_id, integration.account_email, 'scheduled', integration.scan_batch_size)
        RETURNING id INTO new_id;
      run_id := new_id;
      RETURN NEXT;
      UPDATE public.gmail_integrations SET next_scan_at = public.next_gmail_scan_at(
        integration.scan_frequency, integration.scan_time, integration.scan_timezone, now())
        WHERE user_id = integration.user_id;
    END IF;
  END LOOP;
END; $$;

COMMIT;
