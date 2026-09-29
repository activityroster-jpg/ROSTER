/**
 * Per-competitor comparison content for /compare/[slug]. Framing is honest and
 * generic — these describe the *category* each product sits in and where an
 * RYA-specific tool differs. Marketing copy, not a feature audit; every page
 * carries a "check their current features" disclaimer.
 */

export type Cell = "yes" | "partial" | "no";

export interface CompareRow {
  feature: string;
  us: Cell;
  them: Cell;
}

export interface Competitor {
  slug: string;
  name: string;
  category: string;
  /** One-line summary shown on the index card. */
  tagline: string;
  /** Who the competitor is genuinely good for. */
  goodFor: string[];
  /** Where ActivityRoster differs for an RYA centre. */
  weWin: string[];
  /** How you'd move across. */
  migration: string;
  rows: CompareRow[];
}

const RYA_ROWS = (them: Partial<Record<string, Cell>>): CompareRow[] => {
  const base: [string, Cell][] = [
    ["RYA ratio & safety-boat cover checks", "no"],
    ["Blocks unqualified / expired instructors", "no"],
    ["Licence & ticket tracking with expiry alerts", "partial"],
    ["DBS / safeguarding vetting enforced at assignment", "no"],
    ["Youth vs adult courses separated throughout", "no"],
    ["Course-based multi-session scheduling", "partial"],
    ["Visual week calendar & planner", "yes"],
    ["Bulk assign one instructor to many courses", "partial"],
    ["Instructor availability collection", "yes"],
    ["Clock in/out & payroll-ready hours", "yes"],
    ["Printable weekly rota (PDF)", "partial"],
    ["Equipment & boat conflict tracking", "no"],
    ["Per-centre data isolation", "partial"],
    ["Built for RYA centres out of the box", "no"],
  ];
  return base.map(([feature, def]) => ({ feature, us: "yes", them: them[feature] ?? def }));
};

