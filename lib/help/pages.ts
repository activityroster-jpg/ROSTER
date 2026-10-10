import { FAQ } from "./faq";

/*
 * Page awareness for the help assistant, kept apart from the search so the
 * widget can show starter questions without shipping the whole index.
 */

/** Which guides fit the page someone is on, to nudge the answers and suggest questions. */
const PAGE_TOPICS: { prefix: string; topics: string[] }[] = [
  { prefix: "/office/staff", topics: ["staff", "staff-import", "onboarding-tracker", "roles", "licences"] },
  { prefix: "/office/courses", topics: ["courses", "rostering", "import", "integrations", "equipment"] },
  { prefix: "/office/course-setup", topics: ["courses", "equipment", "settings"] },
  { prefix: "/office/import", topics: ["import"] },
  { prefix: "/office/integrations", topics: ["integrations"] },
  { prefix: "/office/rota", topics: ["rota", "board", "problems", "rostering", "if-the-platform-is-down"] },
  { prefix: "/office/availability", topics: ["availability"] },
  { prefix: "/office/timeclock", topics: ["time"] },
  { prefix: "/office/leave", topics: ["leave"] },
  { prefix: "/office/equipment", topics: ["equipment"] },
  { prefix: "/office/locations", topics: ["locations"] },
  { prefix: "/office/finance", topics: ["time", "settings"] },
  { prefix: "/office/settings", topics: ["settings", "pay-rates", "admin-security", "retention", "data"] },
  { prefix: "/office/billing", topics: ["billing", "plans"] },
  { prefix: "/office/onboarding", topics: ["getting-started", "staff", "onboarding-tracker", "courses"] },
  { prefix: "/office", topics: ["dashboard", "getting-started", "problems"] },
  { prefix: "/pricing", topics: ["plans", "billing"] },
  { prefix: "/", topics: ["getting-started", "plans", "billing"] },
];

export function topicsForPage(path: string | null | undefined): string[] {
  const p = path ?? "";
  return PAGE_TOPICS.find((x) => (x.prefix === "/" ? true : p === x.prefix || p.startsWith(`${x.prefix}/`)))?.topics ?? [];
}

/** Starter questions for the page, taken from the FAQ for its topics. */
export function suggestionsForPage(path: string | null | undefined, n = 3): string[] {
  const topics = topicsForPage(path);
  const picks = FAQ.filter((f) => topics.includes(f.topic) && !["human", "password"].includes(f.id));
  return (picks.length ? picks : FAQ.filter((f) => ["add-staff", "create-course", "assign"].includes(f.id))).slice(0, n).map((f) => f.ask[0]!);
}

