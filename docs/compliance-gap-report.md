# Compliance gap report

Audit of the codebase on branch `claude/new-session-2wxbwe` (3 October 2026) against
`docs/compliance-spec.md`. Status key: **Done** · **Partial** · **Missing** · **Conflict**
(the spec and the app disagree; Conor decides). "Dashboard" means the item lives in a
third-party dashboard this audit cannot see; Conor confirms it.

Nothing was changed as part of this audit. The phased plan is in
`docs/compliance-plan.md`.

## Headline

| Area | Done | Partial | Missing | Conflict |
| --- | --- | --- | --- | --- |
| Hosting, residency, sub-processors | 3 | 3 | 1 | 0 |
| Authentication and sessions | 5 | 6 | 1 | 2 |
| Access control and isolation | 4 | 0 | 1 | 0 |
| Hardening | 5 | 6 | 2 | 0 |
| Logging and monitoring | 1 | 4 | 0 | 0 |
| Privacy features | 1 | 6 | 3 | 0 |
| Under-18 and safeguarding | 2 | 2 | 5 | 1 |
| Working-time rules engine | 1 | 2 | 3 | 0 |
| Email and marketing | 6 | 3 | 4 | 0 |
| Backups and DR | 1 | 1 | 8 | 0 |
| Change management | 1 | 2 | 5 | 2 |
| Incident response | 0 | 0 | 6 | 1 |
| Extras | 3 | 1 | 0 | 1 |

The strongest areas are tenant isolation, input validation, Stripe handling and the
sign-in hardening done this week. The biggest gaps are backups (nothing beyond D1 Time
Travel), no staging environment, no under-18 controls, no working-time rules engine and
no incident/offline fallbacks.

## Data map, confirmed against the schema

The spec's draft data map needs these corrections (`lib/db/schema/tenant.ts`,
`lib/db/schema/control-plane.ts`):

| Spec says | What the database actually holds |
| --- | --- |
| Staff profiles include date of birth | **No date of birth field.** `instructor` holds name, email, phone, employment type, status. Under-18 status cannot be derived today. |
| Parent and guardian accounts | **None.** Roles are `admin` and `instructor` only (`MEMBERSHIP_ROLES`). |
| Vetting status: store status only | `compliance_item` holds type, reference number, dates, a `verified` flag **and an uploaded file (`docKey`)**. Centres can upload the DBS certificate itself. See Conflict C5. |
| Student and course records | Courses and sessions hold **headcounts, not names**. The retired `booking` table does hold `customerName` and `customerEmail` (feature removed from the UI, table kept). |
| Emergency contacts | **Not stored anywhere.** The emergency sheet in the spec needs new fields first. |
| Rota and time records | Done: `course_staff`, `roster_week.publishedAt`, `time_entry` (clock in/out), `hours_record`. |
| Customer accounts and billing | Done: `organisation` (Stripe IDs, status, tier), `user`, `membership`; owner's own books in `finance_transaction`. |
| Sales prospect list | Done: `marketing_prospect`, `outreach_*` (control plane). No `source` or lawful-basis column. |
| Website analytics | None found: no analytics script is loaded (`app/(marketing)/layout.tsx`). |

One extra category the spec does not list: **AI usage logs** (`ai_usage`) hold token
counts only, no content.

## Hosting, data residency and sub-processors

