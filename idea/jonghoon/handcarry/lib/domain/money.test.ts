import { describe, expect, test } from "vitest";
import { ESCROW_RATE, RECEIPT_RATE } from "../config";
import { buyerBreakdown, fee, fxDiff, minReward, toWon, travelerSettlement } from "./money";
import { won, yen } from "./types";

describe("toWon", () => {
  test("converts yen at the escrow rate of 843.29 won per 100 yen", () => {
    expect(toWon(yen(100), ESCROW_RATE)).toBe(843);
    expect(toWon(yen(12_000), ESCROW_RATE)).toBe(101_195); // 101,194.8
  });

  test("rounds half up", () => {
    // 2 yen * 8.4329 = 16.8658 → 17; 50 yen at 851.20 = 425.6 → 426
    expect(toWon(yen(2), ESCROW_RATE)).toBe(17);
    expect(toWon(yen(50), RECEIPT_RATE)).toBe(426);
    expect(toWon(yen(1), { centiWonPer100Yen: 50_000 })).toBe(5); // exactly 5.0
    expect(toWon(yen(1), { centiWonPer100Yen: 25_000 })).toBe(3); // 2.5 → 3
  });

  test("zero yen is zero won", () => {
    expect(toWon(yen(0), ESCROW_RATE)).toBe(0);
  });
});

describe("fee", () => {
  test("is 5% of the item price in won, rounded", () => {
    expect(fee(won(101_195))).toBe(5_060); // 5,059.75
    expect(fee(won(10))).toBe(1); // 0.5 → 1
  });
});

describe("minReward", () => {
  test("is 10% of the item price in won, rounded up to 100 won", () => {
    expect(minReward(won(101_195))).toBe(10_200); // 10,119.5 → 10,200
    expect(minReward(won(100_000))).toBe(10_000); // exact multiple stays
  });
});

describe("buyerBreakdown", () => {
  test("sums item price, reward, and 5% fee on the item price only", () => {
    const b = buyerBreakdown(yen(12_000), won(20_000), ESCROW_RATE);
    expect(b).toEqual({ itemWon: 101_195, reward: 20_000, fee: 5_060, total: 126_255 });
  });

  test("fee does not grow with the reward", () => {
    const low = buyerBreakdown(yen(12_000), won(10_200), ESCROW_RATE);
    const high = buyerBreakdown(yen(12_000), won(50_000), ESCROW_RATE);
    expect(low.fee).toBe(high.fee);
  });
});

describe("travelerSettlement", () => {
  test("pays item price at the receipt-date rate plus the reward", () => {
    const s = travelerSettlement(yen(12_000), won(20_000), RECEIPT_RATE);
    expect(s).toEqual({ itemWon: 102_144, reward: 20_000, total: 122_144 });
  });
});

describe("fxDiff", () => {
  test("is settlement item amount minus escrowed item amount", () => {
    expect(fxDiff(won(101_195), won(102_144))).toBe(949);
    expect(fxDiff(won(102_144), won(101_195))).toBe(-949);
  });
});
