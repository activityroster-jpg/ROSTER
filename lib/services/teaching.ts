import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import type { CourseAudience } from "@/lib/db/schema";

export interface TeachableCourse {
  courseTypeId: string;
  name: string;
  audience: CourseAudience;
  category: string | null;
  /** true when a course-type staffing rule matched; false when inferred by discipline. */
  explicit: boolean;
}

export interface InstructorTeaching {
  instructorId: string;
  courses: TeachableCourse[];
}

/** Map an RYA scheme name to the qualification discipline that covers it. */
function schemeDiscipline(scheme: string | null): string | null {
  const s = (scheme ?? "").toLowerCase();
  if (s.includes("windsurf")) return "windsurf";
  if (s.includes("paddleboard") || s.includes("sup")) return "sup";
  if (s.includes("powerboat")) return "powerboat";
  if (s.includes("keelboat")) return "keelboat";
  if (s.includes("cruising")) return "cruising";
  if (s.includes("shorebased")) return "shorebased";
  if (s.includes("sailability")) return "dinghy";
  if (s.includes("sailing") || s.includes("onboard")) return "dinghy";
  return null;
}

/**
 * Work out which course types each instructor is approved to teach. Where the
 * centre has defined explicit staffing rules for a course type
 * (course_type_staffing), an instructor must hold every required qualification;
 * otherwise we infer from the scheme's discipline against the grades they hold.
 * Pure data assembly over tenant-scoped reads.
 */
export async function getTeachingMatrix(
  repos: Repositories,
  ctx: AnyTenantContext,
): Promise<Map<string, TeachableCourse[]>> {
  const t = repos.tenant;
  const [instructors, quals, qualTypes, courseTypes, staffingRules] = await Promise.all([
    t.instructor.list(ctx),
    t.qualification.list(ctx),
    t.qualificationType.list(ctx),
    t.courseType.list(ctx),
    t.courseTypeStaffing.list(ctx),
  ]);

  const disciplineByQualType = new Map(qualTypes.map((q) => [q.id, q.discipline ?? null]));

  // Per instructor: qualification-type ids held + disciplines held.
  const heldTypes = new Map<string, Set<string>>();
  const heldDisc = new Map<string, Set<string>>();
  for (const q of quals) {
    const types = heldTypes.get(q.instructorId) ?? new Set<string>();
    types.add(q.qualificationTypeId);
    heldTypes.set(q.instructorId, types);
    const disc = disciplineByQualType.get(q.qualificationTypeId);
    if (disc) {
      const ds = heldDisc.get(q.instructorId) ?? new Set<string>();
      ds.add(disc);
      heldDisc.set(q.instructorId, ds);
    }
  }

  // Required qualification-type ids per course type (explicit rules).
  const requiredByType = new Map<string, string[]>();
  for (const r of staffingRules) {
    requiredByType.set(r.courseTypeId, [...(requiredByType.get(r.courseTypeId) ?? []), r.qualificationTypeId]);
  }

  const activeTypes = courseTypes.filter((c) => c.active);
  const out = new Map<string, TeachableCourse[]>();

  for (const ins of instructors) {
    const types = heldTypes.get(ins.id) ?? new Set<string>();
    const disc = heldDisc.get(ins.id) ?? new Set<string>();
    const teachable: TeachableCourse[] = [];

    for (const ct of activeTypes) {
      const required = requiredByType.get(ct.id);
      let can = false;
      let explicit = false;
      if (required && required.length > 0) {
        explicit = true;
        can = required.every((qid) => types.has(qid));
      } else {
        const d = schemeDiscipline(ct.scheme);
        can = d ? disc.has(d) : false;
      }
      if (can) {
        teachable.push({ courseTypeId: ct.id, name: ct.name, audience: ct.audience, category: ct.category ?? null, explicit });
      }
    }
    out.set(ins.id, teachable);
  }

  return out;
}
