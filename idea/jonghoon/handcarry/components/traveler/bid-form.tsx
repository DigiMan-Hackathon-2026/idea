"use client";

import { useState, type FormEvent } from "react";
import { ErrorNotice } from "@/components/order/order-parts";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { ESCROW_RATE } from "@/lib/config";
import { ACTING_USER } from "@/lib/demo/users";
import { minReward, toWon } from "@/lib/domain/money";
import { won, type Order } from "@/lib/domain/types";
import { formatWon } from "@/lib/format";
import { useT } from "@/lib/i18n/use-t";
import { newId, nowIso, useDispatch } from "@/lib/store/react";
import type { DispatchResult } from "@/lib/store/state";

export function minRewardFor(order: Order) {
  return minReward(toWon(order.item.priceYen, ESCROW_RATE));
}

export function BidForm({ order }: { order: Order }) {
  const { t, locale } = useT();
  const dispatch = useDispatch();
  const min = minRewardFor(order);
  const mine = order.bids.find((b) => b.travelerId === ACTING_USER.traveler);
  const [reward, setReward] = useState(String(mine?.reward ?? Math.ceil(min / 1000) * 1000));
  const [message, setMessage] = useState(mine?.message ?? "");
  const [result, setResult] = useState<DispatchResult | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(reward);
    if (!Number.isInteger(amount) || amount < 0) {
      setResult({ ok: false, error: "reward_below_minimum" });
      return;
    }
    setResult(
      dispatch({
        type: "orderEvent",
        orderId: order.id,
        event: {
          type: "placeBid",
          bid: { id: `b-${newId()}`, travelerId: ACTING_USER.traveler, reward: won(amount), message: message.trim(), createdAt: nowIso() },
        },
      }),
    );
  };

  return (
    <Card className="space-y-4 p-4">
      {mine && <Notice tone="success">{t.traveler.bidPlaced}</Notice>}
      <form onSubmit={submit} className="space-y-4" aria-label={t.traveler.bid} noValidate>
        <Field id="reward" label={t.traveler.rewardInput} help={t.traveler.minReward(formatWon(min, locale))}>
          <input id="reward" inputMode="numeric" className={`${inputClass} font-mono`} value={reward} onChange={(e) => setReward(e.target.value)} />
        </Field>
        <Field id="bid-message" label={t.traveler.message}>
          <input id="bid-message" className={inputClass} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <Button type="submit" block size="lg">
          {t.traveler.bid}
        </Button>
      </form>
      <ErrorNotice result={result} />
    </Card>
  );
}
