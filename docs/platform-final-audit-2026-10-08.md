# ActivityRoster: final full platform audit

8 October 2026 · code at `df874ed` (production is `4c7f998`) · read-only: no code or design was changed

## Headline

**Final score: 7.5 / 10. Recommendation: NOT READY — FIX BLOCKERS FIRST.** There are three blockers. All three are small and well understood, about a day's work together. Once they're fixed: **READY TO LAUNCH WITH CONDITIONS**.

The three blockers:

1. **Cancelling a session can still pay it.** If the office had edited the pay on a line, cancelling with "pay nothing" keeps the old amount. Tested: £75 still paid, with the note "not paid".
2. **Adding someone for a single day skips the safety checks.** Tickets, qualifications, parental permission and young workers' hours are all skipped. Tested: a 16-year-old was blocked on the whole course for lack of a parent's permission but allowed on a single day.
3. **Changing a session's times after people are rostered never blocks.** A young worker's legal limit can be broken even when the centre chose "block outright". Tested: 14 hours rostered against an 8-hour limit.

The rest of the platform is in good shape. Centre separation is the strongest part: nothing found in code, tests or attacks. Sign-in, the change log, the roster outputs and payroll rebuilds held up under deliberate duplicate and parallel requests.

The full required output (verdict, scores, issue lists, top 10, RYA readiness, launch verdict, manual tests, recommendation) is at the end, in Part Z and sections 1–10.

---

## How this audit was done, and its limits

**Four kinds of evidence**, named in every answer:

- **Code**: the implementation read line by line: all 243 server actions, 39 API routes, the services, the domain rules, the schema and its unique keys, the auth layer, the background jobs and the CI and deploy workflows.
- **Probe**: a throwaway test run against a real SQLite database through the real services, to show what actually happens. 15 probes were run (P1–P15). They covered:
  - duplicate and parallel submissions
  - two admins at once
  - cancellations
  - per-day staffing
  - young workers' hours
  - attempts to reach another centre's data
  - PIN lockout under parallel guesses
  - payroll rebuilds
  - breaks
  - impossible dates

  The probe file is not committed; its results are quoted below.
- **Browser**: the real app run locally with a busy demo centre (18 staff, 48 sessions a week).
  - Every office page and export was opened directly as an instructor and while signed out.
  - Office pages were screenshotted at laptop (1360 px) and phone (390 px) widths.
- **Suite**: the existing automated tests: 117 files, 499 tests, all passing at `df874ed`.

**Limits:**

- **No real phones.** Face ID, push and the offline week were judged from code and the existing tests, not on an iPhone or Android device.
- **No production traffic.** Load and Cloudflare limits were judged from query shapes, not measured.
- **No live email provider or Stripe.**
- **Two-admin races** were simulated with parallel calls in one process. Real D1 has more latency between steps, which makes races more likely, not less.

These limits are collected in section 9, "Manual testing still required".

**Status used for every question:**

- **Working**: works correctly, checked.
- **Partial**: works for the main case, with a named gap.
- **Not enforced**: the rule exists but can be bypassed in a normal flow.
- **Missing**: not built.
- **Manual**: can't be confirmed from code or probes alone.

**Priority:** P0 = must fix before real centres rely on it · P1 = important before or early in real use · P2 = before scale · P3 = later.

---

## Issue register

Every issue found, numbered F01–F39, in priority order (F37–F39 were added while writing and sit after the P3 table). The question tables refer to these numbers. Each entry gives the problem, why it matters, the exact location, the fix and the priority.

### P0: blockers

**F01. Cancelling a session leaves an edited pay amount in place.**
- **Problem:** cancellation writes the old pounds column (`overridePay`) but not the pence column. Payroll reads the pence column first. So a line the office had edited before the cancellation keeps paying the edited amount, while its note says "Session cancelled: not paid". The same applies to the "cancellation fee" rule and to restoring a session.
- **Evidence:** Probe P1. A £75 edited line still showed £75 after "pay nothing".
- **Why it matters:** silent overpayment, with a note that contradicts the figure.
- **Where:**
  - `lib/services/cancel.ts`, the pay-rule block in `cancelSessions` and the record loop in `restoreSessions`
  - `lib/services/finance.ts:251`, which reads pence first
- **Fix:** one helper that sets both columns together (pounds × 100 → pence), used by cancel, restore and the payroll edit. Add a test for "edited, then cancelled".
- **Priority:** P0.

**F02. Adding someone for one day skips most of the safety checks.**
- **Problem:** `setDayStaff` with "add" only checks availability and clashes. It skips:
  - mandatory tickets (first aid, DBS)
  - qualification for the course type
  - parental permission for under-18s
  - young workers' hours, including "block outright" mode
- **Evidence:** Probe P4. A 16-year-old with no parental permission was refused on the whole course but accepted for a single day. The problems list then showed "parent-approval" as blocking.
- **Why it matters:** per-day staffing is how camps and multi-day courses are run, so this is a normal path round the checks, not an edge case.
- **Where:** `lib/services/session-staff.ts`, `setDayStaff` (the `input.mode === "add"` block).
- **Fix:** move the candidate checks out of `assignStaff` into one shared function that takes the sessions being staffed. Use it for whole-course and one-day assignments alike, with the same override and "no override" rules.
- **Priority:** P0.

**F03. Editing a session after people are rostered never blocks, even against legal limits.**
- **Problem:** these actions save first and only list problems afterwards:
  - `updateSessionTimesAction` (move a session, change its times)
  - `addSessionAction` (add a day to a staffed course)

  So the edit can create a double-booking, a Busy slot, or a young worker over their legal hours. That happens even when the centre chose "block outright".
- **Evidence:** Probe P5. A 16-year-old went from 3 to 14 hours on a day with an 8-hour limit. The same shift assigned fresh was refused even with an override.
- **Why it matters:** the young-worker limits are law. "Block outright" is the centre's explicit choice, and the platform says it is enforced.
- **Where:** `app/(app)/office/courses/actions.ts`, `updateSessionTimesAction` and `addSessionAction`.
- **Fix:** before writing, run the working-time and clash checks for everyone on the course against the new times.
  - "Block outright" mode: refuse, naming the people.
  - Block-unless-overridden mode: ask for an override note.
  - Then save the session, pay lines and change log in one batch.
- **Priority:** P0.

### P1: important before or early in real use

**F04. Ratio and safety cover are worked out three different ways.**
- **Problem:** the roster and Today strip judge cover per session, honouring per-day changes. The problems list, the dashboard's "Courses to cover" tile, the digest and the course card judge it per course. The course card also counts people who declined, and the problems list reports a course once, against its first day.
- **Evidence:**
  - Probe P6: safety-boat driver taken off day 2. Roster: "no safety cover"; problems list: nothing.
  - Probe P10: safety-boat driver declined. Roster: no cover; course card: "covered".
  - Probe P11: one person in three roles. Roster: not covered; problems list: fine.
- **Why it matters:** the problems list is meant to be the one place to look, and it is silent about a day with no safety boat.
- **Where:**
  - `lib/services/problems.ts:183-199`
  - `coverageProblems` in `lib/domain/problems.ts:198`
  - `getCourseEditorData` in `lib/services/course-editor.ts:87-99`
  - `coverageOf` in `lib/services/schedule.ts:130`
- **Fix:** one function, cover for a session from its effective staff (declined people out, each person counted once), used by every screen and report. Report each uncovered day, not each course.
- **Priority:** P1.

**F05. Notifications ignore per-day staffing.**
- **Problem:**
  - Someone added for one day is not told when the week is published or when that day is cancelled.
  - Someone taken off a day is still told about that day's cancellation and time changes.
  - "You're on N sessions" counts the course-level sessions.
- **Evidence:** Probe P7.
- **Why it matters:** people turn up for cancelled sessions, or don't know about shifts.
- **Where:**
  - `lib/services/roster.ts:66-79` (publish)
  - `lib/services/cancel.ts:106-116`
  - `app/(app)/office/courses/actions.ts:348-350` (move)
- **Fix:** take recipients from the effective staff of the affected sessions, which already exists as `effectiveStaffBySession`.
- **Priority:** P1.

**F06. A new centre starts with the main safety checks switched off.**
- **Problem:** new centres start with:
  - ratio and safety-boat checks off
  - ticket expiry checks off

  Neither the onboarding wizard nor the setup checklist mentions them. The homepage and the Courses page say qualifications, ratios and safety-boat cover are checked as you schedule. A centre can therefore look ready while unstaffed courses and expired first aid raise nothing.
- **Why it matters:** this is the product's main promise, and the claim on the website isn't true by default.
- **Where:**
  - `lib/seed/seed.ts:28-35`
  - defaults in `lib/db/schema/tenant.ts:116-125`
  - `components/office/OnboardingWizard.tsx`
  - `lib/services/setup.ts:37-41`
- **Fix:** switch ratio, safety-cover and ticket checks on for new centres, or ask in the wizard with "on" pre-selected. Add "Choose your safety checks" to the setup checklist.
- **Priority:** P1.

**F07. PIN lockout can be bypassed with parallel guesses.**
- **Problem:** the PIN check reads the failure count, checks the PIN, then writes count + 1, as separate steps. Guesses sent at the same time all read the same count.
- **Evidence:** Probe P12. 40 wrong guesses in parallel were all checked, the stored count was 1, and the account never locked.
- **Why it matters:** the PIN protects idle sessions and the step-up before exports. With a stolen session, the 10,000 possible PINs fall in hours, not never.
- **Where:**
  - `app/pin/actions.ts`, `verifyPinAction` (lines 211-243) and `stepUpWithPinAction`
  - `ControlPlaneRepository.recordPinFailure`
- **Fix:** one atomic statement (`UPDATE … SET pin_failed_count = pin_failed_count + 1 … RETURNING`) that decides the lock from the returned count. Also put the D1 per-user limit (already used for sign-in) in front of the check.
- **Priority:** P1.

**F08. Nobody is told if the hourly job stops.**
- **Problem:** the hourly job runs:
  - email retries
  - the morning digest
  - data retention deletion
  - leaving reminders
  - invite reminders
  - the trial survey

  No heartbeat is recorded or checked. A failing job only appears in Cloudflare's logs, and sweep errors only in `console.error`.
- **Why it matters:** retention is a legal duty. If both schedulers stop, nothing alerts.
- **Where:**
  - `workers/tick/index.ts`
  - `app/api/outreach/tick/route.ts`
  - `lib/services/retention.ts:233`
- **Fix:**
  - Record the time of the last good tick and each sweep's error count, and show both in the Dev Center.
  - Email Conor if there's been no tick for 3 hours, or a sweep errors two runs in a row. A Better Stack heartbeat monitor works with no code.
- **Priority:** P1.

**F09. Marking someone as left keeps them on future sessions without a word.**
- **Problem:** their app access is suspended, but their future assignments stay, still counted as cover. There's no warning at the time and no problem raised.
- **Why it matters:** the roster shows cover that won't happen.
- **Where:**
  - `app/(app)/office/staff/actions.ts:317-331`
  - `lib/services/problems.ts`, which has no status check
- **Fix:**
  - On "mark as left", list their future sessions and offer to take them off. Use the normal removal path, so staff are told and pay lines follow.
  - Add a "left but still rostered" problem.
- **Priority:** P1.

