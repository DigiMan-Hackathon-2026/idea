// When the rules in interpret.ts cannot read a message ("お肉食べたい、ライブ7時
// からなんだけど2人"), a language model reads it into the same fields. The model
// only fills this form; it never writes a reply. Every value is checked here
// against the areas, menus and shops the agent knows, so an invented one is
// dropped rather than used.
import type { Interpretation } from "./interpret";
import { areaAsPlace, areas, findArea, menuNames } from "./places";
import type { Lang, MenuKey } from "./types";

export type Understanding = {
  reading: Interpretation;
  /** A shop name as written; the agent matches it against the listed shops. */
  shopName: string | null;
  wantsCall: boolean;
};

const MENUS = (Object.keys(menuNames) as MenuKey[]).filter((key) => key !== "any");
const AREA_IDS = areas.map((area) => area.id);

/** JSON schema for the model's answer (OpenAI structured output, strict). */
export const understandingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["partySize", "currentArea", "menu", "shopName", "arriveBy", "nextArea", "nextVenue", "wantsFood", "wantsCall", "cancel"],
  properties: {
    partySize: { type: ["integer", "null"], description: "How many people will eat, if said." },
    currentArea: { type: ["string", "null"], enum: [...AREA_IDS, null], description: "Where they are or want to eat." },
    menu: { type: ["string", "null"], enum: [...MENUS, null], description: "What they want to eat." },
    shopName: { type: ["string", "null"], description: "A specific restaurant name exactly as written, if any." },
    arriveBy: { type: ["string", "null"], description: "24-hour HH:MM by which they must reach their next plan (a show starting at 7 means 19:00)." },
    nextArea: { type: ["string", "null"], enum: [...AREA_IDS, null], description: "Where the next plan is." },
    nextVenue: { type: ["string", "null"], enum: ["live", "hotel", "other", null], description: "Kind of next plan: live show/concert, hotel, or other." },
    wantsFood: { type: "boolean", description: "They want to find somewhere to eat." },
    wantsCall: { type: "boolean", description: "They ask the assistant to phone a restaurant." },
    cancel: { type: "boolean", description: "They want to stop or cancel the current request." },
  },
} as const;

export function understandingPrompt(now: string): string {
  const areaList = areas.map((area) => `${area.id} = ${area.nameJa} / ${area.nameKo}`).join("; ");
  const menuList = MENUS.map((key) => `${key} = ${menuNames[key].ja} / ${menuNames[key].ko}`).join("; ");
  return [
    "You read one LINE message that a traveller in Seoul (usually Japanese, sometimes Korean) sent to a restaurant assistant, and fill the form. Only use what the message says; leave a field null if it does not say it.",
    `Areas: ${areaList}.`,
    `Menus: ${menuList}. Generic meat or yakiniku (肉, お肉, 焼肉, 고기) is korean_bbq; pork belly is samgyeopsal.`,
    `It is now ${now} (UTC). Times are Seoul time; an evening plan said as 7 or 7時 is 19:00.`,
  ].join("\n");
}

const CLOCK = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Checks the model's form and turns it into the agent's reading; null when it says nothing usable. */
export function fromModel(raw: unknown, lang: Lang): Understanding | null {
  if (!raw || typeof raw !== "object") return null;
  const form = raw as Record<string, unknown>;
  const partySize = Number.isInteger(form.partySize) && (form.partySize as number) >= 1 && (form.partySize as number) <= 30 ? (form.partySize as number) : null;
  const menuKey = typeof form.menu === "string" && (MENUS as string[]).includes(form.menu) ? (form.menu as MenuKey) : null;
  const current = typeof form.currentArea === "string" ? findArea(form.currentArea) : undefined;
  const nextArea = typeof form.nextArea === "string" ? findArea(form.nextArea) : undefined;
  const clock = typeof form.arriveBy === "string" ? form.arriveBy.match(CLOCK) : null;
  const venue = form.nextVenue === "live" ? { ja: "ライブ会場", ko: "공연장" } : form.nextVenue === "hotel" ? { ja: "ホテル", ko: "숙소" } : null;
  const place = nextArea ? areaAsPlace(nextArea) : null;
  const nextPlace = place && venue ? { ...place, id: `${place.id}-venue`, nameJa: `${place.nameJa}の${venue.ja}`, nameKo: `${place.nameKo} ${venue.ko}` } : place;
  const shopName = typeof form.shopName === "string" && form.shopName.trim().length >= 2 ? form.shopName.trim().slice(0, 40) : null;
  const reading: Interpretation = {
    lang,
    partySize,
    menu: menuKey ? { key: menuKey, label: menuNames[menuKey][lang] } : null,
    currentAreaId: current?.id ?? null,
    nextPlace,
    arriveBy: clock ? { hour: Number(clock[1]), minute: Number(clock[2]) } : null,
    wantsFood: form.wantsFood === true || menuKey !== null,
    cancel: form.cancel === true,
  };
  const says = partySize !== null || menuKey !== null || current || nextPlace || clock || shopName || reading.wantsFood || form.wantsCall === true || reading.cancel;
  return says ? { reading, shopName, wantsCall: form.wantsCall === true } : null;
}
