import { seedState } from "../demo/seed";
import { ORDER_STATUSES } from "../domain/types";
import { tryReduce, type DemoAction, type DemoState, type DispatchResult } from "./state";

export const STORAGE_KEY = "handcarry-demo:v1";

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

const ROLES = ["buyer", "traveler", "operator"];

// Boundary check for whatever sits in localStorage: anything unexpected falls back to the seed.
function isDemoState(v: unknown): v is DemoState {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Partial<DemoState>;
  return (
    s.version === 1 &&
    typeof s.session === "object" &&
    s.session !== null &&
    ROLES.includes(s.session.role) &&
    Array.isArray(s.orders) &&
    s.orders.every((o) => typeof o?.id === "string" && (ORDER_STATUSES as readonly string[]).includes(o.status)) &&
    Array.isArray(s.chats)
  );
}

export function loadState(storage: KeyValueStorage): DemoState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isDemoState(parsed)) return parsed;
    }
  } catch {
    // Corrupt JSON: fall through to a fresh seed.
  }
  return seedState();
}

export type DemoStore = {
  getState: () => DemoState;
  subscribe: (listener: () => void) => () => void;
  dispatch: (action: DemoAction) => DispatchResult;
  reset: () => void;
};

export function createDemoStore(storage: KeyValueStorage): DemoStore {
  let state = loadState(storage);
  const listeners = new Set<() => void>();

  const commit = (next: DemoState) => {
    state = next;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Quota exceeded (large photos) keeps the in-memory state working for the demo.
      console.warn("Demo state not persisted:", e);
    }
    listeners.forEach((l) => l());
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch: (action) => {
      const { state: next, result } = tryReduce(state, action);
      if (result.ok) commit(next);
      return result;
    },
    reset: () => commit(seedState()),
  };
}
