"use client";

import { useSyncExternalStore } from "react";
import { offlineQuestsKey, parseOfflineQuests, type OfflineQuest } from "./offline-quests";

const changed = "yeogiseoul:offline-quests-changed";

function subscribe(listener: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === offlineQuestsKey || event.key === null) listener();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(changed, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changed, listener);
  };
}

/** The stored string, `""` when empty, or `null` where the offline screen cannot work. */
function readStored(): string | null {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return window.localStorage.getItem(offlineQuestsKey) ?? "";
  } catch {
    return null;
  }
}

let cachedRaw: string | null = null;
let cachedList: OfflineQuest[] = [];

function parseCached(raw: string): OfflineQuest[] {
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = parseOfflineQuests(raw);
  }
  return cachedList;
}

/**
 * Quests saved for the offline screen, newest first.
 * `null` on the server and where this browser cannot keep them, so callers render nothing.
 */
export function useOfflineQuests(): OfflineQuest[] | null {
  const raw = useSyncExternalStore(subscribe, readStored, () => null);
  return raw === null ? null : parseCached(raw);
}

/** Replaces the saved list; `false` when the browser refuses to store it. */
export function writeOfflineQuests(list: readonly OfflineQuest[]): boolean {
  try {
    if (list.length) window.localStorage.setItem(offlineQuestsKey, JSON.stringify(list));
    else window.localStorage.removeItem(offlineQuestsKey);
    window.dispatchEvent(new Event(changed));
    return true;
  } catch {
    return false;
  }
}
