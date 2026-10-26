# Sign-up and sign-in audit, 26 October 2026

The rule: **centres sign up on the website; instructors join through the app** (or the
same screens in a browser at `/app`). The audit walked every door into the product as a
centre owner and as an instructor, found where the two crossed, and fixed them. Each
item below says what was wrong, what changed, and how it was checked.

## The doors, after the changes

| Who | Where they start | What happens |
|---|---|---|
| Centre owner, new | Website: hero email box, header "Try free for a month", `/start` | Email → password + centre name → centre created → confirmation link → office → PIN → set-up wizard. |
| Centre owner who made an account in the app first, or an instructor starting a club | Website `/start` while signed in | No new password: the centre is created for the signed-in login and "Open my centre" goes straight to the office. Signed out: "This email already has an account: sign in, then come back" with a link that returns to `/start`. |
| Instructor, new | App: Create your account | Name, email, password → 6-digit code → join by name (if the centre listed the email) or company code → PIN → schedule. |
| Instructor, already has a login, presses Create account again | App | The code signs them into their existing account and they land in their centre. The address also gets an email saying the account already existed and how to sign in. |
| Instructor invited by the office | Email | Button sets a password on the web (computer); the email now says to use the app on a phone, where the centre is offered by name. |
| Instructor on the website | Any page | Hero, `/start`, `/sign-in` and the footer point to `/instructors`, which explains there is nothing to sign up for and links to the app and `/app`. |
| Instructor on a centre's own address, signed out | `yourcentre.activityroster.com/portal` | Instructor sign-in (`?next=/portal`), not the office one. |
| Anyone signed in on the main site with no centre | `/go` | Two doors: join as an instructor (app, store badge) or create a centre, plus "waiting for X to approve you" when a join request is pending. |
| Centre owner in the instructor app | App | Told the app is the instructors' side, where the office lives, and how to add themselves as an instructor to see their own shifts. |

## Findings and fixes

1. **Instructors were steered into the centre sign-up.** Every door on the website led to
   creating a centre; nothing said "instructors: not here". *Fixed:* `/instructors` page,
   links from the hero, `/start`, `/sign-in`, the footer; the app's sign-in and sign-up
   screens say centres are set up on the website.
2. **The web sign-in's "Set up your account" dead-ended instructors.** It emailed a link
   whose only destination was the office; an instructor ended at "No centre office for
   this account yet". *Fixed:* `/go` (`lib/auth/go.ts`) sends an instructor asking for the
   office to their portal, and shows the two doors when the login has no centre at all.
   Tested in `tests/auth/go-destination.test.ts`.
3. **An existing login could not create a centre.** `/api/signup` refused any email that
   already had an account, and "sign in instead" led nowhere. This hit owners who had tried
   the app first and instructors starting a club. *Fixed:* a signed-in login creates the
   centre with no new password (the session, not the typed email, is the proof); the sign-in
   page accepts `next=/start` and returns there without the office email code. Walked in a
   browser locally: app account → `/start` → centre created → "Open my centre".
4. **Signed-out visits to a centre's `/portal` got the office sign-in** (heading "Sign in",
   emailed office code after the password). *Fixed:* `requireTenant` sends `?next=/portal`
   or `?next=/office` so each side gets its own sign-in.
5. **"Create account" in the app with an email that already had one** walked the person
   through a code and dropped them back at sign-in with no explanation. Better Auth answers
   a duplicate sign-up as if it worked (deliberately, so nobody can test which emails exist)
   and nothing is written. *Fixed:* after the code proves the address, a failed password
   sign-in means "existing account, different password": the person is signed in through
   the code and lands in their centre (checked locally: `/pin?next=/portal`), and the
   library's `onExistingUserSignUp` hook emails the owner of the address what happened and
   how to sign in. No duplicate row, no changed name or password (checked in the database).
6. **Auth links opened inside the instructor app.** iOS universal links and the Android
   app-link filter claimed `/api/auth/*` and every path, so a centre owner's "confirm my
   email" or an office invitation tapped on a phone with the app installed opened the office
   inside the app's web view. *Fixed:* only `/app/*`, `/portal/*`, `/pin` and `/set-pin` open
   in the app (`lib/mobile/links.ts`; `tests/mobile/app-links.test.ts` keeps iOS and Android in
   step). **The Android change needs the next app release to take effect**; the iOS file is
   served by the website and updates on deploy.
7. **The instructor invitation email led with the web.** *Fixed:* step one is the app, step
   two the web button for a computer.
8. **An owner inside the app** saw "Your instructor profile isn't linked yet" with no
   explanation. *Fixed:* role-aware message with the office address and how to add
   themselves as an instructor.

## Checked and left alone

- Company-code joining, join requests and approval emails: work as designed, rate-limited
  (10 tries per 15 minutes), verified-email only.
- PIN on the join screen for new app accounts; the web `/set-pin` for web accounts.
- The web sign-in page inside the app already redirects to `/app`; the apex `/portal` for a
  signed-out visitor already goes to `/app`.
- Join-by-name requires the centre to have typed the exact email on its Instructors list.
  A typo there means the person sees only the code route; the join screen says so.
- `/api/signup` still says when an email already has an account (it did before). That is a
  mild information leak on the website, accepted because the alternative (a silent failure)
  is what caused finding 3.

## What Conor should know

- Nothing here needs a database migration. Deploy production as usual.
- The Android manifest change ships with the next Play release (`mobile/android`). Until
  then, on Android with the app installed, a centre owner's confirmation link can still open
  in the app; they can open it in Chrome instead.
- Local walk-throughs used throwaway accounts on the local database only.
