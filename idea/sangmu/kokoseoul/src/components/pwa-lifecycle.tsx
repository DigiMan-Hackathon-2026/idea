"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";

export function PwaLifecycle() {
  const { locale } = useLocale();
  const [waitingWorker, setWaitingWorker] =
    useState<ServiceWorker | null>(null);
  const updateRequested = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    let registration: ServiceWorkerRegistration | null = null;

    const handleControllerChange = () => {
      if (!updateRequested.current || reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((nextRegistration) => {
        registration = nextRegistration;

        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration?.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(installingWorker);
            }
          });
        });
      })
      .catch(() => {
        // PWA support is progressive; the web experience remains available.
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <aside
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-[110] mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl border border-slate-900/10 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.22)]"
    >
      <p className="text-sm font-bold leading-6 text-slate-700">
        {pickLocale(
          locale,
          "新しいバージョンを利用できます。",
          "새 버전을 사용할 수 있어요.",
        )}
      </p>
      <button
        type="button"
        onClick={() => {
          updateRequested.current = true;
          waitingWorker.postMessage({ type: "SKIP_WAITING" });
        }}
        className="min-h-11 shrink-0 rounded-xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-[#ff5a36] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        {pickLocale(locale, "更新する", "새 버전 적용하기")}
      </button>
    </aside>
  );
}
