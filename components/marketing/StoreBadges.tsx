import { APP_STORES, appStoresLive } from "@/lib/config";

/** App Store and Google Play links, shown only once the apps are live (lib/config APP_STORES). */
export function StoreBadges({ className = "" }: { className?: string }) {
  if (!appStoresLive()) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      {APP_STORES.ios ? <a href={APP_STORES.ios} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"> App Store</a> : null}
      {APP_STORES.android ? <a href={APP_STORES.android} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">▶ Google Play</a> : null}
    </span>
  );
}
