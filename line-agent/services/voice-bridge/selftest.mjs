// Offline check of the voice bridge: fake app, fake GPT-Live, fake Twilio and KAT Cloud.
// Run: node services/voice-bridge/selftest.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { acceptWebSocket } from "./ws-server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ports = { app: 18911, live: 18912, bridge: 18913 };
const chunk = Buffer.alloc(160, 0xff).toString("base64");
const aiAudio = Buffer.alloc(4000, 0x7f).toString("base64");
const token = "token-abc";
const katSecret = "whsec_selftest";
let attemptId = "attempt0001";

let seen = fresh();
// appends counts audio bytes: the shop's five 20 ms chunks (800 bytes) start the fake conversation.
function fresh() {
  return { instructionsAuth: null, result: null, resultAuth: null, start: null, appends: 0 };
}

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
    if (event.type === "session.input_audio.append" && seen.appends < 800 && (seen.appends += Buffer.byteLength(event.audio, "base64")) >= 800) {
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
  env: { ...process.env, OPENAI_API_KEY: "test-key", OPENAI_LIVE_URL: `ws://127.0.0.1:${ports.live}`, VOICE_BRIDGE_PORT: String(ports.bridge), VOICE_BRIDGE_APP_URL: `http://127.0.0.1:${ports.app}`, VOICE_BRIDGE_CLOSING_PAUSE_MS: "200", KAT_WEBHOOK_SECRET: katSecret },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
bridge.stdout.on("data", (data) => (output += data));
bridge.stderr.on("data", (data) => (output += data));
await waitFor(() => output.includes("voice_bridge.listening"), "bridge start");

// Twilio: /media, streamSid inside start, streamSid echoed on every message.
{
  const { fromBridge, closed, socket } = await openStream(`ws://127.0.0.1:${ports.bridge}/media`);
  socket.send(JSON.stringify({ event: "connected" }));
  socket.send(JSON.stringify({ event: "start", streamSid: "MZ1", start: { streamSid: "MZ1", callSid: "CA1", customParameters: { attemptId, token } } }));
  for (let i = 0; i < 5; i++) socket.send(JSON.stringify({ event: "media", streamSid: "MZ1", media: { track: "inbound", payload: chunk } }));
  await checkCall(fromBridge, closed);
  assert.equal(fromBridge.find((m) => m.event === "media")?.streamSid, "MZ1");
}

// KAT Cloud: /kat with a signed upgrade, metadata arrives as customParameters.
{
  const timestamp = String(Math.floor(Date.now() / 1000));
  const unsigned = await openStream(`ws://127.0.0.1:${ports.bridge}/kat`, {}).catch(() => null);
  assert.equal(unsigned, null, "KAT upgrade without a signature is refused");

  attemptId = "attempt0002";
  seen = fresh();
  const callId = "0b4c8e1e-0000-4000-8000-000000000001";
  const streamId = "MZ" + "a".repeat(32);
  const signature = "v1=" + createHmac("sha256", katSecret).update(`${timestamp}.${callId}.${streamId}`).digest("hex");
  const { fromBridge, closed, socket } = await openStream(`ws://127.0.0.1:${ports.bridge}/kat`, {
    "X-Kat-Call-Id": callId,
    "X-Kat-Stream-Id": streamId,
    "X-Webhook-Timestamp": timestamp,
    "X-Webhook-Signature": signature,
  });
  socket.send(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
  socket.send(JSON.stringify({ event: "start", sequenceNumber: "1", streamSid: streamId, start: { streamId, callId, accountId: "KAT1", tracks: ["inbound"], mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 }, customParameters: { attemptId, token }, direction: "outbound" } }));
  for (let i = 0; i < 5; i++) socket.send(JSON.stringify({ event: "media", sequenceNumber: String(i + 2), streamSid: streamId, media: { track: "inbound", chunk: String(i + 1), timestamp: String(i * 20), payload: chunk } }));
  await checkCall(fromBridge, closed);
  assert.equal(fromBridge.find((m) => m.event === "media")?.streamSid, undefined);
}

bridge.kill();
app.close();
live.close();
console.log("voice bridge selftest passed");
process.exit(0);

async function openStream(url, headers) {
  const fromBridge = [];
  const closed = { value: false };
  const socket = new WebSocket(url, headers ? { headers } : undefined);
  socket.addEventListener("message", (raw) => fromBridge.push(JSON.parse(raw.data)));
  socket.addEventListener("close", () => (closed.value = true));
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", reject);
  });
  return { fromBridge, closed, socket };
}

async function checkCall(fromBridge, closed) {
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
  await waitFor(() => closed.value, "stream closed after the closing line");
}

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
