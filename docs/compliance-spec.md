# Activity Roster (Bosun) — Security, Privacy, Compliance & Resilience Spec

3 October 2026 · Conor

## How to use this spec

This is the standing brief for security, privacy, legal compliance and resilience on activityroster.com. Claude Code should save a copy in the repo as `docs/compliance-spec.md` and reference it from `CLAUDE.md` so every session follows it.

**Working rules for Claude Code**

1. **Audit first.** Review the existing codebase against every section and produce a gap report (done / partial / missing, with file references) before changing anything.
2. **Plan in phases.** Propose a phased plan using the priority tags below. Wait for Conor's approval before starting each phase.
3. **Protect production data.** Never run a migration, delete or bulk update on production without testing it on staging first and recording the current D1 Time Travel bookmark.
4. **Never commit secrets.** Use Cloudflare secrets and environment variables only.
5. **Plain English, no scripts for Conor.** Conor is not a developer and prefers not to run scripts himself. Automate anything recurring in the cloud, and tell him exactly what to click in a dashboard when needed.
6. **Flag conflicts.** Where this spec conflicts with how the app works today, flag it rather than silently redesigning.
7. **Legal figures are data.** Hour limits and similar rules must be configurable data, not hard-coded, and verified against official sources before go-live.

**Priority tags**

- **P0**: required now, before onboarding more customers.
- **P1**: within the next quarter, before scaling.
- **P2**: when larger customers ask, or revenue allows.

This spec is not legal advice. Contracts, policies and the DPIA need review by a data protection solicitor.

## Context and roles

Activity Roster (working name Bosun) is a staff-rostering and course-admin SaaS for RYA sailing and watersports schools and clubs, focused primarily on the UK (England, Scotland, Wales and Northern Ireland). UK law and the ICO are the baseline; Ireland and other qualifying jurisdictions are supported on top.

- **Stack:** built with Claude Code, hosted on Cloudflare (Workers or Pages, D1, R2), email via Resend. Claude Code should confirm the exact services in use.
- **Users:** school owners and admins, instructors and assistant instructors (some aged 15 to 17), and parents or guardians. Students do not log in. The platform holds emergency contacts but no medical data; adding medical fields later requires updating this spec and the DPIA first. Messaging is limited to group and rota announcements.
- **Laws that apply:** UK GDPR, the Data Protection Act 2018 and PECR (as amended by the Data (Use and Access) Act 2025). Also EU GDPR, Ireland's Data Protection Act 2018 and the ePrivacy Regulations 2011. Target coverage is every jurisdiction with more than 5 RYA clubs or training centres. Jersey, Guernsey, the Isle of Man, Gibraltar and every country outside the UK and Ireland have their own data protection and employment laws, so each needs its own check before launching there.
- **Processor role:** for each school's staff and student data, the school is the controller. Activity Roster is the processor and acts only on the school's instructions.
- **Controller role:** for its own customer accounts, billing, website visitors and the sales prospect list, Activity Roster is the controller.

**Data map (draft, Claude Code to confirm against the database)**

| Data | Examples | Controller | Sensitivity |
| --- | --- | --- | --- |
| Staff profiles | Name, contact details, date of birth, qualifications, availability | School | Standard; higher for under-18s |
| Parent and guardian accounts | Name, email, phone, linked child | School | Standard |
| Vetting status | DBS, PVG, AccessNI or Garda vetting status, date, expiry | School | High: store status only, never disclosure contents |
| Student and course records | Names, ages, bookings, progress | School | High where children are involved |
| Emergency contacts | Next-of-kin names and phone numbers | School | High: restricted access |
| Rota and time records | Shifts, actual hours, changes, cancellations | School | Standard; a legal record for young workers |
| Customer accounts and billing | School admin contacts, invoices | Activity Roster | Standard |
| Sales prospect list | School and club business contacts | Activity Roster | Standard (business-to-business) |
| Website analytics | Page views | Activity Roster | Low |

## Hosting, data residency and sub-processors

All personal data stays in the UK or EU, and every third party that touches it is listed and covered by a DPA.

