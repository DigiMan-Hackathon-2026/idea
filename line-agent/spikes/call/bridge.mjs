// Approach B: Twilio Media Streams <-> OpenAI GPT-Live over WebSocket.
// Twilio sends the callee's audio (G.711 mu-law, 8 kHz) to /media; we pass it
// straight to GPT-Live (audio/pcmu 8000) and play GPT-Live's audio back into
// the call. No transcoding is needed because both sides use mu-law.
//
// Run: node --env-file-if-exists=.env.local spikes/call/bridge.mjs
import { createServer } from "node:http";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { acceptWebSocket } from "./ws-server.mjs";
import { scenarioFor } from "./scenarios.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.CALL_BRIDGE_PORT ?? 8787);
const liveUrl = process.env.OPENAI_LIVE_URL ?? "wss://api.openai.com/v1/live/sessions";
const liveModel = process.env.OPENAI_LIVE_MODEL ?? "gpt-live-1";
const liveVoice = process.env.OPENAI_LIVE_VOICE ?? "marin";
const apiKey = process.env.OPENAI_API_KEY;
const logDir = process.env.CALL_LOG_DIR ?? join(here, "logs");
const mulawBytesPerMs = 8; // 8000 samples/s, 1 byte per sample
const maxQueuedChunks = 250; // ~5 s of 20 ms Twilio chunks while GPT-Live starts

if (!apiKey) {
  console.error("OPENAI_API_KEY is missing. Add it to .env.local (never paste it in chat).");
  process.exit(1);
}

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  response.writeHead(404).end();
});

server.on("upgrade", (request, socket, head) => {
  if (!request.url?.startsWith("/media")) {
    socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
    return;
  }
  const twilio = acceptWebSocket(request, socket, head);
  if (twilio) bridgeCall(twilio);
});

server.listen(port, () => {
  console.log(`[bridge] listening on :${port} (model ${liveModel}, voice ${liveVoice})`);
});

