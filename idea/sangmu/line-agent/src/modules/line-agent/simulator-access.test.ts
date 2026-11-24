import { describe, expect, it } from "vitest";
import { simulatorAllowed } from "./simulator-access";

const local = { host: "localhost:3000", forwardedHost: "localhost:3000", forwardedFor: "::1", cfConnectingIp: null };

describe("simulatorAllowed", () => {
  it("answers on the machine itself, including Next's own loopback forwarding", () => {
    expect(simulatorAllowed(local, null, null)).toBe(true);
    expect(simulatorAllowed({ ...local, host: "127.0.0.1:3110", forwardedHost: null, forwardedFor: "127.0.0.1" }, null, null)).toBe(true);
  });

  it("refuses tunnelled or public requests without the token", () => {
    expect(simulatorAllowed({ ...local, host: "demo.trycloudflare.com" }, null, null)).toBe(false);
    expect(simulatorAllowed({ ...local, cfConnectingIp: "203.0.113.9" }, null, null)).toBe(false);
    expect(simulatorAllowed({ ...local, forwardedFor: "203.0.113.9" }, null, null)).toBe(false);
    expect(simulatorAllowed({ ...local, forwardedHost: "demo.ngrok.app" }, null, null)).toBe(false);
    expect(simulatorAllowed({ ...local, cfConnectingIp: "203.0.113.9" }, "wrong-token-123456", "right-token-123456")).toBe(false);
  });

  it("accepts the simulator token from anywhere", () => {
    expect(simulatorAllowed({ ...local, host: "demo.trycloudflare.com", cfConnectingIp: "203.0.113.9" }, "right-token-123456", "right-token-123456")).toBe(true);
  });
});
