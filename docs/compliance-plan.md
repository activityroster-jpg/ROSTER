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
| C8 | Working-time checks and parent features (10 October 2026) | Removed at Conor's request: hours, breaks, rest, term dates, permits and parental consent are the centre's to manage as employer, and the checks were getting in the way of rostering. Gone: the rules engine and rule packs (Dev Center → Rules), the Young workers settings card, under-18 and adult hour checks on assignment and in the problems list, the young-worker time register, parent accounts, parent approval, the parent view and the parental-permission slot. Kept: the under-18 flag, contact details hidden from colleagues, no contact sharing or marketing for under-18s, and the parent or guardian emergency contact. Added: each person's rostered hours for the week beside their name on the roster (People × days) and on Availability. Old `guardian_link` rows (parent emails, consent notes) and the unused settings columns and `rule_pack` table stay until a cleanup migration Conor approves, tested on staging first. |

## Phase 1 (P0): before onboarding more customers

### P0-A Documents and quick code fixes — done 3 October (leaving flow, password nudge and append-only logs added the same evening; `booking` table dropped 3 October (migration 0047, after the first nightly backup and off-site copy); GitHub security settings are Conor's clicks)

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

### P0-C Backups and restore — live 3 October (first nightly + off-site copy confirmed); first restore rehearsal due ~10 October

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

### P0-F Working-time rules engine, under-18 scope (L) — built 3 October; withdrawn 10 October (decision C8)

- Done: rule packs for Great Britain, Northern Ireland and Ireland as versioned data with
  citations and per-figure verified flags; Dev Center → Rules to view, edit and reset them;
  centre settings for breach mode (default: block with override, reason to the audit log)
  and term dates; checks on every assignment path (daily and weekly hours, start and finish,
  breaks, daily and weekly rest, term-time caps, annual break and paperwork as notices);
  "not active for this jurisdiction" notice for centres outside the three packs;
  young-worker time register CSV with assigned / confirmed / published stamps; disclaimer on
  the roster and in Settings; Learning Centre guide (`/learn?topic=young-workers`).
- Verified by Conor against GOV.UK on 3 October: the 16–17 band (22:00–06:00, 30-minute
  break after 4.5 hours, 12 hours' daily and 48 hours' weekly rest) and the 15–16 holiday
  caps (8 hours weekdays and Saturdays, 2 on Sundays, 35 a week). The GB pack is now marked
  verified. Decisions (Conor, 3 October): the 16–17 rules apply from the 16th birthday,
  not the school-leaving date (the law is stricter for a 16-year-old still at school until
  the June leaving date; noted in the pack); under-15s are not rostered as workers on the
  platform; they may only volunteer, so no 13–14 band is carried and the engine raises a
  notice (a warning if they are recorded as employed) instead of applying caps.
- **Conor:** the Northern Ireland pack (Education Authority) and the Ireland pack (WRC)
  still carry unverified figures.
  Then in Dev Center → Rules remove each checked field from the band's `unverified` list,
  add the source to `citations`, bump `version`, and set `verified` to true once every list
  is empty. Until then every warning carries "figure not yet verified".
- Later (Phase 2): adult working-time checks; term dates imported from a public feed.

### P0-G Email resilience (M) — code built 3 October; live when Conor adds the DNS records and the Postmark account

- Done in code: two mail streams (system and news) with separate Resend keys and an
  enforced outreach from-domain; Postmark as backup provider with automatic failover on
  outages (never on a rejected message); failover counter on the Dev Center overview;
  Postmark added to the sub-processor register.
- **Conor** (plain steps in `docs/email-setup.md`, Parts 3 and 4): verify
  `notify.activityroster.com` and `news.activityroster.com` in Resend, create a key per
  domain, open a Postmark account (EU DPA) and verify the same two domains there, then set
  the Worker variables listed in `docs/environment.md`. Start DMARC at `p=none`.
- Until the variables exist nothing changes: everything still sends from
  `no-reply@activityroster.com` through the single Resend key.

### P0-H Offline fallbacks and monitoring — done 3 October (status page: https://activity-roster.betteruptime.com)

- Opt-in daily rota digest email (PDF attached) sent from the existing hourly tick.
- Emergency sheet: printable today's staff on duty with emergency contacts, admin-only,
  logged, with handling warning.
- **Conor:** sign up for Better Stack (free tier) or UptimeRobot; I give the URLs to
  monitor and the status-page text. Text-message alerts come from that service.

### P0-I CLAUDE.md and spec upkeep (S)

- Done for the working rules and change management; CLAUDE.md now also points at the
  rule packs (P0-F). Remaining after P0-G: a final pass over the spec's owner checklist.

## Phase 2 (P1): approved by Conor 3 October 2026, in this order

