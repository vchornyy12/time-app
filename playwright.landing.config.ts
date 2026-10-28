import { defineConfig } from '@playwright/test'

const externalOrigin = process.env.LANDING_TEST_ORIGIN

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'landing.spec.ts',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: externalOrigin ?? 'http://127.0.0.1:3300',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: externalOrigin ? undefined : {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3300',
    url: 'http://127.0.0.1:3300',
    timeout: 60_000,
    reuseExistingServer: false,
  },
})
