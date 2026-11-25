import type { DiningRequest } from "./types";

/** Storage the agent needs. `save` is compare-and-set on `revision`. */
export interface AgentStore {
  /** True the first time an event id is seen (webhook redelivery dedupe). */
  claimEvent(eventId: string, now: string): Promise<boolean>;
  getRequest(id: string): Promise<DiningRequest | null>;
  getActiveRequest(conversationKey: string, now: string): Promise<DiningRequest | null>;
  /** Active request started by this person in any conversation (for 1:1 questions). */
  getActiveByRequester(requesterKey: string, now: string): Promise<DiningRequest | null>;
  /** Active request of this person that is waiting for their booking name (asked in 1:1). */
  findAwaitingAlias(requesterKey: string, now: string): Promise<DiningRequest | null>;
  findByAttempt(attemptId: string): Promise<DiningRequest | null>;
  /** Saves when the stored revision equals `expectedRevision` (null = new). */
  save(request: DiningRequest, expectedRevision: number | null): Promise<boolean>;
  /** Open requests with a reminder not yet sent (the agent checks which are due). */
  listWithPendingReminders(now: string): Promise<DiningRequest[]>;
  /** Calls placed since `since`, by everyone or by one requester (daily limits). */
  countCallsSince(since: string, requesterKey: string | null): Promise<number>;
  getAlias(requesterKey: string): Promise<string | null>;
  setAlias(requesterKey: string, alias: string): Promise<void>;
  deleteAlias(requesterKey: string): Promise<void>;
}

const ACTIVE_EXCLUDED = new Set(["closed"]);

export function isActive(request: DiningRequest, now: string): boolean {
  return !ACTIVE_EXCLUDED.has(request.status) && Date.parse(request.expiresAt) > Date.parse(now);
}

/** In-process store for local development, the simulator and tests. */
export class MemoryAgentStore implements AgentStore {
  private requests = new Map<string, DiningRequest>();
  private events = new Map<string, string>();
  private aliases = new Map<string, string>();

  async listWithPendingReminders(now: string): Promise<DiningRequest[]> {
    // A booked request keeps its reminders even after a new request closes it (cancel clears them).
    return [...this.requests.values()].filter((request) => request.reservation !== null && Date.parse(request.expiresAt) > Date.parse(now) && (request.reminders ?? []).some((reminder) => reminder.sentAt === null)).map((request) => structuredClone(request));
  }

  async countCallsSince(since: string, requesterKey: string | null): Promise<number> {
    let count = 0;
    for (const request of this.requests.values()) {
      if (requesterKey !== null && request.requesterKey !== requesterKey) continue;
      count += request.attempts.filter((attempt) => Date.parse(attempt.startedAt) >= Date.parse(since)).length;
    }
    return count;
  }

  async claimEvent(eventId: string, now: string): Promise<boolean> {
    if (this.events.has(eventId)) return false;
    this.events.set(eventId, now);
    // Keep memory bounded on a long-running demo server.
    if (this.events.size > 10_000) {
      for (const key of [...this.events.keys()].slice(0, 5_000)) this.events.delete(key);
    }
    return true;
  }

  async getRequest(id: string): Promise<DiningRequest | null> {
    const found = this.requests.get(id);
    return found ? structuredClone(found) : null;
  }

  async getActiveRequest(conversationKey: string, now: string): Promise<DiningRequest | null> {
    return this.latest((request) => request.conversationKey === conversationKey && isActive(request, now));
  }

  async getActiveByRequester(requesterKey: string, now: string): Promise<DiningRequest | null> {
    return this.latest((request) => request.requesterKey === requesterKey && isActive(request, now));
  }

  async findAwaitingAlias(requesterKey: string, now: string): Promise<DiningRequest | null> {
    return this.latest((request) => request.requesterKey === requesterKey && request.pendingQuestion === "alias" && isActive(request, now));
  }

  async findByAttempt(attemptId: string): Promise<DiningRequest | null> {
    return this.latest((request) => request.attempts.some((attempt) => attempt.id === attemptId));
  }

  async save(request: DiningRequest, expectedRevision: number | null): Promise<boolean> {
    const current = this.requests.get(request.id);
    if (expectedRevision === null ? current !== undefined : current?.revision !== expectedRevision) return false;
    this.requests.set(request.id, structuredClone(request));
    return true;
  }

  async getAlias(requesterKey: string): Promise<string | null> {
    return this.aliases.get(requesterKey) ?? null;
  }

  async setAlias(requesterKey: string, alias: string): Promise<void> {
    this.aliases.set(requesterKey, alias);
  }

  async deleteAlias(requesterKey: string): Promise<void> {
    this.aliases.delete(requesterKey);
  }

  private latest(test: (request: DiningRequest) => boolean): DiningRequest | null {
    let found: DiningRequest | null = null;
    for (const request of this.requests.values()) {
      if (test(request) && (!found || Date.parse(request.createdAt) >= Date.parse(found.createdAt))) found = request;
    }
    return found ? structuredClone(found) : null;
  }
}
