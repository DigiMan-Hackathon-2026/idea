import type { MetadataRoute } from "next";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getRequestLocale();
  const brandName = pickLocale(locale, "ココソウル", "여기서울");
  return {
    name: pickLocale(
      locale,
      `${brandName} — 今日のソウルを選ぶ`,
      `${brandName} — 오늘의 서울을 고르기`,
    ),
    short_name: brandName,
    description: pickLocale(
      locale,
      "グルメ、文化、買い物、散歩、日常の発見から、今日のソウルを選ぶ。",
      "식도락, 문화, 쇼핑, 산책, 일상의 발견에서 오늘의 서울을 고르세요.",
    ),
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#d8ccad",
    theme_color: "#d8ccad",
    lang: locale,
    icons: [
      {
        src: "/pwa-icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
