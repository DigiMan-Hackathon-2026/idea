import { distanceMetres, type GeographicPoint } from "../../lib/geolocation";

export type StationPoint = GeographicPoint;

export const stampRadiusMetres = 200;
export const maxLocationAccuracyMetres = 100;

export function checkStampProximity(
  { latitude, longitude, accuracy }: Pick<GeolocationCoordinates, "latitude" | "longitude" | "accuracy">,
  stationPoints: readonly StationPoint[],
) {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
      !Number.isFinite(accuracy) || accuracy < 0 || accuracy > maxLocationAccuracyMetres) {
    return "inaccurate";
  }
  const distance = Math.min(...stationPoints.map((point) => distanceMetres([latitude, longitude], point)));
  if (distance > stampRadiusMetres) return "too-far";
  // Require the browser's reported uncertainty to fit inside the radius.
  return distance + accuracy <= stampRadiusMetres ? "nearby" : "inaccurate";
}
