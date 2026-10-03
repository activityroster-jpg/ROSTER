# ActivityRoster — security audit (October 2026)

Scope: the deployed Worker (Next.js 15.5 / OpenNext 1.20 / Better Auth 1.7.5 /
Drizzle on D1 / R2 / KV). Reviewed: middleware and host routing, tenant
resolution and RBAC, every API route (15), every server action (27 files),
the PIN second factor, Better Auth configuration, Stripe webhooks, R2 document
access, email rendering, secrets handling, dependency advisories and the git
history. Method: code review plus the existing isolation test suite — no
production system was touched.

**Overall:** the hard parts are right. Tenant isolation is structural and
proven by test for all 33 tenant tables; every office action is admin-gated;
portal actions resolve the instructor from the session rather than the
client; R2 keys are org-prefixed; Stripe is verified on the raw body with
two-layer idempotency and a live-mode guard; security headers are set; no
secrets are in the repo or its history. The findings below are about the
*edges*: the PIN can be reset without proof, secrets have insecure fallbacks,
sign-in throttling is ineffective on Workers, and user text reaches the
owner's inbox unescaped.

Severity: **High** = exploitable now with realistic effort · **Medium** =
needs a precondition or has limited blast radius · **Low** = hardening.

---

## High

### H1. "Forgot PIN" defeats the PIN second factor
`app/pin/actions.ts` → `resetMyPinAction` clears the signed-in user's PIN with
no further proof (no password, no emailed code). The PIN exists to protect
against a stolen or left-open session; with this action, anyone holding the
session cookie clicks *Forgot PIN*, sets a new one and is through.

**Fix:** require the account password (or a one-time code to the account /
recovery email) before clearing; audit the reset; email the user that it
happened. Pair with the planned unfamiliar-device re-auth.

### H2. Insecure secret fallbacks
`BETTER_AUTH_SECRET ?? "dev-insecure-secret-change-me"` appears in
`lib/auth/index.ts`, `lib/auth/pin-gate.ts` and `app/pin/actions.ts`. If the
Worker secret is ever missing or mis-named in production, session tokens and
the signed "PIN verified" cookie become forgeable with a public string — and
nothing would warn you.

**Fix:** one `requireSecret()` helper that throws when `APP_ENV=production`
and a required secret is unset; use it for `BETTER_AUTH_SECRET`,
`STRIPE_WEBHOOK_SECRET`.

### H3. Sign-in brute force is effectively unthrottled
Our KV rate limiter protects signup, leads, slug-check, report-error and the
webhook — but **not** `/api/auth/*`. Better Auth's built-in limiter is
in-memory, which on Workers is per-isolate and short-lived, so password,
magic-link, two-factor and forgot-password endpoints can be hammered.

**Fix:** wrap the `/api/auth/[...all]` handler with the KV limiter for the
POST endpoints (per IP and per email on `sign-in/email`, `sign-in/magic-link`,
`two-factor/*`, `forget-password`), or give Better Auth a KV-backed
`rateLimit.customStorage`. Make these specific limits fail **closed** if KV is
unavailable (see M4).

---

## Medium

### M1. HTML injection into the owner's inbox
Public input is interpolated straight into email HTML:
- `/api/leads` — `email`, `centreName`, `message`
- `/api/report-error` — `path`, `digest`, organisation name (message is
  scrubbed for PII but not HTML-escaped)
- `book/actions.ts` — `name`, `centre`, `notes` (sent to you *and* back to
  the visitor)
- `lib/billing/provision.ts` — `centreName`

Anyone on the internet can therefore place arbitrary links, buttons and
"reset your password" lures into the platform owner's mailbox under the
ActivityRoster template. **Fix:** a shared `escapeHtml` in `lib/mail`, applied
at every call site (notifications.ts already does this correctly).

### M2. Security events are not audited
Setting, resetting and failing the PIN, changing the recovery email, and
inviting an instructor leave no audit trail you can review. **Fix:** write
audit rows for each (tenant `audit_log` where a `TenantContext` exists; a
small control-plane security log for PIN/recovery events).

