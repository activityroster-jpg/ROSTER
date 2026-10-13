import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/** Runs only the video seed (npm run videos:seed). */
export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, "..") } },
  test: { environment: "node", include: ["videos/seed.test.ts"], root: resolve(__dirname, ".."), testTimeout: 120_000 },
});
