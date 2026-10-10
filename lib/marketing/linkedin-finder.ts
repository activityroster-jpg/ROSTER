import { assertSafeFeedUrl } from "@/lib/integrations/url-guard";
import type { PlatformRepository } from "@/lib/db/repositories/platform";
import { parseLinkedinContacts, topRanks, type LinkedinContact } from "@/lib/marketing";

/**
 * The LinkedIn finder. It reads each centre's OWN website (home page, plus a
 * contact or about page if one is linked) and keeps any LinkedIn company page
 * and personal profile links it finds there. It never visits LinkedIn itself:
 * LinkedIn's terms forbid automated collection, so anything not on the club's
 * site is found by hand with the search links on the LinkedIn tab.
 */

const MAX_BYTES = 400_000;
const TIMEOUT_MS = 7000;
const LINKEDIN_RE = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(company|school|in|showcase)\/([A-Za-z0-9\-_%.]+)\/?/gi;
const SUBPAGE_HINT = /contact|about|committee|team|people|who-we-are|officers/i;

export interface LinkedinFound { companyUrl: string | null; people: LinkedinContact[] }

/** Tidy a slug into a readable name guess ("jane-smith-3a9b1" → "Jane Smith"). */
function nameFromSlug(slug: string): string {
  return decodeURIComponent(slug)
    .split(/[-_]/)
    .filter((w) => w && !/\d/.test(w))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** LinkedIn links in a page: the first company/school page, and each personal profile once. Pure. */
export function extractLinkedin(html: string): LinkedinFound {
  let companyUrl: string | null = null;
  const people = new Map<string, LinkedinContact>();
  for (const m of html.matchAll(LINKEDIN_RE)) {
    const kind = m[1]!.toLowerCase();
    const slug = m[2]!.replace(/[.]+$/, "");
    if (!slug || /^(share|sharearticle|feed)$/i.test(slug)) continue;
    if (kind === "in") {
      const url = `https://www.linkedin.com/in/${slug}`;
      if (!people.has(url.toLowerCase())) people.set(url.toLowerCase(), { name: nameFromSlug(slug), role: "", url });
    } else if (!companyUrl) {
      companyUrl = `https://www.linkedin.com/${kind === "showcase" ? "showcase" : kind === "school" ? "school" : "company"}/${slug}`;
    }
  }
  return { companyUrl, people: [...people.values()].slice(0, 10) };
}

async function fetchPage(url: string, fetchImpl: typeof fetch): Promise<string | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: ac.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; ActivityRosterBot/1.0; +https://activityroster.com)", accept: "text/html,*/*;q=0.5" } });
    if (!res.ok || !/html|text/i.test(res.headers.get("content-type") ?? "")) return null;
    const buf = await res.arrayBuffer();
    return new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, MAX_BYTES));
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Read one centre's website (home page and one contact/about page) for LinkedIn links. */
export async function findLinkedinOnWebsite(website: string, fetchImpl: typeof fetch = fetch): Promise<LinkedinFound | null> {
  let home: string;
  try { home = assertSafeFeedUrl(/^https?:\/\//i.test(website) ? website : `https://${website}`); } catch { return null; }
  const html = await fetchPage(home, fetchImpl);
  if (html === null) return null;
  const found = extractLinkedin(html);
  if (!found.companyUrl || found.people.length === 0) {
    const sub = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]!).find((h) => SUBPAGE_HINT.test(h) && !/linkedin|mailto:|tel:/i.test(h));
    if (sub) {
      try {
        const next = assertSafeFeedUrl(new URL(sub, home).toString());
        if (new URL(next).host === new URL(home).host) {
          const more = await fetchPage(next, fetchImpl);
          if (more) {
            const f2 = extractLinkedin(more);
            found.companyUrl ??= f2.companyUrl;
            const seen = new Set(found.people.map((p) => p.url.toLowerCase()));
            for (const p of f2.people) if (!seen.has(p.url.toLowerCase())) found.people.push(p);
          }
        }
      } catch {
        // a bad link on their site: keep what the home page gave
      }
    }
  }
  return found;
}

/**
 * Check the next few centres not checked yet (the top 250 first), saving any
 * company page (only if none is on file) and adding new people to their
 * contacts. Every centre tried is stamped, found or not, so the finder moves
 * on through the list. Runs from the hourly tick and the LinkedIn tab's button.
 */
export async function runLinkedinFinder(repo: PlatformRepository, limit = 15, fetchImpl: typeof fetch = fetch): Promise<{ checked: number; pages: number; people: number; remaining: number }> {
  const all = await repo.listProspects(10_000, 0);
  const ranks = topRanks(all);
  const todo = all
    .filter((p) => !p.linkedinCheckedAt && (p.website ?? "").trim())
    .sort((a, b) => (ranks.get(a.id) ?? 1e6) - (ranks.get(b.id) ?? 1e6) || a.name.localeCompare(b.name));
  const batch = todo.slice(0, Math.max(1, Math.min(40, limit)));
  let pages = 0;
  let people = 0;
  for (let i = 0; i < batch.length; i += 5) {
    const group = batch.slice(i, i + 5);
    const results = await Promise.all(group.map((p) => findLinkedinOnWebsite(p.website!, fetchImpl).catch(() => null)));
    for (const [j, p] of group.entries()) {
      const found = results[j];
      const patch: Parameters<PlatformRepository["updateProspect"]>[1] = { linkedinCheckedAt: new Date() };
      if (found?.companyUrl && !p.linkedinUrl) { patch.linkedinUrl = found.companyUrl; pages++; }
      if (found?.people.length) {
        const current = parseLinkedinContacts(p.linkedinContacts);
        const have = new Set(current.map((c) => c.url.toLowerCase()));
        const added = found.people.filter((c) => !have.has(c.url.toLowerCase()));
        if (added.length) { patch.linkedinContacts = JSON.stringify([...current, ...added].slice(0, 20)); people += added.length; }
      }
      await repo.updateProspect(p.id, patch);
    }
  }
  return { checked: batch.length, pages, people, remaining: Math.max(0, todo.length - batch.length) };
}
