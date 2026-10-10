import { describe, expect, it } from "vitest";
import { isNoAction, letterPrinted, parseProspectStatuses, sizeScore, toggleOutreach, topRanks } from "@/lib/marketing";
import { extractLinkedin } from "@/lib/marketing/linkedin-finder";

describe("outreach tickboxes", () => {
  it("several can be ticked; No action is ticked when none are, and clears them", () => {
    let s = toggleOutreach([], "letter_sent", true);
    s = toggleOutreach(s, "flyer_sent", true);
    expect(s.sort()).toEqual(["flyer_sent", "letter_sent"]);
    expect(isNoAction(s)).toBe(false);
    expect(toggleOutreach(s, "flyer_sent", false)).toEqual(["letter_sent"]);
    const withCall = toggleOutreach(["called", "letter_sent"], null, true);
    expect(withCall).toEqual(["called"]);
    expect(isNoAction(withCall)).toBe(true);
  });

  it("a stored \"new\" means nothing ticked; printed means Ready to send or Letter sent", () => {
    expect(parseProspectStatuses('["new"]', "new")).toEqual([]);
    expect(parseProspectStatuses(null, "letter_sent")).toEqual(["letter_sent"]);
    expect(letterPrinted(["ready_to_send"])).toBe(true);
    expect(letterPrinted(["flyer_sent"])).toBe(false);
  });
});

describe("top 250 by estimated size", () => {
  const p = (id: string, name: string, services: string, extra: Partial<{ region: string; topPick: boolean | null; website: string }> = {}) => ({ id, name, notes: `Services: ${services}. Tel 0`, ...extra });
  it("ranks by the RYA services run, Royal and yacht clubs a little higher", () => {
    expect(sizeScore(p("a", "Big Royal Yacht Club", "Training Centre, Club, ICCTestCentre"))).toBeGreaterThan(sizeScore(p("b", "Small Sailing Club", "Club")));
  });
  it("skips overseas centres, honours pins in and out, and stops at the limit", () => {
    const list = [
      p("1", "Alpha Yacht Club", "Training Centre, Club, ICCTestCentre, OnBoard Club"),
      p("2", "Beta Sailing Club", "Club"),
      p("3", "Gamma Sailing", "Training Centre, Club, ICCTestCentre", { region: "Overseas" }),
      p("4", "Delta Boat Club", "Club", { topPick: true }),
      p("5", "Echo Yacht Club", "Training Centre, Club", { topPick: false }),
    ];
    const r = topRanks(list, 3);
    expect([...r.entries()]).toEqual([["4", 1], ["1", 2], ["2", 3]]);
  });
});

describe("LinkedIn finder", () => {
  it("keeps the first company page and each profile once, ignoring share links", () => {
    const html = `<a href="https://www.linkedin.com/shareArticle?x=1">s</a>
      <a href="https://uk.linkedin.com/company/alpha-yacht-club/">Follow</a>
      <a href="https://www.linkedin.com/company/other">x</a>
      <a href="https://www.linkedin.com/in/jane-smith-1a2b3c">Jane</a>
      <a href="https://linkedin.com/in/jane-smith-1a2b3c/">again</a>`;
    expect(extractLinkedin(html)).toEqual({ companyUrl: "https://www.linkedin.com/company/alpha-yacht-club", people: [{ name: "Jane Smith", role: "", url: "https://www.linkedin.com/in/jane-smith-1a2b3c" }] });
  });
});

describe("LinkedIn finder on a website", () => {
  it("reads the home page, then the contact page it links to", async () => {
    const { findLinkedinOnWebsite } = await import("@/lib/marketing/linkedin-finder");
    const pages: Record<string, string> = {
      "https://alpha-yc.example/": `<a href="https://www.linkedin.com/company/alpha-yc">in</a><a href="/contact-us">Contact</a>`,
      "https://alpha-yc.example/contact-us": `<p>Commodore</p><a href="https://www.linkedin.com/in/sam-jones">Sam</a>`,
    };
    const fake = (async (url: string | URL | Request) => {
      const html = pages[String(url)];
      return new Response(html ?? "", { status: html ? 200 : 404, headers: { "content-type": "text/html" } });
    }) as typeof fetch;
    const found = await findLinkedinOnWebsite("alpha-yc.example", fake);
    expect(found).toEqual({ companyUrl: "https://www.linkedin.com/company/alpha-yc", people: [{ name: "Sam Jones", role: "", url: "https://www.linkedin.com/in/sam-jones" }] });
    expect(await findLinkedinOnWebsite("http://127.0.0.1/admin", fake)).toBeNull();
  });
});
