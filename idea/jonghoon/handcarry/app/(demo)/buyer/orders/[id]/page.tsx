"use client";

import { useParams } from "next/navigation";
import { BidList, travelerName } from "@/components/buyer/bid-list";
import { BreakdownRows, Checkout } from "@/components/buyer/checkout";
import { ReceiptActions } from "@/components/buyer/receipt-actions";
import { ChatLink, deliveryLabel, NotFoundOrder, OrderSummary, ProofPhotos, Timeline, useOrder } from "@/components/order/order-parts";
import { Card, Notice, Section } from "@/components/ui/card";
import type { Order } from "@/lib/domain/types";
import { formatWon } from "@/lib/format";
import { useT } from "@/lib/i18n/use-t";

function StatusPanel({ order }: { order: Order }) {
  const { t, locale } = useT();
  const d = order.payment?.delivery;
  switch (order.status) {
    case "open":
      return <BidList order={order} />;
    case "awaiting_payment":
      return <Checkout order={order} />;
    case "paid":
      return <Notice>{t.status.paid}</Notice>;
    case "purchased":
      return <Notice>{d?.kind === "hub" ? t.orderDetail.hubWaiting(t.hub[d.hub]) : t.orderDetail.inPersonWaiting}</Notice>;
    case "at_hub":
      return <Notice tone="success">{d?.kind === "hub" ? t.orderDetail.hubReady(t.hub[d.hub]) : t.status.at_hub}</Notice>;
    case "delivered":
      return <ReceiptActions order={order} />;
    case "completed":
      return <Notice tone="success">{t.orderDetail.completed}</Notice>;
    case "disputed":
      return <Notice tone="warning">{t.orderDetail.disputed}</Notice>;
    case "resolved_buyer":
      return <Notice tone="success">{t.orderDetail.refunded(formatWon(order.refund?.amount ?? 0, locale))}</Notice>;
    case "resolved_traveler":
      return <Notice>{t.orderDetail.resolvedTraveler}</Notice>;
  }
}

export default function BuyerOrderPage() {
  const { id } = useParams<{ id: string }>();
  const order = useOrder(id);
  const { t } = useT();
  if (!order) return <NotFoundOrder />;
  const selected = order.bids.find((b) => b.id === order.selectedBidId);

  return (
    <div className="space-y-6">
      <OrderSummary order={order} />
      <StatusPanel order={order} />

      {selected && (
        <Section title={t.orderDetail.selectedTraveler} action={<ChatLink orderId={order.id} />}>
          <Card className="space-y-3 p-4">
            <p className="font-semibold">{travelerName(selected.travelerId)}</p>
            {order.payment && (
              <>
                <p className="text-sm text-ink-2">
                  {t.orderDetail.deliveryMethod}: <span className="font-semibold text-ink">{deliveryLabel(order.payment.delivery, t)}</span>
                </p>
                <BreakdownRows breakdown={order.payment.breakdown} />
              </>
            )}
          </Card>
        </Section>
      )}

      {order.proof && (
        <Section title={t.orderDetail.proof}>
          <ProofPhotos photos={order.proof.photos} />
          <p className="text-[12px] text-ink-2">{t.orderDetail.receiptDate(order.proof.receiptDate)}</p>
        </Section>
      )}

      {order.dispute && (
        <Section title={t.operator.reason}>
          <p className="text-sm">“{order.dispute.reason}”</p>
        </Section>
      )}

      <Section title={t.orderDetail.progress}>
        <Timeline order={order} />
      </Section>
    </div>
  );
}
