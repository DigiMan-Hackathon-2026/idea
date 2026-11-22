import type { NextConfig } from "next";
import { getApplicationOrigin } from "./src/server/http-config";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async redirects() {
    if (process.env.APP_ENV !== "local" || !process.env.APP_ORIGIN) return [];

    const origin = getApplicationOrigin(process.env);
    const alias = origin.hostname === "localhost" ? "127.0.0.1"
      : origin.hostname === "127.0.0.1" ? "localhost" : null;
    if (!alias) return [];

    const port = origin.port ? `:${origin.port}` : "";
    const aliasHost = alias.replaceAll(".", "\\.") + port;
    return ["/", "/quests/:path*", "/runs/:path*", "/subway", "/station-album", "/my", "/mobile-preview"].map((source) => ({
      source,
      has: [{ type: "header" as const, key: "host", value: aliasHost }],
      destination: `${origin.origin}${source}`,
      permanent: false,
    }));
  },
  async headers() {
    const securityHeaders = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(self)",
      },
    ];
    const privateHtmlSources = ["/", "/quests/:path*", "/runs/:path*", "/my"];
    const phonePreviewEnabled = process.env.NODE_ENV === "development" || process.env.APP_ENV === "preview";
    const phonePreviewSources = phonePreviewEnabled ? [...privateHtmlSources, "/subway", "/station-album"] : [];
    const phoneFrameHeaders = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
      { key: "Cache-Control", value: "private, no-store" },
    ];
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/subway/sign-camera",
        headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" }],
      },
      ...(phonePreviewEnabled ? [{ source: "/mobile-preview/app", headers: phoneFrameHeaders }] : []),
      ...phonePreviewSources.map((source) => ({
        source,
        has: [
          { type: "header" as const, key: "sec-fetch-dest", value: "iframe" },
          { type: "header" as const, key: "sec-fetch-site", value: "same-origin" },
        ],
        headers: phoneFrameHeaders,
      })),
      {
        source: "/quests/:path*",
        headers: [{ key: "Referrer-Policy", value: "origin" }],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
      ...privateHtmlSources.map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      })),
    ];
  },
};

export default nextConfig;