**F10. Qualification checks are too permissive for an RYA centre.**
- **Problem:** three gaps.
  - **Expired instructor qualifications still count.** An expired Dinghy Instructor still "can teach", because the teaching check ignores qualification expiry. Only checks such as first aid and DBS expire, and only when ticket checks are on.
  - **Nothing on file means no check at all.** Someone with no qualifications recorded passes every course type.
  - **Roles carry no qualification requirement.** An Assistant Instructor can be put in a lead role, and anyone can be the Safety Boat Driver without a powerboat or safety-boat qualification.
- **Why it matters:** this is the RYA-specific value of the product.
- **Where:**
  - `lib/services/teaching.ts`
  - `qualificationGap` in `lib/services/problems.ts:236`
  - `lib/seed/catalogue.ts`
- **Fix:**
  - Ignore expired qualifications in the teaching check.
  - Warn on "no qualifications on file" when ticket checks are on.
  - Let each role name the qualifications it needs, with sensible RYA defaults: Safety Boat Driver needs Powerboat Level 2 plus Safety Boat; lead roles need Dinghy Instructor or Senior Instructor for the discipline.
- **Priority:** P1.

### P2: before scale

| # | Problem | Why it matters | Where | Fix | P |
|---|---|---|---|---|---|
| F11 | The same person can be on one session in two or three roles (Instructor, Senior, Safety Boat), and the course-level checks count them more than once. | One person "covers" a ratio of two and the safety boat (Probe P11). | `lib/services/assignment.ts:163`, `lib/domain/ratio.ts:44` | Count each person once; allow a second role only through an explicit "also safety cover" choice. | P2 |
| F12 | Lunch breaks are worked out per session, not per day. Two sessions totalling 7 hours get no break. | Wrong pay and a missed legal break (Probe P14). | `lib/services/finance.ts`, `applyBreak` per line | Apply the break rule to each person's day. | P2 |
| F13 | Impossible dates (`2026-02-31`) pass validation everywhere. A session edited to one keeps the text date but its time becomes 3 March, so it disappears from the roster. | Invisible sessions and wrong pay dates (Probe P9). | `lib/validation/actions.ts:10`, `updateSessionTimesAction` | Validate a real calendar date: parse it and compare it back. | P2 |
| F14 | Changing a session's times, adding or removing a session, and removing staff aren't all-or-nothing, and session edits have no "someone else changed this" check. | A bad connection can leave pay lines out of step; one admin's change can overwrite another's. | `app/(app)/office/courses/actions.ts` | Batch them like assignments; add `expectedVersion`. | P2 |
| F15 | Marking a whole week Busy (copy week, mark week) or a usual-week Busy doesn't alert the office; a single slot does. The single-slot alert reads every session and ignores per-day staffing. | The office may not hear about a gap until it looks. | `app/(app)/portal/availability/actions.ts` | Run the same office alert for bulk and usual-week changes; make it per-day aware and date-bounded. | P2 |
| F16 | The parent view shows weeks that aren't published yet and ignores per-day staffing. | Parents see drafts and the wrong days. | `app/(app)/parent/page.tsx` | Use the instructor's effective sessions and published weeks only. | P2 |
| F17 | Push notifications keep reaching a phone after sign-out, after "sign out everywhere" and after removal from a centre. Tokens are only removed when notifications are switched off in the app's settings. | Roster details on a phone the person no longer controls. | `lib/mobile/native.ts`, `app/(app)/security/actions.ts`, `lib/services/notifications.ts` | Delete the device token on sign-out; delete all tokens on sign-out-everywhere and suspension; skip pushes for people marked as left. | P2 |
| F18 | Only the whole-centre and per-person exports ask for the PIN again. These don't, though each view is logged: emergency sheet (emergency and guardian contacts), young-worker register, payroll spreadsheet, change-log export. | Sensitive data on an unattended screen. | `app/api/office/*` | Require a fresh step-up on those routes too. | P2 |
| F19 | Retention sweep failures only go to logs. The weekly expiry digest can skip a Monday, because the daily run drifts an hour later each day. | A legal deletion can stop unnoticed; admins miss a digest. | `lib/services/retention.ts:224-235` | Record failures in the Dev Center; key the digest on the date, not "24 hours since". | P2 |
| F20 | Some reads grow with years of history: the change-log page loads the whole log; the leave page, office availability actions, instructor app home, publish, emergency sheet, parent view and time clock read whole tables; "Refresh from roster" re-syncs every course in one request. | Slow pages after a few seasons, and possibly over D1's queries-per-request limit. | See question 253 | Bound by date and paginate; batch the rebuild. | P2 |
| F22 | On a 1360 px laptop the roster board cuts names and roles to "El… I…". | The most-used screen can't show who is on what at a glance. | Roster board (`/office/rota`) | Wider columns or names on two lines; short role badges; collapsible sidebar. | P2 |
| F23 | The second-step hint at sign-in answers for any email without sign-in: whether 2FA is on, plus a masked address. Limited to 20 per minute per network. | Lets someone check which emails have accounts. | `app/(app)/sign-in/actions.ts` | Answer only after a correct password, using Better Auth's pending two-factor state. | P2 |
| F24 | Anyone can create an unverified password account for someone else's email (the app sign-up is public). If that person later signs in by emailed link or code, the account becomes verified and the stranger's password may then work. The PIN and new-device email code reduce the risk. | Account pre-hijacking. | `app/api/auth/[...all]` | When a link or code verifies an account whose password was never verified, clear that password. Needs a manual test (section 9). | P2 |
| F32 | No end-to-end browser test runs in CI. The core typecheck skips `app/` and `components/` (the Next build covers them). | Screen-level breakage (like the 5 October course page crash) only shows after deploy. | `.github/workflows/ci.yml` | A small Playwright smoke test against a seeded local build. | P2 |
| F35 | Publishing, cancelling and other notifications go out one person at a time inside the request (database write, push, email). | A 100-person week publish takes a long time and could hit request limits. | `lib/services/roster.ts`, `lib/services/notifications.ts` | Write the in-app notices in one batch; queue the push and email. | P2 |

### P3: later

| # | Problem | Where | Fix |
|---|---|---|---|
| F21 | The Courses page's dates render differently on the server and in the browser ("Mon 13 Jul" vs "Mon, 13 Jul"), so the whole list is redrawn on load. | `components/office/CourseCard.tsx:28` | Format dates once, on the server. |
| F25 | Non-sign-in rate limits (billing setup, checkout, public forms) count in KV with read-then-write, so parallel requests can go over. | `lib/security/rate-limit.ts` | Use the D1 counter where it matters. |
| F26 | The hourly job's secret is also accepted in the URL (`?secret=`), so it can end up in logs. | `lib/security/cron-secret.ts` | Header only. |
| F27 | A published week can't be unpublished. | `lib/services/roster.ts` | Add unpublish (with a notice). |
| F28 | A course whose location has been retired raises no warning. | `lib/services/retire.ts`, problems | Add a problem, or prompt to replace the location. |
| F29 | Cancellations notify staff even for unpublished weeks, while restores only notify for published ones. | `lib/services/cancel.ts` | Same rule both ways. |
| F30 | Approving leave doesn't show the person's existing sessions in that period; declining after approval leaves the Busy marks behind. | `lib/services/leave.ts` | Show the clash at approval; clear leave-set Busy when declined. |
| F31 | Instructors can still change availability for earlier days of the current week. | `lib/domain/availability.ts:61` | Window starts today, not Monday. |
| F33 | Ownership transfer is two separate writes. | `ControlPlaneRepository.transferOwnership` | One batch. |
| F34 | A corrected pay rate uses the course-level role only, so people added for one day get the default rate; changing someone's role doesn't re-price their line. | `lib/services/hours.ts` | Price from the effective role per session. |
| F36 | On a phone, the Courses page header buttons wrap untidily. | `app/(app)/office/courses/page.tsx` | Stack the header on small screens. |

---
Added during writing:

| # | Problem | Where | Fix | P |
|---|---|---|---|---|
| F37 | Overriding a check from the course card's "Assign" form doesn't require a reason. The board, the per-day panel and bulk assign all do. Who overrode, and when, is still recorded. | `app/(app)/office/courses/actions.ts:421-437` | Require the note, as the other paths do. | P2 |
| F38 | When someone is taken off a course, a pay line the office had already edited (minutes or pay) is kept as payable and isn't flagged. Only approved lines get "roster changed". | `lib/services/hours.ts`, "people no longer on the course" loop | Flag kept lines the same way as approved ones. | P2 |
| F39 | Weather cancellation is per course or day: there's no "cancel everything this afternoon" across courses. | `lib/services/cancel.ts`, Courses / roster | A "Cancel a slot" action: choose a date and slot, then all its courses with one reason and pay rule, one notice per person. | P2 |

---

## Part A. Real centre operations

### A1. First login and setup

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 1 | Does a new centre know what to do? | 8 | Working | Code + Browser. A five-step wizard (how you run, courses, team, roster PDF, finish), then a dashboard checklist and "Next: build your first week". |
| 2 | Configurable without docs or a developer? | 8 | Working | Code. Everything is editable from Settings tabs and Course setup, with a guide link on every page. |
| 3 | Is the setup order logical? | 8 | Working | Code. Courses → team → roster style; the checklist runs staff → course → roster → pay rates → app invite. |
| 4 | Required steps clearly separated from optional ones? | 6 | Partial | Code. The wizard marks optional features. The safety checks (tickets, ratio, safety cover) are presented as neither required nor optional: they're simply off (F06). |
| 5 | Can a centre look ready while important configuration is missing? | 4 | Not enforced | Code (`lib/seed/seed.ts:28-35`, `setup.ts:37-41`). The checklist can show 100% with ratio, safety-cover and ticket checks off, so unstaffed courses and expired first aid raise nothing (F06). |
| 6 | Does setup configure staff, courses, locations, kit, checks, payroll and permissions? | 6 | Partial | Code. Staff, courses, slots, roster PDF and features are set. Checks are not asked about (F06). Pay rates are a checklist item. Office permissions are set later in Staff → Office access. |
| 7 | Clean recovery if setup is abandoned? | 7 | Partial | Code. "Skip for now" works and the dashboard checklist persists. Whether a half-completed wizard step keeps its answers wasn't verified in a browser (Manual). |
| 8 | Safe to change configuration once real data exists? | 8 | Working | Code + Suite. Deactivate-never-delete, delete-or-retire for locations and kit, checks apply live. Changing course-type defaults doesn't rewrite existing courses (by design). |

### A2. The daily workflow (08:00 → payroll)

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 9 | Can the whole daily workflow happen inside the platform? | 8 | Working | Browser. Today strip → availability grid → board → publish → app → cancel → payroll, all present. Students and bookings stay in the centre's booking system (by design). |
| 10 | Is the right information available at each stage? | 7 | Partial | Browser + Probe P6. Mostly yes, but per-day cover appears on the roster and not in the problems list (F04), and the instructor app doesn't show equipment. |
| 11 | Is information entered once and reused? | 8 | Working | Code. Courses, staff and rates feed the roster, app, PDF, emergency sheet, digest and payroll from the same rows. |
| 12 | Does a change in one place update everything that depends on it? | 6 | Partial | Probes P6, P7, P10. Per-day changes don't reach cover checks, notifications or the parent view (F04, F05, F16); marking someone as left doesn't touch their sessions (F09). |
| 13 | Anywhere the admin must remember to update another screen? | 6 | Partial | Code. Marking someone as left (F09). Cancelling a day where someone was added for that day only (F05). Re-checking a course after a time change: the warning appears, but the fix is manual (F03). |
| 14 | Does the platform allow obviously invalid operational states? | 5 | Not enforced | Probes P4, P5, P11. A 16-year-old without permission can be added for a day; 14h for a 16-year-old after a time edit; one person as instructor and safety boat at once (F02, F03, F11). |
| 15 | Does the platform clearly say what needs attention? | 7 | Partial | Browser. Dashboard tiles and a problems list with reasons. Gaps in what the list contains (F04, F09). |

