// Reads a wait report typed (or pasted) by the user. Minutes and team counts
// stay separate: teams are never turned into minutes (spec §4).
import { normalizeText } from "./interpret";
import type { WaitBasis } from "./types";

export type WaitReading = {
  minutes: number | null;
  teams: number | null;
  readyAt: { hour: number; minute: number } | null;
  basis: WaitBasis;
};

const remoteWords = /(受付済|登録済|登録した|順番待ち中|待機中|リモート|원격|등록했|접수했|줄서기 (?:했|중)|웨이팅 (?:등록|걸어))/;
const onArrivalWords = /(着いてから|現地で|行ってから|並ぶと|도착하(?:면|고)|가서|가면|현장)/;
const noWaitWords = /(待ちなし|待ち無し|すぐ入れ|空いてい|대기 ?없|바로 (?:들어|입장)|자리 (?:있|많))/;

export function readWait(text: string): WaitReading | null {
  const t = normalizeText(text);
  let minutes: number | null = null;
  let teams: number | null = null;
  let readyAt: WaitReading["readyAt"] = null;

  const hours = t.match(/(\d{1,2})\s*(?:時間|시간)(?:\s*(\d{1,2})\s*(?:分|분))?/);
  const mins = t.match(/(\d{1,3})\s*(?:分|분)(?!\s*(?:前|전))/);
  if (hours && /(待|대기|後|후|かか|걸)/.test(t)) {
    minutes = Number(hours[1]) * 60 + (hours[2] ? Number(hours[2]) : 0);
  } else if (mins && !/(\d{1,2})\s*(?:時|시)\s*\d{1,2}\s*(?:分|분)/.test(t)) {
    minutes = Number(mins[1]);
  }

  const position = t.match(/(\d{1,3})\s*(?:番目|번째)/);
  const ahead = t.match(/(\d{1,3})\s*(?:組|チーム|팀)/);
  if (position) teams = Math.max(0, Number(position[1]) - 1);
  else if (ahead) teams = Number(ahead[1]);

  const ready = t.match(/(\d{1,2})\s*(?:[:時시])\s*(\d{1,2})?\s*(?:分|분)?\s*(?:に入れ|に入店|입장|에 들어)/);
  if (ready) readyAt = { hour: Number(ready[1]), minute: ready[2] ? Number(ready[2]) : 0 };

  if (noWaitWords.test(t) && minutes === null && teams === null) minutes = 0;
  if (minutes === null && teams === null && readyAt === null) return null;

  const basis: WaitBasis = remoteWords.test(t) ? "remote_from_observed" : onArrivalWords.test(t) ? "on_arrival" : minutes === 0 ? "on_arrival" : "unknown";
  return { minutes, teams, readyAt, basis };
}
