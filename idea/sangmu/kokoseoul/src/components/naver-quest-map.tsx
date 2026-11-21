"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import {
  buildNaverMapScriptUrl,
  buildNaverWalkRouteIntentUrl,
  buildNaverWalkRouteUrl,
  detectNaverMapMobilePlatform,
  SEOUL_MAP_BOUNDS,
} from "@/lib/naver-map";
import {
  formatWonRange,
  getAreaLabel,
  type DemoQuest,
} from "@/modules/content/demo-quests";

type NaverMapInstance = { fitBounds(bounds: unknown, padding?: number): void };
type NaverMarkerInstance = { setMap(map: null): void };

type NaverMapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => NaverMapInstance;
  Marker: new (options: Record<string, unknown>) => NaverMarkerInstance;
  LatLng: new (latitude: number, longitude: number) => unknown;
  LatLngBounds: new (
    southWest?: unknown,
    northEast?: unknown,
  ) => { extend(point: unknown): void };
  Point: new (x: number, y: number) => unknown;
  Event: {
    addListener(target: unknown, event: string, listener: () => void): void;
  };
};

declare global {
  interface Window {
    naver?: { maps: NaverMapsApi };
    navermap_authFailure?: () => void;
  }
}

type LoadState = "idle" | "loading" | "ready" | "error";

function NaverWalkRouteAction({ quest }: { quest: DemoQuest }) {
  const { locale } = useLocale();
  const [platform, setPlatform] = useState<
    ReturnType<typeof detectNaverMapMobilePlatform> | "checking"
  >("checking");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPlatform(
        detectNaverMapMobilePlatform(
          window.navigator.userAgent,
          window.navigator.maxTouchPoints,
        ),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  if (platform === "checking") return null;

  if (platform === "unsupported") {
    return (
      <p className="mt-4 text-xs font-bold leading-5 text-slate-500">
        {pickLocale(
          locale,
          "スマートフォンで開くと、NAVERマップアプリに移動できます。",
          "스마트폰에서 열면 네이버 지도 앱으로 이동할 수 있어요.",
        )}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        const params = {
          start: {
            ...quest.transitGuide.stationPoint,
            name: pickLocale(
              locale,
              `${quest.transitGuide.stationJa} ${quest.transitGuide.exitJa}`,
              `${quest.transitGuide.stationKo} ${quest.transitGuide.exitKo}`,
            ),
          },
          destination: {
            ...quest.mapPoint,
            name: pickLocale(locale, quest.titleJa, quest.titleKo),
          },
          appName: window.location.href,
        };

        if (platform === "android") {
          window.location.href = buildNaverWalkRouteIntentUrl(params);
          return;
        }

        const clickedAt = Date.now();
        window.location.href = buildNaverWalkRouteUrl(params);
        window.setTimeout(() => {
          if (
            document.visibilityState === "visible" &&
            Date.now() - clickedAt < 2_000
          ) {
            window.location.href =
              "https://itunes.apple.com/app/id311867728?mt=8";
          }
        }, 1_500);
      }}
      className="mt-4 min-h-11 w-full rounded-full border border-[#00a84d]/25 bg-white px-4 text-sm font-black text-[#087735]"
    >
      {pickLocale(
        locale,
        "NAVERマップで徒歩ルートを見る",
        "네이버 지도에서 도보 길찾기",
      )}
    </button>
  );
}

