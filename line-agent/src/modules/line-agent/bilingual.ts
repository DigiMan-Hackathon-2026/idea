// Japanese conversations get every text message in Japanese, a "----" line,
// then the same message in Korean, so Korean companions (and shop staff the
// traveller shows the phone to) can read it too. Each message builder is
// called twice, once per language, and the two texts are joined. Flex cards
// stay in Japanese (they already carry the Korean shop names); buttons keep
// the Japanese labels.
import type { LineMessage } from "./line/types";
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

function join(ja: unknown, ko: unknown): unknown {
  if (typeof ja === "string" && typeof ko === "string") return ja === ko ? ja : `${ja}${SEPARATOR}${ko}`;
  if (Array.isArray(ja) && Array.isArray(ko) && ja.length === ko.length) return ja.map((item, index) => join(item, ko[index]));
  const a = ja as LineMessage;
  const b = ko as LineMessage;
  if (a?.type === "text" && b?.type === "text" && a.text !== b.text) {
    // LINE allows 5,000 characters per text message.
    return { ...a, text: `${a.text}${SEPARATOR}${b.text}`.slice(0, 5000) };
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
