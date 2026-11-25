import { getSubwayNeighbors, getSubwayStation, type SubwayStation } from "./subway-network";

function normalizeLabel(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[\s().·'’‐-]/g, "");
}

export function containsStationName(text: string, station: Pick<SubwayStation, "ko" | "en">) {
  const label = normalizeLabel(text);
  return [station.ko, station.en]
    .map(normalizeLabel)
    .some((name) => name.length >= 2 && label.includes(name));
}

export function readPlatformSign(text: string, confidence: number): SubwayStation | null {
  if (!Number.isFinite(confidence) || confidence < 64) return null;
  const codes = text.normalize("NFKC").toUpperCase().match(/(?<![A-Z0-9-])[A-Z]?\d{3}(?:-\d{1,2})?(?![A-Z0-9-])/g) ?? [];
  const candidates = [...new Set(codes)].flatMap((code) => {
    const station = getSubwayStation(code);
    return station && containsStationName(text, station) ? [station] : [];
  });
  // A long door strip can list the current and adjacent stations. Center the
  // current name and code in the viewfinder if more than one complete pair fits.
  return candidates.length === 1 ? candidates[0] : null;
}

export function readNextStation(text: string, confidence: number, current: string) {
  if (!Number.isFinite(confidence) || confidence < 76) return null;
  const code = text.normalize("NFKC").trim().toUpperCase();
  return getSubwayNeighbors(current).find((station) => station.code === code) ?? null;
}

export function comparePlatformDirection(
  observed: { station: SubwayStation; next: SubwayStation | null },
  boarding: SubwayStation | null,
  expected: SubwayStation | null,
) {
  if (!boarding || !expected) return "no-route";
  if (observed.station.code !== boarding.code) return "other-platform";
  if (!observed.next) return "unconfirmed";
  return observed.next.code === expected.code ? "match" : "different";
}
