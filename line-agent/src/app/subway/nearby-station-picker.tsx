"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import { findNearbyStations, type NearbyStation } from "@/modules/transit/nearby-stations";

type NearbySearch =
  | { status: "idle" | "loading" | "unavailable" | "inaccurate" }
  | { status: "ready"; stations: NearbyStation[] };

export function NearbyStationPicker({ onSelect }: { onSelect: (code: string) => void }) {
  const { locale } = useLocale();
  const [search, setSearch] = useState<NearbySearch>({ status: "idle" });

  function locate() {
    if (!navigator.geolocation) {
      setSearch({ status: "unavailable" });
      return;
    }
    setSearch({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const stations = findNearbyStations(coords);
        setSearch(stations ? { status: "ready", stations } : { status: "inaccurate" });
      },
      () => setSearch({ status: "unavailable" }),
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 30_000 },
    );
  }

  return (
    <div className="mt-3 max-w-xl">
      <p id="nearby-location-use" className="text-sm leading-6 text-[var(--foreground-muted)]">
        {pickLocale(locale, "近くの駅を探すため、この端末でだけ位置情報を使います。", "가까운 역을 찾을 때만 이 기기에서 위치 정보를 사용해요.")}
      </p>
      <button type="button" onClick={locate} disabled={search.status === "loading"} aria-describedby="nearby-location-use" className="seoul-button-primary mt-2 min-h-12 rounded-lg px-4 text-sm font-bold disabled:opacity-60">
        {search.status === "loading"
          ? pickLocale(locale, "現在地を確認中…", "현재 위치 확인 중…")
          : pickLocale(locale, "現在地から駅を探す", "현재 위치에서 역 찾기")}
      </button>
      <div aria-live="polite" className="text-sm leading-6">
        {search.status === "unavailable" ? (
          <p className="mt-2">{pickLocale(locale, "現在地を取得できませんでした。位置情報を許可してやり直すか、駅名で探せます。", "현재 위치를 확인하지 못했어요. 위치 권한을 허용해 다시 시도하거나 역 이름으로 찾을 수 있어요.")}</p>
        ) : null}
        {search.status === "inaccurate" ? (
          <p className="mt-2">{pickLocale(locale, "現在地が正確に分かりません。駅の表示にある名前や番号で探してください。", "현재 위치가 정확하지 않아요. 표지판에 나온 역 이름이나 번호로 찾아주세요.")}</p>
        ) : null}
        {search.status === "ready" && !search.stations.length ? (
          <p className="mt-2">{pickLocale(locale, "近くに1〜9号線の駅が見つかりませんでした。駅名で探せます。", "근처에서 1~9호선 역을 찾지 못했어요. 역 이름으로 찾아볼 수 있어요.")}</p>
        ) : null}
        {search.status === "ready" && search.stations.length ? (
          <>
            <p className="mt-3 font-bold">{pickLocale(locale, "駅名と路線を確かめて選んでください。距離は直線での目安です。", "역 이름과 호선을 확인하고 골라주세요. 거리는 직선거리예요.")}</p>
            <ul className="mt-2 grid gap-2">
              {search.stations.map(({ distance, lines }) => (
                <li key={lines[0].code} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2">
                  <p className="px-2 text-xs font-bold text-[var(--foreground-muted)]">
                    {pickLocale(locale, "約", "약 ")}{Math.round(distance / 10) * 10} m
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {lines.map((station) => (
                      <button key={station.code} type="button" onClick={() => { onSelect(station.code); setSearch({ status: "idle" }); }} className="min-h-11 rounded-lg border border-[var(--border)] bg-white px-3 text-start text-sm font-bold">
                        {pickLocale(locale, station.ja, station.ko)} · {pickLocale(locale, `${station.line}号線`, `${station.line}호선`)} {station.code}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
