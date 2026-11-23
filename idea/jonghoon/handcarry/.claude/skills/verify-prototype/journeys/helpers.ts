import { expect, type Page } from "@playwright/test";

export const HERO_KO = "미개봉 확장팩 박스 「별빛 탐험대」 (가상)";
export const HERO_JA = "未開封 拡張パックBOX「星明かり探検隊」（架空）";

// Next.js keeps earlier pages mounted but hidden, so plain getByText can match invisible copies.
// Use seen() for every text lookup in journeys.
export function seen(page: Page, text: string | RegExp, options?: { exact?: boolean }) {
  return page.getByText(text, options).filter({ visible: true });
}

export function panel(page: Page) {
  return page.getByRole("region", { name: "시연 패널" });
}

export async function switchRole(page: Page, role: "구매자" | "여행자" | "운영자") {
  await panel(page).getByRole("button", { name: new RegExp(role) }).click();
  await expect(panel(page).getByRole("button", { name: new RegExp(role) })).toHaveAttribute("aria-pressed", "true");
}

// Buyer registers the demo-script order through the form's example fill.
export async function createHeroOrder(page: Page) {
  await page.goto("/buyer");
  await page.getByRole("link", { name: "새 주문 등록" }).click();
  await page.getByRole("button", { name: "예시로 채우기" }).click();
  await page.getByRole("button", { name: "주문 등록" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HERO_KO);
}

// 1×1 PNG used to drive the real file picker.
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
