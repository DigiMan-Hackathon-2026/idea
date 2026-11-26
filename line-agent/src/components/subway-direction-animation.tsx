"use client";

import { useState } from "react";
import { pickLocale, type Locale } from "@/lib/locale";
import styles from "./subway-direction-animation.module.css";

export function SubwayDirectionAnimation({ locale, from, to }: { locale: Locale; from: string; to: string }) {
  const [playback, setPlayback] = useState(0);

  return (
    <details className={`${styles.disclosure} mt-3 rounded-xl border border-[var(--border)]`}>
      <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-bold leading-6">
        {pickLocale(locale, "電車の進む順を3Dで見る", "열차 이동 순서 3D로 보기")}
      </summary>
      <div className="px-3 pb-3 sm:px-4">
        <div className={styles.scene} aria-hidden="true">
          <div className={styles.track}>
            <span className={styles.start} />
            <span className={styles.finish} />
            <div className={styles.train} key={playback}>
              <span className={styles.roof} />
              <span className={styles.side} />
              <span className={styles.front} />
            </div>
          </div>
        </div>
        <ol className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <li>
            <span className="block text-[var(--foreground-muted)]">{pickLocale(locale, "出発駅", "출발역")}</span>
            <strong>{from}</strong>
          </li>
          <li className="text-right">
            <span className="block text-[var(--foreground-muted)]">{pickLocale(locale, "次の停車駅", "다음 정차역")}</span>
            <strong>{to}</strong>
          </li>
        </ol>
        <p className="mt-2 text-xs leading-5 text-[var(--foreground-muted)]">
          {pickLocale(locale, "停車順のイメージです。ホームでは行先表示を確認してください。", "정차 순서를 보여주는 예시예요. 승강장에서는 행선지 표시를 확인해요.")}
        </p>
        <button type="button" className={`${styles.replay} min-h-12 text-sm font-bold text-[var(--primary)] underline`} onClick={() => setPlayback((count) => count + 1)}>
          {pickLocale(locale, "動きをもう一度見る", "움직임 다시 보기")}
        </button>
      </div>
    </details>
  );
}
