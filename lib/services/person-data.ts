import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext, TenantContext } from "@/lib/tenant/context";
import { actorUserId } from "@/lib/tenant/context";
import {
  availability as availabilityTable,
  complianceItem as complianceItemTable,
  courseStaff as courseStaffTable,
  hoursRecord as hoursRecordTable,
  leaveRequest as leaveRequestTable,
  notification as notificationTable,
  payRate as payRateTable,
  qualification as qualificationTable,
  timeEntry as timeEntryTable,
} from "@/lib/db/schema";
import type { Instructor } from "@/lib/db/schema";
import { readProtectedContacts } from "./protected-contacts";
import { writeAudit } from "./audit";
import { deleteDocument } from "@/lib/r2";

/**
 * Per-person data rights (compliance P1-A): export, restrict, anonymise, and
 * a deletion log that can be replayed after a database restore so nobody who
 * asked to be forgotten comes back.
 */

export interface PersonExport {
  exportedAt: string;
  person: Record<string, unknown>;
  contacts: Record<string, string> | null;
  qualifications: Record<string, unknown>[];
  checks: Record<string, unknown>[];
  assignments: Record<string, unknown>[];
  availability: Record<string, unknown>[];
  hours: Record<string, unknown>[];
  clock: Record<string, unknown>[];
  leave: Record<string, unknown>[];
  payRates: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  changeLog: Record<string, unknown>[];
  signIns: Record<string, unknown>[];
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v);
const plain = (row: Record<string, unknown>, drop: string[] = []): Record<string, unknown> =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !drop.includes(k) && k !== "organisationId").map(([k, v]) => [k, iso(v)]));

/** Everything the centre holds about one person, as plain JSON. Audited. */
export async function exportPerson(repos: Repositories, ctx: TenantContext, instructorId: string): Promise<PersonExport | null> {
  const t = repos.tenant;
  const instructor = await t.instructor.findById(ctx, instructorId);
  if (!instructor) return null;
  const by = (col: { instructorId: unknown }) => eq(col.instructorId as never, instructorId);
  const [quals, checks, staff, avail, hours, clock, leave, rates, notes, audit, courses, qualTypes, checkTypes, roles] = await Promise.all([
    t.qualification.list(ctx, by(qualificationTable)),
    t.complianceItem.list(ctx, by(complianceItemTable)),
    t.courseStaff.list(ctx, by(courseStaffTable)),
    t.availability.list(ctx, by(availabilityTable)),
    t.hoursRecord.list(ctx, by(hoursRecordTable)),
    t.timeEntry.list(ctx, by(timeEntryTable)),
    t.leaveRequest.list(ctx, by(leaveRequestTable)),
    t.payRate.list(ctx, by(payRateTable)),
    t.notification.list(ctx, by(notificationTable)),
    t.auditLog.list(ctx),
    t.course.list(ctx),
    t.qualificationType.list(ctx),
    t.complianceType.list(ctx),
    t.roleType.list(ctx),
  ]);
  const courseName = new Map(courses.map((c) => [c.id, c.name]));
  const qt = new Map(qualTypes.map((q) => [q.id, q.name]));
  const ct = new Map(checkTypes.map((c) => [c.id, c.name]));
  const rn = new Map(roles.map((r) => [r.id, r.name]));
  const contacts = instructor.anonymisedAt ? null : (await readProtectedContacts(repos, ctx, instructor)) as unknown as Record<string, string>;
  const signIns = instructor.userId ? (await repos.control.listSecurityEvents(instructor.userId, 200)).map((e) => plain(e as unknown as Record<string, unknown>, ["id", "userId", "meta"])) : [];
  const mentions = audit.filter((a) => a.entityId === instructorId || (a.after ?? "").includes(instructorId) || a.actorUserId === instructor.userId);
  const out: PersonExport = {
    exportedAt: new Date().toISOString(),
    person: plain(instructor as unknown as Record<string, unknown>, ["guardianName", "guardianPhone", "guardianEmail", "emergencyName", "emergencyPhone", "emergencyRelationship"]),
    contacts,
    qualifications: quals.map((q) => ({ ...plain(q as unknown as Record<string, unknown>, ["instructorId"]), type: qt.get(q.qualificationTypeId) ?? q.qualificationTypeId, document: q.docKey ? "on file" : "none" })),
    checks: checks.map((c) => ({ ...plain(c as unknown as Record<string, unknown>, ["instructorId", "docKey"]), type: ct.get(c.complianceTypeId) ?? c.complianceTypeId, document: c.docKey ? "on file" : "none" })),
    assignments: staff.map((s) => ({ ...plain(s as unknown as Record<string, unknown>, ["instructorId"]), course: courseName.get(s.courseId) ?? s.courseId, role: rn.get(s.roleTypeId) ?? s.roleTypeId })),
    availability: avail.map((a) => plain(a as unknown as Record<string, unknown>, ["instructorId"])),
    hours: hours.map((h) => plain(h as unknown as Record<string, unknown>, ["instructorId"])),
    clock: clock.map((c) => plain(c as unknown as Record<string, unknown>, ["instructorId"])),
    leave: leave.map((l) => plain(l as unknown as Record<string, unknown>, ["instructorId"])),
    payRates: rates.map((r) => ({ ...plain(r as unknown as Record<string, unknown>, ["instructorId"]), role: r.roleTypeId ? rn.get(r.roleTypeId) ?? r.roleTypeId : "any" })),
    notifications: notes.map((n) => plain(n as unknown as Record<string, unknown>, ["instructorId", "userId"])),
    changeLog: mentions.map((a) => plain(a as unknown as Record<string, unknown>)),
    signIns,
  };
  await writeAudit(repos, ctx, { action: "export_person", entity: "instructor", entityId: instructorId, after: { sections: Object.keys(out).length } });
  return out;
}

