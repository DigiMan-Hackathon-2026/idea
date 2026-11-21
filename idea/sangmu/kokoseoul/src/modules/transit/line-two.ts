export type LineTwoStation = {
  code: string;
  ko: string;
  ja: string;
  en: string;
};

function station(code: string, ko: string, ja: string, en: string): LineTwoStation {
  return { code, ko, ja, en };
}

// Order follows the Seoul Metropolitan Government route map. Codes are the
// external numbers on signs, including the hyphenated branch numbers.
const loop = [
  station("201", "시청", "市庁", "City Hall"),
  station("202", "을지로입구", "乙支路入口", "Euljiro 1(il)-ga"),
  station("203", "을지로3가", "乙支路3街", "Euljiro 3(sam)-ga"),
  station("204", "을지로4가", "乙支路4街", "Euljiro 4(sa)-ga"),
  station("205", "동대문역사문화공원", "東大門歴史文化公園", "Dongdaemun History & Culture Park"),
  station("206", "신당", "新堂", "Sindang"),
  station("207", "상왕십리", "上往十里", "Sangwangsimni"),
  station("208", "왕십리", "往十里", "Wangsimni"),
  station("209", "한양대", "漢陽大", "Hanyang Univ."),
  station("210", "뚝섬", "トゥクソム", "Ttukseom"),
  station("211", "성수", "聖水", "Seongsu"),
  station("212", "건대입구", "建大入口", "Konkuk Univ."),
  station("213", "구의", "九宜", "Guui"),
  station("214", "강변", "江辺", "Gangbyeon"),
  station("215", "잠실나루", "蚕室ナル", "Jamsillaru"),
  station("216", "잠실", "蚕室", "Jamsil"),
  station("217", "잠실새내", "蚕室セネ", "Jamsilsaenae"),
  station("218", "종합운동장", "総合運動場", "Sports Complex"),
  station("219", "삼성", "三成", "Samseong"),
  station("220", "선릉", "宣陵", "Seolleung"),
  station("221", "역삼", "駅三", "Yeoksam"),
  station("222", "강남", "江南", "Gangnam"),
  station("223", "교대", "教大", "Seoul Nat'l Univ. of Education"),
  station("224", "서초", "瑞草", "Seocho"),
  station("225", "방배", "方背", "Bangbae"),
  station("226", "사당", "舎堂", "Sadang"),
  station("227", "낙성대", "落星垈", "Nakseongdae"),
  station("228", "서울대입구", "ソウル大入口", "Seoul Nat'l Univ."),
  station("229", "봉천", "奉天", "Bongcheon"),
  station("230", "신림", "新林", "Sillim"),
  station("231", "신대방", "新大方", "Sindaebang"),
  station("232", "구로디지털단지", "九老デジタル団地", "Guro Digital Complex"),
  station("233", "대림", "大林", "Daerim"),
  station("234", "신도림", "新道林", "Sindorim"),
  station("235", "문래", "文来", "Mullae"),
  station("236", "영등포구청", "永登浦区庁", "Yeongdeungpo-gu Office"),
  station("237", "당산", "堂山", "Dangsan"),
  station("238", "합정", "合井", "Hapjeong"),
  station("239", "홍대입구", "弘大入口", "Hongik Univ."),
  station("240", "신촌", "新村", "Sinchon"),
  station("241", "이대", "梨大", "Ewha Womans Univ."),
  station("242", "아현", "阿峴", "Ahyeon"),
  station("243", "충정로", "忠正路", "Chungjeongno"),
];

const seongsuBranch = [
  station("211-1", "용답", "龍踏", "Yongdap"),
  station("211-2", "신답", "新踏", "Sindap"),
  station("211-3", "용두", "龍頭", "Yongdu"),
  station("211-4", "신설동", "新設洞", "Sinseol-dong"),
];
const sindorimBranch = [
  station("234-1", "도림천", "道林川", "Dorimcheon"),
  station("234-2", "양천구청", "陽川区庁", "Yangcheon-gu Office"),
  station("234-3", "신정네거리", "新亭ネゴリ", "Sinjeongnegeori"),
  station("234-4", "까치산", "カチ山", "Kkachisan"),
];

export const lineTwoStations = [...loop, ...seongsuBranch, ...sindorimBranch];
const stationsByCode = new Map(lineTwoStations.map((item) => [item.code, item]));
const segments = [
  { id: "loop", codes: [...loop.map(({ code }) => code), loop[0].code] },
  { id: "seongsu", codes: ["211", ...seongsuBranch.map(({ code }) => code)] },
  { id: "sindorim", codes: ["234", ...sindorimBranch.map(({ code }) => code)] },
] as const;

type SegmentId = (typeof segments)[number]["id"];
type Edge = { next: string; segment: SegmentId };
const edges = new Map(lineTwoStations.map(({ code }) => [code, [] as Edge[]]));

for (const { id, codes } of segments) {
  for (let index = 1; index < codes.length; index++) {
    const from = codes[index - 1];
    const to = codes[index];
    edges.get(from)!.push({ next: to, segment: id });
    edges.get(to)!.push({ next: from, segment: id });
  }
}

export function getLineTwoStation(code: string) {
  return stationsByCode.get(code);
}

export function getLineTwoNeighbors(code: string) {
  return (edges.get(code) ?? []).map(({ next }) => stationsByCode.get(next)!);
}

// Adjacent stops have equal weight. This returns the fewest stops on Line 2.
// The branch junctions split consecutive edges into separate boarding segments.
export function getLineTwoTrip(origin: string, destination: string) {
  if (!stationsByCode.has(origin) || !stationsByCode.has(destination)) return null;
  const queue = [origin];
  const previous = new Map<string, { from: string; segment: SegmentId }>();
  for (let index = 0; index < queue.length && !previous.has(destination) && origin !== destination; index++) {
    const from = queue[index];
    for (const { next, segment } of edges.get(from) ?? []) {
      if (next === origin || previous.has(next)) continue;
      previous.set(next, { from, segment });
      queue.push(next);
    }
  }
  if (origin !== destination && !previous.has(destination)) return null;

  const codes = [destination];
  const journeySegments: SegmentId[] = [];
  for (let at = destination; at !== origin;) {
    const edge = previous.get(at)!;
    journeySegments.push(edge.segment);
    at = edge.from;
    codes.push(at);
  }
  codes.reverse();
  journeySegments.reverse();
  const stops = codes.map((code) => stationsByCode.get(code)!);
  return {
    stops,
    changes: journeySegments.flatMap((segment, index) =>
      index > 0 && segment !== journeySegments[index - 1] ? [stops[index]] : [],
    ),
  };
}
