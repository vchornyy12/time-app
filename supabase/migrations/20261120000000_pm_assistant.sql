-- PM assistant (FS-001 phases 2-5):
--   * agent_processed_items — ledger of source items the agent already handled,
--     so hourly runs skip them even when they produced no task;
--   * agent_suggestions     — agent proposals on existing tasks (close, follow up,
--     create a Jira issue). The human accepts or dismisses; approved external
--     actions are executed by the agent and recorded with their external ID;
--   * agent_profiles        — per-user instructions for the agent (muted spaces,
--     projects, people), editable only in the app;
--   * Vault-backed secrets for the Google Chat source and the notification webhook.
BEGIN;

-- ── Processed-items ledger ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_processed_items (
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source        text NOT NULL CHECK (source IN ('gmail','bluedot','google_chat','slack','jira','calendar','meeting','other')),
  source_ref    text NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 300),
  outcome       text NOT NULL CHECK (outcome IN ('captured','closed','noise','duplicate','skipped')),
  task_id       uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  processed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, source, source_ref)
);
CREATE INDEX IF NOT EXISTS agent_processed_items_user_time_idx
  ON public.agent_processed_items (user_id, processed_at DESC);
ALTER TABLE public.agent_processed_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_processed_select_own ON public.agent_processed_items;
CREATE POLICY agent_processed_select_own ON public.agent_processed_items FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS agent_processed_insert_own ON public.agent_processed_items;
CREATE POLICY agent_processed_insert_own ON public.agent_processed_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS agent_processed_update_own ON public.agent_processed_items;
CREATE POLICY agent_processed_update_own ON public.agent_processed_items FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS agent_processed_delete_own ON public.agent_processed_items;
CREATE POLICY agent_processed_delete_own ON public.agent_processed_items FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND NOT public.is_agent_token());
REVOKE ALL ON public.agent_processed_items FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_processed_items TO authenticated, service_role;

-- ── Suggestions on existing tasks ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_suggestions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id         uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('close','follow_up','jira_issue')),
  reason          text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  evidence_url    text CHECK (evidence_url IS NULL OR (length(evidence_url) <= 2000 AND evidence_url ~ '^https://')),
  evidence_quote  text CHECK (evidence_quote IS NULL OR length(evidence_quote) <= 1000),
  draft_message   text CHECK (draft_message IS NULL OR length(draft_message) <= 2000),
  payload         jsonb CHECK (payload IS NULL OR (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 4000)),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed','executed','failed')),
  external_ref    text CHECK (external_ref IS NULL OR length(external_ref) BETWEEN 1 AND 200),
  captured_by     text CHECK (captured_by IS NULL OR length(captured_by) <= 200),
  created_at      timestamptz NOT NULL DEFAULT now(),
  decided_at      timestamptz,
  executed_at     timestamptz,
  CHECK ((status = 'pending') = (decided_at IS NULL)),
  CHECK (kind = 'jira_issue' OR status NOT IN ('executed','failed'))
);
-- One open suggestion of each kind per task.
CREATE UNIQUE INDEX IF NOT EXISTS agent_suggestions_one_pending_idx
  ON public.agent_suggestions (task_id, kind) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS agent_suggestions_user_status_idx
  ON public.agent_suggestions (user_id, status, created_at DESC);
ALTER TABLE public.agent_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_suggestions_select_own ON public.agent_suggestions;
CREATE POLICY agent_suggestions_select_own ON public.agent_suggestions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS agent_suggestions_insert_own ON public.agent_suggestions;
CREATE POLICY agent_suggestions_insert_own ON public.agent_suggestions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND decided_at IS NULL AND executed_at IS NULL
    AND external_ref IS NULL
    AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));
DROP POLICY IF EXISTS agent_suggestions_update_own ON public.agent_suggestions;
CREATE POLICY agent_suggestions_update_own ON public.agent_suggestions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS agent_suggestions_delete_own ON public.agent_suggestions;
CREATE POLICY agent_suggestions_delete_own ON public.agent_suggestions FOR DELETE TO authenticated
  USING (user_id = auth.uid());
-- The human decides: agent tokens cannot change or delete suggestions directly.
DROP POLICY IF EXISTS agent_suggestions_agent_no_update ON public.agent_suggestions;
CREATE POLICY agent_suggestions_agent_no_update ON public.agent_suggestions AS RESTRICTIVE FOR UPDATE
  TO authenticated USING (NOT public.is_agent_token());
DROP POLICY IF EXISTS agent_suggestions_agent_no_delete ON public.agent_suggestions;
CREATE POLICY agent_suggestions_agent_no_delete ON public.agent_suggestions AS RESTRICTIVE FOR DELETE
  TO authenticated USING (NOT public.is_agent_token());
REVOKE ALL ON public.agent_suggestions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_suggestions TO authenticated, service_role;

