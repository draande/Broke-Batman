import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  timeout: 180000,
  expect: { timeout: 60000 },
  use: {
    actionTimeout: 30000,
    baseURL: process.env.APP_URL || "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --webpack",
    url: process.env.APP_URL || "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
