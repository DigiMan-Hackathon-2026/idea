# Traveler bidding, proof, and hand-over

The traveler (佐藤 ハルト, Japanese screens) browses open orders with item names auto-translated, bids a reward at or above the minimum, uploads purchase proof after the buyer pays, and either hands the item over in person or leaves it at a hub. After the buyer confirms, the traveler picks a payout method.

## Sub-features

- `find-open` lists open orders with the minimum reward or the traveler's own bid.
- `item-translate` shows the Japanese item name with the Korean original and `自動翻訳`.
- `bid-min` rejects a reward below 10% of the item's won price (rounded up to ₩100). Prefill is the minimum rounded up to ₩1,000.
- `bid-place` places or replaces the traveler's bid.
- `jobs` lists orders where this traveler's bid was selected (`マイ案件`).
- `proof-upload` takes real photos (downscaled) and/or sample photos plus a receipt date. Samples are added next to real photos.
- `hand-over` marks an in-person order delivered. Hub orders show drop-off guidance instead.
- `payout` shows the settlement (item at the receipt-date rate + reward, no traveler fee) and records the payout method.

## How to get to it (user POV)

- Presenter panel → 여행자. `/traveler` (`注文を探す`) and `/traveler/jobs` (`マイ案件`) tabs.
- Tap an order → `/traveler/orders/<id>`.

## Driving it with Playwright

Preconditions:

- Doctor `HEALTHY`, fresh context. The hero order exists (`createHeroOrder` in `journeys/helpers.ts`).

- **Find.** Link `未開封 拡張パックBOX「星明かり探検隊」（架空）` contains `最低報酬 ₩4,600`.
- **Translate.** On the detail page, heading is the Japanese name and `미개봉 확장팩 박스 「별빛 탐험대」 (가상) · 自動翻訳` is visible.
- **Minimum.** `報酬（ウォン）` starts at `5000`. Enter `4000`, click `入札する`. Alert `報酬が最低金額を下回っています。`. Enter `6000` and bid. `入札しました。購入者の選択を待っています。`.
- **After buyer pays (in person).** `マイ案件` → the order. `証明をアップする` is disabled. `setInputFiles` on `写真を選ぶ`, then `サンプル写真を添付` → `写真 3枚` and image `購入写真`. Upload → status `韓国へ持ち込み中`.
- **Hand over.** `対面で手渡しました` → `購入者の受取確認を待っています。`. The buyer then sees `수령 확인`, the receipt sample, and image `구매 사진`.
- **Proof.** Journey `journeys/traveler-in-person.spec.ts`. Screenshots `01-bid` to `04-buyer-confirm`.

## Gotchas

- Seed orders selected for 佐藤 ハルト are already past proof (`at_hub`, `delivered`). Proof upload is only reachable through a newly created order.
- Next.js's route announcer is also `role=alert`. Filter alerts by text.
- The file input is hidden behind the `写真を選ぶ` button. `getByLabel("写真を選ぶ")` resolves to the input for `setInputFiles`.
