import "server-only";

import { subwayStations, type SubwayLine } from "@/modules/transit/subway-stations";
import type { AdventureCategory, AdventureMission } from "./adventure-data";

type PlaceSlot = [id: string, station: string, ko: string, ja: string];
type Words = { ko: string; ja: string };
const words = (ko: string, ja: string): Words => ({ ko, ja });

function station(name: string) {
  const match = subwayStations.find((item) => item.line === 2 && item.ko === name);
  if (!match) throw new Error(`Missing Line 2 station: ${name}`);
  return match;
}

const planned: [AdventureCategory, PlaceSlot[]][] = [
  ["food", [
    ["euljiro1-snack", "을지로입구", "지하상가 밖에서 간식 고르기", "地下商店街を出ておやつを選ぶ"],
    ["euljiro3-bunsik", "을지로3가", "골목에서 분식 주문하기", "路地のお店で軽食を注文する"],
    ["ddp-takeaway", "동대문역사문화공원", "간식 하나 포장하기", "おやつを一つ持ち帰る"],
    ["sindang-tteokbokki", "신당", "떡볶이 메뉴 한 가지 고르기", "トッポッキを一品選ぶ"],
    ["seongsu-bread", "성수", "베이커리에서 빵 주문하기", "ベーカリーでパンを注文する"],
    ["hongdae-dessert", "홍대입구", "디저트 하나 주문하기", "デザートを一つ注文する"],
    ["hapjeong-cafe", "합정", "카페에서 음료 주문하기", "カフェで飲み物を注文する"],
  ]],
  ["sights", [
    ["cityhall-front", "시청", "서울광장에서 서울도서관 정면 찾기", "ソウル広場からソウル図書館の正面を見つける"],
    ["jamsillaru-view", "잠실나루", "한강 쪽 풍경 찾기", "漢江側の景色を探す"],
    ["hapjeong-walk", "합정", "양화진 쪽 공개 산책로 걷기", "楊花津方面の遊歩道を歩く"],
  ]],
  ["culture", [
    ["cityhall-reading-room", "시청", "서울도서관 공개 열람 공간 찾기", "ソウル図書館の閲覧スペースを探す"],
    ["ddp-exhibit", "동대문역사문화공원", "DDP 전시에서 작품 하나 고르기", "DDPの展示で印象に残った作品を選ぶ"],
  ]],
  ["discovery", [
    ["cityhall-history-sign", "시청", "근대 건물의 안내 문구 찾기", "近代建築の案内を見つける"],
    ["euljiro-sign", "을지로3가", "인쇄·조명 상점 간판 찾기", "印刷店や照明店の看板を見つける"],
    ["ddp-old-stadium", "동대문역사문화공원", "옛 운동장 안내판 찾기", "旧運動場の案内板を探す"],
    ["seongsu-factory", "성수", "옛 공장 건축의 흔적 찾기", "かつての工場建築の面影を探す"],
    ["hongdae-poster", "홍대입구", "공연 포스터에서 장르 찾기", "公演ポスターでジャンルを調べる"],
  ]],
  ["challenge", [
    ["forest-seongsu-challenge", "뚝섬", "서울숲과 성수 산업 공간의 단서 찾기", "ソウルの森と聖水で街の手がかりを探す"],
  ]],
  ["theme", [
    ["cityhall-euljiro-architecture", "시청", "시청과 을지로의 건축 단서 비교하기", "市庁と乙支路の建物を見比べる"],
    ["hongdae-hapjeong-culture", "홍대입구", "홍대와 합정의 문화 공간 비교하기", "弘大と合井の文化施設を見比べる"],
  ]],
  ["phrase", [
    ["sindang-order-question", "신당", "어떤 메뉴가 덜 매운지 물어보기", "どのメニューが辛さ控えめか聞く"],
    ["seongsu-shelf-question", "성수", "상품이 어디 있는지 물어보기", "商品の売り場を聞く"],
  ]],
];

