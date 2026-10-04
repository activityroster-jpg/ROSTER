# ActivityRoster: full platform audit

4 October 2026 · read-only audit · no code or design changes made

## How this audit was done, and its limits

- **What was inspected:** the code at commit `9519f58` (production). That covers every page, all 202 server actions, all 31 API routes, the schema (35 centre tables and the control-plane tables), the domain rules, and the auth and permission layers. It also covers the R2, email and mobile wrappers, the CI and deploy workflows, and GitHub's own run history for the scheduled jobs.
- **How claims were checked:** wherever possible against the implementation, not the screen. For example, every server action was checked for a server-side permission call. Time handling was checked by computing what each screen prints for a summer date.
- **Limit: no logged-in click-through.** I did not click through the live app as each role. The sign-in chain (password, emailed code, PIN, device check) makes scripted multi-role testing slow. Where a finding is about the user experience it is read from the components and flows, and I say so.
- **Limit: missing question list.** Your brief refers to "the questions already listed in the audit" and a separate security/technical section, but only the page-focus and cross-page sections arrived. I scored every question that was supplied. I covered security and technical quality through the platform-area list (frontend, backend, D1, R2 and so on) in Part C. If there is a further list, send it and I'll score it the same way.
- **Labels used:** **Required**, **Strongly recommended**, **Optional**, **Preference**, as you asked. Priority runs from **P0** (fix before real centres use it in season) to **P3** (later).

---

## Part A: Pages and tabs

### A1. Dashboard (`/office`)

**1. Is the information genuinely useful to an admin when they first log in? Score 7/10**

*What's there:*
- A setup checklist until the centre is configured, then "Next: build your first week".
- "Needs attention" tiles: certs expiring, or not cleared when cert checks are on; leave to approve; open shifts; awaiting confirmation.
- A calendar, this week's roster and a coverage list.

All of it is real, live data.

*Recommendation:* keep the tiles. The missing piece is **today**. An admin opening the app at 08:00 on a sailing day wants three things: who is on the water today, what is uncovered today, and who has said they can't make it.

- **Option A:** add a "Today" strip above the tiles: sessions, staff, uncovered, declined.
- **Option B (recommended):** a Today strip, plus a "Problems" tile group fed by a real conflict check. See question 3.
- **Option C:** a role-aware dashboard (admin, senior instructor, welfare officer each get their own) with a timeline of the day.

B gives most of the value for modest work. C is better for big centres but is a redesign. **Strongly recommended.**

**2. Is anything unnecessary, confusing or missing? Score 6/10**

*Evidence:* the calendar, "This week's roster" and "Coverage" are three views of the same courses. "Coverage" and the roster's "Needs cover" pill repeat each other. Missing items:
- double-bookings;
- staff rostered on a slot they later marked Busy;
- staff on approved leave who are still rostered;
- next week not yet published;
- cancelled sessions.

*Recommendation:* merge Coverage into the roster table as a status column, and add the problems above. Keep the calendar but collapse it on phones. **Strongly recommended.**

**3. Does it clearly highlight important actions, upcoming activity, problems or changes? Score 5/10**

*Evidence:* a schedule-wide conflict check exists (`getScheduleConflicts` in `lib/services/schedule.ts`) but **nothing calls it**. Double-bookings are only checked when someone is assigned. A clash created later (by moving a session, by an override, or in a centre that had the check off) is never shown anywhere. There's also no "changed since you last looked".

*Recommendation:*
- **Current:** problems are invisible once saved.
- **Risk:** two groups on the water with one instructor.
- **Solution:** a single "problems" service (double-bookings, rostered-but-Busy, on leave, uncovered, declined, unpublished week). It should feed the dashboard, the roster page and the morning digest.
- **Priority:** P1.
- **Effect of the change:** additive. It slightly slows the page, which is fine once queries are bounded by date (see C2).

**4. Is the layout and visual hierarchy good on desktop and mobile? Score 7/10**

*Evidence:* clear headings, tile tones (port red, amber, navy). It works on phones because the sidebar collapses. On a phone, the calendar and the week table push the useful tiles below a long scroll.

- **Option A:** on phones, put the tiles first and collapse the calendar.
- **Option B (recommended):** Today strip, then problems, then the roster table, with the calendar in a tab.
- **Option C:** separate mobile and desktop layouts.

**Preference / Strongly recommended for B.**

### A2. Courses and course setup (`/office/courses`, `/office/course-setup`)

**1. Is creating and managing courses intuitive? Score 7/10**

*Evidence:* the course planner (calendar plus builder) pre-fills sessions from each course type's default schedule, supports multi-session and recurring courses, and takes role requirements, locations and equipment at creation. Courses are managed as cards with inline session editing, student numbers and staff required.

*Recommendation:* the creation flow is good. The problem is what can't be changed afterwards (question 3).

**2. Are course settings logical and easy to understand? Score 5/10**

*Evidence:* one course carries five overlapping staffing ideas:
- capacity;
- "students" (stored in `capacity` too, from the card);
- ratio (students per instructor);
- `staffRequired`;
- per-role requirements, which overwrite `staffRequired` with their total.

An admin can set ratio 1:6 with 12 students and "staff required 1", and the pills will disagree.

- **Option A:** hide the ratio when role requirements exist.
- **Option B (recommended):** one "Staffing" panel. You enter students, and the panel shows the RYA ratio from the course type and suggests the roles; the admin adjusts the roles; `staffRequired` is always derived, never typed.
- **Option C:** full RYA staffing templates per course type, with safety-boat ratios.

**Strongly recommended (B).**

**3. Does course setup interact correctly with instructors, availability, equipment, locations and the roster? Score 4/10**

*Evidence:*
- **Locations and equipment can only be set when the course is created.** No action or screen lets you view or change them afterwards; `courseLocation` and `courseEquipment` are written only in `lib/services/courses.ts` and the import.
- Equipment marked "maintenance" or "retired" is hidden from the creation picker, but courses already holding it are not flagged.
- Tracked-equipment double-booking is computed by the unused conflict function, so it never shows.
- Availability is shown in the staff picker (good). Moving a session (`updateSessionTimesAction`) re-syncs hours and notifies staff, but **does not re-check double-booking, availability or young-worker hours**.

*Recommendation:*
- **Current:** checks run once, at assignment.
- **Risk:** silent clashes after edits, and wrong boats or rooms with no way to fix them.
- **Solution:** editable locations and equipment on the course card; re-validate every assignment on the course whenever its sessions change, and show the result; flag courses holding unavailable equipment.
- **Priority:** P1.
- **Effect of the change:** additive; none on existing data.

**4. Are there unnecessary steps or duplicated information? Score 6/10**

*Evidence:* "Course setup" (types, schedules, staffing rules) and "Courses" (instances) are separate tabs. That's correct, but the sidebar puts Course setup at the bottom, far from Courses. The staffing duplication is covered in question 2.

*Recommendation:* move Course setup next to Courses, or into Courses as a "Course types" tab. **Preference.**

**5. Edge cases: editing or deleting courses that already have staff. Score 3/10**

*Evidence:*
- **Delete** cascades the course's sessions and staff after a generic confirm. It does not mention the people rostered and sends them nothing. Their pay lines survive with no session and appear in payroll as "Other", payable (see A7, question 4).
- **Cancel** (course status "cancelled") is a label only. The course stays on the roster, the PDF, the portal and the emergency sheet. Its hours stay payable, it still counts for clashes and young-worker hours, and nobody is told.
- **Removing one session** also orphans its pay lines and notifies nobody.

