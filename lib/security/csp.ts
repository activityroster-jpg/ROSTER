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
 * surfaces. Today it ships REPORT-ONLY: it is evaluated alongside the enforced
 * one and any would-be violation is posted to /api/csp-report and shown in the
 * Dev Center error log. Once a quiet week has passed, enforce it by moving
 * `noncePolicy` into the enforced header in middleware for the app paths.
 *
 * Both headers are set in middleware. On Workers, OpenNext copies every
 * middleware and next.config response header onto the request as well, and
 * Next takes the nonce from the request's `content-security-policy` header
 * before the report-only one, so the enforced policy must carry the nonce or
 * Next never stamps it and every script is reported (6 Oct). `enforcedPolicy`
 * therefore adds the nonce in a `script-src-attr` directive, listed first:
 * Next's parser takes the first directive starting with "script-src", while
 * browsers read `script-src-attr` as governing inline event-handler attributes
 * only (React emits none), so script elements stay governed by the unchanged
 * `script-src`. tests/security/csp.test.ts checks this against Next's own
 * parser, so a Next upgrade that changes it fails CI rather than silently
 * dropping the nonce. Marketing pages are prerendered, so they cannot carry a
 * per-request nonce; they get the static policy only.
 */
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
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  // Only the hosts the browser actually talks to: our own origin, Stripe.js (if
  // ever embedded) and Sentry's EU/US ingest. Everything else is server-side.
  "connect-src 'self' https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://challenges.cloudflare.com",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
  "upgrade-insecure-requests",
].join("; ");

/** The enforced policy; with a nonce (app paths) it also carries the `script-src-attr` nonce described above. */
export function enforcedPolicy(nonce?: string): string {
  return nonce ? `script-src-attr 'nonce-${nonce}'; ${STATIC_POLICY}` : STATIC_POLICY;
}

const APP_PREFIXES = ["/office", "/portal", "/admin", "/app", "/sign-in", "/two-factor", "/pin", "/set-pin", "/security", "/verify-device", "/reset-password"];

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
    "frame-ancestors 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'self' https://challenges.cloudflare.com`,
    "connect-src 'self' https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://challenges.cloudflare.com",
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
    "report-uri /api/csp-report",
  ].join("; ");
}

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
  return `CSP (report-only): ${v.violatedDirective ?? "unknown directive"} blocked ${v.blockedUri ?? "inline"}${where}${v.sample ? ` — “${v.sample}”` : ""}`;
}
