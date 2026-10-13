/**
 * The homepage explainer: ActivityRoster in about two minutes, on the demo
 * centre (videos/seed.test.ts). It sells the whole idea: everything in one
 * place, the checks, Auto-roster, confirming, the app, printing and pay.
 * Music plays quietly under the narration.
 */
const nextMonday = (() => { const d = new Date(); const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7) + 7); return x.toISOString().slice(0, 10); })();
const WEEK = `/office/rota?week=${nextMonday}`;

export default {
  who: "sam@demo.example",
  musicUnder: true,
  warm: ["/office", WEEK, "/office/course-setup", "/office/availability", "/office/finance"],
  start: "/office",
  description: `ActivityRoster is staff rostering for RYA sailing and watersports centres: your courses, instructors, qualifications and ratios in one place, a roster that fills itself with people who are free and qualified, checks that catch clashes and lapsed licences, and an app for your team. Your first month is free.`,
  tags: ["sailing centre software", "watersports staff rota", "RYA instructor rostering", "staff scheduling software", "activity centre management"],
  steps: [
    { chapter: "One place for everything", say: "Running a sailing or watersports centre means juggling courses, instructors, qualifications and ratios. Usually on a spreadsheet, and a very busy group chat.",
      do: async (h) => { await h.point("h1"); } },
    { say: "ActivityRoster puts it all in one place. Today's sessions, who's on, and anything that needs your attention, the moment you sign in.",
      do: async (h) => { await h.highlight(h.page.getByText(/^Today ·/).locator("xpath=ancestor::div[contains(@class,'rounded')][1]")); } },

    { chapter: "Who can teach what", say: "Every RYA course comes set up, with its staffing and ratios. And each instructor is marked with the instructor types they hold, so it knows exactly who can teach what.",
      do: async (h) => { await h.unhighlight(); await h.goto("/office/course-setup"); await h.highlight(h.page.getByRole("columnheader", { name: /Who can teach it/i }).or(h.page.getByText("Who can teach it"))); } },

    { chapter: "Auto-roster", say: "Here's next week, half term, with places still to fill.",
      do: async (h) => { await h.unhighlight(); await h.goto(WEEK); await h.highlight(h.page.getByText(/^needs \d+$/)); } },
    { say: "Press Auto-roster.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: /Auto-roster/ })); await h.wait(600); await h.click(h.page.getByText(/Fill the open places only/)); } },
    { say: "Every open place goes to someone who's free, cleared to roster, and qualified for it, with the sessions shared out fairly. A week's rostering, in seconds.", thumb: true,
      do: async (h) => { await h.click(h.page.getByRole("button", { name: /^Fill the \d+ open places?/ })); await h.wait(2500); await h.page.mouse.move(1380, 790); } },
    { say: "Clashes, double bookings, missing licences and ratios are checked as you go. Anything that doesn't add up turns red, so nothing slips through.",
      do: async (h) => { await h.highlight(h.page.getByText("Confirm the roster", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-card')][1]")); } },
    { say: "When you're happy, confirm each day, and everyone on it gets a message.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByRole("button", { name: /Confirm whole week/ })); } },

    { chapter: "Your team's app", say: "Your instructors use the app. They set when they're free, keep their own licences up to date, ask for leave, and see their shifts. So you're never chasing anyone.",
      do: async (h) => { await h.goto("/office/availability"); await h.highlight(h.page.locator("table").first()); } },

    { chapter: "Print, safety and pay", say: "The roster prints, or downloads as a PDF. The emergency sheet for the duty officer is one click away.",
      do: async (h) => { await h.unhighlight(); await h.goto(WEEK); await h.click(h.page.getByRole("link", { name: "Print view" })); await h.wait(1500); await h.point(h.page.getByRole("link", { name: "Emergency sheet" })); } },
    { say: "And pay is worked out from the roster, at each person's rate, ready to check and export.",
      do: async (h) => { await h.goto("/office/finance"); await h.highlight(h.page.getByText("Total pay").locator("xpath=../..")); } },

    { chapter: "Try it free", say: "ActivityRoster. Built for RYA sailing and watersports centres. Set up in an afternoon, and your first month is free. Start at activityroster dot com.", pause: 1.2,
      do: async (h) => { await h.unhighlight(); await h.goto("/office"); } },
  ],
};
