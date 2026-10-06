import { Lightbulb, Rocket, ThumbsUp } from "lucide-react";

const STEPS = [
  { icon: Lightbulb, title: "Centres ask", body: "Every centre has a Requests & ideas page inside the platform: ask for a feature, suggest a change or report a problem, in your own words." },
  { icon: ThumbsUp, title: "Centres vote", body: "Requests go on a shared board, and centres press “We need this too” on the ones that matter to them. The most-needed rise to the top." },
  { icon: Rocket, title: "We build and ship", body: "We build around what centres vote for and release improvements continuously. You follow each request from review to live, with no upgrades to install." },
];

/** An illustration of the board, not real requests. */
const EXAMPLE = [
  { stage: "In development", title: "Copy last week's roster forward", votes: 14, tone: "bg-teal/15 text-teal" },
  { stage: "Testing", title: "Text instructors when a shift changes", votes: 9, tone: "bg-amber/15 text-amber" },
  { stage: "Live", title: "Weather notes on the daily sheet", votes: 7, tone: "bg-starboard/15 text-starboard" },
];

/**
 * The sales case for a live platform: centres ask, centres vote, and what
 * they vote for gets built. Full section on the homepage, a compact band on
 * the search pages and pricing.
 */
export function BuiltWithCentres({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 md:flex-row md:items-center md:gap-8">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-teal/10 text-teal" aria-hidden="true"><ThumbsUp className="h-6 w-6" /></span>
          <div>
            <h2 className="font-display text-xl font-semibold text-navy">A live platform that keeps getting better</h2>
            <p className="mt-1 text-slate-600">ActivityRoster improves all the time, and centres decide what comes next. Ask for a feature from inside the platform, back other centres&rsquo; ideas with a vote, and watch the most-needed ones go from review to live. We build around what centres vote for.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="built-with-centres" className="border-b border-slate-200 bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal">A live platform</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-navy md:text-3xl" style={{ textWrap: "balance" }}>Built around what centres vote for</h2>
            <p className="mt-3 text-slate-600">
              ActivityRoster isn&rsquo;t a box of software that stays the same for years. It&rsquo;s live, and it keeps improving, led by the centres that use it every day. When centres tell us what they need, we listen, and the ideas centres vote for are the ones we build.
            </p>
            <ol className="mt-6 space-y-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white text-teal shadow-sm ring-1 ring-slate-200" aria-hidden="true"><s.icon className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-semibold text-navy"><span className="text-slate-400">{i + 1}.</span> {s.title}</h3>
                    <p className="mt-0.5 text-sm text-slate-600">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <figure className="rounded-card border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-sm font-bold text-navy">All requests from centres</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">Example</span>
            </div>
            <ul className="space-y-2">
              {EXAMPLE.map((e) => (
                <li key={e.title} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-navy">{e.title}</p>
                    <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.tone}`}>{e.stage}</span>
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">👍 We need this too <span className="text-slate-400">· {e.votes}</span></p>
                </li>
              ))}
            </ul>
            <figcaption className="mt-3 text-xs text-slate-500">Centres see each request&rsquo;s title, stage and vote count. The details, screenshots and who asked stay private.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