export const COMPETITORS: Competitor[] = [
  {
    slug: "deputy",
    name: "Deputy",
    category: "General workforce scheduling",
    tagline: "Powerful shift scheduling for any business — not built for RYA compliance.",
    goodFor: [
      "Hospitality, retail and healthcare shift patterns",
      "Auto-scheduling and demand forecasting",
      "Time & attendance with payroll integrations",
    ],
    weWin: [
      "Deputy schedules shifts; it doesn't know a Dinghy Instructor from a Senior Instructor, or that a session needs a safety boat.",
      "ActivityRoster blocks an instructor who's missing a mandatory check or whose ticket has expired — with a recorded override if you must proceed.",
      "Courses run as multi-session bookings (a 5-day camp, a weekly club), not just individual shifts.",
      "Boats and kit are conflict-checked against sessions; youth and adult courses are separated everywhere.",
    ],
    migration: "Export your staff list and paste your existing schedule into our importer (CSV or calendar). We turn each row into a draft session for you to review.",
    rows: RYA_ROWS({ "Clock in/out & payroll-ready hours": "yes", "Bulk assign one instructor to many courses": "partial" }),
  },
  {
    slug: "when-i-work",
    name: "When I Work",
    category: "General workforce scheduling",
    tagline: "Simple shift scheduling and messaging — general-purpose, not sailing-aware.",
    goodFor: [
      "Small teams wanting quick shift scheduling",
      "Shift swaps and team messaging",
      "Basic time tracking",
    ],
    weWin: [
      "No concept of RYA qualifications, ratios or safety-boat cover — you'd track all of that by hand.",
      "ActivityRoster enforces fit and ratio as you roster, and keeps a licence & vetting register with expiry alerts.",
      "Instructor availability feeds straight into course assignment, showing free/maybe/busy for the exact session times.",
    ],
    migration: "Bring staff and shifts across with the importer; set up your RYA courses from the seeded catalogue in a couple of clicks.",
    rows: RYA_ROWS({ "Clock in/out & payroll-ready hours": "yes" }),
  },
  {
    slug: "rotacloud",
    name: "RotaCloud",
    category: "General rota & leave software",
    tagline: "Rotas, leave and time tracking for UK businesses — no watersports domain model.",
    goodFor: [
      "UK SMEs wanting rotas, leave and attendance in one place",
      "Leave management and approvals",
      "Cost/hours reporting",
    ],
    weWin: [
      "Strong on generic rotas and leave, but there's no ticket tracking, safety-cover logic or course structure.",
      "ActivityRoster gives you leave and open-shift cover too — plus the compliance moat RotaCloud doesn't attempt.",
      "The rota is course- and audience-aware (youth/adult), and prints cleanly for the wall or the inbox.",
    ],
    migration: "Import your schedule and staff; your leave workflow works the same way, with availability layered on top.",
    rows: RYA_ROWS({ "Clock in/out & payroll-ready hours": "yes", "Printable weekly rota (PDF)": "yes" }),
  },
  {
    slug: "planday",
    name: "Planday",
    category: "Employee scheduling platform",
    tagline: "Enterprise-grade employee scheduling — broad, but not RYA-specific.",
    goodFor: [
      "Larger operations with complex pay rules",
      "Payroll and HR integrations",
      "Multi-department scheduling",
    ],
    weWin: [
      "Planday scales scheduling well, but qualifications, ratios and safety cover for watersports aren't part of the model.",
      "ActivityRoster is ready for an RYA centre on day one — schemes, grades, ratios and defaults are seeded.",
      "Every roster, override and change is written to an audit trail scoped to your centre.",
    ],
    migration: "Move staff and schedule via import; keep your pay/hours export for payroll.",
    rows: RYA_ROWS({ "Clock in/out & payroll-ready hours": "yes", "Per-centre data isolation": "yes" }),
  },
  {
    slug: "club-systems",
    name: "Club & membership systems",
    category: "Membership, subs & public bookings",
    tagline: "Great for members and money — staff rostering is an afterthought.",
    goodFor: [
      "Membership records, subscriptions and renewals",
      "Public course booking and payments",
      "Communications to members",
    ],
    weWin: [
      "These systems focus on members and bookings; instructor rostering, qualifications and safety cover are thin or absent.",
      "ActivityRoster is the staff-side counterpart — who's qualified, who's available, who's on which session, and whether it's safe.",
      "It complements a booking system rather than replacing it: you run the rota, they take the money.",
    ],
    migration: "Keep your booking system for members and payments; import your course schedule into ActivityRoster for rostering.",
    rows: RYA_ROWS({ "Instructor availability collection": "no", "Clock in/out & payroll-ready hours": "no", "Visual week calendar & planner": "no", "Licence & ticket tracking with expiry alerts": "partial", "DBS / safeguarding vetting enforced at assignment": "partial", "Per-centre data isolation": "partial" }),
  },
  {
    slug: "spreadsheets",
    name: "Spreadsheets",
    category: "Excel / Google Sheets",
    tagline: "Free and flexible — until an expiry is missed or two instructors clash.",
    goodFor: [
      "Getting started with almost no cost",
      "Total flexibility of layout",
      "Simple one-person, one-site setups",
    ],
    weWin: [
      "Spreadsheets don't warn you: no ratio checks, no expiry alerts, no double-booking guard, no audit trail.",
      "ActivityRoster keeps the flexibility (any pattern of sessions) while enforcing the safety rules automatically.",
      "Data is isolated per centre, EU-hosted and exportable — not scattered across tabs and inboxes.",
    ],
    migration: "This is the easiest move of all — paste your spreadsheet straight into the importer and we build your courses and sessions.",
    rows: RYA_ROWS({ "Printable weekly rota (PDF)": "yes", "Instructor availability collection": "no", "Clock in/out & payroll-ready hours": "no", "Visual week calendar & planner": "no", "Bulk assign one instructor to many courses": "partial", "Course-based multi-session scheduling": "partial", "Per-centre data isolation": "no", "Licence & ticket tracking with expiry alerts": "partial" }),
  },
];

export function competitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}