function bridgeCall(twilio) {
  const startedAt = Date.now();
  const call = {
    streamSid: null,
    callSid: null,
    scenario: null,
    live: null,
    liveReady: false,
    queued: [],
    playbackEndsAt: 0,
    lastInputAt: 0,
    turnLatenciesMs: [],
    firstAudioMs: null,
    bargeIns: 0,
    transcript: [],
    logFile: null,
  };

  const log = (direction, event) => {
    if (!call.logFile) return;
    const entry = { t: Date.now() - startedAt, direction, ...event };
    appendFileSync(call.logFile, JSON.stringify(entry) + "\n");
  };

  const sendLive = (event) => {
    if (call.live?.readyState === WebSocket.OPEN) call.live.send(JSON.stringify(event));
  };

  const sendTwilio = (event) => twilio.send(JSON.stringify({ streamSid: call.streamSid, ...event }));

  const appendInput = (payload) => sendLive({ type: "session.input_audio.append", audio: payload });

  twilio.on("message", (text) => {
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    switch (message.event) {
      case "start": {
        call.streamSid = message.start.streamSid;
        call.callSid = message.start.callSid;
        call.scenario = message.start.customParameters?.scenario ?? "dinner";
        mkdirSync(logDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        call.logFile = join(logDir, `${stamp}-${call.callSid ?? "call"}.jsonl`);
        console.log(`[bridge] call ${call.callSid} started, scenario=${call.scenario}`);
        log("twilio", { type: "start", scenario: call.scenario, mediaFormat: message.start.mediaFormat });
        openLive(call.scenario);
        break;
      }
      case "media": {
        if (message.media.track && message.media.track !== "inbound") return;
        if (call.liveReady) {
          appendInput(message.media.payload);
        } else if (call.queued.length < maxQueuedChunks) {
          call.queued.push(message.media.payload);
        }
        break;
      }
      case "stop":
        log("twilio", { type: "stop" });
        finish("twilio stop");
        break;
      default:
        log("twilio", { type: message.event });
    }
  });

  twilio.on("close", () => finish("twilio closed"));

  function openLive(scenarioId) {
    const scenario = scenarioFor(scenarioId);
    const live = new WebSocket(liveUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    call.live = live;

    live.addEventListener("open", () => {
      const session = {
        model: liveModel,
        instructions: scenario.instructions,
        audio: { format: { type: "audio/pcmu", rate: 8000 }, output: { voice: liveVoice } },
        delegation: { type: "client" },
      };
      live.send(JSON.stringify({ type: "session.start", session }));
      log("to-live", { type: "session.start", model: liveModel, scenario: scenarioId });
    });

    live.addEventListener("message", (raw) => {
      let event;
      try {
        event = JSON.parse(typeof raw.data === "string" ? raw.data : raw.data.toString());
      } catch {
        return;
      }
      handleLive(event);
    });

    live.addEventListener("error", () => {
      console.error("[bridge] GPT-Live socket error");
      log("live", { type: "socket.error" });
    });

    live.addEventListener("close", (closeEvent) => {
      log("live", { type: "socket.close", code: closeEvent.code, reason: closeEvent.reason });
      finish(`live closed ${closeEvent.code}`);
    });
  }

  function handleLive(event) {
    const now = Date.now();
    switch (event.type) {
      case "session.started":
        call.liveReady = true;
        log("live", { type: event.type, session: event.session?.id ?? event.session_id });
        for (const payload of call.queued) appendInput(payload);
        call.queued = [];
        return;
      case "session.output_audio.delta": {
        const bytes = Buffer.byteLength(event.delta ?? "", "base64");
        const idle = now >= call.playbackEndsAt;
        if (call.firstAudioMs === null) call.firstAudioMs = now - startedAt;
        if (idle && call.lastInputAt > 0) {
          call.turnLatenciesMs.push(now - call.lastInputAt);
          log("metric", { type: "turn.latency", ms: now - call.lastInputAt });
        }
        call.playbackEndsAt = Math.max(now, call.playbackEndsAt) + bytes / mulawBytesPerMs;
        sendTwilio({ event: "media", media: { payload: event.delta } });
        return;
      }
      case "session.input_transcript.delta": {
        const speaking = now < call.playbackEndsAt - 200;
        if (speaking) {
          // The shop started talking over the AI: drop the audio Twilio still has queued.
          sendTwilio({ event: "clear" });
          call.playbackEndsAt = now;
          call.bargeIns += 1;
          log("metric", { type: "barge-in" });
        }
        call.lastInputAt = now;
        addTranscript("가게", event.delta);
        log("live", { type: event.type, delta: event.delta });
        return;
      }
      case "session.output_transcript.delta":
        addTranscript("AI", event.delta);
        log("live", { type: event.type, delta: event.delta });
        return;
      case "error":
        console.error("[bridge] GPT-Live error:", JSON.stringify(event.error ?? event));
        log("live", event);
        return;
      default:
        log("live", stripAudio(event));
    }
  }

  function addTranscript(speaker, delta) {
    if (!delta) return;
    const last = call.transcript.at(-1);
    if (last?.speaker === speaker) last.text += delta;
    else call.transcript.push({ speaker, text: delta });
  }

  let finished = false;
  function finish(reason) {
    if (finished) return;
    finished = true;
    if (call.live?.readyState === WebSocket.OPEN) {
      sendLive({ type: "session.close" });
      setTimeout(() => call.live?.close(), 1500);
    }
    if (twilio.isOpen) twilio.close();
    const summary = {
      reason,
      callSid: call.callSid,
      scenario: call.scenario,
      seconds: Math.round((Date.now() - startedAt) / 1000),
      firstAudioMs: call.firstAudioMs,
      turnLatencyMs: describe(call.turnLatenciesMs),
      bargeIns: call.bargeIns,
    };
    log("summary", summary);
    console.log("[bridge] call finished", JSON.stringify(summary));
    for (const line of call.transcript) console.log(`  ${line.speaker}: ${line.text.trim()}`);
    if (call.logFile) console.log(`[bridge] log: ${call.logFile}`);
  }
}

function describe(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (q) => sorted.at(Math.min(sorted.length - 1, Math.floor(q * sorted.length)));
  return { turns: values.length, median: pick(0.5), p90: pick(0.9), max: sorted.at(-1) };
}

function stripAudio(event) {
  const copy = { ...event };
  for (const key of ["delta", "audio"]) {
    if (typeof copy[key] === "string" && copy[key].length > 200) copy[key] = `<${copy[key].length} chars>`;
  }
  return copy;
}
