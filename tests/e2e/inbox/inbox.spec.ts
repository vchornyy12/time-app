import { test, expect } from '../fixtures'
import type { Page } from '@playwright/test'

test.describe('Inbox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inbox')
    await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
  })

  test('renders inbox page with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
  })

  test('captures a task via QuickCaptureBar and it appears in inbox', async ({
    page,
    captureTask,
  }) => {
    const task = await captureTask('E2E test — capture')
    await expect(page.getByRole('button', { name: task.title, exact: true })).toBeVisible()
    await task.cleanup()
  })

  test('empty capture input does not submit', async ({ page }) => {
    const before = await page.locator('li').count()
    await page.getByLabel('Quick capture — press Enter to add').fill('')
    await page.keyboard.press('Enter')
    expect(await page.locator('li').count()).toBe(before)
  })

  test('opens task detail overlay when clicking a task title', async ({ page, captureTask }) => {
    const task = await captureTask('E2E test — detail view')
    // exact: true to avoid matching Delete/Process buttons that contain the title
    await page.getByRole('button', { name: task.title, exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await task.cleanup()
  })

  test('deletes a task via ConfirmDeleteModal', async ({ page, captureTask }) => {
    const task = await captureTask('E2E test — delete me')
    await page.locator(`button[aria-label='Delete "${task.title}"']`).evaluate(el => (el as HTMLElement).click())
    await expect(page.getByText('Move to Trash?')).toBeVisible()
    await page.getByRole('button', { name: 'Move to Trash' }).click()
    await expect(page.getByRole('button', { name: task.title, exact: true })).not.toBeVisible({
      timeout: 5_000,
    })
  })

  test('shows item count in heading area', async ({ page, captureTask }) => {
    const task = await captureTask('E2E test — count badge')
    await expect(page.getByText(/\d+ items?/)).toBeVisible()
    await task.cleanup()
  })
})

// ── GTD Processing ────────────────────────────────────────────────────────────
//
// ProcessingOverlay step button texts:
//   Step 1  "Is this actionable?"               → "Yes" / "No"
//   Step 2  "Can you do this in 2 minutes?"     → "Yes — do it now ✓" / "No — keep processing"
//   Step 3  "Is this yours to do?"              → "Yes" / "No — I'm waiting on someone"
//   Step 4  "Does this have a specific date?"   → ChoiceButtons (emoji prefix + label)
//   Step 5  "Can this be done in a single step?"→ "Yes" / "No — it's a Project"
//   Step 6b "What's the next physical action?"  → "Add to Next Actions →"

test.describe('Inbox — GTD processing', () => {
  /** Click the hidden Process button via DOM evaluate, then wait for the dialog. */
  async function openProcessing(page: Page, taskTitle: string) {
    // Use evaluate to click the opacity-0 process button directly, bypassing CSS visibility checks
    await page.locator(`button[aria-label='Process "${taskTitle}"']`).evaluate(el => (el as HTMLElement).click())
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    return dialog
  }

  test('processes task to Next Actions', async ({ page, captureTask }) => {
    const task = await captureTask(`E2E — next actions ${Date.now()}`)
    const dialog = await openProcessing(page, task.title)

    await dialog.getByRole('button', { name: 'Yes' }).click()                           // Step 1
    await dialog.getByRole('button', { name: 'No — keep processing' }).click()          // Step 2
    await dialog.getByRole('button', { name: 'Yes' }).click()                           // Step 3
    await dialog.getByRole('button', { name: /No — do it as soon as possible/ }).click() // Step 4
    await dialog.getByRole('button', { name: 'Yes' }).click()                           // Step 5
    await dialog.getByRole('button', { name: 'Add to Next Actions →' }).click()         // Step 6b

    await expect(dialog).not.toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('button', { name: task.title, exact: true })).not.toBeVisible()

    // Verify in Next Actions
    await page.goto('/next-actions')
    await expect(page.getByText(task.title)).toBeVisible({ timeout: 8_000 })

    // No inline cleanup needed — global-setup deletes all E2E% tasks before each run
  })

  test('processes task to Someday/Maybe', async ({ page, captureTask }) => {
    const task = await captureTask(`E2E — someday ${Date.now()}`)
    const dialog = await openProcessing(page, task.title)

    await dialog.getByRole('button', { name: 'Yes' }).click()                           // Step 1
    await dialog.getByRole('button', { name: 'No — keep processing' }).click()          // Step 2
    await dialog.getByRole('button', { name: 'Yes' }).click()                           // Step 3
    await dialog.getByRole('button', { name: /No — defer to Someday\/Maybe/ }).click()  // Step 4
    await dialog.getByRole('button', { name: 'Save to Someday/Maybe →' }).click()       // Step 4c

    await expect(dialog).not.toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('button', { name: task.title, exact: true })).not.toBeVisible()

    // Cleanup via someday page
    await page.goto('/someday')
    const deleteBtn = page.locator(`button[aria-label='Delete "${task.title}"']`)
    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deleteBtn.evaluate(el => (el as HTMLElement).click())
      await page.getByRole('button', { name: 'Move to Trash' }).click()
    } else {
      // Fallback: try evaluate even if not "visible" (opacity-0)
      const count = await deleteBtn.count()
      if (count > 0) {
        await deleteBtn.evaluate(el => (el as HTMLElement).click())
        await page.getByRole('button', { name: 'Move to Trash' }).click()
      }
    }
  })

  test('closes processing overlay with Escape key', async ({ page, captureTask }) => {
    const task = await captureTask(`E2E — escape ${Date.now()}`)
    const dialog = await openProcessing(page, task.title)

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    await task.cleanup()
  })
})
