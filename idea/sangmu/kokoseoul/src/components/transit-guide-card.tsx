"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import {
  buildNaverPublicTransitRouteIntentUrl,
  buildNaverPublicTransitRouteUrl,
  buildNaverWalkRouteIntentUrl,
  buildNaverWalkRouteUrl,
  detectNaverMapMobilePlatform,
} from "@/lib/naver-map";
import type { DemoQuest } from "@/modules/content/demo-quests";

export type WalkingRouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
};

export type TransitRouteStatus =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; route: WalkingRouteSummary };

const IOS_NAVER_MAP_STORE = "https://itunes.apple.com/app/id311867728?mt=8";

function useNaverMapPlatform() {
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

  return platform;
}

function openNaverMapRoute(routeUrl: string, intentUrl: string, platform: "android" | "ios") {
  if (platform === "android") {
    window.location.href = intentUrl;
    return;
  }

  const clickedAt = Date.now();
  window.location.href = routeUrl;
  window.setTimeout(() => {
    if (
      document.visibilityState === "visible" &&
      Date.now() - clickedAt < 2_000
    ) {
      window.location.href = IOS_NAVER_MAP_STORE;
    }
  }, 1_500);
}

function NaverTransitRouteActions({ quest }: { quest: DemoQuest }) {
  const { locale } = useLocale();
  const platform = useNaverMapPlatform();

  if (platform === "checking") {
    return <div className="mt-5 h-24 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />;
  }

  if (platform === "unsupported") {
    return (
      <p className="mt-5 border-t border-slate-900/10 pt-4 text-sm font-bold leading-6 text-slate-600">
        {pickLocale(
          locale,
          "スマートフォンでは、現在地からの公共交通と駅からの徒歩ルートをNAVERマップで確認できます。",
          "스마트폰에서는 현재 위치부터의 대중교통과 역에서부터의 도보 경로를 네이버 지도에서 확인할 수 있어요.",
        )}
      </p>
    );
  }

  const stationName = pickLocale(
    locale,
    `${quest.transitGuide.stationJa} ${quest.transitGuide.exitJa}`,
    `${quest.transitGuide.stationKo} ${quest.transitGuide.exitKo}`,
  );
  const appName = window.location.origin;
  const publicTransitParams = {
    destination: {
      ...quest.transitGuide.stationPoint,
      name: stationName,
    },
    appName,
  };
  const walkingParams = {
    start: {
      ...quest.transitGuide.stationPoint,
      name: stationName,
    },
    destination: {
      ...quest.mapPoint,
      name: pickLocale(locale, quest.titleJa, quest.titleKo),
    },
    appName,
  };

  return (
    <div className="mt-5 grid gap-3">
      <button
        type="button"
        onClick={() =>
          openNaverMapRoute(
            buildNaverPublicTransitRouteUrl(publicTransitParams),
            buildNaverPublicTransitRouteIntentUrl(publicTransitParams),
            platform,
          )
        }
        className="min-h-12 rounded-xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800"
      >
        {pickLocale(
          locale,
          "現在地から駅まで公共交通で行く",
          "현재 위치에서 역까지 대중교통 길찾기",
        )}
      </button>
      <button
        type="button"
        onClick={() =>
          openNaverMapRoute(
            buildNaverWalkRouteUrl(walkingParams),
            buildNaverWalkRouteIntentUrl(walkingParams),
            platform,
          )
        }
        className="min-h-12 rounded-xl border border-slate-900/15 bg-white px-4 text-sm font-black text-slate-800 hover:bg-slate-50"
      >
        {pickLocale(
          locale,
          "駅から目的地まで徒歩で行く",
          "역에서 목적지까지 도보 길찾기",
        )}
      </button>
      <p className="text-xs font-semibold leading-5 text-slate-500">
        {pickLocale(
          locale,
          "ココソウルは現在地を受け取りません。現在地とリアルタイム運行情報はNAVERマップで確認します。",
          "여기서울은 현재 위치를 받지 않아요. 현재 위치와 실시간 운행 정보는 네이버 지도에서 확인합니다.",
        )}
      </p>
    </div>
  );
}

