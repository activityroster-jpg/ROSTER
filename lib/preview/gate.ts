/**
 * "Coming soon" gate for the public website (decided 5 Oct). The marketing
 * pages on the apex (home, pricing, compare, blog, demo, contact, sign-up)
 * show a Coming soon page until the visitor enters the preview PIN. The app,
 * sign-in, legal and privacy pages, the Learning Centre (the app links to it)
 * and every centre subdomain stay open. Only a SHA-256 of the PIN is kept here;
 * set PREVIEW_PIN_SHA256 on the Worker to change it, or PREVIEW_GATE=off to open
 * the site.
 */

export const PREVIEW_COOKIE = "ar_preview";
export const PREVIEW_MAX_AGE_S = 60 * 60 * 24 * 30;
const DEFAULT_PIN_SHA256 = "96cae35ce8a9b0244178bf28e4966c2ce1b8385723a96a6b838858cdd6ca0a1e";

const GATED = ["/", "/pricing", "/compare", "/blog", "/book", "/demo", "/contact", "/signup"];

export function previewGateOn(): boolean {
  return (process.env.PREVIEW_GATE ?? "on").toLowerCase() !== "off";
}

/** Is this public page behind the Coming soon gate? */
export function isPreviewGated(path: string): boolean {
  return GATED.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(`${p}/`)));
}

function pinHash(): string {
  const h = (process.env.PREVIEW_PIN_SHA256 ?? "").trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(h) ? h : DEFAULT_PIN_SHA256;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function pinMatches(pin: string): Promise<boolean> {
  return /^\d{4,12}$/.test(pin) && (await sha256Hex(pin)) === pinHash();
}

/** The cookie value that proves the PIN was entered. Changing the PIN invalidates every old cookie. */
export async function previewToken(): Promise<string> {
  return sha256Hex(`ar-preview-v1:${pinHash()}`);
}

/** Where to send someone after the PIN: a same-site path only. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next.slice(0, 300) : "/";
}
