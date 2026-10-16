import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReviewStep2WaitingFor } from './ReviewStep2WaitingFor'
import { ReviewStep4NextActions } from './ReviewStep4NextActions'
import { ReviewStep5SomedayMaybe } from './ReviewStep5SomedayMaybe'
import { getReviewTasks } from '@/lib/actions/review'
import { markTaskDone, moveToNextActions, updateSomedayReviewDate } from '@/lib/actions/tasks'
import type { Task } from '@/lib/types'
vi.mock('@/lib/actions/review', () => ({ getReviewTasks: vi.fn() }))
vi.mock('@/lib/actions/tasks', () => ({
  markTaskDone: vi.fn(), moveToNextActions: vi.fn(), deleteTask: vi.fn(), updateSomedayReviewDate: vi.fn(),
}))
vi.mock('@/lib/actions/processing', () => ({ processToSomedayMaybe: vi.fn() }))
const task = { id: 'task-1', title: 'Keep this item', contexts: [], due_date: '2026-11-01' } as unknown as Task

describe('review list failures', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(getReviewTasks).mockResolvedValue([task]) })
  it.each([
    { View: ReviewStep2WaitingFor, action: markTaskDone, label: 'Mark "Keep this item" as done' },
    { View: ReviewStep4NextActions, action: markTaskDone, label: 'Mark "Keep this item" as done' },
    { View: ReviewStep5SomedayMaybe, action: moveToNextActions, label: 'Activate "Keep this item"' },
  ])('keeps an item when its $label action fails and allows retry', async ({ View, action, label }) => {
    vi.mocked(action).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(undefined)
    render(<View onNext={vi.fn()} />)
    await screen.findByText('Keep this item')
    fireEvent.click(screen.getByRole('button', { name: label }))
    await screen.findByRole('alert')
    expect(screen.getByText('Keep this item')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: label })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: label }))
    await waitFor(() => expect(screen.queryByText('Keep this item')).not.toBeInTheDocument())
  })
  it('distinguishes a failed list query from an empty list', async () => {
    vi.mocked(getReviewTasks).mockRejectedValueOnce(new Error('No connection'))
    render(<ReviewStep2WaitingFor onNext={vi.fn()} />)
    await screen.findByRole('alert')
    expect(screen.queryByText('No waiting-for items.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh list' }))
    await screen.findByText('Keep this item')
  })
  it('clears a review date explicitly and keeps the editor when saving fails', async () => {
    vi.mocked(updateSomedayReviewDate).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(undefined)
    render(<ReviewStep5SomedayMaybe onNext={vi.fn()} />)
    await screen.findByText('Keep this item')
    fireEvent.click(screen.getByRole('button', { name: 'Update review date for "Keep this item"' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear date' }))
    await screen.findByRole('alert')
    expect(updateSomedayReviewDate).toHaveBeenCalledWith(task.id, null)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clear date' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Clear date' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument())
  })
})
