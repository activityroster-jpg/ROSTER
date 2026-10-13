/**
 * The how-to videos on the website: the twelve-part series and the homepage
 * explainer, made by videos/make.mjs. The production deploy copies the latest
 * finished set into private storage under public/videos/ (see the deploy
 * workflow); /api/videos/<file> streams them. Each video leads its own step of
 * the Learning Centre (GUIDE_STAGES follows the series, 1 to 12).
 */
export interface SiteVideo {
  /** File name stem, as made by videos/make.mjs: NN-slug. */
  file: string;
  n: number;
  title: string;
  /** The Learning Centre section this video leads (one each, in series order). */
  sections: string[];
  description: string;
  /** Rough running time, for the label and search engines (ISO 8601). */
  duration: string;
}

export const TOTAL_VIDEOS = 12;

export const EXPLAINER: SiteVideo = {
  file: "00-explainer", n: 0, title: "ActivityRoster in two minutes", sections: [], duration: "PT2M30S",
  description: "Staff rostering for RYA sailing and watersports centres: courses, instructors, qualifications and ratios in one place, a roster that fills itself with people who are free and qualified, and an app for your team.",
};

export const VIDEOS: SiteVideo[] = [
  { file: "01-setup-wizard", n: 1, title: "Sign up and the setup wizard", sections: ["getting-started"], duration: "PT4M", description: "Signing up, your PIN, and each step of the setup wizard: how you run, every course you run, your team and their instructor types, and the invite message." },
  { file: "02-team-and-instructor-types", n: 2, title: "Adding your team and their instructor types", sections: ["instructor-types"], duration: "PT3M", description: "Quick add, importing a spreadsheet, ticking each person's instructor types, licences and expiry dates, and who can teach each course." },
  { file: "03-inviting-your-team", n: 3, title: "Inviting your team", sections: ["staff"], duration: "PT2M30S", description: "Who's on the app, re-sending invites, your centre code, reminders, and running someone from the office instead." },
  { file: "04-courses-on-the-calendar", n: 4, title: "Getting courses on the calendar", sections: ["import"], duration: "PT3M", description: "Connecting your booking system, importing the season from a spreadsheet, and adding a course by hand." },
  { file: "05-availability", n: 5, title: "Availability", sections: ["availability"], duration: "PT2M30S", description: "The week grid, free, maybe and busy, usual weeks, setting availability from the office, and putting someone on a session." },
  { file: "06-roster-board-and-auto-roster", n: 6, title: "The roster board and Auto-roster", sections: ["board"], duration: "PT3M", description: "What the colours mean, putting someone on by hand, filling the week with Auto-roster, and the week person by person." },
  { file: "07-confirming-days", n: 7, title: "Confirming days, and what staff see", sections: ["rota"], duration: "PT2M30S", description: "Pending and confirmed, confirming a day, the missing-expiry warning, changes and undo, and asking staff to accept shifts." },
  { file: "08-printing-and-emergency-sheet", n: 8, title: "Printing, the PDF and the emergency sheet", sections: ["printing"], duration: "PT2M30S", description: "The print view, the roster PDF and its layout, the emergency sheet, and getting the roster round to your team." },
  { file: "09-leave-and-open-shifts", n: 9, title: "Leave and open shifts", sections: ["leave"], duration: "PT2M", description: "Approving leave, what approved leave does to the roster, and finding cover with an open shift." },
  { file: "10-pay-rates-and-payroll", n: 10, title: "Pay rates and payroll", sections: ["pay-rates"], duration: "PT3M", description: "Standard rates by place, course rates, each person's own rate, and checking, approving and exporting payroll." },
  { file: "11-settings-and-office-access", n: 11, title: "Settings and office access", sections: ["settings"], duration: "PT3M", description: "The settings tabs, the roster checks, office admins and what each can reach, and the change log." },
  { file: "12-the-instructor-app", n: 12, title: "For instructors: the app", sections: ["app"], duration: "PT3M", description: "Shifts for the next four weeks, availability and your usual week, leave, hours, licences and settings." },
];

export function videosForSection(sectionId: string): SiteVideo[] {
  return VIDEOS.filter((v) => v.sections.includes(sectionId));
}

/** The file names /api/videos will serve, and nothing else. */
export const VIDEO_FILES: ReadonlySet<string> = new Set(
  [EXPLAINER, ...VIDEOS].flatMap((v) => [`${v.file}.mp4`, `${v.file}.png`, `${v.file}.vtt`]),
);

export const videoUrl = (v: SiteVideo, ext: "mp4" | "png" | "vtt") => `/api/videos/${v.file}.${ext}`;
