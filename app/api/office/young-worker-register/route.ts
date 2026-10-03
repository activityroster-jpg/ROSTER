import { requireTenant } from "@/lib/tenant/require";
import { registerToCsv, youngWorkerRegister } from "@/lib/services/working-time";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDays(iso: string, n: number): string { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

/**
 * CSV time register of every under-18's sessions between two dates (default:
 * the last 31 days). Admin only; the service writes the view to the audit log.
 * Capped at 400 days so one request can't dump years of a child's history.
 */
export async function GET(req: Request) {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const sp = new URL(req.url).searchParams;
  const toQ = sp.get("to"), fromQ = sp.get("from");
  const to = toQ && ISO.test(toQ) ? toQ : londonToday();
  let from = fromQ && ISO.test(fromQ) ? fromQ : addDays(to, -31);
  if (from > to) from = to;
  if (addDays(from, 400) < to) from = addDays(to, -400);
  const csv = registerToCsv(await youngWorkerRegister(repos, ctx, from, to));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ctx.slug}-young-worker-register-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
