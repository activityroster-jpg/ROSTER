import Link from "next/link";
import {
  CalendarDays,
  CalendarOff,
  ClipboardList,
  Clock,
  BarChart3,
  History,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Settings,
  Ship,
  Users,
  Wallet,
} from "lucide-react";
import { requireTenant } from "@/lib/tenant/require";

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
      { href: "/office/reports", label: "Reports", icon: BarChart3 },
      { href: "/office/finance", label: "Payroll", icon: Wallet },
    ],
  },
  {
    group: "Configure",
    items: [
      { href: "/office/settings", label: "Settings", icon: Settings },
      { href: "/office/course-setup", label: "Course setup", icon: LifeBuoy },
      { href: "/office/change-log", label: "Change log", icon: History },
    ],
  },
];

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const { organisation } = await requireTenant({ role: "admin" });

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="flex w-60 flex-none flex-col bg-navy text-white">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="font-display text-lg font-bold">
            Activity<span className="text-ryablue-bright">Roster</span>
          </p>
          <p className="mt-1 truncate text-sm text-white/70">{organisation.name}</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((section) => (
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
          <Link href="/portal" className="hover:text-white">
            Switch to instructor view →
          </Link>
        </div>
      </aside>
      <div className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
