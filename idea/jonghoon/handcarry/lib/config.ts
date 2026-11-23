// All demo policy values live here. Values marked TODO(PRD 미정) are assumptions
// recorded in the demo plan, not decided product policy.

export const SERVICE_NAME = {
  ko: "HandCarry (가칭)",
  ja: "HandCarry（仮称）",
} as const;

// Exchange rates as centi-won per 100 yen, so 843.29원 per 100엔 is 84_329.
// Escrow rate: PRD background figure (2026-10-12 close).
export const ESCROW_RATE = { centiWonPer100Yen: 84_329 } as const;
// Receipt-date rate used for traveler settlement. TODO(PRD 미정): bank and quote type undecided.
export const RECEIPT_RATE = { centiWonPer100Yen: 85_120 } as const;

export const PLATFORM_FEE_PERCENT = 5;
// TODO(PRD 미정): minimum traveler reward. Demo uses 10% of the item price in won.
export const MIN_REWARD_PERCENT = 10;
export const MIN_REWARD_ROUNDING_WON = 100;
export const MAX_ITEM_PRICE_YEN = 100_000;

export const HUBS = ["myeongdong", "hongdae"] as const;
