import { test, expect } from '@playwright/test'

/**
 * Authentication tests — run WITHOUT pre-loaded auth state
 * (configured via the 'auth-tests' project in playwright.config.ts).
 */

const TEST_EMAIL = process.env.E2E_TEST_EMAIL!
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD!

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('shows welcome heading and form fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await expect(page.getByLabel('Email address')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('redirects to /inbox on valid credentials', async ({ page }) => {
    await page.getByLabel('Email address').fill(TEST_EMAIL)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/inbox/, { timeout: 15_000 })
  })

  test('shows error message on invalid credentials', async ({ page }) => {
    await page.getByLabel('Email address').fill('wrong@example.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()

    // The error div appears with the Supabase error message
    await expect(page.locator('.bg-red-500\\/10')).toBeVisible({ timeout: 8_000 })
  })

  test('has a link to the register page', async ({ page }) => {
    await page.getByRole('link', { name: 'Sign up' }).click()
    await expect(page).toHaveURL(/\/register/)
  })

  test('has a forgot password link', async ({ page }) => {
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await expect(page).toHaveURL(/\/reset-password/)
  })
})

test.describe('Route protection', () => {
  test('unauthenticated user visiting /inbox is redirected to /login', async ({ page }) => {
    // No storageState — fresh unauthenticated browser
    await page.goto('/inbox')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user visiting /next-actions is redirected to /login', async ({ page }) => {
    await page.goto('/next-actions')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user visiting /projects is redirected to /login', async ({ page }) => {
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Authenticated redirect', () => {
  test('authenticated user visiting /login is redirected to /inbox', async ({ browser }) => {
    // Load a context with saved auth state
    const authFile = 'playwright/.auth/user.json'
    const context = await browser.newContext({ storageState: authFile })
    const page = await context.newPage()

    await page.goto('/login')
    await expect(page).toHaveURL(/\/inbox/, { timeout: 10_000 })

    await context.close()
  })
})
