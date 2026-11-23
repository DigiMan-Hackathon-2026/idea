"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { travelerName } from "@/components/buyer/bid-list";
import { BreakdownRows } from "@/components/buyer/checkout";
import { ErrorNotice, NotFoundOrder, OrderSummary, ProofPhotos, Timeline, useOrder } from "@/components/order/order-parts";
import { Button } from "@/components/ui/button";
import { Card, Notice, Section } from "@/components/ui/card";
import { USERS } from "@/lib/demo/users";
import type { DisputeWinner } from "@/lib/domain/types";
import { formatWon } from "@/lib/format";
import { useT } from "@/lib/i18n/use-t";
import { nowIso, useDemoState, useDispatch } from "@/lib/store/react";
import type { DispatchResult } from "@/lib/store/state";

export default function DisputePage() {
  const { id } = useParams<{ id: string }>();
  const order = useOrder(id);
  const { chats } = useDemoState();
  const { t, locale } = useT();
  const dispatch = useDispatch();
  const [result, setResult] = useState<DispatchResult | null>(null);
  if (!order || !order.dispute) return <NotFoundOrder />;

  const traveler = order.bids.find((b) => b.id === order.selectedBidId)?.travelerId ?? "";
  const ruling = order.dispute.ruling;
  const rule = (winner: DisputeWinner) => setResult(dispatch({ type: "orderEvent", orderId: order.id, event: { type: "rule", winner, at: nowIso() } }));
  const messages = chats.filter((c) => c.orderId === order.id);

  return (
    <div className="space-y-6">
      <OrderSummary order={order} />

      <Section title={t.operator.reason}>
        <Card className="space-y-2 p-4">
          <p className="text-[12px] text-ink-2">
            {USERS["buyer-minji"].name} → {travelerName(traveler)}
          </p>
          <p className="text-base font-semibold">“{order.dispute.reason}”</p>
        </Card>
      </Section>

      {order.proof && (
        <Section title={t.operator.evidence}>
          <ProofPhotos photos={order.proof.photos} />
          <p className="text-[12px] text-ink-2">{t.orderDetail.receiptDate(order.proof.receiptDate)}</p>
        </Section>
      )}

      {messages.length > 0 && (
        <Section title={t.chat.title}>
          <ul className="space-y-1 text-sm">
            {messages.map((m) => (
              <li key={m.id}>
                <span className="font-semibold">{USERS[m.fromUserId as keyof typeof USERS]?.name ?? m.fromUserId}</span>: {m.text}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {order.payment && (
        <Section title={t.checkout.total}>
          <Card className="p-4">
            <BreakdownRows breakdown={order.payment.breakdown} />
          </Card>
        </Section>
      )}

      {ruling ? (
        <Notice tone="success">
          {t.operator.ruling(ruling.winner === "buyer" ? t.roles.buyer : t.roles.traveler)}
          {order.refund ? ` · ${t.orderDetail.refunded(formatWon(order.refund.amount, locale))}` : ""}
        </Notice>
      ) : (
        <div className="space-y-3">
          <Notice tone="warning">{t.operator.policyNote}</Notice>
          <Button variant="destructive" block onClick={() => rule("buyer")}>
            {t.operator.ruleBuyer}
          </Button>
          <Button variant="secondary" block onClick={() => rule("traveler")}>
            {t.operator.ruleTraveler}
          </Button>
          <ErrorNotice result={result} />
        </div>
      )}

      <Section title={t.orderDetail.progress}>
        <Timeline order={order} />
      </Section>
    </div>
  );
}
