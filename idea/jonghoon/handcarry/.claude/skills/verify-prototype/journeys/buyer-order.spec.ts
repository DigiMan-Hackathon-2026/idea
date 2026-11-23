import { expect, test } from "@playwright/test";
import { capture, watchErrors } from "./evidence";
import { seen } from "./helpers";

test("buyer: order form validates, then registers an allowlisted item", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto("/buyer");
  await page.getByRole("link", { name: "새 주문 등록" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("주문 등록");

  await page.getByRole("button", { name: "주문 등록" }).click();
  await expect(seen(page, "상품명을 입력해 주세요.")).toBeVisible();
  await expect(seen(page, "허용된 카테고리를 선택해 주세요.")).toBeVisible();

  await page.getByLabel("상품명").fill("미개봉 확장팩 박스");
  await page.getByLabel("카테고리").selectOption("pokemon-sealed");
  await page.getByLabel("일본 판매가 (엔)").fill("120000");
  await page.getByRole("button", { name: "주문 등록" }).click();
  await expect(seen(page, "건당 상품가는 10만 엔 이하만 가능해요.")).toBeVisible();
  await expect(seen(page, "포켓몬 카드는 미개봉 상품만 주문할 수 있어요.")).toBeVisible();
  await capture(page, testInfo, "01-validation");

  await page.getByRole("button", { name: "예시로 채우기" }).click();
  await expect(seen(page, "원화 환산 약 ₩45,538 (결제 시점 환율)")).toBeVisible();
  await page.getByRole("button", { name: "주문 등록" }).click();

  await expect(page).toHaveURL(/\/buyer\/orders\/o-/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("미개봉 확장팩 박스 「별빛 탐험대」 (가상)");
  await expect(seen(page, "입찰 받는 중").first()).toBeVisible();
  await expect(seen(page, "아직 입찰이 없어요. 여행자가 곧 제안할 거예요.")).toBeVisible();
  await capture(page, testInfo, "02-registered");

  await page.getByRole("link", { name: "내 주문" }).click();
  await expect(page.getByRole("link", { name: "미개봉 확장팩 박스 「별빛 탐험대」 (가상)" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("buyer: select a bid, see the total breakdown, and pay into escrow", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto("/buyer");
  await page.getByRole("link", { name: "투어 한정 아크릴 스탠드 세트 (가상)" }).click();

  const bid = page.getByRole("listitem").filter({ hasText: "田中 ユイ" });
  await expect(bid).toContainText("₩8,000");
  await bid.getByRole("button", { name: "이 여행자로 선택" }).click();

  const breakdown = page.getByLabel("총 결제 금액").first();
  await expect(breakdown).toContainText("₩40,478");
  await expect(breakdown).toContainText("₩8,000");
  await expect(breakdown).toContainText("₩2,024");
  await expect(breakdown).toContainText("₩50,502");
  await expect(seen(page, "환율 100엔 = 843.29원 (결제 시점 기준)")).toBeVisible();
  await capture(page, testInfo, "01-checkout");

  await page.getByLabel("명동 거점").check();
  await page.getByRole("button", { name: "에스크로 결제 (데모)" }).click();

  await expect(seen(page, "일본에서 구매 대기").first()).toBeVisible();
  await expect(seen(page, "명동 거점", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "채팅" })).toBeVisible();
  await capture(page, testInfo, "02-paid");

  await page.reload();
  await expect(seen(page, "일본에서 구매 대기").first()).toBeVisible();
  expect(errors).toEqual([]);
});