*Recommendation:*
- **Current:** destructive and silent.
- **Risk:** staff turning up to cancelled courses; paying for cancelled sessions; lost history (against the "deactivate, never delete" rule).
- **Solution:**
  - Once a course has staff or is in a published week, replace Delete with **Cancel**.
  - Cancel removes the course from the roster, PDF, portal and sheet; notifies the staff; and asks the pay question (pay a cancellation fee, pay nothing, pay as rostered).
  - Delete stays only for drafts with no staff.
  - Session removal follows the same rules.
- **Priority:** P0 for the pay lines, P1 for the cancel flow.
- **Effect of the change:** behaviour change for admins; the existing data is fine.

### A3. Roster (`/office/rota`), highest priority

**1. Is the roster quick and intuitive for a busy sailing school? Score 5/10**

*Evidence:* the Roster page is **read-only**. It has three good views (by week, by day, compact grid), a publish bar, the PDF and the emergency sheet. All editing happens elsewhere: assignments on the Courses page cards (one picker per role per course), bulk assign, and "assign from cell" on the Availability grid. On a Saturday with 20 sessions the admin works card by card on another page and comes back to the Roster to check.

- **Option A:** an "Edit on Courses" link on every session in the roster.
- **Option B (recommended):** make the roster editable. Click a session to open a side panel with the staffing picker, availability, clashes and the young-worker result; add, remove or swap in place.
- **Option C:** a full planning board (people down the side, days across) with drag and drop.

B keeps one source of truth with modest work. C is what large centres expect, but it is a big build and drag and drop is hard to get right on phones. **Strongly recommended (B); C optional later.**

**2. Is it obvious who is working, where, when and on what? Score 6/10**