-- The only state change an agent may make: record the result of an external
-- action the user already approved (status accepted → executed/failed).
CREATE OR REPLACE FUNCTION public.complete_agent_suggestion(
  p_suggestion_id uuid, p_ok boolean, p_external_ref text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_ok IS NULL OR (p_ok AND (p_external_ref IS NULL OR length(p_external_ref) NOT BETWEEN 1 AND 200))
    OR (p_external_ref IS NOT NULL AND length(p_external_ref) > 200) THEN
    RAISE EXCEPTION 'Invalid result';
  END IF;
  UPDATE public.agent_suggestions
    SET status = CASE WHEN p_ok THEN 'executed' ELSE 'failed' END,
        external_ref = CASE WHEN p_ok THEN p_external_ref ELSE NULL END,
        executed_at = now()
    WHERE id = p_suggestion_id AND user_id = auth.uid()
      AND kind = 'jira_issue' AND status = 'accepted';
  IF NOT FOUND THEN RAISE EXCEPTION 'No approved action with this ID'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_agent_suggestion(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_agent_suggestion(uuid, boolean, text) TO authenticated;

-- ── Per-user agent profile (read-only for agents) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_profiles (
  user_id       uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  instructions  text NOT NULL DEFAULT '' CHECK (length(instructions) <= 4000),
  muted         text[] NOT NULL DEFAULT '{}' CHECK (cardinality(muted) <= 100),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_profiles_own ON public.agent_profiles;
CREATE POLICY agent_profiles_own ON public.agent_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS agent_profiles_agent_no_insert ON public.agent_profiles;
CREATE POLICY agent_profiles_agent_no_insert ON public.agent_profiles AS RESTRICTIVE FOR INSERT
  TO authenticated WITH CHECK (NOT public.is_agent_token());
DROP POLICY IF EXISTS agent_profiles_agent_no_update ON public.agent_profiles;
CREATE POLICY agent_profiles_agent_no_update ON public.agent_profiles AS RESTRICTIVE FOR UPDATE
  TO authenticated USING (NOT public.is_agent_token());
DROP POLICY IF EXISTS agent_profiles_agent_no_delete ON public.agent_profiles;
CREATE POLICY agent_profiles_agent_no_delete ON public.agent_profiles AS RESTRICTIVE FOR DELETE
  TO authenticated USING (NOT public.is_agent_token());
REVOKE ALL ON public.agent_profiles FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_profiles TO authenticated, service_role;

-- ── Assistant secrets (Google Chat token, notification webhook) ───────────
-- Kept out of user_integrations so the Calendar flow is untouched. Only the
-- connection flags are visible to the user; secrets are read by the server
-- with the service role.
CREATE TABLE IF NOT EXISTS public.assistant_integrations (
  user_id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_connected          boolean NOT NULL DEFAULT false,
  chat_account_email      text CHECK (chat_account_email IS NULL OR length(chat_account_email) <= 320),
  chat_token_secret_id    uuid,
  notify_connected        boolean NOT NULL DEFAULT false,
  notify_webhook_secret_id uuid,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assistant_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assistant_integrations_select_own ON public.assistant_integrations;
CREATE POLICY assistant_integrations_select_own ON public.assistant_integrations FOR SELECT TO authenticated
  USING (user_id = auth.uid());
REVOKE ALL ON public.assistant_integrations FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id, chat_connected, chat_account_email, notify_connected, updated_at)
  ON public.assistant_integrations TO authenticated;
GRANT ALL ON public.assistant_integrations TO service_role;

CREATE OR REPLACE FUNCTION public.get_assistant_secret(p_user_id uuid, p_kind text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.decrypted_secret
  FROM public.assistant_integrations i
  JOIN vault.decrypted_secrets s ON s.id = CASE p_kind
    WHEN 'chat' THEN i.chat_token_secret_id
    WHEN 'notify' THEN i.notify_webhook_secret_id END
  WHERE i.user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.set_assistant_secret(
  p_user_id uuid, p_kind text, p_secret text, p_account_email text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE secret_id uuid;
BEGIN
  IF p_kind NOT IN ('chat','notify') OR p_secret IS NULL OR length(p_secret) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Invalid secret';
  END IF;
  INSERT INTO public.assistant_integrations(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT CASE p_kind WHEN 'chat' THEN chat_token_secret_id ELSE notify_webhook_secret_id END
    INTO secret_id FROM public.assistant_integrations WHERE user_id = p_user_id FOR UPDATE;
  IF secret_id IS NULL THEN
    secret_id := vault.create_secret(p_secret);
  ELSE
    PERFORM vault.update_secret(secret_id, p_secret);
  END IF;
  IF p_kind = 'chat' THEN
    UPDATE public.assistant_integrations SET chat_token_secret_id = secret_id, chat_connected = true,
      chat_account_email = left(p_account_email, 320), updated_at = now() WHERE user_id = p_user_id;
  ELSE
    UPDATE public.assistant_integrations SET notify_webhook_secret_id = secret_id, notify_connected = true,
      updated_at = now() WHERE user_id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_assistant_secret(p_user_id uuid, p_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE secret_id uuid;
BEGIN
  IF p_kind NOT IN ('chat','notify') THEN RAISE EXCEPTION 'Invalid kind'; END IF;
  SELECT CASE p_kind WHEN 'chat' THEN chat_token_secret_id ELSE notify_webhook_secret_id END
    INTO secret_id FROM public.assistant_integrations WHERE user_id = p_user_id FOR UPDATE;
  IF p_kind = 'chat' THEN
    UPDATE public.assistant_integrations SET chat_token_secret_id = NULL, chat_connected = false,
      chat_account_email = NULL, updated_at = now() WHERE user_id = p_user_id;
  ELSE
    UPDATE public.assistant_integrations SET notify_webhook_secret_id = NULL, notify_connected = false,
      updated_at = now() WHERE user_id = p_user_id;
  END IF;
  IF secret_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = secret_id; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_assistant_secrets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id IN (OLD.chat_token_secret_id, OLD.notify_webhook_secret_id);
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS assistant_integrations_cleanup_secrets ON public.assistant_integrations;
CREATE TRIGGER assistant_integrations_cleanup_secrets AFTER DELETE ON public.assistant_integrations
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_assistant_secrets();

REVOKE ALL ON FUNCTION public.get_assistant_secret(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_assistant_secret(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_assistant_secret(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_assistant_secrets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_assistant_secret(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_assistant_secret(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_assistant_secret(uuid, text) TO service_role;

COMMIT;
