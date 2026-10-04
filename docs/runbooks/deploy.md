# Runbook: deploying and rolling back

## Try a change on staging

Nothing to do. Every push to the working branch deploys to
https://staging.activityroster.com within about five minutes. Sign in there with the
staging centre you created; emails appear under Dev Center → Outbox (and in your inbox
if a staging Resend key is set).

## Build phase until 13 October 2026

Conor's decision, 4 October: there are no users until 13 October, so Claude Code presses
"Deploy production" itself after each green staging deploy and records the run in the log
below. From 13 October the rule under the next heading applies again: Conor tries the
change on staging and presses the button.

## Put a change into production (your approval)

1. GitHub → Actions → **Deploy production** → Run workflow → leave the branch as it is → Run workflow.
2. Wait for the green tick (about five minutes). The run summary shows the commit, the D1
   Time Travel bookmark taken before the deploy, and the tag created.
3. If the smoke test fails, the workflow rolls the Worker back to the previous version by
   itself and the run shows red. You get an email from GitHub.

What the run does: tests, build, records the restore point, applies any pending database
migrations, deploys, checks `/api/health`, the home page and `/login`, then tags the
commit and points `main` at it.

## Roll back the app (one click)

Cloudflare dashboard → Workers & Pages → **roster** → Deployments → find the previous
deployment → ⋯ → **Rollback**. Takes effect in seconds. This changes code only, not data.

## Roll back data (rare, talk to Claude Code first)

D1 Time Travel restores the whole database to a moment in the last 30 days. Each
production deploy's run summary carries the bookmark from just before it. Restoring
overwrites everything written since that moment, so it is a last resort; the restore
runbook (`docs/runbooks/restore.md`) covers the steps.

## If a migration fails

The run stops before deploying, so the live app keeps running the old code against the
old schema. Claude Code fixes the migration, pushes, you test on staging, then press
Deploy production again.

## Production deploy log

Each row is a "Deploy production" run Conor pressed. The bookmark is the D1 Time
Travel point taken immediately before that deploy; the workflow's run summary is
the source of truth and this table is a convenience copy.

