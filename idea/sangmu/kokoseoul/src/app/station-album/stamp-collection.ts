"use client";

import { useSyncExternalStore } from "react";

const prefix = "digiman.station-stamp.v1:";
const changed = "digiman:station-stamps-changed";

function subscribe(listener: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key.startsWith(prefix)) listener();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(changed, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changed, listener);
  };
}

function readSnapshot() {
  try {
    const storage = window.localStorage;
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(prefix) && storage.getItem(key) === "1") keys.push(key.slice(prefix.length));
    }
    return JSON.stringify(keys.sort());
  } catch {
    return "unavailable";
  }
}

export function refreshStampCollection() {
  window.dispatchEvent(new Event(changed));
}

export function collectStationStamp(stationKey: string) {
  // Separate keys avoid overwriting other stations collected in another tab.
  window.localStorage.setItem(prefix + stationKey, "1");
  refreshStampCollection();
}

export function useStampCollection() {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => null);
  return {
    availability: snapshot === null ? "loading" : snapshot === "unavailable" ? "unavailable" : "ready",
    keys: new Set<string>(snapshot && snapshot !== "unavailable" ? JSON.parse(snapshot) as string[] : []),
  };
}
