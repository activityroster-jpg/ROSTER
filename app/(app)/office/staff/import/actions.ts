"use server";

import { z } from "zod";
import { sendInvite } from "@/lib/auth/invite-link";
import { inviteDailyCap } from "@/lib/services/invite-cap";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { linkInstructorUser } from "@/lib/services/invite";
import { writeAudit } from "@/lib/services/audit";
import { EMPLOYMENT_TYPES, type EmploymentType } from "@/lib/db/schema";
import { splitList } from "@/lib/import/staff";
import { instructorCapState, capUpgradeMessage } from "@/lib/tenant/limits";

export interface ConfirmedStaff {
  name: string;
  email: string;
  phone: string;
  employment: string;
  quals: string;
  courses: string;
}

export interface StaffImportResult {
  ok: boolean;
  created: number;
  skipped: number;
  invited: number;
  qualsLinked: number;
  coursesLinked: number;
  message?: string;
  error?: string;
}

/**
 * Create instructors from reviewed spreadsheet rows. Tolerant of incomplete
 * data: rows without a name are skipped; quals and courses are matched to the
 * catalogue by name (unknowns ignored, never guessed); an invite is emailed
 * only when asked and an email is present. Tenant scoped and audited.
 */
const MAX_IMPORT_ROWS = 500;

export async function importInstructorsAction(rows: ConfirmedStaff[], opts?: { sendInvites?: boolean }): Promise<StaffImportResult> {
  const { ctx, repos, organisation } = await requireTenant({ permission: "staff.edit" });
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, created: 0, skipped: 0, invited: 0, qualsLinked: 0, coursesLinked: 0, error: "Nothing to import" };
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, created: 0, skipped: 0, invited: 0, qualsLinked: 0, coursesLinked: 0, error: `Import up to ${MAX_IMPORT_ROWS} people at a time — split a bigger spreadsheet into parts.` };

  const [qualTypes, courseTypes] = await Promise.all([
    repos.tenant.qualificationType.list(ctx),
    repos.tenant.courseType.list(ctx),
  ]);
  const qualByName = new Map(qualTypes.map((q) => [q.name.trim().toLowerCase(), q]));
  const courseByName = new Map(courseTypes.map((c) => [c.name.trim().toLowerCase(), c]));

  // Hard tier cap: fill up to the Small Club limit, then stop (volunteers
  // included). `remaining` is null when the tier is unlimited.
  let remaining = (await instructorCapState(repos, ctx, organisation)).remaining;
  let limitReached = false;

  let created = 0, skipped = 0, invited = 0, queued = 0, qualsLinked = 0, coursesLinked = 0;

  for (const raw of rows) {
    const name = (raw.name ?? "").trim();
    if (!name) { skipped++; continue; }
    if (remaining !== null && remaining <= 0) { skipped++; limitReached = true; continue; }
    const email = (raw.email ?? "").trim().toLowerCase() || null;
    const employmentType: EmploymentType = (EMPLOYMENT_TYPES as readonly string[]).includes(raw.employment)
      ? (raw.employment as EmploymentType)
      : "employed";

    const instructor = await repos.tenant.instructor.insert(ctx, {
      name,
      email,
      phone: (raw.phone ?? "").trim() || null,
      employmentType,
      status: "active",
    });
    created++;
    if (remaining !== null) remaining--;

    // Qualifications → placeholder rows for the licences we recognise.
    for (const q of splitList(raw.quals)) {
      const qt = qualByName.get(q.toLowerCase());
      if (qt) {
        await repos.tenant.qualification.insert(ctx, { instructorId: instructor.id, qualificationTypeId: qt.id, certNo: null, issueDate: null, expiryDate: null, verified: false });
        qualsLinked++;
      }
    }
    // Courses they can teach → approvals for the course types we recognise.
    for (const c of splitList(raw.courses)) {
      const ct = courseByName.get(c.toLowerCase());
      if (ct) {
        await repos.tenant.instructorCourseType.insert(ctx, { instructorId: instructor.id, courseTypeId: ct.id });
        coursesLinked++;
      }
    }

    if (opts?.sendInvites && email) {
      const linked = await linkInstructorUser(repos, ctx, instructor.id);
      if (linked.ok) {
        const res = await sendInvite(repos, ctx, { email: linked.email, userId: linked.userId, kind: "instructor", centreName: organisation.name, slug: organisation.slug, callbackPath: "/portal/welcome" });
        if (res === "sent") invited++;
        else if (res === "queued") queued++;
      }
    }
  }

  await writeAudit(repos, ctx, { action: "import_instructors", entity: "instructor", after: { created, skipped, invited, qualsLinked, coursesLinked } });
  revalidatePath("/office/staff");
  const parts = [`${created} added`];
  if (invited) parts.push(`${invited} invited`);
  if (queued) parts.push(`${queued} invite${queued === 1 ? "" : "s"} queued for tomorrow (daily limit of ${await inviteDailyCap(repos.db)})`);
  if (qualsLinked) parts.push(`${qualsLinked} licences matched`);
  if (coursesLinked) parts.push(`${coursesLinked} course approvals`);
  if (skipped) parts.push(`${skipped} skipped`);
  const message = limitReached ? `${parts.join(" · ")} — ${capUpgradeMessage(organisation)}` : parts.join(" · ");
  return { ok: true, created, skipped, invited, qualsLinked, coursesLinked, message };
}

const quickAddSchema = z.object({
  people: z.array(z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().toLowerCase().email().max(200).nullable() })).min(1).max(200),
  sendInvites: z.boolean(),
});

/**
 * Quick add and "Paste a list" (audit follow-up): just names and emails, with
 * the invite going out by default so people fill in their own details. Same
 * rules as the spreadsheet import (plan cap, audit, invite only with an email).
 */
export async function quickAddStaffAction(input: { people: { name: string; email: string | null }[]; sendInvites: boolean }): Promise<StaffImportResult> {
  const parsed = quickAddSchema.safeParse(input);
  if (!parsed.success) return { ok: false, created: 0, skipped: 0, invited: 0, qualsLinked: 0, coursesLinked: 0, error: "Check the names and email addresses" };
  return importInstructorsAction(parsed.data.people.map((p) => ({ name: p.name, email: p.email ?? "", phone: "", employment: "employed", quals: "", courses: "" })), { sendInvites: parsed.data.sendInvites });
}
