import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    exclude: ["node_modules/**", "e2e/**", ".claude/**"],
    coverage: {
      provider: "v8",
      include: ["lib/domain/**/*.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: { lines: 90 },
    },
  },
});
