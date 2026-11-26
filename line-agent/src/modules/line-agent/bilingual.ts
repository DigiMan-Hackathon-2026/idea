// Japanese conversations get everything in Japanese with Korean next to it,
// so Korean companions (and shop staff the traveller shows the phone to) can
// read it too. Each message builder is called twice, once per language, and
// the results are joined: text messages as Japanese, a "----" line, Korean;
// card texts with a small Korean line under the Japanese one; button and
// quick-reply labels as "日本語 · 한국어" within LINE's length limits.
import type { FlexComponent, LineAction, LineMessage, QuickReply } from "./line/types";
import type { Lang } from "./types";

export const SEPARATOR = "\n----\n";

type WithLang = { lang: Lang };

function isWithLang(value: unknown): value is WithLang {
  return typeof value === "object" && value !== null && "lang" in value && ((value as WithLang).lang === "ja" || (value as WithLang).lang === "ko");
}

/** The half of an already joined string for one language (strings passed back in, e.g. an intro). */
function half(value: string, lang: Lang): string {
  const at = value.indexOf(SEPARATOR);
  if (at < 0) return value;
  return lang === "ja" ? value.slice(0, at) : value.slice(at + SEPARATOR.length);
}

function inLang(args: unknown[], lang: Lang): unknown[] {
  return args.map((arg) => {
    if (arg === "ja" || arg === "ko") return lang;
    if (typeof arg === "string") return half(arg, lang);
    if (isWithLang(arg)) return { ...arg, lang };
    return arg;
  });
}

function isJapanese(args: unknown[]): boolean {
  return args.some((arg) => arg === "ja" || (isWithLang(arg) && arg.lang === "ja"));
}

/** LINE limits: quick-reply labels 20 characters, Flex button labels 40. */
const QUICK_LABEL_MAX = 20;
const BUTTON_LABEL_MAX = 40;

/** Shorter Korean for quick replies whose two-language label would not fit. */
const SHORT_KO: Record<string, string> = {
  "전화로 물어봐 주세요": "전화 부탁",
  "이미 원격 줄서기 함": "원격 줄서기 함",
  "예약 안 돼 있었어요": "예약 없음",
  "역 주변 미션 보기": "역 주변 미션",
  "그냥 갈게요": "그냥 가기",
};

function label(ja: string, ko: string, max: number, glue: string): string {
  if (ja === ko) return ja;
  const short = SHORT_KO[ko] ?? (/^\d{1,2}:\d{2}로 부탁하기$/.test(ko) ? "부탁" : ko);
  for (const candidate of [`${ja}${glue}${ko}`, `${ja}${glue}${short}`]) if ([...candidate].length <= max) return candidate;
  return ja;
}

function action(ja: LineAction, ko: LineAction, max: number, glue: string): LineAction {
  if (ja.type !== ko.type) return ja;
  const joined = { ...ja, label: label(ja.label, ko.label, max, glue) } as LineAction;
  if (joined.type === "postback" && ja.type === "postback" && ko.type === "postback" && ja.displayText && ko.displayText && ja.displayText !== ko.displayText) {
    joined.displayText = `${ja.displayText} / ${ko.displayText}`.slice(0, 300);
  }
  return joined;
}

function quickReplies(ja: QuickReply | undefined, ko: QuickReply | undefined): QuickReply | undefined {
  if (!ja || !ko || ja.items.length !== ko.items.length) return ja;
  return { items: ja.items.map((item, index) => ({ ...item, action: action(item.action, ko.items[index].action, QUICK_LABEL_MAX, "·") })) };
}

const SMALLER: Record<string, "xxs" | "xs" | "sm" | "md"> = { xxs: "xxs", xs: "xxs", sm: "xs", md: "sm", lg: "sm", xl: "md", xxl: "md", "3xl": "md" };

function textsIn(node: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) node.forEach((item) => textsIn(item, out));
  else if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (record.type === "text" && typeof record.text === "string") out.add(record.text);
    Object.values(record).forEach((value) => textsIn(value, out));
  }
  return out;
}

