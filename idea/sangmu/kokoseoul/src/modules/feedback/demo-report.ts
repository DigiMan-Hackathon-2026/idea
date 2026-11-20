export const DEMO_REPORTS_STORAGE_KEY = "digiman.demo-reports.v1";

export const REPORT_CATEGORY_LABELS = {
  place_information: "場所の情報が違う",
  price_information: "価格・利用条件が違う",
  japanese_copy: "日本語が分かりにくい",
  other: "その他",
} as const;

export const REPORT_CATEGORY_LABELS_KO: Record<
  keyof typeof REPORT_CATEGORY_LABELS,
  string
> = {
  place_information: "장소 정보가 달라요",
  price_information: "가격·이용 조건이 달라요",
  japanese_copy: "일본어 안내가 이해하기 어려워요",
  other: "기타",
};

export type DemoReportCategory = keyof typeof REPORT_CATEGORY_LABELS;

export type DemoReport = {
  id: string;
  category: DemoReportCategory;
  comment: string;
  createdAt: string;
};

export function createDemoReport(
  category: string,
  comment: string,
  id: string,
  now: string,
): DemoReport {
  if (!(category in REPORT_CATEGORY_LABELS)) {
    throw new Error("Unsupported report category");
  }

  const normalizedComment = comment.trim();
  if (normalizedComment.length > 500) {
    throw new Error("Report comment must be at most 500 characters");
  }

  return {
    id,
    category: category as DemoReportCategory,
    comment: normalizedComment,
    createdAt: now,
  };
}

export function parseDemoReports(value: string | null): DemoReport[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((report): report is DemoReport => {
      if (!report || typeof report !== "object") return false;
      const candidate = report as Partial<DemoReport>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.category === "string" &&
        candidate.category in REPORT_CATEGORY_LABELS &&
        typeof candidate.comment === "string" &&
        candidate.comment.length <= 500 &&
        typeof candidate.createdAt === "string"
      );
    });
  } catch {
    return [];
  }
}
