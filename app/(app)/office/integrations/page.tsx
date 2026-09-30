import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { PROVIDERS, providerName, providerColor } from "@/lib/integrations/catalogue";
import { BookingIntegrations } from "@/components/office/BookingIntegrations";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const rows = await repos.tenant.integration.list(ctx);

  const connected = rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    name: providerName(r.provider),
    color: providerColor(r.provider),
    kind: r.kind,
    feedUrl: r.feedUrl,
    status: r.status,
    lastSyncedAt: r.lastSyncedAt ? (r.lastSyncedAt instanceof Date ? r.lastSyncedAt.toISOString() : new Date(Number(r.lastSyncedAt)).toISOString()) : null,
    lastResult: r.lastResult,
  }));

  const providers = PROVIDERS.map((p) => ({ id: p.id, name: p.name, color: providerColor(p.id), category: p.category, blurb: p.blurb, methods: p.methods, apiPlanned: p.apiPlanned, apiAdapter: p.apiAdapter, icsHelp: p.icsHelp, website: p.website }));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Booking system integrations</h1>
        <Link href="/office/courses" className="text-sm text-teal hover:underline">← Courses</Link>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Feed your courses in from the booking or club system you already use. Connect its calendar feed, then press
        <span className="font-medium text-navy"> Check for updates</span> whenever you like — you review the new and
        removed courses and choose what to apply. Nothing is ever imported or deleted without your say-so.
      </p>
      <a href="/learn?topic=integrations" target="_blank" rel="noreferrer" className="mb-6 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">
        📖 Read the guide
      </a>
      <BookingIntegrations providers={providers} connected={connected} />
    </div>
  );
}
