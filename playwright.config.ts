import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  testMatch: process.env.PREVIEW ? "**/production.spec.ts" : "**/app.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4173/spin-the-wheel-customized/",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run ${process.env.PREVIEW ? "preview" : "dev"} -- --host 127.0.0.1 --port 4173`,
    url: "http://127.0.0.1:4173/spin-the-wheel-customized/",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
