"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import type { Worker } from "tesseract.js";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import type { SubwayStation } from "@/modules/transit/subway-network";
import { readTransferSign, type TransferSignResult } from "@/modules/transit/transfer-sign";

const ocrAssets = "/subway-sign-ocr";
const photoMaxSide = 1600;

async function resizePhoto(file: File) {
  const photoUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = photoUrl;
    await image.decode();
    const scale = Math.min(1, photoMaxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo canvas is unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(photoUrl);
  }
}

type Scan = { kind: "idle" | "scanning" } | TransferSignResult;

export function SubwayTransferSignCheck({ targetLine }: { targetLine: SubwayStation["line"] }) {
  const { locale } = useLocale();
  const hintId = useId();
  const [scan, setScan] = useState<Scan>({ kind: "idle" });
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function checkPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || active.current) return;

    const controller = new AbortController();
    const { signal } = controller;
    active.current = controller;
    setScan({ kind: "scanning" });
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    let worker: Worker | undefined;
    try {
      const cancelled = new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
      const result = await Promise.race([cancelled, (async () => {
        const photo = await resizePhoto(file);
        signal.throwIfAborted();
        const { createWorker, OEM } = await import("tesseract.js");
        signal.throwIfAborted();
        worker = await createWorker(["kor", "eng"], OEM.LSTM_ONLY, {
          workerPath: `${ocrAssets}/worker.min.js`,
          corePath: `${ocrAssets}/tesseract-core-lstm.js`,
          langPath: ocrAssets,
          workerBlobURL: false,
          errorHandler: () => controller.abort(),
        });
        if (signal.aborted) {
          await worker.terminate();
          signal.throwIfAborted();
        }
        const { data } = await worker.recognize(photo);
        return readTransferSign(data.text, data.confidence);
      })()]);
      setScan(result);
    } catch {
      setScan({ kind: "unclear" });
    } finally {
      window.clearTimeout(timeout);
      active.current = null;
      await worker?.terminate();
    }
  }

  const targetLabel = pickLocale(locale, `${targetLine}号線`, `${targetLine}호선`);
  const scanning = scan.kind === "scanning";
  let resultMessage = "";
  if (scanning) {
    resultMessage = pickLocale(locale, "写真の文字を読み取っています…", "사진 속 글자를 읽고 있어요…");
  } else if (scan.kind === "unclear") {
    resultMessage = pickLocale(locale,
      `路線番号を一つに絞れませんでした。${targetLabel}の表示だけを撮るか、現地の表示と見比べてください。`,
      `호선 번호를 하나로 확인하기 어려워요. ${targetLabel} 표지만 다시 찍거나 현장 표지에서 직접 확인해요.`);
  } else if (scan.kind === "read") {
    if (scan.line === targetLine) {
      resultMessage = pickLocale(locale,
        `「${targetLabel}」の表示が見つかりました。矢印と行先も現地で確認してください。`,
        `‘${targetLabel}’ 표기를 찾았어요. 화살표와 행선지도 현장에서 확인해요.`);
    } else {
      resultMessage = pickLocale(locale,
        `写真から「${scan.line}号線」を読み取りました。乗り換え先の「${targetLabel}」を探してください。`,
        `사진에서 ‘${scan.line}호선’을 읽었어요. 갈아탈 ‘${targetLabel}’ 표지를 찾아요.`);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2">
      <label className={`relative inline-flex min-h-11 items-center rounded-md font-bold text-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)] ${scanning ? "opacity-60" : "cursor-pointer"}`}>
        <input type="file" accept="image/*" capture="environment" className="sr-only"
          aria-describedby={hintId} disabled={scanning} onChange={checkPhoto} />
        {scan.kind === "read" || scan.kind === "unclear"
          ? pickLocale(locale, "案内表示を撮り直す", "표지판 다시 찍기")
          : pickLocale(locale, "カメラで案内表示を確認", "카메라로 표지판 확인")}
      </label>
      <p id={hintId} className="text-sm leading-6 text-[var(--foreground-muted)]">
        {pickLocale(locale,
          "路線番号が写るように撮ってください。写真は端末内で読み取ります。",
          "호선 번호가 보이게 찍어요. 사진은 기기 안에서만 읽어요.")}
      </p>
      <div role="status" className={resultMessage ? "mt-2 text-sm font-bold leading-6" : undefined}>
        {resultMessage}
      </div>
    </div>
  );
}
