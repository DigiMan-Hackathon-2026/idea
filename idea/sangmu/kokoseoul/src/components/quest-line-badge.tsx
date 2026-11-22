import { pickLocale, type Locale } from "@/lib/locale";
import { subwayLineColors } from "@/modules/transit/subway-line-colors";
import type { SubwayLine } from "@/modules/transit/subway-stations";

/** "4호선" with the line colour as a left border, for quest screens. */
export function QuestLineBadge({ line, locale, tinted = false }: { line: SubwayLine; locale: Locale; tinted?: boolean }) {
  const color = subwayLineColors[line];
  return (
    <span className="rounded border-s-4 bg-white px-1.5 text-sm font-bold"
      style={{ borderInlineStartColor: color, ...(tinted && { backgroundColor: `color-mix(in srgb, ${color} 11%, white)` }) }}>
      {pickLocale(locale, `${line}号線`, `${line}호선`)}
    </span>
  );
}

/** Straight-line distance rounded to 10 m, e.g. "1,250 m". */
export function formatApproxMetres(value: number, locale: Locale) {
  return `${new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "ja-JP").format(Math.round(value / 10) * 10)} m`;
}
