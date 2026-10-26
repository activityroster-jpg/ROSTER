# Search audience review, 26 October 2026

Conor noticed in Search Console that almost every search the site appeared for was an
instructor looking for their own course ("rya instructor course", "rya first aid
instructor", "rya instructor revalidation"), with no clicks. The site is for the people
who run a centre: Principals, Chief Instructors, centre managers and club officers.
Only "duty roster" was a buyer's search.

## What we found

1. **The words said "instructor".** The home page used "instructor(s)" 23 times and never
   said Principal, Chief Instructor or owner. The blog and guides were the same. Search
   engines decide who a site is for from exactly this.
2. **Instructor-facing titles.** "The RYA Instructor Pathway Explained", "First Aid
   Requirements for Watersports Staff", "Weather Decision-Making for Instructors" and others
   read as advice to an instructor, and ranked for instructor searches.
3. **Blog posts competing with guides** on the same question (how many instructors, tracking
   qualifications, SEO), splitting the site's strength between two pages.
4. **No links from the 100 articles to the 10 software pages** except a generic button. The
   articles are most of the site; they pointed nowhere useful.
5. **Staging was indexable.** Nothing told search engines to ignore staging.activityroster.com,
   so it could be indexed as a copy of the live site and compete with it.
6. No share image, no FAQ markup on guides, and nothing supporting the one buyer search that
   was already appearing ("duty roster").

## What changed

- **Staging is now noindex** on every response and disallowed in robots.txt.
- **Audience language everywhere:** home page hero line and a "Who it's for" section (four
  tiles, each linking to the software page for that person), blog and guides hubs, every
  article and guide page, the site description and keywords, and `audience` in the
  structured data on the home page, software pages, guides and articles.
- **14 articles retitled** for the person running the centre (the pathway and first-aid posts
  also open by saying who they are for). The retitles reach the live blog through
  **Dev Center → Blog → Re-sync content** after the deploy (see below).
- **Every article now ends with "If you run the centre":** the two software pages and two
  guides for its category, linked by their search names. The closing note on every article
  links to the RYA sailing school software page.
- **Three new guides** for principal searches, each with FAQ markup:
  `/guides/how-long-do-rya-instructor-qualifications-last`,
  `/guides/how-to-run-a-sailing-club-duty-rota` (with a free three-sheet duty rota template),
  `/guides/rya-recognition-inspection-what-to-have-ready`. They are linked from the relevant
  software pages and from the article footers.
- **Share image** (`/og/activityroster.png`) on every page; article pages use their cover.
- Software pages carry a real last-changed date in the sitemap instead of "now".

## After the production deploy (Conor)

1. Dev Center → Blog → **Re-sync content**. This copies the new titles and openings into the
   live articles. It also overwrites any article text edited by hand in the Dev Center, so if
   you have hand-edited one, tell Claude first and it will carry your edit into the seed.
2. Search Console → URL inspection → **Request indexing** for: the home page, the three new
   guides, `/sailing-club-duty-roster`, `/rya-qualification-tracking-software` and
   `/sailing-school-compliance-software`. Then Sitemaps → resubmit `sitemap.xml`.
3. If staging.activityroster.com appears in Search Console's pages report, use **Removals →
   New request** for the staging host. The noindex will clear it over time either way.
4. Expect the instructor queries to fade over four to eight weeks and the centre queries to
   grow as the pages are re-crawled. Rankings for "sailing school software"-type terms depend
   on links from other sites as much as on the pages, so the booklet campaign, directory
   listings (RYA-adjacent, UK sailing club directories) and any centre that will link to
   its ActivityRoster guide all count.

## Things not changed on purpose

- Articles were not deleted or hidden from search: they still earn visits from owners
  ("seo for sailing schools", "sailing school business plan") and now lead somewhere.
- No ratio or supervision figures were stated as the RYA's own; the new guides follow the
  existing rule in `lib/seo/guides.ts` and tell readers to check the current RYA guidance.
