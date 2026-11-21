export type StationPoint = readonly [latitude: number, longitude: number];

export const stampRadiusMetres = 200;
export const maxLocationAccuracyMetres = 100;

function distanceMetres(from: StationPoint, to: StationPoint) {
  const radians = Math.PI / 180;
  const latitudes = Math.sin(((to[0] - from[0]) * radians) / 2) ** 2;
  const longitudes = Math.sin(((to[1] - from[1]) * radians) / 2) ** 2;
  const chord = latitudes + Math.cos(from[0] * radians) * Math.cos(to[0] * radians) * longitudes;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(Math.min(1, chord)));
}

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
