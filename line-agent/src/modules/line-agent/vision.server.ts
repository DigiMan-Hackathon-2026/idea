import "server-only";

import { visionPrompt, visionSchema, visionText } from "./vision";

const model = process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini";

function mediaType(image: Buffer): string {
  if (image[0] === 0x89 && image[1] === 0x50) return "image/png";
  if (image[0] === 0x52 && image[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

/** Reads a photo with a vision model (form only); null on any failure so the caller can fall back. */
export function visionReader(apiKey: string) {
  return async (image: Buffer): Promise<string | null> => {
    if (image.length === 0 || image.length > 5 * 1024 * 1024) return null;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 400,
        response_format: { type: "json_schema", json_schema: { name: "photo", strict: true, schema: visionSchema } },
        messages: [
          { role: "system", content: visionPrompt },
          { role: "user", content: [{ type: "image_url", image_url: { url: `data:${mediaType(image)};base64,${image.toString("base64")}`, detail: "high" } }] },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!response?.ok) return null;
    const body = (await response.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
    const content = body?.choices?.[0]?.message?.content;
    if (!content) return null;
    try {
      return visionText(JSON.parse(content));
    } catch {
      return null;
    }
  };
}
