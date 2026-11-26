// Offline check of bridge.mjs with no accounts: a fake GPT-Live server and a
// fake Twilio Media Stream client. Verifies audio passes through unchanged,
// audio sent before GPT-Live is ready is queued, the session asks for mu-law,
// and a barge-in clears Twilio's playback buffer.
//
// Run: node spikes/call/selftest.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { acceptWebSocket } from "./ws-server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const livePort = 18901;
const bridgePort = 18902;
const logDir = mkdtempSync(join(tmpdir(), "call-spike-"));
const chunk = Buffer.alloc(160, 0xff).toString("base64"); // 20 ms of mu-law silence
const aiAudio = Buffer.alloc(8000, 0x7f).toString("base64"); // 1 s of AI audio

const seenByLive = { start: null, appends: [] };
const liveServer = createServer();
liveServer.on("upgrade", (request, socket, head) => {
  assert.equal(request.headers.authorization, "Bearer test-key");
  const live = acceptWebSocket(request, socket, head);
  live.on("message", (text) => {
    const event = JSON.parse(text);
    if (event.type === "session.start") {
      seenByLive.start = event.session;
      // Start late so the bridge has to queue the first chunks.
      setTimeout(() => live.send(JSON.stringify({ type: "session.started", session: { id: "live_test" } })), 300);
    }
    if (event.type === "session.input_audio.append") {
      seenByLive.appends.push(event.audio);
      if (seenByLive.appends.length === 10) {
        live.send(JSON.stringify({ type: "session.input_transcript.delta", delta: "여보세요" }));
        setTimeout(() => {
          live.send(JSON.stringify({ type: "session.output_audio.delta", delta: aiAudio }));
          live.send(JSON.stringify({ type: "session.output_transcript.delta", delta: "안녕하세요, AI 예약 비서입니다." }));
          // The shop talks over the AI 50 ms later.
          setTimeout(() => live.send(JSON.stringify({ type: "session.input_transcript.delta", delta: "잠시만요" })), 50);
        }, 120);
      }
    }
    if (event.type === "session.close") live.send(JSON.stringify({ type: "session.closed" }));
  });
});
await new Promise((resolve) => liveServer.listen(livePort, resolve));

const bridge = spawn(process.execPath, [join(here, "bridge.mjs")], {
  env: {
    ...process.env,
    OPENAI_API_KEY: "test-key",
    OPENAI_LIVE_URL: `ws://127.0.0.1:${livePort}`,
    CALL_BRIDGE_PORT: String(bridgePort),
    CALL_LOG_DIR: logDir,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let bridgeOutput = "";
bridge.stdout.on("data", (data) => (bridgeOutput += data));
bridge.stderr.on("data", (data) => (bridgeOutput += data));
await waitFor(() => bridgeOutput.includes("listening"), "bridge to start");

const fromBridge = [];
const twilio = new WebSocket(`ws://127.0.0.1:${bridgePort}/media`);
twilio.addEventListener("message", (raw) => fromBridge.push(JSON.parse(raw.data)));
await new Promise((resolve) => twilio.addEventListener("open", resolve));
twilio.send(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
twilio.send(
  JSON.stringify({
    event: "start",
    streamSid: "MZtest",
    start: {
      streamSid: "MZtest",
      callSid: "CAtest",
      tracks: ["inbound"],
      mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
      customParameters: { scenario: "full" },
    },
  }),
);
for (let i = 0; i < 10; i++) {
  twilio.send(JSON.stringify({ event: "media", streamSid: "MZtest", media: { track: "inbound", payload: chunk } }));
}

await waitFor(() => fromBridge.some((m) => m.event === "clear"), "barge-in clear");
twilio.send(JSON.stringify({ event: "stop", streamSid: "MZtest" }));
await waitFor(() => bridgeOutput.includes("call finished"), "call summary");

const media = fromBridge.find((m) => m.event === "media");
assert.equal(media.streamSid, "MZtest");
assert.equal(media.media.payload, aiAudio, "AI audio reaches Twilio unchanged");
assert.deepEqual(seenByLive.start.audio.format, { type: "audio/pcmu", rate: 8000 });
assert.match(seenByLive.start.instructions, /예약을 도와드리는 AI 비서/);
assert.match(seenByLive.start.instructions, /저녁 8시/, "scenario parameter selects the 'full' script");
assert.equal(seenByLive.appends.length, 10, "queued chunks are flushed after session.started");
assert.ok(seenByLive.appends.every((audio) => audio === chunk), "caller audio reaches GPT-Live unchanged");
const summary = JSON.parse(bridgeOutput.match(/call finished (\{.*\})/)[1]);
assert.equal(summary.bargeIns, 1);
assert.equal(summary.turnLatencyMs.turns, 1);
assert.match(bridgeOutput, /가게: 여보세요/);
assert.match(bridgeOutput, /AI: 안녕하세요, AI 예약 비서입니다\./);

twilio.close();
bridge.kill();
liveServer.close();
rmSync(logDir, { recursive: true, force: true });
console.log("selftest passed:", JSON.stringify(summary));
process.exit(0);

async function waitFor(check, label, timeoutMs = 5000) {
  const until = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > until) {
      bridge.kill();
      throw new Error(`timed out waiting for ${label}\n--- bridge output ---\n${bridgeOutput}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
