# ActivityRoster platform review — October 2026

Full write-up (with a tickable plan): https://claude.ai/code/artifact/cd272117-0140-47a5-88b5-38be2d63eedc

Scope: every route, server action, service, schema, page and the main components;
`npm test` (204 passing), `tsc`, `npm audit`, dependency versions. Not run: the app
against a live database, or the native iOS/Android projects on a device.

## Do these first

1. Fix the `/app` launch crash: `app/app/page.tsx` calls `appLandingAction`, which
   writes the selected-centre cookie during render; Next.js throws
   (`Cookies can only be modified in a Server Action or Route Handler`).
2. Trusted devices key on exact IP (`isTrustedDevice`), so phones on 4G get the
   password prompt constantly. Trust device + country; log IP changes.
3. `Permissions-Policy: geolocation=()` (next.config) disables geolocation on every
   page, so clock-in location is never saved. Use `geolocation=(self)`, `camera=(self)`.
4. Instructor schedule (`portal/page.tsx`) shows this week only.
5. Clock-in/out and payroll Start/Finish use `toISOString()` → one hour early in BST.
6. No pay-rate UI exists; `pay_rate` is never written, pay is always "—" and the
   setup checklist step "Set pay rates" can never complete.
7. `hours_record` rows are only created on clock-out, so payroll ignores rostered
   sessions for centres that do not use the clock.
8. No edit / deactivate for staff (`instructor.status = "inactive"` is never set).
9. Trials never end: nothing enforces `createdAt + trialDays`.
10. No notification on rota assign/remove although the app promises it.

## Security (no isolation or auth bypass found)

| Severity | Where | Issue | Fix |
| --- | --- | --- | --- |
| Medium | Tier cap | `addTeamMemberAction` (wizard), app join requests and approvals skip the Small Club cap. | Apply `instructorCapState` in all three. |
| Medium | `confirmOpenShift` | Inserts course_staff directly, bypassing licence/clash checks. | Route through `assignStaff`. |
| Medium | `claimOpenShift` | Second claimant overwrites the first silently. | Refuse when already offered, or keep claimants list. |
| Medium | Integrations | API tokens stored plaintext and included in JSON export. | Encrypt; redact from export. |
| Medium | Trusted devices | IP-keyed trust trains users to type passwords into prompts. | Device + country, 90 days. |
| Low | `/api/signup` | Auth user created before provisioning; failure orphans it. No slug reservation on trial path. | Reorder / clean up; reserve slug. |
| Low | Audit | rename course, staffRequired, email pref not audited. | Add `writeAudit`. |
| Low | Referential checks | equipment/location/course_staff inserts accept foreign ids unscoped. | Scoped `findById` first. |
| Low | Imports | No row cap, one insert per row. | Cap ~500, batch inserts. |
| Low | CSP | `'unsafe-inline'` scripts, `connect-src https:`. | Nonces; narrow connect-src. |
| Low | Deps | audit flags dev tooling only (vitest, vite, esbuild, drizzle-kit, postcss via next). | Bump at leisure. |
| Info | Passwords | min 8, no breach check. | 10+, HIBP later. |
| Info | Dev Center | allow-list only. | Require TOTP. |

Good as is: PIN second factor + lockout + reset flow; Ghost Mode enforced in the
repository; fail-closed auth rate limits; email escaping; instructor download scoping;
SSRF guard re-checked on redirects; raw-body Stripe verification + idempotency.

## Onboarding

Walk: homepage form → confirm email → PIN → wizard (How you run / Courses / Team /
Finish) → dashboard checklist → first course → invite staff.

Problems: wizard step 2 starts with nothing ticked and `setCoursesRunAction`
retires everything not ticked (re-opening the wizard and pressing Continue wipes the
course list); checklist step "Set pay rates" cannot be completed; no "what next"
after the wizard; no spreadsheet-import link in the Team step; no resend for the
confirmation email; PIN/device screens appear without explanation; the signup form
does not say the web address is permanent.

