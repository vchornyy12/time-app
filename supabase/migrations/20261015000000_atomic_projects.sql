-- Apply before deploying the matching web actions. All functions retain RLS.
-- No data rewrite; failed calls roll back all their writes.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_project_from_inbox(
  p_origin_task_id uuid, p_title text, p_completion_criteria text,
  p_rough_plan_lines text[], p_first_step_title text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := auth.uid();
  origin public.tasks;
  project public.projects;
  plan jsonb;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 500
    OR p_completion_criteria IS NULL OR length(p_completion_criteria) > 1000
    OR p_first_step_title IS NULL OR length(p_first_step_title) > 500
    OR p_rough_plan_lines IS NULL OR cardinality(p_rough_plan_lines) > 50
    OR EXISTS (SELECT 1 FROM unnest(p_rough_plan_lines) line WHERE line IS NULL OR length(line) > 500)
  THEN RAISE EXCEPTION 'Invalid project input' USING ERRCODE = '22023'; END IF;

  SELECT * INTO origin FROM public.tasks
    WHERE id = p_origin_task_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inbox task not found'; END IF;
  -- A retry of the same conversion returns the previously created project.
  IF origin.project_id IS NOT NULL THEN
    SELECT * INTO project FROM public.projects WHERE id = origin.project_id AND user_id = owner_id;
    IF FOUND THEN RETURN jsonb_build_object('project', to_jsonb(project), 'firstTask', to_jsonb(origin)); END IF;
  END IF;
  IF origin.status <> 'inbox' OR origin.project_id IS NOT NULL THEN
    RAISE EXCEPTION 'Task has already been processed';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'text', text, 'order', position - 1)
    ORDER BY position), '[]'::jsonb) INTO plan
  FROM (SELECT btrim(line) AS text, row_number() OVER (ORDER BY ordinal) AS position
    FROM unnest(p_rough_plan_lines) WITH ORDINALITY AS lines(line, ordinal)
    WHERE btrim(line) <> '') steps;

  INSERT INTO public.projects(user_id, title, completion_criteria, rough_plan)
    VALUES(owner_id, btrim(p_title), btrim(p_completion_criteria), plan) RETURNING * INTO project;
  UPDATE public.tasks SET title = coalesce(nullif(btrim(p_first_step_title), ''), btrim(p_title)),
    status = 'next_actions', project_id = project.id
    WHERE id = origin.id AND user_id = owner_id RETURNING * INTO origin;
  UPDATE public.projects SET first_step_task_id = origin.id
    WHERE id = project.id AND user_id = owner_id RETURNING * INTO project;
  RETURN jsonb_build_object('project', to_jsonb(project), 'firstTask', to_jsonb(origin));
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_project_step(p_project_id uuid, p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := auth.uid();
  project public.projects;
  task public.tasks;
  item jsonb;
  plan jsonb;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO project FROM public.projects
    WHERE id = p_project_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  -- Reuse the plan item's UUID as task ID for idempotent retries.
  SELECT * INTO task FROM public.tasks WHERE id = p_item_id AND project_id = p_project_id AND user_id = owner_id;
  IF FOUND THEN RETURN to_jsonb(task); END IF;
  IF project.status <> 'active' THEN RAISE EXCEPTION 'Project is completed'; END IF;
  IF EXISTS (SELECT 1 FROM public.tasks WHERE project_id = p_project_id AND user_id = owner_id
    AND status IN ('next_actions', 'waiting_for', 'calendar'))
  THEN RAISE EXCEPTION 'Review the active step before promoting another'; END IF;
  SELECT value INTO item FROM jsonb_array_elements(project.rough_plan) WHERE value->>'id' = p_item_id::text;
  IF item IS NULL THEN RAISE EXCEPTION 'Plan item not found'; END IF;
  IF length(btrim(item->>'text')) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid plan item'; END IF;
  SELECT coalesce(jsonb_agg(value ORDER BY ordinal), '[]'::jsonb) INTO plan
    FROM jsonb_array_elements(project.rough_plan) WITH ORDINALITY AS items(value, ordinal)
    WHERE value->>'id' <> p_item_id::text;
  INSERT INTO public.tasks(id, user_id, project_id, title, status)
    VALUES(p_item_id, owner_id, p_project_id, btrim(item->>'text'), 'next_actions') RETURNING * INTO task;
  UPDATE public.projects SET rough_plan = plan, first_step_task_id = task.id
    WHERE id = p_project_id AND user_id = owner_id;
  RETURN to_jsonb(task);
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_project_plan(p_project_id uuid, p_ordered_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := auth.uid();
  project public.projects;
  plan jsonb;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_ordered_ids IS NULL OR cardinality(p_ordered_ids) > 100
    OR EXISTS (SELECT 1 FROM unnest(p_ordered_ids) id WHERE id IS NULL)
    OR cardinality(p_ordered_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_ordered_ids) id)
  THEN RAISE EXCEPTION 'Invalid step order' USING ERRCODE = '22023'; END IF;
  SELECT * INTO project FROM public.projects WHERE id = p_project_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF project.status <> 'active' THEN RAISE EXCEPTION 'Project is completed'; END IF;
  -- Read the latest plan under its row lock. Omitted/new items survive, promoted items stay removed.
  SELECT coalesce(jsonb_agg(value || jsonb_build_object('order', position - 1) ORDER BY position), '[]'::jsonb)
    INTO plan FROM (
      SELECT value, row_number() OVER (ORDER BY array_position(p_ordered_ids, (value->>'id')::uuid) NULLS LAST, ordinal) AS position
      FROM jsonb_array_elements(project.rough_plan) WITH ORDINALITY AS items(value, ordinal)
    ) ordered;
  UPDATE public.projects SET rough_plan = plan WHERE id = p_project_id AND user_id = owner_id;
  RETURN plan;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_project_plan_step(p_project_id uuid, p_item_id uuid, p_text text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := auth.uid();
  project public.projects;
  item jsonb;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_item_id IS NULL OR p_text IS NULL OR length(btrim(p_text)) NOT BETWEEN 1 AND 500
    THEN RAISE EXCEPTION 'Invalid step' USING ERRCODE = '22023'; END IF;
  SELECT * INTO project FROM public.projects WHERE id = p_project_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF project.status <> 'active' THEN RAISE EXCEPTION 'Project is completed'; END IF;
  SELECT value INTO item FROM jsonb_array_elements(project.rough_plan) WHERE value->>'id' = p_item_id::text;
  IF item IS NOT NULL THEN RETURN item; END IF;
  -- Do not resurrect a plan item whose promotion already committed.
  IF EXISTS (SELECT 1 FROM public.tasks WHERE id = p_item_id AND project_id = p_project_id AND user_id = owner_id)
    THEN RAISE EXCEPTION 'Step has already been promoted'; END IF;
  IF jsonb_array_length(project.rough_plan) >= 100 THEN RAISE EXCEPTION 'Plan has reached 100 steps'; END IF;
  item := jsonb_build_object('id', p_item_id, 'text', btrim(p_text), 'order', jsonb_array_length(project.rough_plan));
  UPDATE public.projects SET rough_plan = rough_plan || jsonb_build_array(item)
    WHERE id = p_project_id AND user_id = owner_id;
  RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_project_step(p_project_id uuid, p_task_id uuid)
-- The existing recurrence trigger resolves its INSERT through public.
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  owner_id uuid := auth.uid();
  project public.projects;
  task public.tasks;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO project FROM public.projects WHERE id = p_project_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  SELECT * INTO task FROM public.tasks
    WHERE id = p_task_id AND project_id = p_project_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project step not found'; END IF;
  IF task.status = 'done' THEN RETURN; END IF;
  IF project.status <> 'active' OR task.status <> 'next_actions' THEN RAISE EXCEPTION 'Step is not a next action'; END IF;
  UPDATE public.tasks SET status = 'done', completed_at = now() WHERE id = p_task_id AND user_id = owner_id;
  UPDATE public.projects SET first_step_task_id = NULL
    WHERE id = p_project_id AND user_id = owner_id AND first_step_task_id = p_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_project(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := auth.uid();
  project public.projects;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO project FROM public.projects WHERE id = p_project_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF project.status = 'completed' THEN RETURN; END IF;
  IF jsonb_array_length(project.rough_plan) > 0 OR EXISTS (
    SELECT 1 FROM public.tasks WHERE project_id = p_project_id AND user_id = owner_id
      AND status IN ('inbox', 'next_actions', 'waiting_for', 'calendar')
  ) THEN RAISE EXCEPTION 'Project still has unfinished steps'; END IF;
  UPDATE public.projects SET status = 'completed', first_step_task_id = NULL WHERE id = p_project_id AND user_id = owner_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_from_inbox(uuid, text, text, text[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.promote_project_step(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reorder_project_plan(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_project_plan_step(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_project_step(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project_from_inbox(uuid, text, text, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_project_step(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_project_plan(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_project_plan_step(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_project_step(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_project(uuid) TO authenticated;
COMMIT;
