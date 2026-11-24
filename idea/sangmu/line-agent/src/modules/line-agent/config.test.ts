import { describe, expect, it } from "vitest";
import { parsePhoneAllowlist, readLineAgentConfig } from "./config";

const secret = () => "generated";

describe("readLineAgentConfig", () => {
  it("defaults to the call simulator and an in-memory store outside production", () => {
    const config = readLineAgentConfig({ APP_ENV: "local" }, secret);
    expect(config).toMatchObject({ calls: "simulator", simulatorEnabled: true, store: "memory", keySecret: "generated" });
  });

  it("keeps calls off in production unless asked, and never enables the simulator", () => {
    const config = readLineAgentConfig({ APP_ENV: "production", LINE_AGENT_KEY_SECRET: "k".repeat(32), LINE_AGENT_SIMULATOR: "1" }, secret);
    expect(config).toMatchObject({ calls: "off", simulatorEnabled: false });
  });

  it("requires a key secret in production", () => {
    expect(() => readLineAgentConfig({ APP_ENV: "production" }, secret)).toThrow();
  });

  it("turns on real calls only with Twilio and the bridge configured", () => {
    const twilio = { TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "+15550100000" };
    expect(readLineAgentConfig({ APP_ENV: "local", LINE_AGENT_CALLS: "twilio", ...twilio }, secret).calls).toBe("off");
    expect(readLineAgentConfig({ APP_ENV: "local", LINE_AGENT_CALLS: "twilio", ...twilio, VOICE_BRIDGE_PUBLIC_HOST: "b.example.test", VOICE_BRIDGE_SECRET: "s".repeat(16) }, secret).calls).toBe("twilio");
  });

  it("reads a demo clock", () => {
    expect(readLineAgentConfig({ APP_ENV: "local", LINE_AGENT_DEMO_NOW: "2026-11-29T17:30:00+09:00" }, secret).demoNow).toBe("2026-11-29T08:30:00.000Z");
  });
});

describe("parsePhoneAllowlist", () => {
  it("keeps only E.164 numbers under simple refs", () => {
    expect(parsePhoneAllowlist('{"demo-shop-a":"+821000000002","bad ref":"+821000000000","demo-shop-b":"010-1234"}')).toEqual({ "demo-shop-a": "+821000000002" });
    expect(parsePhoneAllowlist("not json")).toEqual({});
  });
});
