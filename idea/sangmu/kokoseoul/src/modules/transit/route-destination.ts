import { getSubwayStation, getSubwayTrip, subwayStations } from "./subway-network";

/** Every Line 1–9 platform code of the station a code belongs to (e.g. both Dongdaemun platforms). */
export function stationPlatformCodes(code: string): string[] {
  const station = getSubwayStation(code);
  if (!station) return [];
  return subwayStations.filter((item) => item.ko === station.ko).sort((a, b) => a.line - b.line).map((item) => item.code);
}

const transferCostInStops = 4;

/**
 * Of several platforms at one destination station, the one reached from `origin`
 * with the least effort (a change counts as four stops). Returns `fallback` when
 * the origin is unknown or no platform is reachable.
 */
export function bestDestinationFor(origin: string, options: readonly string[], fallback: string): string {
  if (!getSubwayStation(origin) || options.length === 0) return fallback;
  let best: { code: string; cost: number } | null = null;
  for (const code of options) {
    if (code === origin) return code;
    const trip = getSubwayTrip(origin, code);
    if (!trip) continue;
    const cost = trip.rideStops + trip.changes.length * transferCostInStops;
    if (!best || cost < best.cost) best = { code, cost };
  }
  return best?.code ?? fallback;
}
