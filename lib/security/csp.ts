/**
 * Content-Security-Policy for every response, set by middleware.
 *
 * `STATIC_POLICY` is enforced everywhere. It is deliberately pragmatic: it
 * locks the dangerous vectors (framing, object/embed, base-uri, external
 * script origins) while allowing the inline script/style Next.js and Tailwind
 * emit. Stripe Checkout/Portal are full-page redirects, so no embedding is
 * needed.
 *
 * `noncePolicy` is the stricter per-request policy for the signed-in app
 * surfaces, ENFORCED since 13 October 2026 (report-only from 3 October; a week
 * of real use reported nothing of ours). Only scripts carrying the request's
 * nonce run, plus whatever those scripts load ('strict-dynamic'); a blocked
 * script is posted to /api/csp-report and shown in the Dev Center error log.
 * To step back to report-only, set `ENFORCE_NONCE_POLICY` to false below.
 *
 * Middleware sets the header on the response and on the request: Next reads
 * the nonce from the request's `content-security-policy` header and stamps it
 * on its own scripts (tests/security/csp.test.ts checks this against Next's
 * own parser, so a Next upgrade that changes it fails CI rather than silently
 * dropping the nonce). Marketing pages are prerendered, so they cannot carry a
 * per-request nonce; they get the static policy only. So does the Android
 * app: its native shell (Capacitor) injects its bridge as an inline script
 * without a nonce, which the strict policy would block.
 */
export const ENFORCE_NONCE_POLICY = true;

/** The Android app's package id, sent by its WebView as X-Requested-With on every request. */
export const NATIVE_APP_ID = "com.activityroster.app";
export const isNativeAppRequest = (headers: Headers): boolean => headers.get("x-requested-with") === NATIVE_APP_ID;
/** React and Turbopack need eval() in `next dev` only; production never gets it. */
const DEV_EVAL = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
export const STATIC_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Inline scripts are still allowed here because the marketing pages are
  // prerendered; the signed-in app also receives the nonce policy above.
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${DEV_EVAL}`,
  // Only the hosts the browser actually talks to: our own origin, Stripe.js (if
  // ever embedded) and Sentry's EU/US ingest. Everything else is server-side.
  "connect-src 'self' https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://challenges.cloudflare.com",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
  "upgrade-insecure-requests",
].join("; ");

/** The enforced policy: the strict nonce policy on the signed-in surfaces (when a nonce is given), the static one elsewhere. */
export function enforcedPolicy(nonce?: string): string {
  return nonce && ENFORCE_NONCE_POLICY ? noncePolicy(nonce) : STATIC_POLICY;
}

const APP_PREFIXES = ["/office", "/portal", "/admin", "/app", "/sign-in", "/verify-login", "/two-factor", "/pin", "/set-pin", "/security", "/verify-device", "/reset-password"];

export const isNonceCspPath = (path: string): boolean => APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));

export function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}


export function noncePolicy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // 'self' and the host are for browsers without 'strict-dynamic'; with it, only the nonce
    // and what nonced scripts load count (Next's chunks and the Turnstile script both do).
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'self' https://challenges.cloudflare.com${DEV_EVAL}`,
    // The offline-week service worker (public/sw.js); without this it would fall under script-src and be refused.
    "worker-src 'self'",
    "connect-src 'self' https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://challenges.cloudflare.com",
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
    "upgrade-insecure-requests",
    "report-uri /api/csp-report",
  ].join("; ");
}

/** Where a browser's CSP report lands in the error log: the current digest, and the one used while the policy was report-only. */
export const CSP_REPORT_DIGEST = ENFORCE_NONCE_POLICY ? "csp" : "csp-report-only";
export const CSP_REPORT_DIGESTS = ["csp", "csp-report-only"] as const;

export interface CspViolation {
  documentUri: string | null;
  violatedDirective: string | null;
  blockedUri: string | null;
  sourceFile: string | null;
  line: number | null;
  sample: string | null;
}

const str = (v: unknown, max = 500): string | null => (typeof v === "string" && v ? v.slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Normalise a browser CSP report. Accepts the legacy `report-uri` body
 * ({"csp-report": {...}}, kebab-case keys) and the Reporting API body
 * ([{type:"csp-violation", body:{camelCase keys}}]). Unknown shapes → [].
 */
export function parseCspReports(body: unknown): CspViolation[] {
  const out: CspViolation[] = [];
  const push = (r: Record<string, unknown>) => {
    out.push({
      documentUri: str(r["document-uri"] ?? r.documentURL ?? r.documentUri),
      violatedDirective: str(r["violated-directive"] ?? r.effectiveDirective ?? r["effective-directive"] ?? r.violatedDirective, 100),
      blockedUri: str(r["blocked-uri"] ?? r.blockedURL ?? r.blockedUri),
      sourceFile: str(r["source-file"] ?? r.sourceFile),
      line: num(r["line-number"] ?? r.lineNumber),
      sample: str(r["script-sample"] ?? r.sample, 120),
    });
  };
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    if (o["csp-report"] && typeof o["csp-report"] === "object") push(o["csp-report"] as Record<string, unknown>);
    else if (o.body && typeof o.body === "object") push(o.body as Record<string, unknown>);
  } else if (Array.isArray(body)) {
    for (const item of body.slice(0, 20)) {
      if (item && typeof item === "object" && (item as Record<string, unknown>).body && typeof (item as Record<string, unknown>).body === "object") {
        push((item as Record<string, unknown>).body as Record<string, unknown>);
      }
    }
  }
  return out;
}

