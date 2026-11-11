-- Per-user BYOK credential storage. No provider requests are made by this migration.
BEGIN;

CREATE TABLE public.user_llm_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'openai' CHECK (provider = 'openai'),
  model text NOT NULL DEFAULT 'gpt-4o-mini' CHECK (length(model) BETWEEN 1 AND 100),
  connected boolean NOT NULL DEFAULT false,
  secret_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (connected = (secret_id IS NOT NULL))
);
ALTER TABLE public.user_llm_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_llm_settings_owner_read ON public.user_llm_settings
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.user_llm_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id, provider, model, connected, updated_at)
  ON public.user_llm_settings TO authenticated;
GRANT ALL ON public.user_llm_settings TO service_role;

CREATE FUNCTION public.set_user_llm_secret(p_user_id uuid, p_api_key text, p_model text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_secret uuid;
BEGIN
  IF p_api_key IS NULL OR length(p_api_key) NOT BETWEEN 20 AND 500
    OR p_model IS NULL OR length(p_model) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid provider settings';
  END IF;
  INSERT INTO public.user_llm_settings(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT secret_id INTO current_secret FROM public.user_llm_settings
    WHERE user_id = p_user_id FOR UPDATE;
  IF current_secret IS NULL THEN
    current_secret := vault.create_secret(p_api_key, 'OpenAI API key for user ' || p_user_id::text);
  ELSE
    PERFORM vault.update_secret(current_secret, p_api_key, 'OpenAI API key for user ' || p_user_id::text);
  END IF;
  UPDATE public.user_llm_settings SET provider='openai', model=p_model,
    secret_id=current_secret, connected=true, updated_at=now() WHERE user_id=p_user_id;
END; $$;

CREATE FUNCTION public.get_user_llm_secret(p_user_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.decrypted_secret FROM public.user_llm_settings u
  JOIN vault.decrypted_secrets s ON s.id=u.secret_id
  WHERE u.user_id=p_user_id AND u.connected;
$$;

CREATE FUNCTION public.clear_user_llm_secret(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_secret uuid;
BEGIN
  SELECT secret_id INTO current_secret FROM public.user_llm_settings
    WHERE user_id=p_user_id FOR UPDATE;
  UPDATE public.user_llm_settings SET secret_id=NULL, connected=false, updated_at=now()
    WHERE user_id=p_user_id;
  IF current_secret IS NOT NULL THEN DELETE FROM vault.secrets WHERE id=current_secret; END IF;
END; $$;

CREATE FUNCTION public.cleanup_user_llm_secret()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.secret_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id=OLD.secret_id; END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER cleanup_user_llm_secret BEFORE DELETE ON public.user_llm_settings
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_user_llm_secret();

REVOKE ALL ON FUNCTION public.set_user_llm_secret(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_llm_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_user_llm_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_user_llm_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_llm_secret(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_llm_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_user_llm_secret(uuid) TO service_role;
COMMIT;
