import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DigiMan — ソウルの小さな冒険ガイド",
    short_name: "DigiMan",
    description: "ソウルで、ひとりでも迷わず始められるローカル体験。",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3eb",
    theme_color: "#f7f3eb",
    lang: "ja",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
