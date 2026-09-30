import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: "./ui",
  outputDir: "../test-results",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:8083",
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    cwd: resolve(__dirname, ".."),
    command: "npx expo start --localhost --port 8083",
    env: { EXPO_PUBLIC_AUTH_MODE: "local", NODE_OPTIONS: [process.env.NODE_OPTIONS, "--dns-result-order=ipv4first"].filter(Boolean).join(" ") }, // Local fixtures; match the IPv4 health-check address on macOS.
    url: "http://127.0.0.1:8083",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
