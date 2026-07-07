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
    await expect(page.getByText(task.title)).toBeVisible({ timeout: 8_000 })
    await expect(page.getByLabel('Repeats weekly')).toBeVisible()

    // Complete it — the DB trigger must clone a fresh occurrence
    await page.locator(`button[aria-label='Mark "${task.title}" as done']`).click()
    // Completion animates out, server action runs, trigger inserts the clone.
    // Reload to read fresh server state rather than racing the optimistic UI.
    await page.waitForTimeout(2_000)
    await page.reload()
    await expect(page.getByText(task.title)).toBeVisible({ timeout: 8_000 })
    await expect(page.getByLabel('Repeats weekly')).toBeVisible()
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
    await expect(page.getByText(task.title)).toBeVisible({ timeout: 8_000 })

    await page.locator(`button[aria-label='Mark "${task.title}" as done']`).click()
    await page.waitForTimeout(2_000)
    await page.reload()
    await expect(page.getByText(task.title)).not.toBeVisible({ timeout: 8_000 })
  })
})
