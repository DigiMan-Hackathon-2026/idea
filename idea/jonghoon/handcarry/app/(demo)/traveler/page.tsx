"use client";

import { EmptyState, OrderCard, PageTitle } from "@/components/order/order-card";
import { minRewardFor } from "@/components/traveler/bid-form";
import { ACTING_USER } from "@/lib/demo/users";
import { formatWon } from "@/lib/format";
import { useT } from "@/lib/i18n/use-t";
import { useDemoState } from "@/lib/store/react";

export default function TravelerFind() {
  const { t, locale } = useT();
  const open = useDemoState().orders.filter((o) => o.status === "open");

  return (
    <>
      <PageTitle title={t.traveler.findTitle} lead={t.traveler.findLead} />
      {open.length === 0 ? (
        <EmptyState>{t.traveler.noOpen}</EmptyState>
      ) : (
        <ul className="space-y-3" aria-label={t.traveler.findTitle}>
          {open.map((o) => {
            const mine = o.bids.find((b) => b.travelerId === ACTING_USER.traveler);
            return (
              <li key={o.id}>
                <OrderCard
                  order={o}
                  href={`/traveler/orders/${o.id}`}
                  meta={
                    <span className="text-[12px] font-semibold text-ink">
                      {mine ? t.traveler.yourBid(formatWon(mine.reward, locale)) : t.traveler.minReward(formatWon(minRewardFor(o), locale))}
                    </span>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
