# Operator hub and disputes

The operator (운영팀, Korean screens) records hub check-in and check-out, rules on rejected receipts, and sees how much exchange-rate difference the platform has absorbed.

## Sub-features

- `hub-incoming` lists hub orders whose proof is uploaded and records `입고 기록`.
- `hub-stored` lists items stored at a hub and records `출고 기록 (구매자 수령)`, which moves the order to the buyer's receipt check.
- `fx-summary` lists settled orders' FX difference and the total (`누적 흡수액`) with both rates.
- `dispute-list` lists open disputes and, under `판정 완료`, ruled ones.
- `dispute-review` shows the buyer's reason, proof photos, chat, and the escrow breakdown, with a "policy undecided" note.
- `dispute-rule` rules for the buyer (full refund including fee, no traveler settlement) or the traveler (normal settlement).

## How to get to it (user POV)

- Presenter panel → 운영자. Tabs `거점` (`/operator`) and `분쟁` (`/operator/disputes`).
- Tap a dispute → `/operator/disputes/<id>`.

## Driving it with Playwright

Preconditions:

- Doctor `HEALTHY`, fresh context. Seed `한정 아크릴 키링 세트 (가상)` is stored at the Hongdae hub. Seed `피규어 「밤하늘 소녀」 (가상)` is delivered and waiting on the buyer.

- **Open a dispute (buyer).** On the figure order: `수령 거부`, then submit empty → alert `거부 사유를 입력해 주세요.`. Fill `거부 사유` with `포장이 이미 뜯어져 있었어요` and submit → `운영팀이 영수증과 사진을 검토하고 있어요.`.
- **Review.** Operator → `분쟁` → the figure. The reason in quotes, image `/영수증/`, and the PRD policy note are visible.
- **Buyer wins.** `구매자 승: 전액 환불` → `구매자 승으로 판정 · 결제한 ₩98,774 전액을 환불했어요.`. The list shows `검토할 분쟁이 없어요.` and the order under region `판정 완료`. The buyer sees the refund. The traveler sees `運営の判定により購入者へ返金されました。精算はありません。`.
- **Traveler wins.** `여행자 승: 정상 정산` → `여행자 승으로 판정`. The traveler's `精算` card shows `₩95,418` and `旅行者の手数料は無料`.
- **Hub.** Covered end to end by the golden path journey (`입고 기록`, `출고 기록 (구매자 수령)`).
- **Proof.** Journey `journeys/dispute.spec.ts`. Screenshots `01-buyer-rejected` to `04-traveler-lost`, `01-traveler-settlement`.

## Gotchas

- The ruling buttons disappear once ruled. A second ruling is impossible by design.
- The FX summary only counts orders with a settlement (completed or traveler-won). Seed `아이돌 표지 잡지 12월호 (가상)` contributes ₩119.
- Use `seen()` from `journeys/helpers.ts` for text. Earlier pages stay mounted but hidden.
