import { headers } from "next/headers";
import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { getEnv } from "@/lib/cf/bindings";
import { resolveHost } from "@/lib/tenant/host";
import { Card } from "@/components/ui";
import { SwitchCentre } from "@/components/mobile/SwitchCentre";
import { SignOutButton } from "@/components/portal/SignOutButton";
import { NativeSettings } from "@/components/mobile/NativeSettings";
import { ProfileCard } from "@/components/portal/ProfileCard";
import { PasswordCard } from "@/components/portal/PasswordCard";
import { ShareContactPref } from "@/components/portal/ShareContactPref";
import { isUnder18 } from "@/lib/domain/age";
import { getAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { instructor as instructorTable } from "@/lib/db/schema";
import { DetailsCard } from "@/components/portal/DetailsCard";
import { CalendarFeedCard } from "@/components/portal/CalendarFeedCard";

export const dynamic = "force-dynamic";

/** Instructor settings: which centre, notifications, security, sign out. */
export default async function PortalSettingsPage() {
  const { ctx, organisation, repos } = await requireTenant();
  const env = getEnv();
  const host = resolveHost((await headers()).get("host"), env.APP_APEX_DOMAIN);
  const onApex = host.kind === "apex";
  const joinHref = onApex ? "/app/join" : `https://${env.APP_APEX_DOMAIN}/app/join`;
  const ms = await repos.control.membershipsForUser(ctx.userId);
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0] ?? null;
  let hasPassword = false;
  try {
    const accounts = await (await getAuth()).api.listUserAccounts({ headers: new Headers(await headers()) });
    hasPassword = accounts.some((a) => a.providerId === "credential");
  } catch { hasPassword = false; }
  const settingsRow = (await repos.tenant.orgSettings.list(ctx))[0];
  const centres = ms
    .filter((m) => m.role === "instructor" || m.status === "active")
    .map((m) => ({ organisationId: m.organisationId, name: m.name, slug: m.slug, status: m.orgStatus !== "active" ? "suspended" : m.status, current: m.organisationId === ctx.organisationId }))
    .sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold text-navy">Settings</h1>

      <Card>
        <h2 className="mb-1 font-semibold text-navy">Your centre{centres.length > 1 ? "s" : ""}</h2>
        <p className="mb-3 text-xs text-slate-500">You&apos;re viewing <strong>{organisation.name}</strong>.{centres.length > 1 ? " Tap another to switch." : ""}</p>
        <SwitchCentre centres={centres} joinHref={joinHref} />
      </Card>

      {me ? (
        <Card>
          <h2 className="mb-3 font-semibold text-navy">About you</h2>
          <ProfileCard name={me.name} phone={me.phone} email={me.email} />
          <div className="mt-4 border-t border-slate-100 pt-3"><DetailsCard dateOfBirth={me.dateOfBirth} /></div>
          {!isUnder18(me.dateOfBirth) ? <div className="mt-4 border-t border-slate-100 pt-3"><ShareContactPref initial={Boolean(me.shareContact)} /></div> : null}
        </Card>
      ) : null}

      {me ? (
        <Card>
          <h2 className="mb-1 font-semibold text-navy">Calendar</h2>
          <CalendarFeedCard active={Boolean(me.calendarTokenHash)} createdAt={me.calendarTokenCreatedAt ? me.calendarTokenCreatedAt.toISOString() : null} />
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-1 font-semibold text-navy">Notifications</h2>
        <p className="mb-2 text-xs text-slate-500">In-app notifications are always on. Choose whether you also get emails.</p>
        <Link href="/portal/notifications" className="text-sm font-semibold text-teal">Notification settings →</Link>
      </Card>

      <NativeSettings />

      <Card>
        <h2 className="mb-1 font-semibold text-navy">Account</h2>
        <p className="mb-2 text-xs text-slate-500">Your PIN is the quick second check when you sign in. Change it any time; if you&apos;ve forgotten it, you can reset it on the PIN screen at your next sign-in.</p>
        <Link href="/set-pin?next=/portal/settings" className="mb-4 inline-block text-sm font-semibold text-teal">Change my PIN →</Link>
        <div className="mb-4 border-t border-slate-100 pt-3"><PasswordCard hasPassword={hasPassword} /></div>
        <SignOutButton to={onApex ? "/app" : "/sign-in"} />
      </Card>
    </div>
  );
}
