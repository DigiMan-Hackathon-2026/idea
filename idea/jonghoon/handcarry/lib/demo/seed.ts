import { createOrder, transition, type OrderEvent } from "../domain/order-machine";
import { won, yen, type Bid, type Item, type Order } from "../domain/types";
import type { ChatMessage, DemoState } from "../store/state";

const at = (day: number, hour: number) => `2026-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;

const bid = (id: string, travelerId: string, reward: number, message: string, time: string): Bid => ({
  id,
  travelerId,
  reward: won(reward),
  message,
  createdAt: time,
});

// Seeds are built by replaying real events, so every seeded order is a state the machine can reach.
function build(id: string, item: Item, createdAt: string, events: OrderEvent[]): Order {
  return events.reduce(transition, createOrder({ id, buyerId: "buyer-minji", item, createdAt }));
}

const proof = (time: string, receiptDate: string): OrderEvent => ({
  type: "uploadProof",
  proof: { photos: ["sample:receipt", "sample:item"], receiptDate, uploadedAt: time },
});

export const SEED_ITEMS = {
  open: { name: "투어 한정 아크릴 스탠드 세트 (가상)", category: "kpop-japan-limited", priceYen: yen(4_800), note: "도쿄 공연장 한정" },
  paid: { name: "팬클럽 한정 포토북 (가상)", category: "jp-idol", priceYen: yen(6_600), note: "" },
  hub: { name: "한정 아크릴 키링 세트 (가상)", category: "anime-character", priceYen: yen(3_300), note: "" },
  dispute: { name: "피규어 「밤하늘 소녀」 (가상)", category: "anime-character", priceYen: yen(9_800), note: "미개봉 박스" },
  done: { name: "아이돌 표지 잡지 12월호 (가상)", category: "idol-magazine", priceYen: yen(1_500), note: "" },
} as const satisfies Record<string, Item>;

// The order the presenter creates live in the demo script.
export const HERO_ITEM_INPUT = {
  name: "미개봉 확장팩 박스 「별빛 탐험대」 (가상)",
  category: "pokemon-sealed",
  priceYen: "5400",
  sealed: true,
  note: "포켓몬센터 한정 프로모 동봉판",
} as const;

function seedOrders(): Order[] {
  return [
    build("seed-open", SEED_ITEMS.open, at(21, 9), [
      { type: "placeBid", bid: bid("seed-open-b1", "trav-yui", 8_000, "金曜日にソウルへ行きます。", at(21, 11)) },
    ]),
    build("seed-paid", SEED_ITEMS.paid, at(20, 9), [
      { type: "placeBid", bid: bid("seed-paid-b1", "trav-yui", 9_000, "", at(20, 10)) },
      { type: "selectBid", bidId: "seed-paid-b1", at: at(20, 12) },
      { type: "pay", delivery: { kind: "in_person" }, at: at(20, 12) },
    ]),
    build("seed-hub", SEED_ITEMS.hub, at(18, 9), [
      { type: "placeBid", bid: bid("seed-hub-b1", "trav-haruto", 5_000, "", at(18, 10)) },
      { type: "selectBid", bidId: "seed-hub-b1", at: at(18, 11) },
      { type: "pay", delivery: { kind: "hub", hub: "hongdae" }, at: at(18, 11) },
      proof(at(19, 8), "2026-11-19"),
      { type: "checkInHub", at: at(21, 15) },
    ]),
    build("seed-dispute", SEED_ITEMS.dispute, at(16, 9), [
      { type: "placeBid", bid: bid("seed-dispute-b1", "trav-haruto", 12_000, "", at(16, 10)) },
      { type: "selectBid", bidId: "seed-dispute-b1", at: at(16, 11) },
      { type: "pay", delivery: { kind: "in_person" }, at: at(16, 11) },
      proof(at(17, 8), "2026-11-17"),
      { type: "handOverInPerson", at: at(21, 18) },
    ]),
    build("seed-done", SEED_ITEMS.done, at(10, 9), [
      { type: "placeBid", bid: bid("seed-done-b1", "trav-yui", 3_000, "", at(10, 10)) },
      { type: "selectBid", bidId: "seed-done-b1", at: at(10, 11) },
      { type: "pay", delivery: { kind: "hub", hub: "myeongdong" }, at: at(10, 11) },
      proof(at(11, 8), "2026-11-11"),
      { type: "checkInHub", at: at(12, 15) },
      { type: "checkOutHub", at: at(13, 12) },
      { type: "confirmReceipt", at: at(13, 12) },
      { type: "choosePayout", method: "prepaid_card", at: at(13, 13) },
    ]),
  ];
}

function seedChats(): ChatMessage[] {
  const msg = (id: string, orderId: string, fromUserId: string, locale: "ko" | "ja", text: string, time: string): ChatMessage => ({
    id,
    orderId,
    fromUserId,
    originalLocale: locale,
    text,
    at: time,
  });
  return [
    msg("seed-c1", "seed-hub", "buyer-minji", "ko", "언제쯤 서울에 도착하세요?", at(18, 12)),
    msg("seed-c2", "seed-hub", "trav-haruto", "ja", "土曜日にソウルに着きます。", at(18, 13)),
    msg("seed-c3", "seed-dispute", "buyer-minji", "ko", "포장이 이미 뜯어져 있었어요.", at(21, 19)),
  ];
}

export function seedState(): DemoState {
  return { version: 1, session: { role: "buyer", localeOverride: null }, orders: seedOrders(), chats: seedChats() };
}
