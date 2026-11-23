"use client";

import Link from "next/link";
import { ItemArt, SamplePhoto } from "@/components/item-art";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import type { Delivery, Order } from "@/lib/domain/types";
import type { DispatchResult } from "@/lib/store/state";
import { formatDateTime, formatYen } from "@/lib/format";
import type { Messages } from "@/lib/i18n/ko";
import { useItemText } from "@/lib/i18n/item-text";
import { useT } from "@/lib/i18n/use-t";
import { useDemoState } from "@/lib/store/react";

export function useOrder(id: string): Order | undefined {
  return useDemoState().orders.find((o) => o.id === id);
}

export function OrderSummary({ order }: { order: Order }) {
  const { t, locale } = useT();
  const text = useItemText(order.item);
  return (
    <Card className="flex gap-4 p-4">
      <ItemArt category={order.item.category} size={88} label={t.category[order.item.category]} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <StatusChip status={order.status} label={t.status[order.status]} />
        <h1 className="font-display text-[19px] leading-snug font-semibold">{text.name}</h1>
        {text.original && (
          <p className="text-[12px] text-ink-3">
            {text.original} · {t.chat.autoTranslated}
          </p>
        )}
        <p className="text-[12px] text-ink-2">{t.category[order.item.category]}</p>
        <p className="text-sm">
          {t.orderDetail.priceYen} <span className="font-mono font-bold">{formatYen(order.item.priceYen, locale)}</span>
        </p>
        {text.note && <p className="text-[13px] text-ink-2">“{text.note}”</p>}
      </div>
    </Card>
  );
}

export function deliveryLabel(delivery: Delivery, t: Messages): string {
  return delivery.kind === "hub" ? t.hub[delivery.hub] : t.inPerson;
}

export function Timeline({ order }: { order: Order }) {
  const { t, locale } = useT();
  return (
    <ol aria-label={t.orderDetail.progress} className="space-y-2 border-l-2 border-line pl-4">
      {order.history.map((h, i) => (
        <li key={`${h.status}-${i}`} className="relative text-sm">
          <span
            aria-hidden
            className={`absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full ${i === order.history.length - 1 ? "bg-ink" : "bg-line-strong"}`}
          />
          <span className="font-semibold">{t.status[h.status]}</span>
          <span className="ml-2 text-[12px] text-ink-3">{formatDateTime(h.at, locale)}</span>
        </li>
      ))}
    </ol>
  );
}

export function ProofPhotos({ photos }: { photos: string[] }) {
  const { t } = useT();
  return (
    <ul className="grid grid-cols-3 gap-2">
      {photos.map((p, i) => (
        <li key={`${p.slice(0, 32)}-${i}`} className="aspect-square overflow-hidden rounded-md border border-line">
          {p === "sample:receipt" || p === "sample:item" ? (
            <SamplePhoto
              kind={p === "sample:receipt" ? "receipt" : "item"}
              label={`${p === "sample:receipt" ? t.operator.receipt : t.operator.itemPhoto} (${t.common.sampleBadge})`}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL from the file picker
            <img src={p} alt={t.operator.itemPhoto} className="h-full w-full object-cover" />
          )}
        </li>
      ))}
    </ul>
  );
}

export function ChatLink({ orderId }: { orderId: string }) {
  const { t } = useT();
  return (
    <Link
      href={`/chat/${orderId}`}
      className="inline-flex h-[34px] items-center rounded-full border-2 border-primary px-[18px] text-[13px] font-bold text-primary hover:bg-primary-soft"
    >
      {t.common.chat}
    </Link>
  );
}

export function ErrorNotice({ result }: { result: DispatchResult | null }) {
  const { t } = useT();
  if (!result || result.ok) return null;
  const message =
    result.error in t.domainError
      ? t.domainError[result.error as keyof Messages["domainError"]]
      : t.storeError[result.error as keyof Messages["storeError"]];
  return (
    <p role="alert" className="rounded-md bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">
      {message}
    </p>
  );
}

export function NotFoundOrder() {
  const { t } = useT();
  return <p className="text-sm text-ink-2">{t.storeError.order_not_found}</p>;
}
