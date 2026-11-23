import { describe, expect, test, vi } from "vitest";
import { seedState } from "../demo/seed";
import { minReward, toWon } from "../domain/money";
import { ESCROW_RATE } from "../config";
import { STORAGE_KEY, createDemoStore, loadState, type KeyValueStorage } from "./store";

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("seedState", () => {
  test("covers the stages the demo script needs", () => {
    const byId = Object.fromEntries(seedState().orders.map((o) => [o.id, o.status]));
    expect(byId).toEqual({
      "seed-open": "open",
      "seed-paid": "paid",
      "seed-hub": "at_hub",
      "seed-dispute": "delivered",
      "seed-done": "completed",
    });
  });

  test("every seeded bid meets the minimum reward", () => {
    for (const o of seedState().orders) {
      for (const b of o.bids) expect(b.reward).toBeGreaterThanOrEqual(minReward(toWon(o.item.priceYen, ESCROW_RATE)));
    }
  });

  test("seeded chats belong to seeded orders", () => {
    const s = seedState();
    const ids = new Set(s.orders.map((o) => o.id));
    expect(s.chats.every((c) => ids.has(c.orderId))).toBe(true);
  });
});

describe("loadState", () => {
  test("falls back to the seed when storage is empty, corrupt, or the wrong shape", () => {
    expect(loadState(memoryStorage())).toEqual(seedState());
    expect(loadState(memoryStorage({ [STORAGE_KEY]: "{not json" }))).toEqual(seedState());
    expect(loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 2 }) }))).toEqual(seedState());
    const badStatus = { ...seedState(), orders: [{ id: "x", status: "teleported" }] };
    expect(loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(badStatus) }))).toEqual(seedState());
  });

  test("restores a saved state", () => {
    const saved = { ...seedState(), session: { role: "operator", localeOverride: "ja" } };
    expect(loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(saved) }))).toEqual(saved);
  });
});

describe("createDemoStore", () => {
  test("a successful action persists and notifies subscribers", () => {
    const storage = memoryStorage();
    const store = createDemoStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);

    const result = store.dispatch({ type: "setRole", role: "traveler" });

    expect(result).toEqual({ ok: true });
    expect(store.getState().session.role).toBe("traveler");
    expect(JSON.parse(storage.data[STORAGE_KEY]).session.role).toBe("traveler");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("an illegal order event returns the error code and changes nothing", () => {
    const storage = memoryStorage();
    const store = createDemoStore(storage);
    const before = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);

    const result = store.dispatch({ type: "orderEvent", orderId: "seed-open", event: { type: "checkOutHub", at: "t" } });

    expect(result).toEqual({ ok: false, error: "illegal_transition" });
    expect(store.getState()).toBe(before);
    expect(storage.data[STORAGE_KEY]).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
  });

  test("order events apply through the state machine", () => {
    const store = createDemoStore(memoryStorage());
    const result = store.dispatch({ type: "orderEvent", orderId: "seed-hub", event: { type: "checkOutHub", at: "t" } });
    expect(result).toEqual({ ok: true });
    expect(store.getState().orders.find((o) => o.id === "seed-hub")!.status).toBe("delivered");
  });

  test("unknown orders and empty chat messages are rejected", () => {
    const store = createDemoStore(memoryStorage());
    expect(store.dispatch({ type: "orderEvent", orderId: "nope", event: { type: "checkOutHub", at: "t" } })).toEqual({
      ok: false,
      error: "order_not_found",
    });
    const message = { id: "m", orderId: "seed-hub", fromUserId: "buyer-minji", originalLocale: "ko" as const, text: "  ", at: "t" };
    expect(store.dispatch({ type: "sendChat", message })).toEqual({ ok: false, error: "message_empty" });
    expect(store.dispatch({ type: "sendChat", message: { ...message, text: "hi", orderId: "nope" } })).toEqual({
      ok: false,
      error: "order_not_found",
    });
  });

  test("chat messages are trimmed and appended; new orders go first", () => {
    const store = createDemoStore(memoryStorage());
    const message = { id: "m", orderId: "seed-hub", fromUserId: "buyer-minji", originalLocale: "ko" as const, text: " 안녕 ", at: "t" };
    store.dispatch({ type: "sendChat", message });
    expect(store.getState().chats.at(-1)).toEqual({ ...message, text: "안녕" });

    const order = { ...seedState().orders[0], id: "new" };
    store.dispatch({ type: "createOrder", order });
    expect(store.getState().orders[0].id).toBe("new");
  });

  test("reset restores the seed and persists it", () => {
    const storage = memoryStorage();
    const store = createDemoStore(storage);
    store.dispatch({ type: "setLocaleOverride", locale: "ja" });
    store.reset();
    expect(store.getState()).toEqual(seedState());
    expect(JSON.parse(storage.data[STORAGE_KEY])).toEqual(seedState());
  });

  test("a storage write failure keeps the in-memory state", () => {
    const storage: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createDemoStore(storage);
    expect(store.dispatch({ type: "setRole", role: "operator" })).toEqual({ ok: true });
    expect(store.getState().session.role).toBe("operator");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
