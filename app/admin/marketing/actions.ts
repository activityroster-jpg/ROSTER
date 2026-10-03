"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { PROSPECT_STATUSES, type NewMarketingProspect, type ProspectStatus } from "@/lib/db/schema";
import { primaryProspectStatus } from "@/lib/marketing";
import { parseCsv } from "@/lib/import/parse";
import { addressComplete, parseProspectStatuses, primaryProspectStatus as primaryOf } from "@/lib/marketing";
import RYA_DIRECTORY from "@/lib/marketing/rya-directory.json";

export type ProspectResult = { ok: boolean; error?: string; message?: string; count?: number };

async function platform() {
  await requirePlatformAdmin();
  return new PlatformRepository(await getDb());
}

const str = (fd: FormData, k: string) => (String(fd.get(k) ?? "").trim() || null);

/** Merge duplicate centres (same name + postcode) into one row each. */
export async function dedupeProspectsAction(): Promise<ProspectResult> {
  const p = await platform();
  const r = await p.dedupeProspects();
  revalidatePath("/admin/marketing");
  return { ok: true, count: r.removed, message: r.removed ? `Merged ${r.removed} duplicate row${r.removed === 1 ? "" : "s"} across ${r.groups} centre${r.groups === 1 ? "" : "s"}` : "No duplicates found" };
}

/** Add one prospect from the admin form. */
export async function createProspectAction(_prev: ProspectResult, fd: FormData): Promise<ProspectResult> {
  const repo = await platform();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Name is required" };
  await repo.createProspect({
    name,
    region: str(fd, "region"),
    addressLine1: str(fd, "addressLine1"),
    addressLine2: str(fd, "addressLine2"),
    city: str(fd, "city"),
    postcode: str(fd, "postcode"),
    email: str(fd, "email"),
    website: str(fd, "website"),
    linkedinUrl: str(fd, "linkedinUrl"),
    contactName: str(fd, "contactName"),
    contactRole: str(fd, "contactRole"),
    source: "manual",
  });
  revalidatePath("/admin/marketing");
  return { ok: true, message: `${name} added` };
}

