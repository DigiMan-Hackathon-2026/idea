import { describe, expect, test } from "vitest";
import { ESCROW_RATE, RECEIPT_RATE } from "../config";
import { buyerBreakdown, travelerSettlement } from "./money";
import { DomainError, availableEvents, createOrder, nextActor, transition, type OrderEvent } from "./order-machine";
import { won, yen, type Order } from "./types";

const T = (n: number) => `2026-11-22T10:${String(n).padStart(2, "0")}:00.000Z`;
const item = { name: "미개봉 확장팩 박스", category: "pokemon-sealed" as const, priceYen: yen(12_000), note: "" };
const bid = (id: string, travelerId: string, reward: number) => ({
  id,
  travelerId,
  reward: won(reward),
  message: "",
  createdAt: T(1),
});

const fresh = () => createOrder({ id: "o1", buyerId: "buyer-minji", item, createdAt: T(0) });
const run = (order: Order, ...events: OrderEvent[]) => events.reduce(transition, order);

const toPaid = (delivery: "hub" | "in_person") =>
  run(
    fresh(),
    { type: "placeBid", bid: bid("b1", "trav-haruto", 20_000) },
    { type: "selectBid", bidId: "b1", at: T(2) },
    payEvt(delivery),
  );
function payEvt(kind: "hub" | "in_person"): OrderEvent {
  return {
    type: "pay",
    delivery: kind === "hub" ? { kind: "hub", hub: "myeongdong" } : { kind: "in_person" },
    at: T(3),
  };
}
const proof: OrderEvent = {
  type: "uploadProof",
  proof: { photos: ["sample:receipt"], receiptDate: "2026-11-21", uploadedAt: T(4) },
};

describe("createOrder", () => {
  test("starts open with no bids and one history entry", () => {
    const o = fresh();
    expect(o.status).toBe("open");
    expect(o.bids).toEqual([]);
    expect(o.history).toEqual([{ status: "open", at: T(0) }]);
  });
});

describe("bidding", () => {
  test("accepts a bid at or above the minimum reward", () => {
    const o = transition(fresh(), { type: "placeBid", bid: bid("b1", "trav-haruto", 10_200) });
    expect(o.bids).toHaveLength(1);
    expect(o.status).toBe("open");
  });

  test("rejects a bid below 10% of the item price in won", () => {
    expect(() => transition(fresh(), { type: "placeBid", bid: bid("b1", "trav-haruto", 10_100) })).toThrow(
      new DomainError("reward_below_minimum"),
    );
  });

  test("a traveler's second bid replaces their first", () => {
    const o = run(
      fresh(),
      { type: "placeBid", bid: bid("b1", "trav-haruto", 20_000) },
      { type: "placeBid", bid: bid("b2", "trav-yui", 15_000) },
      { type: "placeBid", bid: bid("b3", "trav-haruto", 18_000) },
    );
    expect(o.bids.map((b) => [b.travelerId, b.reward])).toEqual([
      ["trav-yui", 15_000],
      ["trav-haruto", 18_000],
    ]);
  });

  test("selecting an unknown bid fails", () => {
    expect(() => transition(fresh(), { type: "selectBid", bidId: "nope", at: T(2) })).toThrow(
      new DomainError("bid_not_found"),
    );
  });

  test("selecting a bid moves to awaiting_payment", () => {
    const o = run(fresh(), { type: "placeBid", bid: bid("b1", "trav-haruto", 20_000) }, { type: "selectBid", bidId: "b1", at: T(2) });
    expect(o.status).toBe("awaiting_payment");
    expect(o.selectedBidId).toBe("b1");
  });

  test("bids close after selection", () => {
    const o = run(fresh(), { type: "placeBid", bid: bid("b1", "trav-haruto", 20_000) }, { type: "selectBid", bidId: "b1", at: T(2) });
    expect(() => transition(o, { type: "placeBid", bid: bid("b2", "trav-yui", 30_000) })).toThrow(DomainError);
  });
});

