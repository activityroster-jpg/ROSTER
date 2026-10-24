# App Review reply: Guideline 2.1, Information Needed (submission 3f1f79eb)

Apple asked for six things because the developer account is new. Reply in App
Store Connect (App Review → the message thread) with the text below, and paste
the same text into **App Information → App Review Information → Notes** so
future submissions carry it. Item 1 is a screen recording you make on your
iPhone; items 2 to 6 are the text, ready to paste.

## 1. The screen recording (you make this, about three minutes)

On your iPhone (latest iOS), Settings → Control Centre → add **Screen
Recording** if it is not there. Then record this, in this order, without
cutting. Use the reviewer login (`applereview@activityroster.com`, its
password, PIN 4826) for the sign-in part, and a fresh throwaway email of your
own for the sign-up part.

1. **Launch.** Start recording on the home screen, open ActivityRoster from its
   icon. Show the sign-in screen.
2. **Create an account.** Tap "Create account". Fill name, email (your
   throwaway), password; tap Continue. Open Mail, copy the 6-digit code, come
   back (it fills itself in) or type it. Show the join screen: enter the
   company code for the "App Review" test centre and choose a PIN. You land
   on My schedule.
3. **Sign out and sign in as the reviewer.** Settings → Sign out. Sign in with
   `applereview@activityroster.com`, the password and PIN 4826. Allow
   notifications when asked (or decline; either is fine on camera).
4. **The typical flow.** My schedule: tap a session to open it. Available:
   mark a slot Free and one Busy; tap "Usual week". Leave: tap "Next week",
   submit a request. Hours: show the grouped days. Docs: show a certificate
   with its expiry. Settings: show Notifications and Calendar.
5. **Account deletion.** Switch back to the throwaway account (Settings → Sign
   out, sign in), Settings → "Delete my account →", read the box, enter the
   PIN, tap "Delete my account". Show the sign-in screen with "Your account has
   been deleted". Stop recording.

Upload the video in the reply (App Store Connect accepts .mov/.mp4 up to
500 MB). If it is too big, AirDrop it to the Mac and compress it in QuickTime
(File → Export As → 720p).

## 2 to 6. Text to paste (fill in the two passwords)

> **2. Purpose and audience.** ActivityRoster is staff rostering for sailing and watersports centres in the UK and Ireland (RYA training centres, sailing schools, yacht clubs). The office side runs on the web at activityroster.com. This app is the companion for the centre's instructors and volunteers: it shows them the sessions they are rostered on, lets them set when they are available, request leave, pick up open shifts, see their hours and estimated pay, keep their qualification certificates up to date, and receive a notification when a day's roster is confirmed or changed. The problem it solves: centres today run this on spreadsheets and group chats, and instructors never know what they are working until the morning. The audience is adults working at a centre (some centres have 16 and 17 year old assistant instructors; their contact details are hidden from colleagues and the app shows them nothing that others cannot see).
>
> **3. Set-up and access.** An instructor gets the app because their centre invited them (email) or gave them the centre's six-character company code. Creating an account takes name, email and password, then a 6-digit code emailed to them, then one screen that joins the centre and sets a 4-digit PIN. For review we have made a test centre with a reviewer login:
>
> Email: applereview@activityroster.com
> Password: REVIEWER PASSWORD
> PIN (asked after signing in, and before deleting an account): 4826
>
> Sign in, enter the PIN, and you land on My schedule for the test centre. The tabs along the bottom are Schedule, Available, Clock, Leave, Hours and Docs; Settings is the cog at the top. To test sign-up, create an account with any email you can read and enter company code: COMPANY CODE (shown on the centre's Settings page). Account deletion is in Settings → "Delete my account": it asks for the PIN and completes immediately; the login and all personal details are removed, and the centre keeps only its past roster and pay records without the person's name (a statutory record-keeping requirement for employers in the UK and Ireland). No sample files are needed. There are no paid features, purchases or subscriptions in the app; centres pay for the service on the web.
>
> **4. External services.** Hosting, database and file storage: Cloudflare (Workers, D1, R2, KV), EU region. Authentication: our own, built on the open-source Better Auth library, running on our servers (email + password, emailed one-time codes, a 4-digit PIN, optional Face ID / Touch ID to fill the PIN on the device only). Email delivery: Resend, with Postmark as a backup. Push notifications: Firebase Cloud Messaging and Apple Push Notification service. Error monitoring: Sentry (personal data scrubbed before sending). Payments: Stripe, used only by centre administrators on the website, never in the app. Breached-password check: Have I Been Pwned (k-anonymity, the password itself never leaves the device). No advertising, analytics or tracking SDKs, and no AI services in the app.
>
> **5. Regional differences.** None in the app. The same features are shown everywhere; the only regional setting is chosen by the centre (which vetting check applies: DBS, PVG, AccessNI or Garda) and it changes a label, not a feature. Currency on the Hours tab follows the centre's setting (GBP or EUR).
>
> **6. Regulated industry or protected material.** Not applicable. ActivityRoster is workforce software for small businesses and clubs; it is not a regulated service and contains no third-party protected content. Certificates shown in the app are the instructor's own, uploaded by them or their centre. We are ActiveRoster Ltd, registered in England and Wales (company number on the website footer).

## Before you reply

- Make the reviewer login if it does not exist yet (listing.md → "Making the reviewer login"), and keep `APP_REVIEW_EMAILS` set so it passes the new-device check from the USA.
- Note the "App Review" centre's company code (Settings in the office) and put it where it says COMPANY CODE.
- The deletion step in the recording needs the build that contains Settings → Delete my account (the web app is live from the production deploy; the app shows it without a new build, because the screens come from the web).
