"use client";

import { EmptyState, OrderCard, PageTitle } from "@/components/order/order-card";
import { ACTING_USER } from "@/lib/demo/users";
import type { Order } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/use-t";
import { useDemoState } from "@/lib/store/react";

function isMyJob(order: Order): boolean {
  return order.bids.some((b) => b.id === order.selectedBidId && b.travelerId === ACTING_USER.traveler);
}

export default function TravelerJobs() {
  const { t } = useT();
  const jobs = useDemoState().orders.filter(isMyJob);

  return (
    <>
      <PageTitle title={t.traveler.jobsTitle} />
      {jobs.length === 0 ? (
        <EmptyState>{t.traveler.noJobs}</EmptyState>
      ) : (
        <ul className="space-y-3" aria-label={t.traveler.jobsTitle}>
          {jobs.map((o) => (
            <li key={o.id}>
              <OrderCard order={o} href={`/traveler/orders/${o.id}`} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
