import type { Locale, Role } from "../domain/types";

export type DemoUser = { id: string; role: Role; name: string; locale: Locale };

export const USERS = {
  "buyer-minji": { id: "buyer-minji", role: "buyer", name: "김민지", locale: "ko" },
  "trav-haruto": { id: "trav-haruto", role: "traveler", name: "佐藤 ハルト", locale: "ja" },
  "trav-yui": { id: "trav-yui", role: "traveler", name: "田中 ユイ", locale: "ja" },
  operator: { id: "operator", role: "operator", name: "운영팀", locale: "ko" },
} as const satisfies Record<string, DemoUser>;

export type UserId = keyof typeof USERS;

// The single persona each role plays in the demo.
export const ACTING_USER: Record<Role, UserId> = {
  buyer: "buyer-minji",
  traveler: "trav-haruto",
  operator: "operator",
};

export const ROLE_LOCALE: Record<Role, Locale> = { buyer: "ko", traveler: "ja", operator: "ko" };
