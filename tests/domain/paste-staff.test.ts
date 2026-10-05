import { describe, expect, it } from "vitest";
import { parsePastedStaff } from "@/lib/domain/paste-staff";

describe("pasting a list of staff", () => {
  it("finds the email wherever it is and keeps the rest as the name", () => {
    const { people, skipped } = parsePastedStaff([
      "Sam Jones, Sam@X.org",
      "Kim Lee <kim@x.org>",
      "jo@x.org\tJo Bloggs",
      "",
      "Alex Volunteer",
      "Sam Again, sam@x.org",
      "  , ;  ",
    ].join("\n"));
    expect(people).toEqual([
      { name: "Sam Jones", email: "sam@x.org" },
      { name: "Kim Lee", email: "kim@x.org" },
      { name: "Jo Bloggs", email: "jo@x.org" },
      { name: "Alex Volunteer", email: null },
    ]);
    expect(skipped).toBe(2);
  });

  it("stops at the limit", () => {
    expect(parsePastedStaff("A\nB\nC", 2)).toEqual({ people: [{ name: "A", email: null }, { name: "B", email: null }], skipped: 1 });
  });
});
