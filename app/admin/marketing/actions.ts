"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { z } from "zod";
import { LINKEDIN_STATUSES, PROSPECT_INTERACTION_KINDS, PROSPECT_STATUSES, type NewMarketingProspect, type ProspectStatus } from "@/lib/db/schema";
import { OUTREACH_TICKS, PIPELINE_META, PIPELINE_STAGES, PROSPECT_STATUS_META, letterPrinted, parseLinkedinContacts, primaryProspectStatus, stageOf, statusesForStage, toggleOutreach, topRanks, type OutreachTick, type PipelineStage } from "@/lib/marketing";
import { runLinkedinFinder } from "@/lib/marketing/linkedin-finder";
import { parseCsv } from "@/lib/import/parse";
import { addressComplete, parseProspectStatuses, primaryProspectStatus as primaryOf } from "@/lib/marketing";
import RYA_DIRECTORY from "@/lib/marketing/rya-directory.json";

export type ProspectResult = { ok: boolean; error?: string; message?: string; count?: number };

async function platform() {
  await requirePlatformAdmin();
  return new PlatformRepository(await getDb());
}

/** The repository plus who is acting, for entries written to a prospect's log. */
async function platformAs() {
  const { email } = await requirePlatformAdmin();
  return { repo: new PlatformRepository(await getDb()), email };
}

const today = () => new Date().toISOString().slice(0, 10);

/** Every page that shows a prospect's stage: the list, the board and its own page. */
function revalidateProspects(id?: string) {
  revalidatePath("/admin/marketing");
  revalidatePath("/admin/marketing/pipeline");
  if (id) revalidatePath(`/admin/marketing/${id}`);
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
  revalidateProspects(id);
  return { ok: true };
}

/**
 * Tick or untick one outreach box on the Prospects list (null = "No action",
 * which clears the postal ticks). The change is written to the prospect's log.
 */
export async function setProspectTickAction(id: string, tick: string | null, on: boolean): Promise<ProspectResult> {
  const { repo, email } = await platformAs();
  if (tick !== null && !(OUTREACH_TICKS as readonly string[]).includes(tick)) return { ok: false, error: "Unknown status" };
  const p = await repo.prospectById(id);
  if (!p) return { ok: false, error: "Not found" };
  const current = parseProspectStatuses(p.statuses, p.status);
  const next = toggleOutreach(current, tick as OutreachTick | null, Boolean(on));
  if (JSON.stringify([...next].sort()) === JSON.stringify([...current].sort())) return { ok: true };
  await repo.setProspectStatuses(id, next, primaryProspectStatus(next));
  const label = tick === null ? "No action" : PROSPECT_STATUS_META[tick as OutreachTick].label;
  await repo.addInteraction({ prospectId: id, kind: "stage", occurredOn: today(), summary: tick === null ? "Marked No action" : `${on ? "Ticked" : "Unticked"} ${label}`, author: email });
  revalidateProspects(id);
  return { ok: true };
}

/** Keep a centre in (true) or out of (false) the top 250 by hand; null follows the size estimate. */
export async function setTopPickAction(id: string, pick: boolean | null): Promise<ProspectResult> {
  const repo = await platform();
  const updated = await repo.updateProspect(id, { topPick: pick === null ? null : Boolean(pick) });
  if (!updated) return { ok: false, error: "Not found" };
  revalidateProspects(id);
  revalidatePath("/admin/marketing/linkedin");
  return { ok: true };
}

/**
 * Move a prospect to one of the board's columns: the Status dropdown on
 * the list and a drag on the board both land here, so the two always agree.
 * The move is written to the prospect's log.
 */
export async function setProspectStageAction(id: string, stage: string): Promise<ProspectResult> {
  const { repo, email } = await platformAs();
  if (!(PIPELINE_STAGES as readonly string[]).includes(stage)) return { ok: false, error: "Unknown stage" };
  const to = stage as PipelineStage;
  const p = await repo.prospectById(id);
  if (!p) return { ok: false, error: "Not found" };
  const current = parseProspectStatuses(p.statuses, p.status);
  const from = stageOf(current);
  if (from === to) return { ok: true };
  const next = statusesForStage(current, to);
  await repo.setProspectStatuses(id, next, primaryProspectStatus(next));
  await repo.addInteraction({ prospectId: id, kind: "stage", occurredOn: today(), summary: `${PIPELINE_META[from].label} → ${PIPELINE_META[to].label}`, author: email });
  revalidateProspects(id);
  return { ok: true };
}

