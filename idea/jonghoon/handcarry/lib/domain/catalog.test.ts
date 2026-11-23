import { describe, expect, test } from "vitest";
import { parseItem } from "./catalog";

const valid = { name: "미개봉 확장팩 박스", category: "pokemon-sealed", priceYen: "5400", sealed: true, note: "" };

describe("parseItem", () => {
  test("accepts an allowlisted sealed Pokémon box and brands the price", () => {
    const r = parseItem(valid);
    expect(r).toEqual({
      ok: true,
      item: { name: "미개봉 확장팩 박스", category: "pokemon-sealed", priceYen: 5400, note: "" },
    });
  });

  test("trims the name and note", () => {
    const r = parseItem({ ...valid, name: "  박스  ", note: " 띠지 포함 " });
    expect(r.ok && r.item.name).toBe("박스");
    expect(r.ok && r.item.note).toBe("띠지 포함");
  });

  test("accepts the 100,000 yen cap exactly", () => {
    expect(parseItem({ ...valid, priceYen: "100000" }).ok).toBe(true);
  });

  test.each([
    [{ name: "   " }, "name_required"],
    [{ category: "liquor" }, "category_not_allowed"],
    [{ priceYen: "0" }, "price_invalid"],
    [{ priceYen: "12.5" }, "price_invalid"],
    [{ priceYen: "abc" }, "price_invalid"],
    [{ priceYen: "100001" }, "price_over_cap"],
    [{ sealed: false }, "pokemon_must_be_sealed"],
  ])("rejects %o with %s", (patch, error) => {
    const r = parseItem({ ...valid, ...patch });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain(error);
  });

  test("the sealed rule applies only to Pokémon cards", () => {
    expect(parseItem({ ...valid, category: "jp-idol", sealed: false }).ok).toBe(true);
  });

  test("reports every error at once", () => {
    const r = parseItem({ name: "", category: "liquor", priceYen: "-1", sealed: false, note: "" });
    expect(!r.ok && r.errors).toEqual(["name_required", "category_not_allowed", "price_invalid"]);
  });
});
