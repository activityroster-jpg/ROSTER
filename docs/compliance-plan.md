# Compliance plan (phased)

Built from `docs/compliance-gap-report.md`. Each phase starts only after Conor approves
it. Items marked **Conor** are dashboard clicks or account sign-ups; everything else is
code or documents Claude Code writes, tests and deploys through GitHub.

Effort is a rough guide: S = under half a day, M = one to two days, L = a week or more.

## Decisions (made 3 October 2026)

| # | Question | Decision |
| --- | --- | --- |
| C1 | Admin second factor | Emailed code the first time on a device and after 12 idle hours; PIN after 30 idle minutes. Done. |
| C2 | Ghost Mode | Keep as is; covered by the terms (solicitor to confirm wording). |
| C3 | Production approval | Staging on every push; production only from the "Deploy production" button. Done. |
| C4 | Deploy window | Deferred until paying centres. |
| C5 | Vetting certificate uploads | Keep; restrict, encrypt and log in Phase 2. |
| C6 | Emergency contacts | Add for staff, encrypted, admin-only. Students stay out. |
| C7 | Anthropic | Listed as a sub-processor (prospect data only). Done. |

## Phase 1 (P0): before onboarding more customers

### P0-A Documents and quick code fixes — done 3 October (remaining: `booking` table removal after a backup cycle; GitHub security settings are Conor's clicks)

- `docs/subprocessors.md`, `docs/data-map.md` (from the real schema), `docs/environment.md`,
  `docs/retention.md` (defaults), `docs/runbooks/restore.md`, `docs/runbooks/incident.md`,
  `docs/restore-tests.md` (template), `docs/security-overview.md`, draft TOMs annex, draft DPIA.
- Password minimum 12 everywhere; HIBP check on every password set.
- `/.well-known/security.txt` and a short disclosure page; privacy complaints form with a
  tracked acknowledgement (Dev Center queue, 30-day timer).
- Record the terms and DPA version plus timestamp on each organisation at signup and on
  re-acceptance.
- `frame-ancestors 'none'`; `.github/dependabot.yml`; remove `d1-letter-not-sent.sql`
  from the repo once it has been run; drop the unused `booking` table in a later release
  (additive-first rule: stop reading it now, remove the table after a backup cycle).
- Audit log additions: exports, sensitive-record views, deletions; remove email addresses
  from console logs.
- Generic sign-in message for unverified accounts.
- **Conor:** GitHub → Settings → Code security: turn on Dependabot alerts, secret
  scanning, push protection. Cloudflare → SSL/TLS: Always Use HTTPS on, minimum TLS 1.2.
  Resend → Domains: note the region; Resend, Stripe, Cloudflare, GitHub: accept DPAs.

### P0-B Billing grace path — done 3 October (14-day grace after a failed payment, then read-only with a banner; never deletion)

- Confirm `past_due` keeps the centre read-only with a visible banner and never deletes;
  write the grace period into the billing page copy.

### P0-C Backups and restore — built 3 October; live once BACKUP_PASSPHRASE is set (Conor), off-site once the B2 secrets exist

- Nightly GitHub Actions job: `wrangler d1 export` → encrypted → private EU R2 bucket
  (30 daily, 12 monthly lifecycle) → off-site copy with object lock.
- Backup status email to Conor after each run (success or failure).
- Encryption key generated once; **Conor** stores a copy in a password manager.
- Restore runbook written against the real commands; first restore test into staging
  (needs P0-D) logged in `docs/restore-tests.md`.
- **Conor:** open the off-site account. Recommended: Backblaze B2 (EU region, object
  lock, DPA available), about $6/TB/month. Alternative: Scaleway Object Storage (Paris).
- **Conor:** confirm R2 bucket jurisdiction; if not EU, approve a new EU bucket and a
  one-off migration of uploaded documents.

### P0-D Staging, branches and approval (M) — built 3 October, awaiting provisioning

- Second D1, R2, KV and a Resend test key for staging; `wrangler.toml` environments;
  synthetic seed for staging.
- `main` branch with protection; `staging` deploys on every push; production deploys from
  `main` after Conor's one-click approval in GitHub (environment protection rule).
- Migration step in the production deploy: record the D1 Time Travel bookmark, then apply
  pending migrations automatically, so no more pasting SQL into the console.
- Documented one-click rollback (Cloudflare Workers → Deployments → Rollback).
- Post-deploy smoke test (home page, sign-in page, one authenticated API) with automatic
  rollback and an email to Conor on failure.
