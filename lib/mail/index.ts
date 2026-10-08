import { getEnv } from "@/lib/cf/bindings";
import { COMPANY } from "@/lib/config";
import { providersFor, type MailStream } from "./providers";
import { queueAndSend } from "./queue";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";

/**
 * Minimal transactional mailer. Delivery goes through lib/mail/providers
 * (Resend, with Postmark as automatic backup; fetch-only, no Node SDK) so it
 * runs on Workers. In non-production or without a key it logs instead of
 * sending, so local/dev flows still work.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  from?: string;
  /** Time-limited content (a sign-in code): do not retry past this many minutes; fail instead. */
  expiresInMinutes?: number;
  /** A one-time-code email: the footer leaves out the copyright year, so the code is the only number that stands out. */
  code?: boolean;
}

/**
 * Wrap a message body in the branded ActivityRoster email shell: a logo/wordmark
 * header and a legally-aware footer (sender identity, why they got it, postal
 * address when configured, and privacy/terms links). All emails go through this.
 */
export function renderEmail(bodyHtml: string, opts: { code?: boolean } = {}): string {
  const env = getEnv();
  const apex = env.APP_APEX_DOMAIN || "activityroster.com";
  const site = `https://${apex}`;
  const legalName = env.COMPANY_LEGAL_NAME || COMPANY.legalName;
  const support = env.SUPPORT_EMAIL || `support@${apex}`;
  const year = new Date().getFullYear();
  const addressText = env.COMPANY_ADDRESS || COMPANY.addressInline;
  const address = addressText ? `<div style="margin-top:4px">${addressText}</div>` : "";

  return `
  <div style="margin:0;padding:0;background:#f1f5f9">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
      <div style="text-align:center;padding:8px 0 16px">
        <a href="${site}" style="text-decoration:none;display:inline-block">
          <img src="${site}/email-logo.png" width="190" height="34" alt="ActivityRoster" style="display:block;border:0;height:34px;width:auto;max-width:190px" />
        </a>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;font-size:15px;line-height:1.55;color:#334155">
        ${bodyHtml}
      </div>
      <div style="padding:16px 8px 8px;text-align:center;color:#94a3b8;font-size:12px;line-height:1.6">
        <div style="font-weight:600;color:#64748b">${legalName}</div>
        <div>${escapeHtml(COMPANY.registration)}</div>
        <div>Staff rostering &amp; course administration for RYA sailing &amp; watersports centres.</div>
        ${address}
        <div style="margin-top:8px">
          <a href="${site}" style="color:#0C6B74;text-decoration:none">Website</a> ·
          <a href="${site}/privacy" style="color:#0C6B74;text-decoration:none">Privacy</a> ·
          <a href="${site}/terms" style="color:#0C6B74;text-decoration:none">Terms</a> ·
          <a href="mailto:${support}" style="color:#0C6B74;text-decoration:none">${support}</a>
        </div>
        <div style="margin-top:8px">You're receiving this service email because you have an ActivityRoster account or a centre invited you. This is a transactional message about your account, not marketing.</div>
        ${opts.code ? "" : `<div style="margin-top:6px">© ${year} ${legalName}. All rights reserved.</div>`}
      </div>
    </div>
  </div>`;
}

/**
 * The plain-text copy sent alongside every branded email: the message, then
 * the sender's identity and address. Mail apps (and Gmail's code detection)
 * read this more reliably than the designed version.
 */
export function renderEmailText(bodyHtml: string): string {
  const env = getEnv();
  const apex = env.APP_APEX_DOMAIN || "activityroster.com";
  const legalName = env.COMPANY_LEGAL_NAME || COMPANY.legalName;
  const support = env.SUPPORT_EMAIL || `support@${apex}`;
  const addressText = env.COMPANY_ADDRESS || COMPANY.addressInline;
  return [htmlToText(bodyHtml), "", "--", legalName, COMPANY.registration, ...(addressText ? [addressText] : []), `https://${apex} · ${support}`].join("\n");
}