## Part B. Dashboard and problems

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 16 | Does the dashboard answer who's working, what's uncovered, who's unavailable, what changed, what needs action? | 7 | Partial | Browser. Today strip (sessions, people, covered, dropped out, unconfirmed) and attention tiles. "What has changed since you last looked" isn't shown. |
| 17 | All important operational problems in one place? | 6 | Partial | Code + Probe P6. Clashes, Busy, leave, declines, tickets, qualifications, young workers, permission, cover and kit are all listed. Per-day cover, left staff and inactive locations are missing (F04, F09, F28). |
| 18 | Can a problem exist without appearing on the dashboard? | 4 | Not enforced | Probe P6. A day with no safety boat, after a per-day change, isn't in the problems list. With ratio checks off (the default) no cover problem is listed at all (F04, F06). |
| 19 | Does resolving a problem remove it automatically? | 9 | Working | Code. Problems are worked out fresh on every page load (`findProblems`); nothing is stored to go stale. |
| 20 | Does a new problem appear straight away? | 9 | Working | Code. Same as 19, plus the edit messages ("Session updated. ⚠ 2 problems…"). |
| 21 | Are problems prioritised correctly? | 8 | Working | Code. `sortProblems` puts blocking first, then warnings, by date. |
| 22 | Can the admin understand why it's a problem? | 8 | Working | Browser. Each row carries a plain reason, e.g. "Marked this slot Busy", "Needs safety-boat cover and nobody is rostered for it". |
| 23 | Can the admin resolve it straight from the list? | 6 | Partial | Browser. Rows link to the course or day; the fix happens there. No one-click "find cover" from the row. |
| 24 | Are cancelled courses, missing qualifications, unavailable staff, kit clashes, shortages and declines handled consistently? | 6 | Partial | Probes P6, P10. Cancelled sessions are excluded everywhere, but cover is judged three different ways (F04). |
| 25 | Are stale or resolved problems ever left behind? | 9 | Working | Code. Nothing is stored (see 19). |

## Part C. Courses and course types

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 26 | Can every common sailing-school course be created? | 8 | Working | Code. The RYA catalogue covers youth and adult dinghy, windsurf, powerboat, keelboat, cruising and shorebased; custom course types too. |
| 27 | Single-day, multi-day and recurring? | 9 | Working | Code + Suite. Multi-session builder, recurring builder, set times or slots. |
| 28 | Can single sessions be changed safely? | 5 | Not enforced | Code + Probe P5. They can be changed, but an edit never blocks a breach (F03) and isn't all-or-nothing (F14). |
| 29 | Dates, times, locations and kit changeable after creation? | 8 | Working | Code. Each is editable from the course page; locations and kit have the stale-edit check. |
| 30 | Do changes trigger every required validation? | 5 | Not enforced | Probe P5. Checks re-run and are shown, but don't block (F03). |
| 31 | After a change, are availability, leave, clashes, qualifications, staffing, young-worker hours, kit, location and payroll re-checked? | 6 | Partial | Code + Probe P5. All are re-computed by the problems list, and payroll re-syncs. Nothing blocks, and per-day cover is missed (F03, F04). |
| 32 | Is the staffing requirement understandable without conflicting numbers? | 8 | Working | Code. One staffing panel (students + roles); required staff is worked out, not typed. |
| 33 | One authoritative staffing calculation? | 5 | Partial | Code + Probes P6, P10, P11. One formula (`evaluateRatio`), fed three different ways (F04). |
| 34 | Are RYA ratios represented correctly? | 7 | Partial | Code. Students per instructor per course type, editable. The defaults are examples to check, not verified RYA figures. One person can be counted twice (F11). |
| 35 | Different staffing on different days of a multi-day course? | 6 | Partial | Probe P6. Per-day add and skip work on the roster, app and pay; the cover checks ignore them (F04). |
| 36 | Can a course be cancelled safely? | 7 | Partial | Code + Suite + Probe P1. Proper cancel: notes, a pay rule, notifications, one batch. Pay is wrong if a line had been edited (F01). |
| 37 | On cancel, what happens to staff, pay, notifications, roster, app, PDF and reports? | 7 | Partial | Code + Probe P7. The session leaves every output; pay follows the rule; course-level staff are told. Day-only staff aren't told (F05); edited pay is kept (F01). |
| 38 | One session cancelled, the rest continue? | 7 | Partial | Probe P7. Works; the same notification gap applies (F05). |
| 39 | Can a draft course be deleted safely? | 9 | Working | Code. `canDeleteCourse`: only with no staff, no published week and no edited pay; leftover untouched pay lines go with it. |
| 40 | Can a live course be deleted by accident instead of cancelled? | 9 | Working | Code + Suite. Refused, with a plain reason pointing to Cancel. |
| 41 | Is the history of cancelled and changed courses kept? | 9 | Working | Code. Cancelled sessions stay on record with reason, pay rule and change-log entry; restore is possible. |

## Part D. Roster (highest priority)

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 42 | Can a complete week be built and kept up from the roster screen? | 8 | Working | Browser. Board with drag and drop, People × days view, publish and re-publish. |
| 43 | Add, remove and swap without extra navigation? | 8 | Working | Browser. Click a person, then a session; remove and per-day from the session panel. |
| 44 | Is who, what, where, when, role, status, kit and cover obvious? | 6 | Partial | Browser (1360 px). Names and roles are cut to "El… I…" on the board (F22). Clear on the phone list and in Print view. |
| 45 | Can every uncovered session be found quickly? | 7 | Partial | Browser. Roster shows "Needs cover" / "No safety cover" pills per session; the problems list misses per-day cases (F04). |
| 46 | Can every unsafe or invalid assignment be found quickly? | 7 | Partial | Code. The problems list covers most; per-day and multi-role gaps remain (F04, F11). |
| 47 | Does the roster update straight away after a change? | 8 | Working | Browser + Code. Server re-render after each action. |
| 48 | Does every roster edit trigger the right validations? | 4 | Not enforced | Probes P4, P5. The per-day add skips most checks; session edits don't block (F02, F03). |
| 49 | Can two admins edit the same roster safely? | 7 | Partial | Probe P2 + Suite. Parallel bookings of one person on overlapping courses were both taken back out (safe). The stale-edit check covers course staffing, location and kit, not session times (F14). |
| 50 | Two admins assign the same person simultaneously? | 8 | Working | Probe P2. Neither assignment is kept; both admins see a clear message to retry. |
| 51 | Editing something another admin has just changed? | 7 | Partial | Code (`lib/services/concurrency.ts`). Refused with who and when for staffing, location, kit and pay lines; not for session times (F14). |
| 52 | Duplicate assignments impossible at database level? | 8 | Working | Probe P3. Unique key; three parallel submissions gave 1 assignment and 1 pay line. The same person in a different role is allowed (F11). |
| 53 | Can someone be put on only some days of a multi-day course? | 8 | Working | Code + Probe P7. Per-day add and skip. Checks gap (F02). |
| 54 | Swaps without pay or notification errors? | 8 | Working | Code. Remove + add; pay re-syncs; "off" and "on" notices go out for published weeks. |
| 55 | Does publishing and unpublishing work? | 7 | Partial | Code. Publish and re-publish work; unpublish doesn't exist (F27). |
| 56 | What happens when a published roster changes? | 7 | Partial | Code. Staff are told of assignments, removals and moves; the gaps are in F05. |
| 57 | Are affected staff notified? | 7 | Partial | Probe P7 (F05). |
| 58 | Does the app show the new information straight away? | 8 | Working | Code. The app reads live on each load; the offline copy refreshes when back online. |
| 59 | Do the PDF, emergency sheet, digest and parent view use exactly the same data? | 7 | Partial | Code. PDF, emergency sheet and digest use the same per-day staffing. The parent view doesn't, and shows unpublished weeks (F16). |
| 60 | Can the roster show something different from the underlying assignments? | 8 | Working | Code. Built from the assignments every time; one row per person (see F11 for counting). |

## Part E. Availability and leave

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 61 | Is Free / Maybe / Busy / blank clear? | 9 | Working | Code. There is no blank: inside the window an unanswered slot counts as Busy; beyond it, "not asked yet". |
| 62 | Does availability affect every relevant rostering decision? | 8 | Working | Code. Blocks assignment (override allowed); in the picker; on the problems list. |
| 63 | Does approved leave stop assignment? | 8 | Working | Code. Approval marks the dates Busy (`markLeaveBusy`). |
| 64 | Someone becomes Busy after being rostered? | 7 | Partial | Code. Problems list flags it; the office is emailed for single-slot changes, not bulk or usual-week changes (F15). |
| 65 | Is the office warned straight away? | 7 | Partial | Same as 64. |
| 66 | Can an admin override an availability conflict? | 9 | Working | Code. |
| 67 | Is the override reason recorded? | 7 | Partial | Code. Recorded when given; one path doesn't require it (F37). |
| 68 | Can admins enter availability for staff without the app? | 9 | Working | Code. Office entry, marked "set by office". |
| 69 | Are recurring availability patterns reliable? | 8 | Working | Code. Usual-week rows apply at any date; a dated answer wins. |
| 70 | Are bulk availability operations atomic? | 6 | Partial | Code (`setAvailabilityMany`). One-by-one upserts, idempotent, so a retry fixes a half-saved week; not all-or-nothing. |
| 71 | Can duplicate availability records exist? | 9 | Working | Code. Unique keys on (person, date, slot) and (person, weekday, slot). |
| 72 | Same cell updated from two devices at once? | 8 | Working | Code. Upsert, last write wins, no duplicate. |
| 73 | Availability outside the permitted horizon? | 8 | Working | Code. Refused for instructors; the office can enter any date (intended). |
| 74 | Can past availability be changed by accident? | 7 | Partial | Code. Earlier days of the current week are still open (F31). |
| 75 | Correct across time zones and the clock changes? | 9 | Working | Code. Dates are plain dates with a slot; no instants involved. |

