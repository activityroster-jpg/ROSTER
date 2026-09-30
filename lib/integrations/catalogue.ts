/**
 * Catalogue of booking / management systems RYA sailing schools and clubs
 * commonly use, and how ActivityRoster can pull their courses in.
 *
 * The universal, reliable path today is a one-way **calendar (ICS) feed**: every
 * system below can publish a calendar URL (or export .ics / .csv), which we
 * fetch and turn into courses + sessions. Named two-way **API** adapters are a
 * later addition where the vendor exposes a public API and the centre provides
 * credentials — marked `apiPlanned`.
 *
 * `method` is the best available path we support now:
 *   - "ics"  → paste a calendar feed URL; we sync it (works today)
 *   - "csv"  → export a spreadsheet and use the importer (works today)
 */

export type IntegrationMethod = "ics" | "csv" | "api";

export interface Provider {
  id: string;
  name: string;
  category: string;
  blurb: string;
  /** Methods available to connect today, best first. */
  methods: IntegrationMethod[];
  /** A public API exists but our adapter isn't built yet. */
  apiPlanned?: boolean;
  /** A live API adapter is available now (connect with an API key). */
  apiAdapter?: boolean;
  /** Short help on where the centre finds their calendar feed URL. */
  icsHelp?: string;
  website?: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: "webcollect",
    name: "WebCollect",
    category: "Club membership & bookings",
    blurb: "Popular with UK RYA clubs for membership, events and course bookings.",
    methods: ["ics", "csv"],
    apiPlanned: true,
    icsHelp: "In WebCollect, open your events/calendar and copy the iCal / calendar feed link, or export your bookings to CSV.",
    website: "https://www.webcollect.org.uk",
  },
  {
    id: "membermojo",
    name: "membermojo",
    category: "Club membership & events",
    blurb: "Membership and event booking used by many clubs.",
    methods: ["csv", "ics"],
    icsHelp: "Export your events/attendees to CSV, or use the calendar feed if your plan exposes one.",
    website: "https://membermojo.co.uk",
  },
  {
    id: "bookwhen",
    name: "Bookwhen",
    category: "Classes & course booking",
    blurb: "Widely used for courses, classes and taster sessions.",
    methods: ["api", "ics", "csv"],
    apiAdapter: true,
    icsHelp: "In Bookwhen, each schedule page has an iCal feed — copy that URL and paste it here. Or connect with your Bookwhen API key (Account → API).",
    website: "https://bookwhen.com",
  },
  {
    id: "eola",
    name: "Eola",
    category: "Watersports & activity booking",
    blurb: "Booking platform built for watersports and activity centres.",
    methods: ["ics", "csv"],
    apiPlanned: true,
    icsHelp: "Ask Eola for your calendar/iCal feed URL, or export sessions to CSV.",
    website: "https://eola.co",
  },
  {
    id: "class4kids",
    name: "Class4Kids",
    category: "Kids' activity & camp booking",
    blurb: "Common for junior clubs and holiday sailing camps.",
    methods: ["csv", "ics"],
    icsHelp: "Export your registers/classes to CSV, or copy the calendar feed if available.",
    website: "https://www.class4kids.co.uk",
  },
  {
    id: "checkfront",
    name: "Checkfront",
    category: "Activity & rental booking",
    blurb: "Inventory-based booking used by tour and activity operators.",
    methods: ["ics", "csv"],
    apiPlanned: true,
    icsHelp: "In Checkfront, enable the calendar/iCal export and copy the feed URL.",
    website: "https://www.checkfront.com",
  },
  {
    id: "fareharbor",
    name: "FareHarbor",
    category: "Tours & activities",
    blurb: "Activity booking platform for tours and experiences.",
    methods: ["ics", "csv"],
    apiPlanned: true,
    icsHelp: "Use your FareHarbor calendar/iCal export URL, or export bookings to CSV.",
    website: "https://fareharbor.com",
  },
  {
    id: "rezdy",
    name: "Rezdy",
    category: "Tours & activities",
    blurb: "Reservation software for tours and activities.",
    methods: ["ics", "csv"],
    apiPlanned: true,
    icsHelp: "Copy your Rezdy calendar feed URL, or export sessions to CSV.",
    website: "https://www.rezdy.com",
  },
  {
    id: "bokun",
    name: "Bókun",
    category: "Tours & activities",
    blurb: "Tripadvisor's booking platform for experiences.",
    methods: ["ics", "csv"],
    apiPlanned: true,
    icsHelp: "Use the Bókun calendar/iCal export, or export to CSV.",
    website: "https://www.bokun.io",
  },
  {
    id: "teamup",
    name: "TeamUp Calendar",
    category: "Shared calendar",
    blurb: "Shared calendars many centres use to plan sessions.",
    methods: ["ics"],
    apiPlanned: true,
    icsHelp: "In TeamUp, open Calendar Settings → iCalendar feeds and copy the feed URL.",
    website: "https://www.teamup.com",
  },
  {
    id: "eventbrite",
    name: "Eventbrite",
    category: "Event ticketing",
    blurb: "Used for one-off courses, tasters and open days.",
    methods: ["csv", "ics"],
    apiPlanned: true,
    icsHelp: "Export your events/attendees to CSV, or use your organiser calendar feed.",
    website: "https://www.eventbrite.co.uk",
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    category: "Shared calendar",
    blurb: "A shared Google Calendar of your sessions.",
    methods: ["ics"],
    icsHelp: "In Google Calendar → Settings → your calendar → 'Secret address in iCal format'. Copy that URL.",
    website: "https://calendar.google.com",
  },
  {
    id: "outlook",
    name: "Outlook / Microsoft 365",
    category: "Shared calendar",
    blurb: "A shared Outlook calendar of your sessions.",
    methods: ["ics"],
    icsHelp: "In Outlook, publish the calendar and copy the ICS link.",
    website: "https://outlook.com",
  },
  {
    id: "ics_generic",
    name: "Any other calendar (ICS)",
    category: "Universal",
    blurb: "Any system that can publish a calendar feed or export .ics / .csv.",
    methods: ["ics", "csv"],
    icsHelp: "Find the 'calendar feed', 'iCal' or 'subscribe' URL in your system and paste it here.",
  },
];

export function providerById(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function providerName(id: string): string {
  return providerById(id)?.name ?? id;
}

/**
 * Brand colour per provider, used for the tile logo badge. These are simple
 * brand-ish accent colours for our own monogram badge — not the vendors'
 * trademarked logos. If a real logo file is later dropped in at
 * public/logos/<id>.svg the UI prefers it over the badge.
 */
const BRAND_COLORS: Record<string, string> = {
  webcollect: "#1f6feb",
  membermojo: "#16a34a",
  bookwhen: "#0ea5e9",
  eola: "#7c3aed",
  class4kids: "#ef4444",
  checkfront: "#0891b2",
  fareharbor: "#2563eb",
  rezdy: "#f59e0b",
  bokun: "#0d9488",
  teamup: "#4f46e5",
  eventbrite: "#f05537",
  google_calendar: "#4285f4",
  outlook: "#0078d4",
  ics_generic: "#334155",
};

export function providerColor(id: string): string {
  return BRAND_COLORS[id] ?? "#334155";
}

/** Up-to-two-letter monogram for the badge, derived from the provider name. */
export function providerInitials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}
