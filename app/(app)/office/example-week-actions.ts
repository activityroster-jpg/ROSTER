"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { packFor } from "@/lib/packs";
import { clearExampleWeek, loadExampleWeek } from "@/lib/services/example-week";
import { weekStart } from "@/lib/services/schedule";

type Result = { ok: boolean; error?: string; message?: string; week?: string };

function refresh() {
  for (const p of ["/office", "/office/rota", "/office/staff", "/office/courses", "/office/onboarding", "/office/payroll"]) revalidatePath(p);
}

/** Put six made-up instructors and a week of sessions on the roster (Getting started, wizard finish step). */
export async function loadExampleWeekAction(): Promise<Result> {
  const { ctx, repos, organisation } = await requireTenant({ permission: "settings.edit" });
  const r = await loadExampleWeek(repos, ctx, { preferredCourseNames: packFor(organisation.activityType).commonCourses ?? [] });
  if (!r.ok) return r;
  refresh();
  return {
    ok: true,
    week: weekStart(new Date(`${r.from}T00:00:00Z`)),
    message: `${r.instructors} made-up instructors and ${r.sessions} sessions are on the roster${r.open ? `; ${r.open} place${r.open === 1 ? "" : "s"} still open for you to fill` : ", every place filled by Auto-roster"}.`,
  };
}

/** Take the example off again: only what it created goes. */
export async function clearExampleWeekAction(): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "settings.edit" });
  const r = await clearExampleWeek(repos, ctx);
  if (!r.ok) return r;
  refresh();
  return { ok: true, message: "The example is gone. Only what it added was removed." };
}
