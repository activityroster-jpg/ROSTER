/**
 * Video 8: Printing, the PDF and the emergency sheet. Lakeside Sailing
 * Centre (videos/seed.test.ts): this week's print view, the PDF download and
 * its layout, the emergency sheet, and what to do if the platform is down.
 */
const thisMonday = (() => { const d = new Date(); const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); })();

export default {
  who: "sam@demo.example",
  warm: [`/office/rota?week=${thisMonday}&view=print`, "/office/rota/emergency"],
  start: `/office/rota?week=${thisMonday}`,
  description: `Getting the roster off the screen with ActivityRoster: the print view, downloading the roster PDF for a day, a week or a month, changing its layout, the emergency sheet for the duty officer, and what to do if the platform is ever down.`,
  tags: ["roster PDF", "print staff rota", "emergency contact sheet", "sailing centre safety", "duty officer"],
  steps: [
    { chapter: "Print view", say: "Plenty of centres still pin the roster up. On the Roster page, switch to Print view.",
      do: async (h) => { await h.click(h.page.getByRole("link", { name: "Print view" })); await h.page.waitForURL(/view=print/); await h.wait(1200); } },
    { say: "Each day is laid out as a table: every course, its times, who's on it, and where.",
      do: async (h) => { await h.highlight(h.page.locator("main table, table")); } },
    { say: "Any problem this week, like a session short of staff, is listed at the top, so it isn't missed before you print.",
      do: async (h) => { await h.unhighlight(); await h.scrollTop(); } },

    { chapter: "The roster PDF", say: "For a file to send or print, use Download PDF. Choose a day, this week, or this month.",
      do: async (h) => { await h.select(h.page.getByLabel("Period to download"), "week"); await h.highlight(h.page.getByRole("link", { name: /Download PDF/ })); } },
    { say: "The layout is yours to change: what it shows, the style, portrait or landscape. Press Change layout.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("link", { name: "Change layout" })); await h.wait(1500); } },
    { say: "Tick what to include, pick a style, and save. If you sent us an example of your old roster in setup, we can make yours match it.",
      do: async (h) => { await h.scrollTo(h.page.locator("#rota-pdf")); await h.highlight(h.page.locator("#rota-pdf")); } },

    { chapter: "The emergency sheet", say: "Next, the emergency sheet: everyone on duty today, with their emergency contact and number.",
      do: async (h) => { await h.unhighlight(); await h.goto("/office/rota/emergency"); await h.highlight(h.page.locator("table").first().or(h.page.getByText("Nobody is rostered on this day."))); } },
    { say: "Under-eighteens show their parent or guardian too. Only people you allow can see the contacts, and each time the sheet is opened, it's written to the change log.",
      do: async (h) => { await h.unhighlight(); await h.highlight(h.page.getByText("Handle with care.").locator("xpath=..")); } },
    { say: "Print it for the duty officer or the safety boat, or download it. Use the arrows for another day.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByRole("button", { name: /Print/ })); await h.wait(500); await h.point(h.page.getByRole("link", { name: /Next day/ })); } },

    { chapter: "If the platform is down", say: "And if the internet, or the platform, is ever down: your team's app keeps the week on their phone, so they can still see their shifts.", pause: 0.8, thumb: true,
      do: async (h) => { await h.page.mouse.move(1380, 790); await h.wait(300); } },
    { say: "Admins can also get the day's roster by email each morning, switched on in Settings. The guide, If the platform is down, has the full plan. Next video: leave and open shifts.", pause: 1.0,
      do: async (h) => { await h.goto("/office/settings"); await h.highlight(h.page.locator('input[name="dailyDigestEnabled"]').locator("xpath=ancestor::label[1]")); } },
  ],
};