- **Data location (P0):** set D1 to a western Europe location, using an EU jurisdiction setting where the account offers it. Create R2 buckets with the EU jurisdiction.
- **Resend (P0):** use an EU sending region if available. Confirm Resend's DPA and its legal mechanism for any US transfer.
- **Sub-processor register (P0):** keep `docs/subprocessors.md` listing name, purpose, data involved, location, DPA link and transfer mechanism. Expected entries: Cloudflare, Resend, Stripe, the backup email provider, error monitoring (if used) and the off-site backup provider.
- **GitHub holds code only (P0):** no production personal data in the repo, in logs committed to it, or on Conor's laptop.
- **Synthetic data (P0):** local and staging environments use generated test data, never copies of real school data.
- **Payments (P0):** use Stripe Checkout or Stripe Elements so card data never touches our servers. This keeps PCI DSS at the lightest level (SAQ A). Schools pay by card or direct debit, and the app stores only Stripe customer IDs, plan and payment status. A failed payment starts a grace period, then read-only access, never deletion; the emergency sheet stays available throughout.
- **Customer notice of changes (P1):** schools are told before a new sub-processor is added, as the DPA will require.

## Authentication and sessions

Admins must use two-factor login, and nobody should be locked out just because email is down.

- **Password storage (P0):** salted, slow hashing suited to Workers (Argon2id, bcrypt, or PBKDF2 at the highest iteration count Workers supports).
- **Password rules (P0):** minimum 12 characters, no forced complexity rules, and a check against breached-password lists (Have I Been Pwned range API).
- **Two-factor login (P0 for Owner and Admin, optional for others):** authenticator-app codes (TOTP) plus one-time recovery codes. Schools can choose to require it for other roles, such as the welfare officer.
- **Brute-force protection (P0):** rate-limit logins per IP and per account. Show Cloudflare Turnstile after repeated failures. Use generic error messages that never confirm whether an account exists.
- **Password reset (P0):** single-use links that expire within 60 minutes. A reset logs out all other sessions.
- **Change alerts (P0):** email the user whenever their password, email address or two-factor settings change, and when someone signs in from a new device or country. Repeated unusual sign-ins also alert Conor.
- **Session cookies (P0):** HttpOnly, Secure and SameSite=Lax.
- **Session timeouts (P1):** configurable idle timeout (default 30 minutes for admins) and an absolute timeout, plus a "log out all devices" button.
- **Shared-device mode (P1):** a short-session option for clubhouse computers and tablets.
- **Login choice (P0):** users choose password or magic-link login. Magic links are single-use and expire within 15 minutes. Prompt magic-link users to set a password too, so a Resend outage does not lock them out. Admins still complete two-factor login whichever method they use.
- **No support login (P0):** there is no feature for Conor to log in as, or view, a school's account. Support happens by screen share with the school in control. Conor's database access is used only for restores and incident handling, and each use is logged.
- **Single sign-on (P2):** optional Google or Microsoft login for larger centres.

## Access control and tenant isolation

One school must never see another school's data, and inside a school each role sees only what it needs.

- **Tenant ID everywhere (P0):** every table holding school data carries a `school_id`. All queries go through one data-access layer that enforces it. No raw queries in route handlers.
- **Server-side checks (P0):** check permissions on every endpoint and every record ID. Never rely on hiding buttons in the interface.
- **Isolation tests (P0):** an automated test suite creates two test schools. It proves users of School A cannot read, list, edit, export or guess the IDs of School B's records, for every endpoint. It runs on every deploy.
- **Unguessable IDs (P1):** use random IDs (UUIDs) for any record that appears in a URL.
- **Configurable roles (P1):** schools can adjust permissions, starting from the defaults below. Default to least access.

**Default permission matrix**

| Data | Owner / Admin | Welfare officer | Senior instructor | Instructor | Under-18 instructor | Parent / guardian |
| --- | --- | --- | --- | --- | --- | --- |
| Own profile, shifts and pay | Yes | Yes | Yes | Yes | Yes | Own account details only |
| Colleagues' names and shift times | Yes | Yes | Yes | Yes | Yes | No |
| Adult colleagues' phone and email | Yes | Yes | If colleague opts in | If colleague opts in | No | No |
| Under-18s' contact details | Yes | Yes | No | No | No | No |
| Children's bookings and course records | Yes | Yes | Own sessions only | Own sessions only | No | No |
| Emergency contacts | Yes | Yes | Own sessions only | Own sessions only | No | No |
| Consents for a child (photos, permission to work) | View status | View status | No | No | View own | Give and withdraw for own child |
| Others' pay rates | Yes | No | No | No | No | No |
| Vetting status | Yes | Yes | No | No | No | No |
| Bulk export and download | Yes | No | No | No | No | No |
| Audit log | Yes | Safeguarding events only | No | No | No | No |

