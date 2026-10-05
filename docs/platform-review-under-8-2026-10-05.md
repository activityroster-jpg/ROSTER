# ActivityRoster: everything under 8, and how to lift it

5 October 2026 · follow-up to `docs/platform-rescore-2026-10-05.md` · review only, nothing changed

## How this was done

- **What:** every question that scored 7 or below in the re-score, plus the cross-page workflow checks (the ten-question tables in the original audit) that are still under 8.
- **How:** I read the code behind each one again. I also checked GitHub's run history for the backups and the restore workflow. As before, I did not click through the live app as each type of user.
- **Correction to the re-score:** I said the staff list had no "invite pending" label or resend button. It has both (`InviteInstructorButton`). That question stays at 7, but for a different reason: the invite email itself (item 5).

## The short version

There are **11 questions and 7 workflow checks** under 8. They come down to **nine fixes**:

| # | Fix | Lifts | Now → after | Size |
|---|---|---|---|---|
| 1 | Bound the big page loads, add two indexes, prove it with a "big centre" test | Roster: big centres | 6 → 8 | M |
| 2 | Make the remaining multi-step saves all-or-nothing | Server code; network failure (workflows) | 7 → 9; 6 → 8 | M |
| 3 | "Someone else changed this" check, and settings saved per section | Roster: two admins; two admins and races (workflows) | 7 → 9; 6 → 8 | M |
| 4 | Automatic monthly restore rehearsal into staging | Database backups | 7 → 9 | S |
| 5 | A proper invite email, and "invited 3 days ago" with an automatic reminder | After adding someone | 7 → 9 | S |
| 6 | Quick add: name and email only, invite by default | Adding an instructor | 7 → 8 | S |
| 7 | "Who can see this" on sensitive pages, and a clear "no access" message | Permissions; denied-access feedback (workflows) | 7 → 9 | S |
| 8 | Warn about equipment clashes and shortages when you pick, not later | Equipment workflow; feedback (workflows) | 7 → 8; 6 → 8 | S |
| 9 | Equipment and locations: use the course-type kit rules, maintenance notes, location notes | Equipment (two questions); locations | 7 → 8 | M (needs your decisions) |

S is a session or less, M is one to two sessions. If all nine are done, every question reaches 8 or more. The **overall goes from 8.0 to about 8.4** (the average across all 72 questions from 8.1 to 8.3, because only 11 of them move).

---

## 1. Roster: copes with big centres (6/10)

**What I found.** The problems checks are bounded by date now. But four places still load a centre's whole history on every visit:

- **Courses page:** every course, every session ever, every assignment (`app/(app)/office/courses/page.tsx`).
- **Payroll:** every pay line, every session, every clock entry, then filters by period in memory (`lib/services/finance.ts`).
- **Roster board:** every session and every course to draw one week (`lib/services/board.ts`).
- **Assigning someone:** every session in the centre and every compliance record for every instructor, on each tap (`lib/services/assignment.ts`). Bulk assign repeats that for each course.

Also, pay lines have no index on their session, so "which lines belong to these sessions" scans the whole table.

**Why it matters.** It's fine for a first season. By a busy centre's third season (thousands of sessions), each page and each tap reads all of it. Pages slow down first. In peak season they can hit the Worker's time limit, which shows as an error page.

**Options.**
- **A:** add the missing indexes only. Cheap, but it doesn't stop the whole-history reads.
- **B (recommended):** read only what's needed:
  - Courses page: upcoming courses by date, past ones a page at a time.
  - Payroll: the chosen period only.
  - Board: the week shown, plus a day either side for clashes.
  - Assigning: that instructor's records and the sessions near the course's dates.
  - Plus the two indexes (pay lines by session; assignments by centre and instructor).
  - Plus a test that loads a made-up centre with 60 staff and 5,000 sessions and fails if a page reads more than it should.
- **C:** B, plus caching each week's roster. Not needed at today's sizes.

**Priority:** P2 now; P1 before any centre has around 40 staff or reaches a third season. **Effect on data:** none, indexes only. **Score after B:** 8.

## 2. Saves that can half-finish (Server code 7/10; network failure in workflows 6/10)

**What I found.** Creating a course is now all-or-nothing. These still write step by step, so a dropped connection or a Worker restart part-way leaves a half-finished change:

