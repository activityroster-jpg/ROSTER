import { getEnv } from "@/lib/cf/bindings";

/**
 * Incident banner and maintenance mode (compliance P1-B), both a KV flag the
 * platform owner sets from the Dev Center. The banner shows on every surface;
 * maintenance replaces the office and portal with a holding page for everyone
 * except platform admins, so a fix can be deployed without people editing.
 */
export interface IncidentState { message: string; level: "info" | "warn"; updatedAt: string }
export interface MaintenanceState { on: boolean; message: string; updatedAt: string }

const INCIDENT_KEY = "ops:incident";
const MAINT_KEY = "ops:maintenance";

export async function readIncident(): Promise<IncidentState | null> {
  try { const raw = await getEnv().TENANT_CACHE.get(INCIDENT_KEY); return raw ? (JSON.parse(raw) as IncidentState) : null; } catch { return null; }
}
export async function writeIncident(state: IncidentState | null): Promise<void> {
  const kv = getEnv().TENANT_CACHE;
  if (state) await kv.put(INCIDENT_KEY, JSON.stringify(state)); else await kv.delete(INCIDENT_KEY);
}
export async function readMaintenance(): Promise<MaintenanceState | null> {
  try { const raw = await getEnv().TENANT_CACHE.get(MAINT_KEY); return raw ? (JSON.parse(raw) as MaintenanceState) : null; } catch { return null; }
}
export async function writeMaintenance(state: MaintenanceState): Promise<void> {
  await getEnv().TENANT_CACHE.put(MAINT_KEY, JSON.stringify(state));
}
