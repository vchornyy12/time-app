import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReviewStep6Summary } from './ReviewStep6Summary'
import { saveWeeklyReviewComplete } from '@/lib/actions/preferences'
const { statsResult, authResult } = vi.hoisted(() => ({ statsResult: vi.fn(), authResult: vi.fn() }))
vi.mock('@/lib/actions/preferences', () => ({ saveWeeklyReviewComplete: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => {
  const query = {
    select: () => query, eq: () => query, gte: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(statsResult()).then(resolve),
  }
  return { auth: { getUser: authResult }, from: () => query }
} }))

describe('weekly review completion', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    statsResult.mockReturnValue({ count: 0, error: null })
    authResult.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    vi.mocked(saveWeeklyReviewComplete).mockResolvedValue(undefined)
  })
  it('never saves a review just because the summary mounted', async () => {
    render(<ReviewStep6Summary onComplete={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Tasks completed')).toBeInTheDocument())
    expect(saveWeeklyReviewComplete).not.toHaveBeenCalled()
    expect(screen.queryByText('Review complete!')).not.toBeInTheDocument()
  })
  it('keeps progress on save failure, then completes only after a successful retry', async () => {
    const onComplete = vi.fn()
    vi.mocked(saveWeeklyReviewComplete).mockRejectedValueOnce(new Error('DB unavailable'))
    render(<ReviewStep6Summary onComplete={onComplete} />)
    fireEvent.click(screen.getByRole('button', { name: 'Finish and save review' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Your review could not be saved'))
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Retry saving review' }))
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(saveWeeklyReviewComplete).toHaveBeenCalledTimes(2)
  })
  it('does not replace failed count queries with made-up zero statistics', async () => {
    statsResult.mockReturnValue({ count: null, error: { message: 'DB unavailable' } })
    render(<ReviewStep6Summary onComplete={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load your summary'))
    expect(screen.queryByText('at zero ✓')).not.toBeInTheDocument()
    statsResult.mockReturnValue({ count: 0, error: null })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry summary' })) })
    expect(screen.getByText('at zero ✓')).toBeInTheDocument()
  })
})
