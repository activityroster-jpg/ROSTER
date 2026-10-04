import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getEnv } from "@/lib/cf/bindings";
import { Logo } from "@/components/Logo";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export const metadata = { title: { default: "Dev Center · ActivityRoster", template: "%s · Dev Center" } };

/** Dev Center: the platform owner's area (centres, billing, marketing, blog, errors). Lives at /admin on the apex. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requirePlatformAdmin();
  const staging = getEnv().APP_ENV === "staging";

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav
        staging={staging}
        email={email}
        brand={
          <div className="flex items-center gap-3">
            <Logo variant="onDark" size="sm" />
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">Dev Center</span>
            {staging ? <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-semibold text-amber-200">staging</span> : null}
          </div>
        }
      />
      <main id="main" className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
