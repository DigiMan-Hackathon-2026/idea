import type { MenuKey, Place, Restaurant } from "./types";

// Areas the agent understands, with the spellings travellers use. Points are
// the station coordinates from the 여기서울 subway data (station-coordinates.json).
type Area = Place & { aliases: string[]; diningArea: boolean };

export const areas: Area[] = [
  {
    id: "shinchon",
    nameJa: "新村",
    nameKo: "신촌",
    point: { lat: 37.555131, lng: 126.936926 },
    stationCode: "240",
    approximate: true,
    diningArea: true,
    aliases: ["新村", "シンチョン", "しんちょん", "신촌", "sinchon", "shinchon"],
  },
  {
    id: "hongdae",
    nameJa: "弘大",
    nameKo: "홍대",
    point: { lat: 37.55679, lng: 126.923708 },
    stationCode: "239",
    approximate: true,
    diningArea: false,
    aliases: ["弘大", "弘益大", "ホンデ", "ほんで", "홍대", "홍익대", "hongdae"],
  },
  {
    id: "ewha",
    nameJa: "梨大",
    nameKo: "이대",
    point: { lat: 37.556733, lng: 126.946013 },
    stationCode: "241",
    approximate: true,
    diningArea: false,
    aliases: ["梨大", "梨花女子大", "イデ", "이대", "이화여대"],
  },
  {
    id: "hapjeong",
    nameJa: "合井",
    nameKo: "합정",
    point: { lat: 37.549457, lng: 126.913808 },
    stationCode: "238",
    approximate: true,
    diningArea: false,
    aliases: ["合井", "ハプチョン", "합정"],
  },
  {
    id: "seongsu",
    nameJa: "聖水",
    nameKo: "성수",
    point: { lat: 37.544581, lng: 127.055961 },
    stationCode: "211",
    approximate: true,
    diningArea: true,
    aliases: ["聖水", "ソンス", "そんす", "성수", "seongsu"],
  },
  {
    id: "myeongdong",
    nameJa: "明洞",
    nameKo: "명동",
    point: { lat: 37.560989, lng: 126.986325 },
    stationCode: "424",
    approximate: true,
    diningArea: false,
    aliases: ["明洞", "ミョンドン", "명동", "myeongdong"],
  },
];

export function findArea(id: string): Area | undefined {
  return areas.find((area) => area.id === id);
}

/** Every area mention in `text`, in order of appearance. */
export function findAreaMentions(text: string): { area: Area; index: number; length: number }[] {
  const lowered = text.toLowerCase();
  const mentions: { area: Area; index: number; length: number }[] = [];
  for (const area of areas) {
    for (const alias of area.aliases) {
      let from = 0;
      for (;;) {
        const index = lowered.indexOf(alias.toLowerCase(), from);
        if (index < 0) break;
        mentions.push({ area, index, length: alias.length });
        from = index + alias.length;
      }
    }
  }
  mentions.sort((a, b) => a.index - b.index || b.length - a.length);
  // Drop mentions nested inside a longer one (e.g. 弘大 inside 弘益大).
  return mentions.filter(
    (mention, i) => !mentions.some((other, j) => j !== i && other.index <= mention.index && other.index + other.length >= mention.index + mention.length && other.length > mention.length),
  );
}

export function areaAsPlace(area: Area): Place {
  const { id, nameJa, nameKo, point, stationCode, approximate } = area;
  return { id, nameJa, nameKo, point, stationCode, approximate };
}

const menuAliases: Record<Exclude<MenuKey, "any">, string[]> = {
  samgyeopsal: ["サムギョプサル", "サムギョプ", "さむぎょぷさる", "삼겹살", "豚バラ"],
  korean_bbq: ["焼肉", "焼き肉", "カルビ", "갈비", "고기", "구이"],
  dakgalbi: ["タッカルビ", "닭갈비"],
  chicken: ["チキン", "치킨"],
  gukbap: ["クッパ", "국밥"],
  tteokbokki: ["トッポッキ", "トッポギ", "떡볶이"],
  naengmyeon: ["冷麺", "レンミョン", "냉면"],
  bibimbap: ["ビビンバ", "비빔밥"],
  samgyetang: ["参鶏湯", "サムゲタン", "삼계탕"],
};

const anyMenuAliases = ["なんでも", "何でも", "おすすめ", "아무거나", "추천"];

