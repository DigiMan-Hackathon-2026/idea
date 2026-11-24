import { describe, expect, it } from "vitest";
import { makeCardToken, readCardToken } from "../links";
import { decodePostback, encodePostback } from "../postback";
import { lineSignature, verifyLineSignature } from "./signature";
import { conversationTarget, parseWebhookBody } from "./webhook";

describe("LINE signature", () => {
  it("accepts the channel's HMAC of the raw body and rejects anything else", () => {
    const body = '{"destination":"U1","events":[]}';
    const signature = lineSignature(body, "secret");
    expect(verifyLineSignature(body, signature, "secret")).toBe(true);
    expect(verifyLineSignature(body + " ", signature, "secret")).toBe(false);
    expect(verifyLineSignature(body, signature, "other")).toBe(false);
    expect(verifyLineSignature(body, null, "secret")).toBe(false);
  });
});

describe("parseWebhookBody", () => {
  it("keeps known events and drops malformed ones", () => {
    const body = parseWebhookBody(JSON.stringify({
      destination: "Ubot",
      events: [
        { type: "message", webhookEventId: "e1", timestamp: 1, replyToken: "r1", source: { type: "group", groupId: "C1", userId: "U1" }, message: { type: "text", id: "m1", text: "ココソウル 新村", mention: { mentionees: [{ isSelf: true, type: "user" }] } } },
        { type: "postback", webhookEventId: "e2", timestamp: 2, replyToken: "r2", source: { type: "user", userId: "U1" }, postback: { data: "a=select" } },
        { type: "message", webhookEventId: "e3", timestamp: 3, source: { type: "user" }, message: { type: "text", id: "m3", text: "no user" } },
        { type: "weird", webhookEventId: "e4", timestamp: 4, source: { type: "user", userId: "U1" } },
      ],
    }));
    expect(body?.events.map((event) => event.webhookEventId)).toEqual(["e1", "e2"]);
    const first = body!.events[0];
    expect(first.type === "message" && first.message.type === "text" && first.message.mention?.mentionees[0].isSelf).toBe(true);
    expect(conversationTarget(first.source)).toBe("C1");
  });

  it("rejects non-JSON", () => {
    expect(parseWebhookBody("nope")).toBeNull();
  });
});

describe("postback data", () => {
  it("round-trips and rejects tampered values", () => {
    const data = encodePostback({ action: "approve", requestId: "abcdef123456", revision: 4, candidateId: "test-shinchon-a", value: null });
    expect(decodePostback(data)).toEqual({ action: "approve", requestId: "abcdef123456", revision: 4, candidateId: "test-shinchon-a", value: null });
    expect(decodePostback("a=delete_all&r=abcdef123456&v=1")).toBeNull();
    expect(decodePostback("a=select&r=../../x&v=1")).toBeNull();
  });
});

describe("Korean booking card token", () => {
  const payload = { restaurantId: "test-shinchon-a", partySize: 2, time: "2026-11-29T09:30:00.000Z", alias: "サトウ", test: true, expiresAt: "2026-11-29T15:30:00.000Z" };
  it("is readable with the secret until it expires", () => {
    const token = makeCardToken(payload, "secret");
    expect(readCardToken(token, "secret", "2026-11-29T10:00:00.000Z")).toEqual(payload);
    expect(readCardToken(token, "other", "2026-11-29T10:00:00.000Z")).toBeNull();
    expect(readCardToken(token, "secret", "2026-11-30T00:00:00.000Z")).toBeNull();
    expect(readCardToken(token.replace(/^./, "x"), "secret", "2026-11-29T10:00:00.000Z")).toBeNull();
  });
});
