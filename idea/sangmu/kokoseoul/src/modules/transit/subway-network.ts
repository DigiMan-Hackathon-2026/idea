import { lineTwoServices } from "./line-two";
import { subwayStations, type SubwayStation } from "./subway-stations";

export { subwayStations, type SubwayStation };
export type SubwayTrain = "local" | "express";

const stationsByCode = new Map(subwayStations.map((station) => [station.code, station]));

export function getSubwayStation(code: string) {
  return stationsByCode.get(code);
}

function range(start: number, end: number, prefix = "") {
  return Array.from({ length: end - start + 1 }, (_, index) => prefix + (start + index))
    .filter((code) => stationsByCode.has(code));
}

// Shared track appears in each service that can continue without changing trains.
const lineOneNorth = ["100-3", "100-2", "100-1", ...range(100, 141)];
const lineOneSouth = [...range(119, 141), ...range(142, 177, "P")];
const lineFiveWest = range(510, 548);
// Seoul Metro Line 9 marks these stops in the operator's station guide.
const lineNineExpress = [
  "902", "905", "907", "910", "913", "915", "917", "920",
  "923", "925", "927", "929", "930", "933", "936", "938",
];

export function isLineNineExpressStop(code: string) {
  return lineNineExpress.includes(code);
}

const services = [
  ...lineTwoServices,
  range(309, 352),
  [...lineOneNorth, ...range(142, 161)],
  lineOneSouth,
  [...lineOneSouth.slice(0, lineOneSouth.indexOf("P157") + 1), "P157-1"],
  [...range(139, 141), ...range(142, 144, "P"), "P144-1"],
  range(405, 456),
  [...lineFiveWest, ...range(549, 558)],
  [...lineFiveWest, ...range(549, 555, "P")],
  ["610", ...range(616, 648)],
  range(709, 761),
  range(804, 827),
  range(901, 938),
  lineNineExpress,
];
const expressService = services.length - 1;

// Confirmed transfer stations on the Seoul Metro map. Chongshin Univ. and Isu
// share a transfer despite the different Korean names used on the platforms.
const transferStations = [
  ["113", "710"], ["116", "412"], ["120", "644"], ["126", "211-4"],
  ["127", "636"], ["128", "421"], ["130", "329", "534"], ["132", "201"],
  ["133", "426"], ["136", "917"], ["138", "525"], ["140", "234"],
  ["145", "750"], ["P142", "746"], ["P149", "443"],
  ["203", "330"], ["204", "535"], ["205", "422", "536"], ["206", "635"],
  ["208", "540"], ["212", "727"], ["216", "814"], ["218", "930"],
  ["223", "340"], ["226", "433"], ["233", "744"], ["234-4", "518"],
  ["236", "523"], ["237", "913"], ["238", "622"], ["243", "531"],
  ["321", "614"], ["322", "612"], ["331", "423"], ["333", "633"],
  ["339", "734", "923"], ["350", "817"], ["352", "P552"],
  ["411", "713"], ["428", "628"], ["431", "920"], ["432", "736"],
  ["512", "902"], ["526", "915"], ["529", "626"], ["537", "634"],
  ["544", "725"], ["547", "811"], ["P550", "936"], ["645", "717"], ["815", "933"],
];

type Change = { from: SubwayStation; to: SubwayStation };
type Edge = { to: string; service: number | null };
const edgesByCode = new Map(subwayStations.map(({ code }) => [code, [] as Edge[]]));

function connect(from: string, to: string, service: number | null) {
  edgesByCode.get(from)!.push({ to, service });
}

services.forEach((stops, service) => {
  for (let index = 1; index < stops.length; index++) {
    connect(stops[index - 1], stops[index], service);
    connect(stops[index], stops[index - 1], service);
  }
});

// Line 6 runs clockwise through Eungam's loop, with no reverse service.
const eungamLoop = [...range(610, 615), "610"];
const lineSixService = services.findIndex((stops) => stops[0] === "610");
for (let index = 1; index < eungamLoop.length; index++) {
  connect(eungamLoop[index - 1], eungamLoop[index], lineSixService);
}

