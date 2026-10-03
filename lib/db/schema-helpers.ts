/** Re-exports used by the schedule services: drizzle operators + a few schema types. */
export { and, gte, lt, lte } from "drizzle-orm";
export type { CourseAudience, SlotCode } from "@/lib/db/schema";
export { courseSession as courseSessionTable } from "@/lib/db/schema";
