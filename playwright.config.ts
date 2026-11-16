import { defineConfig } from "@playwright/test";

/**
 * Frontend QA (npm run qa:ui). Uses the Chrome installed on this machine
 * (no browser download). Every test runs at each screen size below; phone
 * and small-tablet sizes emulate a touch device.
 */
export const SIZES = [
  { name: "phone-320", width: 320, height: 568, mobile: true },
  { name: "phone-375", width: 375, height: 667, mobile: true },
  { name: "phone-390", width: 390, height: 844, mobile: true },
  { name: "phone-430", width: 430, height: 932, mobile: true },
  { name: "tablet-768", width: 768, height: 1024, mobile: true },
  { name: "tablet-834", width: 834, height: 1194, mobile: true },
  { name: "tablet-land-1024", width: 1024, height: 768, mobile: true },
  { name: "laptop-1280", width: 1280, height: 720, mobile: false },
  { name: "laptop-1366", width: 1366, height: 768, mobile: false },
  { name: "laptop-1440", width: 1440, height: 900, mobile: false },
  { name: "laptop-short-1536", width: 1536, height: 730, mobile: false },
  { name: "desktop-1920", width: 1920, height: 1080, mobile: false },
  { name: "desktop-2560", width: 2560, height: 1440, mobile: false },
];

export default defineConfig({
  testDir: "qa/e2e",
  outputDir: "qa/e2e/.results/artifacts",
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [["list"], ["json", { outputFile: "qa/e2e/.results/results.json" }]],
  use: {
    baseURL: "http://localhost:5173",
    channel: "chrome",
    actionTimeout: 15_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: SIZES.map((s) => ({
    name: s.name,
    use: {
      viewport: { width: s.width, height: s.height },
      isMobile: s.mobile,
      hasTouch: s.mobile,
      deviceScaleFactor: s.mobile ? 2 : 1,
    },
  })),
});
