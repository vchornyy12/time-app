import { test as base, expect, type Page } from '@playwright/test'

interface TaskHandle {
  title: string
  cleanup: () => Promise<void>
}

interface GTDFixtures {
  captureTask: (title: string) => Promise<TaskHandle>
}

export const test = base.extend<GTDFixtures>({
  captureTask: async ({ page }, use) => {
    const created: string[] = []

    const captureTask = async (title: string): Promise<TaskHandle> => {
      await page.goto('/inbox')
      const captureInput = page.getByLabel('Quick capture — press Enter to add')
      await captureInput.fill(title)
      await captureInput.press('Enter')
      // exact: true — the title button's accessible name is EXACTLY the task title.
      // Without exact, the Process/Delete buttons (whose aria-labels contain the title
      // as a substring) would also match, causing a strict-mode timeout.
      await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible({
        timeout: 8_000,
      })
      created.push(title)
      return { title, cleanup: () => deleteFromInbox(page, title) }
    }

    await use(captureTask)

    for (const title of created) {
      try {
        await page.goto('/inbox')
        await deleteFromInbox(page, title)
      } catch {
        // best-effort — don't fail the test on cleanup errors
      }
    }
  },
})

export { expect }

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Hover the task row to reveal the opacity-0 action buttons, then delete.
 *
 * Uses exact: true on the title button to avoid matching the Delete/Process
 * buttons (which both contain the title as a substring in their aria-labels).
 */
export async function deleteFromInbox(page: Page, title: string): Promise<void> {
  const titleBtn = page.getByRole('button', { name: title, exact: true })
  if (!(await titleBtn.isVisible({ timeout: 2_000 }))) return

  // Use evaluate to click the opacity-0 delete button directly, bypassing CSS visibility checks
  await page.locator(`button[aria-label='Delete "${title}"']`).evaluate(el => (el as HTMLElement).click())
  await page.getByRole('button', { name: 'Move to Trash' }).click()
}
