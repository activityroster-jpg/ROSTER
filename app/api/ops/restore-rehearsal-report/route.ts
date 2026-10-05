import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCronSecret } from "@/lib/security/cron-secret";
import { writeLastRehearsal } from "@/lib/ops/backup-status";
import { platformAdminEmails } from "@/lib/platform/admin";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  ok: z.boolean(),
  file: z.string().max(200).nullable().optional(),
  tables: z.number().int().nonnegative().nullable().optional(),
  rows: z.number().int().nonnegative().nullable().optional(),
  seconds: z.number().int().nonnegative().nullable().optional(),
  error: z.string().max(2000).nullable().optional(),
});

/**
 * The monthly restore rehearsal posts its result here: last night's backup was
 * decrypted, loaded into a throwaway database, counted row by row against the
 * file, upgraded with any newer migrations, then deleted. Remembered for the
 * Dev Center and emailed to the platform owner either way.
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`rehearsal-report:${clientIp(req)}`, 20, 60 * 60);
  if (!limit.allowed) return tooManyRequests();
  if (!checkCronSecret(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad payload" }, { status: 400 });
  const d = parsed.data;
  const status = { ok: d.ok, at: new Date().toISOString(), file: d.file ?? null, tables: d.tables ?? null, rows: d.rows ?? null, seconds: d.seconds ?? null, error: d.error ?? null };
  await writeLastRehearsal(status);
  const when = new Date(status.at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
  const rows = status.rows == null ? "" : status.rows.toLocaleString("en-GB");
  await Promise.all([...platformAdminEmails()].map((to) => sendEmail({
    to,
    subject: status.ok ? `✅ Restore rehearsal passed ${when} · ${status.tables ?? "?"} tables, ${rows} rows · ${status.seconds ?? "?"}s` : `❌ Restore rehearsal FAILED ${when}`,
    html: status.ok
      ? `<p>Last night's backup was restored into a throwaway database and checked. Nothing live was touched.</p><ul><li>Backup: ${escapeHtml(status.file ?? "")}</li><li>Every table's row count matched the backup file: ${status.tables ?? "?"} tables, ${rows} rows</li><li>Newer migrations applied cleanly on top</li><li>Time to restore: ${status.seconds ?? "?"} seconds</li></ul><p>The throwaway database has been deleted. Steps for a real restore: docs/runbooks/restore.md.</p>`
      : `<p>The monthly restore rehearsal did not pass, so a restore from last night's backup may not work.</p><pre>${escapeHtml(status.error ?? "no detail")}</pre><p>Open GitHub → Actions → Restore rehearsal for the log. D1 Time Travel still covers the last 30 days.</p>`,
  }).catch(() => {})));
  return NextResponse.json({ received: true });
}
