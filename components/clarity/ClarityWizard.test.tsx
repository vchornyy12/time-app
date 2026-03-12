/**
 * ClarityWizard component tests — Wizard state machine + UI disclosure
 *
 * Covers:
 *  Initial render:
 *   - Step 1 heading is visible on mount
 *   - Steps 2, 3, and 4 are NOT rendered on mount (no skipping possible)
 *
 *  Step 1 (Worry):
 *   - "Next →" CTA is disabled when the textarea is empty
 *   - "Next →" CTA is enabled after typing into the textarea
 *   - Clicking "Next →" with content transitions to Step 2
 *
 *  Step 2 (Worst Case):
 *   - Step 2 heading is visible after advancing from Step 1
 *   - Step 1 is no longer rendered after advancing (no going back by default)
 *   - "Next →" CTA is disabled when the textarea is empty
 *   - "Next →" CTA is enabled after typing
 *   - Clicking "Next →" with content transitions to Step 3
 *
 *  Step 3 (Acceptance):
 *   - Step 3 heading is visible after advancing from Step 2
 *   - The worst case text entered in Step 2 is displayed
 *   - "I Accept →" CTA is disabled when the checkbox is unchecked
 *   - Checking the checkbox enables the "I Accept →" CTA
 *   - Clicking "I Accept →" transitions to Step 4
 *
 *  Step 4 (Action):
 *   - Step 4 heading is visible after advancing from Step 3
 *   - "Add to Inbox →" CTA is disabled when the input is empty
 *   - "Add to Inbox →" CTA is enabled after typing
 *   - Submitting calls submitClaritySession with the correct three fields
 *   - The CTA is disabled while the action is in-flight (prevents double-submit)
 *   - The Success Screen is shown after the action resolves
 *   - An error message is rendered below the CTA when the action rejects
 *   - The action input text is preserved after a server error
 *
 *  Success Screen:
 *   - "Mind cleared." heading is visible
 *   - "Go to Inbox →" link points to /inbox
 *   - "Start Again" button resets the wizard back to Step 1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'

// ── Module mocks (declared before subject import) ──────────────

vi.mock('@/lib/actions/clarity', () => ({
  submitClaritySession: vi.fn(),
}))

// ── Helpers ────────────────────────────────────────────────────

import { submitClaritySession } from '@/lib/actions/clarity'
const mockSubmit = vi.mocked(submitClaritySession)

const WORRY = 'I might lose my job'
const WORST_CASE = 'I get fired and cannot pay rent'
const ACTION = 'Update my CV today'

/**
 * Advances the wizard from Step 1 through to the given target step.
 * Assumes all previous steps have their fields filled correctly.
 */
async function advanceToStep(target: 2 | 3 | 4) {
  // Step 1 → 2
  fireEvent.change(screen.getByRole('textbox', { name: /worrying/i }), {
    target: { value: WORRY },
  })
  fireEvent.click(screen.getByRole('button', { name: /next/i }))
  if (target === 2) return

  // Step 2 → 3
  fireEvent.change(screen.getByRole('textbox', { name: /worst/i }), {
    target: { value: WORST_CASE },
  })
  fireEvent.click(screen.getByRole('button', { name: /next/i }))
  if (target === 3) return

  // Step 3 → 4
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: /i accept/i }))
}

// ── Subject (imported after mocks) ─────────────────────────────

import { ClarityWizard } from './ClarityWizard'

// ── Tests ──────────────────────────────────────────────────────

