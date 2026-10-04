# ActivityRoster deep-dive review — 4 October 2026

Requested by Conor: a full pass over the platform and website covering security and
robustness, compliance and legal, fallbacks and likely breakages, workflows, user
experience and whether the site's words match what is built. Small things were fixed on
the spot (listed below with the commit); anything larger is a recommendation with a
decision for Conor at the end.

**Scope and method.** Every route (27 API routes, 44 server-action files), the
middleware, tenant resolution and role matrix, the schema (35 tenant tables, migrations
through 0055), the mail and queue layers, the scheduled tick, the deploy, backup, restore
and probe workflows, every public page and the Learning Centre, the Dev Center and the
instructor portal. Tools: code review, `tsc`, the test suite (79 files, 337 tests, all
passing), `npm audit`, `next build`. Not done: a browser walk of staging with real data
(Conor's own test of the sign-in flow and the DBS status-only change is still the best
check of those), and the native iOS/Android shells on a device.

**Overall.** The foundations hold: tenant isolation is structural and tested for every
tenant table, every server action is gated (the 44 files were scanned function by
function: each goes through `requireTenant`, `requirePlatformAdmin` or a session helper;
the only ungated one sets a harmless cookie), secrets fail hard in production, logs are
append-only, the deploy gate is in place and documented. The findings are at the edges:
one public form had no rate limit, a few pages described the product as it was in
September, the cookie notice listed two of ten cookies, and two dependency advisories
need a major Next.js upgrade that only Conor should schedule.

---

## 1. Fixed today (commit "Deep-dive review fixes")

| Area | What was wrong | What changed |
| --- | --- | --- |
| Security | `bookCallAction` (public "book a call" form) had no rate limit: a script could fill the diary and use the confirmation email as spam. | 5 attempts an hour per IP, same limiter as the other public endpoints. |
| Copy / honesty | Home page promised "Reporting: labour cost, utilisation and budgets" (the Reports tab was removed in September) and "contracts" (there is a checklist item, not contract storage). | Replaced with what exists: emergency sheet and young-worker register; "staff records, documents and a new-starter checklist". |
| Copy / honesty | Home said "One simple plan" while Pricing shows two tiers; "they can't be assigned" omitted the recorded override. | "Two flat plans, nothing per user"; "without a recorded override". |
| Legal | Cookie notice listed a session and PIN cookie; the app sets ten (login-verified, device, centre, ghost, authenticator, onboarding, Turnstile) plus three browser-storage keys. | Rewritten with every cookie, its purpose and lifetime. |
| Legal | Data-processing terms named four sub-processors; there are ten, and the privacy policy said the list was "available on request". | Both link to the new public register at `/subprocessors`; "last updated" dates bumped. |
| Guides | Young-workers guide did not mention the new adult warnings. | One bullet added. |
| UX | Roster download's one-day option was always "Monday only". | "Today" when today is in the week on screen, otherwise the dated Monday. |

Earlier today, in the same session and already on staging: the Dev Center navigation
regrouped into four sections; the rota PDF rebuilt as a day-by-day course breakdown with
four styles; all 100 blog articles expanded with subject-matched cover images and a
"refresh covers" action; Phase 2 block G (adult working-time warnings, under-18 privacy
page, accessibility statement with skip link and focus styles, public sub-processor
register and 30-day notice, DNS zone export, WAF runbook, vetting flag on custom checks,
free-text reminders, trust page brought in line with the platform).

## 2. Security and robustness

**Solid, verified again this pass**
- Authorisation: `requireTenant` resolves the centre from the host or the signed
  mobile cookie, then the membership, then the role matrix; the subdomain is never
  trusted on its own. Ghost Mode and trial read-only refuse writes in the repository
  layer, not just the UI.
- Every tenant table is created through `createTenantRepositories`, so the isolation
  test covers new tables automatically (guardian_link and deletion_log included).
- Secrets: `requireSecret` throws in production when `BETTER_AUTH_SECRET` or the Stripe
  webhook secret is missing or short; the dev fallback only exists outside production
  and logs once.
- Rate limits on every public API route; auth and PIN limits fail closed, public forms
  fail open by design (a KV outage degrades to "no limit" rather than "site down").
- Documents: 10 MB cap, type decided by sniffing the bytes, downloads scoped to the
  caller's org and, for instructors, their own prefix. Blog images served only from the
  `blog/` prefix with path characters rejected.
