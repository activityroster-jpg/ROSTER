import { expect, test, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { E2E } from "./fixtures";

/**
 * The roster's main path, in a real browser: sign in, assign someone with the
 * keyboard, confirm the day, see it as Confirmed in the instructor's app, undo
 * it and see it go back to Pending.
 */

const LOG = process.env.E2E_DEV_LOG ?? "e2e-dev.log";
// On a local run no email is sent; the server log carries the sign-in code's subject line.
const latestCode = (): string | null => {
  const all = [...readFileSync(LOG, "utf8").matchAll(/(\d{6}) is your ActivityRoster sign-in code/g)];
  return all.length ? all[all.length - 1]![1]! : null;
};

/** Scripts the strict Content-Security-Policy refused, as the browser logs them: any one fails the test. */
const cspRefusals: string[] = [];
async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  page.on("console", (m) => { if (/Content.Security.Policy|Refused to (execute|load|create)/i.test(m.text())) cspRefusals.push(`${page.url()}: ${m.text().slice(0, 300)}`); });
  await page.goto(`${E2E.base}/sign-in`);
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", E2E.password);
  const before = latestCode();
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
  if (page.url().includes("/verify-login")) {
    await expect.poll(() => latestCode() !== before && latestCode() !== null, { timeout: 60_000 }).toBe(true);
    await page.getByLabel("Code").fill(latestCode()!);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Yes, stay signed in/ }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/verify-login"));
  }
  if (page.url().includes("/pin")) {
    await page.locator('input[inputmode="numeric"]').first().fill(E2E.pin);
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => !u.pathname.startsWith("/pin"));
  }
  return page;
}

const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]} ${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}`;
};

test("assign, confirm the day, see it confirmed in the app, undo", async ({ browser }) => {
  const office = await signIn(browser, E2E.owner);
  await expect(office).toHaveURL(/\/office/);

  // The roster for the test week: the day starts Pending.
  await office.goto(`${E2E.base}/office/rota?week=${E2E.day}`);
  const day = office.locator("li", { hasText: dayLabel(E2E.day) }).first();
  await expect(day).toContainText("Pending");

  // Assign Kim from the people picker, by keyboard.
  await office.getByText(E2E.course).first().click();
  const picker = office.getByRole("button", { name: /^Who for / }).first();
  await picker.focus();
  await office.keyboard.press("ArrowDown");
  await expect(office.getByRole("option", { name: /Kim Instructor/ })).toBeVisible();
  await office.keyboard.press("Enter");
  await expect(picker).toContainText("Kim Instructor");
  await office.getByRole("button", { name: /^Assign/ }).first().click();
  await expect(office.getByText("Every place filled").first()).toBeVisible();

  // The course's own page opens and shows who is on it (it once crashed on the server).
  await office.getByRole("link", { name: /Open the course/ }).first().click();
  await expect(office.getByRole("heading", { name: E2E.course })).toBeVisible();
  await expect(office.getByText("Kim Instructor").first()).toBeVisible();
  await expect(office.getByText("Something went wrong")).toHaveCount(0);

  // The instructor sees it straight away, as Pending.
  const app = await signIn(browser, E2E.instructor);
  await app.goto(`${E2E.base}/portal`);
  await expect(app.getByText(E2E.course).first()).toBeVisible();
  await expect(app.getByText(/Pending: your centre hasn.t confirmed this day yet/).first()).toBeVisible();

  // Confirm the day: it shows Confirmed, and so does the app.
  await office.goto(`${E2E.base}/office/rota?week=${E2E.day}`);
  // Kim's licence has no expiry date, so confirming warns first; go ahead.
  await expect(day).toContainText("1 licence undated");
  await day.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(office.getByText(/No expiry date recorded on any licence for Kim Instructor/)).toBeVisible();
  await office.getByRole("button", { name: "Yes, go ahead" }).click();
  await expect(office.getByText(/1 day confirmed/)).toBeVisible();
  await expect(day).toContainText("Confirmed");
  await app.reload();
  await expect(app.getByText("✓ Confirmed").first()).toBeVisible();

  // Undo: back to Pending, nobody told.
  await day.getByRole("button", { name: "Undo" }).click();
  await office.getByRole("button", { name: "Yes, go ahead" }).click();
  await expect(day).toContainText("Pending");
  await app.reload();
  await expect(app.getByText(/Pending: your centre hasn.t confirmed this day yet/).first()).toBeVisible();

  // The strict CSP is enforced on every page above: nothing of ours may have been refused.
  expect(cspRefusals).toEqual([]);
});
