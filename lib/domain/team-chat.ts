/**
 * The message the office sends on its team chat alongside the app invites,
 * so people know the invite is real, where to look and when to finish by.
 * Used by the setup wizard and the Instructors page.
 */
export function teamChatMessage(centreName: string, joinCode: string | null, finishBy: string): string {
  return [
    `Hi all, ${centreName} now uses ActivityRoster for the roster.`,
    "You should have an email from ActivityRoster inviting you to set up your account. If you can't see it, check your spam or junk folder.",
    `Please set your password, add your instructor licences and fill in your availability by ${finishBy}.`,
    joinCode ? `No email? Go to activityroster.com/app (or the ActivityRoster app), create an account with the email we have for you, and enter our centre code ${joinCode}.` : "No email? Let the office know and we'll send it again.",
  ].join("\n\n");
}
