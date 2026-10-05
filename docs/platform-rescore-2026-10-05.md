# ActivityRoster: scores then and now

5 October 2026 · a short version of the 4 October audit, scored again after Phases 0–4

## The headline

**Overall: 6.5 → 8.0 out of 10.**

The audit asked 72 questions. Their average went from **6.2 to 8.1**. 61 went up, none went down, and no question now scores below 6 (before, 10 were at 4 or less).

The weak spot last time was the daily loop: checks ran once and never again, cancelling did nothing, times printed an hour late all summer, and the hourly background job barely ran. All of that is fixed.

*How this was scored:* the same way as before, by reading the code and checking it does what it claims. I didn't click through the live app as each type of user.

## By area

| Area | Before | Now | Biggest change |
|---|---|---|---|
| Dashboard | 6.2 | **8.0** | Today strip and one problems list |
| Courses | 5.0 | **8.0** | Proper cancel; edit location and kit later |
| Roster | 5.1 | **7.9** | Editable roster board; problems flagged |
| Availability | 5.8 | **8.4** | No blank slots; leave counts as Busy |
| Staff | 7.0 | **8.2** | Several office admins |
| Equipment | 4.8 | **7.5** | Shortages and maintenance flagged |
| Locations | 7.2 | **8.0** | Editable after the course is made |
| Payroll | 5.4 | **8.0** | Phantom pay lines gone; rate fixes carry through |
| Settings | 6.0 | **7.8** | Tabs and a Security tab |
| Account security | 8.3 | **9.0** | Durable per-account limits |
| Staff app | 7.0 | **8.3** | Calendar feed, offline week, Face ID |
| Workflows | 5.6 | **7.8** | Changes carry through to pay and staff |
| Technical | 7.1 | **8.1** | Hourly job on Cloudflare; 410 tests |

## Biggest jumps

- **Courses: editing or deleting a staffed course**: 3 → 8. Proper cancel: staff told, pay question asked, no phantom pay.
- **Equipment: links to courses and roster**: 3 → 8. Editable on courses; shortages and maintenance flagged.
- **Equipment: spot clashes before they happen**: 3 → 8. Shortages shown in the problems list.
- **Payroll: rounding and data integrity**: 3 → 8. Phantom pay lines removed and stopped.
- **Courses: links to staff, kit, places, roster**: 4 → 8. Edits re-check everyone on the course.
- **Roster: problems flagged**: 4 → 8. Leave, Busy, clashes and qualification gaps flagged, with re-checks.

## What still holds scores back

These are the questions still at 7 or below, and what would lift them:

- **Roster: copes with big centres (6)**: the Courses and payroll pages still load a centre's whole history. Fine today; worth bounding before a centre reaches about 40 staff or a third season.
- **Roster: two admins at once (7)**: no "someone else just changed this" warning; the last save wins.
- **Server code (7)**: only course creation is all-or-nothing. Other multi-step saves could still half-finish on a bad connection.
- **Database backups (7)**: nightly backups are running, but no restore has been practised yet (due from about 10 October).
- **Staff: after adding someone (7)**: no "invite pending" label or resend button on the staff list.
- **Settings: permissions understandable (7)**: "who can see this" is only on emergency contacts, not payroll.
- **Equipment (7s)**: "next booked" on each boat was left out by your decision, so these stay at 7.
- **Adding an instructor / locations (7s)**: already fine; nothing planned.

Outside the code: switch DMARC to quarantine once reports are clean, rebuild the iPhone app so the offline week reaches it, and decide on 11 October whether to enforce the stricter app security rules.

## Every question

### Dashboard

| Question | Before | Now | What changed |
|---|---|---|---|
| Useful at first login | 7 | **8** | Today strip: sessions, people, gaps, declines. |
| Nothing missing or confusing | 6 | **8** | Clashes, Busy, leave, unpublished and cancelled now shown. |
| Highlights problems | 5 | **8** | One problems list feeds dashboard, roster, digest and app. |
| Layout on desktop and phone | 7 | **8** | Today and problems first; calendar folds away. |

### Courses

| Question | Before | Now | What changed |
|---|---|---|---|
| Easy to create and manage | 7 | **8** | Location and equipment editable after creation. |
| Settings make sense | 5 | **8** | One staffing panel; staff numbers worked out, not typed. |
| Links to staff, kit, places, roster | 4 | **8** | Edits re-check everyone on the course. |
| No wasted steps | 6 | **8** | Course setup sits beside Courses. |
| Editing or deleting a staffed course | 3 | **8** | Proper cancel: staff told, pay question asked, no phantom pay. |

### Roster

| Question | Before | Now | What changed |
|---|---|---|---|
| Quick for a busy school | 5 | **8** | Roster board: drag people onto courses. |
| Clear who, where, when | 6 | **9** | Times print as typed everywhere (summer-time bug gone). |
| Assigning and swapping | 5 | **8** | Per-day staffing; open shifts fill one day. |
| Problems flagged | 4 | **8** | Leave, Busy, clashes and qualification gaps flagged, with re-checks. |
| Copes with big centres | 4 | **6** | Problems checks bounded by date. Courses and payroll pages still load full history. |
| Drag, cancel, two admins at once | 4 | **7** | Drag and drop, cancel and duplicate-proofing done. No 'changed by someone else' warning yet. |
| Secure behind the screen | 8 | **9** | Unique keys stop duplicate assignments. |

### Availability

