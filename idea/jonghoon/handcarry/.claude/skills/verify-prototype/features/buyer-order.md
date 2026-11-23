# Buyer order and checkout

The buyer (김민지, Korean screens) registers an allowlisted item, picks one traveler's bid, sees the total broken down, chooses how to receive the item, and pays into escrow. After delivery the buyer confirms or rejects receipt.

## Sub-features

- `order-validate` rejects a blank name, a non-allowlisted category, a price over 100,000 yen, and unsealed Pokémon cards, with per-field messages.
- `order-example` fills the demo-script item with "예시로 채우기" and shows the live won estimate.
- `order-create` registers the order and opens its detail page with status `입찰 받는 중`.
- `bid-select` lists bids (cheapest first) and selects one with "이 여행자로 선택".
- `checkout-breakdown` shows item (won at 843.29/100 yen), reward, 5% fee on the item only, a tax line, and the total.
- `checkout-pay` pays with a delivery choice (명동 거점, 홍대 거점, 직접 대면) from a sticky button that includes the total.
- `receipt-confirm` and `receipt-reject` appear when the order is `수령 확인 대기`.

## How to get to it (user POV)

- Buyer home `/buyer` → "새 주문 등록", or the "주문하기" tab.
- Buyer home → tap an order card → `/buyer/orders/<id>`.

## Driving it with Playwright

Preconditions:

- Doctor `HEALTHY`, fresh context, presenter panel role 구매자.

- **Validate.** Submit the empty form (`주문 등록`). `상품명을 입력해 주세요.` and `허용된 카테고리를 선택해 주세요.` appear. Price `120000` with `포켓몬 카드 (미개봉)` unchecked shows the cap and sealed errors.
- **Example and create.** `예시로 채우기` shows `원화 환산 약 ₩45,538 (결제 시점 환율)`. Submit. URL matches `/buyer/orders/o-`. Heading is `미개봉 확장팩 박스 「별빛 탐험대」 (가상)`.
- **Select a bid.** Open `투어 한정 아크릴 스탠드 세트 (가상)`. In the list item for `田中 ユイ` (₩8,000) click `이 여행자로 선택`.
- **Breakdown.** The region labelled `총 결제 금액` shows `₩40,478`, `₩8,000`, `₩2,024`, `₩50,502`.
- **Pay.** Check `명동 거점`, click the button matching `/에스크로 결제/`. Status `일본에서 구매 대기`, `명동 거점` and a `채팅` link appear. Survives reload.
- **Proof.** Journey `journeys/buyer-order.spec.ts`. Screenshots `01-validation`, `02-registered`, `01-checkout`, `02-paid`.

## Gotchas

- The pay button's accessible name ends with the total (`… · ₩50,502`). Match with a regex.
- Order ids are random (`o-xxxxxxxx`). Find the order by its item name, never by id.
- Text locators can match hidden copies of earlier pages that Next.js keeps alive. Prefer `getByRole`, or add `.filter({ visible: true })` to `getByText`.