const sights: [PlaceSlot, Words, string][] = [
  [["cheonggye-gwansu", "을지로3가", "청계천 관수교에서 물길 바라보기", "清渓川の観水橋から流れを眺める"],
    words("공식 안내도에서 관수교를 찾고, 다리 위에서 청계천의 흐름을 바라보세요.", "公式の案内図で観水橋を探し、橋の上から清渓川の流れを眺めましょう。"),
    "https://www.sisul.or.kr/open_content/cheonggye/enjoy/guide.jsp?bridge=gwansu"],
  [["seoul-forest-path", "뚝섬", "서울숲 가족마당까지 걷기", "ソウルの森のファミリー広場まで歩く"],
    words("안내 지도에서 가족마당을 찾아 야외 산책로를 따라 걸어보세요.", "案内図でファミリー広場を探し、屋外の遊歩道を歩きましょう。"),
    "https://parks.seoul.go.kr/park/detailView.do?pIdx=5"],
  [["gyeongui-rest", "홍대입구", "경의선숲길 연남 구간에서 쉬어가기", "京義線の森の道の延南区間でひと休みする"],
    words("경의선숲길 연남 구간을 걸어보고 쉬고 싶은 자리를 한 곳 골라보세요.", "京義線の森の道の延南区間を歩き、休みたい場所を一つ選んでみましょう。"),
    "https://parks.seoul.go.kr/park/detailView.do?currentPage=2&key=2604070019&pIdx=1383&tabTarget=2"],
];

const stories: [string, string, Words[], number][] = [
  ["ttukseom", "뚝섬", [words("왕의 깃발", "王の旗"), words("나무다리", "木の橋"), words("돌탑", "石塔")], 0],
  ["seongsu", "성수", [words("큰 시장", "大きな市場"), words("맑은 물", "澄んだ水"), words("오래된 성벽", "古い城壁")], 1],
  ["sindang", "신당", [words("장터", "市場"), words("관청", "役所"), words("신령을 모신 집", "神をまつった祠")], 2],
  ["jamsil", "잠실", [words("누에를 키우던 곳", "蚕を育てた場所"), words("배를 만들던 곳", "船を造った場所"), words("말을 돌보던 곳", "馬を飼った場所")], 0],
];

const transfers: [string, string, SubwayLine[], number][] = [
  ["city-hall", "시청", [3, 1, 4], 1],
  ["euljiro3", "을지로3가", [3, 6, 4], 0],
  ["ddp", "동대문역사문화공원", [1, 3, 4], 2],
  ["sindang", "신당", [5, 6, 7], 1],
  ["hapjeong", "합정", [6, 3, 8], 0],
];

export function getLineTwoExtraSlots(): AdventureMission[] {
  const pending = planned.flatMap(([category, slots]) => slots.map(([id, name, ko, ja]): AdventureMission => ({
    type: "planned", id, station: station(name), title: words(ko, ja), category,
  })));
  const walks = sights.map(([[id, name, ko, ja], condition, officialUrl]): AdventureMission => ({
    type: "field", id, station: station(name), title: words(ko, ja), category: "sights", condition, officialUrl,
  }));
  const nameQuizzes = stories.map(([id, name, options, answerIndex]): AdventureMission => {
    const stop = station(name);
    return {
      type: "quiz", id: `story-${id}`, category: "story", station: stop, options, answerIndex,
      title: words(`${name}역 이름의 비밀`, `${stop.ja}駅名の由来`),
      question: words("역 이름과 관련된 단서는 무엇일까요?", "駅名の由来に関係するものはどれでしょう？"),
      href: `/station-album?line=2&station=${encodeURIComponent(name)}#station-story`,
    };
  });
  const transferQuizzes = transfers.map(([id, name, options, answerIndex]): AdventureMission => {
    const stop = station(name);
    const lines = subwayStations.filter(({ ko }) => ko === name).map(({ line }) => line);
    if (options.some((line, index) => lines.includes(line) !== (index === answerIndex))) {
      throw new Error(`Invalid Line 2 transfer question: ${name}`);
    }
    return {
      type: "quiz", id: `transfer-${id}`, category: "transfer", station: stop, answerIndex,
      title: words(`${name}역에서 환승하기`, `${stop.ja}駅で乗り換える`),
      question: words("이 역에서 2호선과 갈아탈 수 있는 호선은 무엇일까요?", "この駅で2号線から乗り換えられるのは何号線でしょう？"),
      options: options.map((line) => words(`${line}호선`, `${line}号線`)),
      href: `/subway?station=${stop.code}#station-interior-title`,
    };
  });
  return [...pending, ...walks, ...nameQuizzes, ...transferQuizzes];
}
