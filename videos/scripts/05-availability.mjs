/**
 * Video 5: Availability. Lakeside Sailing Centre (videos/seed.test.ts): the
 * week grid, what each mark means, setting someone's availability from the
 * office, and putting a free person on a session.
 */
export default {
  who: "sam@demo.example",
  warm: ["/office/availability"],
  start: "/office/availability",
  description: `How availability works in ActivityRoster: the week grid, Free, Maybe and Busy, usual weeks, people the office looks after, changing someone's availability from the office, and putting a free instructor straight onto a session.`,
  tags: ["staff availability", "instructor availability grid", "sailing centre rota", "watersports staff scheduling", "usual week"],
  steps: [
    { chapter: "The week at a glance", say: "The Availability page shows who's free across the week: a row for each instructor, and a column for each morning, afternoon and evening.",
      do: async (h) => { await h.highlight(h.page.locator("table").first()); } },
    { say: "The numbers along the top count who's free in each slot, so a thin day stands out straight away.",
      do: async (h) => { await h.unhighlight(); await h.highlight(h.page.locator("thead tr").last()); } },
    { say: "A tick means free. Amber is maybe, red is busy. A dot means they haven't answered, and until they do, they count as busy.",
      do: async (h) => { await h.unhighlight(); await h.highlight(h.page.getByText("✓ Free", { exact: true }).first().locator("xpath=..")); } },
    { say: "Usual means it comes from their usual week: someone who's always free on Saturdays only has to say so once.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByText("usual", { exact: true }).first()); } },
    { say: "The hours beside each name show what they're rostered for this week, and a small dot in a slot shows they're already on a session.",
      do: async (h) => { await h.highlight(h.page.getByRole("button", { name: /Jack Brown/ }).first()); } },
    { say: "Your team fill this in themselves, in the app, up to four weeks ahead. Use Next to look further on.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("link", { name: /Next →/ }).or(h.page.getByRole("button", { name: /Next →/ })).first()); await h.wait(1500); await h.click(h.page.getByRole("link", { name: /Previous/ }).or(h.page.getByRole("button", { name: /Previous/ })).first()); await h.wait(1000); } },

    { chapter: "Changing it from the office", say: "If someone tells you instead, set it for them. Switch to Edit availability.",
      do: async (h) => { await h.click(h.page.getByRole("tab", { name: "Edit availability" })); await h.wait(500); } },
    { say: "Grace hasn't answered for Wednesday morning. Click the slot.",
      do: async (h) => { await h.click(h.page.getByRole("button", { name: /^Grace Wilson, Wed AM/ })); await h.wait(700); } },
    { say: "And set her as free. It's saved straight away, and it's noted that the office set it.",
      do: async (h) => { await h.click(h.page.getByRole("dialog").getByRole("button", { name: /Free/ }).first()); await h.wait(1200); await h.click(h.page.getByRole("dialog").getByRole("button", { name: /Close/ })); await h.wait(500); } },

    { chapter: "Putting someone on", say: "Back in Assign staff, click any free slot to see the sessions that person can do then.",
      do: async (h) => { await h.click(h.page.getByRole("tab", { name: "Assign staff" })); await h.wait(500); await h.click(h.page.getByRole("button", { name: /^Grace Wilson, Wed AM/ })); await h.wait(1500); } },
    { say: "Only courses they're qualified for, and free for, are offered. Pick the place, and assign them, without leaving the page.", pause: 0.8, thumb: true,
      do: async (h) => { await h.highlight(h.page.getByRole("dialog").first()); await h.page.mouse.move(1380, 300); } },
    { say: "Most of the time, though, you'll let Auto-roster do this for the whole week. That's the next video.", pause: 1.0,
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("dialog").getByRole("button", { name: /Close/ })).catch(() => {}); } },
  ],
};
