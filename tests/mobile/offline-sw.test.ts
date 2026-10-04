import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** The offline helper must only ever step in for the instructor's schedule, and never cache a signed-in page. */
describe("offline service worker", () => {
  const src = readFileSync(join(__dirname, "..", "..", "public", "sw.js"), "utf8");
  const handlers: Record<string, (e: unknown) => void> = {};
  const cached: string[] = [];
  const self = { location: { origin: "https://activityroster.com" }, addEventListener: (t: string, fn: (e: unknown) => void) => { handlers[t] = fn; }, skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() } };
  const caches = { open: async () => ({ addAll: async (l: string[]) => { cached.push(...l); } }), keys: async () => [], match: async () => "offline-page", delete: async () => true };
  runInNewContext(src, { self, caches, fetch: () => Promise.reject(new Error("offline")), Response: class { constructor(public body: string) {} }, URL, Promise });

  it("precaches only the static offline page and its script", async () => {
    let waited: Promise<unknown> | null = null;
    handlers.install!({ waitUntil: (p: Promise<unknown>) => { waited = p; } });
    await waited;
    expect(cached).toEqual(["/offline.html", "/offline.js"]);
  });

  it("answers portal navigations when offline and leaves everything else alone", async () => {
    const respond = (url: string, mode = "navigate", method = "GET") => {
      let r: Promise<unknown> | null = null;
      handlers.fetch!({ request: { url, mode, method }, respondWith: (p: Promise<unknown>) => { r = p; } });
      return r;
    };
    expect(await respond("https://activityroster.com/portal")).toBe("offline-page");
    expect(respond("https://activityroster.com/office")).toBeNull();
    expect(respond("https://activityroster.com/portal/hours", "cors")).toBeNull();
    expect(respond("https://activityroster.com/portal", "navigate", "POST")).toBeNull();
    expect(respond("https://evil.example/portal")).toBeNull();
  });
});
