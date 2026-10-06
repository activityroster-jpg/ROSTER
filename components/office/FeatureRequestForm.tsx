"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IMPORTANCE_LABEL } from "@/lib/validation/feature-request";

type Errors = Record<string, string>;

/**
 * Send a feature request or report a problem. Guided questions so the brief is
 * usable first time; the title is the only part other centres see, and the
 * screenshot stays private. Posts multipart to /api/feature-requests.
 */
export function FeatureRequestForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<"feature" | "problem">("feature");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true); setError(null); setErrors({});
    try {
      const res = await fetch("/api/feature-requests", { method: "POST", body: new FormData(e.currentTarget) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; fieldErrors?: Errors };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That didn't send. Please try again.");
        setErrors(data.fieldErrors ?? {});
        return;
      }
      formRef.current?.reset();
      setFileName(null);
      setSent(true);
      router.refresh();
    } catch {
      setError("That didn't send. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-starboard/40 bg-starboard/5 p-5">
        <p className="font-semibold text-starboard">Thank you. We&rsquo;ve got your request.</p>
        <p className="mt-1 text-sm text-slate-600">It&rsquo;s under &ldquo;My requests&rdquo; below as Submitted. Only your centre and the ActivityRoster team can see it until we&rsquo;ve read it; you&rsquo;ll see it move through the stages from there.</p>
        <button type="button" onClick={() => setSent(false)} className="mt-3 text-sm font-medium text-teal hover:underline">Send another →</button>
      </div>
    );
  }

  const field = (name: string) => `mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-teal ${errors[name] ? "border-port" : "border-slate-300"}`;
  const err = (name: string) => (errors[name] ? <p className="mt-0.5 text-xs text-port">{errors[name]}</p> : null);
  const label = (htmlFor: string, n: number, text: string, optional = false) => (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-navy"><span className="text-slate-400">{n}.</span> {text}{optional ? <span className="font-normal text-slate-400"> (optional)</span> : null}</label>
  );
  const hint = (text: string) => <p className="mt-0.5 text-xs text-slate-500">{text}</p>;

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-5" noValidate>
      <div className="rounded-lg bg-teal/5 px-4 py-3 text-sm text-slate-700">
        <strong className="text-navy">The more detail, the better.</strong> A clear brief (what happens now, what you&rsquo;d like instead, and why it matters) is much quicker for us to understand and build. Write it as you&rsquo;d explain it to a new member of staff.
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-navy"><span className="text-slate-400">1.</span> Is this a new idea or something not working?</legend>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          {([["feature", "A new feature or a change"], ["problem", "Something isn't working right"]] as const).map(([value, text]) => (
            <label key={value} className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${kind === value ? "border-teal bg-teal/5 text-navy" : "border-slate-300 text-slate-600"}`}>
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="accent-teal" />
              {text}
            </label>
          ))}
        </div>
        {err("kind")}
      </fieldset>

      <div>
        {label("fr-problem", 2, "What problem are you trying to solve?")}
        {hint(kind === "problem"
          ? "What were you doing, what did you expect to happen, and what happened instead? Which page was it on?"
          : "What's hard, slow or missing today, and what does it stop you doing? Describe the situation, not just the solution.")}
        <textarea id="fr-problem" name="problem" rows={5} className={field("problem")} aria-invalid={errors.problem ? true : undefined} />
        {err("problem")}
      </div>

      <div>
        {label("fr-change", 3, kind === "problem" ? "What should happen instead?" : "What would you like us to add or change?")}
        {hint("How would it work for you? If you've seen it done well somewhere else, say where.")}
        <textarea id="fr-change" name="change" rows={4} className={field("change")} aria-invalid={errors.change ? true : undefined} />
        {err("change")}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          {label("fr-who", 4, "Who does it affect?", true)}
          {hint("For example: office staff, instructors, senior instructors, parents.")}
          <input id="fr-who" name="whoAffected" className={field("whoAffected")} />
          {err("whoAffected")}
        </div>
        <div>
          {label("fr-freq", 5, "How often does it come up?", true)}
          {hint("For example: every day in summer, once a season.")}
          <input id="fr-freq" name="frequency" className={field("frequency")} />
          {err("frequency")}
        </div>
      </div>

      <div>
        {label("fr-workaround", 6, "How do you get round it today?", true)}
        {hint("A spreadsheet, a WhatsApp group, doing it by hand: it helps us see what the change would save.")}
        <textarea id="fr-workaround" name="workaround" rows={2} className={field("workaround")} />
        {err("workaround")}
      </div>

      <div>
        {label("fr-importance", 7, "How much does it matter to your centre?")}
        <select id="fr-importance" name="importance" defaultValue="important" className={field("importance")}>
          {Object.entries(IMPORTANCE_LABEL).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </div>

      <div>
        {label("fr-details", 8, "Anything else that would help us get it right?", true)}
        {hint("Examples, the steps to reproduce a problem, deadlines (like the start of the season), or anything you'd want a developer to know.")}
        <textarea id="fr-details" name="details" rows={4} className={field("details")} />
        {err("details")}
      </div>

      <div>
        {label("fr-title", 9, "Sum it up in a short title")}
        {hint("This title is the only part other centres will see, on the shared board. Keep names, emails and anything private out of it. We may tidy the wording before it goes on the board.")}
        <input id="fr-title" name="title" maxLength={120} placeholder="For example: Copy last week's roster into next week" className={field("title")} aria-invalid={errors.title ? true : undefined} />
        {err("title")}
      </div>

      <div>
        {label("fr-shot", 10, "Add a screenshot", true)}
        <div className="mt-1.5 rounded-lg border border-amber/40 bg-amber/5 px-3 py-2 text-xs text-slate-700">
          🔒 Screenshots stay private: only your centre and the ActivityRoster team can see them, never other centres. Before you attach one, crop or cover anything personal: names, phone numbers, emails, addresses, and especially anything about children or young staff.
        </div>
        <label htmlFor="fr-shot" className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-teal hover:text-teal">
          📎 {fileName ?? "Choose an image (PNG, JPEG or WebP, up to 5 MB)"}
        </label>
        <input id="fr-shot" name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
        {err("screenshot")}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p><strong className="text-navy">What happens next.</strong> We read every request and look into whether the change is possible. We can&rsquo;t promise to build everything, but if it&rsquo;s possible and it helps centres, we&rsquo;ll do it, and you can follow it here from Submitted to Live.</p>
      </div>

      <label className="flex items-start gap-2.5 text-sm text-slate-700">
        <input type="checkbox" name="consentPublic" className="mt-0.5 h-4 w-4 accent-teal" aria-invalid={errors.consentPublic ? true : undefined} />
        <span>I understand that once ActivityRoster has reviewed this request, <strong>its title and stage will be shown to other centres</strong> on the shared board, where they can say they need it too. The details, the screenshot and our centre&rsquo;s name stay private.</span>
      </label>
      {err("consentPublic")}

      {error ? <p className="text-sm text-port" role="alert">{error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
