# App Store listing: ActivityRoster

Copy-paste text for App Store Connect → My Apps → ActivityRoster → the version
page, plus the answers to every form Apple asks for. Screenshots are in this
folder (iPhone 6.9" and 6.5", taken from the made-up demo centre: no real
people or data). The Google Play version of all this is `docs/play-store/listing.md`.

## Name (30 max)

ActivityRoster

## Subtitle (30 max)

Your shifts, hours and certs

## Promotional text (170 max, can change without a new build)

See your shifts the moment they change, mark when you're free, request leave, check your hours and keep your RYA certs up to date. For staff at centres on ActivityRoster.

## Description (4000 max)

ActivityRoster is the staff app for sailing and watersports centres that use ActivityRoster to plan their rota. Join your centre and everything about your work is in one place.

YOUR SHIFTS
• See every session you're on for the next four weeks: the times, the course, where, who you're working with and how many students.
• Know what's settled: your centre confirms each day, and your phone tells you when it does or when anything changes.
• Add your shifts to your phone's own calendar with one link that stays up to date.
• No signal on the pontoon? The app still shows your week.

YOUR AVAILABILITY
• Tap a morning, afternoon or evening to mark it free, maybe or busy, and add a note for the office.
• Set your usual week once and only change the exceptions, or copy last week in one tap.
• Plan up to four weeks ahead, or as far as your centre allows.

LEAVE AND OPEN SHIFTS
• Ask for time off and hear back when the office approves it.
• Pick up open shifts your centre needs covering.

HOURS AND PAY
• See the sessions you've worked, your total hours and your estimated pay, so you can check them against your payslip.
• Clock in and out from your phone if your centre uses the time clock.

CERTS AND DOCUMENTS
• Upload a photo or PDF of each RYA or other licence with its expiry date.
• You and your centre are reminded before anything expires.

PRIVATE BY DESIGN
• Colleagues see each other's names on a session, never phone numbers or emails.
• Your mobile number is optional.
• Sign in with your email, password and a 4-digit PIN, with Face ID on supported phones.
• Ask for your account and data to be deleted at any time from Settings.

WORK AT MORE THAN ONE CENTRE?
Join another centre and switch between them in Settings.

Your centre must use ActivityRoster (activityroster.com). If they've added your email to their instructor list, the app offers your centre by name; otherwise ask whoever runs your centre for its company code.

## Keywords (100 characters max, commas, no spaces)

RYA,sailing,rota,roster,instructor,watersports,shifts,availability,timesheet,dinghy,powerboat,staff

## What's New (version 1.0)

First release.

## URLs and contact

- Support URL: https://activityroster.com/contact
- Marketing URL: https://activityroster.com
- Privacy Policy URL: https://activityroster.com/privacy
- Copyright: 2026 ActiveRoster Ltd
- Category: Business. Secondary: Productivity.
- Price: Free. Availability: all countries (the app is useless without a centre, so there is nothing to restrict).
- Content rights: No, it does not contain, show or access third-party content.
- Age rating questionnaire: answer **None** to everything (no violence, gambling, medical, unrestricted web access, user-generated content open to the public, etc.). Result: 4+.

## App Privacy (the "nutrition label")

Answer **Yes, we collect data from this app**, then:

| Data type | Collected? | Linked to the user? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Contact info → Name | Yes | Yes | No | App functionality |
| Contact info → Email address | Yes | Yes | No | App functionality |
| Contact info → Phone number | Yes (optional, only if entered) | Yes | No | App functionality |
| Location → Precise location | Yes (only when clocking in, and only if the centre uses the time clock) | Yes | No | App functionality |
| User content → Photos or videos | Yes (certificate photos the person uploads) | Yes | No | App functionality |
| User content → Other user content | Yes (availability, leave requests, notes) | Yes | No | App functionality |
| Identifiers → User ID | Yes | Yes | No | App functionality |
| Identifiers → Device ID | Yes (for phone notifications) | Yes | No | App functionality |
| Diagnostics → Crash data | Yes | No (email addresses are removed before sending) | No | App functionality |

Everything else: not collected. No advertising, no analytics, no tracking across apps.
"Data not linked to you" only holds crash data.

## App Review information

- Sign-in required: **Yes**. Give the reviewer login below.
- Contact: your name, phone and hello@activityroster.com.
- Notes (paste this, filling in the login):

> ActivityRoster is the staff app for sailing centres that run their rota on activityroster.com. Staff normally join through their centre. For review, use this instructor login at a demo centre we made for you:
>
> Email: REVIEWER EMAIL
> Password: REVIEWER PASSWORD
> PIN (asked after signing in): 4826
>
> Sign in, enter the PIN, and you land on My schedule for the demo centre (Lakeside Sailing Centre). Available, Leave, Hours, Docs and Settings are the tabs along the bottom. Phone notifications are optional and the app asks to turn them on; location is only used by the Clock tab, which this demo centre has switched on so you can see it. Nothing in the app is a purchase. The demo centre's data is made up.

### Making the reviewer login (once, before you submit)

1. Dev Center → Centres → make a test centre called "App Review" (RYA centre / club), or use Harbourside.
2. Instructors → add an instructor with an email you control, e.g. `conor+review@...`, and tick the time clock on under Settings so the Clock tab shows.
3. In the app on your own phone, sign up with that email and a password you choose, confirm the code, set the PIN to 4826, and join the centre (it's offered by name). Sign out.
4. Cloudflare → Workers & Pages → roster → Settings → Variables → add `APP_REVIEW_EMAILS` = that email. Reviewers sign in from the USA and can't read your email; this lets that one login through the "somewhere new" check.
5. Put the email and password in the review notes. Remove the variable after approval if you like.

## Version and build

- Version: 1.0.0. Build: the number the iOS build workflow prints (its run number).
- Export compliance: already answered in the app (`ITSAppUsesNonExemptEncryption` = No: standard HTTPS only), so App Store Connect does not ask.
- Release: **Manually release this version** on first launch, so you choose the moment it goes live after approval.

## Screenshots

Apple wants one set at the iPhone 6.9" size (1320 × 2868). The 6.5" set (1242 × 2688) is optional and in this folder too. The app is iPhone-only, so no iPad set is needed. Upload in this order:

1. `iphone69-01-schedule.png` — My schedule: the week's shifts
2. `iphone69-02-availability.png` — My availability: free, maybe, busy
3. `iphone69-03-documents.png` — Licences and certificates with expiry
4. `iphone69-04-hours.png` — Hours worked and estimated pay
5. `iphone69-05-settings.png` — Settings: notifications, calendar link, PIN

Made with `node videos/store-shots.mjs` against the local demo centre (see the Make videos workflow for how that is started).
