-- Durable scan runs and per-user scheduling for the Gmail background worker.
BEGIN;

ALTER TABLE public.gmail_integrations ADD COLUMN next_scan_at timestamptz;

CREATE TABLE public.gmail_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_email text NOT NULL CHECK (length(account_email) BETWEEN 3 AND 320),
  kind text NOT NULL CHECK (kind IN ('manual', 'scheduled')),
  batch_size integer NOT NULL CHECK (batch_size IN (25, 50, 100, 500)),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  processed_count integer NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
  suggestion_count integer NOT NULL DEFAULT 0 CHECK (suggestion_count >= 0),
  worker_token uuid,
  lease_until timestamptz,
  error_message text CHECK (error_message IS NULL OR length(error_message) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX gmail_scan_runs_owner_recent ON public.gmail_scan_runs (user_id, created_at DESC);
CREATE UNIQUE INDEX gmail_scan_runs_one_active_per_user ON public.gmail_scan_runs (user_id)
  WHERE status IN ('queued', 'running');
ALTER TABLE public.gmail_scan_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY gmail_scan_runs_owner_read ON public.gmail_scan_runs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.gmail_scan_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, user_id, kind, batch_size, status, processed_count, suggestion_count, error_message, created_at, started_at, completed_at)
  ON public.gmail_scan_runs TO authenticated;
GRANT ALL ON public.gmail_scan_runs TO service_role;

CREATE FUNCTION public.next_gmail_scan_at(p_frequency text, p_time time, p_timezone text, p_after timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  local_after timestamp;
  candidate_date date;
  candidate_time time;
  candidate timestamptz;
  best_candidate timestamptz;
  day_offset integer;
  slot integer;
  last_slot integer;
BEGIN
  IF p_frequency = 'manual' THEN RETURN NULL; END IF;
  IF p_frequency NOT IN ('daily', 'twice_daily') THEN RAISE EXCEPTION 'Invalid Gmail scan frequency'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone) THEN
    RAISE EXCEPTION 'Invalid Gmail scan time zone';
  END IF;
  local_after := p_after AT TIME ZONE p_timezone;
  last_slot := CASE WHEN p_frequency = 'twice_daily' THEN 1 ELSE 0 END;
  FOR day_offset IN 0..2 LOOP
    candidate_date := local_after::date + day_offset;
    FOR slot IN 0..last_slot LOOP
      candidate_time := CASE WHEN slot = 0 THEN p_time ELSE p_time + interval '12 hours' END;
      candidate := (candidate_date + candidate_time) AT TIME ZONE p_timezone;
      IF candidate > p_after AND (best_candidate IS NULL OR candidate < best_candidate) THEN
        best_candidate := candidate;
      END IF;
    END LOOP;
  END LOOP;
  RETURN best_candidate;
END; $$;

CREATE FUNCTION public.refresh_gmail_scan_due()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.connected AND NEW.scan_frequency <> 'manual' AND NEW.auto_scan_consent THEN
    NEW.next_scan_at := public.next_gmail_scan_at(NEW.scan_frequency, NEW.scan_time, NEW.scan_timezone, now());
  ELSE
    NEW.next_scan_at := NULL;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.refresh_gmail_scan_due() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER gmail_scan_preferences_schedule
  BEFORE INSERT OR UPDATE OF connected, scan_frequency, scan_time, scan_timezone, auto_scan_consent
  ON public.gmail_integrations FOR EACH ROW EXECUTE FUNCTION public.refresh_gmail_scan_due();

CREATE FUNCTION public.create_gmail_scan_run(p_user_id uuid, p_batch_size integer)
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
  IF NOT EXISTS (SELECT 1 FROM public.user_llm_settings WHERE user_id = p_user_id AND connected AND provider = 'openai') THEN
    RAISE EXCEPTION 'Connect your OpenAI API key before scanning';
  END IF;
  SELECT id INTO active_id FROM public.gmail_scan_runs WHERE user_id = p_user_id AND status IN ('queued', 'running');
  IF active_id IS NOT NULL THEN RETURN active_id; END IF;
  INSERT INTO public.gmail_scan_runs(user_id, account_email, kind, batch_size)
    VALUES (p_user_id, integration.account_email, 'manual', p_batch_size) RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

CREATE FUNCTION public.enqueue_due_gmail_scan_runs(p_limit integer DEFAULT 100)
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
      AND EXISTS (SELECT 1 FROM public.user_llm_settings l WHERE l.user_id = g.user_id AND l.connected AND l.provider = 'openai')
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

CREATE FUNCTION public.claim_gmail_scan_run(p_run_id uuid, p_worker_token uuid)
RETURNS public.gmail_scan_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result public.gmail_scan_runs%ROWTYPE;
BEGIN
  UPDATE public.gmail_scan_runs SET status = 'running', worker_token = p_worker_token,
    lease_until = now() + interval '90 seconds', started_at = COALESCE(started_at, now()), error_message = NULL
  WHERE id = p_run_id AND (
    status = 'queued' OR (status = 'running' AND (lease_until < now() OR worker_token = p_worker_token))
  ) RETURNING * INTO result;
  RETURN result;
END; $$;

CREATE FUNCTION public.advance_gmail_scan_run(p_run_id uuid, p_worker_token uuid, p_processed integer, p_suggestions integer, p_done boolean)
RETURNS public.gmail_scan_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result public.gmail_scan_runs%ROWTYPE;
BEGIN
  UPDATE public.gmail_scan_runs SET
    processed_count = processed_count + greatest(0, p_processed),
    suggestion_count = suggestion_count + greatest(0, p_suggestions),
    status = CASE WHEN p_done OR processed_count + greatest(0, p_processed) >= batch_size THEN 'completed' ELSE 'running' END,
    completed_at = CASE WHEN p_done OR processed_count + greatest(0, p_processed) >= batch_size THEN now() ELSE NULL END,
    lease_until = CASE WHEN p_done OR processed_count + greatest(0, p_processed) >= batch_size THEN NULL ELSE now() + interval '90 seconds' END
  WHERE id = p_run_id AND status = 'running' AND worker_token = p_worker_token
  RETURNING * INTO result;
  RETURN result;
END; $$;

CREATE FUNCTION public.fail_gmail_scan_run(p_run_id uuid, p_worker_token uuid, p_error text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.gmail_scan_runs SET status = 'failed', completed_at = now(), lease_until = NULL,
    error_message = left(COALESCE(p_error, 'Gmail scan failed'), 500)
  WHERE id = p_run_id AND status = 'running' AND worker_token = p_worker_token;
  RETURN FOUND;
END; $$;

-- Preferences may have been set before this scheduler migration was applied.
UPDATE public.gmail_integrations SET next_scan_at = public.next_gmail_scan_at(
  scan_frequency, scan_time, scan_timezone, now())
WHERE connected AND auto_scan_consent AND scan_frequency <> 'manual';

REVOKE ALL ON FUNCTION public.next_gmail_scan_at(text,time,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_gmail_scan_run(uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_due_gmail_scan_runs(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_gmail_scan_run(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_gmail_scan_run(uuid,uuid,integer,integer,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_gmail_scan_run(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_gmail_scan_run(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_due_gmail_scan_runs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_gmail_scan_run(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_gmail_scan_run(uuid,uuid,integer,integer,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_gmail_scan_run(uuid,uuid,text) TO service_role;

COMMIT;
