import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { apexDomain } from "@/lib/config";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { CentreControls } from "@/components/admin/CentreControls";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CentreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePlatformAdmin();
  const db = await getDb();
  const platform = new PlatformRepository(db);

  const org = await platform.organisationById(id);
  if (!org) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Centre not found.</p>
        <Link href="/admin" className="mt-2 inline-block text-sm font-semibold text-teal hover:underline">← Back to overview</Link>
      </Card>
    );
  }

  const [usage, members] = await Promise.all([platform.usageByOrg(), platform.membersFor(id)]);
  const u = usage.get(id) ?? { instructors: 0, courses: 0, bookings: 0, sessions: 0 };
  const apex = apexDomain();

  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="flex justify-between border-t border-slate-100 py-2 text-sm first:border-t-0">
      <span className="text-slate-500">{k}</span><span className="font-medium text-navy">{v}</span>
    </div>
  );

  return (
    <div>
      <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-600">← Overview</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">{org.name}</h1>
          <a href={`https://${org.slug}.${apex}`} className="text-sm text-teal hover:underline">{org.slug}.{apex}</a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold text-navy">Billing &amp; subscription</h2>
          <Row k="Plan" v={org.plan} />
          <Row k="Subscription" v={org.subscriptionStatus ?? "—"} />
          <Row k="Centre status" v={org.status} />
          <Row k="Stripe customer" v={org.stripeCustomerId ?? "— (no card on file)"} />
          <Row k="Stripe subscription" v={org.stripeSubscriptionId ?? "—"} />
          <Row k="Joined" v={org.createdAt.toISOString().slice(0, 10)} />
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold text-navy">Usage</h2>
          <Row k="Instructors" v={String(u.instructors)} />
          <Row k="Courses" v={String(u.courses)} />
          <Row k="Sessions" v={String(u.sessions)} />
          <Row k="Bookings" v={String(u.bookings)} />
          <Row k="Jurisdiction" v={org.jurisdiction} />
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold text-navy">Manage</h2>
        <CentreControls id={org.id} status={org.status} subscriptionStatus={org.subscriptionStatus} plan={org.plan} />
      </Card>

      <Card className="mt-6 p-0">
        <h2 className="px-4 pt-4 font-semibold text-navy">Members</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No members.</td></tr>
            ) : (
              members.map((m) => (
                <tr key={m.email}>
                  <td className="px-4 py-3 font-medium text-navy">{m.name}</td>
                  <td className="px-4 py-3 text-slate-600">{m.email}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{m.role}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{m.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
