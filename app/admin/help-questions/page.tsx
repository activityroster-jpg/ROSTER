import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { HELP_QUESTION_DAYS, recentHelpQuestions, type HelpQuestionRow } from "@/lib/services/help";

export const dynamic = "force-dynamic";
export const metadata = { title: "Help questions" };

const when = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

export default async function HelpQuestionsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requirePlatformAdmin();
  const { show } = await searchParams;
  const unanswered = show === "unanswered";
  let rows: HelpQuestionRow[] = [];
  try { rows = await recentHelpQuestions(await getDb()); } catch { /* table arrives with the next migration */ }
  const missed = rows.filter((r) => !r.found);
  const shown = unanswered ? missed : rows;
  const tab = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm font-medium ${on ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"}`;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Help questions <span className="text-base font-normal text-slate-400">{rows.length} in the last {HELP_QUESTION_DAYS} days</span></h1>
      <p className="mb-5 max-w-3xl text-sm text-slate-500">
        What office users typed into the Help button inside their centre. Questions the guides couldn&rsquo;t answer are the ones to write up: add a line to the setup answers (<code>lib/help/faq.ts</code>) or a section to the Learning Centre.
        Only the question, the page and the guide it matched are kept, for {HELP_QUESTION_DAYS} days. Never the answer or who asked, and nothing from the public website.{" "}
        <a href="/learn?topic=help-assistant" target="_blank" rel="noreferrer" className="font-medium text-teal hover:underline">📖 Read the guide</a>
      </p>
      <div className="mb-4 flex gap-2">
        <Link href="/admin/help-questions" className={tab(!unanswered)}>All ({rows.length})</Link>
        <Link href="/admin/help-questions?show=unanswered" className={tab(unanswered)}>Not answered ({missed.length})</Link>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">{unanswered ? "Every question found an answer." : "No questions yet."}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">Question</th><th className="px-3 py-2">Answered from</th><th className="px-3 py-2">Page</th><th className="px-3 py-2">Centre</th><th className="px-3 py-2">When</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="max-w-md px-3 py-2 text-slate-800">{r.question}</td>
                  <td className="px-3 py-2">{r.found ? (r.topic ? <a href={`/learn?topic=${encodeURIComponent(r.topic)}`} target="_blank" rel="noreferrer" className="text-teal hover:underline">{r.topic}</a> : <span className="text-slate-400">small talk</span>) : <span className="rounded-full bg-port/10 px-2 py-0.5 text-xs font-medium text-port">Not answered</span>}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.path ?? "–"}</td>
                  <td className="px-3 py-2 text-slate-600">{r.centreName}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{when(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
