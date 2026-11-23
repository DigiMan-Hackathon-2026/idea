import { ESCROW_RATE, RECEIPT_RATE } from "../config";
import { buyerBreakdown, fxDiff, minReward, toWon, travelerSettlement } from "./money";
import type { Bid, Delivery, DisputeWinner, Item, Order, OrderStatus, PayoutMethod, Proof, Role } from "./types";

export type OrderEvent =
  | { type: "placeBid"; bid: Bid }
  | { type: "selectBid"; bidId: string; at: string }
  | { type: "pay"; delivery: Delivery; at: string }
  | { type: "uploadProof"; proof: Proof }
  | { type: "checkInHub"; at: string }
  | { type: "checkOutHub"; at: string }
  | { type: "handOverInPerson"; at: string }
  | { type: "confirmReceipt"; at: string }
  | { type: "rejectReceipt"; reason: string; at: string }
  | { type: "rule"; winner: DisputeWinner; at: string }
  | { type: "choosePayout"; method: PayoutMethod; at: string };
export type OrderEventType = OrderEvent["type"];

export type DomainErrorCode =
  | "illegal_transition"
  | "reward_below_minimum"
  | "bid_not_found"
  | "delivery_mismatch"
  | "reason_required"
  | "already_paid_out";

export class DomainError extends Error {
  constructor(readonly code: DomainErrorCode) {
    super(code);
    this.name = "DomainError";
  }
}

type Rule = {
  from: readonly OrderStatus[];
  actor: Role;
  // Extra precondition beyond the status, so the UI only offers events that can succeed.
  guard?: (o: Order) => boolean;
};

const isHub = (o: Order) => o.payment?.delivery.kind === "hub";

// Event order here is the order availableEvents reports them in.
const RULES: Record<OrderEventType, Rule> = {
  placeBid: { from: ["open"], actor: "traveler" },
  selectBid: { from: ["open"], actor: "buyer", guard: (o) => o.bids.length > 0 },
  pay: { from: ["awaiting_payment"], actor: "buyer" },
  uploadProof: { from: ["paid"], actor: "traveler" },
  checkInHub: { from: ["purchased"], actor: "operator", guard: isHub },
  checkOutHub: { from: ["at_hub"], actor: "operator" },
  handOverInPerson: { from: ["purchased"], actor: "traveler", guard: (o) => !isHub(o) },
  confirmReceipt: { from: ["delivered"], actor: "buyer" },
  rejectReceipt: { from: ["delivered"], actor: "buyer" },
  rule: { from: ["disputed"], actor: "operator" },
  choosePayout: {
    from: ["completed", "resolved_traveler"],
    actor: "traveler",
    guard: (o) => o.settlement !== undefined && o.settlement.paidOutAt === undefined,
  },
};
const EVENT_TYPES = Object.keys(RULES) as OrderEventType[];

export function createOrder(input: { id: string; buyerId: string; item: Item; createdAt: string }): Order {
  return { ...input, status: "open", history: [{ status: "open", at: input.createdAt }], bids: [] };
}

export function availableEvents(order: Order): OrderEventType[] {
  return EVENT_TYPES.filter((t) => RULES[t].from.includes(order.status) && (RULES[t].guard?.(order) ?? true));
}

export function nextActor(order: Order): Role | null {
  const events = availableEvents(order);
  if (events.length === 0) return null;
  // Once a bid exists, the open order is waiting on the buyer's choice, not more bids.
  if (events.includes("selectBid")) return "buyer";
  return RULES[events[0]].actor;
}

function moveTo(order: Order, status: OrderStatus, at: string, patch: Partial<Order> = {}): Order {
  return { ...order, ...patch, status, history: [...order.history, { status, at }] };
}

function selectedBid(order: Order): Bid {
  const found = order.bids.find((b) => b.id === order.selectedBidId);
  if (!found) throw new DomainError("bid_not_found");
  return found;
}

function settle(order: Order) {
  const bid = selectedBid(order);
  const s = travelerSettlement(order.item.priceYen, bid.reward, RECEIPT_RATE);
  const escrowItemWon = order.payment?.breakdown.itemWon ?? toWon(order.item.priceYen, ESCROW_RATE);
  return { ...s, fxDiffWon: fxDiff(escrowItemWon, s.itemWon) };
}

export function transition(order: Order, event: OrderEvent): Order {
  if (!RULES[event.type].from.includes(order.status)) throw new DomainError("illegal_transition");

  switch (event.type) {
    case "placeBid": {
      if (event.bid.reward < minReward(toWon(order.item.priceYen, ESCROW_RATE))) {
        throw new DomainError("reward_below_minimum");
      }
      const others = order.bids.filter((b) => b.travelerId !== event.bid.travelerId);
      return { ...order, bids: [...others, event.bid] };
    }
    case "selectBid": {
      if (!order.bids.some((b) => b.id === event.bidId)) throw new DomainError("bid_not_found");
      return moveTo(order, "awaiting_payment", event.at, { selectedBidId: event.bidId });
    }
    case "pay": {
      const breakdown = buyerBreakdown(order.item.priceYen, selectedBid(order).reward, ESCROW_RATE);
      return moveTo(order, "paid", event.at, { payment: { delivery: event.delivery, breakdown, paidAt: event.at } });
    }
    case "uploadProof":
      return moveTo(order, "purchased", event.proof.uploadedAt, { proof: event.proof });
    case "checkInHub":
      if (!isHub(order)) throw new DomainError("delivery_mismatch");
      return moveTo(order, "at_hub", event.at, { hubCheckedInAt: event.at });
    case "checkOutHub":
      return moveTo(order, "delivered", event.at, { deliveredAt: event.at });
    case "handOverInPerson":
      if (isHub(order)) throw new DomainError("delivery_mismatch");
      return moveTo(order, "delivered", event.at, { deliveredAt: event.at });
    case "confirmReceipt":
      return moveTo(order, "completed", event.at, { settlement: settle(order) });
    case "rejectReceipt": {
      const reason = event.reason.trim();
      if (!reason) throw new DomainError("reason_required");
      return moveTo(order, "disputed", event.at, { dispute: { reason, openedAt: event.at } });
    }
    case "rule": {
      const dispute = { ...order.dispute!, ruling: { winner: event.winner, decidedAt: event.at } };
      if (event.winner === "buyer") {
        return moveTo(order, "resolved_buyer", event.at, {
          dispute,
          refund: { amount: order.payment!.breakdown.total, at: event.at },
        });
      }
      return moveTo(order, "resolved_traveler", event.at, { dispute, settlement: settle(order) });
    }
    case "choosePayout": {
      if (!order.settlement || order.settlement.paidOutAt) throw new DomainError("already_paid_out");
      return { ...order, settlement: { ...order.settlement, payoutMethod: event.method, paidOutAt: event.at } };
    }
  }
}
