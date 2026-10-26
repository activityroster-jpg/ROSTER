import { describe, expect, it } from "vitest";
import { goDestination, type GoMembership } from "@/lib/auth/go";

const m = (over: Partial<GoMembership>): GoMembership => ({ organisationId: "o", name: "Harbour", slug: "harbour", role: "instructor", status: "active", orgStatus: "active", ...over });

/** After signing in on the main site, /go routes by what the account actually is. */
describe("goDestination", () => {
  it("sends an owner to their office, and an instructor who asked for the office to their portal instead of a dead end", () => {
    expect(goDestination([m({ role: "owner" })], "office", "ar.test")).toEqual({ kind: "open", url: "https://harbour.ar.test/office" });
    expect(goDestination([m({ role: "instructor" })], "office", "ar.test")).toEqual({ kind: "open", url: "https://harbour.ar.test/portal" });
    expect(goDestination([m({ role: "instructor" })], "portal", "ar.test")).toEqual({ kind: "open", url: "https://harbour.ar.test/portal" });
  });

  it("offers a choice when there is more than one centre, and only office centres for the office", () => {
    const both = [m({ organisationId: "a", slug: "a", role: "owner" }), m({ organisationId: "b", slug: "b", role: "instructor" })];
    expect(goDestination(both, "office", "ar.test")).toEqual({ kind: "open", url: "https://a.ar.test/office" });
    const two = [m({ organisationId: "a", slug: "a", role: "owner" }), m({ organisationId: "b", slug: "b", role: "admin" })];
    const d = goDestination(two, "office", "ar.test");
    expect(d.kind).toBe("choose");
    if (d.kind === "choose") expect(d.centres.map((c) => c.slug)).toEqual(["a", "b"]);
    const p = goDestination(both, "portal", "ar.test");
    expect(p.kind).toBe("choose");
  });

  it("ignores cancelled centres and non-active memberships, and reports who is still deciding", () => {
    const rows = [m({ orgStatus: "cancelled" }), m({ organisationId: "p", name: "Lakeside", status: "requested" }), m({ organisationId: "i", status: "invited" })];
    const d = goDestination(rows, "office", "ar.test");
    expect(d.kind).toBe("none");
    if (d.kind === "none") expect(d.pending.map((x) => x.name)).toEqual(["Lakeside"]);
  });
});