/** The same export as CSV: one block per section, a blank line between. */
export function personExportToCsv(data: PersonExport): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const block = (title: string, rows: Record<string, unknown>[]): string => {
    if (rows.length === 0) return `# ${title}\n(none)\n`;
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    return `# ${title}\n${cols.join(",")}\n${rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n")}\n`;
  };
  const sections: [string, Record<string, unknown>[]][] = [
    ["Person", [data.person]],
    ["Guardian and emergency contacts", data.contacts ? [data.contacts] : []],
    ["Qualifications", data.qualifications], ["Checks", data.checks], ["Assignments", data.assignments],
    ["Availability", data.availability], ["Hours", data.hours], ["Clock", data.clock], ["Leave", data.leave],
    ["Pay rates", data.payRates], ["Notifications", data.notifications], ["Change log", data.changeLog], ["Sign-ins", data.signIns],
  ];
  return `Exported ${data.exportedAt}\n\n${sections.map(([t, r]) => block(t, r)).join("\n")}`;
}

/** Restrict (or lift the restriction on) processing: kept, but not rostered or contacted. */
export async function setRestriction(repos: Repositories, ctx: TenantContext, instructorId: string, restricted: boolean, reason: string | null): Promise<Instructor | null> {
  const row = await repos.tenant.instructor.update(ctx, instructorId, restricted ? { restrictedAt: new Date(), restrictedReason: reason } : { restrictedAt: null, restrictedReason: null });
  if (row) await writeAudit(repos, ctx, { action: restricted ? "restrict_instructor" : "unrestrict_instructor", entity: "instructor", entityId: instructorId, after: { reason } });
  return row;
}

export const isRestricted = (i: Pick<Instructor, "restrictedAt"> | null | undefined): boolean => Boolean(i?.restrictedAt);

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A one-way fingerprint of who someone was, so a replay after a restore can find them again without storing their details. */
export async function identityHash(i: Pick<Instructor, "id" | "name" | "email">): Promise<string> {
  return sha256(`${i.id}|${(i.email ?? "").trim().toLowerCase()}|${i.name.trim().toLowerCase()}`);
}

export type AnonymiseResult = { ok: true; removed: Record<string, number> } | { ok: false; reason: string };

/**
 * Anonymise one person: identifying fields go, certificates and checks (and
 * their files) are deleted, their availability, leave, notifications and pay
 * rates are deleted, and their login is removed. Roster and payroll history
 * stays, attached to "Former staff member". Writes a deletion-log row unless
 * this is a replay.
 */