/** The orange "engaged" vibe: they replied, met us or asked for more. */
export async function setEngagedAction(id: string, engaged: boolean): Promise<ProspectResult> {
  const repo = await platform();
  const updated = await repo.updateProspect(id, { engagedAt: engaged ? new Date() : null });
  if (!updated) return { ok: false, error: "Not found" };
  revalidateProspects(id);
  return { ok: true };
}

const text = (max: number) => z.string().trim().max(max);
const ProspectEdit = z.object({
  name: text(200).min(1, "Name is required"),
  region: text(120),
  addressLine1: text(200),
  addressLine2: text(200),
  city: text(120),
  postcode: text(20),
  country: text(80),
  email: z.union([z.literal(""), z.string().trim().email("That email address doesn't look right")]),
  website: text(300),
  linkedinUrl: text(300),
  contactName: text(120),
  contactRole: text(120),
  notes: text(5000),
}).partial();

/** Save the details edited on a prospect's page. Empty fields are cleared (country falls back to the UK). */
export async function updateProspectAction(id: string, input: unknown): Promise<ProspectResult> {
  const repo = await platform();
  const parsed = ProspectEdit.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
  const patch: Partial<Omit<NewMarketingProspect, "id" | "createdAt">> = {};
  for (const [k, v] of Object.entries(parsed.data) as [keyof z.infer<typeof ProspectEdit>, string | undefined][]) {
    if (v === undefined) continue;
    if (k === "name") patch.name = v;
    else if (k === "country") patch.country = v || "United Kingdom";
    else patch[k] = v || null;
  }
  const updated = await repo.updateProspect(id, patch);
  if (!updated) return { ok: false, error: "Not found" };
  revalidateProspects(id);
  return { ok: true, message: "Saved" };
}

const InteractionInput = z.object({
  kind: z.enum(PROSPECT_INTERACTION_KINDS).refine((k) => k !== "stage", "Stage changes are logged automatically"),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  summary: text(2000),
});

/** Which touchpoint an outgoing contact also ticks, so the stage follows what was logged. */
const TOUCHPOINT_FOR: Partial<Record<(typeof PROSPECT_INTERACTION_KINDS)[number], ProspectStatus>> = {
  letter_sent: "letter_sent",
  email_out: "email_sent",
  call: "called",
};
const ENGAGING = new Set<(typeof PROSPECT_INTERACTION_KINDS)[number]>(["email_in", "linkedin_in", "meeting"]);

/**
 * Add an entry to a prospect's log. Logging a letter, an outgoing email, a
 * LinkedIn message or a call also ticks that touchpoint; a reply or a meeting
 * marks them engaged (orange).
 */
export async function addInteractionAction(prospectId: string, input: unknown): Promise<ProspectResult> {
  const { repo, email } = await platformAs();
  const parsed = InteractionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the entry" };
  const p = await repo.prospectById(prospectId);
  if (!p) return { ok: false, error: "Not found" };
  const { kind, occurredOn, summary } = parsed.data;
  await repo.addInteraction({ prospectId, kind, occurredOn, summary: summary || null, author: email });
  const touch = TOUCHPOINT_FOR[kind];
  if (touch) {
    const current = parseProspectStatuses(p.statuses, p.status);
    if (!current.includes(touch) && !current.includes("purchased") && !current.includes("rejected")) {
      const next = Array.from(new Set([...current, touch]));
      await repo.setProspectStatuses(prospectId, next, primaryProspectStatus(next));
    }
  }
  if (ENGAGING.has(kind) && !p.engagedAt) await repo.updateProspect(prospectId, { engagedAt: new Date() });
  // LinkedIn messages move the LinkedIn tab's tracker instead of a postal tick.
  if (kind === "linkedin_out" && p.linkedinStatus === "not_contacted") await repo.updateProspect(prospectId, { linkedinStatus: "no_response" });
  if (kind === "linkedin_in" && p.linkedinStatus !== "rejected") await repo.updateProspect(prospectId, { linkedinStatus: "responded" });
  revalidateProspects(prospectId);
  return { ok: true };
}

