import type { SeoulMetroElevator, SeoulMetroQuickExit } from "./seoul-metro";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function text(row: UnknownRecord, field: string): string | null {
  const value = row[field];
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function responseRows(payload: unknown): UnknownRecord[] {
  const root = asRecord(payload);
  const response = asRecord(root?.response) ?? root;
  const header = asRecord(response?.header);
  const resultCode = header ? text(header, "resultCode") : null;
  if (resultCode && resultCode !== "00" && resultCode !== "0000") {
    throw new Error("Seoul Metro provider returned an unsuccessful result");
  }

  const body = asRecord(response?.body);
  const itemsContainer = body?.items;
  const itemValue = asRecord(itemsContainer)?.item ?? itemsContainer;
  if (Array.isArray(itemValue)) {
    return itemValue.map(asRecord).filter((row): row is UnknownRecord => row !== null);
  }
  const item = asRecord(itemValue);
  return item ? [item] : [];
}

export function parseElevators(payload: unknown): SeoulMetroElevator[] {
  return responseRows(payload).map((row) => ({
    operatingStatus: text(row, "oprtngSitu"),
    facilityName: text(row, "fcltNm"),
    entranceNumber: text(row, "vcntEntrcNo"),
    detailPosition: text(row, "dtlPstn"),
    startFloor: text(row, "bgngFlr"),
    endFloor: text(row, "endFlr"),
    referenceDate: text(row, "crtrYmd"),
  }));
}

export function parseQuickExits(payload: unknown): SeoulMetroQuickExit[] {
  return responseRows(payload).map((row) => ({
    direction: text(row, "upbdnbSe"),
    nextStation: text(row, "drtnInfo"),
    carDoorNumber: text(row, "qckgffVhclDoorNo"),
    facility: text(row, "plfmCmgFac"),
    facilityPosition: text(row, "facPstnNm") ?? text(row, "fwkPstnNm"),
    referenceDate: text(row, "crtrYmd"),
  }));
}
