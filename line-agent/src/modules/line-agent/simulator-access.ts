import { sameToken } from "./tokens";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const LOOPBACK = /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/;

export type RequestOrigin = { host: string | null; forwardedHost: string | null; forwardedFor: string | null; cfConnectingIp: string | null };

function hostName(value: string): string {
  const first = value.split(",")[0].trim();
  return first.startsWith("[") ? first.slice(0, first.indexOf("]") + 1) : first.split(":")[0];
}

/**
 * The simulator can place real calls in twilio mode, so it only answers on the
 * machine itself — unless the request carries the simulator token. Requests
 * through a tunnel (public host name, cf-connecting-ip, non-loopback client)
 * are refused. Next.js adds loopback x-forwarded-* headers itself; those pass.
 */
export function simulatorAllowed(origin: RequestOrigin, token: string | null, expected: string | null): boolean {
  if (expected && token && sameToken(token, expected)) return true;
  if (origin.cfConnectingIp) return false;
  if (!origin.host || !LOCAL_HOSTS.has(hostName(origin.host))) return false;
  if (origin.forwardedHost && !LOCAL_HOSTS.has(hostName(origin.forwardedHost))) return false;
  if (origin.forwardedFor && !origin.forwardedFor.split(",").every((ip) => LOOPBACK.test(ip.trim()))) return false;
  return true;
}

export function requestOrigin(get: (name: string) => string | null): RequestOrigin {
  return { host: get("host"), forwardedHost: get("x-forwarded-host"), forwardedFor: get("x-forwarded-for"), cfConnectingIp: get("cf-connecting-ip") };
}
