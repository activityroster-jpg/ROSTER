import { normaliseAudience, type DraftRow } from "@/lib/import/parse";

/**
 * Bookwhen API adapter. Bookwhen exposes a JSON:API at api.bookwhen.com/v2 with
 * HTTP Basic auth where the API key is the username (blank password). We read
 * upcoming events and map them to the same DraftRow shape the ICS path uses, so
 * the rest of the sync pipeline (importDrafts) is identical.
 *
 * NOTE: the mapping (mapBookwhenEvents) is unit-tested; the live fetch needs a
 * real API key to validate end-to-end.
 */

const API_BASE = "https://api.bookwhen.com/v2";

interface BookwhenEvent {
  id?: string;
  type?: string;
  attributes?: {
    title?: string;
    start_at?: string; // ISO 8601
    end_at?: string;
    location?: { address_text?: string } | string | null;
  };
}

function timePart(iso: string | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  // Bookwhen returns ISO with offset/Z; take the local wall-clock date + HH:MM.
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) return { date: "", time: "" };
  return { date: m[1]!, time: `${m[2]}:${m[3]}` };
}

/** Pure: map a Bookwhen JSON:API payload to import drafts. */
export function mapBookwhenEvents(json: unknown): DraftRow[] {
  const data = (json as { data?: BookwhenEvent[] })?.data;
  if (!Array.isArray(data)) return [];
  const rows: DraftRow[] = [];
  for (const ev of data) {
    const a = ev.attributes ?? {};
    const name = (a.title ?? "").trim();
    const start = timePart(a.start_at);
    const end = timePart(a.end_at);
    const location = typeof a.location === "string" ? a.location : a.location?.address_text ?? "";
    const base = {
      name,
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      audience: normaliseAudience("", name),
      location: (location ?? "").trim(),
      staff: "",
    };
    const issues: string[] = [];
    if (!name) issues.push("No title");
    if (!start.date) issues.push("No start date");
    rows.push({ ...base, issues });
  }
  return rows;
}

/** Fetch upcoming Bookwhen events and return import drafts. Requires an API key. */
export async function fetchBookwhenDrafts(apiKey: string): Promise<DraftRow[]> {
  const auth = "Basic " + Buffer.from(`${apiKey}:`).toString("base64");
  const res = await fetch(`${API_BASE}/events?include=location&per_page=100`, {
    headers: { Authorization: auth, Accept: "application/json" },
  });
  if (res.status === 401 || res.status === 403) throw new Error("Bookwhen rejected the API key");
  if (!res.ok) throw new Error(`Bookwhen responded ${res.status}`);
  const json = await res.json();
  return mapBookwhenEvents(json);
}