- **Assigning someone:** adds them, then creates their pay lines, then notifies. If it stops after the first step, they're on the course with no pay lines until someone presses "Rebuild from roster".
- **Cancelling a course or days:** marks each session, then adjusts each pay line one by one, then marks the course. If it stops part-way, some days are cancelled and some aren't, or the days are cancelled but the pay lines haven't been adjusted.
- **This-day-only staffing, editing a course's locations or kit:** removes old rows, then adds new ones. Stopping in between leaves the course with fewer than either version.
- **Setting a usual week:** many rows written one at a time.

**Options.**
- **A:** add a nightly "repair" sweep that rebuilds pay lines from the roster. It patches the symptom but not the cause.
- **B (recommended):** use the same all-or-nothing batch as course creation (`runAtomic`) for each of these. Do all the checks first, write everything in one batch, and only then send notifications. If the batch fails, nothing has changed and the person sees "That didn't save, please try again".
- **C:** B, plus a "pending changes" queue for very poor beach signal. Not needed while the office works from a desk.

**Priority:** P1 for cancelling and assigning (they touch pay), P2 for the rest. **Effect on data:** none. **Score after B:** server code 9, network failure 8.

## 3. Two people editing at once (Roster 7/10; two admins 6/10 and races 7/10 in workflows)

**What I found.**
- **Duplicates are fixed.** Unique keys stop double taps creating two assignments, two availability rows or two pay lines.
- **Last save wins.** If two office admins edit the same course, staffing panel or pay line, the second save silently overwrites the first. Nobody is told.
- **The whole settings form saves as one.** The General tab sends every setting at once (`updateSettingsAction`). If one admin changes the digest hour while another switches off a safety check, whoever saves second quietly puts the other's change back.
- **Double-booking across two courses at the same moment.** Two admins could assign the same person to two overlapping courses in the same second; each check passes before the other's write lands. The problems list now catches this afterwards, which is why races scores 7, not lower.

**Options.**
- **A:** show "last changed by Sam at 10:42" on each course and pay line. Cheap, but it doesn't stop the overwrite.
- **B (recommended):**
  - Every edit form remembers when the record was last changed. If it has changed since the form was opened, the save is refused with "Jo changed this at 10:42. Reload to see their change", rather than overwriting it. Most tables already carry a last-changed time.
  - Settings save per section: only the fields on that card are sent and written.
  - After an assignment is written, the clash check runs again. If a clash appeared in the meantime, the assignment is undone with a clear message.
