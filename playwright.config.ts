import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const targetUrl = process.env.DEFAULT_TARGET_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/generated",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "runs/playwright-report", open: "never" }],
  ],
  use: {
    baseURL: targetUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    // Auth setup — runs before all other projects
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // Main UI tests (parallel)
    {
      name: "ui-tests",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/user.json",
      },
      dependencies: ["auth-setup"],
      testIgnore: /\.voice\.spec\.ts/,
      workers: 4,
    },

    // Voice tests — must be serial (mic mock is process-wide)
    {
      name: "voice-tests",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/user.json",
      },
      dependencies: ["auth-setup"],
      testMatch: /\.voice\.spec\.ts/,
      workers: 1,
    },
  ],
});
