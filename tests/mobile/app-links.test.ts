import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ANDROID_PATH_PREFIXES, APP_LINK_PATHS } from "@/lib/mobile/links";

/**
 * Which links open inside the instructor app. Auth links must not: a centre
 * owner's "confirm my email" and an office invitation open the office, which
 * lives in the browser, and the app signs in with codes instead.
 */
describe("app links", () => {
  it("cover the app's own screens and nothing on the auth or marketing side", () => {
    expect(APP_LINK_PATHS).toContain("/app/*");
    expect(APP_LINK_PATHS).toContain("/portal/*");
    for (const p of APP_LINK_PATHS as readonly string[]) {
      expect(p.startsWith("/api/")).toBe(false);
      expect(["/*", "/"].includes(p)).toBe(false);
    }
  });

  it("match the Android intent filter, path for path", () => {
    const manifest = readFileSync(join(process.cwd(), "mobile/android/app/src/main/AndroidManifest.xml"), "utf8");
    const prefixes = [...manifest.matchAll(/android:pathPrefix="([^"]+)"/g)].map((x) => x[1]);
    expect(prefixes.sort()).toEqual([...ANDROID_PATH_PREFIXES].sort());
    expect(APP_LINK_PATHS.map((p) => p.replace(/\/\*$/, "")).sort()).toEqual([...ANDROID_PATH_PREFIXES].sort());
  });
});
