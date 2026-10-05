import { statusPageUrl } from "@/lib/config";
import { readIncident } from "@/lib/ops/incident";

/** Platform-wide notice set from the Dev Center; renders nothing when there is none. */
export async function IncidentBanner() {
  const inc = await readIncident();
  if (!inc?.message) return null;
  const tone = inc.level === "warn" ? "bg-port/15 text-port" : "bg-sky-50 text-sky-900";
  return (
    <div role="status" className={`px-4 py-2 text-center text-sm font-medium ${tone}`}>
      {inc.message}{statusPageUrl() ? <> <a href={statusPageUrl()!} target="_blank" rel="noreferrer" className="underline">Status page</a></> : null}
    </div>
  );
}

export function MaintenanceNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="font-display text-2xl font-semibold text-navy">Back shortly</p>
      <p className="mt-3 text-sm text-slate-600">{message || "ActivityRoster is being updated. Nothing has been lost; please try again in a few minutes."}</p>
      {statusPageUrl() ? <p className="mt-6 text-xs text-slate-400">Live updates: <a href={statusPageUrl()!} target="_blank" rel="noreferrer" className="underline">status page</a></p> : null}
    </div>
  );
}
