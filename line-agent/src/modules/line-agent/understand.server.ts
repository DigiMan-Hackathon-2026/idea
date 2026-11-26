import "server-only";

import type { Lang } from "./types";
import { fromModel, understandingPrompt, understandingSchema, type Understanding } from "./understand";

const model = process.env.OPENAI_UNDERSTAND_MODEL ?? "gpt-4.1-mini";

/** Reads a message the rules could not, with OpenAI structured output. null on any failure. */
export function modelReader(apiKey: string) {
  return async (text: string, lang: Lang, now: string): Promise<Understanding | null> => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 300,
        response_format: { type: "json_schema", json_schema: { name: "dining_request", strict: true, schema: understandingSchema } },
        messages: [
          { role: "system", content: understandingPrompt(now) },
          { role: "user", content: text.slice(0, 1000) },
        ],
      }),
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);
    if (!response?.ok) return null;
    const body = (await response.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
    const content = body?.choices?.[0]?.message?.content;
    if (!content) return null;
    try {
      return fromModel(JSON.parse(content), lang);
    } catch {
      return null;
    }
  };
}
