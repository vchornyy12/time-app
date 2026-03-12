-- ============================================================
-- Migration 007 — get_analytics RPC
-- Returns aggregated analytics for a user over a given period.
-- ============================================================

CREATE OR REPLACE FUNCTION get_analytics(
  p_user_id uuid,
  p_from    timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(

    -- Daily completion counts within the period
    'completed_by_day',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('day', day, 'count', cnt)
          ORDER BY day
        )
        FROM (
          SELECT (completed_at AT TIME ZONE 'UTC')::date::text AS day,
                 COUNT(*)::int AS cnt
          FROM   tasks
          WHERE  user_id     = p_user_id
            AND  status      = 'done'
            AND  completed_at >= p_from
          GROUP BY 1
        ) sub
      ),
      '[]'::jsonb
    ),

    -- Average days from capture → done (within period)
    'avg_cycle_days',
    (
      SELECT ROUND(
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400.0)
      )::int
      FROM   tasks
      WHERE  user_id      = p_user_id
        AND  status       = 'done'
        AND  completed_at >= p_from
        AND  completed_at IS NOT NULL
    ),

    -- Total tasks created within the period
    'tasks_captured',
    (
      SELECT COUNT(*)::int
      FROM   tasks
      WHERE  user_id    = p_user_id
        AND  created_at >= p_from
    ),

    -- Current task counts by status (all time — for distribution chart)
    'status_counts',
    COALESCE(
      (
        SELECT jsonb_object_agg(status::text, cnt)
        FROM (
          SELECT status, COUNT(*)::int AS cnt
          FROM   tasks
          WHERE  user_id = p_user_id
          GROUP BY status
        ) sub
      ),
      '{}'::jsonb
    )

  );
$$;

-- Allow authenticated users to call the function
GRANT EXECUTE ON FUNCTION get_analytics(uuid, timestamptz) TO authenticated;