| Requirement | Pri | Status | Evidence / notes |
| --- | --- | --- | --- |
| D1 in western Europe, EU jurisdiction where offered | P0 | Partial | `wrangler.toml` creates D1 with `--location=weur`. That is a location hint; D1 has no jurisdiction flag. Dashboard: confirm region shows Western Europe. |
| R2 buckets with EU jurisdiction | P0 | Partial | `wrangler.toml` comment uses `--location=weur`; the EU **jurisdiction** flag (`--jurisdiction eu`) is a different setting and cannot be added to an existing bucket. Dashboard: check the bucket's jurisdiction; if not EU, create a new EU bucket and migrate (plan P1-C). |
| Resend EU sending region, DPA, transfer mechanism | P0 | Dashboard | Code calls `api.resend.com` (`lib/mail/index.ts`); region is set per domain in Resend. Conor confirms the domain region and accepts Resend's DPA. |
| Sub-processor register `docs/subprocessors.md` | P0 | Done | Known processors from code: Cloudflare (Workers, D1, R2, KV), Resend, Stripe, Sentry (`lib/observability/sentry.ts`), Anthropic (`lib/outreach/research.ts`, prospect data only), GitHub (code and deploys), Have I Been Pwned (password hash prefixes only), Cloudflare DNS-over-HTTPS (domain checks). |
| GitHub holds code only | P0 | Done | No personal data in app code, tests or docs. The console helper SQL files (one of which listed prospect business names) were removed on 3 October; migrations now run through the deploy workflow. |
| Synthetic data in local and staging | P0 | Partial | Seeds and tests are synthetic (`lib/seed`, `tests/*` on SQLite). There is no staging environment yet. |
| Payments via Stripe Checkout, IDs only, grace then read-only | P0 | Done | `lib/billing/checkout.ts`, `lib/billing/webhook.ts` (raw-body signature, idempotent by event id), `organisation.subscriptionStatus`; trial lock → read-only (`lib/billing/trial.ts`). Failed-payment grace relies on Stripe's retry schedule; confirm the `past_due` path keeps read-only rather than locking (plan P0-B). |
| Customer notice before new sub-processor | P1 | Missing | Needs the register first, then a notice email template. |

## Authentication and sessions

| Requirement | Pri | Status | Evidence / notes |
| --- | --- | --- | --- |
| Slow salted password hashing | P0 | Done | Better Auth default (scrypt) in `lib/auth/index.ts`. PIN uses PBKDF2 100k (`lib/auth/pin.ts`). |
| Min 12 chars, no complexity rules, breached-password check | P0 | Done | Minimum 12 everywhere (`lib/validation/*`, Better Auth `minPasswordLength`); HIBP check on signup, password change, Dev Center and reset (`app/(app)/reset-password/actions.ts`). |
| Two-factor (TOTP + recovery codes) required for Owner/Admin | P0 | Conflict C1 | TOTP, email OTP and backup codes exist but are **optional** (`components/office/TwoFactorSetup.tsx`). Today's change makes an **emailed code mandatory** on every office sign-in (`app/verify-login`), which Conor asked for this morning. The spec wants authenticator-app 2FA mandatory. |
| Brute-force: per-IP and per-account limits, Turnstile, generic errors | P0 | Partial | Per-IP and per-email throttle on `/api/auth` (`lib/security/auth-throttle.ts`, `app/api/auth/[...all]/route.ts`), PIN lockout, code attempt limits. **No Turnstile.** Sign-in reveals "confirm your email first" for unverified accounts (`app/(app)/sign-in/page.tsx`), a small existence leak. |
| Password reset: single-use, ≤60 min, logs out other sessions | P0 | Done | Better Auth reset tokens (1 hour default), `revokeSessionsOnPasswordReset: true` (`lib/auth/index.ts:39`). |
| Change alerts (password, email, 2FA, new device/country); repeated unusual sign-ins alert Conor | P0 | Partial | `notifySecurityChange` emails on password change, new device, 2FA on/off (`lib/security/events.ts`). Email-address change alert: not found. Alerts to Conor: not built. |
| Cookies HttpOnly, Secure, SameSite=Lax | P0 | Done | Better Auth defaults plus every custom cookie (`lib/auth/pin.ts`, `app/verify-login/actions.ts`, middleware). |
| Idle timeout (30 min admins), absolute timeout, "log out all devices" | P1 | Partial | PIN re-prompt after 30 min idle, office sign-out after 12 h idle (`lib/auth/login-verify.ts`), 7-day absolute session. **No "log out all devices" button.** Not configurable per school. |
| Shared-device mode | P1 | Done | "Just this once" ends the session when the browser closes (`components/auth/VerifyLoginForm.tsx`). |
| Password or magic link; links single-use ≤15 min; prompt magic-link users to set a password; admins still do 2FA | P0 | Partial | Both offered; magic links single-use, 5-minute expiry (Better Auth default). The set-up flow asks for a PIN but does **not** push magic-link users to set a password. Admins now always do the emailed code. |
| No support login | P0 | Conflict C2 | **Ghost Mode exists**: a platform admin can open any centre read-only from the Dev Center (`lib/auth/ghost.ts`, `app/(app)/office/ghost-actions.ts`), logged as `ghost_start`/`ghost_end` security events. The spec forbids this. |
| SSO (Google / Microsoft) | P2 | Missing | |

