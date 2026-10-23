/**
 * The marketing screenshots (lib/screens.ts → public/screens/*.webp), taken from
 * the local demo centre (videos/seed.test.ts) with the app running like the Make
 * videos workflow runs it (next dev on :8787, e2e/proxy.mjs on :8788). Office
 * screens are 1800×1138 (a 1440×910 window at 1.25×), the courses calendar also
 * at 2× for the homepage hero, and the instructor app 780×1688 (a 390×844
 * phone at 2×). Re-run after a visible change so the tour matches the platform.
 *
 *   SEED_DB=<the local D1 sqlite> DEV_LOG=<dev server log> node videos/screens.mjs [ids…]
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import Database from "better-sqlite3";

const LOG = process.env.DEV_LOG || "videos-dev.log";
const OUT = process.env.OUT || "public/screens";
const PASSWORD = "Manual-Shots-2027!";
const PIN = "4826";
const only = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const db = new Database(process.env.SEED_DB, { readonly: true });
const demoOrg = db.prepare("select id from organisation where slug = 'demo'").get().id;
const courseId = (like) => db.prepare("select id from course where organisation_id = ? and name like ? order by created_at limit 1").get(demoOrg, like)?.id;
const kimId = db.prepare("select id from instructor where organisation_id = ? and name like 'Kim%'").get(demoOrg).id;

const HOSTS = {
  demo: { base: "http://demo.localhost:8788", who: "sam@demo.example" },
  kim: { base: "http://demo.localhost:8788", who: "kim@demo.example" },
  fresh: { base: "http://newcentre.localhost:8788", who: "jo@newcentre.example" },
};

/** Each screen: where it lives, who sees it, and anything to do before the shot. */
const SHOTS = [
  { id: "onboarding", host: "fresh", path: "/office/onboarding" },
  { id: "dashboard", host: "demo", path: "/office" },
  { id: "problems", host: "demo", path: "/office/rota", prep: async (p) => { const s = p.locator("summary", { hasText: /problem/ }).first(); if (await s.count()) await s.click(); } },
  { id: "board", host: "demo", path: "/office/rota" },
  { id: "board-people", host: "demo", path: "/office/rota", prep: async (p) => { await p.getByRole("tab", { name: "People × days" }).click(); } },
  { id: "rota", host: "demo", path: "/office/rota?view=print" },
  { id: "courses", host: "demo", path: "/office/courses" },
  { id: "courses@2x", host: "demo", path: "/office/courses", size: { width: 1360, height: 860, scale: 2 } },
  { id: "course-setup", host: "demo", path: "/office/course-setup" },
  { id: "course-detail", host: "demo", path: () => `/office/courses/${courseId("Powerboat%")}` },
  { id: "course-detail-staff", host: "demo", path: () => `/office/courses/${courseId("%Camp%") ?? courseId("%")}` },
  { id: "import", host: "demo", path: "/office/import" },
  { id: "integrations", host: "demo", path: "/office/integrations" },
  { id: "staff", host: "demo", path: "/office/staff" },
  { id: "staff-import", host: "demo", path: "/office/staff/import" },
  { id: "staff-profile", host: "demo", path: () => `/office/staff/${kimId}` },
  { id: "availability", host: "demo", path: "/office/availability" },
  { id: "leave", host: "demo", path: "/office/leave" },
  { id: "payroll", host: "demo", path: "/office/finance" },
  { id: "equipment", host: "demo", path: "/office/equipment" },
  { id: "locations", host: "demo", path: "/office/locations" },
  { id: "settings", host: "demo", path: "/office/settings" },
  { id: "billing", host: "demo", path: "/office/billing" },
  { id: "emergency", host: "demo", path: "/office/rota/emergency" },
  { id: "security", host: "demo", path: "/security" },
  { id: "help", host: "demo", path: "/office", prep: async (p) => { await p.getByRole("button", { name: "Help" }).click(); await p.waitForTimeout(500); const box = p.getByPlaceholder("Ask a question…"); await box.fill("How do I confirm a day?"); await box.press("Enter"); await p.waitForTimeout(4000); } },
  { id: "app-home", host: "kim", path: "/portal", phone: true },
  { id: "app-availability", host: "kim", path: "/portal/availability", phone: true },
  { id: "app-hours", host: "kim", path: "/portal/hours", phone: true },
  { id: "app-documents", host: "kim", path: "/portal/documents", phone: true },
  { id: "app-leave", host: "kim", path: "/portal/leave", phone: true },
  { id: "app-notifications", host: "kim", path: "/portal/notifications", phone: true },
];

const latestCode = () => { if (!existsSync(LOG)) return null; const all = [...readFileSync(LOG, "utf8").matchAll(/(\d{6}) is your ActivityRoster sign-in code/g)]; return all.length ? all.at(-1)[1] : null; };

async function signIn(page, base, who) {
  await page.goto(`${base}/sign-in`);
  await page.fill("input[type=email]", who);
  await page.fill("input[type=password]", PASSWORD);
  const before = latestCode();
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
  if (page.url().includes("/two-factor")) {
    // A login with the second step on: the emailed code is the newest six digits in the log.
    let code = null;
    for (let i = 0; i < 240 && !code; i++) { const tail = readFileSync(LOG, "utf8").slice(-6000); const m = [...tail.matchAll(/\b(\d{6})\b/g)]; const c = m.length ? m.at(-1)[1] : null; if (c && c !== before) code = c; else await sleep(500); }
    await page.locator('input[inputmode="numeric"]').first().fill(code);
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => !u.pathname.startsWith("/two-factor"));
  }
  if (page.url().includes("/verify-login")) {
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
const pages = new Map();
const pageFor = async (host, phone, size) => {
  const key = `${host}:${phone ? "phone" : size ? `${size.width}x${size.height}@${size.scale}` : "desk"}`;
  if (pages.has(key)) return pages.get(key);
  const vp = phone ? { width: 390, height: 844 } : size ? { width: size.width, height: size.height } : { width: 1440, height: 910 };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: phone ? 2 : size ? size.scale : 1.25, isMobile: phone, hasTouch: phone, locale: "en-GB", timezoneId: "Europe/London" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120_000);
  await signIn(page, HOSTS[host].base, HOSTS[host].who);
  pages.set(key, page);
  return page;
};

let done = 0, failed = [];
for (const shot of SHOTS) {
  if (only.length && !only.includes(shot.id)) continue;
  try {
    const page = await pageFor(shot.host, shot.phone, shot.size);
    const path = typeof shot.path === "function" ? shot.path() : shot.path;
    await page.goto(`${HOSTS[shot.host].base}${path}`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await sleep(800);
    if (shot.prep) await shot.prep(page);
    await page.waitForLoadState("networkidle").catch(() => {});
    await sleep(500);
    await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
    const png = await page.screenshot({ fullPage: false });
    const target = shot.phone ? { width: 780, height: 1688 } : shot.size ? { width: shot.size.width * shot.size.scale, height: shot.size.height * shot.size.scale } : { width: 1800, height: 1138 };
    await sharp(png).resize(target.width, target.height, { fit: "cover", position: "top" }).webp({ quality: 84 }).toFile(join(OUT, `${shot.id}.webp`));
    done++;
    console.log("wrote", `${shot.id}.webp`, page.url());
  } catch (e) {
    failed.push(shot.id);
    console.error("FAILED", shot.id, String(e).split("\n")[0]);
  }
}
await browser.close();
console.log(`done ${done}, failed ${failed.length}${failed.length ? ": " + failed.join(", ") : ""}`);
