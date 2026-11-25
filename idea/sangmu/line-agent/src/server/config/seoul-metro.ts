import "server-only";

export function getSeoulMetroServiceKey(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const value = environment.SEOUL_METRO_PUBLIC_DATA_SERVICE_KEY?.trim();
  return value || null;
}
