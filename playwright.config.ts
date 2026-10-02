import { availableParallelism } from 'node:os'
import { defineConfig, devices } from '@playwright/test'

const ci = Boolean(process.env.CI)

/**
 * The e2e tests drive the coverage builds (npm run build:coverage): dist/ as published, and
 * dist-offline/ as built without GitHub. Each test runs on a desktop Chromium and on an
 * iPhone in WebKit, Safari's engine.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? availableParallelism() : 4,
  reporter: ci
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:4400', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npx astro preview --port 4400 --ignore-lock',
      port: 4400,
      reuseExistingServer: !ci,
    },
    {
      command: 'npx astro preview --port 4401 --ignore-lock',
      port: 4401,
      env: { KUBESTACKS_OUT_DIR: 'dist-offline' },
      reuseExistingServer: !ci,
    },
  ],
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
})
