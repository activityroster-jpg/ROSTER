"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { BUILTIN_PACKS } from "@/lib/rules/working-time/packs";
import { parsePack } from "@/lib/rules/working-time/schema";

type Result = { ok: boolean; error?: string; message?: string };

const keySchema = z.enum(["gb", "ni", "ie"]);

/** Save an edited pack. The JSON is validated against the pack schema; the key in the JSON must match the pack being edited. */
export async function saveRulePackAction(key: string, json: string): Promise<Result> {
  const { email } = await requirePlatformAdmin();
  const k = keySchema.safeParse(key);
  if (!k.success) return { ok: false, error: "Unknown pack" };
  if (json.length > 200_000) return { ok: false, error: "That pack is too large" };
  const parsed = parsePack(json);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (parsed.pack.key !== k.data) return { ok: false, error: `The JSON says key "${parsed.pack.key}" but you are editing "${k.data}"` };
  await new PlatformRepository(await getDb()).upsertRulePack({
    key: k.data,
    name: parsed.pack.name,
    version: parsed.pack.version,
    verified: parsed.pack.verified,
    json: JSON.stringify(parsed.pack, null, 2),
    updatedBy: email,
  });
  revalidatePath("/admin/rules");
  return { ok: true, message: `Saved ${parsed.pack.name} v${parsed.pack.version}. Every centre in that jurisdiction uses it from the next roster change.` };
}

/** Drop the edit so the built-in pack applies again. */
export async function resetRulePackAction(key: string): Promise<Result> {
  await requirePlatformAdmin();
  const k = keySchema.safeParse(key);
  if (!k.success || !BUILTIN_PACKS[k.data]) return { ok: false, error: "Unknown pack" };
  await new PlatformRepository(await getDb()).resetRulePack(k.data);
  revalidatePath("/admin/rules");
  return { ok: true, message: "Back to the built-in figures." };
}
