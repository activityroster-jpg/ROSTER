import { headers } from "next/headers";
import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { getEnv } from "@/lib/cf/bindings";
import { resolveHost } from "@/lib/tenant/host";
import { Card } from "@/components/ui";
import { SwitchCentre } from "@/components/mobile/SwitchCentre";
import { SignOutButton } from "@/components/portal/SignOutButton";
import { NativeSettings } from "@/components/mobile/NativeSettings";

export const dynamic = "force-dynamic";

/** Instructor settings: which centre, notifications, security, sign out. */
export default async function PortalSettingsPage() {
  const { ctx, organisation, repos } = await requireTenant();
  const env = getEnv();
  const host = resolveHost((await headers()).get("host"), env.APP_APEX_DOMAIN);
  const onApex = host.kind === "apex";
  const joinHref = onApex ? "/app/join" : `https://${env.APP_APEX_DOMAIN}/app/join`;
  const ms = await repos.control.membershipsForUser(ctx.userId);
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
        <SignOutButton to={onApex ? "/app" : "/sign-in"} />
      </Card>
    </div>
  );
}
