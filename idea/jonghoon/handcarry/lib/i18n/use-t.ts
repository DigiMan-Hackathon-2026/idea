"use client";

import { usePathname } from "next/navigation";
import { ROLE_LOCALE } from "../demo/users";
import type { Locale, Role } from "../domain/types";
import { useDemoState } from "../store/react";
import { ja } from "./ja";
import { ko, type Messages } from "./ko";

const MESSAGES: Record<Locale, Messages> = { ko, ja };
const ROLE_SEGMENTS: readonly Role[] = ["buyer", "traveler", "operator"];

export function roleFromPath(pathname: string): Role | null {
  const first = pathname.split("/")[1] as Role;
  return ROLE_SEGMENTS.includes(first) ? first : null;
}

// The active role follows the URL on role routes and the session elsewhere (e.g. chat).
export function useRole(): Role {
  const pathname = usePathname();
  const { session } = useDemoState();
  return roleFromPath(pathname) ?? session.role;
}

export function useLocale(): Locale {
  const role = useRole();
  const { session } = useDemoState();
  return session.localeOverride ?? ROLE_LOCALE[role];
}

export function useT(): { t: Messages; locale: Locale } {
  const locale = useLocale();
  return { t: MESSAGES[locale], locale };
}
