"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { TransitGuideCard, type TransitRouteStatus } from "@/components/transit-guide-card";
import { pickLocale } from "@/lib/locale";
import {
  buildNaverMapScriptUrl,
  isPointWithinSeoulMapBounds,
  SEOUL_MAP_BOUNDS,
} from "@/lib/naver-map";
import {
  formatWonRange,
  getAreaLabel,
  type DemoQuest,
} from "@/modules/content/demo-quests";

type NaverMapInstance = {
  destroy(): void;
  fitBounds(bounds: unknown, padding?: number): void;
  panTo(position: unknown): void;
};
type NaverMarkerInstance = {
  setMap(map: NaverMapInstance | null): void;
  setPosition(position: unknown): void;
};
type NaverPolylineInstance = { setMap(map: NaverMapInstance | null): void };
type NaverCircleInstance = {
  setCenter(position: unknown): void;
  setMap(map: NaverMapInstance | null): void;
  setRadius(radius: number): void;
};

type NaverMapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => NaverMapInstance;
  Marker: new (options: Record<string, unknown>) => NaverMarkerInstance;
  Polyline: new (options: Record<string, unknown>) => NaverPolylineInstance;
  Circle: new (options: Record<string, unknown>) => NaverCircleInstance;
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
type WalkingRoute = {
  distanceMeters: number;
  durationSeconds: number;
  path: Array<{ latitude: number; longitude: number }>;
};
type RouteState =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; route: WalkingRoute };
type UserLocationState =
  | "idle"
  | "locating"
  | "ready"
  | "denied"
  | "unavailable"
  | "outside-seoul";

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
  const mapRef = useRef<NaverMapInstance | null>(null);
  const routeLineRef = useRef<NaverPolylineInstance | null>(null);
  const userLocationMarkerRef = useRef<NaverMarkerInstance | null>(null);
  const userLocationCircleRef = useRef<NaverCircleInstance | null>(null);
  const latestPositionRef = useRef<GeolocationPosition | null>(null);
  const locationWatchIdRef = useRef<number | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(keyId ? "idle" : "error");
  const [selectedQuest, setSelectedQuest] = useState(quests[0] ?? null);
  const [routeState, setRouteState] = useState<RouteState>({ status: "idle" });
  const [userLocationState, setUserLocationState] =
    useState<UserLocationState>("idle");

  const renderUserLocation = useCallback(
    (position: GeolocationPosition, recenter: boolean) => {
      if (!mapRef.current || !window.naver?.maps) return;

      const { maps } = window.naver;
      const point = new maps.LatLng(
        position.coords.latitude,
        position.coords.longitude,
      );
      const accuracy = Math.max(position.coords.accuracy, 8);

      if (userLocationCircleRef.current) {
        userLocationCircleRef.current.setCenter(point);
        userLocationCircleRef.current.setRadius(accuracy);
        userLocationCircleRef.current.setMap(mapRef.current);
      } else {
        userLocationCircleRef.current = new maps.Circle({
          map: mapRef.current,
          center: point,
          radius: accuracy,
          strokeColor: "#6789ca",
          strokeOpacity: 0.35,
          strokeWeight: 1,
          fillColor: "#6789ca",
          fillOpacity: 0.14,
        });
      }

      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setPosition(point);
        userLocationMarkerRef.current.setMap(mapRef.current);
      } else {
        userLocationMarkerRef.current = new maps.Marker({
          map: mapRef.current,
          position: point,
          title: pickLocale(locale, "現在地", "현재 위치"),
          icon: {
            content:
              '<div data-testid="current-location-marker" style="width:22px;height:22px;border:4px solid white;border-radius:999px;background:#6789ca;box-shadow:0 2px 8px rgba(15,23,42,.35)" aria-hidden="true"></div>',
            anchor: new maps.Point(11, 11),
          },
        });
      }

      if (recenter) mapRef.current.panTo(point);
    },
    [locale],
  );

  const showCurrentLocation = useCallback(() => {
    if (latestPositionRef.current && userLocationState === "ready") {
      renderUserLocation(latestPositionRef.current, true);
      return;
    }
    if (!navigator.geolocation) {
      setUserLocationState("unavailable");
      return;
    }

    setUserLocationState("locating");
    if (locationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
    }
    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (!isPointWithinSeoulMapBounds(latitude, longitude)) {
          latestPositionRef.current = null;
          setUserLocationState("outside-seoul");
          if (locationWatchIdRef.current !== null) {
            navigator.geolocation.clearWatch(locationWatchIdRef.current);
            locationWatchIdRef.current = null;
          }
          return;
        }
        const firstLocation = latestPositionRef.current === null;
        latestPositionRef.current = position;
        renderUserLocation(position, firstLocation);
        setUserLocationState("ready");
      },
      (error) => {
        if (latestPositionRef.current) return;
        setUserLocationState(
          error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        );
        locationWatchIdRef.current = null;
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    );
  }, [renderUserLocation, userLocationState]);

  useEffect(
    () => () => {
      if (locationWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!keyId || !containerRef.current || quests.length === 0) return;

    let cancelled = false;
    let map: NaverMapInstance | null = null;
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
      map = new maps.Map(containerRef.current, {
        center: new maps.LatLng(firstPoint.latitude, firstPoint.longitude),
        zoom: 15,
        minZoom: 11,
        maxBounds: seoulBounds,
        zoomControl: true,
        zoomControlOptions: { position: 3 },
      });
      mapRef.current = map;
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
            content: `<button type="button" aria-label="${index + 1}" style="display:grid;place-items:center;width:38px;height:38px;border:3px solid white;border-radius:999px;background:#941e34;color:white;font:900 14px system-ui;box-shadow:0 8px 20px rgba(15,23,42,.24)">${index + 1}</button>`,
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
            content: `<div style="display:grid;grid-template-columns:28px auto;align-items:center;gap:7px;padding:5px 10px 5px 5px;border:3px solid white;border-radius:999px;background:#fff;color:#504e49;font:800 12px system-ui;white-space:nowrap;box-shadow:0 8px 20px rgba(15,23,42,.2)"><span style="display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:${quest.transitGuide.lineColor};color:white;font-size:14px">${quest.transitGuide.lineCode}</span>${pickLocale(locale, quest.transitGuide.stationJa, quest.transitGuide.stationKo)}</div>`,
            anchor: new maps.Point(19, 19),
          },
        });

        return [marker, stationMarker];
      });

      map.fitBounds(bounds, 56);
      if (latestPositionRef.current) {
        renderUserLocation(latestPositionRef.current, false);
      }
      setLoadState("ready");
    });

    document.head.appendChild(script);

    return () => {
      cancelled = true;
      routeLineRef.current?.setMap(null);
      routeLineRef.current = null;
      userLocationMarkerRef.current?.setMap(null);
      userLocationMarkerRef.current = null;
      userLocationCircleRef.current?.setMap(null);
      userLocationCircleRef.current = null;
      markers.forEach((marker) => marker.setMap(null));
      map?.destroy();
      mapRef.current = null;
      script.remove();
      if (window.navermap_authFailure === fail) delete window.navermap_authFailure;
    };
  }, [keyId, locale, quests, renderUserLocation]);

  useEffect(() => {
    if (
      loadState !== "ready" ||
      !selectedQuest ||
      !mapRef.current ||
      !window.naver?.maps
    ) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    routeLineRef.current?.setMap(null);
    routeLineRef.current = null;
    setRouteState({ status: "loading" });

    void fetch("/api/v1/routes/walking", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questId: selectedQuest.id }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("route unavailable");
        return (await response.json()) as { route?: WalkingRoute };
      })
      .then(({ route }) => {
        if (!active || !route || route.path.length < 2 || !mapRef.current) {
          throw new Error("route unavailable");
        }
        const { maps } = window.naver!;
        const path = route.path.map(
          (point) => new maps.LatLng(point.latitude, point.longitude),
        );
        routeLineRef.current = new maps.Polyline({
          map: mapRef.current,
          path,
          strokeColor: "#941e34",
          strokeOpacity: 0.92,
          strokeWeight: 6,
          strokeLineCap: "round",
          strokeLineJoin: "round",
        });
        const bounds = new maps.LatLngBounds();
        path.forEach((point) => bounds.extend(point));
        mapRef.current.fitBounds(bounds, 64);
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
      routeLineRef.current?.setMap(null);
      routeLineRef.current = null;
    };
  }, [loadState, selectedQuest]);

  if (!keyId || loadState === "error") {
    return (
      <section className="mt-6 max-w-2xl rounded-xl border border-slate-900/10 bg-white p-7 text-center shadow-sm" role="status">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#f7ecee] text-2xl" aria-hidden="true">⌖</span>
        <h2 className="mt-4 text-xl font-black text-[#504e49]">
          {pickLocale(locale, "地図を読み込めませんでした", "지도를 불러오지 못했어요")}
        </h2>
        <p className="mx-auto mt-2 max-w-md leading-7 text-slate-600">
          {pickLocale(locale, "リストからクエストを選べます。現在地の共有は必要ありません。", "목록에서 퀘스트를 고를 수 있어요. 현재 위치를 공유하지 않아도 됩니다.")}
        </p>
        <button type="button" onClick={onShowList} className="mt-5 min-h-12 rounded-full bg-[#504e49] px-6 text-sm font-black text-white">
          {pickLocale(locale, "リストに戻る", "목록으로 돌아가기")}
        </button>
      </section>
    );
  }

  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-label={pickLocale(locale, "クエスト地図", "퀘스트 지도")}>
      <div className="seoul-surface relative min-h-[26rem] overflow-hidden rounded-xl lg:min-h-[32rem]">
        <div className="absolute inset-0">
          <div ref={containerRef} className="h-full w-full" data-testid="naver-map" />
        </div>
        {loadState !== "ready" ? (
          <div className="absolute inset-0 grid place-items-center bg-[#edf1ef]" role="status">
            <p className="rounded-xl border border-slate-900/10 bg-white px-4 py-3 text-sm font-black text-slate-700">
              {pickLocale(locale, "地図を読み込んでいます…", "지도를 불러오고 있어요…")}
            </p>
          </div>
        ) : null}
        {loadState === "ready" ? (
          <div className="absolute left-4 top-4 z-10 max-w-[calc(100%-5rem)]">
            <button
              type="button"
              onClick={showCurrentLocation}
              disabled={userLocationState === "locating"}
              className="flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-slate-900/15 bg-white px-3.5 text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:text-slate-500"
            >
              <span className="grid size-6 shrink-0 place-items-center text-[#6789ca]" aria-hidden="true">
                {userLocationState === "locating" ? "…" : "⌖"}
              </span>
              <span className="truncate">
                {userLocationState === "locating"
                  ? pickLocale(locale, "現在地を確認中…", "내 위치 확인 중…")
                  : userLocationState === "ready"
                    ? pickLocale(locale, "現在地に戻る", "내 위치로 돌아가기")
                    : pickLocale(locale, "地図で現在地を表示", "지도에서 내 위치 보기")}
              </span>
            </button>
            <p
              className={`mt-2 rounded-xl border border-slate-900/10 bg-white/95 px-3 py-2 text-xs font-bold leading-5 text-slate-600 ${userLocationState === "idle" || userLocationState === "locating" ? "sr-only" : ""}`}
              data-testid="user-location-status"
              role="status"
            >
              {userLocationState === "ready"
                ? pickLocale(locale, "位置情報はこの地図にだけ表示され、保存されません。", "위치는 이 지도에만 표시되고 저장되지 않아요.")
                : userLocationState === "denied"
                  ? pickLocale(locale, "位置情報の許可後、もう一度お試しください。クエストは位置情報なしでも選べます。", "위치 권한을 허용한 뒤 다시 시도해 주세요. 위치 없이도 퀘스트를 고를 수 있어요.")
                  : userLocationState === "outside-seoul"
                    ? pickLocale(locale, "現在地がソウルの外にあるため、この地図には表示できません。", "현재 위치가 서울 밖이라 이 지도에는 표시할 수 없어요.")
                    : pickLocale(locale, "現在地を確認できませんでした。端末の位置情報を確認して、もう一度お試しください。", "현재 위치를 확인하지 못했어요. 기기의 위치 설정을 확인하고 다시 시도해 주세요.")}
            </p>
          </div>
        ) : null}
      </div>

      {selectedQuest ? (
        <article className="seoul-surface self-start rounded-xl p-5">
          <p className="text-xs font-black tracking-[0.12em] text-[#941e34]">
            {getAreaLabel(selectedQuest.areaCode, locale).toUpperCase()}
          </p>
          <h2 className="mt-2 text-xl font-black leading-snug tracking-tight text-[#504e49]">
            {pickLocale(locale, selectedQuest.titleJa, selectedQuest.titleKo)}
          </h2>
          <p className="mt-3 text-sm font-bold text-slate-500">
            {pickLocale(locale, `${selectedQuest.durationMinutes}分`, `${selectedQuest.durationMinutes}분`)} · {formatWonRange(selectedQuest, locale)}
          </p>
          <p className="mt-4 leading-7 text-slate-600">
            {pickLocale(locale, selectedQuest.summaryJa, selectedQuest.summaryKo)}
          </p>
          <div className="mt-5">
            <TransitGuideCard quest={selectedQuest} routeState={routeState as TransitRouteStatus} />
          </div>
          <Link href={`/quests/${selectedQuest.id}`} className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-[#504e49] px-5 text-sm font-black text-white hover:bg-[#594743]">
            {pickLocale(locale, "詳細を見る", "자세히 보기")}
          </Link>
        </article>
      ) : null}
    </section>
  );
}