/** Escape user-supplied text before it goes into an email body. */
export function escapeHtml(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface RawEmail {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
  /** "system" (default) or "news" for the outreach agent: separate keys, from-domain and reputation. */
  stream?: MailStream;
}

/**
 * Send an email exactly as given (no branded shell) and return Resend's id so
 * delivery / open / bounce webhooks can be matched back. Used by the outreach
 * agent, whose messages carry their own footer and unsubscribe link.
 */
/** Environments that really send. Staging also keeps a copy of every email in the Dev Center outbox. */
const canSend = (env: ReturnType<typeof getEnv>) => providersFor(env).length > 0 && (env.APP_ENV === "production" || env.APP_ENV === "staging");

/** Queue the message and try to send it now; retries and the failed-send list live in lib/mail/queue. */
async function dispatch(env: ReturnType<typeof getEnv>, msg: Parameters<typeof queueAndSend>[2], stream: MailStream): Promise<string | null> {
  const r = await queueAndSend(await getDb(), env, { ...msg, stream });
  return r.providerId;
}

export interface OutboxEntry { at: string; to: string; from: string; subject: string; text: string }
const OUTBOX_KEY = "outbox:v1";
const OUTBOX_MAX = 100;

/** On staging, remember the last emails so testers can read codes and links without a real inbox. */
async function captureOutbox(env: ReturnType<typeof getEnv>, entry: OutboxEntry): Promise<void> {
  if (env.APP_ENV !== "staging") return;
  try {
    const raw = await env.TENANT_CACHE.get(OUTBOX_KEY);
    const list: OutboxEntry[] = raw ? (JSON.parse(raw) as OutboxEntry[]) : [];
    list.unshift(entry);
    await env.TENANT_CACHE.put(OUTBOX_KEY, JSON.stringify(list.slice(0, OUTBOX_MAX)), { expirationTtl: 7 * 24 * 3600 });
  } catch { /* the outbox is a convenience, never a blocker */ }
}

export async function readOutbox(): Promise<OutboxEntry[]> {
  const env = getEnv();
  if (env.APP_ENV !== "staging") return [];
  try { const raw = await env.TENANT_CACHE.get(OUTBOX_KEY); return raw ? (JSON.parse(raw) as OutboxEntry[]) : []; } catch { return []; }
}

const htmlToText = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|tr)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").split("\n").map((l) => l.trim()).join("\n").replace(/\n\s*\n+/g, "\n").trim();

export async function sendRawEmail(msg: RawEmail): Promise<{ id: string | null; sent: boolean }> {
  const env = getEnv();
  await captureOutbox(env, { at: new Date().toISOString(), to: msg.to, from: msg.from, subject: msg.subject, text: msg.text });
  if (!canSend(env)) {
    console.info(`[mail] (not sent: ${env.APP_ENV ?? "unset"}) ${msg.subject}`);
    return { id: null, sent: false };
  }
  const id = await dispatch(env, {
    from: msg.from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text,
    replyTo: msg.replyTo, headers: msg.headers, tags: msg.tags,
  }, msg.stream ?? "system");
  return { id, sent: true };
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const env = getEnv();
  const from = msg.from ?? env.MAIL_FROM_SYSTEM ?? "ActivityRoster <no-reply@activityroster.com>";
  const html = renderEmail(msg.html, { code: msg.code });
  const text = renderEmailText(msg.html);
  await captureOutbox(env, { at: new Date().toISOString(), to: msg.to, from, subject: msg.subject, text: htmlToText(msg.html) });

  if (!canSend(env)) {
    console.info(`[mail] (not sent: ${env.APP_ENV ?? "unset"}) ${msg.subject}`);
    return;
  }
  await dispatch(env, { from, to: msg.to, subject: msg.subject, html, text, expiresAt: msg.expiresInMinutes ? new Date(Date.now() + msg.expiresInMinutes * 60_000) : null }, "system");
}

/**
 * Many emails at once (a published week): each is built exactly like
 * {@link sendEmail}, then queued in a few batched statements instead of sent
 * one by one, so a centre of any size stays inside Cloudflare's per-request
 * limits. The delivery job (/api/mail/drain, every two minutes) sends them,
 * with the usual retries. Suppressed addresses are left out.
 */
export async function queueEmails(msgs: EmailMessage[]): Promise<{ queued: number }> {
  if (msgs.length === 0) return { queued: 0 };
  const env = getEnv();
  const from = env.MAIL_FROM_SYSTEM ?? "ActivityRoster <no-reply@activityroster.com>";
  const built = msgs.map((m) => ({ to: m.to, from: m.from ?? from, subject: m.subject, html: renderEmail(m.html, { code: m.code }), text: renderEmailText(m.html), plain: htmlToText(m.html) }));
  if (env.APP_ENV === "staging") {
    for (const b of built.slice(0, 20)) await captureOutbox(env, { at: new Date().toISOString(), to: b.to, from: b.from, subject: b.subject, text: b.plain });
  }
  if (!canSend(env)) {
    console.info(`[mail] (not sent: ${env.APP_ENV ?? "unset"}) ${built.length} × ${built[0]!.subject}`);
    return { queued: 0 };
  }
  const p = new PlatformRepository(await getDb());
  const suppressed = await p.suppressedAmong(built.map((b) => b.to));
  const rows = built.filter((b) => !suppressed.has(b.to.toLowerCase())).map((b) => ({
    stream: "system" as const, toEmail: b.to, fromAddr: b.from, subject: b.subject, html: b.html, text: b.text, replyTo: null, headers: null, tags: null,
    status: "queued" as const, attempts: 0, nextAttemptAt: new Date(), expiresAt: null,
  }));
  return { queued: await p.enqueueEmails(rows) };
}
