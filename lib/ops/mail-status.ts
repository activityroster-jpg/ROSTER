import { getEnv } from "@/lib/cf/bindings";
import { providersFor, type MailProviderName } from "@/lib/mail/providers";

/** The last time email failed over to the backup provider; shown on the Dev Center overview. */
export interface MailFailover { at: string; from: MailProviderName; to: MailProviderName; error: string; count: number }

const KEY = "ops:mail-failover";

export async function recordMailFailover(from: MailProviderName, to: MailProviderName, error: string): Promise<void> {
  try {
    const kv = getEnv().TENANT_CACHE;
    const prev = await readMailFailover();
    const entry: MailFailover = { at: new Date().toISOString(), from, to, error: error.slice(0, 300), count: (prev?.count ?? 0) + 1 };
    await kv.put(KEY, JSON.stringify(entry), { expirationTtl: 30 * 24 * 3600 });
  } catch { /* informational */ }
}

export async function readMailFailover(): Promise<MailFailover | null> {
  try { const raw = await getEnv().TENANT_CACHE.get(KEY); return raw ? (JSON.parse(raw) as MailFailover) : null; } catch { return null; }
}

/** Which providers are configured, in the order they are tried. */
export function mailProviderOrder(): MailProviderName[] {
  return providersFor(getEnv());
}
