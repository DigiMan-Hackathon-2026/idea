# Chat with fixed translation

Buyer and traveler chat about one order. Each message is stored in its sender's language. The reader sees the translation from the fixed demo dictionary, with the original and `자동 번역` / `自動翻訳` underneath. A message the dictionary does not know shows the original and `번역 준비 중` / `翻訳準備中`. Quick-reply chips send the scripted lines without typing. Operators can read but not write.

## Sub-features

- `chat-open` opens `/chat/<orderId>` from the `채팅` / `チャット` link once a bid is selected (buyer) or paid (traveler).
- `chat-quick` sends a quick-reply chip immediately.
- `chat-translate` shows the receiver's language first, then the original with the auto-translated label.
- `chat-pending` shows the original with the pending label for unknown text.
- `chat-type` sends free text with the input and `보내기` / `送信`.
- `chat-readonly` hides the composer for the operator.

## How to get to it (user POV)

- Buyer order detail → `채팅` next to `선택한 여행자`.
- Traveler order detail → `チャット` next to `受け渡し方法`.
- `← 뒤로` / `← 戻る` returns to the role's order page.

## Driving it with Playwright

Preconditions:

- Doctor `HEALTHY`, fresh context, an order paid with 佐藤 ハルト selected (golden path steps 1–3).

- **Buyer sends.** `채팅`, then in group `빠른 답장` click `띠지가 있는 미개봉 상태로 부탁드려요.`. List `채팅` contains it.
- **Traveler reads.** Switch to 여행자 → `マイ案件` → the order → `チャット`. List `チャット` contains `帯付きの未開封でお願いします。` and `띠지가 있는 미개봉 상태로 부탁드려요. · 自動翻訳`.
- **Traveler replies.** Group `クイック返信` → `はい、未開封で購入します。`. The list contains it.
- **Proof.** Golden path journey steps 4–5, screenshot `05-chat-translated`.

## Gotchas

- The chat page has no role in its URL. It acts as the last role route visited (the shell keeps the session role in sync). Open it from a role page, not by typing the URL.
- Translation matches whole phrases exactly (whitespace trimmed). Any edit to a phrase must be made in both languages in `lib/demo/translations.ts`.