## Access control and tenant isolation

| Requirement | Pri | Status | Evidence / notes |
| --- | --- | --- | --- |
| Tenant id on every table, single data-access layer | P0 | Done | `organisation_id` on all tenant tables; all access via `lib/db/repositories`; rule in `CLAUDE.md`. |
| Server-side permission checks on every endpoint and record | P0 | Done | `requireTenant` (`lib/tenant/require.ts`) on every office/portal page, action and API route; repositories scope by org on every read and write. |
| Isolation test suite, two schools, on every deploy | P0 | Done | `tests/isolation` covers every tenant table; runs in CI (`.github/workflows/ci.yml`) and before deploy (`.github/workflows/deploy.yml`). |
| Random IDs in URLs | P1 | Done | `crypto.randomUUID()` (`lib/db/schema/_shared.ts:15`). |
| Configurable roles and the permission matrix | P1 | Missing | Only `admin` and `instructor`. No welfare officer, senior instructor, under-18 or parent roles; no contact-detail opt-in; no per-school permission settings. Pay rates and exports are admin-only today. |

## Data security and application hardening

| Requirement | Pri | Status | Evidence / notes |
| --- | --- | --- | --- |
| HTTPS only, TLS ≥1.2, HSTS | P0 | Done / Dashboard | HSTS with preload (`next.config.mjs:29`). "Always Use HTTPS" and minimum TLS are Cloudflare dashboard settings. |
| App-level AES-GCM for emergency contacts and vetting | P1 | Partial | AES-GCM helper exists for integration tokens (`lib/security/token-crypto.ts`, `TOKEN_ENCRYPTION_KEY`). Not applied to vetting; emergency contacts do not exist yet. |
| Parameterised queries only | P0 | Done | Drizzle throughout; no string-built SQL in app code. |
| Zod on every request, output encoding | P0 | Done | `lib/validation/*`, Zod pass completed this week; React escapes output; `escapeHtml` for emails. |
| CSRF on every mutating request | P0 | Done | Next.js server-action origin checks; Better Auth CSRF; cookies SameSite=Lax. |
| Security headers incl. frame-ancestors 'none' | P0 | Partial | CSP, nosniff, Referrer-Policy, Permissions-Policy set; `frame-ancestors 'none'` since 3 October. Marketing CSP still allows `'unsafe-inline'` scripts; the app's nonce policy is report-only (`lib/security/csp.ts`). |
| Rate limiting on all API routes, Turnstile on public forms | P0 | Partial | `lib/security/rate-limit.ts` used on auth, webhooks, signup, slug-check, report-error, outreach, unsubscribe. Not every office API route is limited. **No Turnstile** on signup, demo or contact forms. |
| Uploads: allow-list, size, malware scan, private bucket, signed links | P0 | Partial | Allow-list and byte sniffing (`lib/security/file-type.ts`), size cap, private R2 with org-scoped keys (`lib/r2`), download only through an authenticated route (`app/api/documents/download/route.ts`), which is equivalent to signed links. **No malware scanning.** |
| Warning on free-text fields | P1 | Missing | Notes fields on staff, courses, prospects carry no warning. |
| Lockfile, Dependabot, secret scanning, push protection | P0 | Partial | `package-lock.json` committed; `npm audit` in CI; `.github/dependabot.yml` added. Secret scanning and push protection are GitHub settings (dashboard). |
| Cloudflare WAF managed rules | P1 | Dashboard | |
| `/.well-known/security.txt` and disclosure page | P1 | Done | `app/.well-known/security.txt/route.ts`, `/trust` page with safe-harbour wording. |
| Annual penetration test | P2 | Missing | |

