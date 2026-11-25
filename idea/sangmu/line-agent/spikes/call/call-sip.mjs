// Approach A: OpenAI GPT-Live places the call itself over a SIP trunk
// (TLS on 5061 + SDES-SRTP media). No bridge server is needed; we only watch
// the call on the sideband socket and hang up when asked.
//
// Run: node --env-file-if-exists=.env.local spikes/call/call-sip.mjs [scenario]
// Env: OPENAI_API_KEY, CALL_TO (E.164, a teammate who agreed),
//      SIP_TRUNK_URL (e.g. sips:<trunk>.pstn.twilio.com:5061),
//      SIP_USERNAME, SIP_PASSWORD, SIP_CALLER_NUMBER (E.164)
import { scenarios } from "./scenarios.mjs";

const required = ["OPENAI_API_KEY", "CALL_TO", "SIP_TRUNK_URL", "SIP_USERNAME", "SIP_PASSWORD", "SIP_CALLER_NUMBER"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

const scenarioId = process.argv[2] ?? "dinner";
const scenario = scenarios[scenarioId];
if (!scenario) {
  console.error(`Unknown scenario "${scenarioId}". Use one of: ${Object.keys(scenarios).join(", ")}`);
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
const api = process.env.OPENAI_LIVE_API ?? "https://api.openai.com/v1/live/sessions";
const startedAt = Date.now();
const elapsed = () => `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;

const response = await fetch(api, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
  body: JSON.stringify({
    session: {
      model: process.env.OPENAI_LIVE_MODEL ?? "gpt-live-1",
      instructions: scenario.instructions,
      audio: { output: { voice: process.env.OPENAI_LIVE_VOICE ?? "marin" } },
      delegation: { type: "client" },
    },
    transport: {
      type: "sip",
      destination: process.env.CALL_TO,
      trunk: {
        provider_url: process.env.SIP_TRUNK_URL,
        auth: { type: "digest", username: process.env.SIP_USERNAME, password: process.env.SIP_PASSWORD },
        caller_number: process.env.SIP_CALLER_NUMBER,
      },
    },
  }),
});
const created = await response.json();
if (!response.ok) {
  console.error(`OpenAI refused the call (${response.status}): ${JSON.stringify(created.error ?? created)}`);
  process.exit(1);
}
const sessionId = created.session.id;
console.log(`[sip] session ${sessionId} created (scenario ${scenarioId}); ringing does not mean answered`);

const seen = new Set();
const timings = {};
const sideband = new WebSocket(`${api.replace(/^http/, "ws")}/${sessionId}/attach`, {
  headers: { Authorization: `Bearer ${apiKey}` },
});

sideband.addEventListener("message", (raw) => {
  const event = JSON.parse(typeof raw.data === "string" ? raw.data : raw.data.toString());
  if (event.event_id) {
    if (seen.has(event.event_id)) return; // the sideband replays the last 3 s on attach
    seen.add(event.event_id);
  }
  switch (event.type) {
    case "transport.ringing":
    case "transport.answered":
      timings[event.type] = elapsed();
      console.log(`[sip] ${elapsed()} ${event.type}`);
      break;
    case "transport.failed":
      console.error(`[sip] ${elapsed()} call failed: ${event.error?.code} ${event.error?.message}`);
      break;
    case "session.input_transcript.delta":
    case "session.output_transcript.delta":
      process.stdout.write(event.delta ?? "");
      break;
    case "session.closed":
      console.log(`\n[sip] ${elapsed()} session closed`, JSON.stringify({ timings, usage: event.usage ?? null }));
      sideband.close();
      break;
    case "error":
      console.error(`[sip] error: ${JSON.stringify(event.error ?? event)}`);
      break;
    default:
      console.log(`[sip] ${elapsed()} ${event.type}`);
  }
});

sideband.addEventListener("close", () => process.exit(0));

process.on("SIGINT", async () => {
  console.log("\n[sip] hanging up");
  await fetch(`${api}/${sessionId}/hangup`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` } });
});
