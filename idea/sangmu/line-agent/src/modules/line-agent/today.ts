// "Can we go there today, on our conditions?" for one shop the user picked.
// Each part (opening hours, time to the next plan, party) is checked on its
// own and says where its answer came from; whatever no page can tell (a free
// table right now) stays unknown and is what the phone call checks.
import type { CandidatePlan } from "./plan";
import { addMinutes, seoulDate, seoulInstant } from "./time";
import type { DiningRequest, OpeningSpan, Restaurant, Weekday } from "./types";

export type TodayVerdict = "ok" | "check" | "hard";

/** When the shop can still seat a group today, from its published hours. */
export type HoursCheck =
  | { state: "unknown" }
  | { state: "closed_today" }
  /** No opening fits the seating window: it opens too late or stops taking orders too early. */
  | { state: "outside"; opensAt: string | null; lastSeatAt: string | null }
  | { state: "open"; seatFrom: string; lastSeatAt: string };

export type TodayCheck = {
  verdict: TodayVerdict;
  hours: HoursCheck;
  /** fits / late / unknown from the seat deadline and the shared wait. */
  timing: CandidatePlan["verdict"];
  /** The shop's confirmed capacity is below the party. */
  tooSmall: boolean;
};

const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
/** Without a last order time, the last seating is taken this long before closing. */
const SEAT_BEFORE_CLOSE_MINUTES = 60;
/** Without a deadline, "today" means within this many hours from now. */
const OPEN_ENDED_HOURS = 6;

function clock(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute };
}

function dayBefore(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

function weekdayOf(date: string): Weekday {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** The opening that starts on `date` as instants (close after midnight rolls to the next day). */
function spanOn(date: string, span: OpeningSpan): { open: string; lastSeat: string } {
  const open = seoulInstant(date, clock(span.open).hour, clock(span.open).minute);
  let close = seoulInstant(date, clock(span.close).hour, clock(span.close).minute);
  if (Date.parse(close) <= Date.parse(open)) close = addMinutes(close, 24 * 60);
  let lastSeat = addMinutes(close, -SEAT_BEFORE_CLOSE_MINUTES);
  if (span.lastOrder) {
    let lastOrder = seoulInstant(date, clock(span.lastOrder).hour, clock(span.lastOrder).minute);
    if (Date.parse(lastOrder) < Date.parse(open)) lastOrder = addMinutes(lastOrder, 24 * 60);
    lastSeat = lastOrder;
  }
  return { open, lastSeat };
}

/**
 * Whether the shop can seat the group between `from` and `until` (both instants).
 * Openings that started yesterday and run past midnight count too.
 */
export function checkHours(restaurant: Restaurant, from: string, until: string): HoursCheck {
  const hours = restaurant.hours;
  if (!hours) return { state: "unknown" };
  const today = seoulDate(from);
  const spans = [dayBefore(today), today].flatMap((date) => hours.weekly[weekdayOf(date)].map((span) => spanOn(date, span)));
  if (hours.weekly[weekdayOf(today)].length === 0 && !spans.some((span) => Date.parse(span.lastSeat) > Date.parse(from))) return { state: "closed_today" };
  for (const span of spans) {
    const seatFrom = Date.parse(span.open) > Date.parse(from) ? span.open : from;
    if (Date.parse(seatFrom) <= Date.parse(until) && Date.parse(seatFrom) <= Date.parse(span.lastSeat)) {
      return { state: "open", seatFrom, lastSeatAt: span.lastSeat };
    }
  }
  const later = spans.filter((span) => Date.parse(span.open) > Date.parse(from)).sort((a, b) => Date.parse(a.open) - Date.parse(b.open))[0];
  const current = spans.filter((span) => Date.parse(span.open) <= Date.parse(from)).sort((a, b) => Date.parse(b.open) - Date.parse(a.open))[0];
  return { state: "outside", opensAt: later?.open ?? null, lastSeatAt: current?.lastSeat ?? null };
}

export function judgeToday(request: Pick<DiningRequest, "partySize">, restaurant: Restaurant, plan: CandidatePlan, now: string): TodayCheck {
  const from = plan.arriveRestaurantAt ?? now;
  const until = plan.seatDeadline ?? addMinutes(from, OPEN_ENDED_HOURS * 60);
  const hours = checkHours(restaurant, from, Date.parse(until) < Date.parse(from) ? from : until);
  const tooSmall = restaurant.maxParty !== null && request.partySize !== null && restaurant.maxParty < request.partySize;
  const hard = hours.state === "closed_today" || hours.state === "outside" || plan.verdict === "late" || tooSmall;
  const sure = hours.state === "open" && plan.verdict === "fits";
  return { verdict: hard ? "hard" : sure ? "ok" : "check", hours, timing: plan.verdict, tooSmall };
}
