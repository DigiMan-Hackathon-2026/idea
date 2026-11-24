// Resolves the public place ids used in /go links (spec §7: URLs carry only
// verified public place ids).
import { areaAsPlace, findArea, findRestaurant } from "./places";
import { estimateLeg } from "./travel";
import type { Point, TravelLeg } from "./types";

export type GoPlace = {
  ref: string;
  nameJa: string;
  nameKo: string;
  point: Point;
  addressKo: string | null;
  stationCode: string | null;
  test: boolean;
  approximate: boolean;
};

export function resolveGoPlace(ref: string | null | undefined): GoPlace | null {
  if (!ref || ref.length > 80) return null;
  const [kind, id] = ref.split(":", 2);
  if (!id || !/^[a-z0-9-]+$/.test(id)) return null;
  if (kind === "r") {
    const restaurant = findRestaurant(id);
    if (!restaurant) return null;
    const area = findArea(restaurant.areaId);
    return { ref, nameJa: restaurant.nameJa, nameKo: restaurant.nameKo, point: restaurant.point, addressKo: restaurant.addressKo, stationCode: area?.stationCode ?? null, test: restaurant.test, approximate: false };
  }
  const area = findArea(id);
  if (!area || (kind !== "a" && kind !== "v")) return null;
  const place = areaAsPlace(area);
  const venue = kind === "v";
  return {
    ref,
    nameJa: venue ? `${place.nameJa}のライブ会場` : `${place.nameJa}駅`,
    nameKo: venue ? `${place.nameKo} 공연장` : `${place.nameKo}역`,
    point: place.point,
    addressKo: null,
    stationCode: place.stationCode,
    test: false,
    approximate: true,
  };
}

export function goLeg(from: GoPlace | null, to: GoPlace, now: string): TravelLeg | null {
  return from ? estimateLeg(from.point, to.point, now) : null;
}

/** Use the 여기서울 subway guide when the trip changes stations. */
export function subwayTarget(from: GoPlace | null, to: GoPlace): string | null {
  if (!to.stationCode) return null;
  if (from?.stationCode && from.stationCode === to.stationCode) return null;
  return to.stationCode;
}
