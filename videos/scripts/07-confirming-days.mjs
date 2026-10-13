/**
 * Video 7: Confirming days, and what staff see. Lakeside Sailing Centre's
 * next week (filled by Auto-roster in video 6; videos/seed.test.ts).
 */
const nextMonday = (() => { const d = new Date(); const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7) + 7); return x; })();
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (offset) => { const x = new Date(nextMonday); x.setUTCDate(x.getUTCDate() + offset); return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x.getUTCDay()]} ${x.getUTCDate()} ${MO[x.getUTCMonth()]}`; };
const WEEK = nextMonday.toISOString().slice(0, 10);
const dayCard = (h, offset) => h.page.locator("li").filter({ has: h.page.getByText(label(offset), { exact: true }) }).first();

export default {
  who: "sam@demo.example",
  warm: [`/office/rota?week=${WEEK}`],
  start: `/office/rota?week=${WEEK}`,
  description: `How confirming works in ActivityRoster: shifts stay pending until you confirm the day, confirming tells everyone on it, what happens when you change a confirmed day, undo, the missing-expiry warning, and asking staff to accept their shifts.`,
  tags: ["confirm roster", "staff shift notifications", "sailing centre rota", "instructor shifts", "licence expiry warning"],
  steps: [
    { chapter: "Pending and confirmed", say: "Once the week is built, you confirm it, one day at a time. Here's next week, after Auto-roster.",
      do: async (h) => { await h.highlight(h.page.getByText("Confirm the roster", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-card')][1]")); } },
    { say: "Until a day is confirmed, your team see their shifts in the app as pending, so they know it might still change.",
      do: async (h) => { await h.unhighlight(); await h.highlight(dayCard(h, 0)); } },
    { say: "Each day shows its sessions, how many people are on, and any session still short of staff.",
      do: async (h) => { await h.wait(400); await h.highlight(dayCard(h, 1)); } },

    { chapter: "Confirming a day", say: "For your first week, confirm one day at a time, and check each one. Press Confirm on Monday.",
      do: async (h) => { await h.unhighlight(); await h.click(dayCard(h, 0).getByRole("button", { name: "Confirm", exact: true })); await h.wait(900); } },
    { say: "If anything needs a look, you're told first. Here, some people have no expiry date recorded on any licence, so the app can't warn you if one lapses. It's worth adding them on Instructors.",
      do: async (h) => { await h.highlight(h.page.getByRole("dialog").or(h.page.locator("dialog[open]")).first()); } },
    { say: "Go ahead.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: "Yes, go ahead" })); await h.wait(1800); } },
    { say: "Monday is confirmed, and everyone on it has been told, by email or in the app, depending on how they've chosen to hear.",
      do: async (h) => { await h.highlight(dayCard(h, 0)); } },

    { chapter: "Changes and undo", say: "You can still change a confirmed day. It stays confirmed, and only the people affected hear about it, straight away.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByText(/Changes to a confirmed day/).first()); } },
    { say: "Confirmed too soon? Press Undo. The day goes back to pending, and nobody is told.",
      do: async (h) => { await h.click(dayCard(h, 0).getByRole("button", { name: "Undo" })); await h.wait(800); } },
    { say: "When you confirm it again, only the people whose shifts changed get a message.",
      do: async (h) => { await h.click(h.page.getByRole("button", { name: "Yes, go ahead" })); await h.wait(1500); await h.highlight(dayCard(h, 0)); } },
    { say: "Once you're used to it, Confirm whole week does every pending day in one go.",
      do: async (h) => { await h.unhighlight(); await h.highlight(h.page.getByRole("button", { name: /Confirm whole week/ })); } },

    { chapter: "Accepting shifts", say: "Want each person to accept their shifts? Turn on Ask staff to accept or decline, in Settings.", pause: 0.8, thumb: true,
      do: async (h) => { await h.unhighlight(); await h.goto("/office/settings"); await h.scrollTo(h.page.locator('input[name="staffAcceptShifts"]')); await h.highlight(h.page.locator('input[name="staffAcceptShifts"]').locator("xpath=ancestor::label[1]")); await h.page.mouse.move(1380, 790); } },
    { say: "Then the roster shows who's accepted, and anyone who can't make it is flagged, so you can find cover. Next: printing, the PDF, and the emergency sheet.", pause: 1.0,
      do: async (h) => { await h.unhighlight(); } },
  ],
};
