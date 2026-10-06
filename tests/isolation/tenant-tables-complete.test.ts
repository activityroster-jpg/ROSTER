import { describe, expect, it } from "vitest";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "@/lib/db/schema";
import { TENANT_TABLES } from "@/lib/db/repositories";

/**
 * Audit C6: a table with an organisation_id column is centre data, so it must
 * be in TENANT_TABLES (and so in the cross-tenant isolation test). This fails
 * CI the moment someone adds such a table and forgets the list.
 */
describe("every centre table is covered by the isolation test", () => {
  it("lists each table that has organisation_id", () => {
    const listed = new Set(TENANT_TABLES.map((t) => getTableConfig(t).name));
    const withOrg = (Object.values(schema) as unknown[])
      .filter((v): v is SQLiteTable => v instanceof SQLiteTable)
      .map((t) => getTableConfig(t))
      .filter((c) => c.columns.some((col) => col.name === "organisation_id"))
      .map((c) => c.name);
    // Control-plane tables that carry an organisation_id to say which centre a row
    // is about, reached only through ControlPlaneRepository's narrow methods.
    const controlPlane = new Set([
      "membership", // who belongs to which centre: the authorisation table itself
      "security_event", // sign-in and PIN events, shown to the superadmin and the Dev Center
      "error_report", // the platform's error log
      "trial_feedback", // the trial-end survey, read in the Dev Center
      "feature_request", // requests centres send to ActivityRoster, read in the Dev Center; the board shows only the public title
      "feature_request_vote", // "we need this too" counts, never shown by centre
    ]);
    const missing = withOrg.filter((n) => !listed.has(n) && !controlPlane.has(n));
    expect(missing, "add these to TENANT_TABLES and createTenantRepositories, or to the control-plane list here with a reason").toEqual([]);
  });
});
