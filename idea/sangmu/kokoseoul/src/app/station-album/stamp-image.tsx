"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { pickLocale, type Locale } from "@/lib/locale";
import { drawStamp, stampPixels, type StampMotif } from "./stamp-art";
import { collectStationStamp } from "./stamp-collection";
import { checkStampProximity, stampRadiusMetres, type StationPoint } from "./stamp-proximity";
import styles from "./station-album.module.css";

type Props = {
  color: string;
  motif: StampMotif;
  lineId: number;
  lineLabel: string;
  stationName: string;
  locale: Locale;
  collected: boolean | null;
  stationPoints: readonly StationPoint[];
  characterSrc: string | null;
  children: ReactNode;
};

type LocationIssue = "denied" | "unavailable" | "timeout" | "inaccurate" | "too-far";

const locationMessages: Record<LocationIssue, readonly [ja: string, ko: string]> = {
  denied: ["ブラウザーの設定で位置情報を許可してから、もう一度お試しください。", "브라우저 설정에서 위치 접근을 허용한 뒤 다시 시도해 주세요."],
  unavailable: ["現在地を取得できませんでした。地上や開けた場所でもう一度お試しください。", "현재 위치를 확인하지 못했어요. 지상이나 트인 곳에서 다시 시도해 주세요."],
  timeout: ["現在地の確認に時間がかかっています。少し待ってから、もう一度お試しください。", "현재 위치 확인에 시간이 걸리고 있어요. 잠시 뒤 다시 시도해 주세요."],
  inaccurate: ["現在地の精度が足りません。駅に近づくか、地上でもう一度お試しください。", "위치 오차가 커요. 역에 더 가까이 가거나 지상에서 다시 시도해 주세요."],
  "too-far": [`駅の中心から${stampRadiusMetres}m以内で受け取れます。駅に近づいて、もう一度お試しください。`, `역 중심에서 ${stampRadiusMetres}m 이내에서 받을 수 있어요. 역에 가까이 가서 다시 시도해 주세요.`],
};

export function StampImage({ color, motif, lineId, lineLabel, stationName, locale, collected, stationPoints, characterSrc, children }: Props) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const painted = useRef(false);
  const characterLoad = useRef<Promise<void> | null>(null);
  const saving = useRef(false);
  const locating = useRef(false);
  const [status, setStatus] = useState<"idle" | "collected" | "claim-error" | "saving" | "requested" | "export-error">("idle");
  const [isLocating, setIsLocating] = useState(false);
  const [locationIssue, setLocationIssue] = useState<LocationIssue | null>(null);
  const attachCanvas = useCallback((element: HTMLCanvasElement | null) => {
    canvas.current = element;
    characterLoad.current = null;
    const stamp = { color, motif, lineLabel, stationName };
    painted.current = element !== null && drawStamp(element, stamp);
    if (!element || !characterSrc || !painted.current) return;

    const character = new Image();
    character.src = characterSrc;
    const load = character.decode().then(() => {
      if (canvas.current === element && characterLoad.current === load) {
        painted.current = drawStamp(element, { ...stamp, character });
      }
    }, () => {
      // Keep the existing stamp visible and exportable when the image cannot load.
    });
    characterLoad.current = load;
  }, [characterSrc, color, motif, lineLabel, stationName]);

  function collect() {
    if (collected !== false || locating.current || stationPoints.length === 0) return;
    setStatus("idle");
    setLocationIssue(null);
    if (!navigator.geolocation) {
      setLocationIssue("unavailable");
      return;
    }
    locating.current = true;
    setIsLocating(true);
    function finish() {
      locating.current = false;
      if (!canvas.current) return false;
      setIsLocating(false);
      return true;
    }
    try {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        if (!finish()) return;
        const result = checkStampProximity(coords, stationPoints);
        if (result !== "nearby") {
          setLocationIssue(result);
          return;
        }
        try {
          collectStationStamp(stationName);
          setStatus("collected");
        } catch {
          setStatus("claim-error");
        }
      }, (error) => {
        if (!finish()) return;
        setLocationIssue(error.code === 1 ? "denied" : error.code === 3 ? "timeout" : "unavailable");
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 });
    } catch {
      if (finish()) setLocationIssue("unavailable");
    }
  }

  async function save() {
    const image = canvas.current;
    if (!collected || saving.current || !image) return;
    saving.current = true;
    setStatus("saving");
    try {
      await characterLoad.current;
      if (canvas.current !== image) return;
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
      setStatus("export-error");
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
      {collected === false && stationPoints.length === 0 && (
        <p className={styles.note}>{pickLocale(locale, "この駅の位置データを確認できないため、スタンプは受け取れません。", "이 역은 위치 데이터를 확인할 수 없어 스탬프를 받을 수 없어요.")}</p>
      )}
      {collected !== null && (collected || stationPoints.length > 0) && (
        <div className={styles.stampActions}>
          <button type="button" className={`${styles.saveStamp} seoul-button-primary`} onClick={collected ? save : collect} disabled={isLocating || status === "saving"}>
            {!collected ? isLocating ? pickLocale(locale, "現在地を確認中…", "현재 위치 확인 중…") : pickLocale(locale, "現在地を確認してスタンプをもらう", "현재 위치 확인하고 스탬프 받기")
              : status === "saving" ? pickLocale(locale, "画像を準備中…", "이미지 준비 중…")
              : pickLocale(locale, "スタンプをPNGで保存", "스탬프 PNG로 저장")}
          </button>
          <p role="status" className={styles.note}>
            {locationIssue && !collected && pickLocale(locale, ...locationMessages[locationIssue])}
            {status === "collected" && collected && pickLocale(locale, "スタンプ帳に追加しました。", "스탬프를 도감에 추가했어요.")}
            {status === "claim-error" && !collected && pickLocale(locale, "スタンプを保存できませんでした。ブラウザーの保存設定を確認して、もう一度お試しください。", "스탬프를 저장하지 못했어요. 브라우저의 저장 설정을 확인하고 다시 시도해 주세요.")}
            {status === "requested" && pickLocale(locale, "ブラウザーのダウンロードをご確認ください。", "브라우저의 다운로드를 확인해 주세요.")}
            {status === "export-error" && pickLocale(locale, "画像を作成できませんでした。もう一度お試しください。", "이미지를 만들지 못했어요. 다시 시도해 주세요.")}
          </p>
        </div>
      )}
    </div>
  );
}
