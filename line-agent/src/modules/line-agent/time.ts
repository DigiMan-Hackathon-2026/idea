// Seoul has no daylight saving time, so a fixed +09:00 offset is exact.
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * MINUTE_MS).toISOString();
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / MINUTE_MS);
}

export function laterOf(a: string, b: string): string {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/** Seoul calendar date (YYYY-MM-DD) of an instant. */
export function seoulDate(iso: string): string {
  return new Date(Date.parse(iso) + SEOUL_OFFSET_MS).toISOString().slice(0, 10);
}

/** Seoul wall-clock hour and minute of an instant. */
export function seoulClock(iso: string): { hour: number; minute: number } {
  const shifted = new Date(Date.parse(iso) + SEOUL_OFFSET_MS);
  return { hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes() };
}

/** Instant for a Seoul date and wall-clock time. */
export function seoulInstant(date: string, hour: number, minute: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - SEOUL_OFFSET_MS).toISOString();
}

/** "18:45" in Seoul time. */
export function formatSeoulTime(iso: string): string {
  const { hour, minute } = seoulClock(iso);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Korean spoken form used on calls, e.g. "저녁 6시 30분". */
export function formatKoreanSpokenTime(iso: string): string {
  const { hour, minute } = seoulClock(iso);
  // Midnight is "밤 12시" (not "오전 12시", which reads as noon to many), the small hours "새벽".
  const period = hour === 0 ? "밤" : hour < 5 ? "새벽" : hour < 12 ? "오전" : hour < 18 ? "오후" : hour < 21 ? "저녁" : "밤";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? `${period} ${twelve}시` : minute === 30 ? `${period} ${twelve}시 반` : `${period} ${twelve}시 ${minute}분`;
}

/** Round up to the next multiple of `step` minutes. */
export function ceilToMinutes(iso: string, step: number): string {
  const ms = Date.parse(iso);
  const stepMs = step * MINUTE_MS;
  return new Date(Math.ceil(ms / stepMs) * stepMs).toISOString();
}

/** Round down to the previous multiple of `step` minutes. */
export function floorToMinutes(iso: string, step: number): string {
  const ms = Date.parse(iso);
  const stepMs = step * MINUTE_MS;
  return new Date(Math.floor(ms / stepMs) * stepMs).toISOString();
}
