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

/** What the centre runs, in a phrase, from its RYA services. */
function whatTheyRun(services: string[], activityType: string | null | undefined): string | null {
  const s = services.map((x) => x.toLowerCase());
  if (activityType === "padi_centre") return "dive courses";
  const bits: string[] = [];
  if (s.some((x) => x.includes("training"))) bits.push("RYA courses");
  if (s.some((x) => x.includes("sailability"))) bits.push("Sailability sessions");
  if (s.some((x) => x.includes("powerboat"))) bits.push("powerboat training");
  if (s.some((x) => x.includes("windsurf"))) bits.push("windsurfing");
  if (s.some((x) => x.includes("club") && !x.includes("on-board"))) bits.push("club training");
  return bits.length ? bits.slice(0, 2).join(" and ") : null;
}

export function followUpEmail(c: FollowUpInput): { subject: string; body: string } {
  const who = firstName(c.contactName);
  const place = (c.city ?? "").trim() || (c.region ?? "").trim();
  const runs = whatTheyRun(c.services ?? [], c.activityType);
  const sent = when(c.bookletSentOn);
  const Sent = sent.charAt(0).toUpperCase() + sent.slice(1);
  const at = (salt: number, list: readonly string[]) => list[pick(c.id, salt, list.length)]!;

  const subject = at(0, [
    `The rostering guide we sent ${c.name}`,
    `Following up on the booklet for ${c.name}`,
    `${c.name}: the guides behind the booklet`,
    `A quick follow-up for ${c.name}`,
    `Did the booklet reach ${c.name}?`,
    `${c.name} and the ActivityRoster booklet`,
    `More on rostering for ${c.name}`,
    `A short note for the ${c.name} team`,
  ]);
  const greeting = who
    ? at(10, [`Hi ${who},`, `Hello ${who},`, `Dear ${who},`, `Hi ${who},`])
    : at(10, [`Hello ${c.name} team,`, `Hi all at ${c.name},`, `Hello,`, `Hi there,`]);
  const opening = at(1, [
    `I posted ${c.name} a copy of our booklet on staff rostering for RYA centres ${sent}.`,
    `${Sent} we sent ${c.name} our booklet on running instructor rotas.`,
    `I'm Conor from ActivityRoster; our booklet on rostering should have reached ${c.name}${place ? ` in ${place}` : ""} ${sent}.`,
    `${c.name} should have had our rostering booklet through the post ${sent}${place ? `, addressed to the team in ${place}` : ""}.`,
    `I hope the booklet we posted to ${c.name} ${sent} made it to the right desk.`,
    `Just following up on the short guide to instructor rostering that I sent to ${c.name} ${sent}.`,
    `A little booklet about rostering instructors should have landed at ${c.name}${place ? ` in ${place}` : ""} ${sent}; it came from me.`,
  ]);
  const middle = at(2, [
    `If it was useful, the Learning Centre has the full version: short guides and two-minute videos on setting up courses, instructor types and ratios, and building a week's roster that checks itself.`,
    `The booklet only scratches the surface. The Learning Centre walks through the whole thing step by step, from adding your team and their instructor types to confirming a day and printing the roster.`,
    `Everything in the booklet is covered in more depth in the Learning Centre, with a short video for each step, so you can see how it would work for your own season before signing up for anything.`,
    `For anyone curious how it would look in practice, the Learning Centre has a guide and a video for each part: courses, availability, Auto-roster, leave, pay and the instructor app.`,
    `Rather than another sales pitch, I thought the most useful thing was to point you at our Learning Centre: it shows exactly how the roster, availability and qualifications fit together, in plain English.`,
    `The online Learning Centre picks up where the booklet stops: twelve short videos and a written guide for each part of running the staff side of a centre.`,
  ]);
  const fit = runs
    ? at(3, [
        `It's built around centres that run ${runs}${place ? ` like yours in ${place}` : ""}, with the RYA course types and ratios already in place.`,
        `For ${runs}, the most useful pages are probably the ones on instructor types and who can teach each course.`,
        `Since you run ${runs}, the guide on ratios and Senior Instructor cover may be the one to start with.`,
        `With ${runs} on the go, the page on availability and Auto-roster is where most centres like yours see the time saved.`,
        `Centres running ${runs} usually start with the getting-started guide, then the one on putting a whole season on the calendar.`,
      ])
    : at(3, [
        `It comes set up with the RYA course types, instructor types and ratios, so most centres are running in an afternoon.`,
        `The guide on instructor types and who can teach each course is a good place to start.`,
        `The getting-started guide shows the route from sign-up to a first confirmed roster in about ten minutes.`,
        `The page on the instructor app is worth a look too: it's what your team would use for availability and shifts.`,
        `Most people start with the two-minute overview video at the top, then dip into whichever guide matches their biggest headache.`,
      ]);
  // The link: on its own line for some, folded into a sentence for others.
  const link = at(6, [
    `${LEARN_URL}`,
    `You'll find it here: ${LEARN_URL}`,
    `It's all free to read at ${LEARN_URL}, no sign-up needed.`,
    `Here's the link: ${LEARN_URL}`,
  ]);
  const ask = at(4, [
    `Would it be worth a 15-minute call to see whether it fits how ${c.name} runs?`,
    `Happy to answer any questions by email, or to set up a free month for ${c.name} if you'd like to try it.`,
    `If you have a minute to have a look, I'd be glad to hear what you think.`,
    `Would a short walk-through be helpful before your next season's planning?`,
    `If anything in there looks like it would help, reply and I'll happily show you around.`,
    `I'd value even a one-line reply on whether this is something ${c.name} would consider.`,
  ]);
  const optOut = at(5, [
    `If it's not for you, just say and I won't email again.`,
    `And if now isn't the right time, a one-word reply is fine and I'll leave it there.`,
    `If you'd rather not hear from us, reply and let me know and that's the last of it.`,
    `No worries at all if it's not a fit; just tell me and I'll stop here.`,
  ]);
  const closing = at(7, ["Best wishes,", "Many thanks,", "All the best,", "Kind regards,", "Thanks,", "Best,"]);
  // A postscript for about a third of centres, so the shape of the email varies too.
  const ps = pick(c.id, 8, 3) === 0
    ? at(9, [
        `P.S. The first month is free and there's no card to enter, if you'd rather just try it.`,
        `P.S. Pricing is flat per centre, from £35 a month, with nothing per instructor.`,
        `P.S. Your team gets a free app for iPhone and Android for their availability and shifts.`,
      ])
    : null;

  const middleBlock = pick(c.id, 11, 2) === 0 ? [`${middle} ${fit}`] : [middle, "", fit];
  const body = [
    greeting, "",
    opening, "",
    ...middleBlock, "",
    link, "",
    `${ask} ${optOut}`, "",
    closing,
    "Conor",
    ...(ps ? ["", ps] : []),
  ].join("\n");

  return { subject, body };
}
