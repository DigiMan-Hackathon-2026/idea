"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type Action = { type: "postback"; label: string; data: string; displayText?: string } | { type: "uri"; label: string; uri: string } | { type: "message"; label: string; text: string };
type Node = { type: string; text?: string; action?: Action; contents?: Node[] | Node; header?: Node; body?: Node; footer?: Node; color?: string; weight?: string; size?: string; style?: string };
type Message = { type: "text"; text: string; quickReply?: { items: { action: Action }[] } } | { type: "flex"; altText: string; contents: Node; quickReply?: { items: { action: Action }[] } };
type Entry = { at: string; to: string; via: "reply" | "push"; message: Message };
type Mine = { at: string; text: string; user: string };

const users = { alice: "Alice（依頼する人）", bob: "Bob（同じグループの人）" } as const;
type User = keyof typeof users;

function newSession(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function LineAgentSimulator({ calls }: { calls: string }) {
  // One conversation per tab; ?s=… in the URL keeps it across reloads.
  const [session] = useState(() => {
    if (typeof window === "undefined") return "";
    const fromUrl = new URLSearchParams(window.location.search).get("s");
    if (fromUrl && /^[a-z0-9]{1,16}$/.test(fromUrl)) return fromUrl;
    return newSession();
  });

  useEffect(() => {
    // Keep the conversation across reloads (no state change, so no re-render).
    if (session && new URLSearchParams(window.location.search).get("s") !== session) {
      window.history.replaceState(window.history.state, "", `?s=${session}`);
    }
  }, [session]);
  const [user, setUser] = useState<User>("alice");
  const [group, setGroup] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [draft, setDraft] = useState("新村で2人、サムギョプサルが食べたいです。20時までに弘大のライブ会場に着きたいです。");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    const response = await fetch(`/api/v1/dev/line-agent?session=${session}&user=${user}&group=${group ? 1 : 0}`, { cache: "no-store" });
    if (response.ok) setEntries((await response.json()).messages);
  }, [session, user, group]);

  useEffect(() => {
    // Fetch once per view change, then poll for pushed messages (call results).
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 1500);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [entries.length, mine.length]);

  async function sendImage(file: File) {
    if (file.size > 5 * 1024 * 1024) return;
    const image = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    await send({ image }, `［画像 · 이미지］${file.name}`);
  }

  async function send(payload: { text?: string; data?: string; image?: string }, shown: string) {
    setBusy(true);
    setMine((list) => [...list, { at: new Date().toISOString(), text: shown, user }]);
    const text = payload.text && group && !/ココソウル|코코서울/.test(payload.text) ? `ココソウル ${payload.text}` : payload.text;
    await fetch("/api/v1/dev/line-agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session, user, group, ...payload, text }) });
    await refresh();
    setBusy(false);
  }

  function onAction(action: Action) {
    if (action.type === "uri") window.open(action.uri, "_blank", "noopener");
    else if (action.type === "message") void send({ text: action.text }, action.text);
    else void send({ data: action.data }, action.displayText ?? `［${action.label}］`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    void send({ text: draft }, draft);
    setDraft("");
  }

  const timeline = [
    ...entries.map((entry) => ({ at: entry.at, kind: "bot" as const, entry })),
    ...mine.filter((item) => (group ? true : item.user === user)).map((item) => ({ at: item.at, kind: "me" as const, item })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const lastQuick = [...entries].reverse().find((entry) => entry.message.quickReply)?.message.quickReply;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-[#8cabd9]/30">
      <header className="sticky top-0 z-10 space-y-2 bg-[#455f54] p-3 text-white">
        <h1 className="text-base font-bold">LINE 秘書シミュレーター · LINE 비서 시뮬레이터</h1>
        <p className="text-xs opacity-90">
          <a href="/dev/line-agent" className="underline">新しい会話 · 새 대화</a>
        </p>
        <p className="text-xs opacity-90">電話: {calls === "simulator" ? "台本どおりのテスト店（実際には電話しません）" : calls === "twilio" ? "実際に発信（許可された番号のみ）" : "オフ"}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={group} onChange={(event) => setGroup(event.target.checked)} /> グループ · 그룹
          </label>
          {(Object.keys(users) as User[]).map((key) => (
            <button key={key} type="button" onClick={() => setUser(key)} className={`rounded px-2 py-1 ${user === key ? "bg-white text-[#455f54]" : "bg-white/20"}`}>
              {users[key]}
            </button>
          ))}
        </div>
      </header>
      <section className="flex-1 space-y-3 p-3" aria-live="polite">
        {timeline.map((item, index) =>
          item.kind === "me" ? (
            <div key={`me-${index}`} className="ml-auto max-w-[80%] rounded-2xl bg-[#c9f2a8] px-3 py-2 text-sm text-[#282439]">
              {group && <span className="block text-[10px] text-[#504e49]">{users[item.item.user as User]}</span>}
              {item.item.text}
            </div>
          ) : (
            <BotMessage key={`bot-${index}`} message={item.entry.message} onAction={onAction} />
          ),
        )}
        <div ref={bottom} />
      </section>
      {lastQuick && (
        <div className="flex gap-2 overflow-x-auto px-3 pb-2">
          {lastQuick.items.map(({ action }, index) => (
            <button key={index} type="button" disabled={busy} onClick={() => onAction(action)} className="shrink-0 rounded-full border border-[#455f54] bg-white px-3 py-1 text-xs text-[#455f54]">
              {action.label}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="sticky bottom-0 flex gap-2 bg-white p-2">
        <label className="sr-only" htmlFor="draft">メッセージ</label>
        <input id="draft" value={draft} onChange={(event) => setDraft(event.target.value)} className="min-w-0 flex-1 rounded border border-[#a4a199] px-2 py-2 text-sm" />
        <label className="flex cursor-pointer items-center rounded border border-[#a4a199] px-2 text-xs">
          画像
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void sendImage(file); event.target.value = ""; }} />
        </label>
        <button type="submit" disabled={busy} className="rounded bg-[#455f54] px-3 text-sm text-white">送信</button>
      </form>
    </main>
  );
}

function BotMessage({ message, onAction }: { message: Message; onAction: (action: Action) => void }) {
  if (message.type === "text") {
    return <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-white px-3 py-2 text-sm text-[#504e49]">{message.text}</div>;
  }
  const bubbles = message.contents.type === "carousel" ? (message.contents.contents as Node[]) : [message.contents];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label={message.altText}>
      {bubbles.map((bubble, index) => (
        <div key={index} className="w-64 shrink-0 space-y-2 rounded-2xl bg-white p-3 text-sm">
          {[bubble.header, bubble.body, bubble.footer].map((part, i) => (part ? <FlexNode key={i} node={part} onAction={onAction} /> : null))}
        </div>
      ))}
    </div>
  );
}

function FlexNode({ node, onAction }: { node: Node; onAction: (action: Action) => void }) {
  if (node.type === "text") {
    return <p className={`${node.weight === "bold" ? "font-bold" : ""} ${node.size === "xs" ? "text-xs" : ""}`} style={{ color: node.color ?? "#504e49" }}>{node.text}</p>;
  }
  if (node.type === "button" && node.action) {
    const action = node.action;
    return (
      <button type="button" onClick={() => onAction(action)} className={`mt-1 block w-full rounded px-2 py-1 text-xs ${node.style === "primary" ? "bg-[#455f54] text-white" : node.style === "secondary" ? "bg-[#dfdfdd] text-[#504e49]" : "text-[#6789ca] underline"}`}>
        {action.label}
      </button>
    );
  }
  if (node.type === "separator") return <hr className="border-[#dfdfdd]" />;
  const children = Array.isArray(node.contents) ? node.contents : [];
  return <div className="space-y-1">{children.map((child, index) => <FlexNode key={index} node={child} onAction={onAction} />)}</div>;
}
