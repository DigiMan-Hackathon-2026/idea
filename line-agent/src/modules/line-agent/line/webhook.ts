// Validates the shape of a LINE webhook body. Anything we cannot read is
// dropped rather than trusted (spec §9: user content is data).
import type { LineEvent, LineSource, LineWebhookBody } from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSource(value: unknown): LineSource | null {
  if (!isObject(value)) return null;
  const userId = typeof value.userId === "string" ? value.userId : undefined;
  if (value.type === "user" && userId) return { type: "user", userId };
  if (value.type === "group" && typeof value.groupId === "string") return { type: "group", groupId: value.groupId, userId };
  if (value.type === "room" && typeof value.roomId === "string") return { type: "room", roomId: value.roomId, userId };
  return null;
}

const knownTypes = new Set(["message", "postback", "follow", "join", "unfollow", "leave", "memberJoined", "memberLeft", "unsend"]);

export function parseWebhookBody(raw: string): LineWebhookBody | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(json) || typeof json.destination !== "string" || !Array.isArray(json.events)) return null;
  const events: LineEvent[] = [];
  for (const item of json.events) {
    if (!isObject(item) || typeof item.type !== "string" || !knownTypes.has(item.type)) continue;
    const source = readSource(item.source);
    if (!source || typeof item.webhookEventId !== "string" || typeof item.timestamp !== "number") continue;
    const common = { webhookEventId: item.webhookEventId, timestamp: item.timestamp, source };
    const replyToken = typeof item.replyToken === "string" ? item.replyToken : "";
    const deliveryContext = isObject(item.deliveryContext) ? { isRedelivery: item.deliveryContext.isRedelivery === true } : undefined;
    if (item.type === "message" && isObject(item.message) && typeof item.message.id === "string" && typeof item.message.type === "string") {
      const message = item.message;
      if (message.type === "text" && typeof message.text === "string") {
        const mentionees = isObject(message.mention) && Array.isArray(message.mention.mentionees)
          ? message.mention.mentionees.filter(isObject).map((m) => ({ isSelf: m.isSelf === true, type: typeof m.type === "string" ? m.type : undefined }))
          : undefined;
        events.push({
          ...common,
          type: "message",
          replyToken,
          deliveryContext,
          message: { type: "text", id: message.id as string, text: message.text.slice(0, 1000), mention: mentionees ? { mentionees } : undefined },
        });
      } else if (["image", "location", "sticker", "audio", "video", "file"].includes(message.type as string)) {
        events.push({ ...common, type: "message", replyToken, deliveryContext, message: { type: message.type as "image", id: message.id as string } });
      }
    } else if (item.type === "postback" && isObject(item.postback) && typeof item.postback.data === "string") {
      events.push({ ...common, type: "postback", replyToken, deliveryContext, postback: { data: item.postback.data.slice(0, 300) } });
    } else if (item.type === "follow" || item.type === "join") {
      events.push({ ...common, type: item.type, replyToken });
    } else if (item.type !== "message" && item.type !== "postback") {
      events.push({ ...common, type: item.type as "leave" });
    }
  }
  return { destination: json.destination, events };
}

/** Raw id of the conversation (where replies go). */
export function conversationTarget(source: LineSource): string {
  return source.type === "user" ? source.userId : source.type === "group" ? source.groupId : source.roomId;
}