### M3. Cron secret accepted in the query string
`/api/cron/sync-integrations` accepts `?key=<CRON_SECRET>`, which lands in
request logs and analytics. **Fix:** `Authorization: Bearer` only.

### M4. Rate limiter fails open
`lib/security/rate-limit.ts` allows everything when KV errors (a deliberate
availability trade-off). For auth and signup that means a KV blip switches off
all brute-force and abuse protection. **Fix:** a `failClosed` option used on
the auth and signup limits only.

### M5. Report-error endpoint can flood every platform admin
Each accepted `/api/report-error` call emails *all* admins; the limit is 30
per minute per IP, so a handful of IPs can bury the inbox. **Fix:** a global
cap (e.g. 20 emails/hour) with an hourly digest beyond that.

### M6. No session revocation or notification on account changes
Better Auth's `revokeSessionsOnPasswordReset` is off, so a password reset
leaves an attacker's existing session alive. Password, PIN and recovery-email
changes send no "this just changed" email. **Fix:** enable revocation; notify
on each change; (ties into H1).

### M7. Instructor invite grants membership before acceptance
`linkInstructorUser` creates the membership immediately for whichever existing
user owns that email. A mistyped address silently gives another account
instructor-level access (their own records, the rota) until noticed. **Fix:**
mark invites pending until the magic link is used, and show/allow revoke on the
Staff tab.

---

## Low / hardening

- **L1.** CSP allows `'unsafe-inline'` scripts (Next.js without nonces).
  Accepted for now; nonce-based CSP is a later project.
- **L2.** Integration feed fetch uses `redirect: "follow"` after the SSRF guard
  checks only the first URL. Workers' network makes this mostly moot; set
  `redirect: "manual"` and re-validate, or cap at one hop.
- **L3.** Bookwhen API tokens are stored in plaintext in D1. Encrypt at rest
  (AES-GCM with a Worker secret).
- **L4.** `enforcePinGate` fails open when no session id is present. Better
  Auth always provides one; make it fail closed.
- **L5.** Upload type check trusts the client's `file.type` and lets an empty
  type through; downloads have no `Content-Disposition: attachment`. Sniff
  magic bytes and force attachment.
- **L6.** `/api/signup` reveals whether an email is registered. Low value to
  fix; note only.
