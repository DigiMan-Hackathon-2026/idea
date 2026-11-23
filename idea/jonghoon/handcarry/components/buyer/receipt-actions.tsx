"use client";

import { useState } from "react";
import { ErrorNotice } from "@/components/order/order-parts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import type { Order } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/use-t";
import { nowIso, useDispatch } from "@/lib/store/react";
import type { DispatchResult } from "@/lib/store/state";

export function ReceiptActions({ order }: { order: Order }) {
  const { t } = useT();
  const dispatch = useDispatch();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<DispatchResult | null>(null);

  return (
    <Card className="space-y-4 p-4" aria-label={t.orderDetail.confirmTitle}>
      <div className="space-y-1">
        <h2 className="font-display text-[17px] font-semibold">{t.orderDetail.confirmTitle}</h2>
        <p className="text-sm leading-relaxed text-ink-2">{t.orderDetail.confirmLead}</p>
      </div>
      {rejecting ? (
        <div className="space-y-3">
          <Field id="reject-reason" label={t.orderDetail.rejectReason}>
            <textarea
              id="reject-reason"
              rows={3}
              className={`${inputClass} h-auto py-3`}
              placeholder={t.orderDetail.rejectPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Button
            variant="destructive"
            block
            onClick={() => setResult(dispatch({ type: "orderEvent", orderId: order.id, event: { type: "rejectReceipt", reason, at: nowIso() } }))}
          >
            {t.orderDetail.rejectSubmit}
          </Button>
          <Button variant="ghost" size="sm" block onClick={() => setRejecting(false)}>
            {t.common.cancel}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            size="lg"
            block
            onClick={() => setResult(dispatch({ type: "orderEvent", orderId: order.id, event: { type: "confirmReceipt", at: nowIso() } }))}
          >
            {t.orderDetail.confirm}
          </Button>
          <Button variant="ghost" block onClick={() => setRejecting(true)}>
            {t.orderDetail.reject}
          </Button>
        </div>
      )}
      <ErrorNotice result={result} />
    </Card>
  );
}
