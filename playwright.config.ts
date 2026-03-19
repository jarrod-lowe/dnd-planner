import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry'
  },

  projects: [
    // E2E tests
    {
      name: 'chromium',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'tablet',
      testDir: './tests/e2e',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 768 }
      }
    },
    // Component tests
    {
      name: 'component',
      testDir: './tests/component',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
});
