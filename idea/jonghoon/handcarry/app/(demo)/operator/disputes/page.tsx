"use client";

import { EmptyState, OrderCard, PageTitle } from "@/components/order/order-card";
import { Section } from "@/components/ui/card";
import { useT } from "@/lib/i18n/use-t";
import { useDemoState } from "@/lib/store/react";

export default function OperatorDisputes() {
  const { t } = useT();
  const { orders } = useDemoState();
  const open = orders.filter((o) => o.status === "disputed");
  const resolved = orders.filter((o) => o.dispute?.ruling);

  return (
    <div className="space-y-6">
      <PageTitle title={t.operator.disputesTitle} />
      {open.length === 0 ? (
        <EmptyState>{t.operator.noDisputes}</EmptyState>
      ) : (
        <ul className="space-y-3" aria-label={t.operator.disputesTitle}>
          {open.map((o) => (
            <li key={o.id}>
              <OrderCard order={o} href={`/operator/disputes/${o.id}`} />
            </li>
          ))}
        </ul>
      )}
      {resolved.length > 0 && (
        <Section title={t.operator.resolved}>
          <ul className="space-y-3">
            {resolved.map((o) => (
              <li key={o.id}>
                <OrderCard order={o} href={`/operator/disputes/${o.id}`} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
