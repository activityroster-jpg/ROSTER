import { fmtWallTime } from "@/lib/domain";
import { requireTenant } from "@/lib/tenant/require";
import { childrenFor } from "@/lib/services/guardians";
import { getRotaDays } from "@/lib/services/schedule";
import { Card } from "@/components/ui";
import { SignOutLink } from "@/components/SignOutLink";

export const dynamic = "force-dynamic";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/**
 * A parent or guardian's read-only view: the next four weeks of their
 * under-18 child's roster. Dates, courses, times and places only; no
 * colleagues' details, no contact details, nothing to edit.
 */
export default async function ParentPage() {
  const { ctx, repos, organisation } = await requireTenant({ permission: "parent.view" });
  const links = await childrenFor(repos, ctx, ctx.userId);
  const from = today();
  const days = await getRotaDays(repos, ctx, from, 28);
  const children = await Promise.all(links.map(async (l) => {
    const child = await repos.tenant.instructor.findById(ctx, l.instructorId);
    const mine = child ? days.flatMap((d) => d.sessions.filter((s) => s.staff.some((x) => x.status !== "declined") && s.staff.some(() => true)).map((s) => ({ ...s, day: d.label, date: d.date }))).filter((s) => s.staff.length > 0) : [];
    // Only sessions this child is on: match by name is not safe; re-read their assignments.
    const staffRows = child ? (await repos.tenant.courseStaff.list(ctx)).filter((cs) => cs.instructorId === child.id && cs.status !== "declined").map((cs) => cs.courseId) : [];
    const onCourses = new Set(staffRows);
    return { link: l, child, sessions: mine.filter((s) => onCourses.has(s.courseId)) };
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-xs text-slate-400">{organisation.name} · parent / guardian view</p>
      <h1 className="font-display text-2xl font-semibold text-navy">Upcoming sessions</h1>
      <p className="mb-5 mt-1 text-sm text-slate-500">The next four weeks, as currently rostered by the centre. This page is read-only; questions go to the centre.</p>
      {children.length === 0 ? <Card><p className="text-sm text-slate-600">No young person is linked to your account at this centre any more.</p></Card> : null}
      {children.map(({ link, child, sessions }) => (
        <Card key={link.id} className="mb-5">
          <h2 className="font-semibold text-navy">{child?.name ?? "Young person"}</h2>
          <p className="mb-3 text-xs text-slate-500">Consent recorded by the centre{link.consentGivenAt ? ` on ${link.consentGivenAt.toLocaleDateString("en-GB")}` : ""}{link.consentNote ? `: ${link.consentNote}` : ""}.</p>
          {sessions.length === 0 ? <p className="text-sm text-slate-500">Nothing rostered in the next four weeks.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {sessions.map((s) => (
                <li key={s.sessionId} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span><span className="font-medium text-navy">{s.day}</span> · {fmtWallTime(s.startAt)}–{new Date(s.endAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}</span>
                  <span className="text-slate-600">{s.courseName}{s.locations.length ? ` · ${s.locations.join(", ")}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
      <p className="text-xs text-slate-400"><SignOutLink to="/login">Sign out</SignOutLink></p>
    </div>
  );
}
