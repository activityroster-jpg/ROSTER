import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (npm run e2e). They drive a local copy of the app with a
 * made-up centre (e2e/seed.test.ts): never staging or production. The
 * browser-tests workflow starts the app, the seed and e2e/proxy.mjs first.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 6 * 60_000,
  expect: { timeout: 60_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1360, height: 900 },
    timezoneId: "Europe/London",
    locale: "en-GB",
    actionTimeout: 120_000,
    navigationTimeout: 300_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Local runs here use the browsers already on the machine; CI installs its own.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
});
