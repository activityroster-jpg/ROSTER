import { getEnv } from "@/lib/cf/bindings";

/** What the nightly backup workflow reported last; shown on the Dev Center overview. */
export interface BackupStatus {
  ok: boolean;
  at: string;
  file: string | null;
  bytes: number | null;
  offsite: boolean;
  documents: boolean;
  error: string | null;
}

const KEY = "ops:last-backup";

export async function writeLastBackup(status: BackupStatus): Promise<void> {
  try { await getEnv().TENANT_CACHE.put(KEY, JSON.stringify(status)); } catch { /* status is informational */ }
}

export async function readLastBackup(): Promise<BackupStatus | null> {
  try {
    const raw = await getEnv().TENANT_CACHE.get(KEY);
    return raw ? (JSON.parse(raw) as BackupStatus) : null;
  } catch { return null; }
}

export const fmtBytes = (n: number | null | undefined): string => {
  if (!n) return "–";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};