## Logging, monitoring and audit trail

| Requirement | Pri | Status | Evidence / notes |
| --- | --- | --- | --- |
| Append-only audit log: who, what, when, record, IP/device; logins, failures, permission changes, sensitive views, exports, deletions, DB access | P0 | Partial | Two logs: `audit_log` (tenant changes to roster, resources, settings, billing) and `security_event` (logins, PIN, devices, 2FA, ghost, invites, with IP/country/agent via `lib/security/events.ts`). **Not logged:** views of sensitive records, admin database access. Data exports are logged since 3 October. Append-only is by convention (no delete method), not enforced in the database. |
| Schools can view and export their own audit log | P1 | Partial | `app/(app)/office/change-log` shows the centre's changes in plain English; no export; security events not shown. |
| Clean application logs, 30–90 day retention | P0 | Partial | Sentry events scrubbed (`lib/observability/sentry.ts:31`). Worker console logs are not retained unless Logpush is on (dashboard). A few `console.info` lines include recipient email addresses (`lib/mail/index.ts:83`), to tidy. |
| Alerts to Conor: email for all, text for critical | P1 | Partial | Error reports land in the Dev Center (`app/admin/errors`) with email on first occurrence. No downtime, backup, deploy-failure or mass-export alerts; no SMS. |
| Error monitoring with EU region and scrubbing | P1 | Done | Sentry via fetch, EU ingest allowed in CSP, scrubbing on. Needs a sub-processor entry. |

## Privacy features

| Requirement | Pri | Status | Evidence / notes |
| --- | --- | --- | --- |
| Per-person search, export (JSON/CSV), correct, freeze, delete/anonymise | P0 | Partial | Whole-centre JSON export (`lib/services/export.ts`, `app/api/office/export`). No per-person export, no freeze flag, no anonymise. Staff can be deactivated (deactivate-never-delete rule). |
| Deleted data ages out of backups; deletion log replayed after restore | P1 | Missing | No backups beyond Time Travel, no deletion log. |
| Per-school retention settings and scheduled deletion | P1 | Missing | `eraseOrganisation` exists for whole-centre deletion only. |
| Consent records | P1 | Missing | |
| Data minimisation review | P1 | Partial | Fields are already lean; `booking` table (customer name/email) is unused and should go. |
| Privacy notices: in-app links, under-18 version, templates | P0 | Partial | Centres set their own notice URL in Settings; office and portal link it beside ours. Templates in `docs/templates/` (staff notice, under-18 version). A public page for the under-18 notice is Phase 2. |
| Record terms/DPA version accepted and when | P0 | Done | `organisation.termsVersion` and `termsAcceptedAt` set at provisioning from `lib/legal.ts` (migration 0041). Re-acceptance on a new version is Phase 2. |
| Leaving: 90-day export, deletion, written confirmation | P0 | Partial | Export always available; suspended centres keep export (`CLAUDE.md`); `eraseOrganisation` exists. The 90-day timer and confirmation email are not automated. |
| Strictly necessary cookies; cookieless analytics | P0 | Done | No analytics or tracking scripts loaded; `CookieNotice` is informational. |
| Named privacy contact, complaints form, 30-day acknowledgement | P0 | Done | `/privacy-request` form → `privacy_request` table with a 30-day due date, automatic receipt, owner email, Dev Center → Privacy queue. |

## Under-18 users and safeguarding

