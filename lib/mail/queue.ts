import type { Database } from "@/lib/db/client";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import type { EmailOutbox } from "@/lib/db/schema";
import { deliver, MailSendError, type MailStream, type OutboundMail } from "./providers";

/**
 * The email queue (compliance P1-C). `sendEmail`/`sendRawEmail` enqueue a row
 * and try at once; anything that fails for a reason that may clear (provider
 * outage, rate limit) is retried from the hourly tick with backoff, up to
 * MAX_ATTEMPTS, then lands in the Dev Center failed-send list. Addresses on
 * the suppression list (bounced or complained) are never sent to.
 */
export const MAX_ATTEMPTS = 5;
/** Minutes to wait before attempt n+1 after attempt n failed: 5, 15, 45, 135. */
export function backoffMinutes(attempts: number): number { return 5 * 3 ** Math.max(0, attempts - 1); }

export interface QueueResult { id: string; sent: boolean; providerId: string | null; error?: string }

export async function queueAndSend(db: Database, env: CloudflareEnv, msg: OutboundMail & { stream?: MailStream; expiresAt?: Date | null }, fetchImpl?: typeof fetch): Promise<QueueResult> {
  const p = new PlatformRepository(db);
  const stream = msg.stream ?? "system";
  const row = await p.enqueueEmail({
    stream, toEmail: msg.to, fromAddr: msg.from, subject: msg.subject, html: msg.html, text: msg.text ?? null, replyTo: msg.replyTo ?? null,
    headers: msg.headers ? JSON.stringify(msg.headers) : null, tags: msg.tags ? JSON.stringify(msg.tags) : null,
    status: "queued", attempts: 0, nextAttemptAt: new Date(), expiresAt: msg.expiresAt ?? null,
  });
  if (await p.isSuppressed(msg.to)) {
    await p.setEmailStatus(row.id, "failed", "Address is on the suppression list (it bounced or complained before)");
    return { id: row.id, sent: false, providerId: null, error: "suppressed" };
  }
  return attempt(p, env, row, fetchImpl);
}

async function attempt(p: PlatformRepository, env: CloudflareEnv, row: EmailOutbox, fetchImpl?: typeof fetch): Promise<QueueResult> {
  const attempts = row.attempts + 1;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    await p.setEmailStatus(row.id, "failed", "Expired before it could be sent (time-limited message)");
    return { id: row.id, sent: false, providerId: null, error: "expired" };
  }
  try {
    const r = await deliver(env, {
      from: row.fromAddr, to: row.toEmail, subject: row.subject, html: row.html ?? "", text: row.text ?? undefined, replyTo: row.replyTo ?? undefined,
      headers: row.headers ? (JSON.parse(row.headers) as Record<string, string>) : undefined,
      tags: row.tags ? (JSON.parse(row.tags) as { name: string; value: string }[]) : undefined,
    }, (row.stream as MailStream) ?? "system", fetchImpl);
    await p.markEmailSent(row.id, r.provider, r.id, attempts);
    if (r.failedOver) console.error(`[mail] failed over to ${r.provider}: ${r.firstError ?? "primary failed"}`);
    return { id: row.id, sent: true, providerId: r.id };
  } catch (err) {
    const e = err instanceof MailSendError ? err : new MailSendError("resend", null, (err as Error).message, true);
    const retry = e.retryable && attempts < MAX_ATTEMPTS;
    const next = retry ? new Date(Date.now() + backoffMinutes(attempts) * 60_000) : null;
    await p.markEmailAttemptFailed(row.id, attempts, e.message, next);
    console.error(`[mail] ${retry ? `attempt ${attempts} failed, retry at ${next!.toISOString()}` : "gave up"}: ${e.message}`);
    return { id: row.id, sent: false, providerId: null, error: e.message };
  }
}

/**
 * Send what is due (first sends of bulk notices, and retries), a few at a time,
 * then purge old rows. Run by the delivery job every couple of minutes and by
 * the hourly tick as a backup.
 */
export async function drainEmailQueue(db: Database, env: CloudflareEnv, now = new Date(), limit = 50, fetchImpl?: typeof fetch, opts: { concurrency?: number; purge?: boolean } = {}): Promise<{ due: number; sent: number; failed: number; purged: number }> {
  const p = new PlatformRepository(db);
  const due = await p.dueEmails(now, limit);
  const step = Math.max(1, opts.concurrency ?? 1);
  let sent = 0, failed = 0;
  for (let i = 0; i < due.length; i += step) {
    for (const r of await Promise.all(due.slice(i, i + step).map((row) => attempt(p, env, row, fetchImpl)))) {
      if (r.sent) sent++; else failed++;
    }
  }
  const purged = opts.purge === false ? 0 : await p.purgeEmailOutbox(now);
  return { due: due.length, sent, failed, purged };
}

/** Dev Center: put a failed row back in the queue for an immediate retry. Only possible while its body is still held. */
export async function retryEmail(db: Database, env: CloudflareEnv, id: string, fetchImpl?: typeof fetch): Promise<QueueResult | { error: string }> {
  const p = new PlatformRepository(db);
  const row = await p.emailOutboxById(id);
  if (!row) return { error: "Not found" };
  if (row.status === "sent") return { error: "Already sent" };
  if (!row.html && !row.text) return { error: "The message body has already been cleared; ask the sender to resend" };
  return attempt(p, env, { ...row, attempts: Math.min(row.attempts, MAX_ATTEMPTS - 1) }, fetchImpl);
}
