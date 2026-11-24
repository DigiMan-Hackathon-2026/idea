// Voice bridge for the LINE agent's phone calls.
//
// Twilio dials the shop (the app asks it to) and streams the call audio here
// (<Connect><Stream>, G.711 mu-law 8 kHz). For each call we fetch the approved
// instructions from the app, bridge the audio to OpenAI GPT-Live
// (audio/pcmu 8000 — no transcoding), and when the call ends we send the
// transcript back. The app — never this bridge — decides what happened.
//
// Run: node --env-file-if-exists=.env.local services/voice-bridge/bridge.mjs
// Env: OPENAI_API_KEY, VOICE_BRIDGE_APP_URL (default APP_ORIGIN),
//      VOICE_BRIDGE_PORT (default 8787), OPENAI_LIVE_MODEL, OPENAI_LIVE_VOICE
import { createServer } from "node:http";
import { acceptWebSocket } from "./ws-server.mjs";

const port = Number(process.env.VOICE_BRIDGE_PORT ?? 8787);
const appUrl = (process.env.VOICE_BRIDGE_APP_URL ?? process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
const liveUrl = process.env.OPENAI_LIVE_URL ?? "wss://api.openai.com/v1/live/sessions";
const liveModel = process.env.OPENAI_LIVE_MODEL ?? "gpt-live-1";
const liveVoice = process.env.OPENAI_LIVE_VOICE ?? "marin";
const apiKey = process.env.OPENAI_API_KEY;
const closingPause = Number(process.env.VOICE_BRIDGE_CLOSING_PAUSE_MS ?? 4000);
const silenceLimit = Number(process.env.VOICE_BRIDGE_SILENCE_LIMIT_MS ?? 25000);
const maxQueued = 250; // ~5 s of 20 ms chunks while GPT-Live starts

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
  if (!request.url?.startsWith("/media")) return void socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
  const twilio = acceptWebSocket(request, socket, head);
  if (twilio) bridgeCall(twilio);
});

server.listen(port, () => log("voice_bridge.listening", { port, model: liveModel }));

function bridgeCall(twilio) {
  const startedAt = Date.now();
  const call = { streamSid: null, attemptId: null, token: null, live: null, ready: false, queued: [], playbackEndsAt: 0, transcript: [], lastActivity: Date.now(), closingTimer: null, finished: false, latencies: [], lastShopAt: 0 };
  const silenceTimer = setInterval(() => {
    if (Date.now() - call.lastActivity > silenceLimit) finish("silence");
  }, 1000);

  const sendLive = (event) => call.live?.readyState === WebSocket.OPEN && call.live.send(JSON.stringify(event));
  const sendTwilio = (event) => twilio.send(JSON.stringify({ streamSid: call.streamSid, ...event }));
  const add = (speaker, delta) => {
    if (!delta) return;
    const last = call.transcript.at(-1);
    if (last?.speaker === speaker) last.text += delta;
    else call.transcript.push({ speaker, text: delta });
  };

  twilio.on("message", async (text) => {
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    if (message.event === "start") {
      call.streamSid = message.start.streamSid;
      call.attemptId = message.start.customParameters?.attemptId ?? null;
      call.token = message.start.customParameters?.token ?? null;
      if (!call.attemptId || !/^[A-Za-z0-9_-]{8,64}$/.test(call.attemptId) || !call.token) return finish("bad_parameters", true);
      const instructions = await fetchInstructions(call.attemptId, call.token).catch(() => null);
      if (!instructions) return finish("no_instructions", true);
      log("voice_bridge.call_started", { attempt: call.attemptId });
      openLive(instructions);
    } else if (message.event === "media") {
      if (message.media.track && message.media.track !== "inbound") return;
      if (call.ready) sendLive({ type: "session.input_audio.append", audio: message.media.payload });
      else if (call.queued.length < maxQueued) call.queued.push(message.media.payload);
    } else if (message.event === "stop") {
      finish("twilio_stop");
    }
  });
  twilio.on("close", () => finish("twilio_closed"));

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

  function onLive(event) {
    const now = Date.now();
    switch (event.type) {
      case "session.started":
        call.ready = true;
        for (const payload of call.queued) sendLive({ type: "session.input_audio.append", audio: payload });
        call.queued = [];
        return;
      case "session.output_audio.delta": {
        const bytes = Buffer.byteLength(event.delta ?? "", "base64");
        if (now >= call.playbackEndsAt && call.lastShopAt) call.latencies.push(now - call.lastShopAt);
        call.playbackEndsAt = Math.max(now, call.playbackEndsAt) + bytes / 8; // 8 bytes per ms
        call.lastActivity = now;
        sendTwilio({ event: "media", media: { payload: event.delta } });
        return;
      }
      case "session.input_transcript.delta":
        if (now < call.playbackEndsAt - 200) {
          // The shop talks over the AI: drop audio Twilio still has queued.
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
        if (/감사합니다|다시 연락드리겠습니다/.test(call.transcript.at(-1)?.text ?? "")) {
          if (call.closingTimer) clearTimeout(call.closingTimer);
          call.closingTimer = setTimeout(() => finish("closing"), Math.max(0, call.playbackEndsAt - Date.now()) + closingPause);
        }
        return;
      case "error":
        log("voice_bridge.live_event_error", { attempt: call.attemptId, code: event.error?.code ?? null });
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
    // Closing the stream lets Twilio finish the TwiML, which ends the call.
    if (twilio.isOpen) twilio.close();
    const turns = call.transcript.map((turn) => ({ speaker: turn.speaker, text: turn.text.trim() })).filter((turn) => turn.text);
    const sorted = [...call.latencies].sort((a, b) => a - b);
    log("voice_bridge.call_finished", { attempt: call.attemptId, reason, seconds: Math.round((Date.now() - startedAt) / 1000), turns: turns.length, medianLatencyMs: sorted[Math.floor(sorted.length / 2)] ?? null });
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