const digits = (value: string) => value.replace(/\D/g, "");

/** One card text with its Korean counterpart. */
function cardText(ja: Extract<FlexComponent, { type: "text" }>, ko: Extract<FlexComponent, { type: "text" }>, shown: Set<string>): FlexComponent {
  if (ja.text === ko.text || ja.contents || shown.has(ko.text)) return ja;
  // "締切 18:50" / "마감 18:50": a word or two around the same numbers already says it.
  const words = ja.text.replace(/[\d\s:.~〜-]/g, "");
  if (digits(ja.text) && digits(ja.text) === digits(ko.text) && [...words].length <= 2) return ja;
  const small = ja.size === "xxs" || ja.size === "xs";
  if (ja.wrap === false || (small && [...ja.text].length + [...ko.text].length <= 24)) return { ...ja, text: `${ja.text} · ${ko.text}` };
  const white = (ja.color ?? "").toLowerCase().startsWith("#ffffff");
  const { flex, margin, ...first } = ja;
  const second = { ...ko, flex: undefined, margin: undefined, size: SMALLER[ja.size ?? "sm"] ?? "xs", color: white ? "#ffffffcc" : "#8a877f", weight: "regular" as const, wrap: true };
  return { type: "box", layout: "vertical", spacing: "none", ...(flex !== undefined ? { flex } : {}), ...(margin ? { margin } : {}), contents: [first, second] };
}

/** Walks the Japanese and Korean card trees together (they are built by the same code). */
function joinCard(ja: unknown, ko: unknown, shown: Set<string>): unknown {
  if (Array.isArray(ja) && Array.isArray(ko)) return ja.length === ko.length ? ja.map((item, index) => joinCard(item, ko[index], shown)) : ja;
  if (!ja || typeof ja !== "object" || !ko || typeof ko !== "object") return ja;
  const a = ja as Record<string, unknown>;
  const b = ko as Record<string, unknown>;
  if (a.type !== b.type) return ja;
  if (a.type === "text") return cardText(ja as Extract<FlexComponent, { type: "text" }>, ko as Extract<FlexComponent, { type: "text" }>, shown);
  if (a.type === "button") return { ...a, action: action(a.action as LineAction, b.action as LineAction, BUTTON_LABEL_MAX, " · ") };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(a)) out[key] = key in b ? joinCard(value, b[key], shown) : value;
  return out;
}

function join(ja: unknown, ko: unknown): unknown {
  if (typeof ja === "string" && typeof ko === "string") return ja === ko ? ja : `${ja}${SEPARATOR}${ko}`;
  if (Array.isArray(ja) && Array.isArray(ko) && ja.length === ko.length) return ja.map((item, index) => join(item, ko[index]));
  const a = ja as LineMessage;
  const b = ko as LineMessage;
  if (a?.type === "text" && b?.type === "text") {
    // LINE allows 5,000 characters per text message.
    const text = a.text === b.text ? a.text : `${a.text}${SEPARATOR}${b.text}`.slice(0, 5000);
    return { ...a, text, ...(a.quickReply ? { quickReply: quickReplies(a.quickReply, b.quickReply) } : {}) };
  }
  if (a?.type === "flex" && b?.type === "flex") {
    const contents = joinCard(a.contents, b.contents, textsIn(a.contents)) as typeof a.contents;
    return { ...a, contents, ...(a.quickReply ? { quickReply: quickReplies(a.quickReply, b.quickReply) } : {}) };
  }
  return ja;
}

/** Wraps the message builders so Japanese results carry the Korean text below a line. */
export function bilingual<T extends object>(builders: T): T {
  return new Proxy(builders, {
    get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver);
      if (typeof value !== "function") return value;
      const build = value as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => {
        if (!isJapanese(args)) return build(...args);
        return join(build(...inLang(args, "ja")), build(...inLang(args, "ko")));
      };
    },
  });
}

/** One inline text in both languages for Japanese conversations. */
export function say(lang: Lang, ja: string, ko: string): string {
  return lang === "ja" ? `${ja}${SEPARATOR}${ko}` : ko;
}
