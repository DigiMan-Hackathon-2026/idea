"use client";

import { translate } from "../demo/translations";
import type { Item } from "../domain/types";
import { useT } from "./use-t";

// Buyers write item names in Korean. Japanese screens show the fixed demo translation when one exists.
export function useItemText(item: Item): { name: string; note: string; original: string | null } {
  const { locale } = useT();
  if (locale === "ko") return { name: item.name, note: item.note, original: null };
  const name = translate(item.name, "ko", "ja");
  const note = item.note ? translate(item.note, "ko", "ja") : "";
  return { name: name ?? item.name, note: note ?? item.note, original: name ? item.name : null };
}