export async function anonymisePerson(repos: Repositories, ctx: AnyTenantContext, instructorId: string, opts: { replay?: boolean } = {}): Promise<AnonymiseResult> {
  const t = repos.tenant;
  const instructor = await t.instructor.findById(ctx, instructorId);
  if (!instructor) return { ok: false, reason: "Not found" };
  if (instructor.anonymisedAt && !opts.replay) return { ok: false, reason: "Already anonymised" };
  const by = (col: { instructorId: unknown }) => eq(col.instructorId as never, instructorId);
  const hash = await identityHash(instructor);
  const removed: Record<string, number> = {};

  const [quals, checks] = await Promise.all([t.qualification.list(ctx, by(qualificationTable)), t.complianceItem.list(ctx, by(complianceItemTable))]);
  for (const q of quals) { if (q.docKey) await deleteDocument(ctx, q.docKey).catch(() => {}); await t.qualification.delete(ctx, q.id); }
  for (const c of checks) { if (c.docKey) await deleteDocument(ctx, c.docKey).catch(() => {}); await t.complianceItem.delete(ctx, c.id); }
  removed.qualifications = quals.length; removed.checks = checks.length;
  for (const [name, repo, table] of [["availability", t.availability, availabilityTable], ["leave", t.leaveRequest, leaveRequestTable], ["notifications", t.notification, notificationTable], ["payRates", t.payRate, payRateTable]] as const) {
    const rows = await repo.list(ctx, by(table));
    for (const r of rows) await repo.delete(ctx, r.id);
    removed[name] = rows.length;
  }

  // Login: membership in this centre goes; the account itself only if nothing else uses it.
  if (instructor.userId) {
    await repos.control.deleteMembership(instructor.userId, ctx.organisationId);
    removed.account = (await repos.control.deleteOrphanUser(instructor.userId)) ? 1 : 0;
  }

  await t.instructor.update(ctx, instructorId, {
    name: "Former staff member", email: null, phone: null, dateOfBirth: null,
    guardianName: null, guardianPhone: null, guardianEmail: null,
    emergencyName: null, emergencyPhone: null, emergencyRelationship: null,
    notifyEmail: false, status: "inactive", userId: null, restrictedAt: null, restrictedReason: null,
    anonymisedAt: new Date(),
  });

  if (!opts.replay) {
    await t.deletionLog.insert(ctx, { subjectKind: "instructor", subjectId: instructorId, subjectHash: hash, summary: JSON.stringify(removed), actorUserId: actorUserId(ctx) });
    await writeAudit(repos, ctx, { action: "anonymise_instructor", entity: "instructor", entityId: instructorId, after: removed });
  }
  return { ok: true, removed };
}

/**
 * After a database restore, remove again anyone in the deletion log who has
 * come back with their details. Safe to run any time: people already
 * anonymised are skipped.
 */
export async function replayDeletions(repos: Repositories, ctx: AnyTenantContext): Promise<{ checked: number; reapplied: number }> {
  const log = await repos.tenant.deletionLog.list(ctx);
  let reapplied = 0;
  for (const entry of log) {
    if (entry.subjectKind !== "instructor") continue;
    const i = await repos.tenant.instructor.findById(ctx, entry.subjectId);
    if (!i || i.anonymisedAt) continue;
    const res = await anonymisePerson(repos, ctx, entry.subjectId, { replay: true });
    if (res.ok) reapplied++;
  }
  // Retention deletions are re-applied by running the sweep again with the same policy; it is idempotent.
  const settings = (await repos.tenant.orgSettings.list(ctx))[0];
  const { runRetention } = await import("./retention");
  const removed = await runRetention(repos, ctx, settings, new Date());
  const retentionRows = Object.values(removed).reduce((a, b) => a + b, 0);
  if (reapplied || retentionRows) await writeAudit(repos, ctx, { action: "replay_deletions", entity: "instructor", after: { checked: log.length, reapplied, retentionRows } });
  return { checked: log.length, reapplied };
}

/** CSV of the centre's change log between two dates (inclusive), newest first. Audited. */
export async function auditLogCsv(repos: Repositories, ctx: TenantContext, from: string, to: string): Promise<string> {
  const rows = (await repos.tenant.auditLog.list(ctx))
    .filter((a) => { const d = a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : ""; return d >= from && d <= to; })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  const esc = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["When (UTC)", "Actor user id", "Action", "Entity", "Entity id", "Details"];
  const body = rows.map((a) => [a.createdAt ? new Date(a.createdAt).toISOString() : "", a.actorUserId ?? "", a.action, a.entity, a.entityId ?? "", a.after ?? ""].map(esc).join(","));
  await writeAudit(repos, ctx, { action: "export_audit_log", entity: "org_settings", after: { from, to, rows: rows.length } });
  return [head.join(","), ...body].join("\n") + "\n";
}