export async function deleteInteractionAction(prospectId: string, interactionId: string): Promise<ProspectResult> {
  const repo = await platform();
  const removed = await repo.deleteInteraction(interactionId);
  if (!removed) return { ok: false, error: "Already removed" };
  revalidateProspects(prospectId);
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
  revalidateProspects();
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
  "sole trader": "soleTrader", soletrader: "soleTrader", "sole_trader": "soleTrader", individual: "soleTrader",
  basis: "lawfulBasis", "lawful basis": "lawfulBasis", "lawful_basis": "lawfulBasis",
};
const TRUE_WORDS = new Set(["yes", "y", "true", "1", "sole trader", "individual"]);
const BASIS_WORDS: Record<string, "legitimate_interests" | "consent" | "existing_customer"> = { li: "legitimate_interests", "legitimate interests": "legitimate_interests", legitimate_interests: "legitimate_interests", consent: "consent", customer: "existing_customer", "existing customer": "existing_customer", existing_customer: "existing_customer" };

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
      soleTrader: TRUE_WORDS.has((rec.soleTrader ?? "").toLowerCase()),
      lawfulBasis: BASIS_WORDS[(rec.lawfulBasis ?? "").toLowerCase()] ?? "legitimate_interests",
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
 * Pick the next N prospects with a complete postal address whose letter has not
 * been printed (not Ready to send or Letter sent, not rejected), optionally
 * only from the top 250 (biggest first). They are marked Ready to send NOW, so
 * the batch is reserved; tick Letter sent once they are posted.
 */
export async function prepareNextLettersAction(count = 10, opts: { top250?: boolean } = {}): Promise<{ ok: boolean; ids?: string[]; error?: string }> {
  const { repo, email } = await platformAs();
  const n = Math.max(1, Math.min(50, Math.round(Number(count) || 10)));
  const all = await repo.listProspects(10_000, 0);
  const ranks = topRanks(all);
  // Centres already printed — by row AND by name, so a duplicate row for the
  // same centre (e.g. imported twice) is never lettered a second time.
  const norm = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const printedNames = new Set(all.filter((p) => letterPrinted(parseProspectStatuses(p.statuses, p.status))).map((p) => norm(p.name)));
  const next = all
    .filter((p) => !opts.top250 || ranks.has(p.id))
    .filter((p) => addressComplete({ addressLine1: p.addressLine1 ?? "", city: p.city ?? "", postcode: p.postcode ?? "" }))
    .filter((p) => { const st = parseProspectStatuses(p.statuses, p.status); return !letterPrinted(st) && !st.includes("rejected") && !st.includes("purchased") && !printedNames.has(norm(p.name)); })
    .sort((a, b) => (opts.top250 ? (ranks.get(a.id) ?? 1e6) - (ranks.get(b.id) ?? 1e6) : 0) || a.createdAt.getTime() - b.createdAt.getTime() || a.name.localeCompare(b.name))
    .slice(0, n);
  if (next.length === 0) return { ok: false, error: opts.top250 ? "Every top-250 centre with a complete address has had its letter printed." : "Everyone with a complete address has had a letter printed." };
  for (const p of next) {
    const statuses = toggleOutreach(parseProspectStatuses(p.statuses, p.status), "ready_to_send", true);
    await repo.setProspectStatuses(p.id, statuses, primaryOf(statuses));
  }
  await repo.addInteractions(next.map((p) => ({ prospectId: p.id, kind: "stage" as const, occurredOn: today(), summary: "Letter printed in a batch: Ready to send", author: email })));
  revalidateProspects();
  return { ok: true, ids: next.map((p) => p.id) };
}

// --- LinkedIn tab --------------------------------------------------------------

const urlText = z.string().trim().max(300).refine((v) => v === "" || /^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\//i.test(v), "Use a linkedin.com address");
const ContactInput = z.object({ name: z.string().trim().max(120), role: z.string().trim().max(120), url: urlText }).refine((c) => c.name || c.url, "Give a name or a LinkedIn link");
const withScheme = (v: string) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v);

