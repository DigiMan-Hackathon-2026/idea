import type { HUBS } from "../config";

export type Yen = number & { readonly __brand: "Yen" };
export type Won = number & { readonly __brand: "Won" };

function assertMoney(n: number, unit: string): void {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`${unit} must be a non-negative integer, got ${n}`);
}
export const yen = (n: number): Yen => {
  assertMoney(n, "Yen");
  return n as Yen;
};
export const won = (n: number): Won => {
  assertMoney(n, "Won");
  return n as Won;
};

export type Rate = { readonly centiWonPer100Yen: number };

export type Role = "buyer" | "traveler" | "operator";
export type Locale = "ko" | "ja";

export const CATEGORIES = [
  "pokemon-sealed",
  "kpop-japan-limited",
  "jp-idol",
  "idol-magazine",
  "anime-character",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Hub = (typeof HUBS)[number];
export type Delivery = { kind: "hub"; hub: Hub } | { kind: "in_person" };
export type PayoutMethod = "prepaid_card" | "hub_cash";

export type Item = {
  name: string;
  category: Category;
  priceYen: Yen;
  note: string;
};

export type Bid = {
  id: string;
  travelerId: string;
  reward: Won;
  message: string;
  createdAt: string;
};

export type BuyerBreakdown = { itemWon: Won; reward: Won; fee: Won; total: Won };
export type Payment = { delivery: Delivery; breakdown: BuyerBreakdown; paidAt: string };

export type Proof = { photos: string[]; receiptDate: string; uploadedAt: string };

export type Settlement = {
  itemWon: Won;
  reward: Won;
  total: Won;
  // Settlement item amount minus the escrowed item amount. Positive means the platform absorbs it.
  fxDiffWon: number;
  payoutMethod?: PayoutMethod;
  paidOutAt?: string;
};

export type DisputeWinner = "buyer" | "traveler";
export type Dispute = {
  reason: string;
  openedAt: string;
  ruling?: { winner: DisputeWinner; decidedAt: string };
};

export const ORDER_STATUSES = [
  "open",
  "awaiting_payment",
  "paid",
  "purchased",
  "at_hub",
  "delivered",
  "completed",
  "disputed",
  "resolved_buyer",
  "resolved_traveler",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Order = {
  id: string;
  buyerId: string;
  item: Item;
  createdAt: string;
  status: OrderStatus;
  history: { status: OrderStatus; at: string }[];
  bids: Bid[];
  selectedBidId?: string;
  payment?: Payment;
  proof?: Proof;
  hubCheckedInAt?: string;
  deliveredAt?: string;
  dispute?: Dispute;
  settlement?: Settlement;
  refund?: { amount: Won; at: string };
};
