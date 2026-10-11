import { describe, expect, it } from "vitest";
import { matchProspect, mergeLinkedin, normName, parseLinkedinSheet } from "@/lib/marketing/linkedin-import";

const HEAD = ["name", "postcode", "linkedin", "contact", "role", "contact LinkedIn", "contact confidence", "contact 2", "contact 2 role", "contact 2 LinkedIn", "contact 2 confidence", "notes"];

describe("parseLinkedinSheet", () => {
  it("reads the page and people by heading, marks low-confidence people and skips empty rows", () => {
    const rows = parseLinkedinSheet([
      HEAD,
      ["Sea School", "TR1 1AA", "linkedin.com/company/sea-school/", "Ann Lee", "Principal", "https://www.linkedin.com/in/ann", "high", "Bob Ray", "Safety", "", "low", "x"],
      ["Quiet Club", "TR2 2BB", "", "", "", "", "", "", "", "", "", "nothing found"],
      ["Bad Link Club", "", "https://example.com/not-linkedin", "", "", "", "", "", "", "", "", ""],
    ]);
    expect(rows).toEqual([{
      name: "Sea School", postcode: "TR1 1AA", pageUrl: "https://linkedin.com/company/sea-school/",
      contacts: [{ name: "Ann Lee", role: "Principal", url: "https://www.linkedin.com/in/ann" }, { name: "Bob Ray", role: "Safety (unconfirmed)", url: "" }],
    }]);
  });
  it("needs a name column", () => expect(parseLinkedinSheet([["centre"], ["x"]])).toEqual([]));
});

describe("matchProspect", () => {
  const ps = [
    { id: "1", name: "Bay Sailing Club", postcode: "AB1 1AA" },
    { id: "2", name: "Bay Sailing Club", postcode: "CD2 2BB" },
    { id: "3", name: "Lake & Sail", postcode: null },
  ];
  const by = new Map<string, typeof ps>();
  for (const p of ps) by.set(normName(p.name), [...(by.get(normName(p.name)) ?? []), p]);
  const row = (name: string, postcode = "") => ({ name, postcode, pageUrl: "", contacts: [] });
  it("matches by name, and by postcode when two share a name", () => {
    expect(matchProspect(row("Lake and Sail"), by)?.id).toBe("3");
    expect(matchProspect(row("bay sailing club", "cd22bb"), by)?.id).toBe("2");
    expect(matchProspect(row("Bay Sailing Club"), by)).toBeNull();
    expect(matchProspect(row("Nowhere"), by)).toBeNull();
  });
});

describe("mergeLinkedin", () => {
  it("adds new people, fills a missing link, never duplicates or removes", () => {
    const current = { pageUrl: "https://linkedin.com/company/old", contacts: [{ name: "Ann Lee", role: "", url: "" }, { name: "Kept", role: "Chair", url: "" }] };
    const m = mergeLinkedin(current, { name: "x", postcode: "", pageUrl: "", contacts: [{ name: "ann lee", role: "Principal", url: "https://linkedin.com/in/ann" }, { name: "New Person", role: "", url: "" }] });
    expect(m.pageUrl).toBe("https://linkedin.com/company/old");
    expect(m.pageChanged).toBe(false);
    expect(m.contacts).toEqual([{ name: "Ann Lee", role: "Principal", url: "https://linkedin.com/in/ann" }, { name: "Kept", role: "Chair", url: "" }, { name: "New Person", role: "", url: "" }]);
    expect(m.added).toBe(2);
    const again = mergeLinkedin({ pageUrl: m.pageUrl, contacts: m.contacts }, { name: "x", postcode: "", pageUrl: "https://linkedin.com/company/old", contacts: [{ name: "New Person", role: "", url: "" }] });
    expect(again.added).toBe(0);
    expect(again.pageChanged).toBe(false);
  });
});
