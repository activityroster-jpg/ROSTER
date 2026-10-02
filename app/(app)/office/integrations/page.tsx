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
        <h1 className="font-display text-2xl font-semibold text-navy">Integrations &amp; import</h1>
        <Link href="/office/courses" className="text-sm text-teal hover:underline">← Courses</Link>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Everything for getting your courses in, in one place. Connect the booking or club system you already use and
        press <span className="font-medium text-navy">Check for updates</span> whenever you like, or bring a one-off
        timetable in from a spreadsheet or calendar. You review everything before anything is created — nothing is
        imported or deleted without your say-so.
      </p>

      {/* Spreadsheet / calendar import — moved here as the single import hub */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="font-semibold text-navy">Import from a spreadsheet or calendar</p>
          <p className="text-sm text-slate-500">A one-off bring-across of your existing timetable (CSV, Excel or an .ics calendar file).</p>
        </div>
        <Link href="/office/import" className="flex-none rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Import a timetable →</Link>
      </div>

      <a href="/learn?topic=integrations" target="_blank" rel="noreferrer" className="mb-6 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">
        📖 Read the guide
      </a>
      <BookingIntegrations providers={providers} connected={connected} />

      {/* Request an integration we don't list yet → contact */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-slate-300 bg-slate-50 p-4">
        <div>
          <p className="font-semibold text-navy">Don&apos;t see your booking system?</p>
          <p className="text-sm text-slate-500">Tell us what you use and we&apos;ll look at adding it.</p>
        </div>
        <Link href="/contact" className="flex-none rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-100">Request an integration →</Link>
      </div>
    </div>
  );
}
