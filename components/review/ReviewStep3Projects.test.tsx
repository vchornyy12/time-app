import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReviewStep3Projects } from './ReviewStep3Projects'
import { getReviewProjects, type ReviewProject } from '@/lib/actions/review'
import { promoteRoughPlanItem } from '@/lib/actions/projects'
vi.mock('@/lib/actions/review', () => ({ getReviewProjects: vi.fn() }))
vi.mock('@/lib/actions/projects', () => ({ promoteRoughPlanItem: vi.fn() }))
const project = {
  id: 'project-1', title: 'Outcome', first_step_task_id: 'stale-task',
  rough_plan: [{ id: 'item-1', text: 'Next real step', order: 0 }],
  tasks: [{ id: 'stale-task', status: 'trash' }],
} as ReviewProject

describe('review project health', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(getReviewProjects).mockResolvedValue([project]) })
  it('does not call a trashed pointer a next action, and a failed promotion keeps the plan', async () => {
    vi.mocked(promoteRoughPlanItem).mockRejectedValue(new Error('DB unavailable'))
    render(<ReviewStep3Projects onNext={vi.fn()} />)
    await screen.findByText('No next action')
    fireEvent.click(screen.getByRole('button', { name: 'Promote →' }))
    await waitFor(() => expect(getReviewProjects).toHaveBeenCalledTimes(2))
    expect(screen.getByText(/Next real step/)).toBeInTheDocument()
    expect(screen.queryByText('Next action set')).not.toBeInTheDocument()
  })
  it('reports actual waiting and scheduled commitments without suggesting a duplicate step', async () => {
    vi.mocked(getReviewProjects).mockResolvedValue([
      { ...project, tasks: [{ id: 'actual', status: 'waiting_for' }] },
    ])
    render(<ReviewStep3Projects onNext={vi.fn()} />)
    await screen.findByText('Waiting for response')
    expect(screen.queryByRole('button', { name: 'Promote →' })).not.toBeInTheDocument()
  })
  it('reloads actual tasks after an overlay edit', async () => {
    const { rerender } = render(<ReviewStep3Projects refreshKey={0} onNext={vi.fn()} />)
    await screen.findByText('No next action')
    vi.mocked(getReviewProjects).mockResolvedValue([
      { ...project, tasks: [{ id: 'actual', status: 'next_actions' }] },
    ])
    rerender(<ReviewStep3Projects refreshKey={1} onNext={vi.fn()} />)
    await screen.findByText('Next action set')
  })
})
