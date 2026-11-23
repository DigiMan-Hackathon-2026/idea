"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { NotFoundOrder, useOrder } from "@/components/order/order-parts";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { QUICK_REPLIES, translate } from "@/lib/demo/translations";
import { ACTING_USER, USERS, type UserId } from "@/lib/demo/users";
import type { Locale, Order } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/format";
import { useItemText } from "@/lib/i18n/item-text";
import { useRole, useT } from "@/lib/i18n/use-t";
import type { ChatMessage } from "@/lib/store/state";
import { newId, nowIso, useDemoState, useDispatch } from "@/lib/store/react";

function Bubble({ message, mine, viewer }: { message: ChatMessage; mine: boolean; viewer: Locale }) {
  const { t, locale } = useT();
  const needsTranslation = !mine && message.originalLocale !== viewer;
  const translated = needsTranslation ? translate(message.text, message.originalLocale, viewer) : null;
  const sender = USERS[message.fromUserId as UserId]?.name ?? message.fromUserId;

  return (
    <li className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`} aria-label={sender}>
      {!mine && <span className="text-[12px] font-semibold text-ink-2">{sender}</span>}
      <div className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-[15px] leading-snug ${mine ? "bg-ink text-white" : "border border-line bg-surface"}`}>
        {needsTranslation ? (
          <>
            <p>{translated ?? message.text}</p>
            <p className="mt-1.5 border-t border-line pt-1.5 text-[12px] text-ink-3">
              {translated ? `${message.text} · ${t.chat.autoTranslated}` : t.chat.pending}
            </p>
          </>
        ) : (
          <p>{message.text}</p>
        )}
      </div>
      <span className="text-[11px] text-ink-3">{formatDateTime(message.at, locale)}</span>
    </li>
  );
}

export default function ChatPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useOrder(orderId);
  return order ? <ChatView order={order} /> : <NotFoundOrder />;
}

function ChatView({ order }: { order: Order }) {
  const orderId = order.id;
  const role = useRole();
  const { t, locale } = useT();
  const { chats } = useDemoState();
  const dispatch = useDispatch();
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLLIElement>(null);
  const messages = chats.filter((c) => c.orderId === orderId);
  const me = ACTING_USER[role];
  const canWrite = role !== "operator";

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const itemText = useItemText(order.item);

  const send = (text: string) => {
    const result = dispatch({
      type: "sendChat",
      message: { id: `m-${newId()}`, orderId, fromUserId: me, originalLocale: locale, text, at: nowIso() },
    });
    if (result.ok) setDraft("");
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };
  const backHref = role === "operator" ? `/operator/disputes/${orderId}` : `/${role}/orders/${orderId}`;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href={backHref} className="text-sm font-bold text-ink-2 hover:text-ink">
          ← {t.common.back}
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold">
          {t.chat.title} · {itemText.name}
        </h1>
      </div>

      <ul aria-label={t.chat.title} className="flex-1 space-y-4">
        {messages.length === 0 && <li className="py-8 text-center text-sm text-ink-3">{t.chat.empty}</li>}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} mine={m.fromUserId === me} viewer={locale} />
        ))}
        <li ref={end} aria-hidden />
      </ul>

      {canWrite && (
        <div className="sticky -bottom-5 -mx-5 space-y-3 border-t border-line bg-surface/95 px-5 pt-3 pb-5 backdrop-blur">
          <div role="group" aria-label={t.chat.quickReplies} className="no-scrollbar flex gap-2 overflow-x-auto">
            {QUICK_REPLIES[locale].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="h-[34px] shrink-0 rounded-full border-[1.5px] border-line-strong px-3.5 text-[13px] whitespace-nowrap transition hover:bg-muted"
              >
                {q}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex gap-2">
            <input aria-label={t.chat.placeholder} className={inputClass} placeholder={t.chat.placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit" disabled={!draft.trim()} className="shrink-0 px-5 whitespace-nowrap">
              {t.chat.send}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
