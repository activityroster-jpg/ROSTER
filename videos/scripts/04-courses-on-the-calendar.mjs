/**
 * Video 4: Getting courses on the calendar. Lakeside Sailing Centre
 * (videos/seed.test.ts): booking-system feeds, importing a spreadsheet (a
 * small made-up timetable three weeks ahead), and adding a course by hand.
 */
const ahead = (days) => { const d = new Date(); const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7) + 21 + days); return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${x.getUTCFullYear()}`; };
const CSV = [
  "Course,Date,Start,End,Audience,Location",
  `Youth Stage 1,${ahead(0)},09:30,12:30,Youth,North bay`,
  `Youth Stage 2,${ahead(0)},13:30,16:30,Youth,North bay`,
  `Start Windsurfing,${ahead(1)},10:00,13:00,Adult,South bay`,
].join("\n");

export default {
  who: "sam@demo.example",
  warm: ["/office/integrations", "/office/import", "/office/courses"],
  start: "/office/courses",
  description: `Three ways to get your courses into ActivityRoster: connect your booking system (WebCollect, Bookwhen, Eola, Class4Kids and more) and press Check for updates, import the season from a spreadsheet, or add a course by hand. Add the whole season, not just the next fortnight.`,
  tags: ["course calendar", "booking system integration", "import courses spreadsheet", "sailing course schedule", "WebCollect Bookwhen"],
  steps: [
    { chapter: "The Courses page", say: "This is the Courses page. Every course you run goes on this calendar, and the roster is built from it.",
      do: async (h) => { await h.highlight(h.page.getByRole("heading", { name: "Calendar" }).locator("xpath=ancestor::div[contains(@class,'rounded')][1]")); } },
    { say: "Add the whole season now, not just the next fortnight. There are three ways in. The quickest is your booking system.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByRole("link", { name: /Integrations & import/ })); } },

    { chapter: "Your booking system", say: "Integrations and import. Pick the system you already take bookings in. Google Calendar, Outlook, Bookwhen, WebCollect, and more.",
      do: async (h) => { await h.click(h.page.getByRole("link", { name: /Integrations & import/ })); await h.page.waitForURL(/integrations/); await h.wait(800); await h.scrollTo(h.page.getByRole("heading", { name: "Connect a booking system" })); await h.highlight(h.page.getByRole("heading", { name: "Connect a booking system" }).locator("xpath=..")); } },
    { say: "Paste in its calendar feed link. Each one has a short guide to where to find it. It only ever reads your sessions, and never changes anything in your booking system.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByText("Where to find your feed link")); await h.wait(500); await h.point(h.page.getByRole("button", { name: /Connect calendar feed/ }).or(h.page.getByRole("link", { name: /Connect calendar feed/ }))); } },
    { say: "Then, whenever new bookings come in, press Check for updates. New courses are added, cancelled ones are flagged, and you approve each change.",
      do: async (h) => { await h.scrollTop(); await h.highlight(h.page.getByText("Check for updates").first().locator("xpath=..")); } },

    { chapter: "From a spreadsheet", say: "No feed? Import a spreadsheet instead. Press Import a timetable.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("link", { name: /Import a timetable/ }).or(h.page.getByRole("button", { name: /Import a timetable/ }))); await h.page.waitForURL(/import/); await h.wait(800); } },
    { say: "Choose your file, a CSV from Excel or Google Sheets, or a calendar file. Or paste the rows in. Here are three courses.",
      do: async (h) => { await h.point(h.page.getByText(/Choose file/)); await h.click(h.page.locator("textarea")); await h.page.locator("textarea").fill(CSV); await h.wait(500); } },
    { say: "Press Read it. It matches your columns for you. Check them, and press Preview.",
      do: async (h) => { await h.click(h.page.getByRole("button", { name: /Read it/ })); await h.wait(1500); await h.highlight(h.page.getByRole("heading", { name: /Match your columns/ }).locator("xpath=..")); } },
    { say: "Now check and fix. Anything it couldn't read is highlighted, and each course is matched to one of your course types.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: /Preview/ })); await h.wait(1500); await h.highlight(h.page.getByRole("heading", { name: /Check & fix/ }).locator("xpath=..")); } },
    { say: "Happy? Import them.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: /^Import \d+ courses?/ })); await h.wait(2500); } },
    { say: "When more bookings come in, import the updated file again. Courses already on the calendar are skipped, so only the new ones are added.",
      do: async (h) => { await h.wait(500); } },

    { chapter: "By hand", say: "And for the odd one-off, add it by hand on the Courses page.",
      do: async (h) => { await h.goto("/office/courses"); await h.scrollTo(h.page.getByRole("heading", { name: "Add a course" })); await h.highlight(h.page.getByRole("heading", { name: "Add a course" }).locator("xpath=..")); } },
    { say: "Pick the course type. Its staffing and ratio come with it.",
      do: async (h) => { await h.unhighlight(); await h.select(h.page.getByRole("heading", { name: "Add a course" }).locator("xpath=..").locator("select"), { label: "Start Paddleboarding" }); } },
    { say: "Then click the days it runs on the calendar. Each click adds a session, at your usual times, and you can change the times for any session.",
      do: async (h) => { await h.scrollTop(); await h.click(h.page.getByRole("button", { name: /^Add a session on/ }).nth(4)); await h.wait(700); await h.scrollTo(h.page.getByRole("heading", { name: "Add a course" })); await h.highlight(h.page.getByText(/Sessions \(\d+\)/i).locator("xpath=..")); } },
    { say: "Press Create course, and it's on the calendar.", pause: 0.8, thumb: true,
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: "Create course" })); await h.wait(2000); await h.scrollTop(); await h.page.mouse.move(1380, 790); } },
    { say: "Next, availability: who's free, and when.", pause: 1.0,
      do: async (h) => { await h.wait(300); } },
  ],
};
