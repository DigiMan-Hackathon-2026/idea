export type GeographicPoint = readonly [latitude: number, longitude: number];

export function distanceMetres(from: GeographicPoint, to: GeographicPoint) {
  const radians = Math.PI / 180;
  const latitudes = Math.sin(((to[0] - from[0]) * radians) / 2) ** 2;
  const longitudes = Math.sin(((to[1] - from[1]) * radians) / 2) ** 2;
  const chord = latitudes + Math.cos(from[0] * radians) * Math.cos(to[0] * radians) * longitudes;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(Math.min(1, chord)));
}
