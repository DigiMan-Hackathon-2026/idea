import "server-only";

import { findStationQuests, getQuestAccess } from "@/modules/content/quest-access";
import { getCatalogQuestPath, questCatalog } from "@/modules/content/quest-catalog";
import { subwayStations, type SubwayLine, type SubwayStation } from "@/modules/transit/subway-stations";
import { getLineTwoExtraSlots } from "./line-two-book";

export type AdventureCategory = "journey" | "food" | "sights" | "culture" | "shopping" | "show"
  | "discovery" | "challenge" | "story" | "theme" | "phrase" | "transfer";
type Bilingual = { ko: string; ja: string };
type FieldMission = {
  id: string;
  station: string;
  category: AdventureCategory;
  title: Bilingual;
  condition: Bilingual;
  officialUrl: string;
  optional?: boolean;
  note?: Bilingual;
};

export type AdventureMission = Omit<FieldMission, "station" | "condition" | "officialUrl"> & {
  station: { ko: string; ja: string; code: string };
} & (
  | { type: "quest"; href: string; summary: Bilingual; durationMinutes?: number }
  | { type: "field"; condition: Bilingual; officialUrl: string }
  | { type: "quiz"; question: Bilingual; options: Bilingual[]; answerIndex: number; href: string }
  | { type: "planned" }
);

const ledger: Partial<Record<SubwayLine, readonly [string, AdventureCategory][]>> = {
  1: [["gwangjang-soonhee-bindaetteok", "food"], ["dongdaemun-market-small-trim", "shopping"], ["sinseol-seoul-folk-flea-market", "shopping"]],
  2: [["seongsu-oliveyoung-skin-consulting", "journey"], ["seongsu-somugwan-solo-gukbap", "journey"], ["jamsil-seoul-bookbogo-first-book-talk", "journey"], ["seongsu-lumiere-perfume-class", "culture"]],
  3: [["changdeokgung-japanese-tour", "sights"], ["insadong-ssamziegil-craft-gift", "shopping"], ["tongin-market-sonmat-gimbap", "food"], ["anguk-folk-museum-seollal", "culture"]],
  4: [["myeongdong-kyoja", "food"], ["museum-room-of-contemplation", "culture"], ["yongsan-amore-custom-foundation", "shopping"], ["naksan-city-wall-walk", "sights"]],
  5: [["gwanghwamun-seoul-museum-city-model", "culture"], ["gwanghwamun-kyobo-find-book", "shopping"], ["yeouido-hangang-bamseom-view", "sights"]],
  9: [["yeouido-irotomo-first-meetup", "culture"]],
};

const ddp: FieldMission = {
  id: "ddp-curves",
  station: "동대문역사문화공원",
  category: "sights",
  title: { ko: "DDP에서 곡선 건축 찾기", ja: "DDPで曲線の建築を見つける" },
  condition: { ko: "동대문디자인플라자 바깥을 걸으며 곡선이 가장 잘 보이는 장소 한 곳을 골라보세요.", ja: "東大門デザインプラザの外を歩き、曲線がよく見える場所を一つ選びましょう。" },
  officialUrl: "https://www.seoul.go.kr/policy/view.do?id=99&lan=KO",
};

const seokchonLake: FieldMission = {
  id: "seokchon-lake",
  station: "잠실",
  category: "sights",
  title: { ko: "석촌호수에서 동호와 서호 만나기", ja: "石村湖の東湖と西湖を歩く" },
  condition: { ko: "석촌호수 산책로를 걸으며 동호와 서호를 각각 한 번 바라보세요.", ja: "石村湖の遊歩道を歩き、東湖と西湖をそれぞれ眺めましょう。" },
  officialUrl: "https://www.songpa.go.kr/culture/detailInfo.do?key=3822&rcpp=6&resrceCd=TR0147-1000053&sc1=TR0147",
};

