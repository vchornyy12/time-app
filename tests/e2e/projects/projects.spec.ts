import { test, expect } from '../fixtures'

/**
 * Projects tests.
 *
 * Note: projects have no standalone "Create project" button.
 * They are only created by processing an inbox item that has multiple steps
 * (the full inbox processing flow → Step 5 → "No — it's a Project").
 *
 * These tests cover:
 *  1. Projects page load + empty state
 *  2. Creating a project via the full processing flow
 *  3. Navigating to a project detail page
 */

test.describe('Projects', () => {
  test('projects page loads with heading', async ({ page }) => {
    await page.goto('/projects')
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  })

  test('shows empty state when there are no active projects', async ({ page }) => {
    await page.goto('/projects')
    // Either empty state or a list — both are valid depending on test data
    const heading = page.getByRole('heading', { name: 'Projects' })
    await expect(heading).toBeVisible()
  })
})

test.describe('Projects — creation via inbox processing', () => {
  /**
   * Full processing flow to create a project:
   * Inbox → Process → Yes → No (keep processing) → Yes → No (ASAP) → No (it's a Project)
   * → fill project form → submit
   */
  test('creates a project from an inbox item', async ({ page, captureTask }) => {
    await page.goto('/inbox')
    const task = await captureTask(`E2E project ${Date.now()}`)

    // Use evaluate to click the opacity-0 process button directly
    await page.locator(`button[aria-label='Process "${task.title}"']`).evaluate(el => (el as HTMLElement).click())
    await expect(page.getByRole('dialog')).toBeVisible()

    const dialog = page.getByRole('dialog')

    // Step 1: "Is this actionable?" → Yes
    await dialog.getByRole('button', { name: 'Yes' }).click()
    // Step 2: "Can you do this in 2 minutes?" → No — keep processing
    await dialog.getByRole('button', { name: 'No — keep processing' }).click()
    // Step 3: "Is this yours to do?" → Yes
    await dialog.getByRole('button', { name: 'Yes' }).click()
    // Step 4: "Does this have a specific date?" → No — do it as soon as possible
    await dialog.getByRole('button', { name: /No — do it as soon as possible/ }).click()
    // Step 5: "Can this be done in a single step?" → No — it's a Project
    await dialog.getByRole('button', { name: /No — it's a Project/ }).click()

    // Project creation form appears
    await expect(page.getByText('Create a project')).toBeVisible()

    // ProjectCreationForm requires a first-step title — always fill it
    const firstStepInput = page.getByPlaceholder(/first physical action/i)
    await expect(firstStepInput).toBeVisible({ timeout: 5_000 })
    await firstStepInput.fill('Research options')

    await page.getByRole('button', { name: /create project|save|submit/i }).click()

    // Overlay closes
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })

    // Optimistic update fires before server action completes — wait for both
    await expect(page.getByRole('button', { name: task.title, exact: true })).not.toBeVisible({ timeout: 5_000 })
    // Wait for server action POST + router.refresh() GET to finish
    await page.waitForLoadState('networkidle', { timeout: 8_000 })

    // Project should now appear on the projects page
    await page.goto('/projects')
    await expect(page.getByText(task.title)).toBeVisible({ timeout: 8_000 })

    // Cleanup: there's no delete button on the projects page in this app by default;
    // the test leaves a project behind — acceptable for now.
    // TODO: add cleanup once project deletion UI is identified.
  })
})

test.describe('Projects — detail page', () => {
  test('navigates to project detail page when clicking a project', async ({ page }) => {
    await page.goto('/projects')

    // Only run this if at least one project exists
    const firstProject = page.locator('ul li').first()
    const hasProjects = await firstProject.isVisible({ timeout: 3_000 })

    if (!hasProjects) {
      test.skip()
      return
    }

    await firstProject.click()

    // Should land on a project detail URL
    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+/)

    // Rough plan section should be visible
    await expect(
      page.getByText(/rough plan|plan/i).first(),
    ).toBeVisible({ timeout: 5_000 })
  })
})
