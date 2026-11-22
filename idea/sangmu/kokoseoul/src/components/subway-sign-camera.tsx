"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import { detectLineThreeArrow, type TransferArrow } from "@/modules/transit/transfer-arrow";

type State = "idle" | "opening" | "live" | "unavailable";

function sameArrow(first: TransferArrow | null, second: TransferArrow) {
  return first?.direction === second.direction
    && Math.abs(first.x - second.x) < second.width * 0.65
    && Math.abs(first.y - second.y) < second.height * 0.65;
}

export function SubwaySignCamera() {
  const { locale } = useLocale();
  const [state, setState] = useState<State>("idle");
  const [arrow, setArrow] = useState<TransferArrow | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const media = useRef<MediaStream | null>(null);
  const request = useRef({ id: 0 });

  function stop() {
    request.current.id++;
    media.current?.getTracks().forEach((track) => track.stop());
    media.current = null;
    if (video.current) video.current.srcObject = null;
    setState("idle");
    setArrow(null);
  }

  useEffect(() => {
    const pauseOnHide = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", pauseOnHide);
    const videoElement = video.current;
    const cameraRequest = request.current;
    return () => {
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", pauseOnHide);
      cameraRequest.id++;
      media.current?.getTracks().forEach((track) => track.stop());
      media.current = null;
      if (videoElement) videoElement.srcObject = null;
    };
  }, []);

  useEffect(() => {
    if (state !== "live") return;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    let previous: TransferArrow | null = null;
    const interval = window.setInterval(() => {
      const source = video.current;
      const track = media.current?.getVideoTracks()[0];
      if (!track || track.muted || track.readyState !== "live" || !source || !source.videoWidth || source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        previous = null;
        setArrow(null);
        return;
      }
      const scale = Math.min(1, 1024 / Math.max(source.videoWidth, source.videoHeight));
      const width = Math.max(1, Math.round(source.videoWidth * scale));
      const height = Math.max(1, Math.round(source.videoHeight * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.drawImage(source, 0, 0, width, height);
      const match = detectLineThreeArrow(context.getImageData(0, 0, width, height));
      const confirmed = match && sameArrow(previous, match) ? {
        direction: match.direction, x: match.x / width, y: match.y / height, width: match.width / width, height: match.height / height,
      } : null;
      setArrow(confirmed);
      previous = match;
    }, 300);
    return () => window.clearInterval(interval);
  }, [state]);

  async function openCamera() {
    const cameraRequest = ++request.current.id;
    setState("opening");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !video.current) throw new Error("Camera unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      if (cameraRequest !== request.current.id || !video.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      media.current = stream;
      video.current.srcObject = stream;
      await video.current.play();
      if (cameraRequest === request.current.id) setState("live");
    } catch {
      if (cameraRequest !== request.current.id) return;
      stop();
      setState("unavailable");
    }
  }

  const active = state === "opening" || state === "live";
  const arrowCaption = arrow && {
    up: pickLocale(locale, "上向きの矢印を見つけました。行先も現地でご確認ください。", "위쪽 화살표를 찾았어요. 현장 표지에서 행선지도 확인해요."),
    left: pickLocale(locale, "左向きの矢印を見つけました。行先も現地でご確認ください。", "왼쪽 화살표를 찾았어요. 현장 표지에서 행선지도 확인해요."),
    right: pickLocale(locale, "右向きの矢印を見つけました。行先も現地でご確認ください。", "오른쪽 화살표를 찾았어요. 현장 표지에서 행선지도 확인해요."),
  }[arrow.direction];

  return (
    <main id="main-content" className="mx-auto min-h-dvh max-w-xl px-4 pb-8 pt-5 sm:px-6">
      {/* Direct navigation loads the camera policy of the new document. */}
      <a href="/subway" className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--primary)] underline">
        {pickLocale(locale, "地下鉄案内に戻る", "지하철 안내로 돌아가기")}
      </a>
      <h1 className="mt-4 text-2xl font-black">{pickLocale(locale, "3号線の乗り換え矢印を確認", "3호선 환승 화살표 확인")}</h1>
      <p className="mt-2 text-sm leading-6">
        {pickLocale(locale, "立ち止まって、丸い「3」と隣の矢印を一緒に映してください。映像は端末内で読み取ります。", "멈춰 서서 원 안의 ‘3’과 옆 화살표를 함께 비춰요. 영상은 기기 안에서만 읽어요.")}
      </p>
      <div hidden={!active} className="relative mt-4 overflow-hidden rounded-xl bg-[var(--foreground)]">
        <video ref={video} muted autoPlay playsInline className="block h-auto w-full" aria-hidden="true" />
        {arrow ? (
          <span aria-hidden="true" data-testid="transfer-arrow-overlay" className="pointer-events-none absolute rounded-md border-4 border-white shadow-[0_0_0_3px_var(--primary)]"
            style={{ left: `${arrow.x * 100}%`, top: `${arrow.y * 100}%`, width: `${arrow.width * 100}%`, height: `${arrow.height * 100}%` }} />
        ) : null}
      </div>
      {state === "opening" ? <p role="status" className="mt-4 text-sm">{pickLocale(locale, "カメラを開いています…", "카메라를 여는 중이에요…")}</p> : null}
      {state === "live" ? <p role="status" className="mt-4 text-sm font-bold">{arrowCaption || pickLocale(locale, "「3」と矢印が同じ画面に入るように映してください。", "‘3’과 화살표가 한 화면에 들어오도록 비춰요.")}</p> : null}
      {state === "unavailable" ? <p role="status" className="mt-4 text-sm">{pickLocale(locale, "カメラを開けませんでした。端末のカメラの権限を確認するか、地下鉄案内にお戻りください。", "카메라를 열 수 없어요. 기기의 카메라 권한을 확인하거나 지하철 안내로 돌아가요.")}</p> : null}
      <button type="button" onClick={active ? stop : openCamera}
        className="mt-4 min-h-11 rounded-xl bg-[var(--primary)] px-4 py-3 font-bold text-white">
        {active ? pickLocale(locale, "カメラを閉じる", "카메라 닫기") : pickLocale(locale, "カメラを開く", "카메라 열기")}
      </button>
    </main>
  );
}
