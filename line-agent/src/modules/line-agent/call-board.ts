// Live view of recent calls for the operations console (memory only). The
// agent and the stored request stay the source of truth for outcomes; this
// only adds what the store does not keep: the call's phase and the
// transcript while the call is still going.
import type { TranscriptTurn } from "./outcome";

export type CallPhase = "placing" | "ringing" | "talking" | "ended" | "failed";

export type BoardCall = {
  attemptId: string;
  restaurantNameKo: string;
  phase: CallPhase;
  placedAt: number;
  answeredAt: number | null;
  endedAt: number | null;
  turns: TranscriptTurn[];
  /** Simulated calls that arrive with the whole transcript at once (the console plays them back). */
  simulated: boolean;
  /** No call audio exists (simulator): the console may read the lines aloud. */
  readAloud: boolean;
};

const MAX_CALLS = 20;
const MAX_TURNS = 200;

export class CallBoard {
  private readonly calls: BoardCall[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  placed(attemptId: string, restaurantNameKo: string, simulated: boolean, readAloud = simulated): void {
    if (this.find(attemptId)) return;
    this.calls.push({ attemptId, restaurantNameKo, phase: "placing", placedAt: this.now(), answeredAt: null, endedAt: null, turns: [], simulated, readAloud });
    if (this.calls.length > MAX_CALLS) this.calls.splice(0, this.calls.length - MAX_CALLS);
  }

  /** Phases only move forward; a late "ringing" never undoes "talking". */
  phase(attemptId: string, phase: CallPhase): void {
    const call = this.find(attemptId);
    if (!call || rank[phase] <= rank[call.phase]) return;
    call.phase = phase;
    if (phase === "talking" && call.answeredAt === null) call.answeredAt = this.now();
    if ((phase === "ended" || phase === "failed") && call.endedAt === null) call.endedAt = this.now();
  }

  live(attemptId: string, turns: TranscriptTurn[]): void {
    const call = this.find(attemptId);
    if (!call || call.phase === "ended" || call.phase === "failed") return;
    this.phase(attemptId, "talking");
    call.turns = turns.slice(0, MAX_TURNS);
  }

  finished(attemptId: string, turns: TranscriptTurn[] | null): void {
    const call = this.find(attemptId);
    if (!call) return;
    if (turns && turns.length) call.turns = turns.slice(0, MAX_TURNS);
    // No words and never answered: the call did not connect.
    this.phase(attemptId, call.turns.length || call.answeredAt !== null ? "ended" : "failed");
  }

  list(): BoardCall[] {
    return this.calls.map((call) => ({ ...call, turns: [...call.turns] })).reverse();
  }

  private find(attemptId: string): BoardCall | undefined {
    return this.calls.find((call) => call.attemptId === attemptId);
  }
}

const rank: Record<CallPhase, number> = { placing: 0, ringing: 1, talking: 2, ended: 3, failed: 3 };
