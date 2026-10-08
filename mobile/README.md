# ActivityRoster instructor app (iOS + Android)

A native shell (Capacitor 8) around the instructor portal. The app loads
`https://activityroster.com/app`; sign-in, company code, centre switching and
the whole `/portal` run from the live site, so a web deploy updates the app
instantly. Native plugins add push notifications, Face ID / fingerprint unlock
and the camera. Nothing in this folder talks to the database.

```
mobile/
  capacitor.config.ts   app id, name, start URL, allowed hosts
  package.json          Capacitor + plugins (install here, not in the repo root)
  www/index.html        offline fallback only (shown if the site can't be reached at launch)
  resources/            icon + splash sources (generated → platform assets)
  ios/, android/        created by `npx cap add` on your Mac (not committed)
```

## 0. Accounts you need (one-off)

| Account | Cost | Why |
|---|---|---|
| **Apple Developer Program** — https://developer.apple.com/programs/enroll/ | US$99 / year (≈£79 + VAT) | App Store + push certificates. Enrol as the company — see *UK company enrolment* below. |
| **Google Play Console** — https://play.google.com/console/signup | US$25 once | Play Store. Identity verification can take a few days. |
| **Firebase project** — https://console.firebase.google.com | free | Push notifications (FCM) for both platforms. |

### UK company enrolment (Apple)

The **Company / Organization** entity type is only offered in the **web**
enrolment on a desktop browser. The Apple Developer app on iPhone/iPad only
enrols individuals outside India, which is why the company option is missing
there.

1. **D-U-N-S number first** (free, ~5 working days). Most UK Ltd companies
   already have one because Dun & Bradstreet mirrors Companies House. Check at
   https://developer.apple.com/enroll/duns-lookup/ using the *exact* Companies
   House name (`ACTIVEROSTER LTD`, company number 17505500, not the trading
   name) and the registered office address. If none is found the same form
   requests one; D&B emails it. Allow another 2 working days for Apple to see
   it. Requested 7 October 2026 (D&B tracking ID 11024869, case 11083109).
2. **Apple Account** for the Account Holder (a company director): real legal
   first/last name, two-factor authentication on. Ideally sign in with an
   address on the company domain (e.g. `name@activityroster.com`).
3. On a **Mac/PC browser**, go to https://developer.apple.com/enroll/ → *Start
   Your Enrollment* → confirm personal details → **Entity type: Company /
   Organization**. You'll be asked for: legal entity name (must match the
   D-U-N-S record), D-U-N-S number, registered address, website on the company
   domain (`https://activityroster.com`), a work email on that domain, phone
   number, and confirmation that you have legal authority to bind the company
   (a director does).
4. Apple Developer Support phones or emails to verify, usually within a few
   working days. Then you pay the fee and the account activates.

