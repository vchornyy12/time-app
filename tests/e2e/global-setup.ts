import { test as setup, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import path from 'path'

const authFile = path.join(__dirname, '../../playwright/.auth/user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set.\n' +
        'Add them to .env.local:\n' +
        '  E2E_TEST_EMAIL=test@example.com\n' +
        '  E2E_TEST_PASSWORD=yourpassword',
    )
  }

  // ── 1. Clean up leftover E2E tasks from previous failed runs ─────────────
  // Tests use titles like "E2E …" — stale tasks from failed runs accumulate
  // in the inbox causing strict-mode timeouts on the next run (multiple
  // elements with the same title).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
  if (!signInErr) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('tasks').delete().eq('user_id', user.id).like('title', 'E2E%')
    }
  }

  // ── 2. Log in via the browser and save the auth state ────────────────────
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/inbox/, { timeout: 15_000 })
  await page.context().storageState({ path: authFile })
})
