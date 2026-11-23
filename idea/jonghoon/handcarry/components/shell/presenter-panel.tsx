"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ACTING_USER, USERS } from "@/lib/demo/users";
import { nextActor } from "@/lib/domain/order-machine";
import type { Locale, Role } from "@/lib/domain/types";
import { ko } from "@/lib/i18n/ko";
import { useRole } from "@/lib/i18n/use-t";
import { useDemoState, useDemoStore, useDispatch } from "@/lib/store/react";

const ROLES: Role[] = ["buyer", "traveler", "operator"];
const LANGS: { value: Locale | null; label: string }[] = [
  { value: null, label: ko.presenter.languageAuto },
  { value: "ko", label: "한국어" },
  { value: "ja", label: "日本語" },
];

// The presenter speaks Korean, so the panel is always Korean regardless of the app locale.
export function PresenterPanel({ onNavigate }: { onNavigate?: () => void }) {
  const t = ko;
  const router = useRouter();
  const role = useRole();
  const state = useDemoState();
  const store = useDemoStore();
  const dispatch = useDispatch();
  const [confirmingReset, setConfirmingReset] = useState(false);

  const switchRole = (next: Role) => {
    dispatch({ type: "setRole", role: next });
    router.push(`/${next}`);
    onNavigate?.();
  };

  const latest = state.orders.find((o) => !o.id.startsWith("seed-"));
  const latestActor = latest ? nextActor(latest) : null;

  return (
    <section aria-label={t.presenter.open} className="space-y-6">
      <header className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">{t.presenter.title}</p>
        <p className="text-sm leading-relaxed text-ink-2">{t.presenter.subtitle}</p>
      </header>

      <div role="group" aria-label={t.presenter.role} className="space-y-2">
        <p className="text-[13px] font-semibold">{t.presenter.role}</p>
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={role === r}
            onClick={() => switchRole(r)}
            className="flex h-12 w-full items-center justify-between rounded-md border-[1.5px] border-line-strong bg-surface px-4 text-left transition hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary-soft"
          >
            <span className="font-bold">{t.roles[r]}</span>
            <span className="text-sm text-ink-2">{USERS[ACTING_USER[r]].name}</span>
          </button>
        ))}
      </div>

      <div role="group" aria-label={t.presenter.language} className="space-y-2">
        <p className="text-[13px] font-semibold">{t.presenter.language}</p>
        <div className="flex gap-2">
          {LANGS.map((l) => (
            <button
              key={l.label}
              type="button"
              aria-pressed={state.session.localeOverride === l.value}
              onClick={() => dispatch({ type: "setLocaleOverride", locale: l.value })}
              className="h-[34px] rounded-full border-[1.5px] border-line-strong px-3.5 text-sm transition hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white"
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {latest && (
        <div className="space-y-1 rounded-md bg-muted px-4 py-3 text-sm" aria-label={t.presenter.nextUp} role="note">
          <p className="text-[12px] font-semibold text-ink-2">{t.presenter.nextUp}</p>
          <p className="font-semibold">{latest.item.name}</p>
          <p className="text-ink-2">
            {t.status[latest.status]} · {latestActor ? t.common.waitingOn(t.roles[latestActor]) : t.common.noOne}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {confirmingReset ? (
          <div className="space-y-2 rounded-md border border-line p-3">
            <p className="text-sm">{t.presenter.resetConfirm}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  store?.reset();
                  setConfirmingReset(false);
                  router.push("/buyer");
                  onNavigate?.();
                }}
              >
                {t.common.confirm}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingReset(false)}>
                {t.common.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmingReset(true)}>
            {t.presenter.reset}
          </Button>
        )}
        <p className="text-[12px] text-ink-3">{t.presenter.policyNote}</p>
      </div>
    </section>
  );
}
