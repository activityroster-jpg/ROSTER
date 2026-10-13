/**
 * Video 12: For instructors, the app. Signed in as Kim, an instructor at
 * Lakeside Sailing Centre (videos/seed.test.ts): her schedule, availability,
 * leave, hours, certificates and settings.
 */
export default {
  who: "kim@demo.example",
  warm: ["/portal", "/portal/availability", "/portal/documents", "/portal/leave", "/portal/hours", "/portal/settings"],
  start: "/portal",
  description: `For instructors: a tour of the ActivityRoster app. Your shifts for the next four weeks, pending and confirmed, setting your availability and your usual week, asking for leave, your hours, uploading your licences, and your settings, including a calendar link and how you're notified.`,
  tags: ["instructor app", "sailing instructor shifts", "staff availability app", "watersports instructor", "RYA instructor"],
  steps: [
    { chapter: "Your schedule", say: "This one's for your instructors. Here's the app, for Kim, an instructor at Lakeside Sailing Centre. It works on any phone, and on a computer.",
      do: async (h) => { await h.point(h.page.getByRole("heading", { name: "My schedule" })); } },
    { say: "My schedule shows every shift for the next four weeks: the times, the course, where, who else is on, and how many students.",
      do: async (h) => { await h.highlight(h.page.getByText(/Pending: your centre|✓ Confirmed/).first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]")); } },
    { say: "Pending means the centre hasn't confirmed that day yet, so it could still change. When it's confirmed, Kim gets a message, and it shows as confirmed.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByText(/Pending: your centre/)); } },
    { say: "The bell has her messages: new shifts, changes, and open shifts she could cover.",
      do: async (h) => { await h.point(h.page.getByRole("link", { name: /Notifications|notifications/ }).or(h.page.locator('a[href*="notifications"]'))); } },

    { chapter: "Availability", say: "Available is where Kim says when she can work. Every slot counts as busy until she marks it free, so the office never rosters someone who hasn't said.",
      do: async (h) => { await h.click(h.page.getByRole("link", { name: "Available" })); await h.page.waitForURL(/availability/); await h.wait(1000); await h.point(h.page.getByRole("heading", { name: "My availability" })); } },
    { say: "Tap a slot to change it: free, maybe, or busy. Add a note to a day if there's something the office should know.",
      do: async (h) => { await h.click(h.page.getByRole("button", { name: /^Mon AM:/ })); await h.wait(900); await h.point(h.page.getByRole("button", { name: /^Add note for/ })); } },
    { say: "The quickest way is My usual week: set it once, and only change the exceptions. Same as last week, and All free, fill a whole week in one tap.",
      do: async (h) => { await h.highlight(h.page.getByRole("button", { name: "My usual week" })); await h.wait(900); await h.highlight(h.page.getByRole("button", { name: "All free" })); } },
    { say: "Use the arrows to set the weeks ahead, as far as your centre allows.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: "Next week" })); await h.wait(800); } },

    { chapter: "Leave, hours and documents", say: "Leave is for time off: the type, the dates, and a reason if she likes. The office approves it, and she's told.",
      do: async (h) => { await h.click(h.page.getByRole("link", { name: "Leave" })); await h.page.waitForURL(/leave/); await h.wait(900); await h.highlight(h.page.getByRole("button", { name: "Submit request" }).locator("xpath=ancestor::form[1]")); } },
    { say: "Hours shows what she's worked, from the roster, for checking against her pay.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("link", { name: "Hours" })); await h.page.waitForURL(/hours/); await h.wait(900); } },
    { say: "And Docs is for her licences and certificates. Pick the certificate, add the expiry date, and upload a photo or PDF. The office is warned before anything expires.",
      do: async (h) => { await h.click(h.page.getByRole("link", { name: "Docs" })); await h.page.waitForURL(/documents/); await h.wait(900); await h.highlight(h.page.getByRole("button", { name: "Upload" }).locator("xpath=ancestor::form[1]")); } },
    { say: "If the centre uses the time clock, Clock is where she clocks in and out.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByRole("link", { name: "Clock" })); } },

    { chapter: "Settings", say: "Finally, settings. Her name and mobile number, whether colleagues can see her contact details, and how she's notified.", pause: 0.8, thumb: true,
      do: async (h) => { await h.goto("/portal/settings"); await h.highlight(h.page.getByRole("heading", { name: "About you" }).locator("xpath=..")); await h.page.mouse.move(1380, 790); } },
    { say: "Make my calendar link puts her shifts in her phone's own calendar, and they stay up to date. And if she works at another centre too, she can join it with a code.",
      do: async (h) => { await h.unhighlight(); await h.scrollTo(h.page.getByRole("button", { name: "Make my calendar link" })); await h.highlight(h.page.getByRole("button", { name: "Make my calendar link" })); } },
    { say: "If the internet drops, the app still shows her week. That's the series. Thanks for watching, and you'll find a step-by-step guide for everything at activityroster dot com slash learn.", pause: 1.2,
      do: async (h) => { await h.unhighlight(); await h.goto("/portal"); } },
  ],
};
