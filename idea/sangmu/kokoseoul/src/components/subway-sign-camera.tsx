"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import type { Worker } from "tesseract.js";
import { createSignReader, readSignRegion } from "@/modules/transit/sign-ocr.client";
import { readPlatformSign } from "@/modules/transit/station-sign";
import { findPlatformSignRegions, findTransferPanels, type ImageBox, type SignPanel, type TransferArrow } from "@/modules/transit/transfer-arrow";
import { selectTransferArrow, type SignDirections } from "@/modules/transit/transfer-panel";
import type { SubwayStation } from "@/modules/transit/subway-network";

type State = "idle" | "opening" | "live" | "unavailable";
type Mode = "transfer" | "platform";

function samePanels(previous: SignPanel[], current: SignPanel[]) {
  return previous.length === current.length && current.every(({ arrow, line }, index) => {
    const before = previous[index];
    return line === before.line && arrow.direction === before.arrow.direction
      && Math.abs(arrow.x - before.arrow.x) <= arrow.width * 0.45
      && Math.abs(arrow.y - before.arrow.y) <= arrow.height * 0.45;
  });
}

function sampleSign(frame: ImageData, boxes: ImageBox[]) {
  return boxes.flatMap((box) => Array.from({ length: 160 }, (_, index) => {
    const x = box.x + Math.floor((index % 20 + 0.5) / 20 * box.width);
    const y = box.y + Math.floor((Math.floor(index / 20) + 0.5) / 8 * box.height);
    const pixel = (y * frame.width + x) * 4;
    return (frame.data[pixel] + frame.data[pixel + 1] + frame.data[pixel + 2]) / 3;
  }));
}

function sameScene(previous: number[], current: number[]) {
  return previous.length === current.length && previous.reduce((total, value, index) =>
    total + Math.abs(value - current[index]), 0) <= current.length * 12;
}

type Props = {
  line: SubwayStation["line"];
  platform: SubwayStation | null;
  next: SubwayStation | null;
  directions: SignDirections | null;
};

