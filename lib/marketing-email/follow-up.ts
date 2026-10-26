/**
 * A short follow-up email to a centre that was posted the booklet, pointing
 * them at the Learning Centre. Each centre gets its own: the opening, the
 * middle and the question are picked from several by the centre's id, and the
 * text names the centre, the town, the contact and what the centre runs.
 * Plain text, one link, a polite opt-out: what reads as a personal note
 * rather than a campaign. Pure.
 */
export const LEARN_URL = "https://activityroster.com/learn";

export interface FollowUpInput {
  id: string;
  name: string;
  city?: string | null;
  region?: string | null;
  contactName?: string | null;
  /** RYA services from the directory notes, e.g. "Training Centre", "Sailability". */
  services?: string[];
  activityType?: string | null;
  /** YYYY-MM-DD the booklet went. */
  bookletSentOn?: string | null;
}

/** A stable small number from the id, so the same centre always gets the same wording. */
function pick(id: string, salt: number, n: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % n;
}

const firstName = (full: string | null | undefined): string | null => {
  const f = (full ?? "").trim().split(/\s+/)[0];
  return f && /^[A-Za-z][A-Za-z'-]{1,}$/.test(f) && !/^(the|mr|mrs|ms|dr|club|sailing)$/i.test(f) ? f : null;
};

const when = (iso: string | null | undefined): string => {
  if (!iso) return "recently";
  const days = Math.round((Date.now() - new Date(`${iso}T12:00:00Z`).getTime()) / 86_400_000);
  return days <= 9 ? "last week" : days <= 21 ? "a couple of weeks ago" : "a few weeks ago";
};

export function followUpEmail(c: FollowUpInput): { subject: string; body: string } {
  const who = firstName(c.contactName);
  const place = (c.city ?? "").trim() || (c.region ?? "").trim();
  const sent = when(c.bookletSentOn);
  const Sent = sent.charAt(0).toUpperCase() + sent.slice(1);
  const at = (salt: number, list: readonly string[]) => list[pick(c.id, salt, list.length)]!;

  // One subject for every centre, as Conor wants it: "Bala Watersports / ActivityRoster".
  const subject = `${c.name} / ActivityRoster`;
  const greeting = who
    ? at(10, [`Hi ${who},`, `Hello ${who},`, `Dear ${who},`, `Hi ${who},`])
    : at(10, [`Hello ${c.name} team,`, `Hi all at ${c.name},`, `Hello,`, `Hi there,`]);
  const opening = at(1, [
    `I posted ${c.name} our booklet on rostering ${sent}.`,
    `${Sent} I sent ${c.name} a short booklet about ActivityRoster.`,
    `Just following up on the booklet I posted to ${c.name} ${sent}.`,
    `I hope the booklet I sent ${c.name}${place ? ` in ${place}` : ""} ${sent} reached the right person.`,
    `${c.name} should have had our booklet through the post ${sent}.`,
  ]);
  // What it is, in one line: rostering and compliance, built for RYA training centres and clubs.
  const what = at(2, [
    `ActivityRoster is rostering and compliance software designed specifically for RYA training centres and clubs: it builds your instructor roster and checks ratios, instructor types and Senior Instructor cover as you go.`,
    `It's staff rostering built for RYA training centres and clubs, with the compliance side done for you: RYA ratios, the right instructor in every place, and licence and DBS expiry tracked.`,
    `In short, it's a roster made for RYA centres and clubs that won't let a session go out short of instructors, without a Senior Instructor, or with someone whose ticket has lapsed.`,
    `We built it for RYA training centres and clubs: one place for the instructor roster and the compliance checks that usually live in a spreadsheet and someone's head.`,
    `It does two jobs for RYA centres and clubs: rosters your instructors in minutes, and checks every session against RYA ratios, instructor types and certificate expiry.`,
  ]);
  const link = at(6, [
    `The Learning Centre shows how it works in a few short videos: ${LEARN_URL}`,
    `You can see how it works here, no sign-up needed: ${LEARN_URL}`,
    `There are short guides and two-minute videos here: ${LEARN_URL}`,
    `If you'd like a look, the Learning Centre walks through it: ${LEARN_URL}`,
  ]);
  const ask = at(4, [
    `Would a 15-minute call be useful?`,
    `Happy to set up a free month for ${c.name} if you'd like to try it.`,
    `I'd be glad to hear whether it would suit ${c.name}.`,
    `Would it be worth a quick chat before next season's planning?`,
    `Any questions, just reply.`,
  ]);
  const optOut = at(5, [
    `If it's not for you, just say and I won't email again.`,
    `If now isn't the right time, a one-word reply is fine and I'll leave it there.`,
    `If you'd rather not hear from us, let me know and that's the last of it.`,
    `No worries if it's not a fit; just tell me and I'll stop here.`,
  ]);
  const closing = at(7, ["Best wishes,", "Many thanks,", "All the best,", "Kind regards,", "Thanks,", "Best,"]);

  const body = [
    greeting, "",
    pick(c.id, 11, 2) === 0 ? `${opening} ${what}` : opening,
    ...(pick(c.id, 11, 2) === 0 ? [] : ["", what]), "",
    link, "",
    `${ask} ${optOut}`, "",
    closing,
    "Conor",
  ].join("\n");

  return { subject, body };
}
