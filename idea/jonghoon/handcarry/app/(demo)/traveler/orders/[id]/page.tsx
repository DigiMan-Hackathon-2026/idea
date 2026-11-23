"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ChatLink, deliveryLabel, ErrorNotice, NotFoundOrder, OrderSummary, ProofPhotos, Timeline, useOrder } from "@/components/order/order-parts";
import { BidForm } from "@/components/traveler/bid-form";
import { ProofUpload } from "@/components/traveler/proof-upload";
import { SettlementCard } from "@/components/traveler/settlement-card";
import { Button } from "@/components/ui/button";
import { Notice, Section } from "@/components/ui/card";
import { ACTING_USER } from "@/lib/demo/users";
import type { Order } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/use-t";
import { nowIso, useDispatch } from "@/lib/store/react";
import type { DispatchResult } from "@/lib/store/state";

function HandOverButton({ order }: { order: Order }) {
  const { t } = useT();
  const dispatch = useDispatch();
  const [result, setResult] = useState<DispatchResult | null>(null);
  return (
    <>
      <Button
        size="lg"
        block
        onClick={() => setResult(dispatch({ type: "orderEvent", orderId: order.id, event: { type: "handOverInPerson", at: nowIso() } }))}
      >
        {t.traveler.handOver}
      </Button>
      <ErrorNotice result={result} />
    </>
  );
}

function MyJobPanel({ order }: { order: Order }) {
  const { t } = useT();
  const d = order.payment?.delivery;
  switch (order.status) {
    case "open":
      return <BidForm order={order} />;
    case "awaiting_payment":
      return <Notice tone="success">{t.traveler.selected}</Notice>;
    case "paid":
      return <ProofUpload order={order} />;
    case "purchased":
      return d?.kind === "hub" ? <Notice>{t.traveler.hubDropOff(t.hub[d.hub])}</Notice> : <HandOverButton order={order} />;
    case "at_hub":
      return <Notice>{t.traveler.atHub}</Notice>;
    case "delivered":
      return <Notice>{t.traveler.waitingConfirm}</Notice>;
    case "disputed":
      return <Notice tone="warning">{t.traveler.disputed}</Notice>;
    case "resolved_buyer":
      return <Notice tone="error">{t.traveler.lostDispute}</Notice>;
    case "completed":
    case "resolved_traveler":
      return <SettlementCard order={order} />;
  }
}

export default function TravelerOrderPage() {
  const { id } = useParams<{ id: string }>();
  const order = useOrder(id);
  const { t } = useT();
  if (!order) return <NotFoundOrder />;

  const selected = order.bids.find((b) => b.id === order.selectedBidId);
  const isMine = selected?.travelerId === ACTING_USER.traveler;

  return (
    <div className="space-y-6">
      <OrderSummary order={order} />
      {order.status === "open" || isMine ? <MyJobPanel order={order} /> : null}

      {isMine && order.payment && (
        <Section title={t.orderDetail.deliveryMethod} action={<ChatLink orderId={order.id} />}>
          <p className="text-sm font-semibold">{deliveryLabel(order.payment.delivery, t)}</p>
        </Section>
      )}

      {isMine && order.proof && (
        <Section title={t.orderDetail.proof}>
          <ProofPhotos photos={order.proof.photos} />
          <p className="text-[12px] text-ink-2">{t.orderDetail.receiptDate(order.proof.receiptDate)}</p>
        </Section>
      )}

      <Section title={t.orderDetail.progress}>
        <Timeline order={order} />
      </Section>
    </div>
  );
}