describe("payment", () => {
  test("escrows item + selected reward + 5% fee and records the delivery choice", () => {
    const o = toPaid("hub");
    expect(o.status).toBe("paid");
    expect(o.payment).toEqual({
      delivery: { kind: "hub", hub: "myeongdong" },
      breakdown: buyerBreakdown(item.priceYen, won(20_000), ESCROW_RATE),
      paidAt: T(3),
    });
  });

  test("cannot pay before a bid is selected", () => {
    expect(() => transition(fresh(), payEvt("hub"))).toThrow(new DomainError("illegal_transition"));
  });
});

describe("hub delivery path", () => {
  test("purchased → at_hub → delivered → completed creates the traveler settlement", () => {
    const o = run(
      toPaid("hub"),
      proof,
      { type: "checkInHub", at: T(5) },
      { type: "checkOutHub", at: T(6) },
      { type: "confirmReceipt", at: T(7) },
    );
    expect(o.status).toBe("completed");
    expect(o.history.map((h) => h.status)).toEqual([
      "open",
      "awaiting_payment",
      "paid",
      "purchased",
      "at_hub",
      "delivered",
      "completed",
    ]);
    const s = travelerSettlement(item.priceYen, won(20_000), RECEIPT_RATE);
    expect(o.settlement).toEqual({ ...s, fxDiffWon: s.itemWon - o.payment!.breakdown.itemWon });
    expect(o.settlement!.fxDiffWon).toBe(949);
  });

  test("hand-over in person is not allowed for a hub order", () => {
    expect(() => run(toPaid("hub"), proof, { type: "handOverInPerson", at: T(5) })).toThrow(
      new DomainError("delivery_mismatch"),
    );
  });
});

describe("in-person delivery path", () => {
  test("purchased → delivered directly", () => {
    const o = run(toPaid("in_person"), proof, { type: "handOverInPerson", at: T(5) });
    expect(o.status).toBe("delivered");
    expect(o.deliveredAt).toBe(T(5));
  });

  test("hub check-in is not allowed for an in-person order", () => {
    expect(() => run(toPaid("in_person"), proof, { type: "checkInHub", at: T(5) })).toThrow(
      new DomainError("delivery_mismatch"),
    );
  });
});

describe("dispute", () => {
  const delivered = () => run(toPaid("in_person"), proof, { type: "handOverInPerson", at: T(5) });

  test("rejecting receipt opens a dispute", () => {
    const o = transition(delivered(), { type: "rejectReceipt", reason: "포장이 개봉됨", at: T(6) });
    expect(o.status).toBe("disputed");
    expect(o.dispute).toEqual({ reason: "포장이 개봉됨", openedAt: T(6) });
  });

  test("a buyer-win ruling refunds the full escrow, fee included, and pays the traveler nothing", () => {
    const o = run(
      delivered(),
      { type: "rejectReceipt", reason: "가품 의심", at: T(6) },
      { type: "rule", winner: "buyer", at: T(7) },
    );
    expect(o.status).toBe("resolved_buyer");
    expect(o.refund).toEqual({ amount: o.payment!.breakdown.total, at: T(7) });
    expect(o.settlement).toBeUndefined();
    expect(o.dispute!.ruling).toEqual({ winner: "buyer", decidedAt: T(7) });
  });

  test("a traveler-win ruling settles normally", () => {
    const o = run(
      delivered(),
      { type: "rejectReceipt", reason: "단순 변심", at: T(6) },
      { type: "rule", winner: "traveler", at: T(7) },
    );
    expect(o.status).toBe("resolved_traveler");
    expect(o.settlement!.total).toBe(122_144);
    expect(o.refund).toBeUndefined();
  });

  test("a blank reason is rejected", () => {
    expect(() => transition(delivered(), { type: "rejectReceipt", reason: "  ", at: T(6) })).toThrow(
      new DomainError("reason_required"),
    );
  });
});

