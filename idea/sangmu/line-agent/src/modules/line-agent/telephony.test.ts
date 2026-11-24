import { afterEach, describe, expect, it, vi } from "vitest";
import { TwilioCallPlacer } from "./telephony";
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
