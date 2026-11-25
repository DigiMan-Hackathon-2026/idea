import type { Metadata } from "next";
import { VisitGuidePage } from "@/components/visit-guide-page";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import guide from "@/modules/content/seongsu-oliveyoung-shopping.json";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: pickLocale(locale, guide.titleJa, guide.titleKo) };
}

export default async function SeongsuOliveyoungShoppingPage() {
  return (
    <VisitGuidePage
      guide={guide}
      locale={await getRequestLocale()}
      listHref="/quests?area=seongsu&purpose=shopping"
      sourceUrl={guide.place.guideUrlKo}
    />
  );
}
