"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { bookLink, readAdventureOrigin } from "@/lib/adventure-origin";
import { pickLocale, type Locale } from "@/lib/locale";

type Props = { locale: Locale; className: string; fallback?: ReactNode };

function ReturnLink({ locale, className, fallback }: Props) {
  const params = useSearchParams();
  const origin = params && readAdventureOrigin(params);
  if (!origin) return fallback;
  const label = pickLocale(locale, "冒険ノートの項目に戻る", "모험 수첩 항목으로 돌아가기");
  return <Link href={{
    ...bookLink(origin.line, origin.book, origin.mission, origin.station),
    hash: "book-page",
  }} className={className} prefetch={false}>
    {label}
  </Link>;
}

export function AdventureReturnLink(props: Props) {
  return <Suspense fallback={props.fallback}><ReturnLink {...props} /></Suspense>;
}
