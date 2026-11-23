import fs from "node:fs";
import type { Page, TestInfo } from "@playwright/test";

// Saves a screenshot and an ARIA snapshot of the current page under the test's evidence dir.
export async function capture(page: Page, testInfo: TestInfo, step: string): Promise<void> {
  await page.screenshot({ path: testInfo.outputPath(`${step}.png`), fullPage: true });
  const aria = await page.locator("body").ariaSnapshot();
  fs.writeFileSync(testInfo.outputPath(`${step}.aria.yml`), `# ${page.url()}\n${aria}\n`);
}

// Collects console errors and uncaught page errors for the whole journey.
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}
