import { randomUUID } from "node:crypto";
import type { LineMessage } from "./types";

export interface LineGateway {
  reply(replyToken: string, messages: LineMessage[]): Promise<void>;
  push(to: string, messages: LineMessage[]): Promise<void>;
  /** Typing indicator in a 1:1 chat while the agent works (best effort). */
  showLoading?(userId: string, seconds: number): Promise<void>;
}

const API = "https://api.line.me/v2/bot/message";

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Messaging API client. Push uses X-Line-Retry-Key so a retried push is not sent twice. */
export class LineMessagingClient implements LineGateway {
  constructor(private readonly accessToken: string) {}

  async reply(replyToken: string, messages: LineMessage[]): Promise<void> {
    if (!replyToken || messages.length === 0) return;
    // A reply token works once, so extra messages beyond 5 are dropped.
    await this.send(`${API}/reply`, { replyToken, messages: messages.slice(0, 5) });
  }

  async push(to: string, messages: LineMessage[]): Promise<void> {
    for (const batch of chunks(messages, 5)) {
      const retryKey = randomUUID();
      for (let attempt = 0; attempt < 3; attempt++) {
        const status = await this.send(`${API}/push`, { to, messages: batch }, retryKey).catch(() => 0);
        // 409 = this retry key was already accepted.
        if ((status >= 200 && status < 300) || status === 409) break;
        if (status >= 400 && status < 500 && status !== 429) throw new Error(`LINE push failed (${status})`);
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  async showLoading(userId: string, seconds: number): Promise<void> {
    await fetch("https://api.line.me/v2/bot/chat/loading/start", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ chatId: userId, loadingSeconds: Math.min(60, Math.max(5, Math.ceil(seconds / 5) * 5)) }),
      signal: AbortSignal.timeout(3_000),
    }).catch(() => undefined);
  }

  private async send(url: string, body: unknown, retryKey?: string): Promise<number> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "content-type": "application/json",
        ...(retryKey ? { "X-Line-Retry-Key": retryKey } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (url.endsWith("/reply") && !response.ok) throw new Error(`LINE reply failed (${response.status})`);
    return response.status;
  }
}

export type RecordedMessage = { at: string; to: string; via: "reply" | "push"; message: LineMessage };

/** Keeps messages in memory instead of sending them (simulator and tests). */
export class RecordingLineGateway implements LineGateway {
  readonly sent: RecordedMessage[] = [];
  private readonly replyTargets = new Map<string, string>();

  constructor(private readonly clock: () => string = () => new Date().toISOString()) {}

  /** The simulator registers which conversation a fake reply token belongs to. */
  registerReplyToken(replyToken: string, to: string): void {
    this.replyTargets.set(replyToken, to);
  }

  async reply(replyToken: string, messages: LineMessage[]): Promise<void> {
    const to = this.replyTargets.get(replyToken) ?? "unknown";
    for (const message of messages.slice(0, 5)) this.sent.push({ at: this.clock(), to, via: "reply", message });
  }

  async push(to: string, messages: LineMessage[]): Promise<void> {
    for (const message of messages) this.sent.push({ at: this.clock(), to, via: "push", message });
  }

  messagesFor(to: string): RecordedMessage[] {
    return this.sent.filter((entry) => entry.to === to);
  }
}
