"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/domain/types";
import type { Messages } from "@/lib/i18n/ko";

type Tab = { href: string; label: (t: Messages) => string };

const TABS: Record<Role, Tab[]> = {
  buyer: [
    { href: "/buyer", label: (t) => t.nav.buyerHome },
    { href: "/buyer/orders/new", label: (t) => t.nav.buyerNew },
  ],
  traveler: [
    { href: "/traveler", label: (t) => t.nav.travelerFind },
    { href: "/traveler/jobs", label: (t) => t.nav.travelerJobs },
  ],
  operator: [
    { href: "/operator", label: (t) => t.nav.operatorHub },
    { href: "/operator/disputes", label: (t) => t.nav.operatorDisputes },
  ],
};

export function BottomNav({ role, t }: { role: Role; t: Messages }) {
  const pathname = usePathname();
  return (
    <nav aria-label={t.roles[role]} className="flex shrink-0 border-t border-line bg-surface">
      {TABS[role].map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-14 flex-1 items-center justify-center text-sm font-bold transition ${active ? "text-primary" : "text-ink-2 hover:text-ink"}`}
          >
            {tab.label(t)}
          </Link>
        );
      })}
    </nav>
  );
}
