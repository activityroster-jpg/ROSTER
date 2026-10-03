import type { Database } from "@/lib/db/client";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import type { WorkingTimePack } from "@/lib/domain/working-time";
import { BUILTIN_PACKS } from "./packs";
import { parsePack } from "./schema";

export interface LoadedPack { pack: WorkingTimePack; source: "builtin" | "edited"; updatedAt: Date | null; updatedBy: string | null }

/**
 * The pack a centre's checks should use: the Dev Center edit if one exists and
 * still parses, otherwise the built-in copy. Never throws — a broken override
 * falls back to the built-in pack so rostering keeps working.
 */
export async function loadPack(db: Database, key: string): Promise<LoadedPack | null> {
  const builtin = BUILTIN_PACKS[key];
  if (!builtin) return null;
  try {
    const row = await new PlatformRepository(db).getRulePack(key);
    if (row) {
      const parsed = parsePack(row.json);
      if (parsed.ok) return { pack: parsed.pack, source: "edited", updatedAt: row.updatedAt, updatedBy: row.updatedBy };
      console.error(`[rule-pack] stored pack ${key} is invalid (${parsed.error}); using built-in`);
    }
  } catch (err) {
    // Table not migrated yet, or D1 hiccup: the built-in pack still applies.
    console.error("[rule-pack] load failed:", (err as Error).message);
  }
  return { pack: builtin, source: "builtin", updatedAt: null, updatedBy: null };
}

export async function loadAllPacks(db: Database): Promise<LoadedPack[]> {
  const out: LoadedPack[] = [];
  for (const key of Object.keys(BUILTIN_PACKS)) {
    const p = await loadPack(db, key);
    if (p) out.push(p);
  }
  return out;
}