Sole trader (no Ltd company) → enrol as *Individual*; the App Store then shows
your personal name as the seller. An individual account can later be converted
to a company one, but only by asking Apple Developer Support
(https://developer.apple.com/contact/), so it is quicker to wait for the D-U-N-S
number than to start as an individual.

You also need a **Mac with Xcode** (free, Mac App Store) for the iOS build, and
**Android Studio** (free) for Android. Both run fine on one Mac.

## 1. Firebase (push) — do this first

1. Firebase console → **Add project** → name it *ActivityRoster*.
2. **Add app → iOS**: bundle id `com.activityroster.app`. Download
   `GoogleService-Info.plist` → later goes in `ios/App/App/`.
3. **Add app → Android**: package `com.activityroster.app`. Download
   `google-services.json` → later goes in `android/app/`.
4. **Project settings → Cloud Messaging → Apple app configuration**: upload an
   **APNs Authentication Key** (create it at developer.apple.com → Certificates,
   IDs & Profiles → Keys → “+” → tick *Apple Push Notifications service* →
   download the `.p8`, note the Key ID and your Team ID).
5. **Project settings → Service accounts → Generate new private key** → a JSON
   file downloads. Give the *whole file* to the Worker as one secret:
   ```
   npx wrangler secret put FCM_SERVICE_ACCOUNT_JSON --name roster
   ```
   (paste the file contents when prompted; or Cloudflare dashboard → Workers →
   roster → Settings → Variables and Secrets → Add → type Secret).
   Until this is set, the platform simply doesn't send pushes — nothing errors.

## 2. Build the projects (on the Mac)

The `ios/` and `android/` projects are **already generated and committed**
(icons, splash screens, permissions and usage descriptions included), so you
don't run `cap add`. iOS uses CocoaPods.

```bash
# one-off tools
brew install cocoapods            # or: sudo gem install cocoapods
# in the repo
cd mobile
npm install
npx cap sync                      # installs iOS pods + copies config
```

Then:

- **iOS**: copy `GoogleService-Info.plist` into `ios/App/App/`. Open Xcode
  (`npm run ios`). Select the *App* target → **Signing & Capabilities**: choose
  your Team, then **+ Capability** → *Push Notifications* (Background Modes →
  Remote notifications and all usage descriptions are already in `Info.plist`).
  Open `ios/App/App.xcworkspace` (the *workspace*, not the project).
- **Android**: copy `google-services.json` into `android/app/`. Open Android
  Studio (`npm run android`). Camera, location, biometric and notification
  permissions are already declared in the manifest.

Run on a device (Product → Run in Xcode; ▶ in Android Studio). Sign in with a
real instructor account, enter a company code, and check: push toggle in
Settings → App, Face ID on the PIN screen, 📷 on Documents, 📍 on clock-in.

## 3. Publish

**App Store** (Xcode → Product → Archive → Distribute → App Store Connect):
1. https://appstoreconnect.apple.com → **My Apps → +** → name *ActivityRoster*,
   bundle `com.activityroster.app`, SKU `activityroster`.
2. Fill the listing (below). Privacy: *Data collected* — name, email, phone,
   precise location (only when clocking in, linked to the user), photos (user
   uploads). Age rating 4+. Category *Business*.
3. **App Review note** (paste this): “Staff rostering app for RYA sailing
   centres. To test: create an account, verify the emailed code, set a PIN, then
   enter company code **XXXXXX** (a demo centre). The centre admin approves
   join requests at …/office/staff.” Create a demo centre first and put its
   company code here — reviewers need a way in.
4. Submit. Typical review 1–3 days.

**Google Play** (Android Studio → Build → Generate Signed Bundle → .aab; keep
the keystore safe, you can never change it):
1. https://play.google.com/console → **Create app** → *ActivityRoster*, App, Free.
2. Complete *Dashboard* tasks: privacy policy URL
   (`https://activityroster.com/privacy`), app access (give the same demo
   instructions + company code), ads (none), content rating (questionnaire,
   Business), target audience (18+), data safety (same as Apple).
3. **Production → Create release** → upload the .aab → roll out. First review
   can take up to a week.

### Listing copy

- **Name**: ActivityRoster
- **Subtitle / short description**: Your roster, hours and certs — for RYA centre instructors.
- **Description**: ActivityRoster is the staff app for sailing and watersports
  centres that run on ActivityRoster. See your sessions for the week, set your
  availability, clock in and out, request leave, pick up open shifts and keep
  your RYA certs and vetting documents up to date — straight from your phone.
  Phone notifications tell you when your rota changes. Join your centre with
  its company code; work for more than one? Switch between them in Settings.
  Your centre must use ActivityRoster (activityroster.com).
- **Keywords**: RYA, sailing, rota, roster, instructor, watersports, staff, timesheet
- **Screenshots**: take them on a phone from the running app (Schedule,
  Availability, Clock, Documents, Settings). Apple needs 6.7" and 6.5" sizes;
  Play needs at least 2 phone screenshots.

## 4. Universal links (open our links in the app)

Without this, a magic link or "confirm device" email opens Safari/Chrome
instead of the app. The site already serves both verification files from
environment variables — set them and the links start opening in the app.

1. **Worker vars** (Cloudflare → Worker → Settings → Variables):
   `APPLE_TEAM_ID` (10 characters, from developer.apple.com → Membership),
   `IOS_BUNDLE_ID` (e.g. `com.activityroster.app`), `ANDROID_PACKAGE`
   (same id), `ANDROID_SHA256_FINGERPRINTS` (comma-separated; get them from
   Play Console → Setup → App signing: both the *upload* and the *app signing*
   certificate SHA-256). Redeploy, then check
   `https://activityroster.com/.well-known/apple-app-site-association` and
   `https://activityroster.com/.well-known/assetlinks.json` return JSON.
2. **Xcode**: target → Signing & Capabilities → “+ Capability” → Associated
   Domains → add `applinks:activityroster.com` and
   `webcredentials:activityroster.com` (also add `applinks:*.activityroster.com`
   so centre subdomains work).
3. **Android** (`android/app/src/main/AndroidManifest.xml`, inside the main
   activity): an intent filter with `android:autoVerify="true"`, action VIEW,
   categories DEFAULT + BROWSABLE, and `<data android:scheme="https"
   android:host="activityroster.com" />` plus one with
   `android:host="*.activityroster.com"`.
4. The Capacitor `App` plugin’s `appUrlOpen` listener routes the opened URL
   inside the web view (see `lib/mobile/native.ts`), so no further code is
   needed.
5. Test: email yourself a sign-in link, open it on the phone — it should land in
   the app, not the browser. Apple caches the association file; a fresh install
   re-fetches it.

## 5. Updating

Web changes need nothing — the app shows the live site. Only change the native
projects when a plugin or Capacitor version changes: bump `package.json`,
`npm install && npx cap sync`, rebuild, re-submit.


## Offline "my week" (iOS)

The portal registers a small service worker (`public/sw.js`) that shows the
instructor's saved week when there is no signal. WKWebView only runs service
workers for app-bound domains, so `activityroster.com` is listed under
`WKAppBoundDomains` in `ios/App/App/Info.plist` and the Capacitor config sets
`ios.limitsNavigationsToAppBoundDomains`. Rebuild the iOS app on the Mac
(`npx cap sync ios`, then archive in Xcode) for this to take effect; Android
WebView supports it without changes.