## Data security and application hardening

The app must resist the common web attacks (the OWASP Top 10), and the most sensitive fields get an extra layer of encryption.

- **HTTPS only (P0):** Cloudflare "Always Use HTTPS", minimum TLS 1.2, and HSTS.
- **Extra encryption (P1):** encrypt emergency contacts and vetting details at application level with AES-GCM (WebCrypto). Keep the key in Cloudflare secrets.
- **Safe queries (P0):** parameterised D1 queries only (prepared statements with bind), never string-built SQL.
- **Input validation (P0):** validate every request body with a schema library such as Zod. Encode all output to block cross-site scripting.
- **CSRF protection (P0):** on every request that changes data.
- **Security headers (P0):** Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and frame-ancestors 'none'.
- **Rate limiting (P0):** on all API routes. Add Cloudflare Turnstile to public forms such as signup, demo requests and contact.
- **File uploads (P0):** allow-list file types and sizes, and scan every upload for malware before it is stored. Store files in a private R2 bucket and serve them through short-lived signed links, never public URLs.
- **Free-text fields (P1):** show a warning on notes fields not to record health, safeguarding or criminal information there.
- **Dependencies (P0):** keep a lockfile. Turn on Dependabot alerts plus GitHub secret scanning and push protection.
- **Cloudflare WAF (P1):** turn on managed firewall rules if the plan allows.
- **security.txt (P1):** publish `/.well-known/security.txt` with a contact address and a short vulnerability disclosure page.
- **Penetration test (P2):** an annual external test once revenue allows.

## Logging, monitoring and audit trail

Every sensitive action is recorded in a tamper-resistant audit log, and Conor is alerted when something looks wrong.

- **Audit log (P0):** an append-only table recording who, what, when, which record and from where (IP and device). It covers logins, failed logins, permission changes, views of sensitive records (under-18 contacts, emergency contacts, vetting), exports, deletions and any database-level access by Activity Roster.
- **School access to the audit log (P1):** admins can view and export their own school's audit log.
- **Clean application logs (P0):** no personal data, passwords, tokens or full request bodies in logs. Keep application logs for 30 to 90 days.
- **Alerts to Conor (P1):** email for everything, plus a text message for critical alerts: downtime, failed backups, failed deploys, suspected breaches or cross-school access, and mass exports. Use the uptime monitoring service's built-in text alerts where possible, to avoid adding another provider.
- **Error monitoring (P1):** use a tool such as Sentry with an EU data region and personal-data scrubbing turned on. Add it to the sub-processor register.

## Privacy features

School admins can handle any data request from inside the app, and data is deleted automatically when it's no longer needed.

- **Data request tools (P0):** admins can search for a person and export all their data (JSON and CSV). They can also correct it, freeze processing, or delete or anonymise it with linked records.
- **Deletion and backups (P1):** deleted data ages out of backups within the backup retention period (up to 12 months), and the privacy notices say so. Keep a log of deleted record IDs, and re-apply those deletions after any restore.
- **Retention settings (P1):** each school sets retention periods per data type: inactive staff, student records, rota history and audit logs. A scheduled job deletes or anonymises on time. Inactive staff profiles default to deletion 12 months after their last shift, so returning seasonal instructors are kept over winter. Each school can change this. Admins get a reminder 14 days before a profile is deleted, with an option to keep it. The 12 months applies to the profile only; rota and time records follow their own retention periods. Some records (incident reports, qualification logs, young-worker time records) may need longer periods, so defaults must be documented.
- **Consent records (P1):** separate, timestamped and withdrawable consents for photos and any optional data. Parent or guardian consent applies for under-18s where consent is the basis. Parents give and withdraw consent through their own account, and each record stores who gave it, when, and the exact wording shown.
- **Data minimisation (P1):** review every field. Make non-essential fields optional and remove ones nobody uses.
- **Privacy notices (P0):** link in-app to the school's own privacy notice and to the Activity Roster platform notice. Add a plain-English version written for 15 to 17-year-olds. Provide template privacy wording that schools can adapt for their staff, parents and students.
- **Terms acceptance (P0):** record which version of the terms and DPA each school accepted, and when.
- **Leaving schools (P0):** when a school cancels, a full export (data plus uploaded files) is available for 90 days, then everything is deleted from live systems. Backup copies age out within the backup retention period. The school gets written confirmation.
- **Cookies (P0):** the app uses strictly necessary cookies only. The marketing site uses cookieless analytics (Cloudflare Web Analytics), which avoids a consent banner in both the UK and Ireland. If any other tracking is ever added, use a banner with an equally prominent "Reject all", nothing pre-ticked, and a consent log.
- **Complaints route (P0):** a named privacy contact email (for example privacy@activityroster.com), used in the privacy notices, security.txt and a data protection complaints form, with acknowledgement within 30 days. This is a UK legal duty since 19 June 2026.

