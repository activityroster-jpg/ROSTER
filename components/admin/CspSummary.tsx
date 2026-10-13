import { Card } from "@/components/ui";
import { CSP_VERDICT_TEXT, type CspGroup } from "@/lib/security/csp";

const TONE: Record<CspGroup["verdict"], string> = {
  ours: "bg-port/10 text-port",
  "third-party": "bg-amber-100 text-amber-800",
  extension: "bg-slate-100 text-slate-600",
  cloudflare: "bg-slate-100 text-slate-600",
  dev: "bg-slate-100 text-slate-600",
};
const LABEL: Record<CspGroup["verdict"], string> = { ours: "Ours: fix first", "third-party": "Outside service", extension: "Browser extension", cloudflare: "Cloudflare", dev: "Dev / test" };

/** The open CSP reports grouped, with a plain answer on whether the stricter policy can be switched on. */
export function CspSummary({ groups }: { groups: CspGroup[] }) {
  if (!groups.length) return null;
  const ours = groups.filter((g) => g.verdict === "ours");
  const text = groups.map((g) => `${g.count}× ${g.directive} blocked ${g.blocked} [${g.verdict}] on ${g.pages.join(", ") || "?"}`).join("\n");
  return (
    <Card className="mb-6">
      <h2 className="mb-1 font-semibold text-navy">CSP reports, grouped</h2>
      <p className={`mb-3 text-sm font-medium ${ours.length ? "text-port" : "text-starboard"}`}>
        {ours.length
          ? `${ours.reduce((n, g) => n + g.count, 0)} report${ours.reduce((n, g) => n + g.count, 0) === 1 ? "" : "s"} point at our own code: the policy is enforced, so something of ours was refused for a visitor. Fix first.`
          : "Nothing points at our own code: the strict policy is enforced and nothing of ours is being refused."}
      </p>
      <ul className="divide-y divide-slate-100 text-sm">
        {groups.map((g) => (
          <li key={g.key} className="py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${TONE[g.verdict]}`}>{LABEL[g.verdict]}</span>
              <span className="font-medium text-navy">{g.count}×</span>
              <span className="break-all text-slate-700">{g.directive} blocked {g.blocked}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{CSP_VERDICT_TEXT[g.verdict]} Pages: {g.pages.join(", ") || "—"}.</p>
          </li>
        ))}
      </ul>
      <details className="mt-3 text-xs text-slate-500">
        <summary className="cursor-pointer font-medium text-teal">Summary to copy</summary>
        <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px] text-slate-700">{text}</pre>
      </details>
    </Card>
  );
}
