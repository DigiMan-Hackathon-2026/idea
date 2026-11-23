"use client";

import { useState } from "react";
import { ErrorNotice } from "@/components/order/order-parts";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { USERS, type UserId } from "@/lib/demo/users";
import type { Order } from "@/lib/domain/types";
import { formatWon } from "@/lib/format";
import { useT } from "@/lib/i18n/use-t";
import { nowIso, useDispatch } from "@/lib/store/react";
import type { DispatchResult } from "@/lib/store/state";

export function travelerName(id: string): string {
  return id in USERS ? USERS[id as UserId].name : id;
}

export function BidList({ order }: { order: Order }) {
  const { t, locale } = useT();
  const dispatch = useDispatch();
  const [result, setResult] = useState<DispatchResult | null>(null);

  return (
    <Section title={t.orderDetail.bids}>
      {order.bids.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-2">{t.orderDetail.noBids}</p>
      ) : (
        <ul className="space-y-3" aria-label={t.orderDetail.bids}>
          {[...order.bids]
            .sort((a, b) => a.reward - b.reward)
            .map((bid) => (
              <li key={bid.id}>
                <Card className="space-y-3 p-4" aria-label={travelerName(bid.travelerId)}>
                  <div className="flex items-baseline justify-between">
                    <p className="font-semibold">{travelerName(bid.travelerId)}</p>
                    <p className="font-mono text-[15px] font-bold">
                      {t.orderDetail.reward} {formatWon(bid.reward, locale)}
                    </p>
                  </div>
                  {bid.message && <p className="text-[13px] text-ink-2">“{bid.message}”</p>}
                  <Button
                    size="sm"
                    block
                    onClick={() => setResult(dispatch({ type: "orderEvent", orderId: order.id, event: { type: "selectBid", bidId: bid.id, at: nowIso() } }))}
                  >
                    {t.orderDetail.selectBid}
                  </Button>
                </Card>
              </li>
            ))}
        </ul>
      )}
      <ErrorNotice result={result} />
    </Section>
  );
}
