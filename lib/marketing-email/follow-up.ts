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

  const subjects = [
    `The rostering guide we sent ${c.name}`,
    `Following up on the booklet for ${c.name}`,
    `${c.name}: the guides behind the booklet`,
    `A quick follow-up for ${c.name}`,
  ];
  const greeting = who ? `Hi ${who},` : `Hello ${c.name} team,`;
  const openings = [
    `I posted ${c.name} a copy of our booklet on staff rostering for RYA centres ${sent}.`,
    `${sent.charAt(0).toUpperCase() + sent.slice(1)} we sent ${c.name} our booklet on running instructor rotas.`,
    `I'm Conor from ActivityRoster; our booklet on rostering should have reached ${c.name}${place ? ` in ${place}` : ""} ${sent}.`,
    `${c.name} should have had our rostering booklet through the post ${sent}${place ? `, addressed to the team in ${place}` : ""}.`,
  ];
  const middles = [
    `If it was useful, the Learning Centre has the full version: short guides and two-minute videos on setting up courses, instructor types and ratios, and building a week's roster that checks itself.`,
    `The booklet only scratches the surface. The Learning Centre walks through the whole thing step by step, from adding your team and their instructor types to confirming a day and printing the roster.`,
    `Everything in the booklet is covered in more depth in the Learning Centre, with a short video for each step, so you can see how it would work for your own season before signing up for anything.`,
    `For anyone curious how it would look in practice, the Learning Centre has a guide and a video for each part: courses, availability, Auto-roster, leave, pay and the instructor app.`,
  ];
  const fits = runs
    ? [
        `It's built around centres that run ${runs}${place ? ` like yours in ${place}` : ""}, with the RYA course types and ratios already in place.`,
        `For ${runs}, the most useful pages are probably the ones on instructor types and who can teach each course.`,
        `Since you run ${runs}, the guide on ratios and Senior Instructor cover may be the one to start with.`,
      ]
    : [
        `It comes set up with the RYA course types, instructor types and ratios, so most centres are running in an afternoon.`,
        `The guide on instructor types and who can teach each course is a good place to start.`,
        `The getting-started guide shows the route from sign-up to a first confirmed roster in about ten minutes.`,
      ];
  const asks = [
    `Would it be worth a 15-minute call to see whether it fits how ${c.name} runs?`,
    `Happy to answer any questions by email, or to set up a free month for ${c.name} if you'd like to try it.`,
    `If you have a minute to have a look, I'd be glad to hear what you think.`,
    `Would a short walk-through be helpful before your next season's planning?`,
  ];
  const optOut = [
    `If it's not for you, just say and I won't email again.`,
    `And if now isn't the right time, a one-word reply is fine and I'll leave it there.`,
    `If you'd rather not hear from us, reply and let me know and that's the last of it.`,
  ];

  const body = [
    greeting,
    "",
    openings[pick(c.id, 1, openings.length)]!,
    "",
    `${middles[pick(c.id, 2, middles.length)]!} ${fits[pick(c.id, 3, fits.length)]!}`,
    "",
    LEARN_URL,
    "",
    `${asks[pick(c.id, 4, asks.length)]!} ${optOut[pick(c.id, 5, optOut.length)]!}`,
    "",
    "Best wishes,",
    "Conor Bourke",
    "ActivityRoster",
    "conor@activityroster.com",
  ].join("\n");

  return { subject: subjects[pick(c.id, 0, subjects.length)]!, body };
}