### P1-A Per-person data rights — built 3–4 October
- Staff profile → Data & privacy: export (JSON/CSV) of everything held about a person,
  restrict processing (not rostered, not contacted; reason recorded), anonymise with typed
  confirmation (identifying fields, certs and files, availability, leave, pay rates,
  notifications and login removed; roster and payroll history kept as "Former staff
  member"). `deletion_log` records each anonymisation by one-way hash; "Replay deletions"
  re-applies them after a restore (Dev Center, centre page).
- Change log shows sign-in events for the centre's accounts and downloads as CSV.
- Migration 0049. Guide updated.

### P1-B Sessions and alerts — built 4 October
- Office → Security → "Sign out all other devices" (ends other sessions, forgets confirmed
  devices, emails the account). Settings → Security: PIN idle timeout per centre, 5 minutes
  to 4 hours, carried inside the signed PIN cookie so the middleware slides it correctly.
- Owner alerts (`lib/security/alerts.ts`): more than 8 failed PIN / identity / join-code
  checks on one account in an hour, or more than 15 exports and sensitive-record views
  from one centre in an hour, email the platform admins, at most once a day per subject.
- Dev Center → Overview → Operations: incident banner on every surface (with the status
  page link) and maintenance mode, which shows a holding page in the office and the app to
  everyone except platform admins. Migration 0050.

### P1-C Email queue and prospects — built 4 October
- Every email goes through `email_outbox` (`lib/mail/queue.ts`): one attempt at once, retries
  from the hourly tick with backoff (5, 15, 45, 135 minutes, five attempts), then the
  failed-send list at Dev Center → Email with retry and discard. Bodies are cleared once sent
  or finally failed; sent rows purge after 7 days, failed after 30. Time-limited messages can
  carry an expiry and fail rather than arrive late.
- Bounces and complaints on system email (Resend webhook) mark the row failed and put the
  address on the suppression list, which every send now checks.
- Prospects carry `lawful_basis` (legitimate interests, consent, existing customer), a note,
  and a sole-trader flag (CSV columns "Sole trader" and "Basis"; toggles in the table). The
  outreach agent never emails a sole trader without consent (PECR). Migration 0051.

### P1-D Retention — built 4 October
- Settings → Data retention: months per record type (former staff, leave, availability,
  notifications, clock/payroll with a 6-year floor, change log with a 3-year floor). Daily
  sweep per centre from the hourly tick; 14-day notice email to admins; "Keep for another N
  months" on a former staff profile; anonymisation rather than deletion for people; every
  run in the change log and deletion log; replay after a restore re-runs the sweep.
- Platform side: security events and trusted devices after 12 months, error reports after
  12 months, closed privacy requests after 3 years. Append-only triggers now allow deletion
  only past those ages (migration 0053). Migration 0052 adds the columns and `left_at`.

### P1-E Vetting and reminders — built 4 October
- `compliance_type.is_vetting` (seeded for DBS, PVG, AccessNI, Garda and the generic check;
  migration 0054 flags existing rows). Vetting checks take no file: uploads are refused, the
  document manager offers no upload slot, and any file already attached is removed by the
  daily sweep (audited). The certificate number is encrypted at rest (`sealToken`) and
  decrypted only on the admin's staff page and in a person export.
- Expiry reminders: instructors are now emailed as well as notified in the app (respecting
  their email preference); admins get one email every Monday listing expired and expiring
  certs and checks within the centre's lead time.
- Still to do: a way for a centre to mark one of its own custom check types as vetting
  (Settings → Checks), noted for P1-G.

### P1-F Roles and families — built 4 October; parent accounts withdrawn 10 October (decision C8)
- Roles: admin, senior instructor (office roster, no pay/billing/settings/exports), welfare
  officer (staff profiles, protected contacts, emergency sheet, young-worker register),
  instructor, parent. Matrix in `lib/auth/rbac.ts`; `requireTenant({ permission })`;
  sidebar filtered by role; granted from the staff profile's Access card.
- Contact-detail opt-in: `instructor.share_contact`, portal setting (never offered to
  under-18s), "Team contacts" list in the portal for those who opted in.
- Parent accounts: `guardian_link` (consent note, who recorded it, when); admin invites the
  guardian on file from an under-18's profile; the guardian signs in by email and sees
  `/parent`, a read-only four-week rota for their child; access revocable; ends with
  anonymisation. Migration 0055. Per-centre matrix adjustments are not offered (roles are
  fixed and documented) — raise if a centre needs one.

### P1-G Public pages and the rest — built 4 October
- Done in code: working-time warnings for adults (48-hour average, 20-minute break after 6
  hours, 11 hours' daily and 24 hours' weekly rest, warn-only because of averaging and
  opt-outs); plain-English under-18 privacy page (`/privacy/young-people`, linked from the
  footer, the privacy policy and the guardian card); free-text reminders under every
  note/reason box; `/trust` brought in line with the platform (roles, PIN timeout, sign-in
  by email, retention, append-only logs); accessibility statement (`/accessibility`), skip
  link, visible focus ring and reduced-motion support, with the self-audit's known gaps
  listed on the page; public sub-processor register (`/subprocessors`) with a dated change
  list and a Dev Center "Sub-processor change notice" that emails every centre admin at
  least 30 days ahead; monthly DNS zone export workflow; custom vetting-type flag under
  Settings → Checks.
- Conor's clicks: WAF managed rules (`docs/runbooks/deploy.md`, "Cloudflare WAF managed
  rules"); add the `CLOUDFLARE_ZONE_ID` secret and give the API token Zone → DNS → Read for
  the DNS export.
- Still open from the WCAG self-audit: a list view of the availability grid and roster for
  screen readers; label association on a few Dev Center forms; contrast of some mobile icons.

## Phase 3 (P2): when customers ask or revenue allows

- SSO (Google / Microsoft), annual penetration test, release notes page, rule-based
  auto-rostering, student import if students are ever held.

## Not Claude Code's to do (from the spec's owner checklist)

Solicitor review of terms, DPA, notices and DPIA; ICO fee; EU representative question;
legitimate-interests assessment for the prospect list; insurance; Cyber Essentials; 2FA on
every third-party account; recovery codes offline; password-manager emergency access;
domain auto-renew and billing alerts; the "if I'm unavailable" note; quarterly restore test
in the calendar.
