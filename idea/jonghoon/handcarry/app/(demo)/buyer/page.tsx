"use client";

import Link from "next/link";
import { EmptyState, OrderCard, PageTitle } from "@/components/order/order-card";
import { ACTING_USER } from "@/lib/demo/users";
import { useT } from "@/lib/i18n/use-t";
import { useDemoState } from "@/lib/store/react";

export default function BuyerHome() {
  const { t } = useT();
  const { orders } = useDemoState();
  const mine = orders.filter((o) => o.buyerId === ACTING_USER.buyer);

  return (
    <>
      <PageTitle title={t.buyer.homeTitle} lead={t.buyer.homeLead} />
      <Link
        href="/buyer/orders/new"
        className="mb-5 flex h-[50px] w-full items-center justify-center rounded-full bg-primary text-base font-bold text-white transition hover:bg-primary-hover"
      >
        {t.buyer.newOrder}
      </Link>
      {mine.length === 0 ? (
        <EmptyState>{t.buyer.empty}</EmptyState>
      ) : (
        <ul className="space-y-3" aria-label={t.buyer.homeTitle}>
          {mine.map((o) => (
            <li key={o.id}>
              <OrderCard
                order={o}
                href={`/buyer/orders/${o.id}`}
                meta={o.status === "open" ? <span className="text-[12px] font-semibold text-ink">{t.buyer.bidCount(o.bids.length)}</span> : null}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
