"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { publishWeek } from "@/lib/services/roster";
import { isoDateSchema } from "@/lib/validation/actions";

type Result = { ok: boolean; error?: string; message?: string };

/** Publish (or re-publish) one week's roster and tell everyone on it. */
export async function publishWeekAction(weekStart: string): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (!isoDateSchema.safeParse(weekStart).success) return { ok: false, error: "Invalid week" };
  const r = await publishWeek(repos, ctx, weekStart);
  revalidatePath("/office/rota");
  revalidatePath("/office/courses");
  revalidatePath("/office");
  revalidatePath("/portal");
  const n = r.instructorsNotified;
  return {
    ok: true,
    message: n
      ? `${r.republished ? "Re-published" : "Published"} — ${n} instructor${n === 1 ? "" : "s"} asked to confirm`
      : `${r.republished ? "Re-published" : "Published"} — nobody is rostered this week yet`,
  };
}
