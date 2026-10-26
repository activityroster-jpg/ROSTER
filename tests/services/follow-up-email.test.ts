import { describe, expect, it } from "vitest";
import { followUpEmail, LEARN_URL } from "@/lib/marketing-email/follow-up";

/** Each centre's follow-up is its own note: named, placed, one link, an opt-out, stable for the same centre. */
describe("booklet follow-up email", () => {
  const centres = Array.from({ length: 30 }, (_, i) => ({ id: `id-${i}-${(i * 7919).toString(36)}`, name: `Centre ${i}`, city: i % 3 ? `Town ${i}` : null, region: "Wales", contactName: i % 2 ? `Sam Taylor` : null, services: i % 4 ? ["Training Centre", "Club"] : [], bookletSentOn: "2026-10-12" }));

  it("names the centre, links the Learning Centre once and offers an opt-out", () => {
    for (const c of centres) {
      const e = followUpEmail(c);
      expect(e.subject).toContain(c.name);
      expect(e.body).toContain(c.name);
      expect(e.body.split(LEARN_URL)).toHaveLength(2);
      expect(e.body).toMatch(/won't email again|leave it there|last of it/);
      expect(e.body).toMatch(c.contactName ? /^Hi Sam,/ : /^Hello Centre \d+ team,/);
    }
  });

  it("gives thirty centres thirty different emails, and the same centre the same email twice", () => {
    const bodies = centres.map((c) => followUpEmail(c).body);
    expect(new Set(bodies).size).toBe(30);
    // Beyond the name: the wording itself varies across the set.
    const shapes = new Set(centres.map((c) => followUpEmail(c).body.replace(new RegExp(`${c.name}|Town \\d+`, "g"), "X")));
    expect(shapes.size).toBeGreaterThan(10);
    expect(followUpEmail(centres[3]!)).toEqual(followUpEmail(centres[3]!));
  });
});
