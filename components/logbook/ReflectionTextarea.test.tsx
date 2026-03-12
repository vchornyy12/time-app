/**
 * ReflectionTextarea component tests
 *
 * Covers:
 *  - Renders a textarea with the initialContent as its value
 *  - Renders the placeholder text when initialContent is empty
 *  - Does NOT call upsertReflection before the debounce delay fires
 *  - Calls upsertReflection with the correct (date, content) after the debounce
 *  - Shows a "Saving…" status indicator while the save is in progress
 *  - Hides the saving indicator after a successful save
 *  - Shows an inline error message when upsertReflection rejects
 *  - Locally typed text is preserved after a save error
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'

// ── Module mocks ───────────────────────────────────────────────

vi.mock('@/lib/actions/logbook', () => ({
  upsertReflection: vi.fn(),
}))

// ── Helpers ────────────────────────────────────────────────────

import { upsertReflection } from '@/lib/actions/logbook'
const mockUpsert = vi.mocked(upsertReflection)

// ── Subject ────────────────────────────────────────────────────

import { ReflectionTextarea } from './ReflectionTextarea'

// ── Tests ──────────────────────────────────────────────────────

describe('ReflectionTextarea', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial rendering', () => {
    it('renders a textarea element', () => {
      render(<ReflectionTextarea date="2025-03-10" initialContent="" />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('displays initialContent as the textarea value', () => {
      render(<ReflectionTextarea date="2025-03-10" initialContent="Today was productive" />)
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe('Today was productive')
    })

    it('renders a placeholder when initialContent is empty', () => {
      render(<ReflectionTextarea date="2025-03-10" initialContent="" />)
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.placeholder).toBeTruthy()
    })
  })

  describe('debounced autosave', () => {
    it('does NOT call upsertReflection immediately after typing', () => {
      render(<ReflectionTextarea date="2025-03-10" initialContent="" />)
      const textarea = screen.getByRole('textbox')

      fireEvent.change(textarea, { target: { value: 'Typing now' } })

      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it('does NOT call upsertReflection before the debounce delay elapses', () => {
      render(<ReflectionTextarea date="2025-03-10" initialContent="" />)
      const textarea = screen.getByRole('textbox')

      fireEvent.change(textarea, { target: { value: 'Typing now' } })
      vi.advanceTimersByTime(500) // less than 800 ms debounce

      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it('calls upsertReflection with the correct date and content after debounce', async () => {
      mockUpsert.mockResolvedValue(undefined)
      render(<ReflectionTextarea date="2025-03-10" initialContent="" />)
      const textarea = screen.getByRole('textbox')

      fireEvent.change(textarea, { target: { value: 'Great day, shipped it!' } })

      await act(async () => {
        vi.advanceTimersByTime(800)
      })

      expect(mockUpsert).toHaveBeenCalledOnce()
      expect(mockUpsert).toHaveBeenCalledWith('2025-03-10', 'Great day, shipped it!')
    })

    it('debounces rapid keystrokes — only calls upsertReflection once after the final keystroke', async () => {
      mockUpsert.mockResolvedValue(undefined)
      render(<ReflectionTextarea date="2025-03-10" initialContent="" />)
      const textarea = screen.getByRole('textbox')

      fireEvent.change(textarea, { target: { value: 'A' } })
      vi.advanceTimersByTime(200)
      fireEvent.change(textarea, { target: { value: 'AB' } })
      vi.advanceTimersByTime(200)
      fireEvent.change(textarea, { target: { value: 'ABC' } })

      await act(async () => {
        vi.advanceTimersByTime(800)
      })

      expect(mockUpsert).toHaveBeenCalledOnce()
      expect(mockUpsert).toHaveBeenCalledWith('2025-03-10', 'ABC')
    })
  })

  describe('saving indicator', () => {
    it('shows a saving indicator while upsertReflection is in-flight', async () => {
      let resolveSave!: () => void
      mockUpsert.mockReturnValue(new Promise<void>((res) => { resolveSave = res }))

      render(<ReflectionTextarea date="2025-03-10" initialContent="" />)
      const textarea = screen.getByRole('textbox')

      // Use a value that does NOT match /saving/i to avoid ambiguity
      fireEvent.change(textarea, { target: { value: 'In progress...' } })

      await act(async () => {
        vi.advanceTimersByTime(800)
      })

      // While the promise is pending, the saving indicator (role="status") is visible
      expect(screen.getByRole('status')).toBeInTheDocument()

      // Resolve to clean up
      await act(async () => { resolveSave() })
    })

    it('hides the saving indicator after a successful save', async () => {
      mockUpsert.mockResolvedValue(undefined)
      render(<ReflectionTextarea date="2025-03-10" initialContent="" />)
      const textarea = screen.getByRole('textbox')

      fireEvent.change(textarea, { target: { value: 'Done' } })

      await act(async () => {
        vi.advanceTimersByTime(800)
      })

      // mockResolvedValue settles in the microtask queue inside act — no waitFor needed
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('shows an inline error message when upsertReflection rejects', async () => {
      mockUpsert.mockRejectedValue(new Error('Network error'))
      render(<ReflectionTextarea date="2025-03-10" initialContent="" />)
      const textarea = screen.getByRole('textbox')

      fireEvent.change(textarea, { target: { value: 'Will fail' } })

      await act(async () => {
        vi.advanceTimersByTime(800)
      })

      // mockRejectedValue is caught synchronously within act — no waitFor needed
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('preserves the locally typed text after a save error', async () => {
      mockUpsert.mockRejectedValue(new Error('Network error'))
      render(<ReflectionTextarea date="2025-03-10" initialContent="" />)
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

      fireEvent.change(textarea, { target: { value: 'My important note' } })

      await act(async () => {
        vi.advanceTimersByTime(800)
      })

      // Rejection handled within act — text is preserved, error shown
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(textarea.value).toBe('My important note')
    })
  })
})
