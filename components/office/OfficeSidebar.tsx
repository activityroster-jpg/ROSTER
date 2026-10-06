"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays, CalendarOff, ClipboardList, Clock, CreditCard, History, LayoutDashboard, LifeBuoy, Lightbulb, MapPin, Menu, Settings, Ship, Users, Wallet, X,
 LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { signOut } from "@/lib/auth/client";
import { can, type OfficeFeature, type Permission } from "@/lib/auth/rbac";
import type { MembershipRole } from "@/lib/db/schema";

const NEEDS: Record<string, Permission> = {
  "/office": "office.view", "/office/courses": "roster.edit", "/office/rota": "rota.view", "/office/availability": "roster.edit", "/office/timeclock": "finance.view", "/office/leave": "roster.edit",
  "/office/staff": "staff.view", "/office/equipment": "roster.edit", "/office/locations": "roster.edit", "/office/finance": "finance.view",
  "/office/settings": "settings.edit", "/office/billing": "billing.manage", "/office/course-setup": "roster.edit", "/office/change-log": "settings.edit",
  "/office/requests": "office.view",
};

const NAV = [
  {
    group: "Operate",
    items: [
      { href: "/office", label: "Dashboard", icon: LayoutDashboard },
      { href: "/office/courses", label: "Courses", icon: CalendarDays },
      { href: "/office/course-setup", label: "Course setup", icon: LifeBuoy },
      { href: "/office/rota", label: "Roster", icon: ClipboardList },
      { href: "/office/availability", label: "Availability", icon: CalendarDays },
      { href: "/office/timeclock", label: "Time clock", icon: Clock },
      { href: "/office/leave", label: "Leave & cover", icon: CalendarOff },
    ],
  },
  {
    group: "People & kit",
    items: [
      { href: "/office/staff", label: "Instructors", icon: Users },
      { href: "/office/equipment", label: "Equipment", icon: Ship },
      { href: "/office/locations", label: "Locations", icon: MapPin },
      { href: "/office/finance", label: "Payroll", icon: Wallet },
    ],
  },
  {
    group: "Set up",
    items: [
      { href: "/office/settings", label: "Settings", icon: Settings },
      { href: "/office/billing", label: "Billing", icon: CreditCard },
      { href: "/office/change-log", label: "Change log", icon: History },
      { href: "/office/requests", label: "Requests & ideas", icon: Lightbulb },
    ],
  },
];

/**
 * The office navigation. A fixed sidebar on laptops; on phones a top bar with
 * a menu button that slides the same list in, so the office works at the
 * slipway as well as at the desk.
 */
export function OfficeSidebar({ orgName, clockOn, hasInstructorRecord, role = "owner", features = [] }: { orgName: string; clockOn: boolean; hasInstructorRecord: boolean; role?: MembershipRole; features?: readonly OfficeFeature[] | readonly string[] }) {
  const doSignOut = async () => { try { await signOut(); } finally { window.location.href = "/sign-in"; } };
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => (clockOn || i.href !== "/office/timeclock") && can({ role, features }, NEEDS[i.href] ?? "settings.edit")) })).filter((g) => g.items.length > 0);
  const active = (href: string) => (href === "/office" ? pathname === "/office" : pathname.startsWith(href));

  const list = (
    <>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {nav.map((section) => (
          <div key={section.group} className="mb-5">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-white/40">{section.group}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} aria-current={active(item.href) ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-white/10 hover:text-white ${active(item.href) ? "bg-white/15 text-white" : "text-white/80"}`}>
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
          <Link href="/portal" className="hover:text-white">Switch to instructor view →</Link>
        ) : (
          <span title="This admin login has no instructor record. To use the instructor app yourself, add yourself on the Instructors page with a personal email.">The instructor app is for your team</span>
        )}
        <button type="button" onClick={doSignOut} className="mt-3 flex w-full items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Laptop: fixed sidebar */}
      <aside className="hidden w-60 flex-none flex-col bg-navy text-white lg:flex print:hidden">
        <div className="border-b border-white/10 px-5 py-5">
          <Logo variant="onDark" size="sm" />
          <p className="mt-1 truncate text-sm text-white/70">{orgName}</p>
        </div>
        {list}
      </aside>
      {/* Phone / tablet: top bar + slide-over */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between bg-navy px-4 py-3 text-white lg:hidden print:hidden">
        <div className="flex items-center gap-3">
          <Logo variant="onDark" size="sm" />
          <span className="truncate text-sm text-white/70">{orgName}</span>
        </div>
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 hover:bg-white/10"><Menu className="h-5 w-5" /></button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-navy text-white shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div><Logo variant="onDark" size="sm" /><p className="mt-1 truncate text-sm text-white/70">{orgName}</p></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            {list}
          </div>
        </div>
      ) : null}
    </>
  );
}
