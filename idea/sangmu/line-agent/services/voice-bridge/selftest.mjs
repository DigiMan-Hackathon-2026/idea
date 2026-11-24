// Offline check of the voice bridge: fake app, fake GPT-Live, fake Twilio.
// Run: node services/voice-bridge/selftest.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { acceptWebSocket } from "./ws-server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ports = { app: 18911, live: 18912, bridge: 18913 };
const chunk = Buffer.alloc(160, 0xff).toString("base64");
const aiAudio = Buffer.alloc(4000, 0x7f).toString("base64");
const attemptId = "attempt0001";
const token = "token-abc";

const seen = { instructionsAuth: null, result: null, resultAuth: null, start: null, appends: 0 };

const app = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === `/api/v1/integrations/voice/attempts/${attemptId}`) {
    seen.instructionsAuth = request.headers.authorization;
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ instructions: "테스트 지시문" }));
    return;
  }
  if (request.method === "POST" && request.url === `/api/v1/integrations/voice/attempts/${attemptId}/result`) {
    let body = "";
    for await (const part of request) body += part;
    seen.result = JSON.parse(body);
    seen.resultAuth = request.headers.authorization;
    response.writeHead(202).end();
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => app.listen(ports.app, resolve));

const live = createServer();
live.on("upgrade", (request, socket, head) => {
  const ws = acceptWebSocket(request, socket, head);
  ws.on("message", (text) => {
    const event = JSON.parse(text);
    if (event.type === "session.start") {
      seen.start = event.session;
      setTimeout(() => ws.send(JSON.stringify({ type: "session.started", session: { id: "live_1" } })), 100);
    }
    if (event.type === "session.input_audio.append" && ++seen.appends === 5) {
      ws.send(JSON.stringify({ type: "session.input_transcript.delta", delta: "네, 테스트 매장입니다." }));
      ws.send(JSON.stringify({ type: "session.output_audio.delta", delta: aiAudio }));
      ws.send(JSON.stringify({ type: "session.output_transcript.delta", delta: "안녕하세요, AI 비서입니다. " }));
      ws.send(JSON.stringify({ type: "session.output_transcript.delta", delta: "감사합니다." }));
    }
    if (event.type === "session.close") ws.send(JSON.stringify({ type: "session.closed" }));
  });
});
await new Promise((resolve) => live.listen(ports.live, resolve));

const bridge = spawn(process.execPath, [join(here, "bridge.mjs")], {
  env: { ...process.env, OPENAI_API_KEY: "test-key", OPENAI_LIVE_URL: `ws://127.0.0.1:${ports.live}`, VOICE_BRIDGE_PORT: String(ports.bridge), VOICE_BRIDGE_APP_URL: `http://127.0.0.1:${ports.app}`, VOICE_BRIDGE_CLOSING_PAUSE_MS: "200" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
bridge.stdout.on("data", (data) => (output += data));
bridge.stderr.on("data", (data) => (output += data));
await waitFor(() => output.includes("voice_bridge.listening"), "bridge start");

const fromBridge = [];
let twilioClosed = false;
const twilio = new WebSocket(`ws://127.0.0.1:${ports.bridge}/media`);
twilio.addEventListener("message", (raw) => fromBridge.push(JSON.parse(raw.data)));
twilio.addEventListener("close", () => (twilioClosed = true));
await new Promise((resolve) => twilio.addEventListener("open", resolve));
twilio.send(JSON.stringify({ event: "connected" }));
twilio.send(JSON.stringify({ event: "start", streamSid: "MZ1", start: { streamSid: "MZ1", callSid: "CA1", customParameters: { attemptId, token } } }));
for (let i = 0; i < 5; i++) twilio.send(JSON.stringify({ event: "media", streamSid: "MZ1", media: { track: "inbound", payload: chunk } }));

await waitFor(() => seen.result !== null, "result post", 8000);
assert.equal(seen.instructionsAuth, `Bearer ${token}`);
assert.equal(seen.resultAuth, `Bearer ${token}`);
assert.equal(seen.start.instructions, "테스트 지시문");
assert.deepEqual(seen.start.audio.format, { type: "audio/pcmu", rate: 8000 });
assert.equal(fromBridge.find((m) => m.event === "media")?.media.payload, aiAudio);
assert.deepEqual(seen.result.transcript, [
  { speaker: "shop", text: "네, 테스트 매장입니다." },
  { speaker: "ai", text: "안녕하세요, AI 비서입니다. 감사합니다." },
]);
await waitFor(() => twilioClosed, "stream closed after the closing line");

bridge.kill();
app.close();
live.close();
console.log("voice bridge selftest passed");
process.exit(0);

async function waitFor(check, label, timeoutMs = 5000) {
  const until = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > until) {
      bridge.kill();
      throw new Error(`timed out waiting for ${label}\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