export function SubwaySignCamera({ line, platform, next, directions }: Props) {
  const { locale } = useLocale();
  const [state, setState] = useState<State>("idle");
  const [mode, setMode] = useState<Mode>("transfer");
  const [arrow, setArrow] = useState<TransferArrow | null>(null);
  const [station, setStation] = useState<SubwayStation | null>(null);
  const [readerUnavailable, setReaderUnavailable] = useState(false);
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
    setStation(null);
    setReaderUnavailable(false);
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
    const snapshot = document.createElement("canvas");
    const snapshotContext = snapshot.getContext("2d");
    if (!snapshotContext) return;

    let closed = false;
    let failed = false;
    let worker: Worker | undefined;
    let currentScene = 0;
    let previousSignature: number[] = [];
    let previousPanels: SignPanel[] = [];
    let previousStation: SubwayStation | null = null;
    let selectedArrow: TransferArrow | null = null;
    let stationSettled = false;
    let busy = false;
    let retryAt = 0;

    function resetScene() {
      currentScene++;
      previousStation = null;
      stationSettled = false;
      selectedArrow = null;
      setArrow(null);
      setStation(null);
    }

    function disableReader() {
      if (closed) return;
      failed = true;
      void worker?.terminate();
      setReaderUnavailable(true);
    }

    async function readLabels(width: number, height: number, boxes: ImageBox[], panels: SignPanel[], hasStationBadge: boolean) {
      busy = true;
      const scene = currentScene;
      const timer = window.setTimeout(disableReader, 22_000);
      try {
        snapshot.width = width;
        snapshot.height = height;
        snapshotContext!.drawImage(canvas, 0, 0);
        worker ??= await createSignReader(disableReader);
        if (closed || failed) {
          await worker.terminate();
          return;
        }
        const readings = [];
        for (const [index, box] of boxes.entries()) {
          if (closed || failed || scene !== currentScene) return;
          const kind = mode === "transfer" ? "label" : hasStationBadge && index === 0 ? "code" : "station";
          readings.push(await readSignRegion(worker, snapshot, box, kind));
        }
        if (closed || failed || scene !== currentScene) return;
        if (mode === "transfer") {
          selectedArrow = selectTransferArrow(panels, readings, line, directions);
        } else {
          const first = readings[0];
          const second = hasStationBadge ? readings[1] : null;
          const match = first && (!hasStationBadge || second)
            ? readPlatformSign(second ? first.text + "\n" + second.text : first.text,
              second ? Math.min(first.confidence, second.confidence) : first.confidence)
            : null;
          stationSettled = Boolean(match && match.code === previousStation?.code);
          setStation(stationSettled ? match : null);
          previousStation = match;
        }
      } catch {
        disableReader();
      } finally {
        window.clearTimeout(timer);
        retryAt = performance.now() + 950;
        busy = false;
      }
    }

    const interval = window.setInterval(() => {
      const source = video.current;
      const track = media.current?.getVideoTracks()[0];
      if (!track || track.muted || track.readyState !== "live" || !source || !source.videoWidth || source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        previousPanels = [];
        previousSignature = [];
        resetScene();
        return;
      }
      const scale = Math.min(1, (mode === "platform" ? 1600 : 1200) / Math.max(source.videoWidth, source.videoHeight));
      const width = Math.max(1, Math.round(source.videoWidth * scale));
      const height = Math.max(1, Math.round(source.videoHeight * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.drawImage(source, 0, 0, width, height);
      const frame = context.getImageData(0, 0, width, height);
      const panels = mode === "transfer" ? findTransferPanels(frame, line) : [];
      const guide = { x: Math.floor(width * 0.25), y: Math.floor(height * 0.38),
        width: Math.ceil(width * 0.5), height: Math.ceil(height * 0.3) };
      const stationRegions = mode === "platform" ? findPlatformSignRegions(frame, guide) : null;
      const boxes = mode === "transfer" ? panels.map(({ label }) => label)
        : stationRegions ? [stationRegions.code, stationRegions.name] : [guide];
      const signature = sampleSign(frame, boxes);
      const stable = samePanels(previousPanels, panels) && sameScene(previousSignature, signature);
      previousPanels = panels;
      if (!stable || boxes.length === 0) {
        previousSignature = signature;
        resetScene();
        return;
      }

      const visualArrow = panels.length === 1 && panels[0].line === line ? panels[0].arrow : null;
      const match = selectedArrow ?? visualArrow;
      const located = match && panels.find(({ arrow }) => arrow.direction === match.direction
        && Math.abs(arrow.x - match.x) < match.width * 0.6 && Math.abs(arrow.y - match.y) < match.height * 0.6)?.arrow;
      setArrow(located ? {
        direction: located.direction, x: located.x / width, y: located.y / height,
        width: located.width / width, height: located.height / height,
      } : null);
      if (!located) selectedArrow = null;
      if (!visualArrow && !selectedArrow && !stationSettled && boxes.length <= 4 && !busy && !failed && performance.now() >= retryAt) {
        void readLabels(width, height, boxes, panels, Boolean(stationRegions));
      }
    }, 310);

    return () => {
      closed = true;
      window.clearInterval(interval);
      void worker?.terminate();
    };
  }, [state, mode, line, directions]);

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
  const lineName = pickLocale(locale, `${line}号線`, `${line}호선`);
  const arrowCaption = arrow && {
    up: pickLocale(locale, "上向きの矢印を見つけました。行先も現地でご確認ください。", "위쪽 화살표를 찾았어요. 현장 표지에서 행선지도 확인해요."),
    left: pickLocale(locale, "左向きの矢印を見つけました。行先も現地でご確認ください。", "왼쪽 화살표를 찾았어요. 현장 표지에서 행선지도 확인해요."),
    right: pickLocale(locale, "右向きの矢印を見つけました。行先も現地でご確認ください。", "오른쪽 화살표를 찾았어요. 현장 표지에서 행선지도 확인해요."),
  }[arrow.direction];
  const stationLabel = station && pickLocale(locale, `${station.code} ${station.ja} · ${station.line}号線`, `${station.code} ${station.ko} · ${station.line}호선`);
  const expectedPlatform = platform && pickLocale(locale, `${platform.code} ${platform.ja} · ${platform.line}号線`, `${platform.code} ${platform.ko} · ${platform.line}호선`);
  const stationCaption = stationLabel && (platform?.code === station?.code
    ? pickLocale(locale, `乗り換え先の「${stationLabel}」の表示を確認しました。`, `갈아탈 승강장 ‘${stationLabel}’ 표기를 확인했어요.`)
    : expectedPlatform
      ? pickLocale(locale, `「${stationLabel}」と読み取りました。乗り換え先は「${expectedPlatform}」です。`, `‘${stationLabel}’ 표기를 읽었어요. 갈아탈 승강장은 ‘${expectedPlatform}’이에요.`)
      : pickLocale(locale, `「${stationLabel}」と読み取りました。行先も現地でご確認ください。`, `‘${stationLabel}’ 표기를 읽었어요. 현장 표지에서 행선지도 확인해요.`));

  function chooseMode(selected: Mode) {
    setMode(selected);
    setArrow(null);
    setStation(null);
    setReaderUnavailable(false);
  }

  return (
    <main id="main-content" className="mx-auto min-h-dvh max-w-xl px-4 pb-8 pt-5 sm:px-6">
      {/* Direct navigation loads the camera policy of the new document. */}
      <a href="/subway" className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--primary)] underline">
        {pickLocale(locale, "地下鉄案内に戻る", "지하철 안내로 돌아가기")}
      </a>
      <h1 className="mt-4 text-2xl font-black">{pickLocale(locale, "駅の案内表示をカメラで確認", "카메라로 역 표지 확인")}</h1>
      <div role="group" aria-label={pickLocale(locale, "読み取る表示", "확인할 표지")}
        className="mt-3 flex gap-2 rounded-xl bg-[var(--surface-muted)] p-1">
        <button type="button" onClick={() => chooseMode("transfer")} aria-pressed={mode === "transfer"}
          className="min-h-11 flex-1 rounded-lg px-2 text-sm font-bold aria-pressed:bg-white aria-pressed:text-[var(--primary)]">
          {pickLocale(locale, "乗り換え表示", "환승 표지")}
        </button>
        <button type="button" onClick={() => chooseMode("platform")} aria-pressed={mode === "platform"}
          className="min-h-11 flex-1 rounded-lg px-2 text-sm font-bold aria-pressed:bg-white aria-pressed:text-[var(--primary)]">
          {pickLocale(locale, "今いるホーム", "지금 있는 승강장")}
        </button>
      </div>
      <p className="mt-3 text-sm leading-6">
        {mode === "transfer"
          ? pickLocale(locale, `立ち止まって、${lineName}の番号と矢印を同じ画面に入れてください。`, `멈춰 서서 ${lineName} 번호와 화살표가 한 화면에 들어오게 비춰요.`)
          : pickLocale(locale, "立ち止まって、ホーム扉の上にある今の駅名と駅番号を枠に入れてください。", "멈춰 서서 스크린도어 위 현재 역의 이름과 번호를 테두리 안에 비춰요.")}
        {" "}{pickLocale(locale, "映像は端末の中で読み取ります。", "영상은 기기 안에서 읽어요.")}
      </p>
      {mode === "transfer" && next ? (
        <p className="mt-2 text-sm font-bold">
          {pickLocale(locale, `乗り換え後の次の停車駅は ${next.ja}（${next.code}）です。`, `환승 후 다음 정차역은 ${next.ko}(${next.code})예요.`)}
        </p>
      ) : null}
      <div hidden={!active} className="relative mt-4 overflow-hidden rounded-xl bg-[var(--foreground)]">
        <video ref={video} muted autoPlay playsInline className="block h-auto w-full" aria-hidden="true" />
        {arrow ? (
          <span aria-hidden="true" data-testid="transfer-arrow-overlay" className="pointer-events-none absolute rounded-md border-4 border-white shadow-[0_0_0_3px_var(--primary)]"
            style={{ left: `${arrow.x * 100}%`, top: `${arrow.y * 100}%`, width: `${arrow.width * 100}%`, height: `${arrow.height * 100}%` }} />
        ) : null}
        {mode === "platform" && state === "live" ? (
          <span aria-hidden="true" className="pointer-events-none absolute top-[38%] left-1/4 h-[30%] w-1/2 rounded-lg border-2 border-dashed border-white" />
        ) : null}
      </div>
      {state === "opening" ? <p role="status" className="mt-4 text-sm">{pickLocale(locale, "カメラを開いています…", "카메라를 여는 중이에요…")}</p> : null}
      {state === "live" ? <p role="status" className="mt-4 text-sm font-bold">{
        arrowCaption || stationCaption || (readerUnavailable
          ? pickLocale(locale, "文字を読み取れませんでした。カメラを開き直すか、現地の表示を確認してください。", "글자를 읽기 어려워요. 카메라를 다시 열거나 현장 표지를 확인해요.")
          : mode === "transfer"
            ? pickLocale(locale, "路線番号・行先と矢印が入るように映してください。", "호선·행선지와 화살표가 함께 보이게 비춰요.")
            : pickLocale(locale, "駅名と駅番号を枠の中央に合わせてください。", "역명과 역번호를 테두리 가운데에 맞춰요."))
      }</p> : null}
      {state === "unavailable" ? <p role="status" className="mt-4 text-sm">{pickLocale(locale, "カメラを開けませんでした。端末のカメラの権限を確認するか、地下鉄案内にお戻りください。", "카메라를 열 수 없어요. 기기의 카메라 권한을 확인하거나 지하철 안내로 돌아가요.")}</p> : null}
      <button type="button" onClick={active ? stop : openCamera}
        className="mt-4 min-h-11 rounded-xl bg-[var(--primary)] px-4 py-3 font-bold text-white">
        {active ? pickLocale(locale, "カメラを閉じる", "카메라 닫기") : pickLocale(locale, "カメラを開く", "카메라 열기")}
      </button>
    </main>
  );
}
