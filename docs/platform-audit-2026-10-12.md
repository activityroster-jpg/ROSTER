# ActivityRoster: full platform audit, 12 October 2026

12 October 2026 · code at `963f3e5` (production is `35103f9`) · follows the final audit of 8 October (`docs/platform-final-audit-2026-10-08.md`)

## Headline

**Score: 7.6 / 10 (was 7.5). Recommendation: NOT READY — FIX TWO BLOCKERS FIRST.** Both are small and well understood. Once they're fixed: **READY TO LAUNCH WITH CONDITIONS**.

The two blockers:

1. **Safety boat drivers are judged on whether they can teach the course.** The "qualified for this course type" check runs for every role, including Safety Boat Driver and Volunteer. A driver who isn't an instructor for Youth Stage 1 turns the session red, is refused when assigned (unless overridden), and is skipped by Auto-roster. This is the red "Not an instructor for this course type" card in Conor's screenshot of Mateo García.
2. **Cancelling a session can still pay it** (F01 from 8 October, still open). If the office had edited the pay on a line, cancelling with "pay nothing" keeps the edited amount. Re-tested tonight: £75 still paid, with the note "Session cancelled: not paid".

Since 8 October, 70 commits changed 366 files. The biggest risks from that audit have gone: the under-18 working-time rules and parental permission were removed by decision, which takes away two of the three old blockers' worst consequences. Centre separation is still the strongest part: nothing found in code, tests or attacks. The new roster tools (coloured cards, the green/orange/red people picker, Auto-roster, Move here, Assign all, choosing who comes off) work as designed in the browser.

Tonight's audit also found and fixed three bugs in work done the same day, and corrected the out-of-date copy on the website and in the Learning Centre (section 5).

---

## 1. How this audit was done, and its limits

**Four kinds of evidence**, named against every finding:

- **Code**: every commit since `df874ed` read, plus the services, domain rules and screens they touch: assignment, per-day staffing, staffing and role places, the roster board, availability, Auto-roster, pay, prospects, the stall guard and the build check.
- **Probe**: a throwaway test run against a real SQLite database through the real services (not committed; results quoted). Seven probes: cancellation pay, one-day adds, clashes, choosing who comes off, zero-staff courses, pay per student, and reaching another centre's course.
- **Browser**: the real app run locally with the busy demo centre (Lough Shore, 42 sessions a week). Every office page and export was opened as the owner and while signed out. The main pages were screenshotted at laptop (1360 px) and phone (390 px) widths. The session panel, people picker and Auto-roster dialog were driven by hand.
- **Suite**: 135 test files, 583 tests, all passing at `963f3e5`. Typecheck clean.

**Limits:**

- **No real phones, no live email, no Stripe.** Same as 8 October.
- **No production traffic.** Load was judged from query shapes. The freeze Conor saw is covered in section 4.
- **Local `/admin` redirect loop.** On the local harness `/admin` on a centre address looped, because the local proxy and the apex use different ports. Production was checked separately by the probe workflow and is fine.
- **Not every 8 October finding was re-tested.** Section 3 says which were.

**Priority:** P0 = must fix before real centres rely on it · P1 = important before or early in real use · P2 = before scale · P3 = later.

---

## 2. What changed since 8 October

| Area | What was added or changed |
|---|---|
| Roster board | Session cards coloured by state (green filled, orange open, red problem); Auto-roster with "fill open roles" or "redo the whole week"; Assign anyway in place of the override tick; Move here / Keep on both for a clash; Assign all; picked people leave the other lists; add another role; choose who comes off |
| People pickers | One order everywhere: qualified and free, qualified but busy (saying why), not qualified or not cleared; shaded sections |
| Courses | Two-column role rows with Change and Assign in place; roles listed by seniority; removing every role means no staff needed |
| Availability | Assign or edit switch; "Currently on" with Move here; person week view; now reads the same week data as the board |
| Activity packs | RYA centre/school or PADI dive centre at sign-up; PADI lists; hidden `/diving` page; centre type on prospects and in the Dev Center |
| Pay | One Pay rates tab; pay per student |
| Staff and safety | Parental permission, parent logins, working-hours rules and staff medical notes removed |
| Reliability | Reload bar when a new build is live; stall guard (a save with no answer in 25 s is cancelled); probe workflow every two hours |
| Sign-in | Dev Center door at `/dev`; www redirects to the apex; sign-in links land in the right place; PIN digits hidden with View PIN |
| Dev Center | Prospects pipeline, printed letter batches, LinkedIn research import, task planner categories |
| Outputs | Rota PDF with role initials and an all-day welfare line; day per page |

