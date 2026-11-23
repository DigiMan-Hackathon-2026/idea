import { MAX_ITEM_PRICE_YEN } from "../config";
import { CATEGORIES, yen, type Category, type Item } from "./types";

export type ItemError =
  | "name_required"
  | "category_not_allowed"
  | "price_invalid"
  | "price_over_cap"
  | "pokemon_must_be_sealed";

export type ItemInput = { name: string; category: string; priceYen: string; sealed: boolean; note: string };
export type ParseItemResult = { ok: true; item: Item } | { ok: false; errors: ItemError[] };

const isCategory = (c: string): c is Category => (CATEGORIES as readonly string[]).includes(c);

// Boundary parser for the order form: raw form strings in, a branded Item or every error out.
export function parseItem(input: ItemInput): ParseItemResult {
  const errors: ItemError[] = [];
  const name = input.name.trim();
  if (!name) errors.push("name_required");

  if (!isCategory(input.category)) errors.push("category_not_allowed");

  const price = Number(input.priceYen.trim());
  const priceOk = input.priceYen.trim() !== "" && Number.isInteger(price) && price > 0;
  if (!priceOk) errors.push("price_invalid");
  else if (price > MAX_ITEM_PRICE_YEN) errors.push("price_over_cap");

  if (input.category === "pokemon-sealed" && !input.sealed) errors.push("pokemon_must_be_sealed");

  if (errors.length > 0 || !isCategory(input.category)) return { ok: false, errors };
  return { ok: true, item: { name, category: input.category, priceYen: yen(price), note: input.note.trim() } };
}
