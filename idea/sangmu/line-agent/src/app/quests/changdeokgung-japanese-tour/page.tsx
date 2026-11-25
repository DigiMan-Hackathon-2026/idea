import type { Metadata } from "next";
import { VisitGuidePage } from "@/components/visit-guide-page";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import guide from "@/modules/content/changdeokgung-japanese-tour.json";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: pickLocale(locale, guide.titleJa, guide.titleKo) };
}

export default async function ChangdeokgungJapaneseTourPage() {
  const locale = await getRequestLocale();
  return (
    <VisitGuidePage
      guide={guide}
      locale={locale}
      listHref="/quests?area=jongno&purpose=culture"
      sourceUrl={pickLocale(locale, guide.place.guideUrlJa, guide.place.guideUrlKo)}
    />
  );
}
