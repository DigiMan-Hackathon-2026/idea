import "server-only";

import { getSeoulMetroServiceKey } from "@/server/config/seoul-metro";
import type {
  SeoulMetroStationSnapshot,
} from "./seoul-metro";
import { parseElevators, parseQuickExits } from "./seoul-metro-parser";

const API_ORIGIN = "https://apis.data.go.kr";
const REQUEST_TIMEOUT_MS = 5_000;
const REVALIDATE_SECONDS = 300;

async function requestRows<T>(
  path: string,
  serviceKey: string,
  parser: (payload: unknown) => T[],
): Promise<{ items: T[]; checkedAt: string | null }> {
  const url = new URL(path, API_ORIGIN);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("lineNm", "2호선");
  url.searchParams.set("stnCd", "0211");
  url.searchParams.set("stnNm", "성수");

  const response = await fetch(url, {
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("Seoul Metro provider request failed");
  return {
    items: parser(await response.json()),
    checkedAt: response.headers.get("date"),
  };
}

export async function getSeongsuStationSnapshot(): Promise<SeoulMetroStationSnapshot> {
  const serviceKey = getSeoulMetroServiceKey();
  if (!serviceKey) {
    return {
      status: "not_configured",
      checkedAt: null,
      elevatorAvailable: false,
      quickExitAvailable: false,
      elevators: [],
      quickExits: [],
    };
  }

  const [elevatorResult, quickExitResult] = await Promise.allSettled([
    requestRows("/B553766/wksn/getWksnElvtr", serviceKey, parseElevators),
    requestRows("/B553766/inout/getFstExit", serviceKey, parseQuickExits),
  ]);
  const elevatorAvailable = elevatorResult.status === "fulfilled";
  const quickExitAvailable = quickExitResult.status === "fulfilled";
  const status = elevatorAvailable && quickExitAvailable
    ? "ready"
    : elevatorAvailable || quickExitAvailable
      ? "partial"
      : "unavailable";

  return {
    status,
    checkedAt: quickExitAvailable
      ? quickExitResult.value.checkedAt
      : elevatorAvailable
        ? elevatorResult.value.checkedAt
        : null,
    elevatorAvailable,
    quickExitAvailable,
    elevators: elevatorAvailable ? elevatorResult.value.items : [],
    quickExits: quickExitAvailable ? quickExitResult.value.items : [],
  };
}
