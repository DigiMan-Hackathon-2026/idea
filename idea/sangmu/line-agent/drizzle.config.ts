import { defineConfig } from "drizzle-kit";
import { getSafeMigrationDatabaseUrl } from "./src/db/config";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getSafeMigrationDatabaseUrl(process.env),
  },
  strict: true,
  verbose: true,
});
