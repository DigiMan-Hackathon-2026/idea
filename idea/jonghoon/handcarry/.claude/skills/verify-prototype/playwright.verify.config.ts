// Playwright config for verify-prototype journeys. Drives the instance started by
// `scripts/verify.mjs launch`; it never starts or reuses a server on its own.
import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const STATE_FILE = path.join(ROOT, ".verify", "run", "state.json");

if (!fs.existsSync(STATE_FILE)) {
  throw new Error("No verify instance. Run `node .claude/skills/verify-prototype/scripts/verify.mjs launch` first.");
}
const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as { url: string };

// Workers re-load this file; the env var keeps one run id per invocation.
process.env.VERIFY_RUN_ID ??= new Date().toISOString().replace(/[:.]/g, "-");
const OUTPUT_DIR = path.join(ROOT, ".verify", "evidence", process.env.VERIFY_RUN_ID);

export default defineConfig({
  testDir: "./journeys",
  outputDir: OUTPUT_DIR,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: path.join(OUTPUT_DIR, "report.json") }]],
  use: {
    baseURL: state.url,
    trace: "on",
    screenshot: "on",
  },
  projects: [
    // The demo is screen-shared from a laptop: presenter panel beside the phone frame.
    {
      name: "desktop",
      testIgnore: /\.mobile\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    // Narrow-screen smoke: app full screen, presenter panel behind a floating button.
    { name: "mobile-chrome", testMatch: /\.mobile\.spec\.ts$/, use: { ...devices["Pixel 7"] } },
  ],
});
