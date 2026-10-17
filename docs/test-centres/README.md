# Test centres: made-up files for trying ActivityRoster

Three made-up RYA centres to load into a test centre. Every person, email and phone
number is invented (emails end in `@example.com`, phone numbers are from the UK range
kept for drama, 07700 900xxx), so nothing reaches a real person.

| Folder | Centre | What it tests |
|---|---|---|
| `1-harbourside-sailing-school` | Sailing school, dinghy and powerboat, half-term week | Adult and youth courses, two-day courses, a powerboat course, courses with no instructor yet for Auto-roster |
| `2-westbay-watersports` | Windsurf, paddleboard and dinghy | Mixed activities; `westbay-calendar.ics` tests the calendar import (as exported from Google or Outlook) |
| `3-riverside-sailing-club` | Volunteer-run club | Volunteers, junior club sessions, club racing |

## How to load one

1. Make a test centre (pick **RYA centre / club**), or use one you already have.
2. **Staff first:** Instructors → **Import from spreadsheet** → upload the centre's `…-staff.csv`.
   Untick **"Email a portal invite"** (the addresses are made up). Licences and
   courses are matched automatically.
3. **Then courses:** Courses → **Import** → upload the centre's `…-courses.csv` (and for
   Westbay, `westbay-calendar.ics` too). Courses with an instructor's name are put on the roster
   with that person; the rest are left for Auto-roster.

Staff must go in before courses, or the instructor names on the courses won't match anyone.

## To test the instructor app with one of them

Change one person's email in the staff file to your own with a `+` tag, for example
`yourname+harbourside@gmail.com` (it still arrives in your inbox), and leave the invite
ticked for the import. Open the invite email on your phone to set up that instructor's
app account.

When you've finished, remove the test centre in the Dev Center (**Remove test centre**).