- Headers: HSTS preload, CSP with `frame-ancestors 'none'`, nosniff, referrer and
  permissions policies; nonce CSP in report-only on signed-in paths with violations
  landing in Dev Center → Errors.
- Scheduled tick: each job (digests, leaving sweep, mail queue, retention) is wrapped so
  one failing job never stops the others; the health endpoint leaks nothing.
- Markdown in the blog escapes HTML before formatting; the two `dangerouslySetInnerHTML`
  uses are JSON-LD and that escaped output.
- No `console.log` in app code; no server env read from client components.

**Findings**
- *Medium.* `next` 15.5.27 carries a moderate advisory (range up to 16.3.0-preview) and
  bundles a `postcss` with a high advisory (arbitrary `.map` file read via
  `sourceMappingURL`). Both are build-time code paths, not reachable from a request, so
  production risk is low, but the only fix is Next.js 16.3.8, a major upgrade with
  OpenNext implications. **Decision for Conor** (section 6).
- *Low.* The nonce CSP has been report-only since 3 October. If Dev Center → Errors shows
  no `csp-report-only` entries after a week of real use, it should be enforced (one-line
  change in `next.config` and `lib/security/csp.ts`). Recommend doing it on 11 October.
- *Low.* `/api/billing/setup` redirects to Stripe for the paid setup service with no rate
  limit; the worst case is creating many Checkout sessions. Add the standard limiter when
  that route is next touched.
- *Low.* Dependabot still lists six dev-tooling advisories (vitest/vite/esbuild chain,
  drizzle-kit). Build and test only; keep taking the weekly minor bumps.

## 3. Compliance and legal

**In place.** Privacy policy, terms, data-processing terms, cookie notice, trust page,
sub-processor register with dated changes, under-18 page, accessibility statement, data
request form with 30-day acknowledgement, per-person export/restriction/anonymisation,
per-centre retention with notice, append-only audit and security logs, EU residency,
Postmark listed ahead of use, HIBP k-anonymity described correctly.

**Findings**
- The privacy policy still says passwords are "hashed" and lists what is collected
  accurately, but it does not yet mention parent/guardian accounts or that guardians see
  only the rota. Covered on the under-18 page and linked; worth one sentence in the
  policy at the next solicitor review.
- `TERMS_VERSION` is 2026-09-29 and was not bumped today: today's legal-page edits are
  clarifications and new links, not changes to what centres agreed to, so no
  re-acceptance is forced. If the solicitor review changes obligations, bump it.
- The outreach emails carry one-click `List-Unsubscribe` headers and a footer; the
  lawful-basis field per prospect exists. The legitimate-interests assessment itself is
  on Conor's owner checklist and still outstanding.
- Sub-processor notices: the Dev Center action refuses to send with under 30 days'
  notice or before the register has the entry. Postmark's activation will be the first
  real use; send yourself the test first.

## 4. Fallbacks and likely breakages

| Scenario | What happens | Verdict |
| --- | --- | --- |
| Resend down or 429 | Queue retries five times over about three hours; Postmark takes over once `POSTMARK_SERVER_TOKEN` exists; owner sees failovers in Dev Center. | Good; Postmark still to be opened by Conor. |
| KV (rate limits, codes) unavailable | Auth and PIN limits fail closed (sign-in refused), public forms fail open. | Correct trade-off; sign-in outage would be visible on the status page. |
| D1 unavailable | `/api/health` returns 503, status page alerts, deploy smoke test fails and rolls back. | Good. |
| Stripe keys missing | Checkout and portal routes return a friendly redirect; billing page explains. | Good. |
| Stock-photo keys missing | Blog cover actions return a plain message naming the secret. | Good. |
| Bot Fight Mode re-enabled by mistake | Deploy smoke test says so in words; production rolls back rather than running untested. | Good, documented. |
| Workers Builds reconnected by mistake | Probe workflow shows identical chunk names on production and staging; runbook says disconnect. | Good, documented. |
| Centre's idle timeout changed | PIN cookie carries the minutes, so the middleware slides correctly without a database read. | Good. |
| Clock change (BST/GMT) | Session times are stored as instants and rendered in the centre's time zone; dates for the rota come from the date column, not from `toISOString()` of a local time. | Spot-checked in schedule, roster and the PDF; no slip found. |
| Very long blog articles | Rendered through the escaping markdown converter; the public page is cached per slug. | Fine; the longest article is about 1,200 words. |

