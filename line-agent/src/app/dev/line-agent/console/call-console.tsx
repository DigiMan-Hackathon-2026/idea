"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useCallAudio } from "./call-audio";

type Turn = { speaker: "ai" | "shop"; text: string; ja: string | null };
type Phase = "placing" | "ringing" | "talking" | "ended" | "failed";
type OutcomeKind = "no_answer" | "declined" | "alternate_offered" | "confirmed" | "unknown";
type Call = {
  attemptId: string;
  approvalId: string | null;
  phase: Phase;
  simulated: boolean;
  placedAt: number;
  answeredAt: number | null;
  endedAt: number | null;
  nameJa: string | null;
  nameKo: string;
  total: number | null;
  partySize: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  arriveBy: string | null;
  nextPlaceJa: string | null;
  outcome: { kind: OutcomeKind; offeredTime: string | null; confirmedTime: string | null; depositRequired: boolean } | null;
  reserved: boolean;
  turns: Turn[];
};
type Status = { line: boolean; calls: string; carrier: boolean | null; bridge: boolean | null; store: string; demoNow: string | null };
type Feed = { now: number; status: Status; calls: Call[] };

const POLL_MS = 700;
/** Simulated calls arrive whole; play them back one line at a time, about as long as saying it. */
const lineMs = (text: string) => 900 + text.length * 120;
const lineStarts = (turns: { text: string }[]) => {
  const starts: number[] = [];
  let at = 600;
  for (const turn of turns) {
    starts.push(at);
    at += lineMs(turn.text);
  }
  return { starts, total: at };
};

const noSubscribe = () => () => {};

/** The bridge's /listen stream, only when this page is opened on the machine itself. */
function localListenUrl(port: number): string | null {
  if (typeof window === "undefined") return null;
  return ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) ? `ws://127.0.0.1:${port}/listen` : null;
}

const time = (iso: string | null) => (iso ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : "—");
const clock = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

export function CallConsole({ token, bridgePort }: { token: string | null; bridgePort: number }) {
  // Known only in the browser; the server render shows no audio button (no hydration mismatch).
  const listenUrl = useSyncExternalStore(noSubscribe, () => localListenUrl(bridgePort), () => null);
  const audio = useCallAudio(listenUrl);
  // `seen`: when each call first showed up here; `offset`: server clock minus ours.
  const [data, setData] = useState<{ feed: Feed; offset: number; seen: Record<string, number> } | null>(null);
  const [offline, setOffline] = useState(false);
  const [tick, setTick] = useState(() => Date.now());
  const feed = data?.feed ?? null;

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const response = await fetch("/api/v1/dev/line-agent/console", { cache: "no-store", headers: token ? { "x-simulator-token": token } : {} });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as Feed;
        if (!stopped) {
          const arrived = Date.now();
          setData((previous) => {
            const seen = { ...previous?.seen };
            for (const call of body.calls) seen[call.attemptId] ??= arrived;
            return { feed: body, offset: body.now - arrived, seen };
          });
          setOffline(false);
        }
      } catch {
        if (!stopped) setOffline(true);
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    const ticker = setInterval(() => setTick(Date.now()), 250);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(ticker);
    };
  }, [token]);

  // The latest approval's calls, oldest first (the demo has two: refused, then accepted).
  const calls = useMemo(() => {
    if (!feed?.calls.length) return [];
    const latest = feed.calls[0];
    return feed.calls.filter((call) => call.approvalId === latest.approvalId).reverse();
  }, [feed]);

  // Playback schedule for simulated calls: each starts after the previous one finished playing.
  const playback = useMemo(() => {
    const result = new Map<string, number>();
    let previousEnd = 0;
    for (const call of calls) {
      if (!call.simulated) continue;
      const start = Math.max(data?.seen[call.attemptId] ?? 0, previousEnd);
      result.set(call.attemptId, start);
      previousEnd = start + lineStarts(call.turns).total;
    }
    return result;
  }, [calls, data?.seen]);

  return (
    <main className="min-h-screen bg-[#0f1720] text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI電話コンソール</h1>
          <p className="text-sm text-slate-400">ココソウル · AI가 가게에 거는 전화를 실시간으로 보여 줍니다</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBar status={feed?.status ?? null} offline={offline} />
          <AudioButton audio={audio} />
        </div>
      </header>

      {calls.length === 0 ? (
        <section className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center text-slate-400">
          <p className="text-3xl">電話の待機中</p>
          <p className="text-lg">LINEで「この条件で電話を頼む」を押すと、ここに通話が表示されます。</p>
        </section>
      ) : (
        <>
          <Conditions call={calls[0]} />
          <section className={`grid gap-5 px-6 pb-8 ${calls.length > 1 ? "lg:grid-cols-2" : ""}`}>
            {calls.map((call, index) => (
              <CallCard key={call.attemptId} call={call} position={index + 1} hasNext={index < calls.length - 1} now={tick} offset={data?.offset ?? 0} playbackStart={playback.get(call.attemptId) ?? null} speak={audio.state === "on" || audio.state === "connecting"} />
            ))}
          </section>
        </>
      )}
    </main>
  );
}