| Requirement | Pri | Status | Evidence / notes |
| --- | --- | --- | --- |
| Required date of birth, automatic under-18 flag | P0 | Missing | No DOB field on `instructor`. |
| Under-18 contact details hidden except Owner/Admin/Welfare | P0 | Missing | Instructors can see colleagues on the rota; phone/email visibility is not role-gated by age. |
| No private adult-to-minor messaging | P0 | Done | No messaging feature at all; notifications are rota/system announcements. |
| Parent/guardian contact, written permission upload, parent accounts | P0 | Missing | |
| No marketing or profiling of under-18s | P0 | Done | Marketing is B2B to centres only (`lib/outreach`); platform users are never emailed marketing. |
| Under-18 photos off by default | P1 | Done (by absence) | No profile photos exist. |
| Vetting tracker: status, date, expiry, reminders; store status only; warn or block | P1 | Conflict C5 | `compliance_item` tracks DBS/first aid/safeguarding with expiry and feeds the fit-to-roster check (warn or block via the licence setting). It also allows uploading the certificate file. The spec says never store certificate contents. |
| Qualification tracker with expiry reminders; warn or block | P1 | Partial | `qualification` with cert number, dates, expiry; dashboard "not cleared to roster" tile; fit-to-roster blocks. Email reminders before expiry: not found. |
| Plain-English privacy explanation for 15-year-olds | P1 | Missing | |

## Working-time rules engine

| Requirement | Pri | Status | Evidence / notes |
| --- | --- | --- | --- |
| School settings: jurisdiction, term dates, breach mode | P0 (U18) | Partial | `organisation.jurisdiction` exists (used for VAT/pricing). No term dates, no breach-mode setting. |
| Worker settings: DOB, employee/volunteer | P0 | Partial | `instructor.employmentType` exists; no DOB. |
| Rules as versioned data with legal citations, per-jurisdiction packs | P0 | Missing | `lib/domain` has conflict, ratio, fit, pay and break rules, no hours limits. |
| Checks: daily/weekly hours, start/finish, breaks, rests, annual break, term caps | P0 | Missing | |
| Checks on rota build and on swaps/pick-ups | P0 | Missing | |
| Actual start/finish times for young workers, exportable register | P0 | Done | `time_entry` clock in/out, payroll export. A dedicated young-worker register export is a small addition. |
| Change history per shift | P0 | Partial | `roster_week.publishedAt` and `audit_log` entries for roster changes; per-assignment change timestamps not stored. |
| Disclaimer in the interface | P0 | Missing | |

## Email (Resend) and the marketing tool

| Requirement | Pri | Status | Evidence / notes |
| --- | --- | --- | --- |
| SPF, DKIM, DMARC | P0 | Dashboard | Steps in `docs/email-setup.md`; records live in Cloudflare DNS. |
| Separate system and marketing subdomains, separate keys | P0 | Missing | Everything sends from `activityroster.com` with one `RESEND_API_KEY`; outreach from-address is per campaign (`outreach_campaign.fromEmail`). |
| Minimal content in emails | P0 | Done | Notifications link into the app; no contact details are emailed. |
| Queue with retries, failed-send list | P1 | Missing | Direct `fetch` to Resend; failures are logged, not queued. |
| Bounce/complaint webhooks suppress addresses | P1 | Partial | Built for outreach (`app/api/webhooks/resend`), not for system email. |
| Backup email provider with automatic failover | P0 | Missing | Single provider behind `sendEmail`/`sendRawEmail` (`lib/mail/index.ts`), which is the right seam to add one. |
| Prospect data separate from school data | P0 | Done | `marketing_prospect` and `outreach_*` are control-plane tables; `lib/outreach` reads nothing tenant-owned. |
| Business contacts only, never users or under-18s | P0 | Done | Audience is the prospect list only (`app/admin/outreach/actions.ts`). |
| Identifies sender, postal address, one-click unsubscribe | P0 | Done | Footer and `List-Unsubscribe` headers (`lib/outreach/writer.ts`, `lib/outreach/engine.ts`). |
| Permanent suppression list checked before every send | P0 | Done | `outreach_suppression`; checked at research, queue and send time. |
| Contact source and legitimate-interests basis; flag sole traders | P1 | Missing | No `source` or `basis` columns on `marketing_prospect`. |

## Backups and disaster recovery

