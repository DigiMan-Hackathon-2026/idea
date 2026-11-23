"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ItemArt } from "@/components/item-art";
import { StatusChip } from "@/components/ui/status-chip";
import type { Order } from "@/lib/domain/types";
import { formatYen } from "@/lib/format";
import { useItemText } from "@/lib/i18n/item-text";
import { useT } from "@/lib/i18n/use-t";

export function OrderCard({ order, href, meta }: { order: Order; href: string; meta?: ReactNode }) {
  const { t, locale } = useT();
  const { name } = useItemText(order.item);
  return (
    <Link
      href={href}
      aria-label={name}
      className="flex gap-3 rounded-lg border border-line bg-surface p-3 transition hover:border-line-strong hover:shadow-medium"
    >
      <ItemArt category={order.item.category} label={t.category[order.item.category]} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-[15px] leading-snug font-semibold">{name}</p>
        </div>
        <p className="text-[12px] text-ink-2">{t.category[order.item.category]}</p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={order.status} label={t.status[order.status]} />
          <span className="font-mono text-[13px] text-ink-2">{formatYen(order.item.priceYen, locale)}</span>
          {meta}
        </div>
      </div>
    </Link>
  );
}

export function PageTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-5 space-y-1">
      <h1 className="font-display text-[26px] leading-tight font-semibold">{title}</h1>
      {lead && <p className="text-sm leading-relaxed text-ink-2">{lead}</p>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-2">{children}</p>;
}
