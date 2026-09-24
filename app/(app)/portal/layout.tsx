import Link from "next/link";
import { eq } from "drizzle-orm";
import { Bell, CalendarCheck, CalendarClock, CalendarOff, Clock, FileCheck, Timer } from "lucide-react";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { unreadCount } from "@/lib/services/notifications";

const TABS = [
  { href: "/portal", label: "Schedule", icon: CalendarCheck },
  { href: "/portal/availability", label: "Available", icon: CalendarClock },
  { href: "/portal/timeclock", label: "Clock", icon: Timer },
  { href: "/portal/leave", label: "Leave", icon: CalendarOff },
  { href: "/portal/hours", label: "Hours", icon: Clock },
  { href: "/portal/documents", label: "Docs", icon: FileCheck },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { ctx, organisation, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  const unread = me ? await unreadCount(repos, ctx, me.id) : 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-canvas">
      <header className="flex items-center justify-between bg-navy px-4 py-4 text-white">
        <div>
          <p className="font-display text-lg font-bold">
            Activity<span className="text-ryablue-bright">Roster</span>
          </p>
          <p className="text-sm text-white/70">{organisation.name}</p>
        </div>
        <Link href="/portal/notifications" className="relative rounded-full p-2 hover:bg-white/10" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-port px-1 text-[10px] font-bold">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Link>
      </header>
      <main className="flex-1 px-4 py-5 pb-24">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center justify-around border-t border-slate-200 bg-white py-2">
        {TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} className="flex flex-col items-center gap-1 px-3 py-1 text-slate-500">
            <tab.icon className="h-5 w-5" />
            <span className="text-[11px]">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