| Requirement | Pri | Status | Evidence / notes |
| --- | --- | --- | --- |
| D1 Time Travel (30 days on Paid) | P0 | Dashboard | Always on. Conor confirmed the Workers Paid upgrade today; 30-day window follows. |
| Nightly D1 export to private EU R2, 30 daily + 12 monthly | P0 | Done (needs secret) | `.github/workflows/backup.yml` at 02:30 UTC: export → gzip → AES-256 → `activityroster-backups` (EU) with lifecycle rules daily/31 days, monthly/400 days, documents/31 days. Runs once `BACKUP_PASSPHRASE` exists. |
| Encrypted off-Cloudflare copy with object lock | P0 | Partial | Workflow copies to any S3-compatible bucket when `OFFSITE_S3_*` secrets exist (recommended Backblaze B2 with object lock). Account is Conor's to open. |
| Backup encryption key held outside Cloudflare | P0 | Done (needs secret) | `BACKUP_PASSPHRASE` lives in GitHub secrets and Conor's password manager, never in Cloudflare. |
| Backup status email | P0 | Done | Workflow posts to `/api/ops/backup-report`; owner emailed on success and failure; Dev Center overview shows the last result. |
| `docs/runbooks/restore.md` (three cases) | P0 | Done | Plus `.github/workflows/restore.yml` for case B (staging rehearsal or confirmed production restore). |
| Quarterly restore test, `docs/restore-tests.md` | P0 | Partial | Log template exists; first rehearsal due a week after backups start. |
| GitHub as source of truth, branch protection on main, `docs/environment.md` | P0 | Partial | Repo is the source of truth and deploys only from GitHub. **There is no `main` branch**: all work is on `claude/new-session-2wxbwe` with no protection. Secrets are named in `.dev.vars.example` and `scripts/setup-secrets.sh`; no rotation notes. |
| Monthly DNS zone export | P1 | Missing | Needs a Zone DNS Read token; Phase 2. |
| Replay deletions after restore | P1 | Missing | |

## Safe change management

| Requirement | Pri | Status | Evidence / notes |
| --- | --- | --- | --- |
| Local, staging, production | P0 | Missing | Local and production only; one D1, one R2, one KV (`wrangler.toml` has no environments). |
| Branches, tests before main, Conor approves DB/security/feature changes | P0 | Conflict C3 | Today every push to the working branch deploys straight to production after tests (`deploy.yml`), and Conor runs migration SQL by hand in the D1 console. No approval step. |
| Deploy from GitHub only | P0 | Done | `.github/workflows/deploy.yml`, set up today. |
| Versioned migrations, staging first, Time Travel bookmark, no destructive changes | P0 | Partial | Drizzle migrations are versioned (`lib/db/migrations`, 40 so far) and additive. No staging; no bookmark step; applied by pasting SQL. |
| One-click rollback documented | P0 | Missing | Cloudflare keeps Worker versions; the click-path is not written down. |
| Claude Code guardrails and least-privilege tokens | P0 | Missing | No `.claude/settings.json`. This cloud session holds no Cloudflare credentials, so it cannot touch production directly; the deploy token in GitHub is scoped to Workers. |
| Rules in `CLAUDE.md` | P0 | Partial | Added in this commit: a pointer to the spec and the working rules. The change-management rules are written as the target state because the tooling (staging, approval gate) does not exist yet. |
| Deploy window 23:00–04:00, smoke tests, auto-rollback | P0 | Conflict C4 | Deploys happen on push at any hour. No smoke tests. |
| Release notes | P2 | Partial | Dev Center change log (`app/admin/change-log`) lists commits in plain English. |

## Incident response and offline fallbacks

