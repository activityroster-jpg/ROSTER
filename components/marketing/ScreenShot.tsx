import type { Screen } from "@/lib/screens";

/**
 * One real screenshot in a light browser or phone frame. Clicking it opens the
 * full-size image in a new tab, so the detail can be read.
 */
export function ScreenShot({ screen, eager = false, className = "" }: { screen: Screen; eager?: boolean; className?: string }) {
  const img = (
    <img
      src={screen.src}
      srcSet={screen.src2x ? `${screen.src} ${screen.width}w, ${screen.src2x} 2720w` : undefined}
      sizes={screen.src2x ? "(min-width: 768px) 1360px, 100vw" : undefined}
      width={screen.width}
      height={screen.height}
      alt={`${screen.title}: ${screen.caption}`}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className="block h-auto w-full"
    />
  );
  if (screen.device === "phone") {
    return (
      <a href={screen.src} target="_blank" rel="noreferrer" className={`block overflow-hidden rounded-[1.75rem] border-[6px] border-navy bg-navy shadow-lg ${className}`} title="Open full size">
        <div className="overflow-hidden rounded-[1.25rem] bg-white">{img}</div>
      </a>
    );
  }
  return (
    <a href={screen.src2x ?? screen.src} target="_blank" rel="noreferrer" className={`block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`} title="Open full size">
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-port/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-starboard/60" />
        <span className="ml-2 truncate text-[11px] text-slate-400">loughshore.activityroster.com</span>
      </div>
      {img}
    </a>
  );
}