## UX and simplicity

- One vocabulary: Grades / Qualifications / Tickets / Licences are the same thing in
  five places. Use **Qualifications** and **Checks** everywhere. Payroll vs Finance,
  Portal vs App likewise.
- Settings shows unused fields: `schedulingMode` (never read), `timezone` (never
  read), slot "Code (AM/PM/EV)", role chips "ratio"/"safety". Remove or rename.
- Courses page is dense (planner + bulk assign + month/week list). Progressive
  disclosure; add search; show "Restore RYA courses" when the type list is empty.
- No course capacity edit → ratio check uses type default.
- Staff: no edit, no leaver; dead row-actions cog.
- Time clock: UTC times; today only.
- Payroll: from/to always visible; money always "—".
- Billing: raw Stripe status words.
- Change log: raw action names.
- Sign-in defaults to magic link; remember last method.
- Instructor app: this-week-only schedule; "change PIN" dead end in Settings.
- Errors: no retry/home buttons.
- Learning Centre links missing on Staff, Availability, Leave, Equipment, Locations,
  Billing, Dashboard, Time clock (CLAUDE.md rule).
- Office sidebar is fixed 240px; unusable on phone browsers.

## Functionality / logic (see table in the doc)

Critical: app launch crash. High: IP-keyed device trust; geolocation header; pay
rates missing; payroll only from clock-outs; BST display; schedule horizon.
Medium: staff edit/leaver; course capacity; rota notifications; expiry alerts (no
sending at all); trial never ends; wizard wipes course types; open-shift logic;
admins not told of leave requests. Low: UTC "today"; Dev Center marketing counts
(fixed 2026-10-03).

Scale: nearly every page loads all sessions/courses/assignments; add date windows
to `getWeekSchedule`, `getSessionEvents`, `getAttendanceBoard` before it hurts.

## Instructor app

Phone number collected but unused; Face ID only enable-able on the PIN screen;
schedule lacks horizon, colleagues, location; availability wants "copy last week";
leave "Days" should derive from dates; no file replace on Docs; Settings lacks change
PIN/password/profile. Owner has no instructor record → "profile not linked" on
"Switch to instructor view". Verify on device: push, Face ID keychain, camera,
safe areas, magic links opening Safari instead of the app.

## Dev Center

