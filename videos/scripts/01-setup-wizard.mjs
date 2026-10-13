/**
 * Video 1: Sign up and the setup wizard. Recorded on the brand-new centre,
 * Harbour Watersports (slug newcentre), whose owner Jo hasn't run the wizard
 * yet (videos/seed.test.ts). The sign-up form is shown, never sent.
 */
const HOME = "http://localhost:8788";

export default {
  who: "jo@newcentre.example",
  host: "newcentre",
  warm: ["/office/onboarding", "/office"],
  start: "/office/onboarding",
  prepare: async (page) => {
    await page.goto(`${HOME}/#get-demo`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByRole("button", { name: "Got it" }).click({ timeout: 4000 }).catch(() => {});
    await page.locator("#get-demo").scrollIntoViewIfNeeded();
  },
  description: `How to sign up to ActivityRoster and get through the setup wizard: your free month, confirming your email, your PIN, choosing how your sessions run, ticking every course you run, adding your team with their instructor types, and letting them know the invite is coming.`,
  tags: ["activityroster setup", "sailing centre software", "watersports centre rota", "RYA centre staff app", "free trial"],
  steps: [
    { chapter: "Signing up", say: "Welcome to ActivityRoster. Your first month is free, and signing up takes about a minute, right here on the home page.",
      do: async (h) => { await h.highlight("#get-demo form"); } },
    { say: "Enter your email and a password, your centre's name, and the web address you'd like. Your team will use that address to reach your centre.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByLabel("Email")); await h.wait(500); await h.point(h.page.getByLabel("Centre name")); await h.wait(500); await h.point(h.page.getByLabel("Your web address")); } },
    { say: "We send a link to confirm your email. Click it, choose a four-digit PIN for signing in on new devices, and you land straight in the setup wizard.",
      do: async (h) => { await h.point(h.page.getByRole("button", { name: "Start my free month" })); } },

    { chapter: "Why setup matters", say: "Here's the wizard, for our made-up centre, Harbour Watersports. Setting up is the part that takes time. Allow twenty to thirty minutes.",
      do: async (h) => { await h.goto("/office/onboarding"); await h.highlight(h.page.getByText("Setting up is the part that takes time").locator("xpath=..")); } },
    { say: "It's an investment. Once every course is set up, and every instructor is marked with what they can teach, Auto-roster fills your week in seconds.",
      do: async (h) => { await h.wait(600); await h.unhighlight(); await h.point(h.page.getByText("Finish", { exact: true })); } },

    { chapter: "How you run", say: "Step one: how you run. Rostering is always on. The extras, like equipment, locations and payroll, are optional, and you can switch them on later.",
      do: async (h) => { await h.unhighlight(); await h.highlight(h.page.getByRole("heading", { name: "What do you want to manage?" }).locator("xpath=..")); } },
    { say: "Next, how your sessions run. Morning, afternoon and evening slots are the quickest, and you can change this later.",
      do: async (h) => { await h.unhighlight(); await h.scrollTo(h.page.getByRole("heading", { name: "How do your sessions run?" })); await h.highlight(h.page.getByRole("button", { name: /Morning \/ afternoon \/ evening/ })); } },
    { say: "Do your staff sign up? We recommend yes: each instructor marks when they're free, and adds their own licences, in the app.",
      do: async (h) => { await h.highlight(h.page.getByRole("button", { name: /Yes, they use the app/ })); } },
    { say: "And how far ahead they can set availability. Four weeks suits most centres.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: "4 weeks", exact: true })); } },
    { say: "Continue.",
      do: async (h) => { await h.click(h.page.getByRole("button", { name: /^Continue →/ })); await h.wait(900); } },

    { chapter: "Courses", say: "Step two: courses. Tick every course you will ever run, across the whole year, not just this month's.",
      do: async (h) => { await h.highlight(h.page.getByRole("heading", { name: "Which courses do you run?" }).locator("xpath=../..").locator("p")); } },
    { say: "Each one comes with its staffing and ratios already set. A course you leave out can't go on the calendar until it's added, so if in doubt, leave it ticked.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.getByRole("button", { name: /Youth Stage 1$/ })); } },
    { say: "Anything not listed, like a club night or a schools programme, add it yourself here.",
      do: async (h) => { await h.scrollTo(h.page.getByText("Add your own course")); await h.highlight(h.page.getByText("Add your own course").locator("xpath=..")); } },
    { say: "Then continue.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: /Continue with \d+/ })); await h.wait(900); } },

    { chapter: "Your team", say: "Step three, your team. This is the step that saves you the most time later.",
      do: async (h) => { await h.highlight(h.page.getByText("This step saves you the most time later.").locator("xpath=..")); } },
    { say: "Type each person's name, and their email if you'd like them to use the app.",
      do: async (h) => { await h.unhighlight(); await h.type(h.page.getByPlaceholder("Full name"), "Jack Brown"); await h.type(h.page.getByPlaceholder("Email (to send an invite)"), "jack@harbour.example", 35); } },
    { say: "Then tick every instructor type they hold. The courses they can teach follow from their types, and that's what Auto-roster uses.",
      do: async (h) => { await h.click(h.page.getByLabel(/^Dinghy Instructor/)); await h.wait(300); await h.click(h.page.getByLabel(/^Safety Boat Certificate/)); } },
    { say: "Leave the invite box ticked, and press Add to team. Do the same for everyone, or import a spreadsheet if you have more than a handful.",
      do: async (h) => { await h.click(h.page.getByRole("button", { name: "+ Add to team" })); await h.wait(1500); await h.highlight(h.page.getByText("Jack Brown").last().locator("xpath=ancestor::li[1]")); } },
    { say: "Continue.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: /^Continue →/ })); await h.wait(900); } },

    { chapter: "The invite", say: "Step four. Invites come from ActivityRoster, not from you, so they're easy to miss. Copy this message into your team chat, so everyone knows it's coming.",
      do: async (h) => { await h.highlight(h.page.locator("textarea")); } },
    { say: "It tells them to check their spam folder, gives a date to finish by, and your centre code, in case an invite goes astray.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: "Copy message" })); await h.wait(600); await h.click(h.page.getByRole("button", { name: /^Continue →/ })); await h.wait(900); } },

    { chapter: "The last steps", say: "Next, you can track each new instructor's onboarding with a checklist, or say no thanks.",
      do: async (h) => { await h.highlight(h.page.getByRole("heading", { name: /Track each new instructor/ }).locator("xpath=..")); } },
    { say: "Then the roster PDF. Keep the defaults, or upload a copy of the roster you use today, and we'll shape yours to look the same.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: /^Continue →/ })); await h.wait(1500); await h.point(h.page.getByRole("button", { name: "Upload my roster" })); } },
    { say: "And you're done with the essentials.", pause: 0.8, thumb: true,
      do: async (h) => { await h.click(h.page.getByRole("button", { name: /Keep the defaults/ })); await h.wait(1200); await h.page.mouse.move(1380, 790); } },
    { say: "Next, put your courses on the calendar: connect your booking system, import a spreadsheet, or add them by hand. That's the fourth video.", pause: 0.8,
      do: async (h) => { await h.highlight(h.page.getByText("Next: put your courses on the calendar").locator("xpath=..")); } },
    { say: "Your dashboard has a checklist for everything else. Next, we'll look at adding the rest of your team, and their instructor types.", pause: 1.0,
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: /Go to my dashboard/ })); await h.wait(1800); await h.highlight(h.page.getByRole("heading", { name: "Getting started" }).locator("xpath=ancestor::div[contains(@class,'rounded')][1]")); } },
  ],
};
