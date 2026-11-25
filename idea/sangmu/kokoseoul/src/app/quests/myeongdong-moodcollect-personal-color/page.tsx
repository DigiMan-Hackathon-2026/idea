import type { Metadata } from "next";
import { VisitGuidePage } from "@/components/visit-guide-page";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import guide from "@/modules/content/myeongdong-moodcollect-personal-color.json";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: pickLocale(locale, guide.titleJa, guide.titleKo) };
}

export default async function MyeongdongMoodcollectPersonalColorPage() {
  const locale = await getRequestLocale();
  return (
    <VisitGuidePage
      guide={guide}
      locale={locale}
      listHref="/quests?area=myeongdong&purpose=beauty"
      sourceUrl={pickLocale(locale, guide.place.guideUrlJa, guide.place.guideUrlKo)}
    />
  );
}
