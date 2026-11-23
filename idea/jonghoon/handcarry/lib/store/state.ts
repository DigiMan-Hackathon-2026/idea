import { DomainError, transition, type DomainErrorCode, type OrderEvent } from "../domain/order-machine";
import type { Locale, Order, Role } from "../domain/types";

export type ChatMessage = {
  id: string;
  orderId: string;
  fromUserId: string;
  originalLocale: Locale;
  text: string;
  at: string;
};

export type Session = { role: Role; localeOverride: Locale | null };

export type DemoState = {
  version: 1;
  session: Session;
  orders: Order[];
  chats: ChatMessage[];
};

export type DemoAction =
  | { type: "createOrder"; order: Order }
  | { type: "orderEvent"; orderId: string; event: OrderEvent }
  | { type: "sendChat"; message: ChatMessage }
  | { type: "setRole"; role: Role }
  | { type: "setLocaleOverride"; locale: Locale | null };

export type StoreErrorCode = DomainErrorCode | "order_not_found" | "message_empty";
export type DispatchResult = { ok: true } | { ok: false; error: StoreErrorCode };

export class StoreError extends Error {
  constructor(readonly code: StoreErrorCode) {
    super(code);
    this.name = "StoreError";
  }
}

// Pure reducer. Throws StoreError or DomainError for actions that cannot apply.
export function reduce(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "createOrder":
      return { ...state, orders: [action.order, ...state.orders] };
    case "orderEvent": {
      const order = state.orders.find((o) => o.id === action.orderId);
      if (!order) throw new StoreError("order_not_found");
      const next = transition(order, action.event);
      return { ...state, orders: state.orders.map((o) => (o.id === order.id ? next : o)) };
    }
    case "sendChat": {
      if (!action.message.text.trim()) throw new StoreError("message_empty");
      if (!state.orders.some((o) => o.id === action.message.orderId)) throw new StoreError("order_not_found");
      return { ...state, chats: [...state.chats, { ...action.message, text: action.message.text.trim() }] };
    }
    case "setRole":
      return { ...state, session: { ...state.session, role: action.role } };
    case "setLocaleOverride":
      return { ...state, session: { ...state.session, localeOverride: action.locale } };
  }
}

export function tryReduce(state: DemoState, action: DemoAction): { state: DemoState; result: DispatchResult } {
  try {
    return { state: reduce(state, action), result: { ok: true } };
  } catch (e) {
    if (e instanceof DomainError || e instanceof StoreError) return { state, result: { ok: false, error: e.code } };
    throw e;
  }
}
