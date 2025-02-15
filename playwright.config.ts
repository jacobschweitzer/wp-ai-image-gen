/**
 * WordPress-specific Playwright configuration.
 */
import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  snapshotDir: './tests/__snapshots__',
  outputDir: './tests/test-results',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  //forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  // retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  // workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:8889',

    /* Configure screenshots to be always taken and included in the test report. */
    screenshot: 'on',

    /* Save all test artifacts (including screenshots) in the test results directory. */
    trace: 'on-first-retry',
  },

  /* Configure browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Ensure trace and screenshots are captured for debugging.
        trace: 'on-first-retry',
        screenshot: 'on'
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'wp-env start',
    url: 'http://localhost:8889',
    reuseExistingServer: true,
    timeout: 120000, // Increased timeout for WordPress startup
  },
});
