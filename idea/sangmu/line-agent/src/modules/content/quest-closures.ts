/** 0 = Sunday … 6 = Saturday, in Seoul time. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Weekly closed days stated in a quest's own Korean text or a course note.
 * `evidenceKo` is quoted from that text so a test can keep the two in step.
 * Public holidays are not covered.
 */
export const questClosures: Readonly<Record<string, { closedWeekdays: Weekday[]; evidenceKo: string }>> = {
  "city-hall-seoul-library-first-loan": { closedWeekdays: [1], evidenceKo: "월요일과 공휴일은 쉬어요" },
  "seongsu-somugwan-solo-gukbap": { closedWeekdays: [0, 6], evidenceKo: "평일에 열고" },
  "dongdaemun-market-small-trim": { closedWeekdays: [0], evidenceKo: "일요일 휴무" },
  "changdeokgung-japanese-tour": { closedWeekdays: [1], evidenceKo: "월요일은 창덕궁이 쉬어요" },
  "sinseol-seoul-folk-flea-market": { closedWeekdays: [2], evidenceKo: "서울풍물시장은 화요일에 쉬어요" },
};

export function getClosedWeekdays(slug: string): Weekday[] {
  return questClosures[slug]?.closedWeekdays ?? [];
}

const weekdayIndex: Record<string, Weekday> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function seoulWeekday(date: Date): Weekday {
  const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Seoul" }).format(date);
  return weekdayIndex[short];
}
