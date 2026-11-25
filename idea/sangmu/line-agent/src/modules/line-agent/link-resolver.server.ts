import "server-only";

// Follows a NAVER Map or Google Maps short link to the URL it stands for. Only
// redirect headers are read (no page body), only between map hosts, over
// HTTPS, with a short timeout, so a shared link cannot make the server fetch
// arbitrary addresses.
const ALLOWED = /^(naver\.me|maps\.app\.goo\.gl|goo\.gl|app\.goo\.gl|(m\.|pcmap\.)?place\.naver\.com|(m\.)?map\.naver\.com|(www\.|maps\.)?google\.com|(www\.)?google\.co\.kr)$/;
const MAX_HOPS = 4;

function allowed(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED.test(url.hostname.toLowerCase()) && !url.port ? url : null;
  } catch {
    return null;
  }
}

export async function resolveShortLink(start: string): Promise<string | null> {
  let url = allowed(start);
  for (let hop = 0; url && hop < MAX_HOPS; hop++) {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": "Mozilla/5.0 (compatible; line-agent-link-check)" },
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);
    if (!response) return null;
    void response.body?.cancel().catch(() => {});
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) return url.href;
    url = allowed(new URL(location, url).href);
  }
  return url?.href ?? null;
}