| Requirement | Pri | Status | Evidence / notes |
| --- | --- | --- | --- |
| Daily rota digest (opt-in email + PDF) | P0 | Missing | A printable weekly rota exists (`app/(app)/office/rota`); no scheduled email. |
| Emergency sheet (today's staff, students, emergency contacts), restricted and logged | P0 | Conflict C6 | No emergency contacts and no student names are held, so the sheet as specified cannot be produced without first adding (and protecting) that data. |
| External uptime monitoring and status page | P0 | Missing | |
| Incident banner via KV flag | P1 | Missing | |
| Maintenance page | P1 | Missing | |
| `docs/runbooks/incident.md`, severity table, breach steps, templates | P0 | Missing | |

## Accessibility, AI and extras

| Requirement | Pri | Status | Evidence / notes |
| --- | --- | --- | --- |
| WCAG 2.2 AA, mobile-first, accessibility statement | P1 | Partial | An accessibility pass was done (labels, focus, contrast); no formal audit, no statement page. |
| AI rules | n/a | Conflict C7 | The spec says no AI features are planned. The Dev Center outreach agent (built today) sends **prospect business data and website text** to Anthropic's API. No school data is ever sent. Anthropic must go on the sub-processor register and the spec should be updated to describe this use. |
| Rule-based auto-rostering transparent and overridable | P2 | Partial | Fit-to-roster suggestions are rule-based and always manual to apply. |
| Ratio checks per activity | P2 | Done | `lib/domain/ratio.ts`, configurable per course type. |
| CSV import for staff and students | P2 | Done (staff) | `app/(app)/office/staff/import`, `app/(app)/office/import` (courses). Students are not held. |
| Customer-facing security overview page | P1 | Done | `/trust` from `docs/security-overview.md`. |

## Conflicts, with Conor's decisions (3 October 2026)

Decisions in **bold** at the end of each item.

- **C1. Second factor for admins.** Spec: authenticator app mandatory for Owner/Admin. App today: emailed code mandatory on every office sign-in (your instruction this morning), authenticator app optional. Options: keep the emailed code as the floor and let a centre require TOTP for its admins (recommended for small clubs), or make TOTP mandatory for everyone. **Decision: emailed code the first time a device is used and again after that device has gone 12 hours without using the office; PIN whenever 30 minutes idle. Built the same day (`lib/auth/login-verify.ts`).**
- **C2. Ghost Mode.** Spec: no support login. App: read-only Ghost Mode from the Dev Center, logged. Options: remove it, or keep it behind the centre's explicit time-limited consent (a "grant support access for 24 hours" button in the office) with the audit entry visible to the centre. **Decision: keep Ghost Mode as it is; centres agree to it in the terms. Action for the solicitor review: make sure the terms say so plainly.**
- **C3. Approval before production.** Spec: Conor approves every database, security, permission and feature change. App: every push deploys. Recommended: a `main` branch with a GitHub "production" environment that requires your one-click approval, plus auto-deploy to staging. Small fixes could still auto-merge via a label. **Decision: a staging environment where Conor tests before anything reaches production. Built: staging deploys on every push, production deploys only from the "Deploy production" button (`docs/runbooks/deploy.md`).**
- **C4. Deploy window 23:00–04:00.** This adds a day's delay to every change while the product is still being built daily. Recommended: adopt it once there are paying centres in season; until then, approve-then-deploy at any time. **Decision: deferred until there are paying centres.**
- **C5. Vetting certificates.** The app lets centres upload DBS certificates. Spec: status only. Options: remove the upload for vetting types (keep it for RYA certificates and first aid), or keep it encrypted and admin-only. Recommendation: remove it for vetting types. **Decision: keep the uploads. Phase 2 restricts them to admins, encrypts them and logs every view; the spec's "status only" line is superseded.**
- **C6. Emergency contacts and students.** The spec assumes both are held; neither is. Decision: add emergency contact fields for staff (encrypted, admin/welfare only) so the emergency sheet can exist, and leave student personal data out. **Decision: yes.**
- **C7. AI in the outreach agent.** Confirm Anthropic as a sub-processor for prospect data and update the spec's AI section accordingly. **Decision: yes. Added to `docs/subprocessors.md`.**

## Owner checklist items this audit could not see

Cloudflare: Workers Paid, Always Use HTTPS, minimum TLS, WAF, R2 jurisdiction, D1 region,
Logpush. Resend: domain region, DPA. GitHub: secret scanning, push protection, 2FA.
Stripe: DPA. All are dashboard clicks; the plan lists them with where to click.