Renamed from "Platform admin" (2026-10-03). Default pricing monthly/annual fields are
dead (every org has a tier; tier price wins). Marketing outreach fixed 2026-10-03
(whole-list counts, column sorting, client paging, name-level skip in "next 10
letters"); possible duplicate rows after the RYA load (2,226 vs 2,138). Centres table
needs trial days left, last activity, search, needs-attention filter. Errors should
link to the centre and Ghost Mode. Require TOTP for Dev Center.

## Plan

Now (≈4 days): items 1–11 in the doc table (launch crash, device trust, headers,
schedule horizon, BST, pay rates, scheduled hours, staff edit/leaver, wizard step 2,
tier cap, open shifts).
Next: trial enforcement, notifications (assign/remove/time change; admins on leave &
join), expiry reminders (delivery TBD), vocabulary + plain-English settings, course
capacity, Courses page simplification, Billing/Change-log wording, guide links,
Dev Center columns.
Later: collapsible sidebar, token encryption, date-windowed queries, nonce CSP + TOTP,
sample data / universal links.

## Open questions (answers change the build)

See the doc's final section: who sets up, roles below admin, volunteer vs commercial
mix, owner-as-instructor, fixed timetable vs ad hoc, publish moment, accept/decline,
visibility of colleagues/students, change notifications, availability as hard block,
slots vs set times, mandatory checks (PB2 for safety boat?), certificate verification,
expiry reminder delivery, pay model, hours source, approval, export format, clock-in
location policy, Face ID replacing PIN, password re-prompt cadence, shift swaps,
trial end behaviour, sample data, import route, self-serve vs call, Dev Center
morning view, real default price, preferred vocabulary.

## Decisions (Conor, 2026-10-03)

- One shared admin login per centre (Principal), no personal name; no role below admin.
- Owner is not auto-instructor; hide "Switch to instructor view" when no instructor record.
- ~50/50 volunteer clubs vs commercial schools; courses mostly ad hoc.
- Roster is PUBLISHED per period once assigned; instructors CONFIRM assignments; colleagues/student counts visible only once published.
- "Busy" availability BLOCKS rostering, admin override allowed.
- Default session times per course type, editable per course (exists).
- Nothing mandatory unless the centre ticks it; safety boat does not require PB2 → seed checks as optional.
- Expiry reminders delivered in the app/portal (in-app + push), generated lazily.
- Pay: per instructor, centre chooses hourly / per session / per day (optional per role).
- Hours from the ROSTER by default; clock is an optional switch; pay source roster|clock is a centre setting.
- Payroll review page: auto-filled from roster, all fields editable, roster vs clock side by side with per-line choice + main switch; reviewed/approved before export.
- Clock-in shows the session; clocking in without a session allowed but needs a mandatory note.
- Face ID replaces PIN in the app (PIN backup); password only after a week unused; device trust by device+country; no shift swaps.
- Trial end: read-only, then locked out; no sample data.
- Real prices: £35 Small Club, £65 Standard — remove dead default monthly/annual fields.
- Vocabulary: "certs", "instructors", "roster" (URLs unchanged).

## Progress (2026-10-03, branch `claude/new-session-2wxbwe`)

Done: launch crash; device trust by device+country; geolocation/camera header;
schedule horizon; UK times everywhere; pay rates (per instructor, per role,
hour/session/day); roster-first hours with optional clock and per-line roster vs
clock choice; payroll review/approve; staff edit + leaver; wizard step 2 fix;
tier cap on all three paths; open shifts first-come + via `assignStaff`; trial
end → read-only (14 days) → locked, Dev Center trial controls; roster-change,
expiry and admin notifications; vocabulary pass; plain-English settings; course
capacity; Restore RYA courses; planner "More options"; billing/change-log
wording; guide links on every page; responsive office navigation; publish week +
instructor confirm/decline; integration tokens encrypted at rest and redacted
from export; date-windowed schedule/attendance queries; `connect-src` narrowed;
two-factor step at sign-in + authenticator required for the Dev Center; Dev
Center search / needs-attention / last-active; universal-link files served from
env; passwords 10+; Learning Centre updated for all of the above.

Also done (later the same day): sign-up reserves the web address, removes an
orphaned login if provisioning fails; breached-password check (HIBP k-anonymity)
on sign-up and every set/change password; imports capped at 500 rows and
`insertMany` chunked for D1; scoped id checks in `assignStaff`, equipment and
location creation; email-preference changes audited; sign-in remembers the last
method; instructor schedule shows the location; Dev Center errors link to the
centre with a Ghost button; "Merge duplicates" for prospects; availability
"Same as last week" / "All free" / "Clear week"; document Replace (old file
removed); profile (name, mobile) and password cards in the app Settings.

CSP nonces: the signed-in app now gets a nonce + strict-dynamic policy in
REPORT-ONLY mode (middleware → `lib/security/csp.ts`), with violations landing
in Dev Center → Errors tagged `csp-report-only`. After a quiet week, enforce it
(move the nonce policy to the enforced header and drop `'unsafe-inline'` from
script-src in next.config). Marketing pages stay on the static policy because
they are prerendered.

User-side: run `d1-roster-payroll-trial-migration.sql`; set `BETTER_AUTH_SECRET`
(and optionally `TOKEN_ENCRYPTION_KEY`), rotate the exposed Stripe keys, set
`FCM_SERVICE_ACCOUNT_JSON`; enrol an authenticator app at `/admin/security` on
first Dev Center visit; Apple/Google accounts and universal-link vars per
`mobile/README.md`.
