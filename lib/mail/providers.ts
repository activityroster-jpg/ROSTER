import type { CloudflareEnv } from "@/lib/cf/bindings";

/**
 * Email delivery providers behind `sendEmail` / `sendRawEmail` (compliance
 * block G). Two streams keep system mail and outreach apart:
 *
 *   system — sign-in codes, invites, rota notices. Resend key RESEND_API_KEY,
 *            from-address MAIL_FROM_SYSTEM (e.g. no-reply@notify.activityroster.com).
 *   news   — the outreach agent. Resend key RESEND_API_KEY_NEWS when set, and
 *            the from-address must be on OUTREACH_FROM_DOMAIN (e.g.
 *            news.activityroster.com) once that is configured, so a campaign can
 *            never send from the system domain and hurt its reputation.
 *
 * Postmark is the backup: when POSTMARK_SERVER_TOKEN is set, a provider outage
 * (network error, 429 or 5xx) fails over automatically. A 4xx that says the
 * message itself is wrong (bad address, unverified domain) is not retried on
 * the other provider: it would fail there too, and retrying could double-send.
 * MAIL_PRIMARY=postmark swaps the order if Resend is ever the one to avoid.
 */

export type MailStream = "system" | "news";
export type MailProviderName = "resend" | "postmark";

export interface OutboundMail {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
}

export class MailSendError extends Error {
  constructor(public readonly provider: MailProviderName, public readonly status: number | null, message: string, public readonly retryable: boolean) {
    super(message);
    this.name = "MailSendError";
  }
}

export interface DeliveryResult {
  id: string | null;
  provider: MailProviderName;
  /** True when the primary failed and the backup carried the message. */
  failedOver: boolean;
  firstError?: string;
}

type MailEnv = Pick<CloudflareEnv, "RESEND_API_KEY" | "RESEND_API_KEY_NEWS" | "POSTMARK_SERVER_TOKEN" | "MAIL_PRIMARY" | "OUTREACH_FROM_DOMAIN">;

interface Provider { name: MailProviderName; send(msg: OutboundMail, stream: MailStream, fetchImpl: typeof fetch): Promise<string | null> }

const retryableStatus = (s: number) => s === 408 || s === 429 || s >= 500;

function resendProvider(env: MailEnv): Provider | null {
  if (!env.RESEND_API_KEY && !env.RESEND_API_KEY_NEWS) return null;
  return {
    name: "resend",
    async send(msg, stream, fetchImpl) {
      const key = (stream === "news" && env.RESEND_API_KEY_NEWS) || env.RESEND_API_KEY;
      if (!key) throw new MailSendError("resend", null, "No Resend key for this stream", true);
      let res: Response;
      try {
        res = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: msg.from, to: msg.to, subject: msg.subject, html: msg.html,
            ...(msg.text ? { text: msg.text } : {}),
            ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
            ...(msg.headers ? { headers: msg.headers } : {}),
            ...(msg.tags ? { tags: msg.tags } : {}),
          }),
        });
      } catch (err) {
        throw new MailSendError("resend", null, `Resend unreachable: ${(err as Error).message}`, true);
      }
      if (!res.ok) throw new MailSendError("resend", res.status, `Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`, retryableStatus(res.status));
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      return data.id ?? null;
    },
  };
}

function postmarkProvider(env: MailEnv): Provider | null {
  if (!env.POSTMARK_SERVER_TOKEN) return null;
  return {
    name: "postmark",
    async send(msg, stream, fetchImpl) {
      let res: Response;
      try {
        res = await fetchImpl("https://api.postmarkapp.com/email", {
          method: "POST",
          headers: { "X-Postmark-Server-Token": env.POSTMARK_SERVER_TOKEN!, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            From: msg.from, To: msg.to, Subject: msg.subject, HtmlBody: msg.html,
            ...(msg.text ? { TextBody: msg.text } : {}),
            ...(msg.replyTo ? { ReplyTo: msg.replyTo } : {}),
            ...(msg.headers ? { Headers: Object.entries(msg.headers).map(([Name, Value]) => ({ Name, Value })) } : {}),
            ...(msg.tags?.[0] ? { Tag: `${msg.tags[0].name}:${msg.tags[0].value}`.slice(0, 1000) } : {}),
            MessageStream: stream === "news" ? "broadcast" : "outbound",
          }),
        });
      } catch (err) {
        throw new MailSendError("postmark", null, `Postmark unreachable: ${(err as Error).message}`, true);
      }
      if (!res.ok) throw new MailSendError("postmark", res.status, `Postmark ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`, retryableStatus(res.status));
      const data = (await res.json().catch(() => ({}))) as { MessageID?: string };
      return data.MessageID ?? null;
    },
  };
}

/** Configured providers in the order they should be tried. Empty = nothing can send. */
export function providersFor(env: MailEnv): MailProviderName[] {
  const have: MailProviderName[] = [];
  if (resendProvider(env)) have.push("resend");
  if (postmarkProvider(env)) have.push("postmark");
  if (env.MAIL_PRIMARY === "postmark" && have.includes("postmark")) return ["postmark", ...have.filter((p) => p !== "postmark")];
  return have;
}

const domainOf = (addr: string): string => {
  const m = /<([^>]+)>/.exec(addr);
  const bare = (m ? m[1]! : addr).trim().toLowerCase();
  return bare.slice(bare.lastIndexOf("@") + 1);
};

/** Reject an outreach from-address that is not on the outreach domain (once one is configured). */
export function checkFromAllowed(env: MailEnv, msg: Pick<OutboundMail, "from">, stream: MailStream): string | null {
  if (stream !== "news" || !env.OUTREACH_FROM_DOMAIN) return null;
  const want = env.OUTREACH_FROM_DOMAIN.trim().toLowerCase();
  return domainOf(msg.from) === want ? null : `Outreach must send from @${want}, not ${msg.from}`;
}

/**
 * Send through the first configured provider, failing over to the next on an
 * outage. Throws MailSendError when no provider accepted the message.
 */
export async function deliver(env: MailEnv, msg: OutboundMail, stream: MailStream, fetchImpl: typeof fetch = fetch): Promise<DeliveryResult> {
  const fromProblem = checkFromAllowed(env, msg, stream);
  if (fromProblem) throw new MailSendError("resend", null, fromProblem, false);
  const byName: Record<MailProviderName, Provider | null> = { resend: resendProvider(env), postmark: postmarkProvider(env) };
  const order = providersFor(env).map((n) => byName[n]!).filter(Boolean);
  if (order.length === 0) throw new MailSendError("resend", null, "No email provider configured", false);

  let firstError: MailSendError | null = null;
  for (let i = 0; i < order.length; i++) {
    const p = order[i]!;
    try {
      const id = await p.send(msg, stream, fetchImpl);
      return { id, provider: p.name, failedOver: i > 0, firstError: firstError?.message };
    } catch (err) {
      const e = err instanceof MailSendError ? err : new MailSendError(p.name, null, (err as Error).message, true);
      if (!e.retryable || i === order.length - 1) throw firstError && i > 0 ? new MailSendError(e.provider, e.status, `${firstError.message}; then ${e.message}`, e.retryable) : e;
      firstError = e;
    }
  }
  throw firstError ?? new MailSendError("resend", null, "No email provider accepted the message", true);
}