function StatusBar({ status, offline }: { status: Status | null; offline: boolean }) {
  if (offline || !status) return <Pill ok={false} label="サーバー" detail={offline ? "応答なし" : "接続中…"} />;
  const realCalls = status.calls !== "simulator";
  return (
    <ul className="flex flex-wrap gap-2">
      <Pill ok={status.line} label="LINE" detail={status.line ? "接続" : "未接続"} />
      <Pill ok={realCalls ? status.carrier === true : null} label="電話網" detail={realCalls ? `${status.calls.toUpperCase()}${status.carrier ? "" : "（設定なし）"}` : "シミュレーター"} />
      {realCalls ? <Pill ok={status.bridge === true} label="音声AI" detail={status.bridge ? "待機中" : "停止"} /> : null}
      <Pill ok={status.store === "postgres"} label="保存" detail={status.store === "postgres" ? "DB" : "メモリ"} />
      {status.demoNow ? <Pill ok={null} label="デモ時刻" detail={`${time(status.demoNow)}から`} /> : null}
    </ul>
  );
}

function Pill({ ok, label, detail }: { ok: boolean | null; label: string; detail: string }) {
  const dot = ok === null ? "bg-slate-400" : ok ? "bg-emerald-400" : "bg-rose-500";
  return (
    <li className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm">
      <span className={`size-2.5 rounded-full ${dot}`} aria-hidden />
      <span className="text-slate-400">{label}</span>
      <span className="font-medium">{detail}</span>
    </li>
  );
}

function Conditions({ call }: { call: Call }) {
  return (
    <section className="flex flex-wrap items-baseline gap-x-8 gap-y-2 px-6 py-5 text-lg">
      <span className="text-slate-400">お客様が承認した条件</span>
      <span>
        <b className="text-2xl">{call.partySize ?? "—"}</b>名
      </span>
      <span>
        <b className="text-2xl">
          {time(call.windowStart)}〜{time(call.windowEnd)}
        </b>
        のあいだ
      </span>
      {call.arriveBy ? (
        <span className="text-slate-300">
          {time(call.arriveBy)}に{call.nextPlaceJa ?? "次の予定"}へ
        </span>
      ) : null}
    </section>
  );
}

