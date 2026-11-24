import { test, expect } from '../fixtures'

/** datetime-local value two days from now at 10:00 local time */
function inTwoDays(): string {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`
}

test.describe('Calendar', () => {
  test('processing an item into Calendar lists it there without crashing', async ({ page, captureTask }) => {
    const task = await captureTask(`E2E — calendar ${Date.now()}`)
    await page.locator(`button[aria-label='Process "${task.title}"']`).evaluate(el => (el as HTMLElement).click())
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    await dialog.getByRole('button', { name: 'Yes' }).click()                     // actionable
    await dialog.getByRole('button', { name: 'No — keep processing' }).click()    // not 2-min
    await dialog.getByRole('button', { name: 'Yes' }).click()                     // mine
    await dialog.getByRole('button', { name: /Yes — pick a date or time/ }).click()
    await dialog.locator('input[type="datetime-local"]').fill(inTwoDays())
    await dialog.getByRole('button', { name: 'Add to Calendar →' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 15_000 })

    await page.goto('/calendar')
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
    const row = page.locator('li', { hasText: task.title })
    await expect(row).toBeVisible({ timeout: 8_000 })
    // Either synced with Google, or the page offers to connect — never the error page
    await expect(page.getByText('Something went wrong')).toHaveCount(0)

    // Back to Inbox so the fixture can clean it up (also removes the Google event)
    await row.getByRole('button', { name: 'Move back to Inbox' }).evaluate(el => (el as HTMLElement).click())
    await expect(row).toHaveCount(0, { timeout: 8_000 })
    await expect(page.getByText('Something went wrong')).toHaveCount(0)
  })
})
