/**
 * Video 10: Pay rates and payroll. Lakeside Sailing Centre (videos/seed.test.ts,
 * Pay & payroll switched on): standard rates by place, a person's own rate,
 * and the payroll page built from the roster.
 */
export default {
  who: "sam@demo.example",
  warm: ["/office/settings?tab=pay", "/office/finance"],
  start: "/office/settings?tab=pay",
  description: `How pay works in ActivityRoster: standard rates for each place (instructor type), per hour or per session, a different rate on a course, each person's own rate, and the payroll page, where hours come from the roster, you check each line, approve them and export for your payroll.`,
  tags: ["instructor pay rates", "payroll export", "sailing centre payroll", "hourly rate per session", "staff hours"],
  steps: [
    { chapter: "Standard rates", say: "Pay starts in Settings, under Pay rates. Set it before your first pay run.",
      do: async (h) => { await h.highlight(h.page.getByRole("heading", { name: /Standard rates by place/ }).locator("xpath=..")); } },
    { say: "Each place, which is an instructor type, has a standard rate: per hour, or per session. A Dinghy Instructor here is paid fourteen pounds an hour.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByLabel("Dinghy Instructor: amount").first()); } },
    { say: "Change it, and save. The bar tells you how many changes you're saving.",
      do: async (h) => { await h.type(h.page.getByLabel("Dinghy Instructor: amount").first(), "14.50", 90); await h.wait(400); await h.highlight(h.page.getByRole("button", { name: /^Save \d+ change/ }).first()); } },
    { say: "Unapproved payroll lines are re-priced from a date you choose. Approved lines keep their pay.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: /^Save \d+ change/ }).first()); await h.wait(1500); } },
    { say: "Where a course pays differently, camps by the day, say, add a course rate under the place.",
      do: async (h) => { await h.point(h.page.getByText(/\+ (Different rate on a course|course rate)/i).first()); } },

    { chapter: "Each person", say: "Below that, each person. Leave it blank to use the standard rates, or give someone their own rate. Volunteers usually have none.",
      do: async (h) => { await h.scrollTo(h.page.getByRole("heading", { name: /Each person/ })); await h.highlight(h.page.getByRole("heading", { name: /Each person/ }).locator("xpath=../..")); } },

    { chapter: "Payroll", say: "Now Payroll. The hours come straight from the roster, at each person's rate.",
      do: async (h) => { await h.unhighlight(); await h.goto("/office/finance"); await h.point("h1"); } },
    { say: "Choose the period: this week, this month, last month, or your own dates. The totals are at the top.",
      do: async (h) => { await h.point(h.page.locator('select[name="period"]')); await h.wait(500); await h.highlight(h.page.getByText("Total pay").locator("xpath=../..")); } },
    { say: "Each line is one shift. Correct the minutes, or the pay, if something was different on the day, and add a note.",
      do: async (h) => { await h.unhighlight(); await h.scrollTo(h.page.getByLabel(/Minutes o/).first()); await h.highlight(h.page.locator("tbody tr").filter({ has: h.page.getByLabel("Approved") }).first()); } },
    { say: "Tick each line as OK once you've checked it, or approve everything shown in one go.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByLabel("Approved").first()); await h.wait(800); await h.point(h.page.getByRole("button", { name: /Approve all shown/ })); } },
    { say: "If the roster changes after a line is approved, it's flagged, so nothing slips through.",
      do: async (h) => { await h.point(h.page.getByRole("button", { name: "Refresh from roster" })); } },
    { say: "Then export: a spreadsheet of every shift, or the totals for each person, for your payroll or accountant. Holiday pay and lunch breaks are set in Settings.", pause: 0.8, thumb: true,
      do: async (h) => { await h.scrollTop(); await h.highlight(h.page.getByRole("link", { name: /Spreadsheet · every shift/ })); await h.page.mouse.move(1380, 790); } },
    { say: "If you use the time clock, clock-in times show alongside the rostered times. Next: settings, and who can open the office.", pause: 1.0,
      do: async (h) => { await h.unhighlight(); } },
  ],
};
