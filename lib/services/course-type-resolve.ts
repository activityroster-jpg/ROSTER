import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import type { CourseAudience } from "@/lib/db/schema";
import { suggestCourseType, TYPE_NEW, TYPE_ONEOFF } from "@/lib/domain";

export { TYPE_NEW, TYPE_ONEOFF };

type CourseTypeRow = Awaited<ReturnType<Repositories["tenant"]["courseType"]["list"]>>[number];

/** Choice strings are short ids or the two sentinels — anything else is dropped. */
export function sanitiseTypeChoices(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object") return out;
  for (const [k, c] of Object.entries(v as Record<string, unknown>).slice(0, 2000)) {
    if (typeof c === "string" && k.length <= 400 && c.length > 0 && c.length <= 64) out[k] = c;
  }
  return out;
}

/**
 * Resolves imported/manual course names to course types, so imports land under
 * the centre's existing types instead of spawning near-duplicates, and one-offs
 * stay off the regular list. Tenant scoped; caches created types per run.
 */
export async function createCourseTypeResolver(repos: Repositories, ctx: AnyTenantContext) {
  const t = repos.tenant;
  const all = await t.courseType.list(ctx);
  const byId = new Map(all.map((c) => [c.id, c]));
  const byName = new Map(all.map((c) => [c.name.trim().toLowerCase(), c]));
  const regular = () => [...byId.values()].filter((c) => c.active && c.listed);

  const create = async (name: string, audience: CourseAudience, listed: boolean): Promise<CourseTypeRow> => {
    const row = await t.courseType.insert(ctx, {
      name,
      scheme: listed ? null : "One-off",
      audience,
      defaultCapacity: 8,
      studentsPerInstructor: 4,
      requiresSafetyBoat: audience === "youth",
      active: true,
      listed,
    });
    byId.set(row.id, row);
    byName.set(name.trim().toLowerCase(), row);
    return row;
  };

  return {
    /** Listed, active types — what review dropdowns offer. */
    regular,
    suggest: (name: string) => suggestCourseType(name, regular())?.type ?? null,
    /**
     * - a type id → that type (if it's this centre's)
     * - TYPE_NEW → the type with this exact name (put on the list), else a new listed type
     * - TYPE_ONEOFF → the type with this exact name, else a new unlisted type
     * - nothing (unattended sync) → best match on the list, else exact name, else unlisted
     */
    async resolve(name: string, audience: CourseAudience, choice?: string): Promise<CourseTypeRow> {
      const clean = name.trim().slice(0, 120) || "Course";
      const exact = byName.get(clean.toLowerCase());
      if (choice && choice !== TYPE_NEW && choice !== TYPE_ONEOFF) {
        const picked = byId.get(choice);
        if (picked) return picked;
      }
      if (choice === TYPE_NEW) {
        if (exact) {
          if (!exact.listed || !exact.active) {
            const updated = (await t.courseType.update(ctx, exact.id, { listed: true, active: true })) ?? exact;
            byId.set(updated.id, updated);
            byName.set(clean.toLowerCase(), updated);
            return updated;
          }
          return exact;
        }
        return create(clean, audience, true);
      }
      if (choice !== TYPE_ONEOFF) {
        const match = suggestCourseType(clean, regular());
        if (match) return match.type;
      }
      return exact ?? create(clean, audience, false);
    },
  };
}
