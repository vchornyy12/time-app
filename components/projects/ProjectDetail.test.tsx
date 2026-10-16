import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProjectDetail } from './ProjectDetail'
import { addRoughPlanStep, completeFirstStep, promoteRoughPlanItem } from '@/lib/actions/projects'
import type { Project, Task } from '@/lib/types'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/actions/projects', () => ({
  addRoughPlanStep: vi.fn(), completeFirstStep: vi.fn(), promoteRoughPlanItem: vi.fn(),
  completeProject: vi.fn(), reorderRoughPlan: vi.fn(),
}))
const project = {
  id: 'project-1', title: 'Outcome', rough_plan: [{ id: 'step-1', text: 'Planned action', order: 0 }],
  status: 'active', completion_criteria: '', first_step_task_id: null,
} as Project
const firstTask = { id: 'task-1', title: 'Current action', status: 'next_actions', contexts: [], due_date: null } as Pick<Task, 'id' | 'title' | 'status' | 'contexts' | 'due_date'>

describe('project mutation failures', () => {
  beforeEach(() => vi.resetAllMocks())
  it('retains new step text after a failure and reuses the same request ID on retry', async () => {
    vi.mocked(addRoughPlanStep).mockRejectedValueOnce(new Error('Response lost'))
      .mockResolvedValueOnce({ id: 'new-step', text: 'New idea', order: 1 })
    render(<ProjectDetail project={project} firstStepTask={null} />)
    const input = screen.getByRole('textbox', { name: 'Add a new step to the rough plan' })
    fireEvent.change(input, { target: { value: 'New idea' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByRole('alert')
    expect(input).toHaveValue('New idea')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled())
    const firstId = vi.mocked(addRoughPlanStep).mock.calls[0][2]
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(input).toHaveValue(''))
    expect(addRoughPlanStep).toHaveBeenLastCalledWith(project.id, 'New idea', firstId)
    expect(screen.getByText('New idea')).toBeInTheDocument()
  })
  it('does not remove a planned action when promotion fails', async () => {
    vi.mocked(promoteRoughPlanItem).mockRejectedValue(new Error('Could not promote'))
    render(<ProjectDetail project={project} firstStepTask={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Set "Planned action" as next step' }))
    await screen.findByRole('alert')
    expect(screen.getByText('Planned action')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark "Planned action" as done' })).not.toBeInTheDocument()
  })
  it('does not clear the active step when completion fails', async () => {
    vi.mocked(completeFirstStep).mockRejectedValue(new Error('Could not complete'))
    render(<ProjectDetail project={project} firstStepTask={firstTask} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark "Current action" as done' }))
    await screen.findByRole('alert')
    expect(screen.getByText('Current action')).toBeInTheDocument()
  })
  it('keeps a waiting commitment visible and routes resolution through Waiting For', () => {
    render(<ProjectDetail project={project} firstStepTask={{ ...firstTask, status: 'waiting_for' }} />)
    expect(screen.getByRole('button', { name: 'Mark "Current action" as done' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Resolve this item in Waiting For' })).toHaveAttribute('href', '/waiting-for')
  })
})
