"use client";

import { useState } from "react";
import { ErrorNotice } from "@/components/order/order-parts";
import { Button } from "@/components/ui/button";
import { Card, Row, Section } from "@/components/ui/card";
import { ESCROW_RATE, HUBS } from "@/lib/config";
import { buyerBreakdown } from "@/lib/domain/money";
import type { BuyerBreakdown, Delivery, Order } from "@/lib/domain/types";
import { formatWon } from "@/lib/format";
import { useT } from "@/lib/i18n/use-t";
import { nowIso, useDispatch } from "@/lib/store/react";
import type { DispatchResult } from "@/lib/store/state";

const DELIVERIES: Delivery[] = [...HUBS.map((hub) => ({ kind: "hub" as const, hub })), { kind: "in_person" }];
const deliveryKey = (d: Delivery) => (d.kind === "hub" ? d.hub : d.kind);

export function BreakdownRows({ breakdown }: { breakdown: BuyerBreakdown }) {
  const { t, locale } = useT();
  return (
    <div className="space-y-2" aria-label={t.checkout.total}>
      <Row label={t.checkout.item} value={formatWon(breakdown.itemWon, locale)} />
      <Row label={t.checkout.reward} value={formatWon(breakdown.reward, locale)} />
      <Row label={t.checkout.fee} value={formatWon(breakdown.fee, locale)} />
      <Row label={t.checkout.tax} value="—" />
      <div className="border-t border-line pt-2">
        <Row label={t.checkout.total} value={formatWon(breakdown.total, locale)} strong />
      </div>
    </div>
  );
}

export function Checkout({ order }: { order: Order }) {
  const { t, locale } = useT();
  const dispatch = useDispatch();
  const [delivery, setDelivery] = useState<Delivery>(DELIVERIES[0]);
  const [result, setResult] = useState<DispatchResult | null>(null);
  const bid = order.bids.find((b) => b.id === order.selectedBidId)!;
  const breakdown = buyerBreakdown(order.item.priceYen, bid.reward, ESCROW_RATE);

  return (
    <Section title={t.checkout.title}>
      <Card className="space-y-4 p-4">
        <BreakdownRows breakdown={breakdown} />
        <p className="text-[12px] text-ink-3">{t.checkout.rateNote((ESCROW_RATE.centiWonPer100Yen / 100).toFixed(2))}</p>
      </Card>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-[13px] font-semibold">{t.checkout.delivery}</legend>
        {DELIVERIES.map((d) => (
          <label
            key={deliveryKey(d)}
            className="flex h-12 cursor-pointer items-center gap-2.5 rounded-md border-[1.5px] border-line-strong bg-surface px-4 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
          >
            <input
              type="radio"
              name="delivery"
              className="h-5 w-5 accent-primary"
              checked={deliveryKey(d) === deliveryKey(delivery)}
              onChange={() => setDelivery(d)}
            />
            {d.kind === "hub" ? t.hub[d.hub] : t.inPerson}
          </label>
        ))}
      </fieldset>

      <p className="text-[12px] leading-relaxed text-ink-2">{t.checkout.escrowNote}</p>
      <ErrorNotice result={result} />
      {/* Sticky so the presenter never has to scroll to find the pay button. */}
      <div className="sticky -bottom-5 -mx-5 border-t border-line bg-surface/95 px-5 pt-3 pb-5 backdrop-blur">
        <Button
          size="lg"
          block
          onClick={() => setResult(dispatch({ type: "orderEvent", orderId: order.id, event: { type: "pay", delivery, at: nowIso() } }))}
        >
          {t.checkout.pay} · {formatWon(breakdown.total, locale)}
        </Button>
      </div>
    </Section>
  );
}
