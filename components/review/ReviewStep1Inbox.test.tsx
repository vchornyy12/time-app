import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReviewStep1Inbox } from './ReviewStep1Inbox'
import { getReviewInboxCount } from '@/lib/actions/review'
vi.mock('@/lib/actions/review', () => ({ getReviewInboxCount: vi.fn() }))
describe('review inbox state', () => {
  beforeEach(() => vi.resetAllMocks())
  it('requires an explicit decision to leave items and refreshes on return from Inbox', async () => {
    const onNext = vi.fn()
    vi.mocked(getReviewInboxCount).mockResolvedValueOnce(3).mockResolvedValueOnce(0)
    render(<ReviewStep1Inbox onNext={onNext} />)
    await screen.findByText('Continue with 3 items to process later')
    expect(screen.getByRole('button', { name: 'Continue with remaining items →' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button', { name: 'Continue with remaining items →' })).toBeEnabled()
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(screen.getByRole('button', { name: 'Continue →' })).toBeEnabled()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
    expect(onNext).toHaveBeenCalledOnce()
  })
  it('cannot treat a failed check as an empty inbox', async () => {
    vi.mocked(getReviewInboxCount).mockRejectedValue(new Error('Offline'))
    render(<ReviewStep1Inbox onNext={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Continue →' })).toBeDisabled()
  })
})