function AudioButton({ audio }: { audio: ReturnType<typeof useCallAudio> }) {
  if (audio.state === "unavailable") return null;
  const on = audio.state === "on" || audio.state === "connecting";
  return (
    <button type="button" onClick={audio.toggle} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${on ? "bg-emerald-500 text-[#0f1720]" : "bg-white/10 text-slate-100"}`}>
      {on ? "通話の音声：オン" : "通話の音声を流す"}
    </button>
  );
}

/** Reads a simulated line aloud in Korean while it is shown (real calls play their own audio). */
function useSpeakLines(turns: Turn[], count: number, enabled: boolean) {
  const spoken = useRef(0);
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    while (spoken.current < count) {
      const turn = turns[spoken.current];
      spoken.current += 1;
      if (!turn) continue;
      const utterance = new SpeechSynthesisUtterance(turn.text);
      utterance.lang = "ko-KR";
      utterance.rate = 1.05;
      utterance.pitch = turn.speaker === "ai" ? 1.1 : 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }, [turns, count, enabled]);
}

function CallCard({ call, position, hasNext, now, offset, playbackStart, speak }: { call: Call; position: number; hasNext: boolean; now: number; offset: number; playbackStart: number | null; speak: boolean }) {
  const bottom = useRef<HTMLDivElement | null>(null);
  // Simulated calls: how many lines have "been said" so far.
  const schedule = useMemo(() => lineStarts(call.turns), [call.turns]);
  const shown = playbackStart === null ? call.turns.length : schedule.starts.filter((start) => now - playbackStart >= start).length;
  useSpeakLines(call.turns, playbackStart === null ? 0 : shown, speak && playbackStart !== null);
  const playing = playbackStart !== null && shown < call.turns.length;
  const phase: Phase = playbackStart === null ? call.phase : now < playbackStart ? "placing" : playing ? "talking" : call.phase;
  const turns = call.turns.slice(0, shown);
  const lastLength = turns.at(-1)?.text.length ?? 0;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns.length, lastLength]);

  const serverNow = now + offset;
  const elapsed =
    playbackStart !== null ? Math.max(0, now - playbackStart) : call.answeredAt ? (call.endedAt ?? serverNow) - call.answeredAt : null;
  const settled = phase === "ended" || phase === "failed";

  return (
    <article className={`flex flex-col overflow-hidden rounded-2xl border ${phase === "talking" ? "border-emerald-400/60" : "border-white/10"} bg-white/[0.03]`}>
      <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-sm text-slate-400">
            {call.total ? `${position}/${call.total}軒目` : `${position}軒目`} · AIだと名乗って韓国語で問い合わせ
          </p>
          <h2 className="text-2xl font-bold">{call.nameJa ?? call.nameKo}</h2>
          <p className="text-slate-400">{call.nameKo}</p>
        </div>
        <PhaseBadge phase={phase} elapsed={elapsed} />
      </header>

      <div className="flex max-h-[52vh] min-h-48 flex-col gap-3 overflow-y-auto px-5 py-4">
        {turns.length === 0 ? <p className="py-8 text-center text-slate-500">{phase === "failed" ? "つながりませんでした" : "相手が出るのを待っています…"}</p> : null}
        {turns.map((turn, index) => (
          <Bubble key={index} turn={turn} live={!settled && index === turns.length - 1} />
        ))}
        <div ref={bottom} />
      </div>

      {settled && !playing ? <Result call={call} hasNext={hasNext} /> : null}
    </article>
  );
}

function PhaseBadge({ phase, elapsed }: { phase: Phase; elapsed: number | null }) {
  const label = { placing: "発信中", ringing: "呼び出し中", talking: "通話中", ended: "通話終了", failed: "不通" }[phase];
  const tone = { placing: "bg-sky-500/20 text-sky-200", ringing: "bg-amber-500/20 text-amber-200", talking: "bg-emerald-500/20 text-emerald-200", ended: "bg-white/10 text-slate-300", failed: "bg-rose-500/20 text-rose-200" }[phase];
  return (
    <div className="text-right">
      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-base font-semibold ${tone}`}>
        {phase === "talking" ? <span className="size-2.5 animate-pulse rounded-full bg-emerald-400" aria-hidden /> : null}
        {label}
      </span>
      {elapsed !== null ? <p className="mt-1 font-mono text-lg tabular-nums text-slate-300">{clock(elapsed)}</p> : null}
    </div>
  );
}

function Bubble({ turn, live }: { turn: Turn; live: boolean }) {
  const ai = turn.speaker === "ai";
  return (
    <div className={`flex flex-col ${ai ? "items-start" : "items-end"}`}>
      <span className="mb-1 text-xs font-semibold tracking-wide text-slate-400">{ai ? "AI秘書" : "お店"}</span>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${ai ? "rounded-tl-sm bg-sky-600/30" : "rounded-tr-sm bg-white/10"}`}>
        <p className="text-xl leading-relaxed">
          {turn.text}
          {live ? <span className="ml-1 inline-block animate-pulse">▍</span> : null}
        </p>
        {turn.ja ? <p className="mt-1.5 border-t border-white/10 pt-1.5 text-base leading-relaxed text-amber-100/90">{turn.ja}</p> : null}
      </div>
    </div>
  );
}

function Result({ call, hasNext }: { call: Call; hasNext: boolean }) {
  const then = hasNext ? "次のお店へ" : "お客様に確認";
  const outcome = call.outcome;
  if (!outcome) return <footer className="border-t border-white/10 px-5 py-4 text-lg text-slate-300">結果を判定中…</footer>;
  const view = (() => {
    switch (outcome.kind) {
      case "confirmed":
        return { tone: "bg-emerald-500/20 text-emerald-100", text: `予約成立 ${time(outcome.confirmedTime)} · ${call.partySize ?? ""}名（テスト）` };
      case "alternate_offered":
        return outcome.depositRequired
          ? { tone: "bg-amber-500/20 text-amber-100", text: "予約金を求められたため確定せず、お客様に確認" }
          : { tone: "bg-amber-500/20 text-amber-100", text: `${time(outcome.offeredTime)}なら空きあり → 承認した時間の外なので${then}` };
      case "declined":
        return { tone: "bg-rose-500/20 text-rose-100", text: `満席で断られました → ${then}` };
      case "no_answer":
        return { tone: "bg-rose-500/20 text-rose-100", text: `応答なし → ${then}` };
      default:
        return { tone: "bg-white/10 text-slate-200", text: "結果が分からないため、お客様に確認" };
    }
  })();
  return <footer className={`px-5 py-4 text-xl font-semibold ${view.tone}`}>{view.text}</footer>;
}
