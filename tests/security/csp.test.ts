import { describe, expect, it } from "vitest";
import { getScriptNonceFromHeader } from "next/dist/server/app-render/get-script-nonce-from-header";
import { STATIC_POLICY, describeViolation, enforcedPolicy, isNonceCspPath, makeNonce, noncePolicy, parseCspReports } from "@/lib/security/csp";

describe("nonce CSP", () => {
  it("keeps the enforced static policy pragmatic and framing-proof", () => {
    expect(STATIC_POLICY).toContain("frame-ancestors 'none'");
    expect(STATIC_POLICY).toContain("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com");
    expect(STATIC_POLICY).toContain("object-src 'none'");
    expect(STATIC_POLICY).not.toContain("nonce-");
    expect(enforcedPolicy()).toBe(STATIC_POLICY);
  });

  it("hands Next the nonce through the enforced header without changing script-src", () => {
    // OpenNext copies response headers onto the request and Next reads the
    // enforced header first (lib/security/csp.ts), so the nonce must be found
    // there by Next's own parser, and only in a directive browsers do not
    // apply to script elements.
    const n = makeNonce();
    const p = enforcedPolicy(n);
    expect(getScriptNonceFromHeader(p)).toBe(n);
    expect(getScriptNonceFromHeader(STATIC_POLICY)).toBeUndefined();
    expect(p.startsWith(`script-src-attr 'nonce-${n}'; `)).toBe(true);
    expect(p).toContain("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com");
    expect(p.split("'nonce-").length).toBe(2);
  });

  it("covers the signed-in surfaces and not the marketing site", () => {
    for (const p of ["/office", "/office/courses", "/portal/leave", "/admin/security", "/app/join", "/sign-in", "/two-factor"]) expect(isNonceCspPath(p)).toBe(true);
    for (const p of ["/", "/pricing", "/learn", "/blog/x", "/api/auth/x", "/.well-known/assetlinks.json", "/applications"]) expect(isNonceCspPath(p)).toBe(false);
  });

  it("builds a strict-dynamic policy carrying the nonce and a report target", () => {
    const n = makeNonce();
    expect(n.length).toBeGreaterThanOrEqual(22);
    const p = noncePolicy(n);
    expect(p).toContain(`script-src 'nonce-${n}' 'strict-dynamic'`);
    expect(p).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(p).toContain("report-uri /api/csp-report");
  });

  it("parses legacy and Reporting-API bodies", () => {
    const legacy = parseCspReports({ "csp-report": { "document-uri": "https://x.activityroster.com/office", "violated-directive": "script-src-elem", "blocked-uri": "inline", "source-file": "https://x.activityroster.com/office", "line-number": 12, "script-sample": "window.__x" } });
    expect(legacy).toHaveLength(1);
    expect(legacy[0]!.violatedDirective).toBe("script-src-elem");
    expect(describeViolation(legacy[0]!)).toBe("CSP (report-only): script-src-elem blocked inline from https://x.activityroster.com/office:12 — “window.__x”");

    const modern = parseCspReports([{ type: "csp-violation", body: { documentURL: "https://x/portal", effectiveDirective: "connect-src", blockedURL: "https://evil.example" } }]);
    expect(modern).toHaveLength(1);
    expect(modern[0]!.blockedUri).toBe("https://evil.example");

    expect(parseCspReports("nope")).toEqual([]);
    expect(parseCspReports(null)).toEqual([]);
  });
});
