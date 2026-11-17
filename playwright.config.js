// End-to-end tests run against the built site in dist/ (npm run test:e2e builds it first).
// Set APP_DIR=. to run them against the unbuilt source instead.
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT || 4173);
const appDir = process.env.APP_DIR || "dist";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // GitHub's runners have 4 cores; Playwright's default uses only half of them.
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}/`,
    trace: "retain-on-failure",
    // Stops animations (e.g. the hint wobble) so screenshots and clicks are deterministic.
    reducedMotion: "reduce",
    // CHROME_PATH runs the tests with an installed Chrome instead of Playwright's own download.
    ...(process.env.CHROME_PATH ? { launchOptions: { executablePath: process.env.CHROME_PATH } } : {}),
  },
  // Every test runs on the phone. Desktop and tablet run only the tests tagged @layout (the map, dragging,
  // sideways overflow, the Rule Book's tabs...), since game logic behaves the same at every size.
  // ALL_SIZES=1 runs every test at every size.
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, ...(process.env.ALL_SIZES ? {} : { grep: /@layout/ }) },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true },
      ...(process.env.ALL_SIZES ? {} : { grep: /@layout/ }) },
  ],
  webServer: {
    command: `node scripts/serve.mjs ${appDir} ${port}`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
  },
});
