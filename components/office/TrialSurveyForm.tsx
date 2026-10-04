"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitTrialSurveyAction, type SurveyState } from "@/app/(app)/office/trial-survey/actions";
import { CONTACT_LABEL, MIN_WORDS, OTHER_LABEL, TEXT_QUESTIONS, USER_COUNT_LABEL, wordCount } from "@/lib/validation/trial-survey";

const initial: SurveyState = { ok: false };
type TextKey = (typeof TEXT_QUESTIONS)[number]["key"] | "otherFeedback";

/** The eight trial-end questions. Controlled fields so answers survive a failed send, with a live word count on each. */
export function TrialSurveyForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action, pending] = useActionState(submitTrialSurveyAction, initial);
  const [text, setText] = useState<Record<TextKey, string>>({ mostUseful: "", leastUseful: "", wouldChange: "", missing: "", featureRequest: "", otherFeedback: "" });
  const [users, setUsers] = useState("");
  const [contact, setContact] = useState<"" | "yes" | "no">("");
  const [email, setEmail] = useState(defaultEmail);
  const err = state.fieldErrors ?? {};

  if (state.ok) {
    const until = state.trialEndsAt ? new Date(state.trialEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
    return (
      <div className="rounded-xl border border-starboard/40 bg-starboard/5 p-5">
        <p className="font-semibold text-starboard">Thank you. Your centre is unlocked{until ? ` until ${until}` : ""}.</p>
        <p className="mt-1 text-sm text-slate-600">Your free month starts today. {contact === "yes" ? "We may be in touch about your answers." : "We won't contact you about your answers."}</p>
        <Link href="/office" className="mt-3 inline-block text-sm font-medium text-teal hover:underline">Back to your dashboard →</Link>
      </div>
    );
  }

  const textArea = (key: TextKey, n: number, label: string, optional = false) => {
    const count = wordCount(text[key]);
    const enough = count >= MIN_WORDS;
    return (
      <div key={key}>
        <label htmlFor={key} className="block text-sm font-medium text-navy"><span className="text-slate-400">{n}.</span> {label}{optional ? <span className="font-normal text-slate-400"> (optional)</span> : null}</label>
        <textarea
          id={key}
          name={key}
          rows={4}
          value={text[key]}
          onChange={(e) => setText((t) => ({ ...t, [key]: e.target.value }))}
          aria-invalid={err[key] ? true : undefined}
          aria-describedby={`${key}-count`}
          className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-teal ${err[key] ? "border-port" : "border-slate-300"}`}
        />
        <p id={`${key}-count`} className={`mt-0.5 text-xs ${optional ? "text-slate-400" : enough ? "text-starboard" : "text-slate-400"}`}>
          {optional ? `${count} word${count === 1 ? "" : "s"}` : `${count} / ${MIN_WORDS} words${enough ? " ✓" : ""}`}
        </p>
        {err[key] ? <p className="text-xs text-port">{err[key]}</p> : null}
      </div>
    );
  };

  return (
    <form action={action} className="space-y-6">
      {TEXT_QUESTIONS.map((q, i) => textArea(q.key, i + 1, q.label))}

      <div>
        <label htmlFor="userCount" className="block text-sm font-medium text-navy"><span className="text-slate-400">6.</span> {USER_COUNT_LABEL}</label>
        <input
          id="userCount" name="userCount" type="number" inputMode="numeric" min={1} max={10000} step={1}
          value={users} onChange={(e) => setUsers(e.target.value)}
          aria-invalid={err.userCount ? true : undefined}
          className={`mt-1.5 w-32 rounded-lg border px-3 py-2 text-sm outline-none focus:border-teal ${err.userCount ? "border-port" : "border-slate-300"}`}
        />
        {err.userCount ? <p className="text-xs text-port">{err.userCount}</p> : null}
      </div>

      {textArea("otherFeedback", 7, OTHER_LABEL, true)}

      <fieldset>
        <legend className="text-sm font-medium text-navy"><span className="text-slate-400">8.</span> {CONTACT_LABEL}</legend>
        <div className="mt-2 flex gap-4">
          {(["yes", "no"] as const).map((v) => (
            <label key={v} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="contactOk" value={v} checked={contact === v} onChange={() => setContact(v)} className="accent-teal" />
              {v === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
        {err.contactOk ? <p className="text-xs text-port">{err.contactOk}</p> : null}
        {contact === "yes" ? (
          <div className="mt-3">
            <label htmlFor="contactEmail" className="block text-xs font-medium text-slate-600">The email we should use</label>
            <input
              id="contactEmail" name="contactEmail" type="email" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              aria-invalid={err.contactEmail ? true : undefined}
              className={`mt-1 w-full max-w-sm rounded-lg border px-3 py-2 text-sm outline-none focus:border-teal ${err.contactEmail ? "border-port" : "border-slate-300"}`}
            />
            {err.contactEmail ? <p className="text-xs text-port">{err.contactEmail}</p> : null}
            <p className="mt-1 text-xs text-slate-400">We&rsquo;ll only use it to talk to you about your answers.</p>
          </div>
        ) : contact === "no" ? (
          <p className="mt-2 text-xs text-slate-400">No problem. We won&rsquo;t contact you about your answers.</p>
        ) : null}
      </fieldset>

      <p className="text-[11px] leading-snug text-slate-400">Please keep your answers about the platform: no names, health details or anything about a child or anyone else.</p>

      {state.error ? <p role="alert" className="text-sm text-port">{state.error}</p> : null}
      <button disabled={pending} className="w-full rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 sm:w-auto">
        {pending ? "Sending…" : "Send my answers and unlock another month"}
      </button>
    </form>
  );
}
