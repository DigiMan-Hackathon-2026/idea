import { afterEach, describe, expect, it, vi } from "vitest";
import { KatCloudCallPlacer, toKoreanDomestic, TwilioCallPlacer } from "./telephony";
import { seoulInstant } from "./time";

const brief = { restaurantNameKo: "테스트 매장 B", partySize: 2, windowStart: seoulInstant("2026-11-29", 17, 40), windowEnd: seoulInstant("2026-11-29", 18, 45), alias: "サトウ", test: true };

afterEach(() => vi.unstubAllGlobals());

describe("TwilioCallPlacer", () => {
  it("dials only allowlisted numbers and streams to the bridge with the attempt token", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ sid: "CA123" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const placer = new TwilioCallPlacer(
      { accountSid: "AC1", authToken: "secret", from: "+15550100000", bridgeHost: "https://bridge.example.test/" },
      (ref) => (ref === "demo-shop-b" ? "+821000000001" : null),
      (id) => `tok-${id}`,
      (id) => `https://app.example.test/api/v1/integrations/voice/attempts/${id}/status?t=tok-${id}`,
    );
    expect(await placer.place({ attemptId: "attempt0001", phoneRef: "demo-shop-b", brief })).toBe("CA123");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Calls.json");
    expect((init.headers as Record<string, string>).Authorization).toBe("Basic " + Buffer.from("AC1:secret").toString("base64"));
    const form = new URLSearchParams(String(init.body));
    expect(form.get("To")).toBe("+821000000001");
    expect(form.get("From")).toBe("+15550100000");
    expect(form.get("Twiml")).toBe('<Response><Connect><Stream url="wss://bridge.example.test/media"><Parameter name="attemptId" value="attempt0001"/><Parameter name="token" value="tok-attempt0001"/></Stream></Connect></Response>');
    expect(form.get("StatusCallback")).toContain("/attempts/attempt0001/status?t=tok-attempt0001");
    expect(form.get("TimeLimit")).toBe("300");
  });

  it("refuses a phone ref that is not on the allowlist", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const placer = new TwilioCallPlacer({ accountSid: "AC1", authToken: "s", from: "+15550100000", bridgeHost: "b.example.test" }, () => null, (id) => id);
    await expect(placer.place({ attemptId: "attempt0002", phoneRef: "real-shop", brief })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a refused call as a failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "geo permission" }), { status: 400 })));
    const placer = new TwilioCallPlacer({ accountSid: "AC1", authToken: "s", from: "+15550100000", bridgeHost: "b.example.test" }, () => "+821000000001", (id) => id);
    await expect(placer.place({ attemptId: "attempt0003", phoneRef: "demo-shop-b", brief })).rejects.toThrow("400");
  });
});

describe("KatCloudCallPlacer", () => {
  const config = { apiKey: "zpa.k1.secret", from: "07000000000", bridgeHost: "https://bridge.example.test/", apiUrl: "https://api.kat.example.test", groupId: null };

  it("looks up the group once, then streams to the bridge's /kat path with the attempt token", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/group") ? new Response(JSON.stringify({ id: 42 }), { status: 200 }) : new Response(JSON.stringify({ callId: "call-uuid", status: "queued" }), { status: 202 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const placer = new KatCloudCallPlacer(config, (ref) => (ref === "demo-shop-b" ? "+821000000001" : null), (id) => `tok-${id}`, (id) => `https://app.example.test/status/${id}`);
    expect(await placer.place({ attemptId: "attempt0001", phoneRef: "demo-shop-b", brief })).toBe("call-uuid");
    expect(await placer.place({ attemptId: "attempt0002", phoneRef: "demo-shop-b", brief })).toBe("call-uuid");
    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls).toEqual(["https://api.kat.example.test/group", "https://api.kat.example.test/group/42/media-stream/calls", "https://api.kat.example.test/group/42/media-stream/calls"]);
    const init = fetchMock.mock.calls[1][1 as never] as unknown as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("zpa.k1.secret");
    expect(headers["Idempotency-Key"]).toBe("attempt0001");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "07000000000",
      to: "01000000001",
      streamUrl: "wss://bridge.example.test/kat",
      statusCallbackUrl: "https://app.example.test/status/attempt0001",
      metadata: { attemptId: "attempt0001", token: "tok-attempt0001" },
      timeLimit: 300,
      codec: "PCMU",
    });
  });

  it("refuses numbers off the allowlist or outside Korea without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const placer = new KatCloudCallPlacer({ ...config, groupId: "42" }, (ref) => (ref === "abroad" ? "+15550100000" : null), (id) => id);
    await expect(placer.place({ attemptId: "attempt0003", phoneRef: "real-shop", brief })).rejects.toThrow("allowlist");
    await expect(placer.place({ attemptId: "attempt0004", phoneRef: "abroad", brief })).rejects.toThrow("Korean");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports KAT's error code when the call is refused", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "AO014" }), { status: 429 })));
    const placer = new KatCloudCallPlacer({ ...config, groupId: "42" }, () => "+821000000001", (id) => id);
    await expect(placer.place({ attemptId: "attempt0005", phoneRef: "demo-shop-b", brief })).rejects.toThrow("429 AO014");
  });

  it("converts Korean E.164 numbers to domestic form", () => {
    expect(toKoreanDomestic("+821012345678")).toBe("01012345678");
    expect(toKoreanDomestic("+8227001234")).toBe("027001234");
    expect(toKoreanDomestic("+15550100000")).toBeNull();
  });
});
