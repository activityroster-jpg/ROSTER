/**
 * Video 9: Leave and open shifts. Lakeside Sailing Centre (videos/seed.test.ts):
 * Jack's pending leave request, Olivia's approved day off, and an open shift
 * broadcast for staff to claim.
 */
export default {
  who: "sam@demo.example",
  warm: ["/office/leave"],
  start: "/office/leave",
  description: `How leave and cover work in ActivityRoster: staff request leave in the app, you approve or decline it, approved leave counts as busy, and an open shift asks your team who can cover a place, with the first to offer confirmed by you.`,
  tags: ["staff leave requests", "shift cover", "open shifts", "sailing instructor holiday", "watersports staff rota"],
  steps: [
    { chapter: "Leave requests", say: "Leave and cover is where time off, and the gaps it leaves, are handled.",
      do: async (h) => { await h.point("h1"); } },
    { say: "Your team ask for leave in the app. Each request shows here, with its type and dates. Jack has asked for three days off, for a family wedding.",
      do: async (h) => { await h.highlight(h.page.locator("tr").filter({ hasText: "Jack Brown" }).first()); } },
    { say: "Approve it, or decline it. Jack is told either way.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.locator("tr").filter({ hasText: "Jack Brown" }).getByRole("button", { name: "Approve" })); await h.wait(1500); } },
    { say: "Approved leave counts as busy, so Auto-roster won't put Jack on anything those days. If he was already rostered, those sessions show up as a problem on the roster, so you can find cover.",
      do: async (h) => { await h.highlight(h.page.locator("tr").filter({ hasText: "Jack Brown" }).first()); } },

    { chapter: "Open shifts", say: "To find cover, post an open shift. Your team are asked who can take it.",
      do: async (h) => { await h.unhighlight(); await h.scrollTo(h.page.getByRole("heading", { name: /Open shifts/ })); await h.highlight(h.page.getByRole("heading", { name: /Open shifts/ }).locator("xpath=..")); } },
    { say: "Pick the session, and the place to fill. The place is an instructor type, so only people who hold it are asked.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByLabel("Session").or(h.page.locator("label").filter({ hasText: "Session" }).locator("select")).first()); await h.wait(600); await h.point(h.page.getByLabel("Place (instructor type)").first()); } },
    { say: "Press Broadcast open shift.",
      do: async (h) => { await h.click(h.page.getByRole("button", { name: "Broadcast open shift" })); await h.wait(1800); } },
    { say: "It's open. Qualified, free instructors see it in the app, and can offer to take it.",
      do: async (h) => { await h.highlight(h.page.getByText("Open", { exact: true }).first().locator("xpath=ancestor::li[1]")); } },
    { say: "When someone offers, it shows here as offered, with their name. Press Confirm, and they're on the roster. Or cancel it if you've sorted it another way.", pause: 0.8, thumb: true,
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByRole("button", { name: "Cancel" }).first()); await h.page.mouse.move(1380, 790); } },
    { say: "Leave requests waiting, and open shifts needing cover, are counted on your dashboard too. Next: pay rates and payroll.", pause: 1.0,
      do: async (h) => { await h.goto("/office"); await h.highlight(h.page.getByText("Leave to approve").locator("xpath=..")); } },
  ],
};
