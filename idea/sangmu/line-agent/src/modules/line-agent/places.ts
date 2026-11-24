import candidateData from "./candidates.json";
import type { MenuKey, Place, Restaurant } from "./types";

// Areas the agent understands, with the spellings travellers use. Points are
// the station coordinates from the 여기서울 subway data (station-coordinates.json).
type Area = Place & { aliases: string[]; diningArea: boolean; stationKo: string };

export const areas: Area[] = [
  {
    id: "shinchon",
    stationKo: "신촌",
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
    stationKo: "홍대입구",
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
    stationKo: "이대",
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
    stationKo: "합정",
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
    stationKo: "성수",
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
    stationKo: "명동",
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

/** 여기서울 station album link (stamps) for an area's station. */
export function stationAlbumPath(areaId: string): string | null {
  const area = findArea(areaId);
  if (!area?.stationCode || !/^\d{3}$/.test(area.stationCode)) return null;
  const line = area.stationCode[0];
  return `/station-album?line=${line}&station=${encodeURIComponent(area.stationKo)}#station-story`;
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

// Curated candidates live in candidates.json so the team can replace the test
// shops with verified ones without touching code. validateCandidates() keeps
// the file honest (checked dates, HTTPS links, no phone numbers).
export function validateCandidates(value: unknown): Restaurant[] {
  const list = (value as { restaurants?: unknown }).restaurants;
  if (!Array.isArray(list)) throw new Error("candidates.json: restaurants must be an array");
  const ids = new Set<string>();
  for (const item of list as Restaurant[]) {
    const where = `candidates.json: ${item?.id ?? "?"}`;
    if (!/^[a-z0-9-]{1,64}$/.test(item.id) || ids.has(item.id)) throw new Error(`${where}: id must be unique lowercase-kebab`);
    ids.add(item.id);
    if (!findArea(item.areaId)?.diningArea) throw new Error(`${where}: unknown dining area ${item.areaId}`);
    if (!item.nameJa?.trim() || !item.nameKo?.trim() || !item.addressKo?.trim()) throw new Error(`${where}: names and address are required`);
    if (!(item.point?.lat > 37.4 && item.point.lat < 37.72 && item.point.lng > 126.7 && item.point.lng < 127.3)) throw new Error(`${where}: point must be in Seoul`);
    if (!Array.isArray(item.menus) || item.menus.length === 0 || item.menus.some((menu) => !(menu in menuNames) || menu === "any")) throw new Error(`${where}: menus must be known menu keys`);
    if (item.phoneRef !== null && !/^[a-z0-9-]{1,40}$/.test(item.phoneRef)) throw new Error(`${where}: phoneRef must be a key, not a number`);
    if (JSON.stringify(item).match(/\+?\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4}/)) throw new Error(`${where}: looks like a phone number; use phoneRef`);
    for (const link of item.bookingLinks ?? []) {
      if (!link.url.startsWith("https://") || !/^\d{4}-\d{2}-\d{2}$/.test(link.checkedAt)) throw new Error(`${where}: booking links need https and checkedAt`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.source?.checkedAt ?? "")) throw new Error(`${where}: source.checkedAt is required`);
    if (!item.test && !item.source.url?.startsWith("https://")) throw new Error(`${where}: a verified shop needs a source URL`);
  }
  return list as Restaurant[];
}

export const restaurants: Restaurant[] = validateCandidates(candidateData);

export function findRestaurant(id: string): Restaurant | undefined {
  return restaurants.find((restaurant) => restaurant.id === id);
}

export function listRestaurants(areaId: string, menu: MenuKey): Restaurant[] {
  return restaurants.filter(
    (restaurant) => restaurant.areaId === areaId && (menu === "any" || restaurant.menus.includes(menu)),
  );
}
