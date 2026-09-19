import { describe, expect, it } from "vitest";
import { resolveHost } from "@/lib/tenant/host";
import { validateSlug, isReservedSubdomain } from "@/lib/tenant/reserved";

const APEX = "activityroster.com";

describe("resolveHost", () => {
  it("treats the apex as marketing", () => {
    expect(resolveHost("activityroster.com", APEX)).toEqual({ kind: "apex" });
  });

  it("treats www as reserved", () => {
    expect(resolveHost("www.activityroster.com", APEX)).toEqual({ kind: "reserved", label: "www" });
  });

  it("resolves a centre subdomain to a tenant", () => {
    expect(resolveHost("alpha.activityroster.com", APEX)).toEqual({ kind: "tenant", slug: "alpha" });
  });

  it("strips the port and lowercases", () => {
    expect(resolveHost("Alpha.activityroster.com:8787", APEX)).toEqual({ kind: "tenant", slug: "alpha" });
  });

  it("flags reserved subdomains, not tenants", () => {
    expect(resolveHost("api.activityroster.com", APEX)).toEqual({ kind: "reserved", label: "api" });
    expect(resolveHost("admin.activityroster.com", APEX)).toEqual({ kind: "reserved", label: "admin" });
  });

  it("rejects nested labels and foreign hosts as unknown", () => {
    expect(resolveHost("a.b.activityroster.com", APEX).kind).toBe("unknown");
    expect(resolveHost("example.com", APEX).kind).toBe("unknown");
    expect(resolveHost(null, APEX).kind).toBe("unknown");
  });
});

describe("validateSlug", () => {
  it("accepts a valid slug", () => {
    expect(validateSlug("my-centre")).toEqual({ ok: true, slug: "my-centre" });
  });

  it("lowercases before validating", () => {
    expect(validateSlug("MyCentre")).toEqual({ ok: true, slug: "mycentre" });
  });

  it("rejects reserved names", () => {
    expect(validateSlug("api")).toEqual({ ok: false, reason: "reserved" });
    expect(isReservedSubdomain("ADMIN")).toBe(true);
  });

  it("rejects bad formats", () => {
    expect(validateSlug("ab").ok).toBe(false); // too short
    expect(validateSlug("-lead").ok).toBe(false);
    expect(validateSlug("has space").ok).toBe(false);
    expect(validateSlug("under_score").ok).toBe(false);
  });
});
