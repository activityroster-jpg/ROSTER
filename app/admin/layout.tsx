import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getEnv } from "@/lib/cf/bindings";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export const metadata = { title: { default: "Dev Center · ActivityRoster", template: "%s · Dev Center" } };

/** Dev Center: the platform owner's area (centres, billing, marketing, blog, errors). Lives at /admin on the apex. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requirePlatformAdmin();
  const staging = getEnv().APP_ENV === "staging";

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Logo variant="onDark" size="sm" />
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">Dev Center</span>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/admin" className="text-white/80 hover:text-white">Overview</Link>
            <Link href="/admin/finance" className="text-white/80 hover:text-white">Finance</Link>
            <Link href="/admin/tasks" className="text-white/80 hover:text-white">Tasks</Link>
            <Link href="/admin/marketing" className="text-white/80 hover:text-white">Marketing</Link>
            <Link href="/admin/outreach" className="text-white/80 hover:text-white">Outreach</Link>
            <Link href="/admin/calls" className="text-white/80 hover:text-white">Calls</Link>
            <Link href="/admin/blog" className="text-white/80 hover:text-white">Blog</Link>
            <Link href="/admin/errors" className="text-white/80 hover:text-white">Errors</Link>
            <Link href="/admin/change-log" className="text-white/80 hover:text-white">Change log</Link>
            <Link href="/admin/privacy" className="text-white/80 hover:text-white">Privacy</Link>
            <Link href="/admin/security" className="text-white/80 hover:text-white">Security</Link>
            <Link href="/admin/rules" className="text-white/80 hover:text-white">Rules</Link>
            {staging ? <Link href="/admin/outbox" className="rounded bg-amber-400/20 px-2 text-amber-200 hover:text-white">Outbox · staging</Link> : null}
            <span className="text-white/40">·</span>
            <span className="text-white/60">{email}</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
