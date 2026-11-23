"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useDemoState, useDemoStore } from "@/lib/store/react";
import { SERVICE_NAME } from "@/lib/config";
import { ACTING_USER, USERS } from "@/lib/demo/users";
import { ko } from "@/lib/i18n/ko";
import { useRole, useT } from "@/lib/i18n/use-t";
import { BottomNav } from "./bottom-nav";
import { PresenterPanel } from "./presenter-panel";

// Desktop (lg+): presenter panel beside a 390×844 phone frame, as in a screen-shared demo.
// Narrow screens: the app fills the screen and the panel opens from a floating button.
export function PresenterShell({ children }: { children: ReactNode }) {
  const role = useRole();
  const { t, locale } = useT();
  const [panelOpen, setPanelOpen] = useState(false);
  const { session } = useDemoState();
  const store = useDemoStore();

  // Role routes are the source of truth; remember the role so role-less pages (chat) act as it.
  useEffect(() => {
    if (store && session.role !== role) store.dispatch({ type: "setRole", role });
  }, [store, session.role, role]);

  return (
    <div className="min-h-dvh lg:flex lg:items-center lg:justify-center lg:gap-12 lg:bg-[radial-gradient(circle_at_20%_20%,#fdf4ff,transparent_45%),radial-gradient(circle_at_80%_80%,#ecfeff,transparent_45%)] lg:p-8">
      <aside className="hidden w-[300px] shrink-0 lg:block">
        <PresenterPanel />
      </aside>

      <div
        lang={locale}
        data-role={role}
        className="flex h-dvh flex-col bg-canvas lg:h-[844px] lg:w-[390px] lg:overflow-hidden lg:rounded-[48px] lg:border-[10px] lg:border-ink lg:shadow-overlay"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-5 py-3">
          <p className="font-display text-[17px] font-bold">{SERVICE_NAME[locale]}</p>
          <p className="rounded-full bg-muted px-3 py-1 text-[12px] font-medium text-ink-2">
            {t.roles[role]} · {USERS[ACTING_USER[role]].name}
          </p>
        </header>
        <main className="no-scrollbar flex-1 overflow-y-auto px-5 py-5">{children}</main>
        <BottomNav role={role} t={t} />
      </div>

      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="fixed right-4 bottom-20 z-20 h-12 rounded-full bg-ink px-5 text-sm font-bold text-white shadow-large lg:hidden"
      >
        {ko.presenter.open}
      </button>
      {panelOpen && (
        <div role="dialog" aria-modal="true" aria-label={ko.presenter.open} className="fixed inset-0 z-30 flex items-end bg-black/40 lg:hidden">
          <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-xl bg-surface p-5">
            <div className="mb-4 flex justify-end">
              <button type="button" onClick={() => setPanelOpen(false)} className="text-sm font-bold text-ink-2">
                {ko.presenter.close}
              </button>
            </div>
            <PresenterPanel onNavigate={() => setPanelOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
