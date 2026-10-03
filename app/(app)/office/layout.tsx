import Link from "next/link";
import {
  CalendarDays,
  CalendarOff,
  ClipboardList,
  Clock,
  History,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Settings,
  Ship,
  Users,
  Wallet,
  CreditCard,
} from "lucide-react";
import { requireTenant } from "@/lib/tenant/require";
import { getDb, getRepositories } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { Logo } from "@/components/Logo";
import { TwoFactorNudge } from "@/components/office/TwoFactorNudge";
import { GhostBanner } from "@/components/office/GhostBanner";
import { eq } from "drizzle-orm";
import { instructor as instructorTable } from "@/lib/db/schema";

const NAV = [
  {
    group: "Operate",
    items: [
      { href: "/office", label: "Dashboard", icon: LayoutDashboard },
      { href: "/office/courses", label: "Courses", icon: CalendarDays },
      { href: "/office/availability", label: "Availability", icon: ClipboardList },
      { href: "/office/timeclock", label: "Time clock", icon: Clock },
      { href: "/office/leave", label: "Leave & cover", icon: CalendarOff },
    ],
  },
  {
    group: "Resources",
    items: [
      { href: "/office/staff", label: "Staff", icon: Users },
      { href: "/office/equipment", label: "Equipment", icon: Ship },
      { href: "/office/locations", label: "Locations", icon: MapPin },
      { href: "/office/finance", label: "Payroll", icon: Wallet },
    ],
  },
  {
    group: "Configure",
    items: [
      { href: "/office/settings", label: "Settings", icon: Settings },
      { href: "/office/billing", label: "Billing", icon: CreditCard },
      { href: "/office/course-setup", label: "Course setup", icon: LifeBuoy },
      { href: "/office/change-log", label: "Change log", icon: History },
    ],
  },
];

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const { ctx, organisation } = await requireTenant({ role: "admin" });
  let clockOn = false;

  // Nudge the admin to turn on 2FA once they've added staff (dismissible).
  let show2fa = false;
  // The shared admin login usually has no instructor record of its own; only
  // offer the instructor view when there is one to show.
  let hasInstructorRecord = false;
  try {
    const { control, tenant } = await getRepositories();
    const me = await control.userById(ctx.userId);
    if (me && !me.twoFactorEnabled) {
      show2fa = (await tenant.instructor.count(ctx)) >= 1;
    }
    hasInstructorRecord = (await tenant.instructor.count(ctx, eq(instructorTable.userId, ctx.userId))) > 0;
    clockOn = Boolean((await tenant.orgSettings.list(ctx))[0]?.timeclockEnabled);
  } catch { show2fa = false; }
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => clockOn || i.href !== "/office/timeclock") }));

  // Billing nudge: distinguish an active free trial from a failed payment.
  const sub = organisation.subscriptionStatus;
  let banner: { kind: "trial" | "pastdue"; daysLeft: number } | null = null;
  if (sub === "past_due" || sub === "unpaid") {
    banner = { kind: "pastdue", daysLeft: 0 };
  } else if (sub === "trialing" || sub == null) {
    try {
      const pricing = await new PlatformRepository(await getDb()).getPricing();
      const created = organisation.createdAt instanceof Date ? organisation.createdAt.getTime() : Number(organisation.createdAt);
      const ends = created + pricing.trialDays * 24 * 60 * 60 * 1000;
      banner = { kind: "trial", daysLeft: Math.max(0, Math.ceil((ends - Date.now()) / (24 * 60 * 60 * 1000))) };
    } catch { banner = null; }
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="flex w-60 flex-none flex-col bg-navy text-white">
        <div className="border-b border-white/10 px-5 py-5">
          <Logo variant="onDark" size="sm" />
          <p className="mt-1 truncate text-sm text-white/70">{organisation.name}</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {nav.map((section) => (
            <div key={section.group} className="mb-5">
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                {section.group}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-xs text-white/50">
          {hasInstructorRecord ? (
            <Link href="/portal" className="hover:text-white">
              Switch to instructor view →
            </Link>
          ) : (
            <span title="This admin login has no instructor record. To use the instructor app yourself, add yourself on the Instructors page with a personal email.">The instructor app is for your team</span>
          )}
        </div>
      </aside>
      <div className="flex-1 overflow-x-hidden">
        {ctx.ghost ? <GhostBanner centreName={organisation.name} /> : null}
        {show2fa && !ctx.ghost ? <TwoFactorNudge /> : null}
        {banner?.kind === "pastdue" ? (
          <Link href="/office/billing" className="block bg-port/15 px-6 py-2 text-center text-sm font-medium text-port hover:bg-port/20">
            Your last payment failed — update your card to keep your centre active →
          </Link>
        ) : banner?.kind === "trial" ? (
          <Link href="/office/billing" className="block bg-amber/15 px-6 py-2 text-center text-sm font-medium text-navy hover:bg-amber/20">
            {banner.daysLeft > 0
              ? `You're on a free trial — ${banner.daysLeft} day${banner.daysLeft === 1 ? "" : "s"} left. Add payment to keep your centre active →`
              : "Your free trial has ended — add payment to keep your centre active →"}
          </Link>
        ) : null}
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
