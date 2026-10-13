/**
 * Video 11: Settings and office access. Lakeside Sailing Centre
 * (videos/seed.test.ts): the Settings tabs, the roster checks, and giving an
 * office admin access to just the parts they need.
 */
export default {
  who: "sam@demo.example",
  warm: ["/office/settings", "/office/staff", "/office/change-log"],
  start: "/office/settings",
  description: `A tour of ActivityRoster settings: your centre code, how availability is kept, the morning roster email, the roster checks for licences, ratios, double-bookings and availability, and office access, where each office admin gets only the parts of the office they need.`,
  tags: ["sailing centre software settings", "office admin access", "roster checks", "staff permissions", "change log"],
  steps: [
    { chapter: "The Settings tabs", say: "Settings is split into tabs, and each section saves on its own, so you can change one thing without touching the rest.",
      do: async (h) => { await h.highlight(h.page.getByRole("button", { name: "General" }).or(h.page.getByRole("tab", { name: "General" })).first().locator("xpath=..")); } },
    { say: "General has your centre code for the app, who keeps availability up to date, how far ahead staff can set it, your currency, and how long before an admin is asked for their PIN again.",
      do: async (h) => { await h.unhighlight(); await h.scrollTo(h.page.locator('input[name="availabilityWeeksAhead"]')); await h.highlight(h.page.locator('input[name="availabilityWeeksAhead"]').locator("xpath=ancestor::*[self::label or self::div][1]")); } },
    { say: "You can also have the day's roster emailed to every admin each morning.",
      do: async (h) => { await h.unhighlight(); await h.scrollTo(h.page.locator('input[name="dailyDigestEnabled"]')); await h.highlight(h.page.locator('input[name="dailyDigestEnabled"]').locator("xpath=ancestor::label[1]")); } },

    { chapter: "Roster checks", say: "Roster and welfare holds the checks that keep the roster safe.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: "Roster & welfare" }).or(h.page.getByRole("tab", { name: "Roster & welfare" })).first()); await h.wait(900); } },
    { say: "Block anyone with a missing or expired licence. Flag courses short of instructors for their ratio. Stop double-bookings. And don't roster anyone who's busy.",
      do: async (h) => { await h.highlight(h.page.locator('input[name="enforceLicenceChecks"]').locator("xpath=ancestor::label[1]")); await h.wait(900); await h.highlight(h.page.locator('input[name="enforceConflictChecks"]').locator("xpath=ancestor::label[1]")); } },
    { say: "Each one is on by default. If you switch one off, the roster still shows the problem, it just doesn't stop you.",
      do: async (h) => { await h.highlight(h.page.locator('input[name="enforceAvailabilityChecks"]').locator("xpath=ancestor::label[1]")); } },
    { say: "The other tabs cover pay rates, the time clock, your lists of things like locations, and your data: exports, and closing the account.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByRole("button", { name: "Time & clock" }).or(h.page.getByRole("tab", { name: "Time & clock" })).first()); await h.wait(500); await h.point(h.page.getByRole("button", { name: "Data & account" }).or(h.page.getByRole("tab", { name: "Data & account" })).first()); } },

    { chapter: "Office access", say: "Who can open the office is set on the Instructors page, under Office access. As the owner, you can do everything.",
      do: async (h) => { await h.goto("/office/staff"); await h.highlight(h.page.getByRole("heading", { name: "Office access" }).locator("xpath=..")); } },
    { say: "To add someone, press Invite an office admin, and enter their name and email.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: "+ Invite an office admin" })); await h.wait(600); await h.type(h.page.getByPlaceholder("Name").first(), "Tom Reed"); await h.type(h.page.getByPlaceholder("Email").first(), "tom.reed@lakeside.example", 30); } },
    { say: "Then tick what they can reach. A new office admin starts with nothing. Here, the roster and courses, and staff, but not payroll or billing.",
      do: async (h) => { await h.click(h.page.getByText("Roster & courses", { exact: true }).locator("xpath=ancestor::label[1]").locator("input")); await h.click(h.page.getByText("Staff", { exact: true }).locator("xpath=ancestor::label[1]").locator("input")); } },
    { say: "Emergency and guardian contacts are a separate tick, and every view is logged. Change any of it later, or remove their access.", pause: 0.8, thumb: true,
      do: async (h) => { await h.highlight(h.page.getByText("Emergency & guardian contacts", { exact: true }).last().locator("xpath=ancestor::label[1]")); await h.page.mouse.move(1380, 790); } },

    { chapter: "The change log", say: "And everything that changes, on the roster, your team, your settings or billing, is written to the change log, with who did it and when.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: "Cancel" }).first()).catch(() => {}); await h.goto("/office/change-log"); await h.point("h1"); } },
    { say: "That's the office. The last video is for your instructors: the app.", pause: 1.0,
      do: async (h) => { await h.wait(300); } },
  ],
};