describe('ClarityWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Initial render ──────────────────────────────────────────

  describe('initial render', () => {
    it('shows the Step 1 heading on mount', () => {
      render(<ClarityWizard />)
      expect(
        screen.getByText(/what are you worrying about right now/i),
      ).toBeInTheDocument()
    })

    it('does NOT render the Step 2 heading on mount', () => {
      render(<ClarityWizard />)
      expect(
        screen.queryByText(/absolute worst thing that could happen/i),
      ).not.toBeInTheDocument()
    })

    it('does NOT render the Step 3 heading on mount', () => {
      render(<ClarityWizard />)
      expect(
        screen.queryByText(/accept the worst/i),
      ).not.toBeInTheDocument()
    })

    it('does NOT render the Step 4 heading on mount', () => {
      render(<ClarityWizard />)
      expect(
        screen.queryByText(/now improve upon it/i),
      ).not.toBeInTheDocument()
    })
  })

  // ── Step 1 ──────────────────────────────────────────────────

  describe('Step 1 — Worry', () => {
    it('"Next →" is disabled when the textarea is empty', () => {
      render(<ClarityWizard />)
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    })

    it('"Next →" is enabled after typing in the textarea', () => {
      render(<ClarityWizard />)
      fireEvent.change(screen.getByRole('textbox', { name: /worrying/i }), {
        target: { value: WORRY },
      })
      expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled()
    })

    it('advances to Step 2 after clicking "Next →" with content', () => {
      render(<ClarityWizard />)
      fireEvent.change(screen.getByRole('textbox', { name: /worrying/i }), {
        target: { value: WORRY },
      })
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      expect(
        screen.getByText(/absolute worst thing that could happen/i),
      ).toBeInTheDocument()
    })
  })

  // ── Step 2 ──────────────────────────────────────────────────

  describe('Step 2 — Worst Case', () => {
    beforeEach(() => {
      render(<ClarityWizard />)
      advanceToStep(2)
    })

    it('shows the Step 2 heading', () => {
      expect(
        screen.getByText(/absolute worst thing that could happen/i),
      ).toBeInTheDocument()
    })

    it('no longer renders the Step 1 textarea', () => {
      // Step 1 textarea (labelled with "worrying") should be gone
      expect(
        screen.queryByRole('textbox', { name: /worrying/i }),
      ).not.toBeInTheDocument()
    })

    it('"Next →" is disabled when the Step 2 textarea is empty', () => {
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    })

    it('"Next →" is enabled after typing into the Step 2 textarea', () => {
      fireEvent.change(screen.getByRole('textbox', { name: /worst/i }), {
        target: { value: WORST_CASE },
      })
      expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled()
    })

    it('advances to Step 3 after clicking "Next →" with content', () => {
      fireEvent.change(screen.getByRole('textbox', { name: /worst/i }), {
        target: { value: WORST_CASE },
      })
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      expect(screen.getByText(/accept the worst/i)).toBeInTheDocument()
    })
  })

  // ── Step 3 ──────────────────────────────────────────────────

  describe('Step 3 — Acceptance', () => {
    beforeEach(async () => {
      render(<ClarityWizard />)
      await advanceToStep(3)
    })

    it('shows the Step 3 heading', () => {
      expect(screen.getByText(/accept the worst/i)).toBeInTheDocument()
    })

    it('displays the worst-case text entered in Step 2', () => {
      expect(screen.getByText(WORST_CASE)).toBeInTheDocument()
    })

    it('"I Accept →" is disabled when the checkbox is unchecked', () => {
      expect(screen.getByRole('button', { name: /i accept/i })).toBeDisabled()
    })

    it('"I Accept →" is enabled after checking the checkbox', () => {
      fireEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByRole('button', { name: /i accept/i })).not.toBeDisabled()
    })

    it('advances to Step 4 after checking the checkbox and clicking "I Accept →"', () => {
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: /i accept/i }))
      expect(screen.getByText(/now improve upon it/i)).toBeInTheDocument()
    })
  })

  // ── Step 4 ──────────────────────────────────────────────────

  describe('Step 4 — Action', () => {
    beforeEach(async () => {
      render(<ClarityWizard />)
      await advanceToStep(4)
    })

    it('shows the Step 4 heading', () => {
      expect(screen.getByText(/now improve upon it/i)).toBeInTheDocument()
    })

    it('"Add to Inbox →" is disabled when the input is empty', () => {
      expect(screen.getByRole('button', { name: /add to inbox/i })).toBeDisabled()
    })

    it('"Add to Inbox →" is enabled after typing an action', () => {
      fireEvent.change(screen.getByRole('textbox', { name: /action/i }), {
        target: { value: ACTION },
      })
      expect(screen.getByRole('button', { name: /add to inbox/i })).not.toBeDisabled()
    })

    it('calls submitClaritySession with the correct three fields on submit', async () => {
      mockSubmit.mockResolvedValue({ sessionId: 'sess-1', taskId: 'task-1' })

      fireEvent.change(screen.getByRole('textbox', { name: /action/i }), {
        target: { value: ACTION },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /add to inbox/i }))
      })

      expect(mockSubmit).toHaveBeenCalledOnce()
      expect(mockSubmit).toHaveBeenCalledWith({
        worryDescription: WORRY,
        worstCaseScenario: WORST_CASE,
        actionTitle: ACTION,
      })
    })

    it('disables the "Add to Inbox →" button while the action is in-flight', async () => {
      let resolveSubmit!: () => void
      mockSubmit.mockReturnValue(
        new Promise<{ sessionId: string; taskId: string }>((res) => {
          resolveSubmit = () => res({ sessionId: 'sess-1', taskId: 'task-1' })
        }),
      )

      fireEvent.change(screen.getByRole('textbox', { name: /action/i }), {
        target: { value: ACTION },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /add to inbox/i }))
      })

      // Button should be disabled while pending
      expect(screen.getByRole('button', { name: /add to inbox/i })).toBeDisabled()

      // Resolve to clean up
      await act(async () => { resolveSubmit() })
    })

    it('shows the Success Screen after the action resolves', async () => {
      mockSubmit.mockResolvedValue({ sessionId: 'sess-1', taskId: 'task-1' })

      fireEvent.change(screen.getByRole('textbox', { name: /action/i }), {
        target: { value: ACTION },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /add to inbox/i }))
      })

      expect(screen.getByText(/mind cleared/i)).toBeInTheDocument()
    })

    it('shows an error message when the action rejects', async () => {
      mockSubmit.mockRejectedValue(new Error('DB error'))

      fireEvent.change(screen.getByRole('textbox', { name: /action/i }), {
        target: { value: ACTION },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /add to inbox/i }))
      })

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('preserves the action input text after a server error', async () => {
      mockSubmit.mockRejectedValue(new Error('DB error'))

      fireEvent.change(screen.getByRole('textbox', { name: /action/i }), {
        target: { value: ACTION },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /add to inbox/i }))
      })

      expect((screen.getByRole('textbox', { name: /action/i }) as HTMLInputElement).value).toBe(ACTION)
    })
  })

  // ── Success Screen ───────────────────────────────────────────

  describe('Success Screen', () => {
    beforeEach(async () => {
      mockSubmit.mockResolvedValue({ sessionId: 'sess-1', taskId: 'task-1' })
      render(<ClarityWizard />)
      await advanceToStep(4)

      fireEvent.change(screen.getByRole('textbox', { name: /action/i }), {
        target: { value: ACTION },
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /add to inbox/i }))
      })
    })

    it('shows "Mind cleared." heading', () => {
      expect(screen.getByText(/mind cleared/i)).toBeInTheDocument()
    })

    it('"Go to Inbox →" is a link pointing to /inbox', () => {
      const link = screen.getByRole('link', { name: /go to inbox/i })
      expect(link).toHaveAttribute('href', '/inbox')
    })

    it('"Start Again" button resets the wizard to Step 1', () => {
      fireEvent.click(screen.getByRole('button', { name: /start again/i }))
      expect(
        screen.getByText(/what are you worrying about right now/i),
      ).toBeInTheDocument()
    })
  })
})
