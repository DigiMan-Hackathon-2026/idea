import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Keeps the screen-shared demo clean; compile and runtime errors still surface.
  devIndicators: false,
  // The demo opens on the buyer's home.
  redirects() {
    return [{ source: "/", destination: "/buyer", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
