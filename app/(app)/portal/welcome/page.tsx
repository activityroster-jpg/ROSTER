import Link from "next/link";
import { eq } from "drizzle-orm";
import { CalendarClock, FileCheck, CalendarCheck } from "lucide-react";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { getStaffProfile } from "@/lib/services/hr";
import { DocumentManager, type DocItem } from "@/components/DocumentManager";
import { SetPasswordCard } from "@/components/portal/SetPasswordCard";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PortalWelcomePage() {
  const { ctx, repos, organisation } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];

  if (!me) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          You&apos;re signed in, but your instructor profile isn&apos;t linked yet. Ask your centre to re-send your invite,
          or check you used the same email address they invited.
        </p>
      </Card>
    );
  }

  const firstName = me.name.split(" ")[0] || me.name;
  const profile = await getStaffProfile(repos, ctx, me.id);
  const docs = profile?.documents ?? [];
  const items: DocItem[] = docs.map((d) => ({
    kind: d.kind, itemId: d.itemId, name: d.name, expiryDate: d.expiryDate, mandatory: d.mandatory, hasFile: d.hasFile, docKey: d.docKey, verified: d.verified,
  }));
  const outstanding = docs.filter((d) => !d.hasFile).length;

  return (
    <div>
      {/* Greeting */}
      <div className="rounded-card bg-navy p-5 text-white">
        <p className="text-sm text-white/70">Welcome to</p>
        <h1 className="font-display text-2xl font-bold">{organisation.name}</h1>
        <p className="mt-2 text-sm text-white/80">
          Hi {firstName} — your account is set up and you&apos;re now part of the team here. Let&apos;s get you ready
          for the water.
        </p>
      </div>

      {/* First steps */}
      <div className="mt-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Get started</p>

        <SetPasswordCard />

        <div className="flex items-start gap-3 rounded-card border border-slate-200 bg-white p-4">
          <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-teal/15 text-teal"><FileCheck className="h-5 w-5" /></span>
          <div className="flex-1">
            <p className="font-semibold text-navy">1. Add your certs</p>
            <p className="text-sm text-slate-600">
              Upload a photo or PDF of each cert and check, and add its expiry date. Your centre confirms them.
              {outstanding > 0 ? <span className="font-medium text-navy"> {outstanding} still to add.</span> : docs.length ? <span className="font-medium text-starboard"> All uploaded — nice one.</span> : null}
            </p>
          </div>
        </div>

        {/* Inline uploader so they can do it right here */}
        {items.length > 0 ? (
          <Card><DocumentManager items={items} admin={false} /></Card>
        ) : (
          <Card><p className="text-sm text-slate-500">Your centre hasn&apos;t listed any required documents yet — you can add them later from the <Link href="/portal/documents" className="text-teal hover:underline">Docs</Link> tab.</p></Card>
        )}

        <Link href="/portal/availability" className="flex items-start gap-3 rounded-card border border-slate-200 bg-white p-4 hover:border-teal">
          <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-teal/15 text-teal"><CalendarClock className="h-5 w-5" /></span>
          <div className="flex-1">
            <p className="font-semibold text-navy">2. Set your availability</p>
            <p className="text-sm text-slate-600">Tell the office which sessions you can work so they can roster you in.</p>
          </div>
          <span className="self-center text-teal">→</span>
        </Link>

        <Link href="/portal" className="flex items-start gap-3 rounded-card border border-slate-200 bg-white p-4 hover:border-teal">
          <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-teal/15 text-teal"><CalendarCheck className="h-5 w-5" /></span>
          <div className="flex-1">
            <p className="font-semibold text-navy">3. See your schedule</p>
            <p className="text-sm text-slate-600">Your upcoming sessions appear here once the office rotas you on.</p>
          </div>
          <span className="self-center text-teal">→</span>
        </Link>
      </div>

      <div className="mt-6 text-center">
        <Link href="/portal" className="inline-block rounded-lg bg-teal px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700">Go to my portal</Link>
        <p className="mt-2 text-xs text-slate-400">Bookmark this site — you can sign back in any time with the link your centre sends, or your email &amp; password.</p>
      </div>
    </div>
  );
}
