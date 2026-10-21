-- Match the existing UI limits at the database boundary as well as Server Actions.
-- All constraints are validated in this transaction. Legacy violations abort the
-- migration without rewriting or truncating user data.
BEGIN;
CREATE OR REPLACE FUNCTION public.valid_task_contexts(context_values text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT context_values IS NOT NULL AND coalesce(array_ndims(context_values),1) = 1
    AND cardinality(context_values) <= 20
    AND NOT EXISTS (SELECT 1 FROM unnest(context_values) value WHERE value IS NULL OR length(value) > 50);
$$;
CREATE OR REPLACE FUNCTION public.valid_task_attachments(items jsonb, owner_id uuid)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE item jsonb;
BEGIN
  IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(items) > 20 THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR jsonb_typeof(item->'name') IS DISTINCT FROM 'string'
      OR length(item->>'name') NOT BETWEEN 1 AND 255
      OR jsonb_typeof(item->'path') IS DISTINCT FROM 'string'
      OR length(item->>'path') NOT BETWEEN 1 AND 1000
      OR left(item->>'path',37) <> owner_id::text || '/'
      OR jsonb_typeof(item->'type') IS DISTINCT FROM 'string'
      OR length(item->>'type') NOT BETWEEN 1 AND 100
      OR jsonb_typeof(item->'size') IS DISTINCT FROM 'number'
    THEN RETURN false; END IF;
    IF (item->>'size')::numeric NOT BETWEEN 0 AND 10485760
      OR trunc((item->>'size')::numeric) <> (item->>'size')::numeric THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.valid_task_contexts(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.valid_task_attachments(jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valid_task_contexts(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.valid_task_attachments(jsonb,uuid) TO authenticated, service_role;

DO $$
DECLARE rule record;
BEGIN
  FOR rule IN SELECT * FROM (VALUES
    ('tasks','tasks_title_bounds','length(title) BETWEEN 1 AND 500'),
    ('tasks','tasks_context_bounds','public.valid_task_contexts(contexts)'),
    ('tasks','tasks_attachment_bounds','public.valid_task_attachments(attachments,user_id)'),
    ('tasks','tasks_delegate_bounds','delegated_to IS NULL OR length(delegated_to) <= 200'),
    ('projects','projects_title_bounds','length(title) BETWEEN 1 AND 500'),
    ('projects','projects_criteria_bounds','length(completion_criteria) <= 1000'),
    ('projects','projects_plan_bounds', 'CASE WHEN jsonb_typeof(rough_plan) = ''array'' THEN jsonb_array_length(rough_plan) <= 100 AND octet_length(rough_plan::text) <= 200000 ELSE false END'),
    ('user_contexts','user_contexts_name_bounds','length(name) BETWEEN 1 AND 50'),
    ('daily_reflections','daily_reflections_content_bounds','length(content) <= 5000'),
    ('clarity_sessions','clarity_worry_bounds','length(worry_description) BETWEEN 1 AND 2000'),
    ('clarity_sessions','clarity_worst_case_bounds','length(worst_case_scenario) BETWEEN 1 AND 2000')
  ) AS rules(table_name,constraint_name,expression)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = rule.constraint_name
      AND conrelid = format('public.%I',rule.table_name)::regclass) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s) NOT VALID',rule.table_name,rule.constraint_name,rule.expression);
    END IF;
    EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',rule.table_name,rule.constraint_name);
  END LOOP;
END;
$$;
COMMIT;
