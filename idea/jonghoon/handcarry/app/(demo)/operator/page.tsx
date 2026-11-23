"use client";

import { useState } from "react";
import { travelerName } from "@/components/buyer/bid-list";
import { ItemArt } from "@/components/item-art";
import { EmptyState, PageTitle } from "@/components/order/order-card";
import { ErrorNotice } from "@/components/order/order-parts";
import { Button } from "@/components/ui/button";
import { Card, Row, Section } from "@/components/ui/card";
import { ESCROW_RATE, RECEIPT_RATE } from "@/lib/config";
import type { Order } from "@/lib/domain/types";
import { formatWon } from "@/lib/format";
import { useT } from "@/lib/i18n/use-t";
import { nowIso, useDemoState, useDispatch } from "@/lib/store/react";
import type { DispatchResult } from "@/lib/store/state";

const isHubOrder = (o: Order) => o.payment?.delivery.kind === "hub";

function HubItem({ order, action }: { order: Order; action: "checkIn" | "checkOut" }) {
  const { t } = useT();
  const dispatch = useDispatch();
  const [result, setResult] = useState<DispatchResult | null>(null);
  const d = order.payment?.delivery;
  const traveler = order.bids.find((b) => b.id === order.selectedBidId)?.travelerId ?? "";
  const event = action === "checkIn" ? ({ type: "checkInHub", at: nowIso() } as const) : ({ type: "checkOutHub", at: nowIso() } as const);

  return (
    <Card className="space-y-3 p-3" aria-label={order.item.name}>
      <div className="flex gap-3">
        <ItemArt category={order.item.category} size={56} label={t.category[order.item.category]} />
        <div className="min-w-0 space-y-0.5">
          <p className="line-clamp-2 text-sm font-semibold">{order.item.name}</p>
          <p className="text-[12px] text-ink-2">
            {d?.kind === "hub" ? t.hub[d.hub] : ""} · {travelerName(traveler)}
          </p>
        </div>
      </div>
      <Button size="sm" block onClick={() => setResult(dispatch({ type: "orderEvent", orderId: order.id, event }))}>
        {action === "checkIn" ? t.operator.checkIn : t.operator.checkOut}
      </Button>
      <ErrorNotice result={result} />
    </Card>
  );
}

function FxSummary({ orders }: { orders: Order[] }) {
  const { t, locale } = useT();
  const settled = orders.filter((o) => o.settlement);
  const total = settled.reduce((sum, o) => sum + (o.settlement?.fxDiffWon ?? 0), 0);
  const rate = (r: { centiWonPer100Yen: number }) => (r.centiWonPer100Yen / 100).toFixed(2);
  return (
    <Section title={t.operator.fxTitle}>
      <Card className="space-y-2 p-4">
        <p className="text-[12px] text-ink-2">{t.operator.fxLead}</p>
        {settled.map((o) => (
          <Row key={o.id} label={o.item.name} value={formatWon(o.settlement?.fxDiffWon ?? 0, locale)} />
        ))}
        <div className="border-t border-line pt-2">
          <Row label={t.operator.fxTotal} value={formatWon(total, locale)} strong />
        </div>
        <p className="text-[12px] text-ink-3">{t.operator.fxRates(rate(ESCROW_RATE), rate(RECEIPT_RATE))}</p>
      </Card>
    </Section>
  );
}

export default function OperatorHub() {
  const { t } = useT();
  const { orders } = useDemoState();
  const incoming = orders.filter((o) => o.status === "purchased" && isHubOrder(o));
  const stored = orders.filter((o) => o.status === "at_hub");

  return (
    <div className="space-y-6">
      <PageTitle title={t.operator.hubTitle} />
      <Section title={`${t.operator.incoming} (${incoming.length})`}>
        {incoming.length === 0 ? (
          <EmptyState>{t.operator.noIncoming}</EmptyState>
        ) : (
          incoming.map((o) => <HubItem key={o.id} order={o} action="checkIn" />)
        )}
      </Section>
      <Section title={`${t.operator.stored} (${stored.length})`}>
        {stored.length === 0 ? <EmptyState>{t.operator.noStored}</EmptyState> : stored.map((o) => <HubItem key={o.id} order={o} action="checkOut" />)}
      </Section>
      <FxSummary orders={orders} />
    </div>
  );
}
