"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { suggestionsForPage } from "@/lib/help/pages";
import type { HelpReply } from "@/lib/help/search";

/**
 * The help assistant: a small "Help" button that opens a chat panel. It is not
 * AI. Each question goes to /api/help, which searches the Learning Centre and
 * the setup FAQ and sends back the best passage with a link to the full guide.
 * The conversation lives only in this browser tab (sessionStorage).
 */

type Message = { id: number; from: "you"; text: string } | { id: number; from: "help"; reply: HelpReply };

const STORE = "ar_help_chat";
const CONTACT = "hello@activityroster.com";

function load(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORE);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Message[]).slice(-40) : [];
  } catch {
    return [];
  }
}

function save(messages: Message[]) {
  try { sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-40))); } catch { /* private mode */ }
}

export function HelpAssistant({ surface }: { surface: "office" | "site" }) {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [big, setBig] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const m = load();
    setMessages(m);
    nextId.current = m.reduce((n, x) => Math.max(n, x.id), 0) + 1;
  }, []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages, open, big]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const push = (m: Message[]) => setMessages((prev) => { const out = [...prev, ...m]; save(out); return out; });

  async function ask(question: string) {
    const q = question.trim().slice(0, 300);
    if (!q || busy) return;
    setDraft("");
    push([{ id: nextId.current++, from: "you", text: q }]);
    setBusy(true);
    let reply: HelpReply;
    try {
      const res = await fetch("/api/help", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q, path, surface }) });
      reply = res.ok
        ? ((await res.json()) as HelpReply)
        : { kind: "not-found", message: res.status === 429 ? "That's a lot of questions in a short time. Try again in a little while." : "Something went wrong. Try again, or browse the Learning Centre.", related: [] };
    } catch {
      reply = { kind: "not-found", message: "You seem to be offline. Try again when you're connected.", related: [] };
    }
    push([{ id: nextId.current++, from: "help", reply }]);
    setBusy(false);
  }

  const clear = () => { setMessages([]); save([]); input.current?.focus(); };
  const suggestions = suggestionsForPage(path, 3);
  const linkTarget = surface === "office" ? { target: "_blank", rel: "noreferrer" } : {};

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open help"
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-2 text-sm font-semibold text-white shadow-lg ring-1 ring-white/20 transition hover:bg-navy-700 print:hidden"
      >
        <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-xs">?</span>
        Help
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label="Help"
      className={`fixed z-40 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl print:hidden ${
        big
          ? "inset-2 sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(760px,calc(100vh-2rem))] sm:w-[min(680px,calc(100vw-2rem))]"
          : "bottom-4 right-4 h-[min(480px,calc(100vh-6rem))] w-[min(360px,calc(100vw-2rem))]"
      }`}
    >
      <header className="flex items-center gap-2 border-b border-slate-100 bg-navy px-4 py-2.5 text-white">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Help</p>
          <p className="truncate text-xs text-white/70">Answers from the Learning Centre</p>
        </div>
        {messages.length > 0 ? (
          <button type="button" onClick={clear} className="rounded-md px-2 py-1 text-xs text-white/80 hover:bg-white/10 hover:text-white">Clear</button>
        ) : null}
        <button type="button" onClick={() => setBig((b) => !b)} aria-label={big ? "Make smaller" : "Make bigger"} title={big ? "Make smaller" : "Make bigger"} className="rounded-md p-1.5 hover:bg-white/10">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            {big ? <path d="M8 3v5H3M12 17v-5h5M8 8 3 3M12 12l5 5" /> : <path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6" />}
          </svg>
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close help" className="rounded-md p-1.5 hover:bg-white/10">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 5l10 10M15 5 5 15" /></svg>
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-slate-600">
              {surface === "office"
                ? "Ask how to do something, like adding staff or publishing the roster. I'll find the answer in the guides."
                : "Ask anything about ActivityRoster, like how setup works or what it costs. I'll find the answer in the guides."}
            </p>
            <div className="flex flex-col items-start gap-1.5">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-teal/30 bg-teal/5 px-3 py-1 text-left text-xs font-medium text-teal hover:bg-teal/10">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m) =>
          m.from === "you" ? (
            <p key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-navy px-3 py-2 text-white">{m.text}</p>
          ) : (
            <div key={m.id} className="max-w-[92%] rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-slate-700">
              {m.reply.kind === "answer" && m.reply.answer ? (
                <>
                  {m.reply.answer.heading ? <p className="mb-1 font-semibold text-navy">{m.reply.answer.heading}</p> : null}
                  {m.reply.answer.text ? <p className="whitespace-pre-line">{m.reply.answer.text}</p> : null}
                  {m.reply.answer.items ? (
                    <ol className="list-decimal space-y-1 pl-5">
                      {m.reply.answer.items.map((it, i) => <li key={i}>{it}</li>)}
                    </ol>
                  ) : null}
                  <a href={m.reply.answer.link} {...linkTarget} className="mt-2 inline-flex items-center gap-1 font-medium text-teal hover:underline">
                    📖 Read the guide: {m.reply.answer.topicLabel}
                  </a>
                </>
              ) : (
                <>
                  <p>{m.reply.message}</p>
                  {m.reply.kind === "not-found" ? (
                    <a href={`mailto:${CONTACT}`} className="mt-1 inline-block font-medium text-teal hover:underline">{CONTACT}</a>
                  ) : null}
                </>
              )}
              {m.reply.related.length > 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  {m.reply.kind === "answer" ? "Also see: " : "These guides may help: "}
                  {m.reply.related.map((r, i) => (
                    <span key={r.topic}>
                      {i > 0 ? " · " : null}
                      <a href={r.link} {...linkTarget} className="font-medium text-teal hover:underline">{r.label}</a>
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          ),
        )}
        {busy ? <p className="w-fit rounded-2xl bg-slate-100 px-3 py-2 text-slate-400">Looking…</p> : null}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void ask(draft); }}
        className="flex items-center gap-2 border-t border-slate-100 p-2"
      >
        <label htmlFor="help-question" className="sr-only">Your question</label>
        <input
          id="help-question"
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={300}
          autoComplete="off"
          placeholder="Ask a question…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
        />
        <button type="submit" disabled={busy || !draft.trim()} className="rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-40">
          Ask
        </button>
      </form>
      <p className="px-3 pb-2 text-[11px] text-slate-400">
        {surface === "office" ? "Not AI: answers come from our guides. We keep the question for 30 days to improve them, never the answer or your name." : "Not AI: answers come from our guides. Nothing you type here is stored."}{" "}
        <a href="/learn" {...linkTarget} className="underline hover:text-slate-600">Learning Centre</a>
      </p>
    </section>
  );
}
