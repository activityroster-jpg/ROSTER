import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Logo variant="onDark" size="sm" />
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">Platform admin</span>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/admin" className="text-white/80 hover:text-white">Overview</Link>
            <Link href="/admin/tasks" className="text-white/80 hover:text-white">Tasks</Link>
            <Link href="/admin/marketing" className="text-white/80 hover:text-white">Marketing</Link>
            <Link href="/admin/calls" className="text-white/80 hover:text-white">Calls</Link>
            <Link href="/admin/blog" className="text-white/80 hover:text-white">Blog</Link>
            <Link href="/admin/errors" className="text-white/80 hover:text-white">Errors</Link>
            <Link href="/admin/change-log" className="text-white/80 hover:text-white">Change log</Link>
            <span className="text-white/40">·</span>
            <span className="text-white/60">{email}</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
