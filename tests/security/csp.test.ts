import { describe, expect, it } from "vitest";
import { describeViolation, isNonceCspPath, makeNonce, noncePolicy, parseCspReports } from "@/lib/security/csp";

describe("nonce CSP", () => {
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
