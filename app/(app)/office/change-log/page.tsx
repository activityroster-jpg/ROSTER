import { requireTenant } from "@/lib/tenant/require";
import { Card } from "@/components/ui";
import { GuideLink } from "@/components/GuideLink";
import { describeAudit } from "@/lib/services/changelog";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export default async function ChangeLogPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const SECURITY: Record<string, string> = {
    new_device: "signed in from a new device", reauth_passed: "confirmed their identity on a new device", reauth_failed: "failed an identity check",
    pin_failed: "entered a wrong PIN", pin_locked: "was locked out after wrong PINs", pin_set: "set a PIN", pin_reset: "reset their PIN",
    password_changed: "changed their password", recovery_email_set: "set a recovery email", two_factor_enabled: "turned on two-factor", two_factor_disabled: "turned off two-factor",
    invite_accepted: "accepted an invitation", join_requested: "asked to join via the app", join_code_failed: "entered a wrong company code", sessions_revoked: "signed out all other devices",
    ghost_start: "ActivityRoster support opened the centre (Ghost Mode)", ghost_end: "ActivityRoster support left the centre",
  };
  const security = await repos.control.listSecurityEventsForOrg(ctx.organisationId, 200).catch(() => []);
  const entries = [
    ...(await repos.tenant.auditLog.list(ctx)).map((e) => ({ id: e.id, actorUserId: e.actorUserId, text: describeAudit(e.action, e.entity, e.after), createdAt: e.createdAt, kind: "change" as const })),
    ...security.map((e) => ({ id: `sec-${e.id}`, actorUserId: e.kind.startsWith("ghost") ? null : e.userId, text: `${SECURITY[e.kind] ?? e.kind.replace(/_/g, " ")}${e.country ? ` (${e.country})` : ""}`, createdAt: e.createdAt, kind: "security" as const })),
  ]
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 400);

  // Who did it: the admin login (the centre's name), an instructor's name, or the system.
  const actorIds = [...new Set(entries.map((e) => e.actorUserId).filter((x): x is string => Boolean(x)))];
  const instructors = await repos.tenant.instructor.list(ctx);
  const byUser = new Map(instructors.filter((i) => i.userId).map((i) => [i.userId!, i.name]));
  const names = new Map<string, string>();
  for (const id of actorIds) {
    const inst = byUser.get(id);
    if (inst) { names.set(id, inst); continue; }
    const u = await repos.control.userById(id);
    names.set(id, u?.name ?? u?.email ?? "Someone");
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Change log</h1>
          <p className="text-sm text-slate-500">Everything that changed in your centre and every sign-in event on its accounts, newest first — who, what and when.</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/api/office/audit-export" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">Download CSV (90 days)</a>
          <GuideLink topic="data" />
        </div>
      </div>
      <Card className="p-0">
        <ul className="divide-y divide-slate-100 text-sm">
          {entries.length === 0 ? (
            <li className="px-4 py-8 text-center text-slate-400">No changes recorded yet.</li>
          ) : (
            entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                <div>
                  <span className="font-medium text-navy">{e.actorUserId ? names.get(e.actorUserId) ?? "Someone" : "ActivityRoster"}</span>{" "}
                  <span className="text-slate-600">{e.text}</span>{e.kind === "security" ? <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">sign-in</span> : null}
                </div>
                <time className="text-xs text-slate-400">{e.createdAt ? fmt(new Date(e.createdAt)) : ""}</time>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