export function TransitGuideCard({
  quest,
  routeState,
}: {
  quest: DemoQuest;
  routeState: TransitRouteStatus;
}) {
  const { locale } = useLocale();
  const walkingSummary =
    routeState.status === "ready"
      ? pickLocale(
          locale,
          `徒歩約${Math.max(1, Math.ceil(routeState.route.durationSeconds / 60))}分 · ${routeState.route.distanceMeters}m`,
          `도보 약 ${Math.max(1, Math.ceil(routeState.route.durationSeconds / 60))}분 · ${routeState.route.distanceMeters}m`,
        )
      : routeState.status === "loading" || routeState.status === "idle"
        ? pickLocale(locale, "実際の徒歩ルートを確認中…", "실제 도보 경로 확인 중…")
        : pickLocale(locale, "徒歩ルートはNAVERマップで確認できます", "도보 경로는 네이버 지도에서 확인할 수 있어요");

  return (
    <section className="rounded-xl border border-slate-900/10 bg-slate-50 p-4" data-testid="transit-guide" aria-labelledby={`transit-${quest.id}`}>
      <p className="text-xs font-black tracking-[0.14em] text-[#087735]">
        {pickLocale(locale, "地下鉄＋徒歩", "지하철+도보")}
      </p>
      <h3 id={`transit-${quest.id}`} className="mt-2 text-xl font-black leading-7 text-slate-950">
        {pickLocale(locale, "迷わないための行き方", "헤매지 않는 이동 안내")}
      </h3>

      <ol className="relative mt-5 grid gap-2 before:absolute before:bottom-7 before:left-[1.15rem] before:top-7 before:w-px before:bg-slate-300">
        <li className="relative grid grid-cols-[2.4rem_1fr] gap-3 p-2">
          <span className="z-10 grid size-9 place-items-center rounded-full border-2 border-[#00a84d] bg-white text-sm font-black text-[#087735]" aria-hidden="true">1</span>
          <div>
            <p className="text-sm font-black text-slate-950">{pickLocale(locale, "現在地から出発", "현재 위치에서 출발")}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{pickLocale(locale, "乗車駅・乗換・所要時間はNAVERマップで確認", "승차역·환승·소요 시간은 네이버 지도에서 확인")}</p>
          </div>
        </li>
        <li className="relative grid grid-cols-[2.4rem_1fr] gap-3 border-y border-slate-900/8 bg-white p-2 py-3">
          <span className="z-10 grid size-9 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: quest.transitGuide.lineColor }} aria-hidden="true">{quest.transitGuide.lineCode}</span>
          <div>
            <p className="text-sm font-black text-slate-950">
              {pickLocale(locale, quest.transitGuide.lineJa, quest.transitGuide.lineKo)} · {pickLocale(locale, quest.transitGuide.stationJa, quest.transitGuide.stationKo)}
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{pickLocale(locale, quest.transitGuide.directionJa, quest.transitGuide.directionKo)}</p>
          </div>
        </li>
        <li className="relative grid grid-cols-[2.4rem_1fr] gap-3 p-2">
          <span className="z-10 grid size-9 place-items-center rounded-full bg-[#ff5a36] text-sm font-black text-white" aria-hidden="true">3</span>
          <div>
            <p className="text-sm font-black text-slate-950">
              {pickLocale(locale, quest.transitGuide.exitJa, quest.transitGuide.exitKo)} · {walkingSummary}
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{pickLocale(locale, quest.transitGuide.arrivalTipJa, quest.transitGuide.arrivalTipKo)}</p>
          </div>
        </li>
      </ol>

      <NaverTransitRouteActions quest={quest} />
    </section>
  );
}

export function QuestTransitGuide({ quest }: { quest: DemoQuest }) {
  const [routeState, setRouteState] = useState<TransitRouteStatus>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetch("/api/v1/routes/walking", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questId: quest.id }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("route unavailable");
        return (await response.json()) as { route?: WalkingRouteSummary };
      })
      .then(({ route }) => {
        if (!active || !route) throw new Error("route unavailable");
        setRouteState({ status: "ready", route });
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setRouteState({ status: "error" });
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [quest.id]);

  return <TransitGuideCard quest={quest} routeState={routeState} />;
}
