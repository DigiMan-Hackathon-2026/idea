import { expect, test } from "@playwright/test";
import { capture, watchErrors } from "./evidence";
import { HERO_JA, HERO_KO, seen, switchRole } from "./helpers";

// Mirrors DEMO.md steps 1–10 one to one. Keep both in sync.
test("golden path: hub delivery from order to payout, with translated chat", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  const heroBuyer = page.getByRole("link", { name: HERO_KO });
  const heroTraveler = page.getByRole("link", { name: HERO_JA });

  // 1. Buyer registers the order.
  await page.goto("/buyer");
  await page.getByRole("link", { name: "새 주문 등록" }).click();
  await page.getByRole("button", { name: "예시로 채우기" }).click();
  await page.getByRole("button", { name: "주문 등록" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HERO_KO);
  await capture(page, testInfo, "01-order-registered");

  // 2. Traveler bids the prefilled reward.
  await switchRole(page, "여행자");
  await heroTraveler.click();
  await page.getByRole("button", { name: "入札する" }).click();
  await expect(seen(page, "入札しました。購入者の選択を待っています。")).toBeVisible();
  await capture(page, testInfo, "02-traveler-bid");

  // 3. Buyer selects the bid and pays into escrow for Myeongdong hub pickup.
  await switchRole(page, "구매자");
  await heroBuyer.click();
  await page.getByRole("listitem").filter({ hasText: "佐藤 ハルト" }).getByRole("button", { name: "이 여행자로 선택" }).click();
  await expect(page.getByLabel("총 결제 금액").first()).toContainText("₩52,815");
  await capture(page, testInfo, "03-checkout");
  await page.getByLabel("명동 거점").check();
  await page.getByRole("button", { name: /에스크로 결제/ }).click();
  await expect(seen(page, "일본에서 구매 대기").first()).toBeVisible();

  // 4. Buyer sends a request in Korean from the chat.
  await page.getByRole("link", { name: "채팅" }).click();
  await page.getByRole("group", { name: "빠른 답장" }).getByRole("button", { name: "띠지가 있는 미개봉 상태로 부탁드려요." }).click();
  await expect(page.getByRole("list", { name: "채팅" })).toContainText("띠지가 있는 미개봉 상태로 부탁드려요.");

  // 5. Traveler reads it in Japanese and replies.
  await switchRole(page, "여행자");
  await page.getByRole("link", { name: "マイ案件" }).click();
  await heroTraveler.click();
  await page.getByRole("link", { name: "チャット" }).click();
  const chat = page.getByRole("list", { name: "チャット" });
  await expect(chat).toContainText("帯付きの未開封でお願いします。");
  await expect(chat).toContainText("띠지가 있는 미개봉 상태로 부탁드려요. · 自動翻訳");
  await page.getByRole("group", { name: "クイック返信" }).getByRole("button", { name: "はい、未開封で購入します。" }).click();
  await expect(chat).toContainText("はい、未開封で購入します。");
  await capture(page, testInfo, "05-chat-translated");

  // 6. Traveler uploads purchase proof and gets hub drop-off guidance.
  await page.getByRole("link", { name: /戻る/ }).click();
  await page.getByRole("button", { name: "サンプル写真を添付" }).click();
  await page.getByRole("button", { name: "証明をアップする" }).click();
  await expect(seen(page, "ソウルに着いたら明洞拠点に預けてください。運営が入庫を記録します。")).toBeVisible();
  await capture(page, testInfo, "06-proof-uploaded");

  // 7. Operator records hub check-in, then check-out when the buyer picks it up.
  await switchRole(page, "운영자");
  await page.getByRole("region", { name: /입고 예정/ }).getByRole("button", { name: "입고 기록" }).click();
  const stored = page.getByRole("region", { name: /보관 중/ });
  await expect(stored.getByLabel(HERO_KO)).toBeVisible();
  await capture(page, testInfo, "07-hub-checked-in");
  await stored.getByLabel(HERO_KO).getByRole("button", { name: "출고 기록 (구매자 수령)" }).click();
  await expect(stored.getByLabel(HERO_KO)).toHaveCount(0);

  // 8. Buyer confirms receipt.
  await switchRole(page, "구매자");
  await heroBuyer.click();
  await page.getByRole("button", { name: "수령 확인" }).click();
  await expect(seen(page, "거래가 완료됐어요. 여행자에게 정산이 진행돼요.")).toBeVisible();
  await capture(page, testInfo, "08-buyer-confirmed");

  // 9. Traveler sees the settlement and picks the prepaid card.
  await switchRole(page, "여행자");
  await page.getByRole("link", { name: "マイ案件" }).click();
  await heroTraveler.click();
  const settlement = page.getByLabel("精算");
  await expect(settlement).toContainText("₩45,965");
  await expect(settlement).toContainText("₩50,965");
  await settlement.getByRole("button", { name: "プリペイドカードにチャージ" }).click();
  await expect(seen(page, "プリペイドカードにチャージで精算しました。")).toBeVisible();
  await capture(page, testInfo, "09-traveler-paid-out");

  // 10. Operator sees the FX difference the platform absorbed.
  await switchRole(page, "운영자");
  const fx = page.getByRole("region", { name: "환율 차액 (플랫폼 흡수)" });
  await expect(fx).toContainText("₩427");
  await expect(fx).toContainText("₩546");
  await capture(page, testInfo, "10-fx-summary");

  expect(errors).toEqual([]);
});
