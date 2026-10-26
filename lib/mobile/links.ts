/**
 * The paths on the main domain that open inside the instructor app when tapped
 * on a phone: iOS universal links (app/.well-known/apple-app-site-association)
 * and the Android app-link filter (mobile/android …/AndroidManifest.xml, kept
 * in step by tests/mobile/app-links.test.ts).
 *
 * Deliberately not here: /api/auth/* (a centre owner's "confirm my email" and
 * the office invitation link, which must open in the browser, where the office
 * lives) and the marketing site. The app signs people in with emailed codes,
 * so it never needs to receive an auth link.
 */
export const APP_LINK_PATHS = ["/app/*", "/portal/*", "/set-pin", "/pin"] as const;

/** The same paths as Android `pathPrefix` values (no wildcard). */
export const ANDROID_PATH_PREFIXES = ["/app", "/portal", "/set-pin", "/pin"] as const;
