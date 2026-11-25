import "server-only";

import { cookies } from "next/headers";
import {
  LOCALE_COOKIE_NAME,
  isLocale,
  type Locale,
} from "@/lib/locale";

export async function getRequestLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
  return isLocale(value) ? value : "ja";
}

