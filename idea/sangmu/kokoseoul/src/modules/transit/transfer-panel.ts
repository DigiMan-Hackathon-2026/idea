import { getSubwayStation, type SubwayStation } from "./subway-network";
import { containsStationName } from "./station-sign";
import type { SignPanel, TransferArrow } from "./transfer-arrow";
import { readTransferSign } from "./transfer-sign";

type Reading = { text: string; confidence: number; coloredStrip?: boolean };
export type SignDirections = { forward: string[]; away: string[] };

function readPanelLine(reading: Reading | null) {
  if (!reading || !Number.isFinite(reading.confidence)) return null;
  const explicit = readTransferSign(reading.text, reading.confidence);
  if (explicit.kind === "read" || !reading.coloredStrip || reading.confidence < 64) return explicit;
  const bilingual = readTransferSign(reading.text, 70);
  if (bilingual.kind !== "read") return explicit;
  const label = reading.text.normalize("NFKC");
  const korean = new RegExp(`(?<!\\d)${bilingual.line}\\s*호\\s*선`);
  const english = new RegExp(`\\bline\\s*${bilingual.line}\\b`, "i");
  return korean.test(label) && english.test(label) ? bilingual : explicit;
}

export function selectTransferArrow(
  panels: SignPanel[],
  readings: (Reading | null)[],
  target: SubwayStation["line"],
  directions: SignDirections | null,
): TransferArrow | null {
  const explicitLines = readings.map(readPanelLine);
  const confirmedOrange = target === 3 ? panels.find((_, index) =>
    readings[index]?.coloredStrip && explicitLines[index]?.kind === "read" && explicitLines[index].line === target) : undefined;
  const countNames = (codes: string[], text: string) => codes.filter((code) => {
    const station = getSubwayStation(code);
    return station && containsStationName(text, station);
  }).length;

  const candidates = [];
  for (const [index, panel] of panels.entries()) {
    const reading = readings[index];
    const explicit = explicitLines[index];
    const reliableText = reading && (reading.confidence >= 70 || explicit?.kind === "read") ? reading.text : "";
    if (explicit?.kind === "read" && explicit.line !== target) continue;
    if (/나가는\s*곳|\bexit\b/i.test(reliableText) && !/갈아타는\s*곳|\btransfer\b/i.test(reliableText)) continue;

    const eligibleStrip = confirmedOrange && reading?.coloredStrip && reading.confidence >= 65
      && Math.abs(panel.arrow.y - confirmedOrange.arrow.y) <= panel.arrow.height;
    const directionText = eligibleStrip ? reading.text : reliableText;
    const forward = directions ? countNames(directions.forward, directionText) : 0;
    const away = directions ? countNames(directions.away, directionText) : 0;
    // When one side explicitly names Line 3, a neighboring section of the
    // same orange strip can be confirmed by two exact route names on one side.
    const corroborated = eligibleStrip && ((forward >= 2 && !away) || (away >= 2 && !forward));
    if (panel.line !== target && explicit?.kind !== "read" && !corroborated) return null;
    const minimumNames = reliableText ? 1 : 2;
    candidates.push({
      arrow: panel.arrow,
      routeMatch: forward >= minimumNames && !away,
      away: away >= minimumNames && !forward,
    });
  }
  if (candidates.length === 1) return candidates[0].away ? null : candidates[0].arrow;
  const matches = candidates.filter(({ routeMatch }) => routeMatch);
  return matches.length === 1 && candidates.every(({ routeMatch, away }) => routeMatch || away) ? matches[0].arrow : null;
}
