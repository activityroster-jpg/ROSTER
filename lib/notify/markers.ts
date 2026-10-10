/**
 * Notifications carry short machine tags in their body (e.g. "[expiry:qualification:abc]",
 * "[remind:availability]") so the app can tell whether one was sent recently. People
 * never see them: strip them before showing a notification, an email or a push.
 */
const MARKER = /\s*\[(?:expiry|remind):[^\]]*\]/g;

export function stripMarkers(text: string): string;
export function stripMarkers(text: string | null | undefined): string | null;
export function stripMarkers(text: string | null | undefined): string | null {
  if (text == null) return null;
  return text.replace(MARKER, "").trim();
}

export type ReminderKind = "availability" | "licences";
export const reminderMarker = (kind: ReminderKind) => `[remind:${kind}]`;
