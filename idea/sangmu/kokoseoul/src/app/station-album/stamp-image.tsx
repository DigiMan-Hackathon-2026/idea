"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { pickLocale, type Locale } from "@/lib/locale";
import { drawStamp, stampPixels, type StampMotif } from "./stamp-art";
import styles from "./station-album.module.css";

type Props = {
  color: string;
  motif: StampMotif;
  lineId: number;
  lineLabel: string;
  stationName: string;
  locale: Locale;
  collected: boolean;
  children: ReactNode;
};

export function StampImage({ color, motif, lineId, lineLabel, stationName, locale, collected, children }: Props) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const painted = useRef(false);
  const saving = useRef(false);
  const [status, setStatus] = useState<"idle" | "saving" | "requested" | "error">("idle");
  const attachCanvas = useCallback((element: HTMLCanvasElement | null) => {
    canvas.current = element;
    painted.current = element !== null && drawStamp(element, { color, motif, lineLabel, stationName });
  }, [color, motif, lineLabel, stationName]);

  async function save() {
    if (!collected || saving.current || !canvas.current) return;
    saving.current = true;
    setStatus("saving");
    try {
      const image = canvas.current;
      if (!painted.current) {
        throw new Error("Canvas context unavailable");
      }
      const blob = await new Promise<Blob | null>((resolve) => image.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("PNG encoding failed");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cocoseoul-line-${lineId}-${stationName.replace(/[<>:"/\\|?*]/g, "-")}.png`;
      document.body.append(link);
      try {
        link.click();
        setStatus("requested");
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      setStatus("error");
    } finally {
      saving.current = false;
    }
  }

  return (
    <div className={styles.stampExport}>
      <figure className={styles.stampFigure}>
        <canvas ref={attachCanvas} width={stampPixels} height={stampPixels} className={styles.stampCanvas}
          data-motif={motif} role="img" aria-label={`${lineLabel} ${stationName}`}>
          {lineLabel} {stationName}
        </canvas>
        <figcaption>{children}</figcaption>
      </figure>
      {collected && (
        <div className={styles.stampActions}>
          <button type="button" className={`${styles.saveStamp} seoul-button-primary`} onClick={save} disabled={status === "saving"}>
            {status === "saving" ? pickLocale(locale, "画像を準備中…", "이미지 준비 중…") : pickLocale(locale, "スタンプをPNGで保存", "스탬프 PNG로 저장")}
          </button>
          <p role="status" className={styles.note}>
            {status === "requested" && pickLocale(locale, "ブラウザーのダウンロードをご確認ください。", "브라우저의 다운로드를 확인해 주세요.")}
            {status === "error" && pickLocale(locale, "画像を作成できませんでした。もう一度お試しください。", "이미지를 만들지 못했어요. 다시 시도해 주세요.")}
          </p>
        </div>
      )}
    </div>
  );
}
