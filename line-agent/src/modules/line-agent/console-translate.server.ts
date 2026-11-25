import "server-only";

// Japanese subtitles for the operations console: each settled Korean line is
// translated once in the background and cached. The console shows the Korean
// line alone until the translation arrives; nothing here touches the call.
const cache = new Map<string, string>();
const pending = new Set<string>();
const MAX_CACHE = 500;

const model = process.env.OPENAI_TRANSLATE_MODEL ?? "gpt-4.1-mini";

export function translationFor(korean: string): string | null {
  const text = korean.trim();
  if (!text) return null;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && !pending.has(text) && pending.size < 8) {
    pending.add(text);
    void translate(text, apiKey)
      .then((japanese) => {
        if (!japanese) return;
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
        cache.set(text, japanese);
      })
      .catch(() => {})
      .finally(() => pending.delete(text));
  }
  return null;
}

async function translate(text: string, apiKey: string): Promise<string | null> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You translate one line of a Korean phone call between a restaurant and an AI booking assistant into natural Japanese for subtitles. Keep times, numbers and names exactly. Output only the Japanese line.",
        },
        { role: "user", content: text },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const japanese = body.choices?.[0]?.message?.content?.trim();
  return japanese ? japanese.slice(0, 1000) : null;
}
