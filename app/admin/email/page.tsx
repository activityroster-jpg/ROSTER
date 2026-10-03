import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { Card } from "@/components/ui";
import { EmailQueue, type OutboxRow } from "@/components/admin/EmailQueue";
import { mailProviderOrder, readMailFailover } from "@/lib/ops/mail-status";
import { maskEmail } from "@/lib/security/mask";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email" };

export default async function AdminEmailPage() {
  await requirePlatformAdmin();
  const p = new PlatformRepository(await getDb());
  const since = new Date(Date.now() - 24 * 3600_000);
  let counts = { queued: 0, failed: 0, sentRecently: 0 };
  let rows: OutboxRow[] = [];
  let suppressed = 0;
  try {
    counts = await p.emailOutboxCounts(since);
    const [queued, failed] = await Promise.all([p.listEmailOutbox("queued", 100), p.listEmailOutbox("failed", 200)]);
    rows = [...queued, ...failed].map((r) => ({
      id: r.id, status: r.status, stream: r.stream, to: maskEmail(r.toEmail), subject: r.subject, attempts: r.attempts, lastError: r.lastError,
      nextAttemptAt: r.nextAttemptAt?.toISOString() ?? null, updatedAt: r.updatedAt.toISOString(), retryable: Boolean(r.html || r.text),
    }));
    suppressed = (await p.listSuppressions(1000)).length;
  } catch { /* table arrives with the next migration */ }
  const order = mailProviderOrder();
  const failover = await readMailFailover();
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Email</h1>
      <p className="mb-5 max-w-3xl text-sm text-slate-500">Every email the platform sends goes through a queue: one attempt straight away, then retries from the hourly tick with growing gaps, then this list. Bodies are cleared once sent or finally failed. Addresses that bounce or complain go on the suppression list and are never emailed again.</p>
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Card><p className="text-xs font-semibold text-navy">Providers</p><p className="mt-1 text-lg font-semibold text-navy">{order.length ? order.join(" → ") : "none"}</p><p className="text-xs text-slate-400">{failover ? `last failover ${new Date(failover.at).toLocaleString("en-GB")}` : "no failovers recorded"}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Sent, last 24 h</p><p className="mt-1 text-2xl font-semibold text-starboard">{counts.sentRecently}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Waiting to retry</p><p className={`mt-1 text-2xl font-semibold ${counts.queued ? "text-amber-600" : "text-navy"}`}>{counts.queued}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Failed</p><p className={`mt-1 text-2xl font-semibold ${counts.failed ? "text-port" : "text-navy"}`}>{counts.failed}</p><p className="text-xs text-slate-400"><a href="/admin/outreach" className="hover:underline">{suppressed} suppressed address{suppressed === 1 ? "" : "es"}</a></p></Card>
      </div>
      <EmailQueue rows={rows} />
    </div>
  );
}