## Part F. RYA qualifications and staffing

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 76 | Does the platform know which qualifications each course type needs? | 6 | Partial | Code (`lib/services/teaching.ts`). By discipline, or explicit per-course-type rules. Expired instructor qualifications still count (F10). |
| 77 | Does the picker show suitable and unsuitable instructors? | 7 | Partial | Browser + Code. Qualified, fit and availability shown per person; "nothing recorded" isn't a warning (F10). |
| 78 | Can an unqualified instructor be assigned by accident? | 5 | Not enforced | Code + Probe P4. Blocked with override when qualifications are recorded. Passes when none are recorded, and always via the per-day add (F02, F10). |
| 79 | Can an Assistant Instructor be treated as qualified to lead? | 3 | Missing | Code. Roles don't carry qualification requirements (F10). |
| 80 | Powerboat, Dinghy, Senior Instructor and others handled correctly? | 5 | Partial | Code. Disciplines map course types to grades, but the Safety Boat Driver role isn't tied to a powerboat or safety-boat qualification (F10). |
| 81 | Are expired qualifications detected? | 5 | Partial | Code. Expiry is tracked for checks (first aid, DBS) and blocks when ticket checks are on. Instructor qualifications' expiry doesn't affect "can teach" (F10). |
| 82 | Future expiry dates handled? | 8 | Working | Code. Valid until the date; "expiring" warnings within the centre's lead time. |
| 83 | Qualification checks re-run whenever a course or assignment changes? | 6 | Partial | Code. Re-computed in the problems list; not enforced on per-day adds or edits (F02, F03). |
| 84 | Can an admin override a qualification warning? | 9 | Working | Code. |
| 85 | Is the override explicit, justified and audited? | 7 | Partial | Code. Audited with who and when; the reason is optional on one path (F37). |
| 86 | Are RYA ratios calculated consistently? | 5 | Partial | Probes P6, P10, P11 (F04, F11). |
| 87 | Are safety-boat requirements represented correctly? | 7 | Partial | Code. Course types say whether a safety boat is needed; roles say who is safety cover. Off by default (F06). |
| 88 | Enough instructors but no safety boat: is it caught? | 6 | Partial | Code + Probe P6. Yes ("No safety cover", blocking) when ratio checks are on, except per-day cases (F04, F06). |
| 89 | Real sailing-school staffing, not generic scheduling? | 7 | Partial | Code. Ratios, safety cover, young workers, welfare officer on duty, per-day camp staffing: genuinely sailing-specific, with the gaps above. |

## Part G. Equipment and locations

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 90 | Can equipment be changed after a course is created? | 8 | Working | Code. |
| 91 | Can one item be put on two sessions at the same time by accident? | 7 | Partial | Code. Saved, then shown straight away as a blocking clash in the save message and the problems list. |
| 92 | Does maintenance status immediately affect existing bookings? | 8 | Working | Code. A problem with the note and "back on" date. |
| 93 | Does retiring equipment immediately affect bookings? | 8 | Working | Code. "… is retired" problem. |
| 94 | Equipment conflicts shown before the course runs? | 8 | Working | Code. Problems list 8 weeks ahead; quantity shortfalls per slot. |
| 95 | Can an admin see where a boat is booked next? | 4 | Missing | "Next booked" was left out by Conor's decision on 4 Oct. |
| 96 | Can equipment be changed safely after publishing? | 7 | Working | Code. Kit changes don't need staff notices; outputs read live. |
| 97 | Can a location be changed after creation? | 8 | Working | Code, with the stale-edit check. |
| 98 | Does changing location update every roster output? | 9 | Working | Code. Roster, PDF, app, emergency sheet and digest read it live. |
| 99 | Can a course have an inactive location? | 6 | Partial | Code. Yes, without a warning (F28). |
| 100 | Are equipment and location changes audited? | 8 | Working | Code. Change-log entries for course kit and location changes, and for retire or delete. |

## Part H. Staff, roles and permissions

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 101 | Several independent office admins? | 9 | Working | Code. |
| 102 | Each admin only has what they were given? | 9 | Working | Code + Suite (`route-permissions.test.ts`). |
| 103 | Can a new admin accidentally get too much access? | 9 | Working | Code. A new office admin starts with no features; only the superadmin grants them. |
| 104 | Can ownership be transferred safely? | 8 | Working | Code. Dev Center only, validated, both people emailed; two writes, not one (F33). |
| 105 | Is there always a recoverable owner? | 8 | Working | Code. Dev Center can transfer; the owner can't remove themselves. |
| 106 | Payroll only for authorised admins? | 9 | Working | Code + Suite. |
| 107 | Emergency and guardian contacts only for authorised users? | 9 | Working | Code. The emergency sheet hides contacts without the "Emergency & guardian contacts" tick; views are logged. |
| 108 | Instructors see only their own information? | 9 | Working | Code + Browser. Every office page and export redirected to the instructor's own app. |
| 109 | Parents see only their child? | 9 | Working | Code. Children looked up by the parent's own link; the decision action checks the link belongs to them. |
| 110 | Permissions enforced on the server? | 9 | Working | Code. All 243 server actions scanned; every one resolves the user and checks permission server-side. |
| 111 | Every sensitive route tested directly? | 9 | Working | Browser. 16 office pages and exports opened as an instructor and while signed out: all refused. |
| 112 | Does a role change take effect straight away? | 9 | Working | Code. Membership is read on every request; nothing is cached. |
| 113 | Are revoked users stopped straight away? | 8 | Working | Code. Access goes immediately; push notices can still reach their phone (F17). |
| 114 | Deleted or deactivated users in existing rosters? | 4 | Not enforced | Code. Marking someone as left keeps them on future sessions with no warning (F09). |

## Part I. Security and authentication

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 115 | Password sign-in | 9 | Working | Code + Suite. Better Auth, verified email required, strength meter, breached-password check. |
| 116 | PIN | 6 | Partial | Code + Probe P12. Works and locks after 5 wrong guesses one at a time; parallel guesses bypass the lock (F07). |
| 117 | Two-factor | 8 | Working | Code + Suite. Authenticator app or emailed code; required for the Dev Center. Manual check on a device recommended. |
| 118 | Recovery email | 8 | Working | Code. Separate address, never a login identity. Manual check recommended. |
| 119 | Password reset | 9 | Working | Code. Revokes other sessions, notifies, logs. |
| 120 | New-device verification | 8 | Working | Code + Suite (`login-verify`, `trusted-device`). Emailed code for office users on a new device. |
| 121 | New location or country | 8 | Working | Code. Device gate by city and country. Manual check recommended. |
| 122 | Session expiry | 9 | Working | Code. 7-day session; PIN after the centre's idle time; office re-sign-in after 12 hours away. |
| 123 | Logout | 8 | Working | Code. Session ends; push token left behind (F17). |
| 124 | Sign out of all devices | 8 | Working | Code. Sessions and trusted devices cleared; push tokens left (F17). |
| 125 | Lockout and rate limiting | 9 | Working | Code + Suite. Per-IP and per-email limits in D1, atomic, failing closed; Turnstile after repeated failures. |
| 126 | Concurrent failed authentication | 6 | Partial | Code + Probe P12. Sign-in counting is atomic; the PIN isn't (F07). |
| 127 | Can rate limits be bypassed with parallel requests? | 5 | Not enforced | Probe P12: the PIN lockout, yes (F07). Sign-in, no. Public forms, slightly (F25). |
| 128 | Can billing or setup endpoints be abused? | 8 | Working | Code. Prices come from the server; limited per IP (KV, see F25); no card data handled. |
| 129 | Can any unauthenticated function expose sensitive behaviour? | 7 | Partial | Code (scan of all actions). Only the 2FA hint leaks anything: whether an email has 2FA (F23). |
| 130 | Another centre by changing IDs? | 10 | Working | Probe P13 + Suite. Assign, cancel, approve pay and per-day add with another centre's ids were all refused; the isolation suite covers every table. |
| 131 | One instructor reaching another's information? | 9 | Working | Code. App scoped to the signed-in person; document downloads checked against their own folder. |
| 132 | One parent reaching another child? | 9 | Working | Code (see 109). |
| 133 | Can a former user keep using a session? | 9 | Working | Code. Membership is checked per request; suspended or removed means denied. |
| 134 | Sensitive exports protected by step-up? | 6 | Partial | Code. Whole-centre and per-person exports ask for the PIN again; the emergency sheet, young-worker register, payroll spreadsheet and change-log export don't (F18). |
| 135 | Security-sensitive actions audited? | 9 | Working | Code. Security events plus the centre change log. |
| 136 | Can audit records be changed or deleted? | 10 | Working | Code + Suite. Append-only database triggers (migration 0046, `append-only.test.ts`). |
| 137 | Same controls on desktop, mobile and API? | 9 | Working | Code. The app is the same web routes in a native shell; the same server checks apply. |

