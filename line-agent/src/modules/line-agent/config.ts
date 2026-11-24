// Reads LINE agent settings from the environment. Secrets stay in env files /
// the deployment's secret store; nothing here is logged.
import { randomBytes } from "node:crypto";

export type CallMode = "off" | "simulator" | "twilio";

export type LineAgentConfig = {
  appEnv: string;
  origin: string;
  channelSecret: string | null;
  accessToken: string | null;
  keySecret: string;
  linkSecret: string;
  calls: CallMode;
  phoneAllowlist: Record<string, string>;
  twilio: { accountSid: string; authToken: string; from: string } | null;
  bridge: { host: string; secret: string } | null;
  simulatorEnabled: boolean;
  demoNow: string | null;
  simulatedCallDelayMs: number;
  store: "memory" | "postgres";
  /** Lets the simulator be used through a public URL (e.g. a tunnel) when given as ?token=. */
  simulatorToken: string | null;
};

const E164 = /^\+[1-9]\d{7,14}$/;

export function parsePhoneAllowlist(value: string | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => /^[a-z0-9-]{1,40}$/.test(entry[0]) && typeof entry[1] === "string" && E164.test(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

export function readLineAgentConfig(env: Readonly<Record<string, string | undefined>>, fallbackSecret: () => string = () => randomBytes(32).toString("base64url")): LineAgentConfig {
  const appEnv = env.APP_ENV ?? "local";
  const production = appEnv === "production";
  const value = (name: string) => env[name]?.trim() || null;

  const keySecret = value("LINE_AGENT_KEY_SECRET");
  if (!keySecret && production) throw new Error("LINE_AGENT_KEY_SECRET is required in production");
  const fallback = keySecret ?? fallbackSecret();

  const twilioSid = value("TWILIO_ACCOUNT_SID");
  const twilioToken = value("TWILIO_AUTH_TOKEN");
  const twilioFrom = value("TWILIO_FROM");
  const twilio = twilioSid && twilioToken && twilioFrom && E164.test(twilioFrom) ? { accountSid: twilioSid, authToken: twilioToken, from: twilioFrom } : null;
  const bridgeHost = value("VOICE_BRIDGE_PUBLIC_HOST");
  const bridgeSecret = value("VOICE_BRIDGE_SECRET");
  const bridge = bridgeHost && bridgeSecret && bridgeSecret.length >= 16 ? { host: bridgeHost, secret: bridgeSecret } : null;

  const requested = value("LINE_AGENT_CALLS");
  let calls: CallMode = production ? "off" : "simulator";
  if (requested === "off" || requested === "simulator") calls = requested;
  if (requested === "twilio") calls = twilio && bridge ? "twilio" : "off";

  const demoNow = value("LINE_AGENT_DEMO_NOW");
  return {
    appEnv,
    origin: value("APP_ORIGIN") ?? "http://localhost:3000",
    channelSecret: value("LINE_CHANNEL_SECRET"),
    accessToken: value("LINE_CHANNEL_ACCESS_TOKEN"),
    keySecret: fallback,
    linkSecret: value("LINE_AGENT_LINK_SECRET") ?? fallback,
    calls,
    phoneAllowlist: parsePhoneAllowlist(env.LINE_AGENT_PHONE_ALLOWLIST),
    twilio,
    bridge,
    simulatorEnabled: !production && (appEnv === "local" || appEnv === "test" || value("LINE_AGENT_SIMULATOR") === "1"),
    demoNow: demoNow && !Number.isNaN(Date.parse(demoNow)) ? new Date(demoNow).toISOString() : null,
    simulatedCallDelayMs: Number(value("LINE_AGENT_SIM_CALL_DELAY_MS") ?? 2500) || 2500,
    store: value("LINE_AGENT_STORE") === "postgres" ? "postgres" : "memory",
    simulatorToken: (value("LINE_AGENT_SIMULATOR_TOKEN")?.length ?? 0) >= 16 ? value("LINE_AGENT_SIMULATOR_TOKEN") : null,
  };
}