---

## 3. The 8 October findings, re-checked

| # | Finding (8 Oct) | Status now | Evidence |
|---|---|---|---|
| F01 | Cancelling keeps an edited pay amount | **Open — P0** | Probe P1: £75 paid, note "not paid". `lib/services/cancel.ts` writes `overridePay` only; payroll reads `overridePayPence` first. |
| F02 | One-day add skips safety checks | **Partly open — P1** | Under-18 rules removed, so the worst case has gone. Probe P2: with First Aid mandatory and expired, the whole course refuses and a one-day add accepts. Qualification for the course type is also skipped. The board warns before you press, so this matters most for direct or automated paths. |
| F03 | Editing a session after staffing never blocks | **Open — P2** (was P0) | Legal hours no longer apply. A time change can still create a clash; it is listed afterwards, not refused. |
| F04 | Cover worked out three ways | **Open — P1** | The problems list still judges cover per course, against its first day. |
| F05 | Notices ignore per-day staffing | **Fixed for publish** | `lib/services/roster.ts` now uses effective per-day staff. Cancel and move notices not re-tested. |
| F06 | New centres start with ratio and licence checks off | **Open — P1** | Still off by default (`enforceRatioChecks`, `enforceLicenceChecks`), and no compliance type is mandatory by default. The website says these are checked on every assignment. See N04. |
| F07 | PIN lockout beaten by parallel guesses | **Open — P1** | `recordPinFailure` still reads then writes. |
| F08 | No alert when the hourly job stops | **Open — P1** | No heartbeat check found. |
| F09 | Marking someone as left keeps them on future sessions | **Open — P1** | `setInstructorStatusAction` doesn't touch assignments. |
| F10 | Expired instructor qualifications still count | **Open — P1** | Teaching matrix ignores qualification expiry. |
| F11 | One person in several roles on a session | **Fixed** | Assigning a second role on the same course is refused. |
| F12 | Breaks per session, not per day | Open — P2 | Unchanged. |
| F13 | Impossible dates accepted | Open — P2 | No real-date check added. |
| F14 | Edits not all-or-nothing | Partly fixed | Staffing saves are one batch; session time edits still aren't. |
| F16 | Parent view shows drafts | **Gone** | Parent view removed. |
| F21 | Courses page dates differ server vs browser | Open — P3 | Browser: hydration mismatch on Courses at both widths. |
| F22 | Roster board cuts names at 1360 px | **Fixed** | Browser: full course names and times readable at 1360 px. |
| F26 | Hourly job secret accepted in the URL | Open — P3 | `?secret=` still read. |
| F27 | A published week can't be unpublished | Open — P3 | Unchanged. |
| F32 | No end-to-end browser test in CI | Open — P2 | Unchanged. |
| F35 | Notifications sent one by one inside the request | Open — P2 | Unchanged; now also interacts with the stall guard (N02). |
| F37 | Course card override needed no reason | **Gone by design** | No override asks for a reason now; each records the checks it overrode, who and when. |
| F39 | No "cancel everything this afternoon" | Open — P3 | Unchanged. |

Not re-tested tonight: F15, F17–F20, F23–F25, F28–F31, F33, F34, F36, F38. Their code wasn't touched since 8 October, so the 8 October status stands.

---

## 4. New findings

### P0

**N01. The course-type qualification check runs for every role, including Safety Boat Driver and Volunteer.**
- **Problem:** "Is this person an instructor for this course type?" is asked of everyone on a session, whatever their role. A powerboat-qualified driver on a Youth Stage 1 session fails it.
- **Evidence:** Browser: Youth Stage 1 (Oppies), Monday, shows "⚠ Aidan Rafferty: Not an instructor for this course type" for the Safety Boat Driver, and the card is red. Conor's screenshot earlier today showed the same for Mateo García.
- **Why it matters:** red cards that aren't real problems teach the office to ignore red. Assigning a driver needs an override every time, and Auto-roster can't fill safety-boat places with non-instructors.
- **Where:**
  - `lib/services/problems.ts:150-155` (problems list)
  - `lib/services/assignment.ts:136-144` (assign refuses)
  - `components/office/RosterBoard.tsx`, `issuesFor` and `candidateFacts` (picker order and buttons)
  - `lib/domain/auto-roster.ts` (planner filter)
  - `lib/services/session-staff.ts` (when F02 is fixed)
- **Fix:** apply the course-type qualification check only to roles that count towards the ratio (the teaching roles). Safety-cover roles should instead be checked against their own requirement (for example a powerboat licence) once roles carry qualification requirements (F10).
- **Priority:** P0.