export const menuNames: Record<MenuKey, { ja: string; ko: string }> = {
  samgyeopsal: { ja: "サムギョプサル", ko: "삼겹살" },
  korean_bbq: { ja: "焼肉", ko: "고기구이" },
  dakgalbi: { ja: "タッカルビ", ko: "닭갈비" },
  chicken: { ja: "チキン", ko: "치킨" },
  gukbap: { ja: "クッパ", ko: "국밥" },
  tteokbokki: { ja: "トッポッキ", ko: "떡볶이" },
  naengmyeon: { ja: "冷麺", ko: "냉면" },
  bibimbap: { ja: "ビビンバ", ko: "비빔밥" },
  samgyetang: { ja: "参鶏湯", ko: "삼계탕" },
  any: { ja: "おまかせ", ko: "상관없음" },
};

export function findMenu(text: string): { key: MenuKey; label: string } | null {
  for (const [key, aliases] of Object.entries(menuAliases) as [MenuKey, string[]][]) {
    const hit = aliases.find((alias) => text.includes(alias));
    if (hit) return { key, label: hit };
  }
  const any = anyMenuAliases.find((alias) => text.includes(alias));
  return any ? { key: "any", label: any } : null;
}

// Curated candidates. The demo entries are test shops: their phone refs map to
// teammates who agreed to take test calls, and every card says テスト / 테스트.
// Replace them with verified shops (source + checked date) before real use.
const checked = "2026-11-25";

export const restaurants: Restaurant[] = [
  {
    id: "test-shinchon-a",
    areaId: "shinchon",
    nameJa: "テスト店A（サムギョプサル）",
    nameKo: "테스트 매장 A (삼겹살)",
    point: { lat: 37.5569, lng: 126.9372 },
    addressKo: "서울 서대문구 신촌역 북쪽 (테스트)",
    menus: ["samgyeopsal", "korean_bbq"],
    maxParty: 6,
    soloEntry: false,
    singlePortion: false,
    bookingLinks: [],
    phoneRef: "demo-shop-a",
    source: { label: "テストデータ / 테스트 데이터", url: null, checkedAt: checked },
    test: true,
  },
  {
    id: "test-shinchon-b",
    areaId: "shinchon",
    nameJa: "テスト店B（サムギョプサル）",
    nameKo: "테스트 매장 B (삼겹살)",
    point: { lat: 37.5547, lng: 126.9332 },
    addressKo: "서울 마포구 신촌역 서쪽 (테스트)",
    menus: ["samgyeopsal"],
    maxParty: 4,
    soloEntry: true,
    singlePortion: true,
    bookingLinks: [],
    phoneRef: "demo-shop-b",
    source: { label: "テストデータ / 테스트 데이터", url: null, checkedAt: checked },
    test: true,
  },
  {
    id: "test-shinchon-c",
    areaId: "shinchon",
    nameJa: "テスト店C（焼肉）",
    nameKo: "테스트 매장 C (고기구이)",
    point: { lat: 37.5584, lng: 126.9385 },
    addressKo: "서울 서대문구 연세로 근처 (테스트)",
    menus: ["korean_bbq", "samgyeopsal"],
    maxParty: 10,
    soloEntry: null,
    singlePortion: null,
    bookingLinks: [],
    phoneRef: "demo-shop-c",
    source: { label: "テストデータ / 테스트 데이터", url: null, checkedAt: checked },
    test: true,
  },
  {
    id: "test-shinchon-d",
    areaId: "shinchon",
    nameJa: "テスト店D（タッカルビ）",
    nameKo: "테스트 매장 D (닭갈비)",
    point: { lat: 37.5559, lng: 126.9390 },
    addressKo: "서울 서대문구 신촌역 동쪽 (테스트)",
    menus: ["dakgalbi"],
    maxParty: 8,
    soloEntry: false,
    singlePortion: false,
    bookingLinks: [],
    phoneRef: "demo-shop-d",
    source: { label: "テストデータ / 테스트 데이터", url: null, checkedAt: checked },
    test: true,
  },
  {
    id: "test-seongsu-a",
    areaId: "seongsu",
    nameJa: "テスト店E（サムギョプサル）",
    nameKo: "테스트 매장 E (삼겹살)",
    point: { lat: 37.5452, lng: 127.0571 },
    addressKo: "서울 성동구 성수역 근처 (테스트)",
    menus: ["samgyeopsal", "korean_bbq"],
    maxParty: 6,
    soloEntry: true,
    singlePortion: false,
    bookingLinks: [],
    phoneRef: "demo-shop-e",
    source: { label: "テストデータ / 테스트 데이터", url: null, checkedAt: checked },
    test: true,
  },
];

export function findRestaurant(id: string): Restaurant | undefined {
  return restaurants.find((restaurant) => restaurant.id === id);
}

export function listRestaurants(areaId: string, menu: MenuKey): Restaurant[] {
  return restaurants.filter(
    (restaurant) => restaurant.areaId === areaId && (menu === "any" || restaurant.menus.includes(menu)),
  );
}