- `.claude/settings.json` denying remote D1 execution, Worker and R2 deletion without
  explicit approval.
- **Conor:** approve the first deploy through the new gate.

### P0-E Under-18 controls — done 3 October (parent accounts and the welfare role follow the Phase 2 roles work)

- Date of birth on staff profiles (required for new staff, prompted for existing ones);
  under-18 flag computed daily and shown on the roster and staff list; lifts at 18.
- Contact details of under-18s hidden from everyone except admins (and the welfare role
  once roles exist).
- Parent or guardian name, phone and email on under-18 profiles, plus a written-permission
  upload slot and date. Parent accounts themselves are Phase 2 (they depend on roles).
- Emergency contact fields for all staff, encrypted at rest, admin-only, every view logged.

### P0-F Working-time rules engine, under-18 scope (L)

- Rule packs as versioned JSON with legal citations: Great Britain, Northern Ireland,
  Ireland, each figure marked verified or unverified; Dev Center screen to view and edit.
- Centre settings: jurisdiction (already stored), term and holiday dates, breach mode
  (warn / block with override / block). Default: block with override, reason to audit log.
- Checks on roster build and on swaps and open-shift pick-ups: daily and weekly hours,
  earliest start and latest finish, breaks, daily and weekly rest, term-time caps, annual
  break. Clear "young-worker checks not active for this jurisdiction" notice otherwise.
- Young-worker time register export; per-assignment published/changed/cancelled stamps;
  disclaimer text on the rota.
- **Conor:** supply the qualifying jurisdiction list and arrange verification of the
  figures (WRC, Education Authority NI, GOV.UK).

### P0-G Email resilience (M)

- Two Resend domains: `notify.activityroster.com` (system) and `news.activityroster.com`
  (outreach), separate API keys; outreach from-address restricted to `news.`.
- Backup provider behind the existing `sendEmail` seam with automatic failover.
  Recommended: Postmark (EU data processing addendum available) or Amazon SES (eu-west-1).
- **Conor:** add the DNS records the two providers list; start DMARC at `p=none`.

### P0-H Offline fallbacks and monitoring — digest and emergency sheet done 3 October; uptime monitor is Conor's sign-up

- Opt-in daily rota digest email (PDF attached) sent from the existing hourly tick.
- Emergency sheet: printable today's staff on duty with emergency contacts, admin-only,
  logged, with handling warning.
- **Conor:** sign up for Better Stack (free tier) or UptimeRobot; I give the URLs to
  monitor and the status-page text. Text-message alerts come from that service.

### P0-I CLAUDE.md and spec upkeep (S)

- Done in this commit for the working rules; change-management rules are updated again
  when P0-D lands.

## Phase 2 (P1): next quarter

- Roles and permission matrix: welfare officer, senior instructor, under-18, parent
  accounts; per-centre adjustments; contact-detail opt-in. Parent consent records.
- Per-person data tools: export (JSON/CSV), correct, freeze, delete/anonymise with linked
  records; deletion log replayed after restores.
- Retention settings per data type with scheduled deletion and 14-day reminders.
- App-level encryption of vetting status; remove certificate uploads for vetting types
  (C5); qualification and vetting expiry reminder emails.
- "Log out all devices", configurable idle timeout, email-change alerts, alerts to Conor
  for repeated unusual sign-ins and mass exports.
- Email queue with retries and a failed-send list; bounce handling for system email.
- Prospect source and lawful-basis columns; sole-trader flag.
- Audit log export for centres; security events in the centre's change log.
- Incident banner (KV flag), maintenance page, monthly DNS zone export.
- Working-time checks for adults; plain-English under-18 privacy page; free-text warnings.
- Customer-facing security overview page; accessibility statement and WCAG 2.2 AA audit;
  Cloudflare WAF managed rules; sub-processor change notices.

## Phase 3 (P2): when customers ask or revenue allows

- SSO (Google / Microsoft), annual penetration test, release notes page, rule-based
  auto-rostering, student import if students are ever held.

## Not Claude Code's to do (from the spec's owner checklist)

Solicitor review of terms, DPA, notices and DPIA; ICO fee; EU representative question;
legitimate-interests assessment for the prospect list; insurance; Cyber Essentials; 2FA on
every third-party account; recovery codes offline; password-manager emergency access;
domain auto-renew and billing alerts; the "if I'm unavailable" note; quarterly restore test
in the calendar.
