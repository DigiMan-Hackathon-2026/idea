// Voice bridge for the LINE agent's phone calls.
//
// Twilio (/media) or KAT Cloud (/kat) dials the shop (the app asks it to) and
// streams the call audio here (G.711 mu-law 8 kHz; KAT mirrors Twilio's
// Media Streams messages). For each call we fetch the approved
// instructions from the app, bridge the audio to OpenAI GPT-Live
// (audio/pcmu 8000 — no transcoding), and when the call ends we send the
// transcript back. The app — never this bridge — decides what happened.
//
// Run: node --env-file-if-exists=.env.local services/voice-bridge/bridge.mjs
// Env: OPENAI_API_KEY, VOICE_BRIDGE_APP_URL (default APP_ORIGIN),
//      VOICE_BRIDGE_PORT (default 8787), OPENAI_LIVE_MODEL, OPENAI_LIVE_VOICE,
//      KAT_WEBHOOK_SECRET (checks KAT's signed WebSocket upgrade when set)
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { acceptWebSocket } from "./ws-server.mjs";

const port = Number(process.env.VOICE_BRIDGE_PORT ?? 8787);
const appUrl = (process.env.VOICE_BRIDGE_APP_URL ?? process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
const liveUrl = process.env.OPENAI_LIVE_URL ?? "wss://api.openai.com/v1/live/sessions";
const liveModel = process.env.OPENAI_LIVE_MODEL ?? "gpt-live-1";
const liveVoice = process.env.OPENAI_LIVE_VOICE ?? "marin";
const apiKey = process.env.OPENAI_API_KEY;
const closingPause = Number(process.env.VOICE_BRIDGE_CLOSING_PAUSE_MS ?? 5000);
// The AI's turn must *end* with a closing line; "감사합니다. 몇 시에 가능할까요?" is not one.
const closingLine = /(감사합니다|다시 연락드리겠습니다)[.!。\s]*$/;
const silenceLimit = Number(process.env.VOICE_BRIDGE_SILENCE_LIMIT_MS ?? 25000);
const maxQueued = 250; // ~5 s of 20 ms chunks while GPT-Live starts
const bargeInGraceMs = Number(process.env.VOICE_BRIDGE_BARGE_IN_GRACE_MS ?? 1500);
const turnGapMs = Number(process.env.VOICE_BRIDGE_TURN_GAP_MS ?? 1200);
const queuedBlockGapMs = Number(process.env.VOICE_BRIDGE_QUEUED_BLOCK_GAP_MS ?? 500);
const katSecret = process.env.KAT_WEBHOOK_SECRET?.trim() || null;

if (!apiKey) {
  console.error("OPENAI_API_KEY is missing. Put it in .env.local (never in chat or git).");
  process.exit(1);
}

const log = (event, data = {}) => console.info(JSON.stringify({ at: new Date().toISOString(), event, ...data }));

const server = createServer((request, response) => {
  if (request.url === "/health") return void response.writeHead(200, { "content-type": "text/plain" }).end("ok");
  response.writeHead(404).end();
});

server.on("upgrade", (request, socket, head) => {
  const path = request.url?.split("?")[0];
  const provider = path === "/media" ? "twilio" : path === "/kat" ? "kat" : null;
  if (!provider) return void socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
  if (provider === "kat" && !katUpgradeValid(request.headers)) {
    log("voice_bridge.kat_signature_rejected", { hasSignature: Boolean(request.headers["x-webhook-signature"]) });
    return void socket.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
  }
  const stream = acceptWebSocket(request, socket, head);
  if (stream) bridgeCall(stream, provider);
});

// KAT signs the upgrade: v1=HMAC-SHA256("{timestamp}.{callId}.{streamId}").
function katUpgradeValid(headers) {
  if (!katSecret) return true; // The attempt token in the start message still gates the call.
  const timestamp = String(headers["x-webhook-timestamp"] ?? "");
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = Buffer.from("v1=" + createHmac("sha256", katSecret).update(`${timestamp}.${headers["x-kat-call-id"] ?? ""}.${headers["x-kat-stream-id"] ?? ""}`).digest("hex"));
  const given = Buffer.from(String(headers["x-webhook-signature"] ?? ""));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

server.listen(port, () => log("voice_bridge.listening", { port, model: liveModel }));

function bridgeCall(twilio, provider) {
  const startedAt = Date.now();
  const call = { streamSid: null, attemptId: null, token: null, live: null, ready: false, queued: [], playbackEndsAt: 0, transcript: [], lastActivity: Date.now(), closingTimer: null, finished: false, latencies: [], lastShopAt: 0, aiTurnStartedAt: 0, liveEvents: {} };
  const silenceTimer = setInterval(() => {
    if (Date.now() - call.lastActivity > silenceLimit) finish("silence");
  }, 1000);

  const sendLive = (event) => call.live?.readyState === WebSocket.OPEN && call.live.send(JSON.stringify(event));
  // Twilio wants the streamSid on every message; KAT identifies the stream by its socket.
  const sendTwilio = (event) => twilio.send(JSON.stringify(provider === "twilio" ? { streamSid: call.streamSid, ...event } : event));
  // The shop's transcript lags its audio, so its deltas interleave with the AI's
  // reply. Each speaker keeps one open turn until they pause for turnGapMs;
  // turns stay in the order they started.
  const open = { shop: null, ai: null };
  const add = (speaker, delta) => {
    if (!delta) return;
    const now = Date.now();
    const turn = open[speaker];
    if (turn && now - turn.lastAt < turnGapMs) {
      turn.text += delta;
      turn.lastAt = now;
      return;
    }
    open[speaker] = { speaker, text: delta, lastAt: now };
    call.transcript.push(open[speaker]);
  };

  twilio.on("message", async (text) => {
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    if (message.event === "start") {
      call.streamSid = message.start?.streamSid ?? message.streamSid ?? message.start?.streamId ?? null;
      call.attemptId = message.start.customParameters?.attemptId ?? null;
      call.token = message.start.customParameters?.token ?? null;
      if (!call.attemptId || !/^[A-Za-z0-9_-]{8,64}$/.test(call.attemptId) || !call.token) return finish("bad_parameters", true);
      const instructions = await fetchInstructions(call.attemptId, call.token).catch(() => null);
      if (!instructions) return finish("no_instructions", true);
      log("voice_bridge.call_started", { attempt: call.attemptId, provider });
      openLive(instructions);
    } else if (message.event === "media") {
      if (!message.media?.payload || message.media.track === "outbound") return;
      if (call.ready) sendLive({ type: "session.input_audio.append", audio: message.media.payload });
      else if (call.queued.length < maxQueued) call.queued.push(message.media.payload);
    } else if (message.event === "stop") {
      finish("stream_stop");
    }
  });
  twilio.on("close", () => finish("stream_closed"));

  function openLive(instructions) {
    const live = new WebSocket(liveUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    call.live = live;
    live.addEventListener("open", () => {
      live.send(JSON.stringify({
        type: "session.start",
        session: { model: liveModel, instructions, audio: { format: { type: "audio/pcmu", rate: 8000 }, output: { voice: liveVoice } }, delegation: { type: "client" } },
      }));
    });
    live.addEventListener("message", (raw) => {
      let event;
      try {
        event = JSON.parse(typeof raw.data === "string" ? raw.data : raw.data.toString());
      } catch {
        return;
      }
      onLive(event);
    });
    live.addEventListener("close", (closeEvent) => {
      log("voice_bridge.live_closed", { attempt: call.attemptId, code: closeEvent.code });
      finish("live_closed");
    });
    live.addEventListener("error", () => log("voice_bridge.live_error", { attempt: call.attemptId }));
  }

  // Audio that arrived while GPT-Live was starting (the shop's "여보세요"). Sent
  // all at once it trips input_audio_rate_limit_exceeded, so it goes in 1 s
  // blocks, a little faster than real time, before live audio resumes.
  async function flushQueued() {
    while (call.queued.length && !call.finished) {
      const block = call.queued.splice(0, 50).map((payload) => Buffer.from(payload, "base64"));
      sendLive({ type: "session.input_audio.append", audio: Buffer.concat(block).toString("base64") });
      if (call.queued.length) await new Promise((resolve) => setTimeout(resolve, queuedBlockGapMs));
    }
    call.ready = true;
  }

  function onLive(event) {
    const now = Date.now();
    if (typeof event.type === "string") call.liveEvents[event.type] = (call.liveEvents[event.type] ?? 0) + 1;
    switch (event.type) {
      case "session.started":
        void flushQueued();
        return;
      case "session.output_audio.delta": {
        const bytes = Buffer.byteLength(event.delta ?? "", "base64");
        if (now >= call.playbackEndsAt) {
          call.aiTurnStartedAt = now;
          if (call.lastShopAt) call.latencies.push(now - call.lastShopAt);
        }
        call.playbackEndsAt = Math.max(now, call.playbackEndsAt) + bytes / 8; // 8 bytes per ms
        call.lastActivity = now;
        sendTwilio({ event: "media", media: { payload: event.delta } });
        return;
      }
      case "session.input_transcript.delta":
        // Words arriving early in the AI's reply are usually the lagging end of the
        // shop's previous sentence, not an interruption.
        if (now < call.playbackEndsAt - 200 && now - call.aiTurnStartedAt > bargeInGraceMs) {
          // The shop talks over the AI: drop audio the carrier still has queued.
          sendTwilio({ event: "clear" });
          call.playbackEndsAt = now;
        }
        call.lastShopAt = now;
        call.lastActivity = now;
        if (call.closingTimer) {
          clearTimeout(call.closingTimer);
          call.closingTimer = null;
        }
        add("shop", event.delta);
        return;
      case "session.output_transcript.delta":
        call.lastActivity = now;
        add("ai", event.delta);
        // After a closing line, hang up once the audio has played and the shop is quiet.
        if (call.closingTimer) {
          clearTimeout(call.closingTimer);
          call.closingTimer = null;
        }
        if (closingLine.test(open.ai?.text ?? "")) {
          call.closingTimer = setTimeout(() => finish("closing"), Math.max(0, call.playbackEndsAt - Date.now()) + closingPause);
        }
        return;
      case "error":
        log("voice_bridge.live_event_error", { attempt: call.attemptId, code: event.error?.code ?? null, message: String(event.error?.message ?? "").slice(0, 200) });
        return;
      default:
        return;
    }
  }

  async function finish(reason, failed = false) {
    if (call.finished) return;
    call.finished = true;
    clearInterval(silenceTimer);
    if (call.closingTimer) clearTimeout(call.closingTimer);
    if (call.live?.readyState === WebSocket.OPEN) {
      sendLive({ type: "session.close" });
      setTimeout(() => call.live?.close(), 1500);
    }
    // Closing the stream ends the call (Twilio finishes the TwiML; KAT hangs up with STREAM_ENDED).
    if (twilio.isOpen) twilio.close();
    const turns = call.transcript.map((turn) => ({ speaker: turn.speaker, text: turn.text.trim() })).filter((turn) => turn.text);
    const sorted = [...call.latencies].sort((a, b) => a - b);
    log("voice_bridge.call_finished", { attempt: call.attemptId, reason, seconds: Math.round((Date.now() - startedAt) / 1000), turns: turns.length, medianLatencyMs: sorted[Math.floor(sorted.length / 2)] ?? null, liveEvents: call.liveEvents });
    if (!call.attemptId || !call.token) return;
    await postResult(call.attemptId, call.token, failed ? { failed: true } : { transcript: turns }).catch(() => log("voice_bridge.result_failed", { attempt: call.attemptId }));
  }
}

async function fetchInstructions(attemptId, token) {
  const response = await fetch(`${appUrl}/api/v1/integrations/voice/attempts/${attemptId}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;
  const body = await response.json();
  return typeof body.instructions === "string" ? body.instructions : null;
}

async function postResult(attemptId, token, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${appUrl}/api/v1/integrations/voice/attempts/${attemptId}/result`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (response && (response.ok || (response.status >= 400 && response.status < 500))) return;
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}
