// Approach B, step 2: ask Twilio to call a test phone and stream the call to
// the bridge. Start bridge.mjs and a public tunnel to it first.
//
// Run: node --env-file-if-exists=.env.local spikes/call/call-stream.mjs [scenario]
// Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (E.164),
//      CALL_TO (E.164, a teammate who agreed), CALL_BRIDGE_PUBLIC_HOST (no scheme)
import { scenarios } from "./scenarios.mjs";

const required = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM", "CALL_TO", "CALL_BRIDGE_PUBLIC_HOST"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

const scenario = process.argv[2] ?? "dinner";
if (!scenarios[scenario]) {
  console.error(`Unknown scenario "${scenario}". Use one of: ${Object.keys(scenarios).join(", ")}`);
  process.exit(1);
}

const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from, CALL_TO: to } = process.env;
const host = process.env.CALL_BRIDGE_PUBLIC_HOST.replace(/^\w+:\/\//, "").replace(/\/$/, "");
const twiml =
  `<Response><Connect><Stream url="wss://${host}/media">` +
  `<Parameter name="scenario" value="${scenario}"/>` +
  `</Stream></Connect></Response>`;

const auth = "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
const base = `https://api.twilio.com/2010-04-01/Accounts/${sid}`;

const created = await fetch(`${base}/Calls.json`, {
  method: "POST",
  headers: { Authorization: auth, "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ To: to, From: from, Twiml: twiml, TimeLimit: "300" }),
});
const call = await created.json();
if (!created.ok) {
  console.error(`Twilio refused the call (${created.status}): ${call.message ?? JSON.stringify(call)}`);
  process.exit(1);
}
console.log(`[call] ${call.sid} → ${mask(to)} (scenario ${scenario}), status ${call.status}`);

const done = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);
for (;;) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const response = await fetch(`${base}/Calls/${call.sid}.json`, { headers: { Authorization: auth } });
  const state = await response.json();
  if (done.has(state.status)) {
    console.log(`[call] ${state.status}, ${state.duration ?? "?"} s, price ${state.price ?? "pending"} ${state.price_unit ?? ""}`);
    break;
  }
  process.stdout.write(`[call] ${state.status}\r`);
}

function mask(number) {
  return number.replace(/\d(?=\d{4})/g, "•");
}