/** Update a prospect's outreach status (the pipeline dropdown). */
export async function setProspectStatusAction(id: string, status: string): Promise<ProspectResult> {
  const repo = await platform();
  if (!(PROSPECT_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Unknown status" };
  const updated = await repo.setProspectStatus(id, status as ProspectStatus);
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin/marketing");
  return { ok: true };
}

/** Set the multi-select outreach statuses (the checkbox list). */
export async function setProspectStatusesAction(id: string, statuses: string[]): Promise<ProspectResult> {
  const repo = await platform();
  const clean = (statuses ?? []).filter((s): s is ProspectStatus => (PROSPECT_STATUSES as readonly string[]).includes(s));
  const updated = await repo.setProspectStatuses(id, clean, primaryProspectStatus(clean));
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin/marketing");
  return { ok: true };
}

/**
 * Add or remove one status for every prospect named in a pasted list (one name
 * per line; leading numbering like "12." or "12)" is ignored).
 */
export async function bulkStatusByNameAction(
  text: string,
  status: string,
  mode: "add" | "remove",
): Promise<ProspectResult & { unmatched?: string[] }> {
  const repo = await platform();
  if (!(PROSPECT_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Unknown status." };
  if (mode !== "add" && mode !== "remove") return { ok: false, error: "Unknown mode." };
  const names = String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+\s*[.)\-:]?\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 2000);
  if (names.length === 0) return { ok: false, error: "Paste at least one centre name, one per line." };
  const r = await repo.bulkProspectStatusByName(names, status as ProspectStatus, mode);
  revalidatePath("/admin/marketing");
  const verb = mode === "add" ? "Added" : "Removed";
  const label = status.replace(/_/g, " ");
  return {
    ok: true,
    count: r.updated,
    unmatched: r.unmatched,
    message: `${verb} “${label}” on ${r.updated} of ${r.matched} matched centre${r.matched === 1 ? "" : "s"}${r.unmatched.length ? ` · ${r.unmatched.length} name${r.unmatched.length === 1 ? "" : "s"} not found` : ""}`,
  };
}

export async function deleteProspectAction(id: string): Promise<ProspectResult> {
  const repo = await platform();
  await repo.deleteProspect(id);
  revalidatePath("/admin/marketing");
  return { ok: true };
}

const HEADER_MAP: Record<string, keyof NewMarketingProspect> = {
  name: "name", centre: "name", club: "name", organisation: "name", organization: "name",
  region: "region", area: "region", county: "region", location: "region",
  address: "addressLine1", "address 1": "addressLine1", address1: "addressLine1", "address line 1": "addressLine1", street: "addressLine1",
  "address 2": "addressLine2", address2: "addressLine2", "address line 2": "addressLine2",
  city: "city", town: "city",
  postcode: "postcode", "post code": "postcode", zip: "postcode",
  country: "country",
  email: "email", "e-mail": "email",
  website: "website", url: "website", web: "website",
  linkedin: "linkedinUrl", "linkedin url": "linkedinUrl",
  contact: "contactName", "contact name": "contactName", name_contact: "contactName", principal: "contactName", owner: "contactName", manager: "contactName",
  role: "contactRole", title: "contactRole", position: "contactRole", "contact role": "contactRole",
  notes: "notes", note: "notes",
};

/** Bulk-import prospects from pasted CSV (e.g. the public RYA training-centre directory). */
export async function importProspectsAction(csv: string): Promise<ProspectResult> {
  const repo = await platform();
  const grid = parseCsv(csv ?? "");
  if (grid.length < 2) return { ok: false, error: "Paste a table with a header row and at least one data row." };

  const headers = grid[0]!.map((h) => h.trim().toLowerCase());
  const colToField: (keyof NewMarketingProspect | null)[] = headers.map((h) => HEADER_MAP[h] ?? null);
  if (!colToField.includes("name")) return { ok: false, error: "Couldn't find a Name/Centre column in the header row." };

  const rows: Omit<NewMarketingProspect, "id" | "createdAt" | "updatedAt">[] = [];
  for (const line of grid.slice(1)) {
    const rec: Record<string, string> = {};
    colToField.forEach((field, i) => {
      if (field) rec[field] = (line[i] ?? "").trim();
    });
    if (!rec.name) continue;
    rows.push({
      name: rec.name,
      region: rec.region || null,
      addressLine1: rec.addressLine1 || null,
      addressLine2: rec.addressLine2 || null,
      city: rec.city || null,
      postcode: rec.postcode || null,
      country: rec.country || "United Kingdom",
      email: rec.email || null,
      website: rec.website || null,
      linkedinUrl: rec.linkedinUrl || null,
      contactName: rec.contactName || null,
      contactRole: rec.contactRole || null,
      notes: rec.notes || null,
      source: "import",
    });
  }
  if (rows.length === 0) return { ok: false, error: "No rows with a name to import." };
  const { inserted, skipped } = await repo.insertProspectsUnique(rows);
  revalidatePath("/admin/marketing");
  const msg =
    skipped > 0
      ? `Imported ${inserted} prospect${inserted === 1 ? "" : "s"}; skipped ${skipped} already on file.`
      : `Imported ${inserted} prospect${inserted === 1 ? "" : "s"}.`;
  return { ok: true, count: inserted, message: msg };
}

/** Seed a few clearly-fictional example prospects so the pipeline isn't empty.
 *  Real centres should be loaded via CSV import from the public RYA directory. */
export async function seedSampleProspectsAction(): Promise<ProspectResult> {
  const repo = await platform();
  if ((await repo.countProspects()) > 0) return { ok: true, message: "Already have prospects." };
  const samples: Omit<NewMarketingProspect, "id" | "createdAt" | "updatedAt">[] = [
    { name: "Example Sailing Club", region: "South West", addressLine1: "1 Harbour Road", city: "Exampleton", postcode: "EX1 1AA", country: "United Kingdom", email: "info@example-sc.test", website: "example-sc.test", contactName: "Sample Principal", contactRole: "Principal", source: "sample", status: "new" },
    { name: "Sample Watersports Centre", region: "North West", addressLine1: "Lakeside", city: "Sampletown", postcode: "SA2 2BB", country: "United Kingdom", email: "hello@sample-watersports.test", contactName: "Test Owner", contactRole: "Owner", source: "sample", status: "new" },
    { name: "Demo Youth Sailing Trust", region: "Scotland", addressLine1: "The Boathouse", city: "Demoville", postcode: "DM3 3CC", country: "United Kingdom", contactName: "Example Manager", contactRole: "Centre Manager", source: "sample", status: "new" },
  ];
  const count = await repo.insertProspects(samples);
  revalidatePath("/admin/marketing");
  return { ok: true, count, message: `Added ${count} example prospects.` };
}

/**
 * Load the bundled RYA "Where's my nearest" directory (every listed training
 * centre and club). Idempotent: centres already on the list are skipped, so
 * existing statuses (e.g. letter sent) are untouched.
 */
export async function loadRyaDirectoryAction(): Promise<ProspectResult> {
  const repo = await platform();
  const rows = (RYA_DIRECTORY as Array<Record<string, string | undefined>>).filter((r) => Boolean(r.name)).map((r) => ({
    name: r.name as string,
    region: r.region || null,
    addressLine1: r.addressLine1 || null,
    addressLine2: r.addressLine2 || null,
    city: r.city || null,
    postcode: r.postcode || null,
    country: r.country || "United Kingdom",
    email: r.email || null,
    website: r.website || null,
    linkedinUrl: r.linkedinUrl || null,
    contactName: r.contactName || null,
    contactRole: r.contactRole || null,
    notes: r.notes || null,
    source: "rya_directory",
  }));
  const { inserted, skipped } = await repo.insertProspectsUnique(rows);
  revalidatePath("/admin/marketing");
  return { ok: true, count: inserted, message: `Added ${inserted} centre${inserted === 1 ? "" : "s"} from the RYA directory${skipped ? `; ${skipped} already on your list (kept as they were)` : ""}.` };
}

/**
 * Pick the next N prospects that have a complete postal address and no letter
 * yet, mark them "letter sent" NOW (so the batch is reserved), and return their
 * ids for the printable batch page.
 */
export async function prepareNextLettersAction(count = 10): Promise<{ ok: boolean; ids?: string[]; error?: string }> {
  const repo = await platform();
  const n = Math.max(1, Math.min(50, Math.round(Number(count) || 10)));
  const all = await repo.listProspects(10_000, 0);
  // Centres that already had a letter — by row AND by name, so a duplicate row
  // for the same centre (e.g. imported twice) is never lettered a second time.
  const norm = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const letteredNames = new Set(all.filter((p) => parseProspectStatuses(p.statuses, p.status).includes("letter_sent")).map((p) => norm(p.name)));
  const next = all
    .filter((p) => addressComplete({ addressLine1: p.addressLine1 ?? "", city: p.city ?? "", postcode: p.postcode ?? "" }))
    .filter((p) => !parseProspectStatuses(p.statuses, p.status).includes("letter_sent") && !letteredNames.has(norm(p.name)))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.name.localeCompare(b.name))
    .slice(0, n);
  if (next.length === 0) return { ok: false, error: "Everyone with a complete address already has a letter marked as sent." };
  for (const p of next) {
    const statuses = Array.from(new Set([...parseProspectStatuses(p.statuses, p.status), "letter_sent" as const]));
    await repo.setProspectStatuses(p.id, statuses, primaryOf(statuses));
  }
  revalidatePath("/admin/marketing");
  return { ok: true, ids: next.map((p) => p.id) };
}
