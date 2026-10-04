/**
 * The public sub-processor register (compliance P1-G). This is the data behind
 * /subprocessors and must be kept in step with docs/subprocessors.md. Every
 * change is dated in CHANGES; centres are told before a new processor goes live
 * (Dev Center → Trust & compliance → Privacy requests → "Sub-processor notice").
 */
export interface Subprocessor {
  name: string;
  purpose: string;
  data: string;
  location: string;
  status: "live" | "standby";
}

export const SUBPROCESSORS: Subprocessor[] = [
  { name: "Cloudflare, Inc.", purpose: "Hosting, database, file storage, cache, DNS and TLS", data: "All platform data", location: "EU (database in western Europe, files in the EU jurisdiction); worldwide edge network for serving requests", status: "live" },
  { name: "Resend, Inc.", purpose: "Transactional and outreach email", data: "Recipient email addresses and the content of the emails we send (sign-in codes, invitations, roster notices)", location: "EU region", status: "live" },
  { name: "ActiveCampaign, LLC (Postmark)", purpose: "Backup email provider, used only if Resend fails", data: "The same as Resend", location: "United States, under EU standard contractual clauses", status: "standby" },
  { name: "Stripe Payments Europe, Ltd.", purpose: "Subscription billing", data: "Billing contact name and email, invoices; card details never reach us", location: "EU / United States", status: "live" },
  { name: "Functional Software, Inc. (Sentry)", purpose: "Error monitoring", data: "Error traces with emails and tokens removed before they are sent", location: "EU", status: "live" },
  { name: "Better Stack, Inc.", purpose: "Uptime monitoring and the public status page", data: "None of centres' data; it fetches our health page and holds the owner's alert contact", location: "EU / United States", status: "live" },
  { name: "Backblaze, Inc. (B2)", purpose: "Second, off-Cloudflare copy of encrypted nightly backups", data: "Encrypted database exports and document archives only", location: "EU", status: "live" },
  { name: "Anthropic, PBC", purpose: "Drafts our own business-to-business outreach emails to prospective centres", data: "Prospect business names, their public website text and business contact names. Never any centre's users, staff or students", location: "United States", status: "live" },
  { name: "GitHub, Inc.", purpose: "Source code, testing and deployment automation", data: "Code and configuration only; no personal data by policy", location: "United States / EU", status: "live" },
  { name: "Have I Been Pwned", purpose: "Checks a new password against known breaches", data: "The first five characters of the password's hash only; never the password or who it belongs to", location: "Cloudflare edge", status: "live" },
];

export interface SubprocessorChange { date: string; summary: string }

/** Newest first. Add a line here with the same change to docs/subprocessors.md. */
export const SUBPROCESSOR_CHANGES: SubprocessorChange[] = [
  { date: "2026-10-03", summary: "Postmark listed as a standby email provider ahead of use; it becomes live only if Resend fails and only after centres have been told." },
  { date: "2026-10-03", summary: "Backblaze B2 added for the off-Cloudflare copy of encrypted backups; Better Stack added for uptime monitoring." },
  { date: "2026-09-29", summary: "Register first published: Cloudflare, Resend, Stripe, Sentry, Anthropic (outreach only), GitHub, Have I Been Pwned." },
];