describe("payout", () => {
  const completed = () =>
    run(toPaid("in_person"), proof, { type: "handOverInPerson", at: T(5) }, { type: "confirmReceipt", at: T(6) });

  test("the traveler chooses a payout method once", () => {
    const o = transition(completed(), { type: "choosePayout", method: "prepaid_card", at: T(7) });
    expect(o.settlement).toMatchObject({ payoutMethod: "prepaid_card", paidOutAt: T(7) });
    expect(o.status).toBe("completed");
    expect(() => transition(o, { type: "choosePayout", method: "hub_cash", at: T(8) })).toThrow(
      new DomainError("already_paid_out"),
    );
  });

  test("payout works after a traveler-win ruling but not after a buyer-win ruling", () => {
    const base = run(toPaid("in_person"), proof, { type: "handOverInPerson", at: T(5) }, { type: "rejectReceipt", reason: "x", at: T(6) });
    const travelerWin = transition(base, { type: "rule", winner: "traveler", at: T(7) });
    expect(transition(travelerWin, { type: "choosePayout", method: "hub_cash", at: T(8) }).settlement!.payoutMethod).toBe("hub_cash");
    const buyerWin = transition(base, { type: "rule", winner: "buyer", at: T(7) });
    expect(() => transition(buyerWin, { type: "choosePayout", method: "hub_cash", at: T(8) })).toThrow(DomainError);
  });
});

describe("transition purity", () => {
  test("never mutates the input order", () => {
    const o = fresh();
    const snapshot = structuredClone(o);
    transition(o, { type: "placeBid", bid: bid("b1", "trav-haruto", 20_000) });
    expect(o).toEqual(snapshot);
  });
});

describe("availableEvents and nextActor", () => {
  test("open: travelers can bid and the buyer can select once a bid exists", () => {
    expect(availableEvents(fresh())).toEqual(["placeBid"]);
    expect(nextActor(fresh())).toBe("traveler");
    const withBid = transition(fresh(), { type: "placeBid", bid: bid("b1", "trav-haruto", 20_000) });
    expect(availableEvents(withBid)).toEqual(["placeBid", "selectBid"]);
    expect(nextActor(withBid)).toBe("buyer");
  });

  test("follows the delivery kind after purchase", () => {
    expect(availableEvents(run(toPaid("hub"), proof))).toEqual(["checkInHub"]);
    // PRD: operators record hub check-in and check-out.
    expect(nextActor(run(toPaid("hub"), proof))).toBe("operator");
    expect(availableEvents(run(toPaid("in_person"), proof))).toEqual(["handOverInPerson"]);
    const atHub = run(toPaid("hub"), proof, { type: "checkInHub", at: T(5) });
    expect(availableEvents(atHub)).toEqual(["checkOutHub"]);
    expect(nextActor(atHub)).toBe("operator");
  });

  test("delivered: buyer confirms or rejects; disputed: operator rules", () => {
    const delivered = run(toPaid("in_person"), proof, { type: "handOverInPerson", at: T(5) });
    expect(availableEvents(delivered)).toEqual(["confirmReceipt", "rejectReceipt"]);
    expect(nextActor(delivered)).toBe("buyer");
    const disputed = transition(delivered, { type: "rejectReceipt", reason: "x", at: T(6) });
    expect(availableEvents(disputed)).toEqual(["rule"]);
    expect(nextActor(disputed)).toBe("operator");
  });

  test("finished orders wait on payout or nobody", () => {
    const completed = run(toPaid("in_person"), proof, { type: "handOverInPerson", at: T(5) }, { type: "confirmReceipt", at: T(6) });
    expect(availableEvents(completed)).toEqual(["choosePayout"]);
    expect(nextActor(completed)).toBe("traveler");
    const paidOut = transition(completed, { type: "choosePayout", method: "prepaid_card", at: T(7) });
    expect(availableEvents(paidOut)).toEqual([]);
    expect(nextActor(paidOut)).toBeNull();
  });
});
