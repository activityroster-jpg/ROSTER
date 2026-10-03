import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { assertSafeFeedUrl } from "@/lib/integrations/url-guard";
import type { ResearchResult } from "./types";

const PAGE_HINT = /contact|about|team|staff|instructor|committee|who|people|meet|principal|office/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BAD_EMAIL = /\.(png|jpe?g|gif|svg|webp|css|js)$|example\.|sentry|wixpress|godaddy|squarespace|@[0-9.]+$|noreply|no-reply|donotreply/i;
const ROLE_RE = /(principal|chief instructor|centre manager|center manager|commodore|sailing secretary|secretary|head of|manager|owner|director|founder|coordinator|training manager|bosun)/i;

const MAX_BYTES = 300_000;
const TIMEOUT_MS = 8000;

async function fetchText(url: string): Promise<string | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; ActivityRosterBot/1.0; +https://activityroster.com)", accept: "text/html,*/*;q=0.5" } });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!/html|text/i.test(ct)) return null;
    const buf = await res.arrayBuffer();
    return new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, MAX_BYTES));
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** HTML → readable text, plus same-site links worth a look. */
export function stripHtml(html: string): { text: string; links: string[]; mailtos: string[] } {
  const mailtos = [...html.matchAll(/href=["']mailto:([^"'?]+)/gi)].map((m) => m[1]!.trim().toLowerCase());
  const links = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]!);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article|header|footer)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return { text, links, mailtos };
}

export function extractEmails(text: string, extra: string[] = []): string[] {
  const found = new Set<string>();
  for (const m of text.match(EMAIL_RE) ?? []) { const e = m.toLowerCase().replace(/\.$/, ""); if (!BAD_EMAIL.test(e)) found.add(e); }
  for (const e of extra) if (e && !BAD_EMAIL.test(e)) found.add(e.toLowerCase());
  return [...found].slice(0, 20);
}

/** Role words we look for next to a name; websites usually capitalise them, so match either case per word. */
const ROLE_WORDS = ["principal", "chief instructor", "centre manager", "center manager", "commodore", "sailing secretary", "training manager", "general manager", "manager", "owner", "director", "founder", "head of [a-z]+"];
const roleAlt = ROLE_WORDS.map((r) => r.split(" ").map((w) => (/^[a-z]/.test(w) && !w.startsWith("[") ? `[${w[0]!.toUpperCase()}${w[0]}]${w.slice(1)}` : w)).join("\\s+")).join("|");
const NAME = "[A-Z][a-z'’-]+(?:\\s+(?:O'|Mc|Mac)?[A-Z][a-z'’-]+){1,2}";
const NAME_ROLE_RE = new RegExp(`\\b(${NAME})\\b[^.\\n]{0,40}?\\b(${roleAlt})\\b|\\b(${roleAlt})\\b[^.\\n]{0,25}?\\b(${NAME})\\b`, "g");

/** Name + role pairs found by proximity in the page text (no AI). */
export function extractNamedRoles(text: string): { name: string; role: string }[] {
  const out: { name: string; role: string }[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(NAME_ROLE_RE)) {
    const name = (m[1] ?? m[4] ?? "").trim();
    const role = (m[2] ?? m[3] ?? "").trim();
    if (!name || !role || /^(The|Our|Royal|Yachting|Sailing|Contact|About|Meet|Join|Dear|Hello)\b/.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, role: role.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) });
    if (out.length >= 8) break;
  }
  return out;
}

const AiSchema = z.object({
  summary: z.string().describe("Two plain sentences on what this centre or club does, from the text only."),
  hooks: z.array(z.string()).max(3).describe("Up to three specific, verifiable details from the text worth mentioning in a first email (a course they run, a boat type, an event, their location). No flattery, no guesses."),
  contacts: z.array(z.object({ name: z.string(), role: z.string().nullable(), email: z.string().nullable() })).max(8),
  bestEmail: z.string().nullable().describe("The single best address to write to for a rostering/admin conversation, chosen from emails present in the text, or null."),
  bestEmailReason: z.string().nullable(),
});

function siteUrl(website: string): string | null {
  const raw = website.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try { return assertSafeFeedUrl(withScheme); } catch { return null; }
}

/**
 * Look a prospect up on their own website: a few pages, the people and
 * addresses on them, and (with a Claude key) a short summary plus specific
 * hooks for a first email. Never throws; an unreachable site yields an empty result.
 */
