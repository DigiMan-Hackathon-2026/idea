"use client";

import { useSyncExternalStore } from "react";
import { DEMO_RUN_STORAGE_KEY } from "@/modules/progress/demo-run";

const CHANGE_EVENT = "digiman-demo-run-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot() {
  return localStorage.getItem(DEMO_RUN_STORAGE_KEY);
}

function getServerSnapshot() {
  return null;
}

export function useDemoRunStorage(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function saveDemoRunStorage(value: string) {
  localStorage.setItem(DEMO_RUN_STORAGE_KEY, value);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearDemoRunStorage() {
  localStorage.removeItem(DEMO_RUN_STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
