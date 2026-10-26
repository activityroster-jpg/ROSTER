/**
 * Traffic sources: which channel a visit came from. Edit the lists below to
 * teach it new sites; everything else follows. Pure, no I/O.
 *
 * Order of the rules (first match wins):
 *   1. UTM tags, when present (utm_source / utm_medium): AI, email, social, search
 *   2. The referring site's domain: AI, search, social, webmail
 *   3. Any other referring site: "Other referral", keeping the domain
 *   4. No referrer and no UTM: Direct
 */

export const CHANNELS = ["direct", "search", "ai", "social", "email", "other"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_META: Record<Channel, { label: string; color: string; hint: string }> = {
  direct: { label: "Direct", color: "#2a78d6", hint: "No referrer and no tags. Also includes bookmarks, typed addresses, QR codes, and links opened from email apps, WhatsApp and PDFs, which don't pass a referrer." },
  search: { label: "Search", color: "#eb6834", hint: "Google, Bing, DuckDuckGo and other search engines." },
  ai: { label: "AI", color: "#1baf7a", hint: "ChatGPT, Perplexity, Claude, Gemini, Copilot and other AI assistants." },
  social: { label: "Social", color: "#eda100", hint: "Facebook, Instagram, LinkedIn, X, YouTube, Reddit and other social sites." },
  email: { label: "Email", color: "#e87ba4", hint: "Links tagged utm_medium=email, or opened from webmail." },
  other: { label: "Other referral", color: "#6250d6", hint: "Any other website linking here; see the referrer list." },
};

/** AI assistants: referring domains and the utm_source values they add (ChatGPT adds utm_source=chatgpt.com). */
export const AI_SOURCES = [
  "chatgpt.com", "chat.openai.com", "openai.com", "perplexity.ai", "claude.ai", "gemini.google.com", "bard.google.com",
  "copilot.microsoft.com", "you.com", "phind.com", "poe.com", "meta.ai", "deepseek.com", "chat.deepseek.com", "mistral.ai", "chat.mistral.ai", "grok.com",
];

/** Search engines (matched on the domain, any country suffix: google.co.uk, google.ie…). */
export const SEARCH_ENGINES = ["google", "bing", "duckduckgo", "yahoo", "ecosia", "baidu", "yandex", "brave", "startpage", "qwant", "ask", "aol", "search.brave"];

/** Social sites (domains, or a word in the utm_source). */
export const SOCIAL_SITES = [
  "facebook.com", "fb.com", "m.facebook.com", "l.facebook.com", "lm.facebook.com", "instagram.com", "l.instagram.com", "linkedin.com", "lnkd.in",
  "t.co", "x.com", "twitter.com", "youtube.com", "youtu.be", "reddit.com", "old.reddit.com", "pinterest.com", "tiktok.com", "threads.net", "bsky.app", "mastodon.social", "whatsapp.com", "wa.me",
];
const SOCIAL_WORDS = ["facebook", "fb", "instagram", "ig", "linkedin", "twitter", "x", "youtube", "reddit", "pinterest", "tiktok", "threads", "bluesky", "whatsapp", "social"];

/** Webmail sites: a link clicked in an email read in the browser. */
export const WEBMAIL_SITES = ["mail.google.com", "outlook.live.com", "outlook.office.com", "outlook.office365.com", "mail.yahoo.com", "mail.aol.com", "mail.proton.me", "icloud.com", "webmail"];

/** The hostname of a referrer URL, lower-case and without "www.", or null. */
export function referrerDomain(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const h = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    return h || null;
  } catch { return null; }
}

const isOrUnder = (domain: string, site: string) => domain === site || domain.endsWith(`.${site}`);
const inList = (domain: string, list: readonly string[]) => list.some((s) => isOrUnder(domain, s));
/** "google" matches google.com, google.co.uk, news.google.com… */
const isSearch = (domain: string) => SEARCH_ENGINES.some((e) => new RegExp(`(^|\\.)${e.replace(".", "\\.")}\\.[a-z.]+$`).test(domain)) && !inList(domain, AI_SOURCES) && !inList(domain, WEBMAIL_SITES);

export interface VisitSource {
  /** The referring domain (already reduced with referrerDomain), or null. */
  referrer: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
}

export function classify({ referrer, utmSource, utmMedium }: VisitSource): Channel {
  const src = (utmSource ?? "").trim().toLowerCase();
  const med = (utmMedium ?? "").trim().toLowerCase();
  if (src || med) {
    if (src && (inList(src.replace(/^www\./, ""), AI_SOURCES) || /chatgpt|openai|perplexity|claude|gemini|copilot/.test(src))) return "ai";
    if (/^e-?mail$|newsletter/.test(med) || /^e-?mail$|newsletter|mailchimp|resend|postmark/.test(src)) return "email";
    if (/social/.test(med) || SOCIAL_WORDS.includes(src) || inList(src, SOCIAL_SITES)) return "social";
    if (/^(cpc|ppc|paid|organic|search)$/.test(med) || SEARCH_ENGINES.includes(src)) return "search";
  }
  if (referrer) {
    if (inList(referrer, AI_SOURCES)) return "ai";
    if (inList(referrer, WEBMAIL_SITES)) return "email";
    if (isSearch(referrer)) return "search";
    if (inList(referrer, SOCIAL_SITES)) return "social";
    return "other";
  }
  return src || med ? "other" : "direct";
}

/** Phone, tablet or desktop, from the user agent. */
export function deviceOf(ua: string | null | undefined): "mobile" | "tablet" | "desktop" {
  const u = (ua ?? "").toLowerCase();
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/.test(u)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/.test(u)) return "mobile";
  return "desktop";
}

/** Crawlers, previews, monitors and headless browsers: never counted. */
export function isBot(ua: string | null | undefined): boolean {
  const u = (ua ?? "").toLowerCase();
  if (u.length < 20) return true;
  return /bot\b|bot\/|crawl|spider|slurp|scrape|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptime|betteruptime|statuscake|monitor|preview|facebookexternalhit|embedly|quora link|whatsapp|telegrambot|discordbot|slackbot|linkedinbot|curl\/|wget\/|python-|go-http|java\/|okhttp|axios|node-fetch|httpclient|feedfetcher|rss|validator|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot|perplexitybot|amazonbot|applebot/.test(u);
}
