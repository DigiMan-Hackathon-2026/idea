import type { SubwayLine } from "./subway-stations";

export const subwayLineColors = {
  1: "#0052a4",
  2: "#00a84d",
  3: "#ef7c1c",
  4: "#00a5de",
  5: "#996cac",
  6: "#cd7c2f",
  7: "#747f00",
  8: "#e6186c",
  9: "#bdb092",
} as const satisfies Record<SubwayLine, string>;
