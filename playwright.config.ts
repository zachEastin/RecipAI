import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  webServer: {
    command: "npm --workspace @recipai/web run dev -- --hostname=127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true
  },
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], baseURL: "http://127.0.0.1:3000" }
    }
  ]
});
