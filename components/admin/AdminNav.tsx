"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Dev Center navigation: a handful of sections across the top, and the pages of
 * the current section in a second, lighter row underneath. Keeps the header
 * readable as pages are added (fourteen flat links was too many) and shows at
 * a glance where you are.
 */
export interface NavPage { href: string; label: string; hint?: string; tone?: "staging" }
export interface NavSection { id: string; label: string; pages: NavPage[] }

export function adminSections(opts: { staging: boolean }): NavSection[] {
  return [
    { id: "overview", label: "Overview", pages: [
      { href: "/admin", label: "Centres", hint: "every centre, its plan and status" },
      { href: "/admin/finance", label: "Finance", hint: "revenue, pricing and discounts" },
      { href: "/admin/tasks", label: "Tasks", hint: "the build and launch planner" },
    ] },
    { id: "growth", label: "Growth", pages: [
      { href: "/admin/marketing", label: "Prospects", hint: "the outreach list and lawful basis" },
      { href: "/admin/outreach", label: "Outreach agent", hint: "automated sequences and the daily tick" },
      { href: "/admin/calls", label: "Discovery calls", hint: "call notes and follow-ups" },
      { href: "/admin/trial-feedback", label: "Trial feedback", hint: "trial-end survey answers and who is happy to be contacted" },
      { href: "/admin/blog", label: "Blog", hint: "articles, scheduling and cover photos" },
    ] },
    { id: "health", label: "Platform health", pages: [
      { href: "/admin/errors", label: "Errors", hint: "runtime errors and reports from centres" },
      { href: "/admin/email", label: "Email", hint: "providers, queue and bounces" },
      ...(opts.staging ? [{ href: "/admin/outbox", label: "Outbox", hint: "staging only: emails that would have been sent", tone: "staging" as const }] : []),
      { href: "/admin/change-log", label: "Change log", hint: "what changed in the platform and when" },
    ] },
    { id: "trust", label: "Trust & compliance", pages: [
      { href: "/admin/security", label: "Security", hint: "sign-in events, alerts and incidents" },
      { href: "/admin/privacy", label: "Privacy requests", hint: "access, erasure and restriction requests" },
      { href: "/admin/rules", label: "Rule packs", hint: "young workers' hours and other legal figures" },
    ] },
  ];
}

function activeFor(sections: NavSection[], pathname: string): { section: NavSection; page: NavPage | null } {
  let best: { section: NavSection; page: NavPage; len: number } | null = null;
  for (const section of sections) {
    for (const page of section.pages) {
      const match = page.href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/centres") : pathname === page.href || pathname.startsWith(page.href + "/");
      if (match && (!best || page.href.length > best.len)) best = { section, page, len: page.href.length };
    }
  }
  return best ? { section: best.section, page: best.page } : { section: sections[0]!, page: null };
}

export function AdminNav({ staging, email, brand }: { staging: boolean; email: string; brand: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const sections = adminSections({ staging });
  const active = activeFor(sections, pathname);

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5">
        {brand}
      <nav aria-label="Dev Center sections" className="flex items-center gap-1 text-sm">
        {sections.map((s) => {
          const on = s.id === active.section.id;
          return (
            <Link
              key={s.id}
              href={s.pages[0]!.href}
              aria-current={on ? "true" : undefined}
              className={`rounded-md px-3 py-1.5 font-medium transition ${on ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
            >
              {s.label}
            </Link>
          );
        })}
        <span className="ml-3 hidden text-xs text-white/50 lg:inline" title="Signed in as">{email}</span>
      </nav>
      </div>
      <div className="border-t border-white/10 bg-navy/95">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-1.5 text-sm">
          {active.section.pages.map((p) => {
            const on = active.page?.href === p.href;
            return (
              <Link
                key={p.href}
                href={p.href}
                title={p.hint}
                aria-current={on ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 transition ${on ? "bg-white text-navy" : p.tone === "staging" ? "text-amber-200 hover:bg-white/10" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
              >
                {p.label}{p.tone === "staging" ? <span className="ml-1 text-[10px] uppercase tracking-wide opacity-80">staging</span> : null}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
