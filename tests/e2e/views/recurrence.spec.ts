import { test, expect } from '../fixtures'
import type { Page } from '@playwright/test'

/** Click the hidden Process button via DOM evaluate, then wait for the dialog. */
async function openProcessing(page: Page, taskTitle: string) {
  await page.locator(`button[aria-label='Process "${taskTitle}"']`).evaluate(el => (el as HTMLElement).click())
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  return dialog
}

/** Walk the processing wizard to step6b (next action clarification). */
async function walkToNextActionStep(dialog: ReturnType<Page['getByRole']>) {
  await dialog.getByRole('button', { name: 'Yes' }).click()                            // Step 1: actionable
  await dialog.getByRole('button', { name: 'No — keep processing' }).click()           // Step 2: not 2-min
  await dialog.getByRole('button', { name: 'Yes' }).click()                            // Step 3: mine
  await dialog.getByRole('button', { name: /No — do it as soon as possible/ }).click() // Step 4: no date
  await dialog.getByRole('button', { name: 'Yes' }).click()                            // Step 5: single step
}

test.describe('Recurring tasks', () => {
  test('recurring next action reappears after completion', async ({ page, captureTask }) => {
    const task = await captureTask(`E2E — recurring ${Date.now()}`)
    const dialog = await openProcessing(page, task.title)

    await walkToNextActionStep(dialog)
    await dialog.getByLabel('Repeat').selectOption('weekly')
    await dialog.getByRole('button', { name: 'Add to Next Actions →' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 8_000 })

    // Shows up in Next Actions with the repeat indicator
    await page.goto('/next-actions')
    const row = page.locator('li', { hasText: task.title })
    await expect(row).toBeVisible({ timeout: 8_000 })
    await expect(row.getByLabel('Repeats weekly')).toBeVisible()

    // Complete it — the DB trigger must clone a fresh occurrence
    await page.locator(`button[aria-label='Mark "${task.title}" as done']`).click()
    // Completion commits the done update and the trigger's clone insert in one
    // transaction; poll fresh server state until the clone row is visible.
    await expect(async () => {
      await page.reload()
      await expect(row).toBeVisible({ timeout: 2_000 })
      await expect(row.getByLabel('Repeats weekly')).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 20_000 })
    // No inline cleanup needed — global-setup deletes all E2E% tasks before each run
  })

  test('non-recurring next action does not reappear after completion', async ({ page, captureTask }) => {
    const task = await captureTask(`E2E — one-shot ${Date.now()}`)
    const dialog = await openProcessing(page, task.title)

    await walkToNextActionStep(dialog)
    // Leave Repeat at None
    await dialog.getByRole('button', { name: 'Add to Next Actions →' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 8_000 })

    await page.goto('/next-actions')
    const row = page.locator('li', { hasText: task.title })
    await expect(row).toBeVisible({ timeout: 8_000 })

    await page.locator(`button[aria-label='Mark "${task.title}" as done']`).click()
    // No clone must appear: poll fresh server state until the row is gone.
    await expect(async () => {
      await page.reload()
      await expect(row).toHaveCount(0, { timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
  })
})
