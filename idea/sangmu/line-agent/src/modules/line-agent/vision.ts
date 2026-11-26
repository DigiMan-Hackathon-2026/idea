// What a vision model reads from a photo the user sent (a shop sign or page, or a
// waiting-list screen), turned back into plain text in the words the agent's
// parsers already know (wait.ts, identify.ts). The model only reads; it never
// decides what the agent does.

export type VisionForm = {
  kind: "shop" | "wait" | "other";
  shopName: string | null;
  waitMinutes: number | null;
  waitTeams: number | null;
  readyAt: string | null;
  remote: boolean | null;
  visibleText: string;
};

export const visionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "shopName", "waitMinutes", "waitTeams", "readyAt", "remote", "visibleText"],
  properties: {
    kind: { type: "string", enum: ["shop", "wait", "other"], description: "shop: a sign, storefront, menu board or map/app page of one shop. wait: a waiting-list screen, ticket or board. other: anything else." },
    shopName: { type: ["string", "null"], description: "The shop's name exactly as written (Korean, Japanese or English), if visible." },
    waitMinutes: { type: ["integer", "null"], description: "Expected wait in minutes, if shown." },
    waitTeams: { type: ["integer", "null"], description: "Groups (teams) ahead in the queue, if shown." },
    readyAt: { type: ["string", "null"], description: "24-hour HH:MM when you can enter, if shown." },
    remote: { type: ["boolean", "null"], description: "True if this is the user's own registration in a remote waiting list (app/kiosk ticket)." },
    visibleText: { type: "string", description: "The main text in the image, as written, at most 300 characters." },
  },
} as const;

export const visionPrompt =
  "You read one photo that a traveller in Seoul sent to a restaurant assistant: usually a shop sign, a shop page in a map app, or a waiting-list (웨이팅/順番待ち) screen. Fill the form only with what is visible; leave fields null when they are not shown. Do not guess shop names.";

const CLOCK = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Text in the agent's own words: the shop name, then wait facts readWait() understands. */
export function visionText(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const form = raw as Partial<VisionForm>;
  const parts: string[] = [];
  if (typeof form.shopName === "string" && form.shopName.trim()) parts.push(form.shopName.trim().slice(0, 60));
  if (form.kind === "wait") {
    if (Number.isInteger(form.waitMinutes) && form.waitMinutes! >= 0 && form.waitMinutes! <= 600) parts.push(form.waitMinutes === 0 ? "待ちなし" : `${form.waitMinutes}分待ち`);
    if (Number.isInteger(form.waitTeams) && form.waitTeams! >= 0 && form.waitTeams! <= 300) parts.push(`前に${form.waitTeams}組`);
    if (typeof form.readyAt === "string" && CLOCK.test(form.readyAt)) parts.push(`${form.readyAt}に入店`);
    if (form.remote === true) parts.push("順番待ち登録済み");
  }
  if (typeof form.visibleText === "string" && form.visibleText.trim()) parts.push(form.visibleText.replace(/\s+/g, " ").trim().slice(0, 300));
  const text = parts.join(" ").trim();
  return text || null;
}
