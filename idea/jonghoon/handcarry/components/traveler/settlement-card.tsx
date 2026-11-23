"use client";

import { useState } from "react";
import { ErrorNotice } from "@/components/order/order-parts";
import { Button } from "@/components/ui/button";
import { Card, Notice, Row } from "@/components/ui/card";
import type { Order, PayoutMethod } from "@/lib/domain/types";
import { formatWon } from "@/lib/format";
import { useT } from "@/lib/i18n/use-t";
import { nowIso, useDispatch } from "@/lib/store/react";
import type { DispatchResult } from "@/lib/store/state";

const METHODS: PayoutMethod[] = ["prepaid_card", "hub_cash"];

export function SettlementCard({ order }: { order: Order }) {
  const { t, locale } = useT();
  const dispatch = useDispatch();
  const [result, setResult] = useState<DispatchResult | null>(null);
  const s = order.settlement;
  if (!s) return null;

  return (
    <Card className="space-y-4 p-4" aria-label={t.traveler.settlementTitle}>
      <h2 className="font-display text-[17px] font-semibold">{t.traveler.settlementTitle}</h2>
      <div className="space-y-2">
        <Row label={t.traveler.settlementItem} value={formatWon(s.itemWon, locale)} />
        <Row label={t.traveler.settlementReward} value={formatWon(s.reward, locale)} />
        <div className="border-t border-line pt-2">
          <Row label={t.traveler.settlementTotal} value={formatWon(s.total, locale)} strong />
        </div>
        <p className="text-[12px] font-semibold text-success">{t.traveler.feeFree}</p>
      </div>
      {s.payoutMethod ? (
        <Notice tone="success">{t.traveler.paidOut(t.payout[s.payoutMethod])}</Notice>
      ) : (
        <div className="space-y-2" role="group" aria-label={t.traveler.choosePayout}>
          <p className="text-[13px] font-semibold">{t.traveler.choosePayout}</p>
          {METHODS.map((m) => (
            <Button
              key={m}
              variant={m === "prepaid_card" ? "primary" : "secondary"}
              block
              onClick={() => setResult(dispatch({ type: "orderEvent", orderId: order.id, event: { type: "choosePayout", method: m, at: nowIso() } }))}
            >
              {t.payout[m]}
            </Button>
          ))}
        </div>
      )}
      <ErrorNotice result={result} />
    </Card>
  );
}
