import Link from "next/link";
import { CalendarCheck, CalendarClock, Clock, FileCheck } from "lucide-react";
import { requireTenant } from "@/lib/tenant/require";

const TABS = [
  { href: "/portal", label: "Schedule", icon: CalendarCheck },
  { href: "/portal/availability", label: "Availability", icon: CalendarClock },
  { href: "/portal/hours", label: "Hours", icon: Clock },
  { href: "/portal/documents", label: "Documents", icon: FileCheck },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { organisation } = await requireTenant();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-canvas">
      <header className="bg-navy px-4 py-4 text-white">
        <p className="font-display text-lg font-bold">
          Activity<span className="text-teal">Roster</span>
        </p>
        <p className="text-sm text-white/70">{organisation.name}</p>
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