| Date (UTC) | Commit | Bookmark | Contents |
|---|---|---|---|
| 2026-10-03 | 7c39fcd | (see run summary, tag `prod-20261003-1929`) | Password rule, strength meter, sign-out buttons, migrations 0040–0043 |
| 2026-10-03 | 7838db1 | `000001ca-00000000-000050f9-ff60ef9ec57b5ded297c390416b7680b` | **Failed and rolled back.** Smoke test got HTTP 403 from Cloudflare (Bot Fight Mode challenging the runner); production stayed on 7c39fcd. |
| 2026-10-03 | 0c414fa | `000001ca-00000000-000050f9-ff60ef9ec57b5ded297c390416b7680b` (unchanged: no writes since the attempt above) | Re-run after Bot Fight Mode was turned off; tag `prod-20261003-2107`. Turnstile, status page link, young workers' hours (migration 0044: `rule_pack`, `org_settings.working_time_mode`, `org_settings.term_dates`), email resilience code |
| 2026-10-03 | 5abdaf5 | `000001cc-00000000-000050f9-edc6c7028fc5cd52cd46b86339971da2` | Tag `prod-20261003-2321`. Migrations 0045–0048 (leaving timer, append-only log triggers, drop unused `booking`, rota template). Phase 1 close-out, verified GB working-time pack (16–17 from 16th birthday, no under-15s), rota PDF with template, dependency updates. Pressed to close incident INC-2026-10-03-1 (see below). |
| 2026-10-04 | a2928d7 | `000001cc-00000100-000050fa-3f4d08a7b9ebd4a1f8db56ce430b9222` | Pressed by Claude Code (build-phase arrangement). Migrations 0049–0055 applied; tag `prod-20261004-0244`; Worker version 61e7531b (previous 8df421f3). Contents: Phase 2 blocks A–G (person data rights, sessions and alerts, email queue, retention, status-only vetting, roles and parent accounts, public pages), sign-in by email with centre chooser, rota PDF day breakdown with styles and students column, blog expanded with matched covers, Dev Center navigation, "rota" vocabulary, deep-dive review fixes, Next.js 16.3.8. |
| 2026-10-04 | 0228ee1 | In the summary of Actions run 37173619934 (no migrations in this deploy) | Pressed by Claude Code (build phase). Tag `prod-20261004-0319`; Worker version c9dc2836 (previous 88e1db77). Website mobile and conversion pass: pricing cards aligned, amber colour scale restored app-wide, logo wordmark fixed, home and compare copy updated for the app, young workers, parent view and rota PDF, Learning Centre and demo fixed for phones. |
| 2026-10-04 | c206a26 | `000001d1-00000088-000050fa-a994ea9bd54551e42f6c2a4e57d95704` | Pressed by Claude Code (build phase). Run 37194597454; tag `prod-20261004-1014`; Worker version 197e71cc (previous cdb12f2f); no migrations. Contents: "roster" replaces "rota" everywhere a person reads it (office, app, parent view, PDF, emails, notifications, guides, website, blog); URLs and code names unchanged. |
| 2026-10-04 | 7bdf1aa | In the summary of Actions run 37199987412 | Pressed by Claude Code (build phase). Migration 0056 applied (new `trial_feedback` table, `organisation.trial_survey_sent_at`; additive); tag `prod-20261004-1151`; Worker version 33a0e7b6 (previous aa17da5c). Contents: trial-end survey (eight questions, another free month once per centre), banner, Billing card and one email, Dev Center → Trial feedback with contact filter and CSV, Learning Centre guide. |
| 2026-10-04 | 456e80b | In the summary of Actions run 37201985298 | Pressed by Claude Code (build phase). Migration 0057 applied (three nullable columns on `trial_feedback`; additive). Contents: Trial feedback detail page with an "Activate 30-day trial" button (removed again in the next deploy at Conor's request); question 7 optional. |
| 2026-10-04 | 9519f58 | In the summary of Actions run 37202423504 (no migrations in this deploy) | Pressed by Claude Code (build phase). Tag `prod-20261004-1234`. Contents: Trial feedback shows when the survey's extra month was activated and when it expires; the "Activate 30-day trial" button removed. |
| 2026-10-04 | f0a1833 | `000001d4-00000096-000050fa-fbf5c7380064ac7ae9aa8a66878d5be5` | Pressed by Claude Code (build phase). Run 37221816396; tag `prod-20261004-1748`; Worker version f27064cb (previous a734bd44); migration 0058 (cancelled sessions; additive). Also deployed the new `roster-tick` Worker (Cloudflare cron `5 * * * *`) with its secret. Contents: Phase 0 of the audit: roster wording, times shown as typed, Cloudflare scheduler, phantom pay lines, cancel workflow. |
| 2026-10-04 | 1d839f8 | In the summary of Actions run 37222793177 | Pressed by Claude Code (build phase). Tag `prod-20261004-1804`; migration 0059 (membership.features; existing admins → owner; legacy roles → instructor). Contents: Phase 1A: superadmin, office admins with feature toggles, office-access card, Dev Center superadmin transfer. |
| 2026-10-04 | 7909484 | In the summary of Actions run 37223613790 | Pressed by Claude Code (build phase). Tag `prod-20261004-1816`; migration 0060 (welfare_duty table; welfare officers, welfare duty pattern and parent-approval switch on org_settings; parent decision on guardian_link; city on trusted_device). Contents: Phase 1B–D: welfare officers and Welfare on Duty on the roster, parental approval before rostering an under-18, office users' security list with sign-out-everywhere, password strength meter, new-device check by device or city. |
| 2026-10-04 | 3c294eb | In the summary of Actions run 37224900093 | Pressed by Claude Code (build phase). Tag `prod-20261004-1836`; migration 0061 (availability_note table; availability.set_by; unique keys on availability after removing duplicates). Contents: Phase 2A: availability with no blank (Busy until marked Free or Maybe inside the window, not asked yet beyond it), usual week, day notes, office-entered availability, approved leave written as Busy, window length in Settings. |
| 2026-10-04 | 21a65a5 | In the summary of Actions run 37225661630 (no migrations in this deploy) | Pressed by Claude Code (build phase). Tag `prod-20261004-1848`. Contents: Phase 2B: problems service (dashboard, roster, digest, instructor app), re-validation when a session moves or is added, Busy-over-assignment notice to the office, qualification match at assignment and in both staff pickers. |
| 2026-10-04 | bc9197a | In the summary of Actions run 37226514681 | Pressed by Claude Code (build phase). Tag `prod-20261004-1901`; migration 0062 (org_settings.check_equipment_quantities). Contents: Phase 2C: one Staffing panel per course, editable course locations and equipment, equipment quantity check with a switch, delete-or-retire for locations, equipment, course types and instructors with collapsed Retired sections. |
| 2026-10-04 | ce6b62f | In the summary of Actions run 37227157791 | Pressed by Claude Code (build phase). Tag `prod-20261004-1910`; migration 0063 (pence columns on hours_record and pay_rate; approval snapshot and roster-changed flag on hours_record; org_settings.holiday_pay_percent; unique keys on course_staff and hours_record after removing duplicates). Contents: Phase 2D: rate changes applied to unapproved lines from a date, approved lines flagged when the roster changes, volunteers hidden from payroll, period summary, optional holiday pay, duplicate assignments refused. |
| 2026-10-04 | 3bb3bf0 | In the summary of Actions run 37227451786 (no migrations in this deploy) | Pressed by Claude Code (build phase). Tag `prod-20261004-1916`. Contents: Phase 2E: role-by-route test (every office entry point must carry its permission), end-to-end lifecycle test with times as typed. Phase 2 complete. |

### Cloudflare "Workers Builds" must stay disconnected

Cloudflare's Git integration (Workers & Pages → roster → Settings → Build) builds and
deploys the Worker itself on every push to the connected branch. It does **not** run the
D1 migrations, so the moment a push adds a column, production code and production data
disagree. It was found connected on 3 October and disconnected the same night (incident
INC-2026-10-03-1 in `docs/incident-log.md`). Only the GitHub workflows deploy. If a
`Workers Builds` check ever reappears on a commit in GitHub, someone has reconnected it:
disconnect it again before anything else. The read-only `Probe production` workflow
(Actions → Probe production → Run workflow) prints status codes and the built file names
for production and staging; identical names on both while GitHub has not deployed is the
tell-tale.

## Bot Fight Mode breaks the deploy checks

The smoke tests fetch `/api/health`, the home page and the sign-in page with `curl`
from a GitHub runner. Cloudflare's **Bot Fight Mode** treats that as an automated
visitor and answers 403 with `cf-mitigated: challenge`, so every deploy fails its
check and production rolls back. The same happens to external uptime monitors.
Keep Bot Fight Mode **off** (Security → Bots). Bots are handled by Turnstile on the
public forms and sign-in, the per-IP rate limits, and Cloudflare's always-on DDoS
protection and managed rules. The workflow now says so in plain words when it sees
the challenge header.

## Cloudflare WAF managed rules (one-off, your clicks)

The Worker already rate-limits sign-in and the public forms, validates every input and
sets strict security headers. Cloudflare's managed firewall rules add a layer in front
of all that for known attack patterns (SQL injection probes, path traversal, exploit
scanners). They are free on the current plan and take two minutes:

1. Cloudflare dashboard → the domain → **Security → WAF → Managed rules**.
2. Turn on **Cloudflare Managed Ruleset**. Leave its action on the default (block).
3. Turn on **Cloudflare OWASP Core Ruleset** with the paranoia level at **PL1** and the
   score threshold at **Medium**. Start with the action set to **Log** for a week.
4. After a week, open **Security → Events**, filter to the OWASP rule, and check that
   nothing genuine was logged (expect nothing from `/api/webhooks/stripe`, sign-in, the
   office or the portal). Then switch the OWASP action to **Managed Challenge**.
5. Leave **Bot Fight Mode off** (see above); the managed rules do not challenge the
   deploy checks or the uptime monitor the way Bot Fight Mode did.

If a centre ever reports being blocked, the event is in Security → Events with the rule
id; tell Claude Code the id and the path and the rule can be excluded for that path.

## Dependency updates (Dependabot)

Dependabot opens pull requests against the working branch every Monday, plus
security fixes as they appear. Conor does not merge them by hand:

- Claude folds the safe ones (patch and minor versions, tooling, GitHub Actions)
  into the working branch with the tests run, so they reach staging and then
  production through the normal deploy. Dependabot closes its own pull request
  once the branch already carries the update.
- Major versions (a new Next.js, Tailwind, Zod and the like) are planned as
  their own piece of work, never merged from the bot. Until then the open pull
  request is left alone or told to ignore that major version.
- `npm audit` findings that only affect build or test tooling (not the deployed
  Worker) are noted here and fixed when the major update happens.

As of 3 October 2026 the remaining audit findings are all build-time
(Tailwind 3's file watcher, Next 15's bundled PostCSS, drizzle-kit's bundler);
none ship in the Worker. They clear with the Tailwind 4 and Next 16 upgrades.
