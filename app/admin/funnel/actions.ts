"use server";

import { revalidatePath } from "next/cache";
import { idSchema } from "@/lib/validation/actions";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";

/**
 * Put a website lead on the prospect list (Growth → Prospects), so the sales
 * follow-up runs from there. They typed their email into a box on our site
 * asking for the demo or a free month, so the basis is their own request.
 */
export async function addLeadToProspectsAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = idSchema.safeParse(formData.get("leadId"));
  if (!id.success) return;
  const platform = new PlatformRepository(await getDb());
  const lead = await platform.leadById(id.data);
  if (!lead) return;
  if ((await platform.prospectEmails()).has(lead.email.toLowerCase())) return;
  await platform.createProspect({
    name: lead.centreName?.trim() || lead.email,
    email: lead.email,
    contactName: null,
    source: `lead:${lead.source}`,
    status: "new",
    lawfulBasis: "consent",
    basisNote: `Left their email on the website (${lead.source}) on ${lead.createdAt.toISOString().slice(0, 10)}, asking for ${lead.source === "demo" ? "the demo tour" : "a free month"}.`,
    notes: lead.message ?? null,
  });
  revalidatePath("/admin/funnel");
  revalidatePath("/admin/marketing");
}
