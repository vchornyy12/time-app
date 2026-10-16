import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReviewStep2MindSweep } from './ReviewStep2MindSweep'
import { captureTask } from '@/lib/actions/tasks'
vi.mock('@/lib/actions/tasks', () => ({ captureTask: vi.fn() }))

describe('mind sweep recovery', () => {
  beforeEach(() => { vi.resetAllMocks(); window.sessionStorage.clear() })
  it('keeps remaining items and their request IDs across a reload after partial failure', async () => {
    vi.mocked(captureTask).mockResolvedValueOnce({ id: 'first' }).mockRejectedValueOnce(new Error('Response lost'))
    const onNext = vi.fn()
    const { unmount } = render(<ReviewStep2MindSweep userId="user-mind" onNext={onNext} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'First\nSecond' } })
    fireEvent.click(screen.getByRole('button', { name: 'Capture to Inbox →' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('textbox')).toHaveValue('Second')
    expect(onNext).not.toHaveBeenCalled()
    const failedId = vi.mocked(captureTask).mock.calls[1][1]
    unmount()
    vi.mocked(captureTask).mockResolvedValueOnce({ id: failedId! })
    render(<ReviewStep2MindSweep userId="user-mind" onNext={onNext} />)
    expect(screen.getByRole('textbox')).toHaveValue('Second')
    fireEvent.click(screen.getByRole('button', { name: 'Capture to Inbox →' }))
    await waitFor(() => expect(onNext).toHaveBeenCalledOnce())
    expect(captureTask).toHaveBeenLastCalledWith('Second', failedId)
    expect(captureTask).toHaveBeenCalledTimes(3)
  })
  it('validates all lines before creating any tasks', async () => {
    render(<ReviewStep2MindSweep userId="user-long" onNext={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: `Valid\n${'a'.repeat(501)}` } })
    fireEvent.click(screen.getByRole('button', { name: 'Capture to Inbox →' }))
    expect(screen.getByRole('alert')).toHaveTextContent('500 characters')
    expect(captureTask).not.toHaveBeenCalled()
  })
})
