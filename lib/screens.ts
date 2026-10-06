/**
 * Real screenshots of the platform (public/screens), taken from a made-up busy
 * centre, "Lough Shore Sailing Centre", in the week of 13 July 2026. Every
 * person, phone number and course in them is invented. One catalogue feeds
 * the demo tour (/demo) and the Learning Centre (/learn), so a retake only
 * has to replace the files.
 */

export interface Screen {
  src: string;
  width: number;
  height: number;
  /** "desktop" shots are the office at 1360px wide; "phone" shots are the instructor app. */
  device: "desktop" | "phone";
  /** Full-resolution copy (2720px, straight from the 2x capture) for places shown large, like the homepage hero. */
  src2x?: string;
  title: string;
  /** One plain sentence for the tour and as the image's alt text. */
  caption: string;
  /** Learning Centre section that explains this screen. */
  topic: string;
}

const desktop = (name: string, title: string, caption: string, topic: string): Screen => ({ src: `/screens/${name}.webp`, width: 1800, height: 1138, device: "desktop", title, caption, topic });
const phone = (name: string, title: string, caption: string, topic: string): Screen => ({ src: `/screens/${name}.webp`, width: 780, height: 1688, device: "phone", title, caption, topic });

export const SCREENS = {
  onboarding: desktop("onboarding", "Setup wizard", "A new centre picks what it wants to manage and how its sessions run, then the wizard sets up courses, team and roster style.", "getting-started"),
  dashboard: desktop("dashboard", "Dashboard", "Monday morning at a busy centre: today's sessions, who is on, and everything that needs attention this week.", "dashboard"),
  problems: desktop("problems", "Problems on the roster", "Clashes, missing safety cover and short-staffed sessions, worked out from the roster as it stands now.", "problems"),
  board: desktop("board", "Roster board", "The week as courses by day, with everyone's availability alongside, so you can drag people onto sessions.", "board"),
  boardPeople: desktop("board-people", "People × days", "The same week turned round: a row per instructor, free slots in green, so gaps and double-bookings stand out.", "board"),
  rota: desktop("rota", "Printable roster", "The published week ready to print or send as a PDF, with locations, kit and this week's problems on top.", "rota"),
  courses: { ...desktop("courses", "Courses", "Every course this week on one calendar, colour-coded youth and adult, with a quick way to add more.", "courses"), src2x: "/screens/courses@2x.webp" },
  courseSetup: desktop("course-setup", "Course setup", "Your course catalogue: RYA courses and your own, with audience, capacity and ratio for each.", "courses"),
  courseDetail: desktop("course-detail", "A course", "One course: staffing worked out from the RYA ratio, plus where it runs and the boats it takes.", "rostering"),
  courseDays: desktop("course-detail-staff", "Who's on each day", "A five-day camp, day by day: who is on each session, and a different person for a single day if needed.", "rostering"),
  importCourses: desktop("import", "Import courses", "Bring an existing timetable in from a spreadsheet or calendar and check it before anything is saved.", "import"),
  integrations: desktop("integrations", "Booking systems", "Connect the booking system you already use and pull its courses in when you choose.", "integrations"),
  staff: desktop("staff", "Instructors", "The whole team, who is fit to roster, who is blocked and whose certificates run out soon.", "staff"),
  staffImport: desktop("staff-import", "Import instructors", "Paste or upload a staff list, even a rough one, and review it before anyone is added.", "staff-import"),
  staffProfile: desktop("staff-profile", "An instructor", "One instructor's certs and checks with expiry dates, their pay rate and onboarding checklist.", "licences"),
  youngWorker: desktop("young-worker", "A 16-year-old instructor", "Under-18s are marked, carry a parental permission check and are rostered against young workers' hours.", "young-workers"),
  availability: desktop("availability", "Availability", "Who is free, maybe or busy for every slot of the week, straight from the instructor app.", "availability"),
  leave: desktop("leave", "Leave & cover", "Leave requests to approve or decline, and open shifts offered to staff who are free.", "leave"),
  payroll: desktop("payroll", "Payroll", "Hours come from the roster with each person's rate; check the lines, approve them, export.", "time"),
  equipment: desktop("equipment", "Equipment", "Dinghies, safety boats and kit, tracked by unit, so two courses never take the same boat.", "equipment"),
  locations: desktop("locations", "Locations", "Operating areas, slipways, classrooms and meeting points, grouped the way your centre works.", "locations"),
  settings: desktop("settings", "Settings", "The company code for the instructor app, the checks applied when rostering and every default, in tabs.", "settings"),
  billing: desktop("billing", "Billing", "Your plan, the optional done-for-you setup and VAT invoices in one place.", "billing"),
  emergency: desktop("emergency", "Emergency sheet", "Today's sessions with who is on and their emergency contacts, ready to print if the internet goes.", "if-the-platform-is-down"),
  security: desktop("security", "Security", "Recovery email, the second step at sign-in and every device that is signed in.", "admin-security"),
  help: desktop("help", "The Help button", "Ask a question in your own words; the answer comes from the guides, with a link to the full page.", "help-assistant"),
  appHome: phone("app-home", "My schedule", "An instructor's week in the app, with each session to confirm and who they are working with.", "app"),
  appAvailability: phone("app-availability", "My availability", "Instructors set their usual week once and change only the exceptions.", "availability"),
  appHours: phone("app-hours", "My hours", "Hours and estimated pay, straight from the roster.", "time"),
  appDocuments: phone("app-documents", "My certs", "Instructors upload a photo of each certificate; the office checks and confirms it.", "licences"),
  appLeave: phone("app-leave", "Leave & open shifts", "Request leave and claim open shifts from the phone.", "leave"),
  appNotifications: phone("app-notifications", "Notifications", "Roster published, a course to confirm, a cert reminder: in the app, and by email if they choose.", "notifications"),
} satisfies Record<string, Screen>;

export type ScreenId = keyof typeof SCREENS;

/** The screenshots shown at the top of each Learning Centre guide, in order. */
export const GUIDE_SCREENS: Partial<Record<string, ScreenId[]>> = {
  "getting-started": ["onboarding"],
  settings: ["settings"],
  locations: ["locations"],
  equipment: ["equipment"],
  courses: ["courses", "courseSetup"],
  import: ["importCourses"],
  integrations: ["integrations"],
  staff: ["staff"],
  "staff-import": ["staffImport"],
  licences: ["staffProfile", "appDocuments"],
  app: ["appHome", "appAvailability"],
  availability: ["availability", "appAvailability"],
  dashboard: ["dashboard"],
  board: ["board", "boardPeople"],
  rostering: ["courseDetail", "courseDays"],
  problems: ["problems"],
  rota: ["rota"],
  "young-workers": ["youngWorker"],
  leave: ["leave", "appLeave"],
  time: ["payroll", "appHours"],
  notifications: ["appNotifications"],
  billing: ["billing"],
  "admin-security": ["security"],
  "help-assistant": ["help"],
  "if-the-platform-is-down": ["emergency"],
};

/** The demo tour: the office first, then the instructor app. */
export const TOUR: { group: string; ids: ScreenId[] }[] = [
  { group: "The office", ids: ["dashboard", "board", "boardPeople", "problems", "courses", "courseDetail", "courseDays", "staff", "staffProfile", "availability", "leave", "payroll", "rota", "emergency", "equipment", "settings"] },
  { group: "The instructor app", ids: ["appHome", "appAvailability", "appHours", "appDocuments", "appLeave", "appNotifications"] },
];
