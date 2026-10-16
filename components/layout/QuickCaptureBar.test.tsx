import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QuickCaptureBar } from './QuickCaptureBar'
import { captureTask } from '@/lib/actions/tasks'
import { updateTaskAttachments } from '@/lib/actions/attachments'

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('@/lib/actions/tasks', () => ({ captureTask: vi.fn() }))
vi.mock('@/lib/actions/attachments', () => ({ updateTaskAttachments: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    storage: { from: () => ({ upload }) },
  }),
}))

function capture(title: string) {
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: title } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('QuickCaptureBar recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(captureTask).mockImplementation(async (_title, id) => ({ id: id! }))
    vi.mocked(updateTaskAttachments).mockResolvedValue(undefined)
    upload.mockResolvedValue({ error: null })
  })

  it('keeps a failed capture without replacing newer input; retry reuses its ID', async () => {
    let rejectRequest!: (error: Error) => void
    vi.mocked(captureTask).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject }))
    render(<QuickCaptureBar />)
    capture('Original thought')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New thought' } })
    await act(async () => { rejectRequest(new Error('Response lost')) })
    expect(screen.getByText('Original thought')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('New thought')
    const [, originalId] = vi.mocked(captureTask).mock.calls[0]
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.queryByText('Original thought')).not.toBeInTheDocument())
    expect(captureTask).toHaveBeenLastCalledWith('Original thought', originalId)
    expect(screen.getByRole('textbox')).toHaveValue('New thought')
  })

  it.each([
    { statusCode: '409', message: 'The resource already exists' },
    { statusCode: '400', message: 'The resource already exists' },
    { statusCode: 'ResourceAlreadyExists', message: 'The resource already exists' },
  ])('retries stable paths after a partial upload ($statusCode)', async (duplicateError) => {
    upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { statusCode: '500' } })
    render(<QuickCaptureBar />)
    const input = document.querySelector('input[type="file"]')!
    fireEvent.change(input, { target: { files: [
      new File(['a'], 'first.txt', { type: 'text/plain' }),
      new File(['b'], 'second.txt', { type: 'text/plain' }),
    ] } })
    capture('With files')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('Task saved. Attachments could not be saved.')
    expect(updateTaskAttachments).not.toHaveBeenCalled()
    const firstPath = upload.mock.calls[0][0]
    // The first upload succeeded before the second failed. Existing files are safe on retry.
    upload.mockResolvedValueOnce({ error: duplicateError }).mockResolvedValueOnce({ error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(updateTaskAttachments).toHaveBeenCalledTimes(1))
    expect(upload.mock.calls[2][0]).toBe(firstPath)
    expect(vi.mocked(captureTask).mock.calls[1][1]).toBe(vi.mocked(captureTask).mock.calls[0][1])
    expect(vi.mocked(updateTaskAttachments).mock.calls[0][1]).toHaveLength(2)
    await waitFor(() => expect(screen.queryByText('With files')).not.toBeInTheDocument())
  })

  it('retains the capture when attachment metadata cannot be saved', async () => {
    vi.mocked(updateTaskAttachments).mockRejectedValueOnce(new Error('DB unavailable'))
    render(<QuickCaptureBar />)
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [new File(['a'], 'file.txt', { type: 'text/plain' })] },
    })
    capture('Keep attachment')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument())
    expect(screen.getByText('Keep attachment')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Task saved.')
  })
})
