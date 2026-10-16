import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TaskList, type TaskWithProject } from './TaskList'
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}))
vi.mock('@/lib/actions/tasks', () => ({ markTaskDone: vi.fn() }))
vi.mock('./TaskCard', () => ({ TaskCard: ({ task }: { task: { title: string } }) => <li>{task.title}</li> }))
vi.mock('./TaskDetailOverlay', () => ({ TaskDetailOverlay: () => null }))
const tasks = [
  { id: '1', title: 'Home task', contexts: ['@home'] },
  { id: '2', title: 'Work task', contexts: ['@work'] },
] as TaskWithProject[]

describe('TaskList URL filters', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/next-actions') })

  it('filters direct links and changes the URL locally while preserving other params', () => {
    window.history.replaceState(null, '', '/next-actions?context=%40home&other=keep#tasks')
    const push = vi.spyOn(window.history, 'pushState')
    const { rerender } = render(<TaskList tasks={tasks} />)
    expect(screen.getByText('Home task')).toBeInTheDocument()
    expect(screen.queryByText('Work task')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '@work' }))
    expect(push).toHaveBeenCalledWith(null, '', '/next-actions?context=%40work&other=keep#tasks')
    rerender(<TaskList tasks={tasks} />)
    expect(screen.getByText('Work task')).toBeInTheDocument()
    expect(screen.queryByText('Home task')).not.toBeInTheDocument()
    push.mockRestore()
  })

  it('shows all tasks when context is removed and follows restored URL state', () => {
    window.history.replaceState(null, '', '/next-actions?context=%40home')
    const { rerender } = render(<TaskList tasks={tasks} />)
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    rerender(<TaskList tasks={tasks} />)
    expect(window.location.search).toBe('')
    expect(screen.getByText('Work task')).toBeInTheDocument()
    window.history.replaceState(null, '', '/next-actions?context=%40home')
    rerender(<TaskList tasks={tasks} />)
    expect(screen.queryByText('Work task')).not.toBeInTheDocument()
  })
})