**F01** (above) is the other blocker.

### P1

**N02. The stall guard can cancel a save that is still working.**
- **Problem:** every save gets 25 seconds on the page. Some legitimately take longer on a big week: publish (notifications one by one, F35), Auto-roster "Redo the whole week", and bulk staffing changes. The page cancels its wait and says "That didn't go through", but the server carries on and finishes.
- **Why it matters:** the office is told a save failed when it worked, and may press again.
- **Where:** `components/ActionFailureWatcher.tsx` (`ACTION_STALL_MS`).
- **Fix:** let known long actions run longer (or run them as a background job with progress), and word the stalled message as "may still be finishing: reload to check".
- **Priority:** P1.

**N03. "Redo the whole week" is not all-or-nothing and has no undo.**
- **Problem:** it takes everyone off the week one by one, then refills. If the request dies part-way (timeout, connection), the week is left half cleared. Confirmed people are told they've been taken off, then told again when they're put back.
- **Where:** `autoRosterAction` in `app/(app)/office/rota/board-actions.ts`.
- **Fix:** plan the new week first, then apply removals and additions in one batch; only notify people whose sessions actually changed. Offer "undo" from the change log for the run.
- **Priority:** P1.

**N04. The website promises checks that a new centre has switched off.**
- **Problem:** the homepage, pricing page and Courses page say every assignment is checked for licences, ratios and safety-boat cover, and "Won't roster the under-qualified". A new centre starts with ratio and licence checks off and no compliance type marked mandatory, so none of those block or appear in the problems list until the centre changes Settings.
- **Why it matters:** a centre that relies on the claim gets no warning about a lapsed first aid certificate or a short ratio.
- **Fix (Conor's decision):** either switch ratio and licence checks on for new centres and mark First Aid and Safeguarding mandatory in the RYA pack (recommended), or soften the copy to "can be checked".
- **Priority:** P1.

### P2

| # | Problem | Where | Fix |
|---|---|---|---|
| N05 | The availability panel now reads the whole week's board on every cell click. Correct (it fixed the mismatch Conor found), but heavier than before. | `assignableForCellAction` | Cache the week's board for the page, or read one day. |
| N06 | Auto-roster redo notifies confirmed people twice (off, then on again) when they end up on the same sessions. | `autoRosterAction` | Diff before notifying (part of N03). |

### P3

| # | Problem | Where | Fix |
|---|---|---|---|
| N07 | `/api/version` tells anyone which commit is live. | `app/api/version/route.ts` | Return a short hash or a hash of it. |
| N08 | The people picker can't be worked with the arrow keys; options are reachable with Tab only. | `components/office/PeoplePicker.tsx` | Arrow-key navigation and Enter to pick, as a standard listbox. |

### The freeze Conor saw

Not reproduced locally. What's in place since 19:27: the reload bar for a new build, and the stall guard that stops one stuck save freezing the tab. Cloudflare's firewall log showed only blocked scanners. The cause of a stuck save on the server is still unknown; the "[stalled]" and "[slow]" entries in Dev Center → Errors will name it.

---

## 5. Fixed during this audit

Found in work from earlier the same day, fixed, tested and pushed (`963f3e5`):

- **R1. A fully staffed course read "understaffed".** An explicit role total (Instructor + Instructor + Safety Boat = 3) was compared with ratio-counting staff only, so the driver didn't count. It now counts everyone assigned. Test added.
- **R2. "Add another role" on a no-staff course** started from the ratio's suggestion instead of nothing.
- **R3. Choosing who comes off ignored people on for one day.** They could be ticked but stayed on. Probe P4 confirms the fix.

**Copy corrected:**

- **Learning Centre:** Rostering, roster board and availability now describe Assign anyway, Move here / Keep on both, Assign all, choosing who comes off, zero-staff courses, coloured cards and the board/sheet staying in step. The old "tick assign anyway" wording and a duplicated bullet are gone.
- **Dive-centre page:** says pay per student is built (it said "on the way") and that an override is one press, recorded with the reason.
- **Homepage, pricing, compare:** "swaps" replaced with "open shifts" (there is no swap feature, only shared contact details and open shifts). "Admin, senior instructor and welfare officer" replaced with what's true: office admins see the parts ticked for them, instructors their own shifts, welfare officers on duty show on the roster. Pay by hour, session, day or student mentioned.
- **Landing pages:** no longer say an override "asks for a reason".
- **Checked and correct:** no remaining parental-permission, working-hours, medical-notes or three-centre-type references; under-18 guardian contacts remain on purpose. A frequency-based typo scan of all user-facing text found no misspellings.

---

## 6. Browser results

| Page | Owner | Signed out | Time (local dev) | Notes |
|---|---|---|---|---|
| Dashboard | 200 | → sign-in | 2.7 s | |
| Roster | 200 | → sign-in | 2.8 s | Card colours clear; full names at 1360 px |
| Availability | 200 | → sign-in | 1.5 s | |
| Courses | 200 | → sign-in | 1.6 s | Hydration mismatch (F21) |
| Staff, Payroll, Settings, Change log, Billing, Emergency sheet | 200 | → sign-in | 0.8–2.5 s | |
| Whole-centre export | 403 until PIN re-entered | → sign-in | | Step-up working |
| Rota PDF, emergency PDF, payroll CSV | download | → sign-in | | |

- **No sideways scrolling** on any page at 1360 or 390 px.
- **Session panel:** roles listed by seniority; issues under names; "Add another role" set apart; the old override tick is gone.
- **Picker:** three shaded groups, with "on another course: Summer Sailing Camp, week 3" for the busy group.
- **Auto-roster dialog:** both choices shown, button wording follows the choice.
- **PIN screen:** digits hidden, View PIN works.

---

## 7. Scores

**Overall: 7.6 / 10** (8 October: 7.5). Roster, RYA functionality and payroll count double.

| Area | 8 Oct | 12 Oct | Why it moved |
|---|---|---|---|
| UX | 7.5 | 8.0 | Coloured cards, clearer pickers, Assign all, guides up to date |
| Roster | 7.0 | 7.5 | Auto-roster, Move here, sheet and board agree; held back by N01 |
| Courses | 7.5 | 7.5 | Role rows clearer; zero-staff fixed |
| Availability | 8.0 | 8.5 | One source with the board; Move here refreshes |
| Staff | 8.0 | 8.0 | |
| RYA functionality | 6.5 | 6.5 | Safety-boat qualification wrong (N01), checks off by default (N04), expiry ignored (F10) |
| Payroll | 7.0 | 7.0 | Pay per student added; F01 still open |
| Equipment | 7.5 | 7.5 | |
| Mobile | 7.5 | 7.5 | |
| Security | 8.0 | 8.0 | PIN hidden; F07 still open |
| Privacy | 8.5 | 9.0 | Medical notes and parent data removed |
| Multi-tenancy | 9.5 | 9.5 | Probe P4 and P7: another centre's people and courses can't be touched |
| Reliability | 7.0 | 7.5 | Reload bar, stall guard; N02 and N03 to tidy |
| Performance | 7.0 | 7.0 | |
| Testing | 7.5 | 7.5 | 583 tests; still no browser tests in CI |
| Website / sales | 8.0 | 8.0 | Copy corrected; N04 decision outstanding |

---

## 8. Top 10, by business impact

1. **N01** qualification check only for teaching roles. Removes most of the false red cards.
2. **F01** cancellation pay writes both columns.
3. **N04 / F06** switch ratio and licence checks on for new centres and mark First Aid and Safeguarding mandatory (or soften the copy).
4. **N03** make "Redo the whole week" one batch and notify only real changes.
5. **N02** longer allowance for long saves, and honest wording when the page stops waiting.
6. **F02** run the same licence and qualification checks on one-day adds.
7. **F04** one cover calculation, per session, for the problems list too.
8. **F09** marking someone as left takes them off future sessions (with a confirmation).
9. **F07** atomic PIN failure count.
10. **F08** alert when the hourly job hasn't run.

---

## 9. Production-readiness verdict

**NOT READY — FIX TWO BLOCKERS FIRST (N01, F01), then READY TO LAUNCH WITH CONDITIONS.**

Conditions for the first centres:
- Turn ratio and licence checks on in their Settings, and mark the checks they rely on as mandatory, until N04 is decided.
- Treat Payroll as preparation, approved line by line, until F01 ships.
- Prefer "Fill the open roles only" over "Redo the whole week" until N03 ships.

---

## 10. Manual testing still required

- On a phone: the instructor app, push notices, Face ID and the offline week.
- A real publish of a 40-person week on staging, timed, to see whether it passes the 25-second stall allowance (N02).
- Auto-roster "Redo the whole week" on a copy of a real centre's week on staging.
- Email delivery (Resend and Postmark) for invites, codes and roster notices.
- Stripe checkout and the customer portal end to end on staging.
- The freeze: next time it happens, read Dev Center → Errors for "[stalled]" and "[slow]".