*Evidence:* the roster shows course, time, staff and role, confirmed or declined, location, equipment and "Needs cover". **But the printed PDF, the emergency sheet, the parent view and the morning digest show every session an hour late during British Summer Time.**
- Session times are stored as clock time labelled UTC (`Date.parse(\`${date}T${time}:00.000Z\`)` in `lib/services/courses.ts` and `app/(app)/office/courses/actions.ts`).
- The office and portal display them in UTC, which is correct.
- The PDF (`lib/pdf/rota-pdf.ts`, using the centre's time zone), the emergency sheet (`lib/services/emergency.ts`, `office/rota/emergency/page.tsx`), the digest (`lib/services/digest.ts`) and `/parent` display them in Europe/London.
- So a 09:00 session prints as 10:00 from late March to late October.

*Recommendation:*
- **Current:** two time conventions are mixed.
- **Risk:** the wrong time on the printed sheet the beach team works from, and on the emergency sheet. This is safety-relevant.
- **Solution:** one rule. Session times are wall-clock values formatted as UTC everywhere (one shared `formatSessionTime` helper), with a test that renders a July session through every output.
- **Priority:** **P0.**
- **Effect of the change:** none on stored data; outputs become correct.

**3. Is assigning and reassigning staff easy? Score 5/10**

*Evidence:* assigning is one picker per role on each course card, plus bulk assign across courses. Reassigning means remove, then add; there is no swap. **Assignments are per course, not per session** (`course_staff` has no session). On a multi-day course, everyone is on every day. An open shift raised for one session is filled by putting the volunteer on the whole course (`lib/services/openshifts.ts`).

*Recommendation:*
- **Required for RYA multi-day courses:** per-session (per-day) staffing as an option. For example, a five-day Stage 3 has different instructors on Wednesday.
- **Option A:** let an assignment exclude chosen sessions.
- **Option B (recommended):** keep course-level assignment as the default, and add "this day only" overrides per session.
- **Option C:** session-level assignment throughout.

B keeps today's simple case simple. **Priority P2** (schema change, done additively).

**4. Are conflicts, unavailable instructors and other problems clearly identified? Score 4/10**

*Evidence (`lib/services/assignment.ts`):*
- **Checked at assignment:** cert fit (only if the centre opts in), double-booking (on for new centres via the seed, but the database and code default is off), Busy availability (on), young-worker hours.
- **Not checked:**
  - **approved leave**, which is a separate system that never touches assignment;
  - weekly recurring availability (the code ignores weekday rows; none are created yet);
  - **whether the instructor holds the right RYA qualification for the course type**, which the Staff page's teaching map knows but the picker ignores;
  - ratio (opt-in flag only).
- **After saving, nothing re-checks.** A Busy marked after rostering, a session moved onto a clash, or leave approved over a rostered day all go unflagged.

*Recommendation:* the problems service (A1, question 3), plus three things at assignment: on leave, qualification match ("not an instructor for this course type", override with a note), and live re-checks on edits. **P1.**

**5. How well does it handle large numbers of instructors and shifts? Score 4/10**

*Evidence:* every roster, courses and payroll load reads the **whole history**: all courses, all assignments, all locations and equipment links, and on Courses and in `assignStaff` every session ever. `assignStaff` also loads every compliance item for every instructor. Bulk assign repeats all of this per course, one after another. A centre's first season is fine. By year three a busy centre carries thousands of sessions, and each tap does a full scan.

*Recommendation:*
- **Current:** unbounded reads.
- **Risk:** slow pages, then Worker CPU limits in peak season.
- **Solution:** bound every query by date range or by course; add `(organisation_id, course_id)` and `(organisation_id, instructor_id)` indexes where missing; batch bulk assign.
- **Priority:** P2 (P1 before any centre over about 40 staff).
- **Effect of the change:** none visible.

**6. Drag and drop, editing, recurring shifts, cancellations, changes, simultaneous edits by several users. Score 4/10**

*Evidence:*
- No drag and drop (not required).
- Recurring courses come from the builder (good).
- Cancellations are cosmetic (A2, question 5).
- **No protection against two admins at once:** no unique constraint on `(course, instructor)`, so a double submit creates a duplicate assignment. Two admins can each pass the clash check and double-book the same person (check, then write).
- No "this was changed by someone else" warning; the last save wins.

*Recommendation:* unique index on `course_staff(course_id, instructor_id, role_type_id)` (additive, after de-duplicating); re-check clashes as part of the write; show "updated by X at 10:42" on conflict. **P1.**

**7. Are the underlying permissions and data handling secure, not just the screen? Score 8/10**

*Evidence:*
- Every roster-changing action calls `requireTenant({ permission: "roster.edit" })`.
- All ids are re-loaded through tenant-scoped `findById`, so a guessed id from another centre fails.
- Overrides record who and why; every change is audited.
- The cross-tenant test covers all 35 tables.

*Recommendation:* add the unique constraint above. Otherwise this is sound. **P1 (constraint only).**

### A4. Availability, high priority

**1. Is it extremely easy for instructors to enter and update availability? Score 7/10**

*Evidence:* the portal grid cycles a cell on tap (Free → Maybe → Busy → clear). It has "Same as last week", "All free" and "Clear week", week navigation, and a horizon set by the centre. That's quick on a phone.

*Recommendation:*
- **Option A:** add a note per day ("can do pm after 2").
- **Option B (recommended):** a recurring pattern ("every Saturday and Sunday, all day"), which fills weeks ahead and can be overridden per week.
- **Option C:** calendar sync (ICS import of the instructor's own calendar).

B matches how seasonal staff think. **Strongly recommended.**

**2. Is the distinction between available, unavailable and tentative clear? Score 6/10**

*Evidence:* the labels Free, Maybe and Busy are clear. But a **blank** cell behaves like Free: assignment only blocks Busy, and Maybe has no effect anywhere except the picker hint. Nothing tells the instructor that blank means "you may be rostered".

*Recommendation:* one line under the grid: "Blank = not set; your centre may still roster you. Only Busy stops it." Show "Maybe" as an amber warning when someone is assigned. **Strongly recommended, small.**

**3. Does availability feed rostering correctly? Score 5/10**

*Evidence:* the picker shows each instructor's state for the course's slots, and Busy blocks with an override. **Leave is a separate system:** approved leave is not availability, does not block assignment and doesn't show in the picker. Busy marked after rostering raises nothing.

*Recommendation:* approved leave writes Busy for its dates (or the check reads both). A Busy added over an existing assignment notifies the office and shows in the problems list. **P1.**

**4. Can admins see and understand availability quickly? Score 7/10**

*Evidence:* the office grid shows every instructor by day and slot, the count of free staff per slot, existing assignments in the cell, and lets you assign from a cell. Good. **But admins cannot enter or correct availability for someone.** Only the instructor can (`setAvailability` is only called from the portal). Volunteers without an app login therefore can never have availability.

*Recommendation:* let an admin set availability for a staff member, audited as "set by office". **Strongly recommended (clubs run on volunteers who won't install an app). P1.**

**5. Are there confusing states or edge cases? Score 4/10**

*Evidence:*
- **No unique constraint** on `availability(instructor, date, slot)`. Fast taps on a fresh cell can create two rows, because the second request looks before the first insert lands. After that, which status wins is arbitrary.
- Taps send separate requests that can arrive out of order.
- The server doesn't enforce the centre's horizon or refuse past dates.
- "All free" writes 21 rows and 21 audit entries one after another (slow on a poor beach signal, and partial if the connection drops).

*Recommendation:*
- **Current:** last-write-wins without a key.
- **Risk:** wrong availability feeding the roster.
- **Solution:** unique index plus a true upsert; send the cell's sequence number and drop stale requests; one batched write for week actions; server-side horizon check.
- **Priority:** P1.
- **Effect of the change:** a migration that de-duplicates existing rows first.

### A5. Instructors and staff (`/office/staff`)

**1. Is adding an instructor straightforward? Score 7/10**

*Evidence:* four routes in: a setup form, an emailed invite, CSV import, and the app company code with admin approval. The Small Club cap is enforced on every route.

*Recommendation:* fine. Make the invite the default button and the form the secondary one (most centres want staff to fill in their own details). **Preference.**

**2. Are roles and permissions clear? Score 7/10**

*Evidence:* five roles (admin, senior instructor, welfare officer, instructor, parent) with an explanation card. Server checks match the matrix (`lib/auth/rbac.ts`). Three defined permissions (`staff.edit`, `finance.view`, `settings.edit`) are unused because those screens are admin-only; that's harmless but misleading. "Senior instructor" is both an RYA qualification and a platform role, which can confuse.

*Recommendation:* rename the role "Roster manager (e.g. Senior Instructor)" or add a hint. Delete the unused permissions or wire them up. **Preference / small.**

**3. Is the distinction between admin, manager, instructor, volunteer and other staff handled correctly? Score 5/10**

*Evidence:* volunteer is correctly an employment type, not a role. **But a centre can only ever have one admin.** The owner gets admin at sign-up (`lib/billing/provision.ts`), and the roles an admin can grant exclude admin (`GRANTABLE_ROLES`). The code even notes that "the shared admin login usually has no instructor record". A Principal, Chief Instructor and office manager would have to share one login, PIN and audit identity. When that person leaves, the centre is stuck.

*Recommendation:*
- **Current:** a single admin.
- **Risk:** shared credentials, a change log that can't tell people apart, lock-out when the owner leaves.
- **Solution:** let admins grant admin. Block removing the last admin. Add "transfer ownership" (billing contact).
- **Priority:** **P0/P1 (Required before real centres).**
- **Effect of the change:** small; the permission checks already work per user.

**4. What happens after an instructor is added? Score 7/10**

*Evidence:* the invite email carries a sign-in link; first visit goes to `/portal/welcome` to set a password; then PIN set-up; then the instructor sets availability and uploads certs. Joining by app code goes through an approval queue.

*Recommendation:* add a short "what happens next" line to the invite email (three steps), and an "invite pending since…" status with a resend button on the staff list. **Optional.**

**5. Onboarding, invitations, password set-up, recovery and 2FA. Score 8/10**

*Evidence:*
- Better Auth with verified email, an 8-character minimum and a breached-password check.
- A password reset revokes every other session.
- PIN: 4 digits, PBKDF2-hashed, lockout after 5 failures, reset by emailed code.
- A recovery email; optional 2FA (authenticator app or email).
- New-device check (password again).
- Office sign-in needs an emailed code on top of the password.

*Recommendation:* security is strong; friction is the issue for instructors. Consider skipping the PIN for instructor-only accounts inside the app when Face ID or fingerprint is set up. **Preference.**

**6. What can each type of user actually access, through the screen and directly? Score 8/10**

*Evidence:*
- All 202 server actions resolve the user and centre on the server. The 25 that looked unguarded call a guarded helper (`repo()`, `platform()`, `resolveMe()`), which I checked one by one.
- Every API route is guarded or deliberately public (health, webhooks with signature checks, rate-limited forms).
- Document download restricts non-admins to their own R2 prefix.
- Portal pages accept any member, but they resolve "me" from the session, so a parent sees nothing of anyone else.

One loose end: `rememberCentre(userId, organisationId)` in `app/app/actions.ts` is an exported, unauthenticated server action that signs any claims you give it. It is harmless today, because the cookie is only a hint and membership is re-checked, but it should not be callable.

*Recommendation:* make `rememberCentre` internal (not exported). **P2.**

### A6. Equipment (`/office/equipment`)

**1. Is equipment management useful or unnecessarily complicated? Score 6/10**

*Evidence:* types, units with an identifier, a status (available, maintenance, retired), and course-type equipment rules. It's simple enough. Its usefulness is limited by question 3.

*Recommendation:* keep it simple. **Option A (recommended):** fix the links to courses and stop there. **Option B:** bulk quantities per type ("12 Picos") checked against the courses that need them. **Option C:** maintenance logs and defects reporting from the portal. A first; B later if centres ask.

**2. Is it easy to see what equipment exists and its status? Score 7/10**

*Evidence:* a list per type with status changes. There's no "what is this boat booked on next" view.

*Recommendation:* show "next booked: Sat 12 Oct, Stage 2" on each unit. **Optional.**

**3. Does equipment interact correctly with courses and the roster? Score 3/10**

*Evidence:* equipment can only be attached when a course is created and can't be changed afterwards. Unit double-booking is computed by an unused function. Putting a unit into maintenance doesn't flag the courses holding it.

*Recommendation:* editable equipment on the course card; show unit clashes and "in maintenance" in the problems list. **P1.**

**4. Can conflicting or unavailable equipment be identified before a problem occurs? Score 3/10**

*Evidence:* same as question 3. Retired or maintenance units are only hidden from the creation picker.

*Recommendation:* as above. **P1.**

### A7. Locations (`/office/locations`)

**1. Is adding and managing locations intuitive? Score 7/10**

*Evidence:* category boxes, add a location under a category, deactivate rather than delete. Simple and fine.

*Recommendation:* no change needed.

**2. Are locations used consistently across courses and the roster? Score 5/10**

*Evidence:* a location shows on the roster and PDF, but **it can only be chosen at course creation and never changed**. Courses imported from booking systems get a location only if the import names one.

*Recommendation:* editable on the course card. A "location" column filter on the roster. **P1 (edit), Optional (filter).**

**3. Are there unnecessary fields or configuration steps? Score 8/10**

*Evidence:* just a name and a category. No over-configuration.

*Recommendation:* none.

**4. Do location-specific information or permissions create security or usability problems? Score 9/10**

*Evidence:* locations are tenant-scoped config with no per-location permissions, so there's nothing to leak.

*Recommendation:* none needed. Only add per-location access if a multi-site group asks. **Optional.**

### A8. Payroll (`/office/finance`)

**1. Is the payroll workflow clear and understandable? Score 7/10**

*Evidence:*
- Lines per instructor per session.
- Pay per hour, per session or per day.
- Roster or clock as the source, per line or by default.
- Overrides for minutes and pay, approve and re-open, a break policy, and CSV export.
- A "Rebuild from roster" button.

*Recommendation:* add a period summary ("1–15 Oct: 14 people, 212 h, £2,940, 3 lines need a rate"). **Optional.**

**2. Does the information come naturally from the roster? Score 7/10**

*Evidence:* yes. Assigning someone creates their lines (`syncHoursForCourse`), and declined staff are excluded. Volunteers also get lines (no rate, "pay unknown"), which clutters the page.

*Recommendation:* hide volunteers from payroll by default (they can be shown with a filter). **Strongly recommended, small.**

**3. Are hours, rates, overtime and adjustments handled correctly? Score 5/10**

*Evidence:*
- Calculations are pure and tested (`lib/domain/pay.ts`); each line is rounded to the penny.
- **Changing a pay rate doesn't update lines already created.** Sync only fills a rate that was blank, so correcting a wrong rate leaves the wrong figure on every unapproved line until each is edited by hand.
- Money is stored as floating point (`real`).
- No holiday pay. For UK casual "workers" (not volunteers or the self-employed) rolled-up holiday pay at 12.07% is lawful and common. The platform exports hours rather than running payroll, so this is **Strongly recommended**, not Required.

*Recommendation:* rate changes offer "apply to unapproved lines from date X"; store money as integer pence (additive column, then migrate); add an optional holiday-pay line. **P1 (rate), P2 (pence, holiday pay).**

**4. Calculation, rounding, editing and data-integrity problems. Score 3/10**

*Evidence:* **orphaned pay lines.**
- `hours_record.course_session_id` is set to null when a session or course is deleted.
- Sync only looks at lines whose session still exists, so those lines are never removed.
- They show in payroll as "Other", dated by when they were created, and **they are payable** (`lib/services/finance.ts`).
- Cancelled courses also stay payable (A2, question 5).

*Recommendation:*
- **Current:** phantom lines.
- **Risk:** paying people for sessions that didn't happen.
- **Solution:** delete unapproved, unedited lines when their session goes; keep approved ones but mark them "session removed after approval".
- **Priority:** **P0.**
- **Effect of the change:** a one-off clean-up of existing orphan lines (additive approach: flag first, then remove).

**5. What happens when the roster changes after payroll has been generated? Score 5/10**

*Evidence:* unapproved lines follow the roster (good). Approved lines are frozen (correct), but **there's no flag** when the roster changed after approval, so the office can't see that an approved line no longer matches reality.

*Recommendation:* mark approved lines whose session time, staff or existence changed after approval: "Roster changed since approval: review". **P1.**

### A9. Admin and settings (`/office/settings`, billing, course setup, change log)

**1. Are all settings pages logical, not just the main one? Score 6/10**

*Evidence:* Settings is one long page. It covers:
- general settings and the safety checks;
- young-worker mode and term dates;
- retention, the roster PDF, the idle timeout, the time clock and breaks;
- the join code, the privacy notice and the digest.

Course setup, Billing and Change log are separate tabs.

- **Option A:** add anchor links at the top.
- **Option B (recommended):** split into tabs: General · Safety checks · Young workers · Pay & time · Data & privacy · Roster PDF.
- **Option C:** a settings search.

**Strongly recommended (B).**

**2. Are important security settings obvious? Score 6/10**

*Evidence:* the idle PIN timeout sits inside the general form. Sign-out-all-devices and 2FA live under `/security` (admin only). No single "Security" section shows a centre's posture: who has 2FA, last sign-ins, active devices.

*Recommendation:* a Security tab showing each office user's 2FA status, last sign-in, and "sign out this person everywhere". **Strongly recommended (pairs with multiple admins).**

**3. Are dangerous actions appropriately protected? Score 6/10**

*Evidence:*
- Turning off the double-booking, availability or cert checks is a single checkbox with no confirmation (it is audited).
- The whole-centre export needs only the admin's session (PIN verified this session), with no fresh step-up, though unusual export volumes alert the platform owner.
- Erasing a centre is Dev Center only (good).
- Course delete is covered in A2.

*Recommendation:* confirm when switching safety checks off ("double-booking won't be stopped"). Ask for the PIN again before a full export or an anonymisation. **P2.**

**4. Are permissions understandable? Score 7/10**

*Evidence:* the access card explains each role.

*Recommendation:* show "who can see this" on sensitive pages (emergency contacts, payroll). **Optional.**

**5. Could any setting accidentally create security, privacy or operational problems? Score 5/10**

*Evidence:*
- **Time zone:** changing it shifts the PDF and the young-worker times further (the time bug in A3, question 2).
- **Checks off:** turning off availability or double-booking checks has silent operational consequences.
- **Privacy notice link:** the field accepts any URL scheme (`z.string().url()`). Rendering then depends on React refusing `javascript:` links.

*Recommendation:* restrict the privacy URL to `https:`; fix the time handling; add the confirmations above. **P2.**

### A10. User account and security

**1. Password, PIN, 2FA, recovery email, sessions, logout, new device and location. Score 8/10**

*Evidence:* covered in A5, questions 5 and 6. There's also a 7-day session, a 12-hour office re-verification, the idle PIN prompt, "sign out all other devices", and new-device and new-country checks. Security events are recorded and shown to the user.

*Recommendation:* fine. See the friction note in A5, question 5.

**2. Are controls enforced on the server, not just shown in the browser? Score 9/10**

*Evidence:*
- `requireTenant` runs the login-verified, device and PIN gates on the server for every page and action.
- Ghost Mode refuses every write on the server.
- A lapsed trial refuses writes at the repository layer.
- The platform owner's Dev Center adds a TOTP gate.

*Recommendation:* none.

**3. Attempting access to data or actions the user shouldn't have. Score 8/10**

*Evidence (code review):*
- Cross-centre ids fail because every lookup is tenant-scoped.
- An instructor can't edit others' availability (the id is taken from the session).
- Instructors can't read others' documents (prefix check).
- A parent can't read portal data for others.

Rate limiting is KV-based: it reads then writes (not atomic), and KV is eventually consistent, so a parallel brute-force can exceed the limit for a short while. PIN lockout counters live in D1, which is correct. The public `/api/billing/setup` creates a Stripe Checkout session per request with no rate limit.

*Recommendation:* move auth-critical limits to Cloudflare's rate-limiting binding or a Durable Object; add a limit to `/api/billing/setup`. **P2.**

### A11. Mobile staff experience

**1. Can staff quickly see shifts and manage availability without admin clutter? Score 8/10**

*Evidence:* the portal is a separate, staff-only area: My schedule (published weeks only, confirm or decline), availability, hours, leave and cover, certs, notifications, settings, and the clock when it's on. No admin menus leak in.

*Recommendation:* keep the separation.

**2. Does the architecture support this cleanly? Score 7/10**

*Evidence:* a Capacitor shell loads the live `/app` and `/portal` on the apex domain with a signed selected-centre cookie, so a web deploy updates the app instantly. Push uses Firebase; biometrics are supported. The app isn't in the stores yet (the iOS and Android projects are built on a Mac). There's no offline cache.

*Recommendation:* a read-only offline cache of "my next 7 days" (service worker) for beaches with no signal. **Strongly recommended for the app launch.**

**3. What should be simpler for staff on mobile? Score 6/10**

*Evidence:* PIN entry each session on top of sign-in. No calendar feed. Availability per week only. Confirming a multi-day course is done on its first card.

*Recommendation:*
- **Option A:** "Add to my calendar" (ICS link per instructor).
- **Option B (recommended):** ICS feed, plus a recurring availability pattern, plus Face ID replacing the PIN in the app.
- **Option C:** a full native "Today" home screen with a widget.

**Strongly recommended (B).**

---

## Part B: Cross-page workflows

Each table answers the ten questions you set for every workflow, with a score and a recommendation per row.

### B1. Instructor → Availability → Course → Roster → Payroll (overall 5/10)

| Question | Score | Finding → recommendation |
|---|---|---|
| Works end to end? | 6 | Yes for the simple path: add, availability, assign (Busy blocks), roster, pay lines. It breaks on cancel, delete and leave (A2-5, A4-3, A8-4). Fix those (P0/P1). |
| UX consistent between pages? | 5 | You view the roster on one page and edit it on another; payroll uses its own vocabulary ("source", "override"). Make the roster editable (A3-1). |
| Information duplicated? | 6 | Staffing numbers are entered in three places (A2-2); leave and availability are parallel. Merge (A2-2, A4-3). |
| Contradictory data possible? | 4 | Yes: rostered while Busy or on leave, double-booked after edits, duplicate assignments, two availability rows for one cell. Add constraints and the problems list. |
| Edit or delete after use? | 3 | Course or session delete → orphan pay lines; rate edits ignored; cancel cosmetic. P0 fixes in A8-4 and A2-5. |
| Permissions consistent at every stage? | 8 | Yes, checked on the server at every step. |
| Race conditions / integrity? | 4 | No transactions, no unique keys on assignments or availability, clash check then write. Add constraints and D1 batch writes (C3). |
| Network fails halfway? | 4 | Multi-step writes (course + sessions + links; assign + hours + notify; bulk availability) can leave half a course. Use D1 `batch()` per operation (C3). |
| Two admins at once? | 4 | Last write wins; double-booking possible. Unique keys, re-check during the write, a "changed by" warning. |
| Clear feedback on success or failure? | 7 | Plain-English messages and block reasons with an override note. A failed bulk action returns per-course outcomes (good). |

### B2. Location → Course → Roster → Instructor (overall 5/10)

| Question | Score | Finding → recommendation |
|---|---|---|
| Works end to end? | 5 | A location set at creation flows to the roster, PDF and portal; it can't be changed afterwards. Make it editable (P1). |
| UX consistent? | 6 | Locations show the same everywhere they appear. |
| Duplication? | 8 | None. |
| Contradictions? | 7 | A deactivated location stays on old courses (correct under "deactivate, never delete"). |
| Edit or delete after use? | 6 | Locations can't be deleted while in use (RESTRICT key), which is good; renames carry through. |
| Permissions? | 9 | Admin-only configuration; tenant-scoped. |
| Races? | 8 | Low risk. |
| Network failure? | 6 | Location links are written after the course; a failure leaves a course without its location. Batch the writes (C3). |
| Two admins? | 8 | Low risk. |
| Feedback? | 7 | Fine. |

### B3. Equipment → Course → Roster (overall 4/10)

| Question | Score | Finding → recommendation |
|---|---|---|
| Works end to end? | 4 | Set once at creation; the unit clash check is never shown; maintenance doesn't flag courses. P1 (A6-3). |
| UX consistent? | 6 | Units show on the roster and PDF. |
| Duplication? | 7 | Course-type equipment rules and per-course picks both exist but are used for different things. Fine. |
| Contradictions? | 3 | A boat in maintenance stays on Saturday's course; one boat can be on two overlapping courses. Problems list (P1). |
| Edit or delete after use? | 6 | RESTRICT keys stop deletion of booked units (good); retiring a unit isn't flagged. |
| Permissions? | 9 | Fine. |
| Races? | 7 | Low risk. |
| Network failure? | 6 | As B2. |
| Two admins? | 7 | Low risk. |
| Feedback? | 5 | No warning anywhere when equipment is unavailable. |

### B4. Instructor → Permissions → Roster → Payroll (overall 7/10)

| Question | Score | Finding → recommendation |
|---|---|---|
| Works end to end? | 7 | Roles gate the pages and actions correctly. A senior instructor can roster but can't see pay (correct). |
| UX consistent? | 7 | The sidebar hides what a role can't use. |
| Duplication? | 8 | None. |
| Contradictions? | 6 | Only one admin is possible (A5-3). Unused permissions in the matrix (A5-2). |
| Edit or delete after use? | 7 | A role change takes effect on the next request (permissions are resolved on every request). |
| Permissions consistent? | 9 | Server-side at every step; parents and instructors are confined to their own data. |
| Races? | 8 | Fine. |
| Network failure? | 8 | Single writes. |
| Two admins? | n/a | Only one admin can exist; fixing that makes this relevant. |
| Feedback? | 7 | A denied action redirects to the role's landing page; it could say "you don't have access to X". Optional. |

### B5. Admin → Settings → Security → User access (overall 7/10)

| Question | Score | Finding → recommendation |
|---|---|---|
| Works end to end? | 8 | Settings save, are audited and take effect on the server; the idle timeout applies from the next PIN entry. |
| UX consistent? | 6 | Security is split across Settings (idle timeout) and `/security` (devices, 2FA). One Security tab (A9-2). |
| Duplication? | 8 | Little. |
| Contradictions? | 6 | Safety checks can be switched off silently; time-zone interplay (A9-5). |
| Edit or delete after use? | 7 | A new join code invalidates the old one immediately (with a confirmation). Good. |
| Permissions? | 9 | Admin only, checked on the server. |
| Races? | 8 | One settings row per centre. |
| Network failure? | 8 | One write. |
| Two admins? | 6 | When multiple admins arrive, one admin's settings save would overwrite another's (the whole form is posted). Save per section. |
| Feedback? | 7 | "Settings saved" plus validation messages. |

---

## Part C: Platform areas (technical, security, compliance)

**C1. Frontend and UI. Score 7/10**
- **Current:** a consistent Tailwind design system, a nautical palette, responsive layouts (checked on phones for the marketing site), accessible focus styles, a skip link and reduced-motion support. Native `confirm()` dialogs are used for destructive actions.
- **Risks:** heavy pages (Courses renders every upcoming course card with full data); seven leftover user-facing "rota" words from the wording change (see Top issue 1).
- **Solution:** finish the wording; paginate or bound Courses; replace `confirm()` on destructive actions with a proper dialog that names the consequences.
- **Priority:** P0 (wording), P2 (the rest).

**C2. Backend and API. Score 6/10**
- **Current:**
  - Server actions with Zod validation and a server-side tenant and permission check on all 202.
  - Business logic in services; pure domain rules (`lib/domain`); a clean repository layer.
- **Risks:**
  - **no transactions** anywhere (no `db.batch` or `transaction`), so multi-step writes can half-complete;
  - unbounded whole-history reads;
  - long sequences of single awaits.
- **Solution:** D1 `batch()` for multi-row operations; date- or id-bounded repository queries; consolidate the per-request reads.
- **Priority:** P1 (batches for course create and assign), P2 (performance).

**C3. Database and schema. Score 6/10**
- **Current:**
  - One migration path, additive since 0046.
  - RESTRICT keys for configuration; cascade from the organisation for erasure.
  - Append-only log triggers; an org id on every centre table, indexed.
- **Risks:**
  - missing unique keys: `course_staff(course, instructor, role)`, `availability(instructor, date, slot)`, `hours_record(instructor, session)`;
  - money stored as floats;
  - `hours_record` set to null on session delete (orphans);
  - session times in a "clock time as UTC" convention that isn't documented in the schema.
- **Solution:**
  - add the unique indexes after a de-duplicating migration;
  - add pence columns;
  - document the time convention in `course_session`;
  - flag or clean orphans.
- **Priority:** P0 (orphans), P1 (unique keys), P2 (pence).
- **Effect of the change:** migrations only add things; they need a de-duplication step before adding the unique keys.

**C4. Authentication and authorisation. Score 8/10**
- **Current:** strong (A5, A10).
- **Risks:** one admin per centre; KV rate limits aren't atomic; `rememberCentre` is exported.
- **Solution:** multiple admins; durable rate limits; make the action internal.
- **Priority:** P0/P1, P2, P2.

**C5. User roles and permissions. Score 7/10**
- **Current:** a coarse matrix, enforced on the server.
- **Risk:** no second admin; three unused permissions.
- **Solution:** see A5-2 and A5-3.

**C6. Multi-tenant organisation structure. Score 9/10**
- **Current:**
  - Isolation is structural: every centre table goes through repositories that inject the org filter.
  - The cross-tenant test covers **all 35** centre tables.
  - The subdomain or app cookie is only a hint; membership authorises.
  - Platform-wide reads go through narrow `PlatformRepository` methods.
- **Risk:** low.
- **Solution:** keep the rule that a new table means a new entry in `TENANT_TABLES`; add a CI check that fails if a schema table with `organisation_id` is missing from the list.
- **Priority:** P3.

**C7. Cloudflare infrastructure. Score 5/10**
- **Current:** Workers via OpenNext, D1, R2 (EU), KV. **Scheduled work runs from GitHub Actions cron, not Cloudflare.**
- **Risk:** **the "hourly" tick ran on schedule only twice in the 23 hours since it was enabled** (GitHub run history: 02:34 and 05:19 on 4 October; nothing since). GitHub drops and delays scheduled runs. Everything that depends on it is therefore late or skipped:
  - email retries;
  - the morning digest;
  - leaving reminders and retention sweeps (compliance commitments);
  - trial-survey invitations;
  - outreach.
- **Solution:** a Cloudflare **Cron Trigger** (a small scheduled Worker or an OpenNext custom entry) calling the same tick every hour. Keep GitHub as a backup ping. Add an uptime check.
- **Priority:** **P0.**
- **Effect of the change:** a new Worker and secret; no data change.

**C8. D1 database. Score 6/10**
- **Current:** Time Travel bookmarks on every deploy; a nightly encrypted export (ran today, about 1h45 late); migrations through the deploy workflow.
- **Risks:** the same as C2 and C3; the backup schedule also depends on GitHub cron.
- **Solution:** move the backup trigger to a Cloudflare cron too, or keep it with an alert when it misses (the backup-report email exists).
- **Priority:** P1.

**C9. R2 storage. Score 8/10**
- **Current:** org-scoped keys, enforced in `lib/r2`; the file type is sniffed on upload; files not on the allow list are forced to download; `no-store` caching; EU jurisdiction; non-admins confined to their own prefix.
- **Risk:** low.
- **Solution:** none urgent.

**C10. Email systems. Score 7/10**
- **Current:**
  - Resend with Postmark as automatic backup.
  - An outbox with retries and backoff, then a failed list in the Dev Center; bodies cleared after send.
  - Bounce webhooks with signature checks; a branded template.
- **Risks:** retries depend on the unreliable tick (C7); DMARC is still `p=none`.
- **Solution:** the C7 cron; move DMARC to `quarantine` once reports are clean (your docs already plan this).
- **Priority:** P0 (via C7), P2 (DMARC).

**C11. Mobile app. Score 7/10**
- See A11.
- Also: the Android notification channel id is "rota" (internal, but it can show in Android's settings), so set a human channel name.
- **Priority:** P2.

**C12. Website and sales funnel. Score 7/10**
- **Current:**
  - Clear positioning; a free month with no card; sign-up with a progress bar and Turnstile.
  - A trial that goes read-only after 14 days, then locks; the trial-end survey.
  - Stripe checkout with the price resolved on the server; pricing aligned (last pass).
- **Risk:** the marketing site promises "every assignment is checked for … clashes". That is true at the moment of assignment, but clashes created later go unflagged (A3-4).
- **Solution:** make the claim true (the problems list) rather than soften it.
- **Priority:** P1.

**C13. Existing tests. Score 6/10**
- **Current:** 345 tests (domain rules, services against SQLite, auth helpers, the isolation gate), run in CI and on every deploy.
- **Risks:**
  - no browser end-to-end tests;
  - no test that walks every route as every role;
  - no summer-time test, which is how the time bug got through;
  - no tests for delete or cancel side effects.
- **Solution:**
  - a role-by-route authorisation test (generated from the page list);
  - summer-date tests for every time output;
  - lifecycle tests (create, assign, move, cancel, delete → roster and payroll);
  - a small Playwright smoke run on staging.
- **Priority:** P1.

**C14. Deployment process. Score 8/10**
- **Current:**
  - Every push: typecheck, tests, isolation, build, staging migrate, deploy and smoke.
  - Production: Time Travel bookmark, migrations, deploy, smoke test, automatic rollback, a tag, and `main` as the record. The build-phase exception is documented.
- **Risk:** `main` is force-pushed by the workflow (intended); no migration dry-run against a copy of production.
- **Solution:** from 13 October, test migrations on staging with production-shaped data (your plan already says this).
- **Priority:** P3.

**C15. Security controls. Score 8/10**
- **Current:**
  - HSTS preload, frame-ancestors, `nosniff`, a referrer policy and a permissions policy.
  - An enforced baseline CSP on every page, plus a stricter nonce CSP in report-only mode for the app (enforcement decision due 11 October).
  - Turnstile on public forms; signed webhooks (Stripe raw body, Svix).
  - Ghost Mode audited; append-only logs.
- **Risks:** see A10-3 (KV limiter, `/api/billing/setup` with no limit), A9-5 (URL scheme), C2 (no transactions).
- **Priority:** P2.

**C16. Data protection and privacy. Score 8/10**
- **Current:**
  - A retention policy per centre, with notices, export and anonymisation.
  - Restriction of processing; a deletion log replayed after a restore.
  - Sealed (encrypted) emergency and guardian contacts, with every view audited.
  - Higher-privacy defaults for under-18s; a parent view with recorded consent; status-only vetting.
  - A sub-processor list and notice tool; EU residency.
- **Risk:** the retention, leaving and expiry sweeps run from the unreliable tick (C7), so deletions promised "after X" can run late.
- **Solution:** C7.
- **Priority:** P0 (via C7).

---

## Part D: Summary

### 1. Overall platform score: **6.5 / 10**

The foundations are strong: tenant isolation, authentication, the compliance features for young workers, privacy and audit, the deploy pipeline and the security headers. Several would score 8–9 on their own.

The weak points are in the core scheduling loop that every centre lives in each day. Checks run once and never again. Cancel and delete don't carry through to payroll and notifications. Times print an hour late all summer. The scheduler behind emails and retention barely runs. All of these can be fixed without a redesign, and most without touching existing data.

### 2. Top 20 issues

1. **User-facing "rota" words left from the wording change** in 7 places: the sidebar label "Rota", the roster view's aria label "Rota template", the Senior-instructor access card, the young-people privacy page and three Learning Centre lines. The internal Android push channel id also still says "rota". My rename skipped words inside quotes. **P0, minutes.**
2. **Summer-time error:** the PDF, emergency sheet, parent view and morning digest show sessions an hour late, and young-worker start and finish checks are off by an hour (an early start can pass when it shouldn't). **P0.**
3. **The "hourly" background job barely runs** (2 scheduled runs in 23 hours), so email retries, the digest, retention and leaving sweeps, and survey invites are late or skipped. **P0.**
4. **Deleting a course or session leaves payable "Other" lines** in payroll. **P0.**
5. **Cancelling a course does nothing:** it stays on the roster, the portal, the PDF and the sheet, stays payable, and nobody is told. **P0/P1.**
6. **Only one admin per centre is possible**, forcing shared logins. **P0/P1.**
7. **Problems found at assignment are never re-checked**: session moves, late Busy, approved leave, overrides. The schedule-wide clash function is unused. **P1.**
8. **Approved leave is ignored by rostering.** **P1.**
9. **Course location and equipment can't be changed after creation.** **P1.**
10. **No unique keys** on assignments and availability, so duplicates appear from double taps or two admins. **P1.**
11. **No transactions:** a failure halfway leaves half-written courses and assignments. **P1.**
12. **Pay rate corrections don't reach existing unapproved lines.** **P1.**
13. **No flag when the roster changes after a line is approved.** **P1.**
14. **Admins can't enter availability for staff**; volunteers without logins never have any. **P1.**
15. **Assignment is per course, not per day**, so multi-day courses with changing instructors can't be modelled, and an open shift for one day fills the whole course. **P2.**
16. **No RYA qualification-to-course check** in the picker; the teaching map exists but isn't used there. **P1.**
17. **Unbounded whole-history reads** on the roster, courses, payroll and assignment pages. **P2 (P1 for large centres).**
18. **Staffing numbers are set in five overlapping fields** (capacity, students, ratio, staff required, roles). **P1.**
19. **Equipment clashes and maintenance status never surface.** **P1.**
20. **Thin end-to-end and authorisation test coverage**; no summer-time tests. **P1.**

### 3. Top 20 opportunities

1. One **"Problems" service** feeding the dashboard, roster, digest and app notifications.
2. **Editable roster:** click a session to staff it, with the checks inline.
3. A **"Today" view** for the office (who's on the water, gaps, declines).
4. A **weather and cancellation workflow:** cancel a day or a session, notify staff, choose the pay rule (a daily reality for sailing schools).
5. **Recurring availability patterns** for instructors.
6. An **ICS calendar feed** per instructor.
7. **Leave written into availability automatically.**
8. A **qualification-aware picker** (suitable first, unsuitable greyed out with the reason).
9. **Per-day staffing overrides** on multi-day courses.
10. **Multiple admins**, with a Security tab showing each person's 2FA and devices.
11. **Offline "my week"** in the app.
12. **Face ID in place of the PIN** in the app for instructors.
13. **Payroll period summary** and an optional holiday-pay line.
14. **A single staffing panel** driven by RYA ratios from the course type.
15. **Equipment "next booked"** and maintenance flags.
16. **Settings split into tabs.**
17. **Course cancellation and no-show reporting** for the season review.
18. **A "changed by someone else" warning** on concurrent edits.
19. **Role-by-route and summer-time test suites** to stop regressions.
20. **A Cloudflare cron and an uptime monitor**, so the background jobs are dependable.

### 4. Critical security and compliance issues

- **Young-worker start and finish checks are off by an hour in summer** (compliance correctness). P0.
- **Retention, leaving and expiry sweeps depend on an unreliable scheduler**, so privacy commitments can run late. P0.
- **Shared admin logins forced by the one-admin limit** (accountability and access control). P0/P1.
- **Emergency sheet times wrong in summer** (safety-relevant). P0.
- Secondary (P2): non-atomic KV rate limits; no rate limit on `/api/billing/setup`; an exported unauthenticated `rememberCentre`; the privacy URL accepts any scheme; no fresh step-up before a full export; the app CSP still report-only (decision due 11 October).

### 5. Critical technical and reliability issues

- Background jobs on GitHub cron (C7). P0.
- Orphan payroll lines (A8-4). P0.
- No transactions (C2). P1.
- Missing unique keys (C3). P1.
- Mixed time conventions (A3-2). P0.
- Unbounded reads (A3-5). P2.
- Backup trigger also on GitHub cron, but it ran and it alerts (C8). P1.

### 6. Biggest UX problems

1. You can see the roster on one page but must edit it on another.
2. Problems are invisible after saving.
3. Five overlapping staffing fields on a course.
4. Cancel and delete behave unexpectedly and silently.
5. You can't change a course's location or equipment.
6. Blank versus Free versus Maybe isn't explained to instructors.
7. Settings is one long page; security is split across two places.
8. The dashboard shows the same courses three ways and has no "today".
9. Instructor friction: sign-in plus a PIN each session; no calendar feed.
10. The leftover "Rota" label in the main menu.

### 7. Biggest RYA-specific gaps

- **Per-day staffing on multi-day courses** (Stage courses, Powerboat Level 2 over two days, Youth Sailing weeks).
- **Qualification-to-course matching** at assignment: an Assistant Instructor can't lead; a Powerboat Instructor is needed for PB courses; a Dinghy Instructor is needed for Stage courses.
- **RYA ratios and safety-boat cover** are opt-in flags rather than built into the staffing panel by default.
- **Weather cancellation days**, with notice to staff and pay rules.
- **Volunteer-heavy clubs:** availability entered by the office, and volunteers kept out of payroll.
- **Junior sailing:** working-time checks are good but need the summer-time fix; parent view in place.
- **Seasonal operations:** recurring availability; a season-start roll-over of course types and staff status.

### 8. Features to remove or simplify

- **Simplify:** staffing fields into one panel (A2-2).
- **Simplify:** the dashboard's three views into one table with status, plus "Today".
- **Simplify:** Settings into tabs.
- **Remove:** Delete for courses with staff or published weeks (replace with Cancel).
- **Remove:** the unused permissions (`staff.edit`, `finance.view`, `settings.edit`) or wire them up.
- **Remove:** the unused weekday column in availability, or use it for recurring patterns (preferred).
- **Keep as is:** equipment (simple), locations (simple), the portal separation, the deploy pipeline.

### 9. Features to add

| Feature | Label |
|---|---|
| Multiple admins | Required |
| Cancel workflow | Required |
| Correct times | Required |
| Reliable scheduler | Required |
| Problems service | Strongly recommended |
| Editable roster | Strongly recommended |
| Leave → availability | Strongly recommended |
| Admin-entered availability | Strongly recommended |
| Qualification-aware picker | Strongly recommended |
| ICS feed | Strongly recommended |
| Recurring availability | Strongly recommended |
| Offline "my week" | Strongly recommended |
| Per-day staffing | Strongly recommended (P2) |
| Holiday-pay line | Strongly recommended for UK employers |
| Equipment next-booked | Optional |
| Payroll summary | Optional |
| Planning board with drag and drop | Optional, later |

### 10. Recommended visual and design improvements

- Status colours used consistently for problems everywhere: port red for clashes or blocks, amber for warnings, teal for confirmed.
- A side-panel pattern for editing (roster session, course) instead of navigating away.
- Proper confirmation dialogs that name the consequences ("3 instructors will be told; 9 pay lines will be removed").
- On phones: the Today strip first, the calendar collapsed, tap targets of at least 44px in the office grid.
- A legend under the availability grid explaining Blank, Free, Maybe and Busy.
- Settings and Course setup reorganised into tabs; Course setup moved next to Courses in the sidebar.

### 11. Recommended architecture and technical improvements

1. A Cloudflare Cron Trigger for the tick (and backups), with GitHub as backup and an uptime monitor.
2. One time-formatting module for session times, with summer tests.
3. D1 `batch()` for multi-row operations; optimistic "updated at" checks on edits.
4. Unique keys (with de-duplicating migrations) on `course_staff`, `availability` and `hours_record`.
5. Date- or id-bounded repository queries; extra composite indexes.
6. Integer pence for money.
7. Durable rate limiting for auth (Cloudflare rate-limit binding or a Durable Object).
8. A problems service as a pure domain function plus a service (testable like `lib/domain`).
9. Test suites: role-by-route, lifecycle (create, assign, move, cancel, delete), summer time, a Playwright smoke run on staging.
10. A CI check that every schema table with `organisation_id` is in `TENANT_TABLES`.

### 12. Prioritised implementation roadmap

**Phase 0: before real centres (now to 12 October)**
- Finish the "roster" wording (7 strings).
- Fix the summer-time display and the young-worker time checks, with tests.
- Cloudflare cron for the tick; uptime monitor.
- Orphan pay lines: clean up and stop new ones; exclude cancelled courses from payroll.
- Multiple admins (grant, last-admin guard, transfer ownership).

**Phase 1: first weeks of real use**
- Problems service, shown on the dashboard, roster, digest and app.
- Cancel workflow (course and session; notify; pay rule); Delete only for drafts.
- Re-validate assignments when sessions change; leave counts as unavailable; qualification check in the picker.
- Editable course location and equipment; equipment maintenance and clash flags.
- Unique keys and batched writes for course create, assign and bulk availability.
- Admin-entered availability; Blank/Free/Maybe/Busy legend.
- Pay-rate changes applied to unapproved lines; "roster changed since approval" flag; volunteers hidden from payroll.
- Single staffing panel.
- Tests: role-by-route, lifecycle, summer time.

**Phase 2: before peak season**
- Editable roster (side panel), swap staff.
- Per-day staffing overrides on multi-day courses.
- Bounded queries and indexes; pence columns.
- Recurring availability; ICS feed; offline "my week"; Face ID instead of the PIN in the app.
- Settings tabs and a Security tab; step-up PIN for export and anonymise; confirmations when switching off safety checks.
- Durable rate limits; `rememberCentre` made internal; https-only privacy URL; Android channel name; DMARC quarantine.

**Phase 3: later**
- Planning board with drag and drop; holiday-pay line; payroll summary; equipment next-booked; season roll-over; Playwright smoke suite; the `TENANT_TABLES` CI guard.

---

*No code has been changed for this audit. I'll wait for your approval of the phases, or of specific items, before making changes.*

---

## Part E: Conor's decisions (4 October 2026)

Conor returned the audit with an answer against every recommendation and answered
the follow-up questions. This section is the working spec; the phases below
replace section 12.

**Approved as written:** every recommendation marked "Do" in the returned document
(nearly all of them), including the critical fixes, the problems service, editable
course locations and equipment, cancel workflow, unique keys and batched writes,
admin-entered availability, pay-rate changes applied to unapproved lines, the
"roster changed since approval" flag, volunteers hidden from payroll, period
summary, pence columns, holiday-pay line, settings tabs, a Security tab (plus a
password-strength indicator), confirmations and PIN step-up for dangerous
actions, "who can see this" on sensitive pages, offline "my week", Face ID in the
app with the PIN as the fallback, ICS feed, all the visual improvements, and the
Cloudflare cron (GitHub stays as the backup pinger).

**Decided differently from the recommendation:**

1. **Roles.** Four kinds of user, nothing else:
   - *Superadmin*: the person who set the centre up and pays. One per centre; a
     transfer is done by ActivityRoster from the Dev Center.
   - *Office admin*: uses the office. Which features they can reach is set by the
     superadmin per person; a new office admin starts with **nothing ticked**.
     Toggles: Roster & courses · Staff · Emergency & guardian contacts (incl. the
     young-worker register) · Payroll · Settings · Billing · Exports & data tools.
   - *Instructor*: the instructor app. Senior instructors and volunteers are
     instructors; "senior" is a qualification, not a platform role.
   - *Parent*: read-only roster of their child plus approve/decline/withdraw
     parental permission (see 3).
   The senior-instructor and welfare-officer roles are removed.
2. **Welfare officer** is not an account. Settings → a free-text list of welfare
   officers' names; optional default duty pattern (which days/slots); the roster
   gets an optional "Welfare on duty" field (a dropdown of those names, like
   locations and equipment). It is a note on the roster, nothing more.
3. **Parent approval flow.** When a young person signs up in the app and their
   date of birth shows under 18, they are asked for a parent's email; the parent is
   invited to make a minimal account and approve. Required by default; a centre
   setting can make it optional (legally required only under 16 in Ireland; good
   practice otherwise). Invite email says why, names the centre, allows decline.
4. **Availability has no blank.** Every slot is Busy until the instructor (or the
   office) marks it Free or Maybe. Beyond the centre's availability window the
   slot is "not asked yet" and does not block. The office roster shows a note that
   the window can be lengthened, linking to the setting. Recurring patterns: yes
   (A11-3), plus a note per day (A4-1).
5. **Times.** No time zones. Session times are entered and shown as typed, 24-hour,
   everywhere (roster, PDF, app, emails, young-worker checks). Clock-in/out stores
   the device's local wall-clock time. The centre's zone is detected from the
   browser at sign-up and kept internally only to time the morning digest; the
   time-zone setting is removed from Settings.
6. **Roster board (option C).** Desktop. Default layout (a): course cards per day
   with open roles, drag instructors from a side list; a switch to layout (b):
   instructor rows × day/slot columns. The board is the Roster page (view and
   edit); the Courses page keeps course creation and editing. Per-day staffing
   overrides (A3-3 option B) ship with it.
7. **New-device check** for office users: challenge on a new device or a new city
   (not on every network change). Instructors stay at country level.
8. **Delete vs retire** for locations, equipment, course types and instructors:
   delete when nothing has ever referenced the item; otherwise retire, with
   retired items in a collapsed "Retired" section.
9. **Equipment option B**: quantities per type checked against the courses that
   need them, with a setting to switch the check off. No "next booked".
10. **Rate limits** are per account, never per shared address, so a busy centre is
    never cut off.
11. **Not doing:** equipment "next booked"; the unique-constraint note in A3-7
    (covered by A3-6).

**Phases (all to production until 13 October; staging first after that):**

- **Phase 0, now:** finish the "roster" wording; times as typed everywhere;
  Cloudflare cron for the hourly tick (GitHub as backup); remove phantom pay
  lines and stop new ones; cancel workflow for courses and sessions (roster,
  app, PDF, sheet, payroll, notifications).
- **Phase 1:** the roles model (superadmin, office admins with toggles, transfer
  from the Dev Center), welfare-officer names and "Welfare on duty", parent
  approval flow, Security tab, password strength, tighter device check for
  office users.
- **Phase 2:** problems service (dashboard, roster, digest, app); re-validation
  on edits; leave → Busy; qualification check in the picker; editable course
  locations and equipment; equipment quantities; unique keys and batched
  writes; availability with no blank, recurring patterns, day notes and
  office-entered availability; payroll fixes (rate changes, changed-since-
  approval, volunteers hidden, summary, pence, holiday pay); single staffing
  panel; delete-or-retire with collapsed Retired sections; tests (role-by-
  route, lifecycle, times).
- **Phase 3:** the roster board with per-day staffing and the two layouts; Today
  strip and dashboard reshuffle; side panels and consequence dialogs; settings
  tabs; Course setup beside Courses.
- **Phase 4:** app items (offline week, Face ID, ICS), durable rate limits,
  remaining P2/P3 technical items.
