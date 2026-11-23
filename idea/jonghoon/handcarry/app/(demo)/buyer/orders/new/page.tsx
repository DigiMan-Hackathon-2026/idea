"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PageTitle } from "@/components/order/order-card";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { ESCROW_RATE } from "@/lib/config";
import { HERO_ITEM_INPUT } from "@/lib/demo/seed";
import { ACTING_USER } from "@/lib/demo/users";
import { parseItem, type ItemError, type ItemInput } from "@/lib/domain/catalog";
import { toWon } from "@/lib/domain/money";
import { createOrder } from "@/lib/domain/order-machine";
import { CATEGORIES, yen } from "@/lib/domain/types";
import { formatWon } from "@/lib/format";
import { useT } from "@/lib/i18n/use-t";
import { newId, nowIso, useDispatch } from "@/lib/store/react";

const EMPTY: ItemInput = { name: "", category: "", priceYen: "", sealed: false, note: "" };

const FIELD_OF: Record<ItemError, keyof ItemInput> = {
  name_required: "name",
  category_not_allowed: "category",
  price_invalid: "priceYen",
  price_over_cap: "priceYen",
  pokemon_must_be_sealed: "sealed",
};

export default function NewOrderPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const dispatch = useDispatch();
  const [input, setInput] = useState<ItemInput>(EMPTY);
  const [errors, setErrors] = useState<ItemError[]>([]);

  const set = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) => setInput((prev) => ({ ...prev, [key]: value }));
  const errorFor = (field: keyof ItemInput) => {
    const e = errors.find((err) => FIELD_OF[err] === field);
    return e ? t.orderForm.errors[e] : undefined;
  };

  const price = Number(input.priceYen);
  const estimate = Number.isInteger(price) && price > 0 ? formatWon(toWon(yen(price), ESCROW_RATE), locale) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseItem(input);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    const id = `o-${newId()}`;
    const result = dispatch({
      type: "createOrder",
      order: createOrder({ id, buyerId: ACTING_USER.buyer, item: parsed.item, createdAt: nowIso() }),
    });
    if (result.ok) router.push(`/buyer/orders/${id}`);
  };

  return (
    <>
      <PageTitle title={t.orderForm.title} lead={t.orderForm.lead} />
      <form onSubmit={submit} noValidate className="space-y-5" aria-label={t.orderForm.title}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setInput({ ...HERO_ITEM_INPUT });
            setErrors([]);
          }}
        >
          {t.orderForm.fillExample}
        </Button>

        <Field id="name" label={t.orderForm.name} error={errorFor("name")}>
          <input
            id="name"
            className={inputClass}
            placeholder={t.orderForm.namePlaceholder}
            value={input.name}
            aria-invalid={!!errorFor("name")}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>

        <Field id="category" label={t.orderForm.category} error={errorFor("category")}>
          <select
            id="category"
            className={inputClass}
            value={input.category}
            aria-invalid={!!errorFor("category")}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="">{t.orderForm.categoryPlaceholder}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.category[c]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="price" label={t.orderForm.price} help={estimate ? t.orderForm.estimate(estimate) : t.orderForm.priceHelp} error={errorFor("priceYen")}>
          <input
            id="price"
            inputMode="numeric"
            className={`${inputClass} font-mono`}
            placeholder="5400"
            value={input.priceYen}
            aria-invalid={!!errorFor("priceYen")}
            onChange={(e) => set("priceYen", e.target.value)}
          />
        </Field>

        <div className="space-y-1.5">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={input.sealed}
              onChange={(e) => set("sealed", e.target.checked)}
              className="h-5 w-5 rounded-[6px] accent-primary"
            />
            {t.orderForm.sealed}
          </label>
          <p className={`text-[12px] ${errorFor("sealed") ? "text-error" : "text-ink-2"}`}>{errorFor("sealed") ?? t.orderForm.sealedHelp}</p>
        </div>

        <Field id="note" label={t.orderForm.note}>
          <input id="note" className={inputClass} placeholder={t.orderForm.notePlaceholder} value={input.note} onChange={(e) => set("note", e.target.value)} />
        </Field>

        <p className="rounded-md bg-muted px-4 py-3 text-[12px] leading-relaxed text-ink-2">{t.orderForm.excluded}</p>

        <Button type="submit" size="lg" block>
          {t.orderForm.submit}
        </Button>
      </form>
    </>
  );
}