## Part J. Multi-tenancy

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 138 | Every centre table tested | 10 | Working | Suite. The isolation suite covers every table in the tenant list; a second test fails CI if a table with `organisation_id` is missing from the list. |
| 139 | Every lookup by ID | 10 | Working | Code + Probe P13. `findById` always adds the centre; another centre's ids came back "not found". |
| 140 | Every list or search | 10 | Working | Code. Repository `list` and `listIn` always add the centre filter. |
| 141 | Every server action | 9 | Working | Code. All go through `requireTenant` and the repositories. Not every action has its own cross-centre test; the guarantee sits in the repository layer, which is tested. |
| 142 | Every API route | 9 | Working | Code. Centre routes use `requireTenant`; admin routes use `requirePlatformAdmin`; webhooks are signature-checked. |
| 143 | Another centre's staff, courses, roster, pay, availability, kit, locations, contacts, guardians, documents, logs, exports | 10 | Working | Suite + Probe P13. Nothing reachable. |
| 144 | Cross-centre writes | 10 | Working | Suite (writes are forced to the context's centre). |
| 145 | Cross-centre deletes | 10 | Working | Suite. |
| 146 | Updates with guessed IDs | 10 | Working | Suite + Probe P13 (approve another centre's pay line → refused). |
| 147 | Isolation after sign-in state changes | 9 | Working | Code. The app's selected-centre cookie is signed and bound to the user; ghost tokens are bound to the admin and the centre. |
| 148 | Isolation in background jobs | 9 | Working | Code. Sweeps build each centre's context from that centre's own row. |
| 149 | Isolation in exports and generated files | 9 | Working | Code. Exports run through the repositories; the PDF is built per request, not stored. |
| 150 | Isolation in R2 files | 10 | Working | Code + Suite (`r2/key.test.ts`). Every key is prefixed `org_{id}/` and checked before read or delete. |
| 151 | Isolation in email links and notifications | 9 | Working | Code. Links go to the centre's own subdomain, which still needs membership. |

## Part K. Payroll

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 152 | Does payroll always come from the current roster? | 9 | Working | Code + Suite. Pay lines re-sync on every roster change, using per-day staffing. |
| 153 | Are cancelled sessions excluded correctly? | 6 | Partial | Probe P1. They follow the pay rule, except a previously edited line keeps its amount (F01). |
| 154 | Deleted draft sessions handled? | 9 | Working | Code (`dropHoursForSessions`). |
| 155 | Approved lines protected? | 9 | Working | Code. Sync never touches an approved line; it gets a note to review. |
| 156 | Roster change after approval flagged? | 9 | Working | Code. "Roster changed since approval" flag. |
| 157 | Rate changes reach unapproved lines? | 8 | Working | Code. Yes; people added for one day get the default rate (F34). |
| 158 | Integer pence? | 7 | Partial | Code. Rates and edits are stored in pence; line pay is worked out in pounds and rounded to 2 decimals. The pence/pounds split is what caused F01. |
| 159 | Consistent rounding? | 8 | Working | Code. Per line to the penny; totals rounded. |
| 160 | Breaks correct? | 5 | Partial | Probe P14. Applied per session, so a 7-hour day in two sessions gets none (F12). |
| 161 | Overtime rules? | 4 | Missing | No overtime rules exist; pay is per hour, session or day. |
| 162 | Volunteers excluded unless included? | 9 | Working | Code. Hidden by default; a tick shows them. |
| 163 | Pay line without a valid session? | 8 | Working | Code. Possible when a session is deleted (set null); untouched ones are hidden or purged, edited ones show as "Other". |
| 164 | Duplicate lines? | 10 | Working | Probes P3, P8. Unique key; parallel syncs made no duplicates. |
| 165 | Safe rebuild without duplicating payments? | 10 | Working | Probe P8. "Refresh from roster" twice: nothing created the second time. |
| 166 | Can cancelling create or keep payable hours? | 4 | Not enforced | Probe P1 (F01). |
| 167 | Paid for a session they were removed from? | 6 | Partial | Code. Untouched lines are removed; an edited line stays payable without a flag (F38). |
| 168 | Consistent after edits, swaps and cancellations? | 7 | Partial | Probes. Yes, apart from F01 and F38. |
| 169 | Period summary accurate? | 9 | Working | Code. Built from the same lines. |
| 170 | CSV totals identical to the screen? | 9 | Working | Code. The CSV is written from the same line objects. |

## Part L. Notifications and email

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 171 | Every important roster change notified? | 7 | Partial | Code + Probe P7 (F05). |
| 172 | Cancellation notices? | 7 | Partial | Probe P7. Course-level staff yes; day-only staff no; staff skipped that day wrongly told. |
| 173 | Assignment notices? | 8 | Working | Code. For published weeks; unpublished weeks wait for the publish notice. |
| 174 | Removal and swap notices? | 8 | Working | Code. |
| 175 | Publication notices correct? | 7 | Partial | Probe P7. Day-only staff not told; session counts course-level (F05). |
| 176 | Declines and cover requests? | 8 | Working | Code. A decline emails the admins and appears on the problems list; open shifts can be claimed and the claimer is told. |
| 177 | Duplicate notifications prevented? | 8 | Working | Probe P3 (one assignment means one notice). Re-publish deliberately reminds everyone. |
| 178 | Failed emails retried? | 9 | Working | Code + Suite. Queue with growing gaps, 5 attempts, failed list in the Dev Center. |
| 179 | Can a failed email look like a success? | 8 | Working | Code. The in-app notice is the record; email failures are kept in the queue. |
| 180 | Links tenant-safe and permission-safe? | 9 | Working | Code. |
| 181 | Times right in BST and GMT? | 9 | Working | Code. Digest timed by the London hour; times shown as typed. |
| 182 | Large numbers of staff at once? | 6 | Partial | Code. Sent one by one inside the request (F35). |

## Part M. Staff mobile app

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 183 | Log in and reach the next shift quickly? | 8 | Working | Code. App home shows upcoming published shifts first. |
| 184 | Today's and upcoming shifts? | 9 | Working | Code. |
| 185 | Location, kit, role and course shown? | 7 | Partial | Code. Location, role, course and colleagues are shown; equipment isn't. |
| 186 | Confirm or decline? | 9 | Working | Code + Suite. |
| 187 | Manage availability? | 9 | Working | Code. Usual week, per-day notes, copy week. |
| 188 | Request leave? | 9 | Working | Code. |
| 189 | See cover information? | 8 | Working | Code. Open shifts to claim. |
| 190 | Face ID works? | 7 | Manual | Code only: native biometric plugin with PIN fallback. Needs a device test. |
| 191 | PIN fallback works? | 7 | Manual | Code. Same. |
| 192 | Promised offline features work? | 7 | Manual | Code + Suite (`offline-sw.test.ts`). The offline week is shown from the copy saved on the phone. The iPhone build needs the rebuild noted on 5 Oct. |
| 193 | Offline while making a change? | 6 | Manual | Code. The action fails with an error; nothing is queued for later. |
| 194 | Stale or offline data clearly marked? | 8 | Working | Code. A separate offline page shows the saved week, never a live page. |
| 195 | Recovers after reconnecting? | 8 | Working | Code. Normal pages load live again. |
| 196 | Push notifications work? | 7 | Manual | Code + Suite (`fcm.test.ts`). Needs a device test. |
| 197 | Right user and device? | 8 | Working | Code. Tokens stored per user; dead tokens removed. |
| 198 | Can a logged-out or removed user still get sensitive notices? | 4 | Not enforced | Code. Yes: tokens survive sign-out and removal (F17). |
| 199 | Time zones and clock changes? | 9 | Working | Code. Same wall-clock rule as the office. |
| 200 | iOS and Android consistent? | 6 | Manual | Code. Same web app in Capacitor; device builds not tested here. |

## Part N. Time, date and daylight saving

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 201 | Exactly one way of storing and showing times? | 9 | Working | Code (`lib/domain/time.ts`). Wall-clock "as typed", stored as if UTC, shown as UTC everywhere; a real zone only for "today" and the digest hour. |
| 202 | GMT dates | 9 | Working | Suite (`time.test.ts`, `pdf.test.ts`). |
| 203 | BST dates | 9 | Working | Suite (lifecycle test, May 2027). |
| 204 | The changeover weekend | 8 | Working | Code. Session times are unaffected. Clock-in/out across the repeated 01:00–02:00 hour in October could mis-measure by an hour; irrelevant for daytime sailing. |
| 205 | Courses crossing midnight | 6 | Missing | Code. End must be after start, so overnight sessions aren't supported. Rare for sailing. |
| 206 | Different centre time zones | 8 | Working | Code. Each centre's zone is used for "today"; UK and Ireland share the same clock. |
| 207 | Staff in different zones | 8 | Working | Code. Everyone sees the centre's wall clock, which is right for on-site work. |
| 208 | Payroll around the changes | 9 | Working | Code. Durations are wall-clock differences. |
| 209 | Young-worker hours around the changes | 9 | Working | Suite (`working-time.test.ts`). |
| 210 | PDFs around the changes | 9 | Working | Suite (`pdf.test.ts`). |
| 211 | Emergency sheets around the changes | 9 | Working | Code. Same formatter. |
| 212 | Emails and digests around the changes | 8 | Working | Code. |
| 213 | Mobile around the changes | 9 | Working | Code. Same pages and formatter. |
| 214 | Same local time for a session everywhere? | 9 | Working | Browser + Suite. Roster, PDF, app and calendar feed (floating local time) agree. |

## Part O. Background jobs and reliability

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 215 | Does the scheduled job run reliably? | 7 | Manual | Code. Cloudflare cron at :05, with a GitHub Actions backup pinger. Cloudflare's run history wasn't visible from here. |
| 216 | Is every expected task run? | 8 | Working | Code. One tick runs every sweep; each is wrapped so one failure doesn't stop the rest. |
| 217 | Are failed jobs detected? | 4 | Missing | Code (F08). |
| 218 | Are failed jobs retried? | 7 | Partial | Code. Naturally, on the next hour; no alert. |
| 219 | Monitoring or alerting when jobs stop? | 3 | Missing | Code (F08). |
| 220 | Can a job run twice without harm? | 8 | Working | Code + Suite. Sent-at stamps and "ran within 24h" guards; the backup pinger relies on this. |
| 221 | Retention idempotent? | 8 | Working | Code. Deletes only what's due, once per centre per day. |
| 222 | Leaving and expiry sweeps idempotent? | 8 | Working | Code + Suite (`leaving.test.ts`). |
| 223 | Email retries idempotent? | 8 | Working | Code + Suite (`queue.test.ts`). |
| 224 | Survey and digest idempotent? | 8 | Working | Suite (`trial-survey.test.ts`). |
| 225 | Does the backup run independently? | 9 | Working | Code. Nightly GitHub workflow, encrypted, off-site copy, emails a report either way. |
| 226 | Can an outage stop compliance tasks indefinitely? | 4 | Not enforced | Code. If both schedulers stop, retention and reminders stop, unnoticed (F08). |
| 227 | Clear recovery procedure if jobs stop? | 5 | Partial | Docs. There are runbooks for deploy, restore and incidents, but none for "the hourly job stopped" (fold into F08). |

## Part P. Database and data integrity

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 228 | Important uniqueness enforced in the database? | 8 | Working | Code. Unique keys on assignments (course, person, role), per-day staffing, availability, pay lines, published weeks, centre settings and config codes. One person can still hold two roles on one course (F11). |
| 229 | Can concurrent requests create duplicates? | 9 | Working | Probes P2, P3, P8. |
| 230 | Multi-step operations transactional where needed? | 7 | Partial | Code + Suite. Assign, cancel, restore, per-day, staffing, location, kit and course creation are single batches. Session edits, add/remove session, remove staff, bulk availability and ownership transfer aren't (F14, F33). |
| 231 | What happens if an operation fails halfway? | 7 | Partial | Suite (`all-or-nothing.test.ts`). Batched ones leave nothing behind; the rest self-heal on the next pay sync or retry. |
| 232 | Can partly-created courses exist? | 9 | Working | Code + Suite. Course, sessions, staffing, location and kit in one batch. |
| 233 | Partly-created assignments? | 9 | Working | Suite. Assignment, pay lines and log entry in one batch. |
| 234 | Partial availability updates? | 7 | Partial | Code. Possible on a dropped connection; idempotent retry. |
| 235 | Can a pay sync partly complete? | 8 | Working | Code. Each course syncs in one batch; a full rebuild can stop between courses and is safe to re-run. |
| 236 | Batch operations atomic where needed? | 8 | Working | Code. Bulk assign is per course by design, reporting each outcome. |
| 237 | Destructive operations reversible where appropriate? | 8 | Working | Code + Docs. Cancel can be restored; delete only for unused drafts; anonymise is deliberately final; D1 Time Travel keeps 30 days. |
| 238 | Foreign keys consistent? | 9 | Working | Code. RESTRICT on config, cascade on centre erasure, set-null on deleted sessions. |
| 239 | Are orphan records possible? | 8 | Working | Code. Pay lines lose their session on delete and are purged or shown as "Other". |
| 240 | Migrations safe on existing production data? | 9 | Working | Docs + Code. Additive; staging first; Time Travel bookmark recorded per deploy. |
| 241 | Duplicate or legacy records cleaned up by migrations? | 8 | Working | Code. The unique-key migrations removed duplicates before adding the keys. |
| 242 | Indexes right for realistic centres? | 8 | Working | Code + Suite (`big-centre.test.ts`). Centre index on every table plus composite keys. |
| 243 | Are all large queries bounded? | 6 | Partial | Code (F20). |
| 244 | 1,000+ assignments and several years of history? | 7 | Partial | Suite. The big-centre test (≈1,400 sessions) passes for the main pages; the change log and a few others still read everything (F20). |

## Part Q. Performance and scale

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 245 | Small club | 9 | Working | Browser + Code. Comfortable. |
| 246 | Medium sailing school | 8 | Working | Browser. Demo centre (18 staff, 48 sessions a week): every office page under 3 s in slow local development mode. |
| 247 | Large centre | 7 | Partial | Code. Bounded where it matters (roster, problems, payroll); see F20 and F35. |
| 248 | Several years of history | 6 | Partial | Code. Change log and a few pages grow with history (F20). |
| 249 | Hundreds or thousands of assignments | 7 | Partial | Suite (big-centre). |
| 250 | Large staff lists | 8 | Working | Code. The instructor list is a single read; fine into the hundreds. |
| 251 | Large payroll periods | 8 | Working | Code. Reads only the period's sessions and lines. |
| 252 | A large roster week | 8 | Working | Code. Week-bounded reads. |
| 253 | Every unbounded query, identified | 5 | Partial | Code. Whole-table reads of growing tables: change-log page (`audit_log`); leave page and office availability actions (`course_session`, `course`); instructor app home, publish, emergency sheet, parent view, time clock (`course_staff` and/or `course`); "Refresh from roster" (`course`, then one sync per course); the hourly tick (all centres, sequential). |
| 254 | Every N+1 pattern | 6 | Partial | Code. Notifications (one person lookup, push and email each); young-worker checks per person and course in the problems list; "Refresh from roster" per course; bulk assign per course (intended). |
| 255 | The same data loaded repeatedly | 7 | Partial | Code. Settings, roles and compliance types re-read within one request (assign, problems); harmless at current sizes. |
| 256 | Anything likely to hit Worker CPU or request limits? | 6 | Partial | Code. "Refresh from roster" on a multi-season centre (D1's 1,000-queries-per-request limit); publishing to 100+ staff; the hourly tick as centres grow. |
| 257 | Does a busy centre's roster still load quickly? | 8 | Manual | Browser. ≈2.5 s in development mode for 48 sessions; production will be faster. Not load-tested. |
| 258 | Bulk operations on poor connections? | 7 | Partial | Code. Bulk availability is idempotent; bulk assign reports each course. |

## Part R. Data protection and privacy

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 259 | Can a centre export all its data? | 9 | Working | Code + Suite (`export.test.ts`). Every tenant table, with step-up. |
| 260 | Only that centre's data? | 10 | Working | Code + Suite. |
| 261 | Sensitive data protected? | 9 | Working | Code. Emergency contacts, guardian phones and vetting references are sealed (encrypted); access by feature tick. |
| 262 | Emergency and guardian records encrypted? | 9 | Working | Code (`openToken`, `isSealed`). |
| 263 | Sensitive accesses audited? | 9 | Working | Code. Emergency sheet, contact views and exports logged. |
| 264 | Does anonymisation remove what it must? | 9 | Working | Code + Suite (`person-data.test.ts`). Identity, qualifications, checks and their files. |
| 265 | Does deletion reach dependent records? | 9 | Working | Code + Suite. Centre erasure cascades; R2 prefix removed. |
| 266 | Does retention delete records when due? | 8 | Working | Code + Suite (`retention.test.ts`). |
| 267 | Can a retention failure go unnoticed? | 4 | Not enforced | Code. Yes (F08, F19). |
| 268 | Under-18 defaults applied? | 9 | Working | Code. Contacts hidden from colleagues; parental permission on by default; young-worker register and hours. |
| 269 | Parental consent stored and auditable? | 9 | Working | Code. Decision, date and the centre's consent note, logged. |
| 270 | Can consent be withdrawn? | 9 | Working | Code. "Withdraw" on the parent view. |
| 271 | Does withdrawal affect access properly? | 9 | Working | Code. Blocks new assignments and flags existing ones as blocking. |
| 272 | Privacy links restricted to safe URL schemes? | 9 | Working | Code. https only. |
| 273 | Generated documents protected? | 9 | Working | Code. PDFs built per request behind permission; files only through the scoped route. |
| 274 | Old R2 files removed when their data is deleted? | 8 | Working | Code. On replace, anonymise, vetting retention and centre erasure. |

## Part S. Roster outputs and documents

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 275 | Live roster vs PDF, emergency sheet, parent view, app, digest, notifications, payroll | 7 | Partial | Code + Probes. PDF, emergency sheet, digest, app and payroll match (per-day aware). The parent view and notifications don't (F05, F16). |
| 276 | Same session shown identically everywhere? | 7 | Partial | Code. Times identical everywhere; staff lists differ in the parent view and notices. |
| 277 | Cancelled sessions removed everywhere? | 9 | Working | Code. The live-sessions filter is used in every output. |
| 278 | Staff swaps reflected everywhere? | 8 | Working | Code. Except per-day in the parent view (F16). |
| 279 | Time changes reflected everywhere? | 9 | Working | Code. |
| 280 | Location and kit changes reflected everywhere? | 9 | Working | Code. The app doesn't show kit (question 185). |
| 281 | Staff statuses reflected everywhere? | 8 | Working | Code. Confirmed and declined shown on the roster and PDF; declined people leave the emergency sheet. |
| 282 | Published / unpublished respected everywhere? | 7 | Partial | Code. App and calendar feed show published weeks only; the parent view doesn't (F16). |
| 283 | Can an old cached or generated document show outdated information? | 8 | Working | Code. Nothing is stored server-side; the morning email and the app's saved week are snapshots, and the offline page says so. |

## Part T. Real-world failure testing

| # | Failure | Score | Status | Safe, recoverable, understandable? |
|---|---|---|---|---|
| 284 | Double-clicking submit | 9 | Working | Probe P3. One assignment, one pay line; the extra clicks get "already on this course". |
| 285 | Two admins submitting simultaneously | 8 | Working | Probe P2. Both clashing bookings taken back with a clear message; retry works. |
| 286 | Network failure halfway | 7 | Partial | Suite. Batched saves are all-or-nothing; session edits and removals aren't (F14). |
| 287 | Browser refresh during submission | 7 | Manual | Same as 286. |
| 288 | Back button after submission | 7 | Manual | Server actions aren't replayed by Back; forms reload from the server. |
| 289 | Duplicate API request | 8 | Working | Unique keys and idempotent upserts. |
| 290 | Stale browser tab | 7 | Partial | Refused with who and when for staffing, kit, location and pay lines; last write wins elsewhere (F14). |
| 291 | Two devices editing the same record | 7 | Partial | As 290. |
| 292 | User loses permissions mid-session | 9 | Working | Checked on every request. |
| 293 | User deleted or deactivated mid-session | 9 | Working | Membership suspended means the next request is denied. |
| 294 | Database write succeeds, notification fails | 9 | Working | Notices are sent after the write; failures are caught; email is queued for retry. |
| 295 | Notification succeeds, UI request times out | 8 | Working | A retry hits the unique key; no duplicate. |
| 296 | Background job runs twice | 8 | Working | Idempotent guards. |
| 297 | Background job partly fails | 6 | Partial | Each sweep is wrapped and resumes next hour, but nobody is told (F08). |
| 298 | Cloudflare temporarily unavailable | 7 | Partial | The platform is down; the printed emergency sheet and morning roster email are the documented fallbacks. |
| 299 | Email provider temporarily unavailable | 8 | Working | Queue with retries and a second provider where configured. |
| 300 | Mobile goes offline during a change | 6 | Manual | The change fails with an error; nothing is queued. |

## Part U. Test coverage

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 301 | Authentication | 8 | Working | Suite: `login-verify`, `pin`, `pin-idle`, `trusted-device`, `auth-throttle`, `reset-code`, `durable-limits`. |
| 302 | Authorisation | 9 | Working | Suite: `rbac`, `who-can-see`, `route-permissions`. |
| 303 | Tenant isolation | 10 | Working | Suite: `cross-tenant`, `tenant-tables-complete` (release gate in CI and deploy). |
| 304 | Role-by-route access | 9 | Working | Suite: `route-permissions.test.ts`. |
| 305 | Course lifecycle | 8 | Working | Suite: `lifecycle.test.ts`. |
| 306 | Roster lifecycle | 8 | Working | Suite: `roster-publish`, `assignment`, `board`. |
| 307 | Payroll lifecycle | 8 | Working | Suite: `payroll`, `payroll-review`, `hours`. |
| 308 | Cancellation | 7 | Partial | Suite: `cancel.test.ts`; misses "edited, then cancelled" (F01) and per-day recipients (F05). |
| 309 | Staff swaps | 6 | Partial | Covered indirectly by assignment tests; no dedicated swap test. |
| 310 | Concurrent edits | 7 | Partial | Suite: two admins, stale edits. |
| 311 | Duplicate submissions | 7 | Partial | Suite: unique-key tests; no parallel double-submit test. |
| 312 | Daylight saving / summer time | 8 | Working | Suite: `time`, `pdf`, `calendar-feed`, lifecycle. |
| 313 | Young-worker rules | 8 | Partial | Suite: `working-time.test.ts`; the per-day and edit paths aren't tested (F02, F03). |
| 314 | Mobile / offline | 5 | Partial | Suite: `offline-sw.test.ts` only. |
| 315 | End-to-end browser smoke test | 2 | Missing | F32. |
| 316 | Does CI run the important tests? | 9 | Working | CI: tests plus the isolation gate, migration-drift check, app build. |
| 317 | Can a deploy succeed with critical tests failing or skipped? | 9 | Working | The deploy workflow runs the tests itself; no skipped tests in the suite. |
| 318 | Production migrations tested against realistic data? | 6 | Partial | Staging first, with synthetic data; the restore rehearsal doesn't run pending migrations against a restored copy. |

## Part V. UX and product quality

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 319 | First-time admin without training? | 8 | Working | Browser. Wizard, checklist, Help assistant, guide links on every page. |
| 320 | Unnecessary text? | 7 | Partial | Browser. Some long page introductions (Courses, Payroll). |
| 321 | Important actions visually prioritised? | 8 | Working | Browser. Publish, Download PDF and Emergency sheet are prominent. |
| 322 | Destructive actions clearly distinguished? | 8 | Working | Code. Cancel and delete use confirm dialogs, red styling and plain consequences. |
| 323 | Errors understandable to a non-technical admin? | 9 | Working | Probes. E.g. "Someone else put Ben on another course at the same time … Nothing was changed here; check the roster and try again." |
| 324 | Does every error say what to do next? | 8 | Working | Code. "Tick override and add a note", "Reload to see their change". |
| 325 | Loading states clear? | 7 | Manual | Code. Buttons switch to "Saving…"/"Sending…"; no skeletons. |
| 326 | Empty states useful? | 8 | Working | Code. |
| 327 | Success obvious? | 8 | Working | Code. Inline messages after each action. |
| 328 | Mobile layouts genuinely usable? | 7 | Partial | Browser (390 px). The roster becomes a readable day list; payroll and the Courses header are cramped (F36). |
| 329 | Tables usable on small screens? | 6 | Partial | Browser. Payroll table columns cut off and need sideways scrolling inside the card. |
| 330 | Forms too long? | 8 | Working | Code. Course and staff forms are short; quick add for staff. |
| 331 | Repeated concepts named consistently? | 9 | Working | Code. |
| 332 | "Roster" rather than legacy terms? | 9 | Working | Code. "Roster" everywhere people read it (the URL is still `/office/rota`). |
| 333 | Developer or internal terms visible to customers? | 8 | Working | Code. Slot codes (AM/PM/EV) appear; one checkout error passes Stripe's raw message through. |
| 334 | Accessibility labels accurate? | 7 | Manual | Code. Labels on board controls and pills; no screen-reader test done. |
| 335 | Can keyboard users run the main office workflows? | 6 | Manual | Code. The board supports click-then-click as well as drag; full keyboard use untested. |
| 336 | Colour-only indicators avoided? | 7 | Partial | Browser. Pills carry text; the status dots by names on the board rely on colour. |
| 337 | Understandable in a stressful situation? | 8 | Working | Browser. Today strip and one-click emergency sheet. |

## Part W. Website and sales funnel

| # | Question | Score | Status | Evidence |
|---|---|---|---|---|
| 338 | Does the homepage explain ActivityRoster immediately? | 9 | Working | "The operating system for RYA sailing centres", with the product in the hero. |
| 339 | Obviously built for sailing and watersports centres? | 9 | Working | RYA language throughout; 10 search pages. |
| 340 | Value clear in seconds? | 8 | Working | Hero plus "Your week, in three steps". |
| 341 | Avoids unnecessary text? | 7 | Partial | A long homepage, but scannable. |
| 342 | Does the funnel lead to signup or demo? | 8 | Working | "Start my free month" and "Take the tour" on every page. |
| 343 | Pricing and limits clear? | 9 | Working | £35 up to 10 people, £65 unlimited, fair use explained. |
| 344 | Are website claims true in the platform today? | 6 | Partial | "Checks … course ratios and safety-boat cover as you schedule" is only true once the centre switches those checks on (F06). |
| 345 | Screenshots representative? | 9 | Working | Taken from the platform on 6 Oct. |
| 346 | Mobile website effective? | 8 | Working | Checked at 390 px; no sideways scroll. |
| 347 | Technically indexable? | 8 | Working | robots.txt, sitemap, per-page canonicals; Search Console shows "discovered", normal for a new site. |
| 348 | Metadata, titles and structured content? | 9 | Working | Per-page titles and descriptions; Organization and FAQ structured data. |
| 349 | Broken links or stale references? | 8 | Working | The guide 404 was fixed and deployed; no automated link check. |
| 350 | Consistent terminology with the platform? | 9 | Working | |

## Part X. RYA / sailing-centre reality check

| # | Question | Score | Status | Assessment |
|---|---|---|---|---|
| 351 | A normal RYA training day? | 8 | Working | Yes: courses by slot, instructors, safety boat, roster, PDF, emergency sheet. |
| 352 | Several courses at once? | 9 | Working | Yes, with clash checks across them. |
| 353 | A busy weekend? | 8 | Working | Yes; weekend courses, people × days view. |
| 354 | A youth sailing programme? | 7 | Partial | Strong: youth audience, under-18 hours, parental permission, guardian contacts, parent view. Weakened by the per-day and edit gaps (F02, F03). |
| 355 | A Powerboat course? | 8 | Working | Powerboat course types and discipline. The safety-boat role isn't tied to powerboat qualifications (F10). |
| 356 | Multi-day courses with different instructors each day? | 6 | Partial | Built (per-day staffing) but not yet wired into checks, cover and notices (F02, F04, F05). |
| 357 | Volunteer-heavy clubs? | 6 | Partial | Volunteers as staff, excluded from pay. Club duties (race officer, safety duty, galley) can only be modelled as "courses"; no duty-swap flow. |
| 358 | Occasional instructors? | 8 | Working | Availability windows, invites, per-day adds. |
| 359 | Weather cancellation? | 6 | Partial | Per course or day, with a pay rule and notices. No "cancel everything this afternoon" across courses (F39), and the F01/F05 gaps apply. |
| 360 | Telling staff quickly when plans change? | 7 | Partial | Push plus email; per-day gaps (F05). |
| 361 | The right qualifications for each course? | 5 | Partial | F10. |
| 362 | RYA staffing ratios correct? | 6 | Partial | F04, F06, F11. |
| 363 | Safety-boat requirements? | 6 | Partial | Represented; off by default; per-day blind spot (F04, F06). |
| 364 | Missing equipment spotted before the session? | 8 | Working | Shortfalls per slot, maintenance and clashes. |
| 365 | An office manager without spreadsheets alongside? | 7 | Partial | Yes for staff, roster and pay preparation; students and bookings stay in the booking system; pay goes out through a payroll provider (CSV). |
| 366 | What would a centre still do outside ActivityRoster? | — | — | Student bookings and lists; paying staff (payroll provider); checking certificates with the RYA; incident and accident reports; boat maintenance logs beyond a note; club duty swaps. |
| 367 | What important workflow is still missing? | — | — | Weather cancellation across courses (F39); qualification requirements per role (F10); "next booked" per boat (by decision); unpublish (F27). |
| 368 | What would stop a centre replacing its current system? | — | — | Trust in the checks: defaults off (F06) and the per-day gaps (F02, F04, F05). Also the staff app not yet in the App Store / Google Play (Apple enrolment waits on the D-U-N-S number; the web app works meanwhile). |

## Part Y. Security red team

| # | Attempt | Score | Status | Result |
|---|---|---|---|---|
| 369 | Cross-centre data access | 10 | Working | Nothing found (Probe P13, isolation suite, R2 prefix checks). |
| 370 | Instructor → admin | 10 | Working | Browser. Every office page and export redirected; server actions check permission. |
| 371 | Office admin → superadmin | 9 | Working | Code. Owner-only actions require the owner; admins can't change their own features. |
| 372 | Parent → instructor or admin | 9 | Working | Code. A parent has only `parent.view`; the app finds no instructor record. |
| 373 | Stale sessions | 9 | Working | Code. Membership per request; password reset revokes sessions. |
| 374 | Direct API calls bypassing the UI | 9 | Working | Code + Browser. |
| 375 | IDOR with another record's ID | 10 | Working | Probe P13. |
| 376 | Duplicate writes | 9 | Working | Probe P3. |
| 377 | Race conditions | 6 | Partial | Assignments safe (Probe P2); PIN lockout not (Probe P12, F07). |
| 378 | Bypassing rate limits | 6 | Partial | PIN (F07); public KV limits slightly (F25). |
| 379 | Deleted records | 9 | Working | Anonymised and deleted records not reachable; cancelled sessions only by admins. |
| 380 | Old or generated documents | 9 | Working | PDFs aren't stored; replaced files are deleted. |
| 381 | Sensitive R2 files | 10 | Working | Prefix check, permission, instructor's own-folder check. |
| 382 | Payroll values manipulated in the browser | 9 | Working | Pay worked out on the server from stored rates; edits need the Payroll tick and pass validation. |
| 383 | Staffing or qualification checks manipulated in the browser | 8 | Working | Checks run on the server; "override" needs Roster permission and is logged (reason optional on one path, F37). |
| 384 | Bypassing PIN, 2FA or device checks | 6 | Partial | 2FA and device gates hold; the PIN can be brute-forced in parallel (F07). |
| 385 | Bypassing Ghost Mode's write block | 9 | Working | Code. Every server action refused in Ghost Mode (`require.ts:63`), the repository refuses writes, and API POST routes check too. |
| 386 | Malformed or unexpected values to every important action | 8 | Working | Code. Validation on inputs; impossible calendar dates accepted (F13). |

**Successful bypasses (security findings):**

- **SF-1 PIN lockout** bypassed with parallel guesses (F07, P1).
- **SF-2 Sign-in hint** reveals whether an email has 2FA, without signing in (F23, P2).
- **SF-3 Push notices** keep reaching signed-out or removed devices (F17, P2).
- **SF-4 Sensitive exports without step-up:** the emergency sheet, young-worker register, payroll spreadsheet and change-log export don't ask for the PIN again (F18, P2).
- **SF-5 Account pre-registration** (F24, P2). Likely from Better Auth's behaviour, but needs a manual test to confirm.

Compliance rules can also be bypassed (F02, F03), but those are rostering-safety issues, not security holes: only office users with Roster permission can reach them.

---

## Part Z. Final release decision

**387. Would you let a real sailing school rely on ActivityRoster for its daily roster today?**
Not quite yet. After the three blockers are fixed (F01–F03) and the centre switches on ratio, safety-cover and ticket checks: yes.

The roster itself is reliable:
- duplicate and parallel bookings are prevented
- cancelled sessions leave every output
- times are right all year
- the PDF, emergency sheet, app and digest agree

What it can't yet be trusted to do is enforce its own rules on two everyday paths: adding someone for one day, and editing a session after it's staffed. On a camp with under-18 assistants that matters.

**388. Would you let a centre rely on it for payroll today?**
Not as the only check until F01 is fixed, and F12 (breaks) and F38 soon after. Once fixed, yes as payroll *preparation*: hours and pay worked out from the roster, approved line by line, exported to the centre's payroll provider.

It isn't a payroll system: no tax, National Insurance or payslips. The safeguards around approval are good: approved lines are frozen, roster changes are flagged, rebuilds create no duplicates.

**389. Would you let a centre store sensitive under-18, guardian and emergency information today?**
Yes:
- contacts are encrypted
- access needs its own feature tick
- every view is logged
- the change log can't be altered
- retention and anonymisation work
- parental permission is recorded and can be withdrawn

Two improvements to make soon: ask for the PIN again before the emergency sheet and young-worker register (F18), and stop push notices reaching signed-out phones (F17).

**390. Would you let it handle a 100+ person seasonal workforce?**
Not comfortably yet. The data model and the main pages are bounded. But four things will start to hurt at that size:
- notifications are sent one by one inside the request (F35)
- a few pages read whole tables (F20)
- "Refresh from roster" can hit D1's per-request limit (question 256)
- the roster board is hard to read on a laptop (F22)

These are P2 fixes. For a 20–40 person centre it's fine.

**391. The five biggest remaining risks**
1. Under-18 rules bypassed on everyday paths: per-day add and session edits (F02, F03).
2. A day with no safety boat missing from the problems list (F04).
3. Cancellation paying an edited line (F01).
4. The hourly job (retention, email retries, reminders) stopping unnoticed (F08).
5. PIN lockout bypassed by parallel guessing (F07).

**392. The five biggest remaining UX problems**
1. The roster board cuts names and roles on a laptop (F22).
2. The safety checks are hidden behind Settings and off by default; the setup checklist doesn't mention them (F06).
3. The course card and the roster can disagree about cover (F04).
4. Tables on phones, payroll especially (question 329).
5. Problems can't be resolved from the list, and there's no "what changed since you last looked" (questions 16, 23).

**393. The five biggest remaining RYA gaps**
1. No qualification requirements per role: a Safety Boat Driver needs no powerboat qualification, and an Assistant can lead (F10).
2. Expired instructor qualifications still count as "can teach" (F10).
3. Per-day staffing invisible to the ratio and safety-cover checks (F04).
4. One person counted twice for ratio or as their own safety cover (F11).
5. No weather cancellation across a whole afternoon's courses (F39). Club duty rostering for volunteer clubs is basic (question 357).

**394. The five biggest technical risks**
1. Two code paths for cover (per course and per session) that disagree (F04).
2. Money in two columns (pounds and pence), the root of F01.
3. Several edits aren't all-or-nothing and have no stale-edit check (F14).
4. No end-to-end browser test (F32).
5. No monitoring of the background job (F08).

**395. What could still cause incorrect rostering while the screen looks fine?**
- per-day adds that skipped the checks (F02)
- session edits after assignment (F03)
- people marked as left still counted as cover (F09)
- one person counted in several roles (F11)
- an impossible date hiding a session (F13)
- checks a centre never switched on (F06)

**396. What could still cause incorrect payroll while the payroll screen looks right?**
- an edited line cancelled with "pay nothing" (F01)
- breaks across two sessions in one day (F12)
- an edited line kept after the person was removed (F38)
- the default rate on a per-day add after a rate correction (F34)
- clock-in/out across the October repeated hour (edge case, question 204)

**397. What could still expose one centre's data to another?**
Nothing found. Every route to centre data goes through the repository, which adds the centre to every read and write. A CI test fails if a new centre table isn't covered, and R2 keys are checked against the centre's prefix.

The remaining theoretical paths:
- raw SQL written outside the repositories (none exists today)
- a new storage helper that builds keys by hand

Both would be caught in review.

**398. What hasn't been tested enough because it needs real users or devices?**
Listed in section 9 below.

**399. What must be fixed before the first paying customer?**
Absolutely: F01, F02, F03.
Strongly, in the same push: F06 (checks on by default; makes the website claim true), F04, F05, F07, F08, F09, and F10's expired-qualification part.

**400. What can safely wait until after the first paying customers?**
All of P2 and P3:
- scale (F20, F35)
- UX polish (F22, F36)
- unpublish (F27)
- "next booked"
- overnight sessions
- overtime
- weather cancel across courses (F39)
- end-to-end tests (F32): important, but not a launch blocker

**401. Is the platform genuinely production-ready?**
**NO — specific blockers remain** (F01, F02, F03). They're small: together about a day's work, with tests.

**402. Final overall score: 7.5 / 10.**

**403. Compared with the previous audit (8.0 on 5 October)**
The score is lower, but the platform hasn't got worse. Two things changed.

*This audit looked harder.* It covered 405 questions, including failure, race and red-team testing, and ran 15 probes against a real database. The earlier re-score read the code.

*Since 5 October, these improved:*
- stale-edit protection on course staffing, kit, location and pay lines
- the post-save clash re-check for two admins
- all-or-nothing assignments, cancellations, per-day changes and course creation
- payroll reading only the selected period
- equipment warnings and kit rules
- a better invite email
- "who can see this" on payroll
- fair-use limits
- feature requests
- the company number on every legal surface

*What pulled the score down:*

| Area | 5 Oct | Now | Why |
|---|---|---|---|
| Dashboard | 8.0 | 7.0 | Problems list misses per-day cover; no cover problems at all with default settings (F04, F06). |
| Courses | 8.0 | 7.5 | Edits re-check but don't block; edited pay survives cancel (F03, F01). |
| Roster | 7.9 | 7.0 | Per-day staffing, added in Phase 3, isn't wired into checks, cover or notices (F02, F04, F05); board unreadable at laptop width (F22). |
| Availability | 8.4 | 8.0 | Bulk Busy doesn't alert the office (F15). |
| Staff | 8.2 | 8.0 | Left staff stay rostered (F09). |
| Equipment | 7.5 | 7.5 | Unchanged. |
| Payroll | 8.0 | 7.0 | F01, F12, F38 found by probes. |
| Security | 9.0 | 8.0 | PIN race (F07); export step-up only partial (F18); push after sign-out (F17). |
| Staff app | 8.3 | 7.5 | Push after sign-out; no kit shown; device behaviour still untested. |
| Technical | 8.1 | 7.0–7.5 | No job monitoring (F08); some unbounded reads (F20); no E2E (F32). |
| Centre separation | 9.0 | 9.5 | Re-tested with attack probes: nothing found. |

**404. Final issue list (only issues that still exist):** the issue register at the top of this document: P0 F01–F03; P1 F04–F10; P2 F11–F20, F22–F24, F32, F35, F37–F39; P3 F21, F25–F31, F33, F34, F36.

**405. "Nothing found" checklist**

| Area | Checked and nothing found |
|---|---|
| Security | No cross-centre access, instructor → admin escalation, admin → superadmin escalation, IDOR, stale-session use or Ghost Mode write. Sign-in rate limits are atomic. Audit logs are append-only. Webhooks are signature-checked. R2 files are scoped. |
| Data integrity | No duplicate assignments, pay lines, availability or published weeks under parallel requests. Course creation and assignment are all-or-nothing. Foreign keys are consistent. Migrations are additive. |
| Tenant isolation | Every centre table is in the isolation suite (CI gate); every lookup, list, write and delete is scoped; exports, background jobs, email links and R2 are scoped. |
| Payroll | Pay comes from the roster. Approved lines are frozen and flagged on change. Rebuilds are idempotent. Volunteers are excluded by default. CSV matches the screen. Period summary is accurate. |
| Roster | Cancelled sessions leave every output. Times are identical everywhere, all year. Two admins can't double-book someone. Delete is refused for anything used. Publish notifies course-level staff. PDF, emergency sheet, digest and app agree. |
| RYA workflows | Ratios, safety cover, ticket expiry, young workers' hours, parental permission, welfare officer on duty, the emergency sheet and the morning email fallback all exist and work on the whole-course path. |

---

## 1. Executive verdict

ActivityRoster does what it promises and is solid underneath:
- **Centre separation** is excellent: nothing found in code, tests or deliberate attacks.
- **Sign-in and the audit trail** are strong.
- **Data integrity** held up: duplicates, double-clicks and two admins at once all failed to produce a bad roster or duplicate pay.
- **The everyday flow works:** sessions, staff, publishing, confirmations, cancellations, the PDF, the emergency sheet and payroll preparation.

What stops it being ready today is consistency, not missing features. The per-day staffing added in Phase 3, and edits made after a course is staffed, don't go through the same checks, cover calculation and notifications as a normal assignment. So:
- a 16-year-old can be rostered for a day without a parent's permission
- a time change can push them past their legal hours
- a day without a safety boat can be missing from the problems list

One payroll bug can also pay a cancelled session. All three blockers are small fixes. With them done, the safety checks switched on by default, and the P1 list worked through in the first weeks, ActivityRoster is fit to replace a generic rostering tool at an RYA centre.

## 2. Final score

**Overall: 7.5 / 10.** Roster, RYA functionality and payroll count double.

| Area | Score |
|---|---|
| UX | 7.5 |
| Roster | 7.0 |
| Courses | 7.5 |
| Availability | 8.0 |
| Staff | 8.0 |
| RYA functionality | 6.5 |
| Payroll | 7.0 |
| Equipment | 7.5 |
| Mobile | 7.5 |
| Security | 8.0 |
| Privacy | 8.5 |
| Multi-tenancy | 9.5 |
| Reliability | 7.0 |
| Performance | 7.0 |
| Testing | 7.5 |
| Website / sales funnel | 8.0 |

## 3. Remaining P0 issues

1. **F01:** cancelling a session ("pay nothing" or "fee") keeps an edited pay amount. `lib/services/cancel.ts`.
2. **F02:** adding someone for one day skips tickets, qualifications, parental permission and young workers' hours. `lib/services/session-staff.ts`.
3. **F03:** editing a session's time, or adding a session, after people are rostered never blocks; young workers' legal limits can be broken in "block outright" mode. `app/(app)/office/courses/actions.ts`.

## 4. Remaining P1 issues

4. **F04:** cover (ratio and safety boat) is worked out three ways; the problems list misses per-day gaps.
5. **F05:** publish, cancel and move notices ignore per-day staffing.
6. **F06:** ratio, safety-cover and ticket checks are off for new centres, while the website says they're on.
7. **F07:** PIN lockout bypassed by parallel guesses.
8. **F08:** no alert when the hourly job stops.
9. **F09:** marking someone as left keeps them on future sessions.
10. **F10:** expired instructor qualifications still count; roles carry no qualification requirements.

## 5. Remaining P2 and P3 issues

**P2:**
- F11 one person in several roles
- F12 breaks per session
- F13 impossible dates
- F14 non-atomic edits without a stale check
- F15 bulk Busy not alerting the office
- F16 parent view (unpublished weeks, per-day staffing)
- F17 push after sign-out
- F18 step-up on sensitive exports
- F19 retention failures and the Monday digest
- F20 unbounded reads
- F22 board readability
- F23 2FA hint
- F24 pre-registration (to confirm)
- F32 no end-to-end test
- F35 sequential notifications
- F37 override reason optional
- F38 edited line kept after removal
- F39 weather cancel across courses

**P3:**
- F21 hydration mismatch
- F25 KV limits
- F26 secret in URL
- F27 unpublish
- F28 inactive location
- F29 cancel/restore notice rule
- F30 leave approval details
- F31 past days this week
- F33 ownership transfer in one batch
- F34 per-day pay rate
- F36 phone header on Courses

## 6. Top 10 improvements, by business impact

1. **One "who is on this session" path for everything:** checks, cover, notices, parent view (F02, F04, F05, F16). This removes most of the inconsistency in one piece of work.
2. **Make edits as safe as assignments:** block or require an override for young-worker breaches and clashes on session edits, saved all-or-nothing (F03, F14).
3. **Payroll you can trust:** the cancel pence fix, breaks per day, edited lines flagged on removal (F01, F12, F38).
4. **Safety checks on from day one:** on by default, a setup checklist step, and the website claim true (F06).
5. **An RYA qualification model:** expired qualifications excluded, qualification requirements per role (Safety Boat Driver, lead instructor), each person counted once (F10, F11).
6. **Know when the platform's background work stops:** a tick heartbeat, sweep failures shown, an email alert (F08, F19).
7. **Leavers handled properly:** "mark as left" clears future sessions with notices (F09).
8. **Close the security gaps:** atomic PIN lockout, step-up on the emergency sheet and register, push tokens cleared at sign-out (F07, F18, F17).
9. **Run the roster on a laptop:** a readable board, plus "cancel this afternoon" for weather (F22, F39).
10. **Confidence at scale:** an end-to-end smoke test in CI, bounded reads, batched notifications (F32, F20, F35).

## 7. RYA readiness

**Yes, ActivityRoster can replace a generic rostering system at an RYA sailing school or club**, and it already does things generic tools can't:
- course ratios and safety-boat cover
- ticket and DBS expiry blocking
- young workers' hours from versioned rule packs
- parental permission
- per-day camp staffing
- a welfare officer on duty
- the emergency sheet and morning roster email

Before a centre relies on it:
- fix F02 and F03 (the under-18 rules must hold on every path)
- switch on the checks (F06)

In the first weeks:
- make cover per-day aware (F04)
- add qualification requirements per role (F10)

A volunteer-heavy club will find club duties basic: they can only be modelled as courses, with no duty swaps.

## 8. Production-readiness verdict

**What prevents launch: F01, F02 and F03, nothing else.**

What should accompany the launch:
- deploy `df874ed` (company number); production is at `4c7f998`
- switch ratio, safety-cover and ticket checks on by default (F06)
- a tick heartbeat alert (F08)

The rest of P1 can follow in the first weeks of real use. P2 belongs before centres of 100+ staff.

## 9. Manual testing still required

**Phones:**
- Face ID and PIN fallback on a real iPhone and Android phone
- push notifications arriving on each
- the offline week after airplane mode
- the rebuilt iPhone app
- a change attempted while offline

**Email:**
- deliverability (DMARC still "none"; switch to quarantine once reports are clean)
- the retry queue against a real provider outage

**Sign-in edge cases:**
- 2FA by authenticator and by email
- recovery email
- password reset
- the new-country check from a VPN
- whether F24 (pre-registration) really lets a stranger's password work after a magic-link sign-in

**Real conditions:**
- two admins on real D1 (latency between steps) editing the same week
- a production-sized centre (100+ staff, three seasons): page timings and the "Refresh from roster" request limit

**Live services:**
- Stripe live checkout, portal, webhooks and invoices
- the Cloudflare tick worker's run history (Cloudflare dashboard → Workers → roster-tick → Logs)

**Accessibility:**
- keyboard-only use of the roster board
- a screen reader on the main office pages

**Setup:**
- a first-time centre walking through the wizard and abandoning it halfway

## 10. Final recommendation

**NOT READY — FIX BLOCKERS FIRST.**

There are three blockers (F01, F02, F03), all small and well understood. Once they're fixed and tested: **READY TO LAUNCH WITH CONDITIONS**. The conditions are safety checks on by default (F06), a background-job alert (F08), and the P1 list worked through in the first weeks of real use.
