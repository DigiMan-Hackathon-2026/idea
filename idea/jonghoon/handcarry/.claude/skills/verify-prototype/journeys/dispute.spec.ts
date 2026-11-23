import { expect, test, type Page } from "@playwright/test";
import { capture, watchErrors } from "./evidence";
import { switchRole, seen } from "./helpers";

const FIGURE_KO = "피규어 「밤하늘 소녀」 (가상)";
const FIGURE_JA = "フィギュア「夜空の少女」（架空）";

async function buyerRejects(page: Page) {
  await page.goto("/buyer");
  await page.getByRole("link", { name: FIGURE_KO }).click();
  await expect(page.getByRole("button", { name: "수령 확인" })).toBeVisible();
  await page.getByRole("button", { name: "수령 거부" }).click();
  await page.getByRole("button", { name: "수령 거부하고 운영팀에 접수" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "거부 사유를 입력해 주세요." })).toBeVisible();
  await page.getByLabel("거부 사유").fill("포장이 이미 뜯어져 있었어요");
  await page.getByRole("button", { name: "수령 거부하고 운영팀에 접수" }).click();
  await expect(seen(page, "운영팀이 영수증과 사진을 검토하고 있어요.")).toBeVisible();
}

async function operatorOpensDispute(page: Page) {
  await switchRole(page, "운영자");
  await page.getByRole("link", { name: "분쟁" }).click();
  await page.getByRole("link", { name: FIGURE_KO }).click();
  await expect(seen(page, "“포장이 이미 뜯어져 있었어요”")).toBeVisible();
  await expect(page.getByRole("img", { name: /영수증/ })).toBeVisible();
  await expect(seen(page, "판정 결과별 정산 정책은 아직 확정되지 않았어요 (PRD 미정).")).toBeVisible();
}

test("dispute: buyer rejects receipt, operator rules for the buyer, full escrow is refunded", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await buyerRejects(page);
  await capture(page, testInfo, "01-buyer-rejected");

  await operatorOpensDispute(page);
  await capture(page, testInfo, "02-operator-review");
  await page.getByRole("button", { name: "구매자 승: 전액 환불" }).click();
  await expect(seen(page, "구매자 승으로 판정 · 결제한 ₩98,774 전액을 환불했어요.")).toBeVisible();
  await capture(page, testInfo, "03-ruled-buyer");

  await page.getByRole("link", { name: "분쟁" }).click();
  await expect(seen(page, "검토할 분쟁이 없어요.")).toBeVisible();
  await expect(page.getByRole("region", { name: "판정 완료" }).getByRole("link", { name: FIGURE_KO })).toBeVisible();

  await switchRole(page, "구매자");
  await page.getByRole("link", { name: FIGURE_KO }).click();
  await expect(seen(page, "결제한 ₩98,774 전액을 환불했어요.")).toBeVisible();

  await switchRole(page, "여행자");
  await page.getByRole("link", { name: "マイ案件" }).click();
  await page.getByRole("link", { name: FIGURE_JA }).click();
  await expect(seen(page, "運営の判定により購入者へ返金されました。精算はありません。")).toBeVisible();
  await capture(page, testInfo, "04-traveler-lost");

  expect(errors).toEqual([]);
});

test("dispute: operator rules for the traveler, who is then settled normally", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await buyerRejects(page);
  await operatorOpensDispute(page);
  await page.getByRole("button", { name: "여행자 승: 정상 정산" }).click();
  await expect(seen(page, "여행자 승으로 판정")).toBeVisible();

  await switchRole(page, "여행자");
  await page.getByRole("link", { name: "マイ案件" }).click();
  await page.getByRole("link", { name: FIGURE_JA }).click();
  const settlement = page.getByLabel("精算");
  await expect(settlement).toContainText("₩95,418");
  await expect(settlement).toContainText("旅行者の手数料は無料");
  await capture(page, testInfo, "01-traveler-settlement");

  expect(errors).toEqual([]);
});
