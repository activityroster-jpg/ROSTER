/**
 * Video 2: Adding your team and their instructor types. Lakeside Sailing
 * Centre (videos/seed.test.ts): the Instructors list, quick add, a profile's
 * instructor types and licences, and Course setup's "who can teach it".
 */
export default {
  who: "sam@demo.example",
  warm: ["/office/staff", "/office/course-setup"],
  start: "/office/staff",
  description: `How to add your team to ActivityRoster and record each person's RYA instructor types: quick add with an invite, importing a spreadsheet, ticking instructor types on a profile, licences and expiry dates, and how Course setup lets your centre choose exactly who can teach each course.`,
  tags: ["RYA instructor types", "instructor qualifications", "staff records sailing centre", "licence expiry tracking", "instructor import"],
  steps: [
    { chapter: "The Instructors page", say: "This is the Instructors page, at our made-up centre, Lakeside Sailing Centre. Everyone on your team is listed here.",
      do: async (h) => { await h.point("h1"); } },
    { say: "At a glance you can see who has set their availability, and whose licences need updating. Anyone who hasn't, you can remind with one click.",
      do: async (h) => { await h.highlight(h.page.getByRole("columnheader", { name: /Has set availability/i }).or(h.page.getByText("Has set availability", { exact: false }))); await h.wait(900); await h.highlight(h.page.getByRole("button", { name: /Everyone who hasn.t set availability/ })); } },

    { chapter: "Adding someone", say: "To add someone, type their name and email in Quick add. Leave Send the invite ticked, and press Add.",
      do: async (h) => { await h.unhighlight(); await h.type(h.page.getByLabel("Name"), "Anna Smith"); await h.type(h.page.getByLabel("Email"), "anna.smith@lakeside.example", 30); await h.point(h.page.getByRole("button", { name: "Add", exact: true })); } },
    { say: "They get an email to set up their account. They fill in their own phone number, date of birth, and licences, so you don't have to.",
      do: async (h) => { await h.click(h.page.getByRole("button", { name: "Add", exact: true })); await h.wait(1500); } },
    { say: "Paste a list adds several people at once. And for a big team, Import from spreadsheet takes your existing staff list in one go.",
      do: async (h) => { await h.point(h.page.getByRole("button", { name: "Paste a list" })); await h.wait(700); await h.highlight(h.page.getByRole("link", { name: "Import from spreadsheet" }).or(h.page.getByRole("button", { name: "Import from spreadsheet" }))); } },

    { chapter: "Instructor types", say: "Now the most important part. Open someone's profile. Here's Jack.",
      do: async (h) => { await h.unhighlight(); await h.scrollTo(h.page.getByText("Jack Brown", { exact: true })); await h.click(h.page.getByText("Jack Brown", { exact: true })); await h.page.waitForURL(/\/office\/staff\/[^/]+$/); await h.wait(1200); } },
    { say: "Instructor types and courses they can teach. Tick every instructor type Jack holds. He's a Dinghy Instructor, with his Powerboat Level 2.",
      do: async (h) => { await h.scrollTo(h.page.getByRole("heading", { name: /Instructor types & courses/ })); await h.highlight(h.page.getByRole("heading", { name: /Instructor types & courses/ }).locator("xpath=..")); } },
    { say: "Let's add his Safety Boat Certificate.",
      do: async (h) => { await h.unhighlight(); await h.scrollTo(h.page.getByLabel(/^Safety Boat Certificate/)); await h.click(h.page.getByLabel(/^Safety Boat Certificate/)); } },
    { say: "The courses he can teach follow from his types, and they're listed underneath. Auto-roster only ever puts Jack on these courses.",
      do: async (h) => { await h.scrollTo(h.page.getByText(/Courses Jack can teach/i)); await h.highlight(h.page.getByText(/Courses Jack can teach/i).locator("xpath=..")); } },
    { say: "Some courses need the Principal's approval for a Dinghy Instructor, like Day Sailing. Tick the ones Jack is approved for.",
      do: async (h) => { await h.highlight(h.page.getByText("Principal’s approval").or(h.page.getByText("Principal's approval")).first().locator("xpath=..")); } },
    { say: "Then save.",
      do: async (h) => { await h.unhighlight(); await h.click(h.page.getByRole("button", { name: "Save instructor types" })); await h.wait(1500); } },

    { chapter: "Licences", say: "Each ticked type gets a licence record, at the top of the profile.",
      do: async (h) => { await h.scrollTop(); await h.highlight(h.page.getByRole("heading", { name: /Licences & documents/ }).locator("xpath=..")); } },
    { say: "Add the expiry date, and upload a copy. Jack can do this himself in the app. With an expiry date recorded, you're warned before a licence lapses.",
      do: async (h) => { await h.unhighlight(); await h.point(h.page.locator('input[type="date"]')); await h.wait(700); await h.point(h.page.getByRole("button", { name: "Upload" })); } },

    { chapter: "Who can teach each course", say: "Which types can teach which course is set once, in Course setup. Every RYA course comes filled in.",
      do: async (h) => { await h.goto("/office/course-setup"); await h.highlight(h.page.getByRole("columnheader", { name: /Who can teach it/i }).or(h.page.getByText("Who can teach it"))); } },
    { say: "Basic Skills, for example, can be taught by a Dinghy Instructor, an Advanced Dinghy Instructor, or a Senior Instructor.",
      do: async (h) => { await h.highlight(h.page.locator("tr").filter({ has: h.page.locator('input[value="Basic Skills (Level 2)"]') })); } },
    { say: "But it's your centre's choice. Press edit, and tick or untick any instructor type, course by course.", thumb: true,
      do: async (h) => { await h.unhighlight(); const row = h.page.locator("tr").filter({ has: h.page.locator('input[value="Basic Skills (Level 2)"]') }); await h.click(row.locator("button[aria-expanded]").first()); await h.wait(900); await h.highlight(h.page.getByRole("button", { name: "Save who can teach it" }).locator("xpath=ancestor::td[1]")); } },
    { say: "You decide exactly who can teach each type of course, and Auto-roster follows your rules.",
      do: async (h) => { await h.point(h.page.getByRole("button", { name: "Save who can teach it" })); await h.wait(1200); await h.unhighlight(); await h.click(h.page.getByRole("button", { name: "Cancel" }).first()); } },
    { say: "You can set each course's capacity and ratio here too. A course you no longer run is retired, so old records still show it.", pause: 0.8,
      do: async (h) => {
        const row = h.page.locator("tr").filter({ has: h.page.locator('input[value="Basic Skills (Level 2)"]') });
        await h.point(row.getByLabel("Capacity", { exact: true })); await h.highlight(row.getByLabel("Capacity", { exact: true }).locator("xpath=ancestor::td[1]")); await h.wait(1800);
        await h.point(row.getByLabel("Students per instructor")); await h.highlight(row.getByLabel("Students per instructor").locator("xpath=ancestor::td[1]")); await h.wait(1800);
        await h.unhighlight(); await h.point(row.getByRole("button", { name: "Delete" })); await h.wait(900); await h.page.mouse.move(1380, 790);
      } },
    { say: "That's your team set up. Next, inviting them to the app, so they keep their own availability and licences up to date.", pause: 1.0,
      do: async (h) => { await h.goto("/office/staff"); await h.wait(600); await h.highlight(h.page.getByText("Anna Smith", { exact: true }).first()); await h.wait(1800); await h.point(h.page.getByRole("button", { name: /Everyone who hasn.t set availability/ })); } },
  ],
};
