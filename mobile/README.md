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
  www/index.html        offline fallback only
  resources/            icon + splash sources (generated → platform assets)
  ios/, android/        created by `npx cap add` on your Mac (not committed)
```

## 0. Accounts you need (one-off)

| Account | Cost | Why |
|---|---|---|
| **Apple Developer Program** — https://developer.apple.com/programs/enroll/ | US$99 / year | App Store + push certificates. Enrol as the company (needs a D-U-N-S number; Apple can issue one, allow ~1–2 weeks) or as an individual to start faster. |
| **Google Play Console** — https://play.google.com/console/signup | US$25 once | Play Store. Identity verification can take a few days. |
| **Firebase project** — https://console.firebase.google.com | free | Push notifications (FCM) for both platforms. |

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
- **Subtitle / short description**: Your rota, hours and licences — for RYA centre staff.
- **Description**: ActivityRoster is the staff app for sailing and watersports
  centres that run on ActivityRoster. See your sessions for the week, set your
  availability, clock in and out, request leave, pick up open shifts and keep
  your RYA tickets and vetting documents up to date — straight from your phone.
  Phone notifications tell you when your rota changes. Join your centre with
  its company code; work for more than one? Switch between them in Settings.
  Your centre must use ActivityRoster (activityroster.com).
- **Keywords**: RYA, sailing, rota, roster, instructor, watersports, staff, timesheet
- **Screenshots**: take them on a phone from the running app (Schedule,
  Availability, Clock, Documents, Settings). Apple needs 6.7" and 6.5" sizes;
  Play needs at least 2 phone screenshots.

## 4. Updating

Web changes need nothing — the app shows the live site. Only change the native
projects when a plugin or Capacitor version changes: bump `package.json`,
`npm install && npx cap sync`, rebuild, re-submit.
