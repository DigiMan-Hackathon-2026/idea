// Rule-based reading of a Japanese or Korean dining request. It only extracts
// what the text states; anything missing or unclear is left null so the agent
// asks one question at a time (spec §3-1, §6 InterpretRequest).
import { areaAsPlace, findAreaMentions, findMenu } from "./places";
import type { Lang, MenuKey, Place } from "./types";

export type ClockTime = { hour: number; minute: number };

export type Interpretation = {
  lang: Lang;
  partySize: number | null;
  menu: { key: MenuKey; label: string } | null;
  currentAreaId: string | null;
  nextPlace: Place | null;
  arriveBy: ClockTime | null;
  wantsFood: boolean;
  cancel: boolean;
};

const kanjiDigits: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const koreanCounters: Record<string, number> = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10 };
const koreanHours: Record<string, number> = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 열한: 11, 열두: 12 };

export function normalizeText(text: string): string {
  return text
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ":")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectLang(text: string): Lang {
  const hangul = (text.match(/[가-힣]/g) ?? []).length;
  const kana = (text.match(/[぀-ヿ一-鿿]/g) ?? []).length;
  return hangul > kana ? "ko" : "ja";
}

export function parsePartySize(text: string): number | null {
  const t = normalizeText(text);
  if (/(おひとり|お一人|ひとりで|一人で|1人で|혼자|혼밥)/.test(t)) return 1;
  if (/(ふたりで|二人で|둘이)/.test(t)) return 2;
  if (/(さんにん|셋이)/.test(t)) return 3;
  if (/(よにん|넷이)/.test(t)) return 4;
  const ja = t.match(/(\d{1,2}|[一二三四五六七八九十])\s*(?:人|名)(?!前|分)/);
  if (ja) return toNumber(ja[1]);
  const koDigits = t.match(/(\d{1,2})\s*(?:명|인)(?!분)/);
  if (koDigits) return Number(koDigits[1]);
  const koWords = t.match(/(다섯|여섯|일곱|여덟|아홉|열|한|두|세|네)\s*(?:명|사람)/);
  if (koWords) return koreanCounters[koWords[1]];
  const bare = t.match(/^(\d{1,2})$/);
  if (bare) return Number(bare[1]);
  return null;
}

function toNumber(token: string): number {
  return /^\d+$/.test(token) ? Number(token) : kanjiDigits[token];
}

export type TimeMatch = ClockTime & { index: number; end: number };

export function findClockTimes(text: string): TimeMatch[] {
  const found: TimeMatch[] = [];
  const patterns: { regex: RegExp; read: (m: RegExpExecArray) => ClockTime | null }[] = [
    {
      regex: /(午前|午後|夜|朝|深夜|오전|오후|저녁|밤|새벽)?\s*(\d{1,2})\s*(?:時|시)\s*(半|반|(\d{1,2})\s*(?:分|분))?/g,
      read: (m) => clock(Number(m[2]), m[3] === "半" || m[3] === "반" ? 30 : m[4] ? Number(m[4]) : 0, m[1]),
    },
    {
      regex: /(오전|오후|저녁|밤|새벽)?\s*(열두|열한|다섯|여섯|일곱|여덟|아홉|열|한|두|세|네)\s*시\s*(반|(\d{1,2})\s*분)?/g,
      read: (m) => clock(koreanHours[m[2]], m[3] === "반" ? 30 : m[4] ? Number(m[4]) : 0, m[1]),
    },
    {
      regex: /(午前|午後|夜|深夜|오전|오후|저녁|밤|새벽)?\s*(\d{1,2}):(\d{2})/g,
      read: (m) => clock(Number(m[2]), Number(m[3]), m[1]),
    },
  ];
  for (const { regex, read } of patterns) {
    for (let m = regex.exec(text); m; m = regex.exec(text)) {
      const value = read(m);
      if (value && !found.some((other) => other.index <= m!.index && other.end > m!.index)) {
        found.push({ ...value, index: m.index, end: m.index + m[0].length });
      }
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

function clock(hour: number, minute: number, period: string | undefined): ClockTime | null {
  if (!Number.isInteger(hour) || hour > 24 || minute > 59) return null;
  let h = hour;
  const morning = period === "午前" || period === "朝" || period === "오전";
  const smallHours = period === "새벽" || period === "深夜";
  const night = period === "밤" || period === "夜";
  // Dining requests are about later today: a bare "8時" means 20:00.
  if (!morning && !smallHours && h >= 1 && h <= 11) h += 12;
  // "오전 12시", "밤 12시", "새벽 12시" are midnight; a bare "12시" is noon.
  if (h === 12 && (morning || smallHours || night)) h = 0;
  if (h === 24) h = 0;
  return { hour: h, minute };
}

const deadlineMarker = /^\s*(?:まで|迄|까지|に着|에 도착|에 가)/;

export function parseArriveBy(text: string): { time: ClockTime; end: number } | null {
  const t = normalizeText(text);
  for (const match of findClockTimes(t)) {
    if (deadlineMarker.test(t.slice(match.end, match.end + 8))) {
      return { time: { hour: match.hour, minute: match.minute }, end: match.end };
    }
  }
  return null;
}

const venueWords = /^(?:の)?\s*(ライブ会場|ライブハウス|会場|ホテル|공연장|라이브|숙소|호텔)/;
const hereMarker = /^\s*(?:にいます|に居ます|にいる|で|에 있|에서|근처)/;
const thereMarker = /^\s*(?:の[^。.!?、,]{0,8})?(?:に着|へ|まで|까지|에 도착|에 가)/;
const foodWords = /(食べ|ご飯|ごはん|ランチ|ディナー|夕食|夕飯|晩ご飯|食事|レストラン|お店|먹|식당|밥|맛집|저녁 식사)/;
const cancelWords = /(キャンセル|やめる|やめます|中止|취소|그만)/;

export function interpret(text: string): Interpretation {
  const t = normalizeText(text);
  const lang = detectLang(t);
  const arrive = parseArriveBy(t);
  const mentions = findAreaMentions(t);

  let currentAreaId: string | null = null;
  let nextPlace: Place | null = null;
  for (const mention of mentions) {
    const after = t.slice(mention.index + mention.length, mention.index + mention.length + 16);
    const afterDeadline = arrive !== null && mention.index >= arrive.end;
    if (!nextPlace && (afterDeadline || thereMarker.test(after)) && !hereMarker.test(after)) {
      const place = areaAsPlace(mention.area);
      const venue = after.match(venueWords);
      nextPlace = venue
        ? { ...place, id: `${place.id}-venue`, nameJa: `${place.nameJa}の${venueLabel(venue[1]).ja}`, nameKo: `${place.nameKo} ${venueLabel(venue[1]).ko}` }
        : place;
      continue;
    }
    if (!currentAreaId && mention.area.diningArea) currentAreaId = mention.area.id;
    else if (!currentAreaId && hereMarker.test(after)) currentAreaId = mention.area.id;
  }

  const menu = findMenu(t);
  return {
    lang,
    partySize: parsePartySize(t),
    menu,
    currentAreaId,
    nextPlace,
    arriveBy: arrive?.time ?? null,
    wantsFood: foodWords.test(t) || menu !== null,
    cancel: cancelWords.test(t),
  };
}

function venueLabel(word: string): { ja: string; ko: string } {
  if (/ホテル|호텔|숙소/.test(word)) return { ja: "ホテル", ko: "숙소" };
  return { ja: "ライブ会場", ko: "공연장" };
}
