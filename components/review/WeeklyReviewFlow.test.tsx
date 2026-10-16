import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { WeeklyReviewFlow } from './WeeklyReviewFlow'
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/components/ui', () => ({ ResponsiveOverlay: () => null }))
vi.mock('@/components/tasks/TaskDetailPanel', () => ({ TaskDetailPanel: () => null }))
vi.mock('@/components/projects/ProjectDetailPanel', () => ({ ProjectDetailPanel: () => null }))
vi.mock('./ReviewStep2MindSweep', () => ({ ReviewStep2MindSweep: ({ onNext }: { onNext: () => void }) => <button onClick={onNext}>Capture thoughts</button> }))
vi.mock('./ReviewStep1Inbox', () => ({ ReviewStep1Inbox: ({ onNext }: { onNext: () => void }) => <button onClick={onNext}>Process captured inbox</button> }))
vi.mock('./ReviewStep2WaitingFor', () => ({ ReviewStep2WaitingFor: ({ onNext }: { onNext: () => void }) => <button onClick={onNext}>Waiting checked</button> }))
vi.mock('./ReviewStep3Projects', () => ({ ReviewStep3Projects: ({ onNext }: { onNext: () => void }) => <button onClick={onNext}>Projects checked</button> }))
vi.mock('./ReviewStep4NextActions', () => ({ ReviewStep4NextActions: ({ onNext }: { onNext: () => void }) => <button onClick={onNext}>Actions checked</button> }))
vi.mock('./ReviewStep5SomedayMaybe', () => ({ ReviewStep5SomedayMaybe: ({ onNext }: { onNext: () => void }) => <button onClick={onNext}>Someday checked</button> }))
vi.mock('./ReviewStep6Summary', () => ({ ReviewStep6Summary: ({ onComplete }: { onComplete: () => void }) => <button onClick={onComplete}>Confirm saved review</button> }))

describe('weekly review progress', () => {
  beforeEach(() => { window.localStorage.clear(); vi.clearAllMocks() })
  afterEach(() => vi.restoreAllMocks())
  it('collects thoughts before processing and only clears progress after completion', () => {
    render(<WeeklyReviewFlow userId="user-order" lastReviewDate={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start Weekly Review →' }))
    expect(screen.getByRole('heading', { name: 'Mind Sweep' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Capture thoughts' }))
    expect(screen.getByRole('heading', { name: 'Process Inbox' })).toBeInTheDocument()
    for (const name of ['Process captured inbox', 'Waiting checked', 'Projects checked', 'Actions checked', 'Someday checked']) {
      fireEvent.click(screen.getByRole('button', { name }))
    }
    expect(window.localStorage.getItem('weekly-review:v2:user-order')).toBe('7')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm saved review' }))
    expect(window.localStorage.getItem('weekly-review:v2:user-order')).toBeNull()
    expect(push).toHaveBeenCalledWith('/inbox')
  })
  it('resumes after leaving and scopes progress to the signed-in user', () => {
    window.localStorage.setItem('weekly-review:v2:user-a', '4')
    const { unmount } = render(<WeeklyReviewFlow userId="user-a" lastReviewDate={null} />)
    expect(screen.getByRole('heading', { name: 'Review Projects' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Exit weekly review' }))
    expect(window.localStorage.getItem('weekly-review:v2:user-a')).toBe('4')
    unmount()
    render(<WeeklyReviewFlow userId="user-b" lastReviewDate={null} />)
    expect(screen.getByRole('button', { name: 'Start Weekly Review →' })).toBeInTheDocument()
  })
  it('still works if the browser refuses storage writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage denied') })
    render(<WeeklyReviewFlow userId="user-private" lastReviewDate={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start Weekly Review →' }))
    expect(screen.getByRole('heading', { name: 'Mind Sweep' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Capture thoughts' }))
    expect(screen.getByRole('heading', { name: 'Process Inbox' })).toBeInTheDocument()
  })
})
