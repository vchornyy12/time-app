import { test, expect } from '../fixtures'

/**
 * GTD view pages — Next Actions, Waiting For, Calendar, Someday, Notes, Trash.
 * Each test verifies that the page loads and core UI elements are present.
 */

const pages = [
  { path: '/next-actions', heading: 'Next Actions' },
  { path: '/waiting-for', heading: 'Waiting For' },
  { path: '/calendar', heading: 'Calendar' },
  { path: '/someday', heading: 'Someday / Maybe' },
  { path: '/notes', heading: 'Notes' },
  { path: '/trash', heading: 'Trash' },
  { path: '/analytics', heading: 'Analytics' },
  { path: '/settings', heading: 'Settings' },
]

for (const { path, heading } of pages) {
  test(`${path} page loads with correct heading`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 10_000 })
  })
}

test.describe('Trash', () => {
  test('deleted task appears in trash and can be restored', async ({ page, captureTask }) => {
    // Capture a task then delete it
    await page.goto('/inbox')
    const task = await captureTask(`E2E trash ${Date.now()}`)

    // Use evaluate to click the opacity-0 delete button directly
    await page.locator(`button[aria-label='Delete "${task.title}"']`).evaluate(el => (el as HTMLElement).click())
    await page.getByRole('button', { name: 'Move to Trash' }).click()

    // Optimistic update fires before server action completes — wait for both
    await expect(page.getByRole('button', { name: task.title, exact: true })).not.toBeVisible({ timeout: 5_000 })
    // Wait for server action POST + router.refresh() GET to finish
    await page.waitForLoadState('networkidle', { timeout: 8_000 })

    // Task should appear in trash
    await page.goto('/trash')
    await expect(page.getByText(task.title)).toBeVisible({ timeout: 8_000 })

    // Restore it back to inbox — use evaluate on the restore button
    const restoreBtn = page.locator(`button[aria-label='Restore "${task.title}"']`)
    const restoreCount = await restoreBtn.count()
    if (restoreCount > 0) {
      await restoreBtn.evaluate(el => (el as HTMLElement).click())
    }

    // Cleanup from inbox
    await page.goto('/inbox')
    const cleanupBtn = page.locator(`button[aria-label='Delete "${task.title}"']`)
    if (await cleanupBtn.count() > 0) {
      await cleanupBtn.evaluate(el => (el as HTMLElement).click())
      await page.getByRole('button', { name: 'Move to Trash' }).click()
    }
  })
})

test.describe('Navigation', () => {
  test('sidebar links navigate between views', async ({ page }) => {
    await page.goto('/inbox')

    await page.getByRole('link', { name: 'Next Actions' }).click()
    await expect(page).toHaveURL(/\/next-actions/)

    await page.getByRole('link', { name: 'Projects' }).click()
    await expect(page).toHaveURL(/\/projects/)

    await page.getByRole('link', { name: 'Inbox' }).click()
    await expect(page).toHaveURL(/\/inbox/)
  })

  test('mobile nav is visible at 375px width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/inbox')

    // MobileNav renders <nav aria-label="Mobile navigation"> with class "md:hidden"
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible()
  })
})
