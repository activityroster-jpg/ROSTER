/**
 * The how-to video series, in the order a centre gets going. Each video lines
 * up with a Learning Centre section (learn), so the guide can link to it.
 * A video is made only when it has a script in videos/scripts.
 */
export const SERIES = [
  { n: 1, slug: "setup-wizard", title: "Sign up and the setup wizard", learn: "getting-started" },
  { n: 2, slug: "team-and-instructor-types", title: "Adding your team and their instructor types", learn: "instructor-types" },
  { n: 3, slug: "inviting-your-team", title: "Inviting your team", learn: "app" },
  { n: 4, slug: "courses-on-the-calendar", title: "Getting courses on the calendar", learn: "import" },
  { n: 5, slug: "availability", title: "Availability", learn: "availability" },
  { n: 6, slug: "roster-board-and-auto-roster", title: "The roster board and Auto-roster", learn: "board" },
  { n: 7, slug: "confirming-days", title: "Confirming days, and what staff see", learn: "rota" },
  { n: 8, slug: "printing-and-emergency-sheet", title: "Printing, the PDF and the emergency sheet", learn: "if-the-platform-is-down" },
  { n: 9, slug: "leave-and-open-shifts", title: "Leave and open shifts", learn: "leave" },
  { n: 10, slug: "pay-rates-and-payroll", title: "Pay rates and payroll", learn: "pay-rates" },
  { n: 11, slug: "settings-and-office-access", title: "Settings and office access", learn: "settings" },
  { n: 12, slug: "the-instructor-app", title: "For instructors: the app", learn: "app" },
];
export const byNumber = (n) => SERIES.find((v) => v.n === n);
