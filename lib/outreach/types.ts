/** Shapes stored as JSON on campaigns and leads. */

export interface AudienceFilter {
  regions: string[];            // empty = all
  statuses: string[];           // prospect statuses to include; empty = all
  requireWebsite: boolean;      // skip prospects with no website (nothing to research)
  excludeContactedDays: number; // skip prospects emailed by any campaign within N days (0 = don't skip)
  limit: number;                // cap the number of leads created at launch
}

export interface SequenceStep {
  /** Days after the previous step (0 for the first). */
  gapDays: number;
  /** Plain-English purpose shown to the writer, e.g. "First contact". */
  purpose: string;
  /** Templates with {{centre}} {{first_name}} {{contact_name}} {{region}} {{sender}} {{hook}}; used verbatim when AI is off. */
  subject: string;
  body: string;
}

export interface ResearchContact {
  name: string;
  role: string | null;
  email: string | null;
}

export interface ResearchResult {
  fetchedAt: string;
  pages: string[];
  summary: string | null;
  /** 1–3 specific, verifiable details worth mentioning (courses they run, a boat, an event, a location). */
  hooks: string[];
  contacts: ResearchContact[];
  generalEmails: string[];
  phone: string | null;
  /** Best address to write to and why. */
  chosenEmail: string | null;
  chosenReason: string | null;
  usedAi: boolean;
}

export const DEFAULT_TARGET_ROLES = "Principal, Chief Instructor, Centre Manager, Commodore, Sailing Secretary, Owner";

export const DEFAULT_PITCH =
  "ActivityRoster is staff rostering built for RYA training centres and clubs. It rosters instructors across courses while checking RYA ratios, safety-boat cover and each instructor's certs; tracks DBS, first aid and safeguarding expiry; and gives instructors an app for availability, confirming shifts, clocking in and leave. Flat price per centre (£35 Small Club, £65 Standard), first month free, no card.";

export const DEFAULT_STEPS: SequenceStep[] = [
  {
    gapDays: 0,
    purpose: "First contact: one specific observation about their centre, what we do in one sentence, a soft ask.",
    subject: "Rostering at {{centre}}",
    body: "Hi {{first_name}},\n\n{{hook}}\n\nI run ActivityRoster, a rostering tool built for RYA centres: it puts instructors on courses while checking ratios, safety-boat cover and certs, and gives your team an app for availability and confirming shifts.\n\nWould it be worth a 15-minute look? Happy to send a link instead if that's easier.\n\n{{sender}}",
  },
  {
    gapDays: 4,
    purpose: "Short follow-up: add one concrete benefit (e.g. cert expiry tracking or the free month), keep it to four lines.",
    subject: "Re: Rostering at {{centre}}",
    body: "Hi {{first_name}},\n\nQuick follow-up in case the last note sank. Centres mostly start with us because the roster, cert expiry dates and payroll hours stop living in three different spreadsheets.\n\nThe first month is free with no card, so you can run a real week before deciding. Shall I send the link?\n\n{{sender}}",
  },
  {
    gapDays: 7,
    purpose: "Last touch: polite close, leave the door open, no pressure.",
    subject: "Re: Rostering at {{centre}}",
    body: "Hi {{first_name}},\n\nI'll leave it there so I'm not cluttering your inbox. If rostering or cert tracking ever becomes a headache at {{centre}}, activityroster.com is where to find us, and I'm always happy to talk.\n\nAll the best for the season,\n{{sender}}",
  },
];
