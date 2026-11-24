import { Fragment } from "react";
import { splitKoreanRuns } from "@/lib/korean-runs";
import type { Locale } from "@/lib/locale";

/**
 * Renders Japanese copy with its Hangul words wrapped in `lang="ko"`, so screen
 * readers switch voice for an address or a sign name. Korean-only pages need no wrapping.
 */
export function KoreanAwareText({ text, locale }: { text: string; locale: Locale }) {
  if (locale === "ko") return text;
  return splitKoreanRuns(text).map((run, index) =>
    run.korean ? <span key={index} lang="ko">{run.text}</span> : <Fragment key={index}>{run.text}</Fragment>,
  );
}
