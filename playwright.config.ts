import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'
import path from 'path'

// Load .env.local so E2E_TEST_EMAIL / E2E_TEST_PASSWORD are available.
// Next.js does this automatically for the app, but Playwright does not.
config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Global setup: log in once and save auth state
    {
      name: 'setup',
      testMatch: '**/global-setup.ts',
    },

    // All tests run with saved auth state (authenticated).
    // Auth-specific tests are excluded here; they run in the 'auth-tests' project below.
    {
      name: 'chromium',
      testIgnore: '**/auth/**',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Auth-specific tests run WITHOUT saved state (unauthenticated browser)
    {
      name: 'auth-tests',
      testMatch: '**/auth/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
    },
  ],

  // Start the Next.js dev server before running tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
