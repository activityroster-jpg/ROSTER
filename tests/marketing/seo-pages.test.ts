import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { LANDINGS, landingBySlug } from "@/lib/seo/landings";
import { GUIDES, guideBySlug } from "@/lib/seo/guides";
import { SCREENS } from "@/lib/screens";
import { SECTIONS } from "@/lib/learn/sections";
import { CATEGORY_LINKS, relatedForCategory } from "@/lib/blog/related";
import { SEED_ARTICLES } from "@/lib/blog/seed";
import { OG_IMAGE } from "@/lib/seo/og";

const learnIds = new Set(SECTIONS.map((s) => s.id));

describe("search pages", () => {
  it("each has its own route, a unique slug and a unique title", () => {
    expect(new Set(LANDINGS.map((l) => l.slug)).size).toBe(LANDINGS.length);
    expect(new Set(LANDINGS.map((l) => l.title)).size).toBe(LANDINGS.length);
    for (const l of LANDINGS) expect(existsSync(join(process.cwd(), "app/(marketing)", l.slug, "page.tsx")), l.slug).toBe(true);
  });

  it("the two pillars come first", () => {
    expect(LANDINGS.slice(0, 2).map((l) => l.keyword)).toEqual(["RYA sailing school software", "RYA staff rostering software"]);
  });

  it("links only to screens, guides, pages and Learning Centre topics that exist", () => {
    for (const l of LANDINGS) {
      for (const id of [l.heroScreen, ...l.screens]) expect(SCREENS[id], `${l.slug} → ${id}`).toBeTruthy();
      for (const g of l.guides) expect(guideBySlug(g), `${l.slug} → guide ${g}`).toBeTruthy();
      for (const r of l.related) expect(landingBySlug(r), `${l.slug} → page ${r}`).toBeTruthy();
      expect(learnIds.has(l.learn), `${l.slug} → learn ${l.learn}`).toBe(true);
    }
  });

  it("keeps meta descriptions within what search engines show", () => {
    for (const l of LANDINGS) expect(l.description.length, l.slug).toBeLessThanOrEqual(200);
    for (const g of GUIDES) expect(g.description.length, g.slug).toBeLessThanOrEqual(200);
  });
});

describe("guides", () => {
  it("link to real pages, guides and topics, and downloads exist", () => {
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(GUIDES.length);
    for (const g of GUIDES) {
      expect(landingBySlug(g.landing), `${g.slug} → ${g.landing}`).toBeTruthy();
      expect(learnIds.has(g.learn), `${g.slug} → learn ${g.learn}`).toBe(true);
      for (const r of g.related) expect(guideBySlug(r), `${g.slug} → ${r}`).toBeTruthy();
      if (g.download) expect(existsSync(join(process.cwd(), "public", g.download.href)), g.download.href).toBe(true);
    }
  });

  it("never present an example ratio as the RYA's own figure", () => {
    const ratios = guideBySlug("how-many-instructors-do-i-need-for-an-rya-course")!;
    const table = ratios.blocks.find((b) => b.kind === "table");
    expect(table && table.kind === "table" ? table.caption : "").toMatch(/example ratios/i);
  });
});

describe("written for the people who run the centre", () => {
  it("every blog category leads to real software pages and guides", () => {
    for (const a of SEED_ARTICLES) expect(CATEGORY_LINKS[a.category], a.category).toBeTruthy();
    for (const [cat, links] of Object.entries(CATEGORY_LINKS)) {
      for (const slug of links.landings) expect(landingBySlug(slug), `${cat} → ${slug}`).toBeTruthy();
      for (const slug of links.guides) expect(guideBySlug(slug), `${cat} → ${slug}`).toBeTruthy();
      expect(relatedForCategory(cat).landings.length).toBe(links.landings.length);
    }
    // A hand-written post with its own category still gets the pillar pages.
    expect(relatedForCategory("Something else").landings[0]?.slug).toBe("rya-sailing-school-software");
  });

  it("article titles speak to the centre, not to instructors or learners", () => {
    for (const a of SEED_ARTICLES) expect(a.title, a.slug).not.toMatch(/\bfor (instructors|sailors|learners|students)\b/i);
  });

  it("guide FAQs are real questions with answers, and the share image exists", () => {
    for (const g of GUIDES) {
      for (const f of g.faqs ?? []) {
        expect(f.q.trim().endsWith("?"), `${g.slug}: ${f.q}`).toBe(true);
        expect(f.a.length, `${g.slug}: ${f.q}`).toBeGreaterThan(40);
      }
    }
    expect(existsSync(join(process.cwd(), "public", OG_IMAGE.url))).toBe(true);
  });
});
