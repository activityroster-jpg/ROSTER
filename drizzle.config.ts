import { defineConfig } from "drizzle-kit";

/**
 * Single multi-tenant D1 (SQLite) database. One schema, one migration path.
 * Migrations are generated here and applied on deploy via wrangler.
 */
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./lib/db/schema/index.ts",
  out: "./lib/db/migrations",
  verbose: true,
  strict: true,
});
