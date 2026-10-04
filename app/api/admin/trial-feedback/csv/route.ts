import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { CONTACT_LABEL, OTHER_LABEL, TEXT_QUESTIONS, USER_COUNT_LABEL } from "@/lib/validation/trial-survey";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /^[=+\-@\t\r]/.test(s) ? `"'${s.replace(/"/g, '""')}"` : /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Every trial-end survey answer as a CSV, optionally only those happy (or not) to be contacted. */
export async function GET(req: Request) {
  await requirePlatformAdmin();
  const contact = new URL(req.url).searchParams.get("contact");
  const all = await new PlatformRepository(await getDb()).listTrialFeedback();
  const rows = contact === "yes" ? all.filter((r) => r.contactOk) : contact === "no" ? all.filter((r) => !r.contactOk) : all;
  const head = ["Submitted", "Centre", "Subdomain", ...TEXT_QUESTIONS.map((q) => q.label), USER_COUNT_LABEL, OTHER_LABEL, `${CONTACT_LABEL} (happy to be contacted)`, "Contact email", "Contact answer recorded", "Extra 30-day trial activated", "Extra trial ends"];
  const lines = [head.map(cell).join(",")];
  for (const r of rows) {
    lines.push([
      r.createdAt.toISOString(), r.centreName, r.centreSlug,
      r.mostUseful, r.leastUseful, r.wouldChange, r.missing, r.featureRequest,
      r.userCount, r.otherFeedback,
      r.contactOk ? "Yes" : "No", r.contactOk ? r.contactEmail : "", r.contactAnsweredAt.toISOString(),
      r.extraTrialGrantedAt?.toISOString() ?? "", r.extraTrialEndsAt?.toISOString() ?? "",
    ].map(cell).join(","));
  }
  const suffix = contact === "yes" ? "-contactable" : contact === "no" ? "-not-contactable" : "";
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="activityroster-trial-feedback${suffix}.csv"` },
  });
}
