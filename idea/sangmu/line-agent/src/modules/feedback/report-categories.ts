/** Report categories accepted by POST /api/v1/quests/:questId/reports. */
export const REPORT_CATEGORIES = ["information", "unavailable", "other"] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_CATEGORY_LABELS: Record<
  ReportCategory,
  { ja: string; ko: string }
> = {
  information: {
    ja: "場所・価格などの情報が違う",
    ko: "장소·가격 등 정보가 달라요",
  },
  unavailable: {
    ja: "案内どおりに利用できなかった",
    ko: "안내대로 이용할 수 없었어요",
  },
  other: { ja: "その他", ko: "기타" },
};

export const REPORT_COMMENT_MAX_LENGTH = 500;

export function isReportCategory(value: string): value is ReportCategory {
  return (REPORT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Normalizes optional free text for the API: blank input becomes null so the
 * server never receives an empty comment.
 */
export function normalizeOptionalComment(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length > REPORT_COMMENT_MAX_LENGTH) {
    throw new Error("Comment must be at most 500 characters");
  }
  return trimmed === "" ? null : trimmed;
}