One genuine gap: there is no automated restore rehearsal yet. The runbook, the Replay
deletions step and the nightly off-site copy exist; the first rehearsal is on Conor's
calendar for about 10 October. Until it has been done once, treat the backups as
unproven.

## 5. Workflows and user experience

Walked in code: sign-up → email confirmation → PIN → onboarding wizard (including the
new rota PDF step) → dashboard checklist → first course → invite staff → instructor
welcome → availability → confirm/decline → leave → time clock → payroll; billing trial →
read-only → locked → checkout; parent invitation → read-only rota; data export,
restriction, anonymisation, erase and replay; Dev Center sign-in with authenticator.

**Clean.** Sign-in no longer asks for a web address; the email decides the centre and a
chooser appears for people in several. Every office page carries a "Read the guide"
link to a Learning Centre section that exists. Error pages (no access, suspended, trial
ended, no centre yet) say what happened and what to do. Empty states on the dashboard
lead to the next step.

**Findings**
- *Vocabulary.* The app says "Roster" in the sidebar and page titles (61 uses) and
  "rota" in the PDF feature, onboarding step and guides (71 uses). UK centres say rota.
  Pick one. **Decision for Conor** (section 6); mechanical to change.
- *Dev Center forms.* A handful of owner-only forms have labels beside rather than
  attached to their fields (noted on the accessibility statement). Cosmetic; one person
  uses them.
- *Availability grid and weekly roster* are dense tables that work with a keyboard but
  are slow with a screen reader. A list view for assistive technology is the one
  accessibility item of substance left; listed on the statement.
- *Roster download* now defaults to one day; centres that liked the week as default can
  change it under Settings → Roster PDF (their saved choice is respected; only brand-new
  centres get the day).

## 6. Decisions for Conor

Conor's answers, 4 October: 1 rota · 2 yes · 3 remind and ask on the day · 4 Claude
Code deploys. Also: no users until 13 October (build phase), so everything built until
then goes straight to production; from the 13th Conor tests on staging first.

1. **Next.js 16 upgrade.** Approved and done (commit a2928d7): Next 16.3.8 with Turbopack,
   no code changes needed, typecheck, 337 tests and the OpenNext build green. The `next`
   and `postcss` advisories are gone; what remains in `npm audit` is build-time tooling
   (drizzle-kit/esbuild, tailwind's glob chain). The middleware-to-proxy rename Next 16
   recommends is left for a quiet moment.
2. **One word for the schedule.** "Rota" was chosen first; later on 4 October Conor
   switched it to **"roster"** to match the ActivityRoster brand. The noun is now
   "roster" everywhere a person reads it (sidebar, page titles, PDF, emails, guides,
   marketing, blog). URLs (`/office/rota`), file names and code identifiers keep "rota"
   so no links or saved settings break.
3. **Enforce the nonce CSP.** A reminder is set for 11 October; Claude Code checks the
   report-only log that day and asks before enforcing.
4. **Production deploy.** Done at 02:44 UTC on 4 October (run 37171883925): bookmark
   `000001cc-00000100-000050fa-3f4d08a7b9ebd4a1f8db56ce430b9222`, migrations 0049–0055
   applied, smoke test passed, tag `prod-20261004-0244`, main now at a2928d7. Until
   13 October Claude Code keeps pressing it after each green staging deploy and logs every
   run; from 13 October Conor tests on staging first and presses the button himself.
   Still to do in Dev Center → Blog: "Re-sync article content", then "Refresh covers to
   match articles (10)" until it says all done.

## 7. Conor's clicks still outstanding (unchanged from the compliance plan)

WAF managed rules (deploy runbook); `CLOUDFLARE_ZONE_ID` secret and DNS read on the API
token; Postmark account and `POSTMARK_SERVER_TOKEN`; Resend subdomains per
`docs/email-setup.md`; confirm `TURNSTILE_SECRET_KEY` on both Workers; verify the NI and
IE working-time packs in Dev Center → Rules; restore rehearsal around 10 October; the
owner checklist in `docs/compliance-spec.md` (solicitor review, ICO fee,
legitimate-interests assessment, insurance, 2FA on third-party accounts).
