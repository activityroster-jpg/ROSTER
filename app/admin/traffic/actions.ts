"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { TrafficRepository } from "@/lib/db/repositories/traffic";
import { idSchema } from "@/lib/validation/actions";

const Marker = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), label: z.string().trim().min(1).max(60) });

/** Add a dated marker to the traffic chart (a mailing, a post, an event). */
export async function addTrafficMarkerAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const m = Marker.safeParse({ day: formData.get("day"), label: formData.get("label") });
  if (!m.success) return;
  await new TrafficRepository(await getDb()).addMarker(m.data.day, m.data.label);
  revalidatePath("/admin/traffic");
}

export async function deleteTrafficMarkerAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  await new TrafficRepository(await getDb()).deleteMarker(id.data);
  revalidatePath("/admin/traffic");
}
