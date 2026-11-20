import { parseAppEnvironment } from "../lib/environment";

export function getApplicationOrigin(
  environment: Readonly<Record<string, string | undefined>>,
): URL {
  const appEnvironment = parseAppEnvironment(environment.APP_ENV);
  const value = environment.APP_ORIGIN;
  if (!value) {
    throw new Error("APP_ORIGIN is required");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_ORIGIN must be a valid absolute origin");
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    value !== url.origin
  ) {
    throw new Error("APP_ORIGIN must not include credentials, path, or query");
  }
  if (appEnvironment !== "local" && url.protocol !== "https:") {
    throw new Error("Non-local APP_ORIGIN must use HTTPS");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APP_ORIGIN must use HTTP or HTTPS");
  }
  return url;
}
