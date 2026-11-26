import { lineTwoStations } from "./line-two";
import stationRows from "./subway-station-names.json";

export type SubwayLine = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type SubwayStation = { code: string; ko: string; ja: string; en: string; line: SubwayLine };

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

export const subwayStations = [
  ...lineTwoStations.map((station) => ({ ...station, line: 2 as const })),
  ...lineThree,
  ...stationRows.map(([code, ko, ja, en]) => ({ code, ko, ja, en, line: Number(code.replace(/^P/, "")[0]) as SubwayLine })),
].sort((a, b) => a.line - b.line);
