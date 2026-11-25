"use client";

import { useEffect, useRef, useState } from "react";
import { pickLocale, type Locale } from "@/lib/locale";
import styles from "./phone-preview.module.css";

export function PhoneScreen({ title, locale }: { title: string; locale: Locale }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    const deadline = Date.now() + 10_000;
    const timer = window.setInterval(() => {
      if (frame.current?.contentDocument?.querySelector("#main-content main h1")) {
        setStatus("ready");
      } else if (Date.now() >= deadline) {
        setStatus("failed");
      } else {
        return;
      }
      window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [attempt]);

  return (
    <div className={styles.screenSlot}>
      <iframe
        key={attempt}
        ref={frame}
        className={styles.screen}
        title={title}
        referrerPolicy="same-origin"
        src={attempt ? `/mobile-preview/app?retry=${attempt}` : "/mobile-preview/app"}
      />
      {status !== "ready" ? (
        <div className={styles.screenMessage}>
          <p role="status">
            {status === "loading"
              ? pickLocale(locale, "スマートフォン表示を読み込んでいます…", "스마트폰 화면을 불러오고 있어요…")
              : pickLocale(locale, "フレーム内の画面を開けませんでした。", "프레임 안의 화면을 열지 못했어요.")}
          </p>
          {status === "failed" ? (
            <button type="button" className="seoul-button-primary mt-4 min-h-11 rounded-lg px-4 font-bold" onClick={() => {
              setStatus("loading");
              setAttempt((count) => count + 1);
            }}>
              {pickLocale(locale, "スマートフォン表示を開き直す", "스마트폰 화면 다시 열기")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