- **L7.** `npm audit`: 10 advisories, all in build/test tooling (vitest, vite,
  esbuild, drizzle-kit, postcss via Next's dev chain). None ship in the
  Worker bundle. Keep current.
- **L8.** Onboarding cookie set without `httpOnly`/`secure` (cosmetic flag only).

---

## What is already solid (keep it that way)

- Tenant isolation: every one of the 33 tenant tables goes through
  `TenantRepository`; `tests/isolation` proves list/findById/update/delete/insert
  cannot cross orgs. No raw queries against tenant tables anywhere in app code.
- Authorisation: `requireTenant({ role: "admin" })` on all 60+ office actions
  and both office API routes; portal actions derive "me" from the session.
- Platform admin: email allowlist from a Worker var, plus PIN; nobody is admin
  when the var is unset.
- Stripe: raw-body signature verification, `webhook_event` idempotency, live
  vs test guard, price IDs from env only.
- R2: org-prefixed keys with an explicit cross-tenant assert; instructors
  limited to their own prefix.
- Input validation: Zod on every public body; server-side slug validation and
  reservation; open-redirect guard on `next`.
- Secrets: none in the tree or git history; `.dev.vars.example` holds
  placeholders only; `NEXT_PUBLIC_*` limited to the apex domain and the
  Google verification token.
- Headers: HSTS preload, nosniff, frame-ancestors, referrer policy,
  permissions policy.

---

## Status (after the fix round)

| Finding | Status |
|---|---|
| H1 PIN reset without proof | **Fixed** — password or emailed one-time code required; throttled; logged; notified |
| H2 Insecure secret fallbacks | **Fixed** — `requireSecret()` hard-fails in production |
| H3 Sign-in brute force | **Fixed** — KV throttle on `/api/auth/*` sensitive POSTs, per IP + per email, fail-closed |
| M1 Email HTML injection | **Fixed** — `escapeHtml` at every call site; single-line capped subjects |
| M2 Security events unaudited | **Fixed** — `security_event` table (migration 0032); shown on /security |
| M3 Cron secret in query string | **Removed** — the scheduled sync endpoint is gone; booking systems refresh only when an admin presses “Check for updates” |
| M4 Limiter fails open | **Fixed for auth/PIN** (`failClosed`); marketing forms still fail open by design |
| M5 Error-report mail flood | **Fixed** — 20 emails/hour global cap; reports still stored |
| M6 No revocation / notification | **Fixed** — sessions revoked on password reset; emails on PIN reset/lock, recovery-email and password changes |
| M7 Invite grants access early | **Fixed** — memberships start `invited`, activate on first signed-in visit |
| L2 Feed redirects | **Fixed** — manual redirects, every hop re-validated |
| L4 PIN gate fail-open | **Fixed** — fails closed |
| L5 Upload type trust | **Fixed** — magic-byte sniffing; downloads get nosniff + safe disposition |
| L1 CSP `unsafe-inline` | Open — nonce-based CSP is a separate project |
| L3 Plaintext Bookwhen tokens | Open — encrypt at rest when the integrations area is next touched |
| L6 Signup email enumeration | Open — accepted |
| L7 Dev-tooling advisories | Open — build/test only; keep dependencies current |
| L8 Onboarding cookie flags | Open — cosmetic |

**Operator action:** run migration 0032 (`d1-security-event-migration.sql`) in D1,
and confirm `BETTER_AUTH_SECRET` and `STRIPE_WEBHOOK_SECRET` are
set as Worker secrets — with the new guard, a missing `BETTER_AUTH_SECRET`
will stop sign-in in production instead of silently using a public string.

## Proposed order of work (as executed)

1. **H1 + M6 + M2** — PIN reset requires password, audit + email on security
   events, revoke sessions on password reset. (Same files; one change.)
2. **H2 + H3 + M4** — `requireSecret()`, KV throttle on `/api/auth`, fail-closed
   option.
3. **M1 + M5** — `escapeHtml` everywhere, global cap on error-report mail.
4. **M3, M7, L2–L5** — small hardening items.
5. **Unfamiliar-device re-auth** (your planned feature) builds on 1 and 2.

## Update (3 October 2026, branch `claude/new-session-2wxbwe`)

New controls since the fix round:

- **Trusted devices** keyed on device id + country (not IP), so mobile networks
  no longer trigger constant password prompts; IP still recorded.
- **Two-factor at sign-in**: the web and app sign-in now handle an enrolled
  authenticator (`/two-factor`: TOTP, emailed code, backup code). Before this an
  admin who enabled 2FA could not complete a password sign-in.
- **Dev Center requires an authenticator app** (`/admin/security`): one-off
  enrolment (with a set-password step for link-only owners) and a code once per
  session, bound to the session id in a signed cookie, on top of the allow-list,
  device check and PIN.
- **Integration API keys encrypted at rest** (AES-256-GCM, key from
  `TOKEN_ENCRYPTION_KEY` or derived from the auth secret), legacy plaintext still
  read, and **redacted from the GDPR export**.
- **Breached-password check** (HIBP k-anonymity, 2.5 s timeout, fails open) on
  sign-up and every set/change of password; new passwords 10+ characters.
- **Sign-up ordering**: web address reserved first; an orphaned login is removed
  if provisioning fails; the hold is released afterwards.
- **Scoped id checks** before `course_staff`, equipment and location inserts.
- **Imports** capped at 500 rows; batched inserts chunked for D1.
- **CSP** `connect-src` narrowed to our origin, Stripe and Sentry ingest.
- **Trial end** enforced server-side: read-only (writes refused in the
  repository layer), then locked, with only billing reachable.
- **Audit** now covers email-preference changes, profile edits, publish/confirm
  and payroll overrides.

Still open: nonce-based CSP for inline scripts (static marketing pages make a
per-request nonce awkward); dependency bumps for dev tooling.

**Operator action:** run `d1-roster-payroll-trial-migration.sql` in D1; set
`TOKEN_ENCRYPTION_KEY` (optional) and rotate the Stripe keys that were pasted
into chat; enrol an authenticator at `/admin/security` on the first Dev Center
visit.