const fieldMissions: Partial<Record<SubwayLine, readonly FieldMission[]>> = {
  2: [ddp, seokchonLake],
  4: [ddp],
  5: [ddp],
  6: [{
    id: "oil-tank-culture-park",
    station: "월드컵경기장",
    category: "culture",
    title: { ko: "문화비축기지에서 옛 석유탱크 찾기", ja: "文化備蓄基地でかつての石油タンクを探す" },
    condition: { ko: "문화비축기지 야외를 걸으며 옛 저장탱크의 둥근 외벽을 한 곳 찾아보세요.", ja: "文化備蓄基地の屋外を歩き、かつての貯蔵タンクの丸い外壁を一つ見つけましょう。" },
    officialUrl: "https://parks.seoul.go.kr/content.do?key=2604300014",
  }, {
    id: "mangwon-market-snack",
    station: "망원",
    category: "food",
    title: { ko: "망원시장에서 간식 하나 주문하기", ja: "望遠市場でおやつを一つ注文する" },
    condition: { ko: "시장에 들러 먹어보고 싶은 간식 한 가지를 고르고 직접 주문해 보세요.", ja: "市場で食べてみたいおやつを一つ選び、自分で注文してみましょう。" },
    note: { ko: "가격은 매대에서 확인해 주세요.", ja: "値段は店頭で確認してください。" },
    officialUrl: "https://stage-kr.visitseoul.net/shopping/%EB%A7%9D%EC%9B%90%EC%8B%9C%EC%9E%A5/KOP037950",
  }],
  7: [{
    id: "childrens-grand-park",
    station: "어린이대공원",
    category: "sights",
    title: { ko: "어린이대공원 정문에서 산책 시작하기", ja: "オリニ大公園の正門から散歩する" },
    condition: { ko: "1번 출구에서 정문으로 들어가 안내도를 보고 걸어볼 장소 한 곳을 고른 뒤 찾아가세요.", ja: "1番出口から正門に入り、案内図で行ってみたい場所を一つ選び、そこまで歩きましょう。" },
    officialUrl: "https://www.sisul.or.kr/open_content/main/introduce/location5.jsp",
  }, {
    id: "ttukseom-jabeolle",
    station: "자양",
    category: "culture",
    title: { ko: "뚝섬한강공원에서 자벌레 건물 찾기", ja: "トゥクソム漢江公園でチャボルレを見つける" },
    condition: { ko: "자양역 3번 출구 쪽에서 공원으로 나와 애벌레 모양의 자벌레 건물을 찾아보세요.", ja: "紫陽駅の3番出口側から公園に出て、シャクトリムシの形をした建物を見つけましょう。" },
    officialUrl: "https://hangang.seoul.go.kr/www/contents/798.do?mid=518",
  }],
  8: [{
    id: "olympic-park-peace-gate",
    station: "몽촌토성",
    category: "sights",
    title: { ko: "올림픽공원 세계평화의문 찾아가기", ja: "オリンピック公園で世界平和の門を見つける" },
    condition: { ko: "몽촌토성역에서 올림픽공원에 들어가 세계평화의문을 찾아보세요.", ja: "夢村土城駅からオリンピック公園に入り、世界平和の門を見つけましょう。" },
    officialUrl: "https://www.ksponco.or.kr/menu.es?mid=a20109000000",
  }, seokchonLake],
  9: [{
    id: "nodeul-river",
    station: "노들",
    category: "sights",
    title: { ko: "노들섬에서 한강을 바라보기", ja: "ノドゥル島で漢江を眺める" },
    condition: { ko: "노들섬 야외에서 강을 볼 수 있는 자리를 찾아 잠깐 머물러 보세요.", ja: "ノドゥル島の屋外で川を眺められる場所を見つけ、ひと休みしましょう。" },
    officialUrl: "https://nodeul.org/guide/",
  }, {
    id: "nodeul-live-show",
    station: "노들",
    category: "show",
    title: { ko: "노들섬에서 공연 한 편 보기", ja: "ノドゥル島でライブを一つ観る" },
    condition: { ko: "공식 일정에서 공연을 골라 관람한 뒤 기록하세요.", ja: "公式スケジュールから公演を選び、観覧してから記録しましょう。" },
    note: { ko: "공연별 일정·요금·예약 방법을 확인해 주세요.", ja: "公演ごとに日程・料金・予約方法を確認してください。" },
    officialUrl: "https://nodeul.org/types/show/",
    optional: true,
  }],
};

const optionalQuests = new Set([
  "changdeokgung-japanese-tour",
  "seongsu-lumiere-perfume-class",
  "jamsil-seoul-bookbogo-first-book-talk",
  "yeouido-irotomo-first-meetup",
]);

export function getLineAdventureMissions(line: SubwayLine): AdventureMission[] {
  const quests = (ledger[line] ?? []).map(([slug, category]): AdventureMission => {
    const quest = questCatalog.find((entry) => entry.slug === slug);
    const access = quest && getQuestAccess(quest.id);
    const station = access?.exit.stations.find((item) => item.line === line);
    if (!quest || !station) throw new Error(`Adventure quest ${slug} has no station on line ${line}`);
    return {
      type: "quest", id: quest.id, station, category, optional: optionalQuests.has(slug),
      title: { ko: quest.titleKo, ja: quest.titleJa }, href: getCatalogQuestPath(quest),
      summary: { ko: quest.summaryKo, ja: quest.summaryJa }, durationMinutes: quest.durationMinutes,
    };
  });
  const fields = (fieldMissions[line] ?? []).map(({ station: name, ...mission }): AdventureMission => {
    const station = subwayStations.find((item) => item.line === line && item.ko === name);
    if (!station) throw new Error(`Adventure station ${name} is missing from line ${line}`);
    return { ...mission, type: "field", station };
  });
  return [...quests, ...fields, ...(line === 2 ? getLineTwoExtraSlots() : [])];
}

export function getStationAdventureMissions(station: SubwayStation): AdventureMission[] {
  const missions = getLineAdventureMissions(station.line).filter((mission) => mission.station.code === station.code);
  const seen = new Set(missions.map(({ id }) => id));
  for (const { quest, match } of findStationQuests(station.code)) {
    if (match !== "exit" || seen.has(quest.id)) continue;
    missions.push({
      type: "quest", id: quest.id, station, category: "journey", optional: optionalQuests.has(quest.slug),
      title: { ko: quest.titleKo, ja: quest.titleJa }, href: getCatalogQuestPath(quest),
      summary: { ko: quest.summaryKo, ja: quest.summaryJa }, durationMinutes: quest.durationMinutes,
    });
  }
  return missions;
}
