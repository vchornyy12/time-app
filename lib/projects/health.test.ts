import { describe, expect, it } from 'vitest'
import { getActiveProjectTask, getProjectHealth, type ProjectTask } from './health'
const task = (id: string, status: ProjectTask['status']): ProjectTask => ({ id, status, title: id, contexts: [], due_date: null })
describe('actual project state', () => {
  it('ignores stale pointers to trash, inbox and done', () => {
    for (const status of ['trash', 'inbox', 'done', 'someday_maybe'] as const) {
      expect(getActiveProjectTask([task('stale', status)], 'stale')).toBeNull()
      expect(getProjectHealth([task('stale', status)])).toBe('missing')
    }
  })
  it('finds another next action when the preferred step is gone', () => {
    const tasks = [task('stale', 'done'), task('real', 'next_actions')]
    expect(getActiveProjectTask(tasks, 'stale')?.id).toBe('real')
    expect(getProjectHealth(tasks)).toBe('actionable')
  })
  it('distinguishes waiting and scheduled commitments from actionable tasks', () => {
    expect(getProjectHealth([task('w', 'waiting_for')])).toBe('waiting')
    expect(getProjectHealth([task('c', 'calendar')])).toBe('scheduled')
    expect(getProjectHealth([task('w', 'waiting_for'), task('n', 'next_actions')])).toBe('actionable')
  })
})
