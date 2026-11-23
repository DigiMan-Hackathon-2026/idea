"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { seedState } from "../demo/seed";
import type { DemoState } from "./state";
import { createDemoStore, type DemoStore } from "./store";

// Server render and hydration both use the seed, then the client switches to localStorage.
const SERVER_STATE: DemoState = seedState();
const StoreContext = createContext<DemoStore | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [store] = useState<DemoStore | null>(() =>
    typeof window === "undefined" ? null : createDemoStore(window.localStorage),
  );
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

const noopSubscribe = () => () => {};

export function useDemoStore(): DemoStore | null {
  return useContext(StoreContext);
}

export function useDemoState(): DemoState {
  const store = useContext(StoreContext);
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    () => store?.getState() ?? SERVER_STATE,
    () => SERVER_STATE,
  );
}

// Dispatch for UI handlers. Throws if called before the client store exists (server render).
export function useDispatch(): DemoStore["dispatch"] {
  const store = useContext(StoreContext);
  return (action) => {
    if (!store) throw new Error("Demo store is not available during server render");
    return store.dispatch(action);
  };
}

export const newId = () => crypto.randomUUID().slice(0, 8);
export const nowIso = () => new Date().toISOString();
