/**
 * Video 3: Inviting your team. Lakeside Sailing Centre (videos/seed.test.ts):
 * app access on the Instructors list, re-sending and first-time invites, the
 * centre code in Settings, reminders, and people the office looks after.
 */
export default {
  who: "sam@demo.example",
  warm: ["/office/staff", "/office/settings"],
  start: "/office/staff",
  description: `How to get your team onto the ActivityRoster instructor app: who has app access, re-sending an invite, inviting someone for the first time, your centre code for anyone whose invite went astray, reminding people to set their availability, and running someone from the office instead.`,
  tags: ["instructor app invite", "staff app sailing centre", "centre code", "availability reminder", "watersports staff onboarding"],
  steps: [
    { chapter: "Who's on the app", say: "Once your team is added, you want them on the app, so they keep their own availability and licences up to date. The Instructors list shows where everyone is.",
      do: async (h) => { await h.scrollTo(h.page.getByText("App access", { exact: false }).last()); await h.highlight(h.page.getByText("App access", { exact: false }).last()); } },
    { say: "Portal access means they've signed up. If someone says they never got the email, press Re-send invite.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByText("Portal access").first()); await h.wait(500); await h.point(h.page.getByRole("button", { name: "Re-send invite" }).first()); } },
    { say: "Dan has no account yet. Invite to portal sends him his first invite.",
      do: async (h) => { await h.highlight(h.page.locator("tr").filter({ hasText: "Dan Ward" }).first()); await h.wait(600); await h.click(h.page.locator("tr").filter({ hasText: "Dan Ward" }).getByRole("button", { name: "Invite to portal" })); await h.wait(1200); } },
    { say: "Invites come from ActivityRoster, so they sometimes land in spam. That's why the setup wizard gives you a message to send on your team chat first, so people know to look for it.",
      do: async (h) => { await h.unhighlight(); await h.wait(400); } },

    { chapter: "Your centre code", say: "If an invite still goes astray, people can join with your centre code. It's in Settings.",
      do: async (h) => { await h.goto("/office/settings"); await h.highlight(h.page.getByRole("heading", { name: /Company code/ }).locator("xpath=..")); } },
    { say: "They download the app, create an account with the email you have for them, and enter the code. If the email matches your list, they're linked straight away. If not, you approve them.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByRole("button", { name: "Copy" }).first()); } },
    { say: "If a code is ever shared too widely, issue a new one. The old one stops working.",
      do: async (h) => { await h.point(h.page.getByRole("button", { name: "Issue a new code" })); } },

    { chapter: "Reminders", say: "Back on Instructors, the list shows who hasn't set their availability yet.",
      do: async (h) => { await h.goto("/office/staff"); await h.scrollTo(h.page.getByRole("button", { name: /Everyone who hasn.t set availability/ })); await h.highlight(h.page.getByText("Not yet").first().locator("xpath=ancestor::td[1]")); } },
    { say: "Remind one person, or press Everyone who hasn't set availability, to nudge them all at once.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByRole("button", { name: "Remind" }).first()); await h.wait(500); await h.highlight(h.page.getByRole("button", { name: /Everyone who hasn.t set availability/ })); } },

    { chapter: "Run it from the office", say: "Not everyone will use the app, and that's fine. Peter is a volunteer, and the office keeps his availability. He shows as office on the Availability page.",
      do: async (h) => { await h.unhighlight(); await h.goto("/office/availability"); await h.highlight(h.page.getByRole("button", { name: /Peter Lynch/ }).first()); } },
    { say: "To run someone from the office, open their profile, and under Availability choose The office sets it. They count as free until you mark them busy.", pause: 0.8, thumb: true,
      do: async (h) => { await h.unhighlight(); await h.goto("/office/staff"); await h.click(h.page.getByText("Dan Ward", { exact: true }).first()); await h.page.waitForURL(/\/office\/staff\/[^/]+$/); await h.wait(1200); await h.highlight(h.page.getByText(/Who sets .* availability\?/).locator("xpath=..")); await h.page.mouse.move(1380, 790); } },
    { say: "That's your team invited. Next, getting your courses onto the calendar.", pause: 1.0,
      do: async (h) => { await h.unhighlight(); } },
  ],
};
