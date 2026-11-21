import { getLineTwoNeighbors, getLineTwoTrip, lineTwoStations, type LineTwoStation } from "./line-two";

export type SubwayStation = LineTwoStation & { line: 2 | 3 };
type Change = { from: SubwayStation; to: SubwayStation };
type Leg = { stops: SubwayStation[]; changes: Change[] };

function lineThreeStation(code: string, ko: string, ja: string, en: string): SubwayStation {
  return { code, ko, ja, en, line: 3 };
}

// External station numbers and order follow the Seoul Metropolitan Government route map.
const lineThree = [
  lineThreeStation("309", "대화", "大化", "Daehwa"),
  lineThreeStation("310", "주엽", "注葉", "Juyeop"),
  lineThreeStation("311", "정발산", "鼎鉢山", "Jeongbalsan"),
  lineThreeStation("312", "마두", "馬頭", "Madu"),
  lineThreeStation("313", "백석", "白石", "Baekseok"),
  lineThreeStation("314", "대곡", "大谷", "Daegok"),
  lineThreeStation("315", "화정", "花井", "Hwajeong"),
  lineThreeStation("316", "원당", "元堂", "Wondang"),
  lineThreeStation("317", "원흥", "元興", "Wonheung"),
  lineThreeStation("318", "삼송", "三松", "Samsong"),
  lineThreeStation("319", "지축", "紙杻", "Jichuk"),
  lineThreeStation("320", "구파발", "旧把撥", "Gupabal"),
  lineThreeStation("321", "연신내", "ヨンシンネ", "Yeonsinnae"),
  lineThreeStation("322", "불광", "仏光", "Bulgwang"),
  lineThreeStation("323", "녹번", "碌磻", "Nokbeon"),
  lineThreeStation("324", "홍제", "弘済", "Hongje"),
  lineThreeStation("325", "무악재", "毋岳チェ", "Muakjae"),
  lineThreeStation("326", "독립문", "独立門", "Dongnimmun"),
  lineThreeStation("327", "경복궁", "景福宮", "Gyeongbokgung"),
  lineThreeStation("328", "안국", "安国", "Anguk"),
  lineThreeStation("329", "종로3가", "鐘路3街", "Jongno 3(sam)-ga"),
  lineThreeStation("330", "을지로3가", "乙支路3街", "Euljiro 3(sam)-ga"),
  lineThreeStation("331", "충무로", "忠武路", "Chungmuro"),
  lineThreeStation("332", "동대입구", "東大入口", "Dongguk Univ."),
  lineThreeStation("333", "약수", "薬水", "Yaksu"),
  lineThreeStation("334", "금호", "金湖", "Geumho"),
  lineThreeStation("335", "옥수", "玉水", "Oksu"),
  lineThreeStation("336", "압구정", "狎鴎亭", "Apgujeong"),
  lineThreeStation("337", "신사", "新沙", "Sinsa"),
  lineThreeStation("338", "잠원", "蚕院", "Jamwon"),
  lineThreeStation("339", "고속터미널", "高速ターミナル", "Express Bus Terminal"),
  lineThreeStation("340", "교대", "教大", "Seoul Nat'l Univ. of Education"),
  lineThreeStation("341", "남부터미널", "南部ターミナル", "Nambu Bus Terminal"),
  lineThreeStation("342", "양재", "良才", "Yangjae"),
  lineThreeStation("343", "매봉", "メボン", "Maebong"),
  lineThreeStation("344", "도곡", "道谷", "Dogok"),
  lineThreeStation("345", "대치", "大峙", "Daechi"),
  lineThreeStation("346", "학여울", "ハンニョウル", "Hangnyeoul"),
  lineThreeStation("347", "대청", "大庁", "Daecheong"),
  lineThreeStation("348", "일원", "逸院", "Irwon"),
  lineThreeStation("349", "수서", "水西", "Suseo"),
  lineThreeStation("350", "가락시장", "可楽市場", "Garak Market"),
  lineThreeStation("351", "경찰병원", "警察病院", "National Police Hospital"),
  lineThreeStation("352", "오금", "梧琴", "Ogeum"),
];

function onLineTwo(station: LineTwoStation): SubwayStation {
  return { ...station, line: 2 };
}

export const subwayStations = [...lineTwoStations.map(onLineTwo), ...lineThree];

const stationsByCode = new Map(subwayStations.map((station) => [station.code, station]));
const lineThreeIndex = new Map(lineThree.map(({ code }, index) => [code, index]));
const connections = [
  { 2: "203", 3: "330" }, // Euljiro 3-ga
  { 2: "223", 3: "340" }, // Seoul Nat'l Univ. of Education
] as const;

export function getSubwayStation(code: string) {
  return stationsByCode.get(code);
}

export function getSubwayNeighbors(code: string) {
  const index = lineThreeIndex.get(code);
  if (index === undefined) return getLineTwoNeighbors(code).map(onLineTwo);
  return [lineThree[index - 1], lineThree[index + 1]].filter(Boolean);
}

function getLeg(line: SubwayStation["line"], origin: string, destination: string): Leg {
  if (line === 2) {
    const trip = getLineTwoTrip(origin, destination)!;
    return {
      stops: trip.stops.map(onLineTwo),
      changes: trip.changes.map(onLineTwo).map((station) => ({ from: station, to: station })),
    };
  }

  const start = lineThreeIndex.get(origin)!;
  const end = lineThreeIndex.get(destination)!;
  const stops = lineThree.slice(Math.min(start, end), Math.max(start, end) + 1);
  return { stops: start <= end ? stops : stops.reverse(), changes: [] };
}

function itinerary(first: Leg, transfer?: Change, second?: Leg) {
  const changeNow = first.stops.length === 1 ? transfer : undefined;
  return {
    stops: [...first.stops, ...(second?.stops ?? [])],
    rideStops: first.stops.length - 1 + (second ? second.stops.length - 1 : 0),
    changes: [...first.changes, ...(transfer ? [transfer] : []), ...(second?.changes ?? [])],
    next: first.stops[1],
    changeNow,
  };
}

// Keep same-line trips on that line. Mixed trips prefer fewer transfers
// (including Line 2 branches), then fewer train stops.
export function getSubwayTrip(origin: string, destination: string) {
  const start = getSubwayStation(origin);
  const end = getSubwayStation(destination);
  if (!start || !end) return null;
  if (start.line === end.line) return itinerary(getLeg(start.line, origin, destination));

  return connections.map((connection) => {
    const from = getSubwayStation(connection[start.line])!;
    const to = getSubwayStation(connection[end.line])!;
    return itinerary(getLeg(start.line, origin, from.code), { from, to }, getLeg(end.line, to.code, destination));
  }).sort((a, b) => a.changes.length - b.changes.length || a.rideStops - b.rideStops)[0];
}
