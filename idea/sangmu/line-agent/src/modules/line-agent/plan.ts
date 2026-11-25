// ComputePlan (spec §4 시간 판정, §6 내부 경계): deterministic for the same input.
import { addMinutes, ceilToMinutes, laterOf, minutesBetween } from "./time";
import type { CandidateState, DiningRequest, WaitObservation } from "./types";

export type Verdict = "fits" | "late" | "unknown";

export type UnknownReason = "no_deadline" | "travel_to_next_unknown" | "travel_to_restaurant_unknown" | "wait_unknown" | "wait_teams_only" | "wait_basis_unknown";

export type CandidatePlan = {
  candidateId: string;
  verdict: Verdict;
  arriveRestaurantAt: string | null;
  seatDeadline: string | null;
  seatExpected: string | null;
  /** Minutes past the seat deadline (positive) or spare minutes (negative). */
  marginMinutes: number | null;
  unknown: UnknownReason[];
  wait: WaitObservation | null;
};

export function seatDeadline(request: Pick<DiningRequest, "arriveBy" | "mealMinutes" | "bufferMinutes">, candidate: CandidateState): string | null {
  if (!request.arriveBy || !candidate.toNext) return null;
  return addMinutes(request.arriveBy, -(request.mealMinutes + candidate.toNext.minutes + request.bufferMinutes));
}

export function latestWait(waits: readonly WaitObservation[], candidateId: string): WaitObservation | null {
  let latest: WaitObservation | null = null;
  for (const wait of waits) {
    if (wait.candidateId !== candidateId) continue;
    if (!latest || Date.parse(wait.reportedAt) >= Date.parse(latest.reportedAt)) latest = wait;
  }
  return latest;
}

export function computePlan(
  request: Pick<DiningRequest, "arriveBy" | "mealMinutes" | "bufferMinutes" | "waits">,
  candidate: CandidateState,
  now: string,
): CandidatePlan {
  const unknown: UnknownReason[] = [];
  const deadline = seatDeadline(request, candidate);
  if (!request.arriveBy) unknown.push("no_deadline");
  else if (!candidate.toNext) unknown.push("travel_to_next_unknown");

  const arrive = candidate.toRestaurant ? addMinutes(now, candidate.toRestaurant.minutes) : null;
  if (!arrive) unknown.push("travel_to_restaurant_unknown");

  const wait = latestWait(request.waits, candidate.restaurantId);
  let seat: string | null = null;
  if (arrive) {
    if (!wait) {
      unknown.push("wait_unknown");
    } else if (wait.readyAt) {
      seat = laterOf(arrive, wait.readyAt);
    } else if (wait.minutes === null) {
      unknown.push("wait_teams_only");
    } else if (wait.basis === "on_arrival") {
      seat = addMinutes(arrive, wait.minutes);
    } else if (wait.basis === "remote_from_observed") {
      seat = laterOf(addMinutes(wait.observedAt ?? wait.reportedAt, wait.minutes), arrive);
    } else {
      unknown.push("wait_basis_unknown");
    }
  }

  let verdict: Verdict = "unknown";
  let margin: number | null = null;
  if (deadline) {
    // Even with the wait unknown, arriving after the deadline is already late.
    const earliest = seat ?? arrive;
    if (earliest) {
      margin = minutesBetween(deadline, earliest);
      if (margin > 0) verdict = "late";
      else if (seat) verdict = "fits";
    }
  }

  return { candidateId: candidate.restaurantId, verdict, arriveRestaurantAt: arrive, seatDeadline: deadline, seatExpected: seat, marginMinutes: margin, unknown, wait };
}

/** Time window the agent may accept on a call: from earliest arrival to the seat deadline. */
export function callWindow(plan: CandidatePlan, now: string): { start: string; end: string } {
  const start = ceilToMinutes(plan.arriveRestaurantAt ?? addMinutes(now, 15), 5);
  const end = plan.seatDeadline && Date.parse(plan.seatDeadline) > Date.parse(start) ? plan.seatDeadline : addMinutes(start, 60);
  return { start, end };
}

/** Order: fits, then unknown, then late; ties by smaller margin then rank. */
export function rankPlans(plans: CandidatePlan[], candidates: CandidateState[]): CandidatePlan[] {
  const order: Record<Verdict, number> = { fits: 0, unknown: 1, late: 2 };
  const rank = (id: string) => candidates.find((c) => c.restaurantId === id)?.rank ?? 99;
  return [...plans].sort(
    (a, b) => order[a.verdict] - order[b.verdict] || (a.marginMinutes ?? 0) - (b.marginMinutes ?? 0) || rank(a.candidateId) - rank(b.candidateId),
  );
}
