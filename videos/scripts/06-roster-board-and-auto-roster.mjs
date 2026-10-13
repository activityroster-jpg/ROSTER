/**
 * Video 6: The roster board and Auto-roster.
 * Each line is spoken while its action plays. The demo centre's next week is
 * half term, with places still open (videos/seed.test.ts).
 */
const nextMonday = (() => { const d = new Date(); const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7) + 7); return x.toISOString().slice(0, 10); })();
const card = (h, name) => h.page.locator("button, [role=button], a, div").filter({ hasText: new RegExp(`^${name}`) }).filter({ hasText: /\d\d:\d\d/ }).last();

export default {
  who: "sam@demo.example",
  warm: ["/office", `/office/rota?week=${nextMonday}`],
  start: `/office/rota?week=${nextMonday}`,
  description: `How to build the week on the ActivityRoster roster board: what the session colours mean, how to put someone on a session by hand, how Auto-roster fills every open place with someone who is free and qualified, and how to see the week person by person.`,
  tags: ["roster board", "auto roster", "staff rota", "sailing instructor roster", "half term camp staffing"],
  steps: [
    { chapter: "The roster board", say: "This is the roster board, where you build each week. Here's half-term week at Lough Shore Sailing Centre.",
      do: async (h) => { await h.point("h1"); } },
    { say: "Each card is one session. Orange means there are still places to fill, and the badge says how many.",
      do: async (h) => { await h.highlight(h.page.getByText(/^needs \d+$/).first()); } },
    { say: "Green means every place is filled and nothing is wrong. Red would mean a problem to fix, such as a clash, or someone in a place they aren't qualified for.",
      do: async (h) => { await h.highlight(card(h, "Half-term Camp: Stage 1")); } },
    { say: "Along the top, each day shows its sessions and people, and whether it's pending or confirmed. Confirming is the next video.",
      do: async (h) => { await h.highlight(h.page.getByText("Confirm the roster").locator("xpath=ancestor::div[contains(@class,'rounded-card')][1]")); } },

    { chapter: "Putting someone on by hand", say: "To fill a place yourself, click the session.",
      do: async (h) => { await h.unhighlight(); await h.wait(300); await h.click(card(h, "Start Windsurfing")); } },
    { say: "The panel shows who's on it, and each place still open. Every place is an instructor type: here, a Start Windsurfing Instructor.",
      do: async (h) => { await h.wait(500); await h.highlight(h.page.getByRole("dialog").getByRole("button", { name: /^Who for / }).first()); } },
    { say: "Open the picker. People are in three groups: qualified and free at the top, then qualified but busy, then anyone who isn't qualified, with the reason.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("dialog").getByRole("button", { name: /^Who for / }).first()); await h.wait(700); await h.highlight(h.page.getByRole("listbox").first()); } },
    { say: "Sinead holds the right instructor type and she's free, so pick her, and press Assign.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("option", { name: /Sinead Barr/ }).first()); await h.wait(400); await h.click(h.page.getByRole("dialog").getByRole("button", { name: "Assign", exact: true }).first()); } },
    { say: "She's on. If someone doesn't fit, the button turns amber and says Assign anyway, and the reason is kept in the change log.", thumb: true,
      do: async (h) => { await h.wait(900); await h.highlight(h.page.getByRole("dialog").getByText(/Sinead Barr/).first()); } },

    { chapter: "Auto-roster", say: "Filling a whole week by hand takes time. Auto-roster does it in one go.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("dialog").getByRole("button", { name: "Close" })); await h.wait(400); await h.point(h.page.getByRole("button", { name: /Auto-roster/ }).first()); } },
    { say: "Press Auto-roster, and choose what you want.",
      do: async (h) => { await h.click(h.page.getByRole("button", { name: /Auto-roster/ }).first()); await h.wait(600); } },
    { say: "Fill the open places only keeps everyone already on the roster where they are.",
      do: async (h) => { await h.highlight(h.page.getByText(/Fill the open places only/).first()); } },
    { say: "Redo the whole week works everything out afresh, and you can undo it straight after.",
      do: async (h) => { await h.highlight(h.page.getByText(/Redo the whole week/).first()); } },
    { say: "Each place goes to someone who's free, cleared to roster, and holds the right instructor type, and the sessions are shared out as evenly as possible.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByText(/Each place goes to someone/).first()); } },
    { say: "Let's fill the open places.",
      do: async (h) => { await h.click(h.page.getByText(/Fill the open places only/).first()); await h.click(h.page.getByRole("button", { name: /^Fill the \d+ open places?/ }).first()); } },
    { say: "Done. Every place it could fill is filled, and anything left stays orange for you to sort out by hand.", pause: 1.0,
      do: async (h) => { await h.wait(2500); await h.point(card(h, "Start Windsurfing")); } },

    { chapter: "People × days", say: "Switch to People by days to see the week the other way round: a row for each instructor, with their free slots in green.",
      do: async (h) => { await h.click(h.page.getByRole("tab", { name: /People/ }).or(h.page.getByRole("button", { name: /People × days/ })).first()); await h.wait(900); } },
    { say: "The hours beside each name show how much each person is rostered this week, so you can spot anyone doing too much, or too little.",
      do: async (h) => { await h.highlight(h.page.getByText(/^\d+(\.\d+)? h$/).first()); } },
    { chapter: "Problems", say: "If anything stops adding up later, say someone marks themselves busy, the session turns red, and the problem is listed on the dashboard.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("tab", { name: /Courses by day/ }).or(h.page.getByRole("button", { name: /Courses by day/ })).first()); } },
    { say: "That's the roster board. Next, we'll check tickets and confirm the days, so your team gets their shifts.", pause: 0.8,
      do: async (h) => { await h.scrollTop(); } },
  ],
};
