"use client";

import { useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import type { Worker } from "tesseract.js";
import { createSignReader, readSignRegion } from "@/modules/transit/sign-ocr.client";
import { comparePlatformDirection, readNextStation, readPlatformSign } from "@/modules/transit/station-sign";
import { findPlatformDirectionRegion, findPlatformSignRegions, findTransferPanels, type ImageBox, type SignPanel, type TransferArrow } from "@/modules/transit/transfer-arrow";
import { selectTransferArrow, type SignDirections } from "@/modules/transit/transfer-panel";
import type { SubwayStation } from "@/modules/transit/subway-network";

type State = "idle" | "opening" | "live" | "unavailable";
type Mode = "transfer" | "platform";
type PlatformReading = { station: SubwayStation; next: SubwayStation | null };

function normalizeArrow(arrow: TransferArrow, width: number, height: number): TransferArrow {
  return { direction: arrow.direction, x: arrow.x / width, y: arrow.y / height,
    width: arrow.width / width, height: arrow.height / height };
}

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

function sameScene(previous: number[], current: number[], tolerance = 12) {
  return previous.length === current.length && previous.reduce((total, value, index) =>
    total + Math.abs(value - current[index]), 0) <= current.length * tolerance;
}

type Props = {
  initialMode: Mode;
  line: SubwayStation["line"];
  platform: SubwayStation | null;
  next: SubwayStation | null;
  directions: SignDirections | null;
};

export function SubwaySignCamera({ initialMode, line, platform, next, directions }: Props) {
  const { locale } = useLocale();
  const [state, setState] = useState<State>("idle");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [arrow, setArrow] = useState<TransferArrow | null>(null);
  const [platformReading, setPlatformReading] = useState<PlatformReading | null>(null);
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
    setPlatformReading(null);
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
    let previousPlatform: PlatformReading | null = null;
    let selectedArrow: TransferArrow | null = null;
    let stationSettled = false;
    let busy = false;
    let retryAt = 0;

    function resetScene() {
      currentScene++;
      previousPlatform = null;
      stationSettled = false;
      selectedArrow = null;
      setArrow(null);
      setPlatformReading(null);
    }

    function disableReader() {
      if (closed) return;
      failed = true;
      void worker?.terminate();
      setReaderUnavailable(true);
    }

    async function readLabels(width: number, height: number, boxes: ImageBox[], panels: SignPanel[], hasStationBadge: boolean, platformDirection: ReturnType<typeof findPlatformDirectionRegion>) {
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
          const kind = mode === "transfer" ? "label" : hasStationBadge && index !== 1 ? "code" : "station";
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
          const direction = readings[2];
          const candidate = match && { station: match, next: direction && readNextStation(direction.text, direction.confidence, match.code) };
          stationSettled = Boolean(candidate && candidate.station.code === previousPlatform?.station.code
            && candidate.next?.code === previousPlatform?.next?.code);
          setPlatformReading(stationSettled ? candidate : null);
          const correct = candidate && comparePlatformDirection(candidate, platform, next) === "match";
          setArrow(stationSettled && correct && platformDirection ? normalizeArrow(platformDirection.arrow, width, height) : null);
          previousPlatform = candidate;
        }
      } catch {
        disableReader();
      } finally {
        window.clearTimeout(timer);
        retryAt = performance.now() + (stationSettled ? 2600 : 950);
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
      const platformDirection = stationRegions ? findPlatformDirectionRegion(frame, stationRegions.code, stationRegions.name) : null;
      const boxes = mode === "transfer" ? panels.map(({ label }) => label)
        : stationRegions ? [stationRegions.code, stationRegions.name] : [guide];
      if (platformDirection) boxes.push(platformDirection.code);
      const signature = sampleSign(frame, platformDirection ? [...boxes, platformDirection.arrow] : boxes);
      const stableCode = !platformDirection || sameScene(
        previousSignature.slice(-320, -160), signature.slice(-320, -160), 6,
      );
      const stable = samePanels(previousPanels, panels) && sameScene(previousSignature, signature) && stableCode;
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
      if (mode === "transfer") setArrow(located ? normalizeArrow(located, width, height) : null);
      if (!located) selectedArrow = null;
      if (!visualArrow && !selectedArrow && (!stationSettled || platformDirection) && boxes.length <= 4 && !busy && !failed && performance.now() >= retryAt) {
        void readLabels(width, height, boxes, panels, Boolean(stationRegions), platformDirection);
      }
    }, 310);

    return () => {
      closed = true;
      window.clearInterval(interval);
      void worker?.terminate();
    };
  }, [state, mode, line, directions, platform, next]);

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
  let stationCaption = "";
  if (platformReading) {
    const { station, next: observedNext } = platformReading;
    const stationLabel = pickLocale(locale, `${station.code} ${station.ja} · ${station.line}号線`, `${station.code} ${station.ko} · ${station.line}호선`);
    const expectedPlatform = platform && pickLocale(locale, `${platform.code} ${platform.ja}`, `${platform.code} ${platform.ko}`);
    const expectedNext = next && pickLocale(locale, `${next.ja}（${next.code}）`, `${next.ko}(${next.code})`);
    const postedNext = observedNext && pickLocale(locale, `${observedNext.ja}（${observedNext.code}）`, `${observedNext.ko}(${observedNext.code})`);
    switch (comparePlatformDirection(platformReading, platform, next)) {
      case "match":
        stationCaption = pickLocale(locale, `乗る方向は合っています。案内表示の次の駅は ${postedNext} です。乗る前に電車の行先も確認してください。`,
          `맞는 방향이에요. 표지판의 다음 역은 ${postedNext}예요. 타기 전에 열차 행선지도 확인해요.`);
        break;
      case "different":
        stationCaption = pickLocale(locale, `このホームは予定と違う方向です。表示は ${postedNext}、乗る方向の次の駅は ${expectedNext} です。`,
          `선택한 경로와 다른 방향이에요. 표지판은 ${postedNext}, 타야 할 방향의 다음 역은 ${expectedNext}예요.`);
        break;
      case "other-platform":
        stationCaption = pickLocale(locale, `「${stationLabel}」を読み取りました。乗り換え先の ${expectedPlatform} の表示を探してください。`,
          `‘${stationLabel}’ 표기를 읽었어요. 갈아탈 ${expectedPlatform} 승강장 표지를 찾아요.`);
        break;
      case "unconfirmed":
        stationCaption = pickLocale(locale, `「${stationLabel}」を読み取りました。方向を確かめるには、矢印とその先の駅番号も映してください。`,
          `‘${stationLabel}’ 표기를 읽었어요. 방향을 확인하려면 화살표와 화살표가 가리키는 역번호도 비춰요.`);
        break;
      case "no-route":
        stationCaption = pickLocale(locale, `「${stationLabel}」を読み取りました。乗る方向を確認するには地下鉄案内で経路を選んでください。`,
          `‘${stationLabel}’ 표기를 읽었어요. 방향을 비교하려면 지하철 안내에서 경로를 선택해요.`);
        break;
    }
  }

  function chooseMode(selected: Mode) {
    setMode(selected);
    setArrow(null);
    setPlatformReading(null);
    setReaderUnavailable(false);
  }

  return (
    <main id="main-content" className="mx-auto min-h-dvh max-w-xl px-4 pb-8 pt-5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        {/* Direct navigation loads the camera policy of the new document. */}
        <a href="/subway" className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--primary)] underline">
          {pickLocale(locale, "地下鉄案内に戻る", "지하철 안내로 돌아가기")}
        </a>
        <LanguageSwitcher />
      </div>
      <h1 className="mt-4 text-2xl font-black">{pickLocale(locale, "駅の案内表示をカメラで確認", "카메라로 역 표지 확인")}</h1>
      <div role="group" aria-label={pickLocale(locale, "読み取る表示", "확인할 표지")}
        className="mt-3 flex gap-2 rounded-xl bg-[var(--surface-muted)] p-1">
        <button type="button" onClick={() => chooseMode("transfer")} aria-pressed={mode === "transfer"}
          className="min-h-11 flex-1 rounded-lg px-2 text-sm font-bold aria-pressed:bg-white aria-pressed:text-[var(--primary)]">
          {pickLocale(locale, "乗り換え表示", "환승 표지")}
        </button>
        <button type="button" onClick={() => chooseMode("platform")} aria-pressed={mode === "platform"}
          className="min-h-11 flex-1 rounded-lg px-2 text-sm font-bold aria-pressed:bg-white aria-pressed:text-[var(--primary)]">
          {pickLocale(locale, "乗る方向", "승차 방향")}
        </button>
      </div>
      <p className="mt-3 text-sm leading-6">
        {mode === "transfer"
          ? pickLocale(locale, `立ち止まって、${lineName}の番号と矢印を同じ画面に入れてください。`, `멈춰 서서 ${lineName} 번호와 화살표가 한 화면에 들어오게 비춰요.`)
          : pickLocale(locale, "止まって、ホーム扉の上にある今の駅名を枠に入れてください。矢印とその先の駅番号も映します。", "멈춰 서서 스크린도어 위 현재 역명을 테두리 안에 맞춰요. 양옆의 화살표와 역번호도 함께 비춰요.")}
        {" "}{pickLocale(locale, "映像は端末の中で読み取ります。", "영상은 기기 안에서 읽어요.")}
      </p>
      {next ? (
        <p className="mt-2 text-sm font-bold">
          {pickLocale(locale, `経路の次の停車駅は ${next.ja}（${next.code}）です。`, `선택한 경로의 다음 역은 ${next.ko}(${next.code})예요.`)}
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
        (mode === "transfer" ? arrowCaption : stationCaption) || (readerUnavailable
          ? pickLocale(locale, "文字を読み取れませんでした。カメラを開き直すか、現地の表示を確認してください。", "글자를 읽기 어려워요. 카메라를 다시 열거나 현장 표지를 확인해요.")
          : mode === "transfer"
            ? pickLocale(locale, "路線番号・行先と矢印が入るように映してください。", "호선·행선지와 화살표가 함께 보이게 비춰요.")
            : pickLocale(locale, "今の駅名・矢印・その先の駅番号が見えるように映してください。", "현재 역명과 화살표, 화살표가 가리키는 역번호가 모두 보이게 비춰요."))
      }</p> : null}
      {state === "unavailable" ? <p role="status" className="mt-4 text-sm">{pickLocale(locale, "カメラを開けませんでした。端末のカメラの権限を確認するか、地下鉄案内にお戻りください。", "카메라를 열 수 없어요. 기기의 카메라 권한을 확인하거나 지하철 안내로 돌아가요.")}</p> : null}
      <button type="button" onClick={active ? stop : openCamera}
        className="mt-4 min-h-11 rounded-xl bg-[var(--primary)] px-4 py-3 font-bold text-white">
        {active ? pickLocale(locale, "カメラを閉じる", "카메라 닫기") : pickLocale(locale, "カメラを開く", "카메라 열기")}
      </button>
    </main>
  );
}
