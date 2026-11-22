import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import styles from "./phone-preview.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: pickLocale(locale, "スマートフォン表示", "스마트폰 미리보기") };
}

export default async function MobilePreviewPage() {
  if (process.env.NODE_ENV !== "development" && process.env.APP_ENV !== "preview") notFound();

  const locale = await getRequestLocale();
  const title = pickLocale(locale, "ココソウルのスマートフォン表示", "여기서울 스마트폰 미리보기");

  return (
    <main className={styles.stage} aria-label={title}>
      <div className={styles.phone}>
        <div className={styles.statusBar} aria-hidden="true">
          <span>9:41</span>
          <span className={styles.battery} />
        </div>
        <iframe className={styles.screen} title={title} src="/" />
        <div className={styles.homeBar} aria-hidden="true" />
      </div>
      <Link href="/" className={styles.expand}>
        {pickLocale(locale, "通常の表示で開く", "일반 화면으로 열기")}
      </Link>
    </main>
  );
}
