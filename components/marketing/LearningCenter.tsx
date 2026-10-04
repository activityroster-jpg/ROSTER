"use client";

import { useState } from "react";
import { LearnMockup, MOCKUP_IDS } from "./LearnMockup";
import { PROVIDERS } from "@/lib/integrations/catalogue";

/** A block of guide content. */
type Block =
  | { kind: "p"; text: string }
  | { kind: "steps"; items: string[] }
  | { kind: "bullets"; items: string[] }
  | { kind: "tip"; text: string }
  | { kind: "sub"; text: string }
  | { kind: "providerHelp" };

interface Section {
  id: string;
  icon: string;
  label: string;
  blurb: string;
  blocks: Block[];
}

const SECTIONS: Section[] = [
  {
    id: "getting-started",
    icon: "🚀",
    label: "Getting started",
    blurb: "Set your centre up in a few minutes with the guided wizard.",
    blocks: [
      { kind: "p", text: "When you first sign in you land on the onboarding wizard. It only asks for what it needs to get you rostering — everything else can wait." },
      { kind: "sub", text: "The five steps" },
      { kind: "steps", items: [
        "How you run — pick the extra features you want (equipment, locations, operating areas, payroll, info) and choose whether your sessions run as Morning/Afternoon/Evening slots or with explicit start & end times.",
        "Courses — tick the RYA courses you offer (grouped by youth and adult), or add your own. Use “Add all RYA courses” if you run a lot of them.",
        "Team — add each instructor, tick the qualifications they hold and the courses they can teach, and add their email to send an invite.",
        "Rota PDF — choose what your printable rota shows (times, staff, students, locations, equipment), its style and whether it is portrait or landscape. You can change it later under Settings.",
        "Finish — you're ready to roster. Any optional features you switched on appear here with a “set up” link.",
      ] },
      { kind: "tip", text: "You can leave the wizard at any time with “Skip for now”. The dashboard keeps a checklist so you can finish setup later." },
      { kind: "sub", text: "Instructors under 18" },
      { kind: "p", text: "Every staff profile has a date of birth. Anyone under 18 is flagged automatically (the flag lifts on their 18th birthday), and their profile gains a parent or guardian contact plus a slot for the signed parental permission to work. Phone numbers and emails of under-18s are shown only to centre admins and the welfare officer; colleagues see names and shift times unless the young person chooses to share their contact details. A parent or guardian can be given a read-only view of their rota. Every staff member also has an emergency contact, stored encrypted and visible to admins only, with each view written to your change log." },
      { kind: "sub", text: "Your privacy notice" },
      { kind: "p", text: "You are the data controller for your staff's details; ActivityRoster processes them for you. Add a link to your own privacy notice under Office → Settings and it appears beside ours for every member of your team. Need wording? We publish a template notice for staff and a plain-English version for under-18 instructors in our documentation; ask us for a copy." },
      { kind: "sub", text: "Coming back to sign in" },
      { kind: "p", text: "Your centre lives at its own address, yourcentre.activityroster.com, and you can bookmark it. You never need to remember it, though: the Sign in link on the homepage asks only whether you run a centre or work at one, then takes your email and password. Your email tells us which centre you belong to; if you belong to more than one, you choose after signing in." },
      { kind: "p", text: "Centre admins sign in with email and password. The first time on a device, and again after that device has gone 12 hours without using the office, we email a 6-digit code to enter (if you've turned on two-factor, that step counts instead). Then you choose whether to stay signed in on that device. Pick \"just this once\" on a shared computer and you're signed out when the browser closes. You're asked for your 4-digit PIN after 30 minutes without activity, and after 12 hours away you sign in again from the start." },
    ],
  },
  {
    id: "if-the-platform-is-down",
    icon: "🛟",
    label: "If the platform is down",
    blurb: "Two fallbacks so a session can still run safely without us.",
    blocks: [
      { kind: "p", text: "Boats go out whether or not the internet is working. Two things make sure you always have today's plan on paper." },
      { kind: "sub", text: "The emergency sheet" },
      { kind: "p", text: "From the rota, press Emergency sheet. It lists today's sessions, who is on each one, their phone number and their emergency contact (and guardian, for under-18s). Print it or save it as a PDF for the duty officer or safety boat, and shred it at the end of the day. Only admins can open it, and each time it is opened is written to your change log. Students aren't recorded in ActivityRoster, so keep your own booking list alongside it." },
      { kind: "sub", text: "The morning rota email" },
      { kind: "p", text: "In Office → Settings, switch on \"Email every admin the day's rota each morning\" and pick the hour. Every admin gets today's sessions, who is on them and where, with a link to the printable rota. It's off by default; we recommend it in season." },
      { kind: "tip", text: "Print tomorrow's emergency sheet the evening before if your signal on the water is poor." },
    ],
  },
  {
    id: "dashboard",
    icon: "📊",
    label: "Dashboard & calendar",
    blurb: "Your week at a glance — the visual heart of the platform.",
    blocks: [
      { kind: "p", text: "The dashboard opens on today. At the top you'll find quick tiles (on the water now, hours logged, sessions this week) and anything needing attention (staff not cleared, checks expiring, courses to cover, leave to approve, open shifts)." },
      { kind: "sub", text: "The week calendar" },
      { kind: "p", text: "Below the tiles is a colour-coded week calendar — youth courses in amber, adult in teal. Use the ← → buttons to move between weeks, or “This week” to jump back. Click any course block to open it." },
      { kind: "sub", text: "This week's rota" },
      { kind: "p", text: "Under the calendar is the written rota for the week — every session, who's on it, where and when — with a link to the full printable rota." },
      { kind: "tip", text: "The “＋ New course” button on the calendar takes you straight to the course planner." },
    ],
  },
  {
    id: "courses",
    icon: "📅",
    label: "Courses & sessions",
    blurb: "Build a course with any pattern of sessions across days and times.",
    blocks: [
      { kind: "p", text: "Open Courses. At the top is the planner: a week calendar plus a builder. A course is one thing (e.g. “Aug Half-Term Kids Camp”) made of one or more sessions on whatever days and times you like." },
      { kind: "sub", text: "Create a course" },
      { kind: "steps", items: [
        "Give it a name (optional but recommended — it makes the course unique and easy to find).",
        "Pick the course type (this sets the RYA scheme, ratios and whether safety cover is required).",
        "Add sessions — click a day in the calendar, or use “＋ Add session”. Add as many as you need: e.g. two on Saturday, one Monday evening, one Wednesday.",
        "For each session set the slot (Morning/Afternoon/Evening), or tick “Exact times” to set a precise start & end.",
        "Open “More options” if you want to say who's needed (e.g. 2× Instructor and 1× Safety Boat) or tick the locations and equipment the course uses — all optional.",
        "Click “Create course”.",
      ] },
      { kind: "sub", text: "Manage a course" },
      { kind: "bullets", items: [
        "Open a course to rename it, change its status (draft, scheduled, confirmed, completed, cancelled), set how many students are booked (this drives the ratio check), add or remove sessions, and assign instructors.",
        "The search box above the list finds a course by its name or type, in Upcoming or Past.",
        "If your course list is ever empty (everything unticked in the setup wizard), the Courses page offers “Restore RYA courses” to bring the standard list back.",
        "Each course card shows its audience (youth/adult), the date/times of its sessions, and its staffing status (covered / under-staffed / no safety cover).",
        "Open a course card to see each role it needs and how many are filled, e.g. “Instructor 1/2”.",
      ] },
      { kind: "sub", text: "Course types: your regular list vs one-offs" },
      { kind: "bullets", items: [
        "The course-type dropdown shows only your regular list — the types you run all the time.",
        "Running something unusual? Pick “＋ Other (type it in)…” and type the name. It's a one-off and stays off your list, unless you tick “Add to my regular course list”.",
        "Course setup lists one-off types separately. Click “Add to list” to make one regular, or “Move courses to…” to file its courses under an existing type and remove the duplicate.",
      ] },
      { kind: "tip", text: "Deleting a course removes its sessions, staff assignments, equipment and location links too — so you don't leave orphans behind." },
    ],
  },
  {
    id: "import",
    icon: "📥",
    label: "Importing courses",
    blurb: "Bring your existing schedule in from a spreadsheet or calendar.",
    blocks: [
      { kind: "p", text: "On the Courses page use “Import from spreadsheet / calendar”. You can paste or upload a CSV, or an .ics calendar file." },
      { kind: "steps", items: [
        "Upload or paste your data.",
        "We detect the columns (course, date, time, audience) automatically and turn each row into a draft session.",
        "Review the drafts — anything uncertain is flagged so you can correct it before it's saved.",
        "Check the Type column. Booking systems rarely use exactly your names, so we match each course to your closest course type (e.g. “RYA Stage 1 – Summer Week” → Youth Stage 1). Anything marked “no match” you can file under the right type, add to your list, or keep as a one-off.",
        "Confirm to create the courses and sessions.",
      ] },
      { kind: "tip", text: "Import is a great way to move a season's worth of courses over in one go instead of typing them in one by one." },
    ],
  },
  {
    id: "integrations",
    icon: "🔌",
    label: "Booking system integrations",
    blurb: "Pull your courses in from the booking system you already use — whenever you press the button.",
    blocks: [
      { kind: "p", text: "If you already take bookings in another system, ActivityRoster can pull your courses in so you never re-type them — only when you press “Check for updates”, never on a schedule. Open Office → Courses → “Connect a booking system” (or the Integrations page)." },
      { kind: "sub", text: "How it works" },
      { kind: "steps", items: [
        "Pick your booking system from the list (WebCollect, Bookwhen, Eola, Class4Kids, Checkfront and more — or any calendar).",
        "Paste its calendar (iCal) feed URL — each system shows you where to find this; the page gives per-system hints. Some (e.g. Bookwhen) can connect with an API key instead.",
        "Whenever you want, hit “Check for updates”. We compare the feed with your platform and show you what's changed — nothing is imported or deleted until you say so.",
        "Review the changes and Apply.",
      ] },
      { kind: "sub", text: "You're always in control" },
      { kind: "bullets", items: [
        "It's one-way and read-only — we never change anything in your booking system.",
        "“Check for updates” shows two lists: new courses in the feed to add, and courses you imported before that have been removed from the feed.",
        "New courses are pre-ticked to add; removed courses are never pre-ticked — nothing is deleted unless you tick it. You can also Edit a course instead.",
        "Each new course is matched to one of your course types, so you don't end up with near-duplicates. Check the type next to each one before applying — change it, add the name to your list, or keep it as a one-off.",
        "Only future sessions are considered; past events are ignored, and manually-created courses are never touched.",
        "It's manual on purpose — updates happen when you press the button, not on a hidden schedule.",
      ] },
      { kind: "sub", text: "Where to find your feed link, by system" },
      { kind: "p", text: "Every booking system keeps its calendar (iCal) feed URL in a slightly different place. Here's exactly where to look in each — copy that link and paste it on the Integrations page." },
      { kind: "providerHelp" },
      { kind: "tip", text: "No calendar feed? Export a spreadsheet from your system and use “Import from spreadsheet / calendar” instead — same result." },
    ],
  },
  {
    id: "app",
    icon: "📱",
    label: "The instructor app",
    blurb: "ActivityRoster on the App Store and Google Play — your rota, hours and certs in your pocket.",
    blocks: [
      { kind: "p", text: "Instructors and volunteers use the free ActivityRoster app (iPhone and Android). Everything in the instructor portal is in it — schedule, availability, clock in/out, leave, hours, documents — plus phone notifications, Face ID / fingerprint unlock and a camera button for cert photos." },
      { kind: "sub", text: "Your company code" },
      { kind: "steps", items: [
        "Open Settings → “Company code · instructor app”. Each centre has its own 6-character code — copy it and share it with your team (a notice board, a WhatsApp group, your welcome email).",
        "If a code leaks, press “Issue a new code”. The old one stops working immediately; people already joined are unaffected.",
      ] },
      { kind: "sub", text: "How an instructor joins" },
      { kind: "steps", items: [
        "Install the app and tap “Create your account”: name, mobile number, email and a password.",
        "Enter the 6-digit code we email them to confirm the address, then choose a 4-digit PIN.",
        "Type in your company code. If their email is already on your Instructors list, they're in straight away. If not, they appear under Instructors → Join requests for you to approve or decline — so a leaked code never lets a stranger in.",
        "Works for more than one centre? They join each with its code and switch between them in the app's Settings.",
      ] },
      { kind: "sub", text: "What the app adds" },
      { kind: "bullets", items: [
        "Phone notifications for rota changes, new open shifts, leave decisions and expiring certs (they can switch these off).",
        "One-tap “I'll be there” on each published course — or “Can't make it” with a reason, so the office can find cover. Colleagues, student numbers and the location show once the week is published.",
        "Availability has “Same as last week”, “All free” and “Clear week” so a regular pattern takes two taps.",
        "Settings: update your name and mobile number, change your PIN, and set or change your password. Docs has a Replace button for a renewed cert.",
        "Face ID / fingerprint instead of typing the PIN every time; the PIN stays as the fallback.",
        "Clock in and out records an approximate location — shown as a 📍 map link on your Time clock page.",
        "A camera button on Documents to photograph a certificate straight into their record.",
      ] },
      { kind: "tip", text: "The web portal keeps working exactly as before — the app and the web are the same account." },
    ],
  },
  {
    id: "staff-import",
    icon: "📇",
    label: "Importing instructors",
    blurb: "Bring your whole team in from a spreadsheet — even a rough, incomplete one.",
    blocks: [
      { kind: "p", text: "On the Instructors tab use “Import from spreadsheet”. Your list doesn't need to be tidy or complete — the only thing every row needs is a name." },
      { kind: "steps", items: [
        "Paste your list or upload a CSV.",
        "Match your columns — we guess them, you correct any that are wrong. Name is the only required column.",
        "Review every row: fix names/emails, and see any flags (e.g. missing email means no invite yet).",
        "Optionally tick “email a portal invite to everyone with an email”, then import.",
      ] },
      { kind: "sub", text: "How messy data is handled" },
      { kind: "bullets", items: [
        "Rows without a name are skipped, never guessed.",
        "Qualifications/tickets and courses-they-can-teach are matched to your catalogue by name; anything it doesn't recognise is ignored so you don't get junk — add those on each profile later.",
        "Employment type is read loosely (e.g. 'casual' → freelance) and defaults to employed.",
      ] },
      { kind: "tip", text: "Start simple: a sheet of just names and emails is enough to get everyone in and invited — you can fill in certs and courses afterwards." },
    ],
  },
  {
    id: "staff",
    icon: "👥",
    label: "Instructors & team",
    blurb: "Add instructors, job types and the courses they can teach.",
    blocks: [
      { kind: "p", text: "The Instructors tab lists everyone at your centre with their status and whether they're cleared to roster." },
      { kind: "sub", text: "Add an instructor" },
      { kind: "steps", items: [
        "Enter their name and (optionally) email.",
        "Pick their employment type — employed, freelance or volunteer. Need a different one? Add a custom job/instructor type inline.",
        "Tick the qualifications/tickets they hold and the courses they can teach (a searchable tickbox list).",
        "Save. If you gave an email, they're automatically invited to the instructor app to upload their own certs.",
        "An invite shows as “Invite pending” until they open it — access to your centre only starts when the invited person signs in, so a mistyped address can't let the wrong account in.",
      ] },
      { kind: "sub", text: "Courses each person can teach" },
      { kind: "p", text: "Each staff profile shows the courses they're approved to teach. This drives the fit checks when you roster — and you can see it at a glance on their profile." },
    ],
  },
  {
    id: "young-workers",
    icon: "🧒",
    label: "Young workers' hours",
    blurb: "How rostering checks under-18s against the working-time rules for your country.",
    blocks: [
      { kind: "p", text: "Children and young people can only work limited hours, between set times, with breaks and rest days. The limits differ for 15-year-olds and 16–17-year-olds (the 16–17 rules apply from the 16th birthday), and between term time and school holidays. ActivityRoster carries those figures as a rule pack for each jurisdiction (Great Britain, Northern Ireland and Ireland) and checks every assignment of an under-18 against them. Under-15s are not rostered as workers: they may only volunteer, no hour caps are applied to them, and rostering one who is recorded as employed raises a warning." },
      { kind: "sub", text: "What is checked" },
      { kind: "bullets", items: [
        "Hours in a day and in a week, with the term-time and holiday caps (school-day, Saturday and Sunday caps where they apply).",
        "Earliest start and latest finish.",
        "A break after a set number of hours, daily rest between two working days, and the weekly rest day(s).",
        "Everything already on their rota across all courses counts, so the check looks at the whole week, not just the course you are adding.",
        "Adults (18+) are checked too, as warnings rather than blocks: a week over 48 hours, no 20-minute break on a session longer than 6 hours, less than 11 hours between working days, or seven days in a row. They are warnings because the adult limits are averaged over several weeks and a person can opt out of the 48-hour limit in writing.",
      ] },
      { kind: "sub", text: "What happens when a rule would be broken" },
      { kind: "p", text: "Office → Settings → Young workers' hours lets you choose: block unless an admin overrides with a note (the default; the override and the reason are written to your change log), block outright, or warn only. Whatever you pick, the findings are recorded against the assignment." },
      { kind: "sub", text: "Term dates" },
      { kind: "p", text: "Add your local authority's term dates in Settings. Weeks inside a term use the stricter term-time caps; weeks outside use the holiday caps. If you add no dates, every week is treated as term time, which is the safer assumption." },
      { kind: "sub", text: "The time register" },
      { kind: "p", text: "The weekly rota page has a link to download a young-worker time register (CSV): every session each under-18 was rostered on, with hours, status, any override note, and when it was assigned, confirmed and published. Keep it with your employment records; viewing it is written to your change log." },
      { kind: "sub", text: "Verified and unverified figures" },
      { kind: "p", text: "Each figure in a pack is marked verified once it has been checked against the official source. Until then a warning that depends on it says \"figure not yet verified\", and Settings shows how many figures in your pack are still outstanding. If your centre's jurisdiction has no pack yet, Settings says so plainly and the hour checks do not run; under-18s are still flagged on the Instructors tab." },
      { kind: "tip", text: "This is a planning aid, not legal advice. Child-employment permits, school-leaving dates and local bylaws remain the employer's responsibility, and the disclaimer on the printed rota says so." },
    ],
  },
  {
    id: "roles",
    icon: "🔑",
    label: "Roles & guardian access",
    blurb: "Who can do what in your centre, and a parent's view of an under-18's rota.",
    blocks: [
      { kind: "p", text: "Every person with an account has one role in your centre, set from the Access card on their profile." },
      { kind: "bullets", items: [
        "Admin — runs the centre: everything, including billing, settings, pay and exports. Admins are set up by ActivityRoster.",
        "Senior instructor — the office rota: courses, assignments, the availability grid, leave and cover, publishing. No pay, billing, settings, exports or contact details beyond names.",
        "Welfare officer — staff profiles, guardian and emergency contacts, the emergency sheet and the young-worker register. Nothing operational or financial.",
        "Instructor — their own portal: shifts, availability, confirmations, documents.",
      ] },
      { kind: "sub", text: "Contact details between colleagues" },
      { kind: "p", text: "Colleagues see names and shift times only. An instructor who is happy to be contactable can switch on “Let colleagues see my phone and email” in their portal settings; they then appear in the Team contacts list in everyone's portal. Under-18s are never offered this." },
      { kind: "sub", text: "Parent or guardian access" },
      { kind: "p", text: "For an instructor under 18, an admin can invite the parent or guardian on file to a read-only view of the young person's rota: dates, courses, times and places, nothing else and nobody else's details. The consent the centre holds (for example “signed permission form on file”) is recorded with the invitation and shown to the guardian. Remove access from the same card at any time; it ends automatically when the profile is anonymised." },
    ],
  },
  {
    id: "licences",
    icon: "🎫",
    label: "Certs & vetting",
    blurb: "Track every cert and check, with expiry alerts.",
    blocks: [
      { kind: "p", text: "Every instructor has a document area for their qualifications (dinghy, keelboat, windsurf, SUP, powerboat, first aid…) and their checks (DBS, safeguarding, first aid)." },
      { kind: "p", text: "Vetting checks (DBS, PVG, AccessNI, Garda) are different: the centre records the status, the certificate number and the dates, and marks the check verified once it has seen the certificate. The certificate itself is never uploaded or stored, and the number is encrypted. That keeps the most sensitive document out of the system entirely. The built-in vetting checks are already marked this way; if you add your own check type under Settings → Checks, tick “Vetting check” and it is treated the same." },
      { kind: "sub", text: "Two ways to add documents" },
      { kind: "bullets", items: [
        "The instructor uploads their own: they pick the cert from a dropdown, add a photo/scan and the expiry date.",
        "The office uploads on their behalf and can edit the expiry, add a reference/certificate number, and mark it verified.",
      ] },
      { kind: "sub", text: "Expiry alerts" },
      { kind: "p", text: "Anything expiring within your lead time is flagged on the dashboard and the staff list. Instructors are reminded in the app and by email, and every Monday admins get one email listing what has expired or is about to. Expired mandatory checks stop an instructor being rostered until they're renewed." },
      { kind: "tip", text: "“Not cleared to roster” always shows the actual reason (e.g. “DBS missing”, “First Aid expired”) rather than a vague label." },
    ],
  },
  {
    id: "availability",
    icon: "🗓️",
    label: "Availability",
    blurb: "Collect availability and see it before you build the rota.",
    blocks: [
      { kind: "p", text: "Instructors submit their availability from their own app — free, maybe or busy for each Morning/Afternoon/Evening slot." },
      { kind: "sub", text: "The availability sheet" },
      { kind: "bullets", items: [
        "The office sees a grid of everyone's availability for the week, with a count of how many are free in each slot.",
        "Click through past and future weeks with the ← → buttons.",
        "A navy dot shows where someone is already rostered, so you can see availability and commitments together.",
      ] },
      { kind: "tip", text: "The number under each slot tells you how many instructors are free then — handy before you start assigning." },
    ],
  },
  {
    id: "rostering",
    icon: "✅",
    label: "Rostering & assigning",
    blurb: "Assign staff with ratio, safety-cover, fit and conflict checks.",
    blocks: [
      { kind: "p", text: "Assign staff from a course (either the card on the Courses page or the course's own page)." },
      { kind: "steps", items: [
        "Pick an instructor. The dropdown shows whether they're cleared (and the reason if not) and whether they're available for this course's times.",
        "Pick their role (e.g. Senior Instructor, Instructor, Safety Boat).",
        "Assign. We check they're qualified, not double-booked, and that the course meets its ratio and safety-cover requirements.",
      ] },
      { kind: "sub", text: "Overrides" },
      { kind: "p", text: "If someone isn't cleared, is unavailable, or would clash, you can still assign them by ticking “assign anyway” and adding a reason. The override is recorded to the audit log with who did it." },
      { kind: "tip", text: "When you pick someone who's unavailable for the course's times, a clear amber note tells you before you commit." },
    ],
  },
  {
    id: "bulk",
    icon: "⚡",
    label: "Bulk assign",
    blurb: "Roster one instructor onto many courses at once.",
    blocks: [
      { kind: "p", text: "On the Courses page, open “Bulk assign staff” to roster the same person across a run of courses in one pass." },
      { kind: "steps", items: [
        "Pick the instructor and the role.",
        "Filter the course list (all / youth / adult / needs cover) and tick the courses — or “select all shown”.",
        "Optionally tick “assign anyway” with a reason to override checks.",
        "Assign. You get a summary: how many were assigned, how many they were already on, and how many were skipped and why.",
      ] },
      { kind: "tip", text: "Bulk assign runs the same safety checks as a single assignment, and never double-books — a course they're already on is left untouched." },
    ],
  },
  {
    id: "rota",
    icon: "🖨️",
    label: "Weekly rota & PDF",
    blurb: "A clean, printable rota for the wall or the inbox.",
    blocks: [
      { kind: "p", text: "The Rota page shows the whole week: each day, each session, who's working, their role, the location/classroom and the times." },
      { kind: "sub", text: "Publish the week" },
      { kind: "steps", items: [
        "Build the week on Courses — add courses and sessions, then put instructors on them. Until you publish, instructors see nothing for that week, so you can move people around freely.",
        "On the Rota page press “Publish week”. Everyone on that week gets a notification (and an email if they allow it) asking them to confirm.",
        "Instructors tap “I'll be there” in the app. If someone can't make it they must say why; you get an email, the course shows “can't make it” and the dashboard counts it under Awaiting confirmation so you can find cover or post an open shift.",
        "Changed something after publishing? Anyone you add, remove or move in a published week is told straight away. “Re-publish & remind everyone” nudges the whole week again.",
      ] },
      { kind: "sub", text: "The PDF" },
      { kind: "p", text: "“Download PDF” on the Rota page produces a proper document, not a picture of the screen. It is a breakdown of each day: a row for every course, with the course name on the left, then its times, then who is working, then any extras you have turned on (number of students booked, location, equipment, staff roles). Pick the period beside the button: one day, the week, or the whole month. The columns, the style (Classic, Bold, Minimal or Compact) and portrait or landscape follow what you chose when you set up, and you can change them any time under Settings → Rota PDF." },
      { kind: "bullets", items: [
        "What goes on it — tick start and finish times, locations, instructors, their roles, and equipment. The course name and date are always there.",
        "Vertical — portrait pages with a table for each day. The classic noticeboard rota.",
        "Horizontal — landscape pages with the days across the top and each session as a small card. Better when you show a lot of detail or run big courses with many staff; a month becomes a calendar grid.",
        "Names — staff appear by first name. If two people on the sheet share a first name, each gets the initial of their surname.",
      ] },
      { kind: "p", text: "On screen, the “Show” tickboxes switch fields on or off and the three on-screen views (by week, by day, compact grid) are remembered on this device; they do not change the PDF." },
      { kind: "bullets", items: [
        "Move between weeks with the navigation — past or future.",
        "Print / Save-as-PDF produces a tidy one-page rota for the wall or the inbox — the layout is designed for it.",
        "Export the week's hours to CSV for payroll straight from the rota.",
        "Unassigned or under-covered sessions (and any missing safety-boat cover) are clearly marked so nothing slips through.",
      ] },
    ],
  },
  {
    id: "equipment",
    icon: "⛵",
    label: "Equipment & boats",
    blurb: "Track boats, yachts, engines and kit — and avoid clashes.",
    blocks: [
      { kind: "p", text: "If you switched on equipment tracking, the Equipment tab lets you record your fleet and kit by type — dinghies, keelboats, yachts, motor cruisers, coach/safety boats, SUPs and more." },
      { kind: "bullets", items: [
        "Manage your equipment types at the top of the Equipment tab — rename them, set how many of each you have (e.g. 12 Pico dinghies), and mark each as tracked or bulk.",
        "Assign tracked units to a course; the platform flags if the same unit is booked on two overlapping sessions.",
        "Bulk (untracked) kit doesn't conflict — use it for consumables and shared gear.",
      ] },
      { kind: "tip", text: "Equipment isn't gated — if it's not switched on you'll see a notice on the page with a one-click option to turn it on." },
    ],
  },
  {
    id: "locations",
    icon: "📍",
    label: "Locations & areas",
    blurb: "Organise your sites, classrooms and operating areas.",
    blocks: [
      { kind: "p", text: "The Locations tab lets you add the places you run from and group them into categories (e.g. “On the water”, “Classrooms”, “Off-site”)." },
      { kind: "steps", items: [
        "Add a location.",
        "Put it in a category — or add your own category if none fits.",
        "Attach locations to courses so they appear on the rota.",
        "Rename or retire a category from its box header; retired categories can be brought back from the list at the bottom.",
      ] },
    ],
  },
  {
    id: "time",
    icon: "⏱️",
    label: "Time & attendance",
    blurb: "Hours from the rota, an optional clock, pay rates and a payroll review you approve before export.",
    blocks: [
      { kind: "p", text: "Hours come from the rota: every session an instructor is on becomes a line on the payroll page automatically, with its scheduled time. Nothing extra to do." },
      { kind: "sub", text: "Pay rates" },
      { kind: "steps", items: [
        "Open an instructor's page → Pay. Choose how they're paid — per hour, per session or per day — and the rate. Volunteers simply have no rate.",
        "Add a different rate for a particular role if you need to (e.g. Senior Instructor days). The role rate wins when they work in that role.",
        "Rates apply from the next payroll line onwards; lines you've already approved keep the pay they were approved at.",
      ] },
      { kind: "sub", text: "The time clock (optional)" },
      { kind: "p", text: "Settings → Time clock & pay switches on clock in / out in the app. Instructors see the session they're clocking in to; clocking in with no session needs a short note. The office sees who's on the water now, and can step back to any earlier day. Choose whether pay follows the rota or the clock — and change it line by line on the payroll page." },
      { kind: "sub", text: "Payroll review & export" },
      { kind: "steps", items: [
        "Open Payroll. Pick a period (this week, this month, last month, custom dates or all time) and, if you like, one instructor.",
        "Every line shows the rostered time and, where the clock was used, the clocked time side by side. Pick which to pay per line, or use the main switch at the top for the whole period. Any field can be overridden — minutes, pay, a note.",
        "Tick Approve on each line (or Approve all). Approved lines are locked: later rota changes don't touch them.",
        "Download “Spreadsheet · every shift” or “Spreadsheet · totals” (CSV for Excel or Google Sheets), or print to PDF.",
      ] },
      { kind: "sub", text: "Lunch breaks" },
      { kind: "p", text: "In Settings → Lunch breaks, set a break length, who gets it (anyone working over a number of hours) and whether it's paid. Unpaid breaks come off paid hours; paid breaks are shown but not deducted." },
    ],
  },
  {
    id: "leave",
    icon: "🌴",
    label: "Leave & open shifts",
    blurb: "Approve leave and offer shifts that need cover.",
    blocks: [
      { kind: "p", text: "Staff request leave from their app; you approve or decline from the Leave area, where pending requests are counted on the dashboard." },
      { kind: "bullets", items: [
        "Open shifts let you advertise a session that needs cover; available staff can pick it up.",
        "Approved leave feeds into availability so you don't rota someone who's off.",
      ] },
    ],
  },
  {
    id: "notifications",
    icon: "🔔",
    label: "Notifications",
    blurb: "Keep staff informed by email or in-app.",
    blocks: [
      { kind: "p", text: "Each instructor can choose whether to receive email notifications. In-app notifications keep them up to date with rota changes, leave decisions and shift offers." },
      { kind: "tip", text: "Turn an instructor's email notifications off on their profile if they prefer in-app only." },
    ],
  },
  {
    id: "plans",
    icon: "🏷️",
    label: "Plans & team size",
    blurb: "Flat pricing per centre, and how the team-size limit works.",
    blocks: [
      { kind: "p", text: "ActivityRoster is priced per centre, not per user — one flat price however many people you roster. Pick a plan and move between them whenever you like." },
      { kind: "sub", text: "The plans" },
      { kind: "bullets", items: [
        "Small Club — £35/month. Designed for smaller centres: up to 10 people on your team.",
        "Standard — £65/month. Unlimited instructors and volunteers.",
        "Custom platform (recommended) — from £850 setup, plus £350 travel if we work with your team on site, then £65/month. We build and tailor the whole thing around exactly how your centre runs and hand it over ready to go.",
      ] },
      { kind: "sub", text: "How the Small Club limit works" },
      { kind: "p", text: "On Small Club you can add up to 10 people in total. Everyone counts towards the 10 — paid instructors and volunteers alike. When you try to add the 11th person, we'll let you know you've reached the limit and prompt you to upgrade to Standard for unlimited team members." },
      { kind: "tip", text: "Upgrading is instant and keeps everything you've set up — your courses, staff, certs and rota all stay exactly as they are. Because competitors charge per user, a volunteer-heavy centre usually pays far less with our flat price." },
    ],
  },
  {
    id: "billing",
    icon: "💳",
    label: "Billing & invoices",
    blurb: "Manage your subscription and get VAT invoices.",
    blocks: [
      { kind: "p", text: "Your centre starts with a free month — no card required. When you're ready, choose monthly or annual (annual works out at one month free on Small Club and two on Standard) and enter card details through secure checkout." },
      { kind: "p", text: "If the trial ends before you choose a plan, nothing is deleted: the centre goes read-only for two weeks (everyone can still look, nobody can change anything), then locks until a plan is chosen. Choosing a plan brings everything straight back." },
      { kind: "bullets", items: [
        "VAT is handled automatically at checkout for business customers.",
        "After payment you get a proper VAT invoice — downloadable as PDF and emailed to you.",
        "Manage your subscription and download past invoices from the billing area at any time.",
      ] },
    ],
  },
  {
    id: "admin-security",
    icon: "🔒",
    label: "Admin & security",
    blurb: "Roles, the 4-digit PIN and the audit trail.",
    blocks: [
      { kind: "p", text: "Lost a phone or left yourself signed in on a shared computer? Office → Security → “Sign out all other devices” ends every other session and forgets every confirmed device, keeping only the one you are using. Your centre also sets how long an idle admin screen waits before asking for the PIN again, under Settings → Security (5 minutes to 4 hours; 30 by default). A full sign-in is always required again after 12 hours away." },
      { kind: "p", text: "Access is authorised on every request: we resolve your account, your centre and your role, and deny anyone who isn't a member." },
      { kind: "sub", text: "Second-factor PIN" },
      { kind: "steps", items: [
        "Each admin sets a 4-digit PIN the first time they sign in.",
        "The PIN is asked for at every login, in addition to the password.",
        "Too many wrong attempts locks the PIN for a cool-off period.",
        "Forgotten it? “Reset it” asks for your password — or emails a one-time code to your account and recovery addresses — before letting you choose a new one. Being signed in isn't enough on its own.",
      ] },
      { kind: "sub", text: "Second step at sign-in (optional)" },
      { kind: "steps", items: [
        "Settings → Security → Second step. Choose an authenticator app (Google Authenticator, 1Password, Authy…) or a code by email, then confirm one code. Save the backup codes somewhere safe.",
        "From then on, signing in with your password asks for the code — sent the way you chose. A backup code gets you in if you've lost the phone or the inbox; each one works once.",
        "Change the method or turn it off any time from the same place; it asks for your password first. Sign-in links still work as before.",
      ] },
      { kind: "sub", text: "New device or country? Password first" },
      { kind: "bullets", items: [
        "The first time you use a new device, or the same device from a new country, you're asked for your password before the PIN — even though you're already signed in. Accounts without a password get a one-time code by email instead. Switching between Wi-Fi and mobile data doesn't trigger it.",
        "Once confirmed, that device isn't asked again for 90 days. Your confirmed devices are listed under Security, with a “Forget all devices” button if a device is lost.",
        "A stolen session or a left-open laptop can't be used from somewhere new without the password.",
      ] },
      { kind: "sub", text: "Know when something changes" },
      { kind: "bullets", items: [
        "Every PIN set or reset, lock-out, recovery-email change and password reset is recorded with the device, country and IP it came from.",
        "You get an email each time — to your account address and your recovery address — so an intruder can't act quietly.",
        "Resetting your password signs out every other device.",
        "See the last few events under Security → Recent security activity.",
      ] },
      { kind: "sub", text: "Audit trail" },
      { kind: "p", text: "Every rota, resource, settings and billing change is written to an audit log — including who made an override and why." },
    ],
  },
  {
    id: "settings",
    icon: "⚙️",
    label: "Settings & configuration",
    blurb: "Tune courses, roles, checks and how sessions run.",
    blocks: [
      { kind: "p", text: "Settings is where you adjust the defaults you set during onboarding." },
      { kind: "bullets", items: [
        "Activate or retire course types, qualification/instructor types and compliance checks — retired items keep their history and stop appearing for new records.",
        "Switch optional features on or off.",
        "Change how sessions run (slots vs explicit times) and your alert lead time for expiries.",
        "Lunch breaks: set the break length, after how many hours it applies, and whether it's paid. Payroll uses this.",
      ] },
      { kind: "sub", text: "Course default schedule" },
      { kind: "steps", items: [
        "In Settings → Course default schedule, click Set next to a course type.",
        "Add each session: which day of the course (Day 1, Day 2…) and its start and end times. A two-day course might be Day 1 09:00–17:00 and Day 2 09:00–17:00.",
        "Save. Now, when you pick that type in “Add a course”, choose a start date and click “Fill sessions”. Every session is filled in for you, and you can still change any of them.",
      ] },
      { kind: "tip", text: "Configuration is deactivate-never-delete: old records keep pointing at retired settings and still render correctly." },
    ],
  },
  {
    id: "retention",
    icon: "🗓️",
    label: "Data retention",
    blurb: "How long records are kept, and the 14-day notice before anything goes.",
    blocks: [
      { kind: "p", text: "Office → Settings → Data retention sets how many months each kind of record is kept: former staff profiles, leave requests, availability, notifications, clock and payroll records, and the change log. The defaults follow our published retention schedule; statutory minimums (6 years for payroll, 3 for the change log) cannot be shortened." },
      { kind: "sub", text: "What happens" },
      { kind: "steps", items: [
        "Once a day the system looks for records past their period.",
        "Every admin is emailed a list of what will go, with 14 days' notice. Nothing has gone yet at that point.",
        "A former staff member's profile shows the date and a “Keep for another N months” button, which restarts their clock.",
        "When the 14 days are up, the records are removed. People are anonymised rather than deleted: rota and payroll history stays as “Former staff member”, everything identifying goes.",
        "Each run is written to your change log, and re-applied automatically if the database is ever restored from a backup.",
      ] },
      { kind: "tip", text: "Need something kept longer for a legal reason, such as an incident report? Lengthen the period here and note why in your own records." },
    ],
  },
  {
    id: "data",
    icon: "🛡️",
    label: "Data, privacy & export",
    blurb: "Hosted on Cloudflare in the EU, UK GDPR-ready, and yours to export.",
    blocks: [
      { kind: "p", text: "Your data is pinned to the EU for GDPR, with PII scrubbing on error monitoring. Each centre's data is structurally isolated — it can never be read alongside another centre's." },
      { kind: "bullets", items: [
        "Export your centre's data at any time.",
        "If a centre is ever suspended, it can still export within the retention window before deletion.",
      ] },
      { kind: "sub", text: "When a staff member asks about their data" },
      { kind: "p", text: "Open their profile and use the Data & privacy card. You are the data controller for your staff; these tools let you answer a request yourself, within the month the law allows." },
      { kind: "bullets", items: [
        "Copy of their data — download everything the centre holds about them as JSON or CSV. Each download is recorded in the change log.",
        "Correct — edit the profile as usual; every change is recorded.",
        "Restrict processing — keeps the record but stops it being used: they cannot be rostered and get no notifications until you lift it. Give a reason; it goes in the change log.",
        "Anonymise (erasure) — removes everything identifying, their certificates and files, availability, leave, pay rates, notifications and their login. Rota and payroll history stays as “Former staff member”. Type their name to confirm; it cannot be undone, and it is re-applied automatically if the database is ever restored from a backup.",
      ] },
      { kind: "sub", text: "Your change log" },
      { kind: "p", text: "Office → Change log lists every change and every sign-in event on your centre's accounts. Download CSV gives you the last 90 days; add ?from=YYYY-MM-DD&to=YYYY-MM-DD to the link for another period." },
    ],
  },
];

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case "p":
      return <p className="text-sm leading-relaxed text-slate-600">{b.text}</p>;
    case "sub":
      return <h3 className="mt-5 font-display text-base font-semibold text-navy">{b.text}</h3>;
    case "steps":
      return (
        <ol className="ml-1 space-y-2">
          {b.items.map((t, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-600">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-teal text-[11px] font-bold text-white">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      );
    case "bullets":
      return (
        <ul className="space-y-1.5">
          {b.items.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600">
              <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-teal" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      );
    case "tip":
      return (
        <div className="rounded-lg border-l-4 border-amber bg-amber/10 px-4 py-2.5 text-sm text-navy">
          <span className="font-semibold">Tip:</span> {b.text}
        </div>
      );
    case "providerHelp":
      return (
        <div className="space-y-2">
          {PROVIDERS.filter((p) => p.icsHelp).map((p) => (
            <div key={p.id} id={`integration-${p.id}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy">{p.name}</p>
                <div className="flex items-center gap-2">
                  {p.apiAdapter ? <span className="rounded bg-teal/15 px-1.5 py-0.5 text-[10px] font-semibold text-teal">API key too</span> : null}
                  {p.website ? <a href={p.website} target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">Open {p.name} ↗</a> : null}
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-600">{p.icsHelp}</p>
            </div>
          ))}
        </div>
      );
  }
}

export function LearningCenter({ initialTopic }: { initialTopic?: string }) {
  const startId = initialTopic && SECTIONS.some((s) => s.id === initialTopic) ? initialTopic : SECTIONS[0]!.id;
  const [active, setActive] = useState(startId);
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0]!;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Learning Centre</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy sm:text-4xl">How to use ActivityRoster</h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          A step-by-step guide to every part of the platform — from first setup to rostering, certs, billing and
          data. Pick a topic to jump in.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Tab list */}
        <nav aria-label="Learning topics" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {SECTIONS.map((s) => {
              const on = s.id === active;
              return (
                <li key={s.id} className="flex-none lg:flex-auto">
                  <button
                    type="button"
                    onClick={() => setActive(s.id)}
                    aria-current={on ? "true" : undefined}
                    className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal ${on ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    <span aria-hidden="true">{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Panel */}
        <article className="min-w-0 rounded-card border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <span className="text-3xl" aria-hidden="true">{section.icon}</span>
            <div>
              <h2 className="font-display text-2xl font-bold text-navy">{section.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{section.blurb}</p>
            </div>
          </div>
          {MOCKUP_IDS.has(section.id) ? (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">What it looks like</p>
              <LearnMockup id={section.id} />
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {section.blocks.map((b, i) => <BlockView key={i} b={b} />)}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <a href="/#get-demo" className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">Start my free month</a>
            <span className="text-xs text-slate-400">Every centre gets the whole platform — explore each topic to see what&apos;s included.</span>
          </div>
        </article>
      </div>
    </div>
  );
}
