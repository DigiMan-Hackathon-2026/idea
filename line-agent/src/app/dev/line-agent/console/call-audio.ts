"use client";

// Plays the live call in the operations console: the voice bridge sends both
// sides as G.711 mu-law 8 kHz chunks (/listen, this machine only). Each side
// keeps its own timeline so the AI's faster-than-real-time audio does not
// overlap itself; "clear" drops what the AI had queued when the shop talks over it.
import { useCallback, useEffect, useRef, useState } from "react";

type Speaker = "ai" | "shop";
type Frame =
  | { type: "audio"; attemptId: string; speaker: Speaker; payload: string }
  | { type: "clear"; attemptId: string }
  | { type: "call"; attemptId: string; state: "start" | "end" };

const MULAW = (() => {
  const table = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const value = ~i & 0xff;
    const sign = value & 0x80;
    const exponent = (value >> 4) & 0x07;
    const mantissa = value & 0x0f;
    const sample = (((mantissa << 3) + 0x84) << exponent) - 0x84;
    table[i] = (sign ? -sample : sample) / 32768;
  }
  return table;
})();

/** A little delay so network jitter does not cut words. */
const JITTER_S = 0.12;

export type CallAudio = { state: "off" | "connecting" | "on" | "unavailable"; toggle: () => void };

export function useCallAudio(listenUrl: string | null): CallAudio {
  const [state, setState] = useState<"off" | "connecting" | "on" | "lost">("off");
  const context = useRef<AudioContext | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const next = useRef<Record<Speaker, number>>({ ai: 0, shop: 0 });
  const aiSources = useRef(new Set<AudioBufferSourceNode>());

  const stop = useCallback(() => {
    socket.current?.close();
    socket.current = null;
    void context.current?.close();
    context.current = null;
    aiSources.current.clear();
  }, []);

  const play = useCallback((speaker: Speaker, payload: string) => {
    const audio = context.current;
    if (!audio) return;
    const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
    const buffer = audio.createBuffer(1, bytes.length, 8000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < bytes.length; i++) channel[i] = MULAW[bytes[i]];
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    const startAt = Math.max(audio.currentTime + JITTER_S, next.current[speaker]);
    source.start(startAt);
    next.current[speaker] = startAt + buffer.duration;
    if (speaker === "ai") {
      aiSources.current.add(source);
      source.onended = () => aiSources.current.delete(source);
    }
  }, []);

  const toggle = useCallback(() => {
    if (!listenUrl) return;
    if (socket.current) {
      stop();
      setState("off");
      return;
    }
    // Created on the click: browsers only start audio after a user gesture.
    context.current = new AudioContext();
    next.current = { ai: 0, shop: 0 };
    setState("connecting");
    const ws = new WebSocket(listenUrl);
    socket.current = ws;
    ws.onopen = () => setState("on");
    ws.onclose = () => {
      if (socket.current === ws) {
        stop();
        setState("lost");
      }
    };
    ws.onmessage = (event) => {
      let frame: Frame;
      try {
        frame = JSON.parse(String(event.data)) as Frame;
      } catch {
        return;
      }
      if (frame.type === "audio") play(frame.speaker, frame.payload);
      else if (frame.type === "clear") {
        for (const source of aiSources.current) source.stop();
        aiSources.current.clear();
        next.current.ai = 0;
      } else if (frame.type === "call" && frame.state === "start") {
        next.current = { ai: 0, shop: 0 };
      }
    };
  }, [listenUrl, play, stop]);

  useEffect(() => stop, [stop]);
  // "lost": the bridge closed (not running); the button offers to connect again.
  return { state: !listenUrl ? "unavailable" : state === "lost" ? "off" : state, toggle };
}
