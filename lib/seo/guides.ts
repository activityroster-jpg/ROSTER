/**
 * Sailing school guides (/guides): long answers to the operational questions
 * centre managers search for. Each one is useful on its own and ends with how
 * ActivityRoster handles it. Where the answer depends on RYA rules or a centre's
 * operating procedures (ratios, safety cover, supervision), the guide says so
 * and never states a figure as the RYA's own.
 */

export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: string[] }
  | { kind: "tip"; text: string }
  | { kind: "table"; head: string[]; rows: string[][]; caption?: string };

export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** Minutes to read, shown on the page. */
  readMins: number;
  updated: string;
  /** The short answer, shown first. */
  answer: string;
  blocks: GuideBlock[];
  /** How ActivityRoster handles it (closing box). */
  product: string;
  /** Landing page slug (lib/seo/landings.ts) and Learning Centre topic for the closing box. */
  landing: string;
  learn: string;
  related: string[];
  download?: { href: string; label: string; size: string };
}

export const GUIDES: Guide[] = [
  {
    slug: "how-many-instructors-do-i-need-for-an-rya-course",
    title: "How many instructors do I need for an RYA course?",
    description: "How to work out instructor numbers for an RYA course from your ratio, roles and safety cover, with worked examples and the things that change the answer.",
    readMins: 6,
    updated: "2026-10-06",
    answer: "Divide the number of students by the student-to-instructor ratio your operating procedures set for that course, round up, then add the people the session needs on top: a Senior Instructor supervising, and a qualified driver for each safety boat. The ratio itself depends on the discipline, the boats, the students and the conditions, so it comes from the RYA guidance for that scheme and your Principal's judgement, not from a single number.",
    blocks: [
      { kind: "h2", text: "Start with the ratio for that course" },
      { kind: "p", text: "Every RYA scheme comes with guidance on how many students one instructor can teach safely, and your centre's operating procedures turn that into the ratio you actually use. It is usually tighter for children, beginners, single-handed boats and open water, and can be looser for experienced adults in crewed boats in sheltered water. Check the current RYA guidance for the scheme and your own operating procedures before you rely on any figure, including the defaults in any software." },
      { kind: "h2", text: "The calculation" },
      { kind: "steps", items: [
        "Take the students booked on the session.",
        "Divide by the ratio for that course (for example, 4 students per instructor).",
        "Round up: 9 students at 1:4 needs 3 instructors, not 2.25.",
        "Decide whether assistant instructors can count towards that number. That depends on the RYA rules for the scheme and your operating procedures, so don't assume they can.",
        "Add the roles that sit outside the ratio: the Senior Instructor supervising, and a qualified driver for each safety boat you need.",
      ] },
      { kind: "table", caption: "Worked examples, using example ratios. Use the ratios your operating procedures set.", head: ["Session", "Students", "Example ratio", "Instructors", "Plus"], rows: [
        ["Adult Start Sailing, crewed dinghies", "6", "1:3", "2", "Safety boat driver"],
        ["Youth Stage 2", "8", "1:4", "2", "Safety boat driver"],
        ["Five-day summer camp", "12", "1:4", "3", "Senior Instructor, safety boat driver"],
        ["Windsurf taster", "4", "1:4", "1", "Safety boat driver"],
      ] },
      { kind: "h2", text: "What changes the number on the day" },
      { kind: "list", items: [
        "Wind and sea state: a forecast that's fine for improvers may need tighter ratios for beginners.",
        "Ability and age: a mixed group is staffed for its least experienced members.",
        "Boats: single-handers spread out; crewed boats keep students together.",
        "Sailability and additional needs: plan extra support in advance.",
        "Distance from base: open-water sessions need more cover than a sheltered lake.",
      ] },
      { kind: "h2", text: "Plan the week, not just the session" },
      { kind: "p", text: "Instructor numbers matter most on your busiest day. Add up the sessions running at the same time and compare the total with the qualified staff who are actually free. If the busiest slot needs every instructor you have, you have no spare for illness, so either move a session or line up cover before the week starts." },
      { kind: "tip", text: "Record the ratio you used and why on the course itself. If someone later asks how a session was staffed, the answer is in one place." },
    ],
    product: "Each course type in ActivityRoster carries the ratio and safety-boat requirement you set. Enter the students booked and it works out how many instructors the session needs, then flags the session as short until it has them. Change the ratio for a course type once and every future session follows.",
    landing: "rya-staff-rostering-software",
    learn: "rostering",
    related: ["how-to-manage-safety-boat-cover", "how-to-build-a-sailing-school-staff-rota", "rya-sailing-school-compliance-checklist"],
  },
  {
    slug: "how-should-a-sailing-school-manage-instructor-availability",
    title: "How should a sailing school manage instructor availability?",
    description: "A simple system for collecting instructor availability at a sailing school: usual week plus exceptions, a fixed window, a deadline, and silence counted as busy.",
    readMins: 5,
    updated: "2026-10-06",
    answer: "Ask each instructor for their usual week once, then only the exceptions. Collect availability for a fixed window ahead (four to eight weeks suits most schools), set a deadline before you build the roster, and treat anything unanswered as busy rather than free. Keep it in one place the office can see while rostering, not in a chat group.",
    blocks: [
      { kind: "h2", text: "Why availability goes wrong" },
      { kind: "p", text: "Most schools collect availability by message: a WhatsApp poll, a few texts, a note on the whiteboard. It works for a handful of people. With a seasonal team of freelancers, students and volunteers, the answers end up spread across phones, half of them out of date by the time the roster is built." },
      { kind: "h2", text: "A system that works" },
      { kind: "steps", items: [
        "Usual week first. Each instructor says which mornings, afternoons and evenings they normally work. That alone answers most weeks.",
        "Exceptions only. After that they only change the days that differ: a wedding, exams, a regatta, another job.",
        "A fixed window. Ask for availability a set number of weeks ahead and no further. Too far ahead and people guess; too short and you can't plan.",
        "A deadline. Tell everyone when you'll build the roster and that availability after that point may not be used.",
        "Silence means busy. Never assume an unanswered slot is free. It's the most common cause of no-shows.",
        "Free, maybe, busy. A 'maybe' lets people offer a slot without promising it, which is exactly what you want for cover.",
      ] },
      { kind: "h2", text: "Use it while you roster" },
      { kind: "p", text: "Availability is only useful if it's in front of you when you assign people. A separate spreadsheet you have to cross-check is where mistakes creep in. Put the two side by side." },
      { kind: "h2", text: "Late changes and fairness" },
      { kind: "list", items: [
        "When someone changes availability after the roster is published, the person rostering needs to know straight away.",
        "Spread sessions fairly across the people who are free. Freelancers who are offered nothing in June won't be free in August.",
        "Approved leave should update availability automatically, so you can't roster someone who is off.",
      ] },
      { kind: "tip", text: "Publish the roster on the same day each week. People plan around it, and it gives the availability deadline a reason." },
    ],
    product: "In ActivityRoster instructors set their usual week once in the app and change only the exceptions. Every slot counts as busy until they mark it free or maybe, the window is set in Settings, and availability shows beside every session on the roster board. If someone marks themselves busy after being rostered, it appears on the problems list.",
    landing: "sailing-instructor-scheduling-software",
    learn: "availability",
    related: ["how-to-build-a-sailing-school-staff-rota", "how-to-manage-freelance-sailing-instructors", "sailing-school-staff-scheduling-spreadsheet-template"],
  },
  {
    slug: "how-to-track-rya-instructor-qualifications",
    title: "How to track RYA instructor qualifications",
    description: "What to record for every RYA instructor qualification, first aid certificate and vetting check, how to verify them, and how to stop expiries slipping through.",
    readMins: 6,
    updated: "2026-10-06",
    answer: "Keep one record per person listing every qualification and check they need, each with its number, issue date, expiry date and who verified the original. Set a lead time for reminders, chase renewals before they lapse, and make sure an expired mandatory check stops that person being rostered, not just turns a cell red.",
    blocks: [
      { kind: "h2", text: "What to track" },
      { kind: "list", items: [
        "Instructor grades: Dinghy, Senior, Windsurf, Powerboat, Keelboat and so on, plus assistant grades.",
        "Safety boat and powerboat qualifications for anyone who drives a safety boat.",
        "First aid: instructor qualifications generally need a valid first aid certificate alongside them.",
        "Safeguarding training, where your centre requires it.",
        "Vetting: DBS, PVG, AccessNI or Garda, depending on where you operate.",
        "Revalidation dates: RYA instructor qualifications are time-limited, so record when each one needs revalidating. Check the RYA's current rules for each grade.",
      ] },
      { kind: "h2", text: "What to record for each one" },
      { kind: "table", head: ["Field", "Why"], rows: [
        ["Qualification or check", "So you can see gaps against what each role needs"],
        ["Certificate number", "To verify it and answer questions later"],
        ["Issue and expiry dates", "To plan renewals and stop expired licences being used"],
        ["Verified by and date", "Proof that someone saw the original"],
        ["A copy, where appropriate", "Not for vetting: record status, number and date only"],
      ] },
      { kind: "h2", text: "Verify, don't just collect" },
      { kind: "p", text: "A photo of a certificate in a shared folder isn't the same as a checked qualification. Have a named person in the office confirm each one against the original or the issuing body's records, and record that they did." },
      { kind: "h2", text: "Handle vetting carefully" },
      { kind: "p", text: "Criminal record certificates are special. In most cases you should record that the check was done, its number, date and outcome, and not keep a copy of the certificate itself. Follow the guidance from the vetting body for your jurisdiction." },
      { kind: "h2", text: "Stay ahead of expiries" },
      { kind: "steps", items: [
        "Choose a lead time, such as 60 days, long enough to book a renewal course.",
        "Remind the instructor and the office when a qualification enters that window.",
        "Review a list of everything expiring each week, not just when someone remembers.",
        "When it expires, stop that person being rostered for anything that needs it until it's renewed.",
      ] },
      { kind: "tip", text: "Only keep what you need, and delete records for people who have left once your retention period ends. Qualification records are personal data." },
    ],
    product: "ActivityRoster keeps every qualification and check with its dates and who verified it. Instructors upload certificates from the app, reminders go out within your lead time, the office gets a weekly summary, and an expired mandatory check stops that person being rostered. Vetting is recorded by status, encrypted number and date, never as a stored certificate.",
    landing: "rya-qualification-tracking-software",
    learn: "licences",
    related: ["how-to-prevent-expired-qualifications-being-rostered", "rya-sailing-school-compliance-checklist", "how-to-manage-freelance-sailing-instructors"],
  },
  {
    slug: "how-to-build-a-sailing-school-staff-rota",
    title: "How to build a sailing school staff rota",
    description: "A step-by-step method for building a sailing school staff rota: sessions, staffing needs, availability, senior roles first, checks, publishing and changes.",
    readMins: 7,
    updated: "2026-10-06",
    answer: "List the week's sessions, work out what each one needs (instructors from the ratio, a supervising Senior Instructor, safety-boat drivers), collect availability, then fill the senior and safety roles first, instructors next and assistants last. Check qualifications, clashes and young workers' hours, keep someone spare on the busiest day, then publish on a fixed day and get everyone to confirm.",
    blocks: [
      { kind: "h2", text: "Step by step" },
      { kind: "steps", items: [
        "List every session for the week: course, date, morning, afternoon or evening, and students booked.",
        "Work out what each session needs: instructors from the ratio, any Senior Instructor supervision, assistants, and a safety-boat driver for each boat.",
        "Collect availability by a deadline, with silence counted as busy.",
        "Fill the hardest roles first: Senior Instructors and safety-boat drivers are usually the scarcest.",
        "Then instructors, matching each one's qualifications to the course.",
        "Then assistants, remembering any supervision rules that apply to them.",
        "Check for clashes: the same person or the same boat in two places at once.",
        "Check hours: young workers have legal limits on hours and breaks, and everyone needs rest.",
        "Keep a spare on your busiest day, or know who you'll call.",
        "Publish on the same day each week and ask everyone to confirm their sessions.",
      ] },
      { kind: "h2", text: "Choose a view that fits how you think" },
      { kind: "p", text: "Some people build by session (who's on each course?), others by person (what's each instructor doing this week?). The best rotas are checked both ways: by session to make sure nothing is short, by person to make sure nobody is double-booked or overworked." },
      { kind: "h2", text: "After you publish" },
      { kind: "list", items: [
        "Track who has confirmed and chase the rest before the week starts.",
        "When something changes, tell the people affected, not the whole team.",
        "Print a day sheet for the duty officer, with emergency contacts for the people on duty.",
        "Keep a record of changes and why they were made.",
      ] },
      { kind: "tip", text: "If the same pattern repeats every week of the summer, build it once and copy it forward, then adjust for leave and bookings." },
    ],
    product: "ActivityRoster's roster board shows the week by course or by person, with availability alongside. Every assignment is checked for qualifications, availability, ratio and safety cover, the problems list catches clashes and gaps, and publishing tells everyone in the app. The printable roster and emergency sheet are one click away.",
    landing: "sailing-school-rostering-software",
    learn: "board",
    related: ["sailing-school-staff-scheduling-spreadsheet-template", "how-many-instructors-do-i-need-for-an-rya-course", "how-should-a-sailing-school-manage-instructor-availability"],
  },
  {
    slug: "how-to-manage-freelance-sailing-instructors",
    title: "How to manage freelance sailing instructors",
    description: "Practical advice for sailing schools working with freelance instructors: terms, rates, availability, onboarding, qualifications, briefings and prompt pay.",
    readMins: 6,
    updated: "2026-10-06",
    answer: "Agree clear terms and rates up front, ask for availability earlier than you do for employed staff, onboard every freelancer properly (qualifications verified, local procedures briefed), keep communication in one channel, and pay promptly from accurate records. Freelancers choose where to work; the centres that are easy to work with get them in August.",
    blocks: [
      { kind: "h2", text: "Set the terms early" },
      { kind: "list", items: [
        "Rates: per day, per session or per hour, and what happens if a session is cancelled at short notice.",
        "What they bring: their own kit, insurance and qualifications, and what you provide.",
        "Employment status: whether someone is genuinely self-employed depends on how the work is done, not on the label. Take advice if you're unsure.",
      ] },
      { kind: "h2", text: "Availability, earlier" },
      { kind: "p", text: "Freelancers fill their calendars across several centres. Ask for their availability further ahead than you would for employed staff, and confirm sessions quickly once you've built the roster, or someone else will." },
      { kind: "h2", text: "Onboard them properly" },
      { kind: "steps", items: [
        "Verify their qualifications, first aid and vetting before their first session.",
        "Brief them on your operating procedures, emergency plan, sailing area and kit.",
        "Show them how you'll share the roster and how to tell you if they can't make it.",
        "Record what they can teach at your centre, which may be narrower than what they hold.",
      ] },
      { kind: "h2", text: "Keep them coming back" },
      { kind: "list", items: [
        "Share sessions fairly through the season, not just the peak weeks.",
        "Use one channel for the roster, not a mix of texts, emails and chat groups.",
        "Pay promptly and accurately, from hours that match the roster.",
      ] },
      { kind: "tip", text: "Ask freelancers to keep their own certificates up to date with you. A reminder before something expires costs nothing and saves a scramble." },
    ],
    product: "In ActivityRoster freelancers are part of the same roster: they set availability in the app, see only your centre's sessions, confirm with a tap and upload their certificates. Mark them as freelance, set day, session or hourly rates, and payroll uses the hours from the roster.",
    landing: "rya-instructor-management-software",
    learn: "staff",
    related: ["how-should-a-sailing-school-manage-instructor-availability", "how-to-track-rya-instructor-qualifications", "how-to-build-a-sailing-school-staff-rota"],
  },
  {
    slug: "how-to-manage-safety-boat-cover",
    title: "How to manage safety boat cover",
    description: "How sailing schools and clubs plan safety boat cover: what decides how much you need, who can drive, getting boats ready, and rostering drivers as a role.",
    readMins: 6,
    updated: "2026-10-06",
    answer: "Decide the cover each type of session needs in your operating procedures and risk assessment, roster a qualified driver for every safety boat as a named role (not an afterthought), make sure each boat is only booked once, and check the boats, fuel and kit before anyone goes afloat. Review the cover on the day against the forecast.",
    blocks: [
      { kind: "h2", text: "What decides how much cover you need" },
      { kind: "p", text: "There's no single number. The cover a session needs depends on the boats on the water, the students' age and ability, the sailing area, the weather and how far from shore you go. The RYA publishes guidance, and your operating procedures and risk assessment set the rule for your centre. Write it down per type of session so it's applied the same way every time." },
      { kind: "h2", text: "Who can drive" },
      { kind: "list", items: [
        "Safety boat drivers need the right qualification, typically the RYA Safety Boat certificate. Check what your operating procedures require.",
        "Track the expiry of the driver's first aid as well as their boat qualification.",
        "Decide whether the driver needs crew, and whether the crew needs a qualification too.",
      ] },
      { kind: "h2", text: "Roster drivers as a role" },
      { kind: "p", text: "The most common gap is the safety boat driver everyone assumed someone else had arranged. Put the driver on the roster against the session, by name, just like an instructor. If a session needs cover and nobody is rostered to provide it, that should be obvious long before the morning." },
      { kind: "h2", text: "Boats, not just people" },
      { kind: "list", items: [
        "Book each safety boat to a session so two groups don't plan to use the same one.",
        "Take boats out of use when they're in maintenance, and say when they'll be back.",
        "Check fuel, kill cords, radio, first aid kit and towing gear before launching.",
      ] },
      { kind: "h2", text: "On the day" },
      { kind: "steps", items: [
        "Review the forecast against the sessions planned.",
        "Brief instructors and drivers together: area, signals, recall, who covers whom.",
        "Adjust cover or the session if conditions need it, and record what you changed.",
      ] },
      { kind: "tip", text: "Keep a printed sheet of who is on duty and their emergency contacts with the duty officer, in case the internet or a phone fails." },
    ],
    product: "In ActivityRoster each course type can require safety-boat cover, and a session with no driver rostered shows as a problem until someone is. Safety boats are tracked as equipment, so the same boat can't go to two sessions, and units in maintenance are flagged. The emergency sheet lists today's staff and contacts for the duty officer.",
    landing: "sailing-school-compliance-software",
    learn: "problems",
    related: ["how-many-instructors-do-i-need-for-an-rya-course", "rya-sailing-school-compliance-checklist", "how-to-build-a-sailing-school-staff-rota"],
  },
  {
    slug: "how-to-prevent-expired-qualifications-being-rostered",
    title: "How to prevent expired qualifications being rostered",
    description: "Why expired licences end up on sailing school rosters and how to stop it: a mandatory list, a lead time, checks at the moment of rostering and recorded overrides.",
    readMins: 5,
    updated: "2026-10-06",
    answer: "Make the check happen when the roster is built, not on the morning of the session. Decide which qualifications and checks are mandatory for each role, track their expiry dates with a reminder lead time, and make an expired mandatory check stop that person being assigned unless someone records a reason to override it.",
    blocks: [
      { kind: "h2", text: "Why it happens" },
      { kind: "p", text: "Expired licences rarely reach the roster through carelessness. They get there because the certificate list and the roster live in different places, and nobody cross-checks them on a busy week. The certificate expired in May; the roster for June was copied from April." },
      { kind: "h2", text: "Close the gap" },
      { kind: "steps", items: [
        "List what's mandatory: for each role, which qualifications and checks must be in date.",
        "Track every expiry date, with who verified the certificate.",
        "Set a reminder lead time long enough to book a renewal.",
        "Check at the moment of rostering: an expired mandatory item should stop the assignment there and then.",
        "Allow overrides only with a recorded reason and a name.",
        "Recheck published rosters when dates pass: a licence can expire between building the roster and the session.",
        "Review a weekly list of what has expired or is about to.",
      ] },
      { kind: "h2", text: "Make renewals easy" },
      { kind: "p", text: "The quicker someone can show a renewed certificate, the sooner they're back on the roster. Let instructors send a photo of the new certificate, have the office confirm it, and clear the block as soon as it's verified." },
      { kind: "tip", text: "A colour in a spreadsheet is a warning; a block at the point of rostering is a control. Inspectors and insurers care about the second." },
    ],
    product: "ActivityRoster checks qualifications every time you assign someone. An expired mandatory check stops the assignment, the problems list rechecks published rosters as dates pass, overrides need a reason that goes in the change log, and instructors upload renewals from the app for the office to verify.",
    landing: "rya-qualification-tracking-software",
    learn: "licences",
    related: ["how-to-track-rya-instructor-qualifications", "rya-sailing-school-compliance-checklist", "how-to-build-a-sailing-school-staff-rota"],
  },
  {
    slug: "sailing-school-staff-scheduling-spreadsheet-template",
    title: "Sailing school staff scheduling spreadsheet template",
    description: "A free Excel and Google Sheets template for sailing school staff scheduling: weekly rota with staffing checks, availability grid and a staff licences tracker.",
    readMins: 4,
    updated: "2026-10-06",
    answer: "Download our free template below. It has a weekly rota that works out instructors needed from the ratio and flags sessions that are short or have no safety cover, an availability grid with free, maybe and busy, and a staff tracker that turns licences amber before they expire and red when they have. It opens in Excel, Numbers and Google Sheets.",
    download: { href: "/templates/sailing-school-staff-rota-template.xlsx", label: "Download the template (.xlsx)", size: "Excel, 3 sheets" },
    blocks: [
      { kind: "h2", text: "What's in it" },
      { kind: "list", items: [
        "Week rota: one row per session with students, ratio, instructors needed, the staff you've rostered and checks for short staffing and missing safety cover.",
        "Availability: a grid of staff against morning, afternoon and evening for the week, with a drop-down of free, maybe and busy.",
        "Staff & licences: instructor grade, first aid, safeguarding, vetting and safety boat expiry dates, with amber for anything due within 60 days and red for expired.",
      ] },
      { kind: "h2", text: "How to use it" },
      { kind: "steps", items: [
        "Fill in Staff & licences first, with your team and their expiry dates.",
        "Each week, ask everyone for availability and fill in the grid.",
        "Add the week's sessions to the rota with students booked and the ratio from your operating procedures.",
        "Fill the senior and safety-boat columns first, then instructors and assistants.",
        "Fix anything the check columns flag before you share the rota.",
      ] },
      { kind: "h2", text: "Where a spreadsheet runs out" },
      { kind: "p", text: "A good spreadsheet will carry a small school a long way. Its limits show when the team grows: it can't stop you putting someone with an expired licence on a session, it doesn't know when someone changes their availability, the same person can end up in two places, and the copy on the noticeboard drifts from the one on the laptop." },
      { kind: "tip", text: "Keep one master copy and share a view-only link, rather than emailing versions around." },
    ],
    product: "ActivityRoster does what this template does, and the parts a spreadsheet can't: it blocks expired licences at the moment you roster, collects availability from instructors' phones, catches double-bookings of people and boats, and keeps one roster that everyone sees. Your staff list from this template can be imported in a few minutes.",
    landing: "sailing-school-rostering-software",
    learn: "import",
    related: ["how-to-build-a-sailing-school-staff-rota", "how-should-a-sailing-school-manage-instructor-availability", "how-to-track-rya-instructor-qualifications"],
  },
  {
    slug: "rya-sailing-school-compliance-checklist",
    title: "RYA sailing school compliance checklist",
    description: "A practical staffing and rostering compliance checklist for RYA sailing schools: before the season, every roster, every day, and the records to keep.",
    readMins: 6,
    updated: "2026-10-06",
    answer: "The staffing side of compliance comes down to four habits: check every person's qualifications and vetting before the season, check every roster for ratios, qualifications and safety cover before it's published, brief and record on the day, and keep records of who did what and why. This checklist covers those. It doesn't replace the RYA's recognition requirements or your own operating procedures, which come first.",
    blocks: [
      { kind: "h2", text: "Before the season" },
      { kind: "list", items: [
        "Operating procedures and risk assessments reviewed and signed off by the Principal.",
        "Every instructor's and assistant's qualifications verified against originals, with expiry dates recorded.",
        "First aid certificates in date for everyone whose qualification requires one.",
        "Vetting (DBS, PVG, AccessNI or Garda) done for everyone who needs it, recorded by status, number and date.",
        "Safeguarding policy in place, welfare officer named, and staff trained to your policy.",
        "Under-18 staff identified, with their hours planned within the legal limits for their age.",
        "Safety boats serviced, drivers' qualifications checked, and boats assigned to programmes.",
        "Emergency plan and contact details current for every member of staff.",
      ] },
      { kind: "h2", text: "Every roster" },
      { kind: "list", items: [
        "Every session has enough instructors for the students booked, at the ratio your procedures set.",
        "Every instructor is qualified for the course they're on, with nothing expired.",
        "Senior Instructor supervision arranged where your procedures require it.",
        "Safety-boat cover rostered by name, with a qualified driver for each boat.",
        "Nobody, and no boat, is booked in two places at once.",
        "Young workers' hours and breaks within the limits; everyone else has proper rest.",
        "Any decision to go ahead despite a warning is recorded with a reason and a name.",
      ] },
      { kind: "h2", text: "Every day" },
      { kind: "list", items: [
        "Forecast reviewed against the day's sessions and cover adjusted if needed.",
        "Staff briefed together: sailing area, signals, recall, who covers whom.",
        "Duty officer has a printed sheet of who is on and their emergency contacts.",
        "Boats and safety kit checked before launching.",
        "Incidents and near misses recorded the same day.",
      ] },
      { kind: "h2", text: "Records to keep" },
      { kind: "list", items: [
        "Who was rostered on each session, and changes made after publishing.",
        "Qualification and check records with who verified them.",
        "Overrides and the reasons given.",
        "Incident and near-miss reports, and what changed as a result.",
        "Keep personal data only as long as your retention policy says, then delete it.",
      ] },
      { kind: "tip", text: "Print this list and pin it next to wherever the roster is built. The checks are easiest when they happen at that moment." },
    ],
    product: "ActivityRoster runs the roster checks on this list every time you assign someone: qualifications, availability, ratios, safety cover and clashes. It keeps the qualification records and the change log, including who went ahead despite a warning, and prints the emergency sheet for the duty officer.",
    landing: "sailing-school-compliance-software",
    learn: "problems",
    related: ["how-to-prevent-expired-qualifications-being-rostered", "how-to-manage-safety-boat-cover", "how-many-instructors-do-i-need-for-an-rya-course"],
  },
];

export const GUIDE_BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));
export const guideBySlug = (slug: string): Guide | undefined => GUIDE_BY_SLUG.get(slug);