for (const group of transferStations) {
  for (const from of group) {
    for (const to of group) {
      if (from !== to) connect(from, to, null);
    }
  }
}

export function getSubwayNeighbors(code: string, train: SubwayTrain = "local") {
  const express = train === "express" && isLineNineExpressStop(code);
  const neighbors = new Set(edgesByCode.get(code)
    ?.filter(({ service }) => service !== null && (service === expressService) === express)
    .map(({ to }) => to));
  return Array.from(neighbors, (neighbor) => stationsByCode.get(neighbor)!);
}

export function getSubwayTransfer(origin: string, target: string): Change | undefined {
  if (edgesByCode.get(origin)?.some(({ to, service }) => service === null && to === target)) {
    return { from: stationsByCode.get(origin)!, to: stationsByCode.get(target)! };
  }
}

type Visit = {
  code: string;
  service: number | null;
  transfers: number;
  rideStops: number;
  previous?: Visit;
  change?: Change;
};

function compare(a: Visit, b: Visit) {
  return a.transfers - b.transfers || a.rideStops - b.rideStops;
}

function itinerary(arrival: Visit) {
  const visits = [arrival];
  for (let visit = arrival.previous; visit; visit = visit.previous) visits.push(visit);
  visits.reverse();
  const firstStep = visits[1];
  const changeNow = firstStep?.service === null ? firstStep.change : undefined;
  const changes = visits.flatMap(({ change }) => change ? [change] : []);
  const firstChange = changes[0];
  return {
    stops: visits.map(({ code }) => stationsByCode.get(code)!),
    rideStops: arrival.rideStops,
    changes,
    next: firstStep && !changeNow ? stationsByCode.get(firstStep.code) : undefined,
    changeNow,
    localChange: firstStep?.service === expressService && firstChange && firstChange.from.code === firstChange.to.code
      ? firstChange.from : undefined,
  };
}

// Express mode describes the current train. After leaving it, the route uses
// the same local network as the default mode.
export function getSubwayTrip(origin: string, destination: string, train: SubwayTrain = "local") {
  if (!stationsByCode.has(origin) || !stationsByCode.has(destination)) return null;
  const initial: Visit = {
    code: origin,
    service: train === "express" && isLineNineExpressStop(origin) ? expressService : null,
    transfers: 0,
    rideStops: 0,
  };
  const queue = [initial];
  const visited = new Set<string>();

  while (queue.length > 0) {
    queue.sort((a, b) => compare(b, a));
    const visit = queue.pop()!;
    const key = `${visit.code}:${visit.service}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (visit.code === destination) return itinerary(visit);

    for (const { to, service } of edgesByCode.get(visit.code)!) {
      if (service === expressService && visit.service !== expressService) continue;
      if (visit === initial && initial.service === expressService && service !== expressService) continue;
      if (visited.has(`${to}:${service}`)) continue;
      const interline = service === null;
      const change = interline || (visit.service !== null && service !== visit.service)
        ? { from: stationsByCode.get(visit.code)!, to: stationsByCode.get(interline ? to : visit.code)! }
        : undefined;
      queue.push({
        code: to,
        service,
        previous: visit,
        change,
        transfers: visit.transfers + Number(Boolean(change)),
        rideStops: visit.rideStops + Number(!interline),
      });
    }
  }
  return null;
}

// Use the first edge from the boarding platform to distinguish opposite
// directions using names that can appear on signs beyond the rider's stop.
export function getSubwaySignDirections(platform: string, destination: string) {
  const boarding = getSubwayStation(platform);
  const next = getSubwayTrip(platform, destination)?.next;
  if (!boarding || !next || next.line !== boarding.line) return null;

  const forward = new Set<string>();
  const away = new Set<string>();
  for (const stop of subwayStations) {
    if (stop.line !== boarding.line || stop.code === platform) continue;
    const first = getSubwayTrip(platform, stop.code)?.next;
    if (first) (first.code === next.code ? forward : away).add(stop.code);
  }
  return { next, forward: Array.from(forward), away: Array.from(away) };
}
