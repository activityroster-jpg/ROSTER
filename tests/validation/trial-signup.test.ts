import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { trialSignupSchema } from "@/lib/validation/signup";

const base = { centreName: "Harbour Sailing", slug: "harbour", ownerEmail: "Owner@Example.com", jurisdiction: "england", acceptedTerms: true } as const;

/** Creating a centre on the website: with a new password, or with a login the person already has. */
describe("trial sign-up input", () => {
  it("accepts a new password, and no password at all (an existing signed-in login owns the centre)", () => {
    expect(trialSignupSchema.safeParse({ ...base, password: "harbour2026" }).success).toBe(true);
    const r = trialSignupSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.password).toBeUndefined(); expect(r.data.ownerEmail).toBe("owner@example.com"); }
  });

  it("still refuses a weak password when one is given", () => {
    expect(trialSignupSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(trialSignupSchema.safeParse({ ...base, password: "onlyletters" }).success).toBe(false);
  });

  it("has a page for the other half of the audience", () => {
    expect(existsSync(join(process.cwd(), "app/(marketing)/instructors/page.tsx"))).toBe(true);
  });
});
