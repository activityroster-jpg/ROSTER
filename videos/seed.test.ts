/**
 * Videos and screenshots: a made-up busy centre ("Lakeside Sailing
 * Centre", slug demo) and a brand-new one ("Harbour Watersports", slug
 * newcentre), written into the local D1 file given by SEED_DB. Dates follow
 * the current week, so the demo always shows this week and next. Every
 * person, phone number and course is invented. Never touches a real database.
 */
import { test } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { schema, account, user, organisation } from "@/lib/db/schema";
import { createRepositories } from "@/lib/db/repositories";
import { seedOrganisationDefaults } from "@/lib/seed/seed";
import { hashPin } from "@/lib/auth/pin";
import { syncHoursForCourse } from "@/lib/services/hours";
import type { Database as Db } from "@/lib/db/client";
import type { SystemTenantContext } from "@/lib/tenant/context";

const PASSWORD = "Manual-Shots-2027!";
const PIN = "4826";
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monday = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
const THIS_MON = monday(new Date());
const NEXT_MON = addDays(THIS_MON, 7);
const SLOT_TIMES: Record<string, [string, string]> = { AM: ["09:00", "12:30"], PM: ["13:00", "16:30"], EV: ["17:30", "20:30"] };

test("seed the video centres", async () => {
  const raw = new Database(process.env.SEED_DB!);
  raw.pragma("foreign_keys = ON");
  const db = drizzle(raw, { schema }) as unknown as Db;
  const repos = createRepositories(db);
  const t = repos.tenant;
  const hash = await hashPassword(PASSWORD);
  const pin = await hashPin(PIN);

  const login = async (orgId: string, name: string, email: string, role: "owner" | "admin" | "instructor") => {
    const u = await repos.control.createUser({ name, email });
    await db.update(user).set({ emailVerified: true, pinHash: pin } as never).where(eq(user.id, u.id));
    await db.insert(account).values({ accountId: u.id, providerId: "credential", userId: u.id, password: hash });
    await repos.control.createMembership({ userId: u.id, organisationId: orgId, role }, "active");
    return u.id;
  };

  // ── A brand-new centre, for the setup wizard ──
  const fresh = await repos.control.createOrganisation({ name: "Harbour Watersports", slug: "newcentre", jurisdiction: "northern_ireland", plan: "rostering", status: "active", subscriptionStatus: "trialing", tier: "standard" } as never);
  const freshCtx: SystemTenantContext = { organisationId: fresh.id, slug: fresh.slug, system: true, reason: "manual seed" };
  await seedOrganisationDefaults(t, freshCtx, "northern_ireland");
  await login(fresh.id, "Jo Harbour", "jo@newcentre.example", "owner");

  // ── The busy centre ──
  const org = await repos.control.createOrganisation({ name: "Lakeside Sailing Centre", slug: "demo", jurisdiction: "northern_ireland", plan: "rostering", status: "active", subscriptionStatus: "trialing", tier: "standard" } as never);
  await db.update(organisation).set({ createdAt: new Date(`${addDays(THIS_MON, -10)}T09:00:00Z`) } as never).where(eq(organisation.id, org.id));
  const ctx: SystemTenantContext = { organisationId: org.id, slug: org.slug, system: true, reason: "manual seed" };
  await seedOrganisationDefaults(t, ctx, "northern_ireland");
  const settings = (await t.orgSettings.list(ctx))[0]!;
  await t.orgSettings.update(ctx, settings.id, { timeclockEnabled: true, enabledFeatures: JSON.stringify(["equipment", "locations", "payroll", "documents"]) } as never);
  await login(org.id, "Sam Rivers", "sam@demo.example", "owner");

  const types = await t.qualificationType.list(ctx);
  const q = (code: string) => types.find((x) => x.code === code)!;
  const roles = await t.roleType.list(ctx);
  const roleFor = (code: string) => roles.find((r) => r.qualificationTypeId === q(code).id) ?? roles.find((r) => r.active)!;

  const people: { name: string; codes: string[]; email?: string; app?: boolean; dob?: string; employment?: string; expiry?: string | null }[] = [
    { name: "Kim Taylor", codes: ["SI", "DI", "PBI", "SBC"], email: "kim@demo.example", app: true, expiry: addDays(THIS_MON, 180) },
    { name: "Anna Moore", codes: ["DI", "SBC"], email: "anna@demo.example", app: true, expiry: addDays(THIS_MON, 227) },
    { name: "Jack Brown", codes: ["DI", "PB2"], email: "jack@demo.example", app: true, expiry: null },
    { name: "Emma Hall", codes: ["SI", "DI", "SBC"], email: "emma@demo.example", app: true, expiry: addDays(THIS_MON, 21) },
    { name: "Ryan Clarke", codes: ["PBI", "SBC", "PB2"], email: "ryan@demo.example", app: true, expiry: addDays(THIS_MON, 274) },
    { name: "Grace Wilson", codes: ["DI", "WI"], email: "grace@demo.example", app: true, expiry: addDays(THIS_MON, 321) },
    { name: "Tom Hughes", codes: ["AI"], email: "tom@demo.example", app: true, dob: addDays(THIS_MON, -16 * 365 - 40), expiry: null },
    { name: "Lucy Green", codes: ["AI", "SBC"], email: "lucy@demo.example", app: true, dob: addDays(THIS_MON, -16 * 365 + 90), expiry: null },
    { name: "Dan Ward", codes: ["DI", "SBC"], email: "dan@demo.example", app: false, employment: "freelance", expiry: addDays(THIS_MON, 368) },
    { name: "Sophie Barr", codes: ["WI", "SUPI"], email: "sophie@demo.example", app: true, employment: "freelance", expiry: addDays(THIS_MON, 415) },
    { name: "Mark Patterson", codes: ["APBI", "PBI", "SBC"], email: "mark@demo.example", app: false, employment: "freelance", expiry: addDays(THIS_MON, 462) },
    { name: "Olivia Dean", codes: ["DI"], email: "olivia@demo.example", app: true, expiry: addDays(THIS_MON, 509) },
  ];
  const ins: Record<string, string> = {};
  for (const p of people) {
    const userId = p.app ? await login(org.id, p.name, p.email!, "instructor") : null;
    const row = await t.instructor.insert(ctx, { name: p.name, email: p.email ?? null, phone: "07700 900" + String(100 + Object.keys(ins).length * 7).slice(-3), employmentType: (p.employment ?? "employed") as never, status: "active", userId, dateOfBirth: p.dob ?? null } as never);
    ins[p.name] = row.id;
    for (const code of p.codes) {
      await t.qualification.insert(ctx, { instructorId: row.id, qualificationTypeId: q(code).id, certNo: `RYA-${100000 + Object.keys(ins).length * 7919 + code.length * 131}`, issueDate: "2024-03-01", expiryDate: code === p.codes[0] ? p.expiry ?? null : null, verified: true });
    }
  }
  // One join request waiting, one person added with no account (office-run)
  const padraig = await t.instructor.insert(ctx, { name: "Peter Lynch", email: null, employmentType: "volunteer", status: "active", managedBy: "office" } as never);
  await t.qualification.insert(ctx, { instructorId: padraig.id, qualificationTypeId: q("AI").id, certNo: null, issueDate: null, expiryDate: null, verified: false });

  // Locations and kit
  const area = await t.locationType.insert(ctx, { name: "On the water", active: true });
  const shore = await t.locationType.insert(ctx, { name: "Ashore", active: true });
  const lough = await t.location.insert(ctx, { name: "North bay", locationTypeId: area.id, active: true });
  await t.location.insert(ctx, { name: "South bay", locationTypeId: area.id, active: true });
  const slip = await t.location.insert(ctx, { name: "Main slipway", locationTypeId: shore.id, active: true });
  await t.location.insert(ctx, { name: "Classroom", locationTypeId: shore.id, active: true });
  const pico = await t.equipmentType.insert(ctx, { name: "Pico", inventoryTracked: false, quantity: 10, active: true });
  const rib = await t.equipmentType.insert(ctx, { name: "Safety RIB", inventoryTracked: true, quantity: null, active: true });
  await t.equipment.insert(ctx, { equipmentTypeId: rib.id, name: "RIB 1", identifier: "LS-01", status: "available" });
  await t.equipment.insert(ctx, { equipmentTypeId: rib.id, name: "RIB 2", identifier: "LS-02", status: "available" });
  await t.equipment.insert(ctx, { equipmentTypeId: rib.id, name: "RIB 3", identifier: "LS-03", status: "maintenance", maintenanceNote: "Kill cord replaced, engine service due", backOn: addDays(NEXT_MON, 1) } as never);
  void pico;

  // Pay rates per place
  for (const [code, rate] of [["SI", 16.5], ["DI", 14], ["AI", 10.5], ["PBI", 15], ["WI", 13.5]] as const) {
    await t.payRate.insert(ctx, { roleTypeId: roleFor(code).id, rate, ratePence: Math.round(rate * 100), unit: "hour" } as never);
  }

  const cts = await t.courseType.list(ctx);
  const ct = (re: RegExp) => cts.find((c) => re.test(c.name)) ?? cts.find((c) => c.active)!;
  const course = async (name: string, typeRe: RegExp, days: { date: string; slots: string[] }[], staff: [string, string][]) => {
    const type = ct(typeRe);
    const c = await t.course.insert(ctx, { courseTypeId: type.id, name, capacity: type.defaultCapacity ?? 8, ratio: type.studentsPerInstructor, status: "scheduled" } as never);
    for (const d of days) for (const slot of d.slots) {
      const [a, b] = SLOT_TIMES[slot]!;
      await t.courseSession.insert(ctx, { courseId: c.id, date: d.date, slot: slot as never, startAt: new Date(`${d.date}T${a}:00Z`), endAt: new Date(`${d.date}T${b}:00Z`) });
    }
    for (const [person, code] of staff) await t.courseStaff.insert(ctx, { courseId: c.id, instructorId: ins[person]!, roleTypeId: roleFor(code).id, status: "confirmed", confirmedAt: new Date() } as never);
    await t.courseLocation.insert(ctx, { courseId: c.id, locationId: /Powerboat/.test(name) ? slip.id : lough.id });
    await syncHoursForCourse(repos, ctx, c.id);
    return c;
  };

  // This week: fully staffed, Monday to Wednesday confirmed
  await course("Powerboat Level 2", /Powerboat Level 2/, [{ date: THIS_MON, slots: ["AM", "PM"] }, { date: addDays(THIS_MON, 1), slots: ["AM", "PM"] }], [["Ryan Clarke", "PBI"]]);
  await course("Wednesday Club Night", /Club|Improving|Stage 3/, [{ date: addDays(THIS_MON, 2), slots: ["EV"] }], [["Emma Hall", "SI"], ["Anna Moore", "DI"], ["Lucy Green", "AI"]]);
  await course("After-school Stage 1", /Stage 1/, [{ date: addDays(THIS_MON, 3), slots: ["PM"] }], [["Olivia Dean", "DI"], ["Tom Hughes", "AI"]]);
  await course("Adult Start Sailing (weekend)", /Start Sailing/, [{ date: addDays(THIS_MON, 5), slots: ["AM", "PM"] }, { date: addDays(THIS_MON, 6), slots: ["AM", "PM"] }], [["Kim Taylor", "SI"], ["Jack Brown", "DI"]]);
  for (let i = 0; i < 3; i++) await t.rosterDay.insert(ctx, { date: addDays(THIS_MON, i), confirmedAt: new Date(), confirmedByUserId: null, snapshot: null } as never);

  // Next week: half-term camps, partly staffed (gaps for Auto-roster)
  const week = [0, 1, 2, 3, 4].map((i) => ({ date: addDays(NEXT_MON, i), slots: ["AM", "PM"] }));
  await course("Half-term Camp: Stage 1", /Stage 1/, week, [["Kim Taylor", "SI"], ["Grace Wilson", "DI"]]);
  await course("Half-term Camp: Stage 2", /Stage 2/, week.map((d) => ({ ...d, slots: ["AM"] })), [["Anna Moore", "DI"]]);
  await course("Start Windsurfing", /Windsurf/, [{ date: addDays(NEXT_MON, 3), slots: ["PM"] }], []);
  await course("Wednesday Club Night", /Club|Improving|Stage 3/, [{ date: addDays(NEXT_MON, 2), slots: ["EV"] }], [["Emma Hall", "SI"]]);
  await course("Powerboat Level 2", /Powerboat Level 2/, [{ date: addDays(NEXT_MON, 5), slots: ["AM", "PM"] }, { date: addDays(NEXT_MON, 6), slots: ["AM", "PM"] }], []);

  // Availability: a usual week for app users, with exceptions
  for (const p of people.filter((x) => x.app)) {
    for (let wd = 0; wd <= 6; wd++) for (const slot of ["AM", "PM", "EV"]) {
      await t.availability.insert(ctx, { instructorId: ins[p.name]!, weekday: wd, date: null, slot: slot as never, status: (wd === 0 || wd === 6) && p.name === "Olivia Dean" ? "busy" : "available", setBy: "self" } as never);
    }
  }
  for (const slot of ["AM", "PM"]) await t.availability.insert(ctx, { instructorId: ins["Grace Wilson"]!, date: addDays(NEXT_MON, 4), weekday: null, slot: slot as never, status: "busy", setBy: "self" } as never);

  // Leave and cover
  await t.leaveRequest.insert(ctx, { instructorId: ins["Jack Brown"]!, type: "annual", startDate: addDays(NEXT_MON, 7), endDate: addDays(NEXT_MON, 9), days: 3, reason: "Family wedding", status: "pending" } as never);
  await t.leaveRequest.insert(ctx, { instructorId: ins["Olivia Dean"]!, type: "other", startDate: addDays(NEXT_MON, 4), endDate: addDays(NEXT_MON, 4), days: 1, reason: "Exam", status: "approved" } as never);

  // Hours on the clock this week
  const sess = await t.courseSession.list(ctx);
  const monAm = sess.find((s) => s.date === THIS_MON && s.slot === "AM")!;
  await t.timeEntry.insert(ctx, { instructorId: ins["Ryan Clarke"]!, courseSessionId: monAm.id, clockInAt: new Date(`${THIS_MON}T08:52:00Z`), clockOutAt: new Date(`${THIS_MON}T12:41:00Z`), source: "clock" } as never);

  // Notifications for Kim's app
  const kimUser = (await t.instructor.findById(ctx, ins["Kim Taylor"]!))!.userId;
  await t.notification.insert(ctx, { userId: kimUser, instructorId: ins["Kim Taylor"]!, title: "Roster confirmed: this Monday", body: "Your shifts are confirmed.", channel: "in_app" } as never);
  await t.notification.insert(ctx, { userId: kimUser, instructorId: ins["Kim Taylor"]!, title: "Roster change: new shifts", body: "You're now on 10 shifts.", channel: "in_app" } as never);
  console.log("seeded", org.slug, fresh.slug);
});
