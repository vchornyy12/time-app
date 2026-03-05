/**
 * InboxList component tests
 *
 * Covers:
 *  - Empty-state rendering
 *  - Task list rendering
 *  - Concurrent-mode safe new-task detection via useEffect (not render)
 *  - isNew flag propagation to InboxItem
 *  - Delete flow: confirm modal → optimistic removal → toast
 *  - Undo (restore) flow
 *  - Process overlay open/close
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'

// ── Module mocks ──────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/lib/actions/tasks', () => ({
  deleteTask: vi.fn().mockResolvedValue(undefined),
  restoreTask: vi.fn().mockResolvedValue(undefined),
}))

// Stub heavy child components to isolate InboxList logic
vi.mock('./InboxItem', () => ({
  InboxItem: ({
    task,
    onDelete,
    onProcess,
    onTitleClick,
    isNew,
  }: {
    task: { id: string; title: string }
    onDelete: () => void
    onProcess: () => void
    onTitleClick: () => void
    isNew: boolean
  }) => (
    <li data-testid={`inbox-item-${task.id}`} data-is-new={String(isNew)}>
      <span>{task.title}</span>
      <button onClick={onDelete} data-testid={`delete-${task.id}`}>Delete</button>
      <button onClick={onProcess} data-testid={`process-${task.id}`}>Process</button>
      <button onClick={onTitleClick} data-testid={`detail-${task.id}`}>Detail</button>
    </li>
  ),
}))

vi.mock('./ProcessingOverlay', () => ({
  ProcessingOverlay: ({ task, onClose }: { task: { id: string; title: string }; onClose: () => void }) => (
    <div data-testid="processing-overlay">
      <span>{task.title}</span>
      <button onClick={onClose} data-testid="close-processing">Close</button>
    </div>
  ),
}))

vi.mock('./TaskDetailOverlay', () => ({
  TaskDetailOverlay: ({ taskId, onClose }: { taskId: string | null; onClose: () => void }) =>
    taskId ? (
      <div data-testid="detail-overlay">
        <button onClick={onClose}>Close Detail</button>
      </div>
    ) : null,
}))

vi.mock('@/components/ui', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
  Toast: ({
    message,
    onUndo,
    onDismiss,
  }: {
    message: string
    onUndo: () => void
    onDismiss: () => void
  }) => (
    <div data-testid="toast">
      <span>{message}</span>
      <button onClick={onUndo} data-testid="undo-btn">Undo</button>
      <button onClick={onDismiss} data-testid="dismiss-btn">Dismiss</button>
    </div>
  ),
  ConfirmDeleteModal: ({
    open,
    taskTitle,
    onConfirm,
    onCancel,
  }: {
    open: boolean
    taskTitle: string
    onConfirm: () => void
    onCancel: () => void
  }) =>
    open ? (
      <div data-testid="confirm-modal">
        <span>{taskTitle}</span>
        <button onClick={onConfirm} data-testid="confirm-delete">Confirm</button>
        <button onClick={onCancel} data-testid="cancel-delete">Cancel</button>
      </div>
    ) : null,
}))

// ── Helpers ───────────────────────────────────────────────────
import type { Task } from '@/lib/types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-uuid-1',
    title: 'Buy milk',
    status: 'inbox',
    user_id: 'user-1',
    project_id: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    scheduled_at: null,
    due_date: null,
    delegated_to: null,
    is_delegation_communicated: false,
    google_calendar_event_id: null,
    contexts: [],
    completed_at: null,
    attachments: [],
    ...overrides,
  }
}

// Import subject AFTER mocks are declared
import { InboxList } from './InboxList'

// ── Tests ─────────────────────────────────────────────────────
describe('InboxList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('empty state', () => {
    it('renders the empty state when no tasks are provided', () => {
      render(<InboxList tasks={[]} />)
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })

    it('shows the correct empty-state heading', () => {
      render(<InboxList tasks={[]} />)
      expect(screen.getByText('Your mind is clear.')).toBeInTheDocument()
    })

    it('does not render the task list when tasks are empty', () => {
      render(<InboxList tasks={[]} />)
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
    })
  })

  describe('task list rendering', () => {
    it('renders an accessible list for non-empty tasks', () => {
      const tasks = [makeTask()]
      render(<InboxList tasks={tasks} />)
      expect(screen.getByRole('list', { name: 'Inbox tasks' })).toBeInTheDocument()
    })

    it('renders one item per task', () => {
      const tasks = [
        makeTask({ id: 'id-1', title: 'Task one' }),
        makeTask({ id: 'id-2', title: 'Task two' }),
      ]
      render(<InboxList tasks={tasks} />)
      expect(screen.getByTestId('inbox-item-id-1')).toBeInTheDocument()
      expect(screen.getByTestId('inbox-item-id-2')).toBeInTheDocument()
    })

    it('does not render the empty state when tasks exist', () => {
      render(<InboxList tasks={[makeTask()]} />)
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()
    })
  })

  describe('isNew flag', () => {
    it('marks existing tasks as not-new on initial render', () => {
      const task = makeTask({ id: 'existing-id' })
      render(<InboxList tasks={[task]} />)
      expect(screen.getByTestId('inbox-item-existing-id').dataset.isNew).toBe('false')
    })

    it('marks newly added tasks as new after re-render', async () => {
      const initial = [makeTask({ id: 'old-id', title: 'Old' })]
      const { rerender } = render(<InboxList tasks={initial} />)

      const newTask = makeTask({ id: 'brand-new-id', title: 'New arrival' })
      rerender(<InboxList tasks={[...initial, newTask]} />)

      // useEffect fires after paint — wait for state update
      await waitFor(() => {
        expect(screen.getByTestId('inbox-item-brand-new-id').dataset.isNew).toBe('true')
      })
    })

    it('does not mark previously seen tasks as new on re-render with same list', async () => {
      const tasks = [makeTask({ id: 'stable-id' })]
      const { rerender } = render(<InboxList tasks={tasks} />)
      rerender(<InboxList tasks={tasks} />)
      await act(async () => {})
      expect(screen.getByTestId('inbox-item-stable-id').dataset.isNew).toBe('false')
    })
  })

  describe('delete flow', () => {
    it('opens the confirm modal when delete is clicked', () => {
      const task = makeTask({ id: 'del-task', title: 'Delete me' })
      render(<InboxList tasks={[task]} />)

      fireEvent.click(screen.getByTestId('delete-del-task'))
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument()
      expect(screen.getByText('Delete me')).toBeInTheDocument()
    })

    it('closes the confirm modal on cancel', () => {
      const task = makeTask({ id: 'del-task', title: 'Delete me' })
      render(<InboxList tasks={[task]} />)

      fireEvent.click(screen.getByTestId('delete-del-task'))
      fireEvent.click(screen.getByTestId('cancel-delete'))
      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument()
    })

    it('shows a toast after confirming delete', async () => {
      const task = makeTask({ id: 'del-task', title: 'Delete me' })
      render(<InboxList tasks={[task]} />)

      fireEvent.click(screen.getByTestId('delete-del-task'))
      fireEvent.click(screen.getByTestId('confirm-delete'))

      await waitFor(() => {
        expect(screen.getByTestId('toast')).toBeInTheDocument()
      })
    })

    it('truncates long task titles in the toast to 40 chars + ellipsis', async () => {
      const longTitle = 'A'.repeat(60)
      const task = makeTask({ id: 'long-task', title: longTitle })
      render(<InboxList tasks={[task]} />)

      fireEvent.click(screen.getByTestId('delete-long-task'))
      fireEvent.click(screen.getByTestId('confirm-delete'))

      await waitFor(() => {
        const toast = screen.getByTestId('toast')
        expect(toast.textContent).toContain('A'.repeat(40) + '…')
      })
    })

    it('does not truncate titles of 40 chars or fewer', async () => {
      const task = makeTask({ id: 'short-task', title: 'Short title' })
      render(<InboxList tasks={[task]} />)

      fireEvent.click(screen.getByTestId('delete-short-task'))
      fireEvent.click(screen.getByTestId('confirm-delete'))

      await waitFor(() => {
        expect(screen.getByTestId('toast').textContent).toContain('Short title')
      })
    })
  })

  describe('undo (restore) flow', () => {
    it('dismisses the toast when Dismiss is clicked', async () => {
      const task = makeTask({ id: 'dismiss-task', title: 'Dismiss me' })
      render(<InboxList tasks={[task]} />)

      fireEvent.click(screen.getByTestId('delete-dismiss-task'))
      fireEvent.click(screen.getByTestId('confirm-delete'))

      await waitFor(() => screen.getByTestId('toast'))
      fireEvent.click(screen.getByTestId('dismiss-btn'))
      expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
    })

    it('calls restoreTask and hides toast when Undo is clicked', async () => {
      const { restoreTask } = await import('@/lib/actions/tasks')
      const task = makeTask({ id: 'undo-task', title: 'Undo me' })
      render(<InboxList tasks={[task]} />)

      fireEvent.click(screen.getByTestId('delete-undo-task'))
      fireEvent.click(screen.getByTestId('confirm-delete'))

      await waitFor(() => screen.getByTestId('toast'))
      fireEvent.click(screen.getByTestId('undo-btn'))

      await waitFor(() => {
        expect(restoreTask).toHaveBeenCalledWith('undo-task')
      })
      expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
    })
  })

  describe('processing overlay', () => {
    it('opens the processing overlay when Process is clicked', () => {
      const task = makeTask({ id: 'proc-task', title: 'Process me' })
      render(<InboxList tasks={[task]} />)

      fireEvent.click(screen.getByTestId('process-proc-task'))
      expect(screen.getByTestId('processing-overlay')).toBeInTheDocument()
    })

    it('closes the processing overlay when its close button is clicked', () => {
      const task = makeTask({ id: 'proc-task', title: 'Process me' })
      render(<InboxList tasks={[task]} />)

      fireEvent.click(screen.getByTestId('process-proc-task'))
      fireEvent.click(screen.getByTestId('close-processing'))
      expect(screen.queryByTestId('processing-overlay')).not.toBeInTheDocument()
    })
  })

  describe('task detail overlay', () => {
    it('opens the detail overlay when the title is clicked', () => {
      const task = makeTask({ id: 'detail-task', title: 'Detail me' })
      render(<InboxList tasks={[task]} />)

      fireEvent.click(screen.getByTestId('detail-detail-task'))
      expect(screen.getByTestId('detail-overlay')).toBeInTheDocument()
    })
  })
})