## Under-18 users and safeguarding

Instructors aged 15 to 17 are children under GDPR, so the platform applies higher-privacy defaults and supports each school's safeguarding duties. Use the UK Children's Code as the design baseline, plus Ireland's Fundamentals for a Child-Oriented Approach to Data Processing for Irish schools.

- **Automatic under-18 flag (P0):** date of birth is required on staff profiles. The flag is calculated from it daily and lifts automatically on the 18th birthday.
- **Hidden contact details (P0):** under-18s' phone, email and address are visible only to Owner, Admin and Welfare officer roles.
- **No private adult-to-minor messages (P0):** messaging stays limited to group and rota announcements. Do not add one-to-one messaging unless welfare-officer visibility and a copy-to-parent option are built at the same time.
- **Parent or guardian details (P0):** *Changed by Conor, 10 October 2026: parent accounts, parent approval and the parental-permission slot were removed (they were causing problems; consent paperwork is the centre's to keep). The parent or guardian contact stays on under-18 profiles as an emergency contact. Every other under-18 default in this section still applies.* Original brief: a required parent or guardian contact for under-18s. Store a record of written parental permission with an upload slot. This is required for under-16 employment in Ireland and for child employment permits in Northern Ireland. Parent accounts are linked to specific children by the school. They are used only to give or withdraw consents (photos and permission to work), and cannot see rotas, bookings or other records.
- **No marketing or profiling (P0):** no marketing, nudges, profiling or location tracking for under-18 users.
- **Photos off by default (P1):** under-18 profile photos are off by default and never shown outside the school's own account.
- **Vetting tracker for adults (P1):** DBS (England and Wales), PVG (Scotland), AccessNI (Northern Ireland) or Garda vetting (Ireland) status, date and expiry, with renewal reminders. Store the status only, never certificate contents, because that is criminal-offence data. Each school chooses at onboarding whether missing or expired vetting gives a warning or blocks rostering to sessions involving under-18s.
- **Qualification tracker (P1):** RYA instructor certificates, first aid, powerboat and safeguarding training, with expiry reminders. Each school chooses at onboarding whether an expired qualification gives a warning or blocks assignment to roles that require it.
- **Plain-English privacy explanation (P1):** written so a 15-year-old can understand what is held and who sees it.

## Working-time rules engine

> **Withdrawn by Conor, 10 October 2026.** Keeping to working-time law (young workers' and adults' hours, breaks, rest, term-time caps, permits and time registers) is the centre's responsibility as employer. The checks were getting in the way of rostering, so the rules engine, rule packs, term dates, breach settings and the young-worker time register were removed from the app. Instead, each person's rostered hours for the week show beside their name on the roster (People × days) and on Availability. The text below is kept as the original brief.

The rota builder checks every shift against the worker's age, the school's jurisdiction and whether the date falls in school term or holidays. What happens on a breach is a school setting (P0 for under-18s, P1 for adults).

- **School settings:** jurisdiction (any country or territory, chosen from a list) and editable school term and holiday dates. Each school also chooses what happens on a breach: warn only, block with admin override (reason written to the audit log), or block with no override. New schools default to block with admin override.
- **Worker settings:** date of birth and status (employee or volunteer), set per person by the school. Checks run for both statuses by default. Northern Ireland's child employment rules cover paid and unpaid work, so volunteer status never switches checks off there.
- **Rules as data:** store rules in a versioned table or JSON file that Conor can update without a code change. Each rule cites its legal source. Rules are grouped into one pack per jurisdiction, so new countries are added as data, not code. Where a school's jurisdiction has no verified pack yet, the rota shows a clear notice that young-worker checks are not active. Launch scope is a pack for every jurisdiction with more than 5 RYA clubs or training centres, from day one; Conor supplies the list. Each pack goes live only after its figures are verified against official sources, ideally by a local employment lawyer.
- **What is checked:** daily and weekly hours, earliest start and latest finish, breaks, daily rest, weekly rest, the annual holiday break and term-time caps.
- **When it checks:** when a rota is built, and when instructors swap or pick up shifts.
- **Time records:** store actual start and finish times for young workers, exportable as a register. Irish employers must keep these.
- **Change history:** timestamp when each shift was published, changed or cancelled. This helps with disputes and with upcoming shift-notice rules in Great Britain.
- **Disclaimer in the interface:** the checks are an aid, and the school remains legally responsible as employer.

**Default rules (verify every figure before go-live; "verify" marks ones not yet confirmed)**

| Rule | GB (England, Scotland, Wales), age 15 to school-leaving age | NI, age 15 to school-leaving age | UK, school-leaving age to 17 | Ireland, age 15 | Ireland, age 16–17 | Adults (UK / Ireland) |
| --- | --- | --- | --- | --- | --- | --- |
| Term-time hours | 12 h per week; max 2 h on school days and Sundays, 8 h on Saturdays | 2 h on school days and Sundays; weekly cap (verify) | 8 h per day, 40 h per week | 8 h per week | 8 h per day, 40 h per week | 48 h per week, averaged (UK workers can opt out) |
| School-holiday hours | 8 h per day Monday to Saturday, 2 h on Sundays, 35 h per week | 7 h per day, 37 h per week | 8 h per day, 40 h per week | 7 h per day, 35 h per week | 8 h per day, 40 h per week | 48 h per week, averaged |
| Permitted times | 7am to 7pm; max 1 h before school | Verify (believed 7am to 7pm) | No night work (verify exact window) | 8am to 8pm | 6am to 10pm (11pm if no school next day) | No limit |
| Breaks | 1 h after 4 h | 1 h after 4 h continuous work | 30 min if over 4.5 h | 30 min after 4 h | 30 min after 4.5 h | UK: 20 min if over 6 h. Ireland: 15 min after 4.5 h, 30 min after 6 h |
| Daily rest | Verify | Verify | 12 h | 14 h in every 24 | 12 h in every 24 | 11 h |
| Weekly rest | Verify | Verify | 48 h | 2 days in every 7 | 2 days in every 7 | 24 h per week (UK also allows 48 h per fortnight) |
| Annual break | 2 consecutive weeks off during school holidays | 2 weeks off during school holidays | None | 21 days off in the summer holidays | None | None |
| Paperwork | Council work permit applied for within 1 week of starting, plus parental consent | Written parental consent and an Education Authority child employment permit | None | Written parental permission, start and finish times, summary of the Act within 1 month | Start and finish times, summary of the Act within 1 month | None |
| Volunteers covered | Verify per council | Yes, paid or unpaid | Depends on worker status | Act is framed around employment; apply as best practice | Same as age 15 | Depends on worker status |

Great Britain's child employment figures come from council byelaws, which are near-identical across England and Wales; check Scottish councils separately. A child stays school-age until the last Friday in June of Year 11 in England and Wales, and Scotland has its own school-leaving dates. Verify each figure before go-live.

## Email (Resend) and the marketing tool

System emails must keep arriving even if a marketing campaign draws complaints, and the marketing tool must never touch school users' data.

**System email**

- **Domain authentication (P0):** SPF, DKIM and DMARC. Start DMARC at p=none with reports, then move to quarantine.
- **Separate subdomains (P0):** one for system email (for example `notify.activityroster.com`) and one for marketing (for example `news.activityroster.com`), each with its own Resend domain and API key.
- **Minimal content (P0):** no emergency contacts or under-18 contact details in emails. Link into the app instead.
- **Queue and retry (P1):** send through a queue (Cloudflare Queues) with retries and backoff. Show a failed-send list in the admin area.
- **Bounces and complaints (P1):** Resend webhooks suppress bad addresses and flag them to the school admin.
- **Backup email provider (P0):** put all sending behind one email interface, with a second provider set up now. Claude Code picks one with an EU region and a DPA (for example Postmark or Amazon SES) and adds its SPF and DKIM records. Sending fails over automatically when Resend errors.

**Marketing tool**

- **Separate data (P0):** prospect data lives in separate tables or a separate database. There is no code path from the marketing module to school users' data.
- **Business contacts only (P0):** send only to school and club business contacts. Never send marketing to platform users, and never to anyone under 18.
- **Every email (P0):** identifies Activity Roster, includes a postal address, and has one-click unsubscribe (List-Unsubscribe header).
- **Suppression list (P0):** unsubscribes are permanent and checked before every send.
- **Contact records (P1):** store each contact's source and the legitimate-interests basis. Flag sole traders and unincorporated clubs, where UK rules may require prior consent.

## Backups and disaster recovery

The target is to lose at most 24 hours of data in a worst case (minutes in most cases) and to be fully restored within one working day. Three backup layers get there, and at least one sits outside Cloudflare.

1. **D1 Time Travel (P0):** built in and always on. It restores to any minute in the last 30 days on the Workers Paid plan, or only 7 days on the free plan. Confirm the account is on Workers Paid.
2. **Nightly export to R2 (P0):** a scheduled Cloudflare Workflow exports D1 to a private, EU-jurisdiction R2 bucket, following Cloudflare's own backup guide. Keep 30 daily and 12 monthly copies, with lifecycle rules deleting older ones.
3. **Off-Cloudflare copy (P0):** each night, send an encrypted copy of the D1 export and all R2 uploaded files to a separate provider and account (Claude Code picks the simplest secure option with an EU region, object lock and a DPA, and records it in the sub-processor register). Use object lock or write-only credentials, so a compromised Cloudflare account cannot delete these backups.

**Supporting requirements**

- **Encryption key (P0):** backups are encrypted, and a copy of the key is kept outside Cloudflare in Conor's password manager.
- **Backup status email (P0):** a daily or weekly email to Conor confirming success or reporting failure.
- **Restore runbook (P0):** `docs/runbooks/restore.md` gives step-by-step instructions for three cases. These are (a) a Time Travel restore, (b) a restore from the R2 export, and (c) a rebuild into a fresh Cloudflare account from the off-site copy. Another developer must be able to follow it.
- **Quarterly restore test (P0):** restore into staging, check it works, and log the date, backup used, time taken and result in `docs/restore-tests.md`.
- **Code and config (P0):** the private GitHub repo is the source of truth, with branch protection on main. `docs/environment.md` lists every secret and environment variable by name (never value), where it comes from and how to rotate it.
- **DNS records (P1):** export the Cloudflare DNS zone file into the repo monthly.
- **Re-apply deletions (P1):** after any restore, replay the deletion log (see Privacy features).

## Safe change management with Claude Code

The most likely disaster is a bad change to the live database, so nothing reaches production without passing through staging and Conor's approval.

- **Three environments (P0):** local (synthetic data), staging (its own D1 database, R2 bucket and Resend test key) and production.
- **Branches and approval (P0):** Claude Code works on branches, and automated tests (including the tenant-isolation suite) must pass before anything reaches main. Small fixes merge automatically once tests pass: bug fixes, wording and styling that do not touch the database, login, permissions, security or personal data handling. Conor approves every database change, new feature, permission or security change, and new sub-processor before it merges.
- **Deploy from GitHub only (P0):** production deploys run from main through Workers Builds or GitHub Actions, never from a laptop.
- **Database migrations (P0):** use versioned migration files and test them on staging first. Record the Time Travel bookmark before running on production. Avoid destructive changes: add the new column, move the data, and remove the old column in a later release.
- **One-click rollback (P0):** document how to roll back to the previous Worker version from the Cloudflare dashboard.
- **Claude Code guardrails (P0):** Claude Code's settings require explicit approval for production-affecting commands, such as remote D1 execution, Worker deletion or R2 deletion. Production API tokens have the minimum permissions, and Claude Code never reads production data.
- **Rules in CLAUDE.md (P0):** write these rules into `CLAUDE.md` so every Claude Code session follows them.
- **Deploy window (P0):** production deploys run only between 11pm and 4am UK and Irish time, except urgent fixes. Approved changes queue until the next window. Automated smoke tests run after each deploy; if any fail, the deploy rolls back automatically and Conor is alerted.
- **Release notes (P2):** a short changelog of what changed in each release.

## Incident response and offline fallbacks

Schools must be able to run a safe session on the water even if the platform is down, and every incident follows a written plan.

**Offline fallbacks (P0, safety-critical)**

- **Daily rota digest:** off by default. Each school can switch on a morning email and PDF of the day's rota for its admins, and onboarding recommends doing so.
- **Emergency sheet:** a one-click printable PDF or CSV of today's staff on duty, students on courses and emergency contacts, for the clubhouse or safety boat. It is restricted to Admin and Welfare roles, logged in the audit log, and carries a handling warning.

**Monitoring and communication**

- **Uptime monitoring and status page (P0):** use an external service hosted off Cloudflare (for example Better Stack or UptimeRobot), so the status page stays up when the app is down.
- **In-app banner (P1):** Conor can switch on an incident banner without a deploy, for example through a flag in Cloudflare KV.
- **Maintenance page (P1):** a ready-made maintenance mode page.

**Incident runbook (P0):** `docs/runbooks/incident.md`, also kept in Google Drive and in print.

| Severity | Example | Response time | Customer communication |
| --- | --- | --- | --- |
| Critical | Data breach, cross-school data leak, full outage in season | Immediately | Status page within 1 hour, plus direct email to affected schools |
| Major | Login, rota publishing or email broken | Within 2 hours | Status page updates |
| Minor | A single feature bug | Next working day | Release notes |

**Data breach steps**

1. Contain the problem and preserve the evidence.
2. Assess what data, which schools and how many people are affected.
3. Notify affected schools without undue delay (target within 24 hours).
4. Support each school with its own decision on reporting to the ICO (or the Irish DPC) within 72 hours. Where the breach affects Activity Roster's own data (customer accounts, billing or the prospect list), Activity Roster is the controller and reports to the ICO itself within 72 hours if people are at risk.
5. Record every incident in an incident log, whether reported or not.

The runbook also holds customer message templates ("we're aware", "update", "resolved") and contacts for Cloudflare support, Resend support and the solicitor.

## Accessibility, AI features and other extras

These are the remaining items that customers, regulators or common sense will ask about.

- **Accessibility (P1):** meet WCAG 2.2 AA. Design mobile-first for instructors on the pontoon, with full keyboard navigation and colour never the only signal. Publish an accessibility statement. Parents do not book or pay online, so the European Accessibility Act's e-commerce rules are unlikely to apply for now. Revisit this if online booking is added.
- **AI features (none planned; rules for any future addition):** if Claude API or other AI features are added (for example suggested rotas), a human always approves the rota. Never allocate shifts based on personal traits or behaviour. Customer data is not used for training, and the AI provider goes on the sub-processor register. Check the EU AI Act high-risk rules before any AI-driven shift allocation or performance monitoring, as these can fall into that category.
- **Rule-based auto-rostering is fine (P2):** a scheduler that matches availability and qualifications by fixed rules is not an AI system in the legal sense, but keep it transparent and overridable.
- **Instructor-to-student ratio checks (P2):** configurable ratio limits per activity, taken from each school's own RYA operating procedures.
- **Spreadsheet import (P2):** CSV import for staff and students with validation, so schools do not email spreadsheets of personal data around.
- **Customer-facing security overview (P1):** a plain-English "Security and privacy" page on the website, drawn from `docs/security-overview.md`.

## Deliverables for Claude Code

Claude Code's work is done when every box below is ticked and each document exists in the repo.

**Build**

- [ ] Gap report against this spec (done / partial / missing, with file references)
- [ ] Phased P0 / P1 / P2 plan approved by Conor
- [ ] `CLAUDE.md` updated with the working rules and change-management rules
- [ ] Staging environment live with synthetic data
- [ ] Tenant-isolation test suite passing on every deploy
- [ ] Backup layers 1 to 3 live, with the status email
- [ ] First restore test completed and logged
- [ ] Audit log live
- [ ] Under-18 controls live
- [ ] ~~Working-time rules engine live, with rules stored as editable data~~ (withdrawn 10 Oct 2026)
- [ ] Email authentication done, with separate system and marketing subdomains
- [ ] Daily rota digest and emergency sheet live
- [ ] External uptime monitoring and status page live

**Documents in `docs/`**

- [ ] `security-overview.md`: customer-facing, plain English
- [ ] `subprocessors.md`: the sub-processor register
- [ ] `data-map.md`: a draft record of processing activities, built from the real database
- [ ] `retention.md`: default retention periods per data type
- [ ] `environment.md`: secrets and settings by name, never value
- [ ] `runbooks/restore.md` and `runbooks/incident.md`
- [ ] `restore-tests.md`: the restore test log
- [ ] Draft technical and organisational measures (TOMs) annex for the DPA, describing what is actually built, for solicitor review
- [ ] Draft DPIA, for Conor and the solicitor to complete

## Owner checklist (Conor, not Claude Code)

These tasks need a person, a signature or a solicitor, not code.

**Legal and admin**

- [ ] Solicitor review of the SaaS terms, DPA, privacy notices and cookie notice. The terms should state that customer data is never sold or used for any other purpose, set an uptime target (for example 99.5%), and say schools remain responsible for working-time compliance
- [ ] Pay the ICO data protection fee if the business trades from Northern Ireland or elsewhere in the UK
- [ ] Confirm where the company is registered. If it is in the UK, ask the solicitor whether an EU GDPR representative is needed for Irish and other EU customers
- [ ] Sign off the DPIA once Claude Code drafts it, and a written legitimate-interests assessment for holding the sales prospect list
- [ ] Accept the DPAs offered by Cloudflare, Resend, the backup email provider, GitHub, Stripe and the backup storage provider
- [ ] (No longer needed: working-time checks withdrawn 10 Oct 2026.) ~~Count RYA clubs and training centres per jurisdiction and give Claude Code the qualifying list (more than 5). Then get each rule pack verified: the Workplace Relations Commission (Ireland), the Education Authority (NI), GOV.UK (Great Britain), and official sources or a local lawyer elsewhere~~
- [ ] Cyber insurance and professional indemnity insurance
- [ ] Cyber Essentials certification (P1), then ISO 27001 or SOC 2 later if larger organisations or councils ask (P2)
- [ ] Add a contract clause on service levels and what happens if Activity Roster stops trading (notice period plus full data export)

**Accounts**

- [ ] Two-factor login (authenticator app or hardware key, not SMS) on Cloudflare, GitHub, Resend, the domain registrar, the password manager and email
- [ ] Print the recovery codes and store them somewhere safe offline. Keep every API key and secret value in the password manager
- [ ] Set up password manager emergency access for one trusted person
- [ ] Turn on domain auto-renew, add a backup payment card and set billing alerts
- [ ] Confirm Cloudflare is on the Workers Paid plan

**Continuity**

- [ ] Write an "if I'm unavailable" note: where everything is, who to call and how schools get their data
- [ ] Put a quarterly restore test in the calendar

**Reference links (starting points; check each before relying on it)**

- [Cloudflare D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)
- [ICO summary of the Data (Use and Access) Act 2025](https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-duaa-summary-of-the-changes/)
- [WRC poster: Protection of Young Persons (Employment) Act](https://workplacerelations.ie/en/publications_forms/protection_of_young_persons_employment_act_-_poster.pdf)
- [Protection of Young Persons (Employment) Act 1996, section 3](https://www.irishstatutebook.ie/1996/en/act/pub/0016/sec0003.html)
- [nibusinessinfo: employing workers of compulsory school age](https://www.nibusinessinfo.co.uk/content/employing-workers-compulsory-school-age)
- [Employment of Children Regulations (Northern Ireland) 1996](https://legislation.gov.uk/nisr/1996/477/made/data.html)
