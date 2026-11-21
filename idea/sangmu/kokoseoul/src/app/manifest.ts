import type { MetadataRoute } from "next";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getRequestLocale();
  const brandName = pickLocale(locale, "ココソウル", "여기서울");
  return {
    name: pickLocale(
      locale,
      `${brandName} — ソウルの小さな冒険ガイド`,
      `${brandName} — 서울의 작은 모험 가이드`,
    ),
    short_name: brandName,
    description: pickLocale(
      locale,
      "ソウルで、ひとりでも迷わず始められるローカル体験。",
      "서울에서 혼자서도 망설이지 않고 시작하는 로컬 체험.",
    ),
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f3eb",
    theme_color: "#f7f3eb",
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
