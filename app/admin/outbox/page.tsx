import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getEnv } from "@/lib/cf/bindings";
import { readOutbox } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Outbox" };

/** Staging only: every email the app tried to send, newest first, so testers can read codes and links. */
export default async function OutboxPage() {
  await requirePlatformAdmin();
  const env = getEnv();
  if (env.APP_ENV !== "staging") {
    return <div><h1 className="font-display text-2xl font-bold text-navy">Outbox</h1><p className="mt-2 text-sm text-slate-500">The outbox only exists on staging. Production emails go straight to Resend.</p></div>;
  }
  const rows = await readOutbox();
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Outbox <span className="text-base font-normal text-slate-400">staging</span></h1>
      <p className="mb-5 text-sm text-slate-500">The last {rows.length} emails this environment produced. {env.RESEND_API_KEY ? "They were also sent for real through Resend." : "No Resend key is set on staging, so nothing was actually sent; read codes and links here."}</p>
      {rows.length === 0 ? <p className="rounded-card border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nothing yet.</p> : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.at}-${i}`} className="rounded-card border border-slate-200 bg-white">
              <details>
                <summary className="cursor-pointer px-4 py-3 text-sm"><span className="font-semibold text-navy">{r.subject}</span> <span className="text-slate-500">to {r.to}</span> <span className="float-right text-xs text-slate-400">{new Date(r.at).toLocaleString("en-GB")}</span></summary>
                <pre className="whitespace-pre-wrap border-t border-slate-100 px-4 py-3 font-sans text-sm text-slate-700">{r.text}</pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