/** One line for the error log. */
export function describeViolation(v: CspViolation): string {
  const where = v.sourceFile ? ` from ${v.sourceFile}${v.line != null ? `:${v.line}` : ""}` : "";
  return `${ENFORCE_NONCE_POLICY ? "CSP blocked" : "CSP (report-only)"}: ${v.violatedDirective ?? "unknown directive"} blocked ${v.blockedUri ?? "inline"}${where}${v.sample ? ` — “${v.sample}”` : ""}`;
}

export type CspVerdict = "ours" | "cloudflare" | "extension" | "dev" | "third-party";
export interface CspGroup { key: string; directive: string; blocked: string; verdict: CspVerdict; count: number; pages: string[]; last: Date }

export const CSP_VERDICT_TEXT: Record<CspVerdict, string> = {
  ours: "Our own code, and the policy is enforced: this script was refused for that visitor and part of the page may not have worked. Fix first.",
  cloudflare: "Cloudflare's own bot-detection script, which Cloudflare adds to our pages (/cdn-cgi/). Not our code; pages work without it. Nothing to do.",
  extension: "A browser extension on the visitor's computer (password manager, translator, ad blocker) was stopped from touching our pages. Nothing to do.",
  dev: "Developer tools or a local test run. Never happens on the live site for ordinary users. Nothing to do.",
  "third-party": "Something outside ActivityRoster tried to load (often injected by an extension or a network) and was refused. Nothing to do unless it's a service we added on purpose.",
};

/**
 * Sort a stored CSP report (its message, as describeViolation wrote it) into
 * whose it is. Pure: the Dev Center groups the open reports by this.
 */
export function classifyCspMessage(message: string, ownHosts: readonly string[] = ["activityroster.com"]): { directive: string; blocked: string; verdict: CspVerdict } {
  const m = /^CSP(?: \(report-only\)| blocked): (\S+) blocked (\S+)(?: from (\S+?))?(?::\d+)?(?: — .*)?$/.exec(message.trim());
  const directive = m?.[1] ?? "unknown";
  const blockedRaw = m?.[2] ?? "unknown";
  const source = m?.[3] ?? "";
  const isOwn = (u: string) => { try { const h = new URL(u).hostname; return ownHosts.some((o) => h === o || h.endsWith(`.${o}`)); } catch { return false; } };
  const extension = /^(chrome|moz|safari|safari-web|ms-browser)-extension:/i;
  let blocked = blockedRaw;
  try { if (/^https?:/i.test(blockedRaw)) blocked = new URL(blockedRaw).origin; } catch { /* keep as written */ }
  let verdict: CspVerdict;
  if (/\/cdn-cgi\//.test(blockedRaw)) { verdict = "cloudflare"; blocked = "Cloudflare /cdn-cgi/ script"; }
  else if (extension.test(blockedRaw) || extension.test(source)) verdict = "extension";
  else if (blockedRaw === "eval" || /localhost|127\.0\.0\.1|webpack|turbopack/i.test(`${blockedRaw} ${source}`)) verdict = "dev";
  else if (/^https?:/i.test(blockedRaw)) verdict = isOwn(blockedRaw) ? "ours" : "third-party";
  else if (blockedRaw === "inline" || blockedRaw === "data" || blockedRaw === "blob") verdict = source && !isOwn(source) ? "third-party" : "ours";
  else verdict = "third-party";
  return { directive, blocked, verdict };
}

/** Group open CSP reports: one row per directive + blocked source, with counts and pages, our own code first. */
export function groupCspReports(reports: readonly { message: string; path: string | null; createdAt: Date }[], ownHosts?: readonly string[]): CspGroup[] {
  const by = new Map<string, CspGroup>();
  for (const r of reports) {
    const c = classifyCspMessage(r.message, ownHosts);
    const key = `${c.directive}|${c.blocked}|${c.verdict}`;
    const g = by.get(key) ?? { key, directive: c.directive, blocked: c.blocked, verdict: c.verdict, count: 0, pages: [], last: r.createdAt };
    g.count++;
    if (r.path && !g.pages.includes(r.path) && g.pages.length < 5) g.pages.push(r.path);
    if (r.createdAt > g.last) g.last = r.createdAt;
    by.set(key, g);
  }
  const order: CspVerdict[] = ["ours", "third-party", "cloudflare", "extension", "dev"];
  return [...by.values()].sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || b.count - a.count);
}
