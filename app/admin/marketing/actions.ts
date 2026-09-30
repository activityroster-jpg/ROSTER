"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { PROSPECT_STATUSES, type NewMarketingProspect, type ProspectStatus } from "@/lib/db/schema";
import { parseCsv } from "@/lib/import/parse";

export type ProspectResult = { ok: boolean; error?: string; message?: string; count?: number };

async function platform() {
  await requirePlatformAdmin();
  return new PlatformRepository(await getDb());
}

const str = (fd: FormData, k: string) => (String(fd.get(k) ?? "").trim() || null);

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