export function NaverQuestMap({
  quests,
  keyId,
  onShowList,
}: {
  quests: DemoQuest[];
  keyId: string | null;
  onShowList: () => void;
}) {
  const { locale } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadState, setLoadState] = useState<LoadState>(keyId ? "idle" : "error");
  const [selectedQuest, setSelectedQuest] = useState(quests[0] ?? null);

  useEffect(() => {
    if (!keyId || !containerRef.current || quests.length === 0) return;

    let cancelled = false;
    let markers: NaverMarkerInstance[] = [];
    const existingScript = document.querySelector<HTMLScriptElement>(
      "script[data-digiman-naver-map]",
    );
    existingScript?.remove();
    delete window.naver;
    setLoadState("loading");

    const script = document.createElement("script");
    script.src = buildNaverMapScriptUrl(keyId, locale);
    script.async = true;
    script.dataset.digimanNaverMap = locale;
    script.referrerPolicy = "origin";

    const fail = () => {
      if (!cancelled) setLoadState("error");
    };
    window.navermap_authFailure = fail;

    script.addEventListener("error", fail);
    script.addEventListener("load", () => {
      if (cancelled || !containerRef.current || !window.naver?.maps) {
        fail();
        return;
      }

      const { maps } = window.naver;
      const firstPoint = quests[0].mapPoint;
      const seoulBounds = new maps.LatLngBounds(
        new maps.LatLng(SEOUL_MAP_BOUNDS.south, SEOUL_MAP_BOUNDS.west),
        new maps.LatLng(SEOUL_MAP_BOUNDS.north, SEOUL_MAP_BOUNDS.east),
      );
      const map = new maps.Map(containerRef.current, {
        center: new maps.LatLng(firstPoint.latitude, firstPoint.longitude),
        zoom: 15,
        minZoom: 11,
        maxBounds: seoulBounds,
        zoomControl: true,
        zoomControlOptions: { position: 3 },
      });
      const bounds = new maps.LatLngBounds();

      markers = quests.flatMap((quest, index) => {
        const position = new maps.LatLng(
          quest.mapPoint.latitude,
          quest.mapPoint.longitude,
        );
        bounds.extend(position);
        const marker = new maps.Marker({
          map,
          position,
          title: pickLocale(locale, quest.titleJa, quest.titleKo),
          icon: {
            content: `<button type="button" aria-label="${index + 1}" style="display:grid;place-items:center;width:38px;height:38px;border:3px solid white;border-radius:999px;background:#ff5a36;color:white;font:900 14px system-ui;box-shadow:0 8px 20px rgba(15,23,42,.24)">${index + 1}</button>`,
            anchor: new maps.Point(19, 19),
          },
        });
        maps.Event.addListener(marker, "click", () => setSelectedQuest(quest));

        const stationPosition = new maps.LatLng(
          quest.transitGuide.stationPoint.latitude,
          quest.transitGuide.stationPoint.longitude,
        );
        bounds.extend(stationPosition);
        const stationMarker = new maps.Marker({
          map,
          position: stationPosition,
          title: pickLocale(
            locale,
            `${quest.transitGuide.stationJa} ${quest.transitGuide.exitJa}`,
            `${quest.transitGuide.stationKo} ${quest.transitGuide.exitKo}`,
          ),
          icon: {
            content: `<div style="display:grid;grid-template-columns:28px auto;align-items:center;gap:7px;padding:5px 10px 5px 5px;border:3px solid white;border-radius:999px;background:#fff;color:#152238;font:800 12px system-ui;white-space:nowrap;box-shadow:0 8px 20px rgba(15,23,42,.2)"><span style="display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:#00a84d;color:white;font-size:14px">2</span>${pickLocale(locale, quest.transitGuide.stationJa, quest.transitGuide.stationKo)}</div>`,
            anchor: new maps.Point(19, 19),
          },
        });

        return [marker, stationMarker];
      });

      map.fitBounds(bounds, 56);
      setLoadState("ready");
    });

    document.head.appendChild(script);

    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.setMap(null));
      script.remove();
      if (window.navermap_authFailure === fail) delete window.navermap_authFailure;
    };
  }, [keyId, locale, quests]);

  if (!keyId || loadState === "error") {
    return (
      <section className="mt-6 max-w-2xl rounded-[2rem] border border-slate-900/10 bg-white p-7 text-center shadow-sm" role="status">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#fff0eb] text-2xl" aria-hidden="true">⌖</span>
        <h2 className="mt-4 text-xl font-black text-slate-950">
          {pickLocale(locale, "地図を読み込めませんでした", "지도를 불러오지 못했어요")}
        </h2>
        <p className="mx-auto mt-2 max-w-md leading-7 text-slate-600">
          {pickLocale(locale, "リストからクエストを選べます。現在地の共有は必要ありません。", "목록에서 퀘스트를 고를 수 있어요. 현재 위치를 공유하지 않아도 됩니다.")}
        </p>
        <button type="button" onClick={onShowList} className="mt-5 min-h-12 rounded-full bg-slate-950 px-6 text-sm font-black text-white">
          {pickLocale(locale, "リストに戻る", "목록으로 돌아가기")}
        </button>
      </section>
    );
  }

  return (
    <section className="mt-6 grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-label={pickLocale(locale, "クエスト地図", "퀘스트 지도")}>
      <div className="relative min-h-[28rem] overflow-hidden rounded-[2rem] border border-slate-900/10 bg-[#dcece7] shadow-sm">
        <div className="absolute inset-0">
          <div ref={containerRef} className="h-full w-full" data-testid="naver-map" />
        </div>
        {loadState !== "ready" ? (
          <div className="absolute inset-0 grid place-items-center bg-[#eef5f2]" role="status">
            <p className="rounded-full bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm">
              {pickLocale(locale, "地図を読み込んでいます…", "지도를 불러오고 있어요…")}
            </p>
          </div>
        ) : null}
      </div>

      {selectedQuest ? (
        <article className="self-start rounded-[2rem] border border-slate-900/8 bg-white p-6 shadow-sm">
          <p className="text-xs font-black tracking-[0.12em] text-[#c93418]">
            {getAreaLabel(selectedQuest.areaCode, locale).toUpperCase()}
          </p>
          <h2 className="mt-2 text-xl font-black leading-snug tracking-tight text-slate-950">
            {pickLocale(locale, selectedQuest.titleJa, selectedQuest.titleKo)}
          </h2>
          <p className="mt-3 text-sm font-bold text-slate-500">
            {pickLocale(locale, `${selectedQuest.durationMinutes}分`, `${selectedQuest.durationMinutes}분`)} · {formatWonRange(selectedQuest, locale)}
          </p>
          <p className="mt-4 leading-7 text-slate-600">
            {pickLocale(locale, selectedQuest.summaryJa, selectedQuest.summaryKo)}
          </p>
          <div className="mt-5 rounded-2xl bg-[#eef8f2] p-4" data-testid="transit-guide">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#00a84d] text-sm font-black text-white" aria-hidden="true">
                2
              </span>
              <div>
                <p className="text-sm font-black text-slate-950">
                  {pickLocale(locale, selectedQuest.transitGuide.lineJa, selectedQuest.transitGuide.lineKo)} · {pickLocale(locale, selectedQuest.transitGuide.stationJa, selectedQuest.transitGuide.stationKo)} {pickLocale(locale, selectedQuest.transitGuide.exitJa, selectedQuest.transitGuide.exitKo)}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-600">
                  {pickLocale(locale, "正確な徒歩ルートはNAVERマップで確認できます。", "정확한 도보 경로는 네이버 지도에서 확인할 수 있어요.")}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
              {pickLocale(locale, "実際のルート検索はNAVERマップが提供します。", "실제 길찾기는 네이버 지도에서 제공합니다.")}
            </p>
            <NaverWalkRouteAction quest={selectedQuest} />
          </div>
          <Link href={`/quests/${selectedQuest.id}`} className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-[#ff5a36] px-5 text-sm font-black text-white">
            {pickLocale(locale, "詳細を見る", "자세히 보기")}
          </Link>
        </article>
      ) : null}
    </section>
  );
}