function revalidateLinkedin(id?: string) {
  revalidatePath("/admin/marketing/linkedin");
  if (id) revalidatePath(`/admin/marketing/${id}`);
}

/** The LinkedIn tracker for one centre. Written to its log. */
export async function setLinkedinStatusAction(id: string, status: string): Promise<ProspectResult> {
  const { repo, email } = await platformAs();
  if (!(LINKEDIN_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Unknown status" };
  const p = await repo.prospectById(id);
  if (!p) return { ok: false, error: "Not found" };
  if (p.linkedinStatus === status) return { ok: true };
  await repo.updateProspect(id, { linkedinStatus: status as (typeof LINKEDIN_STATUSES)[number] });
  await repo.addInteraction({ prospectId: id, kind: "stage", occurredOn: today(), summary: `LinkedIn: ${status.replace(/_/g, " ")}`, author: email });
  revalidateLinkedin(id);
  return { ok: true };
}

/** A centre's LinkedIn company page (empty clears it). */
export async function setLinkedinPageAction(id: string, url: string): Promise<ProspectResult> {
  const repo = await platform();
  const parsed = urlText.safeParse(url ?? "");
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the link" };
  const updated = await repo.updateProspect(id, { linkedinUrl: withScheme(parsed.data) || null });
  if (!updated) return { ok: false, error: "Not found" };
  revalidateLinkedin(id);
  return { ok: true };
}

/** Add a person found on LinkedIn for a centre (name, role, profile link). */
export async function addLinkedinContactAction(id: string, input: unknown): Promise<ProspectResult> {
  const repo = await platform();
  const parsed = ContactInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the contact" };
  const p = await repo.prospectById(id);
  if (!p) return { ok: false, error: "Not found" };
  const contacts = parseLinkedinContacts(p.linkedinContacts);
  if (contacts.length >= 20) return { ok: false, error: "Up to 20 contacts per centre" };
  contacts.push({ name: parsed.data.name, role: parsed.data.role, url: withScheme(parsed.data.url) });
  await repo.updateProspect(id, { linkedinContacts: JSON.stringify(contacts) });
  revalidateLinkedin(id);
  return { ok: true };
}

/** Remove one person from a centre's LinkedIn contacts (by position). */
export async function removeLinkedinContactAction(id: string, index: number): Promise<ProspectResult> {
  const repo = await platform();
  const p = await repo.prospectById(id);
  if (!p) return { ok: false, error: "Not found" };
  const contacts = parseLinkedinContacts(p.linkedinContacts);
  if (!Number.isInteger(index) || index < 0 || index >= contacts.length) return { ok: false, error: "Already removed" };
  contacts.splice(index, 1);
  await repo.updateProspect(id, { linkedinContacts: contacts.length ? JSON.stringify(contacts) : null });
  revalidateLinkedin(id);
  return { ok: true };
}

/** Run the website finder now for the next few centres (it also runs by itself every hour). */
export async function findLinkedinNowAction(): Promise<ProspectResult> {
  const repo = await platform();
  const r = await runLinkedinFinder(repo, 15);
  revalidateLinkedin();
  return { ok: true, count: r.checked, message: r.checked ? `Checked ${r.checked} website${r.checked === 1 ? "" : "s"}: ${r.pages} LinkedIn page${r.pages === 1 ? "" : "s"} and ${r.people} contact${r.people === 1 ? "" : "s"} found. ${r.remaining} still to check.` : "Every centre with a website has been checked." };
}

/** Lawful basis and sole-trader flag for one prospect (UK GDPR / PECR bookkeeping). */
export async function setProspectBasisAction(id: string, input: { soleTrader: boolean; lawfulBasis: string; basisNote?: string }): Promise<ProspectResult> {
  const repo = await platform();
  const basis = (["legitimate_interests", "consent", "existing_customer"] as const).find((b) => b === input.lawfulBasis) ?? "legitimate_interests";
  await repo.updateProspect(id, { soleTrader: Boolean(input.soleTrader), lawfulBasis: basis, basisNote: (input.basisNote ?? "").trim().slice(0, 200) || null });
  revalidateProspects(id);
  return { ok: true };
}