export async function researchProspect(input: { website: string | null; knownEmail: string | null; targetRoles: string; apiKey?: string }): Promise<ResearchResult> {
  const result: ResearchResult = { fetchedAt: new Date().toISOString(), pages: [], summary: null, hooks: [], contacts: [], generalEmails: [], phone: null, chosenEmail: null, chosenReason: null, usedAi: false };
  const home = input.website ? siteUrl(input.website) : null;
  let corpus = "";
  const mailtos: string[] = [];
  if (home) {
    const html = await fetchText(home);
    if (html) {
      result.pages.push(home);
      const { text, links, mailtos: m } = stripHtml(html);
      corpus += `\n\n# ${home}\n${text.slice(0, 12_000)}`;
      mailtos.push(...m);
      const base = new URL(home);
      const candidates = [...new Set(links
        .map((l) => { try { return new URL(l, base).toString(); } catch { return null; } })
        .filter((u): u is string => Boolean(u && u.startsWith(base.origin) && PAGE_HINT.test(u) && !/\.(pdf|jpg|png|zip)$/i.test(u))))].slice(0, 4);
      for (const u of candidates) {
        const h = await fetchText(u);
        if (!h) continue;
        result.pages.push(u);
        const sub = stripHtml(h);
        corpus += `\n\n# ${u}\n${sub.text.slice(0, 8_000)}`;
        mailtos.push(...sub.mailtos);
      }
    }
  }
  const emails = extractEmails(corpus, mailtos);
  result.generalEmails = emails;
  result.phone = (corpus.match(/(\+44\s?\d[\d\s]{8,12}\d|\b0[1-9]\d{2,4}\s?\d{3}\s?\d{3,4}\b|\+353\s?\d[\d\s]{7,10}\d)/) ?? [])[0]?.trim() ?? null;
  const named = extractNamedRoles(corpus);
  result.contacts = named.map((n) => ({ name: n.name, role: n.role, email: null }));

  if (input.apiKey && corpus.trim().length > 200) {
    try {
      const client = new Anthropic({ apiKey: input.apiKey });
      const res = await client.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 2000,
        output_config: { effort: "low", format: zodOutputFormat(AiSchema) },
        system: "You read a sailing centre or club's website text and extract facts for a short, honest business email. Use only what the text says. Prefer named people whose role matches the target roles. Never invent names or addresses.",
        messages: [{ role: "user", content: `Target roles: ${input.targetRoles}\nKnown address from our records: ${input.knownEmail ?? "none"}\nEmail addresses found on the site: ${emails.join(", ") || "none"}\n\nWebsite text:\n${corpus.slice(0, 40_000)}` }],
      });
      if (res.stop_reason !== "refusal" && res.parsed_output) {
        const p = res.parsed_output;
        result.usedAi = true;
        result.summary = p.summary;
        result.hooks = p.hooks.filter(Boolean).slice(0, 3);
        const merged = new Map<string, { name: string; role: string | null; email: string | null }>();
        for (const c of [...p.contacts, ...result.contacts]) { const k = c.name.toLowerCase(); if (!merged.has(k)) merged.set(k, { name: c.name, role: c.role ?? null, email: c.email && !BAD_EMAIL.test(c.email) ? c.email.toLowerCase() : null }); }
        result.contacts = [...merged.values()].slice(0, 8);
        if (p.bestEmail && emails.includes(p.bestEmail.toLowerCase())) { result.chosenEmail = p.bestEmail.toLowerCase(); result.chosenReason = p.bestEmailReason; }
      }
    } catch (err) {
      console.error("[outreach] research AI failed:", (err as Error).message);
    }
  }

  if (!result.chosenEmail) {
    const roleHit = result.contacts.find((c) => c.email && c.role && ROLE_RE.test(c.role));
    const personal = emails.find((e) => !/^(info|office|admin|hello|enquiries|sales|bookings|contact|mail)@/.test(e));
    const general = emails.find((e) => /^(info|office|enquiries|hello|contact|admin|mail)@/.test(e));
    const pick = roleHit?.email ?? input.knownEmail?.toLowerCase() ?? personal ?? general ?? emails[0] ?? null;
    result.chosenEmail = pick;
    result.chosenReason = roleHit ? `Listed as ${roleHit.role}` : input.knownEmail && pick === input.knownEmail.toLowerCase() ? "From our records" : pick ? "Found on their website" : null;
  }
  return result;
}

/** The person to address, from research or the prospect record. */
export function pickContact(r: ResearchResult, targetRoles: string): { name: string | null; role: string | null } {
  const wanted = targetRoles.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const byRole = r.contacts.find((c) => c.role && wanted.some((w) => c.role!.toLowerCase().includes(w)));
  const byEmail = r.chosenEmail ? r.contacts.find((c) => c.email === r.chosenEmail) : undefined;
  const c = byEmail ?? byRole ?? null;
  return { name: c?.name ?? null, role: c?.role ?? null };
}
