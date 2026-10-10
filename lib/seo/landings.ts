import type { ScreenId } from "@/lib/screens";

/**
 * Pages written for the searches RYA centres actually make (SEO review, 6 Oct).
 * Each page targets one main phrase and its closest variant, with its own angle,
 * so no two pages compete or read as copies of each other. Two pillars carry the
 * positioning: "RYA sailing school software" and "RYA staff rostering software".
 * Claims stay within what the platform does today.
 */

export interface LandingSection {
  heading: string;
  body: string[];
  bullets?: string[];
}

export interface Landing {
  slug: string;
  /** Link text wherever the page is listed. */
  navLabel: string;
  /** The search phrase the page is written for, and its close variants. */
  keyword: string;
  alsoFor: string[];
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  heroScreen: ScreenId;
  showFlow: boolean;
  sections: LandingSection[];
  screens: ScreenId[];
  faqs: { q: string; a: string }[];
  /** Guide slugs (lib/seo/guides.ts). */
  guides: string[];
  /** Other landing slugs. */
  related: string[];
  /** Learning Centre section for "how it works". */
  learn: string;
}

export const LANDINGS: Landing[] = [
  {
    slug: "rya-sailing-school-software",
    navLabel: "RYA sailing school software",
    keyword: "RYA sailing school software",
    alsoFor: ["sailing school software UK", "RYA training centre software"],
    title: "RYA Sailing School Software",
    description: "Software built for RYA sailing schools: rosters checked for qualifications, ratios and safety-boat cover, instructor certificates tracked, an app for your team. From £35 a month, first month free.",
    eyebrow: "RYA sailing school software",
    h1: "Software built for the way an RYA sailing school actually runs",
    intro: "General business software doesn't know what a Dinghy Instructor licence is, why a Youth Stage 2 group needs a safety boat, or that your best freelancer's first aid runs out in August. ActivityRoster does. It runs the staff side of an RYA Training Centre: courses, rosters, qualifications, availability, hours and the instructor app, in one place.",
    heroScreen: "dashboard",
    showFlow: true,
    sections: [
      {
        heading: "One place for the whole staff side of the school",
        body: ["Most sailing schools run on a mix of a spreadsheet roster, a WhatsApp group, a folder of certificate photos and the Chief Instructor's memory. It works until someone is ill on a Saturday, a licence lapses unnoticed, or the busiest week of the summer lands on a new member of the office team."],
        bullets: [
          "Courses and sessions on one calendar, colour-coded youth and adult",
          "A roster board where you drag instructors onto sessions",
          "Every RYA licence, first aid certificate and vetting check, with expiry dates",
          "Availability collected from instructors' phones, not chased by text",
          "Leave, open shifts, hours and payroll export",
          "A printable roster and an emergency sheet for the duty officer",
        ],
      },
      {
        heading: "RYA rules built in, not bolted on",
        body: [
          "Your centre starts with RYA course types, instructor grades, roles and checks already set up. Each course type carries the student-to-instructor ratio and safety-boat requirement your operating procedures set, and you can change any of them. From then on, every assignment is checked as you make it.",
          "If someone isn't qualified for a course, is marked busy, would push a session over its ratio, or the session has no safety cover, you see it at once. Nothing is silently blocked or silently allowed: overrides need a reason and are recorded.",
        ],
      },
      {
        heading: "Made for schools of every size",
        body: ["A small club running weekend Stage 1 courses and a residential centre running six programmes a day use the same platform. Pricing is flat per centre, not per user, so volunteers and seasonal freelancers don't cost extra."],
        bullets: ["Small Club: £35 a month for up to 10 people", "Standard: £65 a month for your whole team", "First month free, no card needed"],
      },
    ],
    screens: ["board", "courses", "staff", "appHome"],
    faqs: [
      { q: "Is ActivityRoster approved by the RYA?", a: "No. ActivityRoster is independent software for RYA Training Centres. It follows the structure of RYA courses, grades and checks, but your Principal and operating procedures remain the authority on how your centre runs." },
      { q: "Does it handle bookings and payments from customers?", a: "No. It handles the staff side: rosters, qualifications, availability and hours. It can pull your courses in from the booking system you already use, so you don't type them twice." },
      { q: "How long does it take to set up?", a: "Most centres are running in an afternoon. A guided set-up brings in your courses and staff from a spreadsheet, and we can do it for you if you prefer." },
    ],
    guides: ["rya-sailing-school-compliance-checklist", "how-to-build-a-sailing-school-staff-rota", "how-many-instructors-do-i-need-for-an-rya-course"],
    related: ["rya-staff-rostering-software", "sailing-school-compliance-software", "rya-qualification-tracking-software"],
    learn: "getting-started",
  },
  {
    slug: "rya-staff-rostering-software",
    navLabel: "RYA staff rostering software",
    keyword: "RYA staff rostering software",
    alsoFor: ["RYA staff management software", "RYA roster software"],
    title: "RYA Staff Rostering Software",
    description: "Roster RYA instructors, assistants and safety-boat drivers with qualifications, availability, ratios and safety cover checked as you schedule. Publish to an instructor app. From £35 a month.",
    eyebrow: "RYA staff rostering software",
    h1: "Staff rostering that checks the RYA rules while you build the week",
    intro: "A sailing roster isn't a shift pattern. Each session needs the right grades in the right numbers, a safety boat with a qualified driver, and people who are actually free. ActivityRoster builds the week around those rules, so the roster you publish is one you can run.",
    heroScreen: "board",
    showFlow: true,
    sections: [
      {
        heading: "Build the week on one screen",
        body: ["The roster board shows each day's sessions as cards, with who is on them and the roles still open. Click a session and the people list shows everyone's availability for that slot. Drag someone across, or switch to People × days to see a row per instructor with free slots in green."],
      },
      {
        heading: "Four checks on every assignment",
        body: ["The moment you put someone on a session, ActivityRoster checks it:"],
        bullets: [
          "Qualification: do they hold an in-date licence that covers this course?",
          "Availability: have they marked this slot free, maybe or busy?",
          "Ratio: does the session now have enough instructors for the students booked?",
          "Safety cover: is someone rostered to drive the safety boat?",
        ],
      },
      {
        heading: "Problems found after the fact, too",
        body: ["Rosters change after they're built. Someone marks themselves busy, a session moves, leave is approved, a boat goes into maintenance. The problems list looks at the roster as it stands now and tells you what no longer adds up, from double-bookings to under-18s over their legal hours."],
      },
      {
        heading: "Publish, confirm, done",
        body: ["When the week is right, publish it. Everyone on it is told in the instructor app and can confirm with one tap. Unconfirmed sessions stay flagged on your dashboard, and the printable roster is ready for the noticeboard."],
      },
    ],
    screens: ["board", "boardPeople", "problems", "appHome"],
    faqs: [
      { q: "Can we still override a check?", a: "Yes. Some days you need to. ActivityRoster tells you exactly what the problem is, and an override asks for a reason that goes into the change log, so there's a record of who decided and why." },
      { q: "Does it work for multi-day courses where staff change day to day?", a: "Yes. Staff can be set for the whole course or swapped for a single day, and each day is checked on its own." },
      { q: "Do instructors need the app?", a: "It's the easiest way for them to see their week, set availability and confirm sessions, and it's free for them. Everything also works in a phone browser." },
    ],
    guides: ["how-to-build-a-sailing-school-staff-rota", "how-to-manage-safety-boat-cover", "how-should-a-sailing-school-manage-instructor-availability"],
    related: ["rya-sailing-school-software", "sailing-school-rostering-software", "sailing-instructor-scheduling-software"],
    learn: "board",
  },
  {
    slug: "sailing-school-rostering-software",
    navLabel: "Sailing school rostering software",
    keyword: "sailing school rostering software",
    alsoFor: ["sailing school staff rota", "sailing school roster"],
    title: "Sailing School Rostering Software & Staff Rota",
    description: "Replace the sailing school staff rota spreadsheet. Build the week on a roster board, catch clashes and gaps, publish to an instructor app and print the rota. Free for a month.",
    eyebrow: "Sailing school rostering software",
    h1: "From the staff rota spreadsheet to a roster that checks itself",
    intro: "The spreadsheet rota has served sailing schools well, until the summer it doesn't. ActivityRoster keeps what works about it (one view of the week, easy to change, printable) and adds what a spreadsheet can't: it knows who is qualified, who is free, and what each session needs.",
    heroScreen: "rota",
    showFlow: false,
    sections: [
      {
        heading: "Why the spreadsheet rota stops working",
        body: ["A spreadsheet doesn't know that Tom can't teach Youth Stage 2, that Saoirse marked Wednesday afternoon as busy yesterday, or that two courses have both been given the same safety boat. Someone has to remember, and in July nobody has time to."],
        bullets: ["Clashes are spotted by eye, if at all", "Availability arrives by text and lives in someone's head", "Changes after printing don't reach everyone", "Certificates are checked separately, if they're checked"],
      },
      {
        heading: "What changes with ActivityRoster",
        body: ["You still build the week the way you think about it: by day, by session. But every name you add is checked, every change is seen by the people it affects, and the rota you print is the one in everyone's app."],
        bullets: ["Drag-and-drop roster board, by course or by person", "Double-bookings and gaps flagged as you go", "Availability from instructors' phones, shown alongside the roster", "Publish the week; changes notify the people affected", "Printable rota and day sheets in the layout you choose"],
      },
      {
        heading: "Bring your current rota across",
        body: ["Import your courses and staff from the spreadsheet you use now. ActivityRoster reads it, shows you what it found, and lets you correct anything before saving. Most schools are rostering the same afternoon."],
      },
    ],
    screens: ["board", "rota", "availability"],
    faqs: [
      { q: "Can we keep a printed rota on the noticeboard?", a: "Yes. The weekly roster prints or saves as a PDF in a choice of layouts, with locations, kit and any problems shown at the top." },
      { q: "What about staff who don't use smartphones?", a: "The office can enter availability for them, and the printed rota still works. Everyone else gets the app." },
      { q: "Is there a free spreadsheet template we can use meanwhile?", a: "Yes, our sailing school staff rota template is free to download from the guides section." },
    ],
    guides: ["sailing-school-staff-scheduling-spreadsheet-template", "how-to-build-a-sailing-school-staff-rota", "how-should-a-sailing-school-manage-instructor-availability"],
    related: ["rya-staff-rostering-software", "sailing-instructor-scheduling-software", "sailing-centre-management-software"],
    learn: "rota",
  },
  {
    slug: "sailing-instructor-scheduling-software",
    navLabel: "Sailing instructor scheduling software",
    keyword: "sailing instructor scheduling software",
    alsoFor: ["sailing instructor rota software", "instructor scheduling for sailing centres"],
    title: "Sailing Instructor Scheduling & Rota Software",
    description: "Schedule sailing instructors around real availability and qualifications. Instructors set availability in an app, you see it as you roster, and every session is checked before it's published.",
    eyebrow: "Sailing instructor scheduling software",
    h1: "Schedule instructors around who is free and who is qualified",
    intro: "Most scheduling pain at a sailing centre comes from two questions asked a hundred times a week: who's free, and who can teach this? ActivityRoster answers both on the same screen, from information your instructors keep up to date themselves.",
    heroScreen: "availability",
    showFlow: false,
    sections: [
      {
        heading: "Availability that keeps itself current",
        body: ["Instructors set their usual week once in the app and change only the exceptions: a wedding, a regatta, a day at the other job. Free, maybe and busy show on your availability grid and beside every session on the roster board. You can set how many weeks ahead they can mark."],
      },
      {
        heading: "Who can teach what, without looking it up",
        body: ["Each instructor's qualifications decide which courses they can take, and the scheduling screens use that. Put someone on a course their licences don't cover and you're told before it's saved, not after a parent asks."],
      },
      {
        heading: "Fair, visible, and easy to change",
        body: ["See who has how many sessions this week, spread the work fairly, and offer gaps as open shifts that available instructors can claim. When a session changes, the instructors on it are told."],
        bullets: ["Usual week plus exceptions, set by the instructor", "Free, maybe and busy shown while you roster", "Open shifts that available staff can claim", "Leave requests approved in a tap and fed into availability"],
      },
    ],
    screens: ["availability", "appAvailability", "leave", "boardPeople"],
    faqs: [
      { q: "Can we limit how far ahead instructors set availability?", a: "Yes. You choose the window in Settings, and the app only asks for those weeks." },
      { q: "What if an instructor doesn't fill in their availability?", a: "Every slot counts as busy until they mark it free or maybe, so you're never relying on a guess. You can see at a glance who hasn't answered." },
      { q: "Does it work for freelancers who work at several centres?", a: "Yes. Freelancers set availability like anyone else and only see your centre's sessions." },
    ],
    guides: ["how-should-a-sailing-school-manage-instructor-availability", "how-to-manage-freelance-sailing-instructors", "how-to-build-a-sailing-school-staff-rota"],
    related: ["rya-staff-rostering-software", "sailing-school-rostering-software", "watersports-staff-scheduling"],
    learn: "availability",
  },
  {
    slug: "rya-instructor-management-software",
    navLabel: "RYA instructor management software",
    keyword: "RYA instructor management software",
    alsoFor: ["sailing instructor management", "managing RYA instructors"],
    title: "RYA Instructor Management Software",
    description: "Manage RYA instructors in one place: licences, first aid, vetting, courses they can teach, pay rates, onboarding and documents, with expiry reminders and an app for every instructor.",
    eyebrow: "RYA instructor management software",
    h1: "Every instructor's licences, checks, pay and paperwork in one record",
    intro: "Rostering is only as good as what you know about your team. ActivityRoster keeps a proper record for every instructor, assistant and volunteer: what they hold, what they can teach, when things expire, how they're paid and what's still missing from their onboarding.",
    heroScreen: "staffProfile",
    showFlow: false,
    sections: [
      {
        heading: "A complete record for each person",
        body: ["One page per instructor shows their RYA qualifications and checks with expiry dates, the courses they can teach, their pay rate, emergency contacts and onboarding checklist. Instructors upload a photo of each certificate from their phone; the office checks and confirms it."],
      },
      {
        heading: "Vetting handled properly",
        body: ["DBS, PVG, AccessNI and Garda checks are recorded by status, certificate number and date. The certificate itself is never uploaded or stored, and the number is encrypted, which keeps you on the right side of the rules about holding criminal record information."],
      },
      {
        heading: "Employed, freelance and volunteer",
        body: ["Mark each person employed, freelance or volunteer. Pay rates can be per hour, per session or per day, with different rates for different roles. Volunteers simply have no rate, and they don't count towards a per-user price because there isn't one."],
        bullets: ["Instructor and assistant grades, first aid and safeguarding", "Which courses each person can teach", "Pay rates by hour, session or day", "Onboarding checklist and document uploads", "Under-18s marked, with higher-privacy defaults"],
      },
    ],
    screens: ["staffProfile", "staff", "appDocuments", "availability"],
    faqs: [
      { q: "Can instructors update their own details?", a: "Yes. They upload certificates and keep availability current from the app. The office confirms certificates before they count." },
      { q: "Who in the office can see personal details?", a: "You decide. Sensitive areas such as pay, documents and emergency contacts show by name who can open them, and the superadmin chooses which office admins get which access." },
      { q: "Can we import our current staff list?", a: "Yes, from a spreadsheet, even a rough one. You review what was read before anyone is added." },
    ],
    guides: ["how-to-track-rya-instructor-qualifications", "how-to-manage-freelance-sailing-instructors", "how-to-prevent-expired-qualifications-being-rostered"],
    related: ["rya-qualification-tracking-software", "rya-staff-rostering-software", "sailing-school-compliance-software"],
    learn: "staff",
  },
  {
    slug: "sailing-centre-management-software",
    navLabel: "Sailing centre management software",
    keyword: "sailing centre management software",
    alsoFor: ["sailing centre staff scheduling", "watersports centre management software"],
    title: "Sailing Centre Management Software",
    description: "Run a busy sailing centre from one dashboard: today's sessions, staffing gaps, expiring certificates, leave, open shifts, boats, locations and payroll. Built for RYA centres.",
    eyebrow: "Sailing centre management software",
    h1: "Run the whole centre's day from one dashboard",
    intro: "A centre manager needs to know, at 08:30 on a Monday, what's running today, who's on, what's uncovered and what needs sorting this week. ActivityRoster opens on exactly that, and every number links straight to the thing that needs doing.",
    heroScreen: "dashboard",
    showFlow: false,
    sections: [
      {
        heading: "Today, at a glance",
        body: ["The dashboard opens on today: the sessions running, how many people are on, what's uncovered, who has dropped out and today's problems, with a link to the emergency sheet. Below it, the week: certificates expiring, courses to cover, leave to approve, open shifts and anything on the roster that no longer adds up."],
      },
      {
        heading: "Staff scheduling across every programme",
        body: ["Summer camps, junior club nights, adult courses, powerboat and windsurfing: they all sit on the same calendar and the same roster, so one instructor can't be booked into two programmes at once, and the busy weeks are visible early."],
      },
      {
        heading: "Boats, places and payroll too",
        body: ["Track dinghies, safety boats and kit by unit, so two courses never take the same boat. Organise operating areas, slipways and classrooms. Hours come from the roster with each person's rate, ready for payroll at the end of the month."],
        bullets: ["Equipment tracked by unit, with clash warnings", "Locations grouped the way your centre works", "Leave and open shifts in one place", "Payroll from the roster, approved line by line", "Emergency sheet for the duty officer"],
      },
    ],
    screens: ["dashboard", "equipment", "payroll", "emergency"],
    faqs: [
      { q: "Can several office staff use it?", a: "Yes. Add office admins and choose which parts each can use, such as payroll, certificates or the roster." },
      { q: "Do we have to use equipment and payroll?", a: "No. They're optional and off until you switch them on. Many centres start with rostering and certificates only." },
      { q: "Where is our data kept?", a: "In the EU, with each centre's data kept separate. You can export everything at any time." },
    ],
    guides: ["rya-sailing-school-compliance-checklist", "how-to-build-a-sailing-school-staff-rota", "how-to-manage-safety-boat-cover"],
    related: ["rya-sailing-school-software", "watersports-staff-scheduling", "sailing-school-rostering-software"],
    learn: "dashboard",
  },
  {
    slug: "sailing-school-compliance-software",
    navLabel: "Sailing school compliance software",
    keyword: "sailing school compliance software",
    alsoFor: ["RYA compliance software", "sailing centre safety compliance"],
    title: "Sailing School Compliance Software",
    description: "Stop expired licences, under-ratio sessions and missing safety cover reaching the water. Compliance checks run as you roster, overrides are recorded, and everything is in the audit log.",
    eyebrow: "Sailing school compliance software",
    h1: "Compliance that happens while you roster, not afterwards",
    intro: "Most compliance at a sailing school is checked the morning of the session, by whoever is on duty. ActivityRoster moves it to the moment the roster is built, and keeps checking as things change. By the time anyone is on the slipway, the questions have been answered.",
    heroScreen: "problems",
    showFlow: true,
    sections: [
      {
        heading: "What it checks",
        body: ["Every assignment and every rostered session is checked against your centre's rules:"],
        bullets: [
          "In-date instructor qualifications that cover the course",
          "First aid, safeguarding and vetting checks you mark as mandatory",
          "Student-to-instructor ratios for each course type",
          "Safety-boat cover with a rostered driver",
          "Double-bookings of people and boats",
        ],
      },
      {
        heading: "Overrides with a paper trail",
        body: ["Real life needs judgement. When you go ahead despite a warning, ActivityRoster records who decided and when. If you're ever asked to show how a decision was made, it's there."],
      },
      {
        heading: "An audit log you didn't have to write",
        body: ["Every roster, staff and settings change is recorded with who made it. Sign-in events are logged. Sensitive pages show who can see them. Personal data can be exported, restricted or anonymised when someone asks."],
      },
    ],
    screens: ["problems", "staffProfile", "availability", "emergency"],
    faqs: [
      { q: "Does this replace our operating procedures?", a: "No. Your operating procedures and risk assessments set the rules; ActivityRoster applies the staffing parts of them every time you roster, so they're followed consistently." },
      { q: "Can we switch a check off?", a: "Yes, in Settings. Switching off a safety check asks you to confirm and tells you what will no longer be stopped." },
      { q: "What about under-18 instructors?", a: "They're marked as under 18 from their date of birth, with their contact details kept private from colleagues. Working hours are the centre's to manage; each person's rostered hours for the week show beside their name." },
    ],
    guides: ["rya-sailing-school-compliance-checklist", "how-to-prevent-expired-qualifications-being-rostered", "how-to-manage-safety-boat-cover"],
    related: ["rya-qualification-tracking-software", "rya-staff-rostering-software", "rya-sailing-school-software"],
    learn: "problems",
  },
  {
    slug: "rya-qualification-tracking-software",
    navLabel: "RYA qualification tracking software",
    keyword: "RYA qualification tracking software",
    alsoFor: ["instructor certificate tracking", "RYA licence expiry tracking"],
    title: "RYA Qualification Tracking Software",
    description: "Track every RYA instructor licence, first aid certificate and vetting check with expiry dates. Reminders before they lapse, and expired checks stop someone being rostered.",
    eyebrow: "RYA qualification tracking software",
    h1: "Know every licence, every expiry date, before it matters",
    intro: "A certificate tracker that nobody looks at is just a list. ActivityRoster tracks RYA qualifications and checks with their expiry dates, reminds people before they lapse, and uses them every time you roster, so an expired licence can't quietly end up on the water.",
    heroScreen: "staffProfile",
    showFlow: false,
    sections: [
      {
        heading: "Every qualification and check, with dates",
        body: ["Record instructor and assistant grades, powerboat and safety boat licences, first aid, safeguarding training and vetting. Each has its issue and expiry date, and the office marks it verified once it has seen the certificate."],
      },
      {
        heading: "Reminders that reach the right people",
        body: ["Anything expiring within your lead time shows on the dashboard and the staff list. Instructors are reminded in the app and by email, and every Monday the office gets one email listing what has expired or is about to."],
      },
      {
        heading: "Connected to the roster",
        body: ["This is the part a spreadsheet can't do. An expired mandatory check stops the instructor being rostered until it's renewed, and qualifications decide which courses each person can be put on."],
        bullets: ["Instructors upload a photo of each certificate", "Office verifies before it counts", "Expiry lead time you choose", "Weekly summary email for the office", "Expired checks block rostering, with recorded overrides"],
      },
    ],
    screens: ["staffProfile", "appDocuments", "staff"],
    faqs: [
      { q: "Do you store DBS certificates?", a: "No. Vetting checks are recorded by status, certificate number (encrypted) and date. The certificate itself is never uploaded or stored." },
      { q: "Can we add our own qualifications?", a: "Yes. The RYA list is there from the start and you can add any other licence or check your centre needs." },
      { q: "What happens when someone renews?", a: "They upload the new certificate from the app, the office verifies it, and they can be rostered again straight away." },
    ],
    guides: ["how-to-track-rya-instructor-qualifications", "how-to-prevent-expired-qualifications-being-rostered", "rya-sailing-school-compliance-checklist"],
    related: ["rya-instructor-management-software", "sailing-school-compliance-software", "rya-staff-rostering-software"],
    learn: "licences",
  },
  {
    slug: "watersports-staff-scheduling",
    navLabel: "Watersports staff scheduling",
    keyword: "watersports staff scheduling",
    alsoFor: ["watersports centre rota", "activity centre staff scheduling"],
    title: "Watersports Staff Scheduling Software",
    description: "Schedule watersports staff across dinghy, windsurf, powerboat, SUP and kayak sessions on one roster, with qualifications and safety cover checked for each discipline.",
    eyebrow: "Watersports staff scheduling",
    h1: "One roster for every discipline on the water",
    intro: "A watersports centre might run dinghy sailing, windsurfing, powerboating, paddleboarding and kayaking in the same week, each with its own licences and staffing rules. ActivityRoster puts them on one roster, so staff who teach several disciplines are scheduled once, and each session is checked against its own rules.",
    heroScreen: "courses",
    showFlow: false,
    sections: [
      {
        heading: "Different rules for different sessions",
        body: ["Each course type carries its own ratio, roles and safety-boat requirement. A windsurf taster, a powerboat course and a Youth Stage 1 group are each checked against what they need, and instructors are only offered for sessions their licences cover."],
      },
      {
        heading: "Multi-skilled staff, scheduled once",
        body: ["Your best people often teach more than one discipline. Because everything is on one roster, they can't be booked into two sessions at once, and you can see their whole week, not one programme's slice of it."],
      },
      {
        heading: "Groups, camps and tasters",
        body: ["School groups, summer camps, tasters and adult courses all fit: one-off sessions, multi-day courses and repeating patterns. Staff can be swapped for a single day of a longer course."],
        bullets: ["Dinghy, keelboat, windsurf, powerboat, SUP and kayak", "Ratios and roles per course type", "Safety-boat cover where it's needed", "Boats and kit tracked by unit", "Instructor app for the whole team"],
      },
    ],
    screens: ["courses", "board", "courseSetup", "equipment"],
    faqs: [
      { q: "Is it only for RYA courses?", a: "RYA courses come set up, but you can add any session type you run, with your own ratios and roles." },
      { q: "Can we track boats and boards?", a: "Yes. Equipment is tracked by unit, so two sessions can't take the same safety boat, and kit in maintenance is flagged." },
      { q: "We run school groups. Does that work?", a: "Yes. Groups are courses with their own capacity and staffing, scheduled on the same roster." },
    ],
    guides: ["how-many-instructors-do-i-need-for-an-rya-course", "how-to-manage-safety-boat-cover", "how-to-build-a-sailing-school-staff-rota"],
    related: ["sailing-centre-management-software", "sailing-instructor-scheduling-software", "rya-staff-rostering-software"],
    learn: "courses",
  },
  {
    slug: "sailing-club-duty-roster",
    navLabel: "Sailing club duty roster",
    keyword: "sailing club duty roster",
    alsoFor: ["sailing club volunteer rota", "club safety boat duty rota"],
    title: "Sailing Club Duty Roster Software",
    description: "Run your sailing club's duty roster for training, racing and safety boat cover. Volunteers set availability in an app, duties are checked for licences, and nobody costs extra per user.",
    eyebrow: "Sailing club duty roster",
    h1: "A duty roster your club's volunteers will actually use",
    intro: "Club duty rosters live in spreadsheets, on noticeboards and in long email threads, and someone always ends up on safety boat without a licence. ActivityRoster gives clubs the same checks a sailing school gets, with pricing that doesn't charge for every volunteer.",
    heroScreen: "appHome",
    showFlow: false,
    sections: [
      {
        heading: "Training and racing duties on one roster",
        body: ["Set up club racing, junior training and open days as sessions, with the duties each needs: race officer, safety boat driver, instructors, assistants. Your role names, your duties."],
      },
      {
        heading: "Volunteers sign up from their phone",
        body: ["Members set when they're free in the app, see their duties and confirm them. If something comes up they say so in the app and the duty officer knows straight away; the gap can be offered as an open duty that anyone free can claim. Under-18 juniors who help get higher-privacy defaults and, if you choose, a parent can see their roster."],
      },
      {
        heading: "Licences checked for safety duties",
        body: ["Safety boat duty needs a licence. ActivityRoster knows who holds one and when it expires, so the duty roster can't put an unqualified driver on the water without someone recording why."],
        bullets: ["Volunteers cost nothing extra: flat club pricing", "Duties for racing, training and events", "Availability and drop-outs from the app", "Safety boat and first aid licences tracked", "Printable duty sheet for the clubhouse"],
      },
    ],
    screens: ["appHome", "appAvailability", "rota", "leave"],
    faqs: [
      { q: "How much does it cost for a club with lots of volunteers?", a: "Flat per club, not per person: £35 a month for up to 10 people or £65 a month with no limit on members (fair use applies). The first month is free." },
      { q: "What happens when a member can't do their duty?", a: "They tap \"Can't make it after all?\" in the app and the duty officer is told at once. The duty can then be offered as an open shift for anyone free to claim." },
      { q: "Do members need to install an app?", a: "The app is the easiest way, but everything works in a phone browser too, and the duty sheet still prints for the noticeboard." },
    ],
    guides: ["how-to-manage-safety-boat-cover", "how-should-a-sailing-school-manage-instructor-availability", "sailing-school-staff-scheduling-spreadsheet-template"],
    related: ["sailing-school-rostering-software", "rya-staff-rostering-software", "watersports-staff-scheduling"],
    learn: "app",
  },
];

export const LANDING_BY_SLUG = new Map(LANDINGS.map((l) => [l.slug, l]));
export const landingBySlug = (slug: string): Landing | undefined => LANDING_BY_SLUG.get(slug);
