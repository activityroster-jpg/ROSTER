import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/** Runs only the browser-test seed (npm run e2e:seed). */
export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, "..") } },
  test: { environment: "node", include: ["e2e/seed.test.ts"], root: resolve(__dirname, "..") },
});
