import { MIN_REWARD_PERCENT, MIN_REWARD_ROUNDING_WON, PLATFORM_FEE_PERCENT } from "../config";
import { won, type BuyerBreakdown, type Rate, type Won, type Yen } from "./types";

// Integer math keeps .5 cases exact: yen * centiWon / 10_000 only has finite binary fractions at .5.
export function toWon(amount: Yen, rate: Rate): Won {
  return won(Math.round((amount * rate.centiWonPer100Yen) / 10_000));
}

export function fee(itemWon: Won): Won {
  return won(Math.round((itemWon * PLATFORM_FEE_PERCENT) / 100));
}

export function minReward(itemWon: Won): Won {
  const raw = (itemWon * MIN_REWARD_PERCENT) / 100;
  return won(Math.ceil(raw / MIN_REWARD_ROUNDING_WON) * MIN_REWARD_ROUNDING_WON);
}

export function buyerBreakdown(priceYen: Yen, reward: Won, escrowRate: Rate): BuyerBreakdown {
  const itemWon = toWon(priceYen, escrowRate);
  const platformFee = fee(itemWon);
  return { itemWon, reward, fee: platformFee, total: won(itemWon + reward + platformFee) };
}

export function travelerSettlement(priceYen: Yen, reward: Won, receiptRate: Rate) {
  const itemWon = toWon(priceYen, receiptRate);
  return { itemWon, reward, total: won(itemWon + reward) };
}

export function fxDiff(escrowItemWon: Won, settlementItemWon: Won): number {
  return settlementItemWon - escrowItemWon;
}