- **C:** live updates (you see the other admin's change appear). That's a big build and not needed at centre sizes.

**Priority:** P1 for settings per section (a safety check could quietly come back on or go off), P2 for the rest. **Effect on data:** none. **Score after B:** roster 9, two admins 8, races 8.

## 4. Database backups (7/10)

**What I found.**
- **Nightly backups have run every night since 3 October.** They're encrypted, sent to the private EU bucket, with a status email. The latest run passed every step.
- **No restore has ever been practised.** The restore workflow exists (`restore.yml`, "Restore from backup") but has never run, and `docs/restore-tests.md` is empty. A backup you've never restored is a hope, not a backup.
- **The off-site copy only happens if its secrets are set.** That step "passes" either way. The backup email says whether an off-site copy was made; I can't see the secrets from here. Your compliance plan recommends a Backblaze B2 account (EU, object lock).
- **A runner change is coming.** GitHub moves its standard machines to a newer Ubuntu from 19 October. The backup, deploy and restore workflows all use that label, so a tool could break without warning.

**Options.**
- **A:** you press "Restore from backup" into staging once a quarter and log it. It's free, but it relies on remembering.
- **B (recommended):** a monthly automatic rehearsal:
  - restore last night's backup into **staging**, check the row counts match production, and run the smoke test;
  - email you "Restore rehearsal passed, 41 seconds" and log a row in `docs/restore-tests.md` automatically;
  - pin the workflows to a fixed Ubuntu version, so the 19 October change can't break backups or deploys;
  - production is never touched. You'd still do one guided restore yourself, so you know the steps.
- **C:** B, plus a weekly rehearsal. Monthly is enough at this stage.

**Your part:** confirm whether the backup email says an off-site copy was made. If not, open the B2 account (steps in the compliance plan) and I'll wire it.

**Priority:** P1. **Effect on data:** staging only. **Score after B:** 9.

## 5. Staff: what happens after adding someone (7/10)

**What I found.** The staff list already shows "Invite pending" or "Portal access", with an "Invite to portal" or "Re-send invite" button. The weak part is **the invite email**. It's the general sign-in email ("Your ActivityRoster sign-in link"):

- it doesn't name the centre or who invited them;
- it doesn't say what happens next;
- the link expires quickly, so an instructor who opens it the next morning finds it dead and doesn't know why.

The list also doesn't say **how long** an invite has been waiting.

**Options.**
- **A:** reword the shared sign-in email. Small, but it would then mention invites to people who are just signing in.
- **B (recommended):**
  - A separate invite email: "Ellie at Yeadon Sailing Club has invited you to ActivityRoster". It gives three steps (set a password and PIN, mark when you're free, upload your certificates) and says what to do if the link has expired.
  - "Invited 3 days ago" on the staff list.
  - One automatic reminder after 3 days, then nothing more.
- **C:** B, plus a "Resend all pending" button for the start of the season.

**Priority:** P2. Small, but it's the first thing every new instructor sees. **Score after B:** 9 (C: the same).

## 6. Staff: adding an instructor (7/10)

**What I found.** There are four ways in: the form, an emailed invite, CSV import and the app join code. The page leads with a full form (courses, qualifications, checks). Most centres want the instructor to fill in their own details.

**Options.**
- **A:** move "Invite" above the form.
- **B (recommended):** **Quick add:** name and email, with "Send invite" ticked, which creates the record and invites in one step. The full form sits under "Add with all details". And a "Paste a list" box (one person per line) for the start of the season, using the same checks as CSV import.
- **C:** B, plus a QR poster for the join code to pin up in the clubhouse.

**Priority:** P3. **Score after B:** 8.

## 7. Settings: permissions understandable (7/10), and access-denied feedback (workflow 7/10)

**What I found.**
- **"Who can see this" appears only on emergency contacts.** Payroll, staff documents, the emergency sheet, exports and the young-worker register don't say who else can open them.
- **No message when access is refused.** An office admin without a feature who follows a link to it is sent to the dashboard with `?denied=1`. But the dashboard never reads that, so they land there with no explanation.

**Options.**
- **A:** a fixed line on each sensitive page ("Visible to the superadmin and office admins with Payroll ticked").
- **B (recommended):**
  - The same line, but with the **actual names** ("Visible to: Conor (superadmin), Ellie (Payroll)"), so a centre can spot someone who shouldn't have access.
  - A banner when access is refused: "You don't have Payroll access. Ask Conor (superadmin) to tick it under Instructors → Office access."
- **C:** B, plus a monthly "who has access to what" email to the superadmin. Useful later for larger centres.

**Priority:** P2. **Score after B:** 9.

## 8. Equipment → course → roster workflow (7/10), feedback (workflow 6/10)

**What I found.** Equipment clashes, shortages and maintenance now appear on the problems list. But **nothing warns you when you pick the kit.** Saving a course's equipment just says it saved (`setCourseEquipment`), even if that boat is on another course at the same time or you've asked for more Picos than you own. You only find out later on the dashboard.

**Options.**
- **A:** after saving, show any new equipment problems for that course under the save button.
- **B (recommended):** A, plus warnings in the picker itself: each unit shows "On Stage 2, Sat am" or "In maintenance", and bulk kit shows "You have 12, other courses that morning need 10". You can still save; it's a warning, like staff availability.
- **C:** block the save on a clash. Too strict for a sport where plans change on the beach.

**Priority:** P2. **Score after B:** workflow 8, feedback 8.

## 9. Equipment and locations (7/10 each): needs your decisions

**What I found.**
- **Course-type kit rules are built but switched off.** The database has a table for "a Stage 2 needs 1 Pico per 2 students and a safety boat" (`course_type_equipment`). Nothing lets you set those rules and nothing uses them, so every course's kit is picked by hand.
- **Maintenance has no reason or return date.** A unit is "in maintenance" with no "why" or "back on".
- **No equipment summary.** Nothing says, for example, "Picos: 12 (10 available, 2 in maintenance)".
- **"Next booked" stays out,** as you decided.
- **Locations have no notes.** There's nowhere for "meeting point: slipway 2", launch rules or hazards, which instructors would want on the roster and in the app.

**Options and my recommendation.**
- **Kit rules:** **switch them on.** Set them in Course setup beside the staffing rules. A new course pre-fills its kit from the student number (like the staffing panel does for roles), and the quantity check uses them. Otherwise the table should be removed, so it doesn't confuse later work.
- **Maintenance:** add a reason and an expected-back date. The problems list then says "Safety boat 2 in maintenance (outboard), back 14 Oct".
- **Equipment summary:** a count line per type at the top of the page.
- **Location notes:** one short note per location, shown on the roster, the PDF and the instructor app. Plain text only, with a reminder not to put personal details in it.

**Priority:** P3 (they make the product nicer, nothing is broken). **Score after:** equipment 8 (both questions), locations 8.

---

## Also spotted (not scored)

- **Plain browser pop-ups:** about 20 places still use the plain browser "Are you sure?" box instead of the proper confirm dialog (removing a location, revoking a device, sign out everywhere, the prospects tools and others). Swap them over as each screen is touched.
- **Ubuntu runner change on 19 October:** covered in item 4. Worth doing this week whatever else you choose.

## Suggested order

1. **This week (one session):** item 3's settings-per-section fix, item 4 (restore rehearsal and runner pin), item 7, item 5. All small, and they cover safety, backups and first impressions.
2. **Next:** item 2 (all-or-nothing saves for assigning and cancelling first), then the rest of item 3.
3. **Before the first large centre:** item 1.
4. **When you've decided:** items 6, 8 and 9.

## Decisions I need from you

1. Approve the order above, or change it.
2. Monthly automatic restore rehearsal into staging (item 4): yes or no?
3. Course-type kit rules (item 9): switch them on, or remove the table?
4. Location notes shown to instructors in the app (item 9): yes or no?
5. Invite reminder after 3 days (item 5): yes, a different gap, or none?

---

## What was built (5 October 2026)

Conor's answers: order approved; monthly restore rehearsal yes; kit rules built but off by
default; no location notes; invite reminder after one day.

1. **Restore rehearsal** (`.github/workflows/restore-rehearsal.yml`, monthly on the 3rd, and run by
   hand today). It restores last night's backup into a throwaway EU database (not staging,
   because staging can send email), checks every table's row count against the file, applies
   newer migrations and an integrity check, then deletes the throwaway database. The first run
   found that **the raw export could not be loaded** (tables listed alphabetically, so `account`
   came before `user`). Both the rehearsal and the real restore workflow now re-order the file
   first (`.github/scripts/order-export.mjs`, with a test). The rehearsal passed and is logged in
   `docs/restore-tests.md`. All workflows are pinned to Ubuntu 24.04 ahead of GitHub's 19 October
   change.
2. **Settings saved per card.** Each card on Settings → General saves only its own fields.
3. **Who can see this**, with names, on payroll, certs and documents, emergency contacts, the
   emergency sheet and the whole-centre export. A refused page now says which tick is needed and
   who to ask. **Found and fixed while doing this:** the emergency sheet showed emergency and
   guardian contacts to anyone with "Roster & courses". Contacts now need the "Emergency & guardian
   contacts" tick; without it the sheet shows who is on duty only.
4. **Invitations:** their own email (centre and inviter named, three steps, an expired-link way
   in), "Invited 3 days ago" on the staff list, and one reminder a day later (migration 0067).
5. **All-or-nothing saves** for assigning, cancelling, restoring, per-day staffing and a course's
   locations, kit and staffing. A test simulates a dropped connection and checks nothing was
   half-written.
6. **"Someone else changed this"** on course staffing, locations, kit and pay lines, naming who
   and when. An assignment re-checks clashes after it is written and undoes a same-moment
   double-booking.
7. **Bounded reads** across the board, payroll, the Courses page (upcoming, or the last 12 months
   of past with "Show older"), assigning, the availability grid, the problems list, the roster
   range, open shifts, the course editor and the young-worker register. Two indexes (migration
   0068). A test with about 1,400 sessions checks each page reads a small slice. The dashboard's
   "Courses to cover" tile now counts upcoming courses only (it counted every under-staffed course
   ever).
8. **Quick add and "Paste a list"** on Instructors, with the full form under "Add with all details".
9. **Equipment:** warnings while picking kit and after saving; a reason and back-on date for kit in
   maintenance (shown on the problems list); a summary line per type; **kit rules** per course type
   in Course setup, used only when Settings → "Use kit rules" is ticked (off by default)
   (migration 0069).

Every question in this review now meets the "after" score in the table above.
