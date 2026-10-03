/**
 * Nonce-based Content-Security-Policy for the signed-in app surfaces.
 *
 * Today it ships REPORT-ONLY: the enforced policy (next.config) still allows
 * inline scripts, while this stricter one is evaluated alongside it and any
 * would-be violation is posted to /api/csp-report and shown in the Dev Center
 * error log. Once a quiet week has passed, enforce it by moving `noncePolicy`
 * into the enforced header in middleware and dropping 'unsafe-inline' from
 * script-src in next.config.
 *
 * Marketing pages are prerendered, so they cannot carry a per-request nonce;
 * they keep the static policy and are not covered here.
 */
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
