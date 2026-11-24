import { distanceMetres, type GeographicPoint } from "../../lib/geolocation";
import { getSubwayTransfer, subwayStations, type SubwayStation } from "./subway-network";
import coordinates from "./station-coordinates.json";

const byCode: Record<string, number[] | undefined> = coordinates;
const nearbyRadiusMetres = 3_000;
const maxAccuracyMetres = 500;

export type NearbyStation = {
  distance: number;
  lines: SubwayStation[];
};

export function findNearbyStations({ latitude, longitude, accuracy }: Pick<GeolocationCoordinates, "latitude" | "longitude" | "accuracy">): NearbyStation[] | null {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
      !Number.isFinite(accuracy) || accuracy < 0 || accuracy > maxAccuracyMetres) {
    return null;
  }

  const current: GeographicPoint = [latitude, longitude];
  const nearby = subwayStations.flatMap((station) => {
    const point = byCode[station.code];
    if (!point) return [];
    const [lat, lng] = point;
    const distance = distanceMetres(current, [lat, lng]);
    return Number.isFinite(distance) ? [{ station, distance }] : [];
  }).sort((a, b) => a.distance - b.distance);

  const groups: NearbyStation[] = [];
  const added = new Set<string>();
  for (const { station, distance } of nearby) {
    if (groups.length === 3 || distance > nearbyRadiusMetres) break;
    if (added.has(station.code)) continue;

    const lines = subwayStations.filter((candidate) =>
      candidate.code === station.code || getSubwayTransfer(station.code, candidate.code),
    );
    lines.forEach(({ code }) => added.add(code));
    groups.push({ distance, lines });
  }
  return groups;
}