| Question | Before | Now | What changed |
|---|---|---|---|
| Easy for instructors | 7 | **9** | Usual week pattern and a note per day. |
| Free / Maybe / Busy clear | 6 | **9** | No blank: everything is Busy until marked. |
| Feeds the roster properly | 5 | **8** | Approved leave becomes Busy; Busy after rostering is flagged. |
| Office can see it quickly | 7 | **8** | Office can enter availability for volunteers. |
| Odd states and edge cases | 4 | **8** | One row per slot; week actions saved in one go. |

### Staff

| Question | Before | Now | What changed |
|---|---|---|---|
| Adding an instructor | 7 | **7** | Unchanged (already fine). |
| Roles clear | 7 | **8** | Four simple roles: superadmin, office admin, instructor, parent. |
| Admin vs instructor vs volunteer | 5 | **9** | Several office admins, each with chosen features. |
| What happens after adding | 7 | **7** | No 'invite pending / resend' yet. |
| Sign-up, passwords, 2FA | 8 | **9** | Password strength meter; Face ID in the app. |
| What each person can reach | 8 | **9** | Loose sign-in helper closed off. |

### Equipment

| Question | Before | Now | What changed |
|---|---|---|---|
| Useful, not fussy | 6 | **7** | Quantities per type, check can be switched off. |
| See what exists | 7 | **7** | 'Next booked' not done (your decision). |
| Links to courses and roster | 3 | **8** | Editable on courses; shortages and maintenance flagged. |
| Spot clashes before they happen | 3 | **8** | Shortages shown in the problems list. |

### Locations

| Question | Before | Now | What changed |
|---|---|---|---|
| Easy to manage | 7 | **7** | Unchanged (already fine). |
| Used consistently | 5 | **8** | Editable on the course after creation. |
| No extra fields | 8 | **8** | Unchanged. |
| No security issues | 9 | **9** | Unchanged. |

### Payroll

| Question | Before | Now | What changed |
|---|---|---|---|
| Clear workflow | 7 | **8** | Period summary at the top. |
| Comes from the roster | 7 | **8** | Volunteers hidden by default. |
| Hours, rates, holiday pay | 5 | **8** | Rate changes reach unapproved lines; pence; holiday-pay line. |
| Rounding and data integrity | 3 | **8** | Phantom pay lines removed and stopped. |
| Roster changes after approval | 5 | **8** | 'Roster changed since approval' flag. |

### Settings

| Question | Before | Now | What changed |
|---|---|---|---|
| Pages logical | 6 | **8** | Split into tabs. |
| Security settings obvious | 6 | **8** | Security tab: each office user's 2FA and devices. |
| Dangerous actions protected | 6 | **8** | Warnings before switching checks off; PIN again before exports. Some plain browser pop-ups remain. |
| Permissions understandable | 7 | **7** | 'Who can see this' only on contacts so far. |
| Settings can't cause harm | 5 | **8** | Time-zone setting removed; privacy link must be https. |

### Account security

| Question | Before | Now | What changed |
|---|---|---|---|
| Passwords, PIN, devices | 8 | **9** | New-device check by device or city for office users. |
| Enforced on the server | 9 | **9** | Unchanged (already strong). |
| Blocking access attempts | 8 | **9** | Rate limits per account, stored durably; billing form limited. |

### Staff app

| Question | Before | Now | What changed |
|---|---|---|---|
| Shifts without clutter | 8 | **9** | Calendar feed and offline week. |
| Built cleanly | 7 | **8** | Offline 'my week'. iPhone needs your rebuild to get it. |
| Simple on a phone | 6 | **8** | Calendar feed, usual week, Face ID. |

### Workflows

| Question | Before | Now | What changed |
|---|---|---|---|
| Staff to availability to roster to pay | 5 | **8** | Cancel, delete and leave now carry through. |
| Location to course to roster | 5 | **8** | Editable; course created in one go. |
| Equipment to course to roster | 4 | **7** | Shortages flagged; no 'next booked'. |
| Permissions to roster to pay | 7 | **8** | Several admins with feature ticks. |
| Settings to security to access | 7 | **8** | One Security tab. |

### Technical

| Question | Before | Now | What changed |
|---|---|---|---|
| Look and feel | 7 | **8** | Wording finished; proper confirm dialogs on key actions. |
| Server code | 6 | **7** | Course creation is all-or-nothing. Other multi-step saves not yet. |
| Database | 6 | **8** | Unique keys, pence, no orphan pay lines, time rule written down. |
| Sign-in and permissions | 8 | **9** | Several admins; durable limits. |
| Roles | 7 | **8** | Simpler four-role model. |
| Centre separation | 9 | **9** | Already strong; CI now checks every table is tested. |
| Cloudflare set-up | 5 | **8** | Hourly job runs on Cloudflare, GitHub as backup; status page. |
| Database backups | 6 | **7** | Nightly backups running. First restore test still to do. |
| File storage | 8 | **8** | Unchanged. |
| Email | 7 | **8** | Retries now dependable. DMARC still 'none'. |
| Mobile app | 7 | **8** | Offline week; Android channel name. |
| Website and sign-up | 7 | **8** | 'Every clash checked' claim is now true. |
| Automated tests | 6 | **8** | 410 tests incl. every route by role, lifecycle, summer time. No browser tests yet. |
| Deploys | 8 | **8** | Unchanged; staging-first from 13 Oct. |
| Security controls | 8 | **9** | All listed gaps closed except the app CSP (decision 11 Oct). |
| Privacy | 8 | **9** | Deletion and retention sweeps now run on time. |

Full findings and evidence: `docs/platform-audit-2026-10-04.md`.
