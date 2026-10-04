import { getRepositories } from "@/lib/cf/bindings";
import { calendarFeedFor, resolveCalendarToken } from "@/lib/services/calendar-feed";
import { rateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * An instructor's private calendar feed (ICS). The link is the credential: it
 * names the centre and carries a secret only its owner was shown. Calendar
 * apps poll it about hourly; anything beyond that is refused.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const raw = (await params).token.replace(/\.ics$/i, "");
  if (raw.length > 120) return new Response("Not found", { status: 404 });
  const limit = await rateLimit(`calendar:${raw.slice(-12)}`, 60, 60 * 60);
  if (!limit.allowed) return tooManyRequests();
  const repos = await getRepositories();
  const who = await resolveCalendarToken(repos, raw);
  if (!who) return new Response("This calendar link isn't active any more. Make a new one in the ActivityRoster app (Settings → Calendar).", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const ics = await calendarFeedFor(repos, who.ctx, who.instructorId, who.orgName);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="roster.ics"',
      "Cache-Control": "private, max-age=900",
      "X-Robots-Tag": "noindex",
    },
  });
}
