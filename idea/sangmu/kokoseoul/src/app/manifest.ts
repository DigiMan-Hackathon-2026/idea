import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DigiMan — ソウルの小さな冒険ガイド",
    short_name: "DigiMan",
    description: "ソウルで、ひとりでも迷わず始められるローカル体験。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f3eb",
    theme_color: "#f7f3eb",
    lang: "ja",
    icons: [
      {
        src: "/pwa-icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
