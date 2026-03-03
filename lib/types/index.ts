export type TaskStatus =
  | 'inbox'
  | 'next_actions'
  | 'waiting_for'
  | 'calendar'
  | 'someday_maybe'
  | 'notes'
  | 'trash'
  | 'done'

export type ProjectStatus = 'active' | 'completed'

export interface RoughPlanItem {
  id: string
  text: string
  order: number
}

export interface Attachment {
  name: string
  path: string
  type: string
  size: number
}

export interface Task {
  id: string
  title: string
  status: TaskStatus
  user_id: string
  project_id: string | null
  created_at: string
  updated_at: string
  scheduled_at: string | null
  due_date: string | null
  delegated_to: string | null
  is_delegation_communicated: boolean
  google_calendar_event_id: string | null
  contexts: string[]
  completed_at: string | null
  attachments: Attachment[]
}

export interface Project {
  id: string
  title: string
  completion_criteria: string
  rough_plan: RoughPlanItem[]
  first_step_task_id: string | null
  status: ProjectStatus
  user_id: string
  created_at: string
  updated_at: string
}

export type ReviewItemSelection =
  | { type: 'task'; id: string }
  | { type: 'project'; id: string }

export interface UserIntegration {
  id: string
  user_id: string
  google_refresh_token: string | null
  google_calendar_id: string | null
  created_at: string
}
