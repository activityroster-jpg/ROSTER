/**
 * App Store / Google Play screenshots of the instructor app, taken from the
 * local demo centre (videos/seed.test.ts) signed in as Kim. Needs the app
 * running locally like the Make videos workflow does (next dev on :8787 and
 * e2e/proxy.mjs on :8788). Env: VIDEO_BASE (default http://demo.localhost:8788),
 * DEV_LOG (the dev server's log, for a sign-in code if one is asked), OUT (the
 * folder to write to, default docs/app-store).
 *
 *   node videos/store-shots.mjs
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.VIDEO_BASE || "http://demo.localhost:8788";
const LOG = process.env.DEV_LOG || "videos-dev.log";
const OUT = process.env.OUT || "docs/app-store";
const PASSWORD = "Manual-Shots-2027!";
const PIN = "4826";
const WHO = "kim@demo.example";

/** Apple's sizes: the pixel size is the CSS viewport × 3. */
/** Each is a tab in App Store Connect's Product Page; the file name says which tab and the pixel size. */
const SIZES = [
  { tag: "tab-iphone-dynamic-island-1206x2622", width: 402, height: 874, scale: 3 },
  { tag: "tab-iphone-duo-2007x2853", width: 669, height: 951, scale: 3 },
  { tag: "tab-ipad-13in-2064x2752", width: 1032, height: 1376, scale: 2 },
  { tag: "iphone69-1320x2868", width: 440, height: 956, scale: 3 },
  { tag: "iphone65-1242x2688", width: 414, height: 896, scale: 3 },
];
const SHOTS = [
  { n: "01-schedule", path: "/portal" },
  { n: "02-availability", path: "/portal/availability" },
  { n: "03-documents", path: "/portal/documents" },
  { n: "04-hours", path: "/portal/hours" },
  { n: "05-settings", path: "/portal/settings" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const latestCode = () => {
  if (!existsSync(LOG)) return null;
  const all = [...readFileSync(LOG, "utf8").matchAll(/(\d{6}) is your ActivityRoster sign-in code/g)];
  return all.length ? all.at(-1)[1] : null;
};

async function signIn(page) {
  await page.goto(`${BASE}/sign-in`);
  await page.fill("input[type=email]", WHO);
  await page.fill("input[type=password]", PASSWORD);
  const before = latestCode();
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
  if (page.url().includes("/verify-login")) {
    // A browser the account has used from a known place skips the code and goes straight to "stay signed in?".
    const stay = page.getByRole("button", { name: /Yes, stay signed in/ });
    const code = page.getByLabel("Code");
    await Promise.race([stay.waitFor({ state: "visible" }), code.waitFor({ state: "visible" })]);
    if (await code.isVisible()) {
      for (let i = 0; i < 240 && (latestCode() === before || !latestCode()); i++) await sleep(500);
      await code.fill(latestCode());
      await page.getByRole("button", { name: "Continue" }).click();
    }
    await stay.click();
    await page.waitForURL((u) => !u.pathname.startsWith("/verify-login"));
  }
  if (page.url().includes("/pin")) {
    await page.locator('input[inputmode="numeric"]').first().fill(PIN);
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => !u.pathname.startsWith("/pin"));
  }
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const wanted = (process.env.SIZES || "").split(",").filter(Boolean);
for (const size of SIZES.filter((s) => wanted.length === 0 || wanted.includes(s.tag))) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.scale, isMobile: true, hasTouch: true, locale: "en-GB", timezoneId: "Europe/London" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120_000);
  await signIn(page);
  for (const shot of SHOTS) {
    await page.goto(`${BASE}${shot.path}`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await sleep(800);
    // The dev server's own badge (bottom-left) is not part of the app.
    await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
    const file = join(OUT, `${size.tag}-${shot.n}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log("wrote", file);
  }
  await ctx.close();
}
await browser.close();
