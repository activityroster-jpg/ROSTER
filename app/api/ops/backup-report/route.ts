import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCronSecret } from "@/lib/security/cron-secret";
import { writeLastBackup } from "@/lib/ops/backup-status";
import { platformAdminEmails } from "@/lib/platform/admin";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { fmtBytes } from "@/lib/ops/backup-status";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  ok: z.boolean(),
  file: z.string().max(200).nullable().optional(),
  bytes: z.number().int().nonnegative().nullable().optional(),
  offsite: z.boolean().optional(),
  documents: z.boolean().optional(),
  error: z.string().max(2000).nullable().optional(),
});

/**
 * The nightly backup workflow posts its result here. We remember it for the
 * Dev Center and email the platform owner either way, so a silent failure is
 * impossible: no email by breakfast means the workflow itself did not run.
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`backup-report:${clientIp(req)}`, 20, 60 * 60);
  if (!limit.allowed) return tooManyRequests();
  if (!checkCronSecret(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad payload" }, { status: 400 });
  const d = parsed.data;
  const status = { ok: d.ok, at: new Date().toISOString(), file: d.file ?? null, bytes: d.bytes ?? null, offsite: d.offsite ?? false, documents: d.documents ?? false, error: d.error ?? null };
  await writeLastBackup(status);
  const admins = [...platformAdminEmails()];
  const when = new Date(status.at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
  await Promise.all(admins.map((to) => sendEmail({
    to,
    subject: status.ok ? `✅ Backup done ${when} · ${fmtBytes(status.bytes)}${status.offsite ? " · off-site copy ✓" : " · no off-site copy"}` : `❌ Backup FAILED ${when}`,
    html: status.ok
      ? `<p>Nightly backup completed.</p><ul><li>File: ${escapeHtml(status.file ?? "")}</li><li>Size: ${fmtBytes(status.bytes)} (encrypted)</li><li>Off-site copy: ${status.offsite ? "yes" : "no (OFFSITE_S3_* secrets not set)"}</li><li>Uploaded documents included: ${status.documents ? "yes" : "no (R2_S3_* secrets not set)"}</li></ul><p>Restore steps: docs/runbooks/restore.md.</p>`
      : `<p>The nightly backup did not complete.</p><pre>${escapeHtml(status.error ?? "no detail")}</pre><p>Open GitHub → Actions → Nightly backup for the log. D1 Time Travel still covers the last 30 days.</p>`,
  }).catch(() => {})));
  return NextResponse.json({ received: true });
}
