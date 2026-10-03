import Link from "next/link";
import { apexDomain } from "@/lib/config";
import { eq } from "drizzle-orm";
import { Bell, CalendarCheck, CalendarClock, CalendarOff, Clock, FileCheck, Settings, Timer } from "lucide-react";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { unreadCount } from "@/lib/services/notifications";
import { Logo } from "@/components/Logo";
import { NativeBridge } from "@/components/mobile/NativeBridge";
import { ensureExpiryReminders } from "@/lib/services/reminders";

const TABS = [
  { href: "/portal", label: "Schedule", icon: CalendarCheck },
  { href: "/portal/availability", label: "Available", icon: CalendarClock },
  { href: "/portal/timeclock", label: "Clock", icon: Timer },
  { href: "/portal/leave", label: "Leave", icon: CalendarOff },
  { href: "/portal/hours", label: "Hours", icon: Clock },
  { href: "/portal/documents", label: "Docs", icon: FileCheck },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { ctx, organisation, repos, trial } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  // Cert-expiry reminders are raised lazily, on the instructor's own visits.
  if (me && !ctx.readOnly) await ensureExpiryReminders(repos, ctx, me.id).catch(() => undefined);
  const unread = me ? await unreadCount(repos, ctx, me.id) : 0;
  const portalSettings = (await repos.tenant.orgSettings.list(ctx))[0];
  const clockOn = Boolean(portalSettings?.timeclockEnabled);
  const privacyUrl = portalSettings?.privacyNoticeUrl ?? null;
  const tabs = TABS.filter((t) => clockOn || t.href !== "/portal/timeclock");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-canvas">
      <NativeBridge />
      <header className="flex items-center justify-between bg-navy px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <div>
          <Logo variant="onDark" size="sm" />
          <p className="mt-1 text-sm text-white/70">{organisation.name}</p>
        </div>
        <div className="flex items-center gap-1">
        <Link href="/portal/settings" className="rounded-full p-2 hover:bg-white/10" aria-label="Settings"><Settings className="h-5 w-5" /></Link>
        <Link href="/portal/notifications" className="relative rounded-full p-2 hover:bg-white/10" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-port px-1 text-[10px] font-bold">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Link>
        </div>
      </header>
      {trial.kind === "read_only" ? (
        <p className="bg-amber/25 px-4 py-2 text-center text-xs font-medium text-navy">Your centre&apos;s free trial has ended, so nothing can be changed for now. Please let whoever runs your centre know.</p>
      ) : null}
      <main className="flex-1 px-4 py-5 pb-24">
        {children}
        <p className="mt-8 text-center text-[11px] text-slate-400">
          Privacy: {privacyUrl ? <><a href={privacyUrl} target="_blank" rel="noreferrer" className="underline">{organisation.name}&rsquo;s notice</a> · </> : null}
          <a href={`https://${apexDomain()}/privacy`} target="_blank" rel="noreferrer" className="underline">ActivityRoster&rsquo;s notice</a>
        </p>
      </main>
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center justify-around border-t border-slate-200 bg-white py-2">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className="flex flex-col items-center gap-1 px-3 py-1 text-slate-500">
            <tab.icon className="h-5 w-5" />
            <span className="text-[11px]">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
